# C-08 완료 보고서

## 판정

`COMPLETED` — 승인된 fixture/unit/정적 범위에서 Repository Intelligence의 symbol·dependency·test·impact projection을 보완했고, 기존 A-13 read-only/no-write 계약을 포함한 필수 검증이 모두 통과했다.

## 기준선과 작업 권한

- Work Package: `C-08`
- WorkInstruction SHA-256: `D02670D73F12B574136EF27D99C336600B45F864E00A344CC306FAADEE81EC3C`
- 작업 branch: `codex/c08-repository-intelligence-r1`
- dispatch/start HEAD: `f7931944d894990ec1dff01cf14a47e5384209c8`
- 시작 상태: clean
- 담당: `developer-primary`
- execution fencing token: `c08-repository-intelligence-execution-fence-epoch-1-5529fe5`
- write fencing token: `c08-repository-intelligence-write-fence-epoch-1-5529fe5`
- 실제 변경은 활성 exact9 lease 안의 8경로이며 범위 밖 변경은 없다.

## 구현 결과

- Python AST에서 `import a, b`, `from . import x`를 각각의 결정론적 dependency로 투영한다.
- dependency에 `resolved_path`를 추가하고 Python/TypeScript/JavaScript 상대 import, TS side-effect import, `require`를 보수적으로 해석한다.
- test 파일명 추측 대신 실제 import dependency로 test `targets`와 `target_evidence`를 생성한다.
- path impact는 `direct_files`, `importers`, `callers`, `related_tests`, `related_paths`, `test_selection`, `risk_evidence`를 분리한다.
- Python reference는 AST Load 노드만 사용해 주석·문자열의 symbol 이름을 false reference로 만들지 않는다.
- unsupported source language, syntax error, decode failure, hostile/reparse/outside path를 구조화된 warning으로 fail-closed한다.
- inventory 입력 순서와 중복에 무관한 stable sort 및 canonical SHA-256을 유지한다.
- `ScanRequest.impact_query`는 기존 positional 인자 뒤의 optional 필드로 추가하여 기존 public 호출 순서를 보존하고 `scan_repository`가 이를 impact projection에 전달한다.
- C-08은 G0/G1/G7의 입력 자료를 생성할 뿐 gate 실행·도구 실행·제품 write를 수행하지 않는다.

## 변경 경로와 최종 SHA-256

- `packages/repository_intelligence/indexes.py` — `F3EDC77FFD46C8D5BE7F66DAFBC637C079CFB8C0693D47D30810DB3F6C2CBE3E`
- `packages/repository_intelligence/models.py` — `C075288DF44FEF52645D69910909B6D982722A2C51E01E66A740B232C8031AFE`
- `packages/repository_intelligence/scanner.py` — `3AD6B6443130EA129C6C3D129B2944243081325C5FEDCAA9E932B189C944E826`
- `tests/repository_intelligence/fixtures/app.py` — `207EDB38544F02794044710623322B57EF0470E71A99DA2B0C7B0471CADD1521`
- `tests/repository_intelligence/fixtures/tests/spec_app.py` — `C87735E34A68F16F51B1B084FF73663CA5217D83F9E6133343087892B18B8FEE`
- `tests/repository_intelligence/fixtures/ui.ts` — `6FE4E856DFF0B0C0679D8DD16B91BB36312B0195BCEA0D3BFE9A05B290EE6978`
- `tests/repository_intelligence/test_indexes.py` — `095A1DD5015A676A6282D8D886F555453DA37E470499C689D7D278EF427A1B75`
- `docs/04_test_reports/C-08_COMPLETION_REPORT.md` — 이 보고서

## TDD 및 검증 증거

### 기준선

- `python -m pytest tests/repository_intelligence -q -p no:cacheprovider` → exit `0`, `4 passed in 0.11s`
- `python -m pytest tests/tooling/test_a13_repository_scan.py -q -p no:cacheprovider` → exit `0`, `65 passed in 111.53s`

### RED

- 신규 gap 회귀 추가 후 `python -m pytest tests/repository_intelligence/test_indexes.py -q -p no:cacheprovider` → exit `1`, `8 failed, 3 passed`; 상대 import crash, structured warning 오배치, path impact/test 연결/side-effect import/determinism 누락을 재현했다.
- public positional 호환 회귀 `python -m pytest tests/repository_intelligence/test_indexes.py::test_scan_request_preserves_positional_contract_and_adds_optional_impact_query -q -p no:cacheprovider` → exit `1`, `1 failed`; 새 필드가 기존 6번째 positional `schema_version`을 가로채는 문제를 재현했다.

### GREEN 및 회귀

- `python -m pytest tests/repository_intelligence -q -p no:cacheprovider` → exit `0`, `12 passed in 0.10s`
- `python -m pytest tests/tooling/test_a13_repository_scan.py -q -p no:cacheprovider` → exit `0`, `65 passed in 101.60s`
- `python -B -m compileall -q packages/repository_intelligence tests/repository_intelligence` → exit `0`
- `git diff --check` → exit `0`

A-13 전체 회귀는 실제 임시 Git fixture에 대해 public `scan_repository` JSON 직렬화, read-only Git allowlist, pre/post snapshot 동일성, dirty/untracked 보존, mutation 탐지를 검증한다.

## 미검증 범위와 잔여 위험

- 실제 대규모 repository의 성능과 난해한 TypeScript/JavaScript 문법은 미검증이다. 외부 parser를 사용하지 않으므로 이해하지 못한 TS/JS 구문은 보수적으로 미색인될 수 있다.
- Provider, Telegram, DB, API, 브라우저, WSL, 배포, 운영 성능은 WorkInstruction 범위 밖이며 실행하지 않았다.
- C-14 gate engine은 이 Package의 범위가 아니다. 본 산출물은 G0/G1/G7 자료만 제공한다.
- 파일 write, project process, network, DB/API/browser 호출을 제품 scanner에 추가하지 않았다. 기존 read-only Git metadata 수집만 유지했다.

## Rollback

- C-08 제품 commit 전체를 `git revert <C-08-product-commit>`하여 복구한다.
- migration, DB, 외부 side effect, secret 변경이 없으므로 별도 데이터 rollback은 없다.
