#!/usr/bin/env python3
"""Generate an explicit public-IP ACME configuration; never issue during build."""
import argparse,ipaddress,pathlib,re

def configuration(address,staging=False):
    try:ipaddress.ip_address(address);is_ip=True
    except ValueError:
        if not re.fullmatch(r'[a-z0-9][a-z0-9.-]+\.[a-z]{2,}',address):raise ValueError('Invalid public address')
        is_ip=False
    ca='https://acme-staging-v02.api.letsencrypt.org/directory' if staging else 'https://acme-v02.api.letsencrypt.org/directory'
    profile='\n            profile shortlived' if is_ip else ''
    default_sni='\n    default_sni '+address if is_ip else ''
    return '''{
    admin off%s
}
https://%s {
    tls {
        issuer acme {
            dir %s%s
        }
    }
    header Strict-Transport-Security "max-age=31536000"
    reverse_proxy 127.0.0.1:3001 {
        header_up -X-Demo-User
        header_up X-Forwarded-Proto https
    }
}
'''%(default_sni,address,ca,profile)
if __name__=='__main__':
    p=argparse.ArgumentParser();p.add_argument('--address',required=True);p.add_argument('--out',required=True);p.add_argument('--staging',action='store_true');a=p.parse_args();pathlib.Path(a.out).write_text(configuration(a.address,a.staging))
