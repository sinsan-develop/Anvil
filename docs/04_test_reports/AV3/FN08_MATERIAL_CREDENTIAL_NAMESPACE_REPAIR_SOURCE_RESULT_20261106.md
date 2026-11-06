# FN08 자료 credential namespace 복구 소스 검수 결과

- 판정: 승인 범위의 소스·미적용 SQL·합성 검증 단위 검수 완료. 실제 기능·전체 FN08·Stage·작업계획서 완료 판정은 아니다.
- 담당: 기존 Primary 구현, Main 어울 검수·통합, 기존 읽기 전용 담당자 독립 검토.
- 기준 HEAD: 34eadf0caf3b9bd53fd9b6c984d32d36a4de7897; branch codex/av3-stage-b. 시작 index 비어 있음, 허용12 변경과 Main 문서3 및 보호 untracked3을 구분했다.
- WI r2: docs/work_packages/FN08_MATERIAL_CREDENTIAL_NAMESPACE_REPAIR_SOURCE_WI_20261106.md / F20976B0424B2BC1D8FB0BBC915261612BE68AE296B801500803026C8245F81B.
- 부모 직접 승인: FN08 START 등록 A안 및 FN09 등록 정의 실행 준비·Options r2 A안. 현재 복구는 같은 승인 범위의 내부 H/E 혼동 오류 보완이며 새 공개 필드·권한·실제 실행을 추가하지 않는다.

## 문제와 변경

자료 등록의 credentialGeneration은 원 HUMAN 인증 세대 H이고 서명 challenge와 기존 실행 예약은 E다. H3/E1인 유효한 원 자료가 공통 wrapper에서 scope 전체 비교 때문에 거절됐다. Main a4f57b의 실제 합성 RED는3개 중2PASS/1FAIL/skip0·1279.3663ms/exit1이며 AUTHENTICATED_MATERIAL_REJECTED412였다. 실제 PostgreSQL 실행은 아니다.

원 PoolClient와 Tx에서 동일 grant fullref·원 fact/hash·기존 E1 예약을 읽어 두 scope를 분리한다. 외부 challenge/proof는 E1, 내부 material basis/parts/results는 H를 유지하며 상호 치환·추가 예약 생산을 거절한다. currentReadOnly를 요구하고 현재 주체/Tx/query·최단 기한·각 await 뒤 변경 검사를 보존한다.

SEND/START proof는 기존 예약 reservedAt이 원 publicChallenge.issuedAt보다 뒤면 거절한다. 기존 hash·target·receipt·consumed·resultRef/previousRef/proofHash를 유지한다. 0079는 기존 material_binding_complete 함수의 같은 signature/owner/ACL/trigger 아래 H/E 및 원 예약 결박만 보완하는 미적용 forward SQL이다. 원0062를 수정하지 않는다.

## 검증

Main 최종 직접6·인접3 실행 a0f397:

```text
node --experimental-transform-types --disable-warning=ExperimentalWarning --test tests/unit/FN08/execution-material-credential-basis.test.ts tests/unit/FN08/execution-material-credential-binding-schema.test.ts tests/unit/FN08/execution-material-credential-integration.test.ts tests/unit/FN08/execution-start-material-registration-flow.test.ts tests/unit/FN08/execution-material-registration-store.test.ts tests/unit/FN08/execution-instruction-queue.test.ts tests/unit/FN08/execution-materials.test.ts tests/unit/FN08/execution-routes.test.ts tests/unit/FN08/execution-instruction-material-parts.test.ts
```

- 138PASS / fail0 / cancelled0 / skip0 / todo0 / 8927.5331ms / exit0.
- npm run typecheck: 2a2bb2 exit0.
- git diff --check: e1e761 exit0. START flow 시험의 CRLF→LF 예정 경고1은 보존했고 Git 설정은 변경하지 않았다.
- 위 결과는 마지막 scopeDigest 및 START 타입 보완 이후 Main이 새로 실행한 결과다. Primary의 이전108 및 후속 선택1/1을 중복 합산하지 않는다.
- e71f18의 후검산에서 허용12·WI·보호3 raw hash가 전검산과 동일, HEAD 동일, index 비어 있음을 확인했다.

독립 검토는 source/helper, temporal guard, 미적용0079와 최종 시험 보완에 C0/I0/M0다. 마지막 I1인 SEND 시험의 임의 scopeDigest는 원 grantSnapshot.scopeDigest 사용으로 해소했고 한 곳 역치환 시 이전 시험 hash가 정확히 복원됐다. 기존 instruction 시험의 정상 COMMIT tag·실제 grant/예약/Tx 준비를 보강하되 유실/거절 COMMIT·queue/permit/nonce/rollback 단언을 보존했다. 내부 H3 기대값의 명시 보정과 외부 E1 불변을 구분했다.

START의 구조적 joint 여정은 실제 basis/parts/registrar/P256 및 기존 receiver.record/startOptions를 소비한다. 별도 구체 Store 시험이 H3/E1 부분 조회를 증명한다. 이 둘을 하나의 실제 PG 전체 종단이라고 합쳐 주장하지 않는다. 공유 fixture 추출 전 factory 전체의 byte 보존은 독립 미확인으로 남기며 원 제출 지문만 보존한다.

## 변경 파일과 raw manifest

| 경로 | bytes | SHA256 |
|---|---:|---|
| apps/server/modules/executions/execution-instruction-material-store.ts | 9652 | EACE07F05B802C765CE77B76E17FC484C8C7140902F2EBC7DF4CB8C69EC7BC99 |
| apps/server/modules/executions/execution-material-registration-store.ts | 18945 | 527C361160276B8CB664C4F237E8AE3E62B09D2FA4B265D60F70E6ED613C7CF4 |
| apps/server/modules/executions/execution-start-material-registration-store.ts | 26598 | 493A3A09CA91DBE6F6BE3A070046F63F06E4D3748183109BC803C0680EF339A1 |
| apps/server/modules/executions/execution-material-credential-basis.ts | 4041 | 0D06AF6C3378958C47AA1E49BB38CBB49594F4EE35459BE89FE9B99795874286 |
| db/migrations/0079_material_credential_namespace_binding.sql.pending | 7776 | 4297C897E32C8141B03D6C9741C7217A4CDADBDA6FAF39ABC521E9F551592DEB |
| tests/unit/FN08/execution-start-material-registration-flow.test.ts | 25313 | 83A59E810A43A278381FBF8DF0140DACFF0468E3031105F1910DF7CB9D92906A |
| tests/unit/FN08/execution-material-registration-store.test.ts | 27860 | CFBD5192B30841C3DD415B8EBC2E0A6AD7BFDD362F2D2B56ECA74219FC317508 |
| tests/unit/FN08/execution-material-credential-basis.test.ts | 5084 | 144FF4C65A2CB59F2DABFBE0FAF83562BC2ED10670CAB27CD63C9CBA4150BD8E |
| tests/unit/FN08/execution-material-credential-binding-schema.test.ts | 5575 | 4E4624A60DEBD1BB12565F02E849DD4C2E80930B2BCA8ED6852E16B5646BBB4F |
| tests/unit/FN08/execution-material-credential-integration.test.ts | 16498 | B9C7124A2F34AC7AC20DC4193FF85791B1AE9B8341FAB08E26831AAA5BB9C5F5 |
| tests/support/execution-material-credential-fixture.ts | 30147 | 2E8EFC8613D0D3E2FA2B4BDA896C12096FD9D5F432969258AE410B4AF47ED1DD |
| tests/unit/FN08/execution-instruction-queue.test.ts | 124154 | D220147B103E0658A235A82DC0A7C805D8F784243942924FF2FCACBD3F371E54 |

제품5(기존3·helper1·미적용SQL1), 시험6, 순수 fixture1로 합계12다. 화면·공개 API 형식 변경은 없다. 시험 fixture는 import 시 시험 등록·IO·전역 변경을 하지 않으며 factory별 상태를 분리한다.

## 오류·미검증·복구

- 원 namespace 제품 RED, 기존 COMMIT tag 누락 준비 실패3, quota SELECT 오분류·descriptor 재봉인·import/INSERT 위치·dataURI 준비 오류는 WORK_STATUS §264~275에 분리 기록했다. 합격 기준을 낮추거나 과거 실패를 소급 PASS로 바꾸지 않는다.
- Main 복구 읽기7afc59에서 D 경로 package.json 부재1을 확인했다. 소스 기준 경로의808e2a에서 실제 package·Git을 확인했으며 파일 생성이나 경로 변경은 하지 않았다.
- 실제 PG 설치·RLS/권한·trigger·COMMIT·SQL 완결 동작, 실제 자료 공급·HTTP/서비스·키·Agent·브라우저·사용자 인수는 NOT_RUN이다. 원 실행 제외를 유지한다.
- 실행 후 real QA 자원 생성0/정리 대상0. 운영·기존 DB·권한·키·서비스·실자료 조사0.
- 원격 push/정확 remote 일치·PR/main 통합·배포는 수행하지 않았다. 이전 private 거절은 우회하지 않는다.
- 복구는 이번 로컬 checkpoint의 허용 변경을 검토 후 정상 revert하는 방법이며 현재 실행하지 않았다. 보호 untracked3·기존 원문/SQL은 보존한다.
- WORK_STATUS와 구현 control에 검수·오류·미검증·다음 작업을 누적 기록하고 정본 문서 사본을 같은 bytes로 맞춘다.
- 다음은 현재 복구로 변한 선행만 대조해 승인된 다음 미완료 구현을 기존 Primary에 배정한다. 실제 자료 공급/SDK/권한 등 새 의미가 필요하면 정확 변경점만 분리한다.
