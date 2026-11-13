import React from 'react';

// Render a bounded Markdown subset as React text/elements, never model-supplied HTML.
function inline(text) {
  return String(text).split(/(`[^`\n]+`|\*\*[^*\n]+\*\*|\*[^*\n]+\*)/g).map((part,i)=>
    part.startsWith('`')&&part.endsWith('`')?<code key={i}>{part.slice(1,-1)}</code>:
    part.startsWith('**')&&part.endsWith('**')?<strong key={i}>{part.slice(2,-2)}</strong>:
    part.startsWith('*')&&part.endsWith('*')?<em key={i}>{part.slice(1,-1)}</em>:part);
}
const cells=line=>line.trim().replace(/^\||\|$/g,'').split('|').map(s=>s.trim());
export default function AgentBrief({text}) {
  const lines=String(text||'').replace(/\r\n?/g,'\n').split('\n'),blocks=[];
  for(let i=0;i<lines.length;){
    const line=lines[i];
    if(!line.trim()){i++;continue;}
    const key=i,heading=line.match(/^\s{0,3}(#{1,6})\s+(.+?)\s*#*$/);
    if(heading){const Tag=heading[1].length<=3?'h3':'h4';blocks.push(<Tag key={key}>{inline(heading[2])}</Tag>);i++;continue;}
    if(/^\s*```/.test(line)){
      const code=[];i++;while(i<lines.length&&!/^\s*```/.test(lines[i]))code.push(lines[i++]);if(i<lines.length)i++;
      blocks.push(<pre key={key}><code>{code.join('\n')}</code></pre>);continue;
    }
    if(i+1<lines.length&&line.includes('|')&&/^\s*\|?\s*:?-{3,}:?\s*(\|\s*:?-{3,}:?\s*)+\|?\s*$/.test(lines[i+1])){
      const head=cells(line),rows=[];i+=2;while(i<lines.length&&lines[i].trim()&&lines[i].includes('|'))rows.push(cells(lines[i++]));
      blocks.push(<div className="agent-brief__table" key={key} tabIndex={0} role="region" aria-label="Agent response table"><table><thead><tr>{head.map((c,n)=><th key={n}>{inline(c)}</th>)}</tr></thead><tbody>{rows.map((r,n)=><tr key={n}>{r.map((c,m)=><td key={m}>{inline(c)}</td>)}</tr>)}</tbody></table></div>);continue;
    }
    const list=line.match(/^\s*(?:([-*+])|(\d+)[.)])\s+(.+)$/);
    if(list){
      const ordered=!!list[2],items=[];
      while(i<lines.length){const item=lines[i].match(/^\s*(?:([-*+])|(\d+)[.)])\s+(.+)$/);if(!item||!!item[2]!==ordered)break;items.push(item[3]);i++;}
      const Tag=ordered?'ol':'ul';blocks.push(<Tag key={key} start={ordered?Number(list[2]):undefined}>{items.map((item,n)=><li key={n}>{inline(item)}</li>)}</Tag>);continue;
    }
    if(/^\s*>\s?/.test(line)){const quote=[];while(i<lines.length&&/^\s*>/.test(lines[i]))quote.push(lines[i++].replace(/^\s*>\s?/,''));blocks.push(<blockquote key={key}>{inline(quote.join('\n'))}</blockquote>);continue;}
    const paragraph=[line];i++;
    while(i<lines.length&&lines[i].trim()&&!/^\s*(?:#{1,6}\s|```|>|[-*+]\s|\d+[.)]\s)/.test(lines[i])&&!(i+1<lines.length&&lines[i].includes('|')&&/\|?\s*:?-{3,}/.test(lines[i+1])))paragraph.push(lines[i++]);
    blocks.push(<p key={key}>{inline(paragraph.join('\n'))}</p>);
  }
  return <div className="agent-brief">{blocks}</div>;
}
