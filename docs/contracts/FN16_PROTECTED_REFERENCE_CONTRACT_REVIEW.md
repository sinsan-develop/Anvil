# FN16 B안 보호참조·수동 백업 상세화 검토본 r1

2026-10-27 · Main 어울 · source checkpoint 44f97ad3128d7c79661d59bcbf598eac2f58c38f.

## 상태·선택 근거

PMO는 신산님의 결정·지원 한정 재개 지시를 확인하고 B(소유자 보호참조 설정 화면 포함)를 최초 상세화 경로로 선택했다. 이 문서는 새 wire/권한·키 보호 adapter의 채택을 위한 검토본이며 구현·실행 승인이 아니다. 기존 후보r2 SHA717496CD0E47ED1A267A689FAF82D9D2C9AF5A4D10FA83112B80A1660AEED5B0의 원문과 기존 P02 두 명령 payload는 보존한다. 실제 키/참조 공급·collector/job이 없는 현재 상태를 완료로 표시하지 않는다.

## 1. 기존 계약 유지와 정확 delta

기존 saveBackupPolicy({policy,reason})는 최초 targetId=null/expectedVersion=0, 개정 targetId=정책ID/expectedVersion=직전버전으로 구체화한다. 새 baseRef body 필드를 추가하지 않는다. policy는 P02 BackupPolicyVersion 그대로이고 최초 schedule=MANUAL만 허용한다. 저장이 생성/삭제/스케줄 활성화가 아니다.

기존 createBackup({policyRef,sourceSelection,reason})는 신규 job targetId=null/expectedVersion=0과 exact 정책ref를 소비한다. 명령 접수 receipt와 실제 검사완료 manifest를 분리한다.

다음 세 연산은 아직 등록되지 않은 **새 계약 채택 대상**이다.

| 연산 | strict payload 제안 | 효과/제외 |
|---|---|---|
| saveBackupReference | {kind,displayName,spec,reason} | 신규/같은ID 불변 개정. 기존외피 target/version CAS, kind 변경 거절 |
| revokeBackupReference | {referenceRef,reason} | exact버전 향후 사용 중지 사건. 키/파일 삭제0 |
| reconcileBackupJob | {jobRef,reason} | DB/기존 파일지문/원명령 재대조. 재수집·재암호화·재실행0 |

kind는 TARGET/ENCRYPTION_KEY/RETENTION/VERIFICATION으로 구분한다. TARGET spec={installationResourceRef}, ENCRYPTION_KEY spec={installationResourceRef}, RETENTION spec={automaticDeletion:false}, VERIFICATION spec={checks,limitsRef}를 제안한다. installationResourceRef/limitsRef는 서버가 공급한 고정 전체 ref만 받는다. 브라우저 host/path/adapter명/키 원문/임의 검사 실행 입력은 거절한다. 등록 자체가 실제 대상·키 공급자의 생성/보호 성공을 뜻하지 않는다. 공급자가 없으면 미구성/KEY_PROTECTION_UNVERIFIED로 공개하고 생성은 거절한다. B안의 키 생성/import까지 자동 포함하지 않는다.

## 2. 조회와 고정 버전

새 보호 조회 경로 제안은 프로젝트 prefix 아래 backup-resources(허용 설치 자원), backup-references 및 :id/versions/:version, backup-policies 및 :id/versions/:version, backup-jobs 및 :id/versions/:version, backup-jobs/:id/manifest다. 정확 route/schema 등록은 이 검토본 채택 뒤 WI에서 고정한다. 임의 파일/키 다운로드 경로는 없다.

목록은 표시명·kind·고정 ref·createdAt·불변등록상태와 현재 관측 eligibility/reasonCodes/observedAt을 분리한다. raw 경로·키 값·보호 저장소 내부 식별값은 일반 목록·로그·Agent맥락에 넣지 않는다. 목록/원문은 별도 명시 조회하며 최신 자동선택0, 과거ref는 현재권위로 복원하지 않는다. 조회는 현재 로그인/프로젝트OWNER/민감자료 접근 조건을 다시 검사하고 no-store다. 읽기는 정책 변경·키 해제·실행 승인이 아니다.

## 3. 권한·CAS·replay·회수

새 쓰기와 기존 두 명령은 현재 HUMAN login/client·OWNER·단독 controlGeneration·명시 PROJECT 정책·exact버전·기한·감사/영수증을 공통 gate로 검사한다. DENY 우선, 정책 부재 거절이다. REQUIRE_APPROVAL은 FN11 정확 candidate command/내용/버전/기한과 일회 소비가 실제 연결된 경우만 허용한다. 미연결 상태를 AUTO로 낮추지 않는다. 실제 사용자 정책 부여/GRANT0.

동일 command ID/본문은 기존 operation/job/receipt를 반환하고 다른 본문은 충돌한다. 현재 접근 회수 시 replay로 보호 원문을 우회하지 않는다. 회수는 새 사용 차단이며 기존 정책/job/사본·옛 복호화키는 보존한다. 진행 job의 최종 publish 직전에 별도 현재 DB 경계에서 회수를 다시 관측한다.

## 4. 키 보호·유실·이식: 채택 전 미정 경계

현재 제품에 실증된 서버 백업 키 공급자는 없다. Windows 실행기 DPAPI를 WSL 서버 키 보호로 재사용하거나 파일0700/0600 하나로 암호학적 키 보호를 증명하지 않는다. 다음을 하나의 adapter 계약으로 결정해야 한다.

1. 지원 플랫폼/키 준비 주체·원키 공급 경로와 서버 내 보호 방식, 앱/동일OS사용자/관리자 침해에 대한 한계.
2. 키와 백업의 별도 보존 위치·접근자·오프라인 복구 수단 및 실제 이식 시 소유확인/보호 재설정.
3. rotation 후 새 백업 선택과 과거 백업 복호화 가용성, 유실 시 복구 가능/불가 표시·자동폐기0.
4. AES-256-GCM 후보의 형식버전·nonce유일성·AAD/tag·인증완료 전 원문 미채택 및 키 해제 시간창/메모리 회수.

권장 결정 순서는 운영체제별 암묵 파일키를 먼저 만들기보다 **사용자 소유 서버 간 이식 가능한 키 복구 방식과 서버의 무인 사용 여부를 먼저 선택**하는 것이다. 사용자 입력 비밀로 해제하는 이식형과 설치 Secret 공급자에 위임하는 무인형은 사용자 행동/신뢰경계가 다르므로 같은 구현이라고 간주하지 않는다. 현재 둘 중 어느 쪽도 승인·구현하지 않았다. 실제 키 원문/Secret 생성·전송·설치·외부 서비스는 별도 실행 경계다.

## 5. 유한 한도·자료 collector

확정 수치는 TD-03의 프로젝트자료10GiB·본문2MiB·일반파일20MiB·스풀1GiB 등이며 백업 job의 파일수/전체실행시간/metadata총량/암호화출력/staging실패본 누적 한도와 동일하다고 자동 해석하지 않는다. 검토할 limitsRef에는 inputBytes/outputBytes/stagingBytes/metadataBytes/fileCount/deadlineMs/retainedFailureBytes를 각각 유한 정수로 고정해야 한다. 무제한 기본값/초과자료 조용한 생략은 금지하고 부족 시 접수거절 또는 상태보존 실패로 구분한다. 구체 수치 채택은 남은 결정이다.

collector는 제공된 방법론·헌법·8종문서/불변 원문·대화/지식·설계/계획/추적·판단/승인이력·결과/증거·상태/관계·실행/감사이력·비밀제외 연결설정참조·제공 알림설정/이력을 실제 소유 표/버전/blob로 매핑한다. 미제공/의도적제외/읽기실패를 구별하고 필수collector를 빈배열로 완료시키지 않는다. current credential/session/control/writer/승인 권한은 반출하지 않는다. 사건 이력만 보존한다. sourceSelection은 실제 등록/허가/관측 공급자가 확인된 경우만 수행하며 파일경로를 브라우저에서 실행하지 않는다.

## 6. job·파일/DB 실패창

접수→수집→검사→최종화→성공/실패/결과미확인으로 구분한다. 정확 enum·DB constraint는 채택 후 WI에 고정한다. 각 전이는 원command/정책ref/job version/fence에 결박하고 재시작 자동 replay0이다.

1. 접수 commit 전에는 파일 생성0, 중복접수 경쟁 차단.
2. 수집은 단일 RR 자료 기준+불변 artifact bytes/hash. 부분 실패는 job/staging 근거 보존.
3. 최종화는 수집 RR과 별개 현재 DB transaction에서 login/control/policy/key/target/quarantine 재검사·정확 소비/상태 CAS.
4. 파일 publish와 최종 DB commit은 비원자다. 최종파일 존재+DB rollback/COMMIT불명, DB참조+파일누락을 각각 UNKNOWN/실패로 남기고 성공 다운로드/목록 노출 gate를 닫는다.
5. 명시 reconcile는 원job·파일hash·DB이력 재대조만 수행한다. 새 job/암호화 재실행·자동 삭제0. nonce 재사용을 정상 retry로 취급하지 않는다.

## 7. 구현 묶음·정확파일 고정 조건

보호참조 공급자/키·한도 계약을 결정한 뒤 (1) 등록/고정조회/UI14, (2) 불변 정책/수동접수/미적용forwardSQL, (3) 실제 제공collector/manifest, (4) 암호화파일/job/실패조정, (5) 실제 여정/별도검증복원으로 순차 WI를 작성한다. 각 WI는 exact파일목록/선행/RED/직접영향/rollback을 고정하고 단일writer로 진행한다. 범위는 contracts의해당schema/type/runtime·서버backups/command/route/권한해당부분·웹backups/UI14·신규pendingSQL·집중시험/문서로 제한한다. 기존 적용SQL/무관연산·보호미추적자료는 수정0이다. 파일목록이 아직 없는 이 문서를 포괄 write 허가로 사용하지 않는다.

## 8. 필요한 PMO 결정·지원

- 새 세 연산/보호 조회와 현재권한·CAS/replay/회수·REQUIRE_APPROVAL 연결 경계를 상세 계약 방향으로 채택할지.
- 이식형 사용자 해제와 설치 Secret 공급자 위임 무인형 중 키 복구/사용 경험의 권장안. 실제 adapter 보호 근거·설치 공급이 없으면 실행은 차단한다.
- 백업 자체의 유한한도 수치 선정 및 실제제공자료 collector 표 고정의 담당 기술판단 범위.

어느 결정을 하더라도 실제DB/schema적용·정책/권한부여·키/경로/Secret·서비스·PG복구·Agent/외부비용 실행은 포함하지 않는다. 승인된 독립 계획 구현은 계속한다. 원문/키·job·backup을 지우는 rollback은 제안하지 않는다.
