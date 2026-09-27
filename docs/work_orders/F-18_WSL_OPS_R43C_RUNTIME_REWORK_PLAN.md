# F-18 R43C WSL runtime 결선 보정 계획

- 기준: R43B2 실제 WSL-server 검증의 두 결함(Worker head 0016 고정, HTTPS reverse proxy 미신뢰). 기존 F-18 승인과 R43 계획의 내부 보정이며 기능·요구사항·중요 위험·Production 범위를 넓히지 않는다. `ysna-server`는 대상이 아니다.
- 개발은 기존 `codex/f18-wsl-ops` Windows worktree의 단일 Developer writer, 시험은 제품 commit을 지정 SSH Git alias로 push한 뒤 WSL-server의 clean exact SHA에서 수행한다. 새로운 branch는 만들지 않는다.
- Worker 기본 F15 head 0016은 유지한다. WSL OIDC overlay에서만 `ANVIL_AUTH_MODE=OIDC`를 명시해 Worker가 0019를 요구하며, 알 수 없는 모드·head 불일치는 fail closed다. Worker 준비 판정은 queue 처리 보증이 아니다.
- OIDC API는 QA overlay에서만 Uvicorn `FORWARDED_ALLOW_IPS`를 단일 Web internal-network IPv4로 지정한다. `*`, CIDR, 다른 서비스/공개 IP, OS 전역 신뢰 수정은 금지한다. 격리 Compose 최초 기동은 loopback placeholder로 하고, 실제 Web project/network/IP를 검사한 후 API만 재생성, Web만 restart해 DNS를 재해석한다. 최종 Web IP 불변·API 환경값 동일을 검사한다. 일치하지 않으면 QA를 폐기하고 PASS로 기록하지 않는다.
- TDD exact5: `apps/worker/anvil_worker/main.py`, `deploy/wsl/compose.f18.oidc.yml`, `tests/integration/test_f15_local_stack.py`, `tests/deploy/test_f18_oidc_formal_host_contract.py`, `docs/04_test_reports/F-18_WSL_OPS_REPORT.md`. 기본 Compose/API/Web/NGINX/DB schema/credential는 변경하지 않는다.
- Main은 제품 diff·로컬 회귀·정규화 Compose·보안 경계 확인 후 동일 SHA를 WSL-server에서 격리 재검증한다. 새 전용 자원 이름/수명/정리는 생성 전 `WORK_STATUS`에 기록한다. Worker ready, HTTPS authorization→issuer token→callback/session, 부정 spoof/재사용, PG18, 브라우저 same-origin, 자원 잔여0을 각각 실측한다. 미실행은 미검증으로 남긴다.
- F-18 accepted=false, F-19 blocked, Production NOT_EXECUTED를 R43C만으로 변경하지 않는다. rollback은 전용 Compose project와 합성 자료만 제거하고 기존 Git SHA/이미지로 돌아가는 것이며 DB downgrade는 하지 않는다.
