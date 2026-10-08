# WI-F19A-TASK4-THIRD-ACTOR-QA-FIXTURE-20261008-001

## 판정·권한

F-19A 승인 계약의 `다른 actor에게 grant가 새지 않음`과 기존 관리자 coarse 권한 403을 WSL-server 격리 QA에서 구분해 실측하기 위한 내부 QA fixture 보완이다. 부모 승인 `docs/approvals/APPROVAL-20261007-F19A-PAIR-GRANT-CONTRACT-001.md` SHA256 `ADF11125667CA6C374F31462D2ABD7D55C425D7A86019CB7A8D4B9BA8D0A0AF5`, Spec SHA256 `A4AE1EE80530F2A05393A18409CDE2FC94543C1FAC8598365CD8A4EBB7032247`, Plan SHA256 `0CD8309E3FD8C7F507281BF6094D6BA696973FB5AA12F27023E57E1DA51CA26E`를 보존한다. 출발 `codex/f18-wsl-ops` local/private clean `df253d71a4c521df69b97bdc249dd5d7e2081fb6`, epoch87 seq2223 종료·G-05 PASS·역사106 PASS다. F-19A는 미수락, Release DEFER, Production NOT_EXECUTED다. 새 branch를 만들지 않는다.

## 근거·정확 scope

실제 `docs/04_test_reports/F-19A_TASK4_WSL_QA_REPORT.md`의 `other-actor` 실패는 bootstrap admin에게 `dashboard:read`가 없어 403이 나온 것이다. 승인 Spec상 이는 올바른 coarse 거절이지만, 다른 정상 reader의 무 grant 200 빈 목록 증거는 아니다. Developer `developer-primary-f19a-pair-grant`의 정확8 경로는 통제 `scripts/check_project_progress.py`, `tests/tooling/test_f19a_start_projection.py`; 제품/QA `deploy/wsl/oidc_qa_issuer.py`, `tests/deploy/test_f18_oidc_qa_issuer.py`, `deploy/wsl/f19a_qa_bootstrap.py`, `tests/deploy/test_f19a_qa_bootstrap.py`, `tests/integration/test_f19a_oidc_pg15.py`, `tests/browser/f19a-pair-selection.mjs`다. Main만 WI·Event/progress/HANDOFF/digest/WORK_STATUS·Git·WSL QA 자원을 쓴다. Main의 epoch88 canonical dual lease/private clean A 전에는 Developer 코드 write를 시작하지 않는다. Developer는 위 8파일 밖 write, Git commit/push, WSL/DB/브라우저/Compose write를 하지 않는다.

## 제품·검증 계약

1. QA issuer는 기존 `synthetic-subject-1`·`f19a-qa-reader`를 그대로 허용하고, 세 번째 고정 합성 subject `f19a-qa-other`만 정확 추가한다. 임의 subject·요청 시 subject 변경·wildcard는 거부한다. subject별 로그인은 격리 QA issuer의 지정 환경값으로 순차 수행하며 서명 키/JWKS 신뢰가 바뀌지 않아야 한다.
2. 전용 PG15 QA fixture는 세 번째 actor `f19a_qa_other_<sourceSHA12>`와 전용 role `f19a_qa_other_<sourceSHA12>`를 정확 issuer/subject·source SHA·전용 DB 식별·24시간 이하 만료·정확 host pair에 결박한다. role의 permission은 `dashboard:read`만이며 활성 `pair_grants`는 **0건**이다. 기존 admin·reader·공유 role을 변경하지 않는다. preflight에서 actor/role/subject binding/role membership의 부재·완전 일치만 허용하고 충돌·부분 상태·다른 binding·추가 권한·grant 존재는 쓰기 전에 거부한다. seed는 원자적·멱등이며 실패는 fail-closed다. 기존 admin bootstrap manifest/permission·reader grant를 완화하거나 자동 grant를 만들지 않는다. QA 세 번째 actor와 DB 행은 격리 QA 종료 시 정확 identity로 제거한다.
3. Chromium 실제 검증은 기존 reader grant 상태에서 서로 다른 새 세션으로 reader `200` 정확 pair1, 세 번째 actor `200` items0, bootstrap admin `403 AUTHORIZATION_SCOPE_MISMATCH`를 각각 확인한다. reader 철회 후 다음 요청은 reader `200` items0, 기존 고정 GET/alerts/ACK는 해당 grant 거절 403, DB 장애는 503과 기존 envelope를 별도 확인한다. 브라우저 API는 same-origin 경로만 사용하고 세 actor의 role/session/요청 URL을 교차 확인한다. 이번 코드 절편은 테스트 하네스만 준비하며 실제 WSL/Chromium PASS는 Main의 후속 exact-SHA QA 전까지 미검증이다.
4. TDD RED→GREEN으로 issuer 허용/음성, 세 번째 actor bootstrap 충돌/멱등/무 grant/만료·DB 장애, 브라우저 세 phase와 음성 설정, opt-in PG15 격리 테스트를 작성한다. 새 epoch88 active/C/B/closed G-05 projection은 부모 Event 1~2223 불변, 24시간 분리 token·정확8/제품6, A→C→B→종료 조상/clean/private/비merge/커밋별 경로·위조 거부를 검사한다. 역사 epoch87 fixture와 승인 계약은 완화하지 않는다. 새 route 전 bootstrap G-05 RED는 PASS가 아니다.
5. 로컬 집중·issuer/bootstrap/integration 인접·현재 F-19A 역사/F-20 successor 회귀, 브라우저 self-test, Ruff 신규0·`git diff --check`·G-05를 정확 명령/exit와 함께 보고한다. Main 독립 C0/I0/M0, C exact8 checkpoint/private→B 문서 결박/private/clean→write→worker lease 회수→종료 G-05·회귀 전 WSL 자원 생성 금지. 기존 R48 authority2 FAIL은 별도 기준선이며 신규 실패를 그 탓으로 돌리지 않는다.

## 후속 WSL 격리 QA·제외

Main은 같은 private branch exact clean SHA를 `ssh WSL-server`에서 Git pull한 뒤, 실행 전 전용 PG15/컨테이너/네트워크/이미지 tag/브라우저 프로필/파일의 이름·수명·정리 방법을 WORK_STATUS에 기록한다. 기존 자원 변경 없이 격리 PostgreSQL 15/OIDC/HTTPS/Chromium·same-origin·기존 GET/alerts/ACK·철회·DB 장애·backup/restore·downgrade guard를 실제 실행하고 정확 identity로 제거해 잔여0을 확인한다. 공개 API·DB schema/migration·인증 의미·실 사용자 권한·Secret·공유/지속 DB·Production/ysna-server는 변경하지 않는다. 독립 Tester의 `AV-OPS-026`·`AV-SAFE-034`와 실제 증거 전 F-19A `ACCEPTED`, U-01 제품 write, main 병합을 금지한다.
