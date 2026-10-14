# U-01 실제 승인 요청 원장 R2 — 실제 ASGI 준비 상태 연결

**Goal:** 기존 승인 요청 원장의 실제 DB0021 준비 상태까지 연결한다. 기능 범위 추가가 아니라 누락된 연결 파일 한 개와 내부 실행 순서의 보완이다.
**Architecture / Tech Stack:** 원 WI의 실제 계획→영속 권위/요청/감사→인가된 GET/UI 구조와 기존 Python/SQLAlchemy/PG15/React를 유지한다.
**Spec:** 원 WI `U-01_APPROVAL_REQUEST_LEDGER_WORK_INSTRUCTION.md` SHA256 `935DD7F83D1153F7645ABAACCE1CC8810D84ADE5EEBDB1F8CC930E9219D57258`와 원 제안 SHA256 `9BAF4FAEB4454EDC2ED1151C30F614ABAEB55E3AE5F10C34533B4FB1DC7A0010`. 사람 승인 두 건은 그대로 부모로 유지한다. 분류는 `MAIN_RECONFIRMED_NON_SEMANTIC`: 요구사항·기능·중요 위험 확대0, 준비 상태 검사 완화0.

## 변경 이유와 단일 writer

실제 `apps/api/anvil_api/asgi.py`의 `create_configured_oidc_asgi_app`은 F19A readiness closure의 required head를0020으로 고정한다. process 쪽만0021로 바꾸면 실제 `/api/health/ready`가503이 된다. 이 파일을 수정하는 것이 올바른 연결이며, app state/closure monkeypatch·0020 허위 PASS·DB head 위장은 금지한다. Main과 Primary 모두 이를 읽기 확인했다. 기존 process host1P는 wiring 증거일 뿐 실제 ASGI readiness 증거가 아니다.

원 WI의 15 source 경로를 모두 유지하고 **`apps/api/anvil_api/asgi.py`만 추가하여 정확16 source/제품8**로 한다. 나머지 원 WI의 데이터·권위·producer/registrar 분리·현재 모집단·UI·보안·검증·WSL·복구 계약은 전부 유지한다. 원 WI 파일은 수정하지 않는다. 단일 기존 Primary만 계속 writer이고 Main은 source에 쓰지 않는다. 기존 미커밋 source는 같은 Primary의 진행물로 보존하며 reset/stash/삭제/새 branch0.

## 추가 구현·검증

- [ ] 실제 ASGI factory를 이용한0021 DB→ready200/0020·잘못된head→503 테스트를 먼저 RED로 확인한다. F19A OFF0019·기존 readiness 불일치 거부를 보존한다.
- [ ] `asgi.py`의 F19A required head와 정식 readiness state 선언을0021에 정확 연결한다. 두 관측이 실제 DB head와 같을 때만ready이며 mismatch를 허용하지 않는다. 신규 외부 URL·권한/인증·설정 의미 변경0.
- [ ] 조기 I1(잠금대기 후 만료)과 I2(역사/계산된 SATISFIED·INVALIDATED 누적 대 현재 PENDING100 한도)는 기존15 안에서 각 RED→GREEN 및 PG opt-in을 유지한다. 실패를 전수 검사 이월로 숨기지 않는다.
- [ ] 기존 서비스 기능·actual producer→DB→GET/UI와 선택 영향 검증은 원 WI대로 한다. 미완료 UI/host/G05/PG·만료 이력 목록 미제공을 실제 확인과 구분한다.

## 개정 checkpoint·Event·lease

기존 W21 `f53bfc6edc13871bf713ee2978ef99f2b09bda15`→A20 `1b0e34cc256ea8179d3021f96a9ef0eeaeae9539`는 역사 그대로 보존한다. A20까지 원 WI·Event·임대 발급은 적법하며 이번은 정식 실패 인수나 제품 rollback이 아니다. Developer 정식 FAILURE_REPORT0, 조기 리뷰 재작업1이다.

W22는 A20 직접 자식 R2 WI/Invocation 신규+WORK_STATUS 정확3이다. 이때 source dirty는 같은 Primary가 소유한 허용15의 진행물이며 metadata commit에 stage하지 않는다. Primary가 안전 지점에서 정지한 후 dirty source hash/실행자원 상태를 기록한다.

A21은 W22 직접 자식 Event/progress/HANDOFF/detached digest/WORK_STATUS 정확5. frozen Event1~2432 원문 보존→2433 epoch129 write 회수→2434 worker 회수→2435 R2 WI→2436 epoch130 worker→2437 write ACTIVE. 새 실행/쓰기 token은 서로 다르고 기존 token과도 다르며 새24시간·허용16/제품8을 고정한다. 과거129 완료 lease는 `completed_u01_approval_request_ledger_r1_{write,worker}_lease`에 전체 객체로 보존한다. 회수사유 `INTERNAL_ASGI_READINESS_PATH_REVISION`, 새 WI id `WI-U01-APPROVAL-REQUEST-LEDGER-20261014-002`, actor/subject/step는 원 WI와 같다. 기존 코드 진행물 hash는 새 binding의 `inherited_source_sha256`으로 결박한다.

새 binding은 `u01_approval_request_ledger_binding`, 기존 binding 원문은 `u01_approval_request_ledger_r1_binding`으로 보존한다. 기존 status/mode/action을 유지하고 w21_checkpoint/A20 이전 증거와 `w22_checkpoint`, `a21_docs_checkpoint`, R2 WI/Invocation hash, 부모 승인 두 건을 결박한다. A21 snapshot은 `snapshot-u01-approval-request-ledger-a21-seq2437`. 새 token 전달 전 Primary source 쓰기0, 전달 뒤 정확16에서 재개한다.

C20은 **A21 직접자식**의 허용16 이내 코드-only commit이다. M20 exact schema는 원 WI와 같고 source_files는 실제 변경된 허용16의 정확 map이다. 실제 C20 clean/private G05 PASS 전 WSL QA 금지는 유지한다.
B20은 M20직접자식 정확5 문서·Event2437 불변, action은 원 WI대로, snapshot `snapshot-u01-approval-request-ledger-b20-seq2437`·active_projection_checkpoint=null.
H20은 B20직접자식 정확5 문서, **2438 write→2439 worker** 회수·active0. Event ids `evt_u01_2438_approval_request_ledger_write_lease_revoked`/`evt_u01_2439_approval_request_ledger_worker_lease_revoked`, snapshot `snapshot-u01-approval-request-ledger-h20-seq2439`, 나머지 completed lease keys/close mode·action/첫 report exact2는 원 WI 그대로다. H에서만 B20 SHA를 결박한다.

새 collector는 W21/A20 원문·W22/A21 개정 계보와 중단 전 source 인수 hash까지 fail-closed 확인한다. 이전 승인/검사/실패를 소급 변경하거나 old token commit을 허용하지 않는다. 신규 source 범위·원문·시각·hash·Git/private 위조 음성을 포함하고 범위 밖 쓰기0을 유지한다.
