# F-20/U-01 R7 경고 조회 차단 표시 계획

## 판정·근거

- 기준 브랜치는 `codex/f18-wsl-ops`, R6B 종료 기준선은 `ca4ddf324e8fc23b794363864ed24a3d958b1ad4`·Event seq1830이다. worker/write lease는 모두 회수됐다.
- 기존 `GET /api/operations/alerts`는 project/environment 범위와 `operations:alerts:read`를 검증한다. 현재 Dashboard는 성공 후 경고 목록을 보존하지만 조회 403도 `UNAVAILABLE`로 표시한다. 따라서 조회가 차단되었음을 운영자가 구분할 수 없다.
- 설계 §29.2, 작업계획 §13, 테스트계획 §10.8의 기존 `BLOCKED` 표시 범위 안의 내부 구현 보완이다. 경고 **조회**의 차단이지 Run `BLOCKED` 건수나 U-01 수락 판정이 아니다.

## 경계·검증

1. exact4 제품 경로는 `apps/web/src/console/App.tsx`, `apps/web/tests/f15-console.test.mjs`, `tests/browser/f20-u01-oidc-browser-pg15.mjs`, `docs/04_test_reports/F-20_U01_R7_ALERTS_BLOCKED_RESULT.md`다. 새 공개 API·scope·DB/migration·Secret·Production·새 브랜치는 제외한다.
2. 기존 성공·401·5xx·본문 오류·abort·페이지 연속 요청을 보존하면서, 응답 본문 소비가 성공한 403만 `BLOCKED`로 표시하고 이전 저장 경고를 제거한다. 원인을 특정 권한 탓으로 단정하거나 응답 원문을 DOM/로그로 노출하지 않는다.
3. Node 집중 테스트를 RED→GREEN으로 만들고, 가능하면 동일 SHA 로컬→private push→WSL-server 격리 PG15/OIDC/Chromium 기본 flag OFF 검증을 수행한다. 실제로 실행하지 않은 정식 E-SHOT/E-NET·U-01 전체 검증은 PASS로 표시하지 않는다.
4. Main은 기존 Event raw prefix를 보존하고 별도 epoch20 worker/write dual lease를 발급한다. 단일 Developer에게 제품 exact4만 맡기며 Main은 같은 파일을 동시에 수정하지 않는다. G-05·status·Git은 Main 책임이다.
5. C30 `OPEN_BLOCKING`, ReleaseDecision `DEFER`, Production `NOT_EXECUTED`, F-20/U-01 미수락은 유지한다. rollback은 R7 제품 변경 commit 이전 기준선 `ca4ddf32` 및 사설 원격 ref를 사용하고 history rewrite를 하지 않는다.
