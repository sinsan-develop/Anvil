# FN06 OPEN 이후 HUMAN 보호 current 소스 작업지시서
2026-11-05 Main 어울. 상태: 직접 채택 기록 / 단일 writer 순차 구현.
## 1. 직접 승인과 고정 기준
신산님이 비동기 질문 call_e9d657ed2c54493786f052abe63e8297의 item0에 “A안 계약·source-only 구현 채택”이라고 답했다.
승인 대상은 docs/contracts/FN06_POST_OPEN_PHASE_CURRENT_HUMAN_CANDIDATE_20261105.md,12016B·SHA256 011C3C221E5DDB8086D7FB8A11214C29C0EAC9E6C956840E1BC5325CE53C281C이다. 원 후보의 DRAFT 문구는 승인 전 이력으로 보존하고 이 결박이 채택 사실을 기록한다.
부모 패킷682A51DACA51FAD9525B4DB34AB62DCDD99B0D5DC63A2B1BCA1ACC211F2CA24E, wire6D1A727FB60298C4ADCC37CE5066B4032F144E6F42B8A0B74F023D8AF56E83F4, 기존 통제 §114~118을 유지한다.
현재 문서 checkpoint는4ef4570a50ef89dbfab8ce52e8d35a1dd378482d이며 제품 소스는 GET3 구현 중이다. 시작 기준은 그 GET3를 검수·보존한 실제 후속 commit을 Main이 통제 문서에 기록한 뒤 고정한다. 임의 이전 소스 덮어쓰기0.
## 2. 담당과 순서
기존 fn16_primary_recovered만 제품·시험 writer다. 다른 작업자가 같은 경로를 쓰지 않는다. Main은 문서·검수·직접 최소검증·통합을 맡는다.
먼저 기존 GET3 단위를 안정 지문과 독립 검수·집중 시험으로 마무리해 분리 보존한다. 그 뒤 이 지시서를 읽기 검토해 Critical/Important0인 상태에서 다음 구현을 순차 착수한다. 이미 완료한 OPEN·Delivery를 다시 만들지 않는다.
새 공개 HUMAN read→실제 SD/Node current 생산→strict 응답/parser→typed non-OPEN frame→등록 owner/key-host source validator→원 HTTPS 소비의 실제 호출선을 연결한다. 실제 실행을 시작하지 않는다.
기존 Web S5는 독립 승인 작업이며 Main이 파일 충돌·선행을 확인해 다음 순서를 정한다. 이 후보의 채택으로 ACK bodyHash나 실제 실행의 미채택 경계를 넘지 않는다.
## 3. 정확 허용 파일
아래는 부모 허용목록의 부분집합이다. 필요한 파일만 최소 수정한다. 목록 밖 파일이 필요하면 정확 호출선·최소 diff와 이유를 쓰기 전에 Main에 반환한다.
1. contracts/runtime/native-first-receive-v1.ts
2. apps/server/modules/executions/native-first-receive-input.ts
3. apps/server/modules/executions/native-first-receive-store.ts
4. apps/server/modules/executions/native-first-receive-profile.ts
5. apps/server/modules/executions/native-first-receive-service.ts
6. apps/server/modules/executions/native-first-receive-routes.ts
7. apps/server/modules/executions/project-native-preparations.ts
8. apps/server/modules/executions/native-preparation-current-source.ts
9. apps/server/modules/connections/project-registration-reads.ts
10. db/migrations/0076_native_first_receive.sql.pending
11. apps/connector/runtime/native-first-receive-client.ts
12. apps/connector/runtime/native-preparation-https.ts
13. apps/desktop/src/native-first-receive-client.cjs
14. apps/desktop/src/trust-enrollment-owner.cjs
15. apps/desktop/src/trust-key-host-client.cjs
16. apps/connector/native/DesktopTrustKeyHostSource.cs
17. tests/unit/FN06/native-first-receive-contract.test.ts
18. tests/unit/FN06/native-first-receive-store.test.ts
19. tests/unit/FN06/native-first-receive-routes.test.ts
20. tests/unit/FN06/native-first-receive-schema.test.ts
21. tests/unit/FN06/native-first-receive-client.test.ts
22. tests/desktop/native-first-receive-owner.test.cjs
23. tests/desktop/desktop-trust-registration.test.cjs
24. tests/desktop/native-proof-runtime-build.test.cjs
25. tests/native/FN06/NativeFirstReceiveHostSourceTests.cs
26. tests/native/FN06/DesktopTrustKeyHostSourceTests.cs
Main 기록 파일과 이 지시서는 Main 소유다. 공용 인증·기존 SQL·Git 설정·다른 업무 코드는 수정하지 않는다.
## 4. 구현 필수 조건
새 endpoint·입력/응답 exact 원형은 승인 후보 그대로다. 원 HUMAN cookie·CSRF·원 SID·OWNER/controller·명시 readNativePreparationAuthority AUTO와 실제 Session/Challenge fullref를 검사한다.
phase는 실제 Challenge에서 결정한다. receive-only bearer 확대·저장 digest의 소지 증명 전용·검증된 native proof lease 합성0이다. 실제 SD/Node 근거를 목적 한정 읽기로 재사용한다.
pre-Binding의 원 writer와 BOUND/ATTEMPTED의 실제 RESERVED writer를 구분한다. 원 Window/ref·명령 hash는 바꾸지 않는다. 실제 N/Delivery closure와 모든 최소기한을 검산한다.
정상4 phase와 모든 거절은 후보의 첫사용/null 표를 따른다. STATE/CLOSE proof의 optional ref를 current의 Binding/Delivery ref로 채우지 않는다. fresh current에 replay/CLOSED 예외를 옮기지 않는다.
조회 저장효과0, 일반 인증 bookkeeping만 기존대로다. 기존 OPEN/current·다른 SIGN 목적·원 키·공개 오류·runtime export8/closure14/builtin3·IPC 원형을 보존한다.
같은 Challenge의 UNKNOWN은 새 current/frame/source 객체로 재서명하거나 자동 재전송하지 않는다. 원 시도와 canonical proof를 보존한다.
기존 control8192B·HTTP2097152B·CA65536B·key-host 전체65536B·깊이64와 원 기한을 높이지 않는다. typed 최대 ARM8572B/body332B이며 ProfileRead 전체 HTTP cap은 별도로 강제한다.
## 5. TDD·검수
기능 부재의 실제 RED를 먼저 확인하고 단위별 정상/중요 음성을 GREEN으로 만든다. 실제 Store/Service/route·typed builder·원 signer/HTTPS 소비를 합성으로 연결하고 효과 카운터0을 검산한다.
원 SID/actor/client/control·정책·다른 hash/ref/target·소진 Challenge·terminal·기한·중간 문맥 변경·source 미구성·BOUND writer/Delivery·cap·UNKNOWN 반례를 해당 변경 범위에서 확인한다.
직접/인접 선택 시험·타입·필요 문법·메모리 제품 빌드만 실행한다. 불변 시험을 반복하거나 전체회귀를 기본 gate로 늘리지 않는다. 기대값·기준 완화와 skip 승격0이다.
C# 파일은 코드·source 형상 시험만 허용하며 컴파일/로드/실행은 하지 않는다. 실제 DB/SQL/Tx/RLS·TLS·OS·브라우저·Agent 검증은 NOT_RUN이다.
검수용 안정 파일별 bytes/SHA256·정확 명령/종료코드/결과·실패 원인·미검증·원 rollback을 제출한다. 독립 C/I0과 Main 직접 검증 전 완료로 표시하지 않는다.
## 6. 제외와 복구
실제 DB 접속·SQL 적용·권한/정책/회원 부여·키/인증서/credential 발급·서비스/네트워크·C# 컴파일/helper·Agent/비용·J3/P03 R3·실자료 조사·Oracle/운영·Git 복구는 제외한다.
되돌리기는 이 소스 변경의 한정 revert다. 실제 DB/runtime 변경은 없다. 기존 미커밋·비추적·후보와 다른 업무는 보존한다.
