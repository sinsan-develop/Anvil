# F-18 R8 code-flow writer 종료 통제

- 기준: 승인된 F-18 범위, `codex/f18-wsl-ops` 단일 branch, R8 제품 exact `e6a6c9b9b0f642e51d4dffbc0d8f803ed6b90c2b` 및 WSL-server 동일 SHA 139 PASS.
- 목표: seq1541 ACTIVE worker/write lease를 seq1542~1543 감사 이벤트로 회수하고 Main 소유 checkpoint로 전환한다. F-18 accepted=false, F-19 차단, Production NOT_EXECUTED는 불변이다.
- 검증: 선행 제품 SHA·현재 canonical state·branch/upstream·원격 head·main 기준선·control QA SHA 조상관계·허용 파일 범위·raw checksum·이벤트 연결·snapshot/digest를 fail-closed 검사한다. TDD와 Windows/WSL 잠긴 Python3.12 통제 회귀를 수행한다.
- 자원: WSL-server QA는 새 전용 checkout 하나만 만들고 정확한 경로·소유권을 확인해 제거한다. 기존 서비스·DB·Secret·browser는 변경하지 않는다.
- 제외: 실제 issuer/API/PG18/네트워크/3-image digest/운영 인수/Production 및 새 작업 branch.
