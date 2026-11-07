# FN07 Claude process profile 데이터 selector 소스 작업지시서

- 상태: MAIN_INTERNAL_REVIEW / SOURCE_GO0.
- 기준 HEAD: 35247729220498718a80d2a14a232909024ba2cb, codex/av3-stage-b.
- 목적: 실제 driver가 소비할 원 선언 profile을 기존 보호 reader로 명시 선택·검산한다.
- 범위: 신규 소스/시험2·메모리 합성 검증. 실제 실행 구성·권위·SDK/DB/서비스 실행은 제외한다.

## 1. 기존 계획과 미구현 동작

FN07 실제 driver는 원 command profile을 알아야 하지만 현재 환경에는 commandProfileRefs 목록만 있고 Claude용 단일 선택은 없다. label/purpose로 역할을 추측하거나 모든 profile을 SDK Options로 전달하지 않는다. 기존 보호 원문을 명시 profileRef로 선택하고 definition/environment/host/root/secret 관계를 닫는 데이터 소비가 이번 실제 미구현 동작이다.

기존 Primary는 직접 SOURCE_ROOT_DECLARATION과 보호 snapshot 모두 ProjectEnvironments.references(...,fresh=true,...)로 해소할 수 있음을 확인했다. 기존 public 보호 helper를 사용하며 private 메서드를 공개하거나 원 검사를 다시 구현하지 않는다. 기존 guard가 거절하는 원문은 불가로 남긴다.

이번 결과는 CLAUDE_PROCESS_PROFILE_DATA_CANDIDATE이며 검증된 OS 실행파일/cwd·argv/env·비밀값·도구 허가가 아니다. 실제 생성 역할·허용 program/인자 문법·secretSlots의 argv/env 해석은 후보 계약의 미정으로 유지한다. 새 공개 API/저장/권한을 추가하지 않는다.

## 2. 단일 writer·정확 경로

기존 Primary만 다음 신규2를 작성한다.

1. apps/server/modules/connections/claude-process-profile-selector.ts
2. tests/unit/FN07/claude-process-profile-selector.test.ts

기존 definitions/environments/resources/source roots/snapshot·auth/policy·server app/route·SQL·connector·SDK·패키지를 수정하지 않는다. Main은 같은 제품을 수정하지 않고 WI/검수/통합을 맡는다. 관련 없는 보호3과 Main 문서를 보존한다. 새 branch·worktree·세션·자동화는 만들지 않는다.

## 3. 실제 보호 reader와 고정 선택

selector는 실제 ProjectConnectionDefinitions, ProjectEnvironments와 그 environments.resources인 실제 ProjectEnvironmentResources를 사용한다. 하나의 주입된 기존 access로 실제 reader들을 내부 구성해 같은 access를 보장하며 private access 필드를 새로 공개하지 않는다. 원 prototype/함수·같은 db/actor/project를 검산하고 own override/가짜 class/getter/Proxy·await 중 포트 교체를 거절한다. 각 read에서 기본 authorize=true를 유지하며 read의 권한 검사를 생략하지 않는다.

입력은 원 authenticated actor/db, projectId와 정확 fullref3 {connectionRef,environmentRef,profileRef}, call의 signal/기한뿐이다. profile을 자동 선택하거나 선택을 저장하지 않는다. raw 선택은 검산·복사·고정하며 actor/client의 동일성은 실제 AuthenticatedIdentity 원형에 맞춰 원 필드를 고정/대조한다. 다른 actor/db로 후속 read를 바꾸지 않는다.

실제 definitions.read로 원 connection을 읽어 ref/hash·현재 head·definition.environmentRef를 대조한다. adapterKind는 CLAUDE_AGENT_SDK이고 toolProduct는 Claude Code여야 한다. 설정의 모델 별칭·auto를 임의 blacklist하지 않는다. 이 확인은 설치/버전 지원 증명이 아니다.

실제 environments.read로 environment fullref/hash·역사 적합·현재 configurationCurrentness MATCHED를 요구한다. OBSERVATION_UNVERIFIED 등 원 미검증 정보와 executionEligible:false/dispatchPerformed:false를 보존한다. MATCHED를 OS 현재 관측·실제 사용 권한으로 표시하지 않는다.

profileRef는 environment.snapshot.commandProfileRefs에 정확히 한 번 포함돼야 한다. 실제 resources.read의 COMMAND_PROFILE_METADATA 원 snapshot/ref/head/status DECLARED/current MATCHED를 검산한다. 원 snapshot의 history/hash 검사는 원 reader가 수행해야 하며 selector가 가짜 성공 DTO만 받지 않는다.

## 4. host/root/secret 관계와 전체 원문

COMMAND_PROFILE_METADATA definition은 정확9키다:
label, purpose, hostRef, toolRequirements, program, argsTemplate, workingDirectory, secretSlots, policyRef.

toolRequirements는 최대20개의 {product,versionRequirement} 배열, argsTemplate은 LITERAL value 또는 SECRET_SLOT name, workingDirectory는 sourceRootRef/relativeDirectory, secretSlots는 name/secretRef다. env 맵·실행파일 hash·Claude 역할 literal은 없는 상태로 유지한다.

ProjectEnvironments.references(db,같은actor,projectId,원environment.snapshot,true,전용메모리 evidence배열)의 실제 구현을 소비해 원 host/root/secret 및 profile 관계를 검산한다. 이 helper는 등록/원 snapshot/정책을 읽고 메모리 evidence를 수집하지만 이번 단위는 이를 새 테이블/권한/Secret 저장으로 바꾸지 않는다.

직접 선언과 snapshot 등록 경로를 모두 지원한다. 원 roots.read·SourceReadRecords.readSnapshot/grant와 host/등록·identityRef 관계를 원 helper로 검사하며 snapshot 사실을 OS 현재 증거로 승격하지 않는다. private helper를 복제·공개하거나 지원 가능한 snapshot을 편의상 거절하지 않는다.

선택 profile의 host는 원 환경이 허용한 host 집합에 있고 논리 cwd root는 같은 host의 원 root로 해소돼야 한다. secretSlots는 원 환경 secretRefs 목록/현재 원문과 같은 host에 결박돼야 한다. 슬롯의 name/reference/template 관계는 원 metadata parser/reader의 문법을 유지한다. 비밀값을 읽거나 resolve하지 않는다.

toolRequirements에는 connection.toolProduct인 Claude Code와 product가 정확히 같은 항목이 하나 이상 있어야 한다. 모든 항목의 일치를 요구하거나 나머지 도구를 제거하지 않는다. 각 versionRequirement와 전체 요구 배열을 원문 그대로 보존하며 connection의 선언 버전으로 지원/범위 충족을 추정하거나 임의 semver 확대/재해석을 하지 않는다. 기존 자료가 제공하지 않는 정확 실행 역할·지원 판정을 만들어 내지 않는다.

## 5. 전후 current·기한·반환

원 read/refs helper를 실제로 호출한 뒤 같은 definition/environment/profile을 다시 읽어 ref·definition/snapshot·현재 head/status/policy/관계의 불변 부분을 대조한다. 현재성 관측 시각만 달라진 것을 내용 충돌로 오인하지 않되 변경/폐기/권한·host/root/secret 전환은 반환 전에 거절한다. 진행 중 actor/client/db/포트가 바뀌면 실패한다.

각 await 전후 caller 취소·고정 기한을 검사한다. timeout은1~10000ms이며 caller/인스턴스의 더 짧은 기한을 늘리지 않는다. call signal/expiresAt은 진입에서 고정하고 가변 원 call을 다시 읽지 않는다. DB read가 늦게 정착해도 외부 결과를 소급 성공시키지 않으며 timer/listener를 회수한다. transaction 생성/COMMIT/ROLLBACK·후속 쓰기·자동 재시도는 하지 않는다. db 수명은 caller 소유다.

반환은 고정 refs/hash와 선택된 definition의 위9키, 원 environment 관련 논리 refs·미검증 issues만 포함하는 닫힌 데이터 후보로 만든다. raw 보호 snapshot report/관측에서 얻은 실제 절대경로·proof/비밀값·DB 오류를 일반 결과로 내보내지 않는다. 원 program/template/논리 cwd 선언 문자열은 변형하지 않으며 SDK 실행값으로 사용하지 않는다.

실행 flags는 actualExecutionVerified:false, executionAuthorized:false, executionEligible:false, dispatchPerformed:false, workAccepted:false, ownership:UNVERIFIED다. 선택된 profile을 실행/접속 확인/권한 발급·표준 실행 역할로 자동 채택하지 않는다. current configuration 사실과 실제 실행 현재성의 차이를 유지한다.

## 6. 직접 시험·중요 음성

신규 시험은 실제 정의/환경/metadata/root/snapshot/권한 reader를 하나의 메모리 SQL 모델로 소비한다. reader 성공 함수를 대체하거나 원 권한/정책·원 저장/감사·ref/hash 검산을 끄지 않는다. 가능한 기존 합성 fixture를 재사용하되 새 helper 파일을 쓰지 않는다.

정상은 명시 profile과 원9키·정확refs의 보존, 직접 root와 snapshot root 양쪽, identityRef 관계, 논리 정보만 반환과 false flags를 검산한다. 실제 사용 권위가 없다는 이유로 데이터 후보의 정상 원형을 fake 성공으로 만들지 않는다.

음성은 잘못된 profile/환경 목록/다른 project·actor/client/권한/승인필수·다른 connection/adapter/product·stale/폐기/head/policy/hash/감사오염·다른 host/root/등록/snapshot/grant/identityRef/secret 관계·원문과 현재 refs 불일치다. 값이 바뀌는 경우 각 await 후 실제 reader로 확인한다. snapshot에 의심 비밀이 있거나 rawAllowed가 거절되면 출력하지 않는다.

getter/Proxy/가짜객체·포트/함수 교체·signal 별칭·read HOLD/취소/만료/역행clock·late 결과·listener 회수·원문/DB오류 비반사를 포함한다. 원본 선언/자료와 관련 없는 protected 파일이 바뀌지 않음을 확인한다.

구조적 모듈 부재 RED와 실제 행동 RED/GREEN을 구분한다. 신규 selector와 직접 definitions/environments/resources/snapshot 인접 중 변경 영향의 필요한 파일만 선택해 실행하고 typecheck/diff를 검사한다. 이미 불변인 bootstrap110 전수·브라우저·SDK/운영 검사를 반복하지 않는다.

## 7. 제출·인수·미검증

기존 Primary는 신규2·시작/끝 HEAD/rawhash·정확 명령/exit/fail/skip·실제 RED/준비오류·live/pending/정리·미검증/rollback을 제출하고 writer를 반환한다. commit/push하지 않는다. Main의 독립 C/I0와 fresh 검증 후 정확 소유 파일만 로컬 checkpoint로 통합한다.

실제 DB 접속/SQL·권한/키·Secret값/인증서·서비스·SDK/CLI/Agent·파일/backup 조사·OS process·컴파일·J3/P03 R3·Oracle/운영은 실행하지 않는다. protected reader의 메모리 SQL 모델 검증만 허용한다. 새 route/DTO/SQL/schema·권한 의미가 필수이면 정확 차이를 쓰기 전에 반환한다.

이 데이터 후보를 실제 driver/process 구성 또는 전체 FN07/Stage/계획 완료로 표시하지 않는다. 다음 단계의 역할·argv/env·실제 process 소유·도구 결정·SID/claim·실제 사용자 검증은 남는다. rollback은 신규2와 단위 기록의 정상 revert이며 실제 환경 변경0이다.
