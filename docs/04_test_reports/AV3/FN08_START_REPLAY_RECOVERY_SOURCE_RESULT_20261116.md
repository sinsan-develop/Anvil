# FN08 START 재수신 원 관측·ACK 복구 결과

기준 main2e64c062, branch codex/av3-fn08-start-replay-recovery. WI SHA256 0C4E56865C74FE961475DF32364C18825C9AB09867A0547846647254CDAB13D2. Primary 제품4경로 구현, Main 검수·통합. 기존 계약 안의 내부 호출 연결이며 공개 API/SQL/권한/원장 형상 변경은 없다.

## 동작

변경 전 모든 START 재수신에서 자료 GET을 먼저 수행해, 응답 내구 기록과 서버 관측 저장이 끝났더라도 자료 GET 실패가 ACK 복구를 막았다. 변경 후 현재 page의 등록/context/봉투·전체 descriptor와 저장 부분 bytes를 검산하고 같은 시도 잠금에서 완전 수신 fullref와 시도행 receivedRef를 대조한다. 완전 수신이면 불필요 GET을 생략하며 최초 시도는 기존 startMaterials 전체 원문 검산·current·permit을 거친다. NONE/정상 부분 수신+시도0은 기존 수신을 재개한다. 시도행 있음+수신 없음/불완전/손상/다른 fullref이면 새 실행 없이 UNKNOWN으로 보존한다.

역사 RESPONSE는 원 ref/시각으로 관측을 복구한다. ACK 유실 뒤 새 polling에서 추가 자료 GET·permit·wire0, 원 사건5개 보존·중복저장0·연속 ACK coverage 뒤 cursor 전진을 확인했다. PERMIT_RECORDED에서 중단된 시도는 기존 UNKNOWN 기록/관측을 복구하고 ACK 뒤에도 cursor0이다. 만료/회수 credential은 관측 POST와 cursor를 열지 않는다. 과거 permit은 현재 실행권위가 아니다. 기존 start(envelope,signal) 직접 호출의 입력/반환은 보존하고 page-aware 진입만 추가했다. import 시 원 intake 메서드를 고정해 인스턴스 메서드 교체로 수신 ref 검산을 우회하지 못한다.

## 검증

- RED 0e2e0e exit1/1F: wire1/permit1·서버 관측5/ACK1 저장 뒤 응답 유실, 로컬 coverage=false·자료GET차단 재시작이 UNKNOWN에서 멈췄다. GREEN d0bfdd 1P.
- node --experimental-strip-types --experimental-test-module-mocks --test tests/unit/FN08/normal-start-polling-journey.test.ts — bc8e3f exit0/10P/0F/0SKIP/17191.5549ms. 중간 PERMIT 원장 재시작과 메서드 교체 거절을 최종 소스에서 확인했다.
- 같은 옵션으로 normal-start-polling.test.ts, normal-start-coordinator.test.ts, normal-start-execution-journey.test.ts, normal-start-materials-journey.test.ts — dd3110 exit0/34P/0F/0SKIP/20811.9509ms. 최종 메서드 고정 전 인접 결과이며 그 delta는 위 최종 직접 시험의 교체 반례로 별도 확인했다.
- npm run typecheck — 6d817d exit0. diffcheck30f3c8 exit0.
- Main 최초680ba5는 test-module-mocks 옵션 누락으로 mock.module 미지원, 기능 시험 진입 전1F였다. 정확 옵션으로 ae706d의 ACK유실 복구 핵심1P/0F/0SKIP/exit0/3804.1249ms를 확인했다. 원 실패를 숨기지 않는다.
- 독립 최종 C0/I0/M0. 초기 M1은 partial수신과 중간 attempt 증거 구분이었고, 실제 coordinator가 남긴 PERMIT_RECORDED를 새 polling으로 UNKNOWN/ACK/cursor0까지 연결한 시험으로 해소했다. live0.

기존 둘째 자료 GET 실패 fixture는 완전 수신의 재GET 생략과 충돌하여, 둘째 item의 재해시된 다른 manifestRef 충돌로 바꿨다. 첫 효과/둘째 거절·cursor0·재시작 wire1 단언은 유지했다. 기대값 완화나 검증 생략이 아니다.

## 동결 지문

- normal-start-intake.ts SHA256 67F6E559703D1120CC8B968B79A082524EECC5DE6150B24BB492D1E04E89EB2C
- normal-start-coordinator.ts SHA256 2A43E32767BDC23A611160E07FF9C577909D8B772FC5061D7F46E12C9F6E46EF
- normal-start-polling.ts SHA256 9A2820D222D85FD4161862CFFCFF40F909C64C4A3F322184B228A88E8C52D20D
- normal-start-polling-journey.test.ts SHA256 3D5F8782807045D340CB091D8A967518A7D455B661521880BD4F90B81E27824C

실제 OS/DB/SDK/Agent·서비스·사용자 인수는 미검증이며 전체 FN08/계획은 미완료다. RAM 포트 외 실제 DB/권한/키/파일실자료/서비스/SDK/Agent/P03 실행0. rollback은4경로 한정 diff 역적용이다. 다음은 데스크톱 owner 보호credential을 같은 번들의 GET/POST쌍으로 조립하는 내부 연결을 검토한다.
