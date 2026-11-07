# FN16 권한정책 역사 내부 수집 결과 — 2026-10-29

## 판정·기준
Main 신규11합성 PASS/type·diff0 및 독립C0/I0로 내부 source를 인수했다. 전체 FN16/백업·권한 복원 완료가 아니다. 시작 HEAD63f946e14c7877b3d07517b0bebdd61b03f2cb51, branch codex/av3-stage-b. WI docs/work_packages/FN16_PERMISSION_POLICY_INVENTORY_IMPLEMENTATION_20261029.md SHA256 A420B5E43105892E8869351D53D76EFFE7F37E39B025FF09E6B516F5A4214868.
허용 신규 permission-policy-inventory.ts 및 행동/schema 시험2만 구현. 기존source/19조합/SQL 수정0·실제DB/키/서비스/Agent/파일IO/Git개발자변경0. Main은관리·검수·통합, 단일Primary구현/Reviewer읽기.

## 변경·의미
정책2표의 전체 버전/현재 head와 각 savePermissionPolicy 명령·권한영수증·감사 선택증거3표를 수집한다. 원 contentHash를 검산한 뒤 명시 actor/client/상대경로를 제외한 투영·별도 projectionHash로 반환한다. 선택 증빙과 전체 명령/감사 원장을 혼동하지 않는다. 실제 열은 정책5/버전11/선택command20/receipt9/audit16이다.
만료·빈규칙·과거작성자 변경과 시각 역전을 보존하고 현재 권한을 재판정하지 않는다. 명시 증빙의 rule 주체는 해당 버전 작성자와 일치해야 하며 현재 조회 OWNER와 비교하지 않는다. client/command 둘다null은 SOURCE_COMMAND_EVIDENCE_MISSING/미검증이고 확인된legacy나손상으로단정하지 않는다. 한쪽null/명시증빙 불일치는503이다. 최초의 null 정책과 개정의 직전 정책, 새target·scopeDigest를 구분한다. 원request는DB에없어 재구성/서명 검증을 주장하지 않는다.

## 검증·오류 이력
- preflight 첫6A8E577F I1(명시증거 버전의 rule 주체 관계 누락)을 최종A420B5E4 §6에서 보완, 독립0aa85f C0/I0.
- Primary6dc28b RED 신규11개0PASS/11FAIL/skip0/180.5448ms는 미구현 확인.
- 정상fixture의 저장 당시 만료 오류를 발견해 생성/증빙2025·만료2026-01·조회2026-10으로 보완. 제품에 새 시각 조건을 추가하지 않았다. 민감 음성은 실제 알려진 검사 표식 api_key=로 바꿔 재봉인 거절을 확인했다. 검사 기준 완화0.
- Primary58cba1 GREEN11PASS/0FAIL/skip0/524.834ms/type0.
- Main913dcb node --test tests/unit/FN16/permission-policy-inventory.test.ts tests/unit/FN16/permission-policy-inventory-schema.test.ts →11PASS/0FAIL/skip0/497.7219ms/exit0. npm run typecheck 및 git diff --check exit0.
- 실제 메모리SQL로 전체버전/201 keyset·선택200묶음·audit전체sequence gap정상, 원hash/투영·실행scope경로제외, nullable/주체/target-oldpolicy/원hash/head/누락/교차project/민감·rowbytes·총metadata·신원/만료·COMMIT뒤취소/회수불명503을 확인했다.
- 독립a8c05c 최종 C0/I0,3지문일치/fixture I1해소·inventoryHash7필드 공식 확인. 실제 시험 실행은 Main과 Primary가 수행하고 reviewer는 읽기만했다.
- Maincd615e 보호untracked8 SHA256 모두 기존 기준과 일치. 도구/권한 오류와 제품 오류는 WORK_STATUS에서 분리하며 이번 작업에 동일근본제품실패3회없음.

## 지문·한계·다음
source497630CF99BCD0A0A158088E8955689A5134F8A7F4089FC03FE885C6A0C5B046, 행동95C96B2F8B462C575649CCAC3847FECB4E86224581E5C4B331304428154873E4, schema8D8C1CBB9A9D7B42EBC74B5CA698E382B2CE7EBEF13CCD90B77042F5C8C43FE4.
실제PG/RLS/동시변화/강제실시간상한·원request/재인증/현재권한/전체감사체인·원정책/권한복원·archive/검증복원/UI/사용자인수 NOT_RUN. auth_audit_events는projectId가없어제외. 전체승인/명령/영수증/감사원장도미수집이다. 개인정보제외metadata는원정책권한복원에사용하지않는다. fullProjectCoverage/restorable/authorizationRestoration/executionAuthorized/dispatchPerformed/atomicSnapshotVerified=false.
다음은 수집 정책의 정확ref를 기존 내부 조합에 연결하는 선행을 검토한다. 158E10 후보미채택/API/실행 허가우회0. Main만 신규3+WI/결과/WORK_STATUS/WORK_PLAN 정확7경로checkpoint한다. rollback은 신규내부3파일의검토된revert,정책/자료/백업삭제0. 전체WORK_PLAN미완료.
