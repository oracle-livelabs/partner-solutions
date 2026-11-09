"""Build a file-openable LiveLabs-style review preview."""
from html import escape
from pathlib import Path
import json
import re

ROOT = Path(__file__).resolve().parents[1]
MANIFEST = ROOT / 'workshops/sandbox/manifest.json'
PREVIEW = ROOT / 'preview/index.html'
TOKEN = re.compile(r'!\[([^]]*)\]\(([^)]+)\)|\[([^]]+)\]\(([^)]+)\)|\*\*([^*]+)\*\*|`([^`]+)`|(?<![\w*])\*([^*\s][^*]*?)\*(?![\w*])')


def inline(source, page_dir):
    out, start = [], 0
    for match in TOKEN.finditer(source):
        out.append(escape(source[start:match.start()]))
        if match.group(1) is not None:
            image = (page_dir / match.group(2)).relative_to(ROOT).as_posix()
            out.append(f'<img src="../{escape(image, quote=True)}" alt="{escape(match.group(1), quote=True)}" loading="lazy">')
        elif match.group(3) is not None:
            href = match.group(4)
            if not href.startswith(('https://', 'http://')):
                href = '../' + (page_dir / href).relative_to(ROOT).as_posix()
            out.append(f'<a href="{escape(href, quote=True)}">{escape(match.group(3))}</a>')
        elif match.group(5) is not None:
            out.append(f'<strong>{escape(match.group(5))}</strong>')
        elif match.group(6) is not None:
            out.append(f'<code>{escape(match.group(6))}</code>')
        else:
            out.append(f'<em>{escape(match.group(7))}</em>')
        start = match.end()
    out.append(escape(source[start:]))
    return ''.join(out)


def render_markdown(source, page_dir):
    """Small LiveLabs-flavoured renderer: headings, paragraphs, nested lists, tables and > notes."""
    output, paragraph, lists = [], [], []   # lists: stack of (tag, indent)
    lines = source.splitlines()
    def flush():
        if paragraph:
            output.append('<p>' + inline(' '.join(paragraph), page_dir) + '</p>')
            paragraph.clear()
    def close_lists(to_indent=-1):
        while lists and lists[-1][1] > to_indent:
            output.append(f'</li></{lists.pop()[0]}>')
    i = 0
    while i < len(lines):
        raw = lines[i]; line = raw.strip(); indent = len(raw) - len(raw.lstrip(' '))
        if not line:
            flush(); i += 1
            # a blank line ends lists unless the next non-blank line is indented list content
            j = i
            while j < len(lines) and not lines[j].strip(): j += 1
            if j >= len(lines) or not lists or (len(lines[j]) - len(lines[j].lstrip(' ')) == 0 and not re.match(r'^(?:- |\d+\. )', lines[j].strip())):
                close_lists()
            continue
        if line.startswith('|'):
            flush(); rows = []
            while i < len(lines) and lines[i].strip().startswith('|'):
                cells = [c.strip() for c in lines[i].strip().strip('|').split('|')]
                if not all(re.fullmatch(r':?-{2,}:?', c) for c in cells): rows.append(cells)
                i += 1
            if rows:
                head = ''.join(f'<th>{inline(c, page_dir)}</th>' for c in rows[0])
                body = ''.join('<tr>' + ''.join(f'<td>{inline(c, page_dir)}</td>' for c in r) + '</tr>' for r in rows[1:])
                output.append(f'<table><thead><tr>{head}</tr></thead><tbody>{body}</tbody></table>')
            continue
        if line.startswith('>'):
            flush(); quote = []
            while i < len(lines) and lines[i].strip().startswith('>'):
                quote.append(lines[i].strip()[1:].lstrip()); i += 1
            output.append('<blockquote>' + render_markdown('\n'.join(quote), page_dir) + '</blockquote>')
            continue
        heading = re.match(r'^(#{1,4})\s+(.+)$', line)
        item = re.match(r'^(?:- |\d+\. )(.+)$', line)
        if heading:
            flush(); close_lists()
            level = len(heading.group(1))
            output.append(f'<h{level}>{inline(heading.group(2), page_dir)}</h{level}>')
        elif item:
            flush(); tag = 'ul' if line.startswith('- ') else 'ol'
            close_lists(indent)
            if lists and lists[-1][1] == indent and lists[-1][0] == tag:
                output.append('</li><li>')
            else:
                if lists and lists[-1][1] == indent:
                    output.append(f'</li></{lists.pop()[0]}>')
                num = re.match(r'^(\d+)\. ', line); start = f' start="{num.group(1)}"' if num and num.group(1) != '1' else ''
                output.append(f'<{tag}{start}><li>'); lists.append((tag, indent))
            output.append(inline(item.group(1), page_dir))
        else:
            if lists and indent == 0: close_lists()
            paragraph.append(line)
        i += 1
    flush(); close_lists()
    return '\n'.join(output)


def main():
    manifest = json.loads(MANIFEST.read_text())
    pages = [p for p in manifest['tutorials'] if not p['filename'].startswith('https://')]
    nav, chapters = [], []
    for index, item in enumerate(pages):
        path = (MANIFEST.parent / item['filename']).resolve()
        anchor = 'introduction' if index == 0 else f'scene-{index}'
        nav.append(f'<a href="#{anchor}" data-page="{anchor}">{escape(item["title"])}</a>')
        before = 'introduction' if index == 1 else f'scene-{index-1}'
        previous = '<span></span>' if index == 0 else f'<a href="#{before}">← Previous</a>'
        following = '<span></span>' if index == len(pages)-1 else f'<a href="#scene-{index+1}">Next →</a>'
        pager = f'<div class="pager">{previous}{following}</div>'
        body = render_markdown(path.read_text(), path.parent)
        chapters.append(f'<article id="{anchor}" class="chapter"><div class="kicker">LiveLabs workshop · {index+1} of {len(pages)}</div>{body}{pager}</article>')
    PREVIEW.parent.mkdir(exist_ok=True)
    PREVIEW.write_text(f'''<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>{escape(manifest['workshoptitle'])}</title>
<style>
:root{{font-family:Arial,Helvetica,sans-serif;color:#30343b;background:white}}*{{box-sizing:border-box}}body{{margin:0}}.topbar{{height:70px;border-bottom:1px solid #d5d7d9;display:flex;align-items:center;padding:0 30px;gap:25px;background:white;position:sticky;top:0;z-index:3}}.brand{{color:#b3311c;font-size:22px;font-weight:bold;letter-spacing:1px}}.brand small{{display:block;color:#53565a;font-size:12px;letter-spacing:0;font-weight:normal}}.workshop-name{{font-size:15px;color:#555;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}}.layout{{display:grid;grid-template-columns:290px minmax(0,1fr);min-height:calc(100vh - 70px)}}.sidebar{{border-right:1px solid #d9dcdf;background:#f8f8f8;padding:28px 0;overflow:auto;height:calc(100vh - 70px);position:sticky;top:70px}}.sidebar h2{{margin:0 22px 20px;font-size:17px;font-weight:600}}.sidebar a{{display:block;padding:11px 22px;color:#333;text-decoration:none;border-left:4px solid transparent;line-height:1.35;font-size:14px}}.sidebar a:hover{{background:#eee}}.sidebar a.active{{color:#a62f1c;border-color:#b3311c;background:white;font-weight:bold}}main{{width:100%;max-width:1180px;padding:34px 64px 70px;margin:0 auto}}.note{{font-size:13px;color:#62666a;border-bottom:1px solid #ddd;padding-bottom:16px;margin-bottom:26px}}.chapter{{display:none}}.chapter.active{{display:block}}.kicker{{color:#a63826;font-size:12px;font-weight:bold;letter-spacing:.07em;text-transform:uppercase;margin-bottom:20px}}h1{{font-size:32px;line-height:1.2;font-weight:600;margin:0 0 24px}}h2{{font-size:24px;margin:38px 0 16px;border-bottom:1px solid #ddd;padding-bottom:10px}}h3{{font-size:18px;margin:28px 0 12px}}p,li{{font-size:16px;line-height:1.65}}li{{margin-bottom:9px}}img{{display:block;width:100%;max-width:100%;height:auto;margin:24px 0;border:1px solid #d8d8d8;cursor:zoom-in}}a{{color:#a63826}}code{{background:#f3f3f3;padding:2px 4px}}.pager{{border-top:1px solid #ddd;margin-top:50px;padding-top:20px;display:flex;justify-content:space-between}}.pager a{{text-decoration:none;font-weight:bold}}dialog{{width:min(95vw,1800px);max-height:95vh;padding:15px;border:0;box-shadow:0 12px 55px #0008}}dialog img{{width:auto;max-width:100%;max-height:calc(95vh - 60px);margin:auto;cursor:zoom-out}}dialog button{{float:right;margin-bottom:8px;border:0;background:#b3311c;color:white;padding:6px 12px;cursor:pointer}}@media(max-width:850px){{.layout{{display:block}}.sidebar{{height:auto;position:static;border-bottom:1px solid #ddd;padding:10px}}.sidebar a{{display:inline-block;border-left:0;border-bottom:3px solid transparent;padding:9px}}.sidebar a.active{{border-bottom-color:#b3311c}}main{{padding:24px}}}}
table{{border-collapse:collapse;margin:14px 0;font-size:14px;width:100%}}th,td{{border:1px solid #d5d7d9;padding:7px 10px;text-align:left;vertical-align:top}}th{{background:#f1efed}}blockquote{{margin:16px 0;padding:10px 16px;border-left:4px solid #2f6f9f;background:#f4f7fa}}blockquote p{{margin:6px 0}}li>ul,li>ol{{margin:6px 0}}
</style></head><body><header class="topbar"><div class="brand">ORACLE<small>LiveLabs</small></div><div class="workshop-name">{escape(manifest['workshoptitle'])}</div></header><div class="layout"><nav class="sidebar" aria-label="Workshop chapters"><h2>Contents</h2>{''.join(nav)}</nav><main><div class="note">Local review preview · The publication entry point is <code>workshops/sandbox/index.html</code>.</div>{''.join(chapters)}</main></div><dialog id="zoom"><button type="button" aria-label="Close image">Close</button><img alt="Expanded workshop screenshot"></dialog><script>
function showChapter(){{const id=location.hash.slice(1)||'introduction';const target=document.getElementById(id)||document.getElementById('introduction');document.querySelectorAll('.chapter').forEach(el=>el.classList.toggle('active',el===target));document.querySelectorAll('.sidebar a').forEach(el=>el.classList.toggle('active',el.dataset.page===target.id));window.scrollTo(0,0)}}window.addEventListener('hashchange',showChapter);showChapter();const zoom=document.getElementById('zoom');document.querySelectorAll('.chapter img').forEach(img=>img.addEventListener('click',()=>{{zoom.querySelector('img').src=img.src;zoom.querySelector('img').alt=img.alt;zoom.showModal()}}));zoom.querySelector('button').addEventListener('click',()=>zoom.close());zoom.querySelector('img').addEventListener('click',()=>zoom.close());
</script></body></html>''', encoding='utf-8')
    print(PREVIEW)

if __name__ == '__main__':
    main()
