# U-01 선택 조합 Queue 격리 이상 연결 계획

> 실행: superpowers:subagent-driven-development, 기존 단일 developer-primary. Main은 통제·문서·검토만 담당한다.

**Goal:** 기존 완전 Queue 관측에서 실제 격리 이상을 선택 조합 API·화면에 연결한다. 전체 Queue Health·전체 U-01 완료를 대체하지 않는다.
**Architecture:** 이미 읽은 ScopedQueueSource를 요청 pair와 명시 결박하고 scoped serializer에서 검증한다. 기존 current.health 및 sourceCompleteness.current 내부에만 카드별 근거를 연결한다. 공개 endpoint·권한·DB schema·지속 원본 추가0.
**Tech Stack:** 기존 Python/FastAPI/PostgreSQL15, React/TypeScript.
**Spec:** 설계 §29.2, 작업계획 §13 U-01, 승인 `APPROVAL-20261009-U01-SCOPED-DASHBOARD-CONTRACT-001.md`(SHA256 `60167FF6B062CC208CF21BE4990A7132743D249824B9160BA830044E6885AD39`), 해당 계약 제안 §4/6/8, R45의 0건≠HEALTHY 불변식.

## Global Constraints

- 현재 1단계 WSL 기능 구현. 기존 branch `codex/u01-dashboard-r2` 한 개, Main/Developer 동시 source write 금지. 승인 범위·공개 경로·인가·DB0021·Secret·Run 실행·기존 자료 불변.
- 직접 지시에 따라 작은 수정마다 전체 suite/전체 브라우저를 반복하지 않는다. 기존 기준·음성 단언은 삭제/완화하지 않는다.
- 현재 BASE `ca76e5bc15bc8752a0826672c8143dd3e2ba316b`, seq2444·active0. DB·Run·Queue목록·Agent·승인요청·logout 완료 기능은 재구현/재시험하지 않는다. 직접 영향 범위 회귀만 선택한다.
- 이번은 부분 구현을 전진시키는 항목이다. Queue 전체 HEALTHY/Worker 생존·처리율·지연SLO·새 health 원장/claim/probe는 구현하지 않고 다음 설계/승인 경계로 남긴다. 전체 U-01 미수락·Release DEFER·역사 DC019 불변.

## Review Focus

1. 다른 pair source/목록을 섞으면 UNAVAILABLE, 응답·화면 잔존0.
2. quarantine 행과 작업 상태/attempts 불일치·누락·중복은 숫자를 만들지 않는다.
3. partial/legacy/101행/오래되거나 미래 관측/미래 격리 시각은 실패 폐쇄한다.
4. Secret이 담길 수 있는 raw reason/payload/token/driver예외를 반환하지 않는다. ID는 기존 공개 ID 규칙·React text escape를 유지한다.
5. 0건은 정상 근거가 아니다. 관측된 격리0과 전체 건강도미확인을 분리하고 보이는 동안 5분 freshness 만료를 반영한다.

## Task 1: 기존 원본→API→화면 수직 연결 (단일 writer)

**허용 제품3:**
- `packages/api/scoped_dashboard.py`
- `apps/api/anvil_api/oidc_process.py`
- `apps/web/src/console/App.tsx`

**허용 시험4:**
- `tests/api/test_u01_scoped_dashboard_reader.py`
- `tests/api/test_u01_scoped_dashboard_api.py`
- `tests/api/test_oidc_process.py`
- `apps/web/tests/f15-console.test.mjs`

**추가 허용 통제2:** `scripts/check_project_progress.py`, `tests/tooling/test_u01_postmerge_control_projection.py`. 정확9/제품3. 다른 경로 필요 시 이유를 Main에 보고하고 먼저 쓰지 않는다. Main 소유 WI/Invocation/Event/progress/HANDOFF/digest/STATUS/manifest/report/DEV_ENV는 Developer 수정 금지.

**Interfaces/명시 계약:**
- Consumes: 기존 `load_scoped_queue_source(engine,project_id,environment_id)` → ScopedQueueSource. 반복 DB조회·새 source writer·state mutation을 추가하지 않는다.
- 호스트는 인가 후 요청 pair의 동일 source를 `current_sources['queueHealth']={'source': source, 'projectId': project_id, 'environmentId': environment_id}`로 전달한다. source 누락 시 UNAVAILABLE. 기존 `queue` metric source는 유지한다.
- source는 정확 ScopedQueueSource, 명시 pair 일치·legacy false, job_ids/작업ID 고유·정확 대응·100 이하, timezone-aware 관측시각과 request observedAt 차이 절대5초 이하·벽시계 미래5초 이하, quarantines tuple/100 이하를 요구한다.
- 격리행 job_id/attempts는 같은 source의 job과 일치하고 job.status는 QueueStatus.QUARANTINED여야 한다. job에는 quarantined_at이 없으므로 이 시각의 job-field 대조를 요구하지 않는다. 반대로 관측 QUARANTINED job은 정확1개 격리행이 필요하다. attempts는 bool아닌 int/0이상·작업값일치, 격리행 자체의 quarantined_at은 timezone-aware/관측시각이하, ID는 nonempty/trim/control문자없음/128이하. 같은 source의 기존 current.queue metric·items와 맞지 않아도 UNAVAILABLE.
- 검증 성공 시 `current.health.queue` 고정필드: `status`=`LATE`(격리1이상) 또는 `UNAVAILABLE`(0건); `source`=`scoped_queue_quarantine`; `observedAt`=source UTC; `reason`=`QUEUE_QUARANTINED` 또는 `NO_QUEUE_HEALTH_SIGNAL`; `quarantineCount`=검증된 수; `items`=[{jobId,attempts,quarantinedAt}]. errorCount는 전체오류수 의미 오염 방지로 새로 만들지 않는다. 0건의 items=[]는 전체정상 근거가 아니다.
- 대응 `sourceCompleteness.current.queueHealth`는 기존 completeness형식/source/pair/complete=true/eventTimeBasis=CURRENT_OBSERVATION/동일observedAt/reason=null. 이는 격리 관측의 완전성이지 health6 전체완전성 아님. 전체health gap false와 다른5건 중 미연결4건은 불변. invalid는 기존 UNAVAILABLE/SOURCE_UNAVAILABLE로 닫고 관측 items/count를 보이지 않는다.
- UI selected-queue에 'Queue 격리 이상'·관측수/원본/시각 표시, >0 LATE 경고·상세펼침으로 같은 응답의 ID/attempts/시각 및 '격리 작업 검토' 안내. 외부/Operations 상세route로 가짜링크를 만들지 않는다. 0건은 UNAVAILABLE·'관측된 격리 작업은 없지만 Queue 전체 건강도는 미확인입니다.'를 표시한다. raw reason/기존alert를 새로 만들지 않는다.
- UI는 exact shape/중복/범위/시각/5분유효성·카드근거/current.queue일치를 독립 검증하고 timer로 만료 시 수·목록을 제거한다. 기간 변경은 현재 관측을 기간집계로 바꾸지 않는다. fallback원본·다른pair cache 사용 금지.

- [ ] RED: reader 정상 격리1/2·빈관측·각 Review Focus 음성. 기존 기대값을 먼저 바꾸지 않는다.
- [ ] GREEN: 위 계약 최소 구현. 기존 고정 GET/ACK/R45·selected DB·Queue 목록·Run·승인/로그아웃 동작 불변.
- [ ] Web RED→GREEN: 1/2/0, duplicate/상태/시각/shape/증거pair/만료timer/HTML ID escape/철회소거.
- [ ] 로컬 선택 검증: `python -B -m pytest -q -p no:cacheprovider --import-mode=importlib tests/api/test_u01_scoped_dashboard_reader.py tests/api/test_u01_scoped_dashboard_api.py tests/persistence/test_f20_u01_r8_queue_read.py`; host 해당 신규test·Web console 해당/직접인접·typecheck/lint/build를 필요한 횟수만 수행. 정확 결과/최초실패/미실행/임시출력 정리 보고.

## Task 2: 유효 임대·Git 통제와 실제 검증

- [ ] W24=BASE직접자식 WI/Invocation/STATUS 정확3. A23=W24직접자식 Event/progress/HANDOFF/digest/STATUS 정확5. frozen1~2444보존→2445 WI→2446 epoch132worker→2447write ACTIVE24h·서로다른 token/정확9제품3. binding `u01_scoped_queue_quarantine_binding`, mode `U01_SCOPED_QUEUE_QUARANTINE_ACTIVE`, action `U01_SCOPED_QUEUE_QUARANTINE_IMPLEMENT`, snapshot `snapshot-u01-scoped-queue-quarantine-a23-seq2447`.
- [ ] C22=A23직접자식 허용9 중실제코드만(제품3 포함), 독립코드 C/I0·local회귀/diff0, private clean actualG05seq2447 PASS전 WSL QA금지. 기존checker bytes보존/additive route·위조음성.
- [ ] M22=C22직접자식 신규 `deploy/wsl/U01ScopedQueueQuarantineReleaseManifest.json`+STATUS2. 실제image digest/source·API/Web 역할·기존issuer/db0021·rollback 대조. 서비스반영은 대상·영향·기존 승인 범위 확인 후에만. 금지승인 확대0.
- M22의 정확 manifest schema는 M21과 동일한 최상위키 집합 `schema_version,environment,acceptance,release_decision,source_commit,source_files,predecessor_manifest_commit,predecessor_manifest_sha256,origin,images,image_sources,retained_source_files,database,rollback`이다. schema_version=`u01_scoped_queue_quarantine_manifest/v1`, environment=`WSL_SERVER_TEST_STAGING`, acceptance=`NOT_ACCEPTED`, release_decision=`DEFER`, origin=`https://172.27.253.53:3770`. source_commit=C22(40lowerhex), source_files는 C22가 실제 변경한 허용코드 경로 전량/제품3포함의 raw SHA256 uppercase64와 exact일치한다. C22는허용밖파일/문서0.
- predecessor_manifest_commit=`e92bc992ba7c0abd28ff027a52115f362aff09fa`, predecessor_manifest_sha256=`850D8472C88FD480312C64CBFEE2AFB31F63E8AFCD4CB7D72D901EF78001BF42` 및 M21 manifest Git blob와 대조한다. images/image_sources의 정확키는 api/web/issuer/planning_host다. api/web은실제빌드sha256lower64/C22, issuer는 M21 cefb8b27.../C15 `87aa6c5e8edf1e2e890c3cb69a74bdf5f4b94a84` 불변, planning_host는기존보존artifact 292fb936.../C21 `88a56c30ff9eebc726fa1bf390462ab94eb771b7` 불변(공개서비스가아니며재실행0). 두 고정 image는 M21의 전체값 exact사용·축약값을manifest에쓰지않는다.
- retained_source_files는M21의동일객체5개에 `deploy/wsl/U01PlanningSourceRegistrationReleaseManifest.json`=위M21rawhash1개를추가한정확6개다. 각경로는C22Git bytes및M21역사값일치. database는 M21의정확객체(revision0021/schema_change=false/data_policy/기존registrationapprovalID/hash)와동일하며등록재실행권한아님. rollback정확키 policy/current_runtime/public_runtime_change, policy=`PRESERVE_DB_ROWS_RESTORE_PREVIOUS_API_WEB`, public_runtime_change=true(반영계획표현이지실행증거아님). current_runtime정확키api/web, 각정확키container_id/image_id/source_commit이며현재C20공개api a773c348...·image9938508b.../webccaf91d5...·image103252ad...·source둘다 `f03348ac680e624ee0ca41e2b97ca07b38aff677` 전체값을M21역사와실제읽기로대조한다. 기존권한/Secret/cert/망/issuer/DB원본/보호증거변경0. 위key/type/hash/계보/역할불일치는G05거부하며image실존·동작은별도Main실측으로만PASS한다.
- [ ] 사전등록 새빈 WSL PG15/0021 exact C22에서 정상 repository 저장 격리자료→인가API→실제Chromium DOM·빈값/음성 핵심·same-origin/Secret, 정확 정리0. 기존변경없는 전체R6/전체suite 반복0. 정식반영이 미승인/불가하면 구분 기록하고 다른 독립계획작업을 계속한다.
- [ ] B22=M22직접자식 progress/HANDOFF/digest/STATUS/DEV_ENV 정확5, Event2447불변, repository/HANDOFFhead=M22, active_projection_checkpoint=null. snapshot `snapshot-u01-scoped-queue-quarantine-b22-seq2447`, action `U01_SCOPED_QUEUE_QUARANTINE_CLOSE_READY`.
- [ ] H22=B22직접자식 Event/progress/HANDOFF/digest/STATUS 정확5,2448write→2449workerREVOKED/active0. subject `U-01/SCOPED-QUEUE-QUARANTINE`, step `U01_SCOPED_QUEUE_QUARANTINE_CLOSE`, eventIDs `evt_u01_2448_scoped_queue_quarantine_write_lease_revoked`/`evt_u01_2449_scoped_queue_quarantine_worker_lease_revoked`, completed `completed_u01_scoped_queue_quarantine_{write,worker}_lease` 전체객체, active_projection_checkpoint=B22. mode/reason `U01_SCOPED_QUEUE_QUARANTINE_CLOSED`, action `U01_SCOPED_QUEUE_QUARANTINE_RECORDED_U01_PENDING`, snapshot `snapshot-u01-scoped-queue-quarantine-h22-seq2449`.
- [ ] 첫report=H22직접자식 신규 `docs/04_test_reports/U-01_SCOPED_QUEUE_QUARANTINE_RESULT.md`+STATUS+DC 정확3, 최신G05. 각SHA증거한정·전체U01인수/새branch/PR/main/Oracle/Production/예약0.

## 순서·자기검토·rollback

Task1→2는 같은3제품/serializer/host/UI계약을 소비하므로 단일 writer·단일 C22/rollback 경계다. Main 문서와 source 소유권 충돌 없음. 1의 shape·0건 의미·2의 실제증거가 일치하며 검증실패를 PASS로바꾸지 않는다. 코드미실행/서버미반영을 완료로바꾸지 않는다. 사유없는상시전체테스트/구조개편0. source rollback은 이번정확경로 역변경과 검증으로만 수행·기존데이터/감사삭제0. 실패횟수/명령·exit/미검증/다음기능을STATUS에누적한다. 다음에는 Queue전체건강원본 및 나머지Health/운영카드의 실제source·승인경계를 계속 해결하며 이 경고표시로 대신 완료처리하지 않는다.
