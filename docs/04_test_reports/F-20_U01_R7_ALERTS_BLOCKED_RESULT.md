# F-20/U-01 R7 Alerts 조회 차단 표시 결과보고

## 판정

`R7_SCOPED_WSL_PASS_AFTER_RETRY; U01_F20_NOT_ACCEPTED`. 기존 scoped `GET /api/operations/alerts`의 403 응답을 본문 소비가 완료된 경우에만 Dashboard Critical Alerts의 `BLOCKED`로 구분하고, 이전 저장 경고를 화면에서 제거했다. 401·5xx·본문 읽기 실패는 `UNAVAILABLE`로 남긴다. Main의 동일 SHA 격리 WSL 재실행은 범위 한정 브라우저 흐름을 통과했으나 첫 실행의 403 본문 `UNREADABLE` 원인은 미확정이다. 이는 **경고 조회 차단**의 표시이며 Run `BLOCKED` 건수 또는 U-01/F-20 수락이 아니다.

## 동일 SHA WSL-server 실측·증거 (Main 실행, 본 writer 해시·철회 화면 대조)

- exact SHA `14694e5f7f7cfed946d450488e21d9febc87d129`. Main은 격리 QA에서 Node22 `npm ci` 29 packages, Dashboard 24/24, typecheck, lint 3 files, build 20 modules를 각 exit0으로 확인했다. tmpfs PostgreSQL 15의 비-superuser DB/role·loopback 5545·migration `0019_oidc_sessions`, 합성 HTTPS OIDC와 실제 Chromium을 사용했다. 정식 공유 WSL checkout은 변경하지 않았다.
- 같은 SHA·설정의 기본 OFF 1차 opt-in은 `1 failed, 16 deselected`, `stage=NETWORK_RESPONSE_FACTS category=ALERT_API status=403 reason=UNREADABLE`이었다. 403 응답 본문 캡처 실패의 원인은 **미확정**이며 UI 403→BLOCKED 구현 결함 또는 서버 원인으로 단정하지 않는다. Main이 첫 전용 DB를 완전히 제거하고 새 전용 DB로 재실행한 2차 opt-in은 `1 passed, 16 deselected, 1 deprecation warning in 11.44s`, exit0이었다. 1차 실패를 삭제·SKIP·PASS로 재분류하지 않는다.
- Main 수집 상대 경로와 본 writer가 로컬에서 재계산한 SHA-256: `docs/test_reports/U-01/evidence/r7-14694e5/page-requests.json` = `50ccf41eceb3060b13f2ad2a4a9d1a14b7853af722b3e3cac5e234f1b0075573`; `docs/test_reports/U-01/evidence/r7-14694e5/pre-auth-error.png` = `3c7a9042a6cde8ee7b762dfb8aa86ec8c2c68d065bd3b81c5db510222b409ede`; `docs/test_reports/U-01/evidence/r7-14694e5/stored-critical.png` = `f520060ce1caea84de18868e228e78d73fa0ffdf5a46ad52daf58e0deaafdede`; `docs/test_reports/U-01/evidence/r7-14694e5/revoked-blocked.png` = `6016836e721b83686ab495611786faeed2dc5a345800d044b8d0011d298f8b37`. 네 해시는 Main 전달값과 일치한다. Main 검증상 PNG 3개는 1920×1080, page URL 24건은 same-origin 1종·query/fragment/userinfo 0건이다. 원문 URL·인증자료는 이 보고서에 싣지 않는다.
- Main의 세 PNG 육안 대조는 pre-auth 오류→저장 Critical 경고→철회 후 `BLOCKED/조회 차단`·stale 경고 부재였다. 본 writer도 `revoked-blocked.png`에서 `Critical Alerts`의 `BLOCKED`·`조회 차단`과 저장 경고 부재를 직접 확인했다. PNG만으로 API 403이나 Network 완전성을 증명하지 않으며 이는 별도 브라우저 assertion·Network 기록에 의존한다. full URL의 loopback QA host는 정식 full E-NET 인수가 아니다.
- Main 보고상 정확한 전용 PG/browser/node/port/pytest/TLS/evidence 임시 자원과 QA node_modules/dist는 모두 정리돼 잔여0, QA checkout clean·G-05 seq1834 PASS다. 로컬 수집 증거 4개는 Main 소유 산출물로 보존한다. 본 writer는 WSL·Git·증거 원본을 수정·정리하지 않았다.

## 기준선·권한·변경

- 시작 branch `codex/f18-wsl-ops`, clean HEAD 및 사설 원격 기준 `8dbab30bdaf40d0897d217e7edeae4f0bbab96a2`. Main의 `docs/WORK_STATUS.md` 독립 dirty는 제품 시작 후 관측·보존했다. canonical seq1834, actor `developer-primary-f20-u01-r7`, epoch20 worker `worker-lease-f20-u01-r7-n0805`와 종속 write `write-lease-f20-u01-r7-n0805` ACTIVE, G-05 `PASS sequence=1834`를 제품 쓰기 전에 확인했다. WI SHA-256 `17D1710BA1F5937305FEF4AD6DB3A8CECE6BD5409F8B8E5631D687D43B80C39F`, Invocation `6207DD39D44E376768DA7A2243A8AAB6FF08E7CA8ACE33E15E0FC8BC030A397D`, binding plan `01EBB28672133EE0C5E7252A37EF54E8849AAEDE09F8B85294E84FCF9EF61EF6`.
- `apps/web/src/console/App.tsx`: Alerts 단일·이전 페이지 loader의 non-ok 본문을 기존대로 읽어 폐기하고, 읽기 성공 후 status 403만 `BLOCKED`를 반환한다. card는 generic `조회 차단`만 표시하며 경고 행·과거 페이지 버튼·응답 원문을 표시하지 않는다. React effect의 `AbortController` 확인과 이전 페이지 in-flight guard는 변경하지 않았다.
- `apps/web/tests/f15-console.test.mjs`: 403 본문 완료 전 미확정/완료 후 BLOCKED, 403 이전 페이지의 stale 경고 제거, 403 본문 읽기 실패의 UNAVAILABLE, 기존 401·5xx·위조 응답·성공 페이지 회귀를 검증한다.
- `tests/browser/f20-u01-oidc-browser-pg15.mjs`: 실제 OIDC permission 철회 후 API 403에 이어 card `BLOCKED`·generic 설명·`UNAVAILABLE` 부재·저장 경고 제거를 기다린 뒤 기존 Network/Secret assertion과 screenshot 흐름을 유지한다. 새 공개 API·권한·DB/migration·제품 다른 화면은 바꾸지 않았다.

## RED→GREEN·로컬 검증

| 명령·범위 | exit·관측 결과 |
| --- | --- |
| `npm run test:console -- --test-name-pattern="Critical Alerts 403 waits"` (`apps/web`) 신규 단일 조회 RED | exit1, 21 PASS/1 FAIL. 기존 `UNAVAILABLE`이 신규 기대 `BLOCKED`와 불일치. CLI의 pattern 전달에도 전체 22개가 실행됐으며 다른 실패는 없었다. |
| `npm run test:console` (`apps/web`) 이전 페이지 RED | exit1, 23 PASS/1 FAIL. 기존 이전 페이지 403 `UNAVAILABLE`이 신규 기대 `BLOCKED`와 불일치. |
| `npm run test:console` (`apps/web`) GREEN | exit0, 24 PASS/0 FAIL/0 SKIP. 기존 Provider·Database·Critical 성공/오류 회귀 포함. |
| `node --check tests/browser/f20-u01-oidc-browser-pg15.mjs`; `node tests/browser/f20-u01-oidc-browser-pg15.mjs --audit-self-test` | 각 exit0, `R6_AUDIT_SELF_TEST_PASS`. 실제 브라우저 실행 증거가 아닌 구문·격리 self-test다. |
| `npm run typecheck`; `npm run lint`; `npm run build` (`apps/web`) | 각 exit0. lint 3 files, build 20 modules. 사전 기록된 `apps/web/dist`는 Main이 정확한 worktree 내부 경로·root non-reparse·내부 reparse link0을 확인한 뒤 그 경로만 제거했고 잔여0이라고 전달했다. 본 writer는 정리를 실행하지 않았다. |
| `git diff --check`; `.\.venv\Scripts\python.exe -B scripts/check_project_progress.py` | 각 exit0. G-05 `PASS sequence=1834`. Main 소유 `docs/WORK_STATUS.md` dirty는 보존했다. |

## 미검증·위험·rollback

- 당시 로컬 인계 시에는 실제 WSL-server PG15·OIDC·Chromium의 403→`BLOCKED` DOM, 저장 Critical stale clear, 1920×1080 screenshot, same-origin Network가 **미검증**이었다. 이후 동일 SHA 격리 WSL 재실행의 범위 한정 실측은 위 절에 분리 기록했다. 기존 R6B `revoked-blocked.png`는 당시 `UNAVAILABLE` 화면의 역사적 증거이며 R7 결과로 재사용하지 않는다.
- 경고 조회 403은 scope/permission 외 host 보안 검증에서도 발생할 수 있다. 따라서 화면은 원인을 단정하지 않는 `조회 차단`만 표시하고 403 응답 본문·credential을 DOM/로그에 표시하지 않는다. 다른 Dashboard source와 Run BLOCKED 집계는 여전히 미연결이다. C30 `OPEN_BLOCKING`, ReleaseDecision `DEFER`, E-SHOT/full E-NET, U-01/F-20 전체 수락, Production은 이번 결과로 변경되지 않는다.
- 불채택 또는 회귀 시 Main이 기준 `8dbab30b`와 현재 diff·사용자 dirty를 확인해 R7 exact4의 이번 변경만 역방향 commit으로 되돌린다. 역사 보고서·WORK_STATUS·증거·공유 자원은 보존한다. 본 writer는 Git commit/push/merge·WSL 자원 변경을 수행하지 않았다.
