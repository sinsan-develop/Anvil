# F-20/U-01 R4 Dashboard Critical Alerts 저장 기록 읽기 결과

## 판정

`COMPLETED` — epoch16 exact3의 로컬 UI/계약 구현과 기본 검증을 마쳤고, Main이 제품 SHA `cc94334c1594f85a22402aa990aaf309f84d73fa`의 WSL-server에서 범위가 한정된 API·브라우저 fixture 검증을 수행했다. 현재 화면은 기존 `GET /api/operations/alerts`의 저장 기록 한 페이지만 읽고, 현재 페이지의 active critical 기록을 표시한다. 이 판정은 실제 OIDC+브라우저 통합 E2E 또는 U-01/F-20 수락을 뜻하지 않는다. C30 `OPEN_BLOCKING`, ReleaseDecision `DEFER`, manifest 미수락을 유지한다.

## 기준과 쓰기 권한

- 작업자: `developer-primary-f20-u01-r4`; Windows worktree `D:\Project\Anvil\.worktrees\anvil-f18-wsl-ops`, branch `codex/f18-wsl-ops`, 시작 HEAD `d594966eda1d1da98e0ed4b1ddd8e4f4c1ca8493`, 시작 tracked/untracked clean. upstream `development/codex/f18-wsl-ops`.
- G-05 착수 `PASS sequence=1810 reporting=AUTO_CONTINUE`(exit 0). 마지막 canonical Event `evt_f20_1810_package_resumed`의 step은 `F20_U01_R4_CRITICAL_ALERTS_START`, progress projection과 일치했다. epoch16 worker/write lease는 ACTIVE이고 만료는 `2026-09-29T10:09:55+00:00`다. execution token `f20-u01-r4-execution-fence-epoch-16-r4alertstart1`, write token `f20-u01-r4-write-fence-epoch-16-r4alertstart1`; 두 scope 모두 아래 exact3이다.
- 기준 SHA-256: 설계 `1DD7D91D6A0F9406A100B43B68285AD0A06F453FEC55F497458D55B20F481712`; 계획 `943B4123C5A8F273FF628E150501E0D66FAC10705A72989CA98E8453A083AEEB`; 매트릭스 `1AFDDC9A0D35868EC9D1774CE6A6087A177620875074D7198C361AFF92363AD6`; 테스트계획 `902A6E64E06E92C5F8856EE6C18CA94983F4F72040351AD954ADD1428555A014`; 운영규칙 `BFDF50FB5909BC0D3E7D2267BBDA2E458A67E858D7B5A36A2F077C4FE2DE06B0`; WI `9B5708DA3E0115459DB22B76BA90879B94DE4BCCB51CD87396B754CE9274B257`; Invocation `0DE3AF57838A71BCB35B3DA3B0D43B66C6AEAE1FD3A53BB868EFE3A85CB50D7B`; R4 BINDING_PLAN `985D1B5342D035D99864CED83B71B6C1A00F3543E5519B5E0F6D75C26C08264C`.

## 변경 전후와 영향

- `apps/web/src/console/App.tsx`: 기존 Dashboard Critical Alerts 저장 기록 연결이 없었다. 현재는 Dashboard에서만 `/api/operations/alerts`를 `credentials: 'same-origin'`으로 GET한다. 응답 envelope/data/최대100개/필수 row 필드/중복 alert ID/순서/level/status/시각/owner/cursor를 검증해 위조·오류면 전체 `UNAVAILABLE`로 닫는다. `critical`과 `open|acknowledged`만 code/source/발생시각/담당자/원인/대상으로 React 텍스트 렌더링한다. warning·resolved는 표시하지 않지만 페이지 검증에는 포함한다. 빈 페이지에는 ‘이 페이지에 저장된 Critical 기록 없음’, older cursor에는 ‘과거 페이지 미조회 · 부분 결과’를 표시하며 detector 실행·경고 완전성·신선도를 추론하지 않는다. Main의 경미 검토 지적에 따라 다른 운영 read model 미연결 문구에서 ‘알람’을 제거했다.
- `apps/web/tests/f15-console.test.mjs`: 기존 Database·Provider 8건을 유지하고 정상 mixed 저장 기록·same-origin/credential·악성 텍스트 escaping, 빈/부분 페이지, 401·403·500/네트워크·JSON·malformed·duplicate·위조 거부, Dashboard 공존 5건을 추가했다.
- 제품 diff는 위 두 파일에서 `199 insertions, 1 deletion`이다. 최종 SHA-256은 App `7DDD6822E1D694041A9D0037FF0DA6B616EF3EF29D2C26B51352ED4625027407`, 테스트 `EAA2A1848883AD8188757CA0F8EF5C1300F73D4C9F93936CE29B5D5BD0520C5C`. 새 API·permission·DB·detector·acknowledge·Next Actions·다른 Health 구현은 추가하지 않았다.

## 로컬 실행 증거

- `node --import tsx --test tests/f15-console.test.mjs` (`apps/web`) RED: 기존 8 pass, 신규 5 fail, exit 1. 신규 loader/card 및 Dashboard 영역 부재가 원인이었다.
- 같은 Node 명령 GREEN: `13 pass, 0 fail`, exit 0. Main 지적 운영 문구 보완은 변경 테스트 RED `12 pass, 1 fail`(exit 1) → 코드 보완 후 최종 `13 pass, 0 fail`(exit 0)로 확인했다.
- `npm run web:typecheck` → exit 0; `npm run web:lint` → exit 0, `Checked 3 files`, 수정 0; `npm run web:build` → exit 0, Vite 20 modules 변환. 문구 보완 후 세 명령 모두 다시 exit 0이었다.
- `PYTHONDONTWRITEBYTECODE=1 PYTEST_DISABLE_PLUGIN_AUTOLOAD=1 .\.venv\Scripts\python.exe -m pytest tests/api/test_f13_operations_api.py -q -p no:cacheprovider --basetemp=runtime/pytest-r4-developer-f13` → exit 0, `8 passed in 3.75s`. PowerShell에서는 두 환경변수를 `$env:`로 설정했다. 이는 F-13 API 계약 회귀이며 이번 UI의 실제 OIDC/browser 실측은 아니다.
- `& '.\.venv\Scripts\python.exe' scripts/check_project_progress.py` → exit 0, `G-05 project progress contract: PASS sequence=1810 reporting=AUTO_CONTINUE`; `git diff --check` → exit 0.
- 일회성 F-13 pytest base `runtime/pytest-r4-developer-f13`은 Main이 사전 WORK_STATUS에 기록했고 pytest 후 실제 생성되지 않아 잔류 0이다. web build 산출물은 사전 부재·Main 기록된 이 worktree `apps/web/dist`만 사용했다. build exit 0 뒤 경로가 worktree 내부이고 root reparse 0/내부 reparse 0임을 확인하고 정확한 `dist`만 삭제해 잔류 0이다. 각 명령 launcher는 종료됐으며 공유 Node 프로세스에는 손대지 않았다.

## Main WSL-server 동일 SHA 후속 실측

- Main이 제품 SHA `cc94334c1594f85a22402aa990aaf309f84d73fa`의 WSL-server에서 Node `13/13 pass`, typecheck·lint·build 각각 exit 0을 확인했다. 이 절은 Main이 전달한 후속 실측 기록이며 Developer가 WSL에서 재실행한 결과는 아니다.
- headless Chromium API interception fixture에서 1920×1080과 390×844 viewport 모두 `scrollWidth=viewport`였다. 저장 critical·partial·악성 텍스트·403 상태와 각 viewport의 `/api/operations/alerts` same-origin 상대 요청 4건을 확인했다. 이는 실제 브라우저 엔진의 fixture 검증이며 실제 OIDC 세션과 API를 연결한 browser E2E가 아니다.
- 별도 격리 PG15와 migration 0019에서 OIDC 저장 경고 opt-in 검증은 `1 passed, 41 deselected in 2.33s`였다. 200/401/403/500 응답과 GET 요청 전후 audit 무변경을 확인했다. 이 API 검증은 위 브라우저 interception fixture와 구별한다.
- 첫 두 브라우저 시도는 harness cwd/EROFS 오류로 앱 로드 전에 실패했고, 세 번째 read-only static server 시도가 PASS했다. 첫 posttest G-05는 untracked `dist` 때문에 `F20_U01_R4_GIT_INVALID`였으나, 사전 기록된 `node_modules`/`dist`를 정확히 정리한 뒤 G-05 `PASS sequence=1810`이었다. QA 컨테이너·PG·pytest·port 및 두 임시 경로의 잔류는 0이다.

## 미검증과 다음 조치

- 실제 OIDC 세션을 사용한 브라우저·API 통합 E2E는 미검증이다. 위 interception fixture와 별도 PG15 API 검증을 그 통합 PASS로 승격하지 않는다. detector, Next Actions, 다른 Health, Production 및 운영 배포도 미검증이다. 기존 skip/warning 경계도 유지한다.
- Main의 독립 검토와 WSL-server 동일 SHA 범위 검증은 위와 같이 기록했으나, U-01/F-20 수락은 후속 별도 판정이다. C30 `OPEN_BLOCKING`, ReleaseDecision `DEFER`, manifest 미수락을 유지한다.
- 동일 원인 유효 `FAILURE_REPORT` 0회. rollback은 R4 제품 변경만 후속 정상 Git commit으로 되돌려 Alerts 영역을 `UNAVAILABLE`로 복귀하는 것이다. 원장·이전 승인 기록·DB는 변경하지 않는다. Developer는 이 보고서 보완에서 commit/push/merge·배포하지 않았고 progress/HANDOFF는 Main 소유로 변경하지 않았다. Main이 관리하는 `docs/WORK_STATUS.md`는 보존했다.
