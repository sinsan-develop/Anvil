# WI-F19A-TASK4-RUNTIME-HEAD-COMPAT-20261008-001

## 판정·권한

F-19A Task4 WSL-server 격리 QA에서 관찰한 Worker OIDC DB head 0020 불일치와 Web readiness 표시 호환성을 보정하는 승인 범위 내부 비의미 재작업이다. 부모 사람 승인 `docs/approvals/APPROVAL-20261007-F19A-PAIR-GRANT-CONTRACT-001.md` SHA256 `ADF11125667CA6C374F31462D2ABD7D55C425D7A86019CB7A8D4B9BA8D0A0AF5`, Spec SHA256 `A4AE1EE80530F2A05393A18409CDE2FC94543C1FAC8598365CD8A4EBB7032247`, Plan SHA256 `0CD8309E3FD8C7F507281BF6094D6BA696973FB5AA12F27023E57E1DA51CA26E`를 보존한다. 출발 `codex/f18-wsl-ops` exact local/private clean `db8a8d6f2e9af3179ad1037924a63e9f7f481205`, epoch86 seq2218 종료·활성 lease null·G-05 PASS다. Main이 새 epoch87 worker/write dual lease를 canonical Event/progress/HANDOFF에 결박하고 private clean A를 게시하기 전 코드 write 금지다. 새 branch를 만들지 않는다.

## 근거와 정확 scope

`docs/04_test_reports/F-19A_TASK4_WSL_QA_REPORT.md`의 실제 WSL QA에서 0020 적용·API ready200인데 Worker는 OIDC head0019만 기대해 `migration_head_mismatch` exit1이었다. Web `classifyReadiness`도 status ready/0020을 `NOT CONNECTED`로 분류한다. 이번 WI는 공개 API, DB schema/migration, grant/role/actor·인증 의미, Compose·WSL 자원, 기존 GET/alerts/ACK를 변경하지 않는다. Developer `developer-primary-f19a-pair-grant`의 code exact6: 통제 `scripts/check_project_progress.py`, `tests/tooling/test_f19a_start_projection.py`; 제품/회귀 `apps/worker/anvil_worker/main.py`, `tests/integration/test_f15_local_stack.py`, `apps/web/src/console/App.tsx`, `apps/web/tests/f15-console.test.mjs`. Main만 WI·progress/Event/HANDOFF/digest/WORK_STATUS·Git checkpoint/private push를 쓴다. Developer는 위 여섯 파일 외 write, Git commit/push, WSL/DB/브라우저/Compose write를 하지 않는다.

## 구현·검증 계약

1. Worker OIDC probe는 정확 head `0019_oidc_sessions` 또는 `0020_f19a_pair_grants`일 때만 DB reachability/head `ready`를 보고한다. 기본/COOKIE/WSL_ACCEPTANCE의 기존 `0016_operations_recovery` 계약은 유지한다. 0018·알 수 없는/빈/다중 head, DB 장애, 미지원 auth mode는 fail-closed로 유지한다. OIDC start `--check`와 주기 probe 양쪽에서 0020을 검증한다. Worker의 queue 처리 준비를 새로 주장하지 않는다.
2. Web `classifyReadiness`는 서버 `status=ready`와 정확 `0016`, `0019`, `0020`에만 READY를 준다. 기존 0016/0019·unknown/not_ready/null/요청 실패, same-origin `/api/health/ready` 동작을 보존하고 0020 카드 표시를 테스트한다. 가짜 운영 상태, API 절대주소, 브라우저 내부 호스트는 추가하지 않는다.
3. TDD RED→GREEN. Worker/Web 기존 회귀에 0020 정상·음성·회귀를 먼저 추가한다. 새 epoch87 active/C/B/closed G-05 projection과 exact6/product4, 부모 seq1~2218 불변, 분리된 24시간 fencing token, local/private clean/조상/비merge/허용 history, 위조·무관 dirty·remote 불일치·scope 초과 거부를 checker/test에 추가한다. 역사 epoch86 fixture 기대를 완화하거나 원문을 수정하지 않는다.
4. 정확 실행 명령/exit/실제 결과로 Worker 대상 및 인접 Python tests, Web Node tests/typecheck/build, 통제 집중·역사 회귀, `python -B scripts/check_project_progress.py`, Ruff 신규0·`git diff --check`를 보고한다. Main 독립 C0/I0/M0 검토, C exact6 checkpoint/private→B 문서 결박/private/clean→write→worker 회수→종료 G-05·집중/역사 재실행 전 다음 QA fixture/WSL 자원 생성 금지. 기존 R48 close2 FAIL은 별도 기준선으로 분리하고 GREEN으로 승격하지 않는다. 실행하지 않은 항목은 미검증으로 남긴다.

## 다음 분리 작업

이번 호환성 보정은 F-19A 수락이 아니다. Bootstrap admin의 다른 사용자 403은 승인 Spec의 coarse 권한 거절이며, 정상 읽기 권한을 가진 별도 actor의 grant 격리를 증명하지 않는다. 그 WSL 실측은 다음 QA fixture WI에서 세 번째 격리 subject/actor·정확 role/무 grant·브라우저 200 빈 목록과 admin 403을 함께 검증한다. 기존 GET/alerts/ACK·DB 장애 실제 경로도 같은 exact SHA WSL QA에서 관찰하고 실패가 있으면 별도 rework한다. F-19A `ACCEPTED` 금지, F-20/U-01 rework, Release DEFER, Production/ysna-server NOT_EXECUTED.
