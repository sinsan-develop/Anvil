# F-18 WSL 운영 유사 R5 통제 테스트 fixture 보정

- 범위: R4 독립 감사에서 확인된 현재 체크포인트 테스트 재현성 Important만 수정한다. `codex/f18-wsl-ops` 단일 브랜치, Local 개발→승인 Git push→`ssh WSL-server` QA 순서다. 제품 writer·DB·Docker·Secret·Production 변경은 없다.
- 원인: R4 테스트 `_predecessor()`가 현재 progress를 읽어 seq1525 활성 lease를 기대한다. R4 seq1527 회수 이후 두 lease는 null이므로 해당 테스트 2개가 실패한다. 검사기 자체의 Git 앵커·회수 event는 독립 감사에서 유효했고, 테스트 fixture만 시점 종속이다.
- 보정: R4 검사가 이미 고정한 공개 predecessor `d27c5264a56c80ccf4f96571fcca15ec50ca93e7`의 progress/events를 Git에서 읽는다. 현재 seq1527에서 실제 2 FAIL을 확인했고 수정 후 같은 테스트 2 PASS를 확인한다. R5 checker는 게시 R4 progress/event 전체를 `b39952770e115c2ccafdf0e980eb31b6c23cc716`에 고정하고 새 control-code QA commit을 R5 overlay 최초 추가 Git commit에 결박한다.
- 전환: QA 성공 뒤 test fix event seq1528만 추가한다. R3 worker/write lease는 이미 회수돼 null이며 새 lease를 발급하지 않는다. F-18 accepted=false, F-19 차단, Production `NOT_EXECUTED`, ReleaseDecision `DEFER`를 유지한다.
- 검증: R1~R5 통제 회귀, 동일 게시 SHA의 WSL-server 잠금 Python3.12, 최종 projection 후 재실행, G-05 및 전용 임시 자원 정리. 그 뒤에만 F-18 OIDC·object storage·network 격리 Stage를 준비한다.
