# F-18 R45C rollback rehearsal 보완 WorkInstruction

- 담당: Main 어울. 기존 R45C close 이후 동일 branch에서 수행한다.
- 실행환경: `ssh WSL-server`만 사용한다. 로컬은 문서·control 검증만 수행한다.
- 제품 write scope: 없음. 모든 WSL 자원은 합성·일회성 QA로 생성 전 기록하고 종료 즉시 제거한다.
- old runtime은 OIDC overlay를 사용하지 않는다. old API/Worker가 요구하는 `WSL_ACCEPTANCE`와 restore head0016을 함께 결박한다.
- 새 target head0019/OIDC runtime과 old rollback runtime은 Compose project, network, DB, role, material을 분리한다.
- API/Worker readiness, backup restore, wrong head/image/dirty negative gate, exact cleanup을 각각 별도 evidence로 기록한다.
- 결과는 `COMPLETED`가 아니라 Main이 증거를 검토해 `F-18 accepted`를 판정한다. Production은 `NOT_EXECUTED`로 유지한다.
