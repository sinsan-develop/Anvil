# FN08 normal STOP 대상·저장 형상·페이지 source 검수 결과

## 판정
부분 구현의 source 경계 한정 수용. 실제 정상 STOP 저장·실행 완료가 아니다. 현재 소유 근거 생산자 미연결로 정상 GET/명령 저장은 412이며, 양성 저장·replay·COMMIT 및 실제 Agent 중지는 미검증이다. 전체 FN08/작업계획 완료 체크를 올리지 않는다.

기준 main38388a92f186e1cd1359714e79d7f77a988975ce, branch codex/av3-fn08-normal-stop-target, 지시 게시7f783204b04400a4ab2c31021572c86ba5702b1e. 직접 채택 계약 SHA2562E6445077CDD2A02C00367EAEF08E40AE33E4DB46077EC4BC18785D1156CAC0F. WI r5 SHA256AE84005B78E00361BE9786EC2410AE1AD37CC67B3B29B8DEDE3E43DC05DF860E. 기존 Primary 단일 writer, Main 제품 수정0·검수/통합.

## 실제 구현 범위와 미완료
- 닫힌 STOP target·원 START envelope.commandId namespace UUIDv5/SHA256 codec. 저장 commandRef.id와 namespace를 구분한다.
- 명시 등록된 HUMAN GET/기존 STOP 명령 경로에서 원 grant/START graph·사용자5tuple·정책·기한을 검사하고 검증된 CURRENT 부재를412로 거절한다. synthetic/PREPARED/callback을 현재 권위로 사용하지 않는다.
- normal STOP snapshot/status/outbox의 source 구조와 역사 검산. 정상 신규 저장 성공을 구현·검증 완료했다고 표시하지 않는다.
- STOP에만 materials:null/stopTarget 및 영수증 material2필드null을 적용한다. 서버는 원 START로 UUID를 최종 재검산하며 기존 START/SEND page·receipt·cursor·한도는 보존한다. 실행기 typed 소비는 원 참조를 검산하나 실제 owner를 생산하지 않는다. STOP 자료 GET/permit/interrupt0, polling은 STOP 실행 전 거절한다.
- 0098 미적용 SQL은 원 synthetic check_stop 본문을 rename 보존하고 기존 START/SEND 본문·역완결을 보존한다. SQL은 기존 SHA256/저장graph만 검사하고 UUIDv5는 Node 최종 검산 책임이다. normal 신규쓰기 guard는 false로 닫힌다. 새 extension/자체 SHA1/표/role/SECURITY DEFINER는 없다.

## 오류·보완과 검증
- codec 미구현 import RED(e2a13b)→3P(f4ab8b). Main fresh3P0F0SKIP exit0 148.5369ms(edd1b5), 독립 C0/I0/M0.
- 기존 fixture 정책이 STOP을 허용하지 않아403(9cd2bb). 기존 정책 검사를 낮추지 않고 새 명시 opt-in RAM 정책을 원 START 생성 전에 준비했다. 기본 fixture는 보존했다.
- HTTP RED404/옵션미검산→2P(541ab2). framework query prototype 및 GET body 미파싱은 닫힌 query와 헤더 검사로 보완했다. 최종 header/query 음성2P exit0 3126.008ms(900c72).
- 서버 독립 spec C0/I0/M0, quality 고유I1: GET this.current 교체가 원 검산/최종412를 우회. Main2f8a73 확인, RED0P1F cb58f4→보정7P b6e765(4309.9434ms). 원메서드 캡처와 호출 전후 identity·instance own/accessor 차단. 재검수 C0/I0/M0, targetDFE5E807…AAF4397. 최종 시험 as const만 추가해 실행 의미 불변.
- nullable STOP으로 직접 영향 받은 기존 시험5경로는 원 START/SEND operation·nonnull 명시 assertion만 추가했다. root tsc 중간진단40219/70556은 이력, 최종 npm run typecheck exit0(22b856). page const/UUID 좁힘은 실행 의미 불변.
- page2/consumer/START자료 직접4파일35P0F0SKIP exit0 13962.3858ms(607c5f). 추가 타입영향·polling·synthetic STOP 인접7파일65P0F0SKIP exit0 22388.2941ms(1b958d). 서로 다른 시점 증거이며 전체 프로젝트 PASS나 중복 합산으로 표시하지 않는다.
- SQL 정적4P0F0SKIP exit0 138.7958ms(11c85e). 새 미확정 SQL SHA1 단언/임시 public.digest 의존은 Main이 채택하지 않았고 제거했다. 기존 합격 기준을 낮춘 것이 아니며 Node 원 namespace 재해시 거절은 유지한다.
- Main 최종 명령: node --experimental-strip-types --experimental-test-module-mocks --test --test-reporter=tap tests/unit/FN08/normal-stop-command.test.ts tests/unit/FN08/normal-stop-target-page-journey.test.ts →7P0F0SKIP exit0 4050.4495ms(fa29e4).
- Main 최종 혼합 페이지: node --experimental-strip-types --experimental-test-module-mocks --test --test-name-pattern="저장형상 RAM STOP" --test-reporter=tap tests/unit/FN08/normal-command-pages-journey.test.ts →1P0F0SKIP exit0 2779.0822ms(275ba2). 저장 형상 RAM 대역이며 정상 저장 권위·실DB 증거가 아니다.
- Main git diff --check exit0(b14fb8), Primary23경로 쓰기 반환/live0. SQL spec/quality와 page scoped 검수 C0/I0/M0, 제출 지문 일치. 실제 PG 파서/동시성/권한 검증은 아니다.

## 미검증·복구·다음
실제 DB 적용/권한/키/파일 조사/서비스/SDK·Agent/C# 실행0. 실제 normal CURRENT 생산·원 세션 소유·Agent 후손/파일 경계·writer 회수·정상 STOP 저장/replay/COMMIT/내구 interrupt/ACK 미완료. source rollback은 이 단위 정상 revert, DB rollback 대상 없음. 다음 독립 구현은 UI10 기존 지시 부분계획 GET의 명시 화면 소비이며 새 실행 권위를 만들지 않는다.

## 최종 작업 사본 지문
- `contracts/runtime/normal-stop-target-v1.ts`: `E0F5CFDBEE15D28C9C15569473798EB6B52C357BCF2C0E887512006826D4DBA6`
- `apps/server/modules/executions/normal-stop-target.ts`: `DFE5E8078907904CD0431B1162B080FB0F7B35D78DEF0D7988093B22EAAF4397`
- `apps/server/modules/executions/normal-stop-command.ts`: `D2E99514B43F922C55CEE37B6199A3E8F34BA79EDF7DECFC463F53E0A6E36F5A`
- `apps/server/app.ts`: `AEA99F96430EAADAB6DCC84F28B2EEC218E5F5BC4703BFE41D069B2BD934E598`
- `apps/server/modules/projects/routes.ts`: `325C7FA680BE8B03A28E5A75B724E05ADF1F2E5D0497D02248DA95F810E3BBB2`
- `apps/server/modules/executions/normal-command-pages.ts`: `B48D97C8CEA538107618C9299B6DE9C00FE03DDA0DF27DD5B4433D5D418AB973`
- `apps/connector/runtime/normal-start-material-consumer.ts`: `0D35D6DB53639842FBF997C2AFAB18D8572CD49A6D7D2B4BBFD8F5B4D9611AF3`
- `apps/connector/runtime/normal-protected-get-client.ts`: `6419E1B066BB83324A55D788DF0AA3292C7E32B35C4151B3CF4D30964049828E`
- `db/migrations/0098_normal_stop_target_page.sql.pending`: `7839A51E021FE6D031BF44CF79128D9903C9611465C472665EF66538E82BF320`
- `tests/unit/FN08/normal-stop-target.test.ts`: `5DD33CBE4FF4E94AC62FB61E7617D513BAAA91C2DBE478C5BC8618564A9CC711`
- `tests/unit/FN08/normal-stop-command.test.ts`: `943E2A12FC4277A70F586FBFA0B017ED80A9D5E51464BD870A8F2A591DEF0D59`
- `tests/unit/FN08/normal-stop-sql.test.ts`: `537CF8F5D78C5265EDE2393E3865FBDF97D3A235366DABDD124492BB9B7A30CB`
- `tests/unit/FN08/normal-stop-target-page-journey.test.ts`: `6F5C0D579EC0942C55CE431A5A95751CE5919116611E63C6EFC6CF4B7B742219`
- `tests/unit/FN08/normal-command-pages.test.ts`: `923B54157A84C0C9030EF3DB9298790942DB81473D8877F2291AACBDBBB22B13`
- `tests/unit/FN08/normal-command-pages-journey.test.ts`: `D0A9F9113B9DF72E9609390699E51043BA4626CA518E0DE544CCB3807D0BB7F4`
- `tests/unit/FN08/normal-start-material-consumer.test.ts`: `F1920971E9382598D790B5102963ED8A042CFD2DD476F3BD2045699AF6D21947`
- `tests/unit/FN09/execution-start-origin-fixture.ts`: `C5E846FE74BFA93A8DEF9FB0DB52F595A44F54CB4028A9E6B3D4B497BF84E6E9`
- `tests/unit/FN08/normal-instruction-dispatch-fixture.ts`: `FB222C5EBAF19B3F9115320CA912BC08D67DE5250C462A468314BD87D3A55BB7`
- `tests/unit/FN08/normal-start-materials-journey.test.ts`: `04FCA656A31D551FD67A8F4B750ABF5F78C592F480CFB6A631DACA9F0BBC234D`
- `tests/unit/FN08/normal-instruction-durable-journey.test.ts`: `C14C785D219244FF286EBCCB304F247FC2F8AA628DABB0B4828754EE2EC76C0E`
- `tests/unit/FN08/normal-instruction-intake.test.ts`: `C3A6E803E201733471AC902BB24BFB0BB9A185DD881EBC25654DCE735C3FD166`
- `tests/unit/FN08/normal-instruction-material-consumer-journey.test.ts`: `E0A56E1AD2A50B2EEE84F5B12887828C1F22D5A6F084C48C2430766E667181B4`
- `apps/connector/runtime/normal-start-polling.ts`: `97B2CC9E6E5F42374AE110D4ED5C692C791DA2FEAEAA9092D97CE46AC448C91E`

## 수행자 정확 인접 명령
node --experimental-strip-types --experimental-test-module-mocks --test --test-reporter=tap tests/unit/FN08/normal-command-pages.test.ts tests/unit/FN08/normal-command-pages-journey.test.ts tests/unit/FN08/normal-start-material-consumer.test.ts tests/unit/FN08/normal-start-materials-journey.test.ts

node --experimental-strip-types --experimental-test-module-mocks --test --test-reporter=tap tests/unit/FN08/normal-instruction-durable-journey.test.ts tests/unit/FN08/normal-instruction-intake.test.ts tests/unit/FN08/normal-instruction-material-consumer-journey.test.ts tests/unit/FN08/normal-start-polling.test.ts tests/unit/FN08/normal-instruction-polling-journey.test.ts tests/unit/FN08/execution-stop.test.ts tests/unit/FN08/execution-stop-store.test.ts

node --experimental-strip-types --test --test-reporter=tap tests/unit/FN08/normal-stop-sql.test.ts

SQL helper의 EXECUTE는 기존 app invoker/RLS 범위에만 한정되며 일반 표 권한·role·SD는 추가하지 않는다. 중간 STOP null 자료/영수증 재조회 실패는 보정됐고 최종 page35P에 포함된다. 실패를 소급 PASS로 바꾸지 않는다.
