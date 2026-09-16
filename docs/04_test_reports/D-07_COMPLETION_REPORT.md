# D-07 완료보고

## 1. 판정

- 결과 계약: `COMPLETED` — developer-primary-d07-r1의 지정 구현·기본 검증 완료. Main 독립 검토/ACCEPTED와 다르다.
- 범위: D-06 정본 next-run selection에 결박된 Skill materialization, L0 catalog/match, 선택 후 전체 L1, 명시 exact L2, 사용 계보.
- focused: **80 passed**, 관련 `tests/knowledge tests/api`: **1386 passed**. compileall 및 tracked diff-check exit 0.
- 외부 filesystem Skill 읽기, script 실행, DB/HTTP/browser/Provider/network/queue/Run orchestration/deployment는 실행하지 않았다.
- Main 소유 WI/control/progress/HANDOFF는 수정하지 않았다. Git stage/commit/push 없음. D-08 시작 없음.

## 2. 판단 이유

### 기준선·소유권

- 작업 디렉터리: `D:\Project\Anvil\.codex-sandbox\anvil-main-integration`. 원본 `D:\tmp\anvil-main-integration` 제품 파일은 건드리지 않았다. 기존 venv Python 실행 파일만 사용했다.
- 시작/종료 HEAD: `a3fa3ed09cd6998b234458b5283abafa0f222f88`; branch: `codex/c09-execution-backends-r1`.
- 시작 상태는 기존 C-13~C-15와 Main control의 tracked dirty 26개 및 D-01~D-06/control untracked가 있는 보호 상태였다. clean으로 간주하지 않았다. 이번 변화는 아래 exact6뿐이다.
- canonical D-07 start event sequence: **993**, IN_PROGRESS. 종료 전 read-only 재확인에서도 D-07 start sequence 993 및 동일 ACTIVE dual lease를 확인했다.
- WI SHA256: `3D58AC1539351CE31CD5D41216BC4E72E9B1F59825ACD775B8EA047A9FD2EF50`.
- Invocation SHA256: `D809C5D8ABA3FDAA740C4EAAAD2C87A0418BB929B331F46213C77AF64D606A80`.
- Design SHA256: `DC7509CB76A4BF08A0AE4D6F802FFB747B670FAB93426D5636B14575F7BEF9A3`.
- Work plan SHA256: `00F4B03E5C6A82D50268025A87EB86FAC52815D675B54216D7B69B5BD220DD18`.
- Matrix SHA256: `289933C795F689AF3AF3E44F48B563580EF1B5D9E266AD5583490EDBCABC3DB5`.
- Test plan SHA256: `9C288947F6F77AADDF73ED150EC449B71BE7D1981358A71EA211687B6A75D644`.
- Worker: `worker-lease-d07-r1-20260916-001`; execution fence: `d07-r1-execution-fence-epoch-1-a3fa3ed09cd6998b`.
- Write: `write-lease-d07-r1-20260916-001`; write fence: `d07-r1-write-fence-epoch-1-234458b5283abafa`.
- 양 lease 유효기간: `2026-09-16T12:16:34+09:00` 이상, `2026-09-17T00:16:34+09:00` 미만. 시작 확인 및 종료 전 `2026-09-16T12:37:43+09:00`에 발효·미만료·정확한 path_scope와 token을 대조했다. 토큰은 제품 DTO 입력 권한으로 전용하지 않았다.

### 구현 판단 및 검증 계약

1. D-06 artifact는 Skill 본문 hash를 직접 표현하지 않으므로 Main의 명시적 구현 판단에 따라 **host-only `capture_materialization`** adapter를 둔다. D-06 activation ID/version/hash, exact selection ID/hash, candidate/review/action selector, source provenance, actor/context/scope/expiry, exact Skill manifest/body/L2 hash를 결박한다. name/skill_id는 승인 target_id와 일치하고 version/risk/capabilities도 실제 activation과 일치해야 한다. API에는 capture/create/activate/approve/execute를 노출하지 않는다.
2. Host가 승인 candidate action/target에 해당하는 bytes를 실제로 검증했다는 것이 이 in-memory adapter의 신뢰 전제다. 단순 API payload나 client가 새 승인/활성화를 부여할 수 없다. 동일 ACTIVE activation의 다른 내용은 유효 중·만료 후 모두 rebind 거부한다. 만료 후 동일 materialization 재발급은 허용하되 오래된 시각 및 이전 invocation capture는 stale이다.
3. L0에 body/L2 content를 싣지 않는다. metadata 항목을 정렬하고 전체 응답의 UTF-8 bytes/4 올림을 사용하는 결정론적 token 상당 예산 2,000 이하로 자른다. `truncated/omitted_count/token_count`로 표시한다. Provider tokenizer 실측은 아니다.
4. Matcher는 scope/trigger/exclusion을 함께 검증하고 exclusion 우선, LOW + READ-only + script/policy 없음만 implicit 허용한다. HIGH/MEDIUM, WRITE/NETWORK/SECRET/EXECUTE 및 script는 implicit 거부한다. explicit 선택은 콘텐츠 읽기 허용일 뿐 capability 실행이나 별도 권한을 부여하지 않는다.
5. L1은 선택 invocation 이후 전체 `SKILL.md` body/hash를 반환하고 이때 D-06 실제 사용 계보를 기록한다. 선택 전 L1, L1 전 L2/use는 차단한다. L2는 본문의 단일 `anvil-resources` fenced JSON 배열이 선언한 exact path/kind/hash만 명시 로드한다. 이 manifest 표현은 본문 전체 hash에 포함되는 in-memory 계약이며 실제 파일 adapter/일반 Markdown resolver는 후속 범위다.
6. L2는 reference/script/example **문자열 조회만** 지원한다. traversal/절대/UNC/drive/device/ADS/percent alias, 경로 중복·case alias, 다른 hash/kind/미선언 형제 resource, 숨겨진 추가 content를 차단한다. script 실행은 없다.
7. 매 catalog/match/select/load/use에서 실제 D-06 current ACTIVE/source/selection을 다시 검증한다. revoke/rollback 뒤 신규 콘텐츠 및 사용을 막고 기존 audit을 보존한다. canonical storage는 JSON 문자열이며 반환 nested dict/list는 독립 immutable snapshot이다.
8. selection→L1→L2→사용 SUCCESS/FAILURE와 evidence, Task/Run/snapshot, 승인 activation/source 계보를 hash로 결박한다. 재시도·동시 요청은 canonical이고 다른 요청 의미의 request ID 재사용과 사용 결과 변조는 거부한다. 이미 소비한 event보다 과거 시각으로 load/use/다른 invocation을 추가할 수 없다.
9. `AV-LRN-015/016`은 위 실제 in-memory D-03~D-06 연결을 통해 검증했다. `AV-STAT-040` 관련 API adapter 재접속은 동일 host registry에서 pinned version/selection이 유지됨을 검증했지만 **process 재시작 persistence, Hook trust/Agent thread/lease/failure 복원 전체는 미검증**이다. D-10 등 후속 소유 범위를 이 보고서로 PASS 처리하지 않는다.

## 3. 조치

### 변경 파일과 diff

| 경로 | 이번 diff | 최종 SHA256 (보고서 자체 제외) |
|---|---|---|
| `packages/knowledge/__init__.py` | 기존 D-01~D-06 export 유지, SkillError/SkillRepository import 및 export 2행 추가 | `0EEE6ABF535CB1D4297A5213D07DF3E953888406EECF372ABF6991788A4192FA` |
| `packages/knowledge/skills.py` | 신규 409행: immutable host materialization, L0/L1/L2, canonical usage | `4D630CC3307223A3000CDA69D2450894CD364C0874DC34573C6887DE779E5E59` |
| `packages/api/skills.py` | 신규 38행: authenticated context adapter 6개 operation | `677B448D6117E36E9ACA19E699A9AE883241074B6CF3536C51E484A81DCE9BD6` |
| `tests/knowledge/test_skills_d07.py` | 신규 359행: 실제 in-memory lifecycle·적대·time/replay/concurrency 검증 | `47B60A15FDC9770003131E4DA7C5DECA218A9743E915D68C168E6BA787A15819` |
| `tests/api/test_skills_d07.py` | 신규 65행: API projection, 권한 미노출, 재접속·raw 오류 비노출 | `AD96D8B6DE5EA917EF8417BA414D8C04DA24AC5B940DE2734F34D99E6291FD3D` |
| `docs/04_test_reports/D-07_COMPLETION_REPORT.md` | 신규: 이번 증거·경계·rollback | 자체 hash는 Main 수집 |

기존 knowledge 제품 보존 hash: memory `D730F3FC46BA374895B87C03580C346772D095C039BD3690094891D53483D1F7`, snapshots `42B620BC1ADE951D9C9B22327A217BAA62C7C6806096D138DB02D0D86BDC848F`, sources `124DE0727753C6E8785B5E0DDE58F657769FF2F50EC4F030DF0A6BEFBF191121`, patterns `9AB92DC1FF5D565B6A58C67C7734B639CF737213D26A5EDA59D87F46AB8D290D`, reviews `67C0D58374300F25F14BAAC6257E71883C133AEDE80DEDC3A1442A33AA2EFE22`. D-06 candidates는 이번 writer에서 무수정이며 최종 `03AFB243EA2F4B93959273DA6B4868CC09C6AB263D598B4630CEB8C0EB057DC6`이다.

### 정확한 실행 명령과 실제 결과

모든 명령 cwd는 위 격리 clone이다. PowerShell에서 기존 venv Python 3.13.9를 직접 사용했다.

```powershell
& D:/tmp/anvil-main-integration/.venv/Scripts/python.exe -B -m pytest -q -p no:cacheprovider tests/knowledge/test_skills_d07.py tests/api/test_skills_d07.py --tb=short
```

- exit 1: **수집 오류 1건**, 두 허용 테스트의 동일 basename `test_skills_d07` 충돌. 제품 assertion 실패가 아니다. 파일 rename/control 설정 수정 없이 아래 명령의 import mode로 해결했다.

```powershell
& D:/tmp/anvil-main-integration/.venv/Scripts/python.exe -B -m pytest -q -p no:cacheprovider --import-mode=importlib tests/knowledge/test_skills_d07.py tests/api/test_skills_d07.py --tb=short
```

- 구현 전 RED: exit 1, **59 failed**, 2.10s. 명시 fingerprint `D07_PROGRESSIVE_SKILL_LOADER_MISSING` / `D07_SKILL_API_MISSING`.
- 최초 구현 후: exit 1, **1 failed / 58 passed**, 1.93s. 부정 fixture가 D-06에서 금지된 빈 activation selection을 만들려다 실패했다. 이후 다른 실제 activation fixture로 교정 중 proposal에 query 추가 field를 전달한 1 failed / 58 passed(2.18s)를 확인하고 exact proposal 필드만 사용하도록 고쳤다. 기존 D-06은 수정하지 않았다.
- 최초 GREEN: exit 0, **59 passed**, 1.67s.
- 추가 시간 역행 RED: exit 1, **4 failed / 76 passed**, 2.07s. fingerprint `SKILL_EVENT_TIME_REGRESSION_NOT_REJECTED`; L1 재조회/L2/use/새 선택 시점 역행이 허용된 동작을 확인했다.
- 최종 GREEN: exit 0, **80 passed**, 2.18s. exact current source/activation checks 및 event 시간 guard 적용 후 재실행.

```powershell
& D:/tmp/anvil-main-integration/.venv/Scripts/python.exe -B -m pytest -q -p no:cacheprovider --import-mode=importlib tests/knowledge tests/api --tb=short
```

- exit 0, **1386 passed**, 12.39s. D-01~D-06 및 기존 knowledge/API 회귀 포함. 이 명령 내 skipped/failed 0. C-01 snapshot baseline fail/DB skip는 이 명령 범위가 아니므로 다시 PASS라 주장하지 않는다.

```powershell
& D:/tmp/anvil-main-integration/.venv/Scripts/python.exe -B -m compileall -q packages/knowledge packages/api tests/knowledge tests/api
git diff --check
```

- 각각 exit 0. 최종 개별 exit 출력으로 `COMPILEALL_EXIT=0`, `DIFF_CHECK_EXIT=0` 확인했다.
- 새 untracked 파일은 일반 diff-check에서 빠지므로 exact6 각각 아래 검사를 추가했다. `git diff --no-index` exit 1은 NUL 대비 내용 차이가 있다는 뜻이며 diagnostic 출력은 없다.

```powershell
$d07Paths = @('packages/knowledge/__init__.py','packages/knowledge/skills.py','packages/api/skills.py','tests/knowledge/test_skills_d07.py','tests/api/test_skills_d07.py','docs/04_test_reports/D-07_COMPLETION_REPORT.md')
foreach ($d07Path in $d07Paths) {
    $d07Output = git diff --no-index --check -- NUL $d07Path 2>&1
    $d07Exit = $LASTEXITCODE
    [pscustomobject]@{Path=$d07Path;Exit=$d07Exit;Output=($d07Output -join [Environment]::NewLine)} | ConvertTo-Json -Compress
}
git diff --check
```

### 오류·미검증·잔여 위험

- 정식 실패보고 선언 없음. 의도된 RED 59 + 보강 RED 4는 test-first 증거다. 수집 오류 1건과 fixture 교정 실패 2건은 구현 중 진단이며 해결했다. 최종 미해결 focused/관련 실패 0건.
- `git status`에 사용자 global ignore 파일 접근 권한 경고 2회가 있었지만 command exit 0, 저장소 status 조회는 출력되었다. 권한 변경/escalation/설정 수정은 하지 않았다.
- host materialization의 실제 인증·승인 evidence 획득, 디스크 bytes authenticity, 일반 filesystem loader, 실제 session/process persistence, script 실행, runtime tool permission/egress enforcement는 이 in-memory 패키지가 증명하지 않는다. API 호출의 `now` 및 context는 실제 서버 adapter가 공급해야 하며 client JSON으로 받는 계약이 아니다.
- explicit 고위험 Skill의 **읽기**는 테스트했으나 실행 허가를 검증한 것이 아니다. 콘텐츠 ingestion은 신뢰된 host 경계이며 임의 생성 Skill을 활성화하거나 D-06 approval을 대체하지 않는다.
- 기본 pytest import mode는 승인된 동일 basename 경로 때문에 충돌한다. 재현 가능한 검증 명령에 `--import-mode=importlib`를 명시했다. exact6 밖 test configuration을 변경하지 않았다.
- 완료 전 재검증 스킬로 실제 command evidence를 확인했다. 리뷰 요청 스킬의 독립 검토 단계는 Main 담당 경계로 전달하며 developer는 agent를 추가 생성하지 않았다.

### Rollback 및 다음 조치

- Main이 이번 exact6 diff를 검토하고 보존한 후 D-07 신규 파일 다섯 개와 `__init__.py`의 D-07 import/export 두 행만 되돌리는 방식으로 복구할 수 있다. **현재 rollback을 실행하지 않았다.** 기존 untracked D-01~D-06이나 Main control을 일괄 삭제/reset/stash하지 않는다.
- 실제 runtime/DB/파일/배포 mutation이 없으므로 해당 운영 rollback 대상은 없다. in-memory audit은 process lifetime 경계이고 persistent migration은 없다.
- 다음 조치: Main의 독립 Spec/Quality 검토 및 acceptance/control 갱신. 본 writer는 progress/HANDOFF를 미갱신했으며 D-08/Git 작업을 시작하지 않는다.
