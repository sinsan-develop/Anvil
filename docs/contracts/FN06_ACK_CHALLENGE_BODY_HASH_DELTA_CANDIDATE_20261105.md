# FN06 ACK challenge의 실제 body hash 입력 보완 후보

- 상태: DRAFT / NOT_ADOPTED. ACK delta SOURCE_GO0. 2026-11-05 Main 어울.
- 기존 FN06 source-only 채택과 다른 phase 구현은 계속 유효하다. 이 문서는 ACK 공개 exact 입력의 미결만 다루며 실제 DB/권한/키/서비스/Agent 실행 승인이 아니다.
- 부모 채택 패킷 SHA256: 682A51DACA51FAD9525B4DB34AB62DCDD99B0D5DC63A2B1BCA1ACC211F2CA24E.
- 부모 wire SHA256: 6D1A727FB60298C4ADCC37CE5066B4032F144E6F42B8A0B74F023D8AF56E83F4.
- 부모 계상 SHA256: F8667E17830B60791D769A288EC77C82E34649A952BFF9FAF4AE688BB32C1597.
- 세 부모 원문은 수정하지 않았다. f4a6e3에서 현재 hash를 대조했다.

## 1. 확인된 입력 공백

기존 challenge 요청은 schemaVersion/requestId/phase/offerRef/armRef/deliveryRef/authorityRef/commandHash의 exact8키다. 실제 ACK body는 schemaVersion/windowRef/armRef/deliveryRef/authorityRef/commandHash/slotReceipt의7키이며 slotReceipt는 실제 V<SlotReceipt> 전체다.

wire185/198~204에 따르면 receiptId·acceptedAt 등을 가진 SlotReceipt는 실제 local slot의 정상 단발 수용 뒤 같은 원 main 수신 instance에서만 생산한다. challenge8키에는 이 receipt나 전체 ACK body commitment가 없다. 서버가 다른 기존 필드만으로 실제 ACK bodyHash를 정할 수 없다. nonceDigest만 서명하거나 fake receipt/acceptedAt·null/빈 placeholder bodyHash로 바꾸는 것은 부모의 실제 method/path·정확 bodyHash 결박을 약화한다.

이 문서의 미결은 ACK target 생성에 한정한다. STREAM/ARM/STATE/CLOSE는 현재 필드로 target body를 결정할 수 있어 기존 승인 source 구현을 중단시키지 않는다.

## 2. A안 — ACK에만 전체 body hash commitment 전달

제안은 ACK phase의 challenge 요청에 ackBodyHash:Hash 한 필드를 더하는 것이다. Hash는 기존 canonical SHA-256 규격의64자리 소문자 hex다. ACK는 exact9키, 다른 허용 phase는 기존 exact8키를 보존하고 ackBodyHash를 추가하면 거절한다. schemaVersion/이름/배포 호환 경계는 채택 시 이 후보의 확정 revision으로 고정하며 현재 v1을 몰래 변경하지 않는다.

ACK의 exact 요청 후보:
```text
{schemaVersion:1,requestId,phase:'ACK',offerRef,armRef,deliveryRef,authorityRef,commandHash,ackBodyHash}
```

ackBodyHash는 실제 slotReceipt를 가진 원 수신 instance가 기존7키 ACK body 전체를 canonical화한 hash다. SlotReceipt.ref hash만 보내는 것이 아니다. renderer/caller가 hash/current/receipt를 주입해 수용을 주장하는 경로를 만들지 않는다.

서버는 기존 session/bearer/current·phase/null표·원 offer/arm/delivery/authority/command의 실제 관계/기한을 검사하고, challenge.target의 method/path/queryHash는 기존대로 정한다. target.bodyHash에 이 commitment를 결박한다. 이 값만으로 local slot 수용·ACK 승인·nonce 소비·CONFIRMED를 판정하지 않는다.

실제 ACK에서는 기존 full body/SlotReceipt 전체·exact current·typed proof/서명·nonce와 실제 canonical bodyHash를 모두 다시 대조한다. commitment만 맞고 실제 receipt/current가 틀리면 거절한다. 기존202 CANDIDATE_ONLY/confirmed:false와 실제 원 operation 후행 Tx의 nonce 소비·불변 ACK·DELIVERY_CONFIRMED/정산 COMMIT 구분을 유지한다.

같은 requestId·같은 canonical9키의 재조회는 원 challenge만 반환하고 새행/nonce·기한 연장0이다. 같은 requestId에서 commitment 등 원문을 바꾸면 기존 충돌 의미로 거절한다. 실제 local receipt가 바뀌면 기존 challenge를 덮거나 재서명/새 nonce를 자동 발급하지 않는다. 기존 phase당1회 ACK와 nonce 간 목적 분리를 보존한다.

## 3. B안 — ACK challenge에 실제 SlotReceipt 전달

대안은 ACK challenge에만 slotReceipt:V<SlotReceipt> 전체를 더해 서버가 기존7키 ACK body를 구성·hash하는 것이다. 다른 phase8키는 보존한다. actual receipt/current를 검산할 시점과 signed proof 전의 관측/저장·복제·계상 경계를 별도로 닫아야 한다. receipt를 보냈다는 이유만으로 ACK를 소비하거나 원 operation을 완료하지 않는다.

Main의 초기 권장은 최소 데이터 전달로 실제 full body 결박을 유지하는 A안의 상세화다. 이는 사람 채택이나 비용/Tx 검수 완료가 아니다. 두 안 모두 기존 공개 exact 입력에 없던 변경이다.

## 4. 채택 전 반드시 닫을 상세

- IssueEvidence/IssueReplay/challenge의 실제 canonical projection에서 새 입력이 어디에 보관·hash되는지, 실제복제/held·상한 변화가 있는지 독립 계상 검토한다. 행수0변경이나 비용0이라고 미리 단정하지 않는다. 새로운 표·상한·timeout을 임의 추가하지 않는다.
- ACK challenge를 발급하는 시점의 실제 current/참조 가시성·lock/owner/broker 경계를 확인한다. 이 후보는 bodyHash 입력 공백만 식별했으며 원 operation 대기 중 발급이 실제로 가능한 Tx 프로토콜까지 증명한 것이 아니다. 원 operation DB lock을 잡고 ACK를 기다리는 순환·후행 COMMIT의 의미를 깨지 않는다.
- 실제 local SlotReceipt 생산→불변 body 구성→commitment→challenge→typed ACK proof→원 operation 검산의 호출선을 고정한다. 전달된 caller hash만으로 receipt/secret 수용을 대체하지 않는다.
- A안/정확 필드/phase별 schema·오류·재조회/충돌·비용 projection·코드 허용목록을 한 패킷으로 고정하고 독립 검토 후 필요한 사람 결정을 요청한다. 그 전 ACK delta 구현은0이다.

## 5. 채택 후 검수할 반례

정상 실제 receipt/body에서 challenge commitment와 최종 ACK hash가 같아야 한다. hash 형식/누락/다른 phase의 추가키, 같은 requestId의 변경 commitment, body/receipt/ref/acceptedAt 변조, stale current/다른 원 instance·wrong proof/nonce·deadline을 거절한다. 같은 요청 replay의 행/nonce/기한 증가0과 phase당 ACK1회,202와 실제 후행 COMMIT을 구분한다. 실제 receipt 없이 fake 성공값으로 통과시키지 않는다. 실제 PG/Slot/TLS·Agent 실행은 기존 제외를 유지하며 별도 실행 승인을 대신하지 않는다.
## 6. 독립 계상 검토 결과 — 기존 typed 상계 유지 조건

2026-11-05 담당 A가 기존 v1Ref138B·UUID36/Hash64/At24 및 SlotReceipt exact 원형에서 유한 산술을 도출했다. 새 임의 상한이나 PG 물리 크기가 아니다.

| canonical 대상 | bytes |
|---|---:|
| SlotReceipt snapshot / V | 1276 / 1434 |
| 부모 ACK challenge8키 | 770 |
| A안9키 | 851 (+81) |
| B안9키 | 2219 (+1449) |
| 최종 ACK7키 body | 2155 |

현재 phase producer는 ISSUE_EVIDENCE.requestBody에 전체 요청을 저장한다. record_json과 record_canonical 문자열을 함께 계상하므로 같은 나머지 필드에서 A안 IE 원행의 logical 증분은166B(81+85), B안은3012B(1449+1563)다. 문자열 escaping 추가 quote가 각각4/114개인 조건을 포함한다. Challenge.target.bodyHash와 IssueReplay.requestHash/ref의 폭은 그대로이고 최종 ACK SlotReceipt도 그대로다. 프로젝트 전체 정산액을166/3012로 고정하지 않는다.

두 요청은 기존 requestBody8192B typed 상계 안이며 현재 snapshotBounds는 이미 이 상계로 IE를 예약한다. 기존3행 issue 구조·projection을 유지하면 이번 입력 추가만으로 typed maximum/초기 held를 늘릴 근거는 없다. 실제 used 증가·남은 held 해제·reservation 자기 projection 숫자 폭은 기존 refresh/collector가 같은 Tx에서 재계산한다. 새 행/상한/timeout/권한을 추가하는 결정은 아니다. 형상/복제 구조가 바뀌면 이 결론을 상속하지 않는다.

## 7. 원 operation 연결의 상세안 — 아직 source 인수 아님

A가 읽은 기존 project-native-preparations.ts의 순서는 ATTEMPTED 저장 Tx COMMIT→외부 deliver→별도 후행 Tx다. 원 operation이 잠금을 보유한 채 ACK를 기다리게 바꾸지 않는다. 다음은 기존 순서를 지키기 위한 구현 요구 후보이며 새 R 연결이 현재 이미 구현됐다는 뜻이 아니다.

1. N 효과 전 prospective 예약·현재성·단발 native 조건을 기존 순서로 확보한다. ACK challenge가 읽을 binding/delivery/authority fullref와 실제 frame의 원문은 외부 frame 송신 전에 COMMIT된 실물이어야 한다. 가능한 접합은 기존 ATTEMPTED 선COMMIT 경계에 필요한 R binding/delivery·계상 정산을 같은 Tx로 결박하는 것이다. 정확 producer와 FK/완결은 구현 WI에서 고정한다.
2. 원 operation은 그 Tx의 잠금을 놓고 단발 외부 전달/volatile waiter를 기다린다. frame은 같은 원 main/slot instance가 검산·실제 수용하고 immutable SlotReceipt를 생산한다. VOID 호출·가짜 receipt/시간으로 대신하지 않는다.
3. 같은 receiver가 기존 ACK7키 body의 불변 snapshot을 구성·hash하고 A안의 ACK9키 challenge를 보낸다. challenge Tx는 COMMIT된 실제 refs/current·원 deadline을 검산하며 원 operation의 후행 결과를 기다리지 않는다. issue3행·audit·실제 계상/remaining은 같은 원 Tx에서 완결하고 challenge 반환/재조회 의미를 고정한다.
4. 실제 ACK endpoint는 full body/SlotReceipt·proof/서명/nonce/current를 검산해 정확히 살아 있는 waiter/fence에 후보를 건네고202 CANDIDATE_ONLY를 반환한다. 원 operation 완료를 기다리거나202를 CONFIRMED로 바꾸지 않는다. broker는 DB 현재성·nonce 소비·COMMIT의 대체 권위가 아니다.
5. 원 operation의 별도 후행 Tx가 원 등록/current/물리행·실제 ACK 후보를 재검산하고 nonce 소비·SlotReceipt 불변행·기존 DELIVERY_CONFIRMED의 ackRef·terminal·예약 차분을 함께 COMMIT한다. supplier가 ACK HTTP 완료를 기다려 원 operation을 푸는 순환을 만들지 않는다.

모든 단계는 남은 원 native10초와 Window/session/ARM/delivery/SlotReceipt/nonce의 기존 최소기한 안이다. 새 timeout/재전달·nonce 재발급·기한 연장은0이다. ref 가시성·접합 producer·broker 조건을 Source WI와 반례로 증명하지 못하면 그 분기는 불가/불명으로 남기며 가짜 성공으로 채우지 않는다.

## 8. 공개 계약의 최소 확정 방향과 남은 검토

Main은 채택 제안으로 A안·ACK전용 ackBodyHash 필드와 기존 schemaVersion1의 phase별 exact9/8 분기를 권장한다. 새 native receive ACK는 아직 실제 배포/인수되지 않았으며 기존 다른 phase/legacy native API는 바꾸지 않는다. ACK의 필드 누락/형식/다른 phase의 추가키는 기존 INPUT_INVALID400 경계에서 거절한다. 같은 requestId의 다른 canonical 요청은 기존 원문 충돌 경계를 재사용하고 nonce/행/기한을 증가시키지 않는다. 최종 공개 오류 code/status의 정확 대응과 실제 producer/파일 allowlist는 독립 검토 후 채택 패킷에 고정한다.

이 권장은 미채택이다. B의 exact입력·신뢰된 receipt 생산·전체body commitment·replay/202/후행Tx 검토, 필요한 코드/검증 WI와 원본 hash를 고정한 뒤 사람에게 이 변경점만 결정받는다. 기존 부모 승인 재질문이나 ACK 구현 GO로 쓰지 않는다. 이전 후보98300AA22884E1BCE751CC3596DC043646C1EC47C8B049ADBF61532823A4AD33의 추가 상세 기록이며 세 부모 원문은 그대로다.