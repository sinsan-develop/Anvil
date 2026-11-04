# UI02 본인 공통 도구·환경 정의와 프로젝트 설정 사본 — 상세 계약 후보 r3

상태: A 방향 채택 / 상세 계약·구현 미승인. 신산님 call_43e528bb9a8d429fa827dfca0528317d는 본인 공통 정의 선택→새 프로젝트 설정 사본을 선택했다. 이 문서는 그 방향을 코드로 옮길 공개 입력·조회·저장 계약의 후보다. 실제 DB·권한·키·서비스·Agent 실행, J3 QA 승인이 아니다.

## 1. 목적·기존 경계

설계 §11.3/UI02 3단계의 선택을 실제 저장·재조회·생성 시 사본 보관까지 연결한다. 사용자 공통 방법론·양식과 같이 Anvil 로그인 사용자 소유이며 외부 Agent 계정 소유가 아니다. 현재 DraftWizardReview의 선택 미구현 표시를 실제 입력으로 대체한다. 기존 프로젝트 ConnectionDefinition·EnvironmentVersion·HUMAN 등록·책임 session을 개인 소유 목록으로 전용하지 않는다.

재사용 근거: common-command의 USER_COMMON 범위·현재 client·원명령 hash·중복, 공통 방법론/양식의 owner·불변 version/CAS, 프로젝트 생성의 잠근 초안→생성/귀속/소비/receipt 단일 transaction. 새로 정하는 것은 도구·환경 공통 원형, 초안 선택, 사본/출처와 저장 한도다. 기존 방법론 검토·확정 기준을 이 설정에 자동 이식하지 않는다.

## 2. 사용자 흐름과 상세 화면

| 위치 | 입력·행동 | 저장·조회·오류 |
|---|---|---|
| UI02 3단계 | 총괄용 도구, 기본 코딩 도구, 환경의 세 선택칸. 각 항목에 본인 공통 정의 선택/정의 관리/고정 원문 보기/선택 해제 | 비어 있으면 준비 필요로 초안 저장 가능. 총괄용 도구 선택은 실제 책임 session 예약이 아님 |
| 정의 선택 창 | TOOL/ENVIRONMENT 탭, 이름 검색, 20개씩 명시적 다음 페이지, ACTIVE 목록·현재 version | 다른 사용자/프로젝트의 자료 표시0. 선택은 정확 ref를 buffer에 넣을 뿐 서버 쓰기/연결0 |
| 도구 정의 편집 창 | 이름·제품·버전·adapter 표시명·modelOptions·개정 이유 | 저장 버튼만 명시 USER_COMMON 명령. adapter/옵션을 실행하지 않으며 모델명/auto를 임의 치환하지 않음 |
| 환경 정의 편집 창 | 이름·실행 host 표시/플랫폼·대상 host·소스 경로 힌트·명령 profile 설정·작업 사용자 힌트·이유 | 경로/명령은 설정 원문. 파일 조사·폴더 접근·명령 실행0. 프로젝트의 등록 경로/허가로 표시하지 않음 |
| 저장/중간 이탈 | 기존 중간 저장·이전/다음·재진입 | 선택 ref를 초안 버전에 저장. 미저장 입력 경고와 늦은 응답의 다른 초안/사용자 덮어쓰기 차단 유지 |
| 시작 기준 확인 | 선택한 세 슬롯의 이름/원 version·고정 원문, 미연결 항목, 사본 생성 설명 | 최신 head로 몰래 교체0. 개정/회수/접근 상실이면 원선택을 보존하며 현재 사용불가 이유와 재선택 제공 |
| 프로젝트 생성 후 | 생성 영수증의 새 사본 ref·UNBOUND 표시, 프로젝트 설정으로 이동·정확 사본 조회 | 준비됨/연동완료/실행가능으로 표시0. 실제 연결·정책·책임 session 배정은 기존 FN06/FN09 경로에서 별도 |

기존 화면/12px·오류/키보드/focus 규칙을 사용한다. 설명은 정보 버튼으로 제공하고 상시 긴 경고 박스로 화면을 바꾸지 않는다. 원형 저장 실패는 편집 입력을 유지하고, 초안 저장/생성 실패와 구분한다. 생성 성공 뒤 GET 실패는 생성 미확정/중복 생성 유도로 바꾸지 않고 원 command/receipt를 유지한다.

## 3. 휴대 가능한 원형의 정확 형식

공통 원형 kind는 TOOL 또는 ENVIRONMENT다. 내용 작성부는 정확 {kind,definition,reason}이며 실제 저장 payload도 동일하다. 대상·expectedVersion은 기존 USER_COMMON 바깥 envelope에만 둔다. owner/id/version/상태/관측시각은 서버 소유다. kind는 최초 이후 변경 불가.

TOOL definition exact: {label,toolProduct,toolVersion,adapterKind,modelOptions}.
앞 네 값은 기존 ConnectionDefinition의 유효 Unicode·비어 있지 않음·각200자 검사를 재사용한다. modelOptions는 JSON object로 원값을 보존하고 기존 유효 JSON·전체2MiB 상한·알려진 비밀 key/value 탐지를 적용한다. connectorId/accountRef/environmentRef/policyRef/capabilityReportRef나 session handle은 허용하지 않는다.

ENVIRONMENT definition exact: {label,executionHost,targetHosts,sourceRoots,commandProfiles,executionUserHint}.
- label: 위200자. executionHost exact {label,platform,pathHint}; platform WINDOWS/LINUX/OTHER, pathHint는 null 또는 유효 Unicode 문자열 최대4096자.
- targetHosts: 같은 host 형식의 배열, 최대200. nested label 전부 TOOL label과 같은 유효 Unicode·비어 있지 않음/공백만 불가·최대200자 규칙이다. host.pathHint는 명시 null 또는 비어 있지 않고 공백만이 아닌 유효 Unicode 문자열 최대4096자다. sourceRoots: exact {label,pathHint,requestedAccess} 배열 최대200; sourceRoots.pathHint는 null 불가·비어 있지 않고 공백만이 아닌 유효 Unicode 문자열 최대4096자이며 label은 같은200자 규칙이다. requestedAccess READ/READ_WRITE는 요청 설정이며 허가가 아니다.
- commandProfiles: exact {label,purpose,commandText} 배열 최대200; label200자, purpose/commandText 각20000자. 문자열을 shell/CLI/SQL로 실행하거나 검증하기 위해 실제 도구를 호출하지 않는다.
- executionUserHint: null 또는200자 표시 문자열. OS 계정 선택·생성·권한 부여가 아니다.
중복 label은 targetHosts/sourceRoots/commandProfiles 각각의 배열 안에서 label.trim()의 대소문자 구분 코드포인트 완전일치로 검사한다. 원 문자열을 trim/정규화해 저장하지 않고 서로 다른 배열 사이 label 중복은 거절하지 않는다. 유효 Unicode/JSON·누락/추가 key·전체2MiB 상한을 검사한다. host/sourceRoot/command의 기존 프로젝트 ref·credential·Secret ref는 입력하지 않는다. 실제 경로/명령의 검증은 이후 프로젝트 등록에서 별도다.

reason은 유효 Unicode·비어 있지 않음·최대20000자다. 원문·reason·modelOptions·환경 문자열 전부 기존 알려진 비밀 탐지를 저장/command/감사 원문 보관 전에 적용한다. 탐지 시 412 COMMON_SETUP_SENSITIVE_CONTENT_SUSPECTED·본문 반사/평문 감사 저장0. 완전 탐지·실제 비밀 없음 보장은 하지 않는다.

서버 불변 원문 exact {id,version,kind,definition,reason,createdBy}; canonical UTF8 SHA256이 VersionRef.contentHash다. owner_user_id/현재 head 상태/조회시각은 별도 metadata다. ACTIVE는 설정 선택 허용 상태이며 확정/실지원·실행 허가가 아니다.

## 4. 본인 명령·조회와 회수

기존 /api/v1/user-common/commands의 envelope·scope_id=현재 actor·현재 client·requestHash·멱등/충돌·receipt/audit를 보존하고 operation 2개만 추가한다.
- saveCommonSetupDefinition: payload exact {kind,definition,reason}. 바깥 envelope의 targetId/expectedVersion이 유일한 대상/버전이다. 최초 targetId=null/expectedVersion=0; 개정은 targetId=본인 ACTIVE head id·expectedVersion=그 head version으로 CAS 후 새 version. payload의 definitionId/targetId/expectedVersion 추가는 exact 검사에서 거절해 쓰기0이다. 동일 command는 추가 쓰기/계상0, 다른 내용 재사용409.
- revokeCommonSetupDefinition: payload exact {targetRef,reason}. 바깥 targetId=targetRef.id·expectedVersion=targetRef.version을 먼저 대조하고 불일치 시 쓰기0이다. 그 뒤 본인 현재 ACTIVE head와 targetRef id/version/contentHash를 잠금 검산해 head를 REVOKED로 기록하고 원문·과거 version·회수 사건을 보존한다. 해제/복원·자동 재활성화·물리 삭제 없음.

USER_COMMON에 가짜 project/control/policy/일회 승인 소비를 넣지 않는다. 인증·세션·client 검사를 생략하지 않고 타인 target404, 본인 stale/ref 오염409, 만료401을 기존 경계로 처리한다. 정의 저장/회수로 기존 project 권한·실행 상태는 바뀌지 않는다.

신규 GET /api/v1/user-common/setup-definitions?kind=TOOL|ENVIRONMENT&name=...&cursor=...
신규 GET /api/v1/user-common/setup-definitions/:id/versions/:version
목록은 본인 범위·ACTIVE 기본·name 최대200자·20개 고정, 명시 cursor 이동만 한다. 지속 membership snapshot을 만들지 않고 현재 가시 head 목록의 id 오름차순 keyset으로 lastId 뒤를 읽는다. name 필터는 기존 escape된 부분문자열 규칙을 사용한다. cursor는 신규 kind COMMON_SETUP_LIST·현재 actor/client·kind/name/status/limit 필터 hash·lastId·발급 후30분 기한을 기존 서명 포트로 결박한다. 30분은 기존 방법론 목록과 같은 후보 기준이다. 개정/회수/나중 저장은 페이지 사이 현재 가시 목록을 바꿀 수 있으므로 페이지별 observedAt을 반환하고 처음부터 새로고침할 수 있게 한다. 과거 목록을 고정한 것으로 보고하지 않는다. 검증기 미연결을 무서명 fallback으로 우회하지 않는다.
고정 GET은 본인 불변 원문/ref·observedAt·headVersion/ACTIVE|REVOKED·configurationCurrent·support:UNVERIFIED/executionAuthorized:false를 반환한다. 옛 원문·회수 원문은 읽을 수 있으나 선택 가능 여부와 분리한다. 원작성 client가 달라도 현재 본인 인증/client 검산을 거친 읽기는 가능하다. 목록/상세에 다른 사용자 자료·합계/이름을 노출하지 않는다.

## 5. 초안 선택·생성의 원자성·호환

기존 DraftInput에 optional setupSelection exact {coordinatorToolRef,codingToolRef,environmentRef}를 추가한다. 각 값은 VersionRef 또는 명시 null. 기존 caller의 필드 생략은 세 슬롯 null인 의미로 유지하되 원 requestHash/과거 command 원문은 수정하지 않는다. 기존 저장 초안·생성 replay도 사본이 있었다고 소급 생성하지 않는다.

saveDraft 시 현재 actor의 선택 원형이 해당 TOOL/ENVIRONMENT kind이며 ACTIVE head/version/hash와 일치하는지 같은 transaction에서 검산한다. 선택 저장은 원형 수정·실제 연결/책임 session 지정·정책 부여가 아니다. 초안 GET은 저장 ref와 원 version의 표시/현재 사용 가능 여부를 구분한다. 원선택은 자동 최신화/제거하지 않는다.

프로젝트 생성은 기존 strict {schemaVersion,commandId,clientId,draftId,draftVersion} body를 유지한다. 저장된 초안만 잠가 읽고 선택 원형의 owner/kind/head/version/hash/ACTIVE를 다시 검사한다. 선택하지 않은 슬롯은 사본을 만들지 않고 준비 필요를 유지한다. 이미 저장 뒤 개정/회수되었다면409로 전체 생성 rollback·기존 초안 유지/명시 재선택이다.

각 선택 슬롯마다 새 ProjectSetupCopy를 생성한다. exact 원문 {id,projectId,slot,sourceRef,sourceOwnerUserId,definitionSnapshot,status:'UNBOUND'}·canonical hash와 새 ref를 기록한다. slot은 COORDINATOR_TOOL/CODING_TOOL/ENVIRONMENT. 기존 원형 id와 사본 id는 다르며 본문 사본은 그 고정 definition과 완전히 동일하다.
프로젝트/OWNER·초기 제어/방법론·자료·초안 소비·setup 사본/출처/비용/command·receipt/audit가 같은 transaction에서 성공해야 한다. quota·원형 검산·쓰기 실패는 전부 rollback한다. COMMIT 불명은 원 command 재확인 전 새 명령/추가 복사0이다.

사본은 ConnectionDefinition/EnvironmentVersion/등록 session이 아니다. connector/account/Secret/policy/capability·trust/OS 권한·실제 session/assignment를 복사하거나 null로 만든 유효 등록이라고 표시하지 않는다. 실제 연결로 전환하려면 새 프로젝트의 기존 정의/등록/정책·현재성/능력·책임 session 계약을 다시 거쳐야 한다. 이 후속이 미연결이면 UNBOUND로 남기며 기능 전체 완료로 숨기지 않는다.
원 공통 정의 개정/회수는 이미 생성한 사본을 변경·삭제하지 않는다. 사본 조회의 project 회원/명시 읽기정책은 현재 요청에서 검사하고, 그 권한으로 원 개인 목록까지 열지 않는다.

신규 GET /api/v1/projects/:projectId/setup-copies/:id/versions/1은 기존 현재 인증·project member·명시 readProjectSetupCopy 정책을 검사한다. 기존 OWNER 정책 작성 화면/검증 프로필과 서버 project-command의 허용 operation에 이 읽기 op를 source-only로 연결해, 사용자가 기존 정책 작성 절차로 화면에서 허용/거절을 명시할 생산 경로도 구현·검수한다. 화면의 허용(ALLOW 설명 표현)은 기존 AUTO wire disposition으로 저장하며 새 ALLOW enum을 추가하지 않는다. AUTO 읽기 허용은 Agent 자동 실행 승인이 아니다. 실제 정책 저장/권한 부여는 이번 실행 범위가 아니며 자동 생성하지 않는다. policy 미설정/명시 DENY는 기존 거절 경계다. REQUIRE_APPROVAL은 이 GET에서 지원하지 않고 본문을 반환하지 않으며, 새 승인 요청/소비를 자동 생성하지 않는다. 생성 직후 policy가 없으면 사본 ref·원 command/receipt를 보존하고 화면은 보호 조회 준비 필요로 표시한다. 반환은 {projectId,ref,copy,observedAt,readiness:'UNBOUND',executionAuthorized:false}. 생성 응답은 setupCopyRefs와 준비 필요를 추가하며 실제 연결 ref로 사용하지 않는다.

## 6. 유한 저장·pending SQL·회수

다음 수치는 새 상세 후보이며 아직 적용하지 않는다. 본인 catalog TOOL/ENVIRONMENT 합산 head1000·불변 원형 version10000·setup 선택이 포함된 draft version10000·새 관련 원문/이력 논리량 합계64MiB를 상한으로 제안한다. 자동 삭제/회수/초기화0이다. 과거·회수·소비된 초안도 보존된 비용은 계속 산입하며 COMMIT 불명/회수만으로 비용0으로 만들지 않는다.
동일 owner lock/Tx에서 실제 신규 원형·선택·새 관련 command/receipt/audit의 canonical UTF8 bytes를 검산하고, replay는 추가 산입0이다. 기존 user-common 자료 전체에 소급 quota를 부과하지 않는다. 이 기능의 추가분만 정확 계상하고 타 기능 비용/전역 용량을 커버했다고 주장하지 않는다.

프로젝트 사본은 기존 프로젝트 저장량의 used/held·지속 reservation·원물리행/receipt 역완결에 새 typed kind로 연결한다. 생성 직전 잠금에서 세 사본의 실제 canonical bytes와 새 출처 metadata를 계상하며 기존 artifact 생성 예약에 자동 포함됐다고 가정하지 않는다. quota provider/역완결 미연결이면 사본 포함 생성을 fail-closed로 거절한다. 기선택이 없는 기존 생성 경로의 의미를 바꾸지 않는다.

현재 최고 migration0074. 후보0075_user_common_setup_definitions.sql.pending에서 새 catalog heads/불변 versions·초안선택 이력/개인 계상·project 사본/출처·회수 감사와 필요한 보호 함수를 정의한다. 정확 표·column·producer/guard는 구현 WI에 고정하며 기존 적용 SQL을 수정하지 않는다. 본인 owner·현재 actor/client·project 원본/command/receipt의 물리 관계를 보호한다. 실제 적용/권한 부여·기존 자료 변환은 이번 범위 밖이다.
새 자료가 기존 백업/반출 coverage에 자동 포함됐다고 주장하지 않는다. FN16 연계 미완료는 별도 추적하며 원문 이력은 삭제하지 않는다.

## 7. 구현·검수 패키지와 제외

상세 계약 채택 후 단일 기존 Primary가 공통 portable schema/owner command·reader/DB producer·초안 저장/생성·quota·UI02 작성/선택/사본 조회를 한 업무로 구현한다. 파일 allowlist/역할·검사 명령은 작업지시서로 고정하고 Main은 독립 검수·통합한다. 같은 파일 두 writer0.
검수: 타인/다른client/만료·ID/ref/hash 오염·추가키/비밀·old caller/replay·CAS/개정/회수·초안 재진입·저장 뒤 원형 변경·생성 rollback·프로젝트 사본 불변·개인/프로젝트 quota/중복0/UNKNOWN·화면 입력 유지/늦은응답/키보드/focus·생성 후 보호 재조회·실권위 복사0.
합성 DB/파일/DOM·빌드/타입은 실시 범위만 증명한다. 실제 DB 적용·사용자 정책/권한 부여·키·파일/설치/실자료 조사·서비스·Agent/외부 비용·실연결·J3 QA·P03 R3·기존 프로젝트 차단 해제는 제외한다. 이번 설계 방향 답변을 이러한 실행 승인으로 확대하지 않는다.
기존 실제 기능은 유지하고 전수 재검사 대신 신규/직접 영향 핵심을 선택한다. 전체 UI02/FN06·전체 계획 완료는 실제 실행/후속 연결/사용자 인수 증거와 구별한다.

## 8. 채택 경계

A 방향은 직접 선택됐다. 원형/슬롯/명령·GET·불변 사본/개인 한도/프로젝트 비용 연결이라는 이번 상세 공개·데이터 계약은 독립 검토 후 정확한 후보 hash를 제시해 source-only 채택을 결정받는다. 그 전 제품 source/SQL/실환경을 쓰지 않는다. 원 J3 단1회 질문은 별도이며 본 계약 선택/채택으로 소진된 QA 승인을 재사용하지 않는다.

독립 검토 이력: r1 C0/I3/M1의 outer/payload 대상·버전 중복, nested label/pathHint 제약, 읽기 정책 producer/미설정 화면, 목록 keyset·30분 의미를 r2에서 보완했다. 상세 계약은 여전히 미채택이며 제품 source/SQL·실환경 변경0이다.

최종 scoped 재검토 r2 C0/I0/M1의 ALLOW 표현은 기존 AUTO wire 값임을 r3에서 명시했다. 기존 caller가 setupSelection을 생략한 저장/생성은 원 requestHash/구 command/replay를 그대로 검산하며 이 기능의 새 quota/provider·copy row를 호출하지 않는다. UI도 사용자가 선택 기능을 쓰기 전에는 생략을 보존한다. 명시 setupSelection은 세 null/선택해제 상태를 포함해 해당 새 저장 이력으로 취급하되 사본은 비null 슬롯에만 생성한다. 원형/사본·정책 source-only 구현도 여전히 상세 채택 전 NOT_RUN이다.
