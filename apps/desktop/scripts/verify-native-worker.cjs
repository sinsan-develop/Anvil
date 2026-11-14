'use strict';
const {createHash}=require('node:crypto');
// 고정 runtime 의존성. 배포 loader의 해석은 별도이며 시험에서 실제 모듈 검산을 수행한다.
/** @type {string} */const peModule='pe-library';
/** @typedef {{info:{pointerToRawData:number,sizeOfRawData:number,virtualAddress:number}}} Section */
const MAX_BYTES=64*1024*1024,MAX_METADATA=8*1024*1024,MAX_ROWS=200000,WORKER='OwnershipEvidenceWorker';
/** @returns {never} */
function fail(){throw Error('NATIVE_WORKER_OUTPUT_INVALID');}
// ECMA-335 II.22 / II.24: 표마다 heap/simple/coded index 폭을 실제 row 수로 계산한다.
const layouts=[
 '2,S,G,G,G','cResolutionScope,S,S','4,S,S,cTypeDefOrRef,t4,t6','t4','2,S,B','t6','4,2,2,S,B,t8','t8','2,2,S','t2,cTypeDefOrRef','cMemberRefParent,S,B','2,cHasConstant,B','cHasCustomAttribute,cCustomAttributeType,B','cHasFieldMarshal,B','2,cHasDeclSecurity,B','2,4,t2','4,t4','B','t2,t20','t20','2,S,cTypeDefOrRef','t2,t23','t23','2,S,B','2,t6,cHasSemantics','t2,cMethodDefOrRef,cMethodDefOrRef','S','B','2,cMemberForwarded,S,t26','4,t4','4,4','4','4,2,2,2,2,4,B,S,S','4','4,4,4','2,2,2,2,4,B,S,S,B','4,t35','4,4,4,t35','4,S,B','4,4,S,S,cImplementation','4,4,S,cImplementation','t2,t2','2,2,cTypeOrMethodDef,S','cMethodDefOrRef,B','t42,cTypeDefOrRef'
];
/** @type {Record<string,{bits:number,tables:number[]}>} */
const coded={ResolutionScope:{bits:2,tables:[0,26,35,1]},TypeDefOrRef:{bits:2,tables:[2,1,27]},MemberRefParent:{bits:3,tables:[2,1,26,6,27]},HasConstant:{bits:2,tables:[4,8,23]},HasCustomAttribute:{bits:5,tables:[6,4,1,2,8,9,10,0,14,23,20,17,26,27,32,35,38,39,40,42,44,43]},CustomAttributeType:{bits:3,tables:[6,10]},HasFieldMarshal:{bits:1,tables:[4,8]},HasDeclSecurity:{bits:2,tables:[2,6,32]},HasSemantics:{bits:1,tables:[20,23]},MethodDefOrRef:{bits:1,tables:[6,10]},MemberForwarded:{bits:1,tables:[4,6]},Implementation:{bits:2,tables:[38,35,39]},TypeOrMethodDef:{bits:1,tables:[2,6]}};
/** @param {Buffer} input */
async function verifyNativeWorker(input){
 const started=performance.now(),check=()=>{if(performance.now()-started>=10000)fail();};
 if(!Buffer.isBuffer(input)||input.length<512||input.length>MAX_BYTES)fail();const b=Buffer.from(input);
 /** @param {number} at @param {number} n @param {number} [end] */
 const range=(at,n,end=b.length)=>{check();if(!Number.isSafeInteger(at)||!Number.isSafeInteger(n)||at<0||n<0||at+n>end||at+n>b.length)fail();return at;};
 /** @param {number} at */const u16=at=>b.readUInt16LE(range(at,2));
 /** @param {number} at */const u32=at=>b.readUInt32LE(range(at,4));
 try{
 const {NtExecutable}=await import(peModule);check();const pe=NtExecutable.from(b);
 /** @type {Section[]} */
 const sections=pe.getAllSections();
 if(pe.is32bit()||pe.newHeader.fileHeader.machine!==0x8664||(pe.newHeader.fileHeader.characteristics&0x2000)||sections.length<1||sections.length>96)fail();
 const spans=sections.map(s=>({raw:s.info.pointerToRawData,n:s.info.sizeOfRawData,rva:s.info.virtualAddress}));for(const s of spans){range(s.raw,s.n);if(!s.n||s.raw<pe.getTotalHeaderSize()||s.rva+s.n>0x100000000)fail();}
 for(let i=0;i<spans.length;i++)for(let j=0;j<i;j++){const a=spans[i],c=spans[j];if(a.raw<c.raw+c.n&&c.raw<a.raw+a.n||a.rva<c.rva+c.n&&c.rva<a.rva+a.n)fail();}
 /** @param {number} rva @param {number} n */
 const locate=(rva,n)=>{const found=spans.filter(s=>rva>=s.rva&&rva+n<=s.rva+s.n);if(found.length!==1)fail();return range(found[0].raw+rva-found[0].rva,n);};
 const dir=pe.newHeader.optionalHeaderDataDirectory.get(14);if(dir.size<72||dir.size>MAX_METADATA)fail();const cli=locate(dir.virtualAddress,dir.size);
 if(u32(cli)!==72||!(u32(cli+16)&1)||(u32(cli+16)&0x10)||u32(cli+32)||u32(cli+36))fail();
 const metadataSize=u32(cli+12);if(!metadataSize||metadataSize>MAX_METADATA)fail();const root=locate(u32(cli+8),metadataSize),end=root+metadataSize;
 if(u32(cli+24)!==0||u32(cli+28)!==0)fail();
 const protectedRanges=[{at:cli,n:dir.size},{at:root,n:metadataSize}];
 for(let i=0;i<protectedRanges.length;i++)for(let j=0;j<i;j++){const a=protectedRanges[i],c=protectedRanges[j];if(a.at<c.at+c.n&&c.at<a.at+a.n)fail();}
 for(let i=0;i<16;i++)if(i!==14){const d=pe.newHeader.optionalHeaderDataDirectory.get(i);if(d.size){const at=i===4?range(d.virtualAddress,d.size):locate(d.virtualAddress,d.size);if(protectedRanges.some(p=>at<p.at+p.n&&p.at<at+d.size))fail();}}
 for(let at=cli+32;at<cli+72;at+=4)if(u32(at))fail();
if(u32(root)!==0x424a5342||u32(root+8)!==0)fail();
 const ver=u32(root+12);if(ver<1||ver>256||ver%4)fail();range(root+16,ver,end);let cursor=root+16+ver;range(cursor,4,end);const count=u16(cursor+2);cursor+=4;if(count<2||count>5)fail();
 /** @type {Map<string,{at:number,size:number}>} */const streams=new Map();
 for(let i=0;i<count;i++){range(cursor,8,end);const offset=u32(cursor),size=u32(cursor+4);let stop=cursor+8;while(stop<end&&stop<cursor+40&&b[stop])stop++;if(stop>=end||stop>=cursor+40)fail();if(b.subarray(cursor+8,stop).some(v=>v<32||v>126))fail();const padded=cursor+8+Math.ceil((stop-(cursor+8)+1)/4)*4;range(stop,padded-stop,end);if(b.subarray(stop,padded).some(v=>v!==0))fail();const name=b.toString('ascii',cursor+8,stop);if(!['#~','#Strings','#Blob','#GUID','#US'].includes(name)||streams.has(name)||offset%4||size>MAX_METADATA)fail();range(root+offset,size,end);streams.set(name,{at:root+offset,size});cursor=cursor+8+Math.ceil((stop-(cursor+8)+1)/4)*4;}
 const ordered=[...streams.values()].sort((a,c)=>a.at-c.at);for(let i=0;i<ordered.length;i++)if(ordered[i].at<cursor||i&&ordered[i-1].at+ordered[i-1].size>ordered[i].at)fail();
 const st=streams.get('#~'),strings=streams.get('#Strings'),blobs=streams.get('#Blob');if(!st||!strings||!blobs||!strings.size||!blobs.size||b[strings.at]!==0||b[blobs.at]!==0)fail();const guid=streams.get('#GUID');if(guid&&guid.size%16)fail();range(st.at,24,st.at+st.size);if(u32(st.at)!==0||b[st.at+4]!==2||b[st.at+5]!==0||b[st.at+7]!==1||(b[st.at+6]&~7))fail();
 const heaps=b[st.at+6],valid=b.readBigUInt64LE(st.at+8);if(valid>>45n)fail();const counts=Array(45).fill(0),starts=Array(45).fill(0),widths=Array(45).fill(0);let tableAt=st.at+24,total=0;
 for(let t=0;t<45;t++)if(valid&(1n<<BigInt(t))){range(tableAt,4,st.at+st.size);counts[t]=u32(tableAt);tableAt+=4;total+=counts[t];if(total>MAX_ROWS)fail();}
 /** @param {string} f */
 const width=f=>{if(f==='S')return heaps&1?4:2;if(f==='G')return heaps&2?4:2;if(f==='B')return heaps&4?4:2;if(f[0]==='t')return counts[Number(f.slice(1))]>=65536?4:2;if(f[0]==='c'){const c=coded[f.slice(1)];if(!c)fail();return Math.max(...c.tables.map(t=>counts[t]))>=2**(16-c.bits)?4:2;}return Number(f);};
 for(let t=0;t<45;t++){widths[t]=layouts[t].split(',').reduce((n,f)=>n+width(f),0);starts[t]=tableAt;range(tableAt,counts[t]*widths[t],st.at+st.size);tableAt+=counts[t]*widths[t];}
 if(st.at+st.size-tableAt>3||b.subarray(tableAt,st.at+st.size).some(x=>x!==0)||counts[0]!==1||counts[32]!==1||counts[40]!==0||!counts[2]||!counts[6])fail();
 /** @param {number} table @param {number} row */
 const row=(table,row)=>{if(row<1||row>counts[table])fail();let at=starts[table]+(row-1)*widths[table];return layouts[table].split(',').map(f=>{const n=width(f),v=n===2?u16(at):u32(at);at+=n;return v;});};
 /** @param {number} index */
 const text=index=>{if(index<0||index>=strings.size)fail();const start=strings.at+index,limit=Math.min(strings.at+strings.size,start+1025);let stop=start;while(stop<limit&&b[stop])stop++;if(stop===limit)fail();return new TextDecoder('utf-8',{fatal:true}).decode(b.subarray(start,stop));};
 const module=row(0,1);if(!guid||!module[2]||module[2]*16>guid.size||module[3]*16>guid.size||module[4]*16>guid.size||text(module[1])!=='OwnershipEvidenceWorker.exe')fail();
 const token=u32(cli+20);if(token>>>24!==6)fail();const methodId=token&0xffffff,m=row(6,methodId);if(text(m[3])!=='Main'||(m[2]&7)!==6||!(m[2]&0x10)||(m[2]&0x2400)||m[1]!==0||!m[0])fail();const entry=locate(m[0],1);if(protectedRanges.some(p=>entry>=p.at&&entry<p.at+p.n))fail();
 let owner=0;for(let t=1;t<=counts[2];t++){const v=row(2,t),next=t===counts[2]?counts[6]+1:row(2,t+1)[5];if(v[5]<=methodId&&methodId<next){if(text(v[1])!=='OwnershipEvidenceWorker'||text(v[2])!=='Anvil.Native.OwnershipEvidence')fail();owner++;}}if(owner!==1)fail();
 // 정확 static int Main(string[]) 서명. 일반 IL 검증기/실행기가 아니다.
 let sig=blobs.at+m[4];range(sig,1,blobs.at+blobs.size);if(b[sig]!==5)fail();range(sig+1,5,blobs.at+blobs.size);if(!b.subarray(sig+1,sig+6).equals(Buffer.from([0,1,8,0x1d,0x0e])))fail();
 if(text(row(32,1)[7])!=='OwnershipEvidenceWorker')fail();check();
 return Object.freeze({workerHash:createHash('sha256').update(b).digest('hex'),workerBytes:b.length,entryPoint:'Anvil.Native.OwnershipEvidence.OwnershipEvidenceWorker',compilerExecuted:false,nativeAdmissionVerified:false});
 }catch{throw Error('NATIVE_WORKER_OUTPUT_INVALID');}
}
module.exports={verifyNativeWorker,MAX_BYTES};
