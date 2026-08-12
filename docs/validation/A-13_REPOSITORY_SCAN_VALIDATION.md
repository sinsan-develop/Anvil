# A-13 Repository Scan Validation

## 판정

`FIXTURE_INTEGRATION_PASS / COMPLETED_PENDING_INDEPENDENT_TEST`. 실행한 범위는 Python 표준 라이브러리 adapter와 G-06 불변 fixture 8개뿐이다. 실제 사용자 저장소·브라우저·API·DB·WSL·Production·DIR은 `NOT_EXECUTED`다.

## TDD 및 검증 증거

- RED: package entrypoint 기대 테스트가 구현 부재로 실패했다.
- GREEN: foundation 5/5 PASS. 초기 `ScanError.field`/`dataclasses.field` 이름 충돌은 원인을 확인하고 import alias로 수정했다.
- RED/GREEN: Git·inventory·manifest·zero-delta 통합 요구를 먼저 실패시킨 뒤 구현했고 4/4 PASS했다.
- hostile 최초 7/8 PASS, reparse 검사가 Git보다 늦다는 원인을 확인했다. inventory-first snapshot으로 수정 후 8/8 PASS했다.
- artifact RED는 checker 부재, evidence RED는 manifest 부재를 각각 확인했다.
- `python -m unittest -v tests.tooling.test_a13_repository_scan`: 최종 22/22 PASS, exit 0, 64.688s.
- `python scripts/check_a01_journey.py`부터 `check_a12_screen_states.py`: 모두 exit 0/PASS.
- `python scripts/check_a13_repository_scan.py`: exit 0, `fixtures=8 zero_delta=8 hostile=15`.
- `python scripts/check_g07_baseline.py`: exit 0, packages=97, av=255, uncovered=0, scenarios=20.
- `python scripts/check_phase_g_gate.py`: exit 0, accepted=7, decisions=10, packages=97, av=255, scenarios=20, sync=7.
- `python -m unittest discover -s tests/tooling -v`: 262개 중 258 PASS/4 FAIL. 네 실패는 A03/A07/project progress 검사가 유효한 Developer A-13 untracked 제품 diff를 `GIT_DESCENDANT_WORKTREE_DIRTY`로 판정한 completion projection 조건이다. A-13 기능 test error/failure는 없었다.
- `python scripts/check_project_progress.py`: 동일 이유로 exit 1, `GIT_DESCENDANT_WORKTREE_DIRTY`.

## 불변성 증거

G-06 fixture는 OS temp 아래에 materialize했고 scan output/temp도 fixture repository 밖에 두었다. 8개 모두 pre/post snapshot SHA-256가 같고 delta가 0이었다. `FIX-PY-DIRTY`의 tracked/untracked content, `mtime_ns`, mode, porcelain-v2 status가 동일했다. 실제 Anvil 저장소는 스캔 입력으로 사용하지 않았다.

## 보안 검토

canonical root/path identity, case/prefix escape, symlink/junction/reparse, malicious manifest/hook/tool/network, 내부 output/temp, limit, timeout, injected write를 검사했다. subprocess는 argv allowlist와 `shell=false`만 사용하며 secret-like remote 값을 마스킹한다. 실제 credential은 테스트에 사용하지 않았다.

## 미실행 및 잔여 위험

플랫폼별 Unix symlink/special-file 세부 동작과 실제 대형 저장소 성능은 이 Windows fixture 검증으로 증명하지 않는다. 독립 Tester와 Main Agent의 completion projection/lease 회수 후 full tooling 및 project checker 재실행이 남는다.

## Revision 2 evidence-validator 재작업

- 기준: `main = origin/main = 3dac0804b55bc696eafbca81900804017499fcf6`, sequence 144, epoch 2, `ACTIVE / REWORK_IN_PROGRESS`.
- WI: `WI-A-13-20260812-002`, SHA-256 `A803A7A2C0810EB9E9F8521AEE1E5A66B99D71246888ECDAD193D233582EB46B`.
- `A13-TST-BLK-001` RED: clean committed clone에서 predecessor validator가 actual diff/raw bytes/raw hash/content bytes 네 오류를 재현했다.
- `A13-TST-BLK-002` RED: hostile self-reference/target manifest에 `validate_bundle()`이 `errors=[]`을 반환했고 predecessor tamper는 전용 reason code 없이 fail-open했다.
- GREEN 계약: clean committed successor는 empty Git diff와 frozen predecessor + completion successor live checksum으로 검증한다. R2 manifest가 있으면 그 manifest의 current raw를 직접 검증하며 clean diff 또는 exact five-path rework diff만 허용한다.
- CLI 계약: `validate_bundle()`은 evidence validator를 fixture scan 전에 반드시 호출한다. self-reference, target, raw bytes, raw hash, content bytes, predecessor binding 오류는 stable reason code와 nonzero exit로 전달한다.
- 변경하지 않은 경계: `packages/repository_intelligence/**`, G-06 fixtures, architecture contract, predecessor manifest/completion projection, Tester report, progress/HANDOFF.
- R2 focused: `python -m unittest -v tests.tooling.test_a13_repository_scan`, 22/22 PASS, exit 0, 102.265s. 기존 22개 test 수를 유지하면서 clean successor와 six-tamper bundle/CLI 회귀를 포함했다.
- full tooling: `python -m unittest discover -s tests/tooling -v`, 263개 중 259 PASS/4 FAIL, 164.983s. 네 실패는 Developer의 exact five-path dirty diff 때문에 project-progress가 반환한 `GIT_DESCENDANT_WORKTREE_DIRTY`와 progress가 참조하는 수정 문서의 `PRG_REFERENCED_HASH_MISMATCH`이며 A-13/기타 suite failure 또는 error는 0이다. Developer scope 밖 progress 수정이나 commit으로 우회하지 않는다.
- A01~A12 checker, A13 checker(`fixtures=8 zero_delta=8 hostile=15`), G06(`8/8/20/8`), G07, Phase G는 PASS. project checker만 위 두 projection reason code로 nonzero다.
- 최초 A01~A12 일괄 checker에 positional `.`을 준 호출 오류는 공식 `--root .`로 교정해 모두 PASS했으며 제품 결과로 세지 않았다.
- fixture/static 결과를 실제 runtime PASS로 승격하지 않는다. 독립 retest와 Main의 lease/progress completion projection 뒤 full 263/263 및 project checker 재실행이 남는다.
