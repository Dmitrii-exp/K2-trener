"""Back up exactly the public assets being replaced, then deploy or restore over FTPS.
No SQL, remote deletes outside newly-created release files, or server directory cleanup.
"""
import argparse
import ftplib
import hashlib
import io
import json
import os
from pathlib import Path
import ssl
import urllib.request

FILES = ("company-top.js", "company-branches.js", "manager-history.js", "cold-call-voice-v5.js", "mentor-chat.js", "personal-notes.js", "index.html")
BACKUP = Path("release-backup")

def digest(data):
    return hashlib.sha256(data).hexdigest()

def connect():
    ftp = ftplib.FTP_TLS(context=ssl.create_default_context(), timeout=45)
    ftp.connect(os.environ["FTP_SERVER"], 21)
    ftp.login(os.environ["FTP_USERNAME"], os.environ["REG_FTP_PASSWORD"])
    ftp.prot_p()
    ftp.cwd("/")
    return ftp

def read(ftp, name, missing_ok=False):
    data = io.BytesIO()
    try:
        ftp.retrbinary("RETR " + name, data.write)
    except ftplib.error_perm as error:
        # A 550 can also mean permission denied; only treat it as missing when
        # the parent listing succeeds and confirms absence.
        if not missing_ok or not str(error).startswith("550"):
            raise
        names = {x.rsplit("/", 1)[-1] for x in ftp.nlst()}
        if name in names:
            raise
        return None
    return data.getvalue()

def backup(ftp):
    BACKUP.mkdir(exist_ok=False)
    manifest = {}
    for name in FILES:
        data = read(ftp, name, missing_ok=True)
        if name == "index.html" and (not data or b"<html" not in data.lower()):
            raise RuntimeError("Remote index.html missing or invalid; refusing deployment")
        manifest[name] = None if data is None else digest(data)
        if data is not None:
            (BACKUP / name).write_bytes(data)
    (BACKUP / "manifest.json").write_text(json.dumps(manifest, indent=2))
    print("Backup complete: " + str(len(manifest)) + " release paths")

def load_backup():
    manifest = json.loads((BACKUP / "manifest.json").read_text())
    if set(manifest) != set(FILES):
        raise RuntimeError("Backup manifest does not match release")
    for name, checksum in manifest.items():
        if checksum is not None and digest((BACKUP / name).read_bytes()) != checksum:
            raise RuntimeError("Backup checksum mismatch: " + name)
    return manifest

def upload(ftp, name, data):
    # Each file is written aside, verified and renamed. Publish index last.
    temporary = name + ".release-" + os.environ.get("GITHUB_RUN_ID", "local")
    ftp.storbinary("STOR " + temporary, io.BytesIO(data))
    if digest(read(ftp, temporary)) != digest(data):
        raise RuntimeError("Upload checksum mismatch: " + name)
    ftp.rename(temporary, name)
    if digest(read(ftp, name)) != digest(data):
        raise RuntimeError("Published checksum mismatch: " + name)

def restore(ftp, manifest, names=FILES):
    for name in names:
        if manifest[name] is None:
            if read(ftp, name, missing_ok=True) is not None:
                ftp.delete(name)
        else:
            upload(ftp, name, (BACKUP / name).read_bytes())
    print("Previous assets restored and verified")

def verify_public():
    run = os.environ.get("GITHUB_RUN_ID", "local")
    for name in FILES:
        route = "/" if name == "index.html" else "/" + name
        request = urllib.request.Request("https://app.sale-trener.ru" + route + "?release=" + run,
                                         headers={"Cache-Control": "no-cache"})
        with urllib.request.urlopen(request, timeout=45) as response:
            data = response.read()
        if digest(data) != digest(Path(name).read_bytes()):
            raise RuntimeError("Public HTTP checksum mismatch: " + name)
    print("Public HTTPS serves all " + str(len(FILES)) + " exact release assets")

def deploy(ftp):
    manifest = load_backup()
    for name in FILES:
        data = read(ftp, name, missing_ok=True)
        if (None if data is None else digest(data)) != manifest[name]:
            raise RuntimeError("Remote changed after backup: " + name)
        if not Path(name).is_file():
            raise RuntimeError("Release asset missing: " + name)
    attempted = []
    try:
        for name in FILES:
            attempted.append(name)
            upload(ftp, name, Path(name).read_bytes())
        verify_public()
    except Exception:
        print("Deployment failed; restoring attempted paths")
        restore(ftp, manifest, attempted)
        raise
    print("Release deployed; all remote checksums verified")

def main():
    global BACKUP
    parser = argparse.ArgumentParser()
    parser.add_argument("mode", choices=("backup", "deploy", "restore"))
    parser.add_argument("--backup-dir", default="release-backup")
    args = parser.parse_args()
    BACKUP = Path(args.backup_dir)
    with connect() as ftp:
        if args.mode == "backup":
            backup(ftp)
        elif args.mode == "deploy":
            deploy(ftp)
        else:
            restore(ftp, load_backup())

if __name__ == "__main__":
    main()
