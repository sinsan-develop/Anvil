# U-01 Queue 작업 목록 구현계획 / 2026-10-14

**Goal:** 기존 정확 조합 `current.queue`의 실제 작업 ID·상태를 화면에서 확인한다.
**Architecture:** 기존 scoped reader/API/권한/DB는 그대로 두고 UI가 이미 받은 owner snapshot을 검증·표시한다. Queue Health와 작업 목록을 구분하며 새 요청·명령·상세 API는 만들지 않는다.
**Tech Stack:** 기존 React/TypeScript·Node test·Python 통제 checker.
**Spec:** Anvil_설계서_v2.md §29.2, Anvil_작업계획서_v1.md U-01, 부모 승인 `APPROVAL-20261009-U01-SCOPED-DASHBOARD-CONTRACT-001.md` SHA256 60167FF6B062CC208CF21BE4990A7132743D249824B9160BA830044E6885AD39. 기존 WSL runtime 승인 `APPROVAL-20261014-U01-WSL-DEVELOPMENT-RUNTIME-001.md` 범위다.

## 범위·분류

WSL 기능 구현 단계이며 신산님 `계속하자`에 따라 남은 Dashboard 기능을 이어간다. Main 분류 MAIN_RECONFIRMED_NON_SEMANTIC: 공개 API·DB·인증·권한·Secret·기능 범위 변경0. 기준 HEAD/직전 결과 801a2d79711d44bac9573e0271b5766eb729a1d6, private동일/clean·seq2414·active0. 기존 DB/ACTIVE/BLOCKED/로그아웃 보존. 전체 U-01 NOT_ACCEPTED·Release DEFER·역사 R6 FAIL 불변이다.

### Task 1: 기존 Queue 응답의 사용자 표시

단일 Primary 허용 정확4경로(제품1):
- `apps/web/src/console/App.tsx`
- `apps/web/tests/f15-console.test.mjs`
- `scripts/check_project_progress.py`
- `tests/tooling/test_u01_postmerge_control_projection.py`

소비 계약은 기존 `current.queue={status,count,source,observedAt,reason,items:[{jobId,status}]}` 및 `sourceCompleteness.current.queue`다. source=`scoped_queue_owner`, eventTimeBasis=`CURRENT_OBSERVATION`, 정확 pair·complete=true·reason=null·관측시각 일치를 확인한다. 현재 snapshot이며 기간 발생·대기 수·Queue Health 정상으로 승격하지 않는다.

- [ ] RED: 실제 ScopedDashboardPanel 렌더에서 `PENDING/CLAIMED/SUCCEEDED/QUARANTINED`의 jobId·원 상태와 정상 빈 목록을 검증한다. 기존 총수만 렌더는 목록 검증에 실패해야 한다.
- [ ] GREEN: 기존 generic queue metric 자리를 `Queue 작업` 카드로 표시한다. 총수/출처/관측시각 및 펼칠 수 있는 작업 목록을 제공하고 네 원 상태를 그대로 표시한다. 새 요청/링크/claim/retry/cancel/기타 mutation0. 정상 빈 목록은 `등록된 Queue 작업이 없습니다.`로 구분하고 건강 정상 판정은 하지 않는다.
- [ ] Fail-closed: count 정수0~100·items 길이 일치·고유하고 공백 아닌 jobId·네 enum·reason null·source/evidence/pair/time 정합성을 확인한다. server 관측과 source 시각 차이는 절대5초 이내, client 관측 5분 초과/5초 넘는 미래는 UNAVAILABLE이다. 5분 만료 때 실제 화면도 재조회 없이 UNAVAILABLE로 전환하고 목록을 숨긴다. client clock 변경은 렌더 때 다시 대조한다. invalid enum/중복/빈ID/101건/잘못된 출처·조합·시간·불완전이면 0건/일부 목록으로 내리지 않는다.
- [ ] Negative: 비정상 입력·React text escape·권한/조회 실패·조합 교체 늦은응답·로그아웃 뒤 목록 소거의 관련 기존 검증을 보존한다. Queue Health는 UNAVAILABLE 유지. 새 API/DB/payload/fencing token/secret 노출0.
- [ ] 검증: `npm run web:test`, web:typecheck, web:lint, web:build 직접 영향 각1회·신규 통제 class/위조음성·epoch125 고정 인접 fixture 필요한 범위. 전체 Python/R6/다중기기/부하 반복은 클라우드 정밀검증으로 남기고 현재 PASS로 바꾸지 않는다. fixture/input 보완과 기대 기준 완화는 구분한다. 자체 생성 dist만 신원 확인 후 정확 정리한다.

Main은 active write lease 중 위4경로에 쓰지 않는다. Developer stage/commit/push/서버/새branch/하위agent0. COMPLETED/FAILURE_REPORT/INCOMPLETE/BLOCKED와 RED/GREEN 명령·exit·실패 횟수·미검증·diff를 반환한다. formal failure0에서 시작한다. 독립 spec/quality 검토와 local/private actual clean G05 후에만 WSL Web 변경한다.

## 검토 초점

1. SUCCEEDED 포함 총수를 대기 수로 오표시하지 않는다.
2. source/pair/관측시각이 틀린 목록은 부분 렌더하지 않는다.
3. 만료·빈 snapshot과 원본 미확인을 구분한다.
4. jobId 텍스트 escape, 로그아웃/늦은 응답의 비노출을 유지한다.
5. Queue Health/worker 실행·전체 기능 인수를 목록 표시 성공으로 대체하지 않는다.

## 단일 브랜치 통제 literal

W18은 기준HEAD 직접자식 신규 WI/Invocation+WORK_STATUS 정확3. A17은 W18 직접자식 Event/progress/HANDOFF/detached digest/WORK_STATUS 정확5. Event1~2414 raw객체 보존→2415 WI→2416 epoch126 worker→2417 write ACTIVE·서로 다른24시간 token·허용4/제품App1. actor `developer-primary-u01-dashboard-queue-items`, subject `U-01/DASHBOARD-QUEUE-ITEMS`, step `U01_DASHBOARD_QUEUE_ITEMS`, WI ID `WI-U01-DASHBOARD-QUEUE-ITEMS-20261014-001`.

binding `u01_dashboard_queue_items_binding`, mode/status `U01_DASHBOARD_QUEUE_ITEMS_ACTIVE`, action `U01_DASHBOARD_QUEUE_ITEMS_IMPLEMENTATION_ONLY`, snapshot `snapshot-u01-dashboard-queue-items-a17-seq2417`. binding keys w18_checkpoint/a17_docs_checkpoint/control_checkpoint/manifest_checkpoint/previous_result_checkpoint/active_projection_checkpoint·새hash·token을 결박한다. C17은 A17 직접자식 허용 최대4코드만. 새 G05 successor 구현 전 RED는 PASS가 아니다.

M17은 C17 직접자식 신규 `deploy/wsl/U01QueueItemsReleaseManifest.json`+WORK_STATUS 정확2. baseline은 M16 a1b4ccc85e90d0b1b0432bfd3174f993b82c4723의 `deploy/wsl/U01LogoutReleaseManifest.json`. exact JSON은 M16과 동일 키/타입을 사용하되 schema_version=`u01_dashboard_queue_items_manifest/v1`, source_commit=C17·source_files=C17 실제 변경 허용코드→Git blob SHA256 대문자64hex, predecessor_manifest_commit=M16·predecessor_manifest_sha256=실제 M16 blobhash. images web=실측 새 immutableID/api·issuer=M16동일, image_sources web=C17/api·issuer=M16동일. origin/retained_source_files/unchanged=M16동일, rollback={container_id:기존 c9f677874802c61a2d5fc74de1f17b9e11cd3489f04d37badb25fffe33b1bac4,image_id:M16 web image}. environment/acceptance/release_decision 기존 WSL_SERVER_TEST_STAGING/NOT_ACCEPTED/DEFER. 추가키/누락/타입치환/위조 hash·source·image·origin·retained변경 거부. 기존 source_files는 이전 변경 코드이므로 C17 신규 map과 혼동하지 않는다.

B17은 M17 직접자식 progress/HANDOFF/digest/WORK_STATUS/DEVELOPMENT_ENVIRONMENT 정확5, Event2417불변. binding w18_checkpoint/a17_docs_checkpoint/control_checkpoint/manifest_checkpoint/manifest_sha256/previous_result_checkpoint를 정확 결박, active_projection_checkpoint=null. action `U01_DASHBOARD_QUEUE_ITEMS_CLOSE_READY`, snapshot `snapshot-u01-dashboard-queue-items-b17-seq2417`.

H17은 B17 직접자식 Event/progress/HANDOFF/digest/WORK_STATUS 정확5. seq2418 write→2419 worker REVOKED·active0. completed keys `completed_u01_dashboard_queue_items_{write,worker}_lease`, Event IDs `evt_u01_2418_dashboard_queue_items_write_lease_revoked`/`evt_u01_2419_dashboard_queue_items_worker_lease_revoked`, step `U01_DASHBOARD_QUEUE_ITEMS_CLOSE`, reason/mode/status `U01_DASHBOARD_QUEUE_ITEMS_CLOSED`, action `U01_DASHBOARD_QUEUE_ITEMS_RECORDED_U01_PENDING`, snapshot `snapshot-u01-dashboard-queue-items-h17-seq2419`, H에서만 active_projection_checkpoint=B17. 첫 보고 H17직접자식 신규 `docs/04_test_reports/U-01_DASHBOARD_QUEUE_ITEMS_RESULT.md`+WORK_STATUS 정확2. 과거 route/역사실패/원문prefix/실제private exactSHA/clean/directparent/path/hash 검증은 유지한다.

## WSL 실제 핵심 확인

C17 clean/private actual G05 뒤 같은 승인 Git에서 Web만 build·M17 게시·반영한다. 생성 전 이름/owner/image/경로/수명/정리를 등록하고 기존 Web ID/config를 정지 rollback으로 보존한다. API/issuer/DB0020/기존 row·권한/Secret/cert/망설정 불변, migration/backup반복/전체Compose재생성0. exact ID recovery는 적용 후 timeout도 실제 상태 기반으로 처리한다.

정식 화면에서 기존 실제 DB의 Queue source/API 값·건수와 UI를 확인한다. 실제 빈 DB라면 0건을 그대로 표시하고 비영 목록은 테스트 입력 검증이라고 분리한다. 정식 DB에 가짜 Task/Run/Queue 행을 만들지 않는다. actual reauth/pair선택/기간변경/refresh/logout·sameorigin·선택본문 비밀보호를 필요한 범위만 확인한다. 브라우저의 조작된 응답 반례는 실제 서버 증거로 승격하지 않는다. 일회성 브라우저 정확정리0·보호파일hash/APIissuer ID/network 유지 실측. 남은 Health/Gate/cost/baseline/승인객체 및 전체U01 미진을 숨기지 않는다.

Oracle/ysna/Production/예약/PR/main/새branch/history rewrite/force/실Provider·외부비용0. 기능·공개계약·중요위험 변경 필요시만 신산님 보고한다.
