# UI05 준비 원문에서 사람 능력보고 고정 조회 — 2026-10-30

## 근거·업무·범위
- 승인된 WORK_PLAN/UI05·SCREEN_WORK.md UI05의 버전/환경/도구와 근거 원문 접근을 구현한다. 신산님 승인 FN06 HUMAN r2 고정 GET를 소비할 뿐 새 공개 API·저장/승인/권한/DB 계약은 추가하지 않는다. Main의 내부 연결 판단이며 같은 범위 구현 재승인을 요구하지 않는다.
- 안전 checkpoint f5fdaa90f3fe909c717f548cebfa707348a02489, 기존 codex/av3-stage-b. Main 소유 WORK_STATUS dirty/보호untracked8 보존. 기존 Primary 단일 code writer·기존 Reviewer 읽기검수·Main 관리/문서/검수/통합. 새 세션/branch/자동화0.
- 검산 완료한 과거 준비 원문의 intent.capabilityRef는 HUMAN namespace 존재가 검증된 참조가 아니다. ‘사람 능력보고 확인’은 해당 exact ref의 HUMAN 고정 GET 조회 시도다. 성공도 실측·현재권한·준비완료로 승격하지 않는다. UI04 준비 작성/실제 공급자/C1/7부족조건·false 변경0.

## 정확 수정 allowlist3·시작SHA256
|파일|시작SHA256|
|---|---|
|apps/web/src/features/session-detail/PreparationHistory.tsx|AA5D309D53D37804CB20A61ADBE0B937993D0F722FEC2A28A378275D484B28D3|
|tests/browser/UI05/preparation-history-dom.test.ts|E2334E18F25D750416FA4FDF5799A296E6A331A9F53B502B5CA6D4214B37C0C3|
|tests/browser/UI05/preparation-history-dom-harness.tsx|CE732031EEB4872BBA5AE9DA30AEEEEC63803E89AE0E5946349E4F0E5BE18242|

기존 helper `apps/web/src/features/session-detail/preparation-history-api.ts`84500935B3E1672E9BB14F428F67F9D8AC055A655085F8BCD26E69ACFFF43A10 및 `apps/web/src/features/connections/capability-report-api.ts`0B501439BB73E63E4CDEEE419EF5F3DC9759834F6B96E09D4D026A62ADD69143는 수정 없이 소비한다. 부모 전체App/상위선택·server·SQL·정책·기존완료기준·보호8변경0. 추가경로필요시소비선/이유를Main에보고한다. Primary문서/commit/push0·Main활성writer제품수정0.

## 화면 단위 상세
1. 기존 전체 준비 이력의 페이지·선택·원문·NOT_AUTHORIZED 표시는 보존한다. 검산 완료한 선택 준비 원문에만 버튼 **사람 능력보고 확인**과 원 capability exact id/version/hash를 표시한다. 보조 설명은 ‘사람 주장 조회이며 실측·실행 허가가 아닙니다. 이 참조가 사람보고에 속하는지는 조회로 확인합니다.’로 제공한다.
2. 초기렌더·준비선택·이력페이지변경에는 추가 보고 GET0. 사용자가 버튼을 누를 때만 기존 readCapabilityReport(client,projectId,exactRef)를 호출한다. 버전1 외에는 미지원/미확인 표시·GET0이며 latest/search/다른참조자동시도0.
3. 로딩은 이전 보고 본문을 즉시 숨긴다. 성공 패널에는 정확 ref/hash·사람 원주장과 서버 UNVERIFIED/CANDIDATE_ONLY·실행/dispatch false, 연결/환경 exactrefs·보고/관측 시각·기한·현재성 issues를 구분해 표시한다. 기존 준비 원문도 같이 유지한다. 사람 주장/서버판정의 조작을 성공 처리하지 않는다.
4. 보고 snapshot.claim.connectionRef/environmentRef는 선택 준비 intent.connectionRef/environmentRef와 각각 fullref exact 일치해야 한다. 불일치는 ‘선택 준비와 대상 불일치·미확인’으로 닫고 원문을 다른 준비/보고로 대체하지 않는다. 보고 GET의 exact ref/hash 검산을 우회하거나 새 verifier를 중복 작성하지 않는다.
5. 명시 **능력보고 닫기**로 보고만 닫으며 이력페이지·준비선택은 보존한다. 보고404는 해당참조의 HUMAN보고 미확인이지 준비자료삭제/연결완료가 아니다. 401은 기존 인증상실 callback, 403/404/422/503/응답형식/hash불일치/연결실패는 본문숨김·원참조유지·명시 재시도 가능으로 표시한다. 자동 POST/명령·원문FS접속0.
6. 선택준비/페이지/닫기·재시도·owner·project/assignment/fullref·실client객체/clientId·같은인스턴스ABA 전환과 늦은JSON/native digest 뒤에도 이전보고·오류를 다시표시하지 않는다. 기존owner/selection객체·sequence를 재사용하고 신규표시도 정확 선택원문에 결박한다. KEY강제remount로문맥검증을대체하지않는다. 저장buffer/원명령/기존페이지복구를변경하지않는다.

## 기능 단위·검수
- 실제 기존 PreparationHistory + 기존 readPreparationOriginal 검산 뒤 기존 readCapabilityReport만 명시 소비한다. 숨은 서버 쓰기·AUTHORITY 소비·CURRENT 판정 생성0.
- 실제 UI RED 선행: 기존본에서 보고열기 동선이 없어 실패하는 반례를 먼저 실행한다. 이후 정상 exactref/pair·원주장/서버판정/현재성, 수동열기/닫기·초기GET0, wrongpair/변조hash/404/401/다른version, 페이지/선택보존·owner/실client/ABA·lateJSON/native digest 반례를 직접 확인한다. POST0 및 namespace 미확인을 명시한다.
- 기존 45행 이력·20개 paging/이전/재시도/선택원문 검산·기존API helper·원형/hash기준은 유지한다. 합성 새보고 fixture를 추가해 준비의 원capabilityRef와 연결/환경 fullref만 필요한 해당반례에서 정확 정합화하며 기존 실패기준 완화0.
- 기존 helper unit `node --test tests/unit/UI05/preparation-history-api.test.ts`와 신규/변경 DOM의 필요한 조건, 표준 `npm run build`(typecheck 포함), `git diff --check`를 Main이 fresh 검증한다. 같은코드의완료검사전수반복0·합성source/실Edge 증거를 실HTTP/DB/전체App으로 승격0.
- Primary는 exact3hash/diff·정확명령/exit/RED→GREEN·오류횟수·미검증/QA회수를 제출하고 writer해제한다. 독립 C/I·Main검증 뒤 기존branch checkpoint/private 게시만 수행하며 실제Stagegate 미달 PR/main병합0.

## QA 사전 등록·회수·실행 제외
- 신규 literal `D:/tmp/anvil-v3-stage-b/ui05-preparation-capability-20261030-01`, 담당 Primary/Main 순차·최대30분. in-process Vite 메모리bundle·실Edge·메모리 Response transport만 사용한다. 기존 DOM QA root는 이 새경로로 한정 교체하고 기존 env flag `ANVIL_UI05_PREPARATION_HISTORY_DOM_QA=1`/선택 `ANVIL_UI05_HISTORY_CASE`를 유지한다.
- 매실행직전부재·parent realpath/link/owner와동일경로Edge0 확인후새빈경로. 전체setup outertry/finally·launch시도전불명표식·확정context/browserclose·환경원형복구·marker/realpath/link/owner확인후등록소유자원만제거·독립경로/프로세스잔여0. launch/close불명은강제kill/삭제0·보존/실패/보고. 관리자서비스/포트listener0.
- 실제DB/SQL/계정/권한·키Secretcertificate·서비스·Agent/Job·비용/Oracle/운영·제품원문IO0. 물리불명/served/사용자인수는NOT_RUN. rollback은한정source checkpoint revert이며 실제자료/DB삭제0. 같은근본실패3회면추가지시중단/Main판단, 경로는inventory→Leaf→읽기. 모든산출물한국어.