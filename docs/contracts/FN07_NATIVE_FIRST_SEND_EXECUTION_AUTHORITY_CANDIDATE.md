# FN07 native 첫 SEND 소비를 위한 SEND permit 원본 제공 후보

상태: **미채택·검토용**. 설정 checkpoint `e5cc7475`와 채택된 실행 구성 계약 `4091F8260A05C4E836EEA771CC3C6C95DF651559B240A7AC2531D411386C0610` §B의 남은 연결을 대상으로 한다. 이 문서는 제품 구현·실제 실행·권한 변경 승인이 아니다. 실제 DB·사용자 자료·키·서비스·C#/SDK/Agent 실행은 하지 않았다.

## 1. 확인된 공백과 기존 원본

원 worker의 `NormalFirstSendSource.create(request)`에는 원 START/첫 SEND envelope와 permit, 정확 scope·계획 SID가 있다. 그러나 native `NormalExecutionCredentialSource.RowRequest`는 `attemptId,slotId,startCommandId,sendCommandId,scope`만 받는다. 보호 FIRST3는 envelopeHash와 permit을 저장하지만 envelope 본문은 저장하지 않는다. 현재 native 검사 결과도 digest뿐이다.

역할·세대의 원 출처는 별도로 존재한다. `normal-initial-execution.ts:96~104,214`는 원 책임자 binding의 fullref·`snapshot.generation`·sessionRef와 execution intent를 검산해 normal fact를 만든다. `normal-instruction-permit.ts`는 같은 grant의 binding 및 명령의 currentBinding과 현재 fact를 대조한 뒤 다음 자료를 **이미 기존 permit snapshot에 저장**한다.

- `currentFact.agentSession.{sessionRef,roleBindingRef,bindingGeneration}`
- `currentFact.intent.mode` 및 원 assignment/connection/environment/sourceScopes
- 정확 `scope`(project/connector/execution/generation/grant/credentialGeneration), commandRef, request, proofRef, authorizationReceiptRef, reservationRef
- `bindingHash`, 발급·만료 및 command/grant/proof 기한

`permit.ref.contentHash`는 이 **전체 snapshot의 canonical SHA256**이다. 기존 응답 `respond()`는 `{ref,commandId,envelopeHash,issuedAt,expiresAt}`로 축약하므로 native는 원 역할·세대를 읽거나 전체 해시를 복원할 수 없다. sessionRef.version, executionGeneration, profile 목적 또는 caller의 역할 선언으로 이를 대체하지 않는다.

근거: [원 첫 SEND owner](../../apps/connector/runtime/normal-first-send-owner.ts), [서버 원 fact](../../apps/server/modules/executions/normal-initial-execution.ts), [SEND permit 발급·재조회·원장 검사](../../apps/server/modules/executions/normal-instruction-permit.ts), [현재 축약 응답 소비](../../apps/connector/runtime/normal-protected-post-client.ts), [native 입력](../../apps/connector/native/NormalExecutionCredentialSource.cs).

## 2. 서버가 증명하는 범위와 선택할 응답 계약

**서버가 기존 권위로 증명할 수 있는 것은 정확한 현재 SEND의 허가와 원 permit이며, SDK bootstrap의 최초 SEND 여부는 아니다.** `normal-instruction-command.ts:92~100,133~144`의 parentStart는 해당 grant의 START를 가리키고 IDLE은 관측 당시 상태다. `normal-instruction-permit.ts:46~56,114~128`은 원 명령·grant·현재 fact 및 명령별 permit을 검산한다. `ORDER BY id LIMIT 51`은 원장 조회/한도이며 최초 실행 순서가 아니다. 반면 최초 소비의 단발 상태는 `normal-start-coordinator.ts`의 `settledStarts` WeakMap과 `takeNormalFirstStart`의 삭제, 원 worker/FIRST3에 있다. 이 상태를 서버로 검증 가능하게 제공하는 기존 응답·서명 입력은 확인되지 않았다.

| 경우 | 기존 근거로 가능한 판정 | 최초 제한으로 사용할 수 없는 이유 |
| --- | --- | --- |
| 같은 START에 둘 이상의 SEND가 대기 | 각 명령의 parentStart·현재 fact·예산·기한과 원 permit을 각각 검산 | 큐의 생성 순서/ID 정렬/대기 건수는 어느 명령을 원 worker가 최초 소비했는지 증명하지 않음. 명령 1건의 허가가 다른 명령의 최초성을 배제하지 않음 |
| 앞선 요청이 거절·만료·결과 불명 | 해당 발급/재조회는 원 오류·기한으로 거절 | permit 부재가 미시도 증거가 아니고 permit 존재도 Query 생성/최초 성공 증거가 아님. 다음 명령을 최초로 승격하지 않음 |
| 재접속 또는 같은 packet 재조회 | `prior`가 원 packet·command·permit과 현재 권위를 재검산해 같은 결과만 반환 | 재접속은 WeakMap 복구/새 최초 권위가 아니며, 기록 정렬이나 빈 원장으로 최초 lease를 재발급할 수 없음 |

따라서 이전 초안의 `FIRST_SEND_AUTHORITY_V1`/`NORMAL_FIRST_SEND_PERMIT_SOURCE_V1` 이름과 서버의 ‘첫 SEND에만 제공’ 해석을 철회한다. 아래 두 안은 **선택 전이며 기본 응답은 변경하지 않는다.** 후보 작성 자체로 보호 원본을 반환하거나 제품 구현을 시작하지 않는다.

| 대안 | 서버가 집행할 최소 범위 | 노출·계약 비용 |
| --- | --- | --- |
| A. 정확 SEND permit 원본 제공 | 기존 보호 permit 경로에서 원 credential·challenge·서명·grant·command·현재성 검산을 통과한 SEND에 한정. 최초/후속 구별 없음. native 첫 소비 제한은 별도 원 worker/FIRST3에서 유지 | 새 권한 행이나 실행 operation은 없지만 **기존 실행 권한 보유자가 받을 수 있는 보호 metadata 범위가 모든 해당 SEND로 확대**됨. 이를 단순 내부 구현이나 최초 전용 노출로 표현하지 않고 별도 응답/노출 정책 결정 필요 |
| B. 서버가 검증하는 최초 지정 이후만 제공 | 서버가 원 START/실행·세대/원 SEND·시도와 단발 소진을 구분할 수 있는 검증 가능한 최초 지정 근거를 먼저 정의 | 현재 근거가 없어 구현하지 않음. 원 worker 선언/헤더/ID 정렬로 대체 불가. 최초 지정·소진·재접속/거절 처리의 추가 권위 및 필요 보관 계약이 생기므로 A보다 큰 결정이며 구체 저장 형상을 이 후보에서 임의 도입하지 않음 |

본 후보의 최소 구현안은 **A의 노출 범위를 명시적으로 수용하는 경우에만** 아래와 같다. 최초 전용 노출이 필수라면 A를 채택하지 않고 B의 별도 근거 정의가 선행된다. 역할 3필드만 반환하고 자체 hash를 붙이는 방식은 기존 전체 permit hash와 검증 가능한 연결이 없어 대안이 아니다. 별도로 인증된 축약 증명은 새 증명·서명/검산 계약 비용을 요구한다.

새 endpoint·로그인 역할·DB 테이블/열·서명키는 A에서 추가하지 않는다. 기존 보호 `POST .../commands/{commandId}/permit`의 SEND 응답에 선택 표현을 추가하고 START·관측 ACK·기본 표현은 보존한다. 후보 이름은 `Anvil-Normal-Permit-Representation: SEND_PERMIT_SOURCE_V1`이고 추가 필드는 다음 하나다.

```text
executionAuthority: {
  kind: 'NORMAL_SEND_PERMIT_SOURCE_V1',
  permitSnapshot: <검산된 기존 execution_instruction_permits.snapshot_json 원본>
}
```

별도 role 값·authorityRef·새 만료시각·`verified:true`는 발급하지 않는다. 소비자는 원 permit.ref와 전체 snapshot canonical hash를 대조한 뒤 필요한 필드를 파생한다. 전체 snapshot에는 subject/session 식별자, 근거 fullref와 요청 metadata가 포함된다. credential/token/서명 개인키나 문서·지시 본문을 포함하지 않더라도 기존보다 넓은 노출이다. 원 실행 worker/native 외의 UI·로그·오류·보고서·추가 저장에 제공하지 않는 소비 규칙만으로 서버의 최초 전용 제한이 생기지는 않는다.

### 표현 선택 헤더와 기존 서명의 다른 보장

`execution-proof.ts:17,34~49,59~60`의 서명 target은 method/path/queryHash/bodyHash이고, `normal-instruction-permit.ts:108`의 packetHash는 `{frame,target}`이다. **위 새 헤더는 어느 입력에도 포함되지 않는다.** 같은 서명 packet에서 헤더만 바꾸면 기본/원본 표현을 바꿀 수 있으므로 기존 서명이나 idempotency 검산이 표현 선택까지 인증한다고 주장하지 않는다.

- 하향 변경/헤더 제거: 새 소비자가 기대한 원본이 누락되면 효과 전 거절한다. 축약 응답으로 자동 대체해 native lease를 발행하지 않는다. 이는 실행 차단이며 원 명령을 새로 발행할 이유가 아니다.
- 헤더 추가/교체: 유효한 일반 SEND packet의 반환 범위를 원본으로 바꾸는 것은 기존 서명 검산만으로 막을 수 없다. A는 동일 실행 권한에 이 표현을 허용하는 노출 정책을 수용할 때만 가능하다. 허용되지 않은 값은 거절해도 이 차이는 해결되지 않는다.
- 응답 교체: 원 command/grant/permit.ref와 snapshot hash·시각·현재성 대조로 다른 permit의 대입을 거절한다. 이 검산은 요청자가 그 표현을 선택했다는 서명 증거를 대신하지 않는다.
- 선택 자체의 서명 인증까지 요구하면 표현을 기존 signed body/target에 포함하도록 **요청·challenge·proof·재전송 호환 계약을 추가 변경**해야 한다. unsigned 헤더만의 A와 별개 비용이며, 그 변경만으로 최초 SEND 식별이 생기지도 않는다.

새 클라이언트의 PreparedNormalPost private 정보에 기대 표현을 묶는 것은 로컬 응답 소비 가드다. 기존 클라이언트는 추가 필드를 거절하므로 기본 응답은 그대로 유지하며, 새 소비자는 필드 누락·다른 kind·추가 필드를 거절한다. 구형 서버의 축약 응답은 기존 normal 경로에만 사용하고 새 native 근거로 승격하지 않는다. 같은 packet의 표현 변경을 막으려는 새 서버 기록을 이 후보에서 조용히 추가하지 않는다.

## 3. A를 채택하는 경우의 발급·조건부 재조회와 native 소비

1. 서버 신규 발급은 기존 `checkFact`·grant binding·명령/예산/자료 검산과 거래 종결을 그대로 수행한다. 완성 응답의 크기를 종결 전 검사하고 한도 초과 시 기존 거래 실패로 끝낸다. 새 영수증·permit·감사 기록을 추가하지 않는다.
2. 같은 packet의 명시 재조회는 기존 `prior` 분기만 사용한다. 원 challenge/packetHash/requestHash/commandRef, 같은 credential·grant·현재 fact·예산·자료와 원 permit의 미만료를 다시 검사한다. 기존 코드처럼 새 기록 없이 원 permit과 **같은 원 snapshot**을 반환한다. checkedAt/issuedAt/expiresAt을 갱신하거나 새 permit을 발행하지 않는다. 응답 유실에 대한 자동 재전송은 추가하지 않는다.
3. worker는 원 `source.create`에서 두 envelope와 이 응답을 같은 claim·permit·신호·기한에 묶는다. 새 private 전송의 구체 형상은 구현 WI에서 고정하며 범용 callback/renderer 입력으로 받지 않는다. 현재 native RowRequest를 그대로 사용할 수 있다는 주장은 하지 않는다.
4. native는 원 record/slot·할당·정산을 재판독하고 FIRST3에서 읽은 SEND permit.ref와 응답 ref를 exact 대조한다. `SHA256(canonicalJson(permitSnapshot))`가 그 ref의 contentHash와 같아야 한다. snapshot의 commandId/request.envelopeHash/issuedAt/expiresAt/proofRef는 축약 permit·원 proofResultRef와 일치해야 한다.
5. 기존 `readNormalInstructionPermitLedger`의 한 항목 구조·requestHash·bindingHash·scope·시간·참조 검사 의미를 native에서 독립 대조한다. 원 `currentFact.agentSession.sessionRef`는 SEND envelope와 scope의 sessionBindingRef에, registration 및 실행·credential 세대는 원 record/slot에 결박한다. roleBindingRef fullref·bindingGeneration은 원 snapshot 값으로만 받으며 credentialGeneration과 혼동하지 않는다. 지원 mode는 원 fact와 보호 recipe/profile 모두 `CONTEXT_REVIEW`일 때뿐이다. FILE scope는 READ만 허용하고 기존 sourceScopes 범위를 넓히지 않는다.
6. 두 envelope는 각각 `envelopeHash`를 제외한 전체 canonical 원형의 SHA256으로 재계산한다. 원 FIRST3의 command별 envelopeHash·permit·terminal fullref와 대조하고 START↔SEND context의 기존 비교 규칙을 보존한다. 역사 START permit을 현재 permit으로 재발급하지 않으며, 실행 직전 현재 첫 SEND permit의 기한은 별도로 확인한다.
7. 서버의 조건부 응답은 반환 시점의 현재성 근거다. 캐시된 snapshot만으로 무기한 현재성을 주장하지 않는다. native의 각 사용·인계·생성/재개 직전에 원 등록/slot/설정/패키지·기한을 재검산한다. 이후 역할·grant 변경의 현재성을 요구하는 지점에서 기존 공급자가 이를 확인하지 못하면 효과 0이다. 이 응답이 장기 변경 통지나 OS 강제 집행을 새로 제공하지 않는다.

## 4. 기존 조회로 대체하지 못하는 이유

- 기존 명령 페이지는 envelope와 자료 descriptor를 전달한다. 위 permit의 full currentFact를 전달하는 계약이 아니다.
- 현재 permit 응답은 full snapshot의 hash만 반환한다. 축약 객체를 다시 hash하거나 일부 값을 추정해서 그 hash를 복원할 수 없다.
- 기존 normal current 응답은 key/envelopeHash/grant/localAttempt/sourceObservationRefs/osOwnershipRef/시각을 검산한다. roleBindingRef·bindingGeneration의 원 fact 원문은 없다.
- 일반 책임자/이력 조회의 HUMAN 권한을 실행 slot의 권한으로 바꾸거나 최신 항목을 검색하지 않는다. 별도 조회에서 얻은 현재 binding은 이번 원 permit이 고정한 binding과 같다는 증거도 대신하지 못한다.
- 보호 설정 기록은 로컬 설정의 역사다. 서버 실행 역할·현재 grant의 원본이 아니다. 새 서명된 축약 투영은 새 서명·보관 계약을 요구하므로 이 최소안에서 제외한다.

## 5. 한도·보관·실패와 rollback

기존 보호 응답 **전체 2MiB**와 request 한도는 유지한다. native private 인계도 메타데이터와 필요한 원문을 합한 canonical 전체가 2MiB를 넘으면 효과 전 거절한다. 기존 normal 자격 전송의 48,000바이트 조각을 재사용하는 경우 최대 44조각이며 시작/종결 포함 46프레임이다. 이미 소비한 프레임까지 **원 host 총64·10초** 안이어야 한다. 각 실제 인코딩 frame의 64KiB 한도도 검사한다. 부족하면 둘 이상의 host에 누적·분산하거나 한도를 늘리지 않는다. 이번 응답이 별도 supervisor 인계 pipe·원 endpoint·패키지 검산을 대신하지 않는다.

원 permit은 기존 서버 원장에만 보존한다. worker/native의 추가 snapshot은 원 시도 수명 안의 메모리에만 보유하며 종료·취소·불명 때 폐기한다. FIRST3의 기존 저장 형상은 바꾸지 않는다. 재시작 후 새 응답을 얻지 못하거나 원 packet이 만료됐다면 역사 기록만으로 실행 lease를 재생성하지 않는다. 원 자료가 없거나 서로 다름, 역할/세대 불명, 과대 응답, 회수·만료, 전송/인계 결과 불명은 import/query/spawn 0 및 기존 UNKNOWN·원 소유 수거 규칙을 따른다.

고정 SDK argv/env/CLI closure를 입증한 보호 배포 recipe 부재도 계속 0이다. 이 후보는 recipe를 발행하거나 실제 최초 SEND 성공을 보증하지 않는다. rollback은 선택 표현과 그 native 소비를 닫고 기존 축약 응답을 유지한다. 기존 permit/설정/spool/UNKNOWN 기록은 삭제·재작성하지 않고 원 child가 있다면 그 소유 수거만 유지한다.

## 6. A 채택 뒤 최소 구현·검수 범위

핵심 영향은 서버 `normal-instruction-permit.ts` 및 같은 route의 헤더 선택 연결, connector `normal-protected-post-client.ts`와 원 FIRST claim의 응답 보존, desktop 원 worker의 private 전달, native `NormalExecutionCredentialSource.cs`·`NormalExecutionSpoolProfileSource.cs`·`NormalExecutionConfigurationSource.cs`의 독립 검산이다. 현재 create 입력에는 전체 응답이 남지 않으므로 `normal-instruction-coordinator.ts`와 `normal-first-send-owner.ts`의 **메모리 형상** 보완도 필요하다. 정확 파일 목록은 채택 후 기존 호출선별 WI로 고정한다. DB migration, 기존 FIRST3 snapshot 수정, 새 public endpoint·권한 행은 필요하지 않다.

합성 수용 기준: 후속 SEND도 A의 노출 범위임을 명시하고 두 대기 명령/앞선 거절/재접속을 최초 증거로 삼지 않음; unsigned 표현 헤더의 제거·추가·교체와 원 packet 재조회 보장 구분; 기존 기본 표현/START 호환; 명시 SEND 응답의 원 snapshot hash와 FIRST3 exact 일치; 같은 packet 재조회에서 같은 ref/원 시각·추가 기록0; 교차 grant/명령/session/roleBinding/세대 및 한 필드 변조 거절; 만료·권한/현재성 소실·구형 응답·불명 재발급0; 전체 크기/프레임 한도; signed preset이 아닌 RAM 표로 실제 실행권을 만들지 않음. RAM·정적 증거와 실제 서버/DB/native/SDK 검증은 구분한다. **현재 이 후보의 제품 구현 및 실제 실행은 0이다.**

## 7. 권장 결정안 C — 서명된 요청 형상으로 검산 범위 제한

**미채택. 이 절은 A의 미서명 헤더를 구현 후보에서 대체한다.** 최초성 서버 증명은 추가하지 않는다. 기존 허가와 원 사실 검산을 모두 통과한 `CONTEXT_REVIEW` 및 READ 전용 normal SEND만 지원하며, 여기에는 최초뿐 아니라 후속 SEND도 해당할 수 있다. 보호 수준이 더 넓은 WORK 및 START는 선택 응답을 거절한다. 실제 native 최초 소비에는 원 worker와 exact FIRST3의 기존 단발 기준을 계속 적용한다.

기존 POST의 닫힌 4개 본문 키를 그대로 받는다. C 선택 요청만 기존 키에 `representation: "SEND_PERMIT_SOURCE_V1"` 하나를 추가한 닫힌 5개 키 원형을 사용한다. 헤더 선택은 추가하지 않는다. 기존 정규 JSON `bodyHash`에 전체 원형을 넣고 challenge·proof·packetHash를 지금과 같이 대조한다. 서비스의 기존 한도·키·서명 알고리즘·nonce는 바꾸지 않는다. 요청에 선택값이 없으면 기존 축약 응답을 그대로 반환한다. 해당 문자열을 요청한 적격 SEND에만 §2의 `executionAuthority` 한 필드를 추가한다. 구형 서버는 새 원형을 거절하므로 자동으로 구형 형상으로 재전송하지 않는다. 구형 요청/응답과 과거 permit은 계속 읽을 수 있다.

정확 재조회는 같은 선택값까지 포함한 같은 원 packet에만 가능하다. 선택값이 바뀐 요청은 동일 permit의 표현 변경으로 처리하지 않는다. 기본으로 이미 발급된 동일 명령을 재호출해 표현을 바꾸거나 permit을 다시 발급하지 않는다. 불명·만료·회수는 기존 대로 보존하고 재시도하지 않는다. 2MiB 응답·인계 및 64프레임/10초 한도는 §5를 따른다.

`0097_normal_instruction_dispatch.sql.pending` 607행·700행·706행은 각각 기존 receipt bodyHash와 requestHash, permit 원 요청 hash, challenge bodyHash를 대조한다. C는 선택값까지 포함한 signed 요청 원형을 **기존 `permit.request` 안에 그대로 보존**하여 세 hash의 정확 동일성을 유지한다. SQL의 닫힌 요청 형상에서 기존 4개 또는 정확 단일 선택값의 5개 키를 인정하고, 5개 형상은 원 사실의 CONTEXT_REVIEW 및 READ 전용 조건과 함께 검산한다. 형상 변경은 목적 SEND의 forward SQL 보완으로만 제시하며 실제 적용은 이번 결정에 포함하지 않는다. START의 요청 guard, 다른 receipt·기존 SQL·권한·테이블·서명키·자료는 변경하지 않는다. 동일 중첩 원형을 검산하는 서버/실행기·원장 소비자와 보관 검산 코드는 기존 원형도 보존해야 한다.

원 permit 전체의 기존 SHA256 결박을 검증하기 때문에 수신 자료엔 실행의 subject/session 식별자·근거 fullref·요청 메타데이터가 포함된다. 이 노출은 새 응답 계약의 명시적 결정 항목이다. 문서·지시 본문·token·키의 전달이나 UI/로그 출력, 추가 저장은 허용하지 않는다. 모든 해당 후속 SEND의 이 메타데이터 제공을 원치 않으면 C는 부적합하며 기존 축약 응답을 유지한다. 검수는 기본/과거 자료·START 보존, 요청값 변경/삭제·서명 불일치·WORK 및 쓰기 범위 거절·동일 선택 재조회, 구형 클라이언트 호환, exact FIRST3 및 한도·불명·rollback을 포함한다. 이 후보는 코드·미적용 SQL·합성 검증의 결정만 대상으로 하며 실제 DB·권한·키·서비스·C#·SDK/Agent 실행은 제외한다.
