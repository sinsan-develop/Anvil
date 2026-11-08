# UI02 기준선 설계 문서의 출처 소비 보완

상태: 기존 계약 구현 사전 검수. 현재 branch codex/av3-source-content-origin-contract의 Stage B 작업 묶음에서, 미채택 관리원문 후보의 문서 보존과 별도로 이 승인된 소비 누락만 구현한다. 새 branch를 만들어 우회하지 않는다. 현재 관리원문 기술WI·새권한/DB/계약은 GO0를 유지한다.

## 근거와 완료조건
WORK_PLAN UI02/FN01·INTERFACES의 기존SourceRef4종/DocumentContent·FN01_BASELINE_IMPLEMENTATION의보호문서불변버전선택을소비한다. readBaselineDesign의sourceRefs.length조건이정상AF02/hash문서를거절한다. 실제caller는ProjectBaselinePanel→BaselineDesignPicker→readBaselineDesign이다. 새API/응답/저장·권한의미0,기존기준선의featureState·evidence·확정/허가/실행의미0이다.

## 정확 단일 writer 소유
- 제품: apps/web/src/features/project-create/baseline-design-selection.ts
- 시험: tests/unit/UI02/baseline-design-selection.test.ts
기존Primary만쓴다. Main은WI/현황·검수·통합만수행하고동시codewriter0이다. 타인변경을되돌리지않으며추가경로필요시쓰기전Main반환이다.

## 구현과 TDD
1. 기존fixture의[]양성/오염검사는그대로두고,정상4종출처를content/분리sourceRefs에같이넣어fullcanonicalhash를계산한다. 그정상AF02보호조회가현재DOCUMENT_REFERENCE_CHANGED로거절되는RED부터재현한다.
2. 기존readDocument strict4종/분리열·원본문과documentDraftHash의전체실content검산을보존하고빈배열강제조건만제거한다. refs를지우거나선택한root문서의하위출처를baseline항목에자동펼치지않는다. 연결은정확id/version/hash인기존designRef한건이다.
3. 문서·본문/전체hash·실AF02양식·원form hash·owner/client/currentbuffer·pending/upload/UNKNOWN·인덱스와active검사/await뒤현재성·선택취소를유지한다. 원문/문서hash가맞아도잘못된kind/추가키/분리열오염은거절한다.
4. 정상4종각각/묶음과[]·본문/전체hash·같은ref양식코드변조·잘못된AF02·scope이탈/late·잠긴buffer에서연결/후속GET/쓰기0을검산한다. helper의실GET검증과부모실DOM/served/서버출처재검산은구분한다.

집중정확명령은 node --test tests/unit/UI02/baseline-design-selection.test.ts. 직접인접은기존baseline API/기준선선택을실소비하는확인된시험만선택한다. 기존PR68~71완료검사를다시실행하지않는다. Primary typecheck/diff,Main필요Webmemorybuild·독립최종C/I·Git을분담한다. 원assert삭제/기대값완화0,변경전·후정확diff/RED/GREEN·명령/exit·rawmanifest/오류·미검증·writer반환을보고한다.

## 실행·통합 경계
제품/시험읽기·코드/합성GET만허용하며실DB/권한·키·서비스·Agent·SSH·사용자자료조사0. 기존신규관리원문권한·비용후보를이WI에끼워넣지않는다. 현재branch는동결된미채택계약후보의검토이력과기존출처문서선택소비보완의StageB묶음으로마무리하고PR제목/설명에서범위를명시한다. 후보문서보존의main통합은그계약채택이아니다. Main은이소스검수후게시/필수검증/merged한정smoke·정리를수행한다. 실제사용자인수/전체FN01/UI02/작업계획완료는미확인이다. 회귀는정상revert,원문·역사/사용자dirty보존이다.
