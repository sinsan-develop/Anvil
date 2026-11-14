# D1 normal polling 내부 조합 검수

판정: 소스·합성 단위 검수. 전체 D1/작업계획·실제 Agent/UI 완료 아님.
기준: main ab1fab0165446fbbadf067f4ac2be0e68a0229ac, codex/av3-d1-normal-polling.
근거: 채택 P3 결정안 §3.1 단계3. 기존 Primary 구현, Main 검수·통합, 독립 d2_scope_audit/d2_preflight 읽기 검수.

## 동작과 범위

신규 NormalStartPolling은 GET→자료 검산·내구 RECEIVED→기존 coordinator의 permit/wire→관측 spool/ACK를 직렬 연결한다. 페이지 전체 처리와 ACK 성공 뒤에만 sequence/cursor를 함께 승격한다. 최초 빈 page는0/no-cursor를 유지한다. 결과 불명은 후속 page·자동 갱신·중복 wire를 막는다.

run/renew는 단일 실행이며 owner 변경·abort·기한·최대 page 수를 검사한다. 서버 waitMs=0을 사용하고 host 밖에서 제한 대기한다. 개별 host·GET/POST/current/wire 기존 한도는 그대로이고 여러 요청 묶음은 run/credential 잔여기한으로 제한한다.

명시 renew 뒤 새 GET/POST와 coordinator를 사용하며 기존 intake/store/spool/ACK는 유지한다. cursor는0부터 읽는다. 잔여 시간이 부족한 NEEDS_RENEWAL은 renewalNotBefore로 실제 만료 시점을 구분하고, 만료 전 갱신은 거절한다.

변경: 신규 runtime normal-start-polling.ts, 직접 시험2개, 기존 normal-start-execution-fixture.ts의 기본불변 선택형 미수신 시작/기존포트 반환. 기존 제품 수정·공개API/DB/권한 계약 변경0.

## 검증

- 구현자 신규모듈 부재 RED→기본4P, aggregate 누락 RED→집중1P. 최종 신규2파일12P/0F/0SKIP9572ms. 인접 coordinator permit 응답유실1P4574ms. 루트 typecheck exit0.
- Main 동결지문 직접검사: `node --experimental-test-module-mocks --test --test-reporter=spec tests/unit/FN08/normal-start-polling.test.ts tests/unit/FN08/normal-start-polling-journey.test.ts` exit0/12P/0F/0SKIP9499.545ms. diffcheck0.
- 독립 최종 C0/I0. aggregate spool I1은 두 sync 묶음에 기한 적용을 바로잡아 해소했다. 개별 요청 제한을 늘리지 않았다.
- 최초 Node strip-only parameter-property 오류1회와 시험 overload 타입진단1회는 각각 일반 필드 선언/type cast로 보완했다. pause 중 유실 출력은 통과로 계산하지 않았다. Node experimental module mocking 경고 유지.

## 입증 범위·한계

실제 제품 서버 핸들러·runtime과 RAM 저장/합성 HTTPS/wire를 조합했다. 정상 START→wire1→ACK, 재시작/갱신 wire추가0·permit1, 자료 실패/UNKNOWN cursor보존, 갱신 후 새credential 관측POST1·pending5·ACK1을 단언한다.

부분 page와 hasMore는 codec 이후 명시 fault injection이다. 실제 서버가 두 명령 page를 만들었다는 증거가 아니다. C#·DPAPI·native/실키·DB·서비스·Agent·사용자 화면은 미실행/미검증이며 보호파일 생성0이다. 기존 SYNTHETIC_ONLY adapter 표식을 바꾸지 않았다. 실제 current/wire 공급자 연결은 남아 있다.

## 복구·다음

이번 소스·시험 묶음 일반 revert. 실제 DB/서비스 변경이 없어 환경 rollback은 없다. 다음은 기존 코딩 Agent의 normal START transport source와 실제 앱 진입점 연결의 남은 범위를 채택 계약에 대조한다. 실제 실행은 별도 승인 범위다.
