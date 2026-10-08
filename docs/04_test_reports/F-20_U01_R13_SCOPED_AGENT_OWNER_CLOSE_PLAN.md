# F-20/U-01 R13 Agent owner 읽기 종료 계획

- 기준: 기존 `codex/f18-wsl-ops`의 `25d07aef42a6544c841ec464c29111d9acdbf55b`. R13 exact3는 로컬·WSL-server 동일 SHA PG15 검증과 임시 자원 잔여0을 `docs/WORK_STATUS.md`에 기록했다.
- 목적: epoch26의 R13 `write_lease`를 먼저, `worker_lease`를 다음으로 append-only 회수한다. 기존 Event prefix, C30 `OPEN_BLOCKING`, ReleaseDecision `DEFER`, F-20/U-01 미수락을 보존한다.
- 통제 변경: R13 종료 overlay·전용 테스트·G-05 route·Event/progress/HANDOFF/digest/manifest와 본 계획·WORK_STATUS만. 제품·공개 API·DB·UI 수정은 없다.
- 검증: 종료 테스트 RED→GREEN, R12 close/R13 start 인접, G-05, diff check, 기존 branch commit/private push, WSL-server 동일 SHA clean/G-05 및 R13 임시 자원 잔여0.
- 실패 시: append 전에는 자료 변경0으로 중단한다. projection 오류·G-05 실패면 다음 writer 발급 금지하고 기존 `25d07aef` 및 원격 ref를 복구 기준으로 보존한다. main 병합·새 branch·ysna/Production은 수행하지 않는다.
