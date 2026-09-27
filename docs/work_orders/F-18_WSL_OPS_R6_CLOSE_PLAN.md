# F-18 R6 객체 저장소 완료 체크포인트 계획

- 같은 `codex/f18-wsl-ops` branch에서 제품 R6 exact6과 실제 WSL-server MinIO QA를 검토하고, 제품 경로 추가 mutation 없이 R6 write lease→worker lease 순서로 회수한다.
- 고정 선행 게시 checkpoint `8e2e89bf820a26fa84f1dc66562d35e87efb4b89`의 seq1531 progress/events와 제품 SHA `6f95fd9033b9e4017854c2ea467f0580ffc71e52` 조상 관계를 독립 Git 사실로 확인한다. 회수 후 제품 write scope는 빈 목록이며 신규 writer는 없다.
- 통제 코드 TDD와 Windows·동일 게시 SHA의 WSL-server 잠긴 Python3.12 회귀, evidence-only seq1532/1533 투영, 최종 G-05 PASS 후 다음 OIDC package를 설계한다. F-18 `accepted=false`, F-19 차단, Production `NOT_EXECUTED`는 유지한다.
