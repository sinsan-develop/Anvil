# FN07 normal START 준비 인수 소스 검증 결과

## 판정

원 worker의 START 자료 인수, 세 번째 로컬 준비행, 마지막 필수 관측의 보호 ACK를 RAM 여정에서 연결했다. 최종 직접 41건·메모리 번들 12건·인접 선택 3건, 합계 56건 통과, 실패·취소·skip 0건이다. 루트 타입 검사와 변경 파일 공백 검사 종료 코드는 0이다.

기준은 `codex/av3-fn07-normal-query-output`의 시작 HEAD `3c420b4157a77d7da08ac80d9c07cc642dbb581d`와 직접 채택본 `86A46140DADB38CB31C9B94957E5C836532ACE8093B10A062622B3FE93E7EC9E`다. 시작 시 Main의 WORK_STATUS와 WI가 변경 상태였다. 최초 WI `C973AD4DC2C5FB925684BE84E29FC81544C5AD27E25FDEE005AC469A6D3BE87F`에서 제품 4·시험 4로 시작했다. Main이 범위를 조정한 r2 WI는 `1C99552B6F3FF9EA803A658BC3C154D18C6E4E01E16F4296C86684BBD3F17C7C`다.

## 변경과 오류 이력

- 최초 단독 RED는 정상 여정 1건 실패였다. 기존 wire에 `forWorker`가 없어 첫 구성에서 TypeError가 났다. 같은 단독 명령으로 정상 인수·ACK·재시작을 확인했다.
- 최초 GREEN 뒤 읽기 검토에서 초안의 외부 validator 주입이 옵션 검산을 건너뛸 수 있음을 확인했다. 그 helper를 제거했다. `NormalClaudeStartWire.forWorker`가 원 자료와 current/permit/옵션을 재검산하면서 원 worker의 private 슬롯에 입력을 인계하고 일회 객체를 발급한다. 고정 소비 함수는 원객체·동일 wire·원 grant·입력·부모·기한과 두 자료를 확인한다. 실제로 인수한 슬롯은 소비 후에도 유지한다. 준비경로에서 일반 driver 호출은 없다.
- coordinator에서 원 wire의 고정 검산기를 참조한다. 역방향 import는 type-only다. 이 직접 의존성으로 CJS 원본 목록의 끝에 wire/start-options/schemas/execution-material-receiver 네 소스를 추가했다. r2의 추가 쓰기는 build 스크립트와 해당 시험 두 파일이다. 메모리 import 효과 0, 원본 43·export 17·builtin 4·출력 2MiB 상한 검사를 유지했다. 합성 receiver를 normal owner로 등록하는 경로는 없다.
- 기존 START의 3행 상한 안에서 `START_READY_RECORDED`는 3번째 행에서만 읽는다. previousRef·permit·receivedRef를 대조하며 responseRef/processRef는 null이다. 새 목적과 그 역사만 같은 명령 잠금 거래에서 엄격한 닫힘을 요청한다. 새 결과는 저장 callback **밖**에서 실제 close 성공과 기한을 확인한다. close 불명 시험은 원 lock 보존·재진입 거절·추가 close 0을 확인했다. 기존 generic exclusive의 닫힘 동작은 보존했다.
- 자료 PREPARED를 포함한 네 사건의 원 시각과 fullref를 재사용한다. 준비행을 서버에 발행하지 않는다. polling은 PERMIT_RECORDED의 **spool ref**를 고정해 해당 순번까지 ACK된 뒤 START cursor를 전진시킨다. 201번째 사건이 permit인 시험에서 서버는 순번 200과 201까지 각각 저장했다. 두 번째 응답 유실 직후 클라이언트는 ACK 200·cursor 0을 유지했다. 재시작에서 같은 201건을 확인하고 추가 자료 GET·wire·permit 없이 cursor를 진행했다. 기존 RESPONSE의 다섯 사건, 중단된 시도, SEND·STOP의 cursor 조건도 검사했다.

제품·시험 10파일 기준 diff는 253줄 추가·28줄 삭제다. 이 결과서는 별도 신규 파일이다.

## 실행 명령과 관측

| 검사 | 결과·원 기록 |
|---|---|
| RED → 최초 GREEN | 0P/1F exit 1 `a8cb37` → 1P exit 0 `2cf10b`. r2 구현 단독 1P `0fa49a` |
| 위조·다른 모듈·닫힘·정상 인수 집중 | 7P exit 0 `f5ddde`. 201번째 permit 집중 1P exit 0 `c57cf6` |
| 직접 네 파일 | 41P/0F/0SKIP, 18439.2501 ms, exit 0. session 25148 종단 `dacb03` |
| 인접 START/SEND·STOP | 실제 선택 3P/0F/0SKIP, 7686.596 ms, exit 0 `18427e` |
| 메모리 build·고정 산출물 검산 | 12P/0F/0SKIP, 1945.0987 ms, exit 0 `dff328` |
| 루트 typecheck·공백 | tsc 진단 0, session 6716 종단 `34c730` exit 0. diff exit 0 `414e55`, CJS 두 파일에 Git 체크아웃 줄끝 안내만 출력 |

최종 합계는 마지막 직접·인접·build 묶음만 집계했다.

```powershell
node --experimental-strip-types --experimental-test-module-mocks --test --test-name-pattern="원 worker START 준비 인수" tests/unit/FN08/normal-start-polling-journey.test.ts
node --experimental-strip-types --experimental-test-module-mocks --test --test-name-pattern="준비 인수의 원 증표|다른 모듈 인스턴스|START 준비" tests/unit/FN08/normal-claude-start-wire-journey.test.ts tests/unit/FN08/normal-start-file-store.test.ts tests/unit/FN08/normal-start-coordinator.test.ts tests/unit/FN08/normal-start-polling-journey.test.ts
node --experimental-strip-types --experimental-test-module-mocks --test --test-name-pattern="준비 permit 사건" tests/unit/FN08/normal-start-polling-journey.test.ts
node --experimental-strip-types --experimental-test-module-mocks --test --test-reporter=spec tests/unit/FN08/normal-claude-start-wire-journey.test.ts tests/unit/FN08/normal-start-coordinator.test.ts tests/unit/FN08/normal-start-file-store.test.ts tests/unit/FN08/normal-start-polling-journey.test.ts
node --experimental-strip-types --experimental-test-module-mocks --test "--test-name-pattern=원 START/SEND 혼합 page|STOP.*ACK|역사 STOP" tests/unit/FN08/normal-instruction-polling-journey.test.ts tests/unit/FN08/normal-stop-polling-journey.test.ts
node --test tests/desktop/native-proof-runtime-build.test.cjs
npm run typecheck
git diff --check -- apps/connector/adapters/secondary/normal-start-wire.ts apps/connector/runtime/normal-start-coordinator.ts apps/connector/runtime/normal-start-file-store.ts apps/connector/runtime/normal-start-polling.ts apps/desktop/scripts/native-proof-runtime-build.cjs tests/unit/FN08/normal-claude-start-wire-journey.test.ts tests/unit/FN08/normal-start-coordinator.test.ts tests/unit/FN08/normal-start-file-store.test.ts tests/unit/FN08/normal-start-polling-journey.test.ts tests/desktop/native-proof-runtime-build.test.cjs
```

## 동결 지문

아래 값은 작업트리 파일 바이트의 SHA256이다.

```text
apps/connector/adapters/secondary/normal-start-wire.ts 5A9A7960CD5328BB11898A0E47A00ED9E13AE5B44A2F5246AD591AE600BC7E0C
apps/connector/runtime/normal-start-coordinator.ts 9A174CCDECC48A80888969866C6BB3B81858905CC84A009EC94B632700EDD7AF
apps/connector/runtime/normal-start-file-store.ts FF880FCD16098C002111A03EB863D4E5D5E7732B928D65BA7D0660658223C9C1
apps/connector/runtime/normal-start-polling.ts D04F34B6AB42971ABD27416FFDA54BA690F8D0B2D6D3215E7997D78BA631827D
apps/desktop/scripts/native-proof-runtime-build.cjs 7921D06D3A131C301950E866628D3467C11E894805588B92ACFDDBF7D3EF3C4E
tests/unit/FN08/normal-claude-start-wire-journey.test.ts 38DAE876EAC3D6514B1ABB42DAA6D78C5AA07C2B786A33930836A8FAD5532873
tests/unit/FN08/normal-start-coordinator.test.ts 125D1850BDB85CFDC4BF2A5EB1FA867BB2035C144A837FFE7AF20D14E7E40DD1
tests/unit/FN08/normal-start-file-store.test.ts C7B7821F385AEB182B4609DC7E34FAED54E4E92F85BC54B7FCF10BAB36FB2C3C
tests/unit/FN08/normal-start-polling-journey.test.ts 6ECB9F9FF9C998F1576845E7C2CEA2D64567EA79D97418FBD2EC2C3C41E7AF5E
tests/desktop/native-proof-runtime-build.test.cjs 1CFAEEB897B9A0AC62E54BD4E9392F49B848C7110F9B78115F99D648B4A6687E
```

## 미검증·후속

실제 SDK/Agent/OS child/C#·DB·키·권한·서비스·사용자/백업 파일·P03을 실행하거나 추가 SDK 조회를 하지 않았다. RAM 자료 및 합성 current·전송 포트의 결과다. Vite는 지정 소스만 읽어 메모리 CJS를 만들었다. 이 작업의 CJS 목록 변경은 런타임 무결성 검사를 위한 것이며 desktop 원 owner의 READY 조립·실설치까지 확인한 것은 아니다.

출력 소비, 첫 SEND의 원 Query/iterator·첫 yield와 init 결박, 세션 출력·격리·보호 재판독과 예약, 실제 SDK 모듈/도구 소비·독립 OS 근거는 후속이다. 9E98의 보호 배정과 P03 승인 상태는 독립이다. 현재 processRef는 null이다.

원복은 Main이 이번 변경 집합을 분리해 되돌리는 방식이다. 기존 원장·잠금·ACK 자료를 삭제하지 않는다. 구 판독기는 새 READY 행을 인식할 수 없으므로 그 이력이 있는 경우 원격 성공/미실행으로 간주하거나 다시 실행하지 않는다. 진행 기록과 통합은 Main이 소유하며 개발자는 커밋·푸시를 수행하지 않았다.
