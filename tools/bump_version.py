"""Stamp a new version on every app file so phones fetch fresh copies after a deploy.

Run before each push:  python tools/bump_version.py

It rewrites index.html (the ?v= on the stylesheet and every JS module in the import map,
plus window.APP_VERSION) and version.json, which the running app checks to know when to
reload itself.
"""
import json
import re
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
version = datetime.now(timezone.utc).strftime('%Y%m%d%H%M%S')

modules = sorted(p.name for p in (ROOT / 'js').glob('*.js'))
import_map = {'imports': {f'./js/{m}': f'./js/{m}?v={version}' for m in modules}}

html_path = ROOT / 'index.html'
html = html_path.read_text(encoding='utf-8')
html = re.sub(r'<script type="importmap">.*?</script>',
              '<script type="importmap">' + json.dumps(import_map, indent=2) + '</script>', html, flags=re.S)
html = re.sub(r"window\.APP_VERSION = '[^']*'", f"window.APP_VERSION = '{version}'", html)
html = re.sub(r'href="css/style\.css(\?v=\w+)?"', f'href="css/style.css?v={version}"', html)
html = re.sub(r'src="js/app\.js(\?v=\w+)?"', f'src="js/app.js?v={version}"', html)
html_path.write_text(html, encoding='utf-8')

(ROOT / 'version.json').write_text(json.dumps({'version': version}) + '\n', encoding='utf-8')
print(f'version {version} ({len(modules)} modules)')
