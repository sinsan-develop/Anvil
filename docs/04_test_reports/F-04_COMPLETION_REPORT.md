# F-04 Completion Report — GROQ adapter

## 판정

`COMPLETED`

- Work Package: `F-04`
- 역할: `developer-primary-f04-r1`
- branch: `codex/f04-groq-adapter`
- 시작 HEAD: `d1e35d6742066f4d1dc4798ddab83881fcaefedc`
- WorkInstruction SHA-256: `e104284c8b4739cc5daaa1f510f8b170d16ad76f22be3891f248ec9efb722b99`
- Invocation SHA-256: `205f405934cd862a4a8aef8d478c0762accdaec0c12ccfe3949ebc6032bef913`
- execution fencing token: `f04-r1-execution-fence-epoch-1-b53a53f9611e8fae`
- write fencing token: `f04-r1-write-fence-epoch-1-70d0ab2b9cd175f6`

## 판단 이유

주입형 fake transport만 사용해 GROQ의 OpenAI-compatible `generate`, `stream`, `health`,
`discovery` host adapter 계약을 구현했다. request ID replay/conflict, pre/post-send abort,
provider final usage, quota/error/retry-after, request ID 대조, credential-bearing response,
unknown/malformed response, non-finite JSON 및 stream terminal 순서를 fail-closed 처리한다.
receipt는 frozen value object와 canonical JSON 복제본으로 immutable·detached하게 보존한다.

TDD RED:

```text
$env:PYTHONPATH='.'; & 'D:\tmp\anvil-main-integration\.venv\Scripts\python.exe' -B -m pytest -q -p no:cacheprovider tests/providers/test_groq_adapter_f04.py --tb=short
exit 1
ERROR tests/providers/test_groq_adapter_f04.py
ModuleNotFoundError: No module named 'packages.providers.groq_adapter'
1 error in 0.18s
```

TDD GREEN / focused:

```text
$env:PYTHONPATH='.'; & 'D:\tmp\anvil-main-integration\.venv\Scripts\python.exe' -B -m pytest -q -p no:cacheprovider tests/providers/test_groq_adapter_f04.py --tb=short
exit 0
41 passed in 0.07s
```

관련 provider 회귀:

```text
$env:PYTHONPATH='.'; $base = Join-Path $env:TEMP 'anvil-f04-provider-regression'; & 'D:\tmp\anvil-main-integration\.venv\Scripts\python.exe' -B -m pytest -q -p no:cacheprovider --import-mode=importlib --basetemp=$base tests/providers tests/model_registry tests/provider_catalog tests/knowledge/test_model_registry_d11.py tests/budget tests/orchestration/test_delegation_packet.py tests/git_adapter --tb=short
exit 0
750 passed, 4 skipped in 11.98s
```

compile:

```text
& 'D:\tmp\anvil-main-integration\.venv\Scripts\python.exe' -B -c "from pathlib import Path; files=['packages/providers/groq_adapter.py','packages/providers/groq_models.py','packages/providers/groq_errors.py','tests/providers/test_groq_adapter_f04.py']; [compile(Path(p).read_text(encoding='utf-8'), p, 'exec') for p in files]; print('compile-ok', len(files))"
exit 0
compile-ok 4
```

diff/scope check:

```text
git diff --check; PowerShell exact5 status comparison and trailing-whitespace scan
exit 0
diff-check exact5-only; trailing-whitespace=0
```

추가 전체 bare suite 진단은 exit 1이었다. 변경 코드 실패가 아니라 수집 환경의 기존 의존성/fixture
문제로 6건이 중단되었다: `yaml` 미설치 1건, fixture repository의 `src` import 3건,
`httpx` 미설치 integration 2건. 이를 PASS로 승격하지 않는다.

```text
$env:PYTHONPATH='.'; $base = Join-Path $env:TEMP 'anvil-f04-full'; & 'D:\tmp\anvil-main-integration\.venv\Scripts\python.exe' -B -m pytest -q -p no:cacheprovider --import-mode=importlib --basetemp=$base --tb=short
exit 1
6 errors during collection in 10.30s
```

## 조치

### R1 독립 검토 재작업

독립 검토 판정 `CHANGES_REQUIRED C0/I2/M0`을 다음 두 정식 failure로 각각 1회 기록했다.

| failure fingerprint | 재현 | 수정 결과 |
|---|---|---|
| `F04-CANONICAL-PROVIDER-ID-v1` | uppercase provider가 전송까지 진행됨 | canonical lowercase `groq` 외 값은 transport 전 `PROVIDER_MISMATCH` |
| `F04-GROQ-WIRE-COMPAT-v1` | 정상 additive metadata, role-only delta, 별도 choices-empty usage terminal을 거부함 | 필수 필드는 유지하고 공식 additive metadata와 단일 최종 usage frame을 수용하며 후속 frame은 거부 |

R1 RED:

```text
$env:PYTHONPATH='.'; & 'D:\tmp\anvil-main-integration\.venv\Scripts\python.exe' -B -m pytest -q -p no:cacheprovider tests/providers/test_groq_adapter_f04.py --tb=short
exit 1
4 failed, 41 passed in 0.22s
```

공식 `include_usage` stream의 비종단 `usage: null` fixture를 추가한 두 번째 RED:

```text
$env:PYTHONPATH='.'; & 'D:\tmp\anvil-main-integration\.venv\Scripts\python.exe' -B -m pytest -q -p no:cacheprovider tests/providers/test_groq_adapter_f04.py::test_stream_accepts_role_delta_and_separate_terminal_usage_frame --tb=short
exit 1
1 failed in 0.10s
```

R1 GREEN / focused:

```text
$env:PYTHONPATH='.'; & 'D:\tmp\anvil-main-integration\.venv\Scripts\python.exe' -B -m pytest -q -p no:cacheprovider tests/providers/test_groq_adapter_f04.py --tb=short
exit 0
45 passed in 0.09s
```

R1 관련 회귀:

```text
$env:PYTHONPATH='.'; $base = Join-Path $env:TEMP 'anvil-f04-r1-provider-regression-final'; & 'D:\tmp\anvil-main-integration\.venv\Scripts\python.exe' -B -m pytest -q -p no:cacheprovider --import-mode=importlib --basetemp=$base tests/providers tests/model_registry tests/provider_catalog tests/knowledge/test_model_registry_d11.py tests/budget tests/orchestration/test_delegation_packet.py tests/git_adapter --tb=short
exit 0
754 passed, 4 skipped in 8.89s
```

R1 compile:

```text
& 'D:\tmp\anvil-main-integration\.venv\Scripts\python.exe' -B -c "from pathlib import Path; files=['packages/providers/groq_adapter.py','packages/providers/groq_models.py','packages/providers/groq_errors.py','tests/providers/test_groq_adapter_f04.py']; [compile(Path(p).read_text(encoding='utf-8'), p, 'exec') for p in files]; print('compile-ok', len(files))"
exit 0
compile-ok 4
```

R1 diff/scope check:

```text
git diff --check; PowerShell exact5 status comparison and trailing-whitespace scan
exit 0
diff-check exact5-only; trailing-whitespace=0
```

R1 전체 bare suite도 동일한 기존 수집 환경 문제로 exit 1이었다: `yaml` 미설치 1건,
fixture repository의 `src` import 3건, `httpx` 미설치 integration 2건으로 총 6 errors.

변경 파일은 승인된 제품 exact5뿐이다.

- `packages/providers/groq_adapter.py`
- `packages/providers/groq_models.py`
- `packages/providers/groq_errors.py`
- `tests/providers/test_groq_adapter_f04.py`
- `docs/04_test_reports/F-04_COMPLETION_REPORT.md`

실제 GROQ/Provider/network/credential/DB/UI/browser/WSL/deploy는 호출하거나 검증하지 않았다.
따라서 이 결과는 host-only fake transport 계약 증거이며 실제 credential, upstream wire 호환성,
지연·rate-limit 동작, 운영 health/model discovery를 증명하지 않는다. control/progress/HANDOFF는
수정하지 않았고 commit·push·merge도 수행하지 않았다.

rollback은 위 exact5 신규 파일만 삭제하면 된다. 다른 파일이나 사용자 변경에는 손대지 않는다.
