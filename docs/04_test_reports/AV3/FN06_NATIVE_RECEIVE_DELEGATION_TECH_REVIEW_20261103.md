# FN06 native 최초 수신·위임·전달 후보 r1 기술 검토

2026-11-03. **판정: 보완 필요(REWORK), 채택·구현 준비 미완료.** 실제 취약점 실행을 확인한 판정은 아니다.

## 기준·실행 범위

- 신산님 지시: WORK_STATUS 확인 후 기존 subagent에게 기술 검토를 맡긴다. 실제 키·DB·권한·서비스·Agent 실행 금지.
- 대상 docs/contracts/FN06_NATIVE_RECEIVE_DELEGATION_DELIVERY_CANDIDATE_20261103.md r1.
- 원문 SHA256 F301A7B86EE0CE721F18B2872D69DA2B2FEE8437D5E41C649026388833D07176, 두 검토자 시작·끝/source·정본 동일.
- 기존 Reviewer: 인증·주체·호출선 C0/I3. 기존 Primary: 저장·전달·예약 C0/I6. 아래 A01~A03/B01~B06은 서로 다른 책임영역의 총9개 기술 보완사항이며 전수 제품 보안 검증 결과가 아니다.
- 새 agent/세션·제품 writer0. 코드·후보 원문 변경·시험·빌드·컴파일·실제 키/DB/권한/서비스/네트워크/Agent·실자료 조사·QA 실행0. 기존 패키지 검증 반복0.
- Git 읽기 c5e6f3: codex/av3-stage-b HEAD8f694f31c2aeeac8a2147c6878c1fd6550939ccc. 현황 dirty·후보1+보호untracked3 보존·제품 dirty0. 현황 EOF 빈줄 경고는 PASS로 보고하지 않았고 이후 누적기록의 구분으로 보존했다.
- r1은 DRAFT/NOT_ADOPTED/SOURCE_GO0/EXECUTION_GO0를 유지한다. 이번 검토는 계약 채택·구현·실제 실행 승인이 아니다.

## 유지할 방향

기존 v1/원 등록 상태와 StatusOnly 인증을 보존하고 현재 HUMAN 명령 주체와 원 recipient를 분리한 점은 타당하다. 정확 최종 commandHash·위임·offer·authority parent를 명시 연결하고, 원10초/선COMMIT/최대1회 전달·재전달 금지·휘발ACK를 구분해야 한다는 방향을 유지한다. 다만 미정5항목과 아래 모순을 닫기 전 구현 가능하다고 선언하지 않는다.

## A. 인증·호출선

### A01 Important — 위임 검산 결과와 모든 소비 접점의 원형 미완결

후보 §3/5/6. 실제 접점: project-registration-reads.ts:40,54~59; native-preparation-current-source.ts:54; project-native-preparations.ts:92~96; trust-registration-client.cjs:29와 owner typed SIGN.

PC 등록 뒤 모바일이 controller가 되면 offer/ARM만 정상이어도 writer/current·로컬 HUMAN GET에서 거절된다. 반대로 basis.current=false 전체를 무시하면 원 세션/정책 회수까지 우회한다.

보완: 현재 명령·원 recipient·writer 주체별 검산 결과의 exact schema, 전용 reader가 돌려주는 최소 원등록 projection, server options/current/issuer/host current·consume/local SIGN의 소비 행렬을 고정한다. 기존 HUMAN GET 전체 권한을 대체하지 않는다. 위임 없는 경로는 기존 검사를 유지한다.

### A02 Important — 최초 window/session 발견의 순환과 시작 caller 미정

후보 §4/7은 window 발견을 요구하면서 SESSION_PROOF에 아직 모르는 window/session을 결박한다. shell.cjs:42,47의 remote view에는 preload가 없고 local trust IPC4로 이 동작을 표현할 수 없다.

보완: 최초 등록키 proof→유일 window 발견→session 생성→stream 시작의 단계별 입력/출력·nullable·nonce를 고정한다. PC 수신 절차의 명시 시작은 누가 언제 수행하는지 정한다. 모바일 명령만으로 종료된 PC 앱이 자동 시작되는 의미를 넣지 않는다. 원격 자동 작업 목표를 매번 PC 수동 조작으로 축소하지 않는다.

### A03 Important — 최초 freshness/replay와 단계별 현재성 검사 미정

후보 §7. 기존 native proof는 이미 authority/bearer/serverNonce를 요구한다(native-preparation-routes.ts:11~14; native-preparation-authority-v1.ts:31~32). 최초 proof의 fresh 근거는 이 경로와 분리해야 한다.

보완: client nonce/requestId·기한·원문 hash에 대한 재사용 보관 범위, 동일요청 replay/다른본문 충돌/소비 순서, 발견·OPEN·ARM·binding·전달·ACK·current·consume·SIGN의 회수/현재성 검사 시점을 고정한다. 원 connector_basis_current의 생존/세션/정책/DENY 검사를 보존한다(migration0006:55~67).

## B. 저장·전달·원자성

### B01 Important — 일반 metadata 예약과 collector의 단일 합계식 부재

후보 §9. project-storage-quota.ts:19~42와 migration0059:19~21은 ARTIFACT/CHECKPOINT·정해진 operation으로 닫혀 있다. 정산 :238~253은 원 command/receipt·현재 정책/authorized_until을 요구한다. 기존 원장이 이미 새 metadata 예약을 지원한다고 가정할 수 없다.

보완 권장: 새 목적 metadata 예약/정산을 같은 account 잠금에 명시 연결하고 정산된 bytes는 used에서 한 번만 계산한다. collector는 완결성을 검사하며 같은 bytes를 다시 더하지 않는다. 혹은 별도 소계 방식을 택하면 모든 관련 capacity guard에 단일 공식을 적용한다.

합계는 기존 used+기존 held+새 미정산 held+used 미포함 소계로 명시한다. 예약행·command/receipt/audit·head·signature 비용과 UNKNOWN held 보존을 빠짐없이 포함한다.

### B02 Important — 인증 증거 기록과 terminal headroom 대수 누락

후보의 windows/sessions/offers/command-bindings/acks/events 6종만으로 delegation/challenge/nonce소비/proof replay/profile revision·highwater의 위치가 정해지지 않는다. 최대50 offer·10000 record만으로 종료 가능성을 증명할 수 없다.

보완: 상태별 최대 row/byte 원형을 고정한다. window 고정비+session/challenge/replay비+각 offer/위임/ARM/binding/ACK/최대사건·terminal여유+명령/영수증/감사/head/예약증거를 계산한다. byte와 record slot을 함께 선예약한다. 동시 보존되는 증거는 포함하고 상호배타 분기는 실제 최악값으로 계산한다. UNKNOWN을 자동해제하지 않는다.

### B03 Important — authority2MiB와 wrapper 포함 frame2MiB 충돌

후보 §8. authority 자체 허용 상한2MiB에 ref/snapshot/binding/metadata/opaque/header를 더하면 총2MiB 제한을 넘을 수 있다.

보완 대안: authority를 별도 고정 보호조회하고 frame은 정확ref·제한 delivery만 넣거나, 실제 exact schema 최대값으로 wrapper 포함 상한을 파생한다. 순간 buffer4MiB와 누적100MiB·header/부분수신·중복 과금 범위를 구분한다. 할당 전 길이 검사와 종류/순서/중복/부분close 거절을 고정한다.

### B04 Important — ACK 증거와 기존 terminal의 불명 상태·COMMIT 경계 부족

project-native-preparations.ts:112~113은 supplier 뒤 원예산/현재성을 확인하고 terminal을 기록한다. ACK를 받아도 기한이 지나면 terminal행은 없을 수 있다.

보완 권장: 검산된 ACK 증거와 DELIVERY_CONFIRMED를 같은 후행 Tx에 저장한다. ACK 미관측/ACK COMMIT확인·불명/terminal COMMIT확인·불명/ATTEMPTED만존재를 구분한다. ACK만으로 로컬 소비를 허가하지 않는다. 기한 뒤 CONFIRMED를 새로 만들거나 늦은 ACK로 승격하지 않으며 정확 조회는 재전달하지 않는다.

### B05 Important — 취소와 native binding COMMIT 경합의 잠금·CAS 미정

후보 §5/9의 COMMIT 전 취소만으로 CANCELLED와 COMMAND_BOUND 동시 생성이 막히지 않는다.

보완: offer/head 동일잠금 또는 exact version CAS를 공유해 ARMED→COMMAND_BOUND와 authority/binding을 같은 Tx에서 완결한다. 취소는 binding없는 정확 사전상태만 허용한다. COMMIT불명은 조회 전 CANCELLED로 확정하지 않는다. 같은 command replay는 원결과만, 다른 binding/authority는 충돌이다. window종료/단절은 ATTEMPTED의 미전달 증명이 아니다. recipient와 server재시작을 나눠 secret소실 뒤 재발급 금지를 고정한다.

### B06 Important — stream과 단발 deliver의 실제 소유 생산·소비선 미정

후보 §4/6/8. 연결 선언만으로 기존 deliver 호출과 ACK 대기가 연결되지 않는다.

보완: session/소유stream1·ARM의 instance결박·ATTEMPTED COMMIT 후 전송·backpressure/부분write/close/늦은ACK의 원남은기한·exact ACK의 session/offer/binding/attempt/nonce·중복원결과/상이증거충돌·기한뒤 미정착write/DB 소유·정착처리를 고정한다. write/drain은 수신ACK가 아니다. 수신window2시간과 native10초를 분리하고 새 ACK요청에10초를 재부여하지 않는다.

## 우선 보완 순서와 승인 경계

1. 원형·주체/reader 소비행렬·발견/nonce 순서를 먼저 고정한다.
2. 기록·예약·collector 완결표 및 row/byte·terminal 슬롯 대수를 고정한다.
3. 취소/binding/ACK의 Tx/CAS·COMMIT불명 상태행렬을 고정한다.
4. 그 원형을 쓰는 frame·stream·readback과 실제 Web/모바일/실행기 caller를 닫는다.
5. 보완 r2를 독립 재검토한 뒤 새 목적 위임·bootstrap wire·별도 profile/ACK/저장 의미의 source-only 채택 결정만 PMO에 요청한다.

이 정리는 새 계약을 승인하거나 실제 권한/DB/키·서비스 변경을 허용하지 않는다. 사용자에게 사실 조사나 내부 원형 설계 책임을 넘기지 않는다. 전체 FN06/FN18/작업계획은 미완료다.


## 후속 기술보완 제안 — 미채택, 지적 해소 판정 전

다음은 기존 두 검토자의 한정 보완안이다. r1 원문은 수정하지 않았다. **REWORK·SOURCE_GO0/EXECUTION_GO0를 유지**하며, 아래 제안을 승인 또는 구현 완료로 간주하지 않는다.

### A02/A03: session을 먼저 준비하는 시작·인증 순서

1. PC 사용자가 앱의 유한 수신 준비를 한 번 명시 선택한다. 앱 기동·REGISTERED 상태조회만으로 원격 수신을 시작하지 않고, 서버가 종료된 PC 프로세스를 깨운다고 가정하지 않는다.
2. 원 등록키/별도 native profile의 CHALLENGE→OPEN 뒤 window 미결박 session을 만든다. 아직 모르는 windowRef/sessionRef는 각 phase의 exact null로 구분한다.
3. 고정 stream1개가 연결된 뒤 모바일 controller가 정확 recipient를 골라 window를 생성한다. 해당 registration/project의 유일 활성 session에 같은 Tx로 결박한다. session0은 RECEIVER_NOT_READY, 복수는 무결성 오류이며 다른 PC를 임의 선택하지 않는다.
4. 비밀 없는 결박 알림 뒤 PC는 보호 STATE로 원 window/session을 확인한다. 이후 exact offer 수용/ARM은 소프트웨어로 수행하며 매 작업 PC 클릭으로 축소하지 않는다.
5. Web/모바일은 ARMED를 확인한 뒤 최종 command를 보낸다. native POST 시작부터 원10초/min을 유지한다. window/session 최초기한은 결박 시에도 최소값으로만 좁힌다.

| phase | challengeRef | windowRef | sessionRef |
|---|---|---|---|
| 최초 CHALLENGE | null | null | null |
| OPEN | 정확 원 challenge | null | null |
| 최초 STREAM | OPEN 계열 근거 | null | 정확 원 session |
| 결박 후 STATE/ARM/ACK | 해당 요청의 정확 근거 | 정확 원 window | 정확 원 session |

최초 proof는 server nonce가 없는 등록키의 닫힌 요청 proof이며 server challenge proof로 부르지 않는다. requestId/clientNonce·고정 target/phase·원등록/키세대·profile·로컬준비시도·시각과 null 필드를 서명한다. replay key는 installation/registration/connector세대/requestId, 지문은 canonical 원문 hash로 제안한다. 같은 ID/같은 지문은 원 결과만, 같은 ID/다른 지문은 충돌, 다른 ID/같은 nonce는 재사용 거절이다. OPEN은 challenge 소비와 원 session 생성을 같은 Tx에서 완결한다.

서명/형식 불량에는 영속 원장 생성0. 새 challenge는 서명검산 뒤 원자 nonce/replay·현재성·한도 검사 후 생성한다. 과거 결과 재조회도 접근 인증을 검사하며 만료/소비된 challenge를 재개방하지 않는다.

제안값은 초기유효30초·등록/키세대당 분당30·프로젝트 분당100·활성session/stream1·미소비challenge1이다. 이 값은 미채택이며 시계허용오차/rate분모·원자성·예약대수는 추가 확정이 필요하다. replay 지문을 자동 삭제해 공간을 만들지 않고 프로젝트 누적 분모에 포함한다. 원 nonce·응답 유실/재시작은 새 자동 OPEN/재접속으로 우회하지 않는다.

**잔여:** window 미결박 session의 목적 인증/허가 주체·정책, 실제 local 준비 버튼/IPC caller와 session-first로 바뀌는 exact schema를 닫아야 한다. 이 제안으로 일반 수신 session이 native 실행 허가가 되는 것은 아니다.

### B04~06: 원 Tx/CAS·단발 전달·ACK/terminal

| 단계 | 원자 저장·검산 | 부수효과/원 불명 처리 |
|---|---|---|
| ARM | exact offer/head version·session/stream/recipient nonce·commandHash | 동시ARM1 |
| 취소 | native Tx와 같은 offer/head 잠금, binding없는 사전상태→CANCELLED | 먼저 확정한 Tx만 승리 |
| 원 native Tx | ARMED→COMMAND_BOUND·command/receipt/audit·authority·명시binding 동시COMMIT | 미확정COMMIT을ROLLBACK으로가정0 |
| 전달시도 Tx | ATTEMPTED/deliveryId·원offer/stream 연결 | COMMIT확인 전supplier0 |
| 실제 전달 | 내구새사실없음 | 같은stream에exact6+opaque43 최대1회, 부분write도재전달0 |
| 성공 후행 Tx | ACK원문/서명과DELIVERY_CONFIRMED·대응offer terminal 동시COMMIT | 원기한/현재성/attempt검산·terminal부재CAS |
| 실패 후행 Tx | 허용된UNCONFIRMED 기록 | 원저장조건/기한안에서만, 불가시ATTEMPTED만남을수있음 |

command/binding·ATTEMPTED·ACK/terminal의 유일 제약을 명시한다. COMMAND_BOUND 뒤 취소/window종료/단절은 명령 미실행·미전달 확정이 아니다.

- native/취소/ATTEMPTED COMMIT 응답 유실은 exact ID의 원결과 조회만 허용한다. ATTEMPTED가 나중에 발견돼도 새 supplier 호출은 시작하지 않는다.
- ACK 미관측, ACK/terminal 동일Tx의확인/불명, ATTEMPTED만존재를 구분한다. terminal행 부재는 결과 불명이며 UNCONFIRMED행 존재와 다르다. 기한뒤 UNKNOWN행을 새로 만들어 관측을 위장하지 않는다.
- recipient에 opaque가 살아 있어도 exact ACK+CONFIRMED 보호조회·현재 위임/등록/profile/writer/current·원기한·기존단발factory규칙을 모두 충족해야 소비한다. 서버CONFIRMED 역사만으로재시작recipient의secret을복원하지않는다.
- server재시작·secret소실·부분write/close·ACK유실·후행ROLLBACK은새credential/비밀재전달0이다. 늦은ACK·write·COMMIT응답은원기한뒤새성공/capability를만들지않는다.
- 모든단계는원nativePOST의단조deadline10초와더짧은부모기한을공유한다. 별도ACK요청도새10초를받지않는다. write/callback/drain은ACK가아니다.
- timeout/abort는종료요청이다. 미정착write/query의소유권·buffer/DBlease를정착전재사용하거나회수완료로표시하지않는다.
- hold→used는확인된내구정산과같은Tx에서만전환한다. 부분write/유실/재시작/terminal부재로hold해제0. 취소확정도이미저장된bytes·필수종료증거를삭제하지않는다.

**잔여:** 새목적관측wrapper의exact keys/enum, ACK와원terminal동일Tx의실제호출접점, active operation의원기한·stream소유추적, 종료·정산완결조건을고정해야한다. B01/B02의reservation/collector대수와B03frame설계는이번한정보완안으로해소되지않았다.

## 현재 결론

기술 검토로 r1의 핵심 불일치를 구체화했고 보완 방향을 얻었다. 원문을 임의 채택하거나 Important9건을 닫지 않았다. 다음은 기록/예약/collector 완결표와 새 목적 검산결과/소비행렬을 확정 후보로 구성한 뒤, 동일 보완안을 쓰는 framing·원자성·최초인증 원형을 r2로 통합·독립 재검토하는 순서다. 실제 키·DB·권한·서비스·Agent는 계속 제외한다.



## 원형·예약·frame 보완의 정합 검토 — 구현 가능한 최대값으로 확정하지 않음

### 1. 한정 위임 정본: 별도 delegationRef를 합성하지 않는 내장안 권장

후속 검토에서는 **단일 명령 offer의 불변 typed delegation 내장**을 권장한다. 이는 기술 후보의 내부 정본 선택 제안이며 새 인증 의미의 채택을 뜻하지 않는다. 위임 자체에 offerRef를 포함하지 않아 hash 순환을 막는다. 원 command와 내장 위임 전체를 offerRef.contentHash에 결박하며, 별도 entity가 없는데 delegationRef를 만들어서는 안 된다.

조회는 installationId/projectId/offerId의 원행에서 exact version/contentHash를 검사한다. 최신 대체·등록별 pending 선택0이다. 후속 NativeReceiveCommandBinding·ARM·issuer·delivery·ACK·current·consume·local SIGN은 동일 offerRef와 원 내장 위임을 명시 검산한다. 불변 snapshot과 회수/만료/취소 사건·head는 구분한다. 독립 위임 재사용·독립 수명은 이번 단일 명령에서 필요성이 확인되지 않았다.

현재 r1과 위 후속표의 delegationRef 문구는 아직 수정되지 않았다. r2 구성 시 이 정본에 일관되게 통합해야 하며 **서로 다른 표를 이미 일치한다고 판정하지 않는다**.

commandHuman은 현재 HUMAN controller, recipientHuman은 원 등록/session, writerHuman은 실제 유효 writer head의 주체다. commandHuman.userId와 recipientHuman.userId는 같아야 한다. 위임은 두 client/control의 직접 동일 관계만 대체하며 원 등록 내부 키/client/scope 정합·원 session/정책/DENY·현재 명령의 제어/승인·물리 증거를 보존한다.

전용 목적 reader/current wrapper는 options→issuer→host current/consume→local SIGN의 최소 원등록 projection과 현재 위임/offer 상태를 전달해야 한다. 일반 HUMAN GET 전체 권한을 제공하거나 basis.current=false를 무시하지 않는다. 기존 exact SIGN frame에 필드를 슬쩍 더하지 않고, 새 목적/version의 위임 typed frame을 명시 검토해야 한다. writer head가 모바일 현재 주체에 유효하지 않으면 수신 위임만으로 고치지 않으며 별도 미충족 선행으로 남는다.

### 2. 단일 계상식 권장

새 수신 목적의 별도 actual/held 소계를 같은 account 잠금 아래 추가하는 안이다. 기존 ARTIFACT/CHECKPOINT 예약기의 operation을 이미 지원된 것처럼 사용하지 않는다.

총점유 = U + H + O + N + R + Q

- U/H: 기존 used/held.
- O: 아직 U에 없는 기존 정의·환경 등 소계.
- N: 기존 native authority/events의 actual canonical bytes.
- R: 새 수신 기록 actual canonical bytes. 예약/head 원문 자체도 포함.
- Q: 아직 저장되지 않은 수신/native lifecycle의 미래 예약 bytes.

R/N actual 저장과 Q의 같은 bytes 감소를 동일 Tx로 처리한다. collector는 R/Q의 완결성을 검사하고 R을 U에도 넣어 다시 계산하지 않는다. 기존 native capacity를 포함한 관련 guard는 같은 합계식을 소비해야 한다. COMMIT불명/미정착IO/terminal부재에서Q를자동해제하지않는다. 확인된내구정산만hold→actual로전환한다.

### 3. 조건부 행·byte 표

아래는 exact schema가 이 상한 안에 들어간다는 증명을 아직 하지 않은 **제안 예산**이다.

| 묶음 | 제안 row | 제안 canonical bytes |
|---|---:|---:|
| window/session·bootstrapchallenge/소비·고정replay·profile관측·시작/종료사건·예약/head | 18 | 64KiB |
| offer command+내장위임·ARM·binding·ACK·고정replay·lifecycle/terminal·예약/head | 18 | 2MiB+64KiB |

window 하나에 k≤50이면 rows=18+18k, bytes=64KiB+k×(2MiB+64KiB)라는 조건부 계산이다.

- k=31: 576row, 67,108,864bytes = 정확64MiB.
- k=50: 918row, 108,199,936bytes = **103.1875MiB**. Primary의 최초105.1875MiB는 Main의순수정수계산으로정정했다. 제품시험결과가아니다.
- 따라서 개수상한50은최대크기50개보장이아니다. 누적actual+미생성예약+신규필요가10000row/64MiB·프로젝트10GiB에들어가야만admission한다. 실제작은command는고정미래비와함께실제크기를예약할수있으나과거누적량만큼수용량이줄어든다.

이 숫자에는 exact schema/최대phase/사건수·command/receipt/audit·challenge/replay·profile highwater의모든저장비용이포함돼야한다. actual예약/head를actualrow와미생성slot에중복계산하지않는다. 기존native lifecycle의별도추가row/bytes/terminal도Q에선예약해야하며현재그최대식은미정이다. 기존native10000/64MiB분모와수신분모를혼합하지않는다. 원문최대2MiB+위임8KiB등각한도를실제원형이만족하는지확인전표를인수기준으로확정하지않는다.

### 4. frame 권장 경로

authority 원문을 비밀 frame에 넣지 않고 새 등록키 수신 목적의 **정확 offer/authority 고정 보호조회**로 먼저 검산하는 안을 권장한다. frame에는 header/type/version·exactoffer/binding/authority/ATTEMPTED refs·기존metadata6·별도opaque43만넣는다. 원authority2MiB상한은줄이지않고조회wrapper의총한도를별도파생한다. native bearer 최초인증순환을만들지않는다.

frame64KiB는새제안상한이며정확UTF8최대대수의증명전확정값이아니다. header/부분수신/거절bytes까지window누적100MiB에계상하고buffer4MiB는순간상한으로분리한다. 할당전길이검사·닫힌종류/순서·중복delivery/재연결기산0을고정해야한다.

### 5. 재검토 진입 조건

다음까지닫힌후r2를작성·재검토한다: 내장위임과offer/binding/current·frame의exactschema,초기수신준비/nonce원형·허가caller,record/event/replay최대수·native예약대수·collector완결,Tx/CAS/ACKterminal동일저장접점,고정보호조회·frame총상한. 기술대안을정리한것이며Important9해소/후보채택/제품구현으로승격하지않는다.


## 기존 native typed 예약 상한의 한정 정적 검증

이 항목은 제품·DB·시험 실행이 아니라 기존 source/SQL 읽기와 순수 정수·canonical 문자열 길이 계산이다. 기존 Primary의 산출 뒤 Reviewer가 독립 대조해 **4,249,198 canonical bytes·17 slots의 안전한 보수 예약식은 성립(C0/I0)**한다고 확인했다. 전체9지적해소/새수신원형채택/실DB검증이아니다.

### 계산 범위와 보수치

- 일반 fullref는 **153bytes**, version1 ref는138bytes다. 초기 Primary의152bytes는정정한다.
- writerSubject232, HUMAN actor259, REGISTERED_HOST292, SERVER191, 고정 target266bytes.
- ref를일반153으로넓혀계산하면receipt wrapper1533, CONSUME event wrapper3409bytes다. 앞1518은외부ref만version1로좁힌보수치이며서로다른가정의값이다.
- UUID/hash/닫힌ASCII목적·reason·nonce/base64url·고정UUIDpath·ISO24의폭과escaping을포함한다. 자유문자열은확인되지않았다. authority/intent의sourceScopes는각snapshot2MiB상한에포함된다.
- 종류별앞산출값(예:CONSUME3349)은가정별보수치가섞여있어정확실제최대라고표시하지않는다. 모든parser경계를안전하게덮는event3409를예약식에쓴다.

actual INSERT canonical_bytes는authority의경우 {ref,snapshot:authority,preparationRef,preparationIntent:intent}, event는{ref,snapshot}이다. intent누락·event snapshot의이중계상은하지않는다(native-preparation-store.ts:13~15·SQL0071:102~110).

예약식:

2×2,097,152 + 350 + 16×3,409 = **4,249,198bytes**

authority1행+event16행으로17slots이며이벤트16을임의6으로줄이지않는다. CONTEXT_INVALIDATED는단일kind unique가없어전체16한도를유지해야한다. 이계산은새ACK/위임/nonce·command/receipt/audit·물리DB파일/열/인덱스저장량에는적용하지않는다.

중요경계: SQL0071:6의authority행canonical_bytes는4MiB이하다. 두snapshot독립상한+wrapper의4,194,639라는수식전체가그대로저장가능하다는뜻이아니다. 실제저장행기준의더작은상한은4,194,304+16×3409=4,248,848bytes지만제안예약4,249,198을안전과대로유지할수있다. 기존DB상한을늘리지않는다.

### 수신/기존 native 분모는 별도 검사

session-first·nonce/replay를포함한새조건부R예산은base128KiB/27row+offer당(command실제bytes+128KiB)/38row다. 최종command2MiB일때R만계산하면k30=63.875MiB/1167row,k31=66MiB/1205row,k50=106.375MiB/1927row다. 앞18row/offer·k31=64MiB는이전표가정이며수정표의확정값이아니다.

N/R미생성예약을각분모에함께반영해야한다. 매offer에N최대4,249,198bytes를예약하는조건이라면빈native64MiB분모는15개까지다. k15에서는R=33,554,432bytes,N=63,737,970bytes다. **R의30개나N의15개는정상작업가능보장이아니다.** 현재writer/head/source·기한·정책·과거누적상태와각실제원형·command/receipt/audit비용을모두검사해야한다. 원명령값에서엄밀히산출한더작은Nfuture를사용할수있지만상한/검사기준을임의축소하는것과구별한다.

Nactual증가와Q미생성예약감액은동일Tx다. UNKNOWN·COMMIT불명·미정착IO로Q를자동해제하지않는다. 원래일반4MiBevent×16의68MiB초과는typed필드정밀계산으로해결가능한하위지점이며B01/B02전체/신규R대수는미해소다.

### 최초 proof의 목적 분기 보완

후속원형의phase=CHALLENGE만으로OPEN/STATE용을구분하기부족하므로서명대상에명시 requestedPhase를두는안을권장한다. CHALLENGE/OPEN요청은session/window null, CHALLENGE/STATE요청은exactsession·결박상태별window를받는다. 응답targetPhase와원요청hash가일치해야한다. 실제OPEN/STREAM/STATE요청의requestedPhase는null이다. STREAM용nonce는OPEN응답에서발급하며CHALLENGE의임의추가목적으로넓히지않는다. 같은STREAM ID를재조회해새연결/비밀replay를만들지않는다.

이는미채택proof설계보완이며새publicwire·helperpurpose·전용권한·실행을허용하는결정은아니다.


## ARM/ACK 목적별 원형과 원 operation 소유의 교착 보완

계산용 미채택 원형은 docs/contracts/FN06_NATIVE_RECEIVE_ARM_ACK_SCHEMA_TECHNICAL_DRAFT_20261103.md SHA9C9424591EAB32C52A36482089C4B53CEBB364CFDBD2034FE367E81EE1BCC851로 별도 보존한다. 원r1을바꾸지않았으며새공개wire/helperpurpose·실제실행채택이아니다.

ARM은authority생성전의exactoffer수신준비이고body/proof/challenge/receipt를목적별로분리한다. 아직없는binding/authority/ATTEMPTED/deliveryID/commitment는field자체가없다. ACK는그참조들이이미존재한뒤실제opaque43수용commitment와원nativeCallExpiresAt에결박한다. ACK원장/서명/HTTPJSON에는opaque원문이없다. bodyHash는proof/signature를포함하지않아자기참조를만들지않는다.

새원형의중요실현성검토에서Main이원#deliverPrepared호출순서와AckResponse의교착가능성을제기했고Reviewer가인정·최소보완했다. 기존코드는supplier반환뒤원operation이terminalTx를실행하므로supplier가ACKHTTP성공을기다리고endpoint가terminal을기다리면교착된다.

권장순서:
1. 원operation이authority/offer/소유stream/원ATTEMPTEDtuple·원10초에결박된비공개ACK대기를소유한다.
2. supplier는전달최대1회후HTTP응답이아닌검산된비공개ACK후보를기다린다.
3. endpoint는인증·원행/nonce/원기한을짧게검사한뒤살아있는정확operation에immutable후보를전달한다. 프로젝트/DB잠금이나Tx를유지한채후행작업을기다리지않는다.
4. 원operation이후행Tx에서원행/현재성/기한/유일성을재검사하고ACK증거·nonce소비·DELIVERY_CONFIRMED·대응offer terminal을같이저장한다.
5. COMMIT성공확인후에만ACKendpoint와HUMAN응답을완료한다. 전송flush유실은저장사실을바꾸지않는다.

이는기존supplier CONFIRMED/ackRef를그대로내구성공으로해석하는것과다르다. **module-private ACK후보결과형/소유대기포트와원terminalTx소비의내부변경이필요**하며기존코드그대로연결가능하다고표시하지않는다. 후보ackRef는미리ID/hash를계산해도저장전공개응답/current/허가에노출하지않는다. 기존v1parser/authority를느슨하게할필요는없다.

원operation부재/종료는닫힌거절이며endpoint가새terminaloperation을대신시작하지않는다. 중복ACK동일원문은같은진행/원저장결과만,다른증거는충돌이다. rollback/COMMIT불명은내구ACK성공이아니다. handlerdeadline/HTTP단절은응답대기자만분리하며원operation의미정착IO소유·원기한을유지한다. 기한뒤새후보/Tx/성공시작0·이미진행된COMMIT불명은보존한다.

보호current/wrapper는저장ACKref와terminalref의원자적관계를확인한경우만전달완료근거로쓴다. 검산후보수신은CURRENT/CONFIRMED근거가아니다. 상태조회는후보ID를권위로인정하거나원operation재생성·재전달·terminal부재의미전달확정을하지않는다.

이보완은B04/B06의실현성을구체화한미채택설계이며지적해소/런타임교착시험PASS가아니다. Primary가exactARM/ACK원형으로새R대수를다시계산중이고8KiB묶음/58row/192KiB예산은아직확정하지않는다.


## ARM/ACK 원형의 조건부 바이트 독립 대조 결과

보완자료 최신 SHA **40030CE6F8ED11AF7D158B16B1DDB4547549B23EA45EE83DED7624BDEDBB124B**. 같은Reviewer는원형/교착보완과직접문자열길이계산을독립대조해ARM7980/ACK9619bytes의3행묶음·별도ARMreceipt1361/ACKrecord2245의조건부상한에불일치없음C0/I0를반환했다. 후속항목별표의산술도58행·command외140942bytes·192KiB여유55666으로일치했다. 자료시작끝SHA동일·제품시험/DB실행0이다.

이판정은다음조건을닫은전체lifecycle예산증명이아니다.
- replay10행이STATE8+ARM1+ACK1만뜻한다면각challenge의nonce/requestId/원결과·소비상태가이미계상한challenge/evidence/사건에완결돼야한다. 별도행이필요하면추가한다.
- 취소·만료·회수·stream단절·COMMIT불명까지사건12행내에모두들어가는지미증명이다.
- 기존ATTEMPTED/terminal과새offer사건이별도저장되면각실제행을N/R에계상하고같은행을중복계산하지않는다.
- 원응답을행에서재구성할수없어별도응답보관이필요하면그비용도추가한다.
- L권한명령/receipt/audit·승인소비,receiverPrincipal,실endpoint/closedenum,frame/위임helper전송총한도는별도조건이다.

원후보r1 F301A7B86EE0CE721F18B2872D69DA2B2FEE8437D5E41C649026388833D07176는불변이다. **기술검토REWORK/Important9미해소·source/실행GO0를유지한다.** 기술적하위질문의답을얻은것과새인증/권한·공개wire·저장계약을채택하거나기능을완료한것은구분한다.


## 필수 replay 행과 공통 권한 원장 L의 추가 검토

### nonce 소비·원 결과 완결

Primary의실제전이검토는앞session26/window9/offer58·event12를확정상수로쓸수없음을확인했다. challenge한건에는최대다음5행이필요하다.

- 발급Tx: SignedChallengeRequest evidence + ChallengeSnapshot + **challenge-request replay** = 3행.
- 최종proof처리Tx: proof evidence + **nonce-consumption/replay** = 추가2행.
- 동일원결과재조회는추가행0이며다른본문/다른ID nonce재사용은충돌이다.

앞표의challenge1/evidence2/replay1은서로다른두요청의replay를합쳐세어1행누락됐다. challengeRef소비unique와불변소비replay를원결과ref/hash에결박해야한다. challenge원문을mutable소비표시로바꾸거나COMMIT불명에서미소비를추정하지않는다. 유효proof의거절도nonce를소비할지와그원결과원형은아직선택이필요하다.

이미존재하는SessionSnapshot/WindowSnapshot/OfferSnapshot/ArmReceipt/CommandBinding/AckSnapshot·기존N사건을전이의불변근거로쓰면같은R사건을기계적으로복제할필요는없다. head는현재투영이며전이근거ref를추적할수있어야한다. 단순UNKNOWN/응답유실/재시작은가짜terminal행을만드는근거가아니다.

session/window/offer각첫terminal의상호배타branch,stream결박·단절사건,terminal뒤원무효화의보존목적/횟수를닫아야한다. window종료시offer50개를각종료한다면각offer에원종료행/정산여유가예약돼야한다. STATE원요청replay는당시의정확불변전이/head근거와관측시각으로재구성해야하며나중최신상태를원결과라고반환하지않는다.

필수slot식은기본snapshot/head/예약 + 발급challenge별3 + 소비가능challenge별추가2 + 의미적으로필요한결박/종료행이다. 발급시최대5행을먼저예약하고actual행생성에맞춰future슬롯만감액한다. STATE횟수·CLOSE인증·terminal뒤무효화규칙을닫기전전체정수row상한은미증명이다.

### 공통 L 계상은 기존 U가 자동 지원하지 않는다

Reviewer는project-command.ts:114~120/128·project-approvals.ts:64~67·0059:249~270·0071:181~182를읽기대조했다.

- native 성공commands.result_ref에는최종ProjectCommand전체commandSnapshot과preparationIntent전체가복제된다. 이를임의제거해비용을줄일수없다.
- authorization_receipts·성공audit·approval consumption/원request상태변경과별도거절audit경로는각각실제저장비용이있다.
- C=canonical native command bytes,I=canonical intent bytes일때현재result_ref만의부분상한은C+I+657이다. C/I각2MiB면4,194,961bytes이며전체command행·receipt/audit/승인소비는추가다. app.ts의2MiB요청body상한을성공result/응답상한으로해석하지않는다.
- 0059는정해진SETTLED reservation의settledBytes로U를증가시키고reservation합계와일치를검사한다. 공통receipt함수에는L자동가산이없다. 기존nativeL이U에포함된다고가정하거나U를직접늘려quota_complete를우회할수없다.

Lnative는명시canonical command행projection(result_ref포함)+authorizationreceipt+성공audit+승인시consumption/계상대상상태변경으로정의해야한다. 승인요청/별도결정명령의command/result/receipt/audit와승인원문은별도L이다. 같은내용도다른실제행에복제되면각각계산한다. 같은저장행을R/N/U에중복계산하지않는다.

새window/offer/cancel/close의payload/성공·replayresult·operation/reasonCode·approval원문상한과Lprojection·reservation/정산·완결guard를닫아야한다. rawreason의UTF8/JSONescaping을길이와동일시하지않고거절반복·UNKNOWN의비용도누락하지않는다. 제품/실DB·권한변경을실행해확인한결과가아니라source범위의계약검토다.

## 현재 작업 범위

기존Primary는이결과들을새r2 **미채택통합초안문서**로정리한다. 원r1/제품/SQL을수정하지않고미정·의미선택·source-only채택필요delta와닫힌기술하위증명을분리한다. Main은검수·통합,Reviewer는기채택범위와실제새승인경계의한정대조를담당한다. 새agent/세션/제품writer·실키/DB/권한/서비스/Agent/네트워크·시험실행0이다.


## 기채택 내부 구현과 실제 새 결정의 경계

Reviewer는원native r2 A 계약/승인과trust r5 A 계약/승인을한정대조했다. **보호공급자부재라는이유만으로전달/ACK/전용HTTPS전체를새승인항목으로만들지않는다.**

| 분류 | 근거 | 적용 |
|---|---|---|
| Main내부구현선택 | native r2 §5:57~63·§7:86~90·§10.3:139~147,승인기록:13 | 채택된의미를보존하는행배치·snapshot/head·hash순환방지·동일Tx/CAS·불명guard·정적대수는재승인불필요 |
| 기채택공급자소스상세 | native r2 §5:61~65·§10.3:141,trust r5 §6:122·§7:138 | 고정HTTPS·원등록P256키·별도NativeOnly비밀·최초전달1회·CONFIRMED/UNCONFIRMED+ackRef는기채택. tuple/목적/주체/수명을바꾸지않는concretesupplier연결은내부구현 |
| 새권한/주체관계 | r2§5:57의현재HUMANcontroller와실제registrationreader/hostcurrent의동일client/control검사대비r1§3/4 | controller와다른PCrecipient의prelisten·단일명령crossclient위임은새인증관계 |
| 새publicwire·키서명의의미 | r2§10.2·§5:65·trustr5§6의기존닫힌목적대비r1§6/7 | bearer없는bootstrap/session/ARM/ACK endpoint·새proofdomain/helpercaller/replay원장은별도계약. 기존키를사용하는사실자체는재승인대상이아님 |
| 혼합범위 | 기존r2의profile/보호전달/ACK대비r1§7/8 | 고정origin/CA검산supplier구현은기존범위. 새profileenvelope발급·회수/후퇴권위,새ACKproof/내구증거·외부조회는새의미 |
| 새지속/계상대상과내부계산 | r2§7의native2표/기존분모대비r1§9 | 무엇을새로저장/계상하고포화시무엇을거절하는지는새지속계약. 그결정아래canonicalprojection/행배치/중복제거/최대식은Main기술책임 |

필요한사람결정은같은사용자·정확프로젝트·살아있는원등록/session의단일명령위임을중심으로위새권한/새서명wire/증거저장·수명/회수·계상의최소묶음이다. 실제키/CA·DB/권한·서비스활성화·배포/실행,다른사용자/옛session복구·범용기기권한·writer소유전환은제외한다. 모바일에유효하지않은writerhead는수신위임승인으로해결된것이아니다.

원승인의source-only/실효과제외는이미명확하다. r2승인기록:7,13~15와trust승인기록:13~16의코드/화면/미적용SQL/합성검증범위·Main상세파일고정권한을다시승인받지않는다. 단위해당내용이새의미에의존할때만그새의미를먼저결정한다.

현재Primary의r2통합초안은이경계를분리하는문서작업이다. 원r1/제품/SQL을바꾸거나새의미를채택하지않는다. Main은재승인범위를부풀리지않고,기술적으로미완결인내용을실행가능한승인요청으로포장하지않는다.


## R2 통합문서 반환·독립 정합 검토

새통합후보: docs/contracts/FN06_NATIVE_RECEIVE_DELEGATION_DELIVERY_CANDIDATE_20261103_R2.md.
최종SHA256 **85F8F15EDA74ED0530980A5B4C3706426860174987A7436348D0D82AAA7A441D**,39,755bytes. 두정본동일·UTF8/LF/끝개행1개·16절이다. 중간보고E299CDEE는마지막L_out/prelisten accounting보완전지문이며최종검토는85F8F15E에만적용한다. 기존Primary는문서writer를반환했고Main/Reviewer의같은경로쓰기0이다.

Reviewer독립검토는두축으로판정했다.
- **A: 문서정합C0/I0.** 기채택범위와새의미분리,내장위임/no가짜ref,비공개ACK후보/HTTP응답순서,challenge발급replay누락/5행식,미계상L_out·prelisten accountingcaller,조건부표철회,모바일writer/helperframe미충족이후속근거와일치한다. 시작끝/정본-sourceSHA동일이다.
- **B: 채택·구현GO준비미완료.** ReceiverPrincipal/전용reader·prelisten목적허가/accountcaller,localIPC/명령·상태·오류/발견원형,nonce거절소비/CLOSE/STREAMnonce/STATE재구성·rate/cap,profile발급/slot→helper실제근거,ACK소유port/current관측exactschema,R/N/Lregistry/예약정산·모든guard,고정조회/binary/helper총상한과writer선행이필수미정으로남는다.

원r1과R2모두DRAFT/NOT_ADOPTED/SOURCE_GO0/EXECUTION_GO0이며문서정합판정을Important9해소로쓰지않는다. 제품·SQL·시험·실키/DB/권한/서비스·Agent/네트워크변경·실행0이다.

### 새 설계 방향에 대한 최소 결정 요청

Main은PMO에완성계약/실행승인이아닌**새의미의설계방향**결정을요청했다. 권장A는같은사용자/정확프로젝트/살아있는원등록session에한정해현재controller와다른PCrecipient의유한prelisten·정확단일명령위임을허용하는방향이다. 이를증명하는새인증purpose/publicwire·profile권위·증거저장/계상을기술적으로닫아야한다. 대안B는현재동일client/controller계약을유지해cross-client수신설계를보류하는것이며모바일원격흐름은미충족으로남는다.

A의새인증/원장표면과보존책임을명시했고source비활성복구와향후실제발급/저장후완전원복불가를구분했다. 실제키/CA·DB/권한·서비스·배포/Agent실행·다른사용자/옛session복구/범용기기권한/writer전환은제외했다. 기존HTTPSsupplier/P256/전달1회/ackRef·내부Tx/guard·계산은이미승인된상세라다시승인받지않는다. 이요청만으로어느방향도채택되지않는다.

Main은PMO의다음작업배정을기다리지않으며새설계의미결정과무관한증거/기술정리를진행한다. 구현GO나사용자답변을시간경과로추정하지않는다.
## B04 한정 후속: ACK 후보와 내구 결과의 분리

기존 Reviewer의 읽기 검토를 Main이 project-native-preparations.ts:89~94,109~113과 대조했다. 최소 접점은 supplier 결과(112)와 원 후행 Tx(113) 사이이다. ATTEMPTED의 COMMIT 확인 후에만 단발 공급자를 호출하는 기존 조건과 원 deadline을 유지한다.

내부 제안은 원 operation이 소유하는 AckOwnerPort(waitCandidate/submitCandidate/settleCommitted/settleUnknown/close)다. 검증 함수만 발급하는 비공개 후보를 supplier가 받고 반환하며, HTTP 응답 대기는 별도 submission으로 분리한다. 원 offer/authority/ATTEMPTED/stream instance/deadline에 결박하고 잠금을 보유한 채 ACK 응답을 기다리지 않는다. 기존 supplier 전체의 CONFIRMED 의미를 바꾸지 않는 별도 내부 branch가 필요하다.

원 후행 Tx에서 후보·nonce·현재성·기한을 재검산하고 ACK/소비/CONFIRMED/offer terminal을 함께 저장한다. callback에서 응답 완료를 알리지 않고 #hostRun의 COMMIT 및 후행 check까지 성공한 뒤에만 내구 결과를 알린다. COMMIT 오류 또는 COMMIT 후 검사 실패는 미저장·rollback 성공을 추정하지 않는 불명으로 취급해야 한다. 현재 코드가 이 새 ACK 원형/port를 이미 구현했다는 뜻이 아니다.

고정 내부 결과 후보: operation 부재 OWNER_UNAVAILABLE(재생성/전송0), 다른 후보·tuple 불일치 ACK_CONFLICT, 원 기한 경과 ACK_DEADLINE(새 수용/Tx0), COMMIT 관측 불확실 OUTCOME_UNKNOWN. 동일 후보는 원 submission/저장 결과만 반환하고 재전송하지 않는다. HTTP 연결 종료는 응답 대기자만 분리하며 원 작업/미정착 IO 소유를 없애지 않는다. 늦은 정착의 오류·버퍼 회수는 관측하되 성공/새 IO로 승격하지 않는다.

이는 B04의 내부 연결 위치를 좁힌 기술 제안이다. 공개 ACK 인증/proof/저장 원형·전용 current 결과는 새 계약 결정에 의존하며 B04 전체나 Important9를 해소한 판정이 아니다. 제품 코드·시험·실행 변경0이다.
## B04 후행 현재성 검사와 COMMIT 결과의 한계

기존 Reviewer는 project-native-preparations.ts의 #access:48(OWNER/현재 controller), #readPolicy:49(읽기 명시 정책), #registration:96(원 등록·키·세대/상태·기한), #freshHost:97(RESERVED writer/head·선택·원 쓰기정책·source current·최소기한), #hostRun:91~94 및 후행 callback:113을 대조했다. Main도 앞 단계에서 동일 source의 진입/COMMIT/후행 흐름을 확인했다.

ACK 후보 수용 전 검산은 잠정 관측이다. 후행 Tx에서 원 ATTEMPTED/deliveryId/terminal 부재뿐 아니라 후보의 offer/binding/session/window/stream·nonce·원 proof 관계를 다시 검사해야 한다. 후보의 과거 verifiedAt을 현재성 근거로 재사용하지 않는다. callback 뒤 COMMIT 직전에는 DB 시각·authority 기한·등록·operation check가 있으나 #freshHost 전체가 다시 호출되는 것은 아니다. COMMIT 뒤에는 budget/operation check만 있고 DB 전체 현재성 재조회는 없다.

따라서 내구 결과는 '검산된 ACK/terminal의 COMMIT 확인'으로만 표현한다. COMMIT 직후 회수와 경합할 수 있으므로 지금 사용 가능·미래 회수 없음·factory 실행 허가로 해석하지 않는다. 역사 CONFIRMED 보존과 실제 SIGN/consume 직전 fresh current는 별개다. COMMIT 성공 뒤 budget check 실패도 응답 불명으로 남기고 미저장으로 추정하지 않는다.

최소 private 후보 결박안은 원 owner/stream/deadline의 module-private 객체 동일성, authorityRef/offerRef/bindingRef/receiveSessionRef/windowRef/deliveryAttemptRef/deliveryId, ackRequestHash/proofEvidenceHash/recipientNonce/opaqueCommitment다. recipient/profile/command tuple은 원 offer/binding에서 복원해 비교하고 caller의 중복 선언으로 권위를 만들지 않는다. exact ACK body/proof/signature는 불변 후보 자료로 검산하되 opaque 원문은 넣지 않는다. 새 공개 인증/위임 reader/current wrapper 원형은 미채택이다. 읽기 설계 결과이며 제품 동작/시험 PASS가 아니다.
## B05 한정 후속: 취소와 원 command 결박 경쟁

기존 Primary가 현재 authenticated transaction/replay/receipt/writer/native store 접점을 읽기 매핑했다. Main은 access/project-command.ts:100~104와 project-native-preparations.ts:79~86을 대조했다. 현재 인증·제어·정책 뒤 projectReplay가 원 requestHash를 검사하고 기존 결과를 반환하므로, replay에 ARMED를 다시 요구하거나 credential/예약/전송을 재생성하면 안 된다. 신규 분기만 원 options/current 앞에서 정확 offer/head를 잠그는 내부안을 권장한다.

취소와 신규 binding은 같은 인증→project/member→control→policy→offer/head→필요 window/session→후속 writer/account 잠금순서를 공유해야 한다. account를 먼저 잡고 offer를 기다리는 역순은 만들지 않는다. 전체 시스템 deadlock 부재나 새 ReceiverPrincipal 경로의 잠금 정합이 이미 증명됐다는 뜻은 아니다.

잠긴 ARMED head의 정확 version/마지막 불변전이·binding/terminal 부재·offer/최종command 전체hash·project/actor/승인·recipient/profile/window/session·기한/회수·기존 writer/source를 검사한다. 같은 Tx에서 원 command/receipt/audit/승인소비, writer RESERVED, authority/CREATED, CommandBinding, COMMAND_BOUND 전이/head CAS, 예약정산을 완결한다. CAS 영향행1 및 양방향 ref/hash가 불일치하면 전부 rollback하고 별도 중간 COMMIT은 두지 않는다.

offer/authority/server command마다 binding1개, binding의 project/원 parent·command/receipt/audit 일치가 필요하다. 새 위임 분기의 authority/command에 binding이 정확1개인 역완결도 필요하다. 기존 v1 authority 전체에 binding을 소급 요구하거나 evidenceRefs 존재로 새 분기를 추정하지 않는다.

cancel COMMIT 선승이면 binding 없이 CANCELLED·신규 발급0; binding 선승이면 COMMAND_BOUND/authority/binding을 보존하고 cancel 성공으로 표시하지 않는다. 원 COMMIT 불명은 exact command/offer association 조회만 허용하고 재발급·재전송0이다. rollback 요청 성공을 앞선 COMMIT 미적용 증거로 쓰지 않는다. 같은 command/hash replay는 현재 접근 후 원 결과·원 binding만 반환하고 다른 hash/이미 결박된 offer는 충돌이다. window 종료·stream 단절로 이미 결박된 원 사실을 취소나 미전달 확정으로 바꾸지 않는다.

새 위임 분기 식별·offer 선택 입력, cancel operation/정책·정확 요청/결과/replay, 제어 변경 뒤 과거 조회 접근, ReceiverPrincipal 잠금·정산 권한은 새 계약 의존이다. 기존 ProjectCommand에 offerRef가 없다는 이유로 임의 필드를 추가하거나 최신 pending을 자동 선택하지 않는다. 이는 B05 내부 기술안이며 전체 해소/소스 구현 GO가 아니다. 제품·문서쓰기는 subagent0, Main의 본 검토 통합 외 코드/SQL/시험/실행0이다.
## B06 한정 후속: 외부 기한과 실제 IO 정착의 소유

기존 Reviewer가 #deliverPrepared:109~113/command:86/nativeWorkBudget:33~38을 읽었고 Main은 budget:33~38을 대조했다. delivery supplier의 finally는 deliveryOpaque 복사본을 supplier 정착 후 소거하지만 timer의 abort/race 종료만으로 pending supplier가 정착하지 않는다. 원 command finally의 pendingCredential.token 소거와 별도 deliveryOpaque 복사본 회수는 구분해야 한다. immutable token ASCII 문자열은 Buffer.fill로 완전 소거됐다고 주장할 수 없다. supplier의 추가 복사본도 이 코드의 소유 범위 밖이다.

DB는 own의 pending query 추적·settle 실제 정착 뒤 rollback/release를 유지한다. wait/close는 외부 대기 종료·새 작업 차단이며 실제 IO 정착 증거가 아니다. budget controller와 delivery controller는 별도이고 budget.close가 delivery controller를 직접 abort하지 않는다. 현재 원 operation에는 HTTP socket 단절 신호의 직접 결박도 없다. 단절을 취소/미전달/DB 정착/완전 회수로 표시하지 않는다.

필요한 내부 제안은 OwnedDelivery{requestAbort,result,settled}다. 원 operation이 exact stream instance·전달 복사본·supplier Promise·원 deadline을 소유하며 외부 result와 내부 실제 settled를 분리한다. timeout/종료는 abort 요청·새 IO 차단만 수행한다. supplier/하위 write 정착 후에만 buffer/listener/handle을 회수하고 그 전 재사용·완전 정리 주장을 하지 않는다. HTTP 응답 대기자 소멸과 delivery 취소는 다르며 네트워크 대기 중 불필요한 DB lease를 잡지 않는다. 이미 시작한 DB query의 실제 settle 보호는 유지한다.

현재 delivery에 options의 pendingOptionsSuppliers와 같은 별도 미정착 추적 port가 없고 실제 stream producer/consumer도 없다. 하위 write/drain/close·취소 보장은 미검증이다. 이는 향후 source 구현의 내부 소유 요구를 구체화한 읽기 결과이며 B06/보안·실행 검증 PASS가 아니다. 실제 비밀 바이트 조사·키/DB/권한/서비스/Agent·네트워크·모듈/시험 실행0이다.
