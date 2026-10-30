# UI05 전체 실행 준비 이력·원문 선택 source 검수 결과 — 2026-10-30

## 판정
- 승인 A안의 source/UI·합성 검증 범위 검수 완료(C0/I0). 실제 DB·서비스 기능/사용자인수·UI05/Stage/전체 작업계획서 완료는 아니다. 독립 최종 C0/I0와 Main 실제 검증을 대조했고 checkpoint로 보존한다.
- 직접 승인 1F480147F2907718A87433EEEAE42F5B93BE6C298BEDBAFCB9B8EA73395C8E96, 결정안 r2 0AC548FDFB371A576C09977A108F14818B740EBC0BDBB2DDAFD203C8C9A0817E, WI 8A1EB49E587DD23827B3D6794A46B6775007704F7E6DBE4721F3C40B6FA6885D.
- 시작 HEAD9eb36679df39704def0f4fd1758769728b58e1dc/기존 codex/av3-stage-b, Main WORK_STATUS 변경과 보호 untracked8 보존. 기존 Primary 단일 구현·writer 해제, 기존 Reviewer 읽기 검수, Main 독립 실행·통합. 실제 DB/키/서비스/Agent·새 SQL/table0.

## 변경 전·후와 영향
- 전: 집계 최근20개/hasMore만 제공하여21번째 이후 ID를 발견하지 못했다. 알려진 ID의 원문GET만으로 탐색 공백을 해결하지 못한다.
- 후: 기존 집계 GET과 원문 reader·codec·권한을 보존하고 전용 fixed20 보호 GET을 추가했다. actor/project/fullassignment/order/20·namespace 결박 cursor와 DB US/UUID tuple를 보존하며 각 원문 hash/임무를 검산한다. metadata 목록에는 자유reason/fullintent를 복제하지 않는다.
- UI05에서 명시 열기→과거/이전/재시도/첫페이지 새로고침→서버ref 선택→원문hash 대조를 연결했다. 일반500 이동 실패에는 직전 성공 ref/position만 보존하고 보호 목록+원문을 다시 읽어 복구하며401/403/404·문맥/ABA/late에는 이전본문을 숨긴다. 실행허가/POST/Agent 호출0.
- 기존 연결2파일 diff는 route/import·codec3줄 추가, 부모 컴포넌트 연결과 이전이력 안내 문구만이다. 기존 미확인 명령/작성buffer 전달·서명 변경0. DOM harness는 실제 부모 전체가 아닌 신규자식 직접렌더이며 고정 buffer 객체 비교를 실제부모 통합검증으로 주장하지 않는다.

## Main 실제 검증
1. dab562 exit0/23PASS/0skip/5815.5179ms:
   node --test tests/unit/FN08/execution-preparation-pages.test.ts tests/unit/UI05/preparation-history-api.test.ts tests/unit/FN08/execution-preparation.test.ts tests/unit/UI05/session-detail.test.ts
   신규9+직접인접14. 실 ProjectExecutionPreparations reader/codec·ApiClient를 소비하지만 인증/assignment/DB query/정렬은 메모리 stub이다. 신규 route strict query/인증/namespace/집계불변은 source 대조이며 실제HTTP 통합 아님.
2. 7357cc exit0/6PASS/0skip/1215.2271ms:
   node --test tests/unit/UI05/result-page-api.test.ts tests/unit/FN08/execution-state.test.ts
   위23과 별도 실행한 직접 인접6이다. 이후 추가된 원문 문법 재봉인 반례는 980526에서 --test-name-pattern=browser-safe intent grammar rejects resealed source path/scope corruption으로 정확1사례/0skip/161.7789ms/exit0를 별도검증했다. Main23+6+1은 세 번의 실제 실행이며 단일30 전수 명령 PASS로 합성하지 않는다.
3. c7907a exit0/6자식+부모 Node7PASS/0skip/7460.3393ms:
   ANVIL_UI05_PREPARATION_HISTORY_DOM_QA=1 node --test tests/browser/UI05/preparation-history-dom.test.ts
   21번째발견→정확원문/왕복, 실패페이지 성공위치 유지·재시도,500선택복구의 보호2GET, sameclientABA/latejson, 실제WebCrypto digest반환지연 후닫기/403숨김, project/fullref/client객체변경/손상원문을 실 Edge/React/ApiClient+메모리Response transport로 확인했다. 자동 nonGET0·외부Network0·runtime오류0. 실제서버listener/API/DB0.
   번들 SHA256 d5cde02dc113ab44c32d7d1dc70b9c18597389d3bd70ac564e39c967a478f539.
4. 7357cc npm run build(내부typecheck) exit0/476modules/429ms, git diff --check0. 기존500kB chunk경고 보존·설정/기준 완화0.
5. Main QA시작2026-10-30T09:22:41.164Z(18:22:41KST), 약7초내 finally환경복원/회수, bb75eb별도경로부재/해당Edge0. D:/tmp/anvil-v3-stage-b/ui05-preparation-history-20261030-01 이외 자원 변경0. 실제launch/close결과불명 강제유발은 NOT_RUN이며 코드상불명root보존과정상회수 증거를 구분한다.
6. 1bba24 코드9+보호8 정확17hash 일치. 실제 private branch는9eb36679, remote main/development-main f976ed5e29e14b13e12729d5b1ccf98f050f2210. local main은 과거2026-10-08부터0443043251d25aa77c17d23165b7c9299c8dbeb8이며 변경하지 않았다. remote main과 local main을 혼동하지 않는다.

## 오류·재검수 이력
- 최초391c73 신규모듈부재6FAIL을 RED로 남겼다. fixture noUncheckedIndexedAccess와Vite output union 시험타입 오류는2회 보정·제품기준 완화0.
- 독립 I1/Main1482cc: Node전용runtime import로브라우저원문선택실패. 실DOM7d4e80은21번째목록성공후원문timeout/Nodecrypto경고였으며Buffer직접예외 관측과구분했다. browser-safe TextEncoder/문법검산으로e586f2 동일조건GREEN, 최종API84500935.
- I2/Main923c37: 이동실패에성공선택삭제.9f1069 선택→500→복구부재RED후05b7f5 동일조건GREEN·최종Main c7907a 재확인. 성공본문캐시 재노출 대신 ref/position보존·보호2GET이다.
- QA I3는검수당시 closed=true 가정과작성중지문차이를Main현재launch전closed=false로재확인했다. launch/close불명은NOT_RUN·임의정리0. Reviewer가최종 E2334E18 지문을재확인해현재C0/I0로해소했다.
- Primary의30PASS 제출숫자는 원출력492c52의신규서버6/client4+기존20으로확인했다. Main첫실행당시client3사례이후추가된원문문법재봉인반례1이차이였고 980526에서그1사례만추가검증했다. Main판정은위23+6+1의각실제출력에근거한다.

## 최종 코드 지문 — 정확9
|경로|SHA256|
|---|---|
|apps/server/modules/executions/project-execution-preparation-pages.ts|10DF7AA589CE1EDF2EA807E385FBF480B9C279F58FBF4C5C2A9256937B74BA83|
|apps/server/modules/projects/routes.ts|474C89F3BB870D998B3B884025DB4EC089F7119C8C9C8A271FEA0F47F40BF583|
|apps/web/src/features/session-detail/preparation-history-api.ts|84500935B3E1672E9BB14F428F67F9D8AC055A655085F8BCD26E69ACFFF43A10|
|apps/web/src/features/session-detail/PreparationHistory.tsx|AA5D309D53D37804CB20A61ADBE0B937993D0F722FEC2A28A378275D484B28D3|
|apps/web/src/features/session-detail/SessionDetailPage.tsx|F28C47D90C681F06863F51D32A35D166FA47D2C494F87CD40E6AB9D6BEA7B1BB|
|tests/unit/FN08/execution-preparation-pages.test.ts|B50804C8B7BB2277731C94E31088EF4218F64D6684C602F1C92927C60D9A1D6F|
|tests/unit/UI05/preparation-history-api.test.ts|02B13C107C0F91BAAAE66CC4AB9A03C6E08AECABE3A4B45E8335CEDFC7469766|
|tests/browser/UI05/preparation-history-dom.test.ts|E2334E18F25D750416FA4FDF5799A296E6A331A9F53B502B5CA6D4214B37C0C3|
|tests/browser/UI05/preparation-history-dom-harness.tsx|CE732031EEB4872BBA5AE9DA30AEEEEC63803E89AE0E5946349E4F0E5BE18242|

## 미검증·운영·다음
실제DB/SQL정렬·RLS/경합·인증/실HTTPAPI·served·실부모buffer통합·물리launch/close불명·사용자인수는NOT_RUN. 정상domain의20요약/ref/고정조건한도상2MiB초과는도달하기어려운마지막방어 source 확인이며실초과PASS아니다. cursor는snapshot/as-of가아니므로동시추가/지연COMMIT 전체순회완전성보장0·첫페이지재탐색.
정확9경로source는한정commit revert로복구가능하며DB/runtime변경없어환경rollback없음. 전체Stagegate 불충족에서PR/main병합·branch정리0. 다음미완료이해검토 승인 연결은기존prepareA/UI05A범위가아니며새결정안으로분리,채택전코드GO0이다.
