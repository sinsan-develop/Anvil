# A-13 독립 Tester 재검증 보고서 R2

## 판정

`READ_ONLY_FIXTURE_INTEGRATION_PASS / READY_FOR_MAIN_ACCEPTANCE`

- package/revision: `A-13 / 2`
- blocking finding: `0`
- `A13-TST-BLK-001`: `CLOSED`
- `A13-TST-BLK-002`: `CLOSED`
- assigned verification: `AV-SAFE-010`, `AV-SAFE-012`의 fixture integration slice
- 기준 revision: `main = origin/main = 24581AE9709387D39750F02C9C88625CF223B993`; 검증 시작 시 worktree clean
- progress: sequence `147`, `A-13 / TEST_REVIEW / COMPLETED / R2_PENDING / FIXED_AWAITING_INDEPENDENT_RETEST`; active agent, worker lease, write lease 모두 `null`
- Main acceptance, progress/HANDOFF 변경, commit/push 및 A-14 착수는 수행하지 않았다.

## 이전 finding closure

### A13-TST-BLK-001 — CLOSED

제품 테스트와 분리된 독립 호출에서 current committed target과 `git clone --local --no-hardlinks`로 만든 disposable clean clone을 각각 검사했다.

- current와 clone의 changed paths: 모두 `[]`
- current `validate_evidence_manifest()`: errors `[]`
- clone `validate_evidence_manifest()`: errors `[]`
- current `validate_bundle()`: errors `[]`, fixtures `8`, zero-delta `8`, hostile `15`

clean committed successor가 더 이상 `EVIDENCE_ACTUAL_DIFF_MISMATCH`, raw bytes/hash/content bytes 오류를 내지 않는다. frozen R2 predecessor manifest SHA와 completion successor checker/test live binding도 실제 파일과 일치한다.

### A13-TST-BLK-002 — CLOSED

disposable clean clone의 R2 evidence manifest를 `self_reference=true`, zero target/delivered로 변조했다.

- bundle: `EVIDENCE_SELF_REFERENCE_FORBIDDEN`, `EVIDENCE_TARGET_HASH_MISMATCH`를 포함한 오류 반환
- 공식 checker CLI: exit `1`
- CLI stdout: 위 두 stable reason code 포함

따라서 공식 CLI가 evidence validator 오류를 exit nonzero로 전달하며 hostile manifest를 성공으로 통과시키지 않는다. R2 회귀 테스트는 self-reference, target, content bytes, raw bytes, raw hash, predecessor binding 변조를 각각 fail-closed로 검사한다.

## fresh 테스트와 checker

```powershell
C:\Users\cyhuh\anaconda3\python.exe -m unittest discover -s tests/tooling -v
C:\Users\cyhuh\anaconda3\python.exe -m unittest -v tests.tooling.test_a13_repository_scan
C:\Users\cyhuh\anaconda3\python.exe scripts\check_a01_journey.py --root .
# 같은 형식으로 A-02~A-12 checker 실행
C:\Users\cyhuh\anaconda3\python.exe scripts\check_a13_repository_scan.py .
C:\Users\cyhuh\anaconda3\python.exe scripts\check_g06_test_assets.py .
C:\Users\cyhuh\anaconda3\python.exe scripts\check_project_progress.py .
C:\Users\cyhuh\anaconda3\python.exe scripts\check_g07_baseline.py .
C:\Users\cyhuh\anaconda3\python.exe scripts\check_phase_g_gate.py .
```

- full tooling: exit `0`, `Ran 263 tests in 140.648s`, `263/263 PASS`
- focused A-13: exit `0`, `Ran 22 tests in 82.183s`, `22/22 PASS`
- A-01~A-12 checker: 모두 exit `0`, PASS
- A-13 checker: exit `0`, fixtures `8`, zero-delta `8`, hostile `15`
- G-06 checker: exit `0`, fixtures `8`, golden `8`, scenarios `20`, fault injections `8`
- project-progress: exit `0`, sequence `147`, `AUTO_CONTINUE`
- G-07: exit `0`, packages `97`, AV `255`, uncovered `0`, scenarios `20`
- Phase G Gate: exit `0`, accepted `7`, decisions `10`, packages `97`, AV `255`, scenarios `20`, sync `7`

## G-06 fixture와 scanner read-only 회귀

독립 알고리즘으로 fixture index manifest SHA-256과 각 source tree의 `path<TAB>bytes<TAB>SHA-256` aggregate를 재계산했다. 원본 8개 fixture가 모두 선언값과 일치했다.

각 fixture를 별도 temp Git repository로 materialize하고, `GIT_OPTIONAL_LOCKS=0` 및 fsmonitor 비활성 상태에서 scanner 전후 전체 tree를 `path/type/size/mtime_ns/mode/content SHA-256`로 독립 비교했다.

- manifest/source hash: `8/8` 일치
- materialize/scan success: `8/8`
- scanner `no_write_proof.identical`: `8/8 true`
- 외부 full inventory delta: `0/8`
- Git porcelain-v2 delta: `0/8`
- `FIX-PY-DIRTY`: tracked `src/calc.py`, untracked `notes/local-note.txt`를 정확히 유지
- output/temp: repository 밖 disposable 경로만 사용

focused hostile 회귀는 non-Git, outside-root/case escape, symlink·junction·reparse, TOCTOU/injected write, malicious fsmonitor/hook/AGENTS, inert manifest, project command/package/network 금지, repository 내부 output/temp, entry/file/total limit, Git timeout, remote credential/query masking을 포함해 PASS했다.

## R2 evidence 독립 재계산

| 대상 | 독립 결과 |
|---|---|
| R2 WorkInstruction | SHA-256 `A803A7A2C0810EB9E9F8521AEE1E5A66B99D71246888ECDAD193D233582EB46B` |
| R1 Tester report predecessor | SHA-256 `90765FDA6C240AE04A7548B265BC4E2506E9E1878F93DE353ECFEE1AD736A986`, 불변 |
| R2 Developer manifest file | SHA-256 `4D06E7D449B14711E8CF1AB98171DE4310CFD8CDF46F4095557A38BB9FF21771` |
| R2 Developer raw/target | raw `8`; declared bytes 합 `80603`; canonical bytes `1072`; target/delivered 재계산 `7629BE41F2174CEA6538B35C410A1E3DE7488A8BFD0BA166229F5C36DEB8A085`; self-reference `false` |
| R2 Developer live binding | raw `6/8` 직접 일치; 현재 checker/test `2/2`는 completion successor live bytes/SHA와 일치 |
| R2 completion manifest file | SHA-256 `82A29409FE20922AD92BF4A023953EF313CB07826FC5083FAF9695FB70D0EDC6` |
| R2 completion raw/target | raw `5/5` bytes/hash 일치; canonical bytes `632`; target/delivered 재계산 `1E3E37567D2A278B80BA8D05D7A9AAF74872E6AA6068D66949469A851ADED82B`; self-reference `false` |
| R2 completion exact projection | validated base `3DAC0804B55BC696EAFBCA81900804017499FCF6..HEAD`: Git 변경 `15`, allowlist `15`, missing `0`, unexpected `0` |

Developer manifest의 checker/test 두 과거 raw 행은 R2 completion successor가 현재 파일 bytes/SHA를 별도 결박하므로 historical predecessor를 소급 수정하지 않는다.

## 원본 저장소 불변성

fresh full tooling 실행 전후 Anvil 저장소 전체 `.git` 포함 `7,245` entry를 비교했다.

- path/type/size/mtime_ns/mode/content SHA-256 delta: `0`
- HEAD/branch/porcelain-v2/index/refs/packed-refs/config/`*.lock` delta: `0`
- HEAD/branch: `24581AE9709387D39750F02C9C88625CF223B993 / main`
- index SHA-256: `761FA3FB9564277FAF2495AC386553DC455F33CBCE1B30B057702E23EBB56F54`
- Git lock: pre/post 모두 `0`

## 미실행 범위와 조치

- 이 판정은 `FIXTURE_INTEGRATION_ONLY` 범위의 read-only scanner와 evidence integrity 계약에 한정한다.
- actual user repository, browser, API, DB, WSL, server, production, deployment, network/project tool execution과 DIR은 모두 `NOT_EXECUTED`다.
- fixture/static PASS를 실제 사용자 저장소·운영 기능 PASS로 승격하지 않는다.
- Main Agent는 이 독립 evidence를 fresh 검토한 뒤에만 A-13 최종 acceptance를 판정할 수 있다.
- Tester workspace write는 본 R2 보고서 한 파일뿐이다. rollback은 이 보고서만 제거하면 된다.
