# F-20/U-01 R32 Next Actions 경과시간 절편 계획

> 승인된 설계 §29.2의 Next Actions 경과시간을 기존 Dashboard read snapshot에서만 구현할 수 있는지 검증한다. R31 close seq1986 no-lease가 기준이며 새 유효 WorkInstruction·dual lease 전 제품 write 금지.

목표: 같은 응답의 미해결 alert와 next_action이 정확히 1:1로 대응하고 발생시각이 유효할 때만 경과시간을 표시한다. 시간 기준은 응답 `observed_at`을 사용해 브라우저 로컬 시각 조작·탭 체류에 따른 허위 카운트를 피한다. 대응 실패, 중복, 미래 시각, 불일치는 `경과시간 확인 불가`로 보이고 0분으로 단정하지 않는다.

구조: 서버의 기존 `GET /api/dashboard/operations`, 엄격한 read 파서, same-origin 호출을 유지한다. `next_actions`의 다섯 필드와 snapshot의 `alerts`를 명시 필드로 교차 검증하여 고유 매칭만 표시한다. `resolved` 경고는 후보에서 제외한다. 보호 응답이 401/403·429·오류·취소·재연결 중이면 R30/R31처럼 모든 Next Action과 경과시간을 숨긴다. 새 자동 요청·타이머·API/schema 변경 없음.

검증: RED→GREEN 단위 테스트에서 단일 매칭, 중복/불일치/미래·불량 시각, 권한 철회·오류·취소·재연결과 기존 R31 회귀를 확인한다. WSL-server 동일 clean SHA 격리 PG15/OIDC/HTTPS/Chromium에서 저장 Next Action의 실제 브라우저 DOM·same-origin Network를 확인하고 전용 자원 잔여0으로 종료한다. 실제 검증 실패는 PASS로 승격하지 않는다.

범위: 기존 `codex/f18-wsl-ops` branch. 단일 Developer의 exact 제품 write scope는 `App.tsx`, console test, 기존 browser harness, Python browser integration test, R32 결과보고서로 한정한다. Project/Environment/기간 필터, 운영 카드, Critical 확인 mutation, 공개 API/schema·DB/auth/Secret, backend Run/SSE, Production/ysna, main 병합·새 branch는 제외한다. R32 PASS도 U-01/F-20 전체 인수가 아니다.

Rollback: R32 exact 제품 범위만 정상 Git revert하며 R31 결과·Event 원문 prefix는 보존한다.
