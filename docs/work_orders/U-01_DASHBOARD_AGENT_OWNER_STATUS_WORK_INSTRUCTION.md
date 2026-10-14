# U-01 Agent 소유권 상태 구현계획 / 2026-10-14

**Goal:** 기존 정확 조합의 `current.agent` 원본을 전체·ACTIVE·EXPIRED·REVOKED 소유권 관측 건수로 연결한다.
**Architecture:** 현재 API/DB/권한은 유지하고 UI 총수 카드를 상태 요약으로 바꾼다. 동일 session의 여러 assignment는 정상이며 개별 owner 식별·Worker 실행/건강과 구분한다.
**Tech Stack:** 기존 React/TypeScript·Node test·Python 통제 checker.
**Spec:** 설계29.2/U-01, 부모 scoped 계약 승인 SHA256 60167FF6B062CC208CF21BE4990A7132743D249824B9160BA830044E6885AD39, 기존20261014 WSL runtime 승인 범위.

## 범위와 Task1

기준 HEAD/직전 결과 `65983ef1551e20ef32e99395445c33e9ebd3a6c5`·private동일/trackedclean·seq2419·lease0, 실제 정식 GitM17/서비스3/ready0020·보호hash/망/rollback보존을 읽기 대조했다. MAIN_RECONFIRMED_NON_SEMANTIC이며 공개API·DB schema/지속데이터 직접쓰기·인증/권한·Secret 의미변경0. 사용자 단계1 우선순위에 따라 필요한 기능과 핵심 회귀만 진행한다.

단일 기존 Primary 허용 exact4(제품App1): `apps/web/src/console/App.tsx`, `apps/web/tests/f15-console.test.mjs`, `scripts/check_project_progress.py`, `tests/tooling/test_u01_postmerge_control_projection.py`. Main 동일4 source write0, Developer stage/commit/push/서버/하위agent/scratch·문서쓰기0. 상세 결과는 대화로 반환하고 Main이 기록한다.

- [ ] RED: 실제 ScopedDashboardPanel에 기존 source=`scoped_agent_owner`/eventTimeBasis=`CURRENT_OBSERVATION`/정확 pair·complete=true·reason=null·관측시각 일치인 `current.agent={status,count,source,observedAt,reason,items:[{sessionId,status}]}`를 입력해 `Agent 소유권 상태`/전체 및 세 상태 건수를 검증한다. 같은 session·다른 assignment의 3 owner와 같은 session/status 2 owner도 합계 보존이 양성이다. 서버의 기존 `tests/observability/test_f20_u01_r36_agent_owner_summary.py::test_mixed_states_and_shared_session_distinct_assignment_are_valid` 원본 양성도 확인한다.
- [ ] GREEN: generic agent 카드 자리에서 `전체 N건`, `유효(ACTIVE) N건`, `만료(EXPIRED) N건`, `회수(REVOKED) N건`, 출처·관측시각·`관측 시점 기준`을 표시한다. 현재 owner snapshot의 행 수이며 unique 세션 수/실행 Agent 수/Worker 정상 수가 아니다. 정상0은 `등록된 Agent 소유권이 없습니다.`로 구분한다. 개별 owner 목록·식별·제어·링크·신규 요청0.
- [ ] 원본 정합: 영속 identity는 project/environment/session/assignment 복합키이고 DB unique/hash 검증을 기존 repository가 소유한다. 현재 응답은 assignmentId를 생략하므로 UI가 독립 복합 identity 검증을 했다고 주장하지 않는다. 기존 sessionId unique 가정으로 정상 소유권을 거부하던 agent 경로만 바로잡고 multiplicity를 그대로 합산한다. dedupe/임의 행 제거0, Run/Queue의 기존 unique 검사와 모든 count/source/pair/evidence/서버 hash·복합키·overflow 음성 기준은 유지한다. 공개응답에 assignmentId를 추가하지 않는다. 개별 owner 식별은 별도 계약 판단이 필요한 미구현으로 기록한다.
- [ ] 실패·신선도: count 정수0~100/items 길이 일치·sessionId 비어있지 않고 앞뒤 공백/ASCII0~31 제어문자 없는 UTF8최대128byte(내부 공백은 기존owner identity대로 허용)·정확3 enum·reason/source/evidence/pair/time 검증. 관측과 서버관측 차이 절대5초 이내, client5분 초과·5초 넘는 미래는 UNAVAILABLE·모든 수치 비노출. 만료 타이머는 조회 없이 다시 렌더하고 정리한다. ACTIVE는 관측 시점 소유권 상태일 뿐 현재 lease 유효성/권한/heartbeat를 보증하지 않는다. 기존 Queue·DB·Run·로그아웃/늦은 응답 소거·HealthWorker UNAVAILABLE을 보존한다.
- [ ] 최소 검사: 새 UI/TDD·0/100·동일session 복수·동일session/status multiplicity·합계·101/count/enum/ID/source/pair/time/만료·logout/조회실패 기존 회귀, 웹 전체1회/type/lint/build 각1회, 새통제와epoch126 고정 인접 범위. 기존 서버 summary 정상·음성 필요한 범위는 실행하되 수정0. 전체 Python/R6/부하·다기기 반복0, 같은 원본 불변 검사는 다시 돌리지 않는다. fixture를 보완해도 합격·음성 기준을 완화하지 않는다.

COMPLETED/FAILURE_REPORT/INCOMPLETE/BLOCKED·정확 RED/GREEN 명령/exit·파일hash/diff·오류/정식실패횟수(초기0)·미검증을 반환한다. 자체 생성 dist는 실경로/링크/소유 확인 후 정확 정리. 독립 spec/quality·C18 clean/private actual G05 전 WSL QA/배포0.

## 단일 branch 통제 literal

W19은 기준HEAD 직접자식 신규 WI/Invocation+WORK_STATUS exact3. A18은 W19 직접자식 Event/progress/HANDOFF/detached digest/WORK_STATUS exact5. Event1~2419 raw객체 보존→2420 WI→2421 epoch127 worker→2422 write ACTIVE·분리24시간token·exact4/제품App1. actor `developer-primary-u01-dashboard-agent-owner-status`, subject `U-01/DASHBOARD-AGENT-OWNER-STATUS`, step `U01_DASHBOARD_AGENT_OWNER_STATUS`, WI ID `WI-U01-DASHBOARD-AGENT-OWNER-STATUS-20261014-001`.

binding `u01_dashboard_agent_owner_status_binding`, mode/status `U01_DASHBOARD_AGENT_OWNER_STATUS_ACTIVE`, action `U01_DASHBOARD_AGENT_OWNER_STATUS_IMPLEMENTATION_ONLY`, snapshot `snapshot-u01-dashboard-agent-owner-status-a18-seq2422`. keys w19_checkpoint/a18_docs_checkpoint/control_checkpoint/manifest_checkpoint/previous_result_checkpoint/active_projection_checkpoint·새hash/token 결박. C18은 A18 직접자식 허용최대4코드, 이전 gate/역사실패를 보존하며 새successor 전 RED는 PASS가 아니다.

M18은 C18 직접자식 신규 `deploy/wsl/U01AgentOwnerStatusReleaseManifest.json`+WORK_STATUS exact2. baseline=M17 `2ab227a74cee181c607eaa115a4fb124288293dd`의 `deploy/wsl/U01QueueItemsReleaseManifest.json`, blobSHA256 `3E08DB4AFEE40F3C6D0355F1E1477C542639DB2E6229934D97C0F802E4D615C9`. exact JSON키/타입은 baseline동일, schema_version=`u01_dashboard_agent_owner_status_manifest/v1`, source_commit=C18/실제변경허용코드4→GitblobSHA256대문자map, predecessor_manifest_commit=M17/실제blobhash, images.web=실측 immutableID/image_sources.web=C18. APIissuer images/image_sources/retained_source_files/origin/unchanged/환경·NOT_ACCEPTED·DEFER는M17동일. rollback.container_id=`38857059689f441dbe6a52a71bfb76d5d9e3620d17dc14b1d28bb6e883666f29`, image_id=M17web。추가/누락/타입/위조hash·계보/retained/source/image변경을 fail-closed 거부한다.

B18은 M18 직접자식 progress/HANDOFF/digest/WORK_STATUS/DEVELOPMENT_ENVIRONMENT exact5·Event2422불변. binding 새checkpoint/manifesthash결박·active_projection_checkpoint=null, action `U01_DASHBOARD_AGENT_OWNER_STATUS_CLOSE_READY`, snapshot `snapshot-u01-dashboard-agent-owner-status-b18-seq2422`.

H18은 B18 직접자식 Event/progress/HANDOFF/digest/WORK_STATUS exact5. seq2423write→2424worker REVOKED·active0, completed keys `completed_u01_dashboard_agent_owner_status_{write,worker}_lease`, Event IDs `evt_u01_2423_dashboard_agent_owner_status_write_lease_revoked`/`evt_u01_2424_dashboard_agent_owner_status_worker_lease_revoked`, step `U01_DASHBOARD_AGENT_OWNER_STATUS_CLOSE`, reason/mode/status `U01_DASHBOARD_AGENT_OWNER_STATUS_CLOSED`, action `U01_DASHBOARD_AGENT_OWNER_STATUS_RECORDED_U01_PENDING`, snapshot `snapshot-u01-dashboard-agent-owner-status-h18-seq2424`, H에서만 active_projection_checkpoint=B18. 첫 보고 H18 직접자식 신규 `docs/04_test_reports/U-01_DASHBOARD_AGENT_OWNER_STATUS_RESULT.md`+WORK_STATUS exact2. 실제private exactSHA/clean/directparent/path/hash·원문prefix·이전통제·새hash검증을 유지한다.

## WSL·확인 범위

C18 actual G05 후 승인GitexactSHA로Web만build·M18게시·반영, 생성전이름/owner/image/경로/수명/정리등록·기존Web정지rollback보존. API/issuer/DB0020/권한/Secret/cert/망설정/기존rollback유지·migration/backup반복/전체Compose재생성0. 실제 원본API와Agent상태합계/Queue보존·기간변경/조회/logout 확인, 실제0이면그대로기록·합성owner/assignment정식DB생성0. 비영/동일session복수/clock/invalid는client시험으로분리·실DB비영은미확인. 선택본문비밀감사/sameorigin·일회성정확정리0·독립보존확인. 오래된 ACTIVE를현재유효권한으로사용하지 않는다.

전체 U01 NOT_ACCEPTED/Release DEFER/역사 R6 FAIL·미연결Health/Gate/cost/baseline/승인객체 유지, 개별 owner식별/실Worker는추후테스트가아닌미구현으로구분한다. Oracle/ysna/Production/예약/PR/main/새branch/historyrewrite/force/실Provider·외부비용/타프로젝트변경0. 새 공개계약·범위·중요위험 필요시만 신산님 결정 요청한다.
