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
