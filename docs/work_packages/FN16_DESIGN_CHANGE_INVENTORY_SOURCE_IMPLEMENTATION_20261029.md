# FN16 설계변경·영향검토 이력 내부 수집 작업지시서

## 범위
2026-10-29. codex/av3-stage-b. 설계§10.4/FUNCTION_WORK FN16와 신규 계약 source·합성 직접 승인 안의 자료 보존이다. 착수 기준은 직전 설계·화면·추적 collector 검수/게시 완료 HEAD로 WORK_STATUS에 고정한다. 아직 이 WI 작성만으로 제품 GO하지 않는다. 기존 primary 단독 구현·review 독립 검수·Main 통합. TEST_ONLY→Main RED→SOURCE_GO.
신규 허용3: apps/server/modules/backups/design-change-inventory.ts, tests/unit/FN16/design-change-inventory.test.ts, tests/unit/FN16/design-change-inventory-schema.test.ts. 기존 source/시험/SQL 수정0. 실제DB/FS/키/서비스/P03/Agent/job0, 새 공개형식/schema/권한0. 0050 baseline/activation 자료는 별도이며 이번 수집0.

## 수집
collectDesignChangeInventory(access,token,value,signal). readDocumentInventoryInput 유한limits, 기존collector와 동일 최초/최종 RC 신원/OWNER/nonarchived·최소기한, RO RR 실제설정/snapshot·rollback/release·최종auth COMMIT후검사. 외부제공inventory·SQL0, pool/auth 전체 강제상한 주장은 하지 않는다.
projectId 매개변수·명시열·최대200keyset·SQL CASE JSON byte 제한/누적metadata한도. 실제 migrations와 schema시험 대조.
- design_changes 13: id,project_id,version,before_id,before_version,before_hash,proposal_id,content_hash,change_json,created_by,client_id,command_id,created_at. key id.
- design_change_impacts 14: id,project_id,version,change_id,change_hash,source_kind,content_hash,impact_json,created_by,client_id,command_id,created_at,base_version,base_hash. key id,version. 0004_design_impact_reviews 이후 모든 버전을 읽는다.
- commands 기존 명시11열. exact deduplicated 명령ID만 조회, 원문/현재 문서/계획/설계/정책/감사/활성기준 따라읽기0.

## 기존 역사 보존·무결성
1. change 정확 {ref,status,beforeRef,afterProposalRef,reason,sourceRefs,requestedBy,createdAt}, status PROPOSED/ref.version1. 원hash는 {beforeRef,afterProposalRef,reason,sourceRefs} 4필드. 분리열/actor/client/time·proposeDesignChange expectedVersion0 APPLIED·receipt change/ref/activatedAsBaseline=false 검사. readDesignChangeSources 순수parser 사용 가능. sourceRefs는 사용자지시여도 실행할 명령이 아닌 자료다.
2. 각 change는 동일 id의 impact1..n 연속이력. 초기 v1 MECHANICAL_TRACE는 change와 command 공유, 최상위 receipt ref는 changeRef이고 data.impact.ref는 별도 impactRef다. 다른 change 혼입/누락·잘못된command/ref거절. v1 base_version/base_hash null.
3. impact 원hash는 impact_json에서 ref/observedAt만 제외한다. MECHANICAL snapshot 정확 changeRef/sourceKind/beforeRef/items/coverageGaps/requiresReview/inputs. HUMAN_REVIEW snapshot 정확 changeRef/baseImpactRef/sourceKind/beforeRef/items/coverageGaps/reason/requiresReview/inputs/reviewer. 원문 userId가 hash에 포함된 사람 검토는 원검증 후 익명 투영한다. 공통 분리열/ref/시각·requiresReview=true·beforeRef 일치. 초기 planRefs≤8/indexedDesign boolean·items≤2000·evidenceRefs=[]·AFFECTED/UNKNOWN·기존미연결gap 보존. 현재자료로 calculateDesignImpact 재실행0, 의미판정 확정0.
4. v2+는 동일 impact ID·직전 base_version=v-1/base_hash/ref/원입력 exact. reviewChangeImpact 고유명령/expectedVersion=v-1/APPLIED/ref=impactRef·actor/client/time·data impact exact/activatedAsBaseline=false. readImpactReview 순수parser로 직전 대상 집합·gap 보존·UNAFFECTED 증거 조건만 검사한다. reviewer HUMAN userId를 실제 created_by와 대조. 과거 UNKNOWN·범위절단·미연결·후속검토 모두 원형보존.
5. 명령은 요청+초기영향 공유만 허용한다. 다른 요청·사람영향검토간 재사용0. proposalId는 프로젝트내 unique 보존, 모든 변경에 초기영향 존재, impact orphan·단절·이중계보 거절.
6. 외부 미확인: beforeRef, afterProposalRef(ID만·버전/hash 없음), sourceRefs, inputs.planRefs, target/evidence refs. 원문존재/현재성/교차자료정합확인·실행안전·활성승인으로 승격0. ID-only proposal을 exact-version으로 표현하지 않는다.
7. 모든 투영문자열/참조 known-pattern 검사, 민감 발견시고정오류. 원검증 뒤 requestedBy/reviewer는 kind HUMAN만 남기며 user/client/session/token/storage경로·SQL오류본문 출력0. 원hash/projectionHash구분, 완전비밀탐지주장0.

## 결과·검증
kind DESIGN_CHANGE_INVENTORY_V1/scope DESIGN_CHANGE_HISTORY_ONLY. projectId/changes/impacts/issues/externalDependencies/observation/usage/contentHash. contentHash는 projectId/changes/impacts/issues/externalDependencies 5필드 canonical. DTO별 익명투영hash·배열순서결정적, 외부미확인있으면metadataComplete=false. fileCount/inputBytes0, blobVerification NOT_PERFORMED/executionEvidence NOT_CONNECTED/fullProjectCoverage=false/restorable=false. 결과전체UTF8한도.
기존 AUTH401/NOT_FOUND404/INPUT400, DESIGN_CHANGE_INVENTORY_CANCELLED409/DEADLINE·LIMIT413/INTEGRITY_FAILED·STORAGE_FAILED·SENSITIVE_METADATA503, 회수불명503우선·재시도/기준완화0.
시험: 정상 최초+후속2버전·공유명령과서로다른ref·외부ID-only, 200초과 영향이력, hash/분리열/receipt변조·단절·잘못된parent·actor/시각·잘못된gaps/evidence·orphan/command혼입, 양끝권한/기한/취소/회수/민감metadata. 실제collector+메모리PG만. 신규시험/type/diff·독립검수, 기존불변시험반복0. 실제DB/FS/키/서비스/전체archive/복원/화면인수 NOT_RUN, FN16 전체 미완료.
