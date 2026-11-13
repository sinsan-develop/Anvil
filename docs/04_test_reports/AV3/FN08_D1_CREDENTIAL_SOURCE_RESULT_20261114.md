# D1 최초 credential 보호 연결 source 검수

상태: source·합성 검수 완료, 통합 준비. 전체 계획/D1 완료 아님.
기준 main418d70ca, 작업 branch codex/av3-d1-credential-exchange.

## 범위
기존 P3 §3.1 D1 3단계 채택에 따른 최초교환·보호저장·제한사용 source와 합성검증이다. 기존 single writer developer_primary, Main 관리·검수·통합이다. 실제 DB·권한·키·보호파일·서비스·Agent·native 컴파일은 제외한다.

## 현재 연결과 잔여
- 별도 normal native slot·ownedhost 제한연산과 TypeScript broker/GET·POST 연결을 구현 중이다. 일반SIGN_PROOF/평문token export를 열지 않는다.
- host 10초·64operation·64KiB 제한을 유지하고, bounded chunk의 총량·순번·hash·handle·기한을 검산한다.
- caller full grant snapshot 운반 의존을 제거했다. 최초 challenge에서 최소 binding을 직접 받아 현재 등록·키·실행/credential 세대와 대조한다. 실제 native 실행은 미검증이다.
- 최초challenge bootstrapBinding 공개계약은 신산님 직접 채택됐다(승인원문 SHA088F7058…6A36327). 정확 예약 SELECT와 현재성 재검산으로 응답을 연결하고 native 직접 HTTPS 응답을 소비한다.
- 같은grant 재교환·실제 adapter·SEND/STOP·실제PG/native/Agent 여정은 남는다.

## 중간 검수
- grant등록 지문 필드 mismatch 발견 뒤 실제 producer hostPublicKeyFingerprint로 보완.
- C# 복수 implicit var 선언 CS0819 source 오류 발견·분리 보완. 실제컴파일증거 없음.
- owned 요청에서 명시CA가 무시되는 문제 발견. 명시PEM 보호슬롯/hash와 요청별 검증으로 보완 중이며 실제TLS는 미검증.
- PREPARE응답검산이 operation 밖에서 실패해UNKNOWN봉인누락: 검산실패 이후유효경로호출0 시험으로 보완 중.

## 현재 시험 증거
구현자 제출: 실제제품 START·challenge·교환·명령조회 handler를 잇는 여정1P. SQL/HTTPS/native/보호파일은 RAM 대역이며 C#알고리즘은 JS fakehost가 재구현하므로 C#실행증거가 아니다.
broker4P/native source결박1P는 중간제출, 최종지문/Main검사와 구분한다. typecheck 최종결과와 변경영향묶음은 진행중이다.

## 복구
source 일반 revert. 실제환경전환 없음. 과거worktree·WIP·공유node_modules는 보존한다.

## Main 동결 후 검증
7파일 29P/0F/0SKIP, 8929.7049ms, 타입검사 exit0. 기존 REQUEST 직접 인접과 build 목록검사는 구현자 제출에 별도 있다. PE fixture의 동일 baseline 실패는 조사 중이며 통과로 처리하지 않는다.

## 최종 보완과 owner 연결
앞선 중간 기록의 필드/CS0819/CA/UNKNOWN 지적은 모두 보완했고 독립 native·server/runtime 최종 C0/I0이다. 추가 체인 검사는 전달된 중간CA와 고정CA를 memory store에 넣고 cache-only·AIA/auto-root-update 금지로 구성한다. 요청별 hostname/EKU/time/root 검산을 유지한다. 실제 OS handshake 전체 시간은 미검증이다.
실제 trust-enrollment-owner가 createTrustOperation/current/open lease를 통해 실제 bootstrap bundle·host client를 연결한다. 새 호스트마다 REGISTERED 원기록·epoch/context·키·현재성을 검산하고 정상 close와 abort를 구분한다. 임의 signer/URL/token export는 없다.
Main 추가 owner/bundle2파일 23P/0F/0SKIP,1493.7021ms. 최대 encoded2,812,587바이트는 합성 child를 사용한 실제host client 62frames≤64로 확인했다. 추가 후typecheck exit0/diffcheck0. 실제 native child/키/DB/서비스/Agent는 실행하지 않았다.

## 실패와 환경 구분
기존 PE 시험은 nested checkout에서 pe-library를 찾지 못해 실패했다. 기준418d70ca 원문도 동일했다. 검증기나fixture를 바꾸지 않고 기존 outer apps/desktop/node_modules/pe-library1.0.1만 registerHooks resolver로 지정한 시험9P/0F/0SKIP(exit0). 원 실패를 소급 통과하지 않는다. 설치/junction/권한 변경0.
초기 POST fixture TTL60초 오류는 기존30초기준에맞춰 보완했다. module mocking 플래그누락과TS추론오류도수정했으며 제품기준완화없다. 정상owner close가abort로판정되던추가연결오류는수명분리로해소했다.

## 다음 미완료
같은grant 재교환, polling/실제 adapter 및 SEND/STOP, 실제native컴파일/DPAPI/TLS/DB/Agent 여정. 제품 source 연결과 실환경 사용가능을 구분한다. 이번검사는 전체계획 완료가 아니다.

- 최종 owner 동결 SHA CAC577F90B02BB9B8CFEA250456A41BEC11D473B10051FF41E7DD875C2DEB2D0, 추가독립 C0/I0. 기존15파일지문불변 확인. 생성 bundle loader는기존고정경로방식과동일하며 직접2P/기존등록서명3P 구현자확인.
- 별도 desktop tsconfig 전체는 current179/baseline179 진단, newDiagnostics[] 메모리 compilerHost 비교exit0. 기존dependency/generated모듈/CJS진단은남아있으며 desktop전체타입검사PASS가아니다. 루트타입검사는PASS. 실제native컴파일은이번승인에서제외한채source검수범위만통합한다.
- 정확24파일stage diffcheck0, 신규C#·CJS의Git LF→CRLF정책경고는별도기록. 실제키/DB/서비스/Agent0, 전체계획미완료. 복구는이변경묶음일반revert.
