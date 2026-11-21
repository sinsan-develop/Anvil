# FN09 S2 정상 DISCOVERY 결과의 보호 서명·전송 작업지시서

**목표** 같은 등록 실행기의 보호 출력에서 검산한 최초 탐색 메타데이터를 한 번 서명하고, 그 서명을 만든 native 부모의 정상 종료를 확인한 뒤 동일 패킷만 전송한다.

**기준** 통합 `76603f980840a93090b7fab53f767772497c991a`, [FN09 최초 이해 검토 A안](../contracts/FN09_NORMAL_INITIAL_UNDERSTANDING_RESPONSE_CANDIDATE.md) §3–5, [등록 수송 작업지시서](FN09_INITIAL_UNDERSTANDING_RESPONSE_TRANSPORT_IMPLEMENTATION.md) §3–7. PMO 확인 범위는 같은 Anvil·등록 signer·보호 root와 기존 ACL 안의 목적 한정 소스 및 합성 검증이다. 현재 별도 담당자가 완료하는 native 읽기 감독 및 서버 정착 결과의 정확 SHA는 착수 때 대조한다.

## 1. 허용 범위와 현재 선행

- 이번 단위는 `DISCOVERY_METADATA`만 다룬다. 기존의 `SESSION_ONLY`와 `wholeConversationComplete:false`를 유지한다. 사용자 선택 본문, `SELECT` ticket, 6항목 이해 검토, WORK 허가는 후속이다.
- 서버 수송 경로는 이미 정한 `POST /api/v1/connectors/:cid/executions/:eid/understanding-response-read/:requestId/result` 한 곳이다. 경로의 `requestId`는 HUMAN 탐색 `requestRef.id`이며, 별도 `EXECUTION_REQUEST` proof의 `requestId`는 새 challenge에 결박된다. GET challenge를 POST에 재사용하지 않는다. 기존 challenge와 result path 외의 endpoint나 권한을 추가하지 않는다.
- 현재 `normal-owned-spool-profile.ts`의 `prepareNormalUnderstandingResult`는 `SIGNING_UNAVAILABLE`에서 끝난다. `normal-credential-bootstrap-client.ts`와 `NormalExecutionCredentialSource.cs`의 일반 `PREPARE`·`REQUEST`는 result 경로를 명시적으로 거절한다. 미완성 공급자가 등록돼 있다는 사실로 이 거절을 해제하지 않는다.
- native 착수는 보호 출력 파일 닫기, 원 reader의 종료, 부모의 같은 원장 재잠금 및 `UNDERSTANDING_READ_CLOSED` 정착이 각각 검수된 이후다. S2 전송은 같은 서버의 목적 challenge와 결과 원자 정착을 둘 다 검수한 뒤에만 연결한다. 미공급 상태에서 제품의 발행·전송은 닫은 채 내부 단위만 합성으로 검산할 수 있다.
- 실제 C# 컴파일·로드, 보호 파일·키 읽기나 변경, 실제 DB·권한·서비스·SSH·SDK·Agent 실행은 이번 구현 검수 범위에서 제외한다. OS 종료와 보호 저장의 실효성, 실제 결과 전송·저장은 미검증으로 남긴다.

## 2. 소유권과 실행 순서

1. **원 파일 읽기와 원 자식 종료.** 같은 Anvil과 원 helper가 보호 원장 `UNDERSTANDING_PICKUP` 및 `UNDERSTANDING_READ_STARTED`를 정확히 결박한다. 읽기 전용 자식은 원 실행의 출력 prefix를 검산하고 원 fd를 닫는다. 원 부모가 자신이 실행한 동일 reader handle의 정상 종료·정상 코드·채널 완결을 검산한다. 파일 닫기 또는 자식의 자체 성공 선언으로 종료를 대체할 수 없다.
2. **원 부모에서 보호 종료와 한 번의 준비.** 같은 부모만 원장과 현재 등록·slot을 다시 잠그고 정확한 `UNDERSTANDING_READ_CLOSED`를 저장한다. 성공한 원 `CLOSE` 호출의 in-memory capability를 동일 native 객체에만 남긴다. 원 `CLOSE` 행 재조회, 임의 사본, 재시작 또는 새 호스트에서 capability를 재발급하지 않는다. 기존 `NORMAL_SPOOL_CLOSE`의 목적 분기 뒤 같은 물리 부모의 비공개 `NORMAL_EXECUTION_UNDERSTANDING_RESULT_PREPARE`에서 그 capability를 먼저 소비한다. 입력은 정확한 `attemptId,slotId,requestRef,acquisitionRef,bodyHash`이며 부모가 보관한 값과 다르면 거절한다. URI, 서명할 바이트, nonce, 권한 표시를 입력으로 받지 않는다.
3. **최초 POST challenge와 서명.** 부모가 보호 `CLOSE`의 원 목적·등록·slot·본문 해시로 POST 대상과 새 proof 요청 식별자를 직접 만든다. TLS/원 credential 및 등록 공개키의 기존 검산과 strict challenge 형상, proof/nonce 유일성, 발급 전후 현재성과 기한을 재사용한다. 원 HUMAN 요청·획득 영수증·CLOSE와 같은 범위임을 다시 확인한다. challenge/nonce는 이 POST만 소비할 수 있다. 서명된 proof와 `PREPARED` 원장 append·flush·정확 readback을 모두 확인하기 전에는 패킷을 반환하지 않는다.
4. **부모의 물리 종료 뒤 TS에서 비공개 공개.** `#openRoot` 내부에서만 준비 응답을 보류한다. `trust-key-host-client.cjs`의 원 child exit 0을 확인하는 실제 `host.close()`와 원 `AbortSignal`·활성 slot·목적 기한의 재검산을 통과한 때만 같은 소유 coordinator의 비공개 WeakMap ticket으로 공개한다. `credentialHost()`의 ALS 빌린 채널 종료는 물리 종료의 근거가 아니다. 이 단계에서 화면, 일반 renderer, 외부 Agent, 공개 API에 proof나 보존 자료를 반환하지 않는다. IPC 응답과 실제 종료 사이에는 네트워크 전송이 없다.
5. **같은 원장에 전송을 먼저 정착하고 한 번 전송.** 다음 같은 등록 보호 host는 `NORMAL_EXECUTION_UNDERSTANDING_RESULT_SEND`의 정확 목적 분기에서 원 packet만 받는다. `attemptId,slotId,requestRef,acquisitionRef,preparedHash,auth,body` 외에는 받지 않는다. 이 연산은 기존 제어 채널 frame 한도 안에서 수행하며, 추가 chunk 전송이 필요하면 기존 `NORMAL_EXECUTION_BEGIN/WRITE/EXECUTE`의 유계 전달만 목적별로 결박한다. 저장된 원 credential과 CA는 보호 host 내부에서만 다시 연다. 권한·원 해시·현재 기한을 검산하고 같은 보호 원장 잠금 안에서 `SEND_STARTED`가 없었음을 확인한다. 원 `SEND_STARTED` append·flush·readback·잠금 정상 해제를 확인한 뒤 같은 TLS target으로 한 번만 보낸다. 임의 path/query, 새 서명, 새 nonce, 새 payload는 받지 않는다.
6. **서버 보관 판정.** 보호 서버가 정확 nonce 소비·검산된 custody를 한 거래에서 정착한 결과만 보관으로 본다. 로컬 파일 닫기, reader 종료, 원 부모 종료, `PREPARED`, `SEND_STARTED`, HTTP 응답은 각각 고유한 증거로 유지한다. 보호 proof는 같은 등록 signer의 목적 사용을 인증하며 부모 종료 자체를 서버가 관측했다고 보고하지 않는다.

공통 유효기간은 원 pickup/요청/획득, 고정된 등록·자격·slot, 보호 host 호출 창, 해당 POST challenge 중 가장 짧은 기한이다. 저장소에서 확인한 실제 기한이 권위이며 입력된 시각으로 연장할 수 없다. 첫 출력 접근 전에 wall·monotonic 양쪽을 가장 짧은 기한에 결박하고 준비·부모 종료 확인·재개 금지 검산·전송까지 이어간다. 취소, 회수, 제어/등록/세대 변경, 보호 handle 및 원장 신원 변경 시에는 효과를 내기 전 닫는다.

## 3. 고정 원장과 보호 채널 형상

기존 `owned-spool-profile.v1`의 `management.v1`과 `owned-spool-profile.v1.head`를 같이 사용한다. 새 파일 종류, 저장 위치, 자격, 키, ACL을 추가하지 않는다. 기존 원장 레코드 envelope의 purpose/SID/root/namespace/file/head/sequence/previous 검산을 유지한다. 아래 두 새 row는 기존 출력 `RESERVED`·`SDK_READ_CLOSED`의 쓰기·재개 권위를 소비하지 않는다.

| 기록 | exact 키와 역할 |
| --- | --- |
| `UNDERSTANDING_RESULT_PREPARED` | `kind,key,allocation,host,closeHash,pickupHash,requestRef,acquisitionRef,recordHash,slotHash,slotId,slotReceiptRef,projectId,connectorId,executionId,executionGeneration,grantRef,credentialGeneration,challengeRef,proofRequestId,nonceDigest,bodyHash,packetHash,expiresAt`. `key`는 HUMAN `requestRef.id`다. `closeHash`와 `pickupHash`는 원 보호 행의 canonical SHA-256이다. `host`는 원 `CLOSE`의 보호 host 식별자다. `nonceDigest`는 기존 `serverNonceDigest` 생성 방식으로 계산한다. `packetHash`는 기존 DISCOVERY acquisition과 같은 canonical `{frame,target}`의 SHA-256이며 `frame`은 `auth`에서 검산한 원 proof 패킷이다. 동일 key의 이미 존재하는 PREPARED/STARTED는 새 준비를 차단한다. |
| `UNDERSTANDING_RESULT_SEND_STARTED` | `kind,key,preparedHash,requestRef,acquisitionRef,challengeRef,proofRequestId,bodyHash,packetHash,expiresAt`. `preparedHash`는 위 원 행 전체에 결박한다. 같은 `key`/`preparedHash`에서 최대 한 행이다. 이 행은 전송 시도를 소진하며 수신·서버 저장·현재 실행권을 표시하지 않는다. |

참조는 기존 exact `{id,version,contentHash}`, 시간은 기존 canonical UTC millisecond, digest는 기존 소문자 SHA-256을 쓴다. 보호 root/anchor, 현재 binding, 원 `CLOSE` 및 `PICKUP/STARTED` 계보, 고정 metadata prefix가 하나라도 다르면 복구로 대체하지 않고 거절한다. `challengeRef.id`/`proofRequestId`/`nonceDigest`는 원 GET과 분리한다. 일반 `execution-proof` 파일의 `{slotId,target,authHash,expiresAt,recordHash}`는 이 보관 근거로 취급하지 않는다.

준비 성공의 부모 IPC 데이터는 exact `{state,requestRef,acquisitionRef,preparedHash,auth,expiresAt}`이며 `state`는 `NATIVE_DISCOVERY_RESULT_PREPARED`다. `auth`는 기존 canonical `EXECUTION_REQUEST_PROOF` 패킷과 기존 base64url 인코딩을 쓴다. proof 경로, credential 세대, challenge와 nonce, query/body 해시를 독립 대조한다. `auth`와 `DISCOVERY_METADATA` canonical 본문은 부모 종료 검산 전후 모두 조립자의 유한 메모리에서만 유지한다. 보호 원장에 `auth`, bearer, 개인키, raw SDK/출력 본문, 경로, 원 SID를 저장하지 않는다. 최종 HTTPS에는 기존 닫힌 `{schemaVersion:1,kind:'DISCOVERY_METADATA',metadata}` 본문만 보내며, proof와 본문의 합계가 원 수송 2MiB를 넘으면 전송하지 않는다.

## 4. 기존 한도와 실패 정착

- `NormalExecutionSpoolProfileSource.cs:16–27,82–123`의 관리 원장은 모든 append에 **64MiB** 합계, 암호화된 행 최대 **32,768바이트**, 기존 예약을 포함한 `ManagementHold`를 적용한다. 행의 길이 표식 4바이트와 anchor 32바이트를 포함한 실제 합계를 같은 배타 잠금 아래 검산한다. 새 두 row는 관리 원장 이벤트로 이 공통 상한을 적용받는다. 기존 Output 전용 예약·관리 예산을 전용 전송 예약으로 재사용하지 않는다.
- 기존 `NormalExecutionCredentialSource.cs:468–489`의 고정 보호 파일 형식은 일반 proof를 포함해 생성 전 root 파일 수가 **1,024** 미만이고 기존 파일 합계가 **16MiB − 평문 길이 × 2** 이하인지 검사한다. proof 평문 **8,192바이트**, 읽기 암호문 **16,384바이트**, purpose/ID별 DPAPI 및 `CreateNew`/`Flush(true)`를 사용한다. `.execution-ca`의 별도 65,536/131,072바이트 한도를 결과로 옮기지 않는다. 이번 원장 방식은 그 파일을 추가하거나 proof 파일의 현재 형식·한도를 바꾸지 않는다.
- 기존 한도는 디스크 총량과 행 크기를 보장하며, `PREPARED` 후 별도 SEND 행의 공간까지 미리 보장하지 않는다. `SEND_STARTED`의 기존 한도·회수된 잠금·쓰기·확인 가운데 하나라도 실패하면 네트워크 전송은 0이다. SEND 공간을 선예약하거나 새 시간/건수 상한을 정해야 한다면 현재 방식과 다른 저장 계약이므로 필요한 정확 변경점으로 Main에 넘긴다.
- 기존 원장과 proof 파일은 만료 시 자동 삭제하지 않는다. 보호 기한은 사용 가능성 제한으로만 사용하며 새 보관 기간, 자동 정리, 재수거 권한을 추가하지 않는다. 재시작 이후 `CLOSE` 또는 `PREPARED`만 보여도 비공개 메모리 인계를 복구하거나 sender를 자동 기동하지 않는다.
- flush/readback/close 불명, 등록 회수, 늦게 도착한 응답, 취소, 만료, 동시 제출, 프로세스 교체는 원 기록의 불명 또는 거절로 남긴다. `SEND_STARTED`가 있었거나 그 기록 여부가 불명이면 자동 재시도·새 challenge·새 서명·새 패킷은 0이다. 네트워크 결과를 잃으면 서버 성공/실패를 단정하지 않는다. 기존에 명시적으로 허용된 동일 원 packet 복구 검증이 후속에서 연결되더라도 새 전송을 자동 시작할 권한을 부여하지 않는다.

## 5. 구현 순서와 허용 파일

### S2-R1 원 부모의 준비와 보호 원장 결박

- [ ] `apps/connector/native/NormalExecutionSpoolProfileSource.cs`에서 원 독립 reader 종료, 현재 결박, 기존 관리 원장 한도의 검산 뒤 단 한 번의 `PREPARED`를 허용한다. 두 read 단위의 미완결/현재성 규칙을 그대로 둔다.
- [ ] `apps/connector/native/NormalExecutionCredentialSource.cs`에서 원 in-memory capability를 소비하는 한정 PREPARE와, 원 보호 저장 안에서 exact `SEND_STARTED`를 소비하는 한정 SEND를 연결한다. 기존 `DesktopTrustKeyHostSource.cs`의 `NORMAL_EXECUTION_` 경로를 사용한다. native 감독·launcher·빌드 목록을 추가 변경할 근거가 필요한 경우 별도 파일을 임의 편집하지 않는다.
- [ ] `tests/desktop/normal-execution-credential-owner.test.cjs`와 `tests/unit/FN09/normal-understanding-native-supervision.test.ts`에서 동일 호스트만 준비, 물리 reader 종료·등록/slot·기한 누락 거절, 범용 PREPARE/REQUEST 유지, exact row 및 기존 관리 한도, 동시에 준비/전송한 경우의 단일 소진, flush/readback/close 불명에서 전송 0을 합성/정적으로 검산한다.

### S2-R2 물리 부모 종료와 실제 호출선의 한정 전송

- [ ] `apps/connector/runtime/normal-owned-spool-profile.ts`에서 원 CLOSE와 준비를 같은 물리 host에 결박하고 정상 `host.close()` 이전에는 ticket 노출 0을 보장한다. 기본 `credentialHost()`의 논리 close와 실제 부모 종료를 구분한다.
- [ ] `apps/connector/runtime/normal-credential-bootstrap-client.ts`, `apps/connector/runtime/normal-protected-post-client.ts`, `apps/desktop/scripts/native-proof-runtime-entry.mts`에서 exact purpose ticket, 같은 canonical UTF-8/기한과 등록 소유자를 전송까지 유지한다. 기존 generic POST, permit, observations 및 START/SEND/STOP은 그대로 소비한다. 별도 서버 소유자가 공급자/정착을 닫기 전에는 제품 release 또는 POST를 활성화하지 않는다.
- [ ] `tests/unit/FN09/normal-understanding-response-source.test.ts`, `tests/unit/FN08/normal-protected-post-client.test.ts` 및 기존 desktop owner 직접 시험에서 원 시스템/다른 host·slot/변조된 body·nonce·proof·과기에서 data 전송 0, 부모 exit 전·exit 불명/늦은 응답에서 ticket 0, peer 교체/재진입/복제에서 새 전송 0, 원 close 뒤 최초 전송만 검사한다. 보호 키·파일·실제 프로세스 대신 합성 owner/transport를 넣는다.

## 6. 인수·검수 기준

- [ ] 승인 기준선과 실제 통합 대상 SHA, 정확 수정 경로, 직접·인접 합성시험 명령 및 종료값, `npm run typecheck`, `git diff --check`를 Main에 반환한다. C#/Windows 실제 동작을 정적·RAM 검증으로 승격하지 않는다.
- [ ] 대상 작업의 저장 상태/POST 검증을 달리 보고한다. `PREPARED`는 로컬 준비, `SEND_STARTED`는 단회 시도 소진이며 서버 영수증을 대체할 수 없다. 기존 서버 challenge/정착 포트의 실제 미연결은 미완료로 표시한다.
- [ ] rollback은 목적 분기와 제품 조립을 닫고 이전 경로를 복원하는 코드 변경으로 제한한다. 소진·불명 원장은 보존한다. 파일 제거, 키 교체, migration 적용 또는 권한 회수는 이 rollback에 포함하지 않는다.
