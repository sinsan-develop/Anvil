# F-18 R45A QA 종료 및 R45B 준비

- R45A exact tag `f18-wsl-r45a-qa`/source `d36de847842804ca93e405abe9bff687c1162a69`의 WSL-server PG15·PG18 RC, OIDC, signed QA manifest/preflight 범위만 통과했다. R45A 보고서와 `docs/WORK_STATUS.md`의 실제 오류·명령·정리 증거를 기준으로 한다.
- Main epoch34 worker lease만 canonical seq1675에서 회수한다. 제품 write lease는 계속 null이다. F-18 accepted=false, F-19 blocked, Production NOT_EXECUTED를 유지하며 R45B 동일 세 image ID의 격리 target은 별도 사전 계획·QA lease/G-05 이후 진행한다.
- 모든 R45A 전용 자원은 ID/label/owner와 연결자 확인 후 제거됐고 잔여0, 공유 `anvil-web`·`local-postgres` ID/상태 불변이다. 합성 키·DB는 정리와 함께 제거되어 복구되지 않는다. QA tag와 본 보고서는 보존한다.
- 동일 Git SHA에서 재빌드한 이미지는 같은 ID라고 추정하지 않는다. R45B가 다른 image ID를 관측하면 이전 signed QA manifest를 재사용하지 않고 fail-closed로 artifact 절차를 다시 밟는다. R45B/복구/브라우저 인수는 아직 미검증이다.
