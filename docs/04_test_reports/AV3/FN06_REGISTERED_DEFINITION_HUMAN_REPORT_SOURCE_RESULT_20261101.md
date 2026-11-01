# FN06 등록 정의 HUMAN 보고 A — source-only 검수 결과

## 판정

승인된 코드·화면·미적용 SQL·합성 검증 범위는 구현·검수했다. 실제 DB 적용·RLS·권한·경합·브라우저·서비스·Agent 실행 및 사용자 인수는 NOT_RUN이다. 전체 FN06·UI11·WORK_PLAN 완료나 실제 사용 가능 판정이 아니다.

- 기준 후보 SHA256: 5AEB6CE901F3AEBF891C7CEED550E0AE754EDAE427D4D1068B9B63F2A6EF6D8D
- WI SHA256: 9966B28C48BA41A344F3F2168A67D46B12885108ED7793AD6594F50BDD286C0F
- 시작 HEAD: 6c5df77db1ca04abb2d0704c8fcaffbe1ccec947 / codex/av3-stage-b
- 담당: 기존 Primary 구현, Main 관리·검수·통합 및 반복 오류 인수 후 시험 완료 관측 보완, 기존 Reviewer 독립 읽기 검토.
- 변경은 허용14에 한정했다. Main 현황 기록과 보호 untracked3은 별도로 보존했다.

## 실제 변경

등록된 정의의 보호 조회에서 별도 schema2 사람 보고를 작성하고, 기존 schema1 명령 봉투/recordCapabilityReport를 통해 저장·유한 이력·고정 조회에 연결했다. 환경 null·도구 버전·현재 보호→정확 replay→fresh 순서와 원명령/영수증/감사/증거를 결박한다. 기존 후보용 v1 보고는 유지했다.

신규0067.pending은 별도2표와 현재 정의·원장·보관 보고의 합산 한도를 정의한다. 기존0057/0065/0066 파일은 수정하지 않았다. v1 complete 함수는 그대로 두고 신규 forward SQL에서 shared final guard의 양방향 namespace·원행 분류를 보완한다. SQL은 실행하지 않았다.

화면은 App 소유의 별도 frozen 버퍼와 동기 ref/CAS를 사용한다. 준비 중 정의 교체는 이전 초안의 POST를 막고, 전송 결과 불명은 원명령을 보존한다. 저장 후 조회 실패·늦은401·통신 객체 교체·닫기 후 재조회가 영수증이나 새 문맥을 훼손하지 않도록 보완했다. 서버의 파생 능력은 UNVERIFIED, 실행·dispatch는 false다.

## 검증

Main 최종 ef11f1: 아래 정확7파일 55PASS, FAIL/SKIP/CANCEL/TODO0, native exit0, 3364.0304ms. 이는 실제 클래스·route와 React 메모리 DOM을 사용한 합성 검증이며 실제 DB/브라우저 검증이 아니다.

```powershell
& 'C:\Program Files\nodejs\node.exe' --test tests/unit/FN06/definition-capability-reports.test.ts tests/unit/FN06/definition-capability-report-schema.test.ts tests/unit/UI11/definition-capability-report.test.ts tests/unit/FN06/connection-definitions.test.ts tests/unit/FN06/capability-report-input.test.ts tests/unit/FN06/capability-reports.test.ts tests/unit/UI11/capability-report-api.test.ts
& 'C:\Program Files\nodejs\node.exe' node_modules/typescript/bin/tsc --noEmit -p tsconfig.base.json
```

Main type16d8e6 exit0. 메모리 실제 Web build cf7a02 exit0: configFile:false/envDir:false/publicDir:false/write:false/emptyOutDir:false. JS2508785/CSS11129/HTML354bytes, 환경 파일 읽기·디스크 산출0. diff01fdd5 exit0. 이전53PASS는 보완 전 증거로 보존한다.

독립 전체14 최초 C0/I2 뒤 변경4 scoped 최종 C0/I0: 무렌더 transport의 작업별 runToken 회수와 초안 binding/부모 CAS의 POST 전 보존을 확인했다. 서버·입력·SQL 등 나머지10은 최초 검토 후 불변이다. Reviewer의 Git 환경 오류는 Main 실제 Git f5598a 증거로 분리했다. Reviewer는 코드·SQL 실행을 하지 않았다.

별도 실제 보호reader: 등록한 합성57bytes를 기존 ProjectDocuments/ArtifactStore로 읽어 저장·고정GET/격리를 확인했다. Primary b51019 및 Main e0a980 exact1PASS/native0. 메모리 DB이며 실제 사용자 자료는 사용하지 않았다. owner/file 지문·link0 확인 뒤 7fce45와 별도조회로 정확 회수·잔여0, 두 시험 PID 종료를 확인했다. 이 일회 QA는 소진됐고 재사용하지 않는다.

## 실패·보완과 한계

- 최초 실제 행동 RED32f379: route404 두 건과 Page 작성 진입 누락 한 건. 준비 실패를 기능 RED로 꾸미지 않았다.
- 자동 안전심사 거절1: 기존0057 변경 위험으로 일괄 명령 미실행. 같은 명령 재실행/우회 없이 기존 파일 불변을 확인하고 신규0067 단일 source 쓰기로 분리했다.
- wire operation 치환과 command envelope 버전 오기는 보정했다. 역방향 namespace 누락은 독립 검토 후 보완했다.
- 닫기 lock, 무렌더 transport latch, 최초 prepare 중 초안 교체 문제는 실제 소비 경로를 보완했다. UI2 보정 전 독립 RED는 확보하지 못했으며 코드 검토와 최종 합성 PASS만 근거로 남긴다.
- UI1 동일 단언 a73b06→7c5667→d9a542 세 연속 오류 후 Primary가 중지·writer 반환하고 Main이 인수했다. 최신 제품의 추가 변경 없이 기존150회 bounded flush 안에서 완료를 관측하자 a74022 1PASS였다. FIXED200은 native digest 완료에 추가1회, 다른3분기는0회였다. 기존 결과 폐기/버튼 회복/원body·receipt/POST 수 단언은 유지했다. 최초 제품 결함과 보정 후 시험 시점 오류를 구분한다.
- 경로 준비·fixture·타입 오류는 WORK_STATUS에 실행별로 구분했다. 실제 PG/RLS/SQL 문법·OID·동시 경합·App 전체 버퍼 종단·시각/브라우저·실제 Agent 능력은 미확인이다. 제외 항목을 PASS로 계산하지 않는다.

## 통합·복구

Main이 이 source14와 결과/계획/현황 문서만 기존 승인 브랜치에 checkpoint한다. 원격 main은 f976ed5e29e14b13e12729d5b1ccf98f050f2210, 로컬 main ref는 0443043251d25aa77c17d23165b7c9299c8dbeb8로 서로 다름을 실제 관측했으며 어느 쪽도 변경하지 않았다. main 병합/배포/실제 DB·권한·키·서비스·Agent 실행0이다.

문제 시 신규 source commit을 정상 revert하는 것이 코드 복구 경계다. 실제 SQL을 적용하지 않았으므로 실행 DB rollback은 수행하지 않는다. 기존 보호3과 다른 업무는 복구 대상에 포함하지 않는다. 후속은 남은 계획·기존 승인·실제 환경 계약을 대조해 진행하며 미검증을 완료로 승격하지 않는다.

## 최종 허용14 SHA256

- `apps/server/modules/projects/routes.ts`: `57171F5407B73BDEAC06A8A5F8173FC516AA5DC129FD2E1C32B9DC1E71AF83FB`
- `apps/server/modules/connections/project-connection-definitions.ts`: `366F7F029E214EB5337EB1FA8C1500281AE2C23F7F9A05C94AFA2B1B4C136493`
- `apps/web/src/App.tsx`: `48912DDF833108C6E2C6EE12384BE1788D7B3B801DAFCE6794B0F0FF3D57DA95`
- `apps/web/src/features/connections/ConnectionsPage.tsx`: `EF57D8D16119DA24F82F3B30B2EFC8FCF52E9D61CB5121021C43FEF1AA45FFEE`
- `apps/web/src/features/connections/ConnectionDefinitionPanel.tsx`: `CE1BC38A9E2D7A6E9D004BB96A3237FC5C2A242B84DEEBE4D730434B8C31090C`
- `tests/unit/FN06/connection-definitions.test.ts`: `F0BA99A096C445C049ACB1C9B760037077BB8597D7473217F25096124E59391B`
- `apps/server/modules/connections/definition-capability-report-input.ts`: `592F6FA0E7CAD0860C000132CA6E6EC30E3C87807D8D6862D31ACB0AF8746AB4`
- `apps/server/modules/connections/project-definition-capability-reports.ts`: `E70AFD7EA5F27A067AD47EF12B3940F6B3FF086B980BEF1626EAAA2F88D094D2`
- `apps/web/src/features/connections/definition-capability-report-api.ts`: `2B8CBBDA31764B5AEDC47EECC288AA22E2B49147D579E5844C1697D3A53971F4`
- `apps/web/src/features/connections/DefinitionCapabilityReportsPanel.tsx`: `64F109A25B96D66F6D32562A3C922DB4F0C712F02B67F89B4BBE2096B5E8160A`
- `db/migrations/0067_definition_capability_reports.sql.pending`: `33A8A80A7F149B09DAF6CC99DF1E2D4CB56083E8C2231AE391BDB1C43EB98CCB`
- `tests/unit/FN06/definition-capability-reports.test.ts`: `5BCD9A7CADBF169EC672FF2B152C4B1F045A73C0AE7138A8FB6BE3124BFE7F1E`
- `tests/unit/FN06/definition-capability-report-schema.test.ts`: `D61E5CEA8CE97CDC71B17BF0ACB3C125605C465B7490E327C6DBA30102776DAA`
- `tests/unit/UI11/definition-capability-report.test.ts`: `622CED4A05C526E4F15FD7BD1F7C73087B8A262B005843752E88E117530B6751`
