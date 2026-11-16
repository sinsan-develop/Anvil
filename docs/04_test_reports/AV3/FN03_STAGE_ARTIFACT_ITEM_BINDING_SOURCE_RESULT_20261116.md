# FN03/UI06 문서 버전별 단계 산출물 항목 귀속 결과

## 판정과 범위

소스와 RAM 검증을 완료했다. 같은 단계에서 같은 양식을 사용하는 A·B 중 B를 선택해 저장하면, 해당 문서 버전의 정확 상세 조회에서 원 적용본의 B가 반환된다. 적용본 교체 후에도 과거 조회는 성공하고 개정은 409로 거절되며 편집 입력은 보존된다. 기존 문서에서 귀속을 추정하거나 소급 기록하지 않는다.

- 기준 main `c53d8619`, 승인 체크포인트 `37285fc4`, 작업 브랜치 `codex/av3-stage-output-binding`, 관리 문서 체크포인트 `942d2dd2`. 제품 작성은 한 명이 담당했다.
- 채택 계약 SHA256 `5039D14A2D5E2B6BE0E48172FE1FBACF9ECA98B4F18CF618C33AC3FC3C29A75B`.
- 지시서 최초 `1CBC87356EE8AB9E816B1EF8113B4FC3E0D592B1ED9A27768422B21672759E36`. r2 `DCFB1BF5FF30A8196741355FBBBDE61B89662B94CF1EC6B011355D6E5FEC9B45`에서 영향 fixture 5경로를 허용했다. r3 `F85D1CBEE9BD10B775CC7BD8A794642109CF7392B67156FDF2B09F5D02513078`에서 원 영수증·감사 INSERT 인자를 보관하는 RAM fixture 1경로를 추가했다.
- 최종 독립 검수 C0/I0/M0. 제품 12개와 시험·fixture 15개의 검수 전후 지문이 같았다. 묶음 지문 `74102213E62587E9A1B3D8303418E627E4D0E05B2C645BD490CF5F45CE33A950`.

## 변경과 보호 경계

화면에서 검산한 선택을 실제 save 요청의 선택적 `stageOutputItem`에 연결했다. 업로드에는 항목을 추가하지 않았다. 본문 해시, 섹션의 itemId, 기존 로컬 초안의 주체·문맥 변경 보호는 유지한다. 서버는 저장 버전의 원 명령, 작성자, 인증 영수증, 감사 사유 및 요청 다이제스트를 대조하고 원 적용본에서 단계·항목·양식을 검산한다. 기존 사유와 필드 생략이 모두 맞고 원 요청의 승인 범위 다이제스트가 일치할 때만 과거 미기록으로 읽는다. 귀속 증거 손상과 귀속 적용본 소실은 무결성 오류다.

0099는 미적용 전방 SQL이다. 즉시 버전 INSERT 검사는 앞서 저장한 APPLIED 명령·인증·감사 및 원 적용본을 확인한다. 후행 selection과 DRAFT_SAVED 이벤트를 INSERT 선행조건으로 사용하지 않는다. 원문 재구성은 상세 조회에서도 검산한다. 기존 적용 SQL과 권한을 변경하지 않았다.

## 검증

아래 직접·인접 명령은 TAP 출력을 요약해 확인했다. 시험 파일 목록과 Node 옵션은 실제 선택 범위다.

```powershell
node --experimental-strip-types --experimental-test-module-mocks --test --test-reporter=tap tests/unit/FN03/document-stage.test.ts tests/unit/FN03/document-source-refs.test.ts tests/unit/FN03/document-proposal-content-sources.test.ts tests/unit/UI06/stage-document-draft.test.ts tests/unit/UI06/editor-api.test.ts tests/unit/UI06/document-upload-approval.test.ts tests/unit/UI06/conflict-api.test.ts tests/unit/UI06/proposal-api.test.ts tests/unit/UI06/form-document-outline.test.ts tests/unit/UI06/prepared-stage-output-ui.test.ts
node --experimental-strip-types --experimental-test-module-mocks --test --test-reporter=tap tests/unit/FN10/node-decision-sources.test.ts tests/unit/UI06/document-source-observation.test.ts tests/unit/IX01/project-read-isolation.test.ts
npm run typecheck
git diff --check development/main
```

| 검사 | 결과 | 실행 근거 |
|---|---|---|
| 직접 10파일 · Node RAM, 메모리 Vite/React 포함 | 87 통과, 0 실패, 0 건너뜀, exit 0 | d04116 · 8107.0719ms |
| 인접 3파일 · 판단 근거·보호 조회 격리·화면 관측 | 43 통과, 0 실패, 0 건너뜀, exit 0 | e6ac69 → ecc810 · 세션 91103 종료 · 11234.4765ms |
| 루트 타입 | exit 0 | 52915d → 1d0e5f · 세션 38164 종료 |
| 최종 독립 소스 검수 및 SQL 원문 대조 | C0/I0/M0 | 최종 27개 파일 지문 일치 |

동일 명령·요청의 재확인은 같은 영수증을 반환한다. 같은 양식·본문에서 B를 A로 바꿔 재사용하면 충돌하고 추가 저장은 없다. 승인 후보의 A→B 범위 대조는 409다. 기존 일회승인 기능에서 지원하지 않는 save를 실제 승인 경로에 보내면 원 A와 변경 B가 모두 422 `APPROVAL_INPUT_INVALID`로 거절된다. 이 결과로 save 승인 성공이나 권한 확장을 주장하지 않는다. B 왕복과 legacy/손상 반례는 기존 `document-source-refs.test.ts`에서 실행했다. 별도 중복 시험 파일을 만들지 않았다.

## 실패 이력과 수정

- `5b0bcc`에서 초기 파서 부재를 확인했다. 중간 `b12875 → 43e325`의 61통과/1실패는 대량 원천 fixture의 내용·해시와 원 영수증 불일치였다. 변경된 합성 원문에 맞는 원 영수증을 구성했다.
- `80d989`에서 누락된 양식 필드 fixture와 시험의 응답 타입 접근을 수정했다. `b0bcec`의 85통과/1실패는 역사 편집 원단계 참조 누락으로 fixture를 보완했다. `9de63f`에서 승인 후보의 409와 지원하지 않는 save 승인 요청의 422를 분리했다. 조기 종료된 TAP 출력의 EPIPE와 중간 `279029` 26통과는 최종 건수에 합산하지 않았다.
- 사전 검수 2건을 수정했다. legacy도 원 요청 해시의 승인 범위 재계산을 거치며, 이미 존재하는 귀속 버전에서 적용본 행이 소실되면 503을 반환한다. 실제 문서 부재의 기존 404는 유지한다. 최종 검수에서 두 건 모두 해소됐다.

## 동결 파일 SHA256

```text
apps/server/modules/documents/document-stage.ts FFE55EA28460AF98C261989BA81CC3111419B539DD46FFD64FC58C5D64365A87
apps/server/modules/documents/project-documents.ts 7F3D6BF06FE8C797D0345FC8BD39C828DFBB98AEF3C55EA4D5B9EDD7C929E502
apps/server/modules/documents/project-proposals.ts E70BEF23D7B4BD5007D9120883C68B382DAADAECECCCBCD4CE477DB1D130057F
apps/web/src/features/design-trace/DocumentEditor.tsx 7BD7BC35DAC6FB6652BF90A96123B6C27CF6C597C386E69E6F8F56CD01870E1A
apps/web/src/features/design-trace/DocumentsPage.tsx D3F30F28C304C73365CB3D6D36C2A98C97898D03F90A097982198B4AE425E5AC
apps/web/src/features/design-trace/api.ts CAB71A1999F1D7F0444A53E16814C5A150A562E0D155A43BA320CC892AF33E9B
apps/web/src/features/design-trace/conflict-api.ts 8FFB57E960326D1EFD2C8B85C5408844DC9A0206D2A41E518DAB3689D90CD3E8
apps/web/src/features/design-trace/document-upload-approval.ts 1FCDA0E1D8C8591B871BF8A3C7C858B216B17041A63BE9429BF69DDE75B373F8
apps/web/src/features/design-trace/editor-api.ts 829A71C8A8316DA5E31175957121916A96BD031924081BB95A585E843394E260
apps/web/src/features/design-trace/proposal-api.ts A3080D734A27982E3889F41C6061A4825432C90AB00F4B2DFD6A89BF049794BE
apps/web/src/features/design-trace/stage-document-draft.ts 39BEBDC4F09197A58687A4387F8E563CF7ED08235A14580C83BABB86DD8165EE
tests/integration/FN03/document-stages.test.ts D05176C6F2D70F1BEB14F9D2F012C8FBEB724FBCEA69219AE7618E4800074A8F
tests/unit/FN03/document-proposal-content-sources.test.ts 466867EAD8003FCAE6E3EFE62DA333E5CF691785D3ADB809E5082E08A89496CF
tests/unit/FN03/document-source-refs.test.ts 58F39C5DD4D040B63A77D86A683183F26382AEAE8418FE98E93B038AFB964438
tests/unit/FN03/document-stage.test.ts 993E208AEF4BA3272240A5F69C5987791807ABD8F6F8A133724B4E2AE3A635D9
tests/unit/FN10/node-decision-fixture.ts CEE9D270C8A3018338A9B6503C9F09BD9E36A7702B55B4EC6D0EBE6ADE40DA53
tests/unit/IX01/project-read-isolation.test.ts AF614CC184EB67FD30647BC6B087CDAE698C1EEADA6C5D73D76AC8B887893860
tests/unit/UI06/conflict-api.test.ts E5A3B06D2F118CFA476FE28B233B3666FEC62B62094B37CACBA4E0B33961737B
tests/unit/UI06/document-source-observation.test.ts E6E81C086C8CD5BF6224B78A6220922EECFB14BFF780818BFCE98E50201FCAAD
tests/unit/UI06/document-upload-approval.test.ts 4E3162750E1F4EE3279742E13921B869DDDE6C20FAE9A94EC36AD9AC764E1CBD
tests/unit/UI06/editor-api.test.ts DBF33172F2960C468183CC873E55633E8CC052558CE8E818441E37EE971E1C25
tests/unit/UI06/form-document-outline.test.ts 4AB6BBFEC6E6101C5A7C83377AAD6FECD61A8CADAC611240D709611F7CB043F9
tests/unit/UI06/prepared-stage-output-ui.test.ts A8741832807A131E14841C95CFD9D9A79643AA01173FB4B18B6798873C0D2FFC
tests/unit/UI06/proposal-api.test.ts 419014CDA92866063E8969D1919CCAE8FEE4DB751A13EC8FBE227FC87FB6FBD3
tests/unit/UI06/stage-document-draft.test.ts AA3981A57D824E045B6702631D80E2151EE1468A67CA04E24455DA737587BFCB
db/migrations/0099_document_stage_output_item.sql.pending 6155F65510C1785E75AF4AE155603DDBBD4F1631E39302236692C71EC152341C
tests/unit/FN03/document-stage-receipt-fixture.ts FECC8BEC329FF1084341FD8A043E13B99AD7F69B368B97555D7308A828C31002
```

## 미검증과 복구

실제 PostgreSQL에서 0099 적용·트리거·동시 트랜잭션·롤백·RLS를 실행하지 않았다. 통합 시험 소스 변경은 정적·타입 검증 범위이며 실DB 통합 시험은 미실행이다. 실제 서비스·브라우저·사용자 파일·권한·키·CLI·SDK·Agent 실행은 0이다. 기존 브라우저 동작은 RAM 컴포넌트 범위에서만 대조했다. 실행 중인 시험 핸들은 0이다.

통합 전 복구 기준은 승인 체크포인트와 Main 관리 기록이다. 운영 SQL 적용과 데이터 변경은 없었다. 향후 이미 기록된 귀속 버전이 존재할 경우 해당 원 명령·인증·감사와 이를 검산하는 조회 경로를 보존해야 한다. 통합·Git·작업현황 기록은 Main이 담당한다.
