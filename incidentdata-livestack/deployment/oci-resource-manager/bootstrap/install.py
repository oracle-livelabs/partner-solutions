#!/usr/bin/env python3
"""Destination first-boot installer. Secrets are fetched via instance identity."""
import base64,hashlib,ipaddress,json,os,pathlib,shutil,subprocess,sys,tarfile,tempfile,time,urllib.request,zipfile
BASE=pathlib.Path('/opt/incidentdata')
# Historical UI snapshots are not runtime inputs. Older release archives contain
# dependency symlinks in these trees; ignore the trees without following links.
LEGACY_SOURCE_TREES={'adelaide_v2_tile_20260917','europe_profile_tiles_20260917'}

def digest(path):
    h=hashlib.sha256()
    with path.open('rb') as f:
        for b in iter(lambda:f.read(1024*1024),b''):h.update(b)
    return h.hexdigest()

def safe_path(root,name):
    relative=pathlib.PurePosixPath(name)
    if relative.is_absolute() or '..' in relative.parts:raise ValueError('Unsafe archive path')
    target=(root/str(relative)).resolve()
    if not target.is_relative_to(root.resolve()):raise ValueError('Archive escapes installation root')
    return target

def unpack_tar(archive,target):
    target.mkdir(parents=True,exist_ok=True)
    with tarfile.open(archive,'r:gz') as stream:
        for member in stream.getmembers():
            if pathlib.PurePosixPath(member.name).parts[0] in LEGACY_SOURCE_TREES:continue
            dest=safe_path(target,member.name)
            if member.isdir():dest.mkdir(parents=True,exist_ok=True)
            elif member.isfile():
                dest.parent.mkdir(parents=True,exist_ok=True)
                with stream.extractfile(member) as src,dest.open('wb') as out:shutil.copyfileobj(src,out)
                dest.chmod(member.mode&0o755)
            else:raise ValueError('Symlink or special file in release archive')

def unpack_zip(archive,target):
    target.mkdir(parents=True,exist_ok=True)
    with zipfile.ZipFile(archive) as stream:
        for item in stream.infolist():
            dest=safe_path(target,item.filename)
            if (item.external_attr>>16)&0o170000==0o120000:raise ValueError('Symlink in ZIP release')
            if item.is_dir():dest.mkdir(parents=True,exist_ok=True)
            else:
                dest.parent.mkdir(parents=True,exist_ok=True)
                with stream.open(item) as src,dest.open('wb') as out:shutil.copyfileobj(src,out)

def run(argv,log_name):
    with (BASE/'logs'/log_name).open('ab') as log:subprocess.run(argv,check=True,stdout=log,stderr=log)

def unit(name,argv):
    # No credentials are put in unit files or command arguments.
    if any('\n' in s for s in argv):raise ValueError('Invalid service argument')
    import shlex
    command=' '.join(shlex.quote(s) for s in argv)
    text='[Unit]\nAfter=network-online.target\nWants=network-online.target\n[Service]\nType=simple\nRestart=on-failure\nRestartSec=5\nExecStart='+command+'\n[Install]\nWantedBy=multi-user.target\n'
    pathlib.Path('/etc/systemd/system/'+name+'.service').write_text(text)
    run(['systemctl','daemon-reload'],'services.log');run(['systemctl','enable','--now',name],'services.log')

def download(client,cfg,name,entry,out):
    out.parent.mkdir(parents=True,exist_ok=True)
    if out.is_file() and digest(out)==entry['sha256'] and out.stat().st_size==entry['bytes']:return
    result=client.get_object(cfg['release_namespace'],cfg['release_bucket'],cfg['release_prefix'].rstrip('/')+'/'+name)
    tmp=out.with_suffix(out.suffix+'.partial')
    with tmp.open('wb') as f:
        os.chmod(tmp,0o600)
        for chunk in result.data.raw.stream(1024*1024,decode_content=False):f.write(chunk)
    if digest(tmp)!=entry['sha256'] or tmp.stat().st_size!=entry['bytes']:raise ValueError('Release artifact integrity failure')
    tmp.replace(out)

def checked_credentials(raw,cfg):
    if len(raw)>1048576 or hashlib.sha256(raw).hexdigest()!=cfg['credentials_sha256']:raise ValueError('Bootstrap credential checksum mismatch')
    value=json.loads(raw)
    if value.get('deployment_id')!=cfg['deployment_id'] or value.get('release_sha256')!=cfg['release_sha256']:raise ValueError('Bootstrap credential identity mismatch')
    return value

def bootstrap_credentials(client,cfg,state):
    # A root-only cache supports retries after the cloud object has been retired.
    cache=state/'bootstrap-credentials.json'
    if cache.is_symlink():raise ValueError('Bootstrap cache must not be a symlink')
    if cache.exists():
        info=cache.stat()
        if info.st_uid!=os.getuid() or info.st_mode&0o077:raise ValueError('Bootstrap cache permissions are unsafe')
        return checked_credentials(cache.read_bytes(),cfg)
    response=client.get_object(cfg['status_namespace'],cfg['status_bucket'],cfg['credentials_object'])
    raw=response.data.content;value=checked_credentials(raw,cfg)
    with tempfile.NamedTemporaryFile(dir=state,prefix='.bootstrap-',delete=False) as out:
        os.fchmod(out.fileno(),0o600);out.write(raw);out.flush();os.fsync(out.fileno());temporary=pathlib.Path(out.name)
    temporary.replace(cache)
    return value

def retire_credentials(client,cfg):
    # Check content/ETag before deleting exactly the object for this deployment.
    try:response=client.get_object(cfg['status_namespace'],cfg['status_bucket'],cfg['credentials_object'])
    except Exception as error:
        if getattr(error,'status',None)==404:return
        raise
    checked_credentials(response.data.content,cfg)
    etag=response.headers.get('etag')
    if not etag:raise ValueError('Bootstrap credential ETag missing')
    client.delete_object(cfg['status_namespace'],cfg['status_bucket'],cfg['credentials_object'],if_match=etag)
    try:client.head_object(cfg['status_namespace'],cfg['status_bucket'],cfg['credentials_object'])
    except Exception as error:
        if getattr(error,'status',None)==404:return
        raise
    raise ValueError('Bootstrap credential object still exists after cleanup')

def main(config_file):
    import oci
    os.umask(0o077);cfg=json.loads(pathlib.Path(config_file).read_text())
    for folder in ['logs','release','state','state/rooms','state/transformers','state/caddy','state/caddy/data','state/caddy/config','state/ollama']:(BASE/folder).mkdir(parents=True,exist_ok=True)
    # The instance can boot before its narrowly scoped IAM policy propagates.
    signer=oci.auth.signers.InstancePrincipalsSecurityTokenSigner()
    client=oci.object_storage.ObjectStorageClient({'region':cfg['region']},signer=signer)
    request=urllib.request.Request('http://169.254.169.254/opc/v2/instance/id',headers={'Authorization':'Bearer Oracle'})
    instance_id=urllib.request.urlopen(request,timeout=10).read().decode().strip('"\n')
    def status(stage,state='running',error=None):
        record={'deployment_id':cfg['deployment_id'],'instance_id':instance_id,'release_sha256':cfg['release_sha256'],'stage':stage,'state':state,'updated_at':time.time()}
        if error:record['error']=error
        (BASE/'state/bootstrap-status.json').write_text(json.dumps(record)+'\n')
        client.put_object(cfg['status_namespace'],cfg['status_bucket'],cfg['status_object'],json.dumps(record).encode(),content_type='application/json')
    stage='release'
    try:
        for attempt in range(120):
            try:status(stage);break
            except oci.exceptions.ServiceError as error:
                if error.status not in [403,404,429] or attempt==119:raise
                time.sleep(5)
        response=client.get_object(cfg['release_namespace'],cfg['release_bucket'],cfg['release_prefix'].rstrip('/')+'/release-manifest.json')
        data=response.data.content
        if hashlib.sha256(data).hexdigest()!=cfg['release_sha256']:raise ValueError('Release manifest checksum mismatch')
        manifest=json.loads(data)
        if manifest.get('status')!='candidate':raise ValueError('Release is not a verified test candidate')
        release=BASE/'release';(release/'release-manifest.json').write_bytes(data)
        for entry in manifest['artifacts']:
            name=entry['path'];out=safe_path(release,name)
            # Dump parts are fetched and hash-checked directly inside ADB.
            if name.startswith('database/') and name.endswith('.dmp'):continue
            download(client,cfg,name,entry,out)
        stage='credentials';status(stage)
        secret=bootstrap_credentials(client,cfg,BASE/'state')
        wallet=secret['wallet_base64']
        secret={k:v for k,v in secret.items() if k!='wallet_base64'}
        config={**cfg,**secret,'wallet_dir':str(BASE/'state/wallet'),'wallet_zip':str(BASE/'state/wallet.zip'),'sqlcl':'/opt/sqlcl/bin/sql','connect_string':cfg['database_name'].lower()+'_low'}
        config['release_base_uri']='https://objectstorage.'+cfg['region']+'.oraclecloud.com/n/'+cfg['release_namespace']+'/b/'+cfg['release_bucket']+'/o/'+cfg['release_prefix'].strip('/')
        if not config['database_name'].startswith('ID') or config['database_name'].upper().endswith(('FU40','FU30')):raise ValueError('Unexpected destination name')
        (BASE/'state/wallet.zip').write_bytes(base64.b64decode(wallet));unpack_zip(BASE/'state/wallet.zip',BASE/'state/wallet')
        # Terraform writes this non-secret object after the reserved IP attaches.
        # Looking it up by a known object key avoids a VM/public-IP dependency cycle.
        runtime=None
        for attempt in range(120):
            try:
                value=client.get_object(cfg['status_namespace'],cfg['status_bucket'],cfg['runtime_object']).data.content
                candidate=json.loads(value)
                if candidate['instance_id']!=instance_id or candidate['deployment_id']!=cfg['deployment_id']:raise ValueError('Runtime configuration identity mismatch')
                public_ip=str(ipaddress.ip_address(candidate['public_ip']))
                runtime=candidate;break
            except oci.exceptions.ServiceError as error:
                if error.status not in [403,404,429]:raise
            time.sleep(5)
        if runtime is None:raise ValueError('Reserved public IP configuration was not published')
        config['public_address']=cfg.get('public_hostname') or public_ip;config['public_origin']='https://'+config['public_address'];config['application_dir']=str(BASE/'app')
        config['schema_manifest_sha256']=next(e['sha256'] for e in manifest['artifacts'] if e['path']=='database/manifest.json')
        private_config=BASE/'state/bootstrap-private.json';private_config.write_text(json.dumps(config));private_config.chmod(0o600)
        stage='runtime';status(stage)
        stamp=BASE/'state/release.sha256'
        if stamp.exists() and stamp.read_text().strip()!=cfg['release_sha256']:raise ValueError('This VM belongs to another release; use a fresh stack')
        stamp.write_text(cfg['release_sha256']+'\n')
        app=BASE/'app';unpack_tar(release/'application-source.tar.gz',app)
        bootstrap=BASE/'bootstrap';unpack_tar(release/'bootstrap.tar.gz',bootstrap)
        unpack_zip(release/'tools/sqlcl.zip',pathlib.Path('/opt'));pathlib.Path('/opt/sqlcl/bin/sql').chmod(0o755)
        run(['npm','ci','--omit=dev','--prefix',str(bootstrap)],'bootstrap-dependencies.log')
        run(['podman','build','-f',str(app/'Containerfile'),'-t','localhost/incidentdata:release',str(app)],'app-build.log')
        run(['podman','build','-f',str(bootstrap/'Containerfile.detective-worker'),'-t','localhost/incidentdata-worker:release',str(app)],'worker-build.log')
        for phase in ['schema','security','ai']:
            stage=phase;status(stage);run(['node',str(bootstrap/'database.cjs'),phase,str(private_config),str(release)],phase+'.log')
        stage='apex';status(stage);run(['node',str(bootstrap/'apex.cjs'),str(private_config),str(release)],'apex.log')
        stage='accounts';status(stage);run(['node',str(bootstrap/'accounts.cjs'),str(private_config),str(app),str(BASE/'state/accounts.json')],'accounts.log')
        associations=release/'associations'
        if associations.is_dir():shutil.copytree(associations,BASE/'state/rooms/associations',dirs_exist_ok=True)
        env={'PORT':'3001','CRIMEDATA_BIND_HOST':'127.0.0.1','PUBLIC_DEMO_AUTH':'1','PUBLIC_DEMO_ORIGIN':config['public_origin'],'PUBLIC_DEMO_ACCOUNTS_FILE':'/state/accounts.json','FRONTEND_URL':config['public_origin'],'ORACLE_USER':'CRIME_DATA','APP_SCHEMA_PASSWORD':config['schema_password'],'ORACLE_CONNECTION_STRING':config['connect_string'],'ORACLE_WALLET_LOCATION':'/wallet','ORACLE_WALLET_PASSWORD':config['wallet_password'],'OCI_AUTH_MODE':'instance_principal','OCI_COMPARTMENT_ID':cfg['compartment_ocid'],'OCI_GENAI_REGION':cfg['genai_region'],'OCI_GENAI_MODEL':'meta.llama-3.3-70b-instruct','CDR_TEXT_MODEL':'google.gemini-2.5-flash','CDR_IMAGE_MODEL':'google.gemini-2.5-flash','CDR_AUDIO_MODEL':'google.gemini-2.5-flash','CDR_LEARNING_MODEL':'xai.grok-4.6','CDR_ROOM_MODEL':'meta.llama-4-maverick-17b-128e-instruct-fp8','CDR_ROOM_REGION':cfg['genai_region'],'CDR_ROOM_ENABLED':'1','CDR_ROOM_ROOT':'/rooms','OLLAMA_BASE_URL':'http://127.0.0.1:11434','OLLAMA_MODEL':'qwen2.5-coder:14b','TRANSFORMERS_CACHE':'/cache','XDG_CACHE_HOME':'/cache','HOME':'/tmp'}
        for value in env.values():
            if '\n' in value or '\r' in value:raise ValueError('Invalid runtime environment value')
        environment=BASE/'state/runtime.env';environment.write_text(''.join(k+'='+v+'\n' for k,v in env.items()));environment.chmod(0o600)
        common=['--rm','--network','host','--cap-drop=all','--security-opt=no-new-privileges','--read-only','--tmpfs','/tmp:rw,size=1g','--env-file',str(environment),'-v',str(BASE/'state/wallet')+':/wallet:ro,z','-v',str(BASE/'state/rooms')+':/rooms:rw,z','-v',str(BASE/'state/transformers')+':/cache:rw,z']
        unit('incidentdata-app',['/usr/bin/podman','run','--name','incidentdata-app',*common,'--memory=6g','-v',str(BASE/'state/accounts.json')+':/state/accounts.json:ro,z','localhost/incidentdata:release'])
        unit('incidentdata-worker',['/usr/bin/podman','run','--name','incidentdata-worker',*common,'--memory=12g','--entrypoint','/usr/bin/flock','-e','CDR_ROOM_WORKER_LOCKED=1','-e','CDR_ROOM_MODELS=/models','-e','CDR_ROOM_PUBLIC_ROOT=/public','-v',str(release/'models')+':/models:ro,z','-v',str(app/'frontend/public')+':/public:ro,z','localhost/incidentdata-worker:release','-n','/rooms/worker.lock','node','backend/detective-room-worker.js'])
        stage='ollama';status(stage)
        unit('incidentdata-ollama',['/usr/bin/podman','run','--rm','--name','incidentdata-ollama','--network','host','--memory=12g','-e','OLLAMA_HOST=127.0.0.1:11434','-v',str(BASE/'state/ollama')+':/root/.ollama:rw,z',cfg['ollama_image']])
        for attempt in range(60):
            try:run(['podman','exec','incidentdata-ollama','ollama','list'],'ollama.log');break
            except subprocess.CalledProcessError:time.sleep(5)
        run(['podman','exec','incidentdata-ollama','ollama','pull','qwen2.5-coder:14b'],'ollama-pull.log')
        stage='https';status(stage)
        run(['python3',str(bootstrap/'gateway.py'),'--address',config['public_address'],'--out',str(BASE/'state/Caddyfile')],'gateway.log')
        unit('incidentdata-gateway',['/usr/bin/podman','run','--rm','--name','incidentdata-gateway','--network','host','-v',str(BASE/'state/Caddyfile')+':/etc/caddy/Caddyfile:ro,z','-v',str(BASE/'state/caddy/data')+':/data:rw,z','-v',str(BASE/'state/caddy/config')+':/config:rw,z','docker.io/library/caddy:2.11.2'])
        stage='acceptance';status(stage)
        accepted=BASE/'state/acceptance-passed.json'
        identity={'deployment_id':cfg['deployment_id'],'release_sha256':cfg['release_sha256'],'instance_id':instance_id}
        # A cleanup/status retry must not repeat mutating nine-city acceptance.
        if not accepted.exists() or json.loads(accepted.read_text())!=identity:
            run(['node',str(bootstrap/'verify.cjs'),str(private_config),str(release)],'acceptance.log')
            accepted.write_text(json.dumps(identity)+'\n');accepted.chmod(0o600)
        operator=next(a for a in config['participants'] if a.get('operator') and a['persona']=='statewide_admin')
        authorization=base64.b64encode((operator['username']+':'+operator['password']).encode()).decode()
        health=urllib.request.Request(config['public_origin']+'/api/health',headers={'Authorization':'Basic '+authorization})
        with urllib.request.urlopen(health,timeout=30) as response:
            if json.load(response).get('status')!='healthy':raise ValueError('Public application health check failed')
        stage='credential-cleanup';status(stage)
        retire_credentials(client,cfg)
        status('complete','ready')
    except Exception as error:
        # Never serialize SDK request objects, private config, SQL or credentials.
        code=getattr(error,'code',None) or type(error).__name__
        try:status(stage,'failed',str(code))
        finally:raise RuntimeError('Bootstrap failed in '+stage+' ('+str(code)+')') from None

if __name__=='__main__':
    try:main(sys.argv[1])
    except Exception as error:print(str(error),file=sys.stderr);raise SystemExit(1)
