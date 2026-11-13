import base64,gzip,importlib.util,io,json,pathlib,tarfile,tempfile,unittest,hashlib,types
ROOT=pathlib.Path(__file__).resolve().parents[1]
def module(name,path):
    spec=importlib.util.spec_from_file_location(name,path);obj=importlib.util.module_from_spec(spec);spec.loader.exec_module(obj);return obj
install=module('install',ROOT/'bootstrap/install.py');gateway=module('gateway',ROOT/'bootstrap/gateway.py');wait=module('wait',ROOT/'scripts/wait_ready.py')
class BootstrapTest(unittest.TestCase):
    def test_release_paths_cannot_escape(self):
        with tempfile.TemporaryDirectory() as d:
            root=pathlib.Path(d)
            for value in ['../outside','/etc/shadow','models/../../outside']:
                with self.assertRaises(ValueError):install.safe_path(root,value)
            (root/'link').symlink_to('/tmp')
            with self.assertRaises(ValueError):install.safe_path(root,'link/escape')
            self.assertEqual(install.safe_path(root,'models/model.bin'),root/'models/model.bin')
    def test_archive_rejects_links_and_traversal(self):
        with tempfile.TemporaryDirectory() as d:
            root=pathlib.Path(d)
            for name,kind in [('../escape',tarfile.REGTYPE),('link',tarfile.SYMTYPE),('pipe',tarfile.FIFOTYPE)]:
                archive=root/'bad.tar.gz'
                with tarfile.open(archive,'w:gz') as t:
                    info=tarfile.TarInfo(name);info.type=kind;info.linkname='/etc';t.addfile(info,io.BytesIO())
                with self.assertRaises(ValueError):install.unpack_tar(archive,root/'dest')
    def test_unused_legacy_tree_is_ignored_without_following_links(self):
        with tempfile.TemporaryDirectory() as d:
            root=pathlib.Path(d);archive=root/'legacy.tar.gz'
            with tarfile.open(archive,'w:gz') as t:
                link=tarfile.TarInfo('adelaide_v2_tile_20260917/frontend/node_modules');link.type=tarfile.SYMTYPE;link.linkname='/etc';t.addfile(link)
                file=tarfile.TarInfo('backend/app.js');file.size=2;t.addfile(file,io.BytesIO(b'ok'))
            install.unpack_tar(archive,root/'dest')
            self.assertFalse((root/'dest/adelaide_v2_tile_20260917').exists())
            self.assertEqual((root/'dest/backend/app.js').read_bytes(),b'ok')
    def test_public_ip_has_explicit_short_certificate_profile(self):
        text=gateway.configuration('192.0.2.10');self.assertIn('profile shortlived',text);self.assertIn('header_up -X-Demo-User',text)
        self.assertNotIn('profile shortlived',gateway.configuration('demo.example.com'))
        for value in ['example.com { evil','https://example.com','127.0.0.1\n}']:
            with self.assertRaises(ValueError):gateway.configuration(value)
    def test_callback_bound_to_release_and_instance(self):
        good={'deployment_id':'a','instance_id':'b','release_sha256':'c','state':'ready'}
        self.assertTrue(wait.accepted(good,'a','b','c'))
        for key in ['deployment_id','instance_id','release_sha256']:
            altered={**good,key:'other'};self.assertFalse(wait.accepted(altered,'a','b','c'))
class ServiceFailure(Exception):
    def __init__(self,status):self.status=status
class FakeStorage:
    def __init__(self,body):self.body=body;self.deleted=[];self.deny=False
    def get_object(self,*args):
        if self.body is None:raise ServiceFailure(404)
        return types.SimpleNamespace(data=types.SimpleNamespace(content=self.body),headers={'etag':'revision-1'})
    def delete_object(self,*args,**kwargs):
        if self.deny:raise ServiceFailure(403)
        if kwargs!={'if_match':'revision-1'}:raise AssertionError('ETag not enforced')
        self.deleted.append(args);self.body=None
    def head_object(self,*args):
        if self.body is None:raise ServiceFailure(404)
        return object()
class CredentialDeliveryTest(unittest.TestCase):
    def settings(self):
        raw=json.dumps({'deployment_id':'demo','release_sha256':'release','schema_password':'synthetic-test-secret'}).encode()
        return raw,{'deployment_id':'demo','release_sha256':'release','credentials_sha256':hashlib.sha256(raw).hexdigest(),'status_namespace':'ns','status_bucket':'private','credentials_object':'demo/bootstrap.json'}
    def test_private_cache_survives_cloud_retirement(self):
        raw,cfg=self.settings();client=FakeStorage(raw)
        with tempfile.TemporaryDirectory() as directory:
            state=pathlib.Path(directory);value=install.bootstrap_credentials(client,cfg,state)
            self.assertEqual((state/'bootstrap-credentials.json').stat().st_mode&0o777,0o600)
            install.retire_credentials(client,cfg)
            self.assertEqual(client.deleted,[('ns','private','demo/bootstrap.json')])
            self.assertEqual(install.bootstrap_credentials(client,cfg,state),value)
            install.retire_credentials(client,cfg)
    def test_mismatched_payload_never_cached_or_deleted(self):
        raw,cfg=self.settings();client=FakeStorage(raw+b' ')
        with tempfile.TemporaryDirectory() as directory:
            with self.assertRaises(ValueError):install.bootstrap_credentials(client,cfg,pathlib.Path(directory))
            self.assertFalse(list(pathlib.Path(directory).iterdir()))
        with self.assertRaises(ValueError):install.retire_credentials(client,cfg)
        self.assertFalse(client.deleted)
        wrong={**cfg,'deployment_id':'another'}
        with self.assertRaises(ValueError):install.checked_credentials(raw,wrong)
    def test_failed_cleanup_and_unsafe_cache_fail_closed(self):
        raw,cfg=self.settings();client=FakeStorage(raw);client.deny=True
        with self.assertRaises(ServiceFailure):install.retire_credentials(client,cfg)
        with tempfile.TemporaryDirectory() as directory:
            cache=pathlib.Path(directory)/'bootstrap-credentials.json';cache.write_bytes(raw);cache.chmod(0o644)
            with self.assertRaises(ValueError):install.bootstrap_credentials(client,cfg,pathlib.Path(directory))
class TestStackOwnershipTest(unittest.TestCase):
    def test_cleanup_guard_refuses_other_stacks(self):
        runner=module('test_stack',ROOT/'scripts/test_stack.py')
        state={'compartment_id':'sandbox','stack_id':'test-stack','stack_name':'incident-test-example','run_id':'example'}
        stack=types.SimpleNamespace(compartment_id='sandbox',id='test-stack',display_name='incident-test-example',freeform_tags={'test_run':'example'})
        runner.guard(stack,state)
        for attribute,replacement in [('compartment_id','production'),('id','original-stack'),('display_name','original-demo'),('freeform_tags',{'test_run':'other'})]:
            old=getattr(stack,attribute);setattr(stack,attribute,replacement)
            with self.assertRaises(ValueError):runner.guard(stack,state)
            setattr(stack,attribute,old)
    def test_resource_manager_download_supports_text_and_binary(self):
        runner=module('test_stack_download',ROOT/'scripts/test_stack.py')
        with tempfile.TemporaryDirectory() as directory:
            for n,payload in enumerate(['safe log',b'safe binary',io.BytesIO(b'safe stream')]):
                target=pathlib.Path(directory)/str(n);runner.stream_save(types.SimpleNamespace(data=payload),target)
                self.assertEqual(target.stat().st_mode&0o777,0o600)
                self.assertTrue(target.read_bytes().startswith(b'safe '))
    def test_teardown_protects_original_vm_and_database(self):
        runner=module('test_stack_targets',ROOT/'scripts/test_stack.py')
        state={'protected_resource_ids':['original-vm','fu40-database']}
        for kind,identifier in [('oci_core_instance','original-vm'),('oci_database_autonomous_database','fu40-database')]:
            value={'resources':[{'mode':'managed','type':kind,'instances':[{'attributes':{'id':identifier}}]}]}
            with self.assertRaises(ValueError):runner.guard_destroy_targets(value,state)
        runner.guard_destroy_targets({'resources':[{'mode':'managed','type':'oci_core_instance','instances':[{'attributes':{'id':'new-test-vm'}}]}]},state)
    def test_compressed_resource_manager_state_is_readable_and_private(self):
        runner=module('test_stack_compressed',ROOT/'scripts/test_stack.py')
        with tempfile.TemporaryDirectory() as directory:
            target=pathlib.Path(directory)/'state.json'
            value=runner.json_download(types.SimpleNamespace(data=gzip.compress(b'{"resources":[]}')),target)
            self.assertEqual(value,{'resources':[]});self.assertEqual(target.stat().st_mode&0o777,0o600)
class RetryPlanTest(unittest.TestCase):
    def fixture(self):
        data={
            'oci_core_security_list.demo':{'ingress_security_rules':[{'protocol':'6','source':'0.0.0.0/0','tcp_options':[{'min':p,'max':p}]} for p in [80,443]]},
            'oci_database_autonomous_database.demo':{'is_mtls_connection_required':True,'is_auto_scaling_enabled':False,'is_auto_scaling_for_storage_enabled':False,'db_workload':'OLTP','db_version':'23ai','compute_model':'ECPU','compute_count':2,'data_storage_size_in_gb':100},
            'oci_core_instance.demo':{'metadata':{'user_data':base64.b64encode(gzip.compress(b'#!/bin/bash\ntrue\n')).decode()},'shape':'VM.Standard.E4.Flex','shape_config':[{'ocpus':4,'memory_in_gbs':32}],'source_details':[{'boot_volume_size_in_gbs':100,'source_id':'new-image'}]},
            'oci_objectstorage_bucket.status':{'access_type':'NoPublicAccess'},
            'oci_objectstorage_preauthrequest.bootstrap_write':{'access_type':'ObjectWrite'},
            'oci_objectstorage_preauthrequest.status':{'access_type':'ObjectRead'}}
        return {'terraform_version':'1.5.7','resource_changes':[{'address':key,'type':key.split('.')[0],'mode':'managed','change':{'actions':['no-op'],'after':value}} for key,value in data.items()]}
    def review(self,value,**kwargs):
        reviewer=module('retry_reviewer',ROOT/'scripts/review_plan.py')
        with tempfile.TemporaryDirectory() as directory:
            p=pathlib.Path(directory)/'plan.json';p.write_text(json.dumps(value));return reviewer.review(value,p,allow_existing=True,**kwargs)
    def test_metadata_size_checked_before_apply(self):
        value=self.fixture();self.assertLess(self.review(value)['vm']['metadataBytes'],32000)
        value['resource_changes'][2]['change']['after']['metadata']['ssh_authorized_keys']='x'*32000
        with self.assertRaises(ValueError):self.review(value)
    def test_unknown_metadata_requires_deferred_vm_precondition(self):
        value=self.fixture();vm=value['resource_changes'][2]
        del vm['change']['after']['metadata'];vm['change']['after_unknown']={'metadata':True}
        with self.assertRaises(ValueError):self.review(value)
        value['checks']=[{'address':{'to_display':'oci_core_instance.demo'},'status':'unknown'}]
        result=self.review(value)
        self.assertIsNone(result['vm']['metadataBytes'])
        self.assertEqual(result['vm']['metadataCheck'],'terraform-precondition-at-apply')
    def test_recovery_keeps_all_data_artifacts_and_deployment_identity(self):
        value=self.fixture();manifest={'status':'candidate','acceptance_contract_sha256':'a'*64,'artifacts':[{'path':'database/part-'+str(i),'sha256':'b'*64,'bytes':100} for i in range(30)]}
        gate={'address':'terraform_data.release_gate','type':'terraform_data','mode':'managed','change':{'actions':['update'],'before':{'input':manifest},'after':{'input':json.loads(json.dumps(manifest))}}}
        value['resource_changes'].append(gate);self.review(value,vm_recovery=True)
        gate['change']['after']['input']['artifacts'][0]['sha256']='c'*64
        with self.assertRaises(ValueError):self.review(value,vm_recovery=True)
        value=self.fixture();upload={'address':'terraform_data.bootstrap_credentials','type':'terraform_data','mode':'managed','change':{'actions':['delete','create'],'before':{'triggers_replace':['same-deployment','a'*64]},'after':{'triggers_replace':['same-deployment','b'*64]}}};value['resource_changes'].append(upload);self.review(value,vm_recovery=True)
        upload['change']['after']['triggers_replace'][0]='other-deployment'
        with self.assertRaises(ValueError):self.review(value,vm_recovery=True)
    def test_recovery_only_restores_reviewed_web_ingress(self):
        value=self.fixture();network=value['resource_changes'][0];network['change']['actions']=['update'];network['change']['before']={'ingress_security_rules':[]}
        self.review(value,vm_recovery=True)
        network['change']['after']['egress_security_rules']=[{'protocol':'all','destination':'0.0.0.0/0'}]
        with self.assertRaises(ValueError):self.review(value,vm_recovery=True)
    def test_recovery_does_not_allow_database_or_vm_replacement(self):
        for address in ['oci_core_instance.demo','oci_database_autonomous_database.demo']:
            value=self.fixture();next(r for r in value['resource_changes'] if r['address']==address)['change']['actions']=['delete','create']
            with self.assertRaises(ValueError):self.review(value,vm_recovery=True)
        value=self.fixture();value['resource_changes'].append({'address':'oci_core_public_ip.demo','type':'oci_core_public_ip','mode':'managed','change':{'actions':['update'],'after':{}}})
        with self.assertRaises(ValueError):self.review(value)
        self.assertEqual(self.review(value,vm_recovery=True)['managedChanges'],1)
if __name__=='__main__':unittest.main()
