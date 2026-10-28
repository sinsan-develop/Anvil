import assert from 'node:assert/strict';
import {test} from 'node:test';
import {existsSync} from 'node:fs';
import {AuthFailure} from '../../../apps/server/modules/access/repository.ts';

// FN16 내부 inventory 입력만 검증한다. DB/파일 원문/키/서비스 및 collector 실행 0.
const projectId='71000000-0000-4000-8000-000000000001';
const marker='synthetic-private-input-detail';
const valid=()=>({projectId,limits:{metadataBytes:1048576,inputBytes:20971520,fileCount:200,deadlineMs:5000}});
const fields=['metadataBytes','inputBytes','fileCount','deadlineMs'] as const;
type Input=ReturnType<typeof valid>;
async function reader():Promise<(value:unknown)=>Readonly<Input>>{
 const url=new URL('../../../apps/server/modules/backups/document-inventory-input.ts',import.meta.url);
 const module:any=existsSync(url)?await import(url.href):{};
 assert.equal(typeof module.readDocumentInventoryInput,'function','문서 inventory 입력 함수 미구현');
 return module.readDocumentInventoryInput;
}
function invalid(read:(value:unknown)=>unknown,value:unknown){
 assert.throws(()=>read(value),(error:any)=>error instanceof AuthFailure&&error.message==='INPUT_INVALID'&&error.statusCode===400
  &&error.cause===undefined&&!JSON.stringify(error).includes(marker)&&!String(error.stack).includes(marker));
}

test('inventoryInput 정상 닫힌 입력을 독립 snapshot으로 복제한다',async()=>{
 const read=await reader(),input=valid(),expected=structuredClone(input),result=read(input);
 assert.deepEqual(result,expected);assert.notEqual(result,input);assert.notEqual(result.limits,input.limits);
 input.projectId='71000000-0000-4000-8000-000000000002';input.limits.metadataBytes=1;
 assert.deepEqual(result,expected,'호출 뒤 원 입력 변경이 검증 결과를 바꾸지 않는다');
 assert.deepEqual(Object.keys(result).sort(),['limits','projectId']);
 assert.deepEqual(Object.keys(result.limits).sort(),[...fields].sort());
});

test('inventoryInput 양의 안전정수 양끝을 기본값 치환 없이 보존한다',async()=>{
 const read=await reader();
 for(const number of [1,Number.MAX_SAFE_INTEGER]){
  const input=valid();for(const field of fields)input.limits[field]=number;
  assert.deepEqual(read(input),input);
 }
});

test('inventoryInput top과 limits의 누락·추가·비data shape를 거절한다',async()=>{
 const read=await reader();
 for(const value of [null,undefined,[],true,'input',{}, {projectId}, {limits:valid().limits},
  {...valid(),token:'not-a-token'}, {...valid(),limits:{...valid().limits,extra:1}},
  {...valid(),limits:[]},{...valid(),limits:null},Object.create(valid())])invalid(read,value);
 for(const field of fields){const input:any=valid();delete input.limits[field];invalid(read,input);}
 const symbolTop:any=valid();symbolTop[Symbol('extra')]=true;invalid(read,symbolTop);
 const symbolLimits:any=valid();symbolLimits.limits[Symbol('extra')]=true;invalid(read,symbolLimits);
 const hidden:any=valid();Object.defineProperty(hidden,'extra',{value:1,enumerable:false});invalid(read,hidden);
});

test('inventoryInput projectId의 잘못된 UUID와 형식 변환 입력을 거절한다',async()=>{
 const read=await reader();
 for(const id of ['',null,1,'not-a-uuid',' '+projectId,projectId+' ',projectId.slice(0,-1),'71000000-0000-0000-0000-000000000001']){
  invalid(read,{...valid(),projectId:id});
 }
});

test('inventoryInput 각 한도의 0·음수·분수·무한·비안전정수·문자열을 거절한다',async()=>{
 const read=await reader();
 for(const field of fields)for(const value of [0,-0,-1,0.5,NaN,Infinity,-Infinity,Number.MAX_SAFE_INTEGER+1,'1',null,undefined,1n]){
  const input:any=valid();input.limits[field]=value;invalid(read,input);
 }
});

test('inventoryInput getter를 실행하지 않고 top과 중첩 accessor를 거절한다',async()=>{
 const read=await reader();let invoked=0;
 const getter=()=>{invoked++;throw Object.assign(Error(marker),{cause:marker});};
 for(const field of ['projectId','limits']){
  const input=valid();Object.defineProperty(input,field,{get:getter,enumerable:true});invalid(read,input);
 }
 for(const field of fields){const input=valid();Object.defineProperty(input.limits,field,{get:getter,enumerable:true});invalid(read,input);}
 assert.equal(invoked,0,'검증 단계는 accessor의 사용자 코드를 실행하지 않는다');
});

test('inventoryInput reflection 실패의 원 오류·cause를 고정 오류로 정규화한다',async()=>{
 const read=await reader();
 const fail=()=>{throw Object.assign(Error(marker),{cause:marker});};
 invalid(read,new Proxy(valid(),{ownKeys:fail}));
 invalid(read,{...valid(),limits:new Proxy(valid().limits,{getOwnPropertyDescriptor:fail})});
});

test('inventoryInput descriptor의 data snapshot을 검증·반환하여 Proxy get 변경을 실행하지 않는다',async()=>{
 const read=await reader(),expected=valid();let reads=0;
 const limits=new Proxy(valid().limits,{get(target,key,receiver){if(key==='metadataBytes'){reads++;return reads<3?1:Infinity;}return Reflect.get(target,key,receiver);}});
 const result=read({...valid(),limits});
 assert.deepEqual(result,expected,'검증된 own data descriptor 값과 반환값이 같아야 한다');
 assert.equal(reads,0,'검사 뒤 property get으로 입력 사용자 코드를 다시 실행하지 않는다');
});

test('inventoryInput top get과 descriptor 재호출 없이 한 번 잡은 data 값만 사용한다',async()=>{
 const read=await reader(),expected=valid(),counts=new Map<string,number>();let gets=0;
 const wrap=(target:any,prefix:string)=>new Proxy(target,{get(){gets++;throw Error(marker);},getOwnPropertyDescriptor(object,key){const name=prefix+String(key),count=(counts.get(name)??0)+1;counts.set(name,count);const descriptor=Reflect.getOwnPropertyDescriptor(object,key);if(descriptor&&'value'in descriptor&&count>1)return{...descriptor,value:Infinity};return descriptor;}});
 const source=valid();source.limits=wrap(source.limits,'limits.');const result=read(wrap(source,'top.'));
 assert.deepEqual(result,expected);assert.equal(gets,0);assert(counts.size===6);assert([...counts.values()].every(n=>n===1));
});
