# FN09 원자료 재사용 합성 START 소스 구현 지시서 후보

상태 `DRAFT_WI / CONTRACT_ADOPTED / SOURCE_GO0 / ACTUAL_EXECUTION0`. 신산님이 [상세 계약](FN09_ORIGIN_REUSE_DETAILED_CONTRACT_CANDIDATE_20261107.md) SHA256 `1EABB2AD93AA87CCB61865249E88953D8400229DE92299AA24DD3BB046E96522`를 후속 구현 기준으로 채택했다. 이 문서는 코드 쓰기나 실행을 시작하는 지시가 아니다. 기준 Git HEAD는 `208149cc2d577c6b43b44d97db24c521d2f0bdd6`이고, 공식 경로 기준으로 아래 raw 파일을 별도로 결박한다. [작업현황](../WORK_STATUS.md#446-fn09-원-등록-영수증-공급자-검토) §446–448과 부모 `E7F4412B`의 412 판정을 적용한다.

목표는 원 S/Q를 그대로 보존하고, 현재 P2와 원 사용자·Session·임무에 결박된 명시 승인을 정확한 후속 합성 START 한 건에서 원자 소비하는 것이다. 환경 공개 현재성, 일반 7키 START, SEND와 인접 정책을 유지한다. 기존 큐·실제 원문 reader·registrar·예산/계상·명령·승인 원장을 사용하며 실제 Agent/SDK·키·OS writer·E 발급·외부 전송에는 연결하지 않는다.

## 1. 시작 지문과 허용 경로

후속 Main GO의 허용 후보는 제품 기존 17개·신규 2개(미적용 SQL 포함), 시험 기존 6개 총 **25개**다. 이 목록을 넘는 쓰기가 필요하면 정본 검수 단계에서 사유와 경로를 먼저 결박한다. 새 파일 두 개는 기준에서 모두 부재다.

| ID | 정확 경로 | 기준 raw bytes / SHA256 |
|---|---|---|
| P01 | `apps/server/modules/approvals/approval-input.ts` | 11068 / `4127D0614DADF44DC9E6062A4B592FA53D4D2DA3C193DC4787BFFB22C7635BDA` |
| P02 | `apps/server/modules/approvals/project-approvals.ts` | 53103 / `8D9BFB36F2A3A85B2D834C1F57B4D32BD0485949E8EEA53039CA33B4A97531DC` |
| P03 | `apps/server/modules/access/project-command.ts` | 46544 / `BF43D515D968D5E1AA9012197B3FB74F76F874B0EC3EF79AA07E8F82310E5A2B` |
| P04 | `apps/server/modules/connections/environment-registration-evidence.ts` | 9851 / `976EFEFA2D97A1CA2A2A5C1D18CA17741992E044A3C0C3C7D72E3C810E62BC39` |
| P05 | `apps/server/modules/connections/project-registration-reads.ts` | 13824 / `D7B67C3C837036EDBC01643F78B6F056FBEE7871E08E5BE312D20115CE1A6633` |
| P06 | `apps/server/modules/connections/project-environment-resources.ts` | 28439 / `A9294C98678622A2E8381C23BDC205926567EAA8DDF77EB8848DAA6A112F8952` |
| P07 | `apps/server/modules/connections/project-environments.ts` | 15784 / `7F6D71370081EC8D2DD72717C7A6F13F6497A7CB35CE26B3F1372F530D01E044` |
| P08 | `apps/server/modules/executions/project-execution-preparations.ts` | 22172 / `FEF85317417E67660FE616A48CFB5D5BDEE3A623424DC094A6CAE49BDAE65009` |
| P09 | `apps/server/modules/executions/runtime-policy.ts` | 21793 / `3FD4A24CF3DA750AA558964A2D115434EB6039A239FA680F87A591E8976C7661` |
| P10 | `apps/server/modules/executions/execution-start-origin-sources.ts` | 10948 / `CBC3048D44F5CF7251901827395F5F6C6BD60D9CC648E453932EADFC66414E4F` · 동결 WIP |
| P11 | `apps/server/modules/executions/execution-start-origin-queue-basis.ts` | 13195 / `ECD7B7495C8B3D1BB5A934A5E4B8DA3527D5C16780BF20E506C732369D024C63` · 동결 WIP |
| P12 | `apps/server/modules/executions/execution-commands.ts` | 16152 / `E3428F1B8A3E1002623AD87AFF00BC0D9E790F6C0EF49CCC5539BA32850E6131` · 동결 WIP |
| P13 | `apps/server/modules/executions/execution-start-context-source.ts` | 15749 / `24273B1B1B83314E554EBEB57B0C90D78256B422352F30C92A325019880B240C` |
| P14 | `apps/server/modules/executions/execution-start-material-registration-store.ts` | 26598 / `493A3A09CA91DBE6F6BE3A070046F63F06E4D3748183109BC803C0680EF339A1` |
| P15 | `apps/server/modules/executions/project-runtime-commands.ts` | 4333 / `44FAAEE3AF0A7F74A407A87719BFF3EE51ECFD4B4F93A5EA52B7520118FA9FBC` |
| P16 | `apps/server/modules/projects/project-storage-quota.ts` | 54319 / `7FAB00770398596E7B58F910916346C04F539A6E2C623672CCDE37F1D45CA980` |
| P17 | `apps/server/modules/projects/routes.ts` | 91101 / `2FA07AED309CC7B6A46E59EC2790841A093607A9C3F23BF7B99B605C0F8D12E6` |
| T01 | `tests/unit/FN09/execution-start-origin-fixture.ts` | 44038 / `9B75A014E748418815A36D621295B404F7FBB513AF7615B41F2AFB0FD28CDBF6` · 동결 WIP |
| T02 | `tests/unit/FN09/execution-start-origin-queue-basis.test.ts` | 21931 / `E093BB100DD384F1903CBFA7F4ED9AA611FDA895A74CC5A13F3C0EE300429501` · 동결 WIP |
| T03 | `tests/unit/FN09/execution-start-origin-routes.test.ts` | 5127 / `BABAF6FE1E6FBD6C201F0E28F62FFB1B612EE298815B258AB5482EBC4BC0111B` |
| T04 | `tests/unit/FN08/execution-start-context-source.test.ts` | 44490 / `C42A8D6B993B3991FAA4B543BA2566C673D7DD0F39E20898D3DC8C834474D61E` |
| T05 | `tests/unit/FN08/execution-start-material-registration-schema.test.ts` | 4518 / `020D448D3E417AC414BBAECE4CB91C8ADDD5E93D38B8630831509272560A51BE` |
| T06 | `tests/unit/FN13/project-storage-quota-schema.test.ts` | 19089 / `8E3B74044B7EC097896570B49EB909F86A10AB0B4C09D5371DF21A5E6C92FF5F` |
| P18 | `apps/server/modules/executions/execution-start-origin-reuse.ts` | 신규 · 부재 |
| P19 | `db/migrations/0082_fn09_origin_reuse_synthetic_start.sql.pending` | 신규 · 부재 |

동결 5개(P10–P12/T01–T02)의 시작 바이트와 412 증거를 유지한다. 기준 계약 채택이 이전 미합격 A안의 병합·승인을 뜻하지 않는다. 쓰기 전 Main이 동결 5개의 시작 manifest와 정확 기존 diff를 읽기 전용으로 보존하고 동결 해제 범위를 지시서에 결박한다. 범위가 풀리면 원 basis·시간·보호 reader·합성 장부 경계의 재사용 가능 부분만 대조해 이어 쓰며, 동결본의 실패 기대값이나 실제 검사를 대역으로 교체하지 않는다. 기준 `f54c3655cdc58ebc0f5c345e66d5cfa8fef4010e` 위의 `e3801b` 409와 동결본의 `21ecb5` 412는 역사 증거다. checkout/restore로 타인 변경이나 동결본 전체를 되돌리지 않는다. 구현 도중 경계가 열리지 않으면 현재 결과를 새 지문과 함께 반환하고 Main이 보존을 결정한다.

쓰기 제외는 이 문서와 상위 계약·현황, `apps/server/main.ts`, `apps/server/app.ts`, Web, 모든 기존 migration, 기존 S/Q 등록 저장·취소·조회 계약, 일반 auth repository·권한 부여, 기존 통합 시험이다. 실제 DB/SQL 적용, 계정/권한/키/서비스, Agent/SDK, 실자료/운영/배포와 Git 쓰기는 별도 승인 영역이다. SQL은 P19의 정적 소스로만 작성한다.

## 2. 착수 전 닫을 기술 조건

- [ ] **원 등록 증거.** P04의 `environment-registration-evidence.ts`는 저장된 `request_hash`와 원 registerConnector·영수증·감사·필요 시 승인 소비의 무결성을 검증한다. 원 입력 reason이 보존되지 않아 전체 P1 요청 바이트를 재도출할 수 없다. 저장 hash와 exact 원장 관계까지만 증명한다. P04/P05/P19의 같은 Tx 보호 접점에서 등록/connector 행과 exact 원 Session ID·사용자/client·H/제어·설치·ref/세대·공개키 지문을 별도로 결박한다. 저장된 scope fingerprint만으로 공개키를 대체하지 않고, 확인 가능한 실제 공개키 원형을 원 helper로 지문화해 대조한다. 공개키 원문·Secret·토큰은 외부 응답이나 증빙 JSON으로 내보내지 않는다. 과거 P1에 유효했던 등록 증명과 현 P2의 허용/DENY·회수·기한은 따로 검증한다. 원 Session의 재인증이 만료되면 새 Session으로 승계할 수 없다.
- [ ] **잠금 및 ACL.** 인증 Session/user/client → project/member/control → P2 정책 head → 단계·배정·역할·논리 Session·원자료 → exact 가변 환경/하위 head 및 등록/connector → 한도 → 승인 row → quota account/reservation 순으로, 실제 기존 writer와 교차대조한다. 같은 단계의 복수 행은 종류·ID 고정 순서를 쓴다. `0069:549–574`는 `environment_configuration_commit`의 head 갱신 전에 project lock을 선취하지 않으며 해당 app 직접 쓰기 권한을 회수한다. `0069:252–289`의 지연 계상은 후행 project lock을 잡을 수 있다. 아래 A0는 단계 A보다 먼저 닫을 P19 필수 선행이다. 기존 7인자 commit의 원 auth/context 뒤, 첫 head DML 전에 project `FOR UPDATE`를 선취하도록 같은 함수의 본문을 forward 교체한다. 보호 잠금이 필요한 head는 app 직접 `FOR SHARE` 권한을 가정하지 않고, exact session/actor/client/project/request/P2/ref를 검증하는 목적 한정 보호 RPC 안에서 확보한다. 기존 RLS·소유자·검색 경로를 확인하고 app에 표 권한을 추가하지 않는다. 동일 writer의 다른 RPC·직접 writer 권한을 대조해 잠금 순서가 닫히는 증거를 Main에 반환한다. 실제 교착 재현 또는 PostgreSQL 증거는 이 지시서 범위에서 미실행이다.
- [ ] **원장·계상.** `0077:517–623,689–940`의 기존 원장·정규형·예약/정산 규칙을 기준으로 §5의 세 목적을 분리한다. 기존 approval request JSON/guard로 봉인된 evidence·candidate payload와 원 명령 bytes를 보존하는 exact 연결이 가능한지 결정한다. 본 안은 요청 JSON 목적 키와 기존 원장 재사용을 우선한다. 별도 저장행이 필요하면 기존 공개 상태/권한을 바꾸기 전에 P19 안의 최소 형식·PK/FK·불변·비용·역완결 변경을 Main 지시서에 결박한다. 이 결정이 닫히기 전 목적별 성공 분기를 열지 않는다.
- [ ] **합성 조립.** 하나의 명시 private 조립체가 같은 `AccessRepository`/실제 context·준비·연결·환경 reader 및 기존 한도/예산을 쓴다. source/fact 포트의 원 출처와 검산 가능한 명시 합성 `BudgetUnits` 수요를 공급하는 정확 입력을 Main에게 확인한다. S/Q 또는 P2 허용만으로 fact check/expiry/registration을 성공 값으로 만들 수 없다. 승인 서비스와 큐가 같은 실제 조립체를 사용한다는 소유/정체성 검사를 확인한다. 별도 큐 명령 인자를 추가하는 시험은 HTTP 조립을 증명하지 않는다.

## 3. 단계 A0와 A — 잠금 선행 및 독립 보호 관측

**A0**는 P19의 미적용 잠금 선행이며 T05로 소스 형상을 검산한다.

- [ ] `0082`에서 `CREATE OR REPLACE FUNCTION anvil.environment_configuration_commit(s uuid,a uuid,c uuid,p uuid,request jsonb,snapshot jsonb,evidence jsonb) RETURNS jsonb`로 기존 함수를 교체한다. `environment_configuration_context(s,a,c,p)` 내부의 `fn01_active(s,a,c)`와 기존 context 확인이 완료된 뒤, 첫 head INSERT/UPDATE 전에 해당 project 행을 `FOR UPDATE`로 잠근다. 기존 명령·정책·head CAS·무결성 검산과 반환을 유지한다. 기존 함수의 동일 시그니처·소유자·`SECURITY DEFINER`·`search_path`·ACL을 보존한다. 기존 migration 수정, 함수 drop/recreate, 새 권한 부여는 금지한다. 이 순서를 정적 검산한 뒤 A의 보호 관측을 연결한다. 실제 SQL 실행·교착 검증은 미실행이다.

**A**는 파일 P04–P08/P10/P18, 시험 T01/T02/T04의 보호 관측 RED와 독립 검산까지만 완료 조건으로 삼는다. 실제 승인·큐·계상 통합 양성은 B와 C가 함께 닫힌 뒤에만 검수한다.

- [ ] 첫 새 정상 기대 시험은 기존 실제 보호 클래스에서 P1으로 등록한 S/Q/connector를, P2의 원 역할·Session·H·재인증과 실제 읽기 정책으로 새 목적에서만 관측하도록 만든다. 기존 경로는 같은 P2에서 412와 공개 `CHANGED/POLICY_CHANGED`다. 신규 분기의 RED에서 보호 경계 또는 미연결 코드와 정확 명령·exit를 기록한다. 저장 hash 조작이나 자료 mock으로 정상 값을 만들지 않는다.
- [ ] P04/P05의 원 등록 검산과 P06–P08의 기존 history/head/read를 P18의 목적에 필요한 내부 관측에만 연결한다. S/Q/단계 WAITING·미취소, 원 assignment/role/logical Session, env/host/profile/Secret metadata/source-root exact fullrefs와 상태를 전후 대조한다. 일반 `MATCHED`에서 `POLICY_CHANGED`를 빼지 않는다. 재인증·정책·등록·한도·원 수명은 잠금 후 DB 시각에서 각각 검사하고, 긴 대기는 기존 단조 mark 기준 잔여 시간만 허용한다. 환경은 원 공개 의미를 반환한다.
- [ ] A에서 P18의 관측 경계를 같은 db/query/txid, 원 인증 actor tuple, 원 S/Q/P1/P2와 자료 ref/최단기한에 결박한다. B+C에서 실제 원 START 명령 ID/full request hash 및 승인 request/decision/scopeDigest까지 검산한 뒤에만 큐와 자료 공급이 소비할 private 증명을 만든다. raw JSON/동일 형태 객체/GUC를 권위로 받지 않는다. 외부 callback이나 setter로 증명을 지정하지 않고 같은 조립체 소유에서만 읽으며, rollback/COMMIT 및 교차 Tx는 폐기한다.
- [ ] 거절은 원 등록 증명 누락·공개키 지문 불일치, 다른 원 Session/H/actor/client/control, OWNER 상실, 등록 DENY와 재사용 DENY 각각, reauth/Session 만료·회수, WAITING 취소, 다른 ref/가변 head 변경, 관측 사이 만료로 나눠 검증한다. 원문 body·보호 결과와 새 효과는 실패 뒤 반환하지 않는다.

## 4. 단계 B — 공개 접점, 원장 및 큐·원문 실제 조립

파일 P01–P03/P09–P18, 시험 T01–T04.

- [ ] 실제 App 주입 시험을 먼저 작성한다. `buildApp`의 기존 네 번째 `SyntheticHumanExecutionPorts`에만 P18의 실제 큐·자료 공급을 명시 결합한다. P15는 선택적 capability의 내부 정체성/일치만 전달하고, `dispatchSyntheticHumanExecution`은 기존 세 인자 queue 호출을 유지한다. P17에서 기존 `ProjectApprovals`에 같은 capability를 건넨다. 별도 합성 capability가 없으면 기본 앱에서 기존 명령 enum의 큐 비노출을 유지하며, 원래 존재하는 `requestApproval/decideApproval`의 이 목적 요청은 서비스가 첫 쓰기 전에 거절한다. 기본 운영 진입·환경 플래그를 추가하지 않는다.
- [ ] 기존 `POST /api/v1/projects/:projectId/commands`의 `requestApproval` 목적 분기에서 exact `{details,candidatePayload}`와 상세 계약 §2의 SHA를, `decideApproval`에서 원 요청 ref·scopeDigest와 동일 reauth OWNER를 검산한다. 승인 없는 일반 7키/null은 그대로다. 새 8키는 `originReuse:{originRef,reservationRef}` 한 키만 추가하며 START의 실제 제출에는 non-null exact `approvalRef:{requestId,decisionId,scopeDigest}`가 필요하다. 기존 승인·명령의 이름이나 범용 envelope를 늘리지 않는다. 정책 전용 `reuseExecutionStartOrigin`은 정책 parser에 한정하고 공개 명령 enum에는 넣지 않는다. P02/P03은 목적의 정확 receipt/consume 분기에서 기존 원장의 CAS를 재사용하며 일반 승인 검사를 느슨하게 하지 않는다.
- [ ] P11/P12는 원 S/Q 기반 basis와 승인된 원 command를 비교하고, P09의 기존 `authorizeExecution`·`queueExecutionCommand`에는 해당 정책 함수 호출 동안에만 `approvalRef:null`의 별도 불변 투영을 넣는다. 새 목적과 승인 자체는 독립 검산한다. resolver/registrar·replay·영수증·감사·소비는 non-null 승인 참조를 포함한 실제 원 명령으로만 동작한다. 기존 runtime DENY/REQUIRE_APPROVAL 거절과 최단기한을 그대로 적용한다.
- [ ] 기존 예산 예약과 `resolver.current` 뒤 최종 검산된 동일 합성 fact/grant 수명을 P18에서 묶는다. P14의 실제 `prepare → source.describe/inspect → register`와 P13의 `#load` 앞뒤 보호 관측이 같은 db/query/txid와 원 명령의 private 증명을 소비하도록 연결한다. descriptor/manifest/group 및 원문 ref·bytes/hash·최단기한을 대조한다. 같은 Tx에서 `readBody`가 필요하면 그 원 commandRef까지 결박하며, PoolClient 대여만으로 Tx 일치를 추정하지 않는다. 기존 두 그룹의 envelope/원문 키는 그대로다. COMMIT 후 실제 자료 제공·SDK/Agent 연결은 이 목적의 보존된 성공 범위에 포함하지 않는다.
- [ ] 단계 C의 완결과 세 단계 정산이 연결된 뒤, 같은 command/receipt/audit·승인 소비·budget/queue/material/outbox의 실제 메모리 여정으로 한 건 성공을 검산한다. 교차 actor/Session/Tx/command/descriptor, 승인의 만료·미결정·거절·다른 목적, 동일 승인과 다른 승인/같은 실행ID 경쟁, material 실패를 거절한다. 명시 합성 포트가 없는 App에서 request/decide/queue 효과 0, 기존 7키/null START·SEND·기존 origin GET/등록을 회귀 검사한다. 원자료의 hash와 모든 실제 권위 false는 양성에서도 유지한다.

## 5. 단계 C — 미적용 0082 완결 및 계상

파일 P02/P03/P12/P16/P19, 시험 T02/T03/T05/T06.

- [ ] P19는 A0의 기존 7인자 commit 잠금 선행을 보존하고, 기존 번호 파일을 수정하지 않는다. C에서는 정확 새 목적만 승인 요청/결정/소비 검산·`0078:94,124–132`의 START 완결·역완결·알림·프로젝트 계상 dispatcher에 연결한다. 기존 7키/null START는 원 0078, SEND는 원 0062로 위임한다. 승인 증거 일부 누락을 기존 분기로 대체하지 않는다. 실제 8키와 exact approvalRef로 full request hash를 재구성하고 P2의 receipt/decision/소비 ID·payload_ref·audit·queue/envelope/manifest/material/outbox를 양방향 검산한다. PENDING/APPROVED는 역사로 남길 수 있고 CONSUMED/v3은 exact APPLIED START와 자료 집합을 요구한다. 승인 앞·뒤, 명령 및 자료 어느 쪽만 만들어도 완결되지 않는다.
- [ ] 기존 quota account의 같은 project 잠금 및 적용 가능한 상한·coverage·generation을 유지한다. 각 단계는 해당 원 내부 command ID를 reservation ID로 발급하고 reserve→정확 행 저장→actual→SETTLED를 같은 PoolClient/Tx에서 수행한다. 목적별 고정 reserve/settle 인자·원장 행 투영·R 자기비용과 외부에 노출되지 않는 helper/ACL을 구현 착수 전에 Main과 닫는다. 0077의 canonical projection과 `used + held + reserve + 기존 분리 소계`를 그대로 대조하며 새 상한을 만들지 않는다. 기존 계상 대상이면 새 소계로 한 번 더 더하지 않는다. 0062 자료 한도는 별도로 검사하며 그 한도 수치를 프로젝트 비용에 합산하지 않는다.
- [ ] 요청 비용은 이 요청의 v1·후보 증빙·명령/영수증/감사·원 요청에 귀속된 알림 실제 행이다. 결정 비용은 자체 명령/영수증/감사·결정 행과 v2−v1 차분이다. START 비용은 자기 명령/영수증/감사·소비·v3−v2 차분·자기 큐 및 자료 계상 투영이다. `requestApproval` 알림의 원 명령 hash는 exact `{details,candidatePayload}`를 복원해야 한다. S/Q·이미 정산한 요청/결정/알림·기존 기록을 재계상하지 않는다. 행 누락/추가·정산 불명·coverage 불명은 성공으로 반환하지 않는다.
- [ ] exact 보호 `GET /api/v1/projects/:projectId/approvals/:id`에 상세 계약의 `originReuseOutcome`를 한정 연결한다. COMMIT 정상·응답 유실에서는 새 인증과 현재 보호 조회로 동일 원 command/hash/receipt를 검산해 보관 결과를 읽는다. 저장·계상 0을 단언한다. COMMIT 또는 조회 불명은 새 승인을 발행하거나 원 명령을 재전송하거나 예약을 추정 해제하지 않는다. 중간 실패 rollback과 별도 거절 감사 정착을 구분한다.
- [ ] 정적·순수 검수로 기존 함수 위임, ACL 범위, NULL과 non-NULL 승인 투영, reverse graph, 원장 단계 차분과 각 단계 replay 0을 검사한다. 기존 SQL/서비스를 실행하지 않는다. 실제 PostgreSQL 잠금/COMMIT/GRANT/trigger와 전체 용량 검수는 `NOT_RUN`이다.

## 6. 실행 및 최종 반환 조건

아래 검수는 구현 GO 뒤 수행하며 이번 문서 작업에서는 실행하지 않는다.

```powershell
node --experimental-transform-types --experimental-test-module-mocks --disable-warning=ExperimentalWarning --test tests/unit/FN09/execution-start-origin-queue-basis.test.ts tests/unit/FN09/execution-start-origin-routes.test.ts tests/unit/FN08/execution-start-context-source.test.ts tests/unit/FN08/execution-start-material-registration-schema.test.ts tests/unit/FN13/project-storage-quota-schema.test.ts
node --experimental-transform-types --experimental-test-module-mocks --disable-warning=ExperimentalWarning --test tests/unit/FN08/execution-command-ledger.test.ts tests/unit/FN08/execution-start-material-registration-flow.test.ts tests/unit/FN09/execution-start-origin-store.test.ts tests/unit/FN09/execution-start-origin-quota.test.ts tests/unit/FN06/environment-versions.test.ts
npm run typecheck
git diff --check
```

단계별 exact 시험명, 실제 RED 원인과 준비 오류, 출구 코드와 고유 개수를 남긴다. 최종 결과에는 시작/종료 HEAD·허용 전체 변경 전후 raw·변경/미변경과 제외 범위, 미정 기술 조건, 보호 파일 및 타인 변경 보존, 미실행과 live/pending, writer 반환을 포함한다. Main 독립 검수 전 커밋하지 않는다. 네 기술 조건이나 합성 정상 여정이 닫히지 않으면 `INCOMPLETE`로 반환하며, 정상 기대 변경·항상 412인 대체 분기·fixture의 성공 fact를 인수 증거로 사용하지 않는다. 상세 계약에서 이미 채택한 의미를 임의로 바꾸거나 실제 실행을 여는 데 이 지시서를 사용하지 않는다.

### B1 조립 한정 동결 해제

B0는 보호 관측 본문만 모듈 내부로 분리했다. B1의 허용목록은 P02/P12/P15/P17/P18/T03이다. P12는 원 Queue 객체와 동일 인증 거래에 내부 관측을 결박하는 부분에 한해 동결을 해제한다. P10/P11/T01 및 T02의 기존 역사 바이트는 유지한다. 시작 원본 5개를 정확 바이트로 복사하고 208149cc 기준 기존 diff를 저장했다. 이 세션의 보호 임시 폴더 anvil-fn09-frozen-09c2acb9f5b14d78851997a7a4abc137에 manifest D250DF8A86DC82634D36077B2F1018B201516D38A8AE5EE3DE84F980A242FBA0 및 diff ABC2E5780866D32BEEF9AE3BD00E300C062E03CD25504FC4C4C8EBFA0F3B13A3가 있다. 역사 412와 소스 차이는 인수 증거에서 분리한다.

P18 모듈 내부의 객체 정체성으로 같은 실제 큐·AccessRepository·원 command 메서드를 결박하고, 기본 App·기존 대역 큐·위조 또는 다른 큐의 capability에서는 등록 관측에도 들어가지 못하게 한다. 정상 조립도 기존 보호 관측과 검증된 내부 도달까지만 구현한다. 승인 요청·결정 저장, 승인 소비, 영수증/정산/큐 쓰기 및 성공은 C와 후속 연결 전 계속 차단한다. 새 외부 API·권한 또는 앱 환경 설정을 만들지 않는다. 기존 세 인자 dispatch와 원래의 합성/일반 분기를 유지한다. 기존 fail-closed 외부 응답은 지킨다. 실제 DB/권한/키/서비스/Agent/SDK/WSL은 실행하지 않는다.

B1의 동일 인증 거래 결박에 P03 한 경로를 추가한다. 원 ProjectPolicyRepository.command와 인증 콜백, 원 정책·제어·replay·거절 감사를 유지한다. P03의 기존 비공개 command context에서 재사용 요청의 실제 AccessRepository와 원 authenticated 메서드, db/query, actor/session, 고정 명령을 대조하고 유효 여부만 반환한다. 세터·외부 callback·raw context·별도 command 분기는 추가하지 않는다. B1 진입은 요청의 보호 관측까지만 허용하며, 결정과 START는 저장 증거가 생기는 후속 범위까지 기존대로 차단한다.

### B1b 보호 관측 전용 접점

B1a의 합성 포트 식별이 연결된 경우에도 이 목적의 승인 요청은 원 ProjectPolicyRepository.command, 원 인증·정책·제어·재조회 검사를 거친다. 같은 실제 인증 콜백 안에서 기존 material 호출과 기존 replay 성공 반환보다 앞서 목적 한정 보호 관측만 수행한 뒤 항상 412로 끝낸다. 이 분기는 원 material 콜백 또는 다른 쓰기 콜백을 호출하지 않고 결과나 원문을 외부에 반환하지 않는다. 기존 거절 감사만 유지한다. 기본/대역/위조/다른 큐·다른 Access/이전 거래는 관측 전에 거절한다. 기존 일반 명령과 승인 저장 경로는 동일하다. B1b는 P02/P03/P17/P18/T03에서 이 차단과 실제 App 합성 관측만 확인한다. 승인 저장·소비·실행 큐·계상·결정·START는 연결하지 않는다.

앞선 자동 안전심사가 거절한 P03 변경은 기존 material을 호출할 수 있는 안이었다. 그 작업은 실행하지 않았다. 이 접점은 해당 호출 자체를 금지하는 별도 안이며 기존 변경을 재실행하거나 우회하는 데 사용하지 않는다. 자동심사가 이 안도 거절하면 P03 재시도 없이 실패 근거와 변경 여부를 기록한다.

### B2b 조립 검산 보완

ResponsibleSessions의 실제 생성 여부는 외부 객체 형태가 아니라 기존 private 필드 브랜드로만 검산한다. 이 보완의 허용 파일은 P18/T03과 apps/server/modules/assignments/responsible-sessions.ts 한 경로다. ResponsibleSessions에는 부작용 없는 내부 정적 브랜드 판정만 추가하며 기존 읽기/쓰기 구현·API·권한은 유지한다. P18은 원 브랜드/결박 reader와 결박 reader가 호출하는 기존 승인소비 reader를 고정한다. 객체 prototype 모방·원 메서드 교체는 보호 원장 조회 전에 거절한다. 정상 결박 관측은 기존 합성 App 안에서만 검산하고 원 요청의 승인 저장·소비·큐는 계속 닫는다. 실제 DB·키·권한·서비스·Agent는 실행하지 않는다.

B2b 재검수에서 원 승인소비 메서드의 전후 대조만으로는 await 사이 순간 교체를 막을 수 없음을 확인했다. 같은 허용 경로에서 ResponsibleSessions가 기존 승인소비 reader의 원 함수 참조로 실제 호출하는 한 줄과 필요한 원 참조 선언을 추가 허용한다. 일반 결박·논리세션의 원장 검산과 호출 매개변수는 유지한다. 메서드 교체의 순간 원복 음성 시험을 추가하되 실제 승인/DB를 열거나 fixture를 정상 증거로 승격하지 않는다.

### B2d 원 계획·방법론 보호 읽기 연결

P18/T03만으로는 WorkPlans의 private 문서·설계 인덱스와 Documents의 private 저장소 실제 호출을 고정할 수 없다. 동일 보호 경로의 호출 결박에 한해 apps/server/modules/traceability/work-plans.ts, apps/server/modules/traceability/design-index.ts, apps/server/modules/documents/project-documents.ts 세 기존 파일을 추가 허용한다. 새 공개 API·권한·원문 저장·출력은 추가하지 않는다. 일반 읽기/쓰기와 파일 포트 호환은 유지한다. 기존 계획·설계·문서의 검산 본문을 공유하고, 명시 합성 조립의 실제 receiver와 원 reader 메서드만 내부에서 결박한다. 기존 ArtifactStore의 private 경로·파일·길이·SHA 검산과 합성 파일 포트는 그대로 둔다. 전역 prototype이나 실제 공유 인스턴스를 수정하지 않는다.

같은 인증 거래에서 원 초안 head 잠금과 기존 current의 계획 확정/head/최신 검토, AF04 원문·업무 카드, 방법론 적용·노드·원 basis를 모두 대조한다. T03은 기존 실제 보호 문서와 메모리 파일 포트를 사용한다. 정상 원문 IO와 계획·방법론 관측 후에만 다음 읽기에 도달하고, 같은 길이의 원문 변조와 조립 위조는 환경 조회 전에 실패해야 한다. 보호 자료 반환·승인 저장·소비·START·정산과 실제 DB/키/권한/서비스/Agent는 제외한다.

### 원 환경 연결기 정상 합성 자료

T01 44,038바이트 원본 9B75A014E748418815A36D621295B404F7FBB513AF7615B41F2AFB0FD28CDBF6과 HEAD 208149cc 대비 정확 diff 8B5912B55280E67C3E8FC350D68BABF12B5D38B7CF55752EBDDB66A4441FDA07을 로컬 무시 경로 .av3-data/fn09-origin-reuse-freeze-208149cc에 보존했다. T01과 T03만 한정한다. 기존 기본 호출·T02 실패 증거를 유지하고 선택적 합성 환경에서만 같은 실제 fixture의 project/user/client/Session/P1에 맞춘 등록과 공개 SPKI 증거를 만들고 환경부터 준비와 S/Q까지 정확 ref로 생산한다. 저장 증거를 사후 수정하거나 대역에서 보호 관측을 성공으로 반환하지 않는다. 새 DB·권한·키 파일·실제 서비스 실행은 없으며 시험의 메모리 장부와 합성 공개 지문만 사용한다.

시험에서 정상 연결기 환경은 P2에서 기존 보호 등록과 환경·기한 조회를 지나야 한다. 등록 회수나 증빙 오염은 해당 지점에서 거절한다. 최종 외부 결과는 계속 412이며 도메인 쓰기는 없다. 기존 환경 producer 또는 실제 등록 producer를 쓰지 않고 자료만 준비한 단계는 그 경로의 검증으로 기록하지 않는다. 정본 T01에는 이전 실패 기대를 바꾸지 않는 좁은 정적 타입 수정을 포함할 수 있다.

### B2d 대안 결정안 — 미채택·미실행

기존 거절안 bindProtectedPlanDocuments export를 재생성하지 않는다. 대안은 합성 승인 관측에만 내부 보호 모드를 명시한다. 대상 다섯 파일의 계약 차이는 다음과 같다.

- project-documents.ts의 기존 생성자에 선택적 세 번째 mode FN09_PLAN_PROOF를 추가한다. 해당 모드에만 실제 ArtifactStore receiver와 원 read를 private 필드에 결박한다. 정적 isProtectedPlanReader는 정확 클래스·private 초기화만 판정한다. 기존 version/originalText 인수·반환 및 일반 저장소 호출은 유지한다. 저장소·경로·원문을 노출하는 신규 export는 없다.
- design-index.ts의 기존 생성자에 같은 선택 모드를 추가한다. 보호 모드의 #source/read에서 원 version/originalText만 호출하고 기존 공개 시그니처와 AF02/AF03 검산을 유지한다.
- work-plans.ts에는 내부 static protectedCurrentReader(documents: ProjectDocuments): Readonly<Pick<ProjectWorkPlans, 'read' | 'decision'>>만 추가한다. 보호 receiver를 확인하고 전용 계획/인덱스 객체에서 원 read/decision 및 기존 검산 본문을 호출한다. 문서·원문·저장소를 반환하지 않는다.
- execution-start-origin-reuse.ts의 기존 합성 capability 생성에 선택적 네 번째 protectedPlanDocuments?: ProjectDocuments를 추가한다. 이 경우에만 고정 계획·방법론 포트를 실제 ProjectAssignmentDrafts.current에 결박하고, B2c head 뒤 같은 xid에서 호출한다. 일반 세 인자와 다른 승인·실행 경로는 유지한다.
- execution-start-origin-routes.test.ts는 기존 메모리 파일 포트에서 해당 모드만 조립한다. 정상 AF04 열기·읽기·닫기와 실제 계획/방법론, 같은 길이 변조·stale 계획/방법론·위조 객체·xid 전환 차단을 검증한다. 기존 일반 문서·설계·계획 회귀를 확인한다.

이 변경은 HTTP/DB/ACL·키·파일 포트·실제 환경·승인 저장·큐를 열지 않는다. B1b의 412와 도메인 쓰기0은 유지한다. 롤백은 위 다섯 파일의 추가분만 복원하여 B2c head 보호와 기존 미연결 상태로 돌아간다. 소스 후보는 직접 채택 및 플랫폼 심사 전에는 적용하지 않는다. 실제 diff는 구현 후보 심사 대상으로 별도 확정한다.

### 정책 파서의 범위 검증

자동심사가 EXECUTION else 내부의 허용 목록 변경만으로는 PROJECT 규칙에 들어갈 수 있다고 판정해 거절했다. 해당 변경은 반영하거나 재시도하지 않는다. 별도 후보는 정책 전용 연산을 발견한 각 규칙에서 exact EXECUTION 형태와 동일 project, execution ID·양의 안전 정수 세대·source scope·limit ref를 먼저 검사하도록 한다. PROJECT/혼합 scope/문서 연산 혼입은 기존 오류로 닫는다. 공개 명령 enum·기존 연산 dispatch·권한·저장은 유지한다. P03/T03의 실제 parser 시험을 먼저 고정하며, 플랫폼이 이 별도 후보도 거절하면 우회 없이 보존한다.

### P03 정책 파서 정확 후보 — 직접 결정 전 미실행

별도 자동심사도 P03 권한 경계가 앞서 직접 채택한 다섯 파일 밖이라는 이유로 거절했다. 정확 대상은 apps/server/modules/access/project-command.ts의 materialRules다. 시작 50,664바이트/22254B223FD3CDCA0EF87433FB9F513209484D2264235D8BE42FBD7422751C61에서 const scope 선언 직후에 다음 13줄만 추가한다. 후보 51,758바이트/18C58405631B1520946A82039C58B3BB863FB4CF2CFEE565EE7C52B1842A2CFA를 Main 메모리에서 재도출했다. 기존 P03 바이트는 그대로다.

~~~ts
    if (rule.operations.includes('reuseExecutionStartOrigin')) {
      if (exact(scope, ['kind','projectId']) && scope.kind === 'PROJECT' && scope.projectId === projectId)
        throw new AuthFailure('POLICY_SCOPE_NOT_READY', 412);
      // 정책 전용 목적은 이 분기에서만 정확한 EXECUTION 범위를 확인하고 수락한다.
      if (!exact(scope, ['kind','projectId','executionId','executionGeneration','sourceScopes']) || scope.kind !== 'EXECUTION' || scope.projectId !== projectId
        || !uuidV1(scope.executionId) || !Number.isSafeInteger(scope.executionGeneration) || Number(scope.executionGeneration) < 1)
        throw new AuthFailure('POLICY_INPUT_INVALID', 422);
      try { readSourceScopesV1(scope.sourceScopes); } catch { throw new AuthFailure('POLICY_INPUT_INVALID', 422); }
      if (!refV1(rule.limitPolicyRef) || rule.operations.some(item => item !== 'reuseExecutionStartOrigin' && !(runtimeOperations as readonly string[]).includes(item)))
        throw new AuthFailure('POLICY_SCOPE_NOT_READY', 412);
      seen.add(rule.ruleId);
      continue;
    }
~~~

T03의 실제 parser 검증만 함께 한다. 정상 EXECUTION, PROJECT/혼합/잘못된 scope·문서 연산 혼입의 거절과 공개 enum 및 기존 규칙 불변을 검수한다. 승인 요청 관측 저장/권한 부여·정책 실제 저장·새 명령·실행 평가·DB/키/서비스는 범위에 포함되지 않는다. 롤백은 위 13줄과 해당 시험 추가분만 역치환한다. 직접 승인과 플랫폼 심사 전까지 적용하지 않는다.

### 원 Context metadata의 동일 거래 검산

다음 단위는 P18/T03 및 기존 context/project-contexts.ts, approvals/project-approvals.ts, knowledge/knowledge.ts의 원 내부 호출 결박으로 한정한다. 기존 ProjectContextSources/ProjectContexts의 진짜 생성자와 판독 본문을 공유하며, B2d에서 채택한 보호 문서·계획·초안·확정 포트에 원 지식·대화 reader를 결박한다. context 승인 이력의 원 호출을 고정하고 잘못된 후보 표식은 다른 reader를 실행하기 전에 기존 오류로 거절한다. 일반 읽기/쓰기·기존 source 형식·공개 API·저장은 유지한다. 새 외부 API·권한·원문 노출은 없다.

같은 xid에서 원 context fullref·manifest·확정 임무·한도와 실제 MATCHED_METADATA를 확인한다. 기존 T01의 문서 양성 및 원자료 변경 음성은 동일 합성 App에서 확인한다. 지식·사용자 지시·승인 소비는 실제 증거가 없는 경우 미검증으로 남기고, context 누락 슬롯 해소·START 원문 공급·승인 저장을 대체하지 않는다. T01의 추가 변경은 별도 분해한다. 최종 412/도메인 쓰기0, 실제 DB·키·권한·서비스·Agent 제외.

### 요청 저장·계상 결정 후보 — 미채택·미실행

채택된 상세 계약 §5는 새 요청의 원장과 최초 실제 저장량, 기존 10GiB와 coverage, S/Q 재계상 금지를 정했다. 이번에 별도 고정할 범위는 PENDING/v1 한 건의 전용 계상 목적, part와 전용 RPC 호출 경계다. 이 결정에는 기존 보호 GET의 같은 사용자·client·권한 아래 원 요청 ref 확인까지 포함한다. 응답 유실로 요청 ID가 없을 때의 새 조회 계약, 결정·소비·START는 별도다.

- 목적 ORIGIN_REUSE_APPROVAL_REQUEST, part origin_reuse_request 한 종류를 제안한다. operation은 기존 requestApproval이다. 예약 ID는 서버 명령 ID, part.id/contentHash는 PENDING/v1 요청의 ref다. 기존 plan의 part와 hash·coverage 형식을 쓴다. 요청 증거를 별도 행이나 용량으로 중복 계상하지 않는다.
- 기존 cost projection과 고정점 방식으로 요청, 원 명령·영수증·APPLIED 감사, 최초 인앱 알림, 예약 자기비용을 실제로 한 번씩 센다. 기존 U/H/O와 10GiB를 유지한다. 준비 후보, S/Q, 읽음·결정·소비를 포함하지 않는다. 최초 예약은 기존 고정 폭 상계, 정산은 실제 저장 행을 재조회하며 s≤r, used += s, held -= r를 기존 CAS로 확인한다.
- 전용 fn09_origin_reuse_request_reserve(s uuid,a uuid,c uuid,p uuid,q jsonb,ref jsonb,record jsonb,policy jsonb,ids jsonb,expected_tx text,observed_until timestamptz)를 제안한다. 결과는 reservation_id uuid, transaction_id text, record_hash text, plan_hash text, reserved_bytes text, authorized_until text다. ids는 원 서버 명령·작업·영수증·감사 네 ID만 포함한다. observed_until은 기존 Session·OWNER·제어·P2·요청 유효기한을 줄이는 상계다.
- 전용 fn09_origin_reuse_request_settle(s uuid,a uuid,c uuid,p uuid,external_id uuid,rid uuid,sealed_hash text,cid uuid,result jsonb,expected_tx text)를 제안한다. 결과는 status text, reservation_id uuid, transaction_id text, settled_bytes text다. 정확 원 transaction·예약·봉인·원장·알림과 IO_STARTED/fence 1을 대조한다.
- 미적용 0082에서 두 전용 함수의 migrator 소유·고정 search_path, PUBLIC 차단, anvil_v3_app의 정확 두 EXECUTE만 제안한다. 일반 RPC/표 권한·기존 준비/다른 승인·SQL 적용은 유지한다. 원 요청 목적의 정확 SQL 검사·원장·알림·정산 양방향 검산이 선행이다. 입력 JSON·GUC·축소 시각만으로 권위를 인정하지 않는다. 원 App의 실제 Context·자료·세 규칙 검산과 SQL의 원장·주체·P2·거래 검산을 함께 요구한다.
- 소스는 P02/P03/P16/P18/P19, 검수는 T03/T05/T06이다. 실제 합성 App POST→PENDING COMMIT→원 ID 보호 GET, 같은 후보 중복, 교차 transaction·목적, 원 알림 누락, 상한 초과·정산 실패의 원자 롤백을 검사한다. COMMIT 응답 불명은 재예약/재발행하지 않는다. 롤백은 위 목적의 소스 추가만 역치환한다.

이 후보는 소스·합성 시험·미적용 SQL의 범위다. 실제 DB·ACL·키·서비스·Agent·J3 실행과 승인 결정/소비·START를 허용하지 않는다. 정확 후보 채택 후 독립 검토 및 플랫폼 심사와 별개로 실제 SQL 적용/권한은 열지 않는다.
