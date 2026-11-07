# FN05/UI10 단계·업무별 지식 검색 결과

## 현재 판정

2026-10-28, 담당 fn05_share_request_impl. 승인된 검색 계약의 source-only 한정 구현·검수를 완료했다. 전체 FN05/UI10·Stage·작업계획 완료가 아니다. 제품품질 C0/I0/M0, 명세 C0/I0이며 unit 음성 I1과 DOM fixture I1은 각각 ADDRESSED/C0I0로 확인됐다.

- 직접 승인: call_263d314c1a4746edb77c31cdc18f4c2e/item0 ‘검색 계약·source-only 구현 승인’.
- 결정안 SHA256: 19D93DB1D81DDCE278CDCF1741A9A6C855C172B350BECC99347CF6193C310FED.
- 승인 SHA256: 078AF6AB96FD3CF687F8613FCCCEBA82EFEF82A197911FC5EAA9C7402913DC08.
- WI: docs/work_packages/FN05_KNOWLEDGE_SCOPE_SEARCH_IMPLEMENTATION.md, SHA256 BACFF86BF3D03E801F6FEC62D8869B1E56C12CCBD310ED011DB703B4B3831EA9.
- manifest: docs/work_packages/FN05_KNOWLEDGE_SCOPE_SEARCH_SOURCE_MANIFEST.json, SHA256 73ACA9CF1AAC80EFBA7E427F24A0DEF6613B6CA57C43798CEBB54487A76DD60C.
- source 기준 c602480e37b7b025cd3b50ad153d50a3fdddc2b6, 기존 codex/av3-stage-b, 정본 문서 D:/Project/Anvil, 구현은 DEVELOPMENT_ENVIRONMENT의 등록 Stage B source 작업트리. 허용12는 제품6·신규unit3·DOM2·본 결과서1이다. 작성자의 새 branch/worktree/commit/push는0이며 Main 문서 checkpoint91a77e5a와 구분한다. Main은 제품 write0이며 단일 writer로 수행했다.
- 이전 후보의 §2.1 NOT_ADOPTED는 이번 직접 승인 전 이력이다. 기존 저장·정확조회·업로드승인·공유 계약을 확대하지 않았다. 기존 시험과 완료된 다른 업무 코드는 수정하지 않았다. 보호12는 Main a1ddb6 대조에서 불변 확인됐다.

## 구현 범위와 SQL·cursor 보존

기존 GET /api/v1/projects/:projectId/knowledge에 선택 scope query만 추가했다. 정확 세 필드 {stageRef,taskRef,includeProjectWide}의 최대2048자 canonical JSON이며, 반복 query/배열·비정규 JSON·중복키·추가키·잘못된 ref/Unicode·두 ref null을 거절한다. Web은 같은 canonical wire를 URLSearchParams로 전송한다.

ProjectKnowledge.search는 projectMember를 먼저 호출하고, 기존 verifyKnowledgeScope/readApplicationSnapshot/ProjectWorkPlans.read 경로에서 같은 프로젝트 고정 적용본의 정확 node와 계획 버전/hash의 정확 task를 검증한다. 새 읽기 ACL·권한을 부여하지 않는다. scope 관련성은 접근권한·실행허가가 아니다.

scope 없는 분기는 기존 SQL 문자열과 $1..7 매개값 [projectId,kind|null,query,position.at|null,position.id|null,limit+1,status]를 보존했다. 기존 cursor filter의 canonical {projectId,query,kind,status}, archived:false, limit 직렬화와 KnowledgeHit/응답 형식도 보존했다.

필터 분기는 기존 WHERE의 제목·이유/kind/status/position 조건 뒤에 아래 괄호 조건만 AND로 추가하고, 기존 ORDER BY k.created_at DESC,k.id DESC 및 LIMIT 앞에서 적용한다. 따라서 페이지를 만든 뒤 일부 결과를 UI에서 필터하는 방식이 아니다.

    AND (
      ($8::jsonb IS NOT NULL AND v.scope_json->'stageRefs' @> $8::jsonb)
      OR ($9::jsonb IS NOT NULL AND v.scope_json->'taskRefs' @> $9::jsonb)
      OR ($10::boolean AND v.scope_json->'stageRefs'='[]'::jsonb
                       AND v.scope_json->'taskRefs'='[]'::jsonb)
    )

$8/$9는 canonical 단일 ref 배열 또는 null, $10은 includeProjectWide boolean이다. 선택 단계 OR 업무이며, true일 때만 두 배열이 빈 프로젝트 공통 head를 포함한다. 새 ref를 SQL 문자열에 삽입하지 않는다. 필터 cursor는 기존 signed ProjectListCodec에 구조화 scopeVersion:KNOWLEDGE_SCOPE_V1 및 canonical scope를 결박한다. scope/공통 포함/actor/project/query/kind/status/limit 변경과 무필터 혼용을 거절한다.

UI는 기존 workspace 적용본 GET 및 work-plans 목록/정확 GET에서 확인한 단계·업무만 선택한다. UUID/경로 직접입력이나 목록 본문 자동조회는 추가하지 않았다. 검색 조건 generation과 actor/client/project/client객체 epoch가 늦은 결과를 차단하고, 문맥 변경 첫 render에서도 이전 items/next/error/view를 숨긴다. 조건 변경은 이전 cursor의 다음 목록 전송을 막는다. 기존 작성·업로드승인·정정·공유 buffer를 변경하지 않는다.

위 SQL 위치/매개값 검사는 source 정적 대조와 fakeDB 모델 검증이다. 실제 PostgreSQL 문법·RLS·권한 집행 검증은 아니다.

## 최종 동결11 지문

| 파일 | SHA256 |
| --- | --- |
| apps/server/modules/knowledge/knowledge.ts | 4E2C33F1557102E4A62F0485B83EDEBA8CFAC4511DD1AC0F97C0EC56B6FD8B2F |
| apps/server/modules/knowledge/knowledge-search-scope.ts | 419E41E1A752DAE146E74D9628A48C93271B46DF20C6133A0F8922A9B588475C |
| apps/web/src/features/knowledge/api.ts | FCFE89327BBF797BB54E9E42FC2B03E7BF8172C8E11B476735A415795E1FB9DF |
| apps/web/src/features/knowledge/knowledge-search-scope.ts | E03FE87347DD248F6B840D14D7105BA6B708606A52BD8B63B38AD2D46AB8FA5E |
| apps/web/src/features/knowledge/KnowledgePage.tsx | FC6E92329E6DF731B8AA5B69B9451BC03689613909D7BEA99AA5B3D9BC6349AA |
| apps/web/src/features/knowledge/KnowledgeSearchScopePicker.tsx | EADC5F6301112FBEB34D33C7F3EA76D20F77DAAB5FF74FC1CE9AD1D786D01027 |
| tests/unit/FN05/knowledge-scope-search-input.test.ts | 47CC1F02951F6C8E3706A48BF477A3EC6C4CF29BE368D9E27A3B2F529098896D |
| tests/unit/FN05/knowledge-scope-search-store.test.ts | 589BC39FE5720A9F8BD33BB25FE2E4BD18F77A9B83950D8C6312FA6C7BFAEE82 |
| tests/unit/FN05/knowledge-scope-search-api.test.ts | CB207DBA009B671EF49DD1C26BEDFE32CAE123B44852FD3F1C3A2117BC783580 |
| tests/browser/UI10/knowledge-scope-search-dom.test.ts | EBDD3D61D60EB560C7AD719C45843CA9C431CD2283F8610C631A391CFC854A0F |
| tests/browser/UI10/knowledge-scope-search-dom-harness.tsx | 8C5811CFCAE3B0B7BDA8BF6A1022EDABE32E68D632370A778BFF63459225ED36 |

기존 원제품3 raw는 knowledge.ts 0C507A371094EAB1AD5451523BAAD11B30F7649E85787BCD5BE8DAA5E87F3169, Web api.ts 74BD47F41AC67EE9DC977A71E59FB3F1D67D259EA6A4967C41308192919B250E, KnowledgePage.tsx 2073E8D3AF8A985989AAEF96CAAACB82EFCC757F5076F21B4EA1BDDCBB3DC444였다. TEST_ONLY에서 불변을 확인하고 Main fresh RED 뒤 제품 GO 순서를 지켰다.

## 명령과 실행 결과

실제 source 작업경로는 등록된 Stage B 작업트리이며 Main 원실행 기록과 WORK_STATUS에서 대조한다. author 결과와 Main 독립 결과를 구분한다.

집중 신규 명령:

    node --test --test-reporter=spec tests/unit/FN05/knowledge-scope-search-input.test.ts tests/unit/FN05/knowledge-scope-search-store.test.ts tests/unit/FN05/knowledge-scope-search-api.test.ts

신규+직접인접 선택 명령:

    node --test --test-reporter=spec tests/unit/FN05/knowledge-scope-search-input.test.ts tests/unit/FN05/knowledge-scope-search-store.test.ts tests/unit/FN05/knowledge-scope-search-api.test.ts tests/unit/FN05/knowledge-api.test.ts tests/unit/FN05/knowledge-search-filter.test.ts tests/unit/FN05/knowledge-scope-store.test.ts

SSR 선택 명령:

    node --test --test-reporter=spec --test-name-pattern=^SSR tests/browser/UI10/knowledge-scope-search-dom.test.ts

| 수행자·증거 | 선택/명령 | 결과 |
| --- | --- | --- |
| author 269410 | 신규3파일 집중 | 10수집/3PASS7FAIL, skip0/cancel0/todo0, 340.7361ms, exit1. parser부재3·service scope INPUT_INVALID2·Web wire/검증부재2 RED |
| Main 59fb04 | 같은 신규3파일 | 10수집/3PASS7FAIL, skip0/cancel0/todo0, 342.1691ms, exit1. 무필터SQL7params/cursor/응답 양성 보존 |
| author 406c63 | SSR 선택 | 1FAIL, skip0/cancel0/todo0, 1422.9625ms, node child exit1. 뒤 Get-FileHash 때문에 shell exit0이었으며 시험 PASS가 아님 |
| Main ea59e5 | SSR 선택 | 1FAIL, 599.57ms, exit1. 실제 Page picker 부재 RED |
| author 774d62 | 신규3파일/type | 10PASS, 384.9534ms, exit0. npm run typecheck exit0 |
| author a961fa | node --test --test-reporter=spec tests/unit/FN05/knowledge-scope-search-store.test.ts | I1 기대명확화 후 4PASS, 338.2115ms, exit0 |
| author f883d9 | npm run typecheck | exit0 |
| author 79eac5 | 신규+직접인접 선택 | 신규10+기존9=19PASS, skip0/cancel0/todo0, 1159.7071ms, exit0 |
| author 655775 | SSR 선택 | 1PASS, skip0/cancel0/todo0, 609.3568ms, exit0 |
| author dfd4e7 | Vite build configFile:false/build.write:false, DOM harness IIFE 메모리 bundle | chunk1/CSS1/rootToken=true/appShell=true, exit0. dist 저장·브라우저 실행0 |
| Main f40126 | 신규+직접인접 선택 | 19PASS, skip0/cancel0/todo0, 1069.2171ms, exit0 |
| Main 4ba524 | node node_modules/typescript/bin/tsc --noEmit -p tsconfig.base.json | exit0 |
| author 3c95cf | fixture I1 한정 수정 후 npm run typecheck | exit0. 제품/기존unit 변경0, 실제DOM0 |
| Main 631136 | ANVIL_KNOWLEDGE_SCOPE_SEARCH_DOM_QA=1 환경에서 node --test --test-reporter=spec tests/browser/UI10/knowledge-scope-search-dom.test.ts | SSR1+DOM부모1+하위2=4PASS/0FAIL, skip0/cancel0/todo0, 4952.0527ms, exit0 |

실제 DOM 정상 한 흐름에서 단계 N1과 계획 v3/UI10을 기존 GET으로 각각 조회·클릭 선택하고, 두 고정 ref를 가진 정확 OR wire와 검색/next를 확인했다. 공통 포함 false→true 변경 뒤 기존 cursor 버튼 차단과 새 검색 뒤 다음 페이지 wire를 확인했다. 중요 실패 흐름은 조회 권한거절·늦은 FILTER 및 actor/client/project ABA다. POST0·자동본문GET0·외부요청0을 관측했다. UI08·완료된 업로드/공유 전체 회귀는 반복하지 않았다.

## 오류·검수 보완 이력

- author 48e553 type은 fake codec에 기존 ProjectListCodec의 private #sign이 없어 실패했다. 신규 시험의 codec을 실제 기존 ProjectListCodec으로 교체하여 서명/actor/filter 검증을 재사용했고, 4237fb type은 exit0이었다. 제품 오류로 세지 않는다.
- author 4237fb 시험은 10수집/2PASS8FAIL/436.1749ms/exit1이었다. 이 중 membership 음성1은 AuthFailure.status 대신 실제 statusCode를 확인해야 하는 신규 fixture 기대 오류였다. 제품 기능 RED에서 제외했다. malformed Unicode도 canonicalJson 호출 중 오류가 아니라 JSON wire를 parser에 전달하도록 구성했다. 보정 후 269410의 3PASS7FAIL을 유효 RED로 기록했다.
- 독립 unit I1: 원 store raw 068EAC91F99B61C4F50F9FB38CD321410D1ED0701EC949F6AC445F68709FF01C의 일부 assert.rejects가 예상외 TypeError/UNEXPECTED_SQL도 수용할 수 있었다. 기존 검증기 근거대로 AuthFailure instanceof, exact message/statusCode와 검색SQL0을 결박해 589BC39F…로 보강했다. membership NOT_FOUND404, missing 적용본/node/task KNOWLEDGE_SCOPE_NOT_FOUND404, hash KNOWLEDGE_SCOPE_MISMATCH409, 잘못된 타project 행의 readApplicationSnapshot METHODOLOGY_APPLICATION_INTEGRITY_FAILED503, missing plan NOT_FOUND404, duplicate query INPUT_INVALID400을 각각 확인했다. scoped 타project는 참조 검증에서 닫히므로, 별도 무필터 cursor의 다른 project도 실제 ProjectListCodec CURSOR_INVALID400으로 확인했다. 나머지 cursor 변형도 exact CURSOR_INVALID400이다. 넓은 오류 집합이나 기대완화로 바꾸지 않았다.
- actualDOM 전 fixture I1: 원 harness DA18BAB790AE132F17F7C4E7E3FA9D6BA2D3CD824664C18D97DA87FA388570E6의 context!=A/otherproject 일괄404가 미등록 GET을 삼킬 수 있었다. 실제 Page effect는 query='지연'을 보존하여 지연query 목록을 호출하고, ConversationPanel effect는 project 변경 때만 limit=50 목록을 호출함을 대조했다. ACTOR/CLIENT의 base project knowledge?query=%EC%A7%80%EC%97%B0&limit=50 GET1씩, PROJECT의 other project 동일 knowledge와 conversations?limit=50 GET2만 자료 없는404/NOT_FOUND로 등록했다. 나머지 GET은 unknown500, POST도 차단한다. 발생하지 않는 빈 query나 다른 경로는 허용하지 않았다.
- DOM test 원 D500614D36D5318E5D576E4934BCB518B40AAC0BF816FC291EAE830347F51C0A에서 deniedReads의 정확 문맥/path/GET/status404/NOT_FOUND 응답 기대만 추가해 EBDD3D61…로 강화했다. 기존 unknown[]/POST0/자동본문GET0·timeout·정상 기대를 삭제하지 않았다. 이 fixture 문제는 실제 QA 전에 독립 검토로 차단됐고 과거 업무의 actualDOM 실패와 섞지 않는다.

## Main 실제 QA와 정리

등록 root는 D:/tmp/anvil-v3-knowledge-scope-search-dom-20261028-01이다. author의 실제 DOM/브라우저/QA 자원 생성은 0이며 Main만 실행했다.

- 23f9cb: fresh root 부재, owner SINSANcyhuh, link0/profile0 확인 후 실행.
- 631136: 위 실제 fullfile 4PASS.
- 0de7e3: 정상 close 후 owner/linkescape0/profile0 확인, 186files/59dirs/14637825bytes의 등록 root를 정확 회수.
- 99ef70: 별도 검사에서 root 부재/profile0 확인.

## 미검증·rollback·다음 조치

실제 DB 접속/SQL 실행·PostgreSQL SQL 문법/권한/RLS·실서버·정식 served 환경·사용자 인수는 NOT_RUN이다. fakeDB는 SQL 엔진·RLS·트랜잭션을 구현하지 않았고, 고정 계획 readPlan 포트와 hit 투영 read를 합성했다. source 정적 검사·unit·합성 DOM PASS를 실제 DB/운영 집행이나 인수로 승격하지 않는다. 새 DDL/migration/schema/정책부여/서비스/Secret/인증서/실 Agent/공유/비용 실행0이다. 전체 FN05/UI10·Stage·계획은 미완료다.

rollback은 Main이 이번 허용 변경 경계만 확인해 기존 knowledge.ts/Web api.ts/KnowledgePage.tsx를 기준 source c602480e의 위 원 raw로 복원하고 신규 parser2/Picker1/unit3/DOM2/본 결과서를 해당 변경 경계에서 되돌리는 방식이다. 다른 dirty·보호자료를 reset/clean/삭제하지 않는다. DB·지속자료 변경은 실행하지 않아 해당 rollback은 없다.

다음은 Main의 최종 diff·허용12/기존시험·보호12 확인 및 승인된 소스 통합이다. 본 결과서 작성 뒤 담당 writer는 동결하며 코드/시험/환경 추가 변경과 검증을 수행하지 않는다.
