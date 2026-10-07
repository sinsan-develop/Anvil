# F-19A Task4 WSL-server 격리 QA 보고

## 판정

**PARTIAL / REWORK.** Private branch `codex/f18-wsl-ops`의 exact clean source `c8a024044d3a7fc207d4abdaab5c282983c481aa`를 WSL-server에 Git clone해 격리 QA를 수행했다. F-19A `ACCEPTED` 아님, Release `DEFER`, Production `NOT_EXECUTED`다. `ysna-server`와 공유 DB·공유 Web는 사용·변경하지 않았다.

## 실측 증거

- WSL checkout의 `HEAD`와 `development/codex/f18-wsl-ops` 모두 위 SHA, branch `codex/f18-wsl-ops`, `git status --porcelain=v1 -uall` 공백. 로컬 문서 사전 계획 commit과 private ref도 같은 SHA였다.
- 전용 PG15 `pgvector/pgvector:0.8.2-pg15` image `sha256:75f6767185020459c7e2c3f88fb66f1bd2d9790c435bc91512497146c8bf8d7e`, DB/role `anvil_f19a_ff75266`, loopback `127.0.0.1:5546`. Alembic `0020_f19a_pair_grants` 적용 후 opt-in `tests/integration/test_f19a_oidc_pg15.py` **2 PASS/1 Alembic deprecation warning**, exit 0. 등록·정확 grant·철회와 fix-forward 단위 DB 경로를 실제 PG15에서 실행했다.
- 데이터 존재 시 `alembic downgrade 0019_oidc_sessions` exit 1 `DEPLOYMENT_ROLLBACK_DECISION_REQUIRED`, head0020 유지. `pg_dump -Fc` SHA256 `c6abe9fb4a73231c59ea4a4fa1d2788d0b043646f43a1d9303324bc7f00de2f0`의 TOC와 핵심 데이터 확인 후 같은 전용 DB에 `pg_restore --exit-on-error` exit 0. 복원 전후 head0020, audit6/project1/grant3 동일. 첫 restore는 pg_dump가 `public` schema를 만들지 않는 전제 때문에 실패했고, DDL 확인 후 전용 DB에 schema 생성하여 재실행했다.
- 같은 DB의 새 QA seed에서 `f19a_qa_bootstrap.py` preflight `F19A_QA_CREATABLE`, seed `F19A_QA_CREATED`, 멱등 seed `F19A_QA_UNCHANGED`, 합성 reader·세 정확 grant 후 `F19A_QA_READY`. 철회 후 readiness는 exit2 `F19A_QA_READINESS_INVALID`; 이전 SHA rollback-check는 exit2 `FIX_FORWARD_REQUIRED`.
- 제한된 Git archive로 Web/API/Worker/Issuer 네 이미지를 같은 SHA revision label로 빌드했다. 전용 Compose project에서 API는 별도 검증된 PG15 DB를 사용했고 HTTPS `/`, `/api/health/ready`, OIDC JWKS 모두 200. Cached Playwright v1.62.1 image `sha256:fee853fafa59550d162cef52bca02d907694b44ebf6ef9fb075bcc0c65d8dedb`를 전용 network·임시 profile·readonly source/material로 실행했다. Reader의 새 OIDC 세션에서 `F19A_QA_BROWSER_GRANTED_PASS`, `dashboard:read` 철회 후 새 세션에서 `F19A_QA_BROWSER_REVOKED_PASS`(각 exit0); 스크립트가 same-origin API 요청과 정확 pair 1→0을 검증했다.

## 미해결·미검증

- `other-actor` phase는 QA issuer의 첫 subject가 관리자 bootstrap role(`projects:register`, `pair-grants:manage`)이므로 `GET /api/dashboard/project-environments`의 coarse `dashboard:read` 검사에서 실제 403이다. 브라우저 스크립트는 200/빈 목록을 기대하여 exit1 `F19A_QA_BROWSER_FAILED`. OIDC 로그인·callback·session은 각 200이었고 이 실패를 PASS로 승격하지 않는다. 승인 Spec은 정상 권한 actor의 무 grant 목록만 200 빈 목록, 인증/권한 거절은 403으로 구분한다. 다른 actor 음성을 충족하는 QA actor/기대값을 별도 WI로 정합화해야 한다.
- Worker는 OIDC DB head `0019_oidc_sessions`만 기대해 0020에서 `migration_head_mismatch` exit1. 기존 Worker 프로세스의 호환성 회귀를 검토·수정하고 0019/0020 양쪽 회귀를 재검증해야 한다.
- 기존 `GET /api/dashboard/operations`, `GET /api/operations/alerts`, `POST /api/operations/alerts/{alertId}:acknowledge`의 실제 브라우저/HTTP 철회 다음 요청, DB 장애 fail-closed, 다른 actor의 정상 빈 목록, 독립 Tester의 `AV-OPS-026`·`AV-SAFE-034` 판정은 이 실행에서 미완료다. `F19A_QA_BROWSER_SELF_TEST_PASS`는 실제 브라우저 증거로 사용하지 않는다.
- 명령/환경 오류는 초기 SQL `$$` shell 치환, 첫 restore의 public schema, API Docker legacy builder의 선행 web 입력, issuer synthetic secret의 후행 newline, API 재생성 뒤 Nginx upstream 캐시 및 재기동 readiness 시차, rollback 코드 접두어를 잘못 둔 assertion 각 1회 이상을 원인 확인·전용 QA 절차에서 보정했다. 최초 실패 기록은 보존한다.

## 종료와 다음 조치

전용 Compose container 6개·network 2개·익명 volume 1개, 별도 PG15 container·network, 신규 이미지 tag 4개, checkout/material/browser-profile 세 경로를 정확 identity·realpath·owner 확인 뒤 제거했다. 최종 전용 container/network/volume/image tag/8444·5546 listener/경로 잔여0. 공유 Web ID `f0107aada3b26ea84950d5561fdd1d13759090096601854720acae5448684738`와 공유 PG ID `99f3bf939d40c265f44bc330fb143675ecad96c9ab27bd517500ef04eaa2506c`는 running 불변. 합성 키·credential·DB/backup·프로필은 삭제되어 복구되지 않으며 source는 private Git에 남는다.

Main이 승인된 F-19A 범위의 미해결 QA/Worker 호환성에 대해 새 정확 WI와 dual lease를 발급하고 단일 Developer가 수정·검증한 뒤 exact SHA로 WSL-server QA를 재실행한다. F-19A 수락 전 U-01 write·release·Production은 진행하지 않는다.
