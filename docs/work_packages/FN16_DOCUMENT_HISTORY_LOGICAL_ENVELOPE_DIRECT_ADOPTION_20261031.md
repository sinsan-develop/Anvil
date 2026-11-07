# FN16 DOCUMENT_VERSION 비활성 역사 논리형식 한정 직접 채택

2026-10-31 / Main 어울 / DIRECT_HUMAN_ADOPTION_VIA_PMO

## 승인 근거와 결박
- 신산님은 PMO chat에서 DOCUMENT_VERSION 논리봉투 A의 한정 채택에 ‘그래’라고 직접 답했고 전달 질문에도 ‘그래’라고 답했다. PMO 01a054f5-c2b4-7af0-b31a-c8148ef74642의 trusted codex_delegation이 이 Main chat에 이를 전달했다. PMO cursor66의 완료 요약과 실제 수신 메시지를 구분하며 실제 전달 내용을 근거로 한다.
- 대상: docs/contracts/FN16_RESTORE_HISTORICAL_IDENTITY_CANDIDATE_20261031.md SHA256 924D7359C4113D87B9C3C16B85682A6221E4A1434C92DDDDCD3EB71BB0BF1285의 §10, DOCUMENT_VERSION 1종 비활성 역사 논리형식.
- 검수: nodeId:UUID Important1을 실제 readStageNodeRef 제한 문자열로 보정한 최종 scoped C0/I0. 원19201B의 비교 이력/prefix4339D2BD 보존. 후보 원문을 고쳐 나머지 제안까지 채택된 것처럼 만들지 않는다.
- 안전 기준선: codex/av3-stage-b 7c5cc10855f455fa94be512e1eb4febc951f466d, 제품 마지막 변경6c643577. main f976ed5e29e14b13e12729d5b1ccf98f050f2210 불변을 별도로 확인했다.

## 채택 범위
- source-only 타입·검산 업무의 기준: 고정 원manifest namespace/원ref·원projection hash와 문서4필드 contentHash 구분, 비계정 historical user/client, 원증빙ref와 현재 OWNER 분리.
- stage null/제한문자열 nodeId 및 원snapshot 기반 버전 결정(추정 최신0), 닫힌 검사항목/배타 상태, 논리적 동일키·충돌/UNKNOWN·미공개준비 회수의 의미.
- 이 한정 채택으로 후속 source-only WI를 Main이 고정·독립 검토하고 기존 Primary 구현/Main 검수·통합으로 진행한다. 같은 승인 재요청 없이 승인 경계를 지킨다.

## 제외 및 미정
- 실제 parser·외부 byte/JSON/stream 해석·수입/영속저장·public API·DBschema/실행·권한·현재계정연결·active 파생·실제 복원은 포함하지 않는다.
- 원출처 증명·관계 codec·제품한도·접근/영속/crash 미정은 MISSING/UNSUPPORTED/NOT_RUN이며 자가선언 체크·성공 callback으로 VERIFIED를 발급하지 않는다.
- 실제DB·권한·키·사용자파일조사·서비스·Agent·기존 프로젝트 차단 해제0. 전체 coverage412, 기존 기능·원자료/권한·미검증 상태를 보존한다.
- 논리 hash 계산/분류기의 시험은 출처 진위·원문 전체·실제바이트·저장·복원·사용자인수 증거가 아니다. 전체 FN16/Stage/계획은 미완료다.
