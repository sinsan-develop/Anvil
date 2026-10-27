# FN12/UI05 결과 검수 기준 개정 연결 작업지시서

2026-10-27 · Main 어울 · 기준 codex/av3-stage-b / 3891c544c182ca868d088672b8b1068876c00b48.

## 목적과 기존 승인 범위

승인된 FN12/UI05의 결과 검수 기준을 기존 서버 계약대로 개정한다. INTERFACES.md의 saveResultCriteria는 최초 null/0/baseRef=null과 개정 exact 직전 ref/버전을 이미 정의한다. 서버는 지원하지만 현재 웹은 최초 저장만 가능하다. 새 API·DTO·SQL·DB·권한 의미를 추가하지 않고 기존 명시 AUTO 정책·현재 로그인/제어 검사를 유지한다. 등록은 합격·기준 적용·완료·실행 허가가 아니다.

## 단일 구현 담당 허용 경로

1. apps/web/src/features/session-detail/result-criteria-api.ts
2. apps/web/src/features/session-detail/ResultCriteriaEditor.tsx
3. apps/web/src/features/session-detail/ResultReviewSources.tsx
4. tests/unit/UI05/result-criteria-revision-api.test.ts (신규)
5. tests/browser/UI05/result-criteria-revision.spec.ts (신규)

기존 시험·파일 양식·공통 ordered·server·SQL·Auth·정책·실DB·서비스·Secret·실제 Agent·의존성·보호 untracked8·Main 문서는 변경하지 않는다. SessionDetailPage와 CriteriaDraftFiles는 기존 props/disabled 계약으로 재사용한다. 새 branch/사용자 채팅/자동화/자원/commit/push는 만들지 않는다. 구현 writer는 1명, Main은 제품 수정 없이 관리·검수·통합한다.

## 동작·보존 계약

- 기존 목록과 정확 버전 보호 reader를 사용하여 사용자가 개정 원문을 명시적으로 선택한다. 최신 자동선택·전송·적용은 하지 않는다. 이전 원문은 불변이다.
- 개정 초안은 선택 RegisteredCriteria의 full ref와 원 input.items의 모든 sources 및 environmentRef를 보존한다. 최초 CriteriaRow의 한 source 표현으로 펼쳐 중복/누락하지 않는다. 개정 폼은 item 단위 기준 ID·시험 ID·종류·이유를 편집하고 원조건 매핑/환경은 고정 표시한다. 원조건 전체 포함·중복·문구 hash·확정 임무/기준 참조를 기존 규칙으로 검증한다.
- prepareCriteriaRevision(assignment,base,items,reason,session,generation) 또는 동일하게 검토 가능한 내부 함수를 추가한다. base를 보호 reader와 동등한 구조/hash로 검증하고 targetId=base.ref.id, expectedVersion=base.ref.version, payload.baseRef=정확 full ref를 고정한다. 위조/다른 임무/기준/환경·source 누락/변형을 거절한다.
- saveCriteriaRegistration은 기존 최초 명령 동작을 그대로 보존하며 개정의 full 결박도 검증한다. 명령 target과 응답 ID는 같고 새 버전은 직전+1이어야 한다. POST 영수증과 동적 /versions/:version 보호 GET 원문을 모두 대조한다. approvalRef=null·baselineRefs=[]·저장 외 flags=false를 유지한다.
- 개정 입력/원명령은 기존 App 메모리에 유지한다. 신규/dirty/pending/uncertain buffer를 다른 기준 선택으로 덮지 않는다. 개정 준비/명시 저장/같은 명령 재확인을 분리한다. 서버 CAS 거절은 기존 확정 거절 해제 절차만 사용하고 최신 버전을 추측하지 않는다.
- APPLIED 뒤 GET 실패·단절·불명 응답에서는 저장 가능성과 원명령을 보존한다. 이탈/주체/client/제어/선택 변경·늦은 응답이 다른 buffer를 덮지 않아야 한다. 새 명령 자동 발행0. 선택·비동기 결과 적용은 binding/요청 identity를 대조한다. optional undefined own-key를 만들지 않는다.
- 기존 입력 파일 v1은 최초 등록 전용으로 보존한다. 개정 모드의 import/export는 비활성하고 정확 이유를 표시하여 baseRef/다중 sources가 유실되는 파일을 만들지 않는다. 파일 schema를 몰래 개정하지 않는다.
- 기존 에디터 위치/검토 기능은 유지하고 동일 buffer의 복수 editor를 렌더하지 않는다. 성공 후 새 개정은 사용자가 명시적으로 선택하고 저장된 결과를 보존하는 동작으로만 시작한다.

## 수행·검수 순서

1. 지침/정본/실제 HEAD/보호8을 확인한다. 첫 단계는 신규 unit 1파일만 작성하며 제품 변경0. 정상 v1→v2, 다중 source 보존, 위조 base/source/주체 거절, receipt 버전/ID 불일치·GET 실패/동일명령/active 이탈 반례를 제시한다. Main이 실제 RED를 확인한 뒤 같은 담당에게 구현을 지시한다.
2. 허용 제품3파일을 구현하고 신규 unit·기존 result-criteria-api 및 FN12 직접 인접만 검사한다. 기존 PASS 불필요 반복·전체 회귀·기준 완화0. 타입/메모리 빌드/diff 검사 후 동결·파일 hash/명령/exit/미검증을 보고한다.
3. 독립 검수로 실제 계약·권한/미확인·다중 sources·기존 최초 저장 보존을 확인한다. Main은 실제 App+합성 API의 정상 개정, 원본 선택 거절/불일치, POST/GET 실패·화면 이탈/늦은 응답·기존 입력 보존을 필요한 범위만 확인한다. 실제 PG/WSL 서비스/Agent 증거로 승격하지 않는다.
4. Main 소유 현황/결과와 기존 branch checkpoint/private 게시만 진행한다. Stage 전체 Gate/실DB/서비스/사용자 인수가 남으므로 전체 완료·PR/병합을 주장하지 않는다.

## QA 예정·제외

신규 실제 App 시험은 Main이 생성 직전에 D:/tmp/anvil-v3-stage-b/ui05-result-criteria-revision-20261027-01을 별도 사전등록하고 부재/owner SINSAN\cyhuh·realpath/link·수명 최대30분을 확인한 뒤 수행한다. 현 단계 생성0이다. 각 실행 종료 시 정확 소유 경로·관련 프로세스만 정리하고 별도 잔여0을 확인한다. DB/schema/권한/Secret/TLS/서비스·native/외부 Agent·실비용·Oracle 실행은 모두 제외한다. rollback은 소유 변경의 후속 revert이며 기존 자료 reset/삭제0이다.