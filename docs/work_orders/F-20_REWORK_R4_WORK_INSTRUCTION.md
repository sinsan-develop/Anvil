# F-20 R4 역사·이식성 테스트 기준 재작업 WorkInstruction

- 발행자: Main Agent 어울
- Work Package: `F-20/R4`; F-20 전체 suite 회복의 비G-05 실패 7건을 다룬다.
- 기준: 승인된 `Anvil_작업계획서_v1.md` F-20, `docs/04_test_reports/F-20_FULL_SUITE_RECOVERY_PLAN.md`, `AGENTS.md`.
- 분류: 승인 범위 안의 테스트 기준 시점·OS 이식성 보완. 제품 runtime, 공개 API, 데이터 계약, 권한 및 중요 위험은 바꾸지 않는다.
- 개발: Windows 로컬의 기존 `codex/f18-wsl-ops`; 검증: 지정 원격 push 후 `ssh WSL-server`에서 동일 SHA pull. WSL-server의 공유 DB/Docker 및 ysna-server/Production은 범위 밖이다.

## 정확한 제품 쓰기 범위

1. `docs/04_test_reports/F-20_REWORK_R4_RESULT.md`
2. `tests/integration/test_c30_contract_matrix.py`
3. `tests/tooling/test_a13_repository_scan.py`
4. `tests/tooling/test_f18_wsl_ops_r12_overlay.py`
5. `tests/tooling/test_phase_b_gate.py`
6. `tests/verification/test_c01_l3_independent_acceptance.py`

이 범위 외 제품·테스트 변경은 금지한다. R3 write→worker lease를 append-only 회수한 뒤 R4 worker/write token·scope·만료·기준 commit의 G-05와 독립 통제 테스트가 유효해야 단일 writer가 수정한다.

## 실패 재현과 변경 계약

- 현 SHA의 실패 7건(C30 2, A13 1, F18 R12 2, Phase B 1, C01 1)을 먼저 정확한 오류로 재현한다. 테스트를 skip/xfail하거나 오류 문자열만 무시하지 않는다.
- C30: 당시 Event bytes·seq1357 handoff는 frozen checkpoint에서 검증하고 현재 seq1731은 현재 projection과 연결 증거로 별도 검증한다. 역사 checksum 자체를 갱신하거나 약화하지 않는다.
- A13: POSIX에서는 존재하지 않는 case-flipped `allowed_root`를 허용 root로 쓰지 않는다. 실제 경계 밖 경로 거부를 두 OS에서 검증하고 Windows case-insensitive 거부 의미를 보존한다.
- F18 R12: 과거 `BASE`와 `development/main`의 당시 관계를 고정 Git 역사 fixture로 재현한다. 현재 remote 이동에 좌우되지 않되 당시 exact scope·unrelated path 거부는 유지한다.
- Phase B: 당시 authority 문서 bytes와 manifest의 raw checksum을 함께 검증한다. 현재 successor 문서 hash로 과거 gate를 재판정하지 않고 manifest 변조 음성 테스트는 유지한다.
- C01: 승인된 F-13 Operations GET 2개만 후속 OpenAPI 경로로 추가 인정한다. 기존 execute route, permission, request/response schema와 parent hash 검사는 유지한다.
- 각 변경의 원인·RED→GREEN·파일별 회귀·명령·종료 코드·미검증·rollback을 결과 보고서에 기록한다. Main이 commit/push 후 WSL 동일 SHA 집중 및 전체 suite를 재실행한다. 41개 G-05/history 실패와 raw Event 변경을 R4 PASS로 승격하지 않는다.

## 완료 경계

R4의 7건 GREEN은 F-20 전체 suite, 11개 메뉴 실제 기능, 브라우저 Network 또는 main 병합 허가가 아니다. 다음 lease 전환은 Main이 별도 검사한다.
