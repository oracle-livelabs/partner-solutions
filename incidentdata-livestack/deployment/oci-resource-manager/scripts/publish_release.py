#!/usr/bin/env python3
"""Default: read-only publication plan. --publish creates private release storage.
Run publication only after approval of the reviewed cost/resource plan.
"""
import argparse,hashlib,importlib.util,json,pathlib,re
ROOT=pathlib.Path(__file__).resolve().parents[1]
def main():
    p=argparse.ArgumentParser();p.add_argument('--compartment',required=True);p.add_argument('--bucket',required=True);p.add_argument('--prefix',required=True);p.add_argument('--region',default='ap-sydney-1');p.add_argument('--profile',default='DEFAULT');p.add_argument('--publish',action='store_true');a=p.parse_args()
    if a.region!='ap-sydney-1':raise ValueError('This reviewed first-test publication targets Sydney')
    if not re.fullmatch('[a-z0-9][a-z0-9-]{2,62}',a.bucket) or not re.fullmatch('[a-zA-Z0-9][a-zA-Z0-9/_-]+',a.prefix):raise ValueError('Unsafe bucket or version prefix')
    if '..' in a.prefix:raise ValueError('Unsafe prefix')
    manifest_path=ROOT/'artifacts/release-manifest.json';data=manifest_path.read_bytes();manifest=json.loads(data)
    if manifest.get('status')!='candidate' or not manifest.get('packaging_verified'):raise ValueError('Release has not passed local packaging checks')
    spec=importlib.util.spec_from_file_location('manifest',ROOT/'scripts/release_manifest.py');module=importlib.util.module_from_spec(spec);spec.loader.exec_module(module)
    for entry in manifest['artifacts']:module.validate_entry(ROOT/'artifacts',entry)
    print(json.dumps({'action':'publish' if a.publish else 'plan_only','privateBucket':a.bucket,'prefix':a.prefix,'artifacts':len(manifest['artifacts']),'bytes':sum(e['bytes'] for e in manifest['artifacts']),'manifestSha256':hashlib.sha256(data).hexdigest()}),flush=True)
    if not a.publish:return
    import oci
    config=oci.config.from_file(profile_name=a.profile);config['region']=a.region
    client=oci.object_storage.ObjectStorageClient(config);ns=client.get_namespace().data
    try:bucket=client.get_bucket(ns,a.bucket).data
    except oci.exceptions.ServiceError as error:
        if error.status!=404:raise
        bucket=client.create_bucket(ns,oci.object_storage.models.CreateBucketDetails(name=a.bucket,compartment_id=a.compartment,public_access_type='NoPublicAccess',versioning='Enabled',freeform_tags={'application':'IncidentData','purpose':'versioned-release'})).data
    if bucket.compartment_id!=a.compartment or bucket.public_access_type!='NoPublicAccess' or bucket.versioning!='Enabled':raise ValueError('Existing bucket is outside the approved private versioned publication design')
    files=[(e['path'],e) for e in manifest['artifacts']]+[('release-manifest.json',{'sha256':hashlib.sha256(data).hexdigest(),'bytes':len(data)})]
    manager=oci.object_storage.UploadManager(client,allow_parallel_uploads=True,parallel_process_count=3)
    for name,entry in files:
        obj=a.prefix.rstrip('/')+'/'+name
        try:
            prior=client.head_object(ns,a.bucket,obj)
            if prior.headers.get('opc-meta-sha256')!=entry['sha256'] or int(prior.headers['content-length'])!=entry['bytes']:raise ValueError('Immutable release prefix already contains different content: '+name)
        except oci.exceptions.ServiceError as error:
            if error.status!=404:raise
            manager.upload_file(ns,a.bucket,obj,str(ROOT/'artifacts'/name),metadata={'sha256':entry['sha256']},content_type='application/json' if name.endswith('.json') else 'application/octet-stream')
            prior=client.head_object(ns,a.bucket,obj)
            if int(prior.headers['content-length'])!=entry['bytes'] or prior.headers.get('opc-meta-sha256')!=entry['sha256']:raise ValueError('Upload receipt mismatch')
        print(json.dumps({'uploadedOrVerified':name}),flush=True)
    print(json.dumps({'publication':'complete','namespace':ns,'bucket':a.bucket,'prefix':a.prefix}))
if __name__=='__main__':main()
