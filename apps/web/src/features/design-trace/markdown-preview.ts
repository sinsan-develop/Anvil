export type MarkdownPreviewBlock=
 |{kind:'HEADING';level:number;text:string}|{kind:'PARAGRAPH'|'QUOTE';text:string}|{kind:'CODE';info:string;text:string}
 |{kind:'LIST';ordered:boolean;start:number;items:string[]}
 |{kind:'TABLE';headers:string[];align:('left'|'right'|'center'|undefined)[];rows:string[][]};
export type MarkdownPreview={kind:'READY';blocks:MarkdownPreviewBlock[];unclosedCode:boolean}|{kind:'UNVERIFIED';reason:'DISPLAY_LIMIT'};
const heading=/^(#{1,6})[ \t]+(.*)$/,fence=/^(`{3,}|~{3,})(.*)$/,unordered=/^[-+*][ \t]+(.*)$/,ordered=/^(\d{1,9})[.)][ \t]+(.*)$/,quote=/^> ?(.*)$/;
function cells(line:string):string[]|null{
 const raw=line.trim();if(!raw.includes('|'))return null;const values=[''];
 for(let n=0;n<raw.length;n++){const c=raw[n]!;if(c==='\\'&&raw[n+1]==='|'){values[values.length-1]=values[values.length-1]!+'|';n++;}else if(c==='|')values.push('');else values[values.length-1]=values[values.length-1]!+c;}
 if(raw.startsWith('|'))values.shift();if(values.at(-1)===''&&raw.endsWith('|'))values.pop();return values.map(v=>v.trim());
}
/** 제한된 표시 구조만 만든다. 저장 본문을 바꾸거나 HTML/URL 노드를 생성하지 않는다. */
export function parseMarkdownPreview(body:string):MarkdownPreview{
 const limited={kind:'UNVERIFIED',reason:'DISPLAY_LIMIT'} as const;if(body.length>131072)return limited;
 const lines=body.replace(/^\uFEFF/,'').split(/\r\n|\n|\r/);if(lines.length>4000)return limited;
 const blocks:MarkdownPreviewBlock[]=[];let paragraph:string[]=[],nodes=0,unclosedCode=false;
 const add=(b:MarkdownPreviewBlock)=>{nodes+=1+(b.kind==='LIST'?b.items.length:b.kind==='TABLE'?b.headers.length+b.rows.reduce((n,r)=>n+r.length,0):0);if(blocks.length>=2000||nodes>20000)return false;blocks.push(b);return true;};
 const flush=()=>{if(!paragraph.length)return true;const text=paragraph.join('\n');paragraph=[];return add({kind:'PARAGRAPH',text});};
 for(let i=0;i<lines.length;){
  const line=lines[i]!;if(!line.trim()){if(!flush())return limited;i++;continue;}
  const code=fence.exec(line);if(code){if(!flush())return limited;const contents:string[]=[];let closed=false;i++;
   for(;i<lines.length;i++){const end=lines[i]!.trim();if(end.length>=code[1]!.length&&[...end].every(c=>c===code[1]![0])){closed=true;i++;break;}contents.push(lines[i]!);}
   if(!closed)unclosedCode=true;if(!add({kind:'CODE',info:code[2]!.trim(),text:contents.join('\n')}))return limited;continue;
  }
  const head=heading.exec(line);if(head){if(!flush()||!add({kind:'HEADING',level:head[1]!.length,text:head[2]!}))return limited;i++;continue;}
  const header=cells(line),delimiter=i+1<lines.length?cells(lines[i+1]!):null;
  if(header&&delimiter&&header.length===delimiter.length&&delimiter.length&&delimiter.every(v=>/^:?-{3,}:?$/.test(v))){
   if(header.length>50||!flush())return limited;const rows:string[][]=[];let cellCount=header.length;i+=2;
   for(;i<lines.length;i++){const row=cells(lines[i]!);if(!row||row.length!==header.length)break;cellCount+=row.length;if(cellCount>20000)return limited;rows.push(row);}
   if(!add({kind:'TABLE',headers:header,align:delimiter.map(v=>v.startsWith(':')&&v.endsWith(':')?'center':v.endsWith(':')?'right':v.startsWith(':')?'left':undefined),rows}))return limited;continue;
  }
  const bullet=unordered.exec(line),number=ordered.exec(line);if(bullet||number){if(!flush())return limited;const items=[bullet?bullet[1]!:number![2]!],start=number?Number(number[1]):1;i++;
   for(;i<lines.length;i++){const next=number?ordered.exec(lines[i]!):unordered.exec(lines[i]!);if(!next||number&&Number(next[1])!==start+items.length)break;items.push(number?next[2]!:next[1]!);}
   if(!add({kind:'LIST',ordered:!!number,start,items}))return limited;continue;
  }
  const q=quote.exec(line);if(q){if(!flush())return limited;const parts=[q[1]!];i++;for(;i<lines.length;i++){const next=quote.exec(lines[i]!);if(!next)break;parts.push(next[1]!);}if(!add({kind:'QUOTE',text:parts.join('\n')}))return limited;continue;}
  paragraph.push(line);i++;
 }
 if(!flush())return limited;return{kind:'READY',blocks,unclosedCode};
}
