# FN04 설계 변경 승인·현재/과거 기준 연결 구현 지시서

> 작업자는 superpowers:subagent-driven-development 절차를 적용한다. 단일 Primary Developer가 순차 구현하며 Main 어울은 관리·검수·통합, 독립 읽기 담당은 명세/품질 검수를 맡는다.

**목표:** 승인된 한 연산의 후보 보관→UI07 명시 요청→UI08 별도 결정→UI07 exact 결박/별도 적용과 현재/고정 이력 조회를 실제 소스 호출선에 연결한다.
**구조:** 기존 입력/저장 관계 parser와 FN11/명령/receipt 경계를 재사용한다. 보호 후보·불변 적용/현재pointer·정확 GET2와 UI 버퍼를 추가하고, 실제 영향/OS 안전 source gap가 남은 신규 생산 적용은412로 유지한다.
**기술:** 기존 Node24/TypeScript·Fastify/PG 포트·React/Vite. 새 dependency/도구·전체구조개편0.
**승인:** 직접답변 call_fa997b24d02f4905b251e0f55c46ed63 ‘위 범위 계약·구현 승인’. 기록 docs/approvals/FN04_ACTIVATION_APPROVAL_POINTER_IMPLEMENTATION_20261027.json SHA CF12C71774F38F062B275A3890B6D8C2E18B3DA3A27A348C32F640717352F046.
**명세:** 부모 docs/contracts/FN04_ACTIVATION_APPROVAL_DELTA_PROPOSAL.md SHA84C4AB82C2003F7F0D7E541FD881C804614CACFE5BFC4AF92CE485ECE9AC0573 + 보완 docs/contracts/FN04_ACTIVATION_POINTER_CONTRACT_ADDENDUM_CANDIDATE.md SHA92602F25436F423002607BA1B118B35D4F273E55DAC06E2D33F082D18EEFB715. 두 파일의 NOT_ADOPTED는 승인 전 원문이며 기록된 정확 source 범위에 한해 채택됐다. 원문을 덮거나 실제 실행 승인을 만들지 않는다.

## 공통 제약
- 기준 codex/av3-stage-b/0def97b7. Main 현황/계획·승인기록/P03 결과는별도소유변경으로보존한다. 기존 단일 source에서만 작업하고 새branch/worktree/chat/automation·Git/PR/merge0. Main은 제품 파일을 쓰지 않는다.
- 실제 DB 적용/DML·정책/사용자 권한 부여·실제 기준 전환·서비스/Secret/cert·Agent/native·외부비용/Oracle0. SQL은 충돌 확인한0050.pending만 작성하며 정식 manifest 등록/기존 SQL 수정0.
- 기존 design-activation-input.ts·design-activation-stored-relations.ts를 그대로 소비한다. 기존 완료 다운로드/다른기능·보호8·승인원문/소비marker를 수정·삭제하지 않는다. 사용자 dirty/untracked를staging하지않는다.
- exact payload5필드·원reason/hash·현재 OWNER/정책/DENY·control/client/기한·CAS/일회소비/replay를유지한다. 적용 사실snapshot은채택 계약 §2의 정확18필드·ref version=프로젝트generation,reason/원payload중복공개0. 이력GET은current OWNER,이유후보GET은current OWNER+원요청자라는명세차이를보존한다.
- GET은 /api/v1/projects/:projectId/baseline-activations/current 와 /api/v1/projects/:projectId/baseline-activations/:id/versions/:generation 뿐. same-origin 상대경로·no-store·redirect:error. NONE은pointer/history둘다0의일관된저장관측만,미지원schema/오류/유실/변조는503. fixed과거/isCurrent/관측시각을집행허가로쓰지않는다.
- §6안전gate는신규 activate에만 둔다. 후보capture/read/request/decision은입력·관계/현재권한/정책/기한/pointer검사를하되영구source gap때문에일괄차단하지않는다. 실제관계reader의unverified를버리거나정상fixture를실안전으로승격하지않는다.
- 내부무결성검사와reason반환권한을분리한다. 다른현재OWNER의적용사실조회가원요청자전용후보reader때문에잘못404가되지않도록한다. reason입구는기존inspectArtifact 상당검사로의심비밀을값없는오류로닫고완전탐지라고하지않는다.

## 검수 집중점
1. 합법후속적용뒤과거명령replay:현재auth/policy/control검사뒤기존receipt·CONSUMED를먼저반환,신규pointer/impact/안전gate를앞세우지않는다.
2. 소비UUID/hash순환: snapshot 계산 전에 서버내부로 한 ID만 예약하여 persist/consume/snapshot이같은 UUID를쓴다. 공개DTO/사용자값으로받거나가짜UUID/이중소비0·기존caller기본값불변.
3. 자기CAS충돌: 원pointer상태에서최종승인재검증·receipt/consumption을끝내고같은transaction에activation/재확인행·pointerCAS를쓴다. 새deferredguard가모든방향의완결성을commit시점에대조하며중간실패전체rollback이다. 적용후재authorize로자기pointer를충돌시키지않는다.
4. 원문/권한/현재성: 사용자/기기/CSRF·client/transport·project/selection ABA와늦은JSON·hash·이탈후응답에서원후보/원명령을다른문맥으로수집하지않는다. 명시요청·별도결정·별도결박/적용·동일명령재확인만허용한다.
5. NONE/보관사실을실제준비로오인: raw실영향/writer없으면생산apply는412. 긍정transaction시험은내부합성port/저장routine만으로하고환경변수/공개readinessflag/운영우회스위치를만들지않는다. HTTP생산정상적용을검증했다고보고하지않는다.

## 단일 담당 허용 정확25파일
1. apps/server/modules/access/project-command.ts
2. apps/server/modules/approvals/approval-input.ts
3. apps/server/modules/approvals/project-approvals.ts
4. apps/server/modules/projects/routes.ts
5. apps/server/modules/traceability/baseline-activation-record.ts
6. apps/server/modules/traceability/baseline-activations.ts
7. apps/server/modules/approvals/design-activation-approval-candidate.ts
8. db/migrations/0050_design_baseline_activations.sql.pending
9. apps/web/src/App.tsx
10. apps/web/src/features/design-change/DesignChangesPage.tsx
11. apps/web/src/features/decisions/api.ts
12. apps/web/src/features/decisions/ApprovalsPage.tsx
13. apps/web/src/features/connections/policy-editor-profile.ts
14. apps/web/src/features/design-change/activation-api.ts
15. apps/web/src/features/design-change/DesignActivationPanel.tsx
16. apps/web/src/features/decisions/design-activation-approval-api.ts
17. tests/unit/FN04/baseline-activation-fixture.ts
18. tests/unit/FN04/baseline-activations.test.ts
19. tests/unit/FN04/baseline-activation-read.test.ts
20. tests/unit/FN04/baseline-activation-routes.test.ts
21. tests/unit/FN11/design-activation-approval.test.ts
22. tests/unit/UI07/design-activation-api.test.ts
23. tests/unit/UI08/design-activation-approval-api.test.ts
24. tests/browser/UI07/design-activation-approval-dom-harness.tsx
25. tests/browser/UI07/design-activation-approval-dom.test.ts

초기raw지문/신규부재와보호8은 docs/work_packages/FN04_ACTIVATION_APPROVAL_POINTER_SOURCE_MANIFEST.json SHAF5129CC15B49BFCB99A20F886BD00B96E8422C1D9FBDEE56DE6B3E9592E9712B에고정한다. 그밖의변경이필요하면Main이기존승인범위안의실제접점을대조해WI를개정하며담당이임의확장하지않는다.

## 업무1 — 후보·적용·조회 서버와 미적용 저장 계약
- [ ] TEST_ONLY: 신규서버fixture·시험5파일(목록17~21)만작성한다. 실제기능부재를증명하는고정API/operation·reader/후보시험을포함하고DB/port/process/QA0. 미래import없는것은그공개기능부재로구분하고fixture/타입실패를기능RED로대체하지않는다. 기존제품해시·실행0상태를제출한다.
- [ ] Main이 node --test 신규서버시험으로freshRED·명령/exit/원오류를확인한뒤동일담당에게만제품GO한다. 아직UI제품/SQL작성0이다.
- [ ] 기존 서버4+신규서버3와pendingSQL1을위3접점에맞춰한호출선으로구현한다. operation등록/해당연산baselineRefs만한정허용·requestApproval/GET/결정/consumption·current/fixedroute를실연결하고미사용helper만추가하지않는다.
- [ ] 데이터순서는현재auth/policy/control→동일replay→신규관계/원후보/CAS/안전→소비ID예약/snapshot→receipt+consume(원pointer의재authorize완료)→activation/영향업무재확인/pointerCAS→단일commit이다. SQL deferrable관계/unique/hash/receipt·감사/소비연결을정의하며기존자료의guard분기는보존한다.
- [ ] 신규집중·직접인접승인/receipt회귀·typecheck/diff·SQL정적검수뒤raw지문/diff/실명령·미검증을동결제출한다. Main·독립읽기검수후같은기능의UI를이어간다. 실제PG/경합/COMMIT는NOT_RUN이다.

## 업무2 — UI07↔UI08 실제 연결
- [ ] TEST_ONLY: 신규UI07/UI08API시험2와DOMtest/harness2만작성하고기존상위App·DesignChangesPage·ApprovalsPage를실소비하는합성화면을사용한다. 기존부모에없던명시동선을MainfreshRED로확인한뒤UI제품GO한다. 보관후보raw해시와Appbuffer/제어·세션교체·원명령·후속GET0을검사한다.
- [ ] 기존UI5+신규UI3만으로App버퍼보존→정확변경/최신영향·확정설계/계획·이유준비→현재기준명시조회→후보명시요청→UI08원후보보호조회/별도결정→UI07원명령exact결박/별도적용→고정/과거이력명시조회까지연결한다. 조회/readiness/일회승인결정만으로자동실행0이다.
- [ ] policy-editor-profile은선택가능한자료연산activate추가1곳만·기존입력의자동선택/사용자정책생성0. 기존UI08다운로드/다른승인·UI07요청/검토/원문동작을보존한다. 현재진행률/PASS를임의변경하지않는다.
- [ ] 기존스타일/tokens를유지하고1920×1080/본문12px·접근성라벨/명시버튼을적용한다. 새감시Dashboard/설명박스상시노출·재설계0. impeccable의기존Operate기준/craft-floor를적용하고context재실행/새도구설치0이다.

## 업무3 — 통합 검수·기록
- [ ] 담당은변경영향에필요한신규단위/in-process API/fakeDB·기존승인/receipt인접만실행한다. node --test(설치되지않은tsx loader사용0)·tsc --noEmit·Vite write:false메모리build·diff를선택한다. 불변전체회귀/완료UI05·UI08다운로드14시험반복0.
- [ ] 실제Edge DOM은Main이별도literal/owner/최대수명/정리등록뒤에만실행한다. 그전담당browser/QA/서버0이다. 단위fixture·HTTPinject·합성download/UI와실DB/served/사용자인수는구분한다. 기대/timeout/기존합격기준완화0이다.
- [ ] 담당변경25raw지문/전후diff/정확실행결과/오류횟수/미검증·rollback을제출하고동결한다. 독립spec/품질C/I0·Mainfresh필수검수/보호8/정확allowlist대조후Main만commit/private게시한다. Stage전체필수게이트전PR/merge/전체완료0.

복구는후속소유source의정상revert다. 실제DB/적용이력·원문/소비/승인·보호자료/기존Git을삭제해되돌리지않는다. Main은WORK_STATUS에담당/단계/증거/오류·미검증/다음조치를누적하며사소한내부상세결정은근거와비용을기록하고계속한다.
