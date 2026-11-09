#!/usr/bin/env python3
"""Index local release artifacts without uploading them or claiming readiness."""
import hashlib,json,pathlib,argparse
ROOT=pathlib.Path(__file__).resolve().parents[1]

def fingerprint(path):
    digest=hashlib.sha256()
    with path.open('rb') as f:
        for chunk in iter(lambda:f.read(1024*1024),b''):digest.update(chunk)
    return {'path':str(path.relative_to(ROOT/'artifacts')),'sha256':digest.hexdigest(),'bytes':path.stat().st_size}

def validate_entry(root,entry):
    rel=pathlib.PurePosixPath(entry['path'])
    if rel.is_absolute() or '..' in rel.parts or not rel.parts:raise ValueError('Unsafe artifact path')
    target=(root/str(rel)).resolve()
    if not target.is_relative_to(root.resolve()) or not target.is_file():raise ValueError('Missing or escaped artifact')
    digest=hashlib.sha256()
    with target.open('rb') as f:
        for chunk in iter(lambda:f.read(1024*1024),b''):digest.update(chunk)
    if target.stat().st_size!=entry['bytes'] or digest.hexdigest()!=entry['sha256']:raise ValueError('Artifact checksum or size mismatch')

if __name__=='__main__':
    parser=argparse.ArgumentParser();parser.add_argument('--verify',action='store_true');args=parser.parse_args()
    artifacts=ROOT/'artifacts';manifest=artifacts/'release-manifest.json'
    if args.verify:
        value=json.loads(manifest.read_text())
        for entry in value['artifacts']:validate_entry(artifacts,entry)
        print(json.dumps({'artifactsVerified':len(value['artifacts']),'status':value['status'],'deploymentReady':False}))
    else:
        raise SystemExit('Use scripts/build_release.py to build the complete candidate, or --verify to validate its explicit artifact allowlist.')
