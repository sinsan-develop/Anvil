# F-17 WSL 실제 검증 보고 — 2026-09-24

## 판정

AV-OPS-015·AV-OPS-025는 F-17 지정 범위에서 **PASS / Main의 criterion별 ProductValidation `SUITABLE`**이다. PG15 일반 통합과 격리 PG18 RC 모두 공개 Git `7083e2aa90ced5bb109fd268cf22e34de34ff6d9`, 동일 runtime image `sha256:f6c481954d3ec9013b4974aa9514c8646b06616ffbc84cc4d645c7a5d4432a82`, migration `0016_operations_recovery`에서 핵심 HTTP+DB·실제 API 재시작·SSE를 검증했다. ProductValidation 공개 API/DB 지속화, 전체 UI 업무 흐름, 실 Provider, ysna/Oracle 배포, 사람 ReleaseDecision은 PASS가 아니다.

## 기준·격리

- 시작 main은 F-16 PR #32 merge `3460d9768b039568022fd43e24577cc0e2402dea`; F-17 공개 tag `f17-rc-7083e2a`는 위 Git SHA로 peel됐다. WSL은 `ssh WSL-server`로만 접근했다. `/srv/anvil-wsl/f17-rc`는 clean detached tag checkout이었다. 서버 source copy/patch 및 기존 `/srv/anvil-wsl/repo`·`anvil-web` 수정 0.
- PG15는 기존 `local-postgres` 안에 새 `anvil_f17_pg15_d39432b` DB와 `anvil_f17_migrator_d39432b`/`anvil_f17_app_d39432b` role만 사용했다. 앱은 실제 `current_user`가 후자이며 superuser/createdb/createrole/database CREATE/schema CREATE가 false였다. 기존 `anvil` DB·`anvil_app` role은 보존했다. PG15 image ID `sha256:75f6767185020459c7e2c3f88fb66f1bd2d9790c435bc91512497146c8bf8d7e`.
- PG18은 `anvil-f17-pg18-rc` Compose의 postgres/web/api/worker, 전용 internal+ingress network, PGDATA tmpfs, named volume 0, DB `127.0.0.1:32769`, Web `127.0.0.1:8300`이었다. DB image `sha256:5a9c2dbe6ab521f35e87c81124aa5137678992ddabb9c11ef46e04e5172af73c`(server `180004`), Web image `sha256:5f02bdbbc2e26844e07f3d34208162bdb9a73c82f04670ae223e331281f44a32`. API/Worker는 admin credential 없이 비-superuser `anvil_app`으로 접속했다.
- 두 환경 모두 임시 SAN 127.0.0.1 자체서명 cert와 QA Caddy의 `https://127.0.0.1:8443`에서 정상 Secure cookie jar로 테스트했다. 최종 8443/8300/32769 리슨은 모두 loopback. 합성 actor/project/token/승인 계보만 사용했고 실 key·외부 Provider 요청은 없었다.

## 실제 검증

| 항목 | 결과 |
|---|---|
| DB 공통 | PG15/18 각각 migration `0016_operations_recovery`, vector `0.8.2`, `[1,2,3] <-> [1,2,4] = 1`, HTTPS `/api/health/ready` 200. |
| PG15 핵심 E2E | `tests/integration/test_f17_runtime_e2e.py -k real_task_run_events`의 `phase=create` exit 0/1 PASS·타 환경 1 SKIP. Task `e8fcd5a2-d6c1-4c18-b0b7-d9a305194a1e`, Run `8e626a31-db66-4680-8fbc-63502dc3c4eb`, HTTP+DB 증거 `sha256:698a7a8081ea8c4ce14031b25495c1678282eed1e637fd1617bf0cab94b24d0a`. API 실제 재시작 후 `phase=events` exit 0/1 PASS·1 SKIP, SSE event ID=DB event ID, 증거 `sha256:d3f7ba71560a5a5b3812a1f6b3668701a79b7d406c3647480008aed9b5b230dd`. 환경 target `sha256:22536c6fdfa956f07ca05bc4823cc44e324108d671158277c422c09a1e8a2630`. |
| PG18 핵심 E2E | 동일 테스트 `phase=create` exit 0/1 PASS·1 SKIP. Task `72a30167-8cf0-45af-8581-c4d5f473ab17`, Run `4c9eea19-b938-4520-9187-e56d8c530218`, 증거 `sha256:1a5b75cb8083c38b5a1afb99ffcbd232fb67c02db960729d6e8d0e129b5c982f`. API 실제 재시작 후 `phase=events` exit 0/1 PASS·1 SKIP, SSE=DB, 증거 `sha256:ba12252369016e4b0c976890e4f4ded2a1b16e1f7459272df399f55da1541d89`. 환경 target `sha256:26da54f6f9a5c595bf463e16ed6137c889b4a250621844808296cb0c2fd316f2`. |
| PG18 실제 합성 DB 복구 | PG18 `pg_dump --format=custom --no-owner --no-acl` + 같은 major `pg_restore --exit-on-error`를 새 임시 DB에 실행. 최종 dump 192421 bytes, `sha256:cb6bd8508f9577ff58f875e5fdc44c5c646648f36c2ac86a265f64d73f3f9c72`; 원본/복구 migration·task·run·event·vector `0016|1|1|1|0.8.2` 일치. 복구 DB 잔류 0. |
| PG15·PG18 6계보/rollback | 공개 최종 tag의 F14 guard 테스트 `test_f14_isolated_pg_dump_restore_six_lineages_and_migration_boundaries[15]`·`[18]`를 각기 별도 labeled tmpfs/loopback 컨테이너에 실행, 각각 exit 0/1 PASS. version-matched dump/restore, project/task/run/approval/progress/terminal-learning/audit 계보, 유자료 `0016→0015` downgrade 거부 및 복구 오염 거부 확인. 기존 shared PG15 DB에 파괴적 downgrade는 시도하지 않았다. |
| 최종 Web 브라우저 | WSL 일회용 Playwright Chromium 1920×1080/390×1080 모두 `/` HTTP 200, `scrollWidth=viewport`, JS/page console error 0. Network는 `/`, JS/CSS, `/api/health/ready`의 `https://127.0.0.1:8443` 4건뿐으로 foreign/internal 직접 요청 0. screenshot SHA256: 1920 `cc22768bbd7bdcbb0b4faaaea5ecafa25422a4a0107614a6b07311df144c2485`, 390 `4290a7c4710dcbade3d6b634b94757192245ac3557a809c2ac1e8839f578e262`. UI는 Database READY와 함께 Environment NOT CONNECTED·Queue/Worker UNAVAILABLE를 표시했으므로 전체 업무 UI 정상으로 확대하지 않는다. |

Windows Main 독립 회귀는 `C:\Users\cyhuh\anaconda3\python.exe -m pytest -q -p no:cacheprovider --basetemp=<전용 경로> tests/deploy/test_f17_validation.py tests/integration/test_f17_runtime_e2e.py tests/deploy/test_f16_staging_compose.py tests/deploy/test_f16_release_manifest.py tests/api/test_local_session.py` exit 0 / **83 PASS, 2 SKIP**(opt-in live), Starlette warning 1. PG18 포트 실제 미게시를 발견한 뒤 Compose postgres를 isolated ingress에도 연결하고 테스트 RED(1 FAIL)→GREEN(83 PASS/2 SKIP)으로 고정했다.

## 관측된 차이·한계

- 첫 PG18 Compose의 DB는 Docker internal network에만 있어 선언된 loopback port가 실제 미게시됐다. 빈 tmpfs instance를 내리고 수정 후 `ss`에서 127.0.0.1:32769를 실측했다. 첫 QA Caddy의 `*:8443`도 즉시 중지해 `bind 127.0.0.1`로 재시작했다. 기존 서비스·방화벽 변경 0.
- PG18 Web nginx에 `/auth/session` POST를 직접 보내면 405였다. F17 HTTPS QA 게이트웨이가 `/auth/*`만 격리 API 내부 IP로, 나머지는 Web로 보내는 **same-origin QA topology**에서 Secure cookie E2E를 통과했다. **Web-only 직결 인증 경로는 PASS가 아니다.** F18 실제 배포 proxy/auth 라우팅과 F19/F20 동일 화면/API 흐름에서 재확인해야 한다. QA 게이트웨이는 제품 nginx 수정을 증명하지 않는다.
- PG15 F14 rehearsal 첫 컨테이너는 PG15 image의 `VOLUME /var/lib/postgresql/data`로 익명 volume이 생성돼 격리 부적합했다. 즉시 그 container와 정확한 익명 volume을 제거하고 PGDATA 경로를 tmpfs로 덮어 `Mounts=[]`를 확인한 뒤 PASS했다.
- 초기 PG15의 `509fb22`/이전 image 증거는 최종 비교에서 제외했다. 레거시 Docker 빌드가 동일 소스 재빌드에도 다른 ID를 만들어, 최종 PG15/PG18은 같은 실행 image `f6c481…`를 **유지한 채 순차 실행**했다. 두 환경 target hash는 환경 ID가 달라 서로 다르다.
- harness의 HTTP+DB 단일 관측 `ProductValidation`은 계속 `NEEDS_IMPROVEMENT`이다. Main의 위 전체 증거 합산 criterion별 최종 판단만 F17 범위 `SUITABLE`이며 ProductValidation API 501/미결선과 U-05 구현을 앞당기지 않는다. 사람 ReleaseDecision·사용자 인수·운영 배포는 만들지 않았다.

## 정리·복구

F17 PG15 DB·2 role 제거 후 기존 `anvil|anvil_app`을 확인했다. PG18 Compose container/network/named volume 잔류 0, 별도 PG15/18 rehearsal container·익명 volume 잔류 0, F17 image tag·TLS/browser container·`/srv/anvil-wsl/f17-rc(-qa)` 경로 잔류 0. 기존 `local-postgres`는 Up, `anvil-web`은 Up/healthy다. 합성 비밀·인증서·브라우저 산출물·tmpfs DB는 삭제돼 복구 불가하며, 소스는 공개 `f17-rc-7083e2a` tag에서 재checkout 가능하다. 운영 데이터/설정 rollback은 필요 없고 수행하지 않았다.
