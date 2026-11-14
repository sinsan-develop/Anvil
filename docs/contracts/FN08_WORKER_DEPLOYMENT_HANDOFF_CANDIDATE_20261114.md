# FN08 worker 배포 원천·설치 기록·회수 전달 A안 후보

- 상태: 미채택. 코드·미적용 SQL·합성 검증의 후속 기준 후보이며 실제 효과를 승인하지 않는다.
- 부모: FN08_NATIVE_WORKER_PROVENANCE_PRODUCER_CANDIDATE_20261114.md SHA256 A769DEC827F78A486CD7C6EC9EBD9D84308572AFD29481F10DDA73F647331250.
- 기존 A769 발급 권위·descriptor·run/observer 식별값과 목적은 바꾸지 않는다. PR111 source를 기반으로 현재 미연결인 전달 매체와 설치/회수 공급을 구체화한다.

## 1. 사용자에게 필요한 결정
보호 배포 주체의 worker 전용 기록과 공개 metadata 읽기, 별도 로컬 worker 설치기록을 추가할 것인가. 권장 A는 아래 전체 연결을 한 번에 채택한다. 기존 signer 권한·프로젝트 권한·키 root는 확대하지 않는다.

## 2. 원천과 단방향 흐름
부모를 참조하지 않는 고정 worker compile bytes를 먼저 생산 → 그 bytes를 고정 package에 포함 → parent package/factory 확정 → 같은 worker bytes의 원 compile 결과·검수 → 불변 descriptor/package/build 묶음 → 보호 배포 head → 고정 package에 포함된 worker bytes와 보호 설치기록 → 서버/runtime 및 native가 같은 descriptor/current를 사용한다.

현재 SOURCE_ONLY_MODEL·compilerExecuted:false token은 실제 배포 게시 자격이 아니다. source 구현은 원 compiler 결과/검수 reader와 publisher를 연결하되 실제 producer가 없으면 기본 거절한다. 일반 JSON·actual:true·hash만으로 승격하지 않는다. source 합성 issuer는 시험에만 연결하며 실제 설치 또는 publisher 지원 완료라고 표시하지 않는다. 부모 package/hash에 후행 worker descriptor/head를 재내장하지 않아 hash 순환을 만들지 않는다. worker는 다운로드하지 않고 검산된 package의 고정 bytes만 사용한다. 후행 descriptor/설치기록을 같은 부모 ASAR에 다시 넣지 않으며 설치는 원 package를 수정하지 않는다. 원 package의 worker payload 위치는 resources/native-workers/OwnershipEvidenceWorker.exe로 고정한다.

## 3. 배포 저장·권한
새 worker 전용 저장은 불변 bundle과 append-only head 이력 두 영역이다. bundle exact `{descriptor,packageRecord,buildReceipt}`는 현재 A769 원형을 유지한다. compile/source/tool/cwd 원문은 별도 보호 build 근거이며 일반 응답에 포함하지 않는다.

head exact `{ref,snapshot}`의 snapshot은 `{schemaVersion:1,purpose:'NATIVE_WORKER_DEPLOYMENT_HEAD',nativeFactoryRef,descriptorRef,sequence,previousHeadRef,state,updatedAt,expiresAt}`다. ref.id는 factory fullref별 최초 게시 거래에서 일회 고정한 고유 headId(UUID), version=sequence, contentHash=canonical snapshot SHA256이다. 같은 발행 요청 재조회는 원 headId만 반환하고 다른 factory fullref와 headId를 공유하지 않는다. 최초 ACTIVE sequence1/previousHeadRef:null, 이후 REVOKED sequence2만 허용한다. REVOKED→ACTIVE·기한연장·같은 factory의 다른 descriptor는 금지한다. 새 worker는 새 factory ref/version이다.

보호 배포 전용 NOLOGIN/NOINHERIT/NOBYPASSRLS 역할·목적 함수만 발행/CAS/회수할 수 있다. 일반 app/프로젝트 HUMAN/Agent/PUBLIC에 쓰기 권한을 부여하지 않는다. 새 공개 쓰기 endpoint는 없다. 서버는 목적별 보호 읽기 함수로 원 bundle/head를 같은 거래에서 읽는다. SQL은 미적용 상태로 작성한다.

권한표: worker_owner는 두 저장 영역과 목적 함수를 소유하는 NOLOGIN/NOINHERIT/NOBYPASSRLS 역할이며 runtime membership으로 부여하지 않는다. worker_publisher는 보호 배포 서비스만 명시 SET ROLE할 수 있는 NOLOGIN/NOINHERIT/NOBYPASSRLS 호출 역할이다. 실제 서비스 계정 생성/역할 부여는 이번 제외이며 미설정시 publisher 미등록이다. app은 원 bundle/current 읽기 함수 EXECUTE만 받는다. publisher는 발행/회수/같은 요청 결과 조회 함수 EXECUTE만 받는다. 모든 표 직접 권한과 PUBLIC 함수 EXECUTE를 회수한다. 함수는 SECURITY DEFINER, owner=worker_owner, 고정 search_path와 모든 식별자 schema-qualified를 사용한다. 두 표 FORCE RLS 아래 owner의 SELECT/INSERT만 명시 policy로 허용한다(불변/append-only; UPDATE/DELETE0). publisher/app에는 직접 표 policy가 없다. 설치 migrator만 schema/role/function을 정의하고 runtime에 그 설치 권한을 이월하지 않는다. 함수는 정확 fullref·CAS·원 증거·한도·중복 요청을 자체 검사한다. 읽기 함수는 게시/회수할 수 없다.

최대 factory1000개·metadata64MiB, bundle64KiB이다. 새 발행은 회수 행 1개분을 미리 예약해 포화로 회수가 막히지 않게 한다. 기존 row 수정·자동 삭제·포화 시 우회 없음. 게시 결과 불명은 같은 정확 요청/원기록 조회로만 확인하고 새 발행 자동재시도0이다.

## 4. 공개 읽기와 최신성
GET `/api/v1/native-worker-deployments/:factoryId/:factoryVersion/:factoryHash?nonce=<32-byte canonical base64url>` 한 경로만 추가한다. 정확 factory fullref와 nonce만 받고 body·추가 query·Cookie/Bearer/등록코드·프로젝트/사용자 입력은 거절한다.

응답 exact `{schemaVersion:1,purpose:'NATIVE_WORKER_DEPLOYMENT_READ',nonce,bundle,head,observedAt}`. bundle은 §3의 현재 exact3원형만 명시 projection한다. 응답 최대64KiB. 공개 범위는 factory/worker/parent EXE·ASAR·header/source/compile-input hash·논리rootId·package/build refs와 현재 exact snapshot·상태·시각이다. source/compile-input은 hash만 공개하고 원문은 공개하지 않는다. 절대경로·compile 원문·사용자/등록/실행별 정보·키는 반환하지 않는다. 현재 packageRecord/buildReceipt snapshot에는 ref/hash/time만 있으며 그 exact snapshot을 공개하기로 하는 결정이다. 전체 build product의 compile 필드는 절대 반환하지 않는다. 고정 TLS 응답으로 후행 bundle을 설치기에 전달해 별도 미정 매체나 부모 ASAR 재내장을 요구하지 않는다. 응답 JSON은 build 원객체나 설치 증거로 승격하지 않는다.

기존 설치에서 고정된 catalogue origin과 SYSTEM_CHAIN_AND_HOSTNAME, TLS1.2 이상/rejectUnauthorized를 사용한다. 신규 CA/SPKI pin·임의URL·응답으로 최초 trust 생성·redirect/fallback0. 기존 signer의 exact role/endpoint는 변경하지 않는다. 새 경로는 같은 설치 origin 아래 별도 worker 목적이다.

모든 신규 사용은 온라인 조회하고 nonce echo·no-store·압축/redirect/중복헤더 거절을 검산한다. 요청 시작 monotonic 기준 최대1초 이내만 관측을 사용할 수 있다. 최종 기한=min(요청시작+1초, descriptor/head/authority/receipt/등록/기존budget). 각 기존 current 검사와 첫 생성 primitive 전에 검사하고 기한을 자동 연장하지 않는다. wall/monotonic 후퇴·늦은 응답·원reader 교체·회수·불명은 거절한다. offline cache로 새 사용0. 1초는 관측 허용 나이이며 이미 시작한 OS 작업의 즉시 종료 보장이 아니다.

오류는 형상400·부재404·회수/만료412·공급자/거래불명503으로 구분하고 원문 상세는 노출하지 않는다. 자동재시도0.

## 5. worker 전용 설치기록
Trust 키 root와 분리된 새 고정 sibling 위치 `<FOLDERID_LocalAppData>/Anvil/NativeWorkers/v1`을 제안한다. 현재 사용자 KnownFolder·SID에서만 도출하고 renderer·환경변수·임의 경로를 받지 않는다. 기존 Trust root는 읽기/쓰기 대상으로 사용하지 않는다.

새 root는 current SID/SYSTEM 전용 상속차단 DACL·소유SID·전체 부모 nonlink/reparse·retained volume/file identity를 검산한다. 기존 일반폴더 자동채택/수리0. exact worker 위치는 `packages/<descriptor.contentHash>/OwnershipEvidenceWorker.exe`다. descriptor rootId는 이 설치 root identity와 기록에서 결박되며 절대경로가 아니다.

설치 기록은 `installations.v1`과 목적별 lock/next/previous의 닫힌 목록으로 한정한다. DPAPI CurrentUser의 별도 worker 목적 entropy로 원 bundle/fullrefs·rootId·workerHash·설치 파일 identity·원 시각/기한·head/highwater를 보존한다. 키·credential 원문은 넣지 않는다. metadata8MiB/512revision, worker64개/합계1GiB/개별20MiB를 모두 적용한다. next/previous·부분복사·UNKNOWN 잔여·예약을 포함한 총 보유/예약 bytes로 계산하고 중복 예약은 한 번만 산입한다. lock 파일도 metadata 한도에 포함한다. 자동삭제0·포화시 새설치0. 원 bytes는 검산된 고정 packaged worker에서만 취득한다. 같은 factory/descriptor의 이미 검산 완료된 설치는 동일 원기록을 재조회할 수 있지만 덮어쓰기·누락기록 자동재발급은 금지한다. 제거 기능과 실제 제거는 이번 범위 밖이며 회수된 설치도 비활성 보존한다. 후속 제거는 원소유·참조0·정확대상 계획을 따로 정한다.

명시 설치는 원 package/부모/hash/current 검산→단발 기록 예약→create-new worker→동일handle hash/identity/링크 검산→보호 기록 sync/readback/CAS 순서다. 불명은 보존·사용거절·자동 재설치/원본채택0. 실제 Windows 내구성 지원이 입증되지 않으면 unsupported를 유지한다. journal 기존 제한은 해제하지 않는다.

native ProtectedDeployment는 원 설치기록·원 package/build·현재 worker/root handle 및 온라인 descriptor/head를 함께 검산하고 원 이미지 사용에 결박한다. 최초 설치는 고정 TLS의 원 bundle과 원 package 실bytes/부모hash·고정worker 검산·전용root 보호를 함께 요구한다. 설치기록 없는 실행을 공개GET만으로 bootstrap하지 않는다. 설치기록 손실/파일 부재는 새 설치 권위가 아니며 UNKNOWN으로 남긴다. 서버는 동일 보호 배포 저장을 원 reader로 소비한다. 새 파일이 존재한다는 사실이나 JSON hash만으로 설치 진위가 성립하지 않는다.

## 6. 구현·검수 범위
채택 후 기존 Primary 단일writer: worker deployment 계약/서버 보호 저장·공개 읽기·미적용 SQL, 고정 package/compile 원근거 연결, desktop 명시 설치 coordinator와 native 전용 store/ProtectedDeployment, 기존 host/서버 wiring 및 합성시험. 파일별 WI는 Main이 최소화한다. 다른 정상 흐름을 차단하지 않는다.

필수 합성: 위조/복제 issuer, factory/root/consume 교차, 재봉인hash, 공개정보 누출, head 후퇴/회수/기한, CAS/회수예약, TLSorigin/nonce/1초, 설치 중 교체/hardlink/reparse, 부분저장/재읽기불일치/UNKNOWN, 취소·늦은응답·reader교체, 미등록 default거절과 기존 signer 보존. 제품 reader/store/consumer를 연결한 RAM 여정으로 검수하고 C# 정적 검사를 실제 OS 성공으로 표시하지 않는다.

실제 DB 접속·migration/권한 적용·키·ACL·설치/자료조사·서비스·네트워크 호출·C# compile/load·프로세스/Agent 실행은 제외한다. 계약 채택은 실제 실행 승인이 아니다. 실제 release/설치 원천과 OS 검증이 남으면 전체 FN08/작업계획 미완료를 유지한다.
