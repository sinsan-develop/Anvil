# F-20/U-01 R2b 현재 projection·역사 분리 결과

## 판정

`COMPLETED` — 지정된 exact2 범위의 로컬 RED→GREEN 및 인접 통제 검증을 마쳤다. 이는 R2b 제품 writer의 완료 주장이지 U-01/F-20 수락 또는 전체 suite PASS 판정이 아니다. C30 CRITICAL `OPEN_BLOCKING`, release `DEFER`를 유지한다.

## 판단 이유

- 담당: `developer-primary-f20-u01-r2b`; epoch13 execution token `f20-u01-r2b-execution-fence-epoch-13-r2bstart20260928`, write token `f20-u01-r2b-write-fence-epoch-13-r2bstart20260928`; 만료 `2026-09-29T00:17:16+00:00`. 착수 시 branch `codex/f18-wsl-ops`, HEAD `fdb84603f655f5d0424b0959cb558d66c6fe6bd9`, Git status clean, G-05 `PASS sequence=1792`.
- 기준 SHA-256: 설계 `1DD7D91D6A0F9406A100B43B68285AD0A06F453FEC55F497458D55B20F481712`; 계획 `943B4123C5A8F273FF628E150501E0D66FAC10705A72989CA98E8453A083AEEB`; 매트릭스 `1AFDDC9A0D35868EC9D1774CE6A6087A177620875074D7198C361AFF92363AD6`; 테스트계획 `902A6E64E06E92C5F8856EE6C18CA94983F4F72040351AD954ADD1428555A014`; 운영규칙 `BFDF50FB5909BC0D3E7D2267BBDA2E458A67E858D7B5A36A2F077C4FE2DE06B0`; R2b WI `5893B59824CD55BC13C91023489A5314A75B376FB44D8DA8AF8BA70DCB19F9BC`; Invocation `205B7AC221C43BFF606B113673EDA9E97EE8A590117ACF089A0E2F7B46CC1C78`.
- 이전 WSL-server 전체 suite의 유일한 실패는 현재 projection mode가 `F20_U01_R2B_CURRENT_HISTORY_START`인데 테스트가 과거 R1b mode를 기대한 것이다. 이 로컬 실행에서도 같은 단일 node가 수정 전 `1 failed in 9.54s`(exit 1)로 RED였고, 현재 mode 및 progress/digest/manifest 위조 거부 코드만 R2b route로 바꾼 후 `1 passed in 21.26s`(exit 0)로 GREEN이었다. handoff의 `HANDOFF_NEXT_ACTION_MISMATCH`, manifest 미수락, C30 `OPEN_BLOCKING`, `DEFER` assertion은 그대로다.
- R1b 발급 commit `1126444733f2dabe0525d5e6be250b079ace1042`, R2 발급 commit `214cd61740c84971a71b6e1178047eec40322d52`에서 progress/digest/manifest와 WI/Invocation Git blob을 직접 조회·해시 대조했다. R1b 결과는 `edf0fcc5505e8a74bc48c93fa1b67641e4146492`, R2 결과는 `da86090f72645c4c6ec7812618cbae5249bd8a69`의 Git blob에 결박했다. 기존 R5e/R1 역사 검증은 삭제하지 않았다. 역사 검증을 포함한 두 node는 `2 passed, 686 deselected in 22.08s`(exit 0)였다.
- 인접 R2/R2b 통제의 첫 실행은 기존 Windows 전역 pytest 임시 경로 `C:\Users\cyhuh\AppData\Local\Temp\pytest-of-cyhuh` ACL 접근 거부로 setup `11 errors`(exit 1)였다. 이는 제품 assertion 실패가 아니다. 전용 `runtime/pytest-f20-u01-r2b-writer` basetemp로 다시 실행한 결과 `11 passed in 115.64s`(exit 0). 전용 경로와 내부 reparse target 11개가 모두 해당 경로 안임을 확인한 뒤 정확한 폴더만 제거했고 잔류 `False`를 확인했다. 기존 전역 pytest 폴더는 변경·삭제하지 않았다.
- `python -B scripts/check_project_progress.py .`는 수정 전후 `G-05 ... PASS sequence=1792`(exit 0). `git diff --check` exit 0. Git의 전역 ignore 설정 읽기 경고는 별도 환경 경고이며 위 시험의 판정에 사용하지 않았다.

## 조치·영향·미검증

- 변경 경로는 `tests/tooling/test_project_progress.py`와 이 보고서 exact2뿐이다. 현 테스트 기대 mode/오류 네 곳과 테스트 이름·역사 Git blob anchor를 변경했다. 검증기, canonical Event/progress/digest/manifest, API/DB/auth/UI 및 실제 제품 동작은 변경하지 않았다.
- 정식 Developer `FAILURE_REPORT` 0회. 환경 setup 오류 1회는 전용 basetemp로 해결했고 원래 전역 ACL은 그대로다.
- Main이 exact2 diff와 역사 WI/Invocation/결과 Git blob 6개를 독립 재검토해 Critical/Important 0, 집중 `2 passed, 686 deselected in 34.20s`, G-05 seq1792 및 diff check exit 0을 확인했다. 제품·상태 commit `c4b7e02d81e18579632759678367ad43cadf2479`를 같은 branch에 push하고 로컬·원격 SHA 일치 및 clean을 확인했다.
- rollback은 본 exact2 변경만 이전 commit으로 되돌리는 후속 정상 Git commit이며 원장이나 다른 사용자의 변경을 덮어쓰지 않는다. `docs/WORK_STATUS.md`와 canonical progress/HANDOFF 갱신은 Main 소유이며 이 writer가 수정하지 않았다.

## WSL-server 동일 SHA 검증 인계 결과

- Main 인계 증거의 대상은 `c4b7e02d81e18579632759678367ad43cadf2479`를 지정 개발 원격에서 Git으로 수신한 격리 checkout이다. `git fetch --quiet development '+refs/pull/*/head:refs/remotes/development/pr/*'`로 역사 PR ref를 준비했고, `uv sync --frozen --group dev` 및 잠금 Node22 경로의 `npm ci --ignore-scripts --no-audit --no-fund` 후 G-05 `PASS sequence=1792`였다. 현재·역사 집중 테스트는 `2 passed, 686 deselected in 6.73s`(exit 0)였다.
- 정식 전체 suite 첫 명령은 `env PATH=/home/daon/.local/opt/node-v22.23.2-linux-x64/bin:$PATH PYTHONDONTWRITEBYTECODE=1 ANVIL_POSTGRES_VOLUME_TARGET=/var/lib/postgresql/data /home/daon/.local/bin/uv run python -B -m pytest --import-mode=importlib --ignore=tests/fixtures/repositories -p no:cacheprovider --basetemp=/tmp/anvil-f20-u01-r2b-formal-pytest-c4b7e02d -q --tb=short`였다. 결과는 exit 1, `8222 passed, 3 failed, 116 skipped, 14 warnings in 1672.58s`. 실패 3건은 모두 `C21WorkbenchUiWslImmutableRuntimeControlV2PublicationTests`의 `C21_RUNTIME_CONTROL_V2_PARENT_INVALID`: 격리 clone에 역사 sibling `fb311d456fe3cbb2e8439f39017356ddec6cf266` 객체가 없고 parent는 존재했다. 제품 HEAD나 파일 결함으로 귀속하지 않는다.
- 지정 원격에서 위 정확한 역사 commit 객체만 추가 fetch했다. 해당 C21 class는 객체 준비 전 `3 failed, 1 passed`에서 준비 후 `4 passed in 5.08s`(exit 0)로 바뀌었고 G-05 seq1792, 제품 HEAD와 checkout clean은 유지됐다. 같은 정식 옵션에서 basetemp만 `/tmp/anvil-f20-u01-r2b-formal-retry-pytest-c4b7e02d`로 바꾼 전체 재실행은 exit 0, **`8225 passed, 116 skipped, 14 warnings in 1732.62s`**. 116 skip과 14 warning은 PASS로 승격하지 않는다.
- 종료 후 G-05 seq1792 PASS와 Git clean을 다시 확인했다. 격리 clone과 실제 생성된 정식 pytest base 두 곳은 정확한 realpath, 내부 symlink 객체 합계 550개, 관련 프로세스 부재를 확인한 뒤 해당 경로만 제거해 `R2B_PRODUCT_WSL_RESIDUE_ZERO`(exit 0)를 확인했다. 집중/C21 basetemp는 생성되지 않아 삭제 대상이 아니었다. 공유 DB/Docker 및 ysna-server/Production은 변경하지 않았다.
- R2b는 현재 이력 검증 테스트만 보완했으므로 API/DB/브라우저·PG15/PG18RC는 재실행하지 않았다. 앞선 R2 브라우저 실측을 새 실행으로 표현하지 않는다. C30 CRITICAL `OPEN_BLOCKING`, release `DEFER`이므로 전체 Python 회귀 GREEN만으로 U-01/F-20 수락·main 병합·신규 branch를 진행할 수 없다. 다음은 Main이 이 보고서와 `docs/WORK_STATUS.md`를 대조해 보존 commit/push하고, 남은 U-01 사용자 흐름과 C30 사고를 별도 통제 범위에서 계속 다루는 것이다.
