# F-20/R4 비G-05 역사·이식성 테스트 재작업 결과

## 판정

`COMPLETED_LOCAL_SCOPED` — 지정된 비G-05 실패 7건의 테스트 기준을 원인별로 보완했다. 로컬의 대상 5개 파일 전체 실행은 `91 passed, 8 skipped`이다. 이는 WSL-server 동일 SHA 전체 suite, G-05/history 41건, F-20 기능 인수 또는 main 병합의 PASS가 아니다.

## 기준과 시작 상태

- Work Package `F-20/R4`; 작업계획서 SHA-256 `943B4123C5A8F273FF628E150501E0D66FAC10705A72989CA98E8453A083AEEB`; WorkInstruction SHA-256 `2CF4C28381C44192ABF51A7E7C1754DC54ADD3D5BE76BC9D558F9CDC89EB6A3B`.
- 시작 branch `codex/f18-wsl-ops`, clean HEAD `c64d709165ad8ccf473347c36709e588a905b7b0`; canonical seq1737, worker/write epoch4 actor `developer-primary-f20-r4`, exact6 scope, 만료 `2026-09-28T07:09:26+00:00`. 시작 G-05 `PASS sequence=1737`(exit 0).
- 수정은 본 보고서와 WorkInstruction이 허용한 5개 테스트 파일만 수행했다. 제품 runtime/API, 원본 Event/manifest, 승인 문서, Git commit/push/branch, WSL-server/Production은 변경하지 않았다.

## 원인과 조치

| 실패군 | 확인된 원인과 최소 변경 | 남긴 거부 검증 |
|---|---|---|
| C30 2 | seq1262 원본 Event prefix hash는 frozen `abb7361` Git bytes에서, C30 최종 수락 projection·digest는 `5e7407d` 당시 bytes에서 확인한다. 현재 seq1737 handoff/progress와 현재 detached digest는 별도로 대조한다. | 과거 raw hash·당시 canonical hash, 당시/현재 evidence event 동일성, 현재 progress↔handoff↔digest raw 결박 유지. 현재 ledger의 과거 raw prefix 변조는 해결·수락하지 않았다. |
| A13 1 | Windows의 case-flipped 허용 root 검사는 유지하고 POSIX에서는 실제 존재하는 허용 root로 prefix escape를 검증한다. | 실제 허용 root 밖 `Allowed-escape`가 `ROOT_OUTSIDE_ALLOWED`로 거부됨. |
| F18 R12 2 | 현재 `development/main`에 의존하지 않도록 임시 로컬 Git clone에서 R12 당시 BASE와 active branch 원격 추적 ref를 실제 역사 commit으로 고정한다. R12 close control 파일이 있는 `c7610e2`의 실제 Git tree를 사용한다. | 양성은 clean clone의 실제 `collect_git()==[]`로 확인했다. 음성은 같은 clone의 Git diff 반환값에 `deploy/ysna/unrelated-change.sh`를 주입해 `F18_WSL_OPS_R12_POST_QA_SCOPE_INVALID` 거부를 확인했다. 실제 Git 파일은 변조하지 않았다. |
| Phase B 1 | 원본 manifest가 작성된 `355b99a`의 authority 문서·manifest·16개 raw checksum 대상을 임시 fixture에서 함께 검증한다. 현재 successor matrix/test plan을 과거 checksum에 대입하지 않는다. | manifest 내용·대상·scope·경로 이탈 음성 검사 유지, 역사 matrix byte 변조 신규 거부 검사 추가. |
| C01 1 | 승인된 F-13 Operations `GET /api/operations/alerts`, `GET /api/operations/audit` 두 후속 경로만 C01 역사 OpenAPI projection에서 분리한다. | 기존 execute 단독 경로·권한·request/response schema·parent OpenAPI hash 대조 유지. |

## 검증 기록

- 초기 RED: `.venv\Scripts\python.exe -B -m pytest -q --tb=short --import-mode=importlib -p no:cacheprovider --basetemp=.pytest_tmp_f20_r4_writer` + 7개 지정 node ID → exit 1, `5 failed, 2 passed`. Windows에서 A13과 F18 unrelated-path는 통과했으며 두 항목의 POSIX/WSL 실패는 기존 동일 SHA 전체 suite 증거(`8112 passed, 48 failed, 116 skipped`)에 기록되어 있다.
- C30 중간 점검: 같은 옵션으로 두 C30 node ID → 첫 수정 후 exit 1(`1 failed, 1 passed`; 현재 evidence package 고정 가정), 두 번째 수정 후 exit 1(`1 failed, 1 passed`; 현재 R4 digest에 역사 canonical 필드가 없는 차이), 역사/현재 digest 분리 후 exit 0(`2 passed`).
- A13/C01 집중: 같은 옵션으로 해당 두 node ID → exit 0, `2 passed`.
- Phase B 파일 전체: 같은 옵션으로 `tests/tooling/test_phase_b_gate.py` → exit 0, `5 passed`(authority 변조 검사 추가 전).
- F18 R12 파일 전체: 같은 옵션으로 `tests/tooling/test_f18_wsl_ops_r12_overlay.py` → 첫 역사 clone은 close-control 세 파일이 없는 시점이라 exit 1(`1 failed, 4 passed`); 실제 `c7610e2` tree로 고정한 뒤 exit 0(`5 passed`).
- 최종 집중: `.venv\Scripts\python.exe -B -m pytest -q --tb=short --import-mode=importlib -p no:cacheprovider --basetemp=.pytest_tmp_f20_r4_writer tests/integration/test_c30_contract_matrix.py tests/tooling/test_a13_repository_scan.py tests/tooling/test_f18_wsl_ops_r12_overlay.py tests/tooling/test_phase_b_gate.py tests/verification/test_c01_l3_independent_acceptance.py` → exit 0, `91 passed, 8 skipped in 206.99s`. 8 skip은 C01 실제 PostgreSQL 연결을 요구하는 DB 테스트로, DB PASS가 아니다.
- 최종 `git diff --check` exit 0; `.pytest_tmp_f20_r4_writer` 안의 symlink 2개가 모두 해당 경로 내부를 가리킴을 확인한 후 그 임시 폴더만 삭제, residue 0. 검증 도중 생성된 정확한 5개 일반 `.pyc`도 식별·제거했다. 임시 폴더 정리 후 `scripts/check_project_progress.py` → exit 0, `G-05 project progress contract: PASS sequence=1737 reporting=AUTO_CONTINUE`.
- 독립 검토 Minor 2 보완: C30 검사명을 실제 범위인 frozen prefix hash·현재 비수락 evidence 연결로 명확히 하고, F18 음성 검사가 실제 파일 변조가 아닌 Git diff 반환값 주입임을 위 표에 구분했다. C30 2개와 F18 R12 파일 전체를 같은 pytest 옵션으로 `--basetemp=.pytest_tmp_f20_r4_minor_review`에서 재실행하여 `7 passed in 24.46s`(exit 0). 임시 폴더의 symlink 2개가 모두 내부를 가리킴을 확인 후 해당 폴더만 삭제, residue 0.

## 잔여 범위와 인계

- 정식 Developer `FAILURE_REPORT` 0회. 위 중간 실패는 RED 확인·fixture 조정이며 unresolved 정식 실패가 아니다.
- WSL-server 동일 SHA, 전체 pytest, 브라우저 Network, 실제 DB/API/Provider, 11개 메뉴·복구 흐름, G-05/history 41건 및 C30 현재 ledger raw prefix의 과거 변조는 미검증·미해결이다. 역사 checksum을 새 현재값으로 갱신하지 않았고 테스트 skip/xfail도 추가하지 않았다.
- Main은 정확한 6개 파일 diff/lease를 검토하고 commit/push 후 WSL-server에서 동일 SHA 집중 및 전체 suite를 실행한다. rollback은 이 R4의 5개 테스트 변경과 본 보고서만 되돌리는 것이며 frozen checkpoint·audit Event를 손대지 않는다.
- `docs/progress/build-progress.json` 및 `BUILD_HANDOFF.md`는 단일 writer의 허용 경로 밖이므로 Developer가 갱신하지 않았다. Main에게 결과와 미검증 경계를 인계한다.
