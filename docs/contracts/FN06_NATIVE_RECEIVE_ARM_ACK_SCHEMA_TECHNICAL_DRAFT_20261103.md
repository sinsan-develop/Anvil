# FN06 ARM·ACK typed 원형 기술보완 초안

2026-11-03. DRAFT / NOT_ADOPTED / SOURCE_GO0 / EXECUTION_GO0.
기존 Reviewer가 r1 기술검토 후 제시한 ARM/ACK 원형을 계산·정합검토용으로 고정한 자료다. 실제 source·API·DB·키·권한·서비스·Agent 실행을 승인하지 않는다. 원후보r1은별도보존한다.

## 공통

Ref={id,version,contentHash}; Recipient={installationId,projectId,registrationRef,connectorRef,hostPublicKeyFingerprint,credentialGeneration,channelProfileRef}; Target={method,path,queryHash,bodyHash}.

원제안의hostKeyFingerprint는Main이기존native의더긴hostPublicKeyFingerprint로통일했다. 모든object는exactkey,UUID/소문자hash64/ISO24/안전정수/32bytebase64urlnonce·P1363signature86의유한형식이다. Recipient.credentialGeneration은원등록세대이며아직없는NativeOnly세대가아니다. 권위생성전ARM과ATTEMPTED후ACK를별도원형으로검사한다.

## ARM

ArmBody={
 schemaVersion:1,purpose:"NATIVE_RECEIVE_ARM",armRequestId,
 recipient:Recipient,sessionRef,windowRef,offerRef,
 commandHash,recipientNonce,issuedAt,expiresAt
}

bindingRef/authorityRef/deliveryAttemptRef/deliveryId/opaqueCommitment는ARM에서필드자체가없다. null추가도거절한다. ARM은정확offer수신준비이며native명령승인/소비가아니다.

ArmChallengeSnapshot={
 schemaVersion:1,purpose:"NATIVE_RECEIVE_ARM_CHALLENGE",
 challengeId,challengeRequestId,challengeRequestHash,
 armRequestId,armBodyHash,recipient:Recipient,
 sessionRef,windowRef,offerRef,commandHash,recipientNonce,
 target:Target,serverNonce,issuedAt,expiresAt
}

ArmProof={
 schemaVersion:1,purpose:"NATIVE_RECEIVE_ARM_PROOF",
 proofRequestId,challengeRef,armRequestId,armBodyHash,
 sessionRef,windowRef,offerRef,commandHash,recipientNonce,serverNonce,
 target:Target,issuedAt,expiresAt
}
ArmRequest={body:ArmBody,proof:ArmProof,signature}

서명대상은canonicalArmProof전체다. target은고정ARM POST,bodyHash=hash(canonicalArmBody)다. 자기proof/signature를bodyhash에넣지않는다. 원ARM/offer/session/window/등록/profile/정책·challenge최대수명의min-only기한을쓴다.

ArmReceiptSnapshot={
 schemaVersion:1,purpose:"NATIVE_RECEIVE_ARM_RECEIPT",
 armId,armRequestId,requestHash,proofEvidenceRef,
 sessionRef,windowRef,offerRef,commandHash,recipientNonce,
 state:"ARMED",recordedAt,expiresAt
}
ArmResponse={receipt:{ref,snapshot:ArmReceiptSnapshot}}

서버는같은offer/head잠금에서현재성·단일ARM/원offerhash를검사하고receipt를저장한다. 같은요청은같은원receipt만반환한다.

## ACK

AckBody={
 schemaVersion:1,purpose:"NATIVE_RECEIVE_VOLATILE_ACK",ackRequestId,
 recipient:Recipient,sessionRef,windowRef,offerRef,commandHash,armReceiptRef,
 bindingRef,authorityRef,deliveryAttemptRef,deliveryId,recipientNonce,
 opaqueCommitment:{algorithm:"SHA256",digest},
 nativeCallExpiresAt,issuedAt,expiresAt
}

모든ref/ID는선재해야한다. commitment는recipient가실제수용한opaque43bytes의SHA256이며서버credentialdigest와비교한다. tuple은서명이결박한다. opaque원문은ACK·원장·HUMANJSON·IPC/UI에없다. nativeCallExpiresAt은원native호출의고정wall상한이며원서버단조deadline을대체/재생성하지않는다.

AckChallengeSnapshot={
 schemaVersion:1,purpose:"NATIVE_RECEIVE_ACK_CHALLENGE",
 challengeId,challengeRequestId,challengeRequestHash,
 ackRequestId,ackBodyHash,sessionRef,windowRef,offerRef,
 commandHash,bindingRef,authorityRef,deliveryAttemptRef,deliveryId,
 recipientNonce,opaqueCommitment,target:Target,nativeCallExpiresAt,
 serverNonce,issuedAt,expiresAt
}
AckProof={
 schemaVersion:1,purpose:"NATIVE_RECEIVE_ACK_PROOF",
 proofRequestId,challengeRef,ackRequestId,ackBodyHash,
 sessionRef,windowRef,offerRef,commandHash,bindingRef,authorityRef,
 deliveryAttemptRef,deliveryId,recipientNonce,opaqueCommitment,target:Target,
 nativeCallExpiresAt,serverNonce,issuedAt,expiresAt
}
AckRequest={body:AckBody,proof:AckProof,signature}

target은고정ACK POST,bodyHash=hash(canonicalAckBody)다. ACK요청에새10초를부여하지않는다.

AckSnapshot={
 schemaVersion:1,purpose:"NATIVE_RECEIVE_VOLATILE_ACK_RECORD",
 ackId,ackRequestId,requestHash,proofEvidenceRef,
 sessionRef,windowRef,offerRef,commandHash,armReceiptRef,
 bindingRef,authorityRef,deliveryAttemptRef,deliveryId,
 recipientNonce,opaqueCommitment,nativeCallExpiresAt,recordedAt,expiresAt
}
AckResponse={ack:{ref,snapshot:AckSnapshot},terminalEventRef}

성공응답은ACK기록과기존DELIVERY_CONFIRMED가같은후행Tx에서commit확인된경우만반환하는안이다. ACK접수만으로성공0·COMMIT불명은정확조회만이며secret/새ACK/새terminal생성0이다.

## challenge요청·서명증거

ArmChallengeRequest={
 schemaVersion:1,purpose:"NATIVE_RECEIVE_ARM_CHALLENGE_REQUEST",
 challengeRequestId,armBody:ArmBody,clientNonce,target:Target,issuedAt,expiresAt
}
AckChallengeRequest={
 schemaVersion:1,purpose:"NATIVE_RECEIVE_ACK_CHALLENGE_REQUEST",
 challengeRequestId,ackBody:AckBody,clientNonce,target:Target,
 nativeCallExpiresAt,issuedAt,expiresAt
}
SignedChallengeRequest={request,signature}

target은challengeendpoint/bodyHash는각armBody또는ackBody의hash다. 전체request서명은자기hash필드를포함하지않는다. 같은ID/같은원문은원challenge만,같은ID/다른원문또는다른ID/같은nonce는충돌이다.

ProofEvidenceSnapshot={
 schemaVersion:1,
 purpose:각ARM_CHALLENGE/ARM/ACK_CHALLENGE/ACK전용닫힌값,
 evidenceId,request:해당typedrequest또는proof,signature,
 requestHash,hostPublicKeyFingerprint,verifiedAt
}

키SPKI/profile/CA는각증거에복제하지않고보호ref/지문으로조회한다. verifiedAt은과거검산사실이며fresh검사를대체하지않는다. exactpurpose문자열과허용종류의최종표는아직확정전이다.

## 직접 검산·남은 정합

helper ARM은원보호root/REGISTERED키·recipient/private수신문맥·원offer/위임/commandhash·challenge/target/nonce/min기한을검사한다. 서버ARM은원session/window/offer·현재HUMAN허가/정책·원recipient생존·단일ARM을직접검사한다. 해시선언만권위로삼지않는다.

helper ACK는원소유slot실제수용후commitment·binding/authority/ATTEMPTED/deliveryId/nonce/원예산을검사한다. accepted:true JSON을신뢰하지않는다. 서버ACK는원credentialdigest·ATTEMPTED·stream/recipient/offer·현재성/nonce/기한을재검산한다. 보호slot→helpercaller의구체생산자는아직별도미완료다.

**원 deliver 호출선의 정합 검토 중:** 기존#deliverPrepared는supplier반환후terminalTx를실행한다. supplier가ACK HTTP성공응답을기다리고ACKendpoint가그terminal완료를기다리면교착된다. 검산된비공개ACKevent를원operation에먼저전달→원operation이ACK+terminal동시commit→그결과로endpoint응답완결하는소유·호출순서의실현성을Reviewer가검토중이다. 원operation부재/기한/COMMIT불명/미정착IO/미내구ackRef의표현을고정하기전구현가능하다고판정하지않는다.

새R행/byte·증거/receipt/terminal비용은이원형으로다시계산해야한다. 8KiB묶음·58row·192KiB예약을증명했다고표시하지않는다. 원미채택후보·Important9·실제실행제외를유지한다.


## 기술검토 후속 — 원형 바이트/응답 순서의 조건부 정리

이절은원형계산기준 SHA9C9424591EAB32C52A36482089C4B53CEBB364CFDBD2034FE367E81EE1BCC851 뒤의기술결과다. 위typed필드는바꾸지않았고아래내용은추가조건/미채택보완이다.

Reviewer는ACKendpoint가원operationterminal완료를기다리고supplier가같은ACKHTTP응답을기다리면교착됨을확인했다. 최소보완은HTTP응답과비공개ACK검산후보전달을분리하는것이다. 원operation의exacttuple/stream/원10초대기가후보를받고후행Tx에서ACK증거·nonce소비·CONFIRMED·offerterminal을같이commit한뒤ACK/HUMAN응답을완료한다. endpoint는DB/프로젝트잠금을보유채기다리지않는다. 기존supplier결과를내구성공으로바로보는대신module-private후보결과형/소유대기포트의내부변경이필요하다. 저장전후보ackRef는공개/current/허가근거가아니다. operation부재/종료·기한초과/COMMIT불명은새operation/재전달/가짜성공으로복구하지않는다. 실제코드·교착시험은미실행이다.

Primary는위exact필드에일반fullref153·purpose닫힌ASCII64이하·fixedpathASCII256이하·method4자이하라는조건을적용해ARM challenge/evidence2묶음7980bytes/3행,ACK묶음9619bytes/3행을산출했다. 따라서ARM8KiB는성립하고ACK8KiB는불성립한다. ACK만12KiB로예약하고ArmReceipt1361/AckSnapshot2245를별도각1행으로계산하는안을권장한다. opaque원문/CA/SPKI/프로필원문은원장에복제하지않는다.

이조건의offer계산상한은command2MiB+140942bytes이며추가192KiB에55666bytes여유가있다. **이는phase/STATE횟수·공통권한원장L의예산이나전체지적해소증명이아니다.** session26/window9/offer58row·STATE8회·사건수는여전히의미선택미채택조건이다. 공통명령/receipt/audit/승인소비비용L은별도Q에포함해야하고R/N에같은저장행을중복더하지않는다. 실제endpoint정본의길이·purpose값·receiverPrincipal·미정외피/새frame변경은별도확정및재계산조건이다.

원후보r1·이자료는DRAFT/NOT_ADOPTED·SOURCE_GO0/EXECUTION_GO0를유지한다. 원형/상태/예약기술안은source구현·실제키/DB/권한/서비스/Agent실행승인이아니다.


## 조건부 offer140942bytes의 항목별 합산식

아래는Main이수행자표에서재구성한명시합산식이다. phase/횟수/원형이아직미채택이므로실제기능수용가능성이나확정quota로쓰지않는다.

| 항목 | 가정 rows | command 이외 bytes |
|---|---:|---:|
| offer wrapper/내장위임 overhead | 1 | 3524 |
| ARM receipt | 1 | 1361 |
| command binding | 1 | 2245 |
| ACK record | 1 | 2245 |
| ARM challenge/evidence 묶음 | 3 | 8192 |
| ACK challenge/evidence 묶음 | 3 | 12288 |
| STATE challenge/evidence 최대8묶음 | 24 | 65536 |
| replay 최대10행 | 10 | 20840 |
| lifecycle 사건 최대12행 | 12 | 21096 |
| head | 1 | 1960 |
| reservation | 1 | 1655 |
| 합계 | 58 | **140942** |

따라서command actual bytes+140942라는식과192KiB추가예약여유55666은위목록의합산결과다. STATE8/사건12가의미적으로충분한지·공통L/원권한명령비용·receiverPrincipal/phase원형·누락종료기록·실프레임/응답상한은별도검토조건이다. 정의되지않은저장행을단순히표에서제외해서맞추지않는다.

길이조건의purpose/enum/path는고정허용목록의JSONescaping이필요없는문자만대상이다. ASCII길이만으로임의제어문자/따옴표/역슬래시를허용하지않는다. 위계산은소스모듈실행/제품시험/실DB·키/권한/서비스·Agent실행결과가아니다.
