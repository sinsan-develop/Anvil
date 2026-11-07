# FN16 설치 자원 공급·사용자 해제형 이식키 계약 후보

상태: **NOT_ADOPTED / r2 / 2026-10-28 / 문서 후보만**. 이 문서 작성은 제품·시험·SQL 작성이나 실제 자원 등록·키 생성·Secret 입력·DB·서비스 실행 승인이 아니다. 자동 활성화·자동 백업·자동 삭제는 없다. 아래 수치·공개 API·명령·권한·저장 구조는 모두 신규 결정 제안이다.

## 1. 근거와 이번 결정의 목적

- PMO `D:/Project/PMO/reports/ANVIL_V3_MANAGEMENT_HANDOFF_2026-10-17.md` 2565·2573: B(OWNER 보호참조 설정 화면) 선택, 설치 자원 공급·키 보호/유실/이식 상세화, 사용자 해제형 이식키 첫 후보 권장. 이는 실제 공급자·키·Secret 사용 승인이나 이번 wire의 채택이 아니다.
- `FN16_MANUAL_BACKUP_POLICY_CANDIDATE.md` r2, SHA256 `717496CD0E47ED1A267A689FAF82D9D2C9AF5A4D10FA83112B80A1660AEED5B0`: 수동 생성·사용자 지정 대상·키 분리·평문 fallback 금지·불명 사본 보존 방향. 해당 원문은 미채택 후보로 보존한다.
- `FN16_PROTECTED_REFERENCE_REGISTRATION_CONTRACT_R2.md`, SHA256 `CA7774F7A5C102B2B6EDD3D5D6E87701FEADE197E91B2186D05F4AACFE30AA21`(이하 R2): OWNER GET4, save/revoke 참조·고정 snapshot·CAS·명시 승인·과거 참조 보호는 이미 구현된 별도 단위다. 이번에 재구현하거나 그 승인으로 설치 자원을 허가하지 않는다.
- `TECH_DECISIONS.md` §7·§12/TD-03: 백업과 키 분리, 최초 수동·자동 삭제 OFF, 위치/키는 실제 준비 때 선택. 설계 v3 §10.4·§11.15: 사용자 소유의 이식 가능한 자료, Agent 로그인에 종속되지 않는 복구·UI14. 키는 백업과 별도 관리한다.
- 현재 `apps/server/modules/backups/backup-resource-provider.ts`는 `UnconfiguredBackupResourceProvider`이며 list=[]/read=null이다(확인 raw `A40B32DE3162E312DE6410207C4F190371CAEE7B1100D5B57EDC38BEDDF00189`). 기존 project-backups/project-export-store는 선택 문서 첨부 반출용이다. 그 exportRoot·보호 방식·기존 승인·반출 API를 새 키 저장소나 전체 백업 공급자로 전용하지 않는다.

권장 최소안은 **설치자가 준비한 로컬 저장 슬롯을 OWNER가 선택하고, 사용자 비밀번호로 감싼 프로젝트 키를 필요할 때만 서버 메모리에 해제하는 방식**이다. 암호화된 이식키 파일과 비밀번호를 사용자가 따로 보관하면 Agent 계정 없이 동일 프로젝트의 새 Anvil 설치로 옮길 수 있다. 별도 Secret 서비스·무인 해제·클라우드 저장은 추가하지 않는다. 이 단계는 자원/키의 준비 기능이며 전체 프로젝트 수집·backup job·백업 암호화 파일 형식·검증 복원 구현을 포함하지 않는다.

## 2. 기존 계약과 새 결정의 차이

| 항목 | 기존 확정 경계 | 이 문서의 신규 후보 delta |
|---|---|---|
| 자원 공급 | R2의 빈 공급자·고정 참조 조회 | 보호된 설치 catalog, TARGET 등록·ENCRYPTION_KEY 등록/이식, 현재성 검사 |
| 사용자 권한 | R2 참조 save/revoke, OWNER GET4 | 새 `manageBackupResource` 명령과 하위 action, 등록/해제 등 새 권한을 쓰는 action의 intent 생성 때 정확 일회 승인 소비. 본인 lease 재잠금은 별도 감소 전용 endpoint이며 승인 action에서 제외 |
| R2 상태 호환 | Resource current와 닫힌 reasonCodes | 기존 reasonCodes 불변. current는 등록/보호 descriptor 유효성만 표현하며 잠금은 신규 key-state/사용 직전 검사로 분리 |
| 재잠금 | 기존 R2에 lease 없음 | 현재 본인 actor/client/session의 정확 generation만 즉시 사용 차단. 제어/정책/알림 한도가 차단을 막지 않음 |
| Secret 전달 | 키/비밀번호 DTO 없음 | 승인된 비밀 없는 intent와 일회 Secret 제출을 분리하는 신규 API·로그 배제 경계 |
| 암호 | 이식·보호 방식 미정 | §5의 scrypt/AES-256-GCM 고정 프로필·포맷·유한 수치 |
| 수명/복구 | 실제 키/슬롯 준비 미정 | 최대 5분 해제·재잠금, 비밀번호+이식 파일 복구, 옛 키 보존·자동 재활성화 없음 |
| 지속 자료 | R2 참조 원본/회수 기록 | 공급자 descriptor·intent·암호문 envelope의 새 저장 구조/forward SQL source 제안. 기존 SQL 수정·적용 없음 |

이 표의 채택 여부와 source-only 구현 허용 여부를 따로 결정한다. 실제 설치 경로/OS 보호 설정·실키/Secret·DB 적용·정식 사용자 입력/서비스 운영은 후속 exact 실행 승인 없이는 0이다. 신산님이 새 명령의 권한을 채택하기 전에는 기존 consumableOperations/정책 화면에 추가하지 않는다.

## 3. 설치 슬롯과 등록 경계

첫 지원 후보는 서버의 **로컬 POSIX 파일시스템 슬롯**이다. Windows/SMB/NFS/다중 서버 쓰기는 미지원으로 차단하며 Windows DPAPI를 WSL/서버 키 보호 근거로 쓰지 않는다. 설치 catalog는 서비스 밖의 보호된 설정 파일로 제공하며 서비스가 임의 생성·수정하지 않는다. 실제 파일 배치/owner/mode/용량은 설치 승인 때 고정한다.

Catalog 항목은 내부 `{slotId, installationId, purpose:BACKUP_TARGET|KEY_VAULT, absoluteRoot, expectedRootIdentity, capacityBytes, profileVersion}`이다. absoluteRoot와 파일 정체성은 서버 내부 전용이다. 브라우저에는 `{slotId, displayName, purpose, profileRef, state, reasonCodes}`만 보낸다. 경로·접속 문자열·키·사용자 입력 pathHint를 받지 않는다. catalog 부재/유효성 불명은 UNCONFIGURED/UNVERIFIED이고 exportRoot·임시 폴더·환경변수 임의 경로로 fallback하지 않는다.

TARGET 등록은 허용 slotId를 선택하는 행위다. DB에 원시 경로를 저장하지 않고 installationId/slotId/profileRef와 보호 검증 evidenceRef를 귀속한다. root는 절대 경로, 프로젝트 원문/실행 소스/키 vault와 분리, 서비스 전용 owner·0700, 링크/특수 파일/상위 이탈/동일 root 중복 귀속을 거절한다. 서버가 정한 UUID 하위 경로만 사용한다. 등록과 실제 사용 직전에 root/부모/파일 정체성·현재 권한·남은 용량을 재검사한다. 문자열 realpath 비교만으로 확인/사용 사이 교체 방어가 증명됐다고 표시하지 않는다. 안전한 handle 기반 경계가 제공/검증되지 않는 플랫폼은 사용 불가다. 현재 그 경계를 구현할 수 있는 adapter가 있다고 가정하지 않는다. 실제 구현 가능한 adapter와 안전한 파일·부모 handle 연산을 독립 검수하기 전에는 catalog 등록/키 vault의 실사용을 0으로 유지한다.

쓰기 검증은 승인된 슬롯 안의 새 UUID 검증 파일(최대 1KiB, wx/no-follow, 0600)만 생성·sync·재읽기하고 자기 파일 정체성을 대조한 뒤 정리하는 후보다. 기존 파일 열기/교체/삭제·임의 경로 검사 권한이 아니다. 정리 실패/정체성 불명은 UNKNOWN으로 보존하고 등록 성공을 금지한다. 이 실제 probe도 지금은 실행하지 않는다.

KEY_VAULT에는 암호화된 이식키 envelope만 둔다. DB에는 envelope digest·keyId/version·provenance·보호 evidence와 불변 귀속만 저장한다. 복호화 키/비밀번호/KEK와 그 추측 검증용 hash는 DB/로그/audit/명령/Agent/일반 백업에 저장하지 않는다. raw path는 API error에도 내보내지 않는다. envelope 파일도 일반 다운로드/첨부/Agent source로 노출하지 않는다.

## 4. 인증·wire·일회 승인 후보

`P=/api/v1/projects/:projectId`이고 모든 URL은 same-origin이다. GET은 현재 로그인 HUMAN OWNER·활성 membership·현재 프로젝트 접근으로 제한하고 제어권 없이 읽을 수 있다. Secret 제출 및 새 사용 권한을 만드는 명시 변경에는 현재 OWNER, 정확 client/session, 현재 control generation, CSRF, 허용한 정책 version을 요구한다. 일회 승인은 아래 intent 생성 transaction에서만 소비하고 fulfill에서 재소비하지 않는다. 본인 lease 재잠금만 §4.3의 감소 전용 경계를 적용한다. 승인 scope는 actor/client/project/action/target 고정 ref·expectedVersion·payloadHash·기한에 결박한다. 승인 요구를 AUTO로 낮추거나 기존 R2 참조 승인을 재사용하지 않는다. UI08은 승인 결정만 하고 원 화면으로 명시 복귀한 후 별도 실행한다.

### 4.1 비밀 없는 명령

신규 명령 `manageBackupResource`의 payload는 닫힌 `{action, resourceRef, expectedResourceVersion, expectedLeaseGeneration, slotId, displayName, envelopeHash, reason}`이며 action은 `REGISTER_TARGET|ENROLL_KEY|IMPORT_KEY|VERIFY_KEY_COPY|UNLOCK_KEY|REWRAP_KEY|ROTATE_KEY`만 허용한다. action별 쓰지 않는 필드는 null, 이유는 1~2000자, 이름은 1~120자다. resourceRef는 원 R2 Ref 형식이며 신규만 null/version0, 기존은 정확 고정 ref/CAS다. slotId는 REGISTER/ENROLL/IMPORT에만, envelopeHash는 IMPORT/VERIFY_KEY_COPY/UNLOCK/REWRAP에만 허용한다. expectedLeaseGeneration은 UNLOCK_KEY에서 현재 서버 generation의 안전 정수, 나머지 action은 null이다. RELOCK은 이 명령/intent action에 포함하지 않는다. 기존 command envelope의 targetId/expectedVersion·baseline/policy refs·clientCommandId·operationId/승인 결박을 유지하고 action별 payload와 이중 대조한다. 공개 API parser/정책 scope/승인 reader/서버 guard/FN17 목록 모두 동일 연산을 지원해야 한다. manageBackupResource→INTENT_READY를 저장하는 동일 transaction에서 정확 승인 1건을 한 번만 소비하고 그 CONSUMED 승인/authorization receipt와 원 intent command의 귀속을 고정한다. 승인 소비·명령 receipt·intent 저장 중 하나라도 실패하면 함께 rollback한다. 새 명령의 receipt에는 `INTENT_READY`와 intentRef만 기록하며 자원 등록/키 해제 완료로 표시하지 않는다. 원 command replay는 동일 intent만 반환하며 추가 승인 소비/새 intent 생성은 0이다.

### 4.2 신규 경로와 DTO

| 경로 | 닫힌 입력 / 출력 |
|---|---|
| GET P/backup-installation-slots | kind=TARGET 또는 ENCRYPTION_KEY / `{items, observedAt, state}`; slot DTO는 §3 |
| GET P/backup-resources/:id/versions/:version/key-state | 없음 / `{resourceRef, leaseGeneration, state:LOCKED 또는 UNLOCKED 또는 UNVERIFIED, unlockedUntil, copyConfirmed, auditState:RECORDED 또는 UNKNOWN, observedAt}`; Secret/lease 토큰 없음 |
| GET P/backup-resource-intents/:id | 없음 / `{intentRef, action, resourceRef, state, expiresAt, resultRef, reasonCodes}` |
| POST P/backup-resource-intents/:id/fulfill | `{intentRef, secretInput}` / 비밀 없는 같은 intent 상태 DTO |
| POST P/backup-resources/:id/versions/:version/relock | `{resourceRef, expectedLeaseGeneration}` / §4.3의 `{resourceRef, leaseGeneration, state:LOCKED, auditState:RECORDED 또는 UNKNOWN, observedAt}`; intent/Secret 없음 |
| GET P/backup-resources/:id/versions/:version/portable-key | ENCRYPTION_KEY의 정확 ref 및 현재 OWNER 접근 / 지정한 암호문 envelope binary만, no-store·첨부 다운로드 |

intentRef는 서버 UUID/version1/contentHash다. intent 원본은 승인 command/receipt/scope digest·actor/client/session/control/policy·action/자원 ref/기한을 고정한다. state는 `READY|PROCESSING|SUCCEEDED|FAILED|UNKNOWN|EXPIRED`; resultRef는 성공한 descriptor ref 또는 null이다. 현재 해제 상태를 intent 성공 receipt만 보고 복원하지 않는다. secretInput은 REGISTER_TARGET=null, ENROLL_KEY/ROTATE_KEY=`{passphrase, confirmPassphrase}`, IMPORT_KEY/VERIFY_KEY_COPY/UNLOCK_KEY=`{passphrase, envelope}`(UNLOCK은 서버 저장 envelope와 hash 일치 필수), REWRAP_KEY=`{oldPassphrase,newPassphrase,confirmPassphrase}`만 허용한다. 원문 Secret 제출에는 UTF-8 body 최대20KiB(초과413)·body/error/trace logging 금지·no-store·허용 Origin/CSRF·TLS가 필수다. TLS/로그 배제 경계가 입증되지 않으면 Secret 입력 UI 자체를 제공하지 않는다.

Secret은 ProjectCommand·requestApproval·audit payload에 넣지 않는다. fulfill은 APPROVED·미소비 승인을 요구하거나 consume 함수를 다시 호출하지 않는다. 원 CONSUMED 승인/authorization receipt·원 command와 intent의 정확 귀속(승인 ref/원 candidateCommandId·command hash/scope digest·actor/client/project/action/target/policy)을 검사한다. 그 원 승인 기한과 intent 기한, 현재 actor/session/control/policy·자원 version/lease generation CAS를 처음과 최종 활성화 직전에 다시 대조한다. 다른 명령이 소비한 승인이나 다른 intent의 성공 receipt를 빌려 쓸 수 없다. READY→PROCESSING을 동일 project 잠금/CAS로 한 번만 차지한다. **첫 제출을 받으면 성공/실패와 무관하게 그 intent로 Secret을 다시 실행하지 않는다. 실패 횟수는 오류 transaction rollback으로 지워지지 않게 별도 원자적 제한 기록으로 보존하며, 제한 기록의 저장/현재성이 불명확하면 KDF와 키 사용을 차단한다.** 재시도는 새 명령/승인이다. 전송 유실은 GET으로 원 intent 상태를 명시 재조회하며 비밀번호를 자동 재전송하거나 새 intent를 자동 만들지 않는다. 승인/세션/제어/정책의 짧은 기한보다 intent가 길어질 수 없다. project 전체 intent의 상태 조회·거절도 다른 사용자의 Secret 존재나 상세 실패를 누설하지 않는다.

오류 후보: INPUT_INVALID400, NOT_FOUND404(타인/타프로젝트 포함), RESOURCE_VERSION_CONFLICT409, APPROVAL_REQUIRED412, RESOURCE_UNVERIFIED412, KEY_LOCKED412, KEY_UNLOCK_FAILED422(오류 비밀번호/인증 실패 통합), RESOURCE_LIMIT429, RESOURCE_PROCESSING409, RESOURCE_STATE_UNKNOWN503. 일반 예외는 민감 상세를 제거한다. UNKNOWN을 실패로 단정하거나 자동 정리/재실행하지 않는다.

R2 GET4·Ref/ReferenceSnapshot·닫힌 reasonCodes 목록은 그대로 유지한다. KEY_LOCKED 등 새 잠금 코드를 R2 Resource 응답에 넣지 않는다. 공급자가 검증된 descriptor를 반환할 때만 기존 saveBackupReference의 정확 installationResourceRef 소비가 가능해진다. Resource current.eligible은 등록/보호 descriptor의 현재 유효성만 뜻하며 키가 해제됐거나 실제 암호 연산이 허가됐음을 증명하지 않는다. 잠금·해제 기한·generation·재잠금 감사 불명은 신규 key-state 응답에서만 표현한다(key-state에는 auditState:RECORDED|UNKNOWN도 포함). 암호 연산을 연결할 후속 사용 계약은 별도로 현재 권한/승인·key-state·정확 lease/generation/기한을 사용 직전에 확인해야 한다. 이 신규 사용 경계의 채택도 R2 기존 승인에 포함됐다고 해석하지 않는다. 과거 암호문/참조의 원본과 VERIFICATION 공급자·limitsRef 준비 경계는 보존한다.

### 4.3 본인 lease 재잠금 — 신규 감소 전용 경계

relock endpoint는 현재 인증된 actor/client/session이 소유한 동일 project/resource의 정확 lease generation만 다룬다. CSRF/Origin·현재 세션 정체성·route/body ref·generation CAS를 대조하고 다른 사람/다른 client/session·다른 generation은 종료하지 않는다. OWNER/control/policy/일회 승인/intent·FN17 알림 생성·알림 한도 충족을 재잠금의 선행으로 요구하지 않는다. 이는 키 사용을 추가 허가하지 않고 본인 사용 가능성을 즉시 줄이는 별도 후보 delta다. 권한을 잃은 본인 세션도 유효한 인증이 남아 있으면 자기 lease만 막을 수 있다. 인증 세션 자체가 끝나면 자동 세션 회수가 사용을 차단하며 옛 인증으로 명시 endpoint를 허용하지 않는다.

정확 generation 대조 뒤 서버 메모리의 사용 금지 표식을 먼저 적용하고 키를 폐기한다. 이어 generation/감사를 저장하되 DB·감사·알림 실패가 사용 금지/폐기를 rollback하지 못한다. 기록 성공이면 LOCKED/auditState=RECORDED, 기록 실패/불명이면 LOCKED/auditState=UNKNOWN과 재조회 필요를 반환한다(오류 응답에도 사용 차단 사실과 기록 불명을 분리). 실제 저장하지 못한 감사를 성공이라고 표시하지 않는다. 재조회는 현재 프로세스의 사용 금지와 기록 상태를 다시 대조하며 자동 재해제·승인 재사용을 하지 않는다. 재시작은 항상 LOCKED다. stale generation 재잠금은 새 lease에 영향 없이 거절한다. 자동 만료/권한 회수도 제어·정책·DB 저장 성공을 기다리지 않고 신규 사용을 막는다.

## 5. 키 형식과 유한 프로필 — 모두 신규 제안값

비밀번호는 로그인 비밀번호와 별도로 20~256 Unicode code point, UTF-8 최대1024byte, 정상 Unicode만 허용하며 trim/정규화/대소문자 변경을 하지 않는다. 길이는 추측 저항의 보장이 아니다. 사용자에게 길고 재사용하지 않은 비밀번호와 오프라인 보관을 안내한다. 서버는 비밀번호를 TLS 요청 처리 중에만 받고 KDF를 비동기로 수행한다. 브라우저 storage/URL/화면 복귀 buffer에 저장하지 않고 제출·이탈 때 입력을 비운다.

| 항목 | 제안값·초과/실패 처리 |
|---|---|
| DEK / 암호 | CSPRNG 32byte 프로젝트 자료 키; wrapping은 AES-256-GCM, tag16byte. 서버에서 생성, 평문 내보내기 없음 |
| 비밀번호 KEK | scrypt N=131072,r=8,p=1,dkLen32byte,salt CSPRNG16byte; Node maxmem256MiB. 프로필 이외 KDF·과대 파라미터는 계산 전에 거절 |
| wrapping nonce | CSPRNG12byte. 같은 KEK에서 재사용 금지; 매 wrapping마다 새 salt+nonce, 기존 envelope 덮어쓰기 없음 |
| envelope | UTF-8 canonical JSON 최대16KiB; unknown/duplicate key·비정규 base64url·가변 crypto parameter·외부 URL/경로 거절 |
| 해제 수명 | 최대5분, idle 연장 없음. session/승인/control/policy 기한 중 가장 짧은 창. logout·권한상실·제어이전·명시 relock·프로세스 재시작 때 즉시 신규 사용 차단 |
| 동시성·자원 | 서버 프로세스 KDF 동시1/대기0, project 해제lease1; 거절429. 최초 프로필은 단일 서버 프로세스만 지원 |
| 시도 제한 | actor+project+key 및 project 전체 각각15분에5회 실패 후15분 신규 해제 차단. 서버 신뢰 시각·지속 카운터, 성공/재시작으로 제한 초기화 금지 |
| intent·보관 한도 | intent 수명 최대60초·동시 READY/PROCESSING project1; project TARGET 최대8, 키 generation 최대32, generation당 wrapping 최대32. 도달시429·삭제/상향 자동0 |

envelope 닫힌 원형은 `{format:'ANVIL_PORTABLE_KEY_V1', originProjectId, keyId, keyVersion, wrappingVersion, createdAt, kdf:{name:'scrypt',N:131072,r:8,p:1,dkLen:32,salt}, aead:{name:'AES-256-GCM',nonce,tag}, ciphertext}`다. ciphertext는 정확32byte DEK의 암호문이다. canonical header(위에서 tag/ciphertext만 제외한 모든 필드)의 UTF-8 bytes를 AAD로 사용한다. project/key/version/프로필 변조는 GCM 인증 실패다. envelope hash는 완성된 canonical JSON 전체 SHA-256이며 비밀번호 hash가 아니다. 다른 project에 envelope를 바꾸어 붙일 수 없다. 이식은 동일 originProjectId를 보존하는 설치 이전만 지원한다. 다른 project ID로 재귀속·자료 복원은 별도 계약이다.

Node 공식 crypto 문서는 GCM tag 검증 실패 시 final 실패와 scrypt API를 설명하며, [RFC7914 §12](https://www.rfc-editor.org/rfc/rfc7914.html#section-12)는 KDF 고정 벡터를 제공한다. [Node24 crypto 공식 문서](https://nodejs.org/docs/latest-v24.x/api/crypto.html)는 API 근거이며 위 비용/수명/시도 제한값을 권장하거나 실제 고정 runtime의 성능을 증명하지 않는다. 구현 전 exact Node/OpenSSL 호환성·실측 비용을 대조하고 값을 바꾸려면 후보 개정/결정을 받는다. 검증 실패 plaintext는 사용/저장하지 않는다.

평문 DEK/KEK는 서버 프로세스 메모리에만 한시 보관한다. 사용할 때마다 lease와 현재 auth/control/policy를 확인하고 폐기 시 best-effort Buffer zeroing·참조 해제를 한다. JavaScript GC·OS swap/core dump·관리자/같은 서비스 사용자 침해에 대한 완전 소거/격리를 보장하지 않는다. 해당 운영 보호가 미확인인 설치는 UNVERIFIED다. Agent/사용자 API에는 DEK나 복호화 oracle를 제공하지 않는다.

## 6. 사용자 동작·복구·회전

1. **대상 등록:** UI14 ‘설치 저장소’에서 catalog 슬롯의 이름·용량·보호 관측·실제 사용 영향만 확인한다. OWNER 명시 승인→복귀→등록 실행→현재 검증 결과 조회. 실제 절대 경로는 숨기고 임의 파일 선택창을 제공하지 않는다.
2. **키 등록:** 별도 비밀번호 입력→비밀 없는 ENROLL 승인 intent→명시 fulfill. 새 DEK와 wrapping을 보호 vault에 저장한다. 최초 상태는 LOCKED이며 자동 백업/정책 저장을 하지 않는다. 암호화된 이식키 파일을 별도 다운로드해 사용자 선택 위치에 보관한다. 서버는 다운로드 요청 성공을 오프라인 보관 완료라고 주장하지 않는다. 사용자가 다운로드한 파일을 다시 선택하고 별도 VERIFY_KEY_COPY 승인 intent로 정확 hash/비밀번호 복호화를 확인하기 전에는 ‘복구 준비 미확인’을 표시하고 새 백업용 참조 선택을 막는다.
VERIFY_KEY_COPY는 보관 확인 metadata만 갱신하고 키를 해제하지 않는다. REWRAP도 새 wrapping의 이 확인을 거쳐 기본값을 전환하며 옛 wrapping을 보존한다.
3. **해제/재잠금:** UNLOCK의 성공은 actor/client/project/session/control에 결박된 비전달형 서버 lease만 만든다. 상태는 위 key-state GET으로 조회하며 bearer secret을 반환하지 않는다. UNLOCK은 intent 준비 때의 expectedLeaseGeneration을 최종 실행 때 CAS 대조하고, 본인 RELOCK은 §4.3 endpoint에서 현재 generation을 CAS 대조한다. 해제/재잠금/자동 만료·권한 회수 뒤 새 사용 시 generation을 전진시키며 이전 unlock intent가 더 늦게 생성된 lease를 다시 열거나 stale relock 요청이 새 lease를 닫을 수 없다. 기한이 지난 메모리 키는 generation 저장 실패와 무관하게 사용을 금지한다. 자동 재해제 없음. 명시 RELOCK은 승인 action 밖의 §4.3 감소 전용 endpoint로 즉시 신규 사용부터 차단한다. 자동 만료·권한상실은 승인 대기 없이 보안상 폐기한다. 아직 backup job이 없으므로 진행 job 취소/복원 재시작은 구현하지 않는다.
4. **오프라인 복구/설치 이전:** 암호화된 이식키 파일+기억/별도 보관한 비밀번호를 사용한다. 새 설치에 실제 보안/DB 준비와 동일 project 정체성 복구를 먼저 별도 승인하고, OWNER가 IMPORT 승인→파일/비밀번호 제출→tag/원 project·key 정체성 검증→새 설치 descriptor 발행→기존 참조 연결을 명시 수행한다. 옛 installation descriptor/ref를 새 환경에 자동 유효화하지 않는다. 외부 Agent 계정이나 이전 서버의 Secret 서비스가 필요하지 않다.
5. **유실:** 비밀번호를 잊어도 이미 해제된 세션을 비밀번호 복구 근거로 쓰지 않는다. 기존 비밀번호 없이 재포장/평문 export를 허용하지 않는다. 이식 파일을 잃었으나 vault 암호문과 비밀번호가 있으면 정확 envelope를 다시 다운로드한다. 둘 중 필요한 자료를 모두 잃으면 그 키의 암호문은 복구 불능일 수 있으며 관리자 우회/escrow/새 키로 옛 자료 복호화는 없다. 사용자 확인 없이 파일/옛키를 삭제하지 않는다.
6. **비밀번호 변경(REWRAP):** 옛 비밀번호로 인증된 동일 DEK를 새 salt/nonce·wrappingVersion으로 감싼다. 새 파일 보관 확인 전 새 wrapping을 기본값으로 전환하지 않는다. 옛 envelope는 보존하고 ‘옛 비밀번호로 해제 가능한 사본이 남음’을 명시한다. 비밀번호 변경은 이미 유출된 옛 파일의 비밀번호를 무효화하지 못한다.
7. **자료 키 회전(ROTATE):** 새 keyId/generation·DEK·비밀번호 wrapping을 만든다. 새 참조의 명시 CAS 선택 후에만 미래 자료에 쓴다. 옛 키/참조/암호문과 보관 파일을 보존하며 옛 키의 복호화 유효성은 유지한다. 회수는 새 사용 차단이지 옛 백업 암호학적 파괴가 아니다. 기존 자료 재암호화·옛키 폐기·정리·보존 기간 변경은 별도 결정이다.

원문/Secret 입력은 승인 화면과 프로젝트 전환 buffer에 보존하지 않는다. 비밀 없는 action/원 command만 App CAS로 소유하며 UNKNOWN 원명령은 별도 표시한다. 프로젝트/actor/client ABA 후 늦은 성공 응답이 현재 선택/잠금 상태를 살리거나 다른 문맥의 해제를 표시하지 못하게 한다. 재조회 전 ‘해제됨’을 추측하지 않는다. 보호참조 R2 및 기존 반출 미전송 해제/불명 전송 보호는 변경하지 않는다.

## 7. 저장·실패 창·동시성

신규 영속 metadata 후보는 installation-resource descriptor/version, resource-intent/state, key-wrapping metadata, 실패 제한 counter다. 프로젝트 귀속·현재 head/CAS·원 command/receipt/승인/audit 고정 관계·자기행 조회 guard를 둔다. 공급자는 보호 catalog와 실제 envelope를 다시 대조하며 DB metadata만으로 VERIFIED를 만들지 않는다. 명령·정책·승인 현재성/기한은 파일 쓰기 전과 최종 성공 저장 직전에 재검사한다. FN17 알림 실패가 승인 원명령을 rollback하는 기존 원자성은 유지한다.

파일과 DB commit을 한 transaction이라고 표현하지 않는다. 안전한 handle adapter 구현 가능성과 publish 뒤 parent directory fsync·DB commit 실패 창의 정합 검수는 실제 사용의 필수 선행이다. envelope는 vault의 새 UUID 임시 파일을 wx/0600/no-follow로 쓰고 sync·재읽기·정확 hash를 확인한 뒤 불변 이름으로 publish하고 parent directory handle을 fsync한다. parent fsync 실패/불명은 내구성 성공으로 표시하지 않고 파일/intent를 보존·사용 차단한다. DB에는 정확 파일 digest와 원 intent 결과를 저장한다. DB 성공 전에는 공급자 선택/lease 발급을 금지한다. 파일 완료 후 DB 실패/commit 불명·응답 유실은 UNKNOWN으로 원 intent와 파일을 보존한다. DB 성공·파일 부재/변조는 INTEGRITY_FAILED/사용 차단이다. 자동 재등록·덮어쓰기·삭제로 성공처럼 맞추지 않는다. 권한/기한이 만료되면 메모리 키를 폐기하고 새 사용을 막는다.

reconcile은 이번 별도 공개 명령으로 만들지 않는다. GET은 정합 사실만 보여주며 UNKNOWN→SUCCEEDED를 몰래 확정하지 않는다. 수동 복구/고아 파일 정리 방법은 정확 대상·승인·보존 근거를 갖춘 후속 운영 결정이며 이번 source-only 채택으로 실제 정리를 허가하지 않는다. 재시작 후 READY는 기한/현재성을 재검사하고 PROCESSING은 UNKNOWN·모든 lease는 LOCKED다.

## 8. 제안 구현 표면·순서·검수

다음은 **채택 뒤 WI에서 exact allowlist/hash를 고정할 표면 제안**이며 현재 쓰기 권한이 아니다. R2 CA777 완료 source는 지금 동결한다. 향후 source 변경이 필요하면 해당 변경 근거와 직접 회귀를 함께 고정한다.

| 표면 | 제안 경로/경계 |
|---|---|
| 신규 codec/crypto/공급자 | `contracts/runtime/backup-installation-resources-v1.ts`, `apps/server/modules/backups/portable-key-envelope.ts`, `installation-resource-store.ts`, `installation-resource-routes.ts`, `installation-resource-catalog.ts` |
| 기존 서버 연결 | `apps/server/modules/backups/backup-resource-provider.ts`, `backup-reference-store.ts`, `apps/server/modules/projects/routes.ts`, `apps/server/modules/access/project-command.ts`, `apps/server/modules/approvals/approval-input.ts`, `project-approvals.ts`; 명령 enum/현재 policy/승인/FN17 지원목록의 정확 연결만 |
| 신규 UI와 기존 소비 | `apps/web/src/features/backups/InstallationResourcePanel.tsx`, `installation-resource-api.ts`; 기존 `apps/web/src/App.tsx`, `features/backups/BackupReferencePanel.tsx`, `features/decisions/ApprovalsPage.tsx`, `features/decisions/api.ts`, `features/connections/policy-editor-profile.ts`의 새 연산 소비만 |
| 미적용 SQL | 신규 forward `.sql.pending` 한 개. 관측 목록은0050~0053이 존재한다. 번호/정확 파일명은 후속 WI 직전 inventory로 결정하며 이 문서에서 예약하지 않음. 기존 SQL/적용 리스트 변경0 |
| 집중 검증 | 신규 FN16 codec/crypto, resource store/routes 권한·원자성 시험, UI14 실제 App 정상/승인·유실·ABA 시험. R2 원시험/기존 반출 기대 삭제·완화0 |

권장 순서는 (1) 이 후보의 delta·수치·한계를 결정, (2) exact 문서/WI·manifest와 source-only 허용 범위 확정, (3) TEST_ONLY→Main 실제 RED→단일 writer 제품→독립 검수, (4) source/합성 결과서, (5) 별도 실제 설치·Secret·DB·사용 여정 승인을 준비하는 것이다. 최소 검수는 다음을 포함한다.

- 독립 expected DTO/command/envelope/AAD/hash, RFC KDF 벡터와 GCM tag/nonce/파라미터/동일project·key 변조 거절. 복호화 final 전 plaintext 미사용·비밀번호/DEK/경로가 log/audit/command/에러·브라우저 storage에 남지 않는 반례.
- OWNER GET/새 권한 action의 현재 control/session/policy/일회 승인, VIEWER·타인·다른 client/project·expired/revoked approval 거절, secret submit 전후 변경·동시 fulfill·cap 경쟁·재시작 제한 보존. 원 intent 생성에서 승인 소비 정확1회·replay 추가소비0·fulfill 재소비0/APPROVED 미소비 요구0·CONSUMED 다른 명령 귀속 거절을 검사한다. fixture 허가 stub을 실제 권한 검증으로 세지 않음.
- 안전한 catalog 미구성·지원 밖 플랫폼·부모/link/identity 교체·용량부족·file publish/DB rollback·commit/응답 유실→UNKNOWN, 자동 정리/재전송/중복 키0. 합성 I/O 결과와 실제 OS 보호를 구분.
- 본인 relock은 control 상실/정책 DENY/알림 한도 초과에서도 정확 자기 generation의 사용을 차단하고, DB·감사 실패에도 LOCKED/audit UNKNOWN을 보존한다. 타인/session/client·새 generation 종료0·자동 재해제0, R2 기존 reasonCodes 불변·잠금이 key-state에만 보이는 반례를 확인.
- UI14 슬롯 선택→등록/키 생성→이식 파일 재입력 확인→R2 참조의 명시 선택, 승인 복귀 자동실행0, relock/기한 종료/권한상실, 늦은 응답·프로젝트 ABA·UNKNOWN 상태 유지. 옛 envelope/옛키 복호화와 회전 뒤 미래 참조 분리.

실제 DB/RLS/GRANT·파일 내구성/전원손실·OS 보호/메모리 잔류·TLS/운영 로그·실키 이식·사용자 보관·전체 백업/복원은 별도 **NOT_RUN**이다. 합성 검증으로 이를 PASS 또는 전체 FN16 완료로 올리지 않는다.

## 9. 선택·위험·rollback

권장안의 장점은 사용자가 암호화된 키 파일과 비밀번호를 소유하고 Agent/서비스 공급자를 바꾸어도 자료 접근의 조건을 이어갈 수 있다는 것이다. 단점은 수동 해제 필요, 비밀번호/파일 동시 유실의 복구 불능, 도난 파일의 오프라인 비밀번호 공격, 해제 중 서버 침해, 옛 wrapping 비밀번호의 지속 유효성이다. 무인 Secret 공급자는 자동화에 유리하지만 별도 장기 비밀·운영/복구 의존성과 권한이 생기므로 이번 권장 최소안에서 제외한다.

사용자가 결정할 핵심은 **이 최소안의 새 API/intent 생성 시 일회 소비·fulfill 원소비 귀속 대조·R2 상태 호환/신규 사용 검사·본인 lease 재잠금 감소 경계·암호/유한 수치·복구 불능/옛 비밀번호 잔존 위험을 받아들여 source-only 구현을 허용할지**다. 실제 경로/키/Secret/DB/서비스 가동을 함께 승인하는 선택지는 이 문서에 없다. 보존 기간·자동 삭제·무인 해제·전체 백업/복원은 미결로 남는다.

rollback은 신규 경로와 UI 진입을 비활성화하고 공급자를 UNCONFIGURED로 되돌려 새 사용을 막는 source revert다. 기존 R2·반출 동작/원문/승인/실패 기록을 보존한다. 이미 만든 암호문 envelope·키 파일·참조/receipt는 자동 삭제/재암호화/DB reset하지 않는다. 실제 적용 이후의 자료 rollback은 별도 정확 계획·승인을 요구한다.

## 10. r1 검토 이력

r1 SHA256 `97E644BFE4AC792282D77635499D2D621D3981949C758100C236398BAA8F235D`의 독립 검수는 C0/I3였다. r2는 I1 승인 소비 시점/fulfill 귀속, I2 R2 닫힌 reasonCodes와 신규 key-state 분리, I3 승인 없이 본인 lease만 즉시 막는 재잠금·감사 불명 분리를 보완한 후보 개정이다. Main의 이번 지시는 문서 설계 보완이며 채택·구현·실행 승인이 아니다. 원 r1 hash/검토 이력과 기존 승인 범위는 보존한다.
