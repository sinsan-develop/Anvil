# F-20/R3 Primary Developer 결과 — same-origin client 경로

## 판정

`COMPLETED` (R3 지정 5개 경로 안의 수정과 로컬 Node·UI build/typecheck/lint·A-14 브라우저 소스 경로 검사 완료; Main의 WSL-server 동일 SHA 집중 검증도 해당 범위에서 GREEN). 단, WSL 전체 pytest는 **48 FAIL로 비GREEN**이며 실제 브라우저 Network와 전체 A-14 checker도 미완료다. F-20 전체 수락 또는 11개 메뉴 실기능 완료를 뜻하지 않는다.

## 기준·소유권

- 작업 시작: `D:\Project\Anvil\.worktrees\anvil-f18-wsl-ops`, `codex/f18-wsl-ops`, clean `HEAD dfa85738368f322248818400e432e760bce3684f`; `development`는 `git@github-sinsan-develop:sinsan-develop/Anvil.git`.
- Canonical progress `sequence=1731`, `F-20/R3`, actor `developer-primary-f20-r3`; G-05 `PASS sequence=1731`. 활성 worker token `f20-r3-execution-fence-epoch-3-r3sameorigin9f2`, write token `f20-r3-write-fence-epoch-3-r3sameorigin9f2`; 둘 다 2026-09-28 05:03:48 UTC 만료. 실제 작업은 그 전 수행.
- 제품 exact5 commit `c759956a9592ebfca66ed2bebc03e6db16ea2fe0`은 Main이 지정 `development` 원격에 게시했고, WSL-server 격리 checkout에서 동일 SHA를 확인했다. 본 보고서의 WSL 보완은 이후 clean `HEAD cd897be453c8ea55de2498439c9ba73774c1bf43`에서 작성하며, 제품 코드는 추가 수정하지 않는다.
- 기준 SHA-256: 설계 `1DD7D91D6A0F9406A100B43B68285AD0A06F453FEC55F497458D55B20F481712`; 계획 `943B4123C5A8F273FF628E150501E0D66FAC10705A72989CA98E8453A083AEEB`; 매트릭스 `1AFDDC9A0D35868EC9D1774CE6A6087A177620875074D7198C361AFF92363AD6`; 테스트계획 `902A6E64E06E92C5F8856EE6C18CA94983F4F72040351AD954ADD1428555A014`; 운영규칙 `BFDF50FB5909BC0D3E7D2267BBDA2E458A67E858D7B5A36A2F077C4FE2DE06B0`; R3 WorkInstruction `18FDB8355913EC39A37FC36403806D52F7EC4D5550FCFA8C7DD4688588B383D3`.

## 변경·영향

- `apps/web/src/api/c29-agent-console-client.js`: `fetchImpl(path, ...)`를 `fetchImpl(apiPath(path), ...)`로 변경.
- `apps/web/src/api/projects-client.js`: `fetchImpl(projectsApiPath(), ...)`를 `fetchImpl(apiPath(projectsApiPath()), ...)`로 변경.
- `apps/web/tests/c29-console-runtime.test.mjs`, `apps/web/tests/projects.test.mjs`: 호출 지점의 `apiPath` 적용을 검사하고 외부 URL, 내부 절대주소, `//` 및 `/api/` 허용 범위 밖의 경로 거부를 검사.
- 공개 API·BFF·scanner·기존 정상 요청 경로는 변경하지 않았다. 변경 전 두 client는 고정 상대경로를 직접 fetch했으나 호출 지점에 공통 validator를 적용하지 않았다. 변경 후 실제 네트워크 경계에서 공통 same-origin validator를 통과한다.

## 실제 검증

| 명령 / 환경 | 종료 | 실제 결과 |
|---|---:|---|
| `.venv\Scripts\python.exe -B scripts/check_project_progress.py` / Windows | 0 | G-05 `PASS sequence=1731` |
| `node --test --test-name-pattern='fetch validates' apps/web/tests/c29-console-runtime.test.mjs apps/web/tests/projects.test.mjs` / 수정 전 | 1 | 신규 2개 테스트가 각각 `fetchImpl(apiPath(...))` 호출 지점 부재로 RED |
| 위 명령 / 수정 후 | 0 | 신규 2개 GREEN |
| `ANVIL_PYTHON=<worktree>\.venv\Scripts\python.exe; node --test apps/web/tests/c29-console-runtime.test.mjs apps/web/tests/projects.test.mjs` / Windows | 0 | 21 PASS, 0 FAIL, 0 SKIP; 로컬 Python API를 통과하는 기존 Node BFF 테스트 포함 |
| `.venv\Scripts\python.exe -B -c "from pathlib import Path; from scripts.check_a14_workbench_prototype import browser_source_findings; root=Path.cwd(); paths=[root/'apps/web/index.html',*sorted((root/'apps/web/src').rglob('*'))]; findings=browser_source_findings([p for p in paths if p.is_file()]); print('BROWSER_SOURCE_FINDINGS',len(findings)); print('\\n'.join(findings)); raise SystemExit(bool(findings))"` / Windows | 0 | `BROWSER_SOURCE_FINDINGS 0`; R3 이전 A-14 scanner의 `non-relative-fetch` 2건 해소 |
| `.venv\Scripts\python.exe -B scripts/check_a14_workbench_prototype.py` / 수정 전 | 1 | `non-relative-fetch` 두 client + 기존 checksum 2건 |
| 위 checker / 수정 후 | 1 | `non-relative-fetch` 0건, 기존 `checksum:apps/web/server.mjs`, `checksum:tests/tooling/test_a14_workbench_prototype.py` 2건 잔존. 전체 checker PASS가 아님 |
| `node --check` / 각 수정 client, `git diff --check` | 0 | 문법 2개와 diff 공백 검사 PASS |
| `npm run web:typecheck`, `npm run web:lint`, `npm run web:build` / 최초 Windows 실행 | 각 1 | `node_modules` 부재로 각각 `tsc`, `biome`, `vite` 명령 미발견 |
| `npm ci --ignore-scripts --cache .npm-cache-f20-r3 --prefer-offline --no-audit --no-fund` / 최초 제한 환경 | 1 | registry tarball fetch가 `EACCES`; npm `Exit handler never called!` |
| 동일한 lockfile `npm ci` / 허용된 일회성 실행 권한 | 0 | 29개 package 설치. package-lock 변경 없음 |
| `npm run web:typecheck` / 설치 후 Windows | 0 | TypeScript 검사 PASS |
| `npm run web:lint` / 설치 후 Windows | 0 | biome 검사 PASS, 기존 `src/console/App.tsx` unused React import 경고 1건; 수정 범위 밖 |
| `npm run web:build` / 설치 후 Windows | 0 | Vite v8.3.0, 20 modules transformed, 빌드 PASS |

의존성 설치 시도 전에 `node_modules`, `.npm-cache-f20-r3`, `apps/web/dist`가 모두 없음을 확인했다. 첫 실패 후 임시 두 경로를 정리했고, 허용된 재시도의 검증 후 세 경로만 정리했다. `node_modules/@anvil/web` junction의 대상이 현재 worktree `apps/web`임을 확인하고 junction만 먼저 제거했으며, 세 경로의 재파스 지점·경로 경계를 검사한 뒤 삭제했다. 세 경로 잔류 0, `apps/web` 보존을 확인했다. 관련 없는 파일은 수정·정리하지 않았다.

## Main의 동일 SHA WSL-server 후속 검증

이 절은 Primary Developer의 로컬 실행이 아니라 Main이 `docs/WORK_STATUS.md`에 기록한 격리 WSL-server 실행 결과다. 대상은 지정 원격과 일치하는 제품 `c759956a9592ebfca66ed2bebc03e6db16ea2fe0`이다.

| WSL-server 검증 | 실제 결과 |
|---|---|
| 두 client의 Node 테스트 | `21 passed`, exit 0 |
| A-14 `browser_source_findings` 대상 테스트 | `1 passed`, exit 0; 전체 A-14 checker 합격과 다름 |
| G-05 | `PASS sequence=1731`, exit 0 |
| Web typecheck·lint | 각 exit 0; lint의 기존 unused React import 경고 1건 유지 |
| Web Vite build | 시스템 Node 18은 `styleText` 부재로 실패 1회. 격리 Node `22.23.3` + lockfile 일치 rolldown `1.2.10` Linux optional binding에서 exit 0. 시스템 Node·manifest·lockfile 미변경 |
| 전체 pytest | `--import-mode=importlib --ignore=tests/fixtures/repositories --basetemp=/tmp/anvil-f20-pytest-c759956`, `ANVIL_POSTGRES_VOLUME_TARGET=/var/lib/postgresql/data`, 격리 Node22 PATH: `8112 passed, 48 failed, 116 skipped, 14 warnings in 1271.82s`, exit 1. 기존 261 FAIL보다 감소했으나 비GREEN |
| 정리 | 격리 checkout·pytest base·log·Node cache의 정확한 네 경로 제거 및 `F20_C759956_WSL_RESIDUE_ZERO` 확인. 공유 DB·Docker·서비스 불변 |

48 FAIL은 C30 contract 2, A13 POSIX 경로 1, F18 R12 `development/main` ref 전제 2, Phase B gate 1, progress/history 41, C01 OpenAPI 1로 분류 중이다. 제품 회귀와 역사 fixture·실행 환경 원인은 아직 최종 분리되지 않았다. 이 48건이나 116 SKIP을 PASS로 계상하지 않는다. WSL에 브라우저 실행 파일이 없어 실제 Network 증거는 수집하지 않았다.

## 미검증·잔여 위험·인계

- 실제 브라우저 Network, 전체 A-14 역사 artifact checksum 복구, 전체 pytest 48 FAIL 해소는 후속 과제다. R3 제품 exact5는 commit·push 및 WSL 동일 SHA 집중 검증까지 완료됐으나 전체 suite는 비GREEN이다.
- 기존 `apiPath`는 `/api/...` 또는 `/auth/session/status` allowlist를 적용한다. R3는 그 기존 계약을 호출 지점에 적용했으며 validator 자체를 변경하지 않았다.
- R3의 Node·정적 검사·WSL 집중 검증 통과를 F-20 전체 suite, 11개 메뉴 실제 기능, 실제 브라우저 또는 Production·사용자 인수 PASS로 승격하지 않는다. `ysna-server`와 Production은 작업 범위 밖이다.
- 정식 Developer 실패보고 0회. 이번 WSL 전체 suite 실패 1회(48 FAIL), 시스템 Node18 build 환경 실패 1회(격리 Node22 성공), A-14 전체 checker 역사 checksum 2건 미해결을 각각 분리한다. 다음은 실패군 최소 재현·원인 분류와 새 exact-path 통제 하 순차 RED→GREEN, 전체 suite 재실행이다.

## Rollback

Main이 제품 commit `c759956a9592ebfca66ed2bebc03e6db16ea2fe0`의 exact5 변경만 정상 역적용하면 변경 전 동작으로 복구된다. 다만 호출 지점 same-origin validator 부재와 A-14의 `non-relative-fetch` 두 건도 다시 발생한다. 이 문서 보완만 현재 미커밋이며 commit/push와 canonical progress/HANDOFF/WORK_STATUS 갱신은 Main 소유다.
