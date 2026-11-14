# FN08 normal SEND·지시 부분계획 source 검수 결과

## 판정

승인된 source-only 21경로 구현·한정 검수 완료. 전체 FN08·작업계획·사용자 인수 완료가 아니다. 실제 DB/권한/키/서비스/SDK·Agent 실행은 하지 않았다.

- 기준: codex/av3-fn08-normal-stop-contract, 착수 16eecc19ebaed0855133c9787aaddc40269160ad, 채택 기록 HEAD 7513a1f45bb0d1f28ae91e238859773ba4b56c71.
- 부모 SEND 계약 SHA256 DEA72C3FB14A955E02956C50898A50ED6BE9705E911A17CB651DAFE2847FFB7C.
- 부분계획 추가 계약 SHA256 F3243D1411C4FF434F4548904B99A9B0BBA353EA171FAC0314F7D99353DD91DF.
- 기존 developer_primary 단일 구현, Main 검수·통합, d2_preflight/d2_scope_audit 독립 읽기 검수. 최종 C0/I0/M0, writer 반환/live handle0.

## 실제 구현한 소스 흐름

명시 normal 설정에서 HUMAN의 보호 지시 원문·append 영수증을 검산해 64KiB UTF-8 부분계획 GET을 제공한다. SEND는 원문에서 계획을 다시 만들고 원 HUMAN 5tuple·START 부모·현재 grant·자기 예약을 검산해 명령/자료/영수증/감사를 원자 저장한다. 기존 명령 페이지에서 START와 SEND를 함께 반환하고, SEND에 결박된 동일 거래의 내부 표식으로 정확 원문만 읽는다. 자료 재조회에도 정정·격리·현재성·서명을 다시 검사한다. SEND permit은 기존0024 명령별 일회성을 사용하며 START 세대당 일회성을 유지한다. 원 결과 재조회와 결과 불명 처리를 보존한다.

0097은 미적용 forward이다. 함수25개(신규10/기존15)의 SEND 분기·역완결·한도를 추가하며 기존 START/합성/0090 관측 분기, 표/역할/기존 SQL을 보존한다. 함수별 기존 app EXECUTE 계약은 source에만 작성됐으며 실제 권한 적용은 없다.

## 검증

모든 명령은 프로젝트 root에서 실행했다. Node 직접 시험은 `node --experimental-strip-types --experimental-test-module-mocks --test --test-reporter=tap`을 기본으로 사용했다. 순수 계획 시험은 mock 옵션 없이 dot reporter, SQL/설정 시험은 `node --test --test-reporter=tap`이다.

| 범위 | 결과·근거 |
|---|---|
| instruction-parts-plan.test.ts | Main 3P exit0 c913ec; 순수 UTF-8/경계/hash |
| normal-instruction-dispatch-journey.test.ts + normal-instruction-materials.test.ts | Main 37P/0F/0SKIP exit0, 18454.8242ms, 6d8f9c→c429d6 |
| normal-instruction-permit.test.ts | Main 10P/0F/0SKIP exit0, 17272.2114ms, 84285d→e754a4 |
| normal-instruction-dispatch-sql.test.ts + normal-instruction-command.test.ts | Main 최종 8P/0F/0SKIP exit0, 1703.7636ms, 1f06d1; SQL 정적7+설정1 |
| 최종 추가 `--test-name-pattern='혼합 50/51\|SEND material QUARANTINE'` 위 journey/material 두 파일 | Main 2P/0F/0SKIP exit0, 2685.6227ms, 5875a3 |
| 직접 영향9파일 | Main 172P/0F/0SKIP exit0, 18983.2336ms, c5eec0→cce98e |
| `npm run typecheck` | Main exit0, a87d06→20203c |
| `git diff --check` | exit0; 기존4파일 CRLF→LF 예고 경고 별도 |

영향9파일: FN05/context-sources, FN08/context-read-access, execution-instruction-queue, execution-instruction-permit-schema, execution-instruction-material-parts, normal-command-pages-journey, normal-start-materials-journey, normal-start-context-source, normal-start-permit-journey (모두 tests/unit 아래 .test.ts).

변경 없는 수용 모듈은 반복 검증하지 않았다. fixture 분리와 추가 시험이 바뀐 부분만 재검증했다. 37P와 추가2P는 같은 파일의 증분 검증이며 과거 중간 통과 수를 누적 진척으로 더하지 않는다.

## 오류·보완 이력

- 외부 current 관측을 프로젝트 잠금 거래 안에서 호출한 I1: RED 뒤 거래 종료→외부 관측→새 인증 거래 재검산으로 수정·재검수 C0/I0/M0.
- 과거 START만 만료하고 동일 grant가 유효하다는 I2 반례: 실제0083의 exact 기한 결박으로 도달 불가, 검토자가 철회. 해당 제품 변경0.
- 최초쓰기 normal_initial_graph를 후속 SEND가 재사용한 I1: 원 command GUC/30초 조건 때문에 실SQL에서 거절될 결함. 기존 역사 normal_start_material_complete 호출로 교정·독립 C0/I0/M0. RAM graph 투영의 한계를 기록했다.
- SQL CASE 괄호: 기존 알려진 위험 패턴에 의미 불변 괄호 추가, 정적 RED1F→7P. 실제 parser 성공을 주장하지 않는다.
- 50/51 실제 SEND 생산 시도: 원 호출 예산 BUDGET_CALLS_EXHAUSTED 1F 유지. 예산을 늘리지 않았다. 마지막 시험은 fitPage/readPageWindow의 고유 항목 입력 모형이며 실제50SEND 생성·cursor 인증 증거가 아니다.
- SDK READ3 DNS 실패·1회 소진은 별도 결과서에 보존, 재시도0.
- 미설치 tsx/추정 tsc 경로 실패는 설치 없이 기존 Node/npm script로 정정. RAM import 순서·투영·ready fixture 오류, 주석을 권한 코드로 오인한 정적 시험 오류를 보완했고 제품 기대값을 낮추지 않았다. 상세 명령·실패는 WORK_STATUS에 보존했다.

## 미검증·다음 작업·rollback

실제 PostgreSQL 설치/전체 SQL 구문/trigger·ACL·동시성, 정확2MiB 통합 경계, 실제 SDK/Agent 실행, served UI와 사용자 인수는 NOT_RUN이다. 원문 파일은 MemoryFS, 저장/거래는 RAM 투영이다. 기본 미등록 설정을 실서비스 활성화로 취급하지 않는다.

다음은 이 소스 단위 통합·동기화 후 승인된 계획의 미완료 normal 실행기 SEND/Query·중지 연결을 선정한다. SDK 고정 공개 원문 확인 실패와 실제환경 제외는 별도로 유지한다. rollback은 이 단위 source commit revert이며 실제 DB/자료 삭제나 미적용 SQL 실행은 없다.

## 최종 파일 지문

작업 중 최종 bytes SHA256이다. Git의 LF 정규화 이후 blob SHA와 구분한다.

| 파일 | SHA256 |
|---|---|
| `apps/server/modules/executions/normal-instruction-command.ts` | `AA96F1D97287F27EF2D6E68E3B9249EFF6B923556CFE71A9590043A377E3FB62` |
| `apps/server/modules/executions/normal-instruction-materials.ts` | `A0685B586E17A256F83720BBC3A07C2E750698F354DF6C645B97F8C3B18AD787` |
| `apps/server/modules/executions/normal-instruction-source.ts` | `E8B26B49D05AE0B80839FF63E1CD954C8E403FE8217A1FFC2F348DA2FD9D4489` |
| `apps/server/modules/executions/normal-instruction-permit.ts` | `62A3BCAAE66B8D2F38AA849844B152A7203CC47B8CB458C28A0A1BD48C4B09F0` |
| `db/migrations/0097_normal_instruction_dispatch.sql.pending` | `8221C62DB4B2506331F3B8DBF538D6E2745D44AEA9B0F292FC68B465969F31D6` |
| `apps/server/app.ts` | `5F36F301C4FE8F2395727C278D2F5CEFABD5A3C7F0AC7490C1FDECA9B291BA10` |
| `apps/server/modules/projects/routes.ts` | `D4748E3D9A0806D8C26A7E943EB593705111E3758E5DEE8DCA6EDC73201024BF` |
| `apps/server/modules/executions/normal-command-pages.ts` | `7F59DEFC473A3A228A94F33653EDF07FAF2042E0EA358EB53A8E0419EA9DB09E` |
| `apps/server/modules/executions/normal-start-materials.ts` | `E5827371DC3FBA7F4843647CFDB464AD06A808C7B0BEE52C7E9C6F707DBEE921` |
| `apps/server/modules/executions/normal-start-permit.ts` | `06BBBC760EAD91D4EDF118B65AC0F21C495FABC5818E4A91C95221FB98FD1187` |
| `apps/server/modules/context/context-sources.ts` | `5221C7D83264288640286E5950672AC5E7B5A647738EA1B50DD35AD022033661` |
| `apps/server/modules/context/read-access.ts` | `27C74208B1E04B0EE48D23AB6504FD1C0BB9EFCC0FA31033EEF5BE1FFDD18293` |
| `apps/server/modules/knowledge/conversations.ts` | `B515BFDB4DBBA6382801AFFD6B6B7AB2E64EFCE54ECF252AFDCDA15DA31BB92E` |
| `tests/unit/FN08/normal-instruction-command.test.ts` | `60373957DD776BA82D4861D67CD806C315E028ADB5037A004D94051C113FA67E` |
| `tests/unit/FN08/normal-instruction-materials.test.ts` | `214CFB796CC37DC1EE088952CA1075826BF22B44C6B3B6E86B3D80C4D87F33C2` |
| `tests/unit/FN08/normal-instruction-permit.test.ts` | `45BAE40E151013C801295CD0190CC7AAEA4961C9CE825E89688C0771F6C6F7BF` |
| `tests/unit/FN08/normal-instruction-dispatch-sql.test.ts` | `243470A5BD1ABC2DCA4DFE6E11DF933EFAF760A7BCD342E744741749DFFFA18F` |
| `tests/unit/FN08/normal-instruction-dispatch-journey.test.ts` | `58C7A3E8874479B0E4FE1AF87F191383ABC4BEBBA3D08377917181EDC068F5A5` |
| `apps/server/modules/executions/instruction-parts-plan.ts` | `83576195FE199DD8311B7E5E2F724034872C54B8FCDA2B7D544D1CCDDBCEA430` |
| `tests/unit/FN08/instruction-parts-plan.test.ts` | `153BC9F63D6C9B443AE99D517C795A94DCEC8B23278D3289A917F6402874589D` |
| `tests/unit/FN08/normal-instruction-dispatch-fixture.ts` | `74737A512879B22D7059071BD4A80045020C41DD8C05744E7FB1386C3AE87423` |

## PR115 병합 후 시험 초기화 보정

최종 page 경계시험 추가 시 static import가 RAM FS 설치보다 ArtifactStore를 먼저 평가한 회귀가 있었다. 병합 후 단독 smoke는 ENOENT로 실패했다(3954be). 위 37P는 해당 추가 전 증거이며 최종 파일 전체의 통과로 해석하지 않는다. 제품과 기대값을 유지하고 해당 import를 경계시험 내부 dynamic import로 이동했다. 보정 후 수행자 직접2파일39P/0F/0SKIP(2b6a1f), Main 단독smoke1P/0F/0SKIP(ae2dc8)를 확인했다. journey 최종 working-byte SHA256은 5B6A8BA24BA89B8C86065F393F46346DFB75AFEDE3CF9E791ED8297EBDAA9D36로 앞 지문표의 해당 행을 대체한다. 실제 파일 생성·DB·Agent 실행은 없다.
