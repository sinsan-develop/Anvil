# UI06 과거 작업계획 검토·확정 이력 조회 결과 — 2026-10-31

## 판정
기존 GET을 소비하는 한정 화면 기능을 구현하고 핵심 동작을 확인했다. 실제 served/DB·전체 UI06/Stage B/WORK_PLAN 완료나 사용자 인수 판정은 아니다.

- 기준 WI: UI06_HISTORICAL_WORK_PLAN_DECISION_READ_WI_20261031.md / SHA94D70A70485D4380AF8127DBA20A5250EA75064B8853FAC0BD0D51B200665579.
- SCREEN_WORK UI06의 검수/승인·버전 이력, FUNCTION_WORK FN04 historical_evidence_remains_readable의 기존 승인 범위다. 새 API/DB/권한·정책·쓰기 계약0.
- 기존 Primary 단일 구현, Main 검수·통합, 기존 Reviewer 읽기 검수. 시작 HEAD2de6496f70c36b67a0878eb497480ee630c32187 / codex/av3-stage-b. Main의 제품 코드 수정0.

## 실제 변경
- WorkPlanVersionHistory.tsx 1파일에서 과거 정확 버전의 ‘이 버전 검토·확정 이력 조회’·닫기·재조회를 기존 readWorkPlanDecision에 연결했다.
- 과거 확정 당시 reviewRefs와 해당 버전의 검토 목록, 과거 확정 이력과 응답의 현재 유효성 true/false를 구분한다. 현재 적용·실행 허가로 승격하지 않는다.
- 로딩/빈 이력·403/404/손상 응답을 표시하며, 활성 401만 로그인 만료를 전달한다. 닫기·이탈·버전/사용자/프로젝트/client/ApiClient·mutable transport 교체와 느린 JSON 뒤의 결과·오류를 버린다. 중복 입력은 GET1, POST0이다.
- 기존 원문 조회·비교·부모 편집/최신 계획 이력·API decoder·서버·SQL·전역 CSS는 불변이다. 기존 Operate 화면과 12px 기준을 유지했다.

## 검증
고정 실행기 C:/Program Files/nodejs/node.exe.

```powershell
node --test tests/unit/UI06/work-plan-history-decision.test.ts tests/unit/UI06/work-plan-decision.test.ts tests/unit/UI06/work-plan-pane-keys.test.ts
node node_modules/typescript/bin/tsc --noEmit -p tsconfig.base.json
```
- Main d77ed3: **12PASS/fail0/skip0·type exit0**. 신규8 + 직접회귀4이며 실제 TSX/ReactDOM/ApiClient/원 decoder와 소형 메모리 DOM을 사용했다. 레이아웃·브라우저 보안을 이 시험으로 증명하지 않는다.
- Primary de67f0 신규8PASS, 7b34be 직접4PASS/type·Web 메모리build482modules0·impeccable 대상 detect `[]`/exit0. c6a59f diff0.
- 독립 문서/코드 검수 C0/I0. 최종 제품 지문 B1095ED8…, 신규시험 C3657F2F…를 확인했다.
- RED 정정: 초기228e1e는 원문 native digest 완료 대기가 부족해 기능 RED로 채택하지 않았다. 실제 원문 표시·검산을 기다린 뒤 신규 호출선을 제거한 ba0340에서 버튼 부재 RED/exit1, finally 원바이트 복원=True를 확인하고 정상4732fa GREEN을 기록했다.

## Main 실제 Chromium — 합성 transport
- 등록 전용 QA D:/tmp/anvil-v3-stage-b/ui06-history-decision-20261031-01, SINSAN/cyhuh 소유·경로 부재/link0 확인 후 생성, TTL30분/최대8MiB. 실제 UI source B1095ED8…로657,584bytes 메모리 번들을 만들었다(05bb81). 실제 사용자 파일/DB·서비스/Agent·listener0이다.
- ego space15/p1, file-origin·CSP connect-src none·합성 ApiClient transport,1920×1080 기준으로 확인했다. a67a56 최초 화면에서 자동 GET0.
- e7f9bf: 과거v1 원문→명시 이력 조회, GET2·POST0, 과거확정 있음/현재무효 표시·가로 넘침0·resource request0. 스냅샷과 screenshot을 Main이 실제로 확인했다. 원래 v2 관측과 분리된 v1이었다.
- 닫기 관측식이 body.textContent의 inline script 문자열까지 읽어04ca04 timeout이 났다. 2beadf 읽기 진단에서 실제 root 이력은 닫혔고 body에만 문자열이 남음을 확인했다. 제품 실패가 아닌 Main 관측 오류1이며 클릭을 맹목 반복하지 않았다.
- 5bc31b는 실제 root DOM/innerText로 명시 재조회·확정 당시 reviewRef8/현재 reviewRef9의 펼친 표시·현재무효·닫기 후 원문 보존을 검증했다. 최종 GET3/POST0·추가 resource0·lost callback0이다. 이 별도 보완 결과를 최초 timeout의 PASS로 소급하지 않는다.
- screenshot SHA BA71E74EEFD2D3E3432AAB2B1ADE7149F452DF69AA96D4BF38AA759850F929E0. 임시 파일은 확인 후 정리했다. 전체 App/실 HTTP·권한/DB·모든 브라우저/기기 인수는 미검증이다.

## 오류·정리·보존
- Primary의 경로 인자·Vite entry/반환·소형DOM options·타입/인코딩 준비 오류는 별도 이력으로 보존했다. act가 만든 MessageChannel만 회수한 뒤 시험 session 종료/최종 live handle0, 동일 유효 FAILURE_REPORT3회 없음.
- 5bc31b에서 space15.finish({keep:[]}) 정상1회 완료. 7c1ed0에서 등록9파일745,055bytes·정확 소유/link/이름/예산 검산 후 전용 폴더만 정리했다. Main ba44d9 별도 조회에서 경로 부재=True 확인. 기존 사용자 탭·완료 space9/10·다른 프로젝트 변경0.
- Main ba44d9: 제품 B1095ED8C68E6F8AEF03252B6D2B64D99D6B826437FD9C3888804699EAFA6E88, 신규시험 C3657F2F6AFBA2941FA5FF2741FFCD518C8FE401A535DCB1FE55A4ED0A5DAB63 불변/diff0.
- reader work-plan-decision-api.ts SHA148B6BE29E5D8C07F04FCAD5F2B71624473F5036379AABC04EC4914C8483E5BF, 부모 WorkPlanLibrary.tsx SHA4E154F8834AADFF791467690E73AC305FD3206069B5EE8349184D8E9F53F9294 불변.

## 사용 위치·다음 범위
반영 후 UI06 → 보관 작업계획 → 보관 버전 열기 → 이 버전 검토·확정 이력 조회에서 사용한다. 이번에는 실제 개발 서비스를 반영하지 않았다. 현재 served에서 새 기능이 보인다고 보고하지 않는다.

검수된 source만 기존 branch/private에 통합한다. 롤백은 기존 원형과 새 정상 수정 commit으로 하며 reset/force/history rewrite·실제 DB 롤백0이다. 별도 FN14 결정안은 미채택 자료이며 이 UI 구현 승인으로 채택하지 않는다. Main은 다음 미완료 승인 범위 구현을 계속한다.
