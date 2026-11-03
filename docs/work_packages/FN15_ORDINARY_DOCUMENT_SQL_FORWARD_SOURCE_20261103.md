# FN15 일반문서 기본 흐름 SQL 연결 — source 한정 실행 부록 r2

상태: 기존 WI r7 U4의 source 구현 상세. 전체 FN15 승인/완료 기준을 축소하지 않는다. 단일 기존 Primary에게만 위임하며 실제 DB·권한 적용·키·서비스·Agent는 제외한다.

## 기준과 정확 범위

- 부모 WI: FN15_CONTROL_ACCEPTANCE_SOURCE_IMPLEMENTATION_20261103.md r7 SHA15700DB2F63FFB6DE3F248B22142F76FBFF1B58AE30BC090EB08FAB610BDBE3F.
- 현재 baseline: 기존 codex/av3-stage-b, private/local 9e5cd75a8ba86e85af665998ebd4bf80b324f73e. Main 문서 변경은 별도 소유다.
- 기존 INTERFACES13.6/15.2의 실제 수락한 HE 단독제어 후 일반변경을 기존 정확 정책 아래 이어가는 범위다. OWNER 승격·등록/보호 source 권한·다른 domain 검토·새 approval operation을 추가하지 않는다.
- 제품/시험 정확5: apps/server/modules/access/project-command.ts; db/migrations/0073_control_handoff_acceptance.sql.pending; apps/server/modules/control-handoff/control-acceptance.ts(checksum만); tests/unit/FN15/control-source-integration.test.ts; tests/unit/FN15/control-acceptance-schema.test.ts.
- 옛 SQL/fixture·기존 app/role 정책·.gitattributes·다른 도메인·Primary 밖 문서는 수정하지 않는다. 범위 밖 경로가 필요하면 정확 이유/필수 delta를 Main에 반환한다.

## 확인한 누락과 이번 구현

1. 현재 service의 currentGeneralProjectController는 recordContentReview를 이름으로만 HE에 허용하지만 같은 op가 METHODOLOGY/WORK_PLAN/KNOWLEDGE에도 dispatch된다. HE 직접 명령은 payload.targetKind=DOCUMENT, 정확 targetRef와 envelope targetId/expectedVersion의 일치가 필수다. Owner 기존 branch/다른 domain OWNER guard는 보존한다.
2. document_command_authorized(pid,did,version,operation)의 최종 정의는 0003_document_confirmations.sql이다. 기존 조건을 보존한 forward 정의에서 실제 소비 연산 saveDocumentDraft/confirmDocument/proposeDocumentChange에만 실제 current grant로 검산된 HE를 연결한다. op 임의 문자열·다른 actor/client/gen·미회수 불명 grant·물리행 누락은 거절한다.
3. guard_project_document_review의 최종 정의는 0003_project_document_reviews.sql이다. DOCUMENT의 원 target/ref/hash·현재 head/양식 기준·검토자·명령/receipt/정책·기한/원문/검토 내용의 기존 조건을 그대로 보존한 forward에서 HE current grant만 연결한다. trigger를 definer로 바꿔 current_user guard를 우회하지 않는다.
4. private fn15_grant_current는 app 직접 공개 함수가 아니므로 최소 목적 helper/EXECUTE closure가 필요하다. 구현 전 Primary는 함수 소유권/고정 search_path/실제 인증·현재 project/control/HE/grant 범위/최소 호출권한·PUBLIC 거절과 Owner 불변을 Main에 먼저 제시한다. raw proof/범용 grant 조회·전역 role/table 권한·RLS 완화는 없다. 실제 권한/SQL 적용은 하지 않는다.
5. SQL 원본문·함수 ACL/조건의 기존 Owner 분기는 비교 가능하게 보존한다. 자동 migration 적용·계정/정책 생성·기존 데이터/coverage 승격·세대 위조는 없다. 최종 LF raw bytes/checksum·service 상수·단일 COMMIT·postflight를 다시 같은 지문으로 고정한다.

## 이번에 완성했다고 하지 않을 잔여

- importDocument 및 save의 import선택은 최종0072 import guard에 별도 Owner 제한이 있다. 일반 제안/확정 연결이 import선택까지 완료했다는 뜻이 아니다.
- source link/change는 원 connector 등록/actor/client/control-generation·보호관측 권위를 유지해야 한다. 일반 HE 제어 grant로 이 등록 권위를 대체하지 않는다.
- 승인 producer/consumableOperations의 기존 지원과 일반9의 교집합은 uploadArtifact/detachDocumentSource/linkDocumentSource/proposeDocumentSourceChange뿐이다. 나머지5의 새 승인 생산·소비를 이번에 발명하지 않는다. 정책 REQUIRE_APPROVAL인데 기채택 생산이 없으면 명시 fail-closed/미완료를 보존한다.
- detach와 기존 지원4의 승인 SQL helper chain은 별도 다음 단위다. 전체9op·전체FN15·계획완료로 보고하지 않는다.

## 검수·소유

- 직접 서비스 경로의 HE DOCUMENT 정상과 다른 domain/target mismatch·옛 actor/client/gen·회수/누락 grant 음성의 행동 RED/GREEN. Owner 기존 정상/관리 권한 차단 유지.
- source forward의 정확 최종 함수·원본문/조건 보존·호출 ACL/실제 guard 연결·역완결을 읽기 검수한다. 문자열 정적 PASS를 실PG 집행으로 표시하지 않는다.
- 신규/직접인접만 확인, 기존 불변 UI/45시험·전체회귀 반복0. 최종 type/구문/diff·raw/index/checksum을 필요한 범위에서 확인한다. 메모리 모델/합성 사용, actual PG/RLS·동시성은 NOT_RUN.
- Primary는 Main의 목적 helper 설계 검토 전 그 경계 구현을 시작하지 않는다. 자동 실행 심사 거절이면 우회/분할/반복하지 않고 정확 근거를 반환하며 영향 없는 승인 부분은 계속한다.
- Main은 문서·검수·Git, Primary는 정확5 제품/시험의 한 명 writer다. 오류 횟수/미확인/live와 다음 안전 행동을 반환한다.
## 고정 기술 상세·실행 순서 (r2 Main 검토)

목표: 이미 수락한 HE가 기존 정책 아래 일반문서 기본 흐름을 이어가도록 source의 실제 SQL 접점을 연결한다. 구조: 기존 authenticated Tx·원 command/receipt·private current grant를 소비하는 목적 helper를 추가하고 기존 invoker guard의 HE 분기만 연결한다. 기술: TypeScript/Node, 미적용 PostgreSQL forward, node:test 메모리/정적 검사. Main은 관리·검수/Git, 기존 Primary는 정확5경로의 단일 writer다. 사용자가 지정한 work_packages 위치와 기존 프로젝트 운영 절차를 사용한다.

고정 함수는 anvil.fn15_ordinary_document_command_current(pid uuid,cid uuid,op text) RETURNS boolean이다. 기존 migrator 소유·SECURITY DEFINER·VOLATILE·SET search_path=pg_catalog, PUBLIC EXECUTE 회수, app에는 이 목적 helper EXECUTE만 허용한다. 기존 trigger/current_user guard는 invoker로 보존하고 fn15_grant_current는 공개하지 않는다. 함수는 고정4 operation과 DOCUMENT 검토만 허용하며 다른 입력은 false다.

목적 GUC 명칭은 anvil.fn15_document_context, exact 객체는 {schemaVersion:1,purpose:'FN15_ORDINARY_DOCUMENT_WRITE',sessionId,credentialGeneration,request:원 ProjectCommand}이다. 원 canonical command 최대2097152B와 UUID36·안전정수16자리의 외피162B를 합한 최대2097314B를 TS/SQL 같은 canonical UTF8 분모로 검사한다. 새 공개 본문 상한을 늘리지 않는다. 본문·token·CSRF·context를 새 로그/오류/응답에 출력하지 않는다.

생산자는 실제 AccessRepository 인증 callback의 actor.authSession 원 값이다. same db·actor/client/session/credential·원 commandHash를 private context에 묶고 callback try/finally로 폐기한다. 외부 setter·verified flag·다른 command/Tx/session 재사용·callback 종료 후 사용은 없다. transaction-local context와 실제 APPLIED command/receipt/정책을 SQL에서 재검산하고 정확 fn01_active/원 credential·현재 project/control·HE·실 grant 완결을 모두 요구한다. Owner는 새 context 존재를 필수로 하지 않으며 기존 동작을 유지한다. 잘못된 JSON/cast는 비밀 없는 false이고 query_cancel/DB 장애/미정착을 정상 false로 숨기지 않는다.

검토 초점과 해당 검증:
- 다른 targetKind 또는 envelope/ref 불일치: HE 직접 검토를 material 호출 전에 거절; Owner 기존 다른 domain 동작은 그대로.
- 원 request 사후변조·다른 db/session/command: 목적 context를 재사용하지 못하고 새 문서 쓰기0.
- 만료·구 credential/control·누락/회수 grant: 동일 목적이어도 helper 허가0; 실제 PG 검증은 NOT_RUN.
- 최소 EXECUTE/고정 search_path·invoker guard: 기존 OWNER 조건과 원본문/양식/정책 조건 보존, PUBLIC/raw grant 노출0.
- import/source/새 승인 종류·indexDesignDocument: 이번 HE 분기를 적용하지 않으며 기존 실패·Owner 경로 보존.

- [ ] Primary가 현재9e5cd75a/allowlist5·시작hash·보호파일/다른writer0을 확인한다.
- [ ] control-source-integration.test.ts에 HE DOCUMENT 정상과 KNOWLEDGE/WORK_PLAN/METHODOLOGY·targetRef/envelope 불일치의 material 호출0 행동 RED를 만든다. Owner 기존 경로·same-context/no-reuse 음성도 검증한다.
- [ ] control-acceptance-schema.test.ts에서 정확 helper signature/ACL·같은 scope의 두 forward/원 조건 보존·기존 guard invoker/호출선·op 제한·정확 context 상한의 정적 RED를 만든다. 실행하지 않은 SQL 집행은 별도 표기한다.
- [ ] 정확5경로에서 위 고정 기술 상세를 최소 구현한다. 옛 SQL은 수정하지 않는다. 원 type/정책·결과 불명 보존을 유지한다.
- [ ] node --test tests/unit/FN15/control-source-integration.test.ts tests/unit/FN15/control-acceptance-schema.test.ts 로 신규/직접 소비를 확인한다. node node_modules/typescript/bin/tsc --noEmit -p tsconfig.base.json 및 scoped diff check를 수행한다. 변경 없는 전체 UI/45검사는 반복하지 않는다.
- [ ] 최종 SQL LF/raw checksum·service 상수·COMMIT/postflight·raw/index 관계와 정확 scope를 제출하고 live0로 writer를 반환한다. 오류/NOT_RUN·원 rollback/잔여를 구분한다. Main이 독립 검수/승인 branch checkpoint를 맡는다.

Main 읽기 spec 검토는 이 내부 상세 범위의 C/I 없음이다. 실제 SQL/ACL/잠금 실행 검증이나 전체 FN15/Stage 인수는 아니다. 새 의미/자동 실행 심사 거절이면 해당 경계만 반환하고 우회하지 않는다.