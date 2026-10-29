# FN16 프로젝트 통제원장 조합 연결 작업지시서 — 2026-10-29

## 기준과 범위
기준 codex/av3-stage-b 702b71868014cc2eafed549370635a3bc6c7d305. FN16 승인된 내부 source·합성 검증의 다음 연결 단위다. 이미 검수한 수집기 재개발·새 공개 API·새 저장 계약·정책158E10BC 채택·실제 DB/키/서비스/Agent 실행은 제외한다. Main 관리·검수·통합, 기존 Primary 단독 writer, 독립 Reviewer 읽기 검수. 사전검수 뒤에만 GO한다.

## 허용 코드 4경로
- apps/server/modules/backups/project-inventory-composition.ts (8F5CDB65BF55D05A866CAF2DEA1197F87D37951DB1B1B317B00EA083C71CF471)
- tests/unit/FN16/project-inventory-composition.test.ts (B82DB3FC65C8837A2336DDB50998FA2A260F6981A44C7914E0C1EE0327EFC8AB)
- tests/unit/FN16/project-inventory-composition-schema.test.ts (66B97D5901F0500BA968831F02C9E803826871A5AACE44692241C61A2879EB16)
- tests/unit/FN16/project-inventory-artifact-verification.test.ts (E4C858FA028A53B0FAD90CDF53CEB5F18B8AAC762519E74162F8BAFD9CA046AA)
수집기 source/시험·원문 helper/schema·다른 파일 변경0. 보호8 untracked 보존, Developer Git 쓰기0.

## 연결 계약
1. 실제 collectProjectControlLedgerInventory를 기존21 뒤 22번째로 고정 연결한다. 원 projection 7필드 kind,projectId,commands,authorizationReceipts,auditEvents,issues,externalDependencies의 inventoryHash를 검산한다. 각 child의 현재성·신원·관측·독립 시점·전체 기한/누적 metadata 한도와 오류/회수 경계는 유지한다.
2. 원장에는 원 row version/contentHash가 없다. requestHash·scopeDigest·derivedMetadataHash·audit sequence로 새 VersionRef/provider를 만들지 않는다. 기존 선택 증거와 전체 원장 관측은 각 component에 보존하고 중복을 병합·삭제하지 않는다. 서로 다른 관측을 atomic·동일 snapshot으로 주장하지 않는다.
3. 원장 externalDependencies는 원형을 보존한다. ProjectControlLedger 출처의 PERMISSION_POLICY만 실제 c.policy_ref 의미에 따라 POLICY_VERSION namespace로 대조한다. 전역 aliases에 추가해 기존 Baseline 등 다른 출처의 NOT_COLLECTED 의미를 암묵 변경하지 않는다. ID-only APPROVAL_CONSUMPTION_ID/APPROVAL_DECISION_ID/CONNECTOR_REGISTRATION_ID는 EXTERNAL_UNSUPPORTED이며 가짜 ref/정확해소를 발급하지 않는다.
4. 원 rawPayloadAndResult NOT_EXPORTED 및 현재권한/원형재구성·감사체인·미수집 선언은 component에 그대로 보존한다. NOT_EXPORTED를 declaration 허용 값에 추가하되 원문/raw payload는 반환하지 않는다. missing 첫 항목만 UNRECORDED_APPROVAL_TRANSITIONS로 축소하고 다른 미수집 항목은 유지한다. fullProjectCoverage/restorable/authorizationRestoration/execution/dispatch/atomic false를 유지한다.
5. 원문 검증 helper 자체는 변경하지 않는다. 기존 실제 조합 호출에 22번째가 추가된 결과만 검증하며 기존 최초 차단/원 tuple·현재상태/파일 한도·바이트 확인·최종 현재성 검사를 보존한다.

## 검증과 제출
신규 정상 실수집 반례로 RED 뒤 구현한다. 비어 있지 않은 원장3표/정확46열의 실제 memory fixture를 통해 원7필드hash·component scope/선언·rowCounts·중복 선택 증거와 독립 관측 보존을 검증한다. 실제 commands의 draft_id=null 등 원 schema 필드를 fixture에서 보완하고 수집기 검사를 완화하지 않는다.
정책 exact/absent/재봉인 충돌, ID-only unsupported, 원장 provider 발명0, 다른 출처 PERMISSION_POLICY 기존 의미 유지, 22번째 SQL 실패/종료 신원 변경/누적 한도413/회수 실패503 및 모든 false 선언을 확인한다. 참조 부재는 행 손상이나 자료 부재의 확정 판정이 아니다.
기존 Context26/28·Observation32/34·Policy40/41·Approval42/43 경계를 유지한다. 원장44/45·외부 최종46, 원문 wrapper의 기존47/48은49/50으로 실제 호출 순서에 맞춰 반영한다. 시험 숫자만 맹목 변경하지 않는다.
직접 영향인 composition 행동/schema·artifact 행동/schema 4시험파일의 기존41+신규만 실행한다. typecheck/diff 검증과 독립 C/I0 뒤 Main이 같은 집중 범위를 fresh 확인한다. 완료 수집기 전수·브라우저/부하 반복0. Main만 정확4코드+WI/결과/WORK_STATUS/WORK_PLAN 8경로 checkpoint한다.
실제 PG/RLS/키/서비스·원문FS·전체 archive/복원·UI 인수는 NOT_RUN, 전체계획 미완료를 유지한다. 결과에는 정확 명령/exit/RED와 보완/최종 지문/미검증·rollback을 남긴다. rollback은 이번 조합 연결과 시험의 검토된 revert이며 자료·승인·키 삭제0이다.
