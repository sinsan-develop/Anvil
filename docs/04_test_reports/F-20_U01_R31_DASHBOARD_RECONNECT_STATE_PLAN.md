# F-20/U-01 R31 Dashboard 재연결 상태 구현 계획

> 승인된 설계 §29.2·작업계획 U-01·통합검증매트릭스 §6.11·테스트계획 §10.8의 공통 `reconnect` 상태 중 Dashboard read retry만 분리한다. R30 close seq1980 no-lease에서 새 WorkInstruction과 유효 dual lease 전 제품 write 금지.

목표: Dashboard 조회 실패 후 사용자가 재연결을 시도하는 동안 `RECONNECTING`을 정직하게 보여주고, 같은 origin의 기존 GET 한 건으로만 회복한다. 서버 연결/Run/SSE가 복구됐다고 앞질러 표시하지 않는다.

구조: 기존 `GET /api/dashboard/operations`와 응답/권한 계약을 그대로 둔다. `Shell`의 controller identity·in-flight guard를 재사용한다. `UNAVAILABLE`에서만 명시적 `대시보드 연결 재시도` 조작을 제공하고, 시도 중 종속 Queue/Health/Next Actions/관측 시각은 재연결 중·보호 값 없음으로 표현한다. 독립 Provider/Critical Alerts와 Database API 준비 정보는 유지한다. 자동 재시도·새 endpoint·SSE `Last-Event-ID`는 없다.

검증: focused RED→GREEN에서 `UNAVAILABLE`→`RECONNECTING`→엄격 200 `LOADED`, 사용자 취소 `CANCELLED`, 401/403 `BLOCKED`, 429 `QUOTA`, 500/503·전송·형식 오류 `UNAVAILABLE`, 중복 GET0·늦은 old 결과 무시·Secret 비노출을 확인한다. 실제 WSL-server 격리 PG15/OIDC/HTTPS/Chromium에서 저장 Next Action 이후 결정론적 연결 실패/재시도/회복/거부 전이를 클릭·키보드·DOM·same-origin Network로 확인한다. 기존 R6/R23~R30 증거는 삭제·완화하지 않는다.

작업 경계: 기존 `codex/f18-wsl-ops` branch 하나만 사용. 제품 변경은 Dashboard client/UI·console test·기존 browser harness·Python strict evidence와 결과보고서로 한정. 공개 API/schema, DB/auth/Secret, backend Run/Task lifecycle, B-11 SSE, 필터·운영 수치, Production/ysna, main 병합·새 branch 제외. local 검증→검증 checkpoint/private `development` push→WSL-server 동일 clean SHA 실제 QA→전용 자원 정리. R31 PASS는 F-20/U-01 전체 인수가 아니다.

Rollback: R31 exact scope만 정상 Git revert, R30 및 Event 원문 prefix 보존.
