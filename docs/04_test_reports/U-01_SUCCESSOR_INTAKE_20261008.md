# U-01 Dashboard 후속 착수 대조 / 2026-10-08

## 판정

`F-19A_MAIN_INTEGRATED / U-01_VERTICAL_NOT_ACCEPTED / CONTRACT_BOUNDARY_OPEN`

이 기록은 설계·계획 변경이나 새 공개 API·DB·권한 계약 승인이 아니다. 개발 범위는 로컬과 `ssh WSL-server` QA이며 Production·ysna-server는 제외한다.

## 근거

- F-19A PR #39의 병합된 원격 `main`은 `0443043251d25aa77c17d23165b7c9299c8dbeb8`이다. 병합된 main의 tree는 작업 branch의 merge tree와 같고, 실제 clean main checkout에서 `--f19a-whitespace-merged-smoke`가 PASS했다. 이전 작업 branch와 Broker 임시 tag는 로컬·원격에서 정리했다.
- 최신 main에서 단일 후속 branch `codex/u01-dashboard-r2`를 생성했다. 시작 HEAD는 위 main SHA이며, 격리 checkout을 재사용했다. main 기준 `npm run web:test`는 86 PASS다. 기존 `.pytest_cache`는 Windows 접근 경고가 있으나 사용자 자료로 보존하고 ACL·삭제를 하지 않았다.
- 기존 `U-01_DASHBOARD_REPORT.md`의 판정은 `ACCEPTED_U01_LOCAL_WEB_SCOPED`로, 실제 WSL 브라우저·DB·다중 정확 pair·기간별 read model은 미검증이었다. 이를 계획 §13의 수직 `ACCEPTED`로 승격하지 않는다.
- 현재 공개 `GET /api/dashboard/project-environments`는 F-19A 등록 원장과 정확 pair grant의 목록이다. `GET /api/dashboard/operations`는 host 고정 scope의 현재 snapshot이며 기간 인자를 받지 않는다. 현재 Web Dashboard는 그 고정 GET을 사용하고 Project·Environment·1/7/30일 필터를 렌더링하지 않는다.
- 설계 §29.2는 사용자 승인을 받은 정확 pair, Asia/Seoul 오늘 포함 1/7/30 달력일의 UTC `[start,end)`, 현재 상태와 기간 발생의 구분, 근거 불완전 시 `UNAVAILABLE`을 요구한다. 같은 조항은 상세 공개 API와 지속 데이터 계약을 별도 승인 경계로 남긴다.

## 영향과 다음 조치

1. Main은 F-19A 병합·브랜치 정리 사실을 기존 append-only progress에 후속 Event로 결박하고, 새 U-01 branch용 G-05 경로를 재검증한다. 이전 `F19A_INTEGRATION_WHITESPACE_GATE_CLOSED_EXACT_MAIN_MERGE_PENDING` 투영을 완료 사실로 오인하지 않는다.
2. 새 공개 scoped Dashboard read API·기간 원본·인가/DB 변경이 필요한 범위는 계약이 확정되기 전 제품 write를 하지 않는다. 기존 GET/ACK 의미를 암묵적으로 변경하지 않는다.
3. 영향 없는 기존 경로의 로컬 단위·Web 회귀, 정확 pair 목록/현재 snapshot의 evidence 검토, 실패-폐쇄 UI 계획은 계속할 수 있다. 이후 정확 commit을 push하고 WSL-server에서 Git으로 받아 PG15/OIDC/HTTPS/Chromium, same-origin Network와 원본 근거를 검증한다.

미검증: U-01 수직 API·DB·브라우저·독립 Tester 인수. Release `DEFER`, Production `NOT_EXECUTED`.
