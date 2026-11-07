# FN09 실행 START 원자료 저장·조회·화면 연결 결과

- 일자: 2026-11-07.
- 판정: 승인된 source-only 구현·핵심 합성 검증 인수. 전체 FN09·Stage·작업계획 완료 또는 실제 사용환경 인수는 아니다.
- 계약: FN09_EXECUTION_START_ORIGIN_CANDIDATE_20261106.md r2, SHA256 65765A0B36DEDEEDF188575632535882C19477F6E3B02C8DEC29F168B43105AE. 신산님 직접 채택은 통제 §377에 기록했다.
- WI: FN09_EXECUTION_START_ORIGIN_SOURCE_IMPLEMENTATION_20261107.md, SHA256 907FE5472E18AAE381B8479330C1E34AF6907BE99217CE0458EC39823E0DBB12. 정확 제품15·시험/fixture8이다.
- 시작/최종 검증 branch: codex/av3-stage-b. 최종 검증 HEAD: 1ffbe2b5e1d21af9853a6712391aa9e1eda753d5. 이 문서 이후 checkpoint는 아래 검증을 새 실행으로 만들지 않는다.

## 구현한 동작

실제 보호 생산 자료의 WAITING 요청·확정 임무·등록 준비·책임 binding/별도 Anvil 논리 session을 교차검산해 불변 S와 token 없는 Q를 생산한다. S→originRef→Q→자기 command/receipt/audit 관계를 비순환으로 결박하고 같은 메모리 Tx의 목적 ID·저장량 예약/정산을 소비한다. 실제 AccessRepository의 확정 COMMIT/회수 반환 뒤 새 인증 보호조회가 성공해야 본문을 반환한다.

명령1과 고정 GET·assignment 고정 이력 목록 GET2, 실제 App→SessionDetail→Panel의 명시 선택·packet 고정·사용자 확인·저장·원문·이력 발견을 연결했다. 동일 명령 재확인은 추가 저장하지 않고 다른 명령의 같은 stage는 충돌한다. 취소 후 새 저장은 거절하며 역사 목록/GET은 원 S/Q를 보존한다. 읽기권/원 출처 회수·주체/연결 변경·늦은 응답에는 본문을 숨긴다. POST 결과 불명은 원 packet을 보존하고 자동 재전송하지 않는다. 저장 확정 뒤 GET 거절은 receipt를 보존하며 원 ref GET으로만 재확인한다.

실행·credential 발급·dispatch·OS writer 권위는 false다. 미발급 예약을 실제 Agent 실행 허가로 바꾸지 않는다. 원 준비의 미검증 목록은 보존한다. 0081은 미적용 SQL이다.

## 검증

| 수행 | 증거 | 결과·한계 |
|---|---|---|
| Primary 신규7 | 8ebf11→7d0bd5 | 고유46PASS/0FAIL/0SKIP,11374.8738ms,exit0 |
| Main 신규7 | 47b854/session47956→b6b5f4 | 같은46PASS/0FAIL/0cancel/0SKIP/0todo,10030.577ms,exit0 |
| 필수 여정 추가2 | Primary47c545/Mainb246d1 | 각2PASS/0FAIL/0SKIP;Main1617.958ms,exit0 |
| Main build/type | 636b41 | exit0,517modules,470ms;기존 chunk크기 경고1 유지 |
| Primary build/type | 26106b/85f9bf | exit0;추가2 이후 type0 |
| 인접5 | 624f93 | 48중42PASS/6FAIL/0SKIP,1002.2016ms,exit1 |
| 인접 실패 원인 | 841843/d964af | 변경 전/현재 선택1 모두 동일 환경계상 SQL 미모델;원 시험/정의 producer/repository diff0 |
| 최종 지문/diff | 1a2f16 및 최종 결과 문서 생성 대조 | 정확23·보호3 보존·indexempty·diff0 |

고유 신규 검증은48건이다. Primary와 Main의 같은 검사를 중복 가산하지 않는다. 인접48의6FAIL은 PASS로 숨기지 않는다. 전체 검사 분모를48건으로 축소하지 않으며 기존 fixture 보완은 다음 별도 한정 업무다.

정확 Main 신규 명령:

```powershell
node --experimental-test-module-mocks --test tests/unit/FN09/execution-start-origin-input.test.ts tests/unit/FN09/execution-start-origin-sources.test.ts tests/unit/FN09/execution-start-origin-store.test.ts tests/unit/FN09/execution-start-origin-routes.test.ts tests/unit/FN09/execution-start-origin-quota.test.ts tests/unit/FN09/execution-start-origin-schema.test.ts tests/unit/UI05/execution-start-origin-flow.test.ts
node --experimental-test-module-mocks --test --test-name-pattern '실제 queue 취소 뒤|origin 읽기 정책만' tests/unit/FN09/execution-start-origin-store.test.ts
npm run build
```

## 검수·오류와 보완

제품/시험의 독립 scoped 검수는 최종 C0/I0/M0다. 기준 ref 포함관계, DB/단조 시계 환산·최초 정책/한도 직후 HOLD, 원 미검증 목록 보존, 실제 두번째 페이지 query 객체, Web reservation 외피 exact 누락을 반례로 보완했다. 최종 시험 검수의 취소 뒤 역사와 원 source권한 회수 여정 I2도 추가2의 직접 실행/독립 검토로 해소했다. 상세 원 RED·지문·명령은 WORK_STATUS §377~409/구현 통제에 누적했다.

DOM fixture의 경로 ref·배경 SQL·virtual entry/메모리 이벤트 준비 오류는 제품 실패와 분리했다. T07 쓰기 Access denied는 정확 플랫폼 승인 후 한 문자열만 정정했고 ACL/설정은 바꾸지 않았다. 실제 파일 미변경 뒤 낡은 시험이 실행된 오류는 Stop·수정 후 hash/diff 검산으로 보완했다. 추정 파일/glob 읽기 실패는 제품 근거에서 제외하고 확인된 경로만 사용한다.

인접6은 다음 원인으로 계속 FAIL이다.

```text
미모델 SQL SELECT * FROM anvil.environment_configuration_account($1,$2,$3,$4)
→ registeredFixture:102 정의 저장 → CONNECTION_OUTCOME_UNKNOWN
```

## 미검증·다음 작업·복구

실제 PG 설치/문법·trigger/RLS·SQL ACL·경합·COMMIT 원자성·실제 HTTP 서버/브라우저·SDK/Agent·실사용자 자료/실artifact IO는 미실행이다. 메모리 RPC 응답과 SQL 형상/집합 검사는 이 검증을 대신하지 않는다. 새 실제 DB/서비스/키·권한 자원은 만들지 않았다. live/pending0이다.

다음은 기존 인접 fixture 한 파일의 원 환경계상 응답을 정확 모델링하고 기존 기대값을 유지해 확인하는 별도 단위다. 이후 실제 START/grant/E/첫 SEND의 귀속과 현재성 공급은 기존 원자료 저장 승인과 분리해 계획/계약을 대조한다. SDK 추가 읽기는 DNS 실패·소진 이력 그대로이며 재시도하지 않는다.

PR/병합/배포·원격 push·전체 인수는 하지 않는다. rollback은 이 단위 정확23을 안전 기준선에 대응해 정상 역변경하며 보호3·Main 기록·기존 SQL/실자료를 reset/delete하지 않는다. 실제 DDL 미적용이므로 DB rollback은 없다.

## 최종 파일 지문

| 경로 | bytes | SHA256 |
|---|---:|---|
| apps/server/modules/executions/execution-start-origin-input.ts | 7727 | 872CEF68B0AC957D16BAAE348ED0279DC755E2C786CE4908F96A865E71C19547 |
| apps/server/modules/executions/execution-start-origin-sources.ts | 10959 | 12A763D13E1B5AA756954D68C1FE61D6B7756BD9C1624B2B59BA33171F781423 |
| apps/server/modules/executions/execution-start-origin-store.ts | 12501 | 4AD096DB5877447E58DF73107F6F9B68C4488199B13646F3B7DD53E2A5D7F1EA |
| apps/server/modules/executions/project-execution-start-origins.ts | 14654 | 61BB1B937EC8FFC8FA80E544B7F31DD55754DB8BB3E43E6B385574739B86E1E0 |
| apps/server/modules/scheduling/stage-queue.ts | 18809 | 44CF1C4AC2AC9E3059B03E1380D95D8E581F2D59D188516EC711A36F1F347071 |
| apps/server/modules/executions/project-execution-preparations.ts | 22172 | FEF85317417E67660FE616A48CFB5D5BDEE3A623424DC094A6CAE49BDAE65009 |
| apps/server/modules/access/project-command.ts | 46544 | BF43D515D968D5E1AA9012197B3FB74F76F874B0EC3EF79AA07E8F82310E5A2B |
| apps/server/modules/projects/project-storage-quota.ts | 54319 | 7FAB00770398596E7B58F910916346C04F539A6E2C623672CCDE37F1D45CA980 |
| apps/server/modules/projects/routes.ts | 91101 | 2FA07AED309CC7B6A46E59EC2790841A093607A9C3F23BF7B99B605C0F8D12E6 |
| db/migrations/0081_execution_start_origins.sql.pending | 52539 | 470BFAD065F3D7775E3F9580013CE8BCC375CF26C6C45732A478CC764FBBB2FB |
| apps/web/src/features/session-detail/execution-start-origin-api.ts | 13828 | 7FB3617C885A5A6A0B0B7BD39F1473633E9126C0878EAA2D850B28EAE4FB01DA |
| apps/web/src/features/session-detail/ExecutionStartOriginPanel.tsx | 10784 | 7FE940A4E80803A970658B31C09C2D46F5F35C967D127334787C63E1FD1541BF |
| apps/web/src/features/session-detail/SessionDetailPage.tsx | 28264 | 3225EFEA114DC03894B4D4FF7EB1E91421820EC83AE5457D358A01A1182EB096 |
| apps/web/src/App.tsx | 70892 | 2A60F33AA286B583646909428316D2934CAE8E7430093C5B5E46B23FB4CC61C2 |
| apps/web/src/features/connections/policy-editor-profile.ts | 5518 | 5637BD7394F5893429ECFE18FC3CDF2DD617DC4C8ADC3C4E600DB20671639562 |
| tests/unit/FN09/execution-start-origin-input.test.ts | 6793 | 9D90838C88C86985C85DF08EC1915D333331B43D238B9AAEBFB7700B03CA212D |
| tests/unit/FN09/execution-start-origin-sources.test.ts | 7143 | 77F8ABE891CA1A2FD16B1D29C7657D0FFC0F1588AA1B6F91FB7CE38E547855E8 |
| tests/unit/FN09/execution-start-origin-store.test.ts | 24400 | F0F7F4E3EFEC8A5105CAC87CDB1CEA7AC10B0F4FFF0B9F3B835A0B3836928598 |
| tests/unit/FN09/execution-start-origin-routes.test.ts | 5127 | BABAF6FE1E6FBD6C201F0E28F62FFB1B612EE298815B258AB5482EBC4BC0111B |
| tests/unit/FN09/execution-start-origin-quota.test.ts | 1537 | C269CC5DE91F209870D5404A9F89A6DDF6C99DA2105B0D8952E34A21CAB998C2 |
| tests/unit/FN09/execution-start-origin-schema.test.ts | 5813 | FDBC245E8F953E7F5E3982B3BD5ED5BE27BAD4DA8D9AAF3AB5D55F0BE230715A |
| tests/unit/UI05/execution-start-origin-flow.test.ts | 24193 | 481F84DC81EC3059B9F479106A83D687D8A4FAA1DE69DAEA65573E7D0005530D |
| tests/unit/FN09/execution-start-origin-fixture.ts | 36395 | EEC04FE1F2202BC280AC49564A55CA089E4E6E0A19133204DBC9EDF44D406B74 |
