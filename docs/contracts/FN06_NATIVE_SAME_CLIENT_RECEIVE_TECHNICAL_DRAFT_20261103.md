# FN06 같은-client 최초 수신 — 기존 세션 재사용 기술 대조
2026-11-03 · Main 어울 / 기존 Primary 읽기 검토

**TECHNICAL_DRAFT / NOT_ADOPTED / SOURCE_GO0 / EXECUTION_GO0**.
이 문서는 신규 인증·공개 계약의 채택안이 아니다. 기존 승인 구현을 재승인 대상으로 돌리지 않으며, 전체 위임 후보 R2의 미정 사항을 해결했다고 주장하지 않는다.

## 목적과 현황
기존 코딩 Agent에 일을 보내는 연결의 누락 생산자를 특정한다. UI05/FN12 과거 검수 페이지는 private 6b40370cdb36b48af566421405a612512bad46fb에 보존됐고 반복 구현·검사하지 않는다. 다음은 FN06의 실제 최초 수신 공급·조립이다.

기존 source는 다음을 갖고 있다.
- desktop shell이 동일 main 소유 Electron Session을 원격 화면과 등록 HUMAN 조회에 사용한다. 원 Session receiver·view/origin/generation/authEpoch를 지키며 cookie를 꺼내지 않는다.
- 기존 /api/v1/session은 CSRF를 반환한다. 이를 main 내부에서 소비하는 연결은 아직 없으며, 추가한다면 모든 await 뒤 같은 문맥·기한 검사가 필요하다.
- NativePreparationHttpsChannel은 발급된 authority와 NATIVE_PREPARATION_ONLY purpose가 먼저 있어야 한다. current/challenges/consume 채널이며 최초 OPEN을 대신하지 않는다.
- 기존 Node HTTPS driver·고정 origin/CA/hostname 검사 방식은 재사용할 수 있다. agent:false인 호출을 동일 TCP 연결이라고 부르지 않는다.
- credential slot의 accept는 void다. 휘발 수용이며 ACK·영속 보관·실제 실행 성공이 아니다.
- 서버의 ATTEMPTED 선COMMIT·최대1회 전달·후행 결과와 원 총10초 제한은 보존한다.

실제 원 등록 session은 connector_registrations.session_id에 내부 보존되고 등록 저장 시 실제 session.id와 결박된다. 공개 subject에는 session ID가 없으므로 그 값으로 원 세션을 추정하지 않는다. catalogue 전용 profile을 native 통신 권위로 전용하지 않는다.

## 접근 비교
| 구간 | 혼합 경로 권장안 | Session.fetch 전용 대안 |
|---|---|---|
| 기존 HUMAN 로그인 | main 소유 Session.fetch로 기존 등록/CSRF·신규 challenge 준비 | 같은 Session 사용 |
| 최초 수신 인증 | 원 HUMAN 문맥을 서버 challenge에 내부 결박하고 별도 typed 등록키 proof로 Node OPEN | cookie가 있는 Session 요청과 등록키 proof를 함께 사용 |
| 민감 frame | 별도 Node 고정 HTTPS 수신 instance에만 전달 | 같은 Session의 응답·다른 소비자 경계 입증 필요 |
| 기존 채널 재사용 | TLS/driver 내부 재사용. 기존 authority 이후 채널을 bootstrap으로 사용하지 않음 | 기존 등록 client 그대로는 불가 |
| 새 의미 | challenge-bound 인증·전용 수신 proof/credential·profile/ACK | 신규 endpoint/proof·민감 전달 경계·profile/ACK |

혼합 경로의 OPEN은 cookie·CSRF를 다시 전달하지 않는 제안이다. 따라서 challenge 발급 때 검사한 원 auth session·actor/client·credential/control·등록·정책을 OPEN에서도 현재 값으로 검산하는 새 인증 계약이다. 기존 승인을 근거로 암묵 채택하지 않는다. Session.fetch 전용 방식을 불가능하다고 단정하지도 않는다. service worker 개입은 이번 source 조사로 입증하지 않았다.

## 바꾸면 안 되는 조건
원 사용자·session·client·credential/control세대·등록·정책/DENY·물리 writer·sourceScopeHash를 실제 대조한다. caller boolean이나 delegation으로 basis.current=false를 덮지 않는다.
수신 credential은 기존 NativeOnly bearer·StatusOnly와 목적을 분리하고 main 메모리 밖 저장/remoteWeb·IPC 반환을 금지한다.
서명 본문은 고정 typed 필드·원 challenge/nonce·정확 method/path/query/body hash·기한을 검산한다. 기존 등록 SIGN이나 authority 이후 native SIGN을 최초 OPEN proof로 전용하지 않는다.
ACK는 원 receiver/binding/delivery/authority·commitment·nonce·기한의 검산 결과여야 한다. 수용 뒤 ACK/COMMIT 불명은 재전달·재발급하지 않고 원 결과 조회로 남긴다.
재시작·재연결로 옛 수신권·원 예산·원 세대를 복구하지 않는다. 교차-client/mobile 수신은 남은 요구이며 이번 같은-client 순서 제안으로 삭제하지 않는다.

## 첫 수직 단위의 실제 caller 제안
현재 로컬 preload에는 등록용 API만 있고 native receive 시작자는 없다. 원 prepareNative 명령의 생성·승인·전송은 NativeBoundaryPreparationPanel과 native-boundary-preparation-api의 Web 경로에 있다. main이 원 명령을 대신 전송하는 새 기능은 추가하지 않는다.

| 순서 | 담당·제안 | 권한과 결과 |
|---|---|---|
| 1 | 로컬 명시 한 명령 수신 준비 IPC. requestId/attemptId/epoch만 입력하고 project/등록/키/origin은 원 main binding에서 획득 | 수신 준비일 뿐 native 발급·실행 허가 아님 |
| 2 | main의 HUMAN profile/CSRF/challenge와 typed proof/Node OPEN | 같은 원 session/user/client/control·등록·최소기한 검산 |
| 3 | Web의 원 선택지·명령 생성·필요 승인 흐름 | 최종 command 전체 hash를 그대로 사용 |
| 4 | 새 보호 receiver 조회·명령 binding/ARM | 정확 하나의 원 세션/등록 receiver만 허용. 최신 pending 임의선택 금지. 승인 현재성 검사는 가능하나 원 일회 승인 소비는 기존 실제 native 명령에서만 수행 |
| 5 | 기존 Web 명시 저장/native POST와 새 binding fullref header | ARMED·정확 commandHash·원 문맥을 검산. 기존10초 안에 ARM 대기를 숨겨 넣거나 예산 연장하지 않음 |
| 6 | 원 ATTEMPTED 선COMMIT·한 번 delivery·검산 ACK·후행 저장 | accept(void)나 전송 완료를 CONFIRMED로 간주하지 않음. 불명 결과는 원 결과 조회만 허용 |

로컬 상태/종료 IPC는 원 attempt/epoch에만 한정한다. CLOSE는 이미 진행한 전달·DB 작업의 정착 또는 성공 회수를 보증하지 않는다. 이 로컬 일회 준비는 첫 source 단위이며 매 명령 PC 조작을 최종 제품 해법으로 삼지 않는다. 일반 브라우저·모바일 최초 시작/교차-client는 남은 요구다.

## 구현 전 남은 한정 사항
1. local UI와 원격 Web 중 최초 receive를 누가 시작하고 원 prepare 명령을 누가 보내는지, 같은 원 요청으로 묶는 실제 caller/IPC 경계.
2. profile 발급원·보호 배포 기준·현행/회수·후퇴 방지의 권위. 임의 JSON/environment나 catalogue cast 불가.
3. 정확 endpoint·wire/error·본문 크기·수신 수명/개수·예약/ACK 이력 원자성과 유한 정리.
4. 같은-client 원 로그인 재사용과 새 등록키 수신 서명 의미의 정확한 변경분.

이 네 항목이 정리되기 전 새 구현 승인을 요청하지 않는다. Main은 기존 Primary에게 1번의 좁은 읽기 대조를 맡겼다. 모든 실제 DB·키·권한·서비스·Agent·제품 네트워크·OS/helper 실행, 사용자 자료 조사는 제외한다.

## 읽기 근거
- apps/desktop/src/shell.cjs
- apps/desktop/src/trust-registration-client.cjs
- apps/desktop/src/trust-enrollment-owner.cjs
- apps/connector/runtime/native-preparation-https.ts
- apps/connector/runtime/native-preparation-credential-slot.ts
- apps/server/modules/connections/project-registrations.ts
- apps/server/modules/connections/project-registration-reads.ts
- apps/server/modules/executions/native-preparation-current-source.ts
- apps/server/modules/executions/project-native-preparations.ts
- apps/server/modules/access/routes.ts
- docs/contracts/FN06_NATIVE_RECEIVE_DELEGATION_DELIVERY_CANDIDATE_20261103_R2.md

제품/시험/미적용 SQL 쓰기0·새 외부 자원0. 기술 대조는 실제 보호 통로·Agent 실행 성공이나 전체 계획 완료 증거가 아니다.
