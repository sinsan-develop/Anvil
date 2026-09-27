# F-18 WSL 운영 유사 R4 통제 QA 기준점 보정

- 범위: 이미 승인된 F-18 Local 개발·WSL-server 검증 안에서 R3 통제 게이트의 QA SHA 자체 결박 Important를 보완한다. 제품·DB·인증·Secret·운영 서버·외부 배포는 변경하지 않는다. 단일 `codex/f18-wsl-ops` 브랜치를 유지한다.
- 원인: R3 검사에서 `control_qa_head`, worker/write lease baseline·dispatch, WorkInstruction 발급 event를 모두 같은 수정 가능한 progress/ledger에서 대조했다. 독립 Git 기준점 없이 이 값들을 재결박하면 미검증 후속 control SHA를 기준으로 삼을 수 있다. 직접 재현에서 두 lease와 progress SHA를 함께 옮긴 상태가 기존 R3 `validate_state`를 통과했다.
- 보정: R3 WorkInstruction을 최초 추가한 Git commit `0f0ff0df5495edcec8a3e49cacea516e5d1de3c6`을 독립 앵커로 검사한다. R4 코드 QA 후 R4 overlay 최초 추가 commit을 별도 Git 앵커로 사용한다. 이전 공개 `d27c5264a56c80ccf4f96571fcca15ec50ca93e7`의 progress/event를 읽어 이후 event가 바뀌지 않았는지 확인한다.
- 전환: R3 제품 writer 완료·로컬 154 PASS·WSL 잠금 154 PASS·전용 이미지 F16/F18 import PASS를 근거로 R3 write→worker lease를 순서대로 회수한다. 새 제품 write lease는 발급하지 않는다. R4는 Main 통제 체크포인트이며 F-18 `accepted=false`, F-19 차단, Production `NOT_EXECUTED`, ReleaseDecision `DEFER`를 유지한다.
- 검증: 변조 거부 RED→GREEN, 관련 overlay 회귀, 동일 공개 SHA의 WSL-server 잠금 Python 검증, G-05 seq1527 PASS, exact 임시 자원 정리 후 다음 F-18 OIDC·object storage·network 격리 Stage를 준비한다. QA 실패·미실행은 PASS로 기록하지 않는다.
