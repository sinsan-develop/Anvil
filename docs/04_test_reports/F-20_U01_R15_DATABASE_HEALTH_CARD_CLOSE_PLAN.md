# F-20/U-01 R15 Database Health 카드 종료 계획

- 기준: 기존 `codex/f18-wsl-ops`의 `85f060d58deba6adbc8709de819c09b81bb6e383`. R15 exact3는 로컬과 WSL-server에서 동일 SHA Node24 검증 및 임시 자원 잔여0을 `docs/WORK_STATUS.md`에 기록했다.
- 목적: epoch28의 R15 `write_lease`를 먼저, `worker_lease`를 다음으로 append-only 회수한다. 기존 Event prefix와 C30 `OPEN_BLOCKING`, ReleaseDecision `DEFER`, F-20/U-01 미수락을 보존한다.
- 통제 변경: R15 종료 overlay·전용 테스트·G-05 route·Event/progress/HANDOFF/digest/manifest와 본 계획·WORK_STATUS만. 제품·공개 API·DB·UI 수정은 없다.
- 검증: 종료 테스트 RED→GREEN, R14 close/R15 start 인접, G-05, diff check, 기존 branch commit/private push, WSL-server 동일 SHA clean/G-05 및 R15 임시 자원 잔여0.
- 실패 시: append 전에는 자료 변경0으로 중단한다. projection 오류·G-05 실패면 다음 writer 발급 금지하고 기존 `85f060d5` 및 원격 ref를 복구 기준으로 보존한다. main 병합·새 branch·ysna/Production은 수행하지 않는다.
