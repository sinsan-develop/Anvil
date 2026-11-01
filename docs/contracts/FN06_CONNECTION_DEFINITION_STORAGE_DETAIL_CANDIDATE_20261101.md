# FN06 완성형 ConnectionDefinition 저장 상세 후보

2026-11-01 / Main 어울 / 미채택·미구현 후보. 기존 승인된 완성형 정의의 목적을 재승인받는 문서가 아니다.

## 근거와 정확한 미정
INTERFACES §12.1의 ConnectionDefinition 13필드·registerConnection(definition)/update/CAS/해제, DATA_MODEL의 agent_connections/capability_reports/environment_versions는 기존 설계다. 현재 source는 :356 후보 분기만 구현돼 있고 connector.schema.json은 HOST_TRUST 전용이다. 기존 목적/13필드/실행과 설정의 분리는 유지한다. 미정은 다음과 같다.
1. account/environment/capability 자료를 아직 갖추지 않은 설정의 저장 허용 여부와 null 의미. 필수 보호참조를 검증한 완성형만 허용할지, 미확인 설정을 명시 저장할지 현재 상세 계약이 구분하지 않는다.
2. definition의 정확 입력/서버 소유 필드·상태 값, fullref hash projection, 고정 GET DTO/경로.
3. 신규 조회 정책·명령/승인/감사·현재 설정과 불변 과거 버전·FN14 target 읽기 조건.

기존 HUMAN 능력보고는 project-capability-reports.ts의 connection_candidates head/ref를 소비하고 capability-report-input.ts에서 CANDIDATE_ONLY로 고정된다. 완성형 정의에 정확 결박된 보고서는 아직 생산되지 않는다. 기존 후보 보고서를 full definition의 증빙으로 치환하지 않으며, 그 보고서를 필수로 요구하면 현재 producer로 최초 정의를 만들 수 없다. null은 이 미보고 상태를 보존하는 제안이다. 현재 코드에 정의↔보고서 hash 순환이 구현돼 있다고 단정하지 않는다.

## 권장 A: 실행과 분리한 미확인 설정의 명시 저장
등록된 실행 권위를 만들지 않는 ConnectionDefinition 저장 기능을 먼저 연결한다. 새 공개 kind는 추가하지 않는다. HOST_TRUST/candidate/connector ref는 definition ref의 대용품이 아니다. 후보를 자동 승격하지 않고 사용자가 별도 설정 내용을 작성·확인해 기존 registerConnection 명령을 실행한다.

- 기존 registerConnection의 후보 payload는 바이트·의미를 보존한다. 추가 분기는 exact `{definition,reason}`이며 후보 분기와 섞인 입력은 거절한다.
- definition 입력 exact10: label,toolProduct,toolVersion,adapterKind,connectorId,accountRef,modelOptions,environmentRef,policyRef,capabilityReportRef.
- label/toolProduct/toolVersion/adapterKind는 비어 있지 않은 Unicode 문자열·각 최대200자. adapter 문자열은 표시/저장용이며 임의 executable/path/명령으로 해석하지 않는다.
- connectorId는 UUID 또는 명시 null. accountRef/environmentRef/capabilityReportRef는 기존 VersionRef(id/version/contentHash) 또는 명시 null. policyRef는 현재 프로젝트의 정확 VersionRef로 필수다. 필드 생략과 null을 구분한다.
- modelOptions는 JSON object로 원값을 보존하며 모델 이름/auto 등을 임의 치환하지 않는다. 요청 전체의 기존2MiB 상한과 비밀 의심 검사·유효 Unicode/JSON 제한을 적용한다. 이 기능은 모델을 호출하거나 옵션을 실행에 사용하지 않는다.
- 비null 참조는 같은 프로젝트/현재 소유자·등록 연결과 정확 버전·보호 조회로 검산한 뒤에만 저장한다. provider가 없으면 SOURCE_VERIFIER_NOT_CONNECTED412이고 null로 자동 대체하지 않는다. null은 사용자가 미확인으로 선택한 설정 공백이며 성공 검증이 아니다.
- 서버는 id/version을 부여하고 status=NOT_READY로 고정한다. 저장된 exact13은 기존 필드 목록 그대로이며 caller가 id/version/status·실행 허가를 주입하지 못한다. null 유무와 관계없이 설정 저장만으로 READY/VERIFIED/실제 연동을 반환하지 않는다.

## 저장·hash·보호 GET 상세안
- 프로젝트 명령의 현재 로그인·OWNER/단독 제어·현재 세대·registerConnection 명시 정책·정확 policyRef·기한·중복 명령·기존 AUTO/REQUIRE 원명령/payloadHash 결박·일회 소비/감사를 재사용한다. 기존 정책/계약이 요구하는 최근 재인증은 유지한다. 정책 자동 부여/새 승인 유형은 없다.
- 기존 agent_connections의 현재 head와 프로젝트/id/version 별 불변 definition 버전을 같은 transaction에 저장한다. 기존 적용 SQL 수정 없이 필요한 forward SQL만 별도 pending으로 준비한다. 기존 자료를 변환·삭제하거나 실제 DB에 적용하지 않는다.
- 제안 유한 저장 상한은 프로젝트별 정의 head 1,000개·불변 version row 10,000개·모든 보관 버전의 exact13 canonical UTF8 합계64MiB다. 세 값은 새 상세 정책 후보이며 기존10GiB 프로젝트 정책/저장량 원장에 이미 포함됐다고 주장하지 않는다. 더 엄격한 기존 프로젝트 저장 정책도 함께 적용하되 미연결 전역 원장을 우회해 PASS로 표시하지 않는다.
- 동일 프로젝트 lock/transaction에서 중복 원명령을 먼저 판정하고 새 영속 row의 수·정확 bytes만 예약/산입한다. replay 추가 산입0, COMMIT 불명은0으로 돌리지 않으며 실제 보관된 과거/해제/archived 버전도 계속 산입한다. 자동 삭제/회수/상한 리셋은 없다. 상한 초과는 CONNECTION_STORAGE_LIMIT_REACHED429로 원 명령/정의/감사 쓰기를 같은 transaction에서 rollback하고 기존 저장을 보존한다. current head/버전의 실제행과 canonical 원형을 검산하지 못하면 오류로 닫는다.
- bytes는 physical disk 추정치가 아닌 명시 canonical 논리량이다. 서버가 고정한 canonical 원문과 JSON을 함께 검산하고 byte 합계가 조작 가능한 caller 숫자가 되지 않게 한다. 신규 자료를 기존 FN16 전체 백업 coverage에 자동 포함됐다고 표시하지 않는다.
- fullref는 `{id,version,contentHash:SHA256(canonicalJson(정확13필드 definition))}`다. 다른 현재 상태/조회시각·권한/실측을 hash에 섞지 않는다. 현재 head 갱신은 향후 updateConnection exact expectedVersion/CAS와 별도 작업이며 이번 등록/고정 조회로 자동 갱신하지 않는다.
- 제안 고정 GET `/api/v1/projects/:projectId/connections/:id/versions/:version`은 현재 로그인·현재 프로젝트 member·신규 명시 readConnectionDefinition 정책을 검사한다. 비밀값 없는 설정 정의 읽기를 OWNER 전용으로 제한하지 않으며 실제 보호참조 해석은 해당 provider의 현재 주체/프로젝트 보호를 별도 적용한다. 쓰기 제어권과 원작성 client는 읽기 전제조건이 아니다. 다른 프로젝트/미허가 원문은 기존404/403 경계를 따른다.
- exact 응답: `{projectId,ref,definition,observedAt,currentStatus:{headVersion,configurationCurrent,support:'UNVERIFIED',executionAuthorized:false}}`. configurationCurrent는 저장 head와 버전 일치일 뿐 OS·외부 계정·실제 도구 현재성이 아니다. 과거 불변 원문은 남기되 실제 실행 가능 판정에 쓰지 않는다.
- 이 등록/조회에는 목록·검색·수정·해제·보호 계정 생성·환경 생성·Agent/SDK 호출을 추가하지 않는다. 필요한 후속은 미구현으로 남긴다.

## FN14/UI 연결·필수 검수
UI11에서 설정 입력→기존 명령/일회 승인→영수증→고정 GET을 연결하고 NOT_READY/미확인 참조를 표시한다. FN14 target은 실제 agent_connections 불변 row/ref를 동일 transaction 보호 reader로 읽은 경우에만 내부 REGISTERED_CONNECTION port의 근거로 사용한다. 내부 tag는 공개 kind 추가나 실제 지원/실행 권위가 아니다. 현재 선택/버전의 변경은 새 입력으로 처리하고 후보/hosttrust hash를 그대로 주입하지 않는다. support UNVERIFIED·TARGET_CAPABILITIES_UNVERIFIED·실인계/재개 불가를 유지한다.

검수는 실제 React 입력→명시 저장→고정 조회·확정 임무 준비에 선택까지의 source 소비를 대상으로 한다. null/누락·다른 프로젝트/소유자·정책/제어·hash/버전·참조 provider 부재·REQUIRE 일회 승인/재사용·원명령 UNKNOWN·늦은401/세대변경·원형보존과 저장 후 조회 실패를 포함한다. 실제 DB/키/서비스/권한 적용/Agent 실행·현재 프로젝트 차단 해제는 제외한다. 합성 결과를 실사용 가능/전체FN06/FN14 완료로 표시하지 않는다.

## 대안과 채택 경계
B는 기존 필수 보호자료가 모두 검증된 정의만 저장한다. 이 경우 정확 보호 provider와 environment/account 등 실제 자료의 선행을 먼저 완성해야 하며, 그때까지 FN14 비null target412를 유지한다. 누락을 candidate/hosttrust로 채워 통과시키는 대안은 없다.

권장 A의 null/상태·입력/응답 DTO·hash·고정 GET/조회 정책/저장 상세를 기존 논리 설계의 기술 구체화로 채택할 수 있는지 검토한다. 실제 공개/데이터/권한 계약의 별도 결정이라면 이 정확 delta만 결박해 source-only(코드·화면·미적용SQL·합성검수) 채택을 받는다. 현재 문서 작성은 이들 채택/구현 GO가 아니며 제품 쓰기0이다. 독립 검토 후 Main이 정확 파일 allowlist/WI를 고정한다.