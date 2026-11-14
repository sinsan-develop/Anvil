# FN08 준비 결과 ownership 반환 연결 후보

상태: **채택 — 2026-11-14 신산님 직접 A안 계약·source-only 구현 승인**. 승인 대상 원문 SHA256: `CFF94F6704B91556A0DBBD21353F5F2D29A8CA0F4340E3C0413A7841B849EFA4`. 아래 후보 표현은 결정 당시 이력이며 채택 범위는 코드·미적용 SQL·합성 검증이다. 실제 DB·권한 적용·키·프로세스·서비스·Agent 실행은 제외한다. 작성 developer-primary, 2026-11-14. 기준 `main 8922562ba1b63354042e3b326ebc5e40ca02e25c`, 작업 branch `codex/av3-d1-ownership-binding`. 이 문서는 Main이 지정한 문서 한 개만 작성한 결과다. 실제 DB·권한·키·보호 파일·서비스·프로세스·Agent 실행과 native 컴파일을 승인하거나 수행하지 않는다.

## 1. 결정할 한 점과 사용자 효과

**원 HUMAN 준비 명령을 한 번 소비한 같은 등록 host에, 그 결과인 원 retained process의 최초 ownership 관측을 반환할 제한 권한과 정확 전송 형상을 추가할지** 결정한다. 권장안 A의 채택 범위는 계약·source·합성 검증이며 실제 process 생성·실제 native 관측·키 사용·DB 적용은 제외한다.

사용자에게는 정상 실행 준비가 단순 등록 성공이나 빈 helper 관측에서 멈추지 않고, 검산된 원 준비 결과가 서버 원장에 연결되는 효과가 있다. 수용된 관측은 이후 START 권위 검산의 근거 후보이며, 그 자체가 코딩 Agent 실행·업무 성공·도구 권한 또는 writer ACTIVE 확정은 아니다.

새 credential 종류, 새 principal, 범용 서명 API, 새 ownership 서명 목적은 필요하지 않다. 그러나 **새 credential이 없다는 것이 추가 권한도 없다는 뜻은 아니다.** 기존 준비 credential의 정확 두 operation에 관측 반환 권한을 암묵 포함시키지 않는다.

## 2. 기존에 있는 계약과 아직 없는 연결

| 근거 | 기존 계약·구현 | 이번 후보와의 구분 |
|---|---|---|
| `FN06_FN08_P3_NORMAL_TRANSPORT_DECISION_PACKET_20261113.md` §3.1 단계2·3 | normal 서버·실행기 source 구현, 실제 실행은 단계4 별도 | source 연결을 전체 차단하는 근거가 아님. 새 공개 형상은 명시 결정 |
| `FN06_FN08_EXECUTION_DISPATCH_PROPOSAL.md` §6 | 실행 grant/credential와 permit의 현재 host/source 관측 결박 | 초기 grant가 osFence를 요구하므로 최초 관측을 normal credential에 의존시키면 순환 |
| `contracts/runtime/native-preparation-authority-v1.ts`의 NativeAuthority | 준비 권위, 원 HUMAN command/receipt/audit, RESERVED head, 같은 실행/세대/등록/factory/sourceScope. 허용 operation 정확 CURRENT/CONSUME 두 개 | 기존 권위·기록을 새 관측 반환 권위로 재해석 금지 |
| `native-preparation-client.ts`, `native-preparation-factory-consumer.ts` | 내구 localAttempt, current/challenge/consume, 원 consume receipt와 복제 불가 일회 factory capability | 재사용. consume proof를 다른 HTTP target의 proof로 재생하지 않음 |
| `native-preparation-owner-bridge.ts`, `native-preparation-owner-launcher.ts` | 원 capability로 소유 helper를 열고 OPEN_EMPTY/QUERY_EMPTY 결과를 검산 | 현재 EMPTY_OBSERVED/holderId는 process ownership evidenceRef가 아님 |
| `OwnershipEvidenceProcessOwnerSource.cs`, `OwnershipEvidencePreparedFactsSource.cs` | 원 retained process/job 관측과 facts 후보 source | 준비 capability·원 서버 요청·제한 서명·수용을 잇는 공급자가 미연결. 표식만 변경하지 않음 |
| `ownership-observation-v1.ts`, `ownership-observation-proof.ts` | OWNERSHIP_OBSERVATION, `ANVIL_OWNERSHIP_OBSERVATION_V1\0` 서명 bytes, 등록 SPKI, nonce/기한/process/facts 검산 | 그대로 재사용. 새로운 서명 namespace 불필요 |
| `ownership-observation-staged.ts` | 원 요청·nonce·head 검산, observation/accepted event/head의 같은 거래 저장 | 현재 SYNTHETIC_NONE·기존 PREPARATION_GRANTED 부모 계약을 보존. native consume 부모는 별도 명시 분기 필요 |
| `normal-start-permit.ts:74` | 요청 osOwnershipRef가 현재 fact.checks.osFence.evidenceRefs에 실제 포함되어야 함 | 등록 ref·profile hash·holderId·서명 문자열로 대체하지 않음 |

위 파일의 실제 존재가 실제 공급자 활성화·운영 검증을 뜻하지 않는다. 오래된 후보 문서의 미채택 표기만으로 이후 채택된 source 전체를 무효화하지도 않는다.

## 3. normal credential에 의존하지 않는 최초 반환 흐름

1. 실제 HUMAN의 기존 `prepareNativeBoundary` 명령에서 현재 제어권·정책·필요 승인·등록·선택 sourceScopes·정확 factory를 검산한다. 기존 EMPTY_AT/RECLAIMED_AT 근거가 없으면 거절한다. 정상 실행 grant는 요구하지 않는다.
2. 같은 executionId/generation을 RESERVED 준비에 결박하고 준비 전용 권위를 발급·보호 수신한다. 기존 발급/수신/원 승인 소비를 다시 구현하지 않는다.
3. 원 current/challenge/consume 검산 후 localAttempt와 FACTORY_ATTEMPTED를 내구 기록한다. 기존 원 factory capability를 정확 한 번 소비한다.
4. **실제 구현 후 실행 승인을 받은 환경에서만** 원 factory가 retained process/job을 보유한다. 이번 source 시험에서는 이 경계만 RAM 대역이다. helper의 EMPTY_OBSERVED만 있거나 retained process가 없으면 이후 단계는 UNAVAILABLE다.
5. host가 원 준비 결과의 process 후보를 제한 request 발행 경로로 전달한다. 서버가 consume·등록·세대·원 preparation을 검산하고 원 ownership request와 후보 anchor를 만든다. 이 시점의 candidate는 OS 진위나 writer 권위가 아니다.
6. 같은 소유 host 내부에서 원 retained handle을 다시 관측한다. 원 서버 request, candidate anchor, 실제 process identity가 모두 같을 때만 기존 ownership bytes에 제한 서명한다.
7. 서버가 같은 nonce/원 request/현재 등록·준비/원 head·서명을 검산해 원장을 원자 수용한다. 확정 COMMIT 뒤 observationRef와 headRef를 반환한다.
8. 이번 정상 종단은 확정된 observationRef/headRef 반환까지다. PREPARED 관측 수용 또는 ownership head의 ACTIVE 표기는 normal grant가 요구하는 writer OWNED/osFence VERIFIED_CURRENT의 증명이 아니다. PREPARED에서 grant를 허용하는 기존 검산 근거와 retained process의 resume 선행 관계는 현재 미확인이다. 따라서 grant→실행 credential→START permit 도달이나 전체 부트스트랩 순환 해소를 완료 조건으로 주장하지 않는다.

원 request는 process/anchor를 결박하므로 PID/startTicks를 알기 전 consume 응답에 완성된 ownership request를 미리 넣지 않는다. 최초 관측에는 normal 실행 credential을 사용하지 않는다.

이 흐름은 최초 반환에 실행 credential을 요구하는 의존성만 제거한다. 기존 CURRENT facts가 RUNNING/everResumed:true를 요구하는 점과 grant 이전 실행 허가의 관계는 남은 검토 경계다. 이를 풀기 위해 임의 resume 권한을 만들거나 PREPARED를 RUNNING으로 바꾸지 않는다.

## 4. A안 권장 — 준비 결과 반환만 허용하는 명시 분기

### 4.1 권위와 호환성 — 신규 권장 형상

기존 v1 authority snapshot/allowedOperations/소비 응답/역사 hash는 불변이다. 신규 발급에서만 선택되는 **native 준비 authority v2**를 권장한다. v2는 v1의 필드·정확 부모 관계·수명 상한을 유지하고 `schemaVersion:2`, allowedOperations의 다음 정확 세 항목만 다르다.

```text
CHECK_NATIVE_PREPARATION_CURRENT
CONSUME_NATIVE_PREPARATION
RETURN_NATIVE_PREPARATION_OWNERSHIP
```

세 번째 항목은 같은 authority의 확정 consumeReceipt/localAttempt에 한정된 최초 BOOTSTRAP_PREPARED 결과 반환만 허용한다. 준비 두 operation의 의미는 변하지 않는다. v1 token은 새 target에서 거절한다. v1을 자동 변환하거나 재발급하지 않는다. 실제 issuer/정책 활성화는 이번 문서 작성이나 source 시험으로 수행하지 않는다.

이는 구현된 현재 형상이 아니라 **사용자 결정 대상인 권장 계약**이다. v2 선택·정확 schema validator/저장 분기·호환 시험은 그 결정을 구현하는 내부 작업이며 별개의 범용 실행 권한을 만들지 않는다.

### 4.2 인증 주체와 정확 target

주체는 원 authority에 결박된 REGISTERED_HOST다. 같은 준비 credential의 digest/generation, 등록 ref/SPKI, origin/channelProfile, 원 HUMAN/제어 세대·정책·writer 준비 상태를 서버에서 재검산한다. HTTP가 보낸 current/권한 bool은 받지 않는다.

새 허용 target은 다음 둘뿐이다. 정규 경로, query 없음, 원 host/TLS/명시 CA, 단일 준비 Bearer, Cookie·다른 realm 혼합 거절을 유지한다.

```text
POST /api/v1/connector/native-preparations/:authorityId/ownership-requests
POST /api/v1/connector/native-preparations/:authorityId/ownership-results
```

준비 credential이 이 target에서 사용되는 근거는 새 세 번째 operation이다. 등록 STATUS_ONLY나 normal 실행 Bearer로 fallback하지 않는다. 기존 `NATIVE_PREPARATION_REQUEST_PROOF`는 consume target에만 유효하며 여기로 재사용하지 않는다.

기존 v1 consume proof의 canonical 서명 bytes와 목적·target은 불변이다. v2 consume에서도 proof의 authorityRef는 해당 v2 원 snapshot의 정확 id/version/contentHash와 결박하며, ref만 같은 모양인 v1/v2 snapshot 교체를 거절한다. ownership report 서명 bytes에도 새 필드를 임의 추가하지 않는다. 서버의 원 request/binding→v2 authorityRef→확정 consumeReceipt 관계를 별도 검산하여 서명 검산만으로 다른 권위를 대입하지 못하게 한다.

### 4.3 원 요청 발행 형상 — 신규 권장

`ownership-requests` body의 정확 필드:

```text
{schemaVersion:1, requestId:UUID, authorityRef:Ref,
 consumeReceiptRef:Ref, localAttemptRef:Ref,
 processRef:{runId:UUID,generation:positiveInteger,jobId:UUID,
             pid:positiveInteger,startTicks:decimalString,executableHash:SHA256}}
```

Ref는 기존 id/version/contentHash 형상이다. processRef는 기존 OwnershipProcessRefV1 검사를 사용한다. caller가 anchorRef·observerRef·head·sourceScopeHash·정책·등록 근거를 선택하지 않는다. 서버가 원 preparation/factory/consume 기록에서 파생하고 대조한다. expected executable/image·factory provenance가 보호 원기록에서 검산되지 않으면 거절한다.

응답의 정확 필드:

```text
{bindingRef:Ref, request:OwnershipObservationRequestV1,
 candidateAnchor:{ref:Ref,snapshot:ExistingOwnershipAnchorShape}}
```

`ExistingOwnershipAnchorShape`는 기존 ownership-ledger-v1의 anchor 검사를 통과하는 원 구조를 뜻하며 새 자유 JSON이 아니다. 서버가 만든 request의 phase는 BOOTSTRAP_PREPARED, expectedHeadRef는 null이다. 해당 execution/generation에 기존 head나 다른 원 준비 반환이 있으면 최초 경로는 거절한다. 원 request는 기존 32-byte nonce·최대10초 TTL이며 만료는 authority/consumeReceipt/등록/원 준비/정책 기한의 최솟값 이내다.

bindingRef는 원 authorityRef/consumeReceiptRef/localAttemptRef/requestRef/candidateAnchorRef와 동일 실행·등록·sourceScopeHash의 **서버 원자 저장 결박**을 참조한다. self-hash 순환을 만들지 않는다. 반환은 그 저장의 확정 COMMIT 이후다. candidateAnchor는 서명/수용 전에는 실제 OS 증거가 아니다.

**candidate 발행의 한계와 위험:** 이 권장 형상의 발행 요청은 준비 Bearer로 인증되며 아직 retained process 관측 서명이 없다. 따라서 해당 credential을 행사할 수 있는 주체가 잘못된 PID/processRef를 보내면, 최종 관측 수용에는 실패하더라도 같은 consume의 일회 request 창을 소진할 수 있다. 이는 새 operation에 포함되는 가용성 위험이며 서명된 최종 report가 막아준다고 주장하지 않는다. owned host가 원 capability/현재 등록/retained identity를 검산한 후보만 송신하도록 제한하여 노출을 줄이되, 서버가 Bearer만 보고 그 provenance까지 증명할 수는 없다. 발행 전 단발 서명으로 이 위험을 더 줄이는 방안은 기존 서명 목적·정확 bytes/target 재사용 가능성을 별도로 검토해야 하며, 이 후보에서 consume proof 재생이나 범용 signer로 우회하지 않는다.

### 4.4 제한 관측 서명과 수용 형상 — 기존 의미 재사용

native signer는 기존 OWNERSHIP_OBSERVATION bytes만 서명한다. 임의 bytes signer·일반 SIGN_PROOF를 열지 않는다. 같은 owned host의 원 retained handle과 preparation capability 계보, 인증된 서버 응답의 request/binding/anchor, 현재 등록 키를 검산한다. 다른 process·세대·sourceScope·factory로 바꾸거나 caller facts를 그대로 서명하지 않는다.

`ownership-results` body의 정확 필드:

```text
{schemaVersion:1, authorityRef:Ref, consumeReceiptRef:Ref,
 localAttemptRef:Ref, bindingRef:Ref,
 report:OwnershipObservationV1, facts:OwnershipObservationFactsV1,
 signature:ExistingCanonicalP256Signature}
```

signature는 기존 registration-proof의 canonical 64-byte P256 서명 표현과 ownership verifier를 사용한다. 새 서명 목적은 없다. report의 원 request 필드·factsHash·observedAt, facts의 원 process/job·PREPARED/everResumed:false·활성 수·원 image를 기존 검산기로 확인한다. fileSandboxVerified/killOnClose 의미도 기존 계약 그대로이며 이를 true로 바꾸지 않는다.

확정 COMMIT 뒤 결과의 정확 필드:

```text
{receiptRef:Ref, observationRef:Ref, headRef:Ref,
 acceptedAt:ISOInstant, executionAuthorized:false, dispatchPerformed:false}
```

서버가 받은 후보·보고서 자체가 아닌 **수용 원장 observationRef와 해당 head의 연결**을 반환한다. 후속 current가 이를 읽어 writer OWNED/osFence VERIFIED_CURRENT로 채택할 수 있는지는 이 후보에서 입증하지 않는다. 현재 정상 종단은 원 관측의 수용이며 grant/permit 허가가 아니다.

## 5. 거래·멱등·UNKNOWN·한도

- authority+consumeReceipt+localAttempt 단위로 request 하나만 허용한다. 같은 requestId와 같은 body hash는 최초 request/nonce/expiry를 그대로 반환한다. 다른 ID로 같은 consume의 window를 늘리거나 다른 candidate를 끼우면 409다. 만료된 request는 새 nonce로 자동 대체하지 않는다.
- request TTL이 지난 뒤에도 현재 인증·조회 권한이 유효한 동일 요청 재조회는 원 만료 request/nonce/expiry를 역사 결과로 반환할 수 있다. 이는 새 서명·관측 수용 허가가 아니다. 미수용 결과를 만료 request로 제출하면 412이며, 현재 등록/권한의 유효성이 원 request TTL을 되살리거나 늘리지 않는다. 이미 확정 수용된 동일 packet의 원 receipt 재조회와 신규 수용은 구분한다.
- 결과의 packet hash는 위 정확 result body의 canonical hash다. 같은 원 request/packet은 최초 receipt를 재조회할 수 있지만 새 관측·head·서명·factory를 만들지 않는다. 다른 packet은 충돌이다. 인증/현재 권한이 없으면 과거 결과 조회도 거절한다.
- candidate 발행은 authority/consume 및 ownership 슬롯을 직렬 검산한다. 수용은 nonce 미소비·원 binding·예상 head·등록/권위 기한을 같은 거래에서 재검산하고 observation/accepted event/head/원 결과를 원자 저장한다. DB 동시성 제약과 트리거는 앱 검사만으로 대체하지 않는다.
- request와 result의 동일 tuple 동시 호출은 하나의 원 결과로 수렴하거나 명시 충돌한다. 원장 UPDATE/DELETE, request nonce 재사용, 다른 execution/generation에 수용한 ref 재사용을 금지한다.
- COMMIT tag 불명, 응답 유실, native 관측/서명/close 불명은 UNKNOWN이다. 자동 재서명·새 requestId·factory 재실행·새 권위 발급으로 회복하지 않는다. 명시 재조회도 동일 packet만 사용하며 실제 효과를 모르면 UNKNOWN을 유지한다.
- host는 관측 반환 ATTEMPTED와 정확 request/body hash를 내구 기록하고 원 소유 process를 유지한다. 재시작에 원 retained identity를 복구·검증하지 못하면 관측을 만들어내지 않는다. 서버 receipt 확인은 OS process 종료 증명이 아니다.
- request 최대16KiB, result 최대64KiB, request 하나/consume 하나, report 기존 process 최대128개·TTL 최대10초를 권장한다. native 개별 frame/budget의 기존 한도를 넘으면 명시 거절하고 무한 chunk·기한 연장으로 우회하지 않는다.
- 400 형상 오류, 401/403 인증·목적 오류, 식별 전 균일404, 409 원 요청/packet 충돌, 412 현재성·기한·원근거 불일치, 503 공급자/거래 불명을 구분한다. 세부 원문·키·credential·경로·사용자 지시를 로그에 남기지 않는다.

## 6. 기존 원장 재사용과 별도 부모 연결

기존 `OWNERSHIP_OBSERVATION_RECORD`, OBSERVATION_ACCEPTED/ANCHOR_ADOPTED, nonce 소진·expectedHead·관측 서명 검산과 append-only 원장을 재사용한다. 새 서명/관측 원장을 평행하게 만들지 않는다.

단, 기존 synthetic staged의 PREPARATION_GRANTED는 `prepareOwnershipAnchor` command/receipt/audit를 검산한다. 새 native 준비/consume 기록을 그 과거 command인 것처럼 위조하지 않는다. normal 전용 부모 binding 분기는 실제 native authority→원 HUMAN command/receipt/audit→consumeReceipt→원 factory→candidate/request를 대조해야 한다. synthetic의 SYNTHETIC_NONE과 false 표식은 유지한다.

서버 bindingRef/결과 receipt의 정확 저장 위치·forward migration은 이 연결의 구현 설계로 결정하되, 기존 닫힌 event schema를 깨거나 새 데이터를 기존 payload에 몰래 넣지 않는다. 기존 표가 해당 부모 분기를 표현하지 못하면 최소 additive binding 저장을 설계·검토하고 그 SQL도 source 산출물로 남긴다. 기존 migration 수정·실제 DB 적용은 하지 않는다. 현재 SQL이 이미 이 경로를 수용한다고 주장하지 않는다.

## 7. 후속 CURRENT는 최초 반환과 분리

이 후보의 새 operation은 BOOTSTRAP_PREPARED 한 번만 허용한다. CURRENT는 이미 수용된 같은 anchor/process/head의 재관측이며 기존 계약상 RUNNING/everResumed:true를 요구한다. 최초 PREPARED facts를 CURRENT로 바꾸거나 그대로 osFence 최신 관측으로 재사용하지 않는다.

grant 발급 후 normal 실행 credential로 후속 요청을 전달할 후보는 있으나, 이번에 /commands의 원 outbox나 /observations의 일반 사건을 ownership 채널로 바꾸지 않는다. 현재성 보고·회수·UNKNOWN의 정확 후속 전송은 별도 단위로 남긴다. 최초 반환 구현만으로 NormalStartCurrent·앱 polling·실제 Agent 전체 연결 완료를 표시하지 않는다.

## 8. 최소 구현 지도와 검증

채택 후 Main이 정확 허용파일을 정한다. 다음은 영향 지도이며 지금의 쓰기 권한이 아니다.

- native authority/runtime schema와 기존 project-native-preparations/native-preparation-routes: v1 보존, v2 반환 목적·정확 두 target·부모 current 검산.
- 신규 normal ownership 반환 producer와 ownership-observation-staged/proof의 재사용 가능 검산: 실제 binding/request/nonce/관측/head/원 결과의 같은 거래 연결. 기존 synthetic 진입은 불변.
- native-preparation-owner-bridge와 원 retained factory 관측 source: 같은 일회 capability 계보를 보존한 관측. EMPTY_OBSERVED 대체0.
- owned host의 제한 ownership signer와 원 요청 전달 client: 기존 등록 SPKI·root/peer/current/기한, caller facts 서명0, 범용 서명0.
- 직접 합성 시험: 실제 prepare/consume source→원 request→RAM retained 관측/QA 서명→실제 수용 코드→원 observationRef/headRef 반환까지 검증한다. PREPARED만으로 grant/current/permit 허가를 만들지 않는 음성도 포함한다. DB·OS·실사용 키 실행이나 전체 부트스트랩 순환 해소의 증거가 아님.

필수 반례는 다른 authority/consume/localAttempt/execution/generation/등록/sourceScope/factory/process, hash·서명·nonce·head 불일치, 만료·회수·구세대, 후보만으로 VERIFIED 승격, 기존 v1의 새 target 접근, 같은 ID/다른 body, 동시 request/result, 일부쓰기 rollback, COMMIT/응답 유실과 UNKNOWN 뒤 자동 재실행0이다. 정상 result가 Agent 성공/실행 권한 bool을 만들지 않는 것도 확인한다.

추가 호환·위험 검사는 v1 서명 bytes 불변, v2 authorityRef의 원 snapshot 결박, v1/v2 교차 proof/authority/consume 거절, 잘못된 PID candidate가 창을 소진해도 관측 수용0·새 창 자동 생성0, 만료 원 request 역사 재조회와 신규 수용412·TTL 연장0이다.

## 9. 대안과 미채택 시 동작

- **A(권장)**: 준비 권위의 명시 v2 반환 operation과 위 두 target을 source 계약으로 채택한다. 최초 반환의 normal credential 의존성을 제거하고 관측/head 수용 source를 구체화한다. PREPARED→grant 허용 근거와 resume 선행 관계는 미확인으로 남으며 전체 순환 해소를 뜻하지 않는다.
- **B**: 두 operation을 완전히 동결하고 서버/host 내부의 별도 one-use 반환 capability를 설계한다. 여전히 추가 결과 반환 권한·보호 전달 형상 결정이 필요하며, ref만 받은 일반 callback은 대안이 아니다. 현 단계에서는 A보다 연결 계약이 더 간접적이다.
- **C**: 이 delta를 채택하지 않는다. 기존 준비·bootstrap/polling/adapter source는 보존하고 최초 ownership 반환/current 공급자는 미연결로 표시한다.

미채택 상태에서 제품·schema·실제 환경 변경0이다. 채택 후에도 실제 process/SDK 실행은 별도 정확 승인 대상이다. source rollback은 해당 구현 commit의 정상 revert이며 기존 v1 자료·원장 이력은 보존한다. 이 문서의 후보 필드·target·v2는 기존 채택 사실로 보고하지 않는다.
