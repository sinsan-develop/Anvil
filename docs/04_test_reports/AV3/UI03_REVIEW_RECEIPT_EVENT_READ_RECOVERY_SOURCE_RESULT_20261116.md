# UI03/FN02·FN03 검토·확정 사건 조회 복구 — 2026-11-16

기준 main7b4d6036aef9cec217197f533ad708b3bd4196cc, branch codex/av3-ui03-review-receipt-read. WI SHA256 EB50D5E253271952FDBFAAE7B8D9ADEED08BB774D04ECD7248C8A1303D92A1E3. Primary 구현, Main 검수·통합. 기존 receipt/GET/권한 계약의 내부 화면 보완이며 새 API·SQL·실권한은 없다.

변경 전에는 영수증 뒤 GET이 실패하면 원명령 재POST만 가능했고, 반대로 정상 형상의 같은 버전 GET에 해당 검토 사건이 없어도 onVerified가 호출됐다. 변경 후 원 요청·주체/client/project·대상 전체 참조에 결박한 사건을 화면 버퍼에 보존한다. 검토는 전체 이력에서 원 ID가 정확히 한 번 존재해야 하며 ref·criteriaVersion·판정·reviewer·items·reason을 대조한다. 확정은 원 confirmationId·decidedBy·reviewRefs를 대조한다. 누락/불일치/상한 밖·GET오류에서는 pending/dirty 입력/영수증을 유지하고 명시 GET만 허용한다. 원POST유실·부정형 영수증은 같은 명령 재확인에 남는다.

PROJECT 최초 prepare→write→read와 원 정책/일회승인·preparationId/application 동작은 유지한다. 현재projectId의 내부 prop 전달 한 곳으로 원 prepared request와 복구 문맥을 대조한다. 과거 검토 사건이 배열 첫 행이 아니어도 검산하되 별도 확정의 최신 검토 조건은 바꾸지 않는다. 주체·전송·기준·project 변경/ABA/화면 종료 뒤 늦은200/401은 버퍼·본문·인증에 반영하지 않는다. React effect 재설정에서 active를 복원하고 자기 preparationId만 정리한다.

## 검증

- RED028ea8 exit1/0P1F: 실제 FormReviewPanel에서 같은 버전의 사건 없는 GET200 뒤 onVerified=1을 재현했다(기대0).
- 최종 node --experimental-strip-types --test tests/unit/UI03/project-methodology-review-read.test.ts tests/unit/FN02/stored-content-reviews.test.ts tests/unit/FN02/common-client.test.ts tests/unit/FN02/project-method-web.test.ts tests/unit/FN03/form-draft-client.test.ts — 2cf075 exit0, 43P/0F/0SKIP, 2147.6153ms.
- 실제 두 패널 RAM의 공통 양식/공통·PROJECT 방법론 record/confirm, 사건없는 GET·GET503·hash/actor/criteria/items/reason/confirmationId/reviewRefs 불일치, 올바른 사건 확인까지 POST1/onVerified0, 정확 일치 뒤만 해제, 원POST유실/부정형영수증 동일명령 재확인, 늦은응답/ABA를 포함했다. 최신 REWORK 행 뒤 원 사건이 있어도 별도 확정은 비활성으로 유지했다.
- npm run typecheck — 12bc1d exit0(원 session43539 종단). 원웹 Vite envDir:false/write:false 메모리 생산빌드 7c0fda exit0, 520모듈/892ms·HTML/CSS/JS. 최초 시험 EOF 빈행 경고만 제거 후 diff348ced exit0.
- Main 핵심 사건 복구 시험 — 29a708, 1P/0F/0SKIP, exit0. 독립 소스·시험 본문 검수 C0/I0/M0, 동결 지문 일치.

## 동결 SHA256

- FormReviewPanel.tsx: 58ABDDF37B3321C37ECA62F1F8386B0B1D3994E0553911C44A4090A1D33F82EC.
- MethodReviewPanel.tsx: 1C47560D1BDDDD54F10D7A6692F2434F0C3E28EA4FA7B444126B2F41F1462561.
- form-editor-state.ts: 16C5B755F7B3D98EF06094E754D1A3E0A42AFD7E585730387E5264584603BD8C.
- ProjectMethodologyPage.tsx: C8DD6839E8425530B76AF36BCA9A87ADF7FC7D3A7D3000ADFE471ECD1FC14E88.
- project-methodology-review-read.test.ts: D99B36480A7017E8B15FE0BE69016ABDCA2FCF6B455E85EE3921F24B22DEAB6B.

실제 브라우저·서버·DB는 미검증이다. RAM·fixture를 실제 권한·저장·사용자 인수로 승격하지 않으며 전체 UI03/FN02/FN03·계획 완료는 아니다. 실제 DB/권한/키/서비스/Agent·SDK·R3 추가 조회·조작0, live0. rollback은 5파일 한정 diff 역적용이며 실제 사건·사용자 자료는 변경하지 않는다.
