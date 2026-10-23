"""Upload a prepared content bundle with resume support; credentials come from env."""
import concurrent.futures
import json
import os
import pathlib
import posixpath
import re
import sys
import threading
import paramiko

sys.stdout.reconfigure(encoding='utf-8', errors='replace')
source = pathlib.Path(sys.argv[1]).resolve()
target = sys.argv[2]
if not target.startswith('/opt/sfhyl-platform/shared/local-content-sync-') or '..' in target:
    raise ValueError('Unexpected staging directory')
manifest = json.loads((source / 'manifest.json').read_text(encoding='utf-8'))
client = paramiko.SSHClient()
client.load_host_keys(str(pathlib.Path.home() / '.ssh' / 'known_hosts'))
client.set_missing_host_key_policy(paramiko.RejectPolicy())
client.connect(os.environ['SFHYL_DEPLOY_SSH_HOST'], username=os.environ['SFHYL_DEPLOY_SSH_USER'],
               password=os.environ['SFHYL_DEPLOY_SSH_PASSWORD'], allow_agent=False, look_for_keys=False, timeout=20)
client.get_transport().set_keepalive(15)
lock = threading.Lock()
completed = 0
try:
    with client.open_sftp() as sftp:
        for directory in [target, target + '/files']:
            try:
                sftp.mkdir(directory, mode=0o700)
            except IOError:
                sftp.stat(directory)

    def upload(entry):
        global completed
        name = entry['filename']
        if not re.fullmatch(r'[a-f0-9]{64}\.[a-zA-Z0-9]+', name):
            raise ValueError('Unexpected media filename')
        local = source / 'files' / name
        remote = posixpath.join(target, 'files', name)
        with client.open_sftp() as sftp:
            sftp.get_channel().settimeout(60)
            try:
                offset = sftp.stat(remote).st_size
            except IOError:
                offset = 0
            if offset > entry['size']:
                raise ValueError('Staged object larger than source')
            if offset < entry['size']:
                with local.open('rb') as incoming, sftp.file(remote, 'r+b' if offset else 'wb') as outgoing:
                    outgoing.set_pipelined(True)
                    incoming.seek(offset)
                    outgoing.seek(offset)
                    while block := incoming.read(32768):
                        outgoing.write(block)
            if sftp.stat(remote).st_size != entry['size']:
                raise ValueError('Uploaded media size mismatch')
        with lock:
            completed += 1
            if completed % 10 == 0 or completed == len(manifest['files']):
                print(f'Media files uploaded: {completed}/{len(manifest["files"])}', flush=True)

    with concurrent.futures.ThreadPoolExecutor(max_workers=4) as pool:
        list(pool.map(upload, manifest['files']))
    with client.open_sftp() as sftp:
        sftp.put(str(source / 'manifest.json'), target + '/manifest.json')
    print('Content bundle upload completed', flush=True)
finally:
    client.close()
