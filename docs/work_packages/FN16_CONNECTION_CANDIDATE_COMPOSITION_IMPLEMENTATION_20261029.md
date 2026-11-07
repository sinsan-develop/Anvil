# FN16 연결·환경 후보 조합 연결 WI — 2026-10-29

기준 codex/av3-stage-b e6d87afc7697bff889c8d52a1c42c3263dce2f62. 기존 FN16 내부 metadata source·합성 범위, 사전검수 전 코드 GO 아님. Main 관리/검수/통합·기존 Primary 단독 writer·Reviewer 읽기. 실제 키/DB/권한/서비스·파일IO·Agent·새 API·공유B 구현·미채택158E10BC는 제외한다.

## 허용4코드와 시작 지문
- apps/server/modules/backups/project-inventory-composition.ts 5746F2C918DD9898D71788D9FC0497096283BCC06E514245DD6EFBAADFB18ACD
- tests/unit/FN16/project-inventory-composition.test.ts D67938F9042253469E6296C22147D4BE8BCCD62804BF4C2D5198FA1F826C7143
- tests/unit/FN16/project-inventory-composition-schema.test.ts 806DC51849A6B850C31914EC3BD0F6B6E8B3C9FC9E63AB546DE08EAD67A7EEA6
- tests/unit/FN16/project-inventory-artifact-verification.test.ts D4B8D1BA087EF5B58C9C6A3037127145E158AF4B62DEDD500E65D19388665FE1
기존 candidate collector(3560579E)/16시험·producer/input/22수집기/helper/schema·SQL·다른 파일·Git개발자쓰기0, 보호8 보존.

## 실제 연결과 보호
검수된 collectConnectionCandidateInventory를 기존22 뒤 ConnectionCandidate 23번째로 추가한다. 원 inventoryHash의 정확7필드 kind,projectId,candidates,versions,evidence,issues,externalDependencies를 검산한다. child scope·원hash/resultDigest·issues/declarations/관측/rowCounts와 이미 허용된 NOT_EXPORTED의 sourceSnapshot 선언을 보존한다. 전체 한도·기한·동일 신원/OWNER·마지막 RC·파일합집합/원문검증·모든 false 경계는 유지한다.

실제 ResponsibleSession 수집기의 external('CONNECTION_CANDIDATE',snapshot.connectionRef), assignments/responsible-sessions.ts의 ProjectConnectionCandidates.read와 kind CONNECTION_CANDIDATE 확인이 출처다. 새 versions 중 정확 kind CONNECTION_CANDIDATE의 원 ref만 CONNECTION_CANDIDATE namespace provider로 등록한다. ENVIRONMENT_CANDIDATE는 별도 실제 소비선이 없으므로 provider로 등록하지 않는다. 알 수 없는 kind/잘못된 ref는 거절한다. 원 ref는 원 snapshot의 hash이며 투영 hash/현재head로 대체하지 않는다. 환경후보를 기존 ENVIRONMENT_REF/ENVIRONMENT_REFERENCE 등으로 alias하거나 후보를 CONNECTION/Resource/실등록 권한으로 승격하지 않는다.

정책 POLICY_VERSION과 ID-only approval 외부참조는 기존 실제 kind/ref 그대로 검산/미지원 처리한다. 다른 source alias·관계 의미를 바꾸지 않는다. 현재 metadata는 원형 snapshot 반출이 아니며 원문/현재정책·능력실측·신뢰/등록·소스root/전역설정·전체archive/복원은 미검증/미수집이다. 기존 notCollected 배열은 전부 그대로다. 23번째 연결만으로 어떤 전체 미수집 항목도 삭제하지 않는다.

## TDD·독립 검수
실제 수집기와 memory schema 정상 반례를 추가해 RED부터 보존한다. 두 kind 비어있지 않은 실제2표/63열 및 선택증빙, 원7필드 hash·scope·익명화/NOT_EXPORTED/미검증/false·고유ref와 다른원형 의미를 확인한다. 실제 ResponsibleSession connectionRef와 새후보의 exact/absent/독립 정합 재봉인 충돌을 검증한다. 같은 id/version의 환경후보를 연결provider로 해소하지 않는 반례, alias/실등록승격0, 실제 승인 ID-only unsupported를 유지한다. 다른 collector의 선택증빙과 전체원장에 후보 명령이 나타나는 경우 이를 숨기거나 merge하지 않고 별도 관측/중복 metadata로 보존한다.

기존1~22 경계는 유지하고 후보46/47·최종48, 원문기존49/50→51/52를 실제 호출 순서로 확인한다. 숫자만 바꾸거나 뒤검사로 마스킹하지 않는다. 23번째 SQL/정확원hash 오류·종료신원/취소·누적metadata413/회수불명503을 검증한다. 부재는 원형참조 미공급이지 행 손상 확정이 아니다.

직접 영향4시험파일(composition 행동/schema, artifact 행동/schema) 기존48+신규만 실행한다. typecheck/diff·최종4지문·독립C/I0 뒤 Main fresh 같은 범위, 기존 완료16후보·다른collector 전수/브라우저·부하 반복0. Main만 허용4+WI/결과/WORK_STATUS/WORK_PLAN 정확8경로 commit/private checkpoint한다. 실제DB/RLS/키/서비스·원문FS/archive·UI NOT_RUN, 전체계획 미완료. rollback은 이번 연결/시험의 검토된 revert이며 자료·승인·키 삭제0이다.
