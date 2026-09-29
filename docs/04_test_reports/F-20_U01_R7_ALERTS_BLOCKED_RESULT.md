# F-20/U-01 R7 Alerts 조회 차단 표시 결과보고

## 판정

`COMPLETED_LOCAL; WSL_BROWSER_UNVERIFIED`. 기존 scoped `GET /api/operations/alerts`의 403 응답을 본문 소비가 완료된 경우에만 Dashboard Critical Alerts의 `BLOCKED`로 구분하고, 이전 저장 경고를 화면에서 제거했다. 401·5xx·본문 읽기 실패는 `UNAVAILABLE`로 남긴다. 이는 **경고 조회 차단**의 표시이며 Run `BLOCKED` 건수 또는 U-01/F-20 수락이 아니다.

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

- 실제 WSL-server PG15·OIDC·Chromium에서 403→`BLOCKED` DOM, 저장 Critical stale clear, 1920×1080 screenshot, same-origin Network는 Main의 새 exact SHA 검증 전까지 **미검증**이다. Node self-test와 build PASS를 실제 브라우저 PASS로 승격하지 않는다. 기존 R6B `revoked-blocked.png`는 당시 `UNAVAILABLE` 화면의 역사적 증거이며 R7 결과로 재사용하지 않는다.
- 경고 조회 403은 scope/permission 외 host 보안 검증에서도 발생할 수 있다. 따라서 화면은 원인을 단정하지 않는 `조회 차단`만 표시하고 403 응답 본문·credential을 DOM/로그에 표시하지 않는다. 다른 Dashboard source와 Run BLOCKED 집계는 여전히 미연결이다. C30 `OPEN_BLOCKING`, ReleaseDecision `DEFER`, E-SHOT/full E-NET, U-01/F-20 전체 수락, Production은 이번 결과로 변경되지 않는다.
- 불채택 또는 회귀 시 Main이 기준 `8dbab30b`와 현재 diff·사용자 dirty를 확인해 R7 exact4의 이번 변경만 역방향 commit으로 되돌린다. 역사 보고서·WORK_STATUS·증거·공유 자원은 보존한다. 본 writer는 Git commit/push/merge·WSL 자원 변경을 수행하지 않았다.
