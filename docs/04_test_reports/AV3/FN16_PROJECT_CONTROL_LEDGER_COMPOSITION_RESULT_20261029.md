# FN16 프로젝트 통제원장 조합 연결 결과 — 2026-10-29

## 판정과 기준
고정21개 수집 결과 뒤에 이미 검수한 프로젝트 통제원장 수집기를 22번째로 연결했다. Main 직접 영향48합성PASS/type·diff0 및 독립최종C0/I0이다. 실제 백업 생성·복원·UI 인수·전체 FN16 완료는 아니다.

시작 branch codex/av3-stage-b, HEAD702b71868014cc2eafed549370635a3bc6c7d305. WI docs/work_packages/FN16_PROJECT_CONTROL_LEDGER_COMPOSITION_IMPLEMENTATION_20261029.md SHA25657778C8537BE2C94454EC78E762980929F89954B479E66E1937626A3DD98DD55. Main 관리·검수·통합/기존 Primary 단독구현/Reviewer 읽기 검수.

## 변경과 보호
실제 DTO 원7필드 kind,projectId,commands,authorizationReceipts,auditEvents,issues,externalDependencies의 inventoryHash를 대조한다. 원장과 기존 선택 증거를 각각 관측/component로 보존하고 중복을 병합하거나 atomic 관측으로 주장하지 않는다. 원 row에 없는 version/hash로 provider를 만들지 않는다.

정책 참조는 ProjectControlLedger 출처의 PERMISSION_POLICY만 POLICY_VERSION namespace로 대조한다. 원 dependency는 불변이며 Baseline 등 다른 출처의 기존 NOT_COLLECTED 의미와 전역 aliases를 유지했다. ID만 있는 승인·소비·등록 참조는 EXTERNAL_UNSUPPORTED다. 원 rawPayloadAndResult NOT_EXPORTED와 미검증/미수집/false 선언을 보존한다. 첫 missing만 UNRECORDED_APPROVAL_TRANSITIONS로 축소했다. 원문 검증 helper와 모든 기존 collector는 수정하지 않았다.

## 실제 검증 증거
- Primary ea7301/08a834: 시작4지문·양쪽 WI·HEAD 확인. RED359e81 신규4개0PASS/4FAIL 후 구현했다.
- Primary f3c625: 직접4파일48PASS/0FAIL,1646.4574ms,type·diff0 후 writer해제.
- Main 1ae229: 동일 아래4파일48PASS/0FAIL/skip0,1694.4027ms/exit0. npm run typecheck 및 git diff --check exit0,최종4지문 일치.
- 독립최종 C0/I0: 실제7필드hash·source diff +5/-3·정합 재봉인 정책충돌·타출처 의미 불변·ID-only 미지원·비APPLIED/commandless·신원/오류/누적한도·원문49/50 경계를 읽기 확인했다. 검수 중 새 제품 finding0/재작업0이다.

정확 명령: node --test tests/unit/FN16/project-inventory-composition.test.ts tests/unit/FN16/project-inventory-composition-schema.test.ts tests/unit/FN16/project-inventory-artifact-verification.test.ts tests/unit/FN16/project-inventory-artifact-verification-schema.test.ts

실제3표 memory fixture/46열·정책 exact/absent/독립재봉인 conflict, 같은 정책의 Baseline NOT_COLLECTED 유지, 원장 새 provider0, schema-only3상태·무명령 거절감사 보존을 확인했다. 기존1~21 관측 경계는 유지하고 원장44/45·최종46, 원문49/50만 실제 순서대로 반영했다. 누적한도는 중복 metadata도 포함하며 22번째 SQL/신원/회수 실패를 계속 거절한다. 완료 collector 전수 반복0이다.

## 지문과 한계
- source5746F2C918DD9898D71788D9FC0497096283BCC06E514245DD6EFBAADFB18ACD
- 조합행동D67938F9042253469E6296C22147D4BE8BCCD62804BF4C2D5198FA1F826C7143
- 조합schema806DC51849A6B850C31914EC3BD0F6B6E8B3C9FC9E63AB546DE08EAD67A7EEA6
- 원문행동D4B8D1BA087EF5B58C9C6A3037127145E158AF4B62DEDD500E65D19388665FE1

실제 DB/RLS·키/서비스·원문FS·전체 archive/원형 복원·UI 인수는 NOT_RUN이다. raw payload/result·draft/user-common/인증 원장은 미수집/미반출이며 전체성·권한복원·실행·dispatch·atomic·restorable false다. 미채택 수동 정책158E10BC/READY/실행 허가로 우회하지 않았다.

Main만 정확4코드+WI/본결과/WORK_STATUS/WORK_PLAN 8경로 checkpoint한다. rollback은 이번 연결과 시험의 검토된 revert이며 기존 자료·승인·키 삭제0이다. 보호8 보존, 전체WORK_PLAN 미완료. 다음 미수집 자료의 실제 승인 계약과 원본 보존 경계를 대조한다.
