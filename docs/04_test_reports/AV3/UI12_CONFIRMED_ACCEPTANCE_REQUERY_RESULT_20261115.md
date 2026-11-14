# UI12 확정 수락 결과 명시 재조회·확정 상태 보존

## 변경

원 수락 결과 검산/CONFIRMED CAS 후 별도 현재상태GET이 실패하면 수락 결과를 다시 열 수 없던 화면에 기존 acceptanceResult GET 명시 재조회를 연결했다. 원 명령·보호요약·현재 주체/클라이언트·요청수명에 결박하고 역사결과로현재권위를갱신하지않는다. 재현중확정CAS뒤빠른현재GET실패가React이전buffer를읽는공통catch로가UNKNOWN재CAS가능함을확인해확정후읽기오류를분리했다. 새수락POST/승인/권한/API/SQL0.

## 기준·범위

기준main50d1aed611886ca3053d336adf1c9960eff3948a, 기존developer_primary 단일writer/Main검수·통합. WI UI12_CONFIRMED_ACCEPTANCE_REQUERY_WI_20261115.md의r2는확정단조성내부보완,r3는기존인접시험선택자1개수정이다.

apps/web/src/features/control-handoff/ControlAccessPage.tsx
SHA256: C797CD3B13CEA5E64AA229CCA2EAC03240D86A03E5AA646240732E881C75D155
tests/unit/UI12/control-acceptance.test.ts
SHA256: E8CF5D4F61007BB5F8EE7BBF7DA450E969ACDBA457253764975D5D8673FC2E44
tests/unit/UI12/control-access-pagination.test.ts
SHA256: 67C50C6B2E88832E27D44492FCDF48F133ADCA7A16062C0F00376B1BA64247C2

## 검증·실패

- 내부즉시실패관측3회후무목적반복중지. 정식실패보고3회/인수trigger아님. Main79~95행원인확인과Primary trace RED0ba0e2 exit1: 원수락POST/결과GET→CONFIRMED CAS→후속stateGET503뒤UNKNOWN역행. 대기를늘리거나기준완화하지않았다.
- 빠른503보완 GREEN6e39b9:1P0F0SKIP exit0/2132.4768ms.
- 수행자직접신규·기존7P/typecheck진단0 exit0(17f44c), scoped diff0.
- 필수인접4파일25P1F(9bc771). 실패1은기준main에이미없는'인수 수락 (미구현)'버튼을찾던기존시험이며실제이름'인수 수락 명령 보존'으로selector만교정. disabled/원버퍼/재전송단언유지. 해당반례만재실행1P0F0SKIP exit0/1235.1775ms(bd004d),diff0. 서로다른실행결과이며전체한번26P라고합치지않는다.
- Main node --test --test-name-pattern="확정 수락" tests/unit/UI12/control-acceptance.test.ts —3P0F0SKIP exit0/2425.7277ms(9c02b8):즉시/지연실패·명시GET복구,오류/다른원명령거절·닫기/주체교체뒤응답폐기. 원CONFIRMED객체보존·추가POST0·현재제어상태불변.

실제React/기존RAM행동검사이며실제브라우저/DB/권한/키/서비스/Agent/네트워크미실행. 전체UI12/FN15/계획인수미완료. 최종독립검수·통합근거는WORK_STATUS후속참조. 복구는정확3경로이번diff를이전main으로되돌리는변경이며지속데이터변경0.
