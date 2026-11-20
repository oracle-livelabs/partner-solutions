#!/usr/bin/env python3
"""Wait for an authenticated VM callback via a single-object, read-only PAR."""
import argparse,json,os,time,urllib.request,urllib.error

def accepted(record,deployment,instance,release):
    return record.get('deployment_id')==deployment and record.get('instance_id')==instance and record.get('release_sha256')==release

def main():
    p=argparse.ArgumentParser();p.add_argument('--deployment',required=True);p.add_argument('--instance',required=True);p.add_argument('--release',required=True);p.add_argument('--minutes',type=int,default=120);a=p.parse_args()
    # PAR is sensitive and passed through the environment, never arguments/logs.
    url=os.environ['INCIDENTDATA_STATUS_URL'];deadline=time.monotonic()+a.minutes*60;last=None
    while time.monotonic()<deadline:
        try:
            with urllib.request.urlopen(url,timeout=20) as response:record=json.load(response)
            if record.get('state')=='pending' and record.get('deployment_id')==a.deployment and record.get('release_sha256')==a.release:
                time.sleep(20);continue
            if not accepted(record,a.deployment,a.instance,a.release):raise RuntimeError('Bootstrap callback identity mismatch')
            stage=(record.get('state'),record.get('stage'))
            if stage!=last:print('Bootstrap: '+str(stage[0])+' / '+str(stage[1]),flush=True);last=stage
            if record.get('state')=='failed':raise RuntimeError('Destination bootstrap failed at '+str(record.get('stage'))+'; inspect protected VM diagnostics')
            if record.get('state')=='ready' and record.get('stage')=='complete':return
        except urllib.error.HTTPError as error:
            if error.code not in (403,404,429):raise RuntimeError('Bootstrap callback HTTP failure') from None
        except (TimeoutError,urllib.error.URLError):pass
        time.sleep(20)
    raise RuntimeError('Destination did not pass bootstrap acceptance before the deadline')
if __name__=='__main__':main()
