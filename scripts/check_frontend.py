"""Static frontend checks. Run from the repository root; requires Python and Node."""
from html.parser import HTMLParser
from pathlib import Path
import subprocess
import tempfile
from urllib.parse import urlsplit

class Page(HTMLParser):
    def __init__(self):
        super().__init__()
        self.active = None
        self.scripts = []
        self.references = []
    def handle_starttag(self, tag, attrs):
        attrs = dict(attrs)
        if tag in ('script', 'style'):
            self.active = [tag, attrs, '']
        if tag == 'script' and attrs.get('src'):
            self.references.append(attrs['src'])
        if tag == 'link' and attrs.get('rel') == 'stylesheet':
            self.references.append(attrs['href'])
    def handle_data(self, data):
        if self.active:
            self.active[2] += data
    def handle_endtag(self, tag):
        if self.active and self.active[0] == tag:
            kind, attrs, source = self.active
            if kind == 'script' and not attrs.get('src'):
                self.scripts.append(source)
            if kind == 'style':
                assert '<style' not in source, 'Nested style tag'
            self.active = None

page = Page()
page.feed(Path('index.html').read_text())
for reference in page.references:
    parsed = urlsplit(reference)
    if not parsed.netloc:
        assert Path(parsed.path.lstrip('/')).is_file(), reference
with tempfile.TemporaryDirectory() as directory:
    for i, source in enumerate(page.scripts):
        script = Path(directory) / f'inline-{i}.js'
        script.write_text(source)
        subprocess.run(['node', '--check', str(script)], check=True)
for script in Path('.').glob('*.js'):
    subprocess.run(['node', '--check', str(script)], check=True)
for stylesheet in Path('assets').glob('*.css'):
    assert '<style' not in stylesheet.read_text(), stylesheet
assert 'cold-call-voice.js?' not in Path('canva-ui.js').read_text()
print('PASS: inline scripts, root JS syntax, local assets, no nested style tags')
