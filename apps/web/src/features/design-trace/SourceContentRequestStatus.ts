import {createElement as h} from 'react';
import {readSourceContentStatusV1,readSourceContentProofStatusV1} from '../../../../../contracts/source-content-status-v1.ts';
const states={CREATED:'요청 기록 있음',CHALLENGED:'교환 준비 기록',ISSUED:'발급 기록 있음',REPORTED:'보고 기록 있음',REVOKED:'요청 회수 기록',EXPIRED:'만료 기록',UNKNOWN:'결과 미확인'};
const reasons:Record<string,string>={CURRENT_AUTHORITY_UNAVAILABLE:'현재 권한 미확인',POLICY_ABSENT:'정책 기록 없음',MALFORMED_HEAD:'최신 정책 자료 미확인',POLICY_REVOKED:'정책 회수 기록',POLICY_DENIED:'정책 거절 기록',POLICY_EXPIRED:'정책 만료 기록',SUBJECT_MISMATCH:'정책 주체 불일치',REQUEST_OUTSIDE_ORIGINAL_LIFETIME:'원 요청 수명 밖',CONTENT_POLICY_REF_CHANGED:'요청과 최신 정책 참조 불일치'};
/** 비활성 표시 후보. 앱/router에 연결하지 않으며 fetch·저장·실행·승인 버튼/handler가 없다. */
export function SourceContentRequestStatus({value,expected,proof}:{value:unknown;expected:unknown;proof?:unknown}){
 let v:ReturnType<typeof readSourceContentStatusV1>;
 try{v=readSourceContentStatusV1(value,expected);}catch{return h('p',{role:'alert'},'표시 자료를 확인하지 못했습니다. 실제 상태·권한은 미확인입니다.');}
 return h('section',{'aria-label':'내용 관측 요청 상태 후보',className:'status-card'},
  h('h3',null,'보관된 요청 상태'),h('p',null,states[v.requestState]),
  h('p',{className:'meta'},`요청 ${v.requestRef.id} v${v.requestRef.version} · 대상 ${v.targetCount}개 · 상태 기록 ${v.stateRecordedAt}`),
  h('p',{role:'status'},`별도 정책 판독: ${reasons[v.policy.reason]}`),
  h('p',{className:'meta'},'분리 조회이며 현재 권한 미확인입니다. 파일 내용 일치·관측 성공은 확인하지 않았습니다.'),
  h('p',{className:'meta'},'비활성 표시 후보입니다. 저장·연결·Agent 실행은 수행하지 않습니다.'),
  proof===undefined?null:proofStatus(proof,{projectId:v.projectId,requestRef:v.requestRef}));
}

function proofStatus(value:unknown,expected:unknown){
 let proof:ReturnType<typeof readSourceContentProofStatusV1>;
 try{proof=readSourceContentProofStatusV1(value,expected);}catch{return h('p',{role:'alert'},'서명 입력 표시 자료를 확인하지 못했습니다. 실제 서명·현재 권한은 미확인입니다.');}
 if(proof.candidate===null)return h('p',{role:'status'},'검증 입력 후보 없음. 실제 서명·현재 권한은 미확인입니다.');
 const c=proof.candidate;
 return h('div',{'aria-label':'비활성 서명 입력 표시'},
  h('h4',null,'서명 검증 입력 후보'),
  h('p',{className:'meta'},`요청 ${c.requestRef.id} v${c.requestRef.version} · 보고 ${c.reportRef.id} v${c.reportRef.version}`),
  h('p',{className:'meta'},`domain ${c.proofDomain} · 입력 digest ${c.proofInputHash}`),
  h('p',{role:'status'},'실제 서명·현재 권한은 미확인입니다. 저장·연결·실행은 수행하지 않습니다.'));
}
