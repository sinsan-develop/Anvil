# F-18 R7 ID Token verifier 종료 체크포인트 계획

- 같은 `codex/f18-wsl-ops` branch에서 R7 제품 exact6 commit `0b220b8a57922e051ad1fc43ea433c1ec189c5aa`와 동일 SHA의 WSL-server Python3.12 회귀 108 PASS·전용 자원 잔류0을 검토한다. 신규 제품 기능이나 실제 OIDC issuer/API의 합격 판정은 하지 않는다.
- 현재 seq1536의 worker/write lease를 write→worker 순서로 회수하고 제품 write scope를 빈 목록으로 만든다. 선행 게시 checkpoint의 progress/events byte 및 제품 SHA 조상 관계를 고정 검증한다.
- 통제 코드 TDD RED→GREEN, Windows·동일 게시 SHA의 WSL-server 잠긴 Python3.12 통제 회귀를 수행한 뒤 evidence-only seq1537/1538을 투영한다. 최종 G-05 PASS와 clean push를 확인한다. F-18 `accepted=false`, F-19 차단, Production `NOT_EXECUTED`는 유지하며 다음 단계는 실제 격리 OIDC issuer/API 연결 계획이다.
