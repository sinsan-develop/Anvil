# FN05/UI10 단계·업무별 지식 검색 구현

## 권위·범위
신산님 call_263d314c1a4746edb77c31cdc18f4c2e/item0 ‘검색 계약·source-only 구현 승인’. 결정안19D93DB1/승인078AF6AB/기준source c602480e. 과거 후보E4D828C5의§2.1 NOT_ADOPTED는이직접승인전이력이며이정확검색wire만이제source구현채택이다. 기존§1/2저장·정확조회와공유/업로드승인범위를임의확대하지않는다.

## 정확 허용12·단일 writer
- `apps/server/modules/knowledge/knowledge.ts` 원raw 0C507A371094EAB1AD5451523BAAD11B30F7649E85787BCD5BE8DAA5E87F3169
- `apps/web/src/features/knowledge/api.ts` 원raw 74BD47F41AC67EE9DC977A71E59FB3F1D67D259EA6A4967C41308192919B250E
- `apps/web/src/features/knowledge/KnowledgePage.tsx` 원raw 2073E8D3AF8A985989AAEF96CAAACB82EFCC757F5076F21B4EA1BDDCBB3DC444
- `apps/server/modules/knowledge/knowledge-search-scope.ts` 신규
- `apps/web/src/features/knowledge/knowledge-search-scope.ts` 신규
- `apps/web/src/features/knowledge/KnowledgeSearchScopePicker.tsx` 신규
- `tests/unit/FN05/knowledge-scope-search-input.test.ts` 신규
- `tests/unit/FN05/knowledge-scope-search-store.test.ts` 신규
- `tests/unit/FN05/knowledge-scope-search-api.test.ts` 신규
- `tests/browser/UI10/knowledge-scope-search-dom.test.ts` 신규
- `tests/browser/UI10/knowledge-scope-search-dom-harness.tsx` 신규
- `docs/04_test_reports/AV3/FN05_KNOWLEDGE_SCOPE_SEARCH_RESULT.md` 신규

## 불변 계약
- 기존GET knowledge의선택 scope query만추가: 최대2048자canonical JSON 정확{stageRef,taskRef,includeProjectWide};ref둘다null/중복query/비정규JSON/추가key/변조·잘못된참조거절. 원결정안§2.1의wire그대로,직접경로/UUID입력UI0.
- projectMember먼저·실제동일project의고정적용본/계획과정확노드/업무를기존검증/API로확인. 무권한/다른project와미존재의원문·상태차이노출0. 선택stage OR task,includeProjectWide true일때만빈stage/task공통포함. 종류/상태/제목·이유/정렬/limit와같이서버WHERE에서페이지제한전에적용. 현재페이지필터후전체검색완료표시금지.
- 필터cursor는KNOWLEDGE_SCOPE_V1+canonical scope/project/actor/기존query-kind-status-limit에결박,다른scope/공통포함/무필터와재사용거절. scope없으면기존cursor filter직렬화·기존SQL매개값·기존검색/응답KnowledgeHit형식보존.
- UI10은기존workspace적용본/work-plans목록/정확GET에서선택한정확stage/task만사용. 검색조건/공통포함선택·조건변경시기존cursor다음페이지차단·비동기늦은결과의현재문맥덮기금지. 기존지식작성buffer/승인pending·정정/공유·검색query/kind/status동작보존,목록자동본문조회/새권한/공유0.
- 기존SELECT범위필터source변경은포함. 새table/DDL/migration/schema·실제DB접속/SQL실행·정책/권한/서비스/Secret/인증서/Agent/비용0. 기존KnowledgeScope관련성은ACL/실행권한이아니다.

## 순서·검증
TEST_ONLY 신규unit3/필요SSR-DOM2부터,제품6은MainfreshRED뒤GO. 기존시험파일수정/삭제·기대완화0. 무필터호환양성,정확canonical/길이·중복/두refnull·잘못된동일/타project참조,stage/task OR+공통truefalse/상태와페이지경계,actor/project/filtercursor변조·무필터혼용,Web정확wire·현재조건/지연응답을집중검사한다. serverfakeDB/SQL문자열대조는실PG문법/권한집행증거가아니다. 직접영향기존knowledge-api/knowledge-search-filter/knowledge-scope-store에서필요회귀·type·write:false화면bundle만선택한다.
실제DOM은변경된검색선택·검색전송/결과/다음cursor거절·지연/권한거절핵심만,UI08/완료업로드·공유·전체브라우저회귀반복0. 신규QA는Main사전등록·GO전생성0·timeout연장/skip0. 독립검수·exactdiff/protected12·Main검증/정확정리뒤결과source-only범위와실PG/served/사용자인수미검증을기록한다. 전체FN05/UI10/Stage/계획완료로승격하지않는다. Main은제품write0·한시점단일writer,새허용파일이필요하면수정전근거보고/범위고정한다.
