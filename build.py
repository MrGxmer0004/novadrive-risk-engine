"""Assemble the single-file dashboard from src/ and data/.

    python build.py

Writes dist/index.html (opens directly in a browser) and
dist/artifact.html (the same page without the html/head wrapper, for hosts that add their own).
"""
import json, re, pathlib
root = pathlib.Path(__file__).parent
src, data, dist = root / 'src', root / 'data', root / 'dist'
dist.mkdir(exist_ok=True)
js = lambda name: re.sub(r"\nif \(typeof module[^\n]*\n?", "\n", (src / name).read_text(encoding='utf-8'))
blob = lambda name: json.dumps(json.loads((data / name).read_text(encoding='utf-8')), ensure_ascii=False).replace('</', '<\\/')
page = (src / 'template.html').read_text(encoding='utf-8')
for mark, text in [('/*DATA*/', blob('data.json')), ('/*ALTS*/', blob('alts.json')), ('/*MODEL*/', js('model.js')), ('/*EVENTS*/', js('events.js')), ('/*APP*/', js('app.js'))]:
    assert mark in page, mark
    page = page.replace(mark, text)
(dist / 'artifact.html').write_text(page, encoding='utf-8')
head = ('<!doctype html><html lang="en"><head><meta charset="utf-8">'
        '<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">'
        '<style>body{margin:0}[hidden]{display:none!important}img{max-width:100%}</style></head><body>')
(dist / 'index.html').write_text(head + page + '</body></html>', encoding='utf-8')
print('built', dist / 'index.html', len(page), 'bytes')
