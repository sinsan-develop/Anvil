# U-01 승인 대기 Run 화면 연결 / 2026-10-14

**Goal:** 기존 정확 조합의 `current.run.items`에서 `WAITING_APPROVAL` Run 수·ID·phase를 별도 카드에 연결한다.
**Architecture:** 기존 영속 Run→정확 pair read port→승인된 Dashboard API 응답을 그대로 사용한다. 승인 요청 객체 원장은 없는 상태이므로 `approvalPending`은 UNAVAILABLE로 유지하고 대체하지 않는다. 새 API/schema/권한/지속 데이터 쓰기0.
**Tech Stack:** 기존 React/TypeScript·Node test·Python 통제 checker.
**Spec:** 승인 설계29.2/U-01 및 scoped Dashboard 부모 승인 SHA256 `60167FF6B062CC208CF21BE4990A7132743D249824B9160BA830044E6885AD39`, 기존 WSL runtime 승인. 내부 표시 보완 `MAIN_RECONFIRMED_NON_SEMANTIC`; 기능/공개계약 확장0.

## 현재 단계·범위

1단계 로컬·WSL 기능 구현. 기준 결과 tail `f4efc3ecb6e9462306072874ffdcd501e06553ed` local/private 동일·trackedclean·seq2424/activelease0, 정식 WSL M18/sourceC18·서비스3/ready0020/보호hash·망·rollback4/일회성0을 읽기 재확인했다. 기존 `approval_records`는 승인된 기록의 ACTIVE/INVALIDATED/REVOKED/SUPERSEDED만 저장하고 project/environment·대기 요청 원장은 없다. `approvalPending`의 현재 SOURCE_UNAVAILABLE와 Run WAITING_APPROVAL는 별개다. 승인 요청 원장/인가·공개계약 추가는 별도 결정 필요·이번 NOT_AUTHORIZED이며 미구현으로 기록한다.

단일 기존 Primary exact4(제품App1): `apps/web/src/console/App.tsx`, `apps/web/tests/f15-console.test.mjs`, `scripts/check_project_progress.py`, `tests/tooling/test_u01_postmerge_control_projection.py`. Main 동일4 source 쓰기0. Developer stage/commit/push/문서·scratch·서버·새agent0. 결과는 대화로 반환한다. 기존 Run/ACTIVE/BLOCKED/Agent/Queue/DB/logout/nextActions/critical/generic approvalPending 동작·검사 기준 유지, 무관한 리팩토링/컴포넌트공통화/도구도입0.

## Task1: 하나의 표시 기능·TDD

소비: 인가된 pair의 `current.run={status,count,items:[{runId,status,phase}],source,observedAt,reason}`와 `sourceCompleteness.current.run`·서버 `period.observedAt`. 생산: App.tsx `ScopedWaitingApprovalRunCard({run,runEvidence,pair,observedAt})`를 기존 ACTIVE/BLOCKED 카드 곁에서 렌더. 새 fetch0.

Review Focus: 상태만 WAITING_APPROVAL인 행을 집계(phase 추측0); 정상 빈값과 원본 결손 구분; exact pair·완전 원본·신선도 유지; ID unicode/중복/101 overflow 거부; logout/응답역전/선택변경 후 이전행 소거.

- [ ] RED: 실제 ScopedDashboardPanel 렌더의 새 `Waiting approval Run` 테스트에서 총Run3 중 WAITING_APPROVAL2/ACTIVE1 입력→`승인 대기 Run`·`2건`·대기ID/원phase만 표시, generic approvalPending은 UNAVAILABLE 유지. 제거/상태추측/ACTIVE포함 시 실패해야 한다. 정상0·100과101/count불일치·중복ID·null/bool/enum·phase/형식·scope/evidence/time 음성을 추가해 실제 누락 RED를 확인한다.
- [ ] GREEN: `승인 대기 Run`, count `N건`, `원본 · scoped_run_owner`, `관측 시점 기준 · {sourceAt}`, `승인 요청 객체 수가 아닌 Run 관측 상태입니다.`를 표시한다. 정상0은 `승인 대기 상태의 Run이 없습니다.`. 목록은 Run ID·원phase만 text escape, 상세링크/승인버튼/권한행동/승인객체수 주장0. 기존generic approvalPending를 대체/숨기지 않는다.
- [ ] 원본 검증: AVAILABLE/source scoped_run_owner/reason null, evidence complete true/reason null/exactpair/CURRENT_OBSERVATION/관측시각 일치; count 정수0~100/items배열·길이일치, 원RunID unique, status/phase는 기존SCOPED_RUN_STATUSES/PHASES 정확enum. 새card의RunID는기존readport계약대로 canonical trim·Unicode codepoint수1~128·Python isprintable와동등(L/M/N/P/S와ASCII공백만허용, 앞뒤공백금지), 내부공백·astral허용/단독surrogate·control·separator거부. 기존다른Run helper는수정하지 않는다. 중복제거로맞추지 않는다.
- [ ] 신선도: source/서버 관측 차이 절대5초 이내, client5분초과·5초초과미래는UNAVAILABLE/수치·목록비노출. 기존정리가능 expiry scheduler를 재사용해 조회 없이 만료·선택/로그아웃/이전timer정리를검증한다. 집계는렌더중파생/새effectfetch0. source가불완전하면0 fallback0.
- [ ] 최소 검증: 신규UI RED→GREEN, 영향web전체한번/type/lint/build각한번, 신규통제+epoch127 frozen 인접·기존Run summary 정상음성만. 전체Python/R6/다기기·부하반복0. 합격·위조·기대기준완화0, 역사fixture 현재문서혼입이면 frozen입력만명시공급한다. React/TDD지침적용·원본불변시험중복0.
- [ ] 보고: COMPLETED/FAILURE_REPORT/INCOMPLETE/BLOCKED와 exact diff/hash·명령exit/RED/GREEN/오류·정식실패0기준·미검증 반환. 자체dist실경로/링크/tracked/소유확인뒤정확정리. Main 독립spec/quality/fresh핵심/G05뒤커밋한다.

## 단일 branch 통제·literal

W20은 기준tail 직접자식 WI/Invocation/WORK_STATUS/design_change 정확4. A19는W20직접자식 Event/progress/HANDOFF/detached digest/WORK_STATUS 정확5. rawEvent1~2424보존→2425 WI→2426 epoch128worker→2427write ACTIVE/분리24시간token/exact4·제품App1. actor `developer-primary-u01-dashboard-waiting-approval-run`, subject `U-01/DASHBOARD-WAITING-APPROVAL-RUN`, step `U01_DASHBOARD_WAITING_APPROVAL_RUN`, WI ID `WI-U01-DASHBOARD-WAITING-APPROVAL-RUN-20261014-001`.

binding `u01_dashboard_waiting_approval_run_binding`, status/mode `U01_DASHBOARD_WAITING_APPROVAL_RUN_ACTIVE`, action `U01_DASHBOARD_WAITING_APPROVAL_RUN_IMPLEMENTATION_ONLY`, snapshot `snapshot-u01-dashboard-waiting-approval-run-a19-seq2427`. keys w20_checkpoint/a19_docs_checkpoint/control_checkpoint/manifest_checkpoint/previous_result_checkpoint/active_projection_checkpoint, fresh hash/token결박. C19 A19직접자식 허용최대4코드; 이전통제/실패불변·successor전RED는PASS아님. W20 exact4의design_change는신규미진추가만허용/기존DC원문불변 검증.

M19 C19직접자식 신규 `deploy/wsl/U01WaitingApprovalRunReleaseManifest.json`+WORK_STATUS 정확2. baseline M18 `fd552dd877151ccb1477700136a967ade66dbcd2`의 `deploy/wsl/U01AgentOwnerStatusReleaseManifest.json`, blobSHA256 `D4FDAC97EC0AEA052302AFC3280449D95F85F36692F77E4EB6D0CE2CFEA3BC2A`. exact키/타입 M18동일, schema `u01_dashboard_waiting_approval_run_manifest/v1`, source C19/실제변경허용4Gitblob대문자hashmap, predecessorM18/hash, 실측webimmutableID/sourceC19, APIissuer images/source·retained/origin/unchanged/NOT_ACCEPTED/DEFER 그대로. rollback currentWeb `988cb3591fc9c61c0476e09984f030e6acff1ce261203d7b15686d310083cd41`/M18image; 추가/누락/타입/hash·계보·retained위조failclosed.

B19 M19직접자식 progress/HANDOFF/digest/WORK_STATUS/DEVELOPMENT_ENVIRONMENT 정확5·Event2427불변·bindingcheckpoint/manifesthash·active_projection_checkpoint=null. action `U01_DASHBOARD_WAITING_APPROVAL_RUN_CLOSE_READY`, snapshot `snapshot-u01-dashboard-waiting-approval-run-b19-seq2427`.

H19 B19직접자식 Event/progress/HANDOFF/digest/WORK_STATUS 정확5.2428write→2429worker REVOKED·active0, completed keys `completed_u01_dashboard_waiting_approval_run_{write,worker}_lease`, Event IDs `evt_u01_2428_dashboard_waiting_approval_run_write_lease_revoked`/`evt_u01_2429_dashboard_waiting_approval_run_worker_lease_revoked`, close step `U01_DASHBOARD_WAITING_APPROVAL_RUN_CLOSE`, mode/status/reason `U01_DASHBOARD_WAITING_APPROVAL_RUN_CLOSED`, action `U01_DASHBOARD_WAITING_APPROVAL_RUN_RECORDED_U01_PENDING`, snapshot `snapshot-u01-dashboard-waiting-approval-run-h19-seq2429`, H에서만active_projection_checkpoint=B19. 첫report H19직접자식 신규 `docs/04_test_reports/U-01_DASHBOARD_WAITING_APPROVAL_RUN_RESULT.md`+STATUS 정확2. strictclean/liveprivate/exactSHA/directparent/path/hash/원문prefix·기존통제보존.

## WSL 확인·잔여

C19 actualclean/privateG05뒤만GitexactSHAWeb-onlybuild·M19게시·정식WSL반영. 생성전literal/image/owner/수명/정리등록·oldWeb988cb359정지rollback보존. APIissuer/DB0020/권한/Secret/cert/망/기존rollback4유지·migration/backup반복/전체Compose재생성0. 실제RunAPI/UI의WAITING_APPROVAL数/빈값·기간/조회/QueueAgent/승인객체UNAVAILABLE·logout을확인한다. 실DB0이면0그대로, 합성Task/Run/승인객체정식DB생성0. 2대기/다른상태/identity/clock반례는client시험으로분리·비영실DB미확인. sameorigin/선택본문비밀감사·exactoneuse정리0·독립보존확인. 전체U01NOT_ACCEPTED/ReleaseDEFER/R6FAIL·실승인요청/Health/Gate/cost/baseline미진유지. Oracle/ysna/Production/예약/PR/main/새branch/historyrewrite/force/실Provider·외부비용/타프로젝트변경0.
