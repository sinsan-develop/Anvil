# FN06/FN08 관측 HTTPS 계약·전송 코드 source 구현 지시서

2026-11-01 / Main 어울 / 기존 Primary 단일 writer / 기준 codex/av3-stage-b cf35023a1b2093792074abe7f74f9eebbc140016.

## 승인·목표
신산님 최신 직접 지시 ‘관측 HTTPS 계약과 FN14 Web의 코드·화면·합성 검증 구현을 승인해’를 근거로 관측 wire 후보 A안(SHA256 62E9B2D3E6D36489C2D7769BD8158B80E737A86D9FAA97A6035163FB3F4A00B3)을 채택한다. 후보 원문 §4~6은 이 지시서의 상세 계약이다. 실제 DB·권한·키·서비스·Agent 실행 제외, 실제 사용자/백업 자료 조사와 기존 프로젝트 차단 해제 제외는 유지한다.

실제 Node HTTPS 호출 코드를 구현하되 합성 request 대역으로만 검수한다. SDK/서버 repository/현재 등록·서명/보호 원기록/서비스 등록이 연결됐다고 주장하지 않는다. 가짜 성공 wrapper나 새 SYNTHETIC bridge로 실제 전송 코드를 대체하지 않는다.

## 정확 source/test 4경로
1. contracts/runtime/execution-observation-http-v1.ts (신규)
2. apps/connector/runtime/execution-observation-https.ts (신규)
3. tests/unit/FN08/execution-observation-http.test.ts (신규)
4. tests/unit/FN08/execution-observation-https.test.ts (신규)

기존 모델·C3 transport guard·provider-session-claim-v1·서버 main/실행 mode·기존 보호3·package/lock·SQL 불변. 추가 경로는 먼저 Main에게 정확 사유를 전달한다. Main은 채택 문서·WI·검수/상태만 쓴다. FN14 Web은 이4개 동결·검수 후 같은 writer가 별도 WI로 순차 수행한다. subagent commit/push0.

## wire 검산
- 후보의 정상 EXECUTION challenge/observations POST 2개만 허용한다. RECOVERY/heartbeat/credential 교환/START/SEND/permit/material/commands/stop·query·중복/인코딩 경로 변형은 거절한다.
- 기존 parseWireJson·canonical target/bodyHash·signature domain·nonce 의미를 재사용한다. raw whitespace hash로 바꾸지 않는다. challenge body는 원 exact 필드+signature, observations는 기존 events/batchHash다. 실제 event 발생·서명/nonce/credential/key/UUID를 생성하지 않는다.
- Bearer av3ex1_ 기존50문자 credential은 명시 private 입력만 받는다. Origin은 명시 HTTPS origin, Cookie는 빈 값도 거절한다. observations의 Anvil-Execution-Auth는 후보의 exact schemaVersion/challengeRef/proof/signature canonical base64url이며 decoded4KiB/encoded8KiB 한도다. proof는 기존 exact8필드, signature는 canonical base64 64bytes다. rawHeaders의 Authorization/Origin/Auth/Content-Type 중복·배열·다중값을 검사한다. challenge에 Auth header0.
- JSON 중복키/알 수 없는키/BOM/비정상UTF8/비정상수·버전/다른scope·target/기한/크기를 fail-closed로 거절한다. GET·다른operation·인증종류 fallback0. 알려진 credential·서명·원격 원문이 오류/공개반환에 새지 않도록 유한 코드만 남긴다.
- HTTP200 exact {schemaVersion:1,data}만 읽는다. challenge data/ref/id·원 requestId/grant/credentialGeneration/clientNonce·일반30초 기한을 검산한다. 공개challenge는 정확10필드이며 targetHash가 없다. scopeDigest를 grantRef로 발명하거나 ref.contentHash를 challenge JSON hash로 재계산하지 않는다. 기존 기대 scopeDigest가 명시되면 일치를 대조한다.
- observations는 proofResultRef/기존 ack snapshot의 execution/sequence·digest·gap·storedCount/refhash를 대조한다. nonceConsumed true의 형식이 서버 commit/현재 authority/실제 공급자 사실을 증명하지 않는다. client ackAudited/writerReleaseVerified/actualExecutionVerified/executionAuthorized/dispatchPerformed false를 유지한다. transport:SYNTHETIC_ONLY 모델을 응답에서 벗겨 성공시키지 않는다.

## Node 전송·불명 처리
- import/constructor IO0. 명시 origin/공개CA/scope/원요청·서명/credential만 받으며 파일·환경·실제 키를 읽거나 만들지 않는다. method 호출의 default driver는 node:https.request다. 테스트는 명시 request 대역만 사용한다. 실제 socket/API·localhost listener·실서비스0.
- HTTPS/제품port3830/origin일치·CA/hostname 검증(rejectUnauthorized:true)·agent:false를 고정한다. redirect/자동retry/쿠키/fallback0. TLS보안검사를 느슨하게 하는 옵션·환경 우회0.
- 전체 deadline은10초와 원요청/challenge/credential 명시 기한 중 최단이다. idle timeout만으로 전체 deadline을 대신하지 않는다. challenge 요청·응답16KiB, observations 요청·응답1MiB, 기존 events/ACK의 유한 상한을 보존한다. chunk 수신 중 상한 초과 즉시 거절·자기 request만 destroy한다. 정확 자기 timer/listener/response buffer를 회수하고 종료 후 늦은 response/data/error를 새 성공/미처리예외로 바꾸지 않는다.
- non200/malformed/timeout/abort/단절/종료 불명은 원 request/proof/event 식별을 유지한다. 새nonce/새UUID/새허가/자동재전송0. 형식 검사 실패나 전송 불명 후 중복 호출을 자동 실행하지 않는다. GC/OS quota/물리 문자열 소거·서버내구성 보증0.

## TDD·검수
1. TEST_ONLY로 신규2시험 작성·baseline을 보고한다. 신규module/export부재는 기능상 보안음성 검증과 구분한다. 기존 source/guard 불변 확인 후 Main PRODUCT_GO를 받는다.
2. 정상 challenge/observation의 기존 canonical target·원서명 바이트 보존, header encode/decode, exact envelope/ref/ACK scope·hash를 검사한다.
3. 중요 음성: 중복rawheader/unknownkey/JSON중복·query/다른scope·authkind/기한/버전/크기·에러비밀누출·redirect/retry/abort/timeout·조기/늦은 종료·원식별 유지. before/after request 수와 종료·timer회수도 검사한다. native socket 대신 fake request/response event emitter로 명시한다.
4. 변경4파일의 집중 시험과 실제 재사용에 영향받는 기존 canonical/target/challenge/ACK 시험만 선택한다. root typecheck·diff를 수행한다. 직접 영향 없는 전수검사/브라우저·실TLS/DB0. 기준/기대값 완화0.
5. 독립 spec/품질 검토 Critical/Important0과 Main fresh 검증 뒤 정확4 source/test+채택/검수/현황 문서를 기존 branch에 통합한다. 실제 TLS/등록/키·서명/원기록/PG/서비스·Agent·인수는 NOT_RUN, 전체 FN06/FN08/계획 완료는 아니다.

## 제출·복구
시작HEAD/상태·기준WI hash·정확변경diff/지문·명령/exit·RED→GREEN·음성·오류횟수·미실행/남은연결·live handle/PID정보를 보고한다. 실제효과없으므로 source 정상revert가 rollback이며 기존자료reset/force/새branch0이다. 새로운 scope·source 출처를 발명하거나 미검증을PASS로 표시하지 않는다.
