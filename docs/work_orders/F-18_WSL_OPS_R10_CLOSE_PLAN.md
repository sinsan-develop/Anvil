# F-18 R10 OIDC token transport writer 종료 통제

- 기준: 승인된 F-18 로컬·WSL-server 범위, 단일 `codex/f18-wsl-ops` branch, R10 제품 exact `5c0a9ba2ec907b8e7a4b05c92389de9456304736` 및 WSL-server 동일 SHA 관련 143 PASS.
- 목표: seq1551 ACTIVE worker/write lease를 seq1552~1553 감사 이벤트로 회수하고 Main 소유 checkpoint로 전환한다. F-18 accepted=false, F-19 차단, Production NOT_EXECUTED는 불변이다.
- 검증: 게시 제품 SHA의 선행 canonical state, branch/upstream·원격 head·main 기준선·control QA SHA 조상관계, 허용 파일, raw checksum, 이벤트 연결, snapshot/digest를 fail-closed 검사한다. Windows와 WSL-server 잠긴 Python3.12 통제 회귀를 수행한다.
- 자원: WSL-server에는 새 전용 임시 checkout 하나만 만들고 exact 경로·소유권·HEAD를 확인한 후 제거한다. 기존 서비스·DB·Secret·브라우저는 변경하지 않는다.
- 제외: 실제 Keycloak issuer/API/PG18/3-image digest/운영 인수/Production 및 새 작업 branch. 다음 안전 행동은 격리 실제 issuer QA 설계·수행이다.
