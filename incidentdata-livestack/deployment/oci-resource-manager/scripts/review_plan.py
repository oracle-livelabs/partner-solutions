#!/usr/bin/env python3
"""Produce an allowlisted, secret-free review of a protected Terraform JSON Plan."""
import argparse,base64,collections,datetime,gzip,hashlib,json,pathlib

def review(value,plan_file,allow_existing=False,vm_recovery=False):
    changes=value.get('resource_changes',[]);managed=[r for r in changes if r['mode']=='managed']
    def permitted(resource):
        actions=resource['change']['actions']
        if actions in ([['create'],['no-op']] if allow_existing else [['create']]):return True
        if not vm_recovery:return False
        if resource['address']=='oci_core_security_list.demo' and actions==['update']:
            before=resource['change']['before'];after=resource['change']['after']
            same=all(before.get(k)==after.get(k) for k in set(before)|set(after) if k!='ingress_security_rules')
            rules=after.get('ingress_security_rules',[])
            web=sorted((r.get('protocol'),r.get('source'),r.get('tcp_options',[{}])[0].get('min'),r.get('tcp_options',[{}])[0].get('max')) for r in rules)
            return same and not before.get('ingress_security_rules') and web==[('6','0.0.0.0/0',80,80),('6','0.0.0.0/0',443,443)]
        if resource['address']=='terraform_data.release_gate' and actions==['update']:
            before=resource['change']['before'].get('input',{});after=resource['change']['after'].get('input',{})
            immutable=lambda value:{a['path']:(a['sha256'],a['bytes']) for a in value.get('artifacts',[]) if a['path'] not in ['application-source.tar.gz','bootstrap.tar.gz']}
            return before.get('status')==after.get('status')=='candidate' and len(immutable(before))>=30 and immutable(before)==immutable(after) and before.get('acceptance_contract_sha256')==after.get('acceptance_contract_sha256')
        if resource['address']=='terraform_data.bootstrap_credentials' and actions==['delete','create']:
            before=resource['change']['before'].get('triggers_replace',[]);after=resource['change']['after'].get('triggers_replace',[])
            return len(before)==len(after)==2 and before[0]==after[0] and all(isinstance(v,str) and len(v)==64 and all(c in '0123456789abcdef' for c in v) for v in [before[1],after[1]])
        if resource['address'] in ['oci_identity_policy.runtime','oci_core_public_ip.demo','oci_objectstorage_object.runtime'] and actions==['update']:return True
        if resource['address']=='oci_objectstorage_object.runtime' and actions==['delete','create']:
            before=resource['change']['before'];after=resource['change']['after']
            return all(before.get(k)==after.get(k) for k in ['namespace','bucket','object']) and str(after.get('object','')).endswith('/runtime.json')
        return resource['address']=='terraform_data.readiness' and actions==['delete','create']
    if not managed or not all(permitted(r) for r in managed):raise ValueError('Plan includes an unreviewed update, replacement or deletion')
    if any(r['type']=='oci_identity_dynamic_group' for r in managed):raise ValueError('Direct-principal demo must not create tenancy-level dynamic groups')
    resources={r['address']:r['change']['after'] for r in managed}
    network=resources['oci_core_security_list.demo'];ports=[]
    for rule in network['ingress_security_rules']:
        tcp=rule.get('tcp_options',[])
        if rule['protocol']!='6' or len(tcp)!=1 or tcp[0]['min']!=tcp[0]['max']:raise ValueError('Unexpected ingress rule')
        port=tcp[0]['min'];source=rule['source'];ports.append({'port':port,'source':source})
        if port not in [80,443,22] or port==22 and source=='0.0.0.0/0':raise ValueError('Unexpected public service or unrestricted SSH')
    db=resources['oci_database_autonomous_database.demo'];vm=resources['oci_core_instance.demo']
    metadata=vm.get('metadata');metadata_bytes=None
    if metadata is not None:
        metadata_bytes=len(json.dumps(metadata,separators=(',',':')).encode())
        if metadata_bytes>=32000:raise ValueError('VM metadata exceeds OCI launch limit')
        startup=base64.b64decode(metadata['user_data'],validate=True)
        if startup.startswith(b'\x1f\x8b'):startup=gzip.decompress(startup)
        if not startup.startswith(b'#!/bin/bash\n'):raise ValueError('VM startup payload is not a valid bootstrap script')
    else:
        # Fresh ADB URL and credential checksum do not exist until Apply.
        # Require the exact size gate in the deployed Terraform configuration.
        change=next(r for r in managed if r['address']=='oci_core_instance.demo')
        conditions=value.get('checks',[])
        gated=any(c.get('address',{}).get('to_display')=='oci_core_instance.demo' and c.get('status')=='unknown' for c in conditions)
        if change['change'].get('after_unknown',{}).get('metadata') is not True or not gated:
            raise ValueError('Unknown VM metadata requires its deferred Terraform precondition')
    if not db['is_mtls_connection_required'] or db['is_auto_scaling_enabled'] or db['is_auto_scaling_for_storage_enabled']:raise ValueError('Database mTLS/autoscaling differs from reviewed assumptions')
    if resources['oci_objectstorage_bucket.status']['access_type']!='NoPublicAccess':raise ValueError('Bootstrap storage is public')
    if any(r['type'].startswith(('oci_kms_','oci_vault_')) for r in managed):raise ValueError('Vault resources are not part of the short-lived demo design')
    upload=resources['oci_objectstorage_preauthrequest.bootstrap_write'];status=resources['oci_objectstorage_preauthrequest.status']
    if upload['access_type']!='ObjectWrite' or status['access_type']!='ObjectRead':raise ValueError('Bootstrap upload/status PAR scope differs from design')
    if any(r['address']=='oci_objectstorage_object.credentials' for r in managed):raise ValueError('Credential object must not be recreated by Terraform refresh')
    previous=value.get('prior_state',{}).get('values',{}).get('root_module',{}).get('resources',[])
    if not allow_existing and any(r['mode']=='managed' for r in previous):raise ValueError('Plan did not start from an empty managed-resource state')
    images=next((r['values']['images'] for r in previous if r['address']=='data.oci_core_images.oracle_linux'),[])
    image=images[0] if images else {}
    return {'checkedAt':datetime.datetime.now(datetime.timezone.utc).isoformat(),'terraformVersion':value['terraform_version'],'planJsonSha256':hashlib.sha256(plan_file.read_bytes()).hexdigest(),'managedAdditions':sum('create' in r['change']['actions'] for r in managed),'managedResourceCount':len(managed),'managedChanges':sum(r['change']['actions']==['update'] for r in managed),'managedDeletions':sum('delete' in r['change']['actions'] for r in managed),'managedPriorStateResources':sum(r['mode']=='managed' for r in previous),'ociProviderResources':sum(r['type'].startswith('oci_') for r in managed),'releasePublicationSeparate':True,'inboundRules':sorted(ports,key=lambda p:p['port']),'inboundSshEnabled':any(p['port']==22 for p in ports),'vm':{'metadataBytes':metadata_bytes,'metadataCheck':'verified-plan-value' if metadata is not None else 'terraform-precondition-at-apply','shape':vm['shape'],'ocpus':vm['shape_config'][0]['ocpus'],'memoryGB':vm['shape_config'][0]['memory_in_gbs'],'bootGB':vm['source_details'][0]['boot_volume_size_in_gbs'],'imageName':image.get('display_name'),'imageIdSha256':hashlib.sha256(vm['source_details'][0]['source_id'].encode()).hexdigest()},'adb':{'workload':db['db_workload'],'apiVersion':db['db_version'],'computeModel':db['compute_model'],'ecpus':db['compute_count'],'storageGB':db['data_storage_size_in_gb'],'publicNetworkEndpoint':True,'mandatoryMtls':True,'computeAutoscaling':False,'storageAutoscaling':False},'resources':[{'address':r['address'],'type':r['type'],'actions':r['change']['actions']} for r in managed],'planSucceeded':True,'applyRun':False,'deploymentReady':False,'notes':['A successful Plan does not reserve capacity or prove resource creation permissions.','Private release publication, approved spending/retention and service-limit clearance are required before Apply.']}

def main():
    p=argparse.ArgumentParser();p.add_argument('--plan-json',type=pathlib.Path,required=True);p.add_argument('--output',type=pathlib.Path,required=True);a=p.parse_args()
    result=review(json.loads(a.plan_json.read_text()),a.plan_json);a.output.write_text(json.dumps(result,indent=2)+'\n');print(json.dumps({k:result[k] for k in ['terraformVersion','managedAdditions','managedChanges','managedDeletions','planSucceeded','deploymentReady']}))
if __name__=='__main__':main()
