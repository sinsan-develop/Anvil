# D-08 완료보고

## 1. 판정

- 결과 계약: **COMPLETED** — 지정 exact6 내 구현 및 기본 검증 완료. Main의 독립 acceptance/D-Skill Gate 판정은 별개다.
- R2 최종 focused **104 passed**, 관련 knowledge/API **1499 passed**, compileall 및 git diff-check **exit 0**. 하단 R2 기록이 R1·초기 구현 판단보다 우선한다.
- D-05/D-06 정본 계보와 D-07 before-version을 참조하는 immutable evolution sidecar를 구현했다. create/patch/split/merge/archive, host-captured replay·pilot evidence, 사람 승인/제한된 trusted_auto, head CAS, 다음 Run one-shot 선택, rollback 계보를 검증했다.
- **D-07 consumer 연결: NOT_INTEGRATED.** 실제 filesystem pending directory, Skill/Hook 실행, DB/HTTP/browser/Provider/network/queue/배포: **NOT_EXECUTED**.
- Git mutation/control/progress/HANDOFF 변경 없음. 승인 UI/escalation 요청 없음. 다음 Package 시작 없음.

## 2. 판단 이유

### 기준선과 작업 권한

- 작업 root: `D:\Project\Anvil\.codex-sandbox\anvil-main-integration`.
- 시작/최종 HEAD: `a3fa3ed09cd6998b234458b5283abafa0f222f88`, branch: `codex/c09-execution-backends-r1`.
- 시작 `git status --short`: 기존 C-13~C-15 및 Main control tracked dirty 26개와 D-01~D-07/control untracked 다수. 기존 상태는 보호했으며 clean이라고 간주하지 않았다.
- canonical `d08_start.event_sequence=1002`, status IN_PROGRESS. 이 writer는 seq1002를 변경하지 않았다.
- WI `docs/work_orders/D-08_WORK_INSTRUCTION.md` SHA256: `85ABF5F8ED84EE93F8414D3E551EB1629EE01672312D893BF4AA0688E3726633`.
- Invocation SHA256: `E0651F8F3DB59FC05CE89B1FED56972EB761A6B4CCAF2BB5638FC6B719331E15`.
- Design baseline: `DC7509CB76A4BF08A0AE4D6F802FFB747B670FAB93426D5636B14575F7BEF9A3`. 설계 36.11~36.12, 작업계획 D-08, AV-LRN-017 및 WI를 대조했다.
- worker `worker-lease-d08-r1-20260916-001`; execution fencing token `d08-r1-execution-fence-epoch-1-a3fa3ed09cd6998b`.
- write `write-lease-d08-r1-20260916-001`; write fencing token `d08-r1-write-fence-epoch-1-234458b5283abafa`.
- 양 lease ACTIVE, exact6 path scope 일치. 발효 `2026-09-16T13:18:00+09:00`, 만료 `2026-09-17T01:18:00+09:00`. host `2026-09-16T18:27:47+09:00`에서 발효·미만료 확인 후 쓰기를 시작했고 최종 검증 시각은 `2026-09-16T18:49:10+09:00`이다.
- 원본 `D:\tmp\anvil-main-integration` 제품 파일은 쓰지 않았다. 그곳의 기존 venv Python 3.13.9 실행 파일만 사용했다.

### Main의 내부 연결 판단

D-06 activation은 항상 사람 승인을 요구하고 D-07 loader는 그 activation을 받는다. D-08 exact6만으로 기존 두 계약을 변경할 수 없어, 구현 전에 Main에게 연결 경계를 확인했다. Main은 다음 방법을 명시 승인했다.

- D-08 자체 immutable evolution activation/next-run selection sidecar를 둔다.
- D-06 candidate와 D-07 before-version exact ID/version/hash, 사람 approval 또는 trusted-auto 정책, head CAS 및 D-02 run-start one-shot selection을 검증한다.
- D-07 loader 직접 연결은 범위 밖이며 **NOT_INTEGRATED**로 남긴다. 이 결과를 runtime consumer 통합 PASS로 승격하지 않는다.
- 이는 WI 4.8/4.11과 exact6 경계의 내부 구현 판단이며, 새 Skill은 반드시 사람 승인이다.

### 실제 구현 계약

1. `capture_proposal`은 host가 확인한 D-05 reflection/D-06 candidate 계보, exact before/after payload hash, 서로 다른 evidence 2개 및 대표 작업 manifest 3개 이상을 결박한다. 각 task ID/content hash/input hash는 독립적이다. API가 raw actor/source/trust/approval/pilot 결과를 공급하지 않는다. 이 host adapter는 실제 인증·증거 수집 경계이지 모델 self-attestation API가 아니다.
2. reason enum은 REUSABLE_NEW→CREATE, PROCEDURE_GAP→PATCH, BROAD_TRIGGER→SPLIT, DUPLICATE→MERGE, OBSOLETE→ARCHIVE로 결정론적으로 분류한다. before/after 개수·identity, D-06 intent/target을 검증하여 모델 추측 문자열·단일 행동·잘못된 shape를 거부한다. 기존 D-07 Skill을 before에서 누락하고 CREATE로 덮어쓰는 경로를 막는다.
3. 후보는 immutable before/after, baseline hash, unified diff, provenance/review, 예상 재사용 범위, actor/context를 가진 PENDING 기록이다. 후보 생성만으로 D-07 catalog나 현재 Run snapshot을 바꾸지 않는다. canonical JSON 저장 및 detached immutable projection을 사용한다.
4. R2부터 description/body는 섹션·언어·단어·의미와 무관하게 **한 글자라도 달라지면 MAJOR+human**이다. 구조화된 trigger/exclusion/tag만 바뀌면 MINOR, capability/scope/risk/resource 변경은 MAJOR다. 실제 내용이 전부 동일한 version bookkeeping만 PATCH다. 잘못된 risk/capability enum 및 다른 scope는 stage 단계에서 거부한다.
5. evaluation proof의 static/security/secret_scan/permission/reproducible 5종과 과거 Run replay 1개 이상을 확인한다. 모든 활성화는 서로 다른 pilot case 3개 이상, 동일 candidate/baseline hash, PASS, 품질/precision/recall 비하락, 비용 비증가, regression/permission drift 없음이 필요하다. 같은 pilot ID 재등록은 3개로 부풀려지지 않는다.
6. 신규/CREATE, SPLIT, MERGE, ARCHIVE 및 위험 확대는 사람 승인만 가능하다. approve/activate는 현재 host approval의 target/evaluation/actor/context/hash와 반개방 validity를 재검증하고 revoke/stale/replay를 거부한다.
7. trusted_auto는 이미 ACTIVE D-07 before-version에 대한 사전 host policy가 있을 때만 가능하다. R1에서 description/body 자연어 변경을 모두 제외했으며 현재 DTO에는 안전하게 자동 변경할 다른 구조화 delta가 없어 **내용 불변 version bookkeeping PATCH만** 허용한다. 자연어 비확장을 regex로 증명했다고 주장하지 않는다. observe_only/review_required 및 모든 실제 내용 변경은 사람 승인 없이는 활성화하지 않는다.
8. activation은 touched head 전체를 compare-and-swap하며 경쟁 후보의 이중 교체와 replay 의미 변경을 거부한다. D-08 version hash ledger는 rollback으로 지우지 않아 같은 Skill ID/version에 다른 내용을 재사용할 수 없다.
9. `capture_run_start`는 실제 D-02 immutable Task/Run snapshot과 host clock을 결박한 identity capability다. activation 이후 시작한 Run만, 시작 후 5초 미만 window에서 1회 선택한다. 역기록/늦은 호출/forged DTO/다른 hash를 거부하고 실제 host 관측 시각을 기록한다. snapshot 내용은 수정하지 않는다.
10. source revoke/quarantine은 D-06 current source guard를 통해 새 평가·활성화·선택을 차단한다. rollback은 이전 immutable head snapshot을 복구하고 영향을 받은 Run, 반례 target, 실패 evidence를 남긴다. archive는 version/head sidecar 변경이며 물리적 삭제가 아니다. 기존 selection/audit은 보존한다.

## 3. 조치

### 변경 경로·diff·hash

| 경로 | 이번 변경 | 최종 SHA256 |
|---|---|---|
| `packages/knowledge/__init__.py` | D-01~D-07 export 보존, D-08 import/export 2행 추가 | `EB20E4D26961041FEDC633988B803DDE6E78F4D61AA8A46ED5F4AA692B52F922` |
| `packages/knowledge/skill_evolution.py` | 신규 587행: evolution/host evidence/approval/trust/version/head/next-run/rollback, R2 의미 추론 제거 | `D4CC114DB144B6BAAD22FB42D81CC5FCD09B6DF03ADE7DA20232B82D6622E13D` |
| `packages/api/skill_evolution.py` | 신규 36행: authenticated host-context API adapter | `E415861D0C54D19C339E187F9E87A314D00C77E0A46E7326A25E73AD70A1F302` |
| `tests/knowledge/test_skill_evolution_d08.py` | 신규 591행: domain lifecycle·적대·동시성, R2 자연어 exact-delta 검증 | `80CBDEBC22B58408A9FD12E4F323559F8F02BB7FBD8CD656DD7787BB91F78055` |
| `tests/api/test_skill_evolution_d08.py` | 신규 47행: API 입력 권한·projection, pilot 원문 권한 주입 거부 | `3C07BBB336F7AEA77363222B41919230E64A33A4B6D643DD25A2C659E93E06F4` |
| `docs/04_test_reports/D-08_COMPLETION_REPORT.md` | 신규: 이번 결과 증거·경계·rollback | Main 수집 |

기존 D-07 `skills.py` hash `B6605F08A5E2C3D0C1E5740EFCD366CB1A48C1B21A24B721BB80A33EE91BF275`, D-06 `candidates.py` hash `03AFB243EA2F4B93959273DA6B4868CC09C6AB263D598B4630CEB8C0EB057DC6`를 최종에 재확인했다. 두 파일은 이번 scope 밖이며 수정하지 않았다.

### 정확한 명령·exit·RED/GREEN

모든 명령 cwd는 위 격리 clone이다. 테스트 경로의 동일 basename 충돌을 피하기 위해 기존 D-07과 동일하게 `--import-mode=importlib`를 명시했다. 설정 파일은 수정하지 않았다.

```powershell
& D:/tmp/anvil-main-integration/.venv/Scripts/python.exe -B -m pytest -q -p no:cacheprovider --import-mode=importlib tests/knowledge/test_skill_evolution_d08.py tests/api/test_skill_evolution_d08.py --tb=no
```

- 최초 RED: **exit 1, 39 failed in 1.37s**. `D08_EVOLUTION_MISSING` / `D08_API_MISSING` fingerprint. 제품 파일 구현 전 테스트를 추가·실행했다.

```powershell
& D:/tmp/anvil-main-integration/.venv/Scripts/python.exe -B -m pytest -q -p no:cacheprovider --import-mode=importlib tests/knowledge/test_skill_evolution_d08.py tests/api/test_skill_evolution_d08.py --tb=short
```

- 최초 GREEN: exit 0, **39 passed in 1.41s**.
- 보강 RED: exit 1, **3 failed / 50 passed in 1.80s**. 실제 결함은 기존 Skill before 누락 CREATE 허용 및 unknown risk/capability 허용 2건이다. 나머지 1건은 30분 늦은 Run 검사가 더 먼저 만료된 evidence를 `EVOLUTION_ATTESTATION_STALE`로 거부한 정상 동작과 테스트 expected reason 불일치였다. 제품 차단을 완화하지 않고 expected reason을 실제 선행 guard에 맞췄다.
- 보강 GREEN: exit 0, **53 passed in 1.84s**.

```powershell
& D:/tmp/anvil-main-integration/.venv/Scripts/python.exe -B -m pytest -q -p no:cacheprovider --import-mode=importlib tests/knowledge/test_skill_evolution_d08.py -k 'same_version_number or two_staged' --tb=short
```

- immutable version RED: exit 1, **1 failed / 1 passed / 45 deselected in 0.31s**. fingerprint `EVOLUTION_VERSION_REBOUND_NOT_REJECTED`. rollback 뒤 같은 ID/version에 다른 내용을 활성화하는 경로를 재현했고 append-only version hash ledger로 수정했다. 실제 두 승인 후보의 head CAS 경쟁도 검증했다.
- 위 focused 전체 명령 최종 재실행: **exit 0, 54 passed in 1.73s**.

```powershell
& D:/tmp/anvil-main-integration/.venv/Scripts/python.exe -B -m pytest -q -p no:cacheprovider --import-mode=importlib tests/knowledge tests/api --tb=short
```

- 중간 회귀: exit 0, **1448 passed in 9.20s**.
- 최종 회귀: **exit 0, 1449 passed in 9.66s**. D-01~D-07 및 기존 knowledge/API 포함. 이 범위 내 fail/skip 0.

```powershell
& D:/tmp/anvil-main-integration/.venv/Scripts/python.exe -B -m compileall -q packages/knowledge packages/api tests/knowledge tests/api
git diff --check
```

- 각각 **exit 0**. `COMPILEALL_EXIT=0`, `DIFF_CHECK_EXIT=0`을 별도 출력으로 확인했다.
- 신규 untracked 파일은 일반 diff-check에서 빠지므로 exact6 각각 아래 명령을 수행했다. NUL 대비 파일 내용 차이로 각 exit 1이며 **whitespace diagnostic 출력은 없음**. 마지막 tracked diff-check exit 0.

```powershell
$d08Paths=@('packages/knowledge/__init__.py','packages/knowledge/skill_evolution.py','packages/api/skill_evolution.py','tests/knowledge/test_skill_evolution_d08.py','tests/api/test_skill_evolution_d08.py','docs/04_test_reports/D-08_COMPLETION_REPORT.md')
foreach ($d08Path in $d08Paths) {
    $d08Output=git diff --no-index --check -- NUL $d08Path 2>&1
    $d08Exit=$LASTEXITCODE
    [pscustomobject]@{Path=$d08Path;Exit=$d08Exit;Output=($d08Output -join [Environment]::NewLine)} | ConvertTo-Json -Compress
}
git diff --check
```

### 오류 횟수·미검증·잔여 위험

- 최종 미해결 focused/관련 테스트 실패 0. 최초 RED 39, 보강 제품 결함 RED 2+1, expected reason 교정 1은 구현 중 증거이며 정식 FAILURE_REPORT를 선언하지 않았다. 오류 count/control 판정은 Main 소유다.
- Git status read-only 조회에서 global ignore 접근 권한 경고 2회가 있었고 status 출력은 정상 반환됐다. 권한 변경/escalation은 하지 않았다.
- replay/3+ pilot은 **host-captured synthetic evidence contract와 실제 in-memory validator 검증**이다. 실제 sandbox process나 대표 작업을 실행해 수집한 운영 evidence가 아니다. 실제 pilot 실행/증거 수집과 사람 이벤트 인증은 host의 후속 책임이다.
- D-08 자체 evolution sidecar의 next-run/rollback을 검증했으며 **D-07 loader나 D-02 source_versions에 삽입하지 않았다**. 따라서 evolved Skill 소비·화면·process 재시작 persistence·D-Skill Gate 실제 runtime 통합은 미검증이다.
- 현재 before adapter는 실제 D-07에 materialize된 immutable version을 받는다. D-08 sidecar version을 다시 D-07에 승격하거나 이후 진화 chain의 runtime consumer로 연결하는 작업은 이번 exact6 밖이다.
- R1 trusted_auto는 실제 내용 변경을 전혀 자동 승인하지 않는다. 자연어 의미 동등성은 검증할 수 없으므로 description/body 변경을 사람 승인으로 보낸다. 구조화된 추가 auto delta를 후속 승인 없이 임의로 도입하지 않는다.
- C-01 snapshot baseline fail/실제 DB skip는 이번 knowledge/API 명령 범위가 아니므로 결과를 개선했다거나 PASS라고 표시하지 않는다.
- TDD·검증 스킬에 따라 RED 및 최종 command evidence를 확인했다. Main 승인 내부 계획을 따랐으며 reviewer agent를 추가 생성하거나 Git에 통합하지 않았다.

### Rollback·다음 조치

- Main이 이번 exact6 diff를 보존한 뒤 D-08 신규 파일 다섯 개와 `__init__.py` D-08 import/export 2행만 되돌릴 수 있다. **지금 rollback을 실행하지 않았다.** 기존 dirty/untracked D-01~D-07/control 파일은 reset/stash/delete 대상으로 삼지 않는다.
- 실제 filesystem pending dir/DB/Hook/runtime mutation이 없으므로 운영 rollback 대상은 없다. domain rollback은 immutable previous head snapshot과 affected Run/counterexample evidence를 보존한다.
- 다음 조치: Main 독립 Spec/Quality 검토와 acceptance/control 갱신. progress/HANDOFF는 Main 소유로 미갱신이며 D-Skill Gate나 다음 Package를 이 writer가 자동 개시하지 않는다.

## 4. R1 독립 리뷰 재작업 — 현재 판정

### 판정

**COMPLETED**. 독립 리뷰 Blocking 4건을 각각 RED로 재현하고 수정했다. 최초 54개 테스트를 삭제하지 않았으며 잘못된 자연어 auto/Procedure PATCH positive fixture는 승인 계약에 맞게 교정했다. 최종 **83 focused / 1478 knowledge+API PASS**, compileall/diff-check exit 0. Main의 재리뷰/ACCEPTED는 아직 별도다.

### 판단 이유

1. `NATURAL_LANGUAGE_TRUSTED_AUTO_EXPANSION`: description/body 변경은 단어 blacklist로 비확장을 증명할 수 없어 **모든 자연어 delta를 trusted_auto에서 제외**했다. 현재 schema의 자동 경로는 내용이 완전히 동일한 기존 version bookkeeping뿐이다. 새 Skill, 구조 변경, 내용 변경은 사람 승인이다.
2. `BODY_CONTRACT_CHANGE_MISCLASSIFIED_PATCH`: Markdown `#`~`######` 구조를 기준으로 section을 분석한다. Procedure/Input/Output/Result/Contract/Permission/Capability, unknown/duplicate/ambiguous 변경을 MAJOR로 처리한다. description/Pitfalls/Verification이라도 계약 의미 keyword가 드러나는 변경은 MAJOR이며, PATCH로 분류된 자연어 보완 역시 human-only다.
3. `D07_MATERIALIZATION_CREATE_TOCTOU`: stage 이후 동일 이름의 D-07 materialization이 추가되어도 CREATE가 활성화되는 문제를 재현했다. activate 및 현재 activation 사용 시 touched ID 전체의 **현재 D-07 materialized reference 집합과 exact skill ID/version/hash/activation ID**를 다시 읽는다. before가 없는 새 ID는 현재 catalog에 존재하면 거부하고, PATCH/SPLIT/MERGE/ARCHIVE before는 현재 ACTIVE D-06/D-07 및 pinned document와 대조한다. 기존 sidecar head CAS와 동일 lock 안에서 검사한다.
4. `PILOT_CASE_ALIAS_REUSES_TASK_EVIDENCE`: case_id만 바꾸어 같은 evidence를 3회 count하는 문제를 재현했다. proposal capture에 최소 3개의 immutable representative manifest `{task_id, content_hash, input_hash}`를 요구하고 그 목록을 후보 content hash에 포함했다. pilot은 exact `task_ref`와 `run_ref {run_id, content_hash}`, `evidence_ref/evidence_hash`를 추가 결박한다. case/task ID/task hash/input hash/run ID/run hash/evidence ID/evidence hash 중 하나라도 다른 pilot과 재사용되면 거부한다. 평가 시에도 distinctness와 proposal membership를 다시 검사한다. 단순 문자열 task 2개는 더 이상 유효한 proposal capture가 아니다.

### 조치 및 명령 증거

- R1 시작 host: `2026-09-16T19:00:57+09:00`. 같은 seq1002, 동일 epoch-1 dual lease/token 및 exact6를 재확인했고 발효·미만료였다.
- 최종 host: `2026-09-16T19:07:05+09:00`. HEAD/branch 및 ACTIVE lease, canonical seq1002 유지 확인. D-06/D-07 제품 hash도 위 보존 값과 동일하다.

```powershell
& D:/tmp/anvil-main-integration/.venv/Scripts/python.exe -B -m pytest -q -p no:cacheprovider --import-mode=importlib tests/knowledge/test_skill_evolution_d08.py -k r1 --tb=short
```

- 수정 전 **exit 1, 13 failed / 47 deselected in 0.62s**. 자연어 auto 2, 계약 섹션 8, CREATE TOCTOU 1, proposal 대표 task 부족 1, pilot evidence alias 1을 각각 확인했다. 정식 반복 실패 count는 Main 소유로 미갱신이다.

```powershell
& D:/tmp/anvil-main-integration/.venv/Scripts/python.exe -B -m pytest -q -p no:cacheprovider --import-mode=importlib tests/knowledge/test_skill_evolution_d08.py tests/api/test_skill_evolution_d08.py --tb=short
```

- 첫 GREEN **exit 0, 67 passed in 2.36s**.
- 전 alias·before action·API 주입 보강 후 최종 **exit 0, 83 passed in 2.47s**.
- 검증에는 각 task/run/input/evidence alias, manifest 자체의 duplicate ID/hash/input, 같은 이름의 새 D-07 Skill 추가, 모든 before action에서 stage 후 D-07 current version 변경, exact version-only auto positive가 포함된다.

```powershell
& D:/tmp/anvil-main-integration/.venv/Scripts/python.exe -B -m pytest -q -p no:cacheprovider --import-mode=importlib tests/knowledge tests/api --tb=short
& D:/tmp/anvil-main-integration/.venv/Scripts/python.exe -B -m compileall -q packages/knowledge packages/api tests/knowledge tests/api
git diff --check
```

- 회귀 **exit 0, 1478 passed in 10.77s**. compileall 및 tracked diff-check 각각 **exit 0**.
- 위 exact6 no-index whitespace 명령을 R1 보고서 저장 뒤 재실행했다. 각 exit 1은 NUL 대비 내용 차이이며 whitespace diagnostic은 없다. 마지막 git diff-check exit 0.
- R1 수정은 `packages/knowledge/skill_evolution.py`, 두 D-08 테스트 및 이 보고서 4개다. 다른 exact6 파일의 기존 내용을 보존하고 scope 밖/Git/control mutation은 하지 않았다.
- **D-07 consumer NOT_INTEGRATED**, 실제 pilot 실행/증거 획득/HTTP/DB/Hook/filesystem/배포 NOT_EXECUTED 경계는 그대로다. 이 결과는 in-memory 독립 evidence identity 검사이며 실제 task 입력이나 evidence bytes를 외부에서 수집·인증했다는 주장은 아니다.
- rollback은 Main이 R1 이전 diff를 보존한 뒤 이 네 파일의 R1 delta만 복구할 수 있으나 **취약한 R0 상태를 복원해 운용하지 말아야 한다**. 실제 rollback은 수행하지 않았다. 초기 전체 D-08 rollback 경계도 위와 동일하다.

## 5. R2 의미 판별 제거 — 최신 판정

### 판정

**COMPLETED**. R1에서 남은 `# Verification`의 `Keep the result.` → `Emit YAML rather than JSON.` 변경이 PATCH로 분류되는 결함을 재현했다. 자연어 keyword/blacklist 및 Markdown section parser를 제거했다. 기존 83건을 유지하고 21건을 추가하여 최종 **104 focused / 1499 관련 회귀 PASS**, compileall/diff-check exit 0이다.

### 판단 이유

- 현재 schema에는 계약 의미 fingerprint가 없으므로 description/body 원문 exact equality 외에는 비확장을 증명할 수 없다. 이제 description/body의 한 글자·문장부호·공백 변화도 무조건 MAJOR+human이다. 동의어·영어·한국어·일본어·base64·percent encoding·형식/행위 표현에 대한 예외가 없다.
- tags/triggers/exclusions만 바뀌고 description/body 등이 그대로인 경우 MINOR를 유지한다. capability/scope/risk/resources 변경은 MAJOR다. 내용 불변 version bookkeeping만 PATCH/trusted_auto를 허용한다.
- 기존 trigger-only fixture는 본문 Pitfalls 추가까지 동시에 수행하던 상태였으므로 내용 불변 baseline에서 trigger만 바꾸도록 교정했다. 본문 변경을 숨기거나 MAJOR guard를 완화하지 않았다.

### 조치와 검증

- R2 시작 host `2026-09-16T19:14:44+09:00`, 종료 검증 `2026-09-16T19:16:33+09:00`. 같은 seq1002/epoch-1 ACTIVE dual lease와 exact6를 재확인했다. HEAD `a3fa3ed09cd6998b234458b5283abafa0f222f88` 불변.
- 변경은 `packages/knowledge/skill_evolution.py`, `tests/knowledge/test_skill_evolution_d08.py`, 이 보고서 3개뿐이다. API/기존 D-07 consumer/control/Git은 무수정이다.

```powershell
& D:/tmp/anvil-main-integration/.venv/Scripts/python.exe -B -m pytest -q -p no:cacheprovider --import-mode=importlib tests/knowledge/test_skill_evolution_d08.py -k r2 --tb=short
```

- 수정 전 RED **exit 1, 16 failed / 5 passed / 75 deselected in 0.80s**. fingerprint `NATURAL_LANGUAGE_CONTRACT_DELTA_MISCLASSIFIED_PATCH`. 두 언어/인코딩/동의어 body·description 변형이 PATCH로 남는 실제 동작을 확인했다. 기존 keyword에 걸리던 2건과 구조화 metadata-only 3건은 이미 PASS였다.

```powershell
& D:/tmp/anvil-main-integration/.venv/Scripts/python.exe -B -m pytest -q -p no:cacheprovider --import-mode=importlib tests/knowledge/test_skill_evolution_d08.py tests/api/test_skill_evolution_d08.py --tb=short
& D:/tmp/anvil-main-integration/.venv/Scripts/python.exe -B -m pytest -q -p no:cacheprovider --import-mode=importlib tests/knowledge tests/api --tb=short
& D:/tmp/anvil-main-integration/.venv/Scripts/python.exe -B -m compileall -q packages/knowledge packages/api tests/knowledge tests/api
git diff --check
```

- focused **exit 0, 104 passed in 2.71s**.
- 관련 회귀 **exit 0, 1499 passed in 10.48s**.
- compileall 및 tracked diff-check 각각 **exit 0**. 본 보고서 저장 후 위 exact6 no-index whitespace 검사도 재실행했으며 각 exit 1은 NUL 대비 내용 차이이고 diagnostic 출력은 없다.
- 최종 미해결 focused/회귀 실패 0. 정식 실패 ledger/progress는 Main 소유로 미갱신이다.
- D-07 consumer **NOT_INTEGRATED**, 실제 pilot/Hook/filesystem/DB/HTTP/배포 **NOT_EXECUTED** 경계는 유지한다. 결과는 synthetic host evidence contract 검증이며 운영 실증이 아니다.
- rollback은 R2 diff 보존 후 이 세 파일만 복구 가능한 경계다. **취약한 이전 의미 추론을 운용 목적으로 재활성화하지 않는다.** 실제 rollback/commit/push는 수행하지 않았다. Main의 독립 재검토를 요청한다.
