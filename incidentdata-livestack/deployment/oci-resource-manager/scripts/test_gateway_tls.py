#!/usr/bin/env python3
"""Exercise IP certificate selection behind NAT without public ACME requests."""
import importlib.util, pathlib, socket, ssl, subprocess, tempfile, time, uuid

ROOT = pathlib.Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location('gateway', ROOT / 'bootstrap/gateway.py')
gateway = importlib.util.module_from_spec(spec)
spec.loader.exec_module(gateway)
IMAGE = 'docker.io/library/caddy:2.11.2'
ADDRESS = '192.0.2.10'


def main():
    with tempfile.TemporaryDirectory(prefix='incidentdata-tls-') as directory:
        folder = pathlib.Path(directory)
        subprocess.run(['openssl', 'req', '-x509', '-newkey', 'ec', '-pkeyopt',
                        'ec_paramgen_curve:P-256', '-nodes', '-keyout', str(folder / 'key.pem'),
                        '-out', str(folder / 'cert.pem'), '-days', '1', '-subj', '/CN=' + ADDRESS,
                        '-addext', 'subjectAltName=IP:' + ADDRESS], check=True, capture_output=True)
        (folder / 'key.pem').chmod(0o600)
        for fixed in [False, True]:
            with socket.socket() as listener:
                listener.bind(('127.0.0.1', 0))
                port = listener.getsockname()[1]
            text = gateway.configuration(ADDRESS).replace('admin off', 'admin off\n    auto_https disable_redirects')
            start = text.index('    tls {')
            end = text.index('    header Strict-Transport-Security', start)
            text = text[:start] + '    bind 127.0.0.1\n    tls /test/cert.pem /test/key.pem\n' + text[end:]
            text = text.replace('https://' + ADDRESS + ' {', 'https://' + ADDRESS + ':' + str(port) + ' {')
            if not fixed:
                text = text.replace('\n    default_sni ' + ADDRESS, '')
            (folder / 'Caddyfile').write_text(text)
            name = 'incidentdata-tls-test-' + uuid.uuid4().hex[:10]
            try:
                subprocess.run(['podman', 'run', '-d', '--name', name, '--network=host',
                                '-v', str(folder) + ':/test:ro,Z', IMAGE, 'caddy', 'run',
                                '--config', '/test/Caddyfile', '--adapter', 'caddyfile'],
                               check=True, capture_output=True)
                context = ssl.create_default_context(cafile=str(folder / 'cert.pem'))
                for attempt in range(30):
                    try:
                        with socket.create_connection(('127.0.0.1', port), timeout=2) as connection:
                            # Python checks the IP SAN and omits SNI for IP literals.
                            with context.wrap_socket(connection, server_hostname=ADDRESS):
                                connected = True
                        break
                    except ConnectionRefusedError:
                        time.sleep(0.2)
                    except ssl.SSLError:
                        connected = False
                        break
                else:
                    raise RuntimeError('Local Caddy test listener did not start: '+subprocess.check_output(['podman','logs',name],stderr=subprocess.STDOUT,text=True)[-1600:])
                assert connected == fixed, 'Unexpected IP certificate selection behavior'
                print('No-SNI IP handshake: ' + ('passed with fix' if fixed else 'original failure reproduced'))
            finally:
                subprocess.run(['podman', 'rm', '-f', name], capture_output=True)


if __name__ == '__main__':
    main()
