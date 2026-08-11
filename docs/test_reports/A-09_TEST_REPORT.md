# A-09 독립 Tester 검증 보고서

## 판정

`PASS_STATIC_CONTRACT / READY_FOR_MAIN_ACCEPTANCE`

- package: `A-09`
- assigned verification: `AV-LRN-018`, `AV-LRN-024`의 A-09 정적 계약 slice
- blocking finding: `0`
- canonical L4 / AE / MX / E-SHOT / E-AUD: `RUNTIME_DEFERRED / NOT_EXECUTED`
- actual Skill activation / Hook activation / Run / API / DB / Event / Browser / Network / Docker / DIR: `NOT_EXECUTED`
- Main acceptance: 아직 미실행
- A-10: Main acceptance 전까지 `BLOCKED_PENDING_A09_ACCEPTANCE`
- 기능 범위·요구사항·중요 위험 변경: 없음

## 판단 이유

A-09는 LearningSource의 provenance·hash·license·confidentiality·scan·revoke와 candidate→evaluation→approval→activation→applied→rollback을 분리하며, activation은 현재 actual Run이 아닌 다음 immutable snapshot부터 적용하도록 고정한다. revoked source와 미검증 positive exemplar의 신규 사용은 fail-closed로 차단하고 영향 Run은 격리·보고하도록 한다.

Skill은 `DRAFT→PILOT→ACTIVE→DEPRECATED→ARCHIVED`, 서로 다른 대표 작업 3개 pilot, reproducibility, permission/secret scan, 사람 승인을 요구한다. Selection Trace에는 matched evidence, 선택 version/hash와 reason, rejected candidates, resources, precondition/result을 남기고 L0→선택된 L1 전체 SKILL→필요 시 L2 reference의 progressive disclosure만 허용한다.

Hook은 `Event→Matcher→Program→Result/Fault Policy`의 versioned deterministic 계약이다. definition hash trust와 program hash/permission profile/principal trust를 각각 결박하고 hash 변경 시 trust를 무효화한다. shadow 무부작용, pilot replay, 모든 matching hook 평가, `deny>ask>modify>allow`, modify conflict 차단, timeout policy 노출, recursion depth 1, Hook의 Subagent spawn 금지를 확인했다. AgentDefinition은 parent의 `inherit_and_narrow`만 허용하며 persistent memory 기본값은 `none`이다.

## 기준선과 독립 hash

| artifact | SHA-256 |
|---|---|
| Git HEAD / origin/main | `E03F65F0C18E21847C99B2572E6BD5762D33C8F9` |
| WorkInstruction | `5BB6F711EB22B8AF776CD04F5E51004B3DACB58D47B8E822BF55854650D152AC` |
| InvocationPrompt | `539CD665C1194D8735AB118E84710C4F86F42CA0D4FE7E45DC93BC39BA479C7F` |
| Developer evidence manifest | `A917008E376E34F51BFADE8E74FE1B6E065D7FDBAC79C748D3DC0424A4E23EA3` |
| Developer target / delivered | `915B377C6390405664E8A2685DC502A65FE6305D8F327C80A46EFF457C4D4AA3` |
| Completion progress manifest file | `6BD9043B438FE1746DC9930807BA5B5315CA64580DA6B6C832961D839A66F996` |
| Completion progress target / delivered | `343F9CDEE850C04BCB60AC470E79AF52A8FF001DD929491C7D339CE6292F0104` |
| CompletionReport | `CBB57AECCF510876BA1B907624A2B52C6F7141E469D6FC6CFED9DEC9D039AB19` |

- 검증 진입 시 `main = origin/main`, worktree clean, progress sequence `112`, `A-09 / TEST_REVIEW / COMPLETED / accepted=false`, active agent/worker lease/write lease 모두 `null`이었다.
- Developer manifest의 raw artifact `15/15` byte/hash와 target canonical bytes `2024`, content bytes `47739`, target/delivered를 확인했다. manifest는 self-reference가 `false`다.
- Completion manifest raw checksum `5/5`, target/delivered, self-reference `false`를 확인했다.
- catalog의 accepted predecessor binding `A-01~A-08`은 `8/8` 실제 hash가 일치했다.
- completion base `f7969b49784945807521f430ada1cf96adc2ae4f..HEAD`의 변경 경로 `27개`가 completion manifest exact allowlist `27개`와 정확히 일치했다. `git diff --check`는 exit `0`이었다.

## 독립 hostile mutation

Developer fixture의 `44`개 hostile mutation을 fresh tooling test에서 실행해 모두 기대 stable reason으로 fail-closed됨을 확인했다.

| 보호 경계 | 관찰 stable reason |
|---|---|
| source provenance, revoke, unverified exemplar | `SOURCE_PROVENANCE_REVOKE_MISMATCH` |
| candidate/evaluation/activation/applied, immutable snapshot, rollback | `LEARNING_LIFECYCLE_SNAPSHOT_MISMATCH` |
| Skill lifecycle, 3 pilot, 선택 근거, progressive disclosure | `SKILL_PILOT_SELECTION_DISCLOSURE_MISMATCH` |
| Hook contract/hash trust/shadow/pilot/replay | `HOOK_TRUST_SHADOW_PILOT_MISMATCH` |
| timeout, permission, recursion, precedence/modify conflict | `HOOK_SAFETY_PRECEDENCE_MISMATCH` |
| Agent permission expansion, persistent memory, Hook spawn | `AGENT_PERMISSION_BOUNDARY_MISMATCH` |
| secret/credential/internal endpoint disclosure | `SENSITIVE_DISCLOSURE_FORBIDDEN` |
| static-to-runtime promotion | `VERIFICATION_CONTRACT_MISMATCH` |
| raw manifest/hash/self-reference bypass | `EVIDENCE_RAW_HASH_MISMATCH`, `EVIDENCE_SELF_REFERENCE_FORBIDDEN` |

## fresh 전체 검증

```powershell
$env:PYTHONDONTWRITEBYTECODE='1'
C:\Users\cyhuh\anaconda3\python.exe -m unittest discover -s tests/tooling -p 'test_*.py'
C:\Users\cyhuh\anaconda3\python.exe scripts/check_a09_learning_automation.py --root . --json
C:\Users\cyhuh\anaconda3\python.exe scripts/check_project_progress.py .
C:\Users\cyhuh\anaconda3\python.exe scripts/check_g07_baseline.py .
C:\Users\cyhuh\anaconda3\python.exe scripts/check_phase_g_gate.py .
git diff --check
```

- full tooling: exit `0`, `216/216 PASS`, `Ran 216 tests in 56.194s`.
- A-09 checker: exit `0`, `PASS`, errors `[]`.
- project-progress checker: exit `0`, `PASS`, sequence `112`, reporting `AUTO_CONTINUE`.
- G-07 checker: exit `0`, packages `97`, AV `255`, uncovered `0`, scenarios `20`.
- Phase G Gate checker: exit `0`, accepted `7`, decisions `10`, packages `97`, AV `255`, scenarios `20`, sync `7`.
- `git diff --check`: exit `0`.

초기 checker 실행에서 지원하지 않는 `--json`/`--root` 인자를 사용해 project/G-07/Phase-G checker가 exit `1/2/2`를 반환했다. CLI 도움말과 source를 읽어 원인을 확인했고, 위의 해당 checker 공식 positional-root 형식으로 재실행해 모두 exit `0`이었다. 제품·checker 산출물 변경은 없었으므로 정식 `FAILURE_REPORT` 또는 blocking finding으로 집계하지 않는다.

## 정적 계약과 미실행 범위

- A-09 `STATIC_ONLY / STATIC_CONTRACT_PASS` slice만 PASS다.
- `AV-LRN-018`, `AV-LRN-024` 실제 L4/AE/MX/E-SHOT/E-AUD 검증은 D-12 owner의 runtime 범위이며 수행하지 않았다.
- 실제 Skill/Hook 설치·활성·실행, source revoke의 실제 Run 격리, API, DB, Event, Browser, Network, Docker, WSL/server, deployment, release, DIR은 `NOT_EXECUTED`다.
- 정적 Markdown/SVG/catalog/fixture 또는 mutation test를 runtime·운영·사용자 기능 PASS로 승격하지 않는다.

## 조치

Main Agent는 이 독립 Tester evidence를 fresh 검토한 뒤에만 A-09 최종 수락 여부를 판정할 수 있다. Tester는 `ACCEPTED`, progress/HANDOFF 갱신, commit/push 또는 A-10 착수를 수행하지 않았다. Tester workspace write는 본 보고서 한 파일뿐이다.
