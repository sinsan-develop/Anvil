import {createHash} from 'node:crypto';

// fixtures/v1/manifest.json의 고정 QA A 입력이다. 호출자가 기준선·허용 경로를 대체하지 않는다.
const baseline=[
 {path:'src/ready-state.mjs',bytes:63,sha256:'bec57c71476b73a91b2cdace86be31064a495e8663501a0fdd3648a3bfb52e62'},
 {path:'test/ready-state.test.mjs',bytes:728,sha256:'1fb5326c175b65ddf4ff8006827c2b8febbf369a6dc2af88ac3efeb2ec3d8e49'},
] as const;
const invalid=():never=>{throw Error('IX02_QA_A_FILE_EVIDENCE_INVALID');};
function exact(value:unknown,keys:string[]):value is Record<string,unknown>{
 return !!value&&typeof value==='object'&&!Array.isArray(value)&&Object.keys(value).length===keys.length&&keys.every(key=>Object.hasOwn(value,key));
}
function captures(input:unknown){
 if(!Array.isArray(input)||input.length!==baseline.length)return invalid();
 const files=new Map<string,Buffer>();
 for(const capture of input){
  if(!exact(capture,['path','kind','bytes']))return invalid();
  const {path,kind,bytes}=capture;
  if(typeof path!=='string'||!baseline.some(file=>file.path===path)||files.has(path)||kind!=='FILE'||!(bytes instanceof Uint8Array))return invalid();
  files.set(path,Buffer.from(bytes));
 }
 return files;
}
const fingerprint=(bytes:Buffer)=>({bytes:bytes.byteLength,sha256:createHash('sha256').update(bytes).digest('hex')});

/** 이미 수거된 두 파일만 대조한다. 미관측 경로·수거 출처·코드 의미·시험 실행·IX02 인수를 판정하지 않는다. */
export function verifyQaAFileEvidence(input:unknown){
 if(!exact(input,['before','after','changedPaths']))return invalid();
 const before=captures(input.before),after=captures(input.after),declared=input.changedPaths;
 if(!Array.isArray(declared)||declared.some(path=>typeof path!=='string'||!baseline.some(file=>file.path===path))||new Set(declared).size!==declared.length)return invalid();
 const files=baseline.map(expected=>{
  const previous=before.get(expected.path)!,next=after.get(expected.path)!,first=fingerprint(previous);
  if(first.bytes!==expected.bytes||first.sha256!==expected.sha256)return invalid();
  return{path:expected.path,before:first,after:fingerprint(next),changed:!previous.equals(next)};
 });
 const changed=files.filter(file=>file.changed).map(file=>file.path);
 if(!files[0]!.changed||changed.length!==declared.length||changed.some(path=>!declared.includes(path)))return invalid();
 const testCaptureChanged=files[1]!.changed;
 return{fixtureVersion:'v1' as const,scope:'SUPPLIED_CAPTURES_ONLY' as const,files,sourceCaptureChanged:true as const,testCaptureChanged,
  prescribedTestBytesPreserved:!testCaptureChanged,testExecutionVerified:false as const,wholeWorktreeVerified:false as const};
}
