# UI02 기준선 설계 선택·명시 저장 실제 React 합성 여정

판정: 동결 시험의 Main 집중7 PASS. 독립 최종 검수·게시·통합은 후속 기록으로 대조한다. 전체 UI02/FN01·served/실DB/사용자인수·작업계획 완료 아님.

## 기준과 소유
WORK_PLAN Stage B UI02/FN01의 기존 화면 여정 검수다. WI UI02_BASELINE_DESIGN_SCREEN_JOURNEY_WI_20261108.md SHA256 c297a0b01d632fdca926af9d7bfe4964bf21aa28ef72bc9ffec9a1300d6e37f9·독립사전60c617 C0/I0. 구현시작 안전게시본2c5b5158, branch codex/av3-origin-technical-contract. 기존 Primary 단일 writer는 신규 tests/unit/UI02/baseline-design-screen.test.ts 한 파일만 작성했다. Main은 문서·검수·통합만 담당했다. Main9bc014의 main대비 apps/db diff0도 확인했다. 기존제품/시험·의존·SQL 변경0이다.

## 실제 소비한 여정과 한계
기존 MemoryNode/Vite write:false 선례에서 실제 React ProjectBaselinePanel→BaselineDesignPicker→readBaselineDesign→setBaselineDesign→명시 saveBaselineDraft→실 sendBaselineCommand를 호출한다. 가상 transport는 정확 예상 경로/method/body만 수용하며 일반 성공 fallback이나 DTO 직통 state 주입으로 완료를 만들지 않는다.

- 정상4종 각각/묶음의 문서·본문·AF02를 검산해 root designRef1만 부모에 commit하고 선택POST0/명시저장POST1을 확인했다. 원 UUID/body·Idempotency-Key/CSRF·same-origin과 strict hash snapshot·false flags·saved/dirtyfalse/pendingnull을 실제 부모에서 확인한다.
- 403·hash-valid 출처오염·본문/양식변조는 원 연결을 보존하고 새반영/POST0이다.
- metadata/body/form 대기 중 buffer/owner/client 변경, unmount, 부모CAS거절·제어세대교체를 검산한다.
- 결과 유실은 원packet UNKNOWN/자동POST0·명시재확인 동일ID/body만 허용한다. hash까지 일관된 true권위표식 응답도 거절하고 원pending을 보존한다.

이는 실제 React 상태·이벤트의 합성 여정이며 실제 served 브라우저/Network·서버DB·사용자인수를 대신하지 않는다. 실제 DB·권한·키·서비스·Agent·SSH·사용자 자료·J3·P03 실행0이다. FN03 관리origin 후보/기술문서는 미채택 GO0이고 이 시험으로 채택되지 않는다.

## 정확 검증
- Primary c27b31: `node --test tests/unit/UI02/baseline-design-screen.test.ts` 7PASS/skip0, 자연terminal exit0.
- 이후 true권위표식의 hash를 일관되게 강화했다. Primary3985e7 `node --test --test-name-pattern='strict 저장결과' tests/unit/UI02/baseline-design-screen.test.ts` 해당1PASS/exit0, 나머지6본문불변. 앞7과 고유8건으로 합산하지 않는다.
- 최종 Primary `npm run typecheck` d46dac/session39566→069c34 exit0. 앞140e21/session89580→0e84ac도 exit0이나 최종과 별도다.
- Primary `git diff --check` 및 신규 whitespace00060b exit0.
- Main8877d0: 최종동결 SHA를 먼저 대조한 뒤 신규파일7전체를 실행, 7PASS/fail0/skip0/자연terminal exit0, 1320.8576ms. 기존helper12 재실행0이다.

## 준비 오류·회수
9f269f exit1 UNRESOLVED_ENTRY는 Vite 가상 entry exact-match 준비오류1이었다. 선례의 endsWith resolver로 보정했다. 후속89eb7e/session65930은 첫FAIL 뒤 종료/stack미출력이어서 같은handle만추적했고 재실행하지 않았다. sandboxCIM67c798 실패를 PID0으로 오인하지 않았다.

소유metadata1a50ca는 parent14344(부모39152/시작12:45:07.263552+09), child23904(부모14344/시작12:45:07.336206+09)를 확인했다. 같은명령경로/생성시각/부모 재검산 뒤 child23904만1회 수동회수76c4a1 exit0, 원65930→8ee840 exit1/1FAIL을 회수했다. parent무조건종료/다른Node·서비스·Agent 종료0이며 자연PASS로 소급하지 않는다. 원인은 port.close 직후 hasRef=false 즉시assert가 throw해 나머지 globals/채널 회수가 끊긴 시험 cleanup 오류였다. 제품여정RED가 아니다.

독립준비읽기c50b7c는 초기화try전 예외/close assert 뒤 회수공백도 확인했다. 전체초기화try·nullable root·독립회수/첫오류보존·close callback완료await로 보완했다. 정확잔류2a5ea6 exit0/count0 뒤에만 새실행했고 최종 각mount는 소유채널/globals회수를 단언한다. Vite bundle전 native채널까지 이 배열의 소유라고 주장하지 않는다. 마지막 알려진 실행0/writer반환이다.

Main d5133e의 리뷰artifact mkdir은 부모경로가 없어 FileNotFoundError로 실패1, 시험은 실행되지 않았다. 8877d0에서 새 전용 부모/리프 생성으로 보정하고 정확 SHA 후 시험했다. 기존파일 삭제/권한변경0이며 제품오류/제품RED로 계산하지 않는다.

## 지문·검수·복구
신규시험22983B/SHA256 377842ea7eca031ef6c383df7aed958ce0c458afba0c6a415608bfe9434232bb, sorted compact manifest1d6892ef6dd78f70ae501f2720aae2c555e710795dafdfa0b628ed0632ebd6c7.

원제품4의 시작/종료SHA 동일:
- ProjectBaselinePanel.tsx f48f8bea765dcf055dbfb0b9270330388582ac634820d402e760b2ec1d07dabb
- BaselineDesignPicker.tsx 777f044fe542046046f8acc588b2d8c494dc1c09e832de03358d021fc73a8986
- baseline-design-selection.ts 8511cd2c5009e386fa11f35dc075d141db5e4d71d0da1f6c9291de3c80e263c6
- baseline-api.ts 96a0e5ea17fb4ad2dbb3c5f31b1d192056303f5337bea03c70208db7906141ac

base cfb59b2a 대비branch 문서전체+신규시험전체 고정패치를 독립검수에 제공했다. 최종 finding은 후속현황에 남기며 미해결 C/I가 있으면 게시·병합을 완료로 판정하지 않는다. 복구는 신규시험/해당문서의 정상 revert, 기존제품·시험·원문·후보역사는 보존한다. 통합 뒤 신규7개 한정smoke/PR·tree·remote복구ref/clean을 검산하고 완료branch를 정상정리한다.
