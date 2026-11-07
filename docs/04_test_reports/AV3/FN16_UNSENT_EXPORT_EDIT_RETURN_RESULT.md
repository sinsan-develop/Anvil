# FN16/UI14 미전송 반출 준비 해제·편집 복귀 결과

## 현재 판정

2026-10-28 기준 기존 승인 FN16/UI14의 미전송 local 준비 해제·편집 복귀 한정 source 구현과 검수가 완료됐다. Main 최종 실제 App bundle/합성 transport browser18 PASS, 직접 unit 신규15+기존9 단일24 PASS, 타입/build 및 독립 검수에서 필수 미해결 finding0이다. 실제 DB·정식 served·실반출·Agent·사용자 인수와 전체 FN16/UI14/Stage/작업계획 완료 판정은 아니다.

제품2·신규 unit1·기존 browser 보강1은 아래 지문으로 동결했다. 이번 최종 쓰기는 결과서1뿐이다. App/CSS/server/SQL/권한/정책·새 API·일반구조·의존성·실반출·운영 변경0, 작성자 Git/상태/기존 문서 수정0이다. QA build/browser/정상 회수는 Main만 수행했다.

## 권위와 기준

- Main 지정 base `ff429762`, 기존 `codex/av3-stage-b`; Main preflight9ad12f가 HEAD/branch·Main status dirty1/indexempty·baseline 제품/기존 browser·읽기 App·보호12·신규 unit/result 부재·문서2 양쪽 지문을 확인했다. 작성자가 별도 Git 상태를 확인한 것으로 쓰지 않는다.
- WI `docs/work_packages/FN16_UNSENT_EXPORT_EDIT_RETURN_IMPLEMENTATION.md`, SHA256 `3BC97DAE31DA15CCE2EC49BDC72F722F8139F8465DE0E9653FCE076DEAEF8B0E`.
- manifest `docs/work_packages/FN16_UNSENT_EXPORT_EDIT_RETURN_SOURCE_MANIFEST.json`, SHA256 `64AFA1BD1D4F76CADDF83CEB81A186D2D77814B608B5C3D866D0B3E4E9CC31C4`.
- 기존 승인 `FN16_SELECTED_ARTIFACT_EXPORT_IMPLEMENTATION.md`의 준비 POST0/별도 명시 전송 및 App 원명령 보존, `FN16_EXPORT_ONE_TIME_APPROVAL_IMPLEMENTATION.md`의 명확412→별도 승인·원명령 결박/UNKNOWN 보존을 소비했다. 서버 취소 명령이나 새 반출/권한 계약이 아니다.
- 문서 독립 C0/I0/M0 후 TEST_ONLY→Main fresh RED→제품 GO를 따랐다. 독립 API I1은 별도 TEST_ONLY4→Main RED4→API 한정 보완으로 처리했다. 실제 browser 실행도 Main의 새 QA 등록/별도 GO 뒤에만 수행했다.

## 문제와 최종 동작

기존 panel은 준비만 해도 work가 생겨 편집 fieldset을 잠갔고, receipt가 있어야 결과 닫기만 제공했다. API merge도 receipt 없는 old를 일반 null로 지우지 못하게 보호했다. 이번 변경은 그 보호를 유지한 채 **실제로 발급된 현재 미전송 객체**에 한정한 명시 해제 동선을 연결한다.

사용자는 “미전송 준비 해제·편집”을 눌러 확인 영역을 열고 “준비 유지” 또는 “해제하고 편집으로 돌아가기”를 고른다. 취소는 같은 command/body/binding을 보존한다. 확인은 현재 exact-old 객체의 단발 근거와 App의 동기 CAS가 성공할 때만 local 준비를 해제한다. 열기·취소·해제는 POST0·서버 취소0·추가 GET0이다.

원 document/artifact fullref·version·reason은 **보존 입력**으로 돌아온다. resolved document=null/consent=false로 만들고 원문 재조회를 요구한다. remount 뒤 목록이 없어도 이전 선택 metadata option/이유만 표시하며 DocumentSummary/artifacts/READY를 합성하지 않는다. 문서 목록/고정 버전의 기존 실제 GET과 정확 hash/artifact 대조·재동의 뒤에만 새 commandId로 준비한다. 새 준비도 POST0이며 전송은 별도다. 화면 전체 reload 및 해제 후 일반 local 입력 수명은 기존 한계를 유지하고 새 영구/App draft store는 만들지 않았다.

다음 조건은 계속 해제 불가다: UNKNOWN/REQUIRED/BOUND, inflight/busy, receipt, accessLost, approvalRef/approvalRequest, actor/client/project/API/transport/CSRF 또는 scope 불일치/ABA, 위조·복사 객체, 이미 새 buffer가 된 CAS, 늦은 응답. 이전 전송 명령과 승인/불명·확정 결과를 이 동선으로 버리지 않는다.

## 정확 변경 표면·보호

| 파일 | 변경 |
| --- | --- |
| `apps/web/src/features/backups/project-backups-api.ts` | 실제 prepareExport 반환 객체의 내부 WeakMap 근거 등록. current/exact old에 결박한 단발 release와 보존 입력 반환. 일반 null merge는 여전히 거절하며 유효 근거만 한 번 소비. markExportDispatch 및 직접 sendExport 진입에서 미전송/해제 근거 폐기 |
| `apps/web/src/features/backups/ProjectBackupsPanel.tsx` | 명시 확인/취소·busy/flight/context/CAS 보호, 선택/이유 복귀·document null/재동의·실 GET/fullref/artifact 재검사. 이전 metadata를 검증 원문으로 표시하지 않음. 반출 이유 textarea의 안정적 aria-label1 |
| `tests/unit/FN16/unsent-export-edit-return.test.ts` | 실제 prepare의 fake GET2 발급 객체·독립 canonical document/hash·POST/unknown GET count, 단발/복제위조/현재성/ABA/CAS/late JSON 및 직접 send 진입 반례 |
| `tests/browser/UI14/project-backups.spec.ts` | 기존 기대 보존, 새 exact QA literal1 추가, GET/POST 준비 관측과 미전송 취소/복귀/remount/전송/접근상실/CSRF 보존7흐름 추가 |

App의 기존 changeExport CAS는 수정하지 않았다. 같은 bindingId/body라도 다른 old 객체는 내부 발급 근거가 아니며 복사/위조 객체로 지울 수 없다. markDispatch 뒤 old 객체를 다시 가져와도 원 해제 근거는 무효다. 직접 sendExport도 진입 즉시 두 근거를 폐기하므로 Panel 외 호출에서도 “미전송” 자격이 살아 있지 않는다. 기존 전송 가드·명령/body·응답 처리·승인 및 receipt 단조성은 유지한다.

UI 편집 전 craft-floor를 읽고 기존 CSS/12px와 작은 확인 영역을 사용했다. 새 modal·테마·공통 컴포넌트·PRODUCT/DESIGN을 만들지 않았다.

## 독립 finding·원 실패 보존

### API I1

원 API `35CB93F597E69A0E4DC727AD2B986EA6EA0B265B653601B3FB9B7E66824277E0`는 Panel의 markDispatch 선행에서는 안전했으나 실제 prepare 객체를 직접 sendExport에 넘기면 미전송 발급/release 근거가 살아 있었다. 직접 POST 대기·응답 유실 후 oldproof clear/null 및 새 proof 발급 가능성을 Main395b7c가 신규4의 0PASS4FAIL/179.1481ms/skip0/exit1로 재현했다.

기존 신규11 기대는 유지하고 opt-in fake POST barrier와 직접 send4를 같은 허용 unit에 추가했다. 실제 POST1/body·unknownGET0을 관측하고 finally에서 pending promise를 해제·정확 CONNECTION_LOST로 정산했다. API sendExport 진입 한 곳에 unsentPrepared.delete(p)/unsentRelease.delete(p)만 추가했다. I1은 ADDRESSED / scoped C0/I0/M0다. 최초20 PASS는 I1 실증으로 소급하지 않는다.

### 첫 실제 App browser 실패

Main596c08/4e453a 첫 실행은18 중13PASS5FAIL/51.0초/exit1이었다. 기존11은 모두 PASS, 신규7 중5는 채워진 textarea의 `getByLabel('반출 이유',{exact:true})`를 찾지 못한 timeout5000이었다. Main cba50c screenshot/57021a DOM에서 실제 textbox·원 입력값 보존을 확인했다. wrapping label의 textarea 값이 label text에 영향을 주는 exact 검색 문제 범위로 분리했다.

허용 Panel의 textarea에 명시 `aria-label="반출 이유"`1곳만 추가했다. selector/기대/timeout/skip·API·unit·browser 본문을 완화하지 않았다. 재검수 C0/I0, Main 재build 뒤 동일18 모두 PASS였다. 같은 단일 실행의 locator 실패5개를 반복 수행3회로 세지 않는다. 원 실패 screenshot 파일은 QA 정리로 제거됐으므로 현재 존재한다고 주장하거나 파일 링크를 제공하지 않는다. 원 FAIL은 tool 기록/결과현황으로 보존한다.

## 지문

| 파일 | 최종 raw SHA256 |
| --- | --- |
| `apps/web/src/features/backups/project-backups-api.ts` | `2D5BBD3A505B9E76F2D60853E99E4889B5C9BA6804E0193F16D781066882F005` |
| `apps/web/src/features/backups/ProjectBackupsPanel.tsx` | `6AC014CBE932696F916FB9C94F49144CD5CB7B8F4A1564F1B08270778C2A0D82` |
| `tests/unit/FN16/unsent-export-edit-return.test.ts` | `0E1073D0184538B4901B7326EFC92DD00CB23A2ED130F81FB858F6347C48F442` |
| `tests/browser/UI14/project-backups.spec.ts` | `A663920EEAB899ACC5638827C1E7525B5D95534F7015A0DB77720F8ACA6EF3D3` |
| 읽기 전용 `apps/web/src/App.tsx` | `0694CB2794446EFD35AD2A9C080012E71ED4DFFC465AF6ACBB85B0BD042C65F7` |

위 제품/신규시험/browser 최종 raw와 LF는 동일하다. App은 원raw 그대로이며 LF `B4DF6D951ABCD13A050EE219DCB478892681B52335DE4592C73A5824C4F65B29`와 구분한다.

기준 raw: API `44616FC8333850878292650726C812F7C620EA3BC4ED0E5DDDE1EF782B7EE058`, Panel `0359A536CC54385888C6AE7537E7BC6FE4D4BA236259F23084765E054FADCBAF`, browser `47E4335606928315C538F6AF9F250E32D34D423509E6A0F5B3EB5539A0F28764`. 최초 신규11 동결은 `D20B422DCD1656E422B5827C5854607AA521A5E5CDD07DB629DF48771F5A9CC7`; 첫 제품 Panel `439F279D2B0DB362FDC99E1A0FAA0D3F791D85BF2B2D874E19AA00DDF750DF46`, API `35CB93F5…`였다. 이력과 최종 보완 지문을 분리한다.

## 단위·타입 결과와 명령

| 증거 | 실제 결과 | 의미 |
| --- | --- | --- |
| Main20e0b4 | 신규11: 2PASS9FAIL / 224.6914ms / skip0 / exit1 | 실제 해제 접점 부재 RED, 수집 오류0 |
| author81be74/9fbb4d | 신규11+기존9 단일20PASS / 235.7475ms / exit0, tsc0 | API I1 발견 전 기본 증거 |
| Main 첫20 | 단일20PASS / 444.0626ms | 후속 I1 해소와 별개 |
| Main395b7c | 직접 send 신규4: 0PASS4FAIL / 179.1481ms / skip0 / exit1 | I1 기능 RED |
| author559b28/a0f85d | 신규15+기존9 단일24PASS / 269.2833ms / exit0, tsc0 | I1 보완 후 |
| Main22bf19/4821ba | 단일24PASS / 210.6651ms / type0 | aria 보완 전 최종 API/단위 독립 검증 |
| author d3dd0d | exact tsc exit0 | aria-label1 추가 후 타입 |

```text
node --test --test-reporter=spec tests/unit/FN16/unsent-export-edit-return.test.ts
node --test --test-reporter=spec --test-name-pattern=직접sendExport tests/unit/FN16/unsent-export-edit-return.test.ts
node --test --test-reporter=spec tests/unit/FN16/unsent-export-edit-return.test.ts tests/unit/FN16/export-approval-api.test.ts
node node_modules/typescript/bin/tsc --noEmit -p tsconfig.base.json
```

등록 source의 상대 명령 참조다. 내부 실행 공간을 제품 사용 경로로 노출하지 않는다. 최초 test 작성 때 DocumentSession에 없는 displayName 장식필드는 실제 타입 대조 후 실행 전 제거했다(ECA229…→D20B…). 기대 변경·제품 실패가 아니다. 조사 중 NotificationScope를 잘못 지정한 `apps/web/src/features/notifications/project-notifications-api.ts` rg의 경로 없음1은 실제 import `apps/web/src/notifications/project-notifications-api.ts`로 읽기 정정했고 파일 영향0이다. 이 조사/타입 준비 문제를 정식 제품 실패로 세지 않는다.

## Main 실제 App QA·정상 회수

새 등록 root는 `D:/tmp/anvil-v3-stage-b/ui14-unsent-export-edit-return-20261028-01`, owner `SINSAN\cyhuh`, 최대30분이며 old QA 재사용0이다. Main06549e 생성 UTC `2026-10-28T03:45:09.2713659Z`. Main만 새 bundle/config/temp/results를 이 root 아래 만들었다.

- fffd40 첫 build:468 modules/exit0. chunk>500k 경고만 있었으며 build 실패/제품 기능 실패로 세지 않는다.
- 596c08/4e453a 첫 browser:18 중13PASS5FAIL/51.0초/exit1. 위 원 FAIL 보존.
- 5919de 재build:468 modules/exit0.
- cbe4ec 최종 같은 spec18PASS/17.1초/exit0. 기존11+신규7 기대·timeout을 그대로 적용했다.
- 독립 API I1 재검수 ADDRESSED C0/I0/M0, Panel aria 보완 C0/I0, 원 unit 검수 C0/I0/M0. 필수 미해결0.

정확 Main build 명령(두 build 동일):

```text
node node_modules/vite/bin/vite.js build --config apps/web/vite.config.ts --outDir D:/tmp/anvil-v3-stage-b/ui14-unsent-export-edit-return-20261028-01/bundle
```

첫/최종 browser 명령:

```text
node node_modules/@playwright/test/cli.js test --config D:/tmp/anvil-v3-stage-b/ui14-unsent-export-edit-return-20261028-01/qa.config.cjs UI14/project-backups.spec.ts
node node_modules/@playwright/test/cli.js test --config D:/tmp/anvil-v3-stage-b/ui14-unsent-export-edit-return-20261028-01/qa-run-02.config.cjs UI14/project-backups.spec.ts
```

child env TEMP/TMP는 등록 root/temp, ANVIL_UI14_EXPORT_QA_DIST는 root/bundle이었다. Main 임시 config의 testDir는 등록 source의 tests/browser, testMatch는 UI14/project-backups.spec.ts, outputDir는 첫 root/results·최종 root/results-02다. workers1/retries0/forbidOnlytrue/timeout15000/reporterline, baseURL=https://localhost:3830/browserName=chromium/channel=msedge/headless=true/ignoreHTTPSErrors=false/serviceWorkers=block/trace=off/screenshot=only-on-failure를 유지했다. repo config/CSS/App 수정0이다.

이 QA는 실제 App bundle과 route.fulfill 합성 API를 사용했다. 별도 HTTP listener0·실제 TLS 서버 접속0이며 실제 DB/정식 served 증거가 아니다. browser spec의 기존 등록 exact literal은 보존하고 새 exact bundle literal1만 추가했으며 임의 env path/fallback은 없다.

Main e4f1f1은 정확 root의 소유/link/이탈을 확인한 뒤 UTC `2026-10-28T03:51:48.0842665Z`, 68files/17dirs/3,801,961bytes를 정상 회수했다. 생성부터 약6분39초로 등록 최대30분 안이다. 별도 a48cb7은 UTC `2026-10-28T03:52:01.7932196Z`에 root 부재 및 Node/Edge 관련 경로 양 slash 표기0을 확인했다. 실패 screenshot·임시 config/bundle/results가 현재 남아 있다고 주장하지 않는다. 실제 QA 잔여0 확인은 Main 증거이고 작성자는 browser/QA 실행·회수0이다.

## 미검증·rollback·다음 조치

실DB/SQL/권한·정책 부여·서버 취소·실반출 bytes/보관본·실제 사용자 다운로드·정식 served·운영/Agent·사용자 인수는 NOT_RUN이다. GET2/POST count·App CAS·DOM PASS는 실제 저장소/서비스·권한 집행 증거가 아니다. P03 R2 actual packet/실행과 이 UI 동선은 독립이다. 전체 FN16/UI14/Stage/계획은 미완료다.

source rollback은 Main이 이번 API/Panel·신규unit/browser 보강·문서의 정확 소유 변경만 선택 복구하고 기존 UNKNOWN/승인·receipt·보호 자료를 보존하는 것이다. 해제는 local 미전송 준비만 대상으로 하며 서버 반출본 삭제·전송 취소·DB/권한 복구·실환경 재실행을 하지 않는다.

Main이 최종 diff/지문·보호자료·등록 QA 회수를 대조해 별도 checkpoint/통합한다. 작성자는 결과서1 해시 제출 뒤 제품/시험/기존문서/Git/환경 추가 작업 없이 동결한다.
