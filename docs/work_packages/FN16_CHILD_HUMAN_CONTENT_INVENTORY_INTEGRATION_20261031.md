# FN16 하위 HUMAN 임무 내용 이력 수집 — 내부 통합 보완 WI

2026-10-31 / MAIN_SCOPED_INTEGRATION / 구현 dispatch 전 독립 경계 검토.
기준 codex/av3-stage-b cc1fa2a6111f68c189c413f949e8312f4d4d2a5e.
사용자 승인 근거: FN09_CHILD_HUMAN_CONTENT_SOURCE_DIRECT_APPROVAL_20261031.md(E49057622D68AD322766DD8C82659AC4BB3D6B395F1F571FA36A460EF960E602), 채택 r2 5880747B… 및 승인된 WORK_PLAN FN16.
기존 FN16 임무 이력 WI의 child draft-only 조건은 FN09 HUMAN 내용검토·확정 기능 구현 전의 내부 수집 범위였다.
이 WI는 현재 이미 저장 가능한 동일 snapshot/동일 표의 과거 내용을 백업 metadata에서 누락하지 않는 후속 통합이다.
새 공개 endpoint/DTO필드·operation·schema·승인·권한·하위실행 지원을 추가하지 않는다. 전체 backup/coverage412와 기존 프로젝트 차단을 풀지 않는다.

## 1. 실제 전후 차이와 Main 판단
현재 assignment-inventory.ts:139/146은 parentAssignmentRef가 nonnull인 review/confirmation을 거절한다.
현재 FN09 HUMAN producer reviewContent/confirmContent/readContent는 동일 기존 review/version DTO와 receipt/audit 형식으로 한 단계 child의 내용사실을 저장·조회한다.
변경 후 수집기는 이 과거 내용만 정확 원문/부모계보/검토·영수증/감사로 검산해 동일 inventory 배열에 담는다.
기존 shared assertAssignmentRoot·confirmations.read/decision·drafts.current·19개 실행/연결 소비선과 downstream SQL은 변경하지 않는다.
Main은 이를 기존 승인 기능 간 내부 metadata 수집의 정합 보완으로 분류한다. 구현 중 새 공개 형식/저장/권한이 필요하다는 실제 근거가 나오면 추가하지 말고 정확 차이를 보고한다.

## 2. 단일 writer와 허용 경로
기존 Primary만 code writer, Main docs/검수/통합, 기존 Reviewer read-only. A1 문서 writer 반환 뒤에만 순차 dispatch한다.
1. apps/server/modules/backups/assignment-inventory.ts — 시작 SHA256 1D3DD7BE8D3D7C236E5FE2AF11C1E4725795E7D463085DFFD8CAE5C7D0B1A3A4
2. tests/unit/FN16/assignment-inventory.test.ts — 시작 4ED4E47040847D04D4931FD727679A8370EE1B61CB66D6A656F819852BFA0599, 기존 fixture 최소 확장/의도된 성공 사례만. 다른 거절/기준 완화0.
3. tests/unit/FN16/assignment-child-content-inventory.test.ts — 신규, 부재 확인 후.
기존 schema 시험 D79EBB6FFC994CC20C4C8E066A70A23FAE6FB47AFD235CD577741D25113D34BC 및 FN09 source/SQL/보호3/그 외 경로는 수정하지 않는다.
처음 source diff와 RED 사례를 제출한 뒤 최소 변경한다. Main은 동시 code write0/Git 소유.

## 3. TDD와 구현 조건
- 실제 승인된 HUMAN producer가 만들 수 있는 child 검토/별도확정 원형을 사용해 수집 실패 RED를 증명한다. 가능하면 실제 producer 함수를 합성 DB에서 소비하고, 검산을 통과하려고 임의 snapshot을 새로 조립하지 않는다.
- root/null 정상·기존 child draft 보존, 한 단계 child content만 지원한다. 손자/self/reparent/다른project·원형/부모ref/hash·source tuple/receipt/audit·최신ACCEPTED/선택review·사건순서·범위 부분집합 위반은 계속 거절한다.
- 과거 고정 parent fullref를 사용하고 현재 parent head·새 적합/실권한·OS를 과거 사실에 재적용하지 않는다. 원 부모/원 검토·원문이 없으면 실패이며 외부 미확인/빈 배열로 낮추지 않는다.
- false flags·내용사실/실행권한 분리·사용자 익명 투영과 원hash/projectionHash 구분, 기존 RR/RC 경계·유한한도/정확select/정리/오류 비노출을 유지한다.
- 공통 root validator/역할·맥락/실행·grant/writer는 호출하거나 바꾸지 않는다. parent 참조와 역사 검산 외 현재 실행권한을 발급하지 않는다.
- 원 시험이 새로 허용된 정상 child 내용만 거절하도록 명시돼 있다면 그 정확 사례/근거/diff를 Main에 제시한다. 다른 실패 조건을 지우거나 일반 기대값·합격 기준을 느슨하게 바꾸지 않는다.

## 4. 검수·제출·한계
최소 정상은 root+child 검토/확정+부모의 후속개정 후 과거내용 보존, 원문/선택review/receipt/audit 누락·child 범위확대·손자·late/유한한도·다른project/상반hash 거절이다.
기존 assignment inventory/schema 시험, FN09 child HUMAN 직접 영향, typecheck/diff를 한 번씩 선택한다. 전체회귀/브라우저/실DB를 반복하지 않는다.
결과에는 정확 변경·명령/exit·RED→GREEN·독립 지적·미검증·writer 반환을 남긴다.
실제 DB/SQL/RLS·키/사용자파일 조사·서비스/Agent·실백업/복원·일반차단 해제·새QA0. 합성 결과는 전체 FN16/계획 완료가 아니다.
rollback은 이 보완 source commit 정상 revert. 실제 원문·DB 삭제/down migration0.
