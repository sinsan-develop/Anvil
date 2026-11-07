# UI05 전체 실행 준비 이력 페이지·원문 선택 구현 WI — 2026-10-30

## 근거·담당·기준
- 직접 승인 docs/approvals/UI05_PREPARATION_HISTORY_PAGING_DIRECT_APPROVAL_20261030.json SHA256 1F480147F2907718A87433EEEAE42F5B93BE6C298BEDBAFCB9B8EA73395C8E96.
- 채택한 결정안 docs/work_packages/UI05_PREPARATION_HISTORY_PAGING_DECISION_PACKET_20261030.md r2 SHA256 0AC548FDFB371A576C09977A108F14818B740EBC0BDBB2DDAFD203C8C9A0817E 전체가 상세 기준이다. 당시 DRAFT 표기는 이력이며 현재 직접 승인으로 A안 채택.
- WORK_PLAN UI05/FN08의 21번째 이후 준비 기록 발견·정확 원문 조회 공백을 완성한다. 전체 기능/Stage/계획 인수 아님.
- 시작 HEAD9eb36679df39704def0f4fd1758769728b58e1dc, 기존 codex/av3-stage-b 유지. 기존 Primary 단일 code writer, 기존 Reviewer 읽기 검수, Main 관리·문서·검수·통합. Main WORK_STATUS dirty/보호 untracked8 보존. 새 세션/branch/자동화0.

## 정확 코드 쓰기 allowlist 9경로
기존2:
- apps/server/modules/projects/routes.ts — 시작 SHA256 F45009FFA1D5DDF76867AE4EF1DBF9E42DDA4804893FCCD8F394C2341F3EDCA7
- apps/web/src/features/session-detail/SessionDetailPage.tsx — 시작 SHA256 133F3DE73824F242D80F0D56B5BBDB3FCF99686BBBDCD0BEBF617EAFA58C7718
신규7(Main 부재 확인):
- apps/server/modules/executions/project-execution-preparation-pages.ts
- apps/web/src/features/session-detail/preparation-history-api.ts
- apps/web/src/features/session-detail/PreparationHistory.tsx
- tests/unit/FN08/execution-preparation-pages.test.ts
- tests/unit/UI05/preparation-history-api.test.ts
- tests/browser/UI05/preparation-history-dom.test.ts
- tests/browser/UI05/preparation-history-dom-harness.tsx
기존2는 새route/codec 의존 주입과 새 컴포넌트 연결에 한정하며 기존 집계/원문/부모 미확인buffer를 바꾸지 않는다. 추가 경로 필요 시 Main에 소비선/이유를 먼저 보고한다. 문서/commit/push는 Main, Primary는 하지 않는다.

## 계약·불변 조건
- 새 GET /api/v1/projects/:projectId/assignments/:id/versions/:version/execution-preparations, optional cursor 단일 query/고정20/기존 인증 transaction·projectMember·확정 임무read. 기존 집계 query/응답·고정 준비GET/과거조회권 보존, OWNER 임의 제한0.
- ProjectListCodec 전용 서명 namespace와 actor/project/full assignmentRef/정렬/20/query 결박, 기존30분. 새 Secret/키/codec 전역변경0. cursor DB created_at 마이크로초문자열+UUID를 그대로 왕복하며 checkedAt/JSDate 절삭 대체0. SQL tuple21조회→20표시·마지막 표시행cursor. 정적 불변 집합 보장만, 동시추가/지연COMMIT snapshot보장0·첫페이지 새로고침 재탐색.
- 각 원문을 기존 ProjectExecutionPreparations.read로 검산하고 intent.assignmentRef fullref/project/ref/hash를 대조한다. 손상 하나면 전체 실패, skip0. 결과는 결정안 고정7키 및 item4키, 자유reason/fullintent/handle 목록노출0, 2MiB 초과거절·절삭0. 두 false/currentness 유지.
- 서버가 준 ref만 선택→기존 고정GET 원문 검산/내용표시. 임의UUID폼/새준비/POST/실행0. 저장된 조건은 현재권한/능력·예산/OS 사실이 아니다.
- UI 명시 열기/다음 과거/이전/재시도/첫페이지 새로고침/선택·닫기. 성공한 위치·선택 보존, 실패한 페이지 요청은 성공history에 넣지 않는다. project/user/client/fullassignment/client객체/실제로 관측한세대 변경·sameclientABA·late/403에 이전본문 즉시 숨김. 예약세대나 오래된 buffer로 현재권한 추정0. 기존 부모 미확인 명령·작성buffer 보존, 자동 전송0.

## 구현·검수 순서
1. 실제 누락21번째발견을 source fakeDB/class·ApiClient/DOM에서 RED 재현 후 GREEN. 모듈부재와 행동실패 분리 기록.
2. 서버 cursor 범위/서명/만료/다른namespace·동일시각UUID/US 경계·빈/끝페이지·순서중복/다른임무·손상ref·크기/권한을 합성검증한다. 실제 기존 reader와 stub의 경계를 명시한다. route의 strict query/인증/주입과 기존 집계 불변을 확인한다.
3. 실제 React DOM/ApiClient 합성transport에서21번째발견→정확원문선택, 이전/다음/실패재시도/성공위치보존/닫기, sameclientABA·늦은json/실제digest반환지연·403숨김/미확인buffer보존·POST0. 실제Network/DB/served PASS로 승격0.
4. 신규unit2/DOM·직접 인접 기존 session-detail/result-page-api와 FN08 execution-state/preparation 계열 중 실제 존재 경로만 선정. npm run build(내부typecheck), git diff --check. 변경 없는 완료기능 전수반복0/기대값완화0.
5. Primary 정확명령/exit/실결과·파일hash/diff·오류횟수/미검증/정리 제출→writer해제→독립C/I→동일Primary 보완→Main fresh 집중검증/회수확인→기존branch source-only checkpoint/private 게시. 실제 gate 불충족에서 PR/main병합0.

## 합성 QA 사전등록
- D:/tmp/anvil-v3-stage-b/ui05-preparation-history-20261030-01, 담당 UI05 Primary/Main 순차. Main 부재확인 완료. 매실행 생성 전 정확경로·부모 realpath/link/owner/기존부재 재확인 후 신규 빈경로만 사용. 메모리 합성transport·실 Edge DOM bundle/프로필만, server listener/DB/서비스/Agent0.
- 매실행 최대30분, 성공/실패 finally에서 context/browser·환경변수 원형 복구·확인된 자기자원만 정리. 별도 경로/프로세스 잔여0 확인. launch/close 결과불명은 강제kill/삭제하지 말고 실패·보존·보고. 물리불명 경계 미실행은 NOT_RUN.

## 제외·기록·복구
실제 DB접속/DDL/적용/GRANT/정책·계정/키/Secret/인증서/서비스/Agent/Job/비용/Oracle운영0·신규SQL/table0. FN06 HUMAN R2 채택0. source-only와 실제 기능/사용자인수 미검증을 분리한다. 동일근본원인3회 시 같은시도중단·Main 보고, 경로는 실제 inventory/Leaf→읽기·ACL변경0/자동심사우회0.
Main WORK_STATUS/WORK_PLAN에 단계/담당/변경/시험/오류/미검증/다음을 누적한다. 한정9경로Git revert로 source rollback 가능하며 실제DB/runtime변경없음. 보호8·Main dirty·과거 실패/제외는 보존한다.
