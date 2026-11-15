# FN07 SDK 세션 출력 소비자 소스 검증 결과

채택 계약 86A46140DADB38CB31C9B94957E5C836532ACE8093B10A062622B3FE93E7EC9E §4·6, WI 5D7CC3CADF16A8E87316C2CE26114A1B53B71F88B82126F1AE313BC29CCD2A88. 기준 브랜치는 `codex/av3-fn07-normal-query-output`, 시작 커밋은 `c43610ca122f0dd9ea2d3e9fdc5acc98ad109481`이다. 담당자는 Primary다. WORK_STATUS와 Git 통합은 Main이 소유한다.

## 변경과 판정

- `apps/connector/runtime/normal-sdk-session-output.ts` 신규. 원 owner·생성 시도·Query·iterator 객체와 scope를 대조하고, 같은 iterator를 직렬 소비한다. 소비자는 iterator를 추가로 취득하지 않는다. 원문 검산과 codec의 동기 capture 뒤 전체 canonical UTF-8 bytes를 base64로 보존하고 원행을 재판독한다. 확인행은 원 prefix 순번·tail·digest, 원 scope 및 계획/관측 SID digest에 결박된다. 원행을 수정하지 않는다.
- `tests/unit/FN07/normal-sdk-session-output.test.ts` 신규. 실제 소비자와 기존 codec을 RAM 거래·예약·분류·현재성 포트 및 합성 iterable로 구동했다. 원 등록, 운영 파일 정착, 정산 권위는 해당 시험에서 생산하지 않는다.
- 정상 반환에는 SESSION_ONLY 출력 fullref와 init 확인행 fullref, processRef=null을 제공한다. same owner의 init 증거는 객체 identity를 확인해 한 번 소비한다. 실제 SDK 입력수락, 특정 SEND에 대한 답변, 업무 완료, 프로세스 소유는 검증 대상 밖이다.
- 예비행과 격리행도 순번·점유·해시 체인에 들어간다. 민감 assistant/미분류 error result의 전체 bytes와 예약을 확인했다. init 확인 뒤에도 두 격리행의 일반 영수증은 0개였다. 분류 포트의 민감자료 탐지율은 미검증이다.
- 각 next 전 확인행을 포함한 최악 데이터량과 관리 비용을 예약한다. 채널 3MiB 파일, 64MiB/10000행, 정상 실행 공동 256MiB를 검산한다. append·sync·재판독·strict close·정산 실패에서 추가 next 0, 결과 영수증 0, RAM 원 예약 보존을 확인했다. 같은 SDK 식별의 정착 행만 중복 재사용한다.

## 직접 검증

| 실행 명령 | 증거 | 결과 |
| --- | --- | --- |
| `node --experimental-strip-types --test tests/unit/FN07/normal-sdk-session-output.test.ts` | e71c8c → ac93f5 | 구현 전 모듈 미존재 RED 1F → 최초 정상흐름 1P |
| `node --experimental-strip-types --test --test-name-pattern="재취득하지" tests/unit/FN07/normal-sdk-session-output.test.ts` | 7d729b | 추가 취득 RED 1F, 관측 2회/기대 1회 |
| `node --experimental-strip-types --test tests/unit/FN07/normal-sdk-session-output.test.ts` | b20e1a | I1 보완 전 직접 25P/0F/0SKIP, exit 0, 499.431ms |
| `node --experimental-strip-types --test tests/unit/FN07/claude-sdk-message-codec.test.ts` | 3f8a71 | 기존 codec 17P/0F/0SKIP, exit 0, 343.1633ms |
| `npm run typecheck` | a16975→abdff3, 2b0651→406145 | 최초 TS18047 1건·TS2532 3건. null 분기 종료와 시험 결과 인덱스를 명시한 뒤 최종 exit 0·진단 0 |
| `git diff --check` 및 신규 파일 UTF-8/LF·줄끝 공백·마지막 개행 직접 대조 | a6c5c9 | exit 0 |

직접 시험에는 init 선후, 전체 assistant·success/error result bytes, 원문 유지·prefix 누락/교체·부모 변경, 다른 SID·중복 충돌, 위조/재사용 init 증거, 불명 시 추가 호출 0, 동시 두 owner의 공동 예약 경쟁, 관리 비용 부족·채널 요건, 기한/시각후퇴·취소·소유 상실과 늦은 결과가 포함된다. 기존 codec 인접 시험에서 임의 thenable·getter 미실행, 입력 형상·식별 상한 및 동기 capture 경계를 확인했다.

## I1 보완 전 지문과 잔여 선행

| 파일 | SHA256 |
| --- | --- |
| normal-sdk-session-output.ts | 959244FD0ACA34521EB9224E39FC3FD82D97DB600E3D3AFA67721F2763650466 |
| normal-sdk-session-output.test.ts | 10FF0348D22FBCC06DD9863D6D20EA25DE03EED3CFB5AC88C10C680AFFDBCF7C |

판정은 독립 RAM 소비자와 기존 codec의 소스 검증 범위다. 9E98 보호 profile은 별도 미채택이며 실제 5번째 SDK_SESSION_OUTPUT 채널·native 등록 owner·예약/정산·배정 생산자와 desktop 활성화는 미지원이다. 원 SDK Query/iterator 발급·module/hook, 첫 SEND yield와 init 정착 증거의 결합, 실 SDK/OS child는 후속 범위다. 실제 DB·권한·키·사용자 파일·서비스·SDK/Agent/C#·추가 SDK 조회·P03은 실행하지 않았다. 롤백 대상은 이번 신규 소비자와 직접 시험이며, 이전 START 체크포인트와 원 보호자료는 그대로 보존한다.

## 최종 보완과 동결

독립 검수 I1은 같은 Query·iterator·생성 시도를 소비자 둘이 동시에 소유할 수 있는 생성자 재진입 문제였다. 기존 구현에서 중복 검사와 WeakSet 등록 사이에 호출한 current 또는 clock이 생성자를 동기 재호출하면 두 인스턴스가 성공했다. 세 객체의 형상을 확인하고 WeakSet 중복 검사와 선점을 연속으로 처리한 뒤에만 현재성·시각·codec 초기화를 수행하도록 바꿨다. 선점 이후 초기화가 실패해도 원 객체의 선점은 유지된다. 옵션의 origin과 iterator의 next 접근자는 호출 없이 거절하며, 정상 상속 데이터 메서드는 사용할 수 있다.

| 실행 명령 | 증거 | 결과 |
| --- | --- | --- |
| `node --experimental-strip-types --test --test-name-pattern="생성자" tests/unit/FN07/normal-sdk-session-output.test.ts` | d3d71d | 수정 전 4F, exit 1. current/clock 재진입, 최초 clock 실패 이후 재구성, 접근자 진입 |
| `node --experimental-strip-types --test tests/unit/FN07/normal-sdk-session-output.test.ts` | 86e91d | 최종 29P/0F/0SKIP, exit 0, 329.7606ms |
| `npm run typecheck` | 299f9d→02d00c | 최종 exit 0, 진단 0 |

중복 생성자 성공 0, 원 소비자의 실제 RAM iterator.next 호출 1회, 초기화 실패 뒤 재구성 0회를 확인했다. 기존 codec 인접 17P는 앞 회차에서 실행한 결과다. 최종 동결 제품 SHA256은 `F5AFF10518482D9A60422C8C1C04365BCE7B5F81F986F09438747F2F07CA0D1E`, 직접시험 SHA256은 `F4807D0768765E74C32679D40725FC8AF64D305B9F48DE92D317519475F8DAA9`이다. 실제 SDK/등록/보호저장 검증 범위는 앞 절과 같다.
