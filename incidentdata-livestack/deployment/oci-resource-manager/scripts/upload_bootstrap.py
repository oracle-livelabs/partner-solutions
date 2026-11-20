#!/usr/bin/env python3
"""One-time HTTPS PUT using a write-only, single-object PAR; never log secrets."""
import json,os,time,urllib.request,urllib.error,urllib.parse

def main():
    body=os.environ['INCIDENTDATA_BOOTSTRAP_BODY'].encode();url=os.environ['INCIDENTDATA_BOOTSTRAP_UPLOAD_URL'];parsed=urllib.parse.urlsplit(url)
    if parsed.scheme!='https' or not parsed.hostname or not parsed.hostname.endswith('.oraclecloud.com') or not parsed.hostname.startswith('objectstorage.') or parsed.username or parsed.password or not parsed.path.startswith('/p/'):raise ValueError('Invalid private bootstrap upload endpoint')
    if len(body)>1048576:raise ValueError('Bootstrap payload exceeds size limit')
    json.loads(body)
    for attempt in range(30):
        try:
            req=urllib.request.Request(url,data=body,method='PUT',headers={'Content-Type':'application/json'})
            with urllib.request.urlopen(req,timeout=45) as response:
                if response.status not in [200,201]:raise RuntimeError('Unexpected bootstrap upload response')
            print('Private bootstrap credential object uploaded');return
        except urllib.error.HTTPError as error:
            if error.code not in [408,429,500,502,503,504] or attempt==29:raise RuntimeError('Private bootstrap upload HTTP '+str(error.code)) from None
        except (urllib.error.URLError,TimeoutError):
            if attempt==29:raise RuntimeError('Private bootstrap upload unavailable') from None
        time.sleep(5)
if __name__=='__main__':main()
