#!/usr/bin/env python3
"""Build local private release and small Resource Manager ZIP; never upload/apply."""
import hashlib,importlib.util,json,pathlib,shutil,subprocess,tarfile,zipfile
ROOT=pathlib.Path(__file__).resolve().parents[1];REPO=ROOT.parents[1];ART=ROOT/'artifacts'
def sha(path):
    h=hashlib.sha256()
    with path.open('rb') as f:
        for b in iter(lambda:f.read(1048576),b''):h.update(b)
    return h.hexdigest()
def main():
    audit=json.loads((ROOT/'inventory/database-export-audit.json').read_text())
    if audit.get('status')!='passed' or audit.get('restoreTested') is not False:raise ValueError('Current encrypted schema audit must pass; restore remains a target test')
    db=json.loads((ART/'database/manifest.json').read_text())
    if db.get('prefix')!=audit.get('exportPrefix'):raise ValueError('Audit belongs to another export')
    for entry in db['files']:
        filename=entry['file']
        if not filename.startswith(db['prefix']) or '/' in filename or '\\' in filename:raise ValueError('Invalid database artifact name')
        file=ART/'database'/filename
        if not file.is_file() or file.stat().st_size!=entry['bytes'] or sha(file)!=entry['sha256']:raise ValueError('Database export file failed source manifest verification')
    orm=json.loads((ROOT/'inventory/resource-manager-schema.json').read_text())
    if not orm.get('passed') or orm.get('schemaSha256')!=sha(ROOT/'schema.yaml'):raise ValueError('Resource Manager UI schema not validated')
    checks=json.loads((ROOT/'inventory/local-validation.json').read_text())
    if checks.get('status')!='passed':raise ValueError('Local validation has not passed')
    changes=subprocess.check_output(['git','status','--porcelain','--untracked-files=no'],cwd=REPO,text=True)
    if any(line[3:].split('/')[0] in ['backend','frontend','detective-worker','test','demos','Containerfile','package.json','package-lock.json'] for line in changes.splitlines()):raise ValueError('Commit application changes before building an immutable release')
    commit=subprocess.check_output(['git','rev-parse','HEAD'],cwd=REPO,text=True).strip()
    source_paths=subprocess.check_output(['git','ls-tree','--name-only',commit],cwd=REPO,text=True).splitlines()
    source_paths=[p for p in source_paths if p not in ['adelaide_v2_tile_20260917','europe_profile_tiles_20260917']]
    with (ART/'application-source.tar.gz').open('wb') as out:subprocess.run(['git','archive','--format=tar.gz',commit,'--',*source_paths],cwd=REPO,stdout=out,check=True)
    with tarfile.open(ART/'application-source.tar.gz') as archive:
        if any(not(m.isfile() or m.isdir()) for m in archive):raise ValueError('Runtime source archive contains a symlink or special file')
    with tarfile.open(ART/'bootstrap.tar.gz','w:gz') as archive:
        for p in sorted((ROOT/'bootstrap').glob('*')):
            if p.is_file() and p.suffix in ['.cjs','.py','.json','.sql']:archive.add(p,arcname=p.name)
        archive.add(ROOT/'Containerfile.detective-worker',arcname='Containerfile.detective-worker')
    shutil.copyfile(ROOT/'inventory/source-baseline.json',ART/'baseline.json')
    contract=ROOT/'acceptance-contract.json';shutil.copyfile(contract,ART/'acceptance-contract.json')
    paths=[ART/'application-source.tar.gz',ART/'bootstrap.tar.gz',ART/'baseline.json',ART/'acceptance-contract.json',ART/'ai/configuration.json',ART/'apex/manifest.json',ART/'tools/sqlcl.zip',ART/'database/manifest.json',ART/'database/security-baseline.json']
    paths += sorted((ART/'apex').glob('f*.sql'))+sorted((ART/'models').glob('*'))+sorted((ART/'associations').glob('*.json'))
    paths += [ART/'database'/f['file'] for f in db['files'] if f['file'].endswith('.dmp')]
    for p in paths:
        if not p.is_file() or p.is_symlink():raise ValueError('Missing or linked artifact: '+str(p))
    entries=[{'path':str(p.relative_to(ART)),'sha256':sha(p),'bytes':p.stat().st_size} for p in paths]
    value={'version':1,'status':'candidate','packaging_verified':True,'bootstrap_verified':False,'source_commit':commit,'acceptance_contract_sha256':sha(contract),'destination_restore_tested':False,'artifacts':entries}
    manifest=ART/'release-manifest.json';manifest.write_text(json.dumps(value,indent=2)+'\n');manifest.chmod(0o600)
    (ROOT/'inventory/artifact-index.json').write_text(json.dumps(value,indent=2)+'\n')
    with zipfile.ZipFile(ART/'incidentdata-resource-manager.zip','w',compression=zipfile.ZIP_DEFLATED) as bundle:
        for p in sorted((ROOT/'terraform').iterdir()):
            if p.is_file() and (p.suffix=='.tf' or p.name=='.terraform.lock.hcl'):bundle.write(p,'terraform/'+p.name)
        for name in ['install.py','firstboot.sh.tftpl']:bundle.write(ROOT/'bootstrap'/name,'bootstrap/'+name)
        bundle.write(ROOT/'scripts/wait_ready.py','scripts/wait_ready.py');bundle.write(ROOT/'scripts/upload_bootstrap.py','scripts/upload_bootstrap.py');bundle.write(ROOT/'schema.yaml','terraform/schema.yaml');bundle.write(manifest,'release-manifest.json');bundle.write(ROOT/'RUNBOOK.md','RUNBOOK.md')
    print(json.dumps({'status':'candidate','artifacts':len(entries),'payloadBytes':sum(e['bytes'] for e in entries),'resourceManagerZipBytes':(ART/'incidentdata-resource-manager.zip').stat().st_size,'sourceCommit':commit,'manifestSha256':sha(manifest),'provisioned':False}))
if __name__=='__main__':main()
