# WI-F19A-TASK4-DB-FAULT-BOUNDED-503-20261008-001

## 판정·권한

F-19A Task4의 승인된 계약 `docs/architecture/f19a/F19A_MINIMAL_PAIR_AUTH_CONTRACT.md`는 DB 사용 불가 시 503과 기존 JSON 오류 envelope를 요구한다. WSL-server 격리 PG15 네트워크 연결이 0개인 상태에서 새 인증 브라우저의 `GET /api/dashboard/project-environments`가 15초 내 응답하지 않았다. 이는 PASS가 아니며, 대기 지점은 아직 미확정이다. 기존 epoch90 종료 seq2238, clean/private `64237af83babd15f9df876f1aaa2494c4453e1e8`을 선행 기준으로 삼는다. 승인된 요구사항·범위·중요 위험 변경 없이 장애 시 응답 계약을 구현·검증하는 내부 보완이다. 부모 승인 `docs/approvals/APPROVAL-20261007-F19A-PAIR-GRANT-CONTRACT-001.md`를 유지한다.

## 정확 scope·소유

Main은 이 WorkInstruction, Event/progress/HANDOFF/digest/WORK_STATUS, Git·WSL 격리 QA와 최종 판정을 소유한다. Developer `developer-primary-f19a-pair-grant`의 정확 코드 경로는 통제 `scripts/check_project_progress.py`, `tests/tooling/test_f19a_start_projection.py`와 제품 `apps/api/anvil_api/oidc_process.py`, `packages/api/fastapi_app.py`, `tests/api/test_oidc_process.py`, `tests/api/test_f19a_registration_api.py`, `tests/integration/test_f19a_oidc_pg15.py`의 7개다. Main이 새 epoch91 worker/write dual lease와 별개의 execution/write fencing token을 발급하고 A clean/private bootstrap을 검증하기 전에는 코드 write를 하지 않는다. 통제 C/B가 clean/private·G-05 GREEN으로 결박되기 전에는 제품 5경로 write를 하지 않는다. 다른 코드·공유 DB/컨테이너·ysna-server/Production·새 branch·Developer의 Git commit/push는 금지한다.

## RED→GREEN 계약

1. 현재 앱의 실제 0020 진입점에서 PG15 장애를 신규 연결과 이미 풀에 있는 연결에 각각 주입한다. 독립된 유한 시간 측정·stack/stage 증거로 OIDC 세션 또는 pair 원장 등 정확한 대기 경계를 먼저 식별한다. 첫 15초 무응답은 RED로 보존한다. DB 단절 중에는 허용·빈 목록·403으로 대체하지 않는다.
2. 확인된 대기 경계에만 최소 deadline을 적용한다. `connect_timeout`만으로 기존 풀 socket 장애를 해결했다고 주장하지 않는다. `asyncio.wait_for`로 threadpool worker를 방치하는 방식은 단독 해법으로 금지한다. F-19A의 목록·고정 host GET/alerts/ACK는 DB 사용 불가 시 유한 503, 승인 계약의 해당 `PAIR_AUTHORIZATION_UNAVAILABLE` 코드와 `{error:{code,message,request_id}}` envelope를 입증한다. OIDC가 먼저 실패하는 경우에도 실제 F-19A 요청의 오류 코드 판정을 명시적으로 검증한다. 무쿠키401, 0019 OIDC 장애 응답, 기존 정상 GET/alerts/ACK, 정상 정확 pair 목록은 회귀시키지 않는다.
3. 로컬 단위/API/PG15 opt-in RED→GREEN과 인접 회귀·정적 검사·diff check를 실행한다. 통제 코드는 seq≤2238 원문을 보존한 epoch91 A→C→B→종료, 실제 Git/private/clean·정확7·제품 gate·분리 lease/24시간·위조/만료 거절을 검증한다. route 미구현 bootstrap G-05 RED는 PASS로 표기하지 않는다.
4. Main의 독립 C0/I0/M0, 정확 코드 checkpoint/private, 활성 B G-05 후에만 WSL-server에서 같은 Git SHA를 pull해 격리 PG15/OIDC/HTTPS/Chromium 실측을 재실행한다. PG15 정상·신규 연결/풀 연결 장애·유한 503/코드/envelope·복구 후 정상 응답을 반복하고 임시 자원은 identity 확인 후 모두 제거한다. 격리 QA 자원의 이름·수명·정리 방법은 생성 전에 WORK_STATUS에 기록한다.

## F-19A 잔여 수락·제외

독립 Tester의 `AV-OPS-026` 복원 전후 필드 동일성 및 U-03 중복 금지와 `AV-SAFE-034` 교차/미등록/비활성 pair·철회 직후 기존 GET/alerts/ACK·cache 혼합은 별도로 실제 증명한다. 둘 다 ACCEPTED 전에는 F-19A 수락, U-01 제품 write, main 병합, 다음 branch를 금지한다. PostgreSQL 18 RC·Production·ysna-server·공유/지속 데이터 변경은 이 WI에서 실행하지 않는다.
