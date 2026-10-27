import ftplib
import importlib.util
import os
from pathlib import Path
import tempfile
import unittest

spec=importlib.util.spec_from_file_location('release',Path(__file__).with_name('reg_ru_release.py'))
m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m)
class FTP:
    def __init__(self):
        self.files={'index.html':b'<html>old</html>','manager-history.js':b'old history'}
        self.fail=None
    def retrbinary(self,cmd,callback):
        key=cmd[5:]
        if key not in self.files: raise ftplib.error_perm('550 missing')
        callback(self.files[key])
    def nlst(self):return list(self.files)
    def storbinary(self,cmd,data):
        if self.fail and cmd[5:].startswith(self.fail):
            self.fail=None
            raise OSError('temporary write failure')
        self.files[cmd[5:]]=data.read()
    def rename(self,a,b):self.files[b]=self.files.pop(a)
    def delete(self,a):del self.files[a]
class Release(unittest.TestCase):
    def setUp(self):
        self.previous=Path.cwd();self.tmp=tempfile.TemporaryDirectory();os.chdir(self.tmp.name)
        for name in m.FILES:Path(name).write_text('new '+name)
        self.ftp=FTP();self.old=dict(self.ftp.files)
    def tearDown(self):os.chdir(self.previous);self.tmp.cleanup()
    def test_backup_deploy_restore(self):
        m.backup(self.ftp);self.assertEqual(self.ftp.files,self.old)
        m.deploy(self.ftp)
        for name in m.FILES:self.assertEqual(self.ftp.files[name],Path(name).read_bytes())
        m.restore(self.ftp,m.load_backup());self.assertEqual(self.ftp.files,self.old)
    def test_partial_failure_rolls_back(self):
        m.backup(self.ftp);self.ftp.fail='manager-history.js'
        with self.assertRaises(OSError):m.deploy(self.ftp)
        self.assertEqual(self.ftp.files,self.old)
    def test_changed_remote_aborts(self):
        m.backup(self.ftp);self.ftp.files['index.html']=b'<html>someone else</html>';before=dict(self.ftp.files)
        with self.assertRaises(RuntimeError):m.deploy(self.ftp)
        self.assertEqual(self.ftp.files,before)
    def test_corrupt_backup_aborts(self):
        m.backup(self.ftp);Path('release-backup/index.html').write_text('corrupt')
        with self.assertRaises(RuntimeError):m.deploy(self.ftp)
        self.assertEqual(self.ftp.files,self.old)
if __name__=='__main__':unittest.main()
