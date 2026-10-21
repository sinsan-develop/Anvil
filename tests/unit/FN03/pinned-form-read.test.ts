import test from 'node:test';
import assert from 'node:assert/strict';
import { ApiClient } from '../../../apps/web/src/api/client.ts';
import {canonicalJson,contentHash} from '../../../contracts/canonical.ts';
const module = await import(new URL('../../../apps/web/src/features/methodologies/pinned-form-read.ts', import.meta.url).href).catch(error => { if (error.code === 'ERR_MODULE_NOT_FOUND') return null; throw error; });
const ref = { id: '11111111-1111-4111-8111-111111111111', version: 3, contentHash: 'a'.repeat(64) };
const standard = { id: '22222222-2222-4222-8222-222222222222', version: 2, contentHash: 'b'.repeat(64) };
export const original = { ref, definition: { formCode: 'AF02', name: '고정 설계서', purpose: '변경 전 설계 기준', scope: 'SYSTEM', authorRole: 'STAGE_OWNER', reviewerRole: 'REVIEWER', confirmerRole: 'USER', requiredInputs: ['승인된 요구 원문'], authoringStandardRef: standard,
 items: [{ itemId: 'AF02-02', title: '기능 설계', required: true, valueType: 'RECORDS', repeated: true, fields: [{ fieldId: 'AF02-02-F01', title: 'D ID', required: true, valueType: 'TEXT' }, { fieldId: 'AF02-02-F02', title: '제외 이유', required: false, valueType: 'TEXT' }], authoringRules: ['처리·저장·조회를 명시'], reviewCriteria: ['실제 근거와 대조'] }] },
 authoringStandard: { ref: standard, content: '<script>원문은 텍스트</script>' }, validation: { formatOnly: true, contentReview: 'NOT_PERFORMED', userAcceptance: 'NOT_PERFORMED' } };
standard.contentHash=contentHash(Buffer.from(original.authoringStandard.content));ref.contentHash=contentHash(canonicalJson(original.definition));
const settle = () => new Promise(resolve => setImmediate(resolve));
async function completed(states:any[]){const end=Date.now()+3000;while(!states.length&&Date.now()<end)await new Promise(r=>setTimeout(r,1));assert.equal(states.length,1);}
function watch(client: ApiClient, wanted: typeof ref, states: any[], auth: () => void = () => {}) { assert.equal(typeof module?.watchPinnedForm, 'function'); return module!.watchPinnedForm(client, wanted, (state: unknown) => states.push(state), auth); }

for(const kind of ['DEFINITION','STANDARD'])test('원 ref 표식이 같아도 '+kind+' 실제 내용 hash가 다르면 원문을 표시하지 않는다',async()=>{const value=structuredClone(original);if(kind==='DEFINITION')value.definition.purpose='위조된 정의';else value.authoringStandard.content='위조된 기준';const states:any[]=[];watch(new ApiClient(async()=>Response.json(value)),ref,states);await completed(states);assert.equal(states[0].status,'ERROR');assert.equal(states[0].error.code,'RESPONSE_INVALID');assert.equal(states[0].data,undefined);assert.equal(JSON.stringify(states).includes('위조된'),false);});

test('단계의 고정 양식 버전만 same-origin GET으로 조회하고 원 입력 참조 변경을 따르지 않는다', async () => {
 const states: any[] = [], wanted = { ...ref }, paths: string[] = []; let release!: (value: Response) => void;
 const client = new ApiClient(async (path, init) => { paths.push(String(path)); assert.equal(init?.method, 'GET'); assert.equal(init?.credentials, 'same-origin'); assert.equal(init?.cache, 'no-store'); return new Promise(resolve => { release = resolve; }); });
 watch(client, wanted, states); wanted.version = 9; wanted.contentHash = 'c'.repeat(64); release(Response.json(original)); await completed(states);
 assert.deepEqual(paths, ['/api/v1/forms/11111111-1111-4111-8111-111111111111/versions/3']); assert.equal(states.length, 1); assert.equal(states[0].status, 'READY'); assert.deepEqual(states[0].data.ref, ref);
});

test('다른 id·버전·hash나 응답 손실을 최신본/이전 성공 본문으로 대신하지 않는다', async () => {
 for (const response of [{ ...original, ref: { ...ref, version: 4 } }, { ...original, ref: { ...ref, id: standard.id } }, { ...original, ref: { ...ref, contentHash: 'c'.repeat(64) } }, null]) {
  const states: any[] = []; let calls = 0;
  watch(new ApiClient(async () => { calls++; if (response === null) throw Error('transport'); return Response.json(response); }), ref, states); await settle();
  assert.equal(calls, 1); assert.equal(states.length, 1); assert.equal(states[0].status, 'ERROR'); assert.equal(states[0].data, undefined);
 }
});

test('현재 401만 인증 만료를 알리고 403/404의 보호 본문은 표시하지 않는다', async () => {
 for (const status of [401, 403, 404]) { const states: any[] = []; let auth = 0;
  watch(new ApiClient(async () => Response.json({ code: status === 401 ? 'AUTH_REQUIRED' : 'FORBIDDEN', privateBody: 'not-visible' }, { status })), ref, states, () => auth++); await settle();
  assert.equal(auth, status === 401 ? 1 : 0); assert.equal(states[0].status, 'ERROR'); assert.equal(states[0].error.status, status); assert.equal(states[0].data, undefined); assert.equal(JSON.stringify(states).includes('not-visible'), false);
 }
});

test('닫기/전환 취소 뒤 늦은 정상·401 응답은 화면과 인증 상태에 반영하지 않는다', async () => {
 const originalDigest=crypto.subtle.digest,realDigest=originalDigest.bind(crypto.subtle);let digests=0;
 crypto.subtle.digest=async(...args)=>{const result=await realDigest(...args);digests++;return result;};
 try{for (const response of [Response.json(original), Response.json({ code: 'AUTH_REQUIRED' }, { status: 401 })]) { const states: any[] = []; let auth = 0, release!: (value: Response) => void,consumed=false;const json=response.json.bind(response);response.json=async()=>{const value=await json();consumed=true;return value;};
  const before=digests,cancel = watch(new ApiClient(async () => new Promise(resolve => { release = resolve; })), ref, states, () => auth++); cancel(); release(response);
  const end=Date.now()+3000;while((!consumed||response.ok&&digests<before+2)&&Date.now()<end)await new Promise(r=>setTimeout(r,1));assert.equal(consumed,true);if(response.ok)assert.equal(digests,before+2);await settle();
  assert.deepEqual(states, []); assert.equal(auth, 0);
 }}finally{crypto.subtle.digest=originalDigest;}
});
