# C-21 정상 Run/Event 생성 R2 보고서

## 판정

`MAIN_TAKEOVER_IMPLEMENTED_PENDING_FINAL_REVIEW`

운영 DB에 직접 seed하지 않고 승인된 Task·WorkInstruction·ExecutionPlan·Approval 계보를 서버에서 검증한 뒤 Run과 canonical `TASK_CONFIRMED` event를 한 transaction으로 기록하는 정상 application port를 구현했다. 운영 배포와 운영 DB 변경은 수행하지 않았다.

## 구현 범위

- `POST /api/tasks/{taskId}/runs`: camelCase body, 서버 생성 Run ID, HTTP 202, `phase`·`status`·same-origin `eventStreamUrl` 반환
- Task `CONFIRMED` 및 `expectedStateVersion` 일치 요구
- DesignBaseline → WorkPlan → IterationPlan → WorkInstruction → ExecutionPlan hash 계보와 만료되지 않은 human `ACTIVE` approval을 DB에서 검증
- `execution_plans`, `tasks.version`, Run authority/idempotency/continuation 계보 migration 추가
- Task별 active Run partial unique constraint와 migration preflight duplicate 검출
- DesignBaseline project anchor와 API authorization project/environment/permission snapshot을 신규 Run에 결박하여 cross-project artifact 재사용 차단
- terminal prior Run의 same-task/authority/environment/permission 및 checkpoint state artifact·binding hash를 재검증하고, 완료 Step의 output artifact/EvidenceManifest가 일치할 때만 continuation 허용
- 외부 side effect가 아직 조정되지 않은 `pending_writes` checkpoint는 continuation을 거부하고 checkpoint state artifact의 type/run/project/content hash를 명시적으로 재검증
- EvidenceManifest를 prior Run/Step/project와 현재 ExecutionPlan ID/hash 및 permission snapshot에 직접 결박하여 다른 실행의 동일-hash 증거 재사용을 차단
- artifact approval type을 정상 domain/API approval vocabulary와 통합
- Run, `TASK_CONFIRMED`, Task 상태 전이를 단일 transaction으로 처리하고 durable/current phase를 `ANALYZING`으로 유지
- 동일 idempotency key는 동일 request fingerprint와 완전한 canonical event가 있을 때 기존 receipt 반환
- 기존 테스트 session의 `run:events:read` 권한은 Run 생성에 사용할 수 없으며 정상 인증 계약을 우회하지 않음

## RED / GREEN 증거

- RED: 신규 canonical port/migration 모듈 부재로 test collection 실패
- GREEN: canonical API와 migration contract `4 passed`
- PostgreSQL 15 초기 증거: migration `0012_run_authority`, atomic creation/idempotent replay/event rollback/concurrent replay `3 passed in 1.67s`
- Main canonical 보정 RED: 단일 `TASK_CONFIRMED` 기대에 비표준 `RUN_CREATED`가 추가되어 `1 failed, 4 passed`
- Main canonical 보정 GREEN: 실제 PostgreSQL 15 `5 passed in 0.83s`, API port `4 passed in 0.76s`
- 멱등 무결성 RED/GREEN: sequence 1이 비표준 이벤트인 손상 상태를 기존 replay가 수락해 RED; canonical `TASK_CONFIRMED` 확인을 추가한 뒤 PostgreSQL 통합 `6 passed in 0.79s`
- 진행 후 멱등 receipt RED/GREEN: mutable current phase/status를 replay해 최초 202 응답을 위반하는 RED를 재현했고, 최초 `ANALYZING`/`ACTIVE` receipt를 고정 반환하도록 수정했다. PostgreSQL 통합 `7 passed in 0.91s`
- PostgreSQL 18 RC: 새 격리 DB에 migration head `0012_run_authority` 적용, 실제 Run/Event 통합 `5 passed in 0.79s`
- API + persistence 회귀: PostgreSQL 15 DSN을 포함한 Main takeover 재검증 `79 passed in 2.72s`
- 최종 권위 보완: PostgreSQL Run creation `13 passed`; scratch DB migration upgrade/downgrade 및 duplicate-active preflight transaction rollback `2 passed`; API+persistence+planning `105 passed in 9.49s`
- PostgreSQL 18 RC 최신 재검증: 0012 head 적용 후 Run/continuation 및 migration round-trip/preflight `15 passed in 6.20s`
- pending write continuation RED/GREEN: 미조정 write가 남은 checkpoint가 통과해 `1 failed, 13 passed`; 차단 후 PostgreSQL 15 Run/continuation `14 passed in 1.44s`, scratch migration `2 passed in 5.42s`
- 독립 review Important 보완: foreign EvidenceManifest 재사용 차단 및 0012 round-trip 포함 PostgreSQL `17 passed in 6.82s`; 전체 API+persistence+planning `107 passed in 8.38s`; compileall/diff-check PASS
- 임시 PostgreSQL 15/18 컨테이너는 `--rm` stop 후 name/port 잔여 0건을 확인했으며 volume/network를 생성하지 않았다.
- `git diff --check`: PASS

## 영향과 rollback

- 기존 Run은 authority 열이 모두 NULL인 legacy row로 보존되며 신규 생성 port에서 재사용하지 않는다.
- migration은 중복 active Run이 있으면 명시적으로 중단하여 조용한 데이터 변경을 하지 않는다.
- 코드 rollback은 이 revision revert, schema rollback은 배포 중지 후 `alembic downgrade 0011_telegram_webhook_state`다. 신규 R2 Run 데이터가 생성된 뒤 downgrade하면 신규 authority 열과 execution plan table이 제거되므로 운영 적용 전 별도 backup/복구 승인이 필요하다.

## 미검증 / 후속

- 운영 인증 principal과 실제 승인 artifact가 아직 구성되지 않아 공개 route authenticated 운영 호출은 미검증이다.
- 운영 DB migration, ysna 배포, Telegram/SSE/Last-Event-ID 운영 호출은 수행하지 않았다.
- 세 번째 동일 권위/phase 계약 실패 후 Main Agent가 직접 인수했다. DesignBaseline은 `specification_id`의 실제 `design_artifacts` hash와 `root_human_approval_id`가 가리키는 exact `DESIGN_SPECIFICATION` approval을 함께 검증한다.
- 설계서 406, 1782, 1950-1957을 함께 만족하도록 202 receipt와 durable/current phase를 모두 `ANALYZING`으로 유지하고, 최초 canonical event는 `TASK_CONFIRMED` 하나만 기록한다. `ANALYSIS_COMPLETED`는 실제 분석 완료 전에 선행 기록하지 않는다.
- Last-Event-ID strict successor는 실제 후속 canonical event가 생성된 뒤에만 운영 PASS로 판정하며, 검증 편의를 위한 비표준 이벤트를 추가하지 않는다.
