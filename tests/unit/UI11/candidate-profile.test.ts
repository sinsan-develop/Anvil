import assert from 'node:assert/strict';
import {test} from 'node:test';
import {createElement} from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {canonicalJson,contentHash} from '../../../contracts/canonical.ts';
import {ApiClient} from '../../../apps/web/src/api/client.ts';
import {readCandidate} from '../../../apps/web/src/features/connections/api.ts';
import {candidateCapabilities,candidateReadiness} from '../../../apps/server/modules/connections/candidate-input.ts';
const path='../../../apps/web/src/features/connections/CandidateProfile.ts';
const id='11111111-1111-4111-8111-111111111111',ref={id,version:1,contentHash:'a'.repeat(64)};
async function fixture(kind:'CONNECTION_CANDIDATE'|'ENVIRONMENT_CANDIDATE',fields:Record<string,unknown>){
 const input={kind,candidate:{label:'보관 후보',...fields},candidateRef:null,policyRef:ref,expiresAt:'2027-01-01T00:00:00.000Z',reason:'실제 연결 아님'};
 const candidate={kind,input,readiness:candidateReadiness(input),capabilities:candidateCapabilities(input)},fixed={...ref,contentHash:contentHash(canonicalJson(candidate))};
 return readCandidate(new ApiClient(async()=>Response.json({ref:fixed,candidate,expired:false,createdAt:'2026-10-20T00:00:00.000Z',recordedBy:id,executionAuthorized:false,observedAt:'2026-10-24T00:00:00.000Z'})),id,fixed);
}
test('도구 후보의 제공·빈 값·미제공과 기록시각/조회시각을 연결 완료로 승격하지 않는다',async()=>{
 const {CandidateProfile}=await import(path),view=await fixture('CONNECTION_CANDIDATE',{toolProduct:'도구 <선언>',toolVersion:''}),before=structuredClone(view);
 const html=renderToStaticMarkup(createElement(CandidateProfile,{view}));
 for(const text of ['도구 &lt;선언&gt;','빈 값으로 제공','미제공',view.createdAt,view.observedAt,view.recordedBy,'실제 설치·연결·능력·현재 권한 확인이 아닙니다'])assert.ok(html.includes(text),text);
 assert.deepEqual(view,before);assert.doesNotMatch(html,/<button|<input|<form|<선언>/);
});
test('환경 후보는 미제공과 명시 빈 목록을 구분하고 비밀은 고정 참조로만 표시한다',async()=>{
 const {CandidateProfile}=await import(path),view=await fixture('ENVIRONMENT_CANDIDATE',{targetHostRefs:[],secretRefs:[ref],executionHostRef:ref}),before=structuredClone(view);
 const html=renderToStaticMarkup(createElement(CandidateProfile,{view}));
 for(const text of ['시험·배포 대상','명시적 빈 목록','소스 참조','미제공','비밀 참조',ref.contentHash,'v1','비밀값을 읽거나 표시하지 않습니다'])assert.ok(html.includes(text),text);
 assert.deepEqual(view,before);assert.doesNotMatch(html,/<button|<input|<form/);
});
