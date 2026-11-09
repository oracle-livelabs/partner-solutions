#!/usr/bin/env python3
"""Read-only OCI inventory; never emits auth configuration or wallet contents."""
import argparse, json
import oci

def collect(profile='DEFAULT',expected_tenancy='apacanzset03'):
    config=oci.config.from_file(profile_name=profile)
    identity=oci.identity.IdentityClient(config)
    tenancy=identity.get_tenancy(config['tenancy']).data
    compartments=oci.pagination.list_call_get_all_results(identity.list_compartments,config['tenancy'],compartment_id_in_subtree=True,access_level='ACCESSIBLE').data
    selected=[c for c in compartments if c.name=='franco_ucci_sandbox' and c.lifecycle_state=='ACTIVE']
    result={'readOnly':True,'tenancy':{'name':tenancy.name,'id':tenancy.id},'expectedTenancy':expected_tenancy,'region':'ap-sydney-1','compartments':[{'name':c.name,'id':c.id} for c in selected], 'regionSubscriptions':[{'name':r.region_name,'status':r.status} for r in identity.list_region_subscriptions(config['tenancy']).data]}
    if tenancy.name.lower()!=expected_tenancy.lower() or len(selected)!=1:
        result['destinationVerified']=False
        return result
    result['destinationVerified']=True
    target={**config,'region':'ap-sydney-1'}
    compartment=selected[0].id
    db=oci.database.DatabaseClient(target)
    result['autonomousDatabases']=[{'name':d.display_name,'id':d.id,'databaseVersion':d.db_version,'state':d.lifecycle_state,'cpuCount':d.cpu_core_count,'ecpuCount':d.compute_count,'computeModel':d.compute_model,'storageTB':d.data_storage_size_in_tbs,'publicAccess':getattr(d,'is_access_control_enabled',None),'privateEndpoint':bool(getattr(d,'private_endpoint',None))} for d in oci.pagination.list_call_get_all_results(db.list_autonomous_databases,compartment).data]
    compute=oci.core.ComputeClient(target)
    result['instances']=[{'name':i.display_name,'id':i.id,'shape':i.shape,'state':i.lifecycle_state,'availabilityDomain':i.availability_domain} for i in oci.pagination.list_call_get_all_results(compute.list_instances,compartment).data]
    result['availabilityDomains']=[a.name for a in oci.identity.IdentityClient(target).list_availability_domains(compartment).data]
    result['genai']={}
    for region in ['ap-sydney-1','us-chicago-1']:
        try:
            client=oci.generative_ai.GenerativeAiClient({**config,'region':region})
            models=oci.pagination.list_call_get_all_results(client.list_models,compartment_id=compartment).data
            result['genai'][region]={'models':[{'id':m.id,'name':m.display_name,'vendor':m.vendor,'capabilities':m.capabilities,'state':m.lifecycle_state} for m in models]}
        except oci.exceptions.ServiceError as e:
            result['genai'][region]={'error':{'status':e.status,'code':e.code}}
    return result

if __name__=='__main__':
    parser=argparse.ArgumentParser();parser.add_argument('--profile',default='DEFAULT');parser.add_argument('--output',required=True);parser.add_argument('--expected-tenancy',default='apacanzset03');args=parser.parse_args()
    try:
        result=collect(args.profile,args.expected_tenancy)
        with open(args.output,'w') as f:json.dump(result,f,indent=2);f.write('\n')
        print(json.dumps({'destinationVerified':result['destinationVerified'],'tenancy':result['tenancy']['name'],'compartmentMatches':len(result['compartments']),'output':args.output}))
    except oci.exceptions.ServiceError as e:
        raise SystemExit(f'OCI inventory failed: HTTP {e.status} / {e.code}; no mutation attempted')
