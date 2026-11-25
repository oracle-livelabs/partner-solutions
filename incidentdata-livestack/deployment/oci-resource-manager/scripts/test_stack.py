#!/usr/bin/env python3
"""Operate only the recorded short-lived test stack; never apply another stack."""
import argparse,base64,datetime,gzip,hashlib,json,os,pathlib,subprocess,time,uuid
import oci
ROOT=pathlib.Path(__file__).resolve().parents[1]
TERMINAL={'SUCCEEDED','FAILED','CANCELED'}
def save(path,value):
    tmp=path.with_suffix('.partial');tmp.write_text(json.dumps(value,indent=2)+'\n');tmp.chmod(0o600);tmp.replace(path)
def clients(state):
    config=oci.config.from_file();config['region']=state['region']
    if config['tenancy']!=state['tenancy_id'] or state['region']!='ap-sydney-1':raise ValueError('Test tenancy/region mismatch')
    return oci.resource_manager.ResourceManagerClient(config),oci.object_storage.ObjectStorageClient(config)
def guard(stack,state):
    if stack.compartment_id!=state['compartment_id'] or stack.id!=state['stack_id'] or stack.display_name!=state['stack_name'] or stack.freeform_tags.get('test_run')!=state['run_id']:raise ValueError('Test stack ownership mismatch; refusing operation')
def guard_destroy_targets(value,state):
    protected=set(state.get('protected_resource_ids',[]))
    for resource in value.get('resources',[]):
        if resource.get('mode')=='managed' and resource.get('type') in ['oci_core_instance','oci_database_autonomous_database']:
            for item in resource.get('instances',[]):
                if item.get('attributes',{}).get('id') in protected:raise ValueError('Refusing teardown: original resource appeared in test state')

def stream_save(response,path):
    with path.open('wb') as out:
        os.fchmod(out.fileno(),0o600)
        data=response.data
        if isinstance(data,str):out.write(data.encode())
        elif isinstance(data,bytes):out.write(data)
        elif hasattr(data,'raw'):
            for chunk in data.raw.stream(1048576,decode_content=False):out.write(chunk)
        elif hasattr(data,'read'):
            for chunk in iter(lambda:data.read(1048576),b''):out.write(chunk)
        else:raise ValueError('Unsupported Resource Manager download format')
def start_job(rm,state,operation):
    guard(rm.get_stack(state['stack_id']).data,state)
    models=oci.resource_manager.models
    if operation=='PLAN':details=models.CreatePlanJobOperationDetails(operation='PLAN',is_provider_upgrade_required=False)
    elif operation=='APPLY':
        prior=rm.get_job(state['plan_job']).data
        if prior.stack_id!=state['stack_id'] or prior.lifecycle_state!='SUCCEEDED' or not state.get('plan_reviewed'):raise ValueError('A successful reviewed Plan is required')
        if state.get('budget_usd')!=20 or not state.get('destroy_authorized') or not state.get('cleanup_timer_armed'):raise ValueError('Approved test budget/teardown guard missing')
        details=models.CreateApplyJobOperationDetails(operation='APPLY',execution_plan_strategy='FROM_PLAN_JOB_ID',execution_plan_job_id=state['plan_job'],is_provider_upgrade_required=False)
    else:details=models.CreateDestroyJobOperationDetails(operation='DESTROY',execution_plan_strategy='AUTO_APPROVED',is_provider_upgrade_required=False)
    return rm.create_job(models.CreateJobDetails(stack_id=state['stack_id'],display_name='incidentdata-test-'+operation.lower(),job_operation_details=details,freeform_tags={'application':'IncidentData','test_run':state['run_id']})).data

def json_download(response,path):
    stream_save(response,path);raw=path.read_bytes()
    if raw.startswith(b'\x1f\x8b'):
        path.write_bytes(gzip.decompress(raw));path.chmod(0o600)
    return json.loads(path.read_text())

def wait(rm,job_id,seconds=600):
    until=time.monotonic()+seconds;last=None
    while time.monotonic()<until:
        job=rm.get_job(job_id).data
        if job.lifecycle_state!=last:print(json.dumps({'operation':job.operation,'state':job.lifecycle_state}),flush=True);last=job.lifecycle_state
        if job.lifecycle_state in TERMINAL:return job
        time.sleep(15)
    raise RuntimeError('Job still running; resume status monitoring')

def prepare(state_path):
    if state_path.exists():raise ValueError('Test state already exists; use status')
    raw=json.loads(pathlib.Path('/tmp/incidentdata-step4-oci.json').read_text());inputs=json.loads((ROOT/'artifacts/step4-plan/inputs.auto.tfvars.json').read_text());manifest=json.loads((ROOT/'artifacts/release-manifest.json').read_text());run_id=uuid.uuid4().hex[:12]
    state={'run_id':run_id,'region':'ap-sydney-1','tenancy_id':raw['tenancy']['id'],'compartment_id':raw['compartments'][0]['id'],'stack_name':'incident-test-'+run_id[:8],'budget_usd':20,'budget_approved':True,'destroy_authorized':True,'cleanup_timer_armed':False,'created_at':datetime.datetime.now(datetime.timezone.utc).isoformat(),'release_bucket':'incidentdata-test-'+run_id,'release_prefix':'releases/'+manifest['source_commit'],'namespace':inputs['release_namespace'],'release_manifest_sha256':hashlib.sha256((ROOT/'artifacts/release-manifest.json').read_bytes()).hexdigest(),'source_commit':manifest['source_commit'],'publication_owned':False,'protected_resource_ids':[item['id'] for section in ['autonomousDatabases','instances'] for item in raw[section]]}
    save(state_path,state);rm,objects=clients(state)
    try:objects.get_bucket(state['namespace'],state['release_bucket']);raise ValueError('Dedicated test bucket already exists')
    except oci.exceptions.ServiceError as error:
        if error.status!=404:raise
    variables={k:str(v) for k,v in inputs.items()};variables.update(stack_name=state['stack_name'],release_manifest_path='../release-manifest.json',release_bucket=state['release_bucket'],release_prefix=state['release_prefix'])
    zipdata=(ROOT/'artifacts/incidentdata-resource-manager.zip').read_bytes()
    config=oci.resource_manager.models.CreateZipUploadConfigSourceDetails(config_source_type='ZIP_UPLOAD',working_directory='terraform',zip_file_base64_encoded=base64.b64encode(zipdata).decode())
    stack=rm.create_stack(oci.resource_manager.models.CreateStackDetails(compartment_id=state['compartment_id'],display_name=state['stack_name'],description='Short-lived IncidentData replication test; USD 20 approved; destroy after validation',config_source=config,variables=variables,terraform_version='1.5.x',freeform_tags={'application':'IncidentData','purpose':'short-lived-replication-test','test_run':run_id})).data
    state['stack_id']=stack.id;save(state_path,state)
    job=start_job(rm,state,'PLAN');state['plan_job']=job.id;save(state_path,state)
    print(json.dumps({'testRun':run_id,'stackId':stack.id,'planJob':job.id,'billableInfrastructureCreated':False}))

def review_plan(rm,state,path):
    job=rm.get_job(state['plan_job']).data
    if job.lifecycle_state!='SUCCEEDED':raise ValueError('Resource Manager Plan has not succeeded')
    guard(rm.get_stack(state['stack_id']).data,state)
    plan=path.parent/(state['run_id']+'-plan.json');stream_save(rm.get_job_tf_plan(job.id,tf_plan_format='JSON'),plan)
    raw=plan.read_bytes()
    if raw.startswith(b'\x1f\x8b'):
        plan.write_bytes(gzip.decompress(raw));plan.chmod(0o600)
    from review_plan import review
    value=json.loads(plan.read_text());guard_destroy_targets({'resources':[{'mode':r['mode'],'type':r['type'],'instances':[{'attributes':r['values']}]} for r in value.get('prior_state',{}).get('values',{}).get('root_module',{}).get('resources',[])]},state)
    result=review(value,plan,allow_existing=state.get('retry_plan',False),vm_recovery=bool(state.get('vm_recovery')))
    if (result['managedResourceCount']!=27) or result['inboundSshEnabled']:raise ValueError('Plan differs from short-lived test scope')
    for change in json.loads(plan.read_text())['resource_changes']:
        if change['type']=='oci_identity_dynamic_group':raise ValueError('Test must not create tenancy-level groups')
    state['plan_reviewed']=True;state['plan_additions']=result['managedAdditions'];save(path,state)
    (ROOT/'inventory/resource-manager-test-plan.json').write_text(json.dumps(result,indent=2)+'\n')
    print(json.dumps({'planReviewed':True,'adds':result['managedAdditions'],'changes':result['managedChanges'],'deletions':result['managedDeletions']}))

def publish(state,path):
    if not state.get('plan_reviewed') or not state.get('cleanup_timer_armed'):raise ValueError('Reviewed Plan and cleanup timer required')
    if hashlib.sha256((ROOT/'artifacts/release-manifest.json').read_bytes()).hexdigest()!=state['release_manifest_sha256']:raise ValueError('Test release changed since Plan')
    state['publication_owned']=True;save(path,state)
    subprocess.run(['python3',str(ROOT/'scripts/publish_release.py'),'--compartment',state['compartment_id'],'--bucket',state['release_bucket'],'--prefix',state['release_prefix'],'--publish'],check=True)
    state['published']=True;save(path,state)

def cleanup(rm,objects,state,path):
    if not state.get('destroy_authorized') or not state['stack_name'].startswith('incident-test-'):raise ValueError('Test teardown not authorised')
    if state.get('stack_deleted'):return
    if not state.get('stack_id'):
        state['stack_deleted']=True;save(path,state);return
    guard(rm.get_stack(state['stack_id']).data,state)
    jobs=oci.pagination.list_call_get_all_results(rm.list_jobs,stack_id=state['stack_id']).data
    for job in jobs:
        if job.lifecycle_state not in TERMINAL:
            rm.cancel_job(job.id);wait(rm,job.id,900)
    statejobs=[j for j in jobs if j.operation in ['APPLY','DESTROY']]
    if statejobs and not state.get('destroy_succeeded'):
        latest=sorted(statejobs,key=lambda j:j.time_created,reverse=True)[0]
        tfstate=path.parent/(state['run_id']+'-state.json')
        try:
            value=json_download(rm.get_job_tf_state(latest.id),tfstate);guard_destroy_targets(value,state)
            for res in value.get('resources',[]):
                if res['type']=='oci_objectstorage_bucket' and res['name']=='status':
                    for inst in res['instances']:
                        name=inst['attributes']['name'];bucket=objects.get_bucket(state['namespace'],name).data
                        if bucket.compartment_id!=state['compartment_id'] or bucket.freeform_tags.get('application')!='IncidentData' or not name.startswith('incidentdata-status-'):raise ValueError('Bootstrap bucket ownership mismatch')
                        entries=objects.list_objects(state['namespace'],name).data.objects
                        for obj in entries:
                            if obj.name.endswith('/bootstrap.json'):objects.delete_object(state['namespace'],name,obj.name)
        except oci.exceptions.ServiceError as error:
            if error.status!=404:raise
        job=start_job(rm,state,'DESTROY');state['destroy_job']=job.id;save(path,state)
        outcome=wait(rm,job.id,7200)
        if outcome.lifecycle_state!='SUCCEEDED':raise RuntimeError('Destroy failed; retain state and diagnose')
        state['destroy_succeeded']=True;save(path,state)
    if state.get('publication_owned'):
        try:
            bucket=objects.get_bucket(state['namespace'],state['release_bucket']).data
            if bucket.compartment_id!=state['compartment_id'] or bucket.freeform_tags.get('application')!='IncidentData' or state['release_bucket']!='incidentdata-test-'+state['run_id']:raise ValueError('Publication bucket ownership mismatch')
            collection=oci.pagination.list_call_get_all_results(objects.list_object_versions,state['namespace'],state['release_bucket']).data
            versions=collection if isinstance(collection,list) else collection.items
            for item in versions:objects.delete_object(state['namespace'],state['release_bucket'],item.name,version_id=item.version_id)
            objects.delete_bucket(state['namespace'],state['release_bucket']);state['publication_deleted']=True
        except oci.exceptions.ServiceError as error:
            if error.status!=404:raise
    rm.delete_stack(state['stack_id']);state['stack_deleted']=True;state['cleaned_at']=datetime.datetime.now(datetime.timezone.utc).isoformat();save(path,state);print('Recorded test resources destroyed; dedicated publication bucket and control stack removed')

def main():
    os.umask(0o077);p=argparse.ArgumentParser();p.add_argument('operation',choices=['prepare','review','publish','apply','status','logs','cleanup','replan']);p.add_argument('--state',type=pathlib.Path,required=True);a=p.parse_args();a.state.parent.mkdir(parents=True,exist_ok=True,mode=0o700)
    if a.operation=='prepare':prepare(a.state);return
    state=json.loads(a.state.read_text());rm,objects=clients(state)
    if a.operation=='replan':
        guard(rm.get_stack(state['stack_id']).data,state)
        if state.get('apply_job'):
            if rm.get_job(state['apply_job']).data.lifecycle_state!='FAILED':raise ValueError('Retry requires a failed Apply')
        elif state.get('published') or rm.get_job(state['plan_job']).data.lifecycle_state not in TERMINAL:
            raise ValueError('Pre-Apply replan requires a terminal Plan and unpublished release')
        if hashlib.sha256((ROOT/'artifacts/release-manifest.json').read_bytes()).hexdigest()!=state['release_manifest_sha256']:raise ValueError('Frozen test release changed')
        zipdata=(ROOT/'artifacts/incidentdata-resource-manager.zip').read_bytes()
        config=oci.resource_manager.models.UpdateZipUploadConfigSourceDetails(config_source_type='ZIP_UPLOAD',working_directory='terraform',zip_file_base64_encoded=base64.b64encode(zipdata).decode())
        rm.update_stack(state['stack_id'],oci.resource_manager.models.UpdateStackDetails(config_source=config))
        job=start_job(rm,state,'PLAN');state['previous_plan_job']=state['plan_job'];state['plan_job']=job.id;state['plan_reviewed']=False;state['retry_plan']=bool(state.get('apply_job'));save(a.state,state)
        print(json.dumps({'retryPlan':job.id,'state':job.lifecycle_state}))
    elif a.operation=='review':review_plan(rm,state,a.state)
    elif a.operation=='publish':publish(state,a.state)
    elif a.operation=='cleanup':cleanup(rm,objects,state,a.state)
    elif a.operation=='apply':
        if not state.get('published'):raise ValueError('Private release must be published first')
        job=start_job(rm,state,'APPLY');state['apply_job']=job.id;state['apply_started_at']=datetime.datetime.now(datetime.timezone.utc).isoformat();save(a.state,state);print(json.dumps({'applyJob':job.id,'state':job.lifecycle_state}))
    elif a.operation=='status':
        result={}
        for key in ['plan_job','apply_job','destroy_job']:
            if state.get(key):
                job=rm.get_job(state[key]).data;result[key]={'state':job.lifecycle_state,'operation':job.operation}
        print(json.dumps(result))
    else:
        key='apply_job' if state.get('apply_job') else 'plan_job';stream_save(rm.get_job_logs_content(state[key]),a.state.parent/(state['run_id']+'-'+key+'.log'));print('Logs saved privately; inspect only redacted excerpts')
if __name__=='__main__':
    try:main()
    except oci.exceptions.ServiceError as error:print(json.dumps({'error':'OCI operation failed','status':error.status,'code':error.code}),flush=True);raise SystemExit(1)
    except Exception as error:print(json.dumps({'error':type(error).__name__,'message':str(error) if isinstance(error,(ValueError,RuntimeError)) else 'Inspect private diagnostics'}),flush=True);raise SystemExit(1)
