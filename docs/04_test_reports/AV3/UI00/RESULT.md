# UI00 중간 결과 — 부분 구현

2026-10-16 Main 어울 / codex/av3-stage-b / base main f976ed5e(PR41).

- 프로젝트 중심 shell·남색/파랑·PC/모바일 공통 탐색·hash 경로/뒤로/새로고침·도움말/focus·same-origin 읽기 client를 구현했다. Dashboard를 첫 화면으로 만들지 않았다.
- `npm run build`: 타입/22모듈 PASS. `npm test`: 기존13+UI00 4+FN01 auth3=20 PASS, skip0. API3와 route1의 실제 assertion RED→GREEN, Edge UI00 두 건도 기존 준비 화면에서 RED→GREEN이다.
- Edge155/Playwright1.64.1·TLS무시false·정확 localhost3830. 실제 미구현 session404를 오류로 표시하며 빈 목록·로그인 성공으로 바꾸지 않았다. 모바일430×844 키보드 메뉴/뒤로/새로고침·가로 넘침 없음 확인. 실제 브라우저는 미커밋 Web build를 읽었으며 서버 준비 source base는 f976ed5e다. 이 결과를 clean exact SHA WSL 시험으로 표시하지 않는다.
- 오류: 최초 fresh unit1실패는 ignored dist build 선행 누락→동일기준 build/test13 PASS. API import 부재1은 기능 RED 아님→최소 진입점 뒤 assertion RED3/GREEN3. CSS 선언 오류1→Vite client 타입 선언. 잘못된 project UUID1 RED→정확 형식 거절 GREEN. native fetch receiver1 실패→실제 Edge window/object 비교(404 vs Illegal invocation)→원래 window receiver 호출만 수정·동일 browser2 PASS. 원래 실패는 숨기지 않는다.
- 미완료: 실제 로그인·만료 후 입력 보존/재인증·실제 프로젝트/역할·단독 제어·공통 미저장/충돌·PC2규격/200%·대비·FN01/FN11 연결 검수. 미구현 화면은 아직 연결되지 않았다는 안내이고 실제 기능 성공이 아니다. UI00 [2] 유지, 전체 완료 아님.
- 실제 Node30072(startUTC2026-10-15T19:26:50.5534635Z)는 새 branch의 준비 source로 시작했으나 구 script receipt branch 상수는 Stage A를 표시했다. 실제 Git과 불일치를 기록하고 이후 시작은 실제 branch·dirty상태를 담도록 보완한다. 기존 receipt를 조작해 소급 정정하지 않는다.
- 등록 임시 경로는 D:\tmp\anvil-v3-stage-b\browser·npm-cache. 단위/브라우저 증거는 해당 코드 범위에만 재사용하며 전체 제품/Agent/WSL/Oracle PASS가 아니다. 정확 회수/정리 후 잔여를 WORK_STATUS에 기록한다. 개발 DB·CA/공유 relay 보존.
- 다음: FN01 실제 DB/API/로그인 연결→UI00 남은 동작 검수→UI01/02 및 FN11. rollback은 해당 UI00 source 변경만 비교하며 자동 reset/자료삭제를 하지 않는다.
