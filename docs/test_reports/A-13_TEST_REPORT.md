# A-13 독립 Tester 검증 보고서

## 판정

`FAILURE_REPORT / REWORK_REQUIRED`

- package: `A-13`
- assigned verification: `AV-SAFE-010`, `AV-SAFE-012`의 fixture integration slice
- blocking finding: `2`
- 기준 revision: `main = origin/main = B5DF158CA5D4EB206AE026B0E6F9427CC257D10B`; 검증 시작 시 worktree clean
- progress: sequence `140`, `A-13 / TEST_REVIEW / COMPLETED / accepted=false`; active agent, worker lease, write lease 모두 `null`
- Main acceptance, progress/HANDOFF 변경, commit/push 및 A-14 착수는 수행하지 않았다.

핵심 repository scanner는 G-06 fixture `8/8`에서 full inventory와 Git 상태를 보존했고 독립 mutation `10/10`을 거부했다. 그러나 제출된 evidence 검증 경로에는 clean committed successor를 처리하지 못하는 오류와 CLI가 evidence manifest 검증을 호출하지 않는 fail-open 오류가 있다. 따라서 scanner 기능의 부분 PASS를 A-13 package acceptance로 승격하지 않는다.

## 차단 finding

### A13-TST-BLK-001 — HIGH — clean committed successor에서 evidence validator 실패

재현 조건은 Tester 보고서가 아직 존재하지 않고 `git status --porcelain=v2 --branch --untracked-files=all`의 worktree entry가 0인 실제 committed target이다.

- `_git_changed_paths(root)` 결과: `[]`
- `_successor_projection(root, changed_paths)` 결과: `None`
- `validate_evidence_manifest(root)` 결과:
  - `EVIDENCE_ACTUAL_DIFF_MISMATCH`
  - `EVIDENCE_CONTENT_BYTES_MISMATCH`
  - `EVIDENCE_RAW_BYTES_MISMATCH`
  - `EVIDENCE_RAW_HASH_MISMATCH`
- 원인: successor 인식 조건이 completion projection의 exact 28-path 집합과 현재 `git status` changed-path 집합의 동일성을 요구한다. completion projection이 commit된 clean target에서는 changed-path 집합이 0이므로 successor가 무효화되고, frozen predecessor가 보존한 과거 checker/test raw와 현재 successor raw의 의도된 차이를 다시 오류로 판정한다.
- 영향: fresh full tooling은 `263`개 중 `262 PASS / 1 FAIL`이며 A-13 evidence integrity test가 반복적으로 실패한다.

successor 자체의 결박은 독립 재계산에서 정상이다. predecessor file SHA-256은 `BA2522405B707D0D17673BB029DCAF456D7891F76F09B60B03214DF8043FD2DE`로 불변이고, successor가 선언한 현재 checker/test 두 행은 실제 bytes와 SHA-256에 모두 일치한다. 즉 결박 자료가 없는 것이 아니라 clean target을 판별하는 조건이 잘못됐다.

### A13-TST-BLK-002 — CRITICAL — CLI가 evidence manifest 변조를 fail-open

원본 저장소 밖 disposable 복제본에 `self_reference=true`, 빈 raw 목록, 0으로 채운 target hash를 가진 hostile `A-13_EVIDENCE_MANIFEST.json`을 넣고 CLI를 실행했다.

- hostile manifest SHA-256: `FC9117C7057DC6F77DB8F8A3F2DD066BB194FC37AB78BE720A36981769CFAA07`
- 실제 결과: exit `0`, `A-13 repository scan: fixtures=8 zero_delta=8 hostile=15`
- 원인: CLI `main()`은 `validate_bundle()`만 호출하고, `validate_bundle()`은 `validate_evidence_manifest()`를 호출하지 않는다.
- 영향: evidence manifest가 명백히 변조돼도 공식 checker CLI가 성공하므로 완료 evidence의 신뢰 경계가 fail-open이다. 제출 evidence를 acceptance 근거로 사용할 수 없다.

## scanner read-only 검증 결과

### G-06 원본 fixture hash와 materialization

독립 알고리즘으로 fixture index의 manifest SHA-256과 각 source tree의 `path<TAB>bytes<TAB>SHA-256` 집계를 재계산했다. `8/8` 모두 선언값과 일치했다.

| Fixture | Manifest SHA-256 | Source aggregate |
|---|---|---|
| `FIX-PY-CLEAN` | `0B1A59EE754CB4C193D2FE8190495AF9196866F6895180BA0630631050286616` | `8849CA9BF6FA4BB25CD748959958DEEBC20594207E72804CF3EE566DD8B1CCEA` |
| `FIX-PY-DIRTY` | `2DA53A66C96F691C8E33EA2BA15E8A0829CC7805F6269F7709ADBD1019FDDE8D` | `8849CA9BF6FA4BB25CD748959958DEEBC20594207E72804CF3EE566DD8B1CCEA` |
| `FIX-PY-REDFAIL` | `9BCA89ED4A4C6CA35488D76BF0AF82041ECE3BBC5AD88EF9EEA1CF3906DF342D` | `7CE285F3B0B89249A0A22F62EE2C62A6D2989308D8A1CF58858FE6C28D5C0E7E` |
| `FIX-TS-CLEAN` | `A92AF061A87179C82A34F8E52E76254251DCFCB8422EF22BBAE98C8AB18001E3` | `C2F9579E4F77811577FF688A19BC960004211C7A0123FFDB16A91687732F283D` |
| `FIX-TS-NOTOOL` | `F0D9F9BBB8274FBC8D82460B61F191FA540B19E49F59DF71F4270ED094E5DFAF` | `1EF435DC06F9726B329F76FEF1AF37C4DFF301E4A34EB9A6ED2ED6592E996873` |
| `FIX-PROTECTED` | `56EB2070F0E3061C7BAFA267622AE60325A0CAF93ACE6B07611E7ED01355067B` | `8BDC025BFF79770F547D27E1C351AD74E9615289606C62E1EF4F79DBF4951545` |
| `FIX-LARGE` | `0A060B65C1675379E0F93FA8CABF6D624DFCBFAC1D033C152E3D313CDBB06E5F` | `70F805CBABD30AFBEC07D77263754BA0C6A28FB69A53B7E2DD9EB945E75FA4B2` |
| `FIX-CONFLICT` | `751C553109EAD56769AE4398E7B46C24BE554A8F8D72BF340EA905547FA0CF33` | `07CBDE10EDE51D53F081AB873B9FEBF01FBE2D09C8407C2357532E17C1E8414F` |

각 fixture를 별도 temp Git repository로 materialize하고 `GIT_OPTIONAL_LOCKS=0`, fsmonitor/hook 비활성 상태에서 외부 독립 full inventory를 `path/type/size/mtime_ns/mode/content SHA-256`로 pre/post 비교했다.

- materialize/scan: `8/8` success
- scanner `no_write_proof.identical`: `8/8 true`
- 외부 full inventory delta: `0/8` fixture
- Git porcelain-v2 pre/post delta: `0/8` fixture
- `FIX-PY-DIRTY` exact 상태: tracked `src/calc.py`, untracked `notes/local-note.txt`; content, mtime_ns, mode와 status 모두 보존
- output/temp는 모두 repository 밖 disposable 경로에만 생성

첫 탐색 측정에서는 외부 측정자가 inventory 뒤 일반 `git status`를 호출해 fixture별 `.git/index` stat-cache delta 1개를 만들었다. 이는 scanner 실행 전 측정자 유발이므로 PASS 근거에서 제외했고, 위 결과는 optional-lock 비활성 및 status 선행 안정화 후 fresh 재측정한 값이다.

### hostile와 mutation

A-13 focused module의 non-artifact scanner test `21/21`은 통과했다. non-Git, outside-root/case escape, symlink·junction·reparse, TOCTOU injected write, malicious fsmonitor/hook/AGENTS, inert manifest, project command/package/network 금지, repository 내부 output/temp 거부, entry/file/total limit, Git timeout, remote credential/query masking을 확인했다.

추가 독립 injection은 각기 새 disposable `FIX-PY-CLEAN`에서 manifest detection과 post snapshot 사이에 수행했다.

| Injection | 결과 |
|---|---|
| file add / delete / content / mtime_ns / mode | `5/5 REJECTED` |
| `.git/index` / ref / `HEAD` / branch / porcelain status | `5/5 REJECTED` |

모두 `SCAN_MUTATION_DETECTED`, `identical=false`와 해당 inventory/Git/Git-metadata delta를 반환했다. 원본 Anvil 저장소에는 mutation이 없었다.

## evidence와 projection 독립 재계산

| 대상 | 결과 |
|---|---|
| Developer predecessor file | SHA-256 `BA2522405B707D0D17673BB029DCAF456D7891F76F09B60B03214DF8043FD2DE`, raw `16`, self-reference `false` |
| Developer predecessor target | declared raw projection 재계산 `1AEC2DC560F1AF41B234FEDA3603C25F88B62740E8FB19A83FA85B770D3BA733`, canonical bytes `2121`, content bytes `84262`; target/delivered 일치 |
| Frozen predecessor 대 live raw | `14/16` 직접 일치; checker/test `2`행은 successor가 별도 current bytes/hash로 정확히 결박 |
| Completion manifest file | SHA-256 `56376C0DB64E840E1CB8145918F74291B413FFEFA681AD29DDE141D91681A854` |
| Completion raw | `5/5` bytes/hash 일치, self-reference `false` |
| Completion target | TAB-row UTF-8 byte ordinal 재계산 `03652000579D921576D8E70BAA4968D46D16D2DBAC6706C24353454FD9914DC8`, canonical bytes `629`; target/delivered 일치 |
| Completion exact projection | validated base `EE878EE4195D61715A31CF7E7AA79240BA7BC416..HEAD` Git 변경 `28`, allowlist `28`, missing `0`, unexpected `0` |

## fresh 전체·회귀 검증

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

- full tooling: exit `1`, `Ran 263 tests in 133.672s`, `262 PASS / 1 FAIL`; A13-TST-BLK-001 재현
- A-13 focused: exit `1`, `22`개 중 `21 PASS / 1 FAIL`; 동일 finding 재현
- A-01~A-12 checker: 모두 exit `0`, PASS
- A-13 CLI: exit `0`, fixtures `8`, zero-delta `8`, hostile `15`; 단 A13-TST-BLK-002 때문에 evidence integrity PASS로 인정하지 않음
- G-06: exit `0`, fixtures `8`, golden `8`, scenarios `20`, fault injections `8`
- project-progress: exit `0`, sequence `140`, `AUTO_CONTINUE`
- G-07: exit `0`, packages `97`, AV `255`, uncovered `0`, scenarios `20`
- Phase G Gate: exit `0`, accepted `7`, decisions `10`, packages `97`, AV `255`, scenarios `20`, sync `7`

호출 이력상 A-01~A-12 checker에 positional `.`을 준 첫 일괄 명령은 argparse exit `2`였고 `--root .`로 교정해 전부 PASS했다. 존재하지 않는 A-13 test class를 지정한 첫 targeted 명령도 loader error였으며 정확한 class/method로 재실행해 동일 제품 failure를 확인했다. 두 호출 오류는 제품 failure나 PASS로 집계하지 않는다.

## 원본 저장소 불변성과 미실행 범위

full tooling 실행 전후 Anvil 저장소 전체 `.git` 포함 `7,185` entry를 독립 비교했다.

- path/type/size/mtime_ns/mode/content SHA-256 delta: `0`
- HEAD/branch/porcelain-v2/index/refs/packed-refs/config/`*.lock` delta: `0`
- HEAD/branch: `B5DF158CA5D4EB206AE026B0E6F9427CC257D10B / main`
- index SHA-256: `E860F738F1D4A2994929A38C2C8572A8D8CAAF0E73DADDE46D39FFA6E7CE3C9B`
- Git lock: pre/post 모두 `0`

actual user repository, browser, API, DB, WSL, server, production, deployment와 DIR은 모두 `NOT_EXECUTED`다. fixture/static 검증을 실제 운영 PASS로 승격하지 않는다.

## 조치

1. A13-TST-BLK-001에서 committed clean 상태와 uncommitted completion projection을 구분해 frozen predecessor + successor binding을 모두 검증하도록 수정해야 한다.
2. A13-TST-BLK-002에서 공식 CLI bundle 검증이 evidence manifest validator를 반드시 실행하고 그 오류를 exit nonzero로 전달해야 한다.
3. 두 finding의 hostile regression과 fresh full `263/263` PASS 후 독립 재검증한다.
4. 기존 predecessor/completion evidence는 수정하지 말고 successor/rework evidence로 비소급 보완한다.

Tester workspace write는 본 보고서 한 파일뿐이다. rollback은 Main Agent가 이 보고서 파일만 제거하면 되며, 제품·기존 evidence·progress/HANDOFF·Git 상태에는 Tester 변경이 없다.
