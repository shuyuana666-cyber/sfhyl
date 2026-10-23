"""SSH/SFTP deployment helper. Credentials are read only from environment variables."""
import argparse
import os
import pathlib
import select
import sys
import paramiko

sys.stdout.reconfigure(encoding='utf-8', errors='replace')
sys.stderr.reconfigure(encoding='utf-8', errors='replace')

parser = argparse.ArgumentParser()
parser.add_argument('action', choices=['exec', 'upload', 'download'])
parser.add_argument('paths', nargs='*')
args = parser.parse_args()
client = paramiko.SSHClient()
known = pathlib.Path.home() / '.ssh' / 'known_hosts'
client.load_host_keys(str(known))
client.set_missing_host_key_policy(paramiko.RejectPolicy())
client.connect(os.environ['SFHYL_DEPLOY_SSH_HOST'], username=os.environ['SFHYL_DEPLOY_SSH_USER'],
               password=os.environ['SFHYL_DEPLOY_SSH_PASSWORD'], timeout=20, auth_timeout=20,
               allow_agent=False, look_for_keys=False)
client.get_transport().set_keepalive(15)
try:
    if args.action == 'exec':
        command = pathlib.Path(args.paths[0]).read_text(encoding='utf-8-sig') if args.paths else sys.stdin.read()
        channel = client.get_transport().open_session()
        channel.exec_command('bash -s')
        channel.sendall(command.replace('\r\n', '\n').encode())
        channel.shutdown_write()
        while True:
            if channel.recv_ready():
                print(channel.recv(65536).decode('utf-8', 'replace'), end='', flush=True)
            if channel.recv_stderr_ready():
                print(channel.recv_stderr(65536).decode('utf-8', 'replace'), end='', file=sys.stderr, flush=True)
            if channel.exit_status_ready() and not channel.recv_ready() and not channel.recv_stderr_ready():
                break
            select.select([channel], [], [], 1)
        sys.exit(channel.recv_exit_status())
    else:
        local, remote = args.paths if args.action == 'upload' else reversed(args.paths)
        with client.open_sftp() as sftp:
            if args.action == 'upload':
                size = pathlib.Path(local).stat().st_size
                progress = 0
                sent = 0
                with open(local, 'rb') as source, sftp.file(remote, 'wb') as target:
                    while block := source.read(32768):
                        target.write(block)
                        sent += len(block)
                        percentage = sent * 100 // size
                        if percentage >= progress + 25:
                            progress = percentage
                            print(f'Upload: {percentage}%', flush=True)
                if sftp.stat(remote).st_size != size:
                    raise RuntimeError('Uploaded file size differs from source')
            else:
                pathlib.Path(local).parent.mkdir(parents=True, exist_ok=True)
                sftp.get(remote, local)
        print(f'{args.action} completed')
finally:
    client.close()
