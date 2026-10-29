# FN16 권한정책 내부 조합 연결 결과 — 2026-10-29

## 판정·기준
실제 권한정책 collector를 기존19뒤20번째로 연결했고 Main 직접영향33합성PASS/type·diff0를 확인했다. 독립최종지문 확인 뒤 source를 인수하며 전체 FN16/백업·권한복원 완료가 아니다.
branch codex/av3-stage-b, 시작6ebce9e1ede2135ad0e2c599c42797693703e1a7. WI docs/work_packages/FN16_PERMISSION_POLICY_COMPOSITION_IMPLEMENTATION_20261029.md SHA256 18AA0433D7311011CF815D5C5B6A7AA80EDAD1275C3E6EA1E1934211EFDF5E41.
정확4경로: 조합source·조합행동/schema시험·원문연결행동시험. 기존policycollector/원문helper/SQL/다른source변경0·실제DB/키/서비스/파일/Agent0. Main관리검수통합·Primary단독구현·Reviewer읽기.

## 변경·기존 보존
고정 import/마지막entry와 정책7필드 원inventoryHash, PermissionPolicy.versions[].ref→POLICY_VERSION 명시provider만 추가했다. 같은원ref 정확존재/수집했으나부재/독립재봉인hash충돌을 구분하며 unknown PERMISSION_POLICY 자동alias0이다. 개인정보제외 projectionHash로 원정책ref를 대신하지 않는다.
원 notCollected 그룹은 WHOLE_APPROVAL_COMMAND_AUTH_AUDIT로 한정 보정하고 정책child의 전체승인/명령/영수증/감사/인증감사 NOT_COLLECTED, 현재권한/원request/재인증/체인/OS/blob NOT_PERFORMED 및 권한복원false는 유지한다. 사용자/client/경로 원형이 없는 정책metadata 투영은 원정책 복원자료 전체가 아니다.
기존19순서·중간 Context26/28/Observation32/34 관측은 그대로이며 최종 인증40→42, 원문현재조회43→45/IO전44→46만20수집의 실제 순서로 조정했다. 상한/timeout·기존 보안기대 삭제·완화0, 독립RR 원자성false와 전체coverage/restorablefalse 유지.

## 검증·오류 이력
- preflight Main실producer/독립C0/I0·Primaryd45a67 이후GO.
- Primary8fe4a3 신규3연결시험 RED0PASS/3FAIL/skip0/567.4699ms: 기존19미수집·충돌미거절·20번째실패미도달 재현.
- Primary2823c1 최초직접영향32PASS/type0. 실제5표선택증빙 연결1개추가 뒤692267 32PASS/1FAIL은 fake의 authreceipt command_id ANY 선택키를 id ANY로 잘못 모사한 원인. 실제 SQL 조건에 맞춰 보완 후 c86238 최종33PASS/0FAIL/skip0/1158.8982ms/type·diff0. 제품조건 완화0.
- Main2aea20: node --test tests/unit/FN16/project-inventory-composition.test.ts tests/unit/FN16/project-inventory-composition-schema.test.ts tests/unit/FN16/project-inventory-artifact-verification.test.ts tests/unit/FN16/project-inventory-artifact-verification-schema.test.ts →33PASS/0FAIL/skip0/1418.8818ms/exit0. npm run typecheck/git diff --check exit0. 변경 영향이 있는4시험만 재검사했으며 불변policy11 및 다른수집기 반복0.
- 실제 Context와 정책수집의 양null 미확인 정상/실제정책5표증빙 정상·exact/부재·각원hash독립재봉인충돌·20번째실패/끝신원변경, 기존원문IO1/최초차단IO0/현재성/한도/회수불명503를 확인했다.
- 독립595651 읽기는 guard/한도/회수/false 불변·phase정합·보안기대 유지 C0/I0. 최종4지문 보완은 아래누적한다.

## 최종 지문·미검증·복구
source B40D65AB868FD4F12F451FA1C8AB280F99182606497E57E66C3A9998E2D7BADD, 조합행동0D57100FDA9C352EAF511666AC836D6D7C5BFF0082DA335EEC08F086582DBFC6, 조합schema1CA17247AA9207FD165F4AE0669C9A447D4D672AE7BEC244A9AEC30335B6B68E, 원문행동BCE9D5189355F66FE9A65AED9F85DE074CDDAF84F4F4942023D5A750C724B22F.
실제PG/RLS/동시변화/키/서비스·원문FS/전체원장·원정책 권한복원·archive/검증복원/UI/사용자인수 NOT_RUN. 158E10 정책미채택/API/READY/저장허가우회0. 전체WORK_PLAN미완료. Main만허용4+WI/결과/WORK_STATUS/WORK_PLAN 정확8경로checkpoint한다. rollback은20번째연결과해당시험의검토된revert이며정책/자료/백업삭제0.

독립최종a452ef C0/I0,추가실5표선택증빙·정확query키·최종4지문일치확인. Main2aea20과함께이번내부source연결만인수한다.
