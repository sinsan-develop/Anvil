# F-20/U-01 R40 A-14 현재 검사 successor 결과

## 판정

`A14_R7_CURRENT_STATIC_CHECK_GREEN; FULL_NON_OPT_IN_REGRESSION_GREEN; F20_U01_NOT_ACCEPTED`. 기존 작업 브랜치 `codex/f18-wsl-ops`의 `6e4b48e89532b9c5a2a9558f5274224bf7d0445d`에서 A-14 현행 정적 검사와 반례가 로컬·WSL-server 동일 SHA로 통과했다. 후속 기록 checkpoint `5f9a14f31eb2e46f1df9b7a271ce06d0a39db609`의 WSL-server 전체 비-opt-in suite도 통과했다. C-30은 계속 `OPEN_BLOCKING`/release `DEFER`이며, 이 결과를 실제 브라우저 Network·F-20/U-01 인수 또는 main 병합으로 승격하지 않는다.

## 변경 전·후와 범위

- 변경 전: 역사 A-14 EvidenceManifest의 현재 checksum drift와 `App.tsx`의 입력 **거부용** `/localhost|127\.0\.0\.1/`을 내부 API 주소 사용으로 오인해 CLI가 실패했다. 역사 manifest/R6을 고쳐 쓸 수 없었다.
- 변경 후: 완결된 JavaScript regex literal 안의 주소 문자열만 `internal-address` 탐지에서 제외하고, 미완결 regex·실제 절대 URL 문자열·상대경로가 아닌 fetch·기존 READY_PATH 방어는 계속 거부한다. R6과 역사 manifest의 실제 SHA 및 현재 checker/test/server 세 파일의 raw bytes/SHA를 새 R7 successor registry가 정확히 결박한다. R7은 Git tracked-clean일 때만 적용하며 위조 부모·경로·행 해시·self-reference를 거부한다.
- Main control 변경 파일: `scripts/check_a14_workbench_prototype.py`, `tests/tooling/test_a14_workbench_prototype.py`, `docs/evidence/manifests/A-14_A14_SUCCESSOR_R7.json`, `scripts/f20_u01_r38b_close_overlay.py`, R40 계획·이 결과·`docs/WORK_STATUS.md`. 제품 `App.tsx`, 역사 manifest/R6, Event/lease, DB, 공개 API, 권한, Secret은 변경하지 않았다. 단일 Main control writer이며 제품 lease 발급0.

## 실행 증거

| 환경 | 명령·검사 | 실제 결과 |
| --- | --- | --- |
| Windows local | `.venv\Scripts\python.exe -m pytest tests/tooling/test_a14_workbench_prototype.py -q` | 17 passed in 32.62s, exit0. 커밋 전에는 tracked-clean 반례 1F/나머지 16P를 확인했다. |
| Windows local | `.venv\Scripts\python.exe scripts/check_a14_workbench_prototype.py` | `PASS paths=17 self_reference=false`, exit0. |
| Windows local | `.venv\Scripts\python.exe scripts/check_project_progress.py` | G-05 `PASS sequence=2040 reporting=AUTO_CONTINUE`, exit0. |
| Windows local | `.venv\Scripts\python.exe -m pytest tests/tooling/test_f20_u01_r38b_close_projection.py -q` | 3 passed in 7.08s, exit0. |
| Windows local | `git diff --cached --check` / exact five-path commit / `git push development HEAD:codex/f18-wsl-ops` | diff check exit0, commit `6e4b48e8`, private remote 동일 SHA. |
| WSL-server | exact branch clone, 역사 heads/PR refs 및 C21 sibling 객체 fetch, `/home/daon/.local/bin/uv sync --frozen --group dev --offline` | HEAD `6e4b48e8...`, Git clean, Python3.14.3/dev43, sync exit0. |
| WSL-server | `.venv/bin/python scripts/check_a14_workbench_prototype.py`; `.venv/bin/python -m pytest tests/tooling/test_a14_workbench_prototype.py -q` | CLI `PASS paths=17 self_reference=false`; 17 passed in 1.92s, 모두 exit0. |
| WSL-server | `.venv/bin/python -m pytest tests/tooling/test_f20_u01_r38b_close_projection.py -q`; `.venv/bin/python scripts/check_project_progress.py` | 3 passed in 1.31s; G-05 seq2040 PASS, 모두 exit0, 종료 시 HEAD/clean 불변. |

Windows `uv run`의 기본 전역 cache 접근은 OS ACL 거부로 exit1이었으나 checkout 내부 기존 `.venv`로 같은 로컬 검증을 완료했다. 이는 제품/통제 실패가 아니다. 정식 Developer 실패0, 이 절편의 미해결 집중 실패0.

## QA 자원 종료·잔여 조건

WSL-server의 일회성 `/tmp/anvil-f20-r40-qa-6e4b48e`는 생성 전 부재, 종료 전 실경로 일치·owner `daon`·비link·mount0·정확 HEAD·Git clean·pytest/Python 사용 프로세스0을 확인했다. 링크4는 `.venv`의 표준 Python 절대 링크1/내부 상대 링크3이었다. 정확 checkout 하나만 제거하고 `R40_WSL_QA_RESIDUE_ZERO`를 확인했다. 공유 서비스·DB·Docker·port·`ysna-server`/Production 변경0.

## 미검증·다음 조치·rollback

실제 브라우저 Network/11개 메뉴, IdP/Provider, PostgreSQL18 RC, C30 사고 복구와 사용자 인수는 이 회귀 결과로 검증되지 않았거나 차단 상태다. 다음은 같은 브랜치에서 C30/open scope를 별도로 처리한다. 회귀 발생 시 이 commit의 정확 변경만 정상 `git revert 6e4b48e8`로 되돌릴 수 있다. 역사 manifest/R6을 재작성하지 않는다.

## 후속 WSL-server 전체 비-opt-in 회귀 (기록 checkpoint `5f9a14f3`)

- 생성 전 exact `/tmp/anvil-f20-r40-full-5f9a14f`, `/tmp/anvil-f20-r40-pytest-5f9a14f`, `/tmp/anvil-f20-r40-run-5f9a14f` 부재와 원격 branch SHA를 확인했다. 전용 clone은 `5f9a14f31eb2e46f1df9b7a271ce06d0a39db609`/Git clean이고 원격 heads/PR refs 및 C21 sibling 정확 객체를 fetch했다. 잠긴 Python3.12.3/dev43 offline sync와 G-05 seq2040 PASS 후 실행했다.
- 명령: `env PATH=/home/daon/.local/opt/node-v22.23.2-linux-x64/bin:$PATH PYTHONDONTWRITEBYTECODE=1 ANVIL_POSTGRES_VOLUME_TARGET=/var/lib/postgresql/data .venv/bin/python -B -m pytest tests --import-mode=importlib --ignore=tests/fixtures/repositories -p no:cacheprovider --basetemp=/tmp/anvil-f20-r40-pytest-5f9a14f --tb=short --junitxml=/tmp/anvil-f20-r40-run-5f9a14f/results.xml` (전용 run root에 로그/종료 코드 분리 저장).
- 실제 종료 marker `0`; pytest **8815 passed / 123 skipped / 14 warnings in 2281.69s**. JUnit `tests=8938, failures=0, errors=0, skipped=123`, time `2281.446s`로 집계와 일치한다. `SKIPPED` 123개를 PASS로 세지 않는다.
- `run.log` 48,159 bytes SHA-256 `6cacd9463b89b9732ac4305ddaaf865ea1c20d39132e8befaff89764dfb50f7e`; `results.xml` 1,438,522 bytes SHA-256 `ba2988ae9794a4b737904adfb935a5b743f085eb67d677f92e87393b271408b0`. 두 원본은 전용 임시 run root와 함께 정리되어 복구되지 않으며, 집계·hash·명령·exit는 이 보고서에 보존한다.
- 종료 전 checkout exact HEAD/Git clean, 세 root 실경로 일치·owner `daon`·비link·mount0, pytest/checkout/run symlink 각각 352/4/0, pytest link 외부 target0, checkout link 외부 target은 표준 `/usr/bin/python3.12` 하나, 관련 pytest 프로세스0, G-05 seq2040 PASS를 확인했다. 정확 세 root만 제거해 `R40_FULL_WSL_RESIDUE_ZERO`. 공유 서비스·DB·Docker·port·`ysna-server`/Production 변경0.
- 이 실행은 opt-in 브라우저·실 DB·Provider 호출이나 정식 운영 유사 11개 메뉴 검증이 아니다. C30 원장 원문 사고는 테스트에서 차단 상태로 유지된 것이며 해결/승인된 것이 아니다. 현재 branch의 이후 `WORK_STATUS` 기록 commit은 전체 검증 SHA와 다르므로 제품 회귀 증거를 새 HEAD에 암묵 전가하지 않는다.
