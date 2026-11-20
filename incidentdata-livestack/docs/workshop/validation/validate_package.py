"""Check the LiveLabs manifest, chapter links and conceptual illustrations."""
from pathlib import Path
import json
import re
import subprocess

root=Path(__file__).resolve().parents[1]
manifest=json.loads((root/'workshops/sandbox/manifest.json').read_text())
pages=[p for p in manifest['tutorials'] if not p['filename'].startswith('https://')]
errors=[]
images=set()
local_links=set()
for page in pages:
    path=(root/'workshops/sandbox'/page['filename']).resolve()
    if not path.is_file():
        errors.append(f'Missing chapter: {path}')
        continue
    source=path.read_text()
    for label,target in re.findall(r'(?<!!)\[([^]]+)\]\(([^)]+)\)',source):
        if target.startswith(('http://','https://','#')):
            continue
        local=(path.parent/target.split('?',1)[0].split('#',1)[0]).resolve()
        local_links.add(local)
        if not local.is_file():
            errors.append(f'Missing local link ({label}): {local}')
    for target in re.findall(r'!\[[^]]*\]\(([^)]+)\)',source):
        image=(path.parent/target).resolve()
        images.add(image)
        if not image.is_file():
            errors.append(f'Missing image: {image}')
            continue
        width=height=None
        head=image.read_bytes()[:32]
        if head[:8]==b'\x89PNG\r\n\x1a\n':   # portable PNG header read (sips is macOS-only)
            import struct
            w,h=struct.unpack('>II',head[16:24]);width=re.match(r'(\d+)',str(w));height=re.match(r'(\d+)',str(h))
        else:
            result=subprocess.run(['sips','-g','pixelWidth','-g','pixelHeight',str(image)],capture_output=True,text=True)
            width=re.search(r'pixelWidth: (\d+)',result.stdout)
            height=re.search(r'pixelHeight: (\d+)',result.stdout)
        if not width or not height or int(width[1])<1440 or int(height[1])<900:
            errors.append(f'Image below desktop minimum: {image}')
if len(pages)!=15:
    errors.append(f'Expected introduction and 14 scenes, found {len(pages)}')
if not (root/'workshops/sandbox/index.html').is_file() or not (root/'preview/index.html').is_file():
    errors.append('Missing LiveLabs shell or local preview')
print(f'Chapters: {len(pages)}; referenced images: {len(images)}; errors: {len(errors)}')
print(f'Local chapter links: {len(local_links)}')
for error in errors:
    print('ERROR:',error)
raise SystemExit(bool(errors))
