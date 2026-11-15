# FN08 후속 SEND 입력 제공의 로컬 종단 후보 A

**미채택 · source-only 결정 후보.** 채택본 [FN07 normal Query 출력·소유 §3~4](FN07_NORMAL_QUERY_OUTPUT_OWNERSHIP_CANDIDATE_20261116.md)의 SHA-256은 `86A46140DADB38CB31C9B94957E5C836532ACE8093B10A062622B3FE93E7EC9E`다. 이번 결정 대상은 살아 있는 같은 Query에 **후속 SEND 한 건의 입력이 실제 제공됐음**을 어떤 로컬 행으로 남기고 언제 명령 페이지를 진행할지다. 미채택 상태에서는 새 긍정 종단을 사용하지 않는다.

## 1. 사실과 원 세션

첫 SEND는 원 입력의 첫 yield와 같은 Query의 init 확인을 모두 요구한다. 후속 SEND는 새 Query·출력 iterator·init 확인을 생성하지 않는다. 원 등록 worker가 보유한 같은 live Query의 입력 포트에 이번 명령 전용 일회 iterable을 제공하고, 해당 iterable이 검산한 사용자 메시지를 실제로 한 번 내준 경우만 입력 제공으로 인정한다. 입력 포트 호출이나 반환만으로 영수증을 발급하지 않는다. 해당 호출의 오류·취소·결과불명은 성공으로 닫지 않는다. SDK 수락, 해당 SEND의 응답, 작업 완료는 미확인이며 시간상 인접한 assistant/result는 기존 `SESSION_ONLY`로 남긴다.

현재 `normal-first-send-owner.ts`의 lease는 live Query·iterator·output을 유지하지만 첫 SEND 원장을 정확히 다시 열 키와 첫 종단 fullref를 함께 보관하지 않는다. A안은 첫 SEND 4행의 append·sync·재판독·거래 정상 닫힘 뒤 owner commit에서 **첫 envelope의 receiptKeyV1**(projectId/executionId/executionGeneration/commandId), envelopeHash, 첫 종단 fullref, 원 START 준비 fullref, init 확인 fullref를 동일 worker·Query의 private lease에 고정한다. 첫 전송의 실제 원 envelope·자료와 기존 보호 원장을 그 키로 재대조한다. 부모 원장을 현재 SEND 거래에서 역순 중첩 잠금하거나 caller가 건넨 임의 키로 여는 일을 피한다. 읽기 전후 원 lease·원행 불변성을 검산한다. 재시작 시 부모 키는 역사 검산용이며 live handle을 재발급하지 않는다.

## 2. 후속 행 형상과 전이

현재 SEND 전용 원장의 세 번째 `SEND_DISPATCH_ATTEMPTED`가 정착된 뒤에만 새 목적의 네 번째 행 `LIVE_SEND_INPUT_YIELDED`를 허용한다. 첫 SEND 키와 현재 키는 달라야 한다. 기존 4행 공통 snapshot의 sequence/state/key/envelopeHash/grantRef/sessionBindingRef/receivedRef/previousRef/permit/proofResultRef/recordedAt/localAttemptRef/dispatchAttemptRef/responseRef/processRef를 유지한다. sequence는 4, previousRef와 dispatchAttemptRef는 현 3행 fullref, responseRef와 processRef는 null이다. 새 목적에만 다음 필드를 둔다.

| 필드 | 검산 원천 |
|---|---|
| `registrationRef`, `startReadyRef` | 원 START와 현재 SEND의 등록 fullref, 같은 READY·세대·grant·논리 session |
| `firstSendKey`, `firstEnvelopeHash`, `firstTerminalRef`, `initConfirmationRef` | live 입력 전과 역사 재생 모두 첫 SEND 부모 원장 전체가 정확히 4행이며 마지막 상태가 `FIRST_SEND_INPUT_AND_INIT_RECORDED`이고 마지막 행의 fullref가 `firstTerminalRef`와 일치해야 한다. 그 종단에 결박된 원 init 확인도 대조한다. 모든 ref는 id/version/contentHash 전체를 비교 |
| `inputEvidence` | 현 dispatchAttemptRef, instructionRef, partsRef, instructionDigest(원 자료 bytes의 SHA-256), messageDigest(이번 실제 yield 메시지의 기존 bounded SDK canonical digest). 원 session·worker·Query·현재 SEND 시도에 묶인 일회 private 증표로만 만들며 공개 JSON 복제로 발급하지 않음 |

행 ref는 기존 방식의 신규 UUID·version 1·canonical snapshot SHA-256이다. 등록·grant·정책/현재 permit·시도·기한·원 수신 자료를 현 명령 기준으로 다시 검산한다. 원 instruction bytes·SDK 메시지 본문·SDK SID·별도 실행 권한은 행에 넣지 않는다. 기존 FIRST·generic RESPONSE·UNKNOWN의 exact 형상과 기존 행의 판독을 유지한다.

## 3. 경합·복구·페이지 진행

같은 live owner에는 한 번에 한 입력만 진입한다. STOP이 먼저 owner를 점유하거나 현재성·허가·기한이 먼저 사라지면 새 입력을 제공하지 않는다. 이미 yield 경계를 넘었는데 정상 정착 전에 STOP·취소·오류가 뒤따르면 추가 yield 없이 불명을 보존한다. STOP의 기존 단발 interrupt·종료 미확인 계약은 유지한다.

4행의 append·sync·원 행 재판독·거래 정상 닫힘 후 기존 spool에서 **해당 SEND의 RECEIVED·PREPARED·PERMIT_RECORDED 전체**를 원 command/envelope/record ref로 재구성하고 마지막 필수 관측까지 연속 ACK coverage를 검산한다. 3행과 새 4행은 로컬 전용이다. 페이지의 모든 항목이 각 기존 종단·ACK 규칙을 만족할 때만 cursor를 진행한다. 부분 ACK는 원 관측의 기존 sync/재대조 경로만 사용한다. 역사 판독은 원 SEND와 첫 부모의 키·원행·자료 digest·시각을 재검산하며 정상 4행과 ACK로만 진행한다. 행 소실·변조·닫힘 불명·UNKNOWN에서는 원기록 보존, cursor 진행과 추가 Query·입력 전송은 0회다. ACK는 입력 제공 바이트에 대한 서버 영수증이 아니다. 서버가 이 로컬 사실을 새로 조회하거나 표시하는 기능은 없다.

## 4. 합성 검수와 제외

- 처음과 다른 명령 하나를 같은 live Query에 한 번 yield한 뒤 정확한 4행과 기존 연속 ACK를 확인한다. 원 입력이 pull되지 않음, 2차 pull, yield 후 호출 실패, 증표 복제·소실, 부모 fullref 교체를 각각 검사한다. 같은 iterable의 재판독으로 두 번째 입력을 제공하지 않는다. 부모의 첫 4행이 일치해도 뒤에 UNKNOWN 5행이나 다른 추가행이 있거나 전체 행수·최종 상태가 불명이면 live 입력과 역사 cursor 진행은 모두 0회다.
- 두 후속 SEND와 STOP의 경합, 등록·session·grant·permit 변경, 정착 전후 기한 만료, sync/readback/close 불명, 부분·다른 명령 ACK에서 입력 중복과 cursor 오진행을 검사한다. 정상 4행을 재시작으로 읽어도 새 입력·Query·iterator 생성은 0회다.
- 공개 API·서버 이벤트·SQL·권한 변경은 없다. 실제 SDK module/hook과 live 입력 포트의 검증, CURRENT 생산자, 미채택 보호 spool `9E98…`의 profile·배정은 미지원이다. RAM 결과는 실제 SDK 수락·보호 저장·종료·업무 완료의 증거가 아니다.
