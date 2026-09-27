# F-18 R29 내부망 제품 Stage 구현 계획

> 승인된 F-18 WorkInstruction 단계 3~5의 network capability만 구체화한다. 단일 branch `codex/f18-wsl-ops`, 단일 Developer writer, Production `NOT_EXECUTED`.

## 목표·경계

- F-17 Compose의 `postgres` ingress 연결을 F-18 인수 근거로 재사용하지 않는다. 별도 F-18 Compose에서 Web의 loopback ingress와 내부 서비스망을 구분하고, API/Worker/PG18/MinIO는 내부망·최소 권한으로 제한한다.
- 제품 exact3: `deploy/wsl/compose.f18.yml`, `tests/deploy/test_f18_network_topology.py`, `docs/04_test_reports/F-18_WSL_OPS_REPORT.md`. 기존 F-17 Compose, 인증·DB schema·API, 승인 계약, 기존 서비스는 수정하지 않는다.
- Compose는 배포 실행물이 아니라 검증 대상 구성이다. 실제 OIDC/API·브라우저·egress 및 운영 유사 target 인수는 이 Stage의 정적 합격만으로 주장하지 않는다.

## Task 1 — network fail-closed 계약 RED→GREEN

1. 정적 검사에서 PG18·API·Worker·MinIO의 host port 또는 ingress network 연결, Web 이외 서비스의 외부 network, API/Worker의 `read_only`·`cap_drop: [ALL]`·`no-new-privileges` 누락을 각각 실패하게 만든다. fixture를 조작해 해당 부정 사례가 실제로 RED인지 확인한다.
2. `deploy/wsl/compose.f18.yml`을 최소 작성한다. Web은 loopback host bind·internal+ingress, 나머지 서비스는 internal-only·host port 0. 역할별 image는 각각 검증된 image ID 필수 환경변수로 받고 재빌드하지 않는다. PG18·MinIO는 전용 tmpfs 및 synthetic credential만 요구하며 기존 DB·volume을 공유하지 않는다. 앱 image의 기존 entrypoint를 중복 command로 덮어쓰지 않는다.
3. focused tests, 관련 Compose 정적 검증, 기존 F-17 회귀와 전체 테스트 시도를 분리 실행한다. 결과·RED/GREEN·미검증·rollback을 보고서에 적는다. exact3만 commit하고 Main이 diff·G-05 및 동일 Git SHA의 WSL-server 동작을 독립 검증한다.

## 실제 WSL 단계의 경계

- Main이 공개된 정확한 Git SHA와 Web/API/Worker image ID를 일치시킨 뒤 `ssh WSL-server`에서 전용 project·path·network·container·port·수명·정리 절차를 `WORK_STATUS`에 사전 기록한다. 기존 `local-postgres`·`anvil-web`을 변경하지 않는다.
- 실제 Docker network inspect, Web→API HTTP, 내부 DNS/통신 허용, 외부 direct socket 거부, host port·capability·rootfs, 종료 후 정확한 자원 잔류0을 측정한다. 이때도 제품 OIDC·browser·PG18 backup/restore·rollback·Production은 별도다.

## Rollback

R29 exact3 제품 commit만 정상 revert한다. 기존 F-17 Compose와 WSL 공유 자원에는 변경이 없어야 한다.
