# FN06 같은-client 최초 수신 상세화 검토 초안
2026-11-04 · Main 어울 · 읽기 담당 제안 수거

**DRAFT / NOT_ADOPTED / SOURCE_GO0 / EXECUTION_GO0**

이 문서는 작업계획 FN06의 다음 미완료 계약을 준비하는 검토 초안이다. 기존 신뢰 등록·native 준비·책임 예약의 source 승인을 다시 승인받는 문서가 아니며, 새로운 인증·profile·공개 경로·저장을 구현하도록 허가하지 않는다. 현재 UI02 구현은 별도로 계속한다.

## 1. 원 기준과 첫 단위 제안

부모 후보는 FN06_NATIVE_RECEIVE_DELEGATION_DELIVERY_CANDIDATE_20261103_R2.md와 FN06_NATIVE_SAME_CLIENT_RECEIVE_TECHNICAL_DRAFT_20261103.md다. 부모 원문을 수정하지 않는다.

첫 단위는 같은 사용자·원 HUMAN 로그인 session·client/control 세대·동일 등록에서 명령 한 개를 받는 수신이다. 교차-client/mobile 위임·장시간 대기는 후속 미완료 요구로 보존한다. 이 순서는 제안이며 신규 기능의 채택이 아니다.

기존 OWNER/current control·재인증·정책/DENY·등록 원 session/credential 세대·ISSUED/TRUSTED·SPKI·원 writer head/current·sourceScopeHash·기한/회수 검사를 유지한다. HUMAN 보고는 실측이 아니며 RESERVED 책임자는 외부 Agent session이 아니다. 기존 prepareNativeBoundary payload와 최종 approvalRef를 포함한 원 commandHash, native authority·metadata6/opaque43·ATTEMPTED·CONFIRMED/UNCONFIRMED 원형을 유지한다.

## 2. 아직 필요한 다섯 계약

| 경계 | 구체 제안 | 채택 전 남은 조건 |
|---|---|---|
| 첫 인증 | HUMAN challenge가 원 로그인·등록·client/control을 결박하고 별도 typed 등록키 OPEN proof가 이를 단발 소비한다. 공개 recipient에 원 auth session ID를 노출하지 않는다. | exact proof 필드/목적·endpoint별 null 조합·credential 발급/반환/유실 의미 |
| profile | 설치 package manifest에 별도 native-profile anchor를 고정하고 같은 Anvil 서버의 불변 revision/head/회수 repository를 보호 배포 producer가 관리한다. renderer/Agent 쓰기 API는 두지 않는다. | 실제 신뢰 근거/보호 producer와 현재성·rollback 하한의 정확 원형. catalogue/TLS 인증서를 자동 전용하지 않음 |
| 명령 binding | Web 원 명령은 그대로 두고 검산된 offer/ARM 참조를 별도 지시한다. 실제 binding은 원 authority/command/receipt/audit가 생기는 동일 Tx에서 생산한다. | exact ARM header/IPC·원문·오류·취소/CAS·조회 계약 |
| ACK | 원 operation이 비공개 waiter를 소유한다. 실제 slot 수용 proof를 후보로 전달하고 같은 후행 Tx에서 nonce/ACK/CONFIRMED/terminal/정산을 결박한다. | broker 포트·내구 증거·HTTP 완료 순서·종료/불명 처리와 최대량 |
| 유한 저장 | 새 receive actual/future를 원 native와 공통 원장의 중복 분모 없이 기존 used/held에 연결한다. 종료 비용을 시작 전에 예약한다. | exact 표/필드·전이/횟수·원 native 차분·공통 원장 projection·총 바이트 식 |

## 3. 제안 처리 순서

1. 로컬 명시 수신 준비에서 main 소유 Session·view/origin/generation/authEpoch·IPC sender를 모든 await 뒤 검산한다. caller가 project/등록/키/origin을 정하지 않는다.
2. 원 HUMAN 문맥에서 profile·CSRF·challenge를 조회/생산하고 등록키 전용 proof로 OPEN한다. OPEN 때도 원 session/current를 다시 검산한다.
3. Web이 기존 방식으로 최종 명령·승인을 준비한다. 한 receiver/offer/ARM에 그 전체 commandHash를 결박한다.
4. 기존 native 명령 Tx가 ARM과 원 문맥을 검산하고 실제 authority와 binding을 함께 생산한다. ARM 단계에서 원 일회 승인을 미리 소비하지 않는다.
5. ATTEMPTED를 먼저 COMMIT 확인한 뒤 같은 stream에 최대 한 번 전달한다. 부분 전송·단절에 재전송하지 않는다.
6. 실제 slot 수용에서 ACK 후보를 만들고 원 operation만 후행 Tx를 수행한다. ACK endpoint가 Tx 잠금을 잡고 원 operation 완료를 기다리지 않으며 supplier도 ACK HTTP 성공을 기다리지 않는다.
7. 원 결과의 보호 고정 조회로 역사 결과와 현재 가용성을 구분한다. 새로운 확인 요청이 원 10초나 slot 기한을 갱신하지 않는다.

같은-client 부모 초안의 선재 binding header 제안과 R2의 동일 native Tx binding 생산은 서로 다르다. 아직 없는 bindingRef를 사전 전송하지 않고 offer/ARM 참조를 쓰는 방향으로 닫아야 한다. 이는 미채택 공개 계약 보완 사항이다.

## 4. 검토용 경로·목적 후보

HUMAN window/offer/challenge/close와 고정 상태 조회, 등록키 OPEN/STREAM/ARM/ACK/STATE/CLOSE를 별도 목적의 경로로 분리하는 안이다. 기존 authority 이후 전용 HTTPS 채널을 최초 OPEN으로 사용하면 인증 선행이 순환하므로 전용 bootstrap이 필요하다.

새 준비 연산을 AUTO/DENY로만 시작하고 REQUIRE_APPROVAL을 미지원으로 거절하는 안도 신규 제안이다. 원 native 명령의 기존 REQUIRE_APPROVAL은 변경하지 않는다. 경로명/헤더·상태 enum·서명 목적을 기존 구현 사실로 보고하지 않는다.

첫 anchor는 origin/endpointPrefix·CA SHA256/hostname·minimumProfileVersion을 검수된 설치 자료에 고정하는 제안이다. 원격 profile 응답 스스로 최초 신뢰를 정할 수 없다. origin/CA 변경은 새로운 승인 package 대상이며 실제 키·CA 생성/설치는 이번 초안에 포함하지 않는다.

## 5. 횟수·행수와 바이트 검토

후보는 window/session/stream/offer/ARM/delivery/ACK 각1, STATE 최대2, CLOSE 최대1이다. 각 phase challenge1회, 동일 요청 조회는 새행0, 첫 확정 terminal1개를 제안한다. 형식/서명 불량을 원문 감사로 저장하지 않고, 식별·인증 가능한 proof의 고정 소비 결과와 잘못된 인증의 현재 거절을 구별한다.

새 receive 분모의 조건부 최대는 다음과 같다.

| 분모 | 후보 최대 행 |
|---|---:|
| head | 1 |
| window/session/offer snapshot | 3 |
| 실제 binding | 1 |
| ARM receipt | 1 |
| ACK | 1 |
| terminal | 1 |
| reservation | 1 |
| challenge 7회 × 요청·challenge·발급 replay·proof·소비 replay | 35 |
| 조건부 합계 | 44 |

이 44행은 위 제한과 원형이 채택될 경우의 식이며, 부모 전체 R2·교차-client·장시간 수신의 총량이 아니다. 원 native 분모와 신규 HUMAN command/result/receipt/audit 등 공통 분모는 포함하지 않았다.

120초 window/session/offer, 부모 최솟값의30초 challenge, 새 receive 누적10,000행/64MiB, 일반 record16KiB·offer2MiB+192KiB는 검토 후보일 뿐이다. 원 native 총10초·프로젝트10GiB·자동삭제OFF는 기존 기준을 유지한다. 기존 수치를 참조했다는 이유로 새 용도에 채택됐다고 하지 않는다.

총식은 기존 used+held + 아직 포함되지 않은 receive 실제량 + 중복되지 않는 공통 실제량 + 원 native/receive/공통의 미생성 미래예약이다. 각 행은 한 번만 계상하고 actual 증가와 미래예약 감소는 같은 Tx로 처리한다. 원 native 차분·공통 projection·exact 길이/최대식이 아직 닫히지 않았으므로 이 초안은 source 구현 GO가 아니다.

## 6. 불명·회수·비밀

OPEN COMMIT/비밀 반환 불명은 원 결과만 조회하고 재구성·재발급하지 않는다. ATTEMPTED COMMIT 불명은 전송하지 않으며 뒤늦은 행 발견도 새 supplier 호출 근거가 아니다. 부분 write/단절/ACK 유실·후행 COMMIT 불명은 재시도·이어쓰기·자동 terminal 생성으로 메우지 않는다. 재시작으로 휘발 credential·slot·원 예산을 복구하지 않고 미정착 hold를 자동 반환하지 않는다.

비밀 원문은 일반 JSON/IPC/로그/감사/manifest에 넣지 않는다. 실제 키·CA·권한·DB·서비스·Agent·OS/helper 실행과 J3/P03 R3, 사용자 자료 조사는 수행하지 않았다.

## 7. 다음 상세화와 검수

먼저 profile producer의 보호 권위·접합점, exact endpoint/IPC/proof null 표, 저장 원형/횟수·바이트 전체식을 닫는다. 이어 별도 읽기 검토로 과거 guard와 원 명령·10초·한 번 전달·UNKNOWN 보존을 대조한 뒤 정확 후보 hash를 제시할 수 있다. 미완료 계산을 숨기거나 기존 승인으로 새 인증을 열지 않는다.


## 8. 2026-11-04 기술 대조 보완 r2 — native 미래량
직전 초안 SHA256 965288705a4209c4c08e6c3c342e806eb05bfc355205fce8264c1c2130c59c37의 후속 기술 대조다. 여전히 NOT_ADOPTED / SOURCE_GO0 / EXECUTION_GO0이며 원 후보/신뢰 계약을 채택하지 않는다.

현재 NativePreparationStore.capacity와 SQL0071 native_preparation_capacity는 authority/event의 현재 actual만 합산한다. 재사용할 native 미래예약 producer가 없으므로 새 Q_N과 append 동Tx 차감·모든 account collector 접합이 필요하다. 기존 N 저장 원형을 유지한다는 것과 미래예약이 구현돼 있다는 것은 다르다.

현재 생산선은 authority1 + AUTHORITY_CREATED + DELIVERY_ATTEMPTED + terminal 한 개 + CHALLENGE_ISSUED + REQUEST_PROOF_ACCEPTED + CONSUME_COMMITTED = 7행이다. authority와 CREATED 이후에는 다섯 event slots가 남는다. ACK/binding 원문은 새 receive 분모에만 넣고 N에는 기존 ackRef를 쓴다.

고정 authority의 profile/ref 길이를 C, registration/ref를 G, writer/ref를 W, credentialGeneration 자릿수를 g, 후행 ACK ref 길이를 A라 할 때 남은 최대 canonical bytes는 다음과 같다.

`7394 + sequence 자릿수 합 + 3C + 4G + 4g + A + 2W`

기존 parser의 fullref 최대153B·generation16자리·현재 sequence2~6을 적용하면 다음 값이다.

| 후속 사건 | 최대 wrapper bytes |
|---|---:|
| DELIVERY_ATTEMPTED | 1398 |
| DELIVERY_CONFIRMED | 1121 |
| CHALLENGE_ISSUED | 1707 |
| REQUEST_PROOF_ACCEPTED | 1539 |
| CONSUME_COMMITTED | 3228 |
| 합계 | 8993 |

Main5c73f5는 실제 기존 readNativeEvent·nativeHash/nativeBytes와 최대 scalar의 합성 객체를 사용해 다섯 원형 검산 및 위 각 값/합계8993B·5slots를 독립 계산했다. 실제 DB/키/파일 생성·source 쓰기는0이다. 새 ACK를 v1으로 채택하면 A=138이므로 해당 조건부 상한은8978B다. 일반 기존 parser의8993B와 혼동하지 않는다. per-authority 예약에서는 고정 C/G/W/g의 실제 길이를 쓰며 caller bytes/count를 받지 않는다. 새 자유문자열·배열·사건·필드 또는 version 범위가 추가되면 그 typed 차분을 다시 계산한다.

아직 닫히지 않은 것은 초기 authority/CREATED와 원 native 공통 원문 저장분의 선예약, 새 receive 원장 자기비용/전체 공통 분모, 거절 감사의 유한 admission/rate 계약이다. 기존 persistProjectReceipt는 성공 연산당 command/receipt/audit3행이므로 새 세 HUMAN 연산 성공분은9행이지만, 4xx의 recordProjectDenial은 자체 dedup이 없어 전체 공통 상한9행을 보장하지 않는다. 원 native commandSnapshot/intent는 기존 result_ref의 실제 복제분으로 남으며 다른 분모에 있다고 빼지 않는다. 이 항목들이 명시되기 전 source 구현 GO를 내리지 않는다.


## 9. 2026-11-04 담당자별 후속 대조와 남은 결정
이 절은 읽기 담당 결과를 보존하며 NOT_ADOPTED/SOURCE_GO0/EXECUTION_GO0를 바꾸지 않는다. UI02 source-only 구현은 별도85480d5a로 보존됐으나 private 게시 오류가 있어 원격 최신SHA는 미확인이다.

### 구현 업무 단위와 선행
Primary는 다음5단위의 실제 접점을 확인했다. (1) app/current-source의 별도 보호 profile 생산·불변revision/current/revocation, (2) desktop shell/preload/policy의 명시 수신과 await마다 sender/origin/generation/authEpoch 대조, (3) trust-enrollment-owner/native host의 최초 OPEN 전용 typed proof, (4) native panel/API/route/원 native Tx의 offer·ARM·authority/binding 동시 생산, (5) credential-slot과 원 operation의 단발 전달/ACK·후행확정이다. 기존 SIGN을 넓히거나 accept():void를 ACK로 승격하지 않는다. 원 ATTEMPTED commit 전 전달0, 원10초 유지, UNKNOWN 재전송0이다. 신규 파일명/allowlist/SQL번호는 채택 후 고정하며 기존HTTPS·slot을 중복 개발하지 않는다.

### 초기 비용과 실제 생산 순서
현재 project-native-preparations는 current 검산→intent→persistProjectReceipt→reserveNativePreparation→credential→authority/CREATED 순서이며 NativePreparationStore.insert는 actual capacity만 검사한다. 신규 receive 저장예약을 원receipt/credential보다 먼저 확보하되 기존 writer 예약의 선행계약은 옮기지 않는 안을 검토한다. 초기Q_N은 서버 검산된 intent의 실제 배열/문자열과 UUID/hash/ISO/정수/ref의 유한typed폭으로 authorityWrapperTemplate+CREATEDTemplate+후속8993B를 합한다. N총7slots이며 writer·원L_native의 commandSnapshot/intent 복제와 승인소비는 별도 원분모에 남긴다. 실제생성치가예약초과/current변경이면원Tx전체거절이고COMMIT불명hold는유지한다. 이는새producer가구현됐다는뜻이아니다.

### 자기비용과 거절 감사: 아직 선택하지 않은 대안
예약행은R actual에한번, 미생성N/R/L만Q에넣어자기비용중복을금지한다. 계획hash에는미계산self_bytes를포함하지않는다. 담당자는숫자32자리문자·동일폭phase/closed_at표현을한대안으로제시했으나이는새저장계약이며채택하지않았다. 실제종료시각의의미를바꾸지않는더단순한고정typed투영과비교검토가필요하다. 기존FN15 예약함수의operation/subject를receive에재사용하지않는다.
기존recordProjectDenial은적격4xx마다audit를추가하여dedup/상한이없다. 신규receive의인증전무저장거절·입장후내구감사·원requestId/hash재조회·불명hold·효과시작전포화거절의경계는별도채택대상이다. 담당자의60/window·프로젝트공유rate안은새선택이다. 이를채택할경우조건부R44+거절replay60+최초project admission1=105행, 신규L성공9+거절audit60=69행이며현재R44에숨겨넣지않는다. 60이나R105/L69를확정값으로승격하지않는다. 무저장구간의보안감사영향, 기존보호로그와의역할, 최소한의유한대안을독립검토한뒤결정패킷을만든다. code enum/row shape·실제collector·역완결·예약해제불명규칙까지고정되기전구현GO0이다.
