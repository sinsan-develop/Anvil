# F-20 C30 Event 원장 비파괴 복구 실행계획

## 목표·구조·기준

목표는 원본/오염 원문을 모두 보존한 채 C30의 새 논리 원장 세대를 검증해 차단 사유를 정확히 재판정하는 것이다. 구현은 현행 append-only Event JSON, Git object 고정 manifest, 기존 `scripts/check_project_progress.py`와 successor overlay를 사용한다. 설계 기준은 `F-20_C30_EVENT_RECOVERY_V2_DESIGN.md`; 제품 기능·DB·공개 API 변경은 없다. 한 branch/한 writer, dual lease, `main` 직접 개발 금지, 로컬 개발→push→WSL-server 정확 SHA 검증을 지킨다.

## 순차 작업

1. Main은 현재 branch/HEAD/clean과 원격 동일성을 확인하고 정상 anchor, 사고 commit, 컷오버 blob의 hash·Event 수·의미 diff를 재확인한다. 기술 설계/테스트 기준을 현재 통제 allowlist에 반영하고 기존 G-05를 유지한다.
2. Main은 C30 복구 WorkInstruction에 정확한 writer scope, dual lease, 입력 hash, 실패/rollback 조건을 기록한다. Developer 한 명만 제품·검증 코드 write lease를 갖는다. Main은 같은 파일을 동시에 쓰지 않는다.
3. Developer는 먼저 정상 anchor/컷오버/의미 변조/후속 WorkInstruction·lease/승인 binding 음성 테스트를 추가해 RED를 확인한다. 최소한의 복구 검증기와 successor projection을 구현해 GREEN을 확인한다. 기존 C30 검사가 새 검증 없이 PASS로 바뀌면 실패다.
4. Main은 Developer 결과와 diff·테스트를 독립 검토하고, 검증기 자체를 별도 음성 fixture로 공격한다. 불완전하면 동일 branch에서 재작업한다. 원본 bytes, SHA, accepted/Release 상태를 먼저 확인한다.
5. 검증된 컷오버 manifest와 seq2041 generation-start Event를 append-only 기록한다. 새 세대 검증이 끝나기 전에는 C30 `OPEN_BLOCKING`을 유지한다. 독립 Tester의 read-only 검증 뒤에만 recovery-verified Event와 차단 상태 재판정을 기록한다.
6. 로컬 focused/full G-05·회귀 검증, 변경 영향에 맞는 빌드·정적 검사, clean checkpoint/private push를 수행한다. WSL-server는 Git pull한 정확 SHA에서 동일 검사와 필요한 격리 테스트만 수행하고 전용 자원을 제거한다. 결과·오류 횟수·미검증·rollback을 `docs/WORK_STATUS.md`에 누적한다.
7. F-20/U-01 미완료 항목으로 즉시 이어간다. 전체 Stage 조건이 충족되기 전에는 F-20 수락, Release GO, `main` 병합, branch 삭제 또는 새 branch 생성은 하지 않는다.

## 검토 초점

- 원본과 오염 원문을 모두 잃지 않는가; 2040개 기존 Event 객체가 byte-for-byte 그대로인가.
- 기존 11개 거짓 수락이 새 세대의 유효한 승인이나 Package 수락으로 해석되지 않는가.
- seq1715~2040의 후속 통제가 실제 파일 hash·fencing·회수와 맞는가.
- 검증 실패가 반드시 차단 상태로 끝나는가; 테스트 mock PASS를 실제 WSL/browser/운영 PASS로 승격하지 않는가.
