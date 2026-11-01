# FN06 ConnectionDefinition A source 구현·검수 결과

2026-11-01 / Main 어울 / 수행자 기존 Primary / 독립 Reviewer.

## 판정
채택된 등록·고정 보호조회·UI11/FN14 연결의 코드·미적용 SQL·합성 검증을 수행했다. **Main 66PASS/type/diff0·독립 최종 scoped C0/I0로 채택 범위의 source 검수를 마쳤다.** 실제 DB·권한·키·서비스·Agent 실행은 제외했고 전체 FN06/FN14·WORK_PLAN 완료는 아니다.

## 승인·변경 이유
직접 승인 후보80A2E0C160D3F5DCDB161AECBDFE3F4CCE632716C33C71A7C26C188A35639B12 / WI E66FA028DD80CC64669F855BC4BBEB7928AE27AF4648770AA5F7F6D08B3C67B2. 시작 제품3301a1f6·통제문서ab5870fa/e98bcfae, branch codex/av3-stage-b. 최초 tracked clean·보호 untracked3은 유지한다.

기존 route는 모든 registerConnection을 후보로 전달했고 고정GET은 없었다. 변경 후 후보는 보존하고 exact {definition,reason}를 별도 등록한다. 서버 소유id/version/NOT_READY·fullref와 불변 원형을 보관하며 현재 member+명시 readConnectionDefinition 정책으로 조회한다. 비null 보호참조의 producer가 없으면412, 실행·실제능력은 계속미확인/false다.

기존10GiB 원장 kind/수치에 정의를 위장하지 않고 별도 canonical64MiB·head1000/version10000과 함께 더 엄격한 합산cap을 같은 project lock/미적용 deferred guard로 검산한다. 현재 제어·정확정책/기한·AUTO/별도REQUIRE 일회소비·replay추가0·감사 완결을 보존한다. UI는 App소유 frozen명령·UNKNOWN/영수증/늦은401 보호, FN14는 동일PoolClient 실제정의 reader/고정ref 선택만 연결하고 TARGET_CAPABILITIES_UNVERIFIED·실인계/재개false를 유지한다.

## 실행 증거
- 최초533d22 exit1: 보호 정책GET200을 기준으로 정의GET404≠401, 실제Page 작성버튼0≠1의 행동RED2. 신규SQL부재는 별도 준비RED1, loader실패0.
- Primary 최종31PASS/type0·전체Web 메모리build0(JS4448539B/CSS11156B,configFile:false/envDir:false/write:false). 이후 I2/I3 반례 보완신규23PASS·최종React8PASS/type0.
- Main c6d8cd 초기동결본64PASS/type·diff0. 최종 보완후623de1→2a5bc2→25f8d8 단일handle52492: **66PASS/0FAIL/0SKIP·9055.513ms, typecheck exit0, diff check0**. 실행전 심사timeout1은 미시작이며 도구가 허용한1회재시도만 했다.

정확 Main 명령:
```text
node --test tests/unit/FN06/connection-definitions.test.ts tests/unit/FN06/connection-definition-schema.test.ts tests/unit/UI11/connection-definition.test.ts tests/unit/FN06/candidate-input.test.ts tests/unit/UI11/candidate-api.test.ts tests/unit/UI11/candidate-policy.test.ts tests/unit/FN14/preparation-record-input.test.ts tests/unit/FN14/preparation-record-store.test.ts
node node_modules/typescript/bin/tsc --noEmit -p tsconfig.base.json
git diff --check
```

## 독립 검토와 오류
- 중간I1: command/receipt만 검산해 원audit 없는 반쪽 정의를 허용할 수 있었다. 정확audit1행·scope/operationId/주체/target/policy·원command와 역trigger 완결을 보완했다.
- 최종I2: 비JSON/code누락409를 명확거절로 판단했다. 실제React RED e8bdec 뒤 정의POST의 정확6필드 오류DTO/JSON·2MiB·고정code만 명확거절로 표시하고 비정형/초과/중복key/판독불가는UNKNOWN 원body로 보존한다. 기존GET/후보분기는 변경하지 않는다.
- 최종I3: audit의SQL NULL과 원요청JSON null 비교가 정상AUTO를 거절했다. 정적RED336b20 뒤 JSONnull만SQLNULL로 정확정규화하고 key부재/위조는 거절했다.
- 준비오류: Primary 타입2·React fixture/관측3종·SQL시험문법1 및 실제목록 이전경로조회 오류. Main sandbox git diff권한오류1은 무효로 기록하고 승인된읽기로 대조했다. Reviewer 의존경로오조회는 근거에서 제외했다. 실패를 과거PASS로 소급하지 않는다.
- 최종 독립 scoped C0/I0: I2/I3 해소·추가 C/I0. 보완5개 시작/끝 지문 일치, 나머지12개는 선행 전체검토 이후 불변이다. 리뷰 재시작이 pending_init으로 남은 상태를 실제목록으로 확인해 해당 초기화만 중단하고 같은Reviewer를1회 재개했다. 중복 제품실행은 없었다.

## 미검증·복구·다음
실PG문법/role/RLS/trigger·경합·실파일bytes·served API·nativeBrowser/시각·실도구/Provider/인계·사용자인수는 NOT_RUN이다. 기존FS 포함FN14/FN16시험이나 실DB·권한·키·서비스·Agent는 실행하지 않았다. 소유 시험자원/채널/app은 반환했고 livehandle0이다. 기존 프로젝트 차단 해제·READY·전체backup coverage 승격0.

현재 변경 전 코드는 e98bcfae의 제품 상태이며 이 변경을 적용하지 않으면 이전 후보전용 동작을 유지한다. 실제DB에는0065를 적용하지 않았으므로 DB복원 작업은 없다. 통합 뒤 문제 발생시 별도 forward수정 또는 해당제품commit의 정상revert를 검토하며 dirty/untracked를 reset하지 않는다. 전체 필수gate 미충족으로 main병합/운영배포/branch삭제0. 다음은 같은Primary의 FN16 잠금reader exact3 구현·독립검수다.

## 최종 source 지문17
| 경로 | SHA256 |
|---|---|
| apps/server/modules/projects/routes.ts | 65E96E18201FAC86BA07F6BD8A6CC8B67D4F73DD81A2BB8FA709EF849518B165 |
| apps/server/modules/access/project-command.ts | 988D3247CF50B056EF61D3A408E3F37CF8D9FCE2779EA320729B5881CB0BCF06 |
| apps/server/modules/transfers/preparation-record-source-adapter.ts | 976FB750D1C748D18AD803D77577467B0F1690611DDD0753EC410747F37F1487 |
| apps/web/src/App.tsx | F5244008E27D7F3B5CA9317693C65CE225BD668F53856016440685E18C82DE17 |
| apps/web/src/features/connections/ConnectionsPage.tsx | 5EB18A6B803A02E93475B551F3D7C3CC6F2367CCF186455A6236F64B5A127A70 |
| apps/web/src/features/connections/policy-editor-profile.ts | 581690334193609224070E7126CB72A43C45D27228FCC6C6E9F6E3ED85DED77A |
| apps/web/src/features/transfers/preparation-record-api.ts | 8BC274CD1300F2470650F2589B2E25F97E72BB93B5ECA95FFCC28545A1C4B8FA |
| apps/web/src/features/transfers/TransferPreparationRecordPanel.tsx | D8A1173E22DF2E2266708F7149CD442C9FBA5A7D68DB539A1A3C082B60DFA4B9 |
| apps/server/modules/connections/connection-definition-input.ts | C80DAD5505ED0DCF86306A4B735B00664CC8548F9CD7D794E58A88B45ED3EF5E |
| apps/server/modules/connections/project-connection-definitions.ts | A43218462AD1185C2E69FFA98F025EA01DFEA5CCA70F4A13EF49CFB5D7E0D6B2 |
| apps/web/src/features/connections/connection-definition-api.ts | 1FF5EF27F0C9B085AD9D666F1595E908DDFB29E42DD151CE07444EF6E2146C29 |
| apps/web/src/features/connections/ConnectionDefinitionPanel.tsx | 28E9009E64DBBCF7728781A7470C537281F2A6B1F81CB8A954E989A52331A0A2 |
| db/migrations/0065_connection_definitions.sql.pending | 34B89B45E4CCD84071AFDD2C5E07E0D7E37F692F8BC226A673745D62856C9EA8 |
| tests/unit/FN06/connection-definitions.test.ts | 768D10AAB01AE01F911C6CB62C0C503FCAD63867A7B8834A2BF8238160D058D3 |
| tests/unit/FN06/connection-definition-schema.test.ts | DBECFB790C47A0BAB334F3E8F6A3A555395C6DF492A9DBE031BC3C95806A79EF |
| tests/unit/UI11/connection-definition.test.ts | 0C793575DC9D6E6EC091B73005496B49865EB5677C8330BE67F3D29D2851514F |
| apps/web/src/features/decisions/api.ts | C933E8FDDA18295F70935B16B254DB7E1B019BAACB501EA22FBB234871411FFF |
