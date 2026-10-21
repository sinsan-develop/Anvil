import {ApiClient,ApiError} from '../../api/client.ts';
import {readDocument,type DocumentVersion} from './api.ts';
type Ref={id:string;version:number;contentHash:string};
type Artifact=DocumentVersion['content']['attachments'][number];
export interface StoredDocumentPng{dataUrl:string;width:number;height:number}
const unsupported=():never=>{throw new ApiError('DOCUMENT_PNG_UNSUPPORTED');};
const crcTable=Uint32Array.from({length:256},(_,n)=>{let c=n;for(let i=0;i<8;i++)c=(c&1)?0xedb88320^(c>>>1):c>>>1;return c>>>0;});
/** 유한 구조 검사만 수행한다. 압축 픽셀 해석은 브라우저 decode 성공과 별도로 확인한다. */
function dimensions(bytes:Uint8Array){
 if(bytes.length<57||bytes.length>2097152||![137,80,78,71,13,10,26,10].every((v,i)=>bytes[i]===v))return unsupported();
 const v=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength),idat:{start:number;end:number}[]=[];let offset=8,width=0,height=0,channels=0,chunks=0,data=false,afterData=false;
 while(offset+12<=bytes.length){
  if(++chunks>4096)return unsupported();const size=v.getUint32(offset),end=offset+12+size;if(end>bytes.length)return unsupported();
  const type=String.fromCharCode(...bytes.subarray(offset+4,offset+8));if(!/^[A-Za-z]{2}[A-Z][A-Za-z]$/.test(type)||['acTL','fcTL','fdAT'].includes(type))return unsupported();
  let crc=0xffffffff;for(let i=offset+4;i<end-4;i++)crc=crcTable[(crc^bytes[i]!)&255]!^(crc>>>8);if(((crc^0xffffffff)>>>0)!==v.getUint32(end-4))return unsupported();
  if(type==='IHDR'){
   if(offset!==8||size!==13)return unsupported();width=v.getUint32(offset+8);height=v.getUint32(offset+12);
   if(!width||!height||width>4096||height>4096||width*height>4194304||bytes[offset+16]!==8||![2,6].includes(bytes[offset+17]!)||bytes[offset+18]!==0||bytes[offset+19]!==0||bytes[offset+20]!==0)return unsupported();channels=bytes[offset+17]===2?3:4;
  }else if(!width)return unsupported();
  else if(type==='IDAT'){if(afterData)return unsupported();data=true;idat.push({start:offset+8,end:end-4});}
  else if(type==='IEND'){if(size!==0||!data||end!==bytes.length)return unsupported();return{width,height,channels,idat};}
  else {if(data)afterData=true;
   if(type==='PLTE'){if(data||size===0||size%3||size>768)return unsupported();}
   else if(type==='sRGB'){if(data||size!==1||bytes[offset+8]!>3)return unsupported();}
   else if(type==='gAMA'){if(data||size!==4||v.getUint32(offset+8)===0)return unsupported();}
   else if(type==='cHRM'){if(data||size!==32)return unsupported();}
   else if(type==='pHYs'){if(data||size!==9||bytes[offset+16]!>1)return unsupported();}
   else if(type==='tRNS'){if(data||channels!==3||size!==6||[0,2,4].some(i=>v.getUint16(offset+8+i)>255))return unsupported();}
   else return unsupported();
  }
  offset=end;
 }
 return unsupported();
}
/** 압축 입력은1KiB씩 공급하고 예상 행 길이를 넘으면 취소한다. OS/VM 강제 quota 보장은 아니다. */
async function verifyPixels(bytes:Uint8Array,shape:ReturnType<typeof dimensions>,active:()=>boolean){
 const bad=():never=>{throw new ApiError('DOCUMENT_PNG_DECODE_FAILED');};
 if(typeof DecompressionStream!=='function')return unsupported();let part=0,offset=shape.idat[0]?.start??0;
 const compressed=new ReadableStream<BufferSource>({pull(controller){while(part<shape.idat.length&&offset===shape.idat[part]!.end){part++;offset=shape.idat[part]?.start??0;}if(part===shape.idat.length){controller.close();return;}const end=Math.min(offset+1024,shape.idat[part]!.end);controller.enqueue(bytes.slice(offset,end));offset=end;}},{highWaterMark:0});
 const reader=compressed.pipeThrough(new DecompressionStream('deflate')).getReader(),row=1+shape.width*shape.channels,expected=shape.height*row;let size=0;
 try{while(true){const chunk=await reader.read();if(!active())throw new ApiError('DOCUMENT_ATTACHMENT_READ_PAUSED');if(chunk.done)break;if(chunk.value.byteLength>expected-size)return bad();for(let i=(row-size%row)%row;i<chunk.value.length;i+=row)if(chunk.value[i]!>4)return bad();size+=chunk.value.length;}if(size!==expected)return bad();}
 catch(e){throw e instanceof ApiError?e:new ApiError('DOCUMENT_PNG_DECODE_FAILED');}
 finally{await reader.cancel().catch(()=>{});reader.releaseLock();}
}
/** 기존 보호 GET의 고정 첨부만 소비한다. SVG/HTML/animation·외부 URL·새 권한은 없다. */
export async function readStoredDocumentPng(client:ApiClient,projectId:string,documentRef:Ref,attachment:Artifact,active:()=>boolean=()=>true):Promise<StoredDocumentPng>{
 const check=()=>{if(!active())throw new ApiError('DOCUMENT_ATTACHMENT_READ_PAUSED');};check();const pinned=structuredClone(documentRef),selected=structuredClone(attachment);
 if(!selected||selected.mediaType!=='image/png'||!Number.isSafeInteger(selected.bytes)||selected.bytes<57||selected.bytes>2097152||!/^[a-f0-9]{64}$/.test(selected.contentHash)||!/^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/.test(selected.artifactId))return unsupported();
 const value=await readDocument(client,projectId,pinned.id,pinned.version,{expectedContentHash:pinned.contentHash,active});check();
 const matches=value.document.content.attachments.filter(a=>a.artifactId===selected.artifactId);
 if(matches.length!==1||matches[0]!.bytes!==selected.bytes||matches[0]!.mediaType!==selected.mediaType||matches[0]!.contentHash!==selected.contentHash)throw new ApiError('DOCUMENT_ATTACHMENT_REFERENCE_CHANGED');
 let r:Response;try{r=await client.transport.call(globalThis,`/api/v1/projects/${projectId}/files/${selected.artifactId}`,{method:'GET',credentials:'same-origin',redirect:'error',cache:'no-store',headers:{Accept:'application/octet-stream'}});}catch{throw new ApiError('CONNECTION_LOST');}
 if(!active()){await r.body?.cancel().catch(()=>{});check();}if(!r.ok)throw new ApiError('ARTIFACT_READ_FAILED',r.status);
 if(!/^application\/octet-stream\b/i.test(r.headers.get('content-type')??'')||!r.body)throw new ApiError('RESPONSE_INVALID');
 const reader=r.body.getReader(),bytes=new Uint8Array(selected.bytes);let size=0;
 try{while(true){const part=await reader.read();if(!active()){await reader.cancel();check();}if(part.done)break;if(part.value.byteLength>selected.bytes-size){await reader.cancel();throw new ApiError('ARTIFACT_INTEGRITY_FAILED');}bytes.set(part.value,size);size+=part.value.byteLength;}}catch(e){throw e instanceof ApiError?e:new ApiError('CONNECTION_LOST');}finally{reader.releaseLock();}
 const hash=[...new Uint8Array(await crypto.subtle.digest('SHA-256',bytes))].map(n=>n.toString(16).padStart(2,'0')).join('');check();if(size!==selected.bytes||hash!==selected.contentHash)throw new ApiError('ARTIFACT_INTEGRITY_FAILED');
 const shape=dimensions(bytes);await verifyPixels(bytes,shape,active);check();let binary='';for(let i=0;i<bytes.length;i+=16384)binary+=String.fromCharCode(...bytes.subarray(i,i+16384));return{dataUrl:'data:image/png;base64,'+btoa(binary),width:shape.width,height:shape.height};
}
