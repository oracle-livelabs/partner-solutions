#!/usr/bin/env python3
"""Local validation only: no OCI create/update, publication, Plan or Apply."""
import argparse,hashlib,json,pathlib,subprocess,sys,time
ROOT=pathlib.Path(__file__).resolve().parents[1];REPO=ROOT.parents[1]
def main():
    p=argparse.ArgumentParser();p.add_argument('--terraform',required=True);p.add_argument('--containers',action='store_true');a=p.parse_args()
    logs=ROOT/'artifacts/preflight';logs.mkdir(parents=True,exist_ok=True);checks={}
    def run(name,argv,cwd=REPO):
        with (logs/(name+'.log')).open('w') as out:subprocess.run(argv,cwd=cwd,stdout=out,stderr=subprocess.STDOUT,check=True)
        checks[name]={'passed':True,'logSha256':hashlib.sha256((logs/(name+'.log')).read_bytes()).hexdigest()};print(name+': passed',flush=True)
    try:
        run('application-tests',['npm','test'])
        run('frontend-build',['npm','run','build'],REPO/'frontend')
        run('bootstrap-tests',[sys.executable,str(ROOT/'scripts/test_bootstrap.py')])
        run('terraform-fmt',[a.terraform,'fmt','-check','-recursive'],ROOT/'terraform')
        run('terraform-validate',[a.terraform,'validate','-no-color'],ROOT/'terraform')
        if a.containers:
            run('app-image',['podman','build','-f','Containerfile','-t','localhost/incidentdata:deployment-candidate-20261021','.'])
            run('worker-image',['podman','build','-f',str(ROOT/'Containerfile.detective-worker'),'-t','localhost/incidentdata-detective-worker:portable-candidate-20261021','.'])
            run('worker-offline',['podman','run','--rm','--network','none','--memory=4g','--entrypoint','bash','-v',str(ROOT/'artifacts/models')+':/models:ro,z','-v',str(ROOT/'scripts/probe_worker.sh')+':/probe.sh:ro,z','localhost/incidentdata-detective-worker:portable-candidate-20261021','/probe.sh'])
            run('worker-lock-binary',['podman','run','--rm','--network','none','--entrypoint','/usr/bin/flock','localhost/incidentdata-detective-worker:portable-candidate-20261021','--version'])
        receipt={'status':'passed' if a.containers else 'partial','checkedAt':time.strftime('%Y-%m-%dT%H:%M:%SZ',time.gmtime()),'checks':checks,'cloudResourcesCreated':False,'terraformApplyRun':False,'destinationTested':False}
    except subprocess.CalledProcessError:
        receipt={'status':'failed','checks':checks};raise
    finally:
        if 'receipt' in locals():(ROOT/'inventory/local-validation.json').write_text(json.dumps(receipt,indent=2)+'\n')
if __name__=='__main__':main()
