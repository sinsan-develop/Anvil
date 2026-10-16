# Anvil 재설계 작업현황

## 1. 현재 상태와 기록 기준

- PMO가 AV3-PMO-FN06-CANDIDATE-API-01 승인을 전달했다. PMO가 사용자 위임·10분 기한/최신 답변을 직접 대조한 판단이며, 이 담당자가 임의 무응답 승인을 만들지 않았다. 기존 명령 registerConnection/saveEnvironment의 kind별 후보 payload와 후보 GET 목록/불변 버전2개만 연결한다. 완성형 필수 참조·신뢰·실제 실행은 열지 않는다. 최근 재인증·현재 제어/명시 정책·후보 exact 이전 ref/CAS·현재 policyRef·유한 기한/필요 일회 소비·감사를 내부 저장 transaction에서 확인한다. 형식상 적합해도 아직 없는 완성형 host/environment/source/Secret ref는412, 후보 ID를 가짜 실체로 쓰지 않는다.
- 후보 HTTP 분기·승인 소비의 좁은 연산 목록을 연결한 로컬 후보: unit150 PASS/2835ms·type/diff0. 실제 시험에 내부 PG와 별도 HTTP 인증/Origin/타 프로젝트·원 명령 응답 유실 재확인·불완전 정의 승격412를 구분해 추가했다. 새41은 아직 미적용이며 다음 exact 게시본으로 기존40 checksum/DB 신원을 재확인한 뒤 적용한다. 실제 기능 GREEN·HTTP PASS로 선승격하지 않는다.

- FN06 04b49e9c exact private/WSL clean actual RED1/1161ms(기능909ms)/skip0: 후보 목록 내부 함수가 새 테이블 부재42P01로 실패했다. finally 후 독립 users/projects/documents/artifacts/commands/policy/승인 count0·후보2테이블 NOT_PRESENT·임시root[]·지속원문 uid1000/0700/link0/실경로 동일/empty·migrations40 확인. 새 forward41 초안을 runner의 마지막 명시 순서에 연결했으며 적용 전이다. 공개 API/operation 분기는 PMO의 별도 승인 확인 전 미연결이고 실제 저장 GREEN·사용자 HTTP/browser는 미검증이다. 기존40 SQL 불변·서비스/Secret·실제 Agent 변경0이다.

- PMO 실행 지시 수신: 기존 branch/단일 Main writer로 FN06 후보 저장·조회/환경/6능력 기록만 진행한다. local main ref0443043251d25aa77c17d23165b7c9299c8dbeb8과 사설 remote main f976ed5e29e14b13e12729d5b1ccf98f050f2210은 구분하며 보정/reset/새 branch를 하지 않는다. 미연결 후보는 완성형 ConnectionDefinition/EnvironmentVersion과 별도 내부 저장·NOT_READY로 분리하며 필수 참조를 nullable로 완화하지 않는다. 실제 host/참조 저장이 아직 없으면 가짜 FK/실측을 만들지 않고 제공된 연결 ref는412로 거절한다. 후보 자신의 개정 ref와 현재 policy ref는 실제 project/id/version/hash를 대조한다.
- 후보 전용 공개 조회2개·기존 명령 payload의 kind 분기는 PMO가 권장안 AV3-PMO-FN06-CANDIDATE-API-01로 신산님 승인 절차를 담당한다. 승인 확인 전 route/공개 소비는 연결하지 않는다. 내부 입력 신규 부재 RED1→2 PASS/443ms·type0, 내부 저장/조회와 새 forward41 `0006_connection_candidates` 초안/실제 실패 시험만 작성했다. 기존40 SQL은 수정하지 않았고 새 SQL/DB 적용·실제 저장 GREEN은 아직 미실행이다.
- FN06 actual QA 자원 사전등록: 기존 개발 DB anvil_v3_development의 qa-connection-candidate-<UUID> 합성 사용자2·UUID 프로젝트2·현재 합성 client·후보/불변 버전/정책/승인·명령/감사만 한 시험 수명으로 생성한다. owner UUID 배열 외 자료는 건드리지 않으며 finally transaction에서 참조를 정확히 분리하고 해당 UUID 행만 정리·독립 잔여를 확인한다. 시험 파일/폴더·컨테이너·포트·실제 credential/키·Agent·서비스 생성0, 보호 config 원문 출력0이다. 기존 정책/일회 승인 helper를 읽으며 잘못 추측한 파일 읽기2회는 실제 파일 목록/기존 소유 파일로 정정했고 ACL·자료 변경0이다.

- 2026-10-17 신산님 직접 응답 ‘두 가지 승인’ 확인: FN06 연결 등록 후보·프로젝트 허가·버전별 환경·능력 기록의 기존 개발 DB 보완과, 해당 신규 코드/테스트·비밀 없는 문서의 기존 private codex/av3-stage-b 게시 범위가 승인됐다. 이전 승인 대기는 해소됐다. 실제 PC 등록 키/credential 발급·Agent/유료 호출·계정/설치·소스 변경·서비스/Secret/운영·main 직접 쓰기/새 branch/force/history rewrite는 여전히 제외다. 기존 SQL/자료 보존·합성 QA exact 생성/정리 원칙을 유지한다.
- 같은 직접 지시로 Anvil의 모든 진행 보고·요청을 PMO(01a054f5-c2b4-7af0-b31a-c8148ef74642)에 전달하고 PMO 지시를 받아 진행하는 경로로 전환했다. 프로젝트 AGENTS에 기록했으며 PMO 공통 파일은 변경하지 않았다. PMO에 최신 사용자 원문·정본/branch·완료 증거/미검증·로컬 미게시2파일·새로 승인된 범위/제외·다음 FN06 실행 지시 요청을 전달했다. PMO가 정본/실제 상태 대조 후 지시하겠다고 수신 확인했다. 전달만으로 FN06 DB 적용·게시/실제 Agent를 실행하지 않았으며 다음은 PMO의 구체 지시에 따라 수행한다.

- FN03 단계 연결 최종 checkpoint adaac161e8dcc934db3260f618ee2a8cab9b082b local/private 동일·WSL exact/clean actual1 PASS/1317ms(기능998ms)/skip0, 독립 DB39종 각0·시험root[]·지속원문 uid1000/0700/link0/실경로 동일/empty·migrations40. 정본6문서 동기화/hash 일치 확인. 최종 Web의 baseStageNodeRef 보존/본문-only 제안 구분도 실제 같은 함수/API·PG에서 확인했다. Stage B branch-only이며 main f976ed5e 불변, PR/병합/서비스 교체·실제 Agent 호출0이다.
- 다음 선행 대조: FN03 소스 실관측/드리프트·FN01 VERIFIED 기준선과 FN02 실행 상태 기반 적용은 FN06/FN08 실제 연결·관측이 필요하다. 계획의 FN06 조기 타당성 경로를 준비하되 문서 저장 승인으로 등록 신뢰/DB 범위를 확대하지 않는다. 실제 개발 DB의 연결용 예정8테이블 존재0을 이름만 읽어 확인했다. 신산님께 ‘FN06 연결 등록 계약·개발 DB 보완’ 비동기 승인1건 요청; 답변 전 forward41/저장/API·권한·credential/키·Agent/비용·서비스 변경0이다. 단순 입력 검사만 준비했으며 연결 완료 진도로 세지 않는다.
- FN06 사전 입력 검사: 기존 INTERFACES §12의 등록 후보7필드·참조 exact version/hash·중복/기한/유한 정책/알려진 비밀 거절·원문 복제를 구현했다. 등록 maxAge/maxReferences는 호출한 확정 정책을 필수로 받고 임의 수명을 기본값으로 만들지 않는다. 신규 모듈 부재 RED1→입력2 PASS/225ms, 전체unit148 PASS/2859ms·type/diff0. 실제 회원/최근 재인증·제어·정책/참조 실재성·host 서명은 후속 저장 transaction의 검사이며 이 순수 함수만으로 신뢰/실제 연결을 주장하지 않는다. 신규 시험 디렉터리 부재로 첫 patch1회가 적용 전에 거절되어 정확 폴더만 생성 후 적용했다. 계획상 아직 없는 connector/시험 폴더 읽기2회는 부재를 확인한 기록이며 ACL·기존 자료 변경0이다. 신규 FN06 코드/시험2파일은 Main 소유 로컬 미게시 상태로 보존하며 Stage B 기존 게시 승인으로 새 연결 구현의 외부 게시 권한을 추정하지 않는다. 기존 브라우저 시험의 잘못 옮긴 본문을 찾지 못한 patch1회도 적용 전 거절됐고 원문을 대조한 뒤 정정했다.

- FN03/UI06 6cdb21cb exact private/WSL clean actual 단계1 PASS/1199ms(기능952ms)/skip0·공유 제안 서버의 인접 기존 문서1 PASS/14585ms(기능14288ms)/skip0. 동일 Web 단계 조회/선택→업로드1/저장 후 합성 응답 단절→같은 명령 재확인/같은 ref→원문/단계재조회→제안 diff/명시 선택·새 버전 보존을 확인했다. 제안 선택의 단계 null 위장409·다른 적용/과거 이력 검사도 포함한다. 독립39종 count0·시험root[]·지속원문 보호/empty·migrations40, 기존 SQL 재실행0. 현재 마지막 Web 후속은 단계만 바꾼 입력을 본문 제안으로 조용히 유실하지 않도록 `baseStageNodeRef`를 분리했다(신규 거절 RED1→GREEN2/150ms). 최초 새 문서 저장의 오래된 buffer.pending 참조로 화면 갱신 실패1을 기존 정상 시험에서 확인→현재 updater의 pending으로 보정, 편집8 PASS/8.2초·단위146 PASS/2249ms·type/build0(Web93/604.60kB/gzip156.95·기존 경고 유지). 최종 Web same-client actual은 다음 exact 게시본에서 확인하며 사용자용 old backend/relay·만료 bootstrap·Secret/실제 정책은 불변이다. 전체 FN03·Stage B·44업무 완료로 승격하지 않는다.

- FN03/UI06 20e18f45b8a3c34fa0af7bdc944a2044c0c78340 exact private/WSL clean actual RED1/851ms(기능604ms)/skip0: 같은 Web 단계 선택·업로드1/저장 뒤 합성 응답 단절·동일 명령 재확인·단계/원문 재조회는 도달했으나 기존 제안 서버가 non-null 단계를 `DOCUMENT_REFERENCE_CONNECTION_PENDING`412로 차단했다. 원인은 기존 null-only 경계이며 신규 승인된 단계 연결을 실제 snapshot/양식으로 확인하도록 좁혔다. 제안 선택도 원 문서의 stage_ref_json과 정확히 일치해야 하며 몰래 해제/변경은409를 유지한다. 새 schema/SQL 변경0·원문/확정본 불변. unit146 PASS/1938ms·type/diff0, 후보 실제 GREEN은 다음 exact 게시본에서 확인한다. 실패 후 독립39종 count0·임시root[]·지속원문 보호/empty·migrations40, 사용자용 runtime/Secret/정책 변경0이다.

- FN03 단계 서버 f231218eec876911ffccc1d46f2001e8777c6054 exact private/WSL clean에서 forward40 `0003_document_stage_bindings` checksum5ec9965d55ad7968d5dac7a2cf90f388b6e3bf6e1a1e74913d32bb8d1c4041e1 적용·기존39 SQL 불변, 실제1 PASS/775ms(기능527ms)/skip0. 교차 프로젝트404·없는 노드/맞지 않는 양식422·같은 명령 동시2/버전1·현재 적용 교체409·과거 단계 보존·명시 해제 새 버전·변조503/복원·직접 수정42501을 확인했다. 독립39종 count0·QA root[]·지속원문 uid1000/0700/link0/실경로 동일/empty·migrations40이다. 방법론 적용 전환·Agent/실제 사용자·서비스/Secret 변경0.
- UI06 단계 후속: 선택 참조를 편집 버퍼/pending/동일 저장 명령/hash에 보존(RED1→GREEN4/160ms), 자동 선택 없이 현재 고정 적용본/정확 양식의 단계를 조회하고 선택·저장·다시 편집한다. 단계 선택 fixture RED1→GREEN1/2.5초, 추가 충돌 보존 RED1→GREEN4/149ms·제안 선택 단계 보존 RED1→GREEN2/242ms. 전체unit146 PASS/2689ms, type/build0(Web93/604.31kB/gzip156.89·기존 경고 유지). 타입 검사1회는 unknown 참조의 선행 narrowing 누락으로 실패→nullable 검사를 먼저 적용해 해소했다. 직접 영향 browser26 중24 PASS/2 FAIL은 확장한 합성 fixture가 옛 충돌 seed의 미연결 null을 undefined로 바꾼 원인이었으며 제품 조건/기대값을 낮추지 않고 fixture의 null을 명시했다. 수정한 편집8 PASS/8.7초, 다른18 PASS는 코드/환경 불변으로 재실행하지 않는다.
- 다음 실제 QA는 같은 등록 자원/명명/수명과 forward40을 재사용해 같은 Web 함수의 단계 선택→업로드/저장 응답 단절→동일 명령 재확인→원문/단계 재조회→수정 제안 선택을 대조한다. 실제 제안 서버는 아직 non-null 단계를412로 막는 기존 경계가 남아 있으므로 신규 시험에서 먼저 실패를 확인한다. 이 검증 전 해당 경로를 통과/완료로 표시하지 않는다. Windows 사용자용 old backend/relay·만료 bootstrap은 불변, 실제 사용자 browser↔DB 여정/Stage B/전체44 완료 아님이다.

- FN03 단계 실제 RED38ffcfa2 exact private/WSL clean1 FAIL/688ms(기능365ms)/skip0: stage-options GET 미연결404(정확 노드/양식 선택 조회200 필요). 후속은 현재 고정 snapshot/graph hash·프로젝트/노드/양식 exact ref를 확인하고 문서 hash와 불변 버전에 stageNodeRef를 함께 저장하도록 연결했다. 새 forward40 `0003_document_stage_bindings` checksum5ec9965d55ad7968d5dac7a2cf90f388b6e3bf6e1a1e74913d32bb8d1c4041e1 후보 작성·미적용/실제 GREEN/UI06 미검증이며 이전39 SQL은 불변이다. 과거 문서는 당시 적용본으로 읽고 새로운 저장은 현재 적용본을 요구한다. 등록 QA의 새 자료만 정리·서비스/Secret·실제 사용자 변경0. 단위143 PASS/4497ms·type/diff0이다.

- FN03 단계 입력/양식 exact ref RED2→GREEN2/128ms. 실제 검증은 별도 `document-stages.test.ts`에서 기존 QA 명명법의 qa-document-storage-<UUID> 사용자2·UUID 프로젝트2·현재 client/명시 문서 정책·실제 내장 v2의 합성 고정 snapshot을 사용한다. 두 프로젝트로 교차 적용 참조를 검사하며 /tmp/anvil-v3-document-qa-<UUID> uid1000/0700·한 시험 수명·finally 소유 UUID/실경로/링크 확인 후 정확 정리한다. 이는 실제 방법론 적용 전환을 구현/통과한 증거가 아니라 승인된 테스트 seed다. 신규40 작성/적용·단계 저장 GREEN/UI06 미검증, 지속 root/기존 SQL/서비스·Secret 변경0.

- 2026-10-17 FN03 후속 직접 승인 `call_1553fd04d9e64a098d20ba83a7e7525c` ‘문서·방법론 단계 연결 계약·개발 DB 보완 승인’을 확인했다. 기준def4a0ae clean/private·정본6 동기화에서 Main 어울 단일 writer로 documents module·UI06/기존 문서 client 소비·신규 forward40/runner·직접 시험·관련 정본만 작업한다. 현재 stage_ref_json 열은 있으나 저장은412·Web hash는null만 지원하므로 nullable 기존 동작을 보존하면서 실제 고정 적용 snapshot/노드·양식 exact ref를 검사한다. 새 저장은 현재 적용본과 결박하고 과거 문서 조회는 당시 고정 적용본/원문을 유지한다. 변경 전38+39 SQL·원문·확정 이력은 보존하며 적용 전환·실행·자동 확정·실제 사용자 정책/Agent·Secret/서비스/운영은 제외한다. 기존 qa-document-storage UUID 사용자2/프로젝트1·/tmp/anvil-v3-document-qa-<UUID> uid1000/0700·한 시험 수명/finally exact 정리를 재사용하고 새 자원 범위를 늘리지 않는다. 새 code/schema/40 적용은 아직0이다.

- FN02/UI03 현재 적용 구분866ea25f039d3de671136ac595d349a0e0b96234 local/private·WSL exact/clean actual1 PASS/1250ms(기능968ms)/skip0. 같은 Web reader가 개정·확정 뒤에도 고정 적용 ref와 별개임을 실제 API/PG에서 확인했다. SQL39 재적용0·독립 DB39종 각0·시험root[]·지속원문 uid1000/0700/link0/실경로 동일/empty·migrations39. 최신 단위141 PASS/1972ms·type/build0·UI03 fixture1/3.3초, Windows backend/relay/초기 비밀·실제 사용자 정책·Agent/서비스 변경0. 완료된 범위는 다시 구현하지 않으며 FN02 적용 전환/전체 기능·사용자 browser DB 인수는 여전히 미완료다.
- 다음 Stage B FN03의 stageNodeRef는 현재 저장에서412·Web에서는 null로만 처리된다. 정본 계약은 `{applicationId,nodeId}`이며 실제 적용 snapshot/노드·양식 exact ref와 문서 불변 버전을 연결해야 한다. 이 계약/새 forward 보호·UI06 연결에 대해 신산님께 비동기 승인1건을 요청했다. 승인 전 해당 DB/저장 연산은 변경하지 않고 기존 입력·조회/소비 경계만 대조한다. 기존 원문·확정본·SQL·적용 이력을 보존하고 방법론 적용 전환·업무 실행·자동 확정·실제 사용자 정책/Agent·Secret/서비스/운영은 제외한다.

- UI03 현재 적용본 표시 후속은 기존 GET project.currentMethodologyRef 계약만 소비하며 새 API/schema/적용 쓰기를 추가하지 않았다. 적용 snapshot ref/세대를 편집·확정 후보와 별도 표시하고 필드 누락을 미적용으로 간주하지 않는다. 신규 단위 RED1→GREEN2/144ms·fixture1 PASS/3.3초·type/build0(Web91/598.26kB/gzip155.41, 기존 경고 불변). 실제 같은 Web reader의 현재 적용 없음 대조는 다음 exact 게시본에서 확인 예정이다. 기존 고정 적용본/서비스/실제 사용자·Secret 변경0.

- FN02/UI03 과거 조회 후속e1ff6d1d43a4b42cffd3024468c62e1371ef75d5 local/private·WSL exact/clean actual1 PASS/1369ms(기능1112ms)/skip0: 같은 Web reader로 v1 확정 이력과 v2 미확정 분리를 다시 열었다. 독립 DB39종 각0·시험root[]·지속root uid1000/0700/link0/실경로 동일/empty·migrations39. 마지막 단위140 PASS/2113ms·type/diff0, 최신 UI fixture1/3.0초·기존 공통 UI 직접 영향10 PASS를 구분한다. 현재 Windows backend/relay/만료 bootstrap·Secret은 불변이며 사용자 browser↔DB 인수·방법론 적용 전환/FN02 전체는 미완료다. 다음은 현재 고정 적용본과 개정 후보의 화면 구분을 기존 프로젝트 조회 계약으로 연결하고, FN03/후속 실행 연결의 남은 선행을 계획 순서로 대조한다.

- FN02/UI03 19ce2bb7858807e3993cb0b8b02c0c0cbd96b04d local/private·WSL exact/clean actual2 PASS/1485ms(방법론1142·최초 생성1130ms)/skip0. 같은 Web prepare/write/read를 실제 API·PG에 연결해 직접 전용본 작성→저장 후 합성 receipt 단절→원 명령/같은 ref 재확인→내용 검토→별도 확정·원문 변조503/복원200을 확인했다. 최초 생성의 전용 snapshot 조회도 유지했다. 독립 DB39종 각0·시험root[]·지속원문 uid1000/0700/link0/실경로 동일/empty·migrations39, SQL39 재실행0·실제 사용자/Agent·서비스/Secret 변경0. 적용 전환은 FN08/FN09 실행 상태 근거와 FN04 영향 연결 부재로 미구현/fail-closed, 전체 FN02/Stage B/44업무 완료 아님이다.
- UI03 과거 버전 열기 부재 RED1→GREEN1/3.0초: 새 v2 개정이 v1 확정 사건을 승계하지 않고 이전/다음 조회로 원문/확정 이력을 다시 연다. Web91/597.37kB/gzip155.27·type/build0, 기존 경고 유지. 추가 실제 같은 Web의 과거 버전 조회는 다음 exact 게시본 검증 예정이다. 기존 조건/합격 기준·확정본/적용본을 바꾸지 않는다.

- FN02 서버635e3ad16073eb9a9878dba1e26ca720ee38da02 exact private/WSL clean에서 승인 forward39 `0002_project_methodology_revisions` checksumf816147a1454b428af090b0feb93e496b60cb4eaba7f5979fccdf919fc353e68 적용·이전38 불변·fixtures7·실제 사용자 생성0. 실제 FN02/FN11 2 PASS/1547ms(방법론1131·정책771ms)/skip0: 별도 정책/현재 기기·다른 사용자·동일 명령 동시2/버전1·copy/개정·METHOD5·최신 REWORK/확정·옛 사건 보존·공통본 불변·자동 적용0·옛 제어409/직접변조42501. 독립 DB39종 각0·시험root[]·지속root 보호/empty·migrations39다. 최초 private push의 remote commit_refs 오류1은 read-only로 원격c43b68d9/main불변 확인 뒤 동일 non-force push1회로 해소했고 우회/다른 대상 변경0이다.
- UI03 후속: React 명시 event mutation/functional 상태 갱신 스킬로 기존 공통 편집·검토를 보존하며 전용 gateway와 프로젝트별 root 버퍼를 연결했다. 명령 검사 RED1→GREEN1/158ms, 화면 부재 browser RED1→copy/내용검토/확정·응답 단절/화면 이동/뒤403의 원 명령 보존 focused1 PASS/2.8초. 직접 영향 공통 UI03은10 PASS(전용 fixture의 오류 code 대신 기존 한국어 오류를 기대해야 하는 실패1은 소비 계약대로 정정, 제품/기준 변경0). unit140 PASS/1872ms·type/build0(Web91/596.51kB/gzip155.08·기존 bundle/색상 경고 보존). 새 API same-client 실제 저장·검토·확정/오염503 및 기존 최초 생성 회귀는 다음 exact 게시본에 추가했으나 아직 실행 전이며 사용자용 backend/relay/Secret·실제 사용자 UI DB 인수는 미변경/미검증이다.

- FN02 c43b68d9 exact private/WSL clean actual RED1/592ms(기능332ms)/skip0: copyMethodology가 프로젝트 명령에 미등록400(명시 정책 미설정412 필요). 후속은 별도 project 명령/정책·현재 제어·CAS·receipt와 전용 버전 원문/검토/확정을 연결한다. 새 forward39 `0002_project_methodology_revisions` 후보만 작성했으며 기존38 SQL/자료는 불변·아직39 미적용/실제 GREEN/UI03 미검증이다. 기존 공통·생성 guard는 유지하고 project 분기는 실제 receipt/OWNER/client/현재 정책으로만 허용한다. 확정은 적용이 아니며 실행 상태 미확인 적용은412다. unit139 PASS/1919ms·type/diff0, 등록 UUID QA의 같은 수명/exact 정리만 재사용하고 새 서비스/실제 사용자·Secret/Agent 변경0.

- FN02 프로젝트 입력/METHOD5 신규 미구현 RED2→GREEN2/225ms, unit139 PASS/2122ms·type/diff0. 실제 실패용 시험은 `qa-project-method-<UUID>` 사용자2·UUID 프로젝트2·현재 합성 client와 명시 정책만 한 시험 수명으로 생성하며 소유 UUID만 finally transaction 정리한다. 파일/폴더/컨테이너 생성0, 실제 사용자 정책 부여0. 아직 forward39/프로젝트 변경 GREEN/UI03는 미구현·미검증이다. 이 등록 계약으로 같은 시험의 수정/정리까지 진행하며 새로운 자원 범위는 추가하지 않는다.

- 2026-10-17 FN02 후속 직접 승인 `call_351372d7d53d43ecae8e25c5c78ef9b2` ‘프로젝트 방법론 개정·확정·별도 적용 계약·개발 DB 보완 승인’을 확인했다. 기준31ff8dd6 local/private 동일·clean, Main 어울 단일 writer로 방법론 module·project command/route·UI03·직접 시험·새 forward39/runner 및 관련 정본만 수정한다. 기존38 SQL·공통/시스템 원본·고정 적용 이력은 보존한다. Pre-flight: 현재 project 명령/명시 정책·METHOD5/양식 준비 계약을 소비하고 저장→검토→확정→적용을 분리한다. Ruling: 실행 상태를 증명할 FN08/FN09 원본이 아직 없으므로 부재를 IDLE로 추정하지 않고 적용 전환은 EXECUTION_STATE_UNVERIFIED로 거절한다. 개정·검토·확정과 조회는 먼저 구현하며 적용 기능은 선행 미충족으로 남긴다(판단 오류 비용: 조기 적용 사용 불가, 기존 적용본/작업은 불변). 실제 사용자 정책·Agent/업무 재개·Secret/서비스/운영 변경0. 새 DB 변경 전 실제 schema/guard를 확인하며 이전 잘못 추측한 읽기 경로는 목록 조회로 정정하고 ACL 변경0이다.

- FN01/UI02 same-client d8128157d35f2734eee5c0910c46762f609acf10 local/private·WSL exact/clean actual1 PASS/1184ms(기능937ms)/skip0: 실제 writeProjectDraft의 선언 저장 뒤 합성 receipt 단절→원 명령 재확인/동일 선언 ref·readProjectDraft 대조→runDraftAction으로 기존 소스 프로젝트 생성·UNVERIFIED/baseline null을 확인했다. 독립 DB39종 각0·시험root[]·지속root uid1000/0700/link0/실경로 동일/empty·migrations38. UI02 fixture10/단위137·type/build PASS는 실제 사용자 browser↔DB 인수와 분리한다. 사용자가 저장 초안을 다시 열면 위치 설명·이유가 유지되며 생성 결과에도 선언/미확인을 표시한다. 프로젝트 작업 화면(UI04)은 아직 Stage C 미구현으로 소스 실관측/실행 권한·기준선 검증은 미연결이다. 전체44 합계와 Stage B 완료 판정은 불변이며 Windows runtime/relay/Secret은 변경하지 않았다.

- FN01 0ba2fd49617e7c21c0a3413f3d80610859ff7076 exact private/WSL clean actual2 PASS/1178ms(생성922·중간저장406ms)/skip0: 기존 빈 생성 보존·EXISTING 선언 저장/replay/재조회·선언 새 버전/옛 내용 보존·현재 버전만 원자 귀속·동시 생성1·타인404·source 미확인/baseline null·delivery0·위장 UPDATE/삭제42501을 확인했다. SQL38 재실행0, 기존 실패는 PASS로 소급하지 않는다.
- UI02 기존 소스 입력/선언 proof 신규 unit RED1→GREEN2/146ms·입력란 부재 browser RED1→UI02 직접 영향10 PASS/7.7초, 전체 unit137 PASS/1918ms·type/build0(Web89/587.77kB/gzip152.72·기존 bundle/색상 경고 보존). 소스 방식을 바꿔 탭 선언을 비울 때만 명시 확인을 받으며 서버 과거 이력은 보존한다. source 선언을 VERIFIED/실제 root 권한으로 표시하지 않는다. 동일 Web 함수 실제 저장 후 합성 응답 단절→원 명령 재확인·재조회·생성 시험은 추가 작성 후 다음 exact 게시본 실행 예정/미검증이다. 서비스/relay/Secret·실제 사용자 권한·실제 소스 파일 접근0.

- FN01 3d21841bdab2c69a1066e43c73dcd436fc556c0d exact WSL에서 보정38 checksum246fd202…3c025 적용/이전37 불변·fixtures7·실제 사용자 생성0으로 42P07 원인은 해소됐다. actual2 FAIL/1241ms: 생성 시험은 선언 저장/재조회·새 버전/옛 원문 보존·동시 생성/현재 귀속/타인404·Agent0까지 통과했으나 마지막 음성 SQL이 readiness 없는 identity 테이블을 참조해42703≠42501이었다. 시험 대상만 실제 버전 테이블로 교정하며 적용 SQL38/기대42501 불변이다. 인접 draft-storage는 ANVIL_QA_CLEANUP_CONFIG 미전달로 생성 전 중단했다. 해당 기존 보호 migrator 파일 참조를 실행에 추가하며 키/Secret 변경0이다. 아직 전체 actual GREEN 미검증, 다음 exact 게시본에서 같은 좁은 시험을 확인한다.

- FN01 forward38 첫 적용4b3f63bc는 generic migration 실패로 실제 QA 실행0이다. 독립 롤백 전용 probe에서 37개 적용·기존 source_declarations 존재, 동일 SQL42P07을 확인했다(같은 root2회). 원0001 SQL/실제 열·제약·권한·행0을 읽기 전용 대조했으며 기존 준비 테이블을 새로 만들려 한 충돌이 원인이다. Ruling: 기존 선언 identity 테이블/원37 SQL·자료는 보존하고 별도 source_declaration_versions에 append-only snapshot을 연결한다. root identity는 최초 선언 metadata/보호 payload 참조만 보존하고 현재 내용은 exact 버전이 소유한다. 기존 app UPDATE/DELETE는 새38에서 회수·새 INSERT는 현재 owned draft command guard로 보호한다. 미적용38 후보만 보정했으며 checksum246fd20284f998ac8d1c1cbea1570372f7d6a204dad885ea41112eeda5b3c025다. 실제 GREEN은 미검증·3회 같은 root면 추가 재시도 없이 예외 보고한다. 삭제/기존 자료 변환·Secret/서비스 변경0.

- FN01 exact ca8f54f03833e6feafe5b8a842226db4b8e00a24 WSL actual RED1/1068ms/skip0: 기존 SOURCE_DECLARATION_NOT_READY412(선언 초안 저장201 필요). 후속 후보는 작성자/client·초안 exact version의 선언 ref를 command receipt와 불변 저장하고 생성 transaction에서 그 선언만 프로젝트 귀속한다. 원문 pathHint는 보호 DB의 기존 소유 초안 input/새 선언 snapshot에서만 보존·소유 범위 API가 조회하며 경로 해석/파일 접근0이다. 단계 변경도 새 선언 버전을 보존하고 이전 버전·현재 USER_DECLARED/UNVERIFIED를 변경하지 않는다. 새 forward38 `0001_source_declarations` checksum5fccb763d32e0809d2cdf72541b30f83eb3ff6c1b0bd524c4ef254cf06d643de 작성·아직 미적용/실제 GREEN/UI02 미검증. unit136 PASS/2546ms·type/diff0, 기존37 SQL 불변·등록 qa-project-create UUID2/초안·프로젝트/finally exact 정리 재사용·실제 사용자/Secret/서비스 변경0.

- FN01 소스 선언 입력 RED2→GREEN2/139ms: 정확4필드·원문 복제·유한 길이·위장 권한/검증·알려진 비밀 거절, 경로 해석/파일 접근0. actual RED용 기존 `tests/integration/FN01/draft-create.test.ts`에 EXISTING 선언 저장/미확인 표지를 추가했다. 시험 자원은 기존 qa-project-create-<UUID> 사용자2·UUID 소유 초안/프로젝트·합성 로그인/현재 client이며 파일/소스 root 생성0, 한 시험 수명·기존 exact finally 정리다. 아직 DB38 작성/적용0·기존 소스 생성 GREEN/UI02는 미검증이다.

- FN01 기존 소스 선언 후속 직접 승인 `call_8c65f3d7a56d42fb9386472b6cfc739b` ‘기존 소스 선언·프로젝트 생성 계약·개발 DB 보완 승인’을 확인했다. Main 어울 단일 writer, 기준 c8b869e0 clean/정본6 동기화에서 이어간다. sourceDeclaration(hostLabel/displayName/pathHint/reason)은 사용자 선언만 저장하고 USER_DECLARED/UNVERIFIED를 유지하며 pathHint 실행/파일 접근·실제 소스 수집·Agent/기준선 VERIFIED·Secret/서비스/운영 변경은 제외한다. 순수 입력 신규 RED2/109ms 뒤 최소 검사부터 연결하며 아직 DB38/생성/UI02 미구현이다. 등록 합성 QA만 사용·한 시험 수명/exact finally 정리하고 실제 사용자 자료/기존36+37 SQL은 보존한다. 최근 잘못 추측한 읽기 경로/PowerShell wildcard는 실제 repository/파일 목록으로 정정했고 ACL·자료 변경0이다.

- FN05/UI10 7cf8c005fbae320b62b8d1e89186896dfabe546c local/private·WSL exact/clean actual1 PASS/15068ms(기능14756ms)/skip0. 실제 같은 Web prepare/send/read로 적용 세대2 교체·저장 후 합성 응답 단절→원 명령 재확인/동일 결과·과거 적용 페이지·현재 원문 proof·옛 적용 비선택·정정 SUPERSEDED/제외 EXCLUDED 뒤 이력 보존·변조503·적용 이력2건을 확인했다. SQL37 재실행0·독립 DB33종 각0·시험root[]·지속root uid1000/0700/link0/실경로 동일/empty·migrations37. UI10 직접 영향 fixture12 PASS/11.0초, 추가 헌법 APPLY 단절/이동/뒤403 sticky 보존1 PASS/2.7초·이전 명령3회 동일/새 적용 생성0. 전체 unit134 PASS/2066ms·type/diff0; 최신 Web89/583.53kB/gzip151.71와 bundle/색상 경고를 유지한다. 현재 사용자용 Windows backend/relay·만료 bootstrap/Secret은 변경하지 않았으므로 사용자 browser↔DB 인수는 미검증이다. FN05의 공유/임무별 맥락 선별·전달·이해 대조(FN09/IX04 선행), Stage B의 나머지 기존 프로젝트 기준/방법론 개정·FN11 다른 행위·IX01은 미완료이며 전체44 상태 합계는 불변이다.

- FN05 적용 서버 045d699624084c8dc9ed49537a60df94501cd891 exact private/WSL clean: 새 승인 forward37 `0005_project_constitutions` checksum71f4674b279ffea063e3291c392ac822ab4367a0393834079b79caeea29dd765 적용·기존36 불변/fixtures7/실제 사용자 생성0. 실제 FN03+FN11 2 PASS/14708ms(기능14354ms·정책580ms)/skip0: 별도 적용 권한403·확정/정확 hash409·확인 누락422·동일 명령 동시2/적용1·현재 조회/타인404·유한 입력400·재검토 뒤 이력 보존/사용 불가·app 이력 삭제/pointer 위장42501. 독립 DB33종 각0·시험root[]·지속root uid1000/0700/link0/실경로 동일/empty·migrations37. actual source/API 검증이지 사용자 browser↔DB 인수는 아니다.
- UI10 후속: React 스킬의 명시 event mutation/기존 root 판단 버퍼를 사용해 별도 APPLY와 조회 panel을 연결했다. UI 명령 단위 RED1→GREEN6/185ms·버튼 부재 browser RED1→지식 판단/조회/적용 fixture3 PASS/4.2초, 전체unit134 PASS/1830ms·type/build0(Web89/583.53kB/gzip151.71; 기존 bundle/색상 경고 보존). source 확인과 적용 proof/snapshot/hash를 재대조하며 기존 가짜 applied=true 거절을 유지한다. 실제 같은 Web의 세대2 교체/응답 단절 재확인·유한 과거 이력/정정·제외·변조503은 추가 시험 작성 후 다음 exact 게시본 실행 예정/미검증이다. 테스트 historyPage 지역 변수 중복1은 constitutionHistoryPage로 정정, SQL/검사 기준 변경0. 현재 Windows runtime/relay/Secret·실제 사용자 권한은 변경하지 않았다.

- FN05 순수 적용 검사 RED2→GREEN2/214ms, 기존 UUID QA의 exact 98665202494984cb9cc436b3e28ed4e3a56dff77 실제 RED1/12612ms/skip0: 헌법 GET 미등록404(인증401 필요). 신규 기능 미구현 실패이며 이전 FN11 성공을 소급 변경하지 않는다. source/current eligibility와 별도 acknowledged 입력을 분리했고 신규 단위 포함133 PASS/1797ms·type/diff0. references의 없는 isUuid export/잘못 추측한 읽기 경로는 실제 references.ts/UUID 규칙으로 정정(권한 변경0). 후속 현재 적용 세대 CAS·별도 정책/확정/최신 검토·불변 이력/guarded pointer 후보를 작성했다. 새 forward37만 작성·아직 미적용, 실제 GREEN/UI10은 미검증이다. 동일 기존 합성 QA/정리 계약을 유지하고 사용자 정책/Secret/서비스/Agent 변경0.

- FN05 헌법 적용 후속 직접 승인 `call_1eab183042804ae495957c14227599ec` ‘헌법 적용·이력 계약·개발 DB 보완 승인’을 확인했다. Main 어울 단일 writer, 기준 3bd2347e/clean에서 이어간다. Ruling: 프로젝트 단일 적용 상태는 projectId/적용 세대 CAS로 별도 관리하고, 정확 CONSTITUTION 버전·확정 사건·최신 적합 검토와 사용자 명시 확인을 저장 직전 재대조한다. 적용 이력은 append-only이며 정정/제외/재검토 뒤에도 과거 적용을 지우지 않고 현재 사용 가능 상태만 분리한다. 같은 명령 재확인은 기존 결과만 반환한다. 새 forward37만 작성/적용하고 이전36 SQL은 불변이다. 기존 UUID 문서 QA 사용자2/프로젝트1·/tmp/anvil-v3-document-qa-<UUID>(0700)·한 시험 수명/finally exact 정리 계약을 재사용하며 지속 artifacts root 보호를 유지한다. 실제 사용자 정책 부여·Agent 전달/자동 준수·설계 기준 적용·업무 재개·Secret/서비스/운영 변경0. 다음은 순수 입력/현재 유효성 RED→GREEN→actual 별도 정책/저장/이력/회귀→UI10이며 아직 구현/DB37 적용0이다.

- FN11 목록 `835b9a50a7cf08855a183ec868305f57437d351d` local/private·WSL exact/clean actual1 PASS/12553ms(기능12311ms)/skip0: 같은 프로젝트 승인 metadata 목록·두 페이지 중복 없음·status/targetId 필터·변조/조건 다른 cursor400·EXPIRED1/CONSUMED2·타인404·정책 회수 뒤 PENDING0/REVOKED1 및 상세 basisCurrent=false를 확인했다. SQL36 재실행0·독립 DB31종 각0·시험root[]·지속root 보호/empty·migrations36. 승인 목록은 actual 확인됐으나 다른 command/환경/Agent의 소비·UI08/실제 사용자 browser↔DB는 미완료다.
- 다음 Stage B 핵심 미완료 FN05의 헌법 적용/이력을 정본(DATA_MODEL §7.3 project_constitutions·INTERFACES 헌법 GET)과 대조했다. 기존 지식 확정은 적용 pointer가 아니며 현재 코드는 appliedAsConstitution=false만 반환한다. 별도 applyConstitution의 현재 로그인/단독 제어·별도 정책·확정/최신 적합 원문·명시 확인·불변 적용 이력/현재 사용 가능 상태와 UI10 연결을 신산님께 비동기1건 요청했다. 답변 전 해당 schema/연산·pointer 쓰기는 하지 않고 현재 자료/양식/화면 소비 경계를 읽기 전용으로 준비한다. 실제 사용자 정책 자동 부여·Agent 전달/자동 준수 판정·설계 기준 적용/업무 재개·Secret/서비스/운영 변경은 제외한다. 전체44업무 상태 합계는 그대로다.

- FN11 남은 승인 목록: 무인증 GET404≠401·유한 입력 검사 부재 RED2→GREEN2/478ms 후 기존 같은 프로젝트 회원 조회·기본50/최대200·상태/대상·서명 cursor의 actor/project/filter/limit 결박을 연결했다. 목록은 본문/완전 검토를 싣지 않고 metadata/integrity=NOT_RECHECKED이며 상세가 기존 요청/결정/소비 무결성을 검사한다. PENDING/APPROVED의 실제 기한 경과/현재 정책·제어·소유자 부재를 EXPIRED/REVOKED로 표시하며 원 이력 상태를 덮지 않는다. 현재 unit131 PASS/1851ms·type/diff0, 실제 목록 GREEN은 다음 exact 게시본에서 검증 예정이다. 새 DB/schema/권한·자원 생성0·현재36 SQL 불변이며 기존 UUID 문서 QA/승인 사건만 같은 수명·정리 계약으로 사용한다. 다른 연산의 승인 소비/환경/Agent·UI08·사용자 browser↔DB는 미완료다.

- FN11 일회 소비 `eb4f1d97c9b914a9dbd17a71d6c2e5f705d74e18` local/private·WSL exact/clean에서 승인 forward36 checksum9eab1fcb…0b29d 적용/이전35 불변. actual2 PASS/13084ms(기능12748ms·정책566ms)/skip0: 요청→사람 결정→실제 보호 원문 업로드·승인 소비/authorization receipt/감사 연결·같은 명령 동시2/원문1/소비1·다른 후보/내용409·바이트422/소비0·REJECT/REQUEST_CHANGE412·미소비 만료412·소비 뒤 만료의 동일 결과만 재조회·현재 DENY403을 확인했다. 독립 DB31종 각0·시험root[]·지속root uid1000/0700/link0/실경로 동일/empty·migrations36 확인. 원문 업로드 승인 한 건의 핵심 실제 동작 확인이지 다른 command/환경/Agent·UI08·실제 사용자 browser↔DB/Stage B 전체 완료는 아니다. 변경이 없는 FN04·기존 UI 빌드/브라우저는 반복 실행하지 않았다. 다음은 FN11의 남은 유한 승인 목록/조회·소비 지원 범위와 Stage B 잔여를 계획 기준으로 이어간다. 기존 Node40744/startUTC2026-10-15T20:25:42.3705853Z·비밀 없는 runtime receipt commit000d0088, relay26052/startUTC12:28:17.5262971Z를 읽기 전용 확인했고 재시작/4차 DB 재접속/키·bootstrap 갱신0이다.

- FN11 소비 actual RED `6677f36640dc065989d335cfc1186b3946f55f5e` exact/clean WSL1 FAIL/9173ms/skip0: 승인 참조가 든 업로드를 기존 header가400으로 거절(실제 소비/201 미연결). 소비 참조 순수 RED1→GREEN4/193ms 후 같은 승인 범위에서 현재 정책/OWNER/client/control·exact request/APPROVE/범위/candidate/payload hash를 저장 전·본문 수신 전 모두 대조하고 업로드 command/authorization receipt/소비/감사/상태2→3을 같은 transaction에 결박했다. 새 forward36 `0011_one_time_approval_consumption` checksum9eab1fcba2586bf87f202cefc39f300e152e1415c8339692438074b3b800b29d 작성·미적용/실제 GREEN 미검증, 기존35 SQL 불변. 아직 파일 소비는 uploadArtifact만이며 다른 연산/환경/Agent·설계 기준 적용/업무 재개·실제 사용자 정책/Secret/서비스는 열지 않는다. 미소비 만료는 거절하고 소비된 동일 명령은 현재 정책/제어 유효 시 기존 결과만 조회하며 새 부작용0을 요구한다. unit129 PASS/1779ms·type/diff0. 다음 exact 게시본에서 실제 원문 업로드·동시 같은 명령/사건1·다른 명령/내용/바이트·REJECT/REQUEST_CHANGE·미소비 만료/소비 뒤 결과 조회·현재 DENY/감사·exact QA 정리를 확인한다. 같은 등록 문서 UUID QA만 사용하고 새로운 자원0이다.

- FN11 결정 저장 `4c3e61dba2ebdce5b1176efddc3112f460960d28` local/private·WSL exact/clean, 승인 forward35 checksum727c5862…141a 적용/이전34 불변. actual2 PASS/9866ms(기능9501ms·정책561ms)/skip0: 별도 결정 정책403·정확 scope409·같은 명령 동시2/사건1·APPROVE/REJECT/REQUEST_CHANGE·반대 결정409·최초 요청 보존/실제 결정 대조·직접 상태/삭제42501·없는 결정 포인터503를 확인했다. 독립 DB31종 각0·시험root[]·지속root uid1000/0700/link0/실경로 동일/empty·migrations35 확인. 현재 실행/소비는 여전히412이며 사용자용 runtime·권한/Secret·서비스 변경0. 다음은 같은 승인 안의 uploadArtifact 한 후보 소비: 현재 정책/기기/세대·정확 request/decision/scope/candidate/body hash를 검사하고 command/authorization receipt/소비/감사/업로드 metadata를 같은 transaction에 저장한다. 같은 소비 명령의 결과 재확인은 부작용0, 다른 명령/내용·만료 전 미소비/회수는 거절한다. 소비 뒤 만료는 현재 정책/제어가 유효한 동일 명령의 기존 결과만 재확인할 수 있고 새 변경은 불가하도록 구분한다. 아직 구현/forward36 작성·적용0이며 기존35 SQL을 바꾸지 않는다.

- FN11 결정 actual RED `b01643edeef5bf6c6cbda05b688d454a320df722` WSL exact/clean1 FAIL/8790ms/skip0: decideApproval 미등록400(별도 결정 정책403 필요). 결정 입력 RED1→GREEN/179ms 후 같은 승인 범위에서 별도 AUTO 결정 정책·정확 requestId/expectedVersion/scopeDigest·지정 현재 HUMAN/client/control·기한/기준을 확인해 별도 불변 APPROVE/REJECT/REQUEST_CHANGE 사건과 요청 status/version2만 원자 갱신하도록 구현했다. 최초 요청 JSON/version1은 보존하고 조회는 실제 결정 receipt/hash/주체·현재 상태를 대조하며 결정 사건 없는 승인 포인터는503이다. 미연결 소비 INSERT는 계속42501이며 파일 변경/Agent/기준 적용/업무 재개0. 새 forward35 `0011_one_time_approval_decisions` checksum727c586254d34bd454986bf899cfc53429682e751deb36555b5bdae19a1f141a 작성·미적용/실제 GREEN 미검증, 이전34 SQL 불변. unit128 PASS/1783ms·type/diff0. 다음 exact 게시본에서 승인3종/같은 명령 동시2·반대 결정409·과거 요청 보존·현재 포인터/삭제 위장 차단을 확인한다. 기존 UUID 문서 QA/원문 root/한 시험 수명·승인 사건 exact finally 정리 계약을 재사용하며 실제 사용자/서비스/Secret 변경0.

- FN11 요청 저장 `92cb9c3a934ab18bf4d977eafd3c9dd6a9e816e6` local/private·WSL exact/clean actual1 PASS/9883ms(기능9548ms)/skip0. 별도 요청 정책403·REQUIRE_APPROVAL 후보의 실제 업로드412·요청 PENDING 저장/멱등·정확 요청/서버 지정 OWNER 조회·타인404·같은 후보 새 요청409·요청만으로 실행 거절·직접 상태 UPDATE42501을 확인했다. 독립 DB31종(기존28+승인3) 각0·시험root[]·지속root uid1000/0700/link0/실경로 동일/empty·migrations34 확인. SQL34 재실행0·실제 사용자 정책/서비스/Secret·설계 기준/업무 재개0. 요청 실제 GREEN은 결정/소비 구현 완료가 아니다. 다음은 같은 call_0a529c010d3e4c04be861bafa31071f9 승인 안에서 정확 요청·현재 정책/제어·지정 HUMAN/기한·별도 결정 정책과 APPROVE/REJECT/REQUEST_CHANGE 하나만 저장하는 후속이다.

- 요청 저장 진단 `af0b06add124c5e952e038f8d72947900347a775` actual1 FAIL/8970ms/skip0: whitelist42501/APPROVAL_REQUEST_EXACT_CURRENT_SCOPE_REQUIRED(같은 root 실제 실패2회). 독립 BEGIN READ ONLY probe에서 DB transaction_timestamp와 서버 Date ISO의 정밀도 비교 mismatch=true, 서버 milliseconds 비교=false·변경0을 확인했다. guard의 정확 시간 조건을 완화하지 않고 request_json.createdAt과 같은 서버 유래 ISO를 INSERT.created_at에도 명시한다(변경 전 DEFAULT microseconds≠서버 milliseconds, 변경 후 같은 서버 값 exact). 새 SQL/권한 변경0·적용34 불변, 다음 exact 게시본에서 GREEN을 확인하며 같은 root 3회면 추가 재시도 없이 예외 보고한다.

- FN11 요청 후보 `205ab4c13be1ac619cc2bb3aa0c0e5c90662fcc0` WSL exact/clean에서 승인 forward34 checksumbe0c422f…1b5c 적용/기존33 불변. actual2 중 FN11 정책 PASS·FN03 승인 요청 FAIL1/9606ms/skip0: 별도 정책403·새 정책 저장/요청 전 업로드412까지 통과했으나 requestApproval 정상 저장503(새 root1/원인 미확정). 독립 기존 DB28종 각0·시험root[]·지속root 보호/empty·migrations34 확인. app 승인3표의 SELECT/INSERT=true·table UPDATE=false를 읽기 전용 확인했으며 권한 변경0이다. 같은 합성 명령의 현재 인증/정책 경로로만 whitelist code/messageCode/constraint/routine 진단을 추가하고 오류 원문/SQL detail/Secret은 출력하지 않는다. 원래 HTTP 실패 보존, 적용34 SQL 수정0·아직 요청 실제 GREEN 아님.

- FN11 입력 RED2→GREEN2/231ms·unit127 PASS/2205ms·type/diff0. actual RED `03487184b08f999d77931057177f98e59752bc23` exact/clean WSL1 FAIL/9708ms/skip0: requestApproval 미등록400(별도 명시 정책403 필요). 후속 requestApproval/정확 GET을 현재 인증/제어·별도 AUTO 정책과 후보 uploadArtifact REQUIRE_APPROVAL 아래 연결했다. 요청은 기존 보호 텍스트 원문 업로드 후보만 초기 지원하며 다른 연산/환경·출처/한도 연결은412다. 요청 만료는 현재 후보 정책 유효기한을 넘을 수 없고 후보 명령/본문 hash/주체·기기/세대/정확 대상·위험/복구 설명을 보존한다. 사람이 요청에서 requiredDecider를 지정하지 못하며 서버의 현재 OWNER를 지정한다. 신규 forward34 `0011_one_time_approval_requests` checksumbe0c422f5e9f4f3869e076d6331436b6bf944abf11865aa62d0e7aaa48ce1b5c 작성·미적용/실제 GREEN 미검증. nullable metadata로 과거 행은 보존하고 기존33 SQL 불변, 요청 직접 상태 UPDATE·아직 미연결 결정/소비 INSERT는42501로 닫는다. 다음 exact 게시본에서 적용/실제 저장·멱등/조회·후보중복/요청만으로 파일 변경 거절을 확인한다. QA는 새 사용자/프로젝트를 추가하지 않고 기존 등록 qa-document-storage-UUID 사용자2·프로젝트1·전용 /tmp/anvil-v3-document-qa-UUID/0700/한 시험 수명·exact finally 정리에 승인 요청/명령/감사만 추가하며 실제 사용자·서비스·Secret 변경0이다.

- FN11 후속 직접 승인 확인: `call_0a529c010d3e4c04be861bafa31071f9` 답변 ‘FN11 일회 승인 계약·개발 DB 보완 승인’. 기존 개발 DB의 승인 표를 새 forward로 보호하고 정확 명령/내용/버전/기한·현재 인증/단독 제어/별도 정책·원자 소비/감사만 연결한다. 실제 사용자 정책 자동 부여·설계 기준 적용/업무 재개·Agent 호출·Secret/서비스/운영 변경은 제외한다. 다음 선행은 승인 입력/후보 대조 순수 RED→GREEN 후 실제 명시 정책403/요청 저장 RED다. 아직 DB34 작성/적용0·연산 등록0. 합성 QA는 기존 개발 DB에 고유 qa-approval-UUID 사용자2·프로젝트2/정책·요청/결정/명령/감사, 한 시험 수명·정확 ID/FK 순서 finally 정리로 사전 등록한다. 파일/컨테이너/port 생성0·실제 사용자 자료 변경0. 단독 Main이 같은 branch에서 수행하며 완료한 FN04 검사는 코드/환경 불변이면 반복하지 않는다. 새 업무 폴더 생성의 sandbox 거부1은 정확 두 폴더만 허용된 실행으로 생성해 해결·기존 ACL 변경0이다.

- 다음 선행 경계는 FN11 일회 승인 요청/결정/소비다. 기존0011에 표는 있지만 현재 authorizeMaterial의 REQUIRE_APPROVAL은412로 거절만 하며 실제 승인 소비는 미구현이다. INTERFACES §10.1·DATA_MODEL §7.1의 정확 후보 command/범위/hash·현재 로그인/client/control·정책/만료/회수·원자 소비/감사 조건을 재확인했다. 신산님께 같은 개발 DB의 새 forward guard·일회 승인 연결을 비동기1건 요청했으며 답변 전 DB·권한/연산 연결은 하지 않는다. 앞선 FN04 승인은 기준 적용·업무 재개를 명시 제외했으므로 그 승인을 확대하지 않는다. 영향과 무관한 기존 조회/소스 준비는 가능하며 실제 Agent·서비스·Secret 변경0. 읽기 경로 추측1/PowerShell glob1은 무변경 오류로 보존하고 이후 목록/정확 경로를 먼저 사용한다. 현재44업무 상태합계는 변경하지 않았다.

- FN04 출처·영향 저장 `df2f81ff28c0a2832dff24b87dd7dc0646a57c7c` local/private·WSL exact/clean actual1 PASS/9215ms(기능8948ms)/skip0. 승인 forward33 checksum1ec0d32d…b95a 적용/이전32 SQL checksum 불변·fixtures7·실제 사용자 생성0. 같은 프로젝트 문서/보호 원문/대화/사용자 지시4종 출처 보존·replay/상세 조회, 중복/종류 위장422·다른 hash409·부재404·격리412·DB 출처 guard의 USER_MESSAGE 위장false, 기존 사람 영향v2/v3/미확인 공백·과거 이력/페이지 보호까지 확인했다. 독립 DB28종 각0·시험root[]·지속root uid1000/0700/link0/실경로 동일/empty·migrations33 확인. 적용32의42702와 앞선 모든 실제 실패는 소급 PASS하지 않는다. 현재 사용자용 backend000d0088/Web 혼합 runtime·expired bootstrap·relay HOLD는 그대로이며 실제 사용자 브라우저↔DB 인수/서비스 교체는 미검증이다. FN04/Stage B/전체44업무 완료 아님. 현재 승인 call_d824c2536d1d42d89cbfe3ed0f38b8e3의 요청/출처·사람 영향 이력 저장 범위만 확인했고 설계 기준 적용·업무 재개·실제 사용자 정책/Agent·Secret/서비스는 변경하지 않았다. 결과 기록 patch의 잘못된 환경 문서 heading1은 적용 전 atomic 거절 뒤 실제 heading으로 교정했다.

- 출처 저장 진단 `ad29be5ad94f0e3d92400549e7fcb55882bb5863` actual1 FAIL/8189ms/skip0: whitelist42702/plpgsql_post_column_ref. 빈 결과 독립 읽기 probe에서 정확 `kind` 변수/열 모호성=true와 바인딩 매개변수 비교false·변경0을 확인했다. 같은 root 실제 실패2회다. 적용32는 불변으로 보존하고 새 forward33 `0004_design_change_source_binding_fix` checksum1ec0d32d45a770998be2da36d2eab7cd557f16314ee41618676bcefea704b95a에서 같은 검사 함수의 변수명만 source_kind_value로 구분했다. 조건/권한/기준/자료는 바꾸지 않는다. type/diff0·현재 미적용/실제 GREEN 미검증, 다음 exact 게시본에서 같은 root면 3회 규칙에 따라 추가 시도 없이 예외 보고한다. 진단 schemaVersion 타입1은 literal1로 고정해 수정했고 추측한 읽기 경로1은 실제 project-command.ts로 확인·파일 변경0이다.

- FN04 출처 후보 `e74c1098eebcf42db6c2c8797f3e34091778b4f2` WSL exact/clean에서 forward32 checksum02b4f223…0e69 적용/기존31 불변. actual1 FAIL/9736ms/skip0: 중복422·다른 hash409·부재404·USER_MESSAGE 지시 위장422·격리412까지 통과했으나 정상4종 요청 저장에서 STORAGE_FAILED503(신규 root1/원인 미확정). 독립 DB28종 각0·시험root[]·지속root 보호/empty·migrations32 확인. 같은 합성 명령을 현재 인증/정책/허가 경로로만 재확인해 whitelist code/messageCode/constraint/routine을 출력하는 진단을 추가하며 오류 원문/Secret/SQL detail은 출력하지 않는다. 적용32 SQL은 수정하지 않고 원래 HTTP 실패를 보존한다.

- FN04 요청 출처 순수 검사 RED2→GREEN2/235ms, 실제 미연결 RED `c477505dbcfc677e011db21021a77933b98958a0` exact/clean WSL1 FAIL/10025ms/skip0(중복 출처 기대422/기존 전체 미지원412). 같은 승인 범위에서 sourceRefs의 기존4종·최대200/정확 키/중복 차단 및 실제 프로젝트·문서/원문·대화 종류/hash를 저장/조회 양쪽에서 재검사하도록 구현했다. 텍스트 원본은 기존≤2MiB/UTF8·격리 차단을 유지하며 미지원 바이너리는412다. 알려진 과거 지시는 불변 출처일 뿐 현재 적용/전달 승인이 아니다. callback 타입 좁힘 오류1은 확인한 제안 ID를 고정해 수정, sandbox Git 읽기 거부1은 실제 상태 변경/손상으로 취급하지 않는다. unit125 PASS/1863ms·type/diff0, 새 forward32 `0004_design_change_sources` checksum02b4f223f482ebe2dedd8090eb725d93f953f0afac47702fe3d31f21609b0e69 작성·미적용/실제 GREEN 미검증. 이전31 SQL/원문/확정·현재 기준·사용자 권한/서비스/Secret은 불변이다. 같은 UUID 합성 사용자/프로젝트·시험 전용0700 root/한 시험 수명·finally 정확 정리 계약으로 다음 exact 게시본을 확인한다.

- FN04 사람 영향 검토 `2151eedd907e161f91b0b88f88c926ccf805b95c` local/private·WSL exact/clean actual1 PASS/9812ms(기능9551ms)/skip0. 별도 정책403·공백 삭제/근거 없는 판단422·v2 저장/멱등·stale409·잘못된 근거422/없는 근거404·실제 문서 근거v3·원 기계/과거 사람 이력 보존·유한 페이지/limit21 거절을 확인했다. 독립 DB28종 각0·시험root[]·지속root uid1000/0700/link0/실경로 동일/empty·migrations31 확인. 이전 오류들은 이력으로 보존하며 소급 PASS하지 않는다. 실제 사용자 브라우저/기준 활성화/업무 재개·UI07·전체 FN04 완료와 구분한다. 다음은 같은 직접 승인 call_d824c2536d1d42d89cbfe3ed0f38b8e3 안의 요청 sourceRefs 연결: 실제 같은 프로젝트 문서/원본/대화/지시의 바이트·hash·kind를 확인해 출처만 저장한다. 과거 지시를 현재 적용 지시로 승격하거나 Agent 전달/실행하지 않는다. 승인된 forward 보완 외 기존 SQL/사용자 권한/서비스/Secret은 변경하지 않는다.

- `e7e1030341787aa6d0bd877998ca78b145a7af66` exact/clean WSL에서 forward31 checksumc3d5cb62…002b 적용·기존30 checksum 불변·fixtures7·실제 사용자 생성0. actual1 FAIL/8780ms/skip0: 이전42883 저장 root는 해소되어 사람 검토v2 저장/동일 명령 replay·stale409까지 통과했고, 다음 잘못된 근거 ID/versionRef의 음성에서 기대422/실제412로 실패했다. 원인은 입력 형식 오류와 미지원 kind를 한 분기로 분류한 것으로 확인했다(별도 root1). 순수 분류 시험 RED1→GREEN·unit123 PASS/4333ms·type/diff0: 잘못된 참조422, 유효한 미지원 EXECUTION412로만 분리하며 기존 actual 기대값/거절 기준은 유지한다. 독립 DB28종 각0·시험root[]·지속root uid1000/0700/link0/실경로 동일/empty·migrations31 확인. 사람 근거v3·전체 이력 페이지의 실제 GREEN은 아직 미검증이며 다음 exact 게시본에서 확인한다. 현재 기준 적용/실제 사용자 권한/서비스/Secret 변경0.

- 저장503 진단 `c1175ce5cd8dcf7e9ad8db1aed4f6e46b33be7ea` actual1 FAIL/8923ms/skip0: whitelist code42883/routine op_error, 이전 미확인 삭제422·근거 없는 판단422까지 통과했다. SQL30의 `snapshot->coverageGaps @> prior.impact_json->coverageGaps` 연산 결합이 원인임을 빈 JSON probe 원식42883/양쪽 괄호 보정식false·변경0으로 확인했다. 새 저장 root 실제 실패2회이며 SQL30 checksume99067f1…9275c는 불변으로 보존한다. 새 forward31 `0004_design_impact_review_operator_fix` checksumc3d5cb62a7f5615db0325f9008031f61c6d16a225bc2ef241defcadbc75c002b는 같은 guard 정의에서 포함 비교 양쪽 괄호만 명시한다. 권한/자료/의미 조건·현재 기준 확대0, 현재 미적용·실제 GREEN 미검증이다. 다음 exact 게시본으로 검증하며 동일 root가 다시 재현되면 3회 규칙에 따라 추가 시도하지 않고 예외 보고한다.

- 중복 잠금 보정 `c1b831976205ff975389f1ff73a7b5180f5d1d80` exact/clean actual1 FAIL/8867ms/skip0. 이전 조회 root는 해결돼 공백 삭제422·근거 없는 영향 없음422까지 통과했고, 다음 실제 새 검토 저장에서 별도 STORAGE_FAILED503이 발생했다(새 저장 root1, 아직 원인 미확정). 적용30/권한은 바꾸지 않고 같은 합성 명령/동일 인증·정책 경로에서 whitelist 오류 code/messageCode/constraint/routine만 드러내는 시험 진단을 추가한다. 오류 원문/SQL detail/Secret은 출력하지 않고 원래 HTTP 실패 판정은 보존하며 finally 정확 정리를 유지한다.

- 사람 영향 검토503 원인 확인: `7fe95c8a0820d35e21484083512082e83035d52b` actual1 FAIL/8620ms/skip0에서 STORAGE_FAILED를 확인했고, 빈 결과 독립 probe에서 app SELECT=true/UPDATE=false·일반 SELECT OK·FOR UPDATE=42501·변경0을 재현했다. 같은 root 실제 실패2회이며 추가 권한 부여/SQL 변경 없이 중복 설계 이력 FOR UPDATE 한 줄만 제거했다. 모든 변경은 기존 ProjectPolicyRepository/currentProjectController의 project_control FOR UPDATE를 먼저 통과하고 최신 영향 CAS·unique/FK/DB guard는 그대로다. 변경 전: 불변 이력에 UPDATE 잠금 요구→42501, 변경 후: 기존 프로젝트 제어 직렬화 아래 정확 이력 조회/새 버전 저장. 적용 SQL30 불변·권한/원문/기준/서비스/Secret 변경0. 다음 exact 게시본에서 실제 GREEN을 확인한다.

- 사람 영향 검토 후보 `4ff5465cc0eb27e49e2de9e6a815893da5ef1db8` exact/clean WSL에서 승인 forward30 checksume99067f14f8fa1d5ba775c3c6e4096ecf4a20483651d0e777776a74e4589275c 적용(이전29 불변). actual2 중 FN11 PASS·FN03 FAIL1/8713ms: 새 검토 정책 거절/정책 추가 뒤 ‘미확인 공백 삭제422’ 시도에서503, 원인 아직 미확정. 합격으로 승격하지 않고 비밀 없는 구조화 오류 code를 다음 시험에 노출해 원인을 좁힌다. 독립 DB28종 각0·시험root[]·지속root 보호/empty·migrations30 확인, 실제 사용자/서비스/Secret·기준 변경0. SQL30은 적용본이므로 수정하지 않는다.

- FN04 사람 영향 검토 미구현 actual RED `23d3dfa8ac435499eec7bc6639c6c3ffb7f0edcc` WSL exact/clean 1FAIL/8865ms/skip0: 새 reviewChangeImpact 미등록400(별도 정책403이 필요). 같은 승인 범위 후속에서 exact change/baseImpact와 현재 정책·최신 버전 CAS, 모든 대상/미확인 공백 보존·UNAFFECTED 문서 근거의 실제 프로젝트/hash를 검증해 HUMAN_REVIEW 새 버전만 저장하도록 구현했다. 기존 기계/사람 이력·SQL29 불변·기준 적용0. 조회는 기본10/최대20개 영향 버전과 beforeVersion으로 유한하게 읽고 최신 ref/더 있음/다음 위치를 분리한다. unit122 PASS/1730ms·type/diff0, 실제 GREEN 미검증. 새 forward30 `0004_design_impact_reviews` checksume99067f14f8fa1d5ba775c3c6e4096ecf4a20483651d0e777776a74e4589275c 작성, 현재 미적용이다. 다음 exact 게시본에서 별도 정책·미확인 삭제/근거 없는 영향 없음/구버전·실제 근거/이전 이력 보존·페이지 경계를 검증한다. 기존 UUID QA/수명/정리 계약 그대로이며 실제 사용자/Secret/서비스 변경0.

- 같은 FN04 영향 이력 승인 후속: 사람 검토 입력 검사 unit RED2→GREEN2/243ms(정확 대상 전체/미확인 공백 보존·UNAFFECTED는 문서 근거 필수·미지원 실행 증거412), callback 타입1은 unknown으로 명시했다. 순수 검사이며 근거 문서의 실제 프로젝트/원문 hash는 저장 경로가 별도 확인해야 한다. reviewChangeImpact 명시 정책403 실제 음성 시험을 추가했고 다음 exact 게시본에서 미구현 RED 확인 예정. 아직 forward30 작성/적용0·사람 검토 실제 저장 미구현. 자동 기준 활성화/재개·실제 사용자 권한/Secret/서비스 변경0.

- FN04 초기 변경 요청 `d672450d004af3b9cda723557cb64be271f24eb9` local/private·WSL exact/clean, 승인 forward29 checksum2cafd54f19dade5780c0f9dab652999c65ed1b072bafe3e64b701935ea7b7d70 적용/이전28 불변·fixtures7·실제 사용자 생성0. actual FN03+FN11 2 PASS/8830ms(기능8553ms)/skip0: 기존 실제 수정 제안→별도 요청 정책403/허가→불변 요청/기계 영향 저장·같은 명령 replay/새 중복409·조회/교차 사용자404·정확 hash409·기존 설계 head/confirmed v1 유지·직접 삭제/영향 위장 UPDATE42501. 독립 DB28종 각0·시험root[]·지속root uid1000/0700/link0/실경로 동일/empty·migrations29 확인. sourceRefs 추가 출처·사람 영향 검토 버전·UI07·기준 적용/재개는 미구현이며 FN04 전체 완료가 아니다. 다음은 같은 저장 승인 범위 안의 사람 영향 검토 새 버전/근거·미확인 보존 검사이며 현재 기준·실제 사용자·서비스·Secret은 변경하지 않는다.

- 설계 변경 요청 미구현 actual RED `26fc178e40ab6014df3bb9eb251e2ac358d9bf20` WSL exact/clean 1FAIL/9398ms/skip0: 새 연산 미등록400(별도 정책 거절403이 필요). 후속은 기존 실제 PENDING 수정 제안·현재 확정 AF02/최신 적합 검토·새 요청 정책을 재검사하고 변경 요청/초기 기계 영향 v1을 append-only 저장한다. 선택 출처 sourceRefs는 현재 []만 지원하며 추가 출처는412로 명시 미연결, 승인/기준 적용/업무 재개0·사람 영향 검토 버전은 후속 미구현이다. 현재 설계 인덱스와 최대8개 현재 계획(각200업무)·최대2000대상만 계산하고 잘림/모호한 계획/실행·시험 미연결은 coverageGaps로 보존한다. unit120 PASS/4516ms·타입 unknown→UUID predicate 좁힘1 교정·실제 GREEN 미검증. 새 승인 forward29 `0004_design_change_proposals` checksum2cafd54f19dade5780c0f9dab652999c65ed1b072bafe3e64b701935ea7b7d70 작성, 아직 적용0·이전28 SQL 불변. 같은 등록 QA 수명/정리 조건으로 exact 게시본에서 확인한다.

- FN04 다음 저장 범위 직접 승인 확인: `call_d824c2536d1d42d89cbfe3ed0f38b8e3` ‘설계 변경·영향 이력 계약·개발 DB 보완 승인’. 기존 anvil_v3_development의 새 forward·현재 로그인/단독 제어·별도 정책/감사로 정확 확정 AF02/실제 수정 제안·이유/출처·영향 이력을 보존하며 기존 SQL/원문/확정·현재 기준 불변이다. 기준 적용·업무 재개·실제 사용자 권한/Agent·Secret/서비스/운영 변경은 제외한다. 현재 `design-impact.ts`의 exact 설계/의존 방향 전파·UNKNOWN/누락·범위 잘림·중복/위장 상태 거절 unit RED2→GREEN2/229ms, 상태 literal 음성 비교의 타입 경고1은 String 비교로 시험 의도를 유지해 교정했다. 원문 참조 문서명 추측 읽기1은 실제 contracts/references.ts로 정정, 자료/권한 변경0. 아직 DB29 작성/적용0. 실제 별도 변경 요청 정책403 시험을 추가했고 다음 exact 게시본에서 미구현 RED 확인 예정. 임시 자원은 기존 승인 UUID 사용자/프로젝트·/tmp/anvil-v3-document-qa-<UUID>/한 시험 수명·exact finally 정리 계약을 재사용한다.

- UI06/FN04 동일 Web `827f812ff1299f692830423cc6091e5405ba9877` local/private·WSL exact/clean actual1 PASS/8168ms/skip0. 실제 원문/카드 조회→계획 검토 저장/replay→현재 조건 재조회→별도 checkbox 필요→확정 실제 저장 뒤 합성 응답 단절→같은 명령 재확인/동일 확정 ID·DB pointer/조회·사후 REWORK 이력 보존을 확인했다. 독립 DB26종 각0·시험root[]·지속root uid1000/0700/link0/실경로 동일/empty·migrations28, SQL 재실행0·실제 사용자/Secret/서비스 변경0. unit118/계획 fixture8·type/build PASS는 실제 사용자 browser↔DB 인수와 구분한다. FN04/Stage B/전체44업무는 미완료다.
- 다음 계획 범위는 FN04 설계 변경 요청·영향 이력이다. 기존 확정 AF02·실제 document_proposals/trace_edges/계획 버전을 대조했고 저장에는 새 forward/명시 연산 계약이 필요하다. 신산님께 별도 질문1건을 보냈으며 승인 전 DB/schema/연산 등록/서비스 변경은 하지 않는다. 기존 원문·확정·적용 기준 불변, 연결 없는 영향을 UNKNOWN으로 보존하는 순수 계산/테스트를 먼저 진행한다. 실제 기준 적용/업무 재개·권한 부여·Agent 호출은 이번 저장 승인 요청의 제외 범위다.

- UI06 계획 검토/확정 후보 검증: unit118 PASS/1709ms·type/build0(Web86/575.75kB/gzip149.82, 기존 bundle/NO_COLOR 경고 유지), 계획 화면 fixture8 PASS/8.5초/skip0. 읽기 전용 보관함의 검토/확정 조회는 버튼 부재 RED1→GET만/미확정·미검토 표시 GREEN, 현재 주체/정확 버전/별도 확인·단절 후 같은 명령·나중403/화면 이동 보존·실행 활성화 거절 확인. `WorkPlanLibrary`에서도 제어권 쓰기 준비 없이 상태/이력 조회 가능하다. 실제 같은 client prepare/send/read·확정 저장 뒤 합성 receipt 단절/멱등 확인을 실제 시험에 연결했으며 다음 exact 게시본 실행 전/미검증이다. 현재 제품 runtime 교체/로그인 Secret 변경은 하지 않았다.

- FN04 backend `a7d6851f28433ab9756d68431ffb09d2c4d88103` local/private·WSL exact/clean actual1 PASS/8110ms/skip0. 계획5기준 별도 검토·정확/최신 검토·정책403·원문 미확정422·정상 확정/멱등/조회·최신 REWORK 뒤 유효성 false·직접 pointer/이력 삭제42501·기존 초안 snapshot 보존 확인. 독립 DB26종 각0·시험root[]·지속root uid1000/0700/link0/실경로 동일/empty·migrations28 확인. SQL28 checksum8c899de2…a249 불변. 실제 사용자/Agent·기준 활성화·서비스/Secret 변경0.
- 같은 후속 UI06: plan 전용 read/prepare/send/검토·별도 확인 버퍼를 기존 root 계획 버퍼에 연결했다. API unit RED2→GREEN2·전체117 PASS/1492ms·type/build0(Web86/573.93kB/gzip149.54, 기존 경고 보존). 버튼 부재 browser RED1 후 최초6PASS/1FAIL(선택란 이름 불안정), 다음1PASS/1FAIL(재표시 textarea의 label 이름 불안정). 두 필드 모두 aria-label 고정 뒤 계획 화면7 PASS/7.9초/skip0·기대값/timeout 변경0. 입력 소실은 아니며 root 버퍼/동일 명령이 보존됨을 확인했다. 보관함 읽기 전용 상태 조회는 추가 작성 중이다. 같은 Web API의 실제 DB 검증은 다음 exact 게시본에서 실행 예정/미검증이며 현재 사용자용 mixed runtime/실제 browser DB 인수·전체44업무 완료로 승격하지 않는다. 잘못 추측한 읽기 경로2·PowerShell wildcard1은 실제 목록으로 정정했고 파일/권한 변경0, 연산 union 및 시험 전달 타입 오류 각1은 좁게 수정했다.

- FN04 `46af3ec70239a49e48474e20adb7f0505336683e` exact/clean WSL에서 승인 forward28(8c899de2…a249) 적용/fixtures7/실제 사용자 생성0. actual2 중 FN11 PASS, FN03 FAIL1/7088ms: 새 검토 저장/replay·별도 확정 정책403·미확정 원문422까지 통과한 뒤 합성 AF04 두 줄 lead를 배열 한 줄로 세어 section anchor가 틀렸다. `lead.split('\n')`로 시험 자료만 교정하며 기존 검사/SQL28/제품 계약 변경0. 독립 DB26종 각0·시험root[]·지속root uid1000/0700/link0/실경로 동일/empty·migrations28 확인. 잘못 추측한 validation.ts 읽기1은 실제 목록의 document-validation.ts로 확인했으며 권한 변경0. 다음은 새 exact 게시본에서 실제 확정·재조회·직접 변경 차단을 재확인한다. 정상 확정은 아직 미검증이다.

- FN04 계획 검토/확정 후보: exact `506c7deb399341f4780d702d8cbc35703ebca661` WSL actual RED1/6502ms/skip0(계획 검토가 기존 DOCUMENT 경로로 들어가404). 계획 전용 검토/5기준·별도 confirmWorkPlan 정책·확정 직전 현재 원문/최신 검토/카드 재검사·불변 확정 이력/보호 포인터를 추가했다. unit115 PASS/1481ms·typecheck/diff0, 실제 GREEN 미검증. 승인된 forward28 `0004_work_plan_confirmation` SHA256 8C899DE2C7C5E673A8915FD2EBD83E78B32E0D87D4828B50CD76DD499B03A249 작성, 기존27 SQL 불변·아직 적용0. 허용 DB/합성 UUID/root/수명·정리 범위는 직전 등록 그대로이며 새 지속 자료는 확정 이력 구조뿐이다. 패치 문맥 순서1·줄바꿈 출력1 오류는 모두 atomic 무변경 후 원문/순서로 교정했다. 다음 exact 게시본에서 적용28·정상/미확정/권한/최신 재작업·직접 pointer/삭제 차단을 실제 확인한다. 화면 연결·현재 사용자용 runtime·전체 Stage B 미완료.

- FN04 승인 후속 Main 어울: 계획 전용5기준/정확 버전/누락·옛 적합 우회·중복 선택 unit RED2→GREEN2(218ms), typecheck0. 실제 WSL 시험에 WORK_PLAN 검토 저장·별도 확정 정책403을 추가했으며 아직 실행 전/미검증이다. 사용 자원은 기존 승인된 DB anvil_v3_development·UUID 합성 사용자/프로젝트·/tmp/anvil-v3-document-qa-<UUID>(0700), 시험1회 수명·finally exact 정리이며 기존 지속 자료/서비스 변경0. forward28은 아직 작성/적용0. 읽기 경로 오기2건은 실제 파일 목록으로 정정했고 자료·권한 변경0. 다음은 게시 exact SHA의 예상 RED를 확인한 뒤 저장 구현이다.

- FN04 화면 검토 선택 `ec2692212b5d4ad93d6ab5a27cd28105916840cf` local/private·WSL exact/clean actual1 PASS/7739ms/skip0. 같은 Web이 실제 AF03 원문/양식·미검토/최신 검토를 조회→명시 선택→기존 계획 저장/멱등/재조회·최신 REWORK 뒤 선택 차단·옛 선택 보존을 확인했다. 전체 계획은 DRAFT이고 설계 미확정 문제는 유지한다. 독립 DB25종 각0·시험root[]·지속root uid1000/0700/link0/실경로 동일/empty·SQL27 재적용0. 새 API/DB·실제 사용자 권한/서비스 변경0.
- 다음 FN04 계획 내용검토·별도 확정은 `call_16ea05f2ca814a53bd83dc2b9945b898`의 ‘계획 검토·별도 확정 계약·개발 DB 보완 승인’으로 승인됐다. 현재 로그인/단독 제어·별도 정책·정확 계획/설계/AF04/최신 화면 검토·업무/선행/검수 조건 재검사와 불변 검토/확정 이력·guarded confirmed_version을 새 forward로 추가한다. 기존 SQL/원문/선택/확정 보존, 자동 기준 활성화·업무 실행/Agent·실제 사용자 권한·Secret/서비스/운영 변경0. 합성 UUID/root 수명과 정확 정리 조건은 동일하다. 현재 소유 변경은 이 후속이며 일반 원문 격리 전체 완료/Stage B 완료는 아니다.

- FN04 화면 검토 선택 후보: 기존 readDocument/고정 AF03 양식/원문 hash·연결 화면 exact version·실제 HUMAN 검토의 감사 순서/항목을 확인하고 최신 ACCEPTED만 명시 선택한다. 선택 전 쓰기0·자동 합격/계획 확정0, 옛 적합 뒤 최신 REWORK는 선택 불가이며 기존 선택 기록은 자동 삭제하지 않는다. 새 helper 단위 RED2→GREEN2, 화면 버튼 부재 browser RED1→작업계획 fixture5 PASS/6.1초·전체 unit113 PASS/1503ms·type/build0(Web84), 기존 경고 유지. 실제 같은 client의 선택 저장은 다음 exact 게시본에서 검증한다. 기존 UUID 합성 사용자/프로젝트/root와 정리 조건만 재사용하며 새 DB/schema/Secret/서비스 변경0. 현재 FN04/Stage B는 부분 구현이다.

- 격리 UI `391a1d6c7ec8d6e5550df48f54421fb946899a6d` local/private·WSL exact/clean actual1 PASS/6753ms/skip0. 같은 Web에서 실제 업로드 저장 뒤 합성 응답 단절→같은 명령 재확인→검증된 격리 ID·후속 saveKnowledge command0·보관 원문 상태를 확인했다. 독립 DB25종 각0·시험root[]·지속root uid1000/0700/link0/실경로 동일/empty, SQL27 재적용0. 사용자 browser↔DB/완전 비밀 탐지/기존 전 자료 재분류·백업/스풀 사후 격리·해제는 미검증/미구현이다. FN05/Stage B 완료로 승격하지 않는다.
- 다음 독립 미완료: FN04의 작업계획 화면 검토 선택을 기존 문서 원문·최신 내용검토 API와 연결한다. 새 SQL/기준 활성화/Agent 호출 없이, 사용자가 연결된 실제 화면 버전의 최신 적합 검토를 명시 선택해 기존 screenReviewRefs로 저장하도록 한다. 이전 계획 원문/저장 관계는 보존하고 옛 합격을 자동 선택하지 않는다. 헌법 적용/임무 맥락 실제 전달의 별도 계약은 아직 미완료다.

- 격리 UI 직접 영향 확인: UI06 문서 편집/가져오기·제안 fixture8 PASS/8.0초/skip0, UI10 fixture11 PASS/9.8초·unit111/type/build0. 단순 HTTP412에 UUID를 붙이지 않고 검증한 upload receipt에만 원문 ID를 전달한다. 이전 단절 미확인은 이 terminal receipt에서만 해소하며 후속 domain command는 만들지 않는다. 비밀 없는 ID·입력/명령은 닫기 전 보존한다. 검사되지 않은 옛 Windows backend의 업로드는 새 DB guard가 검사 metadata 누락으로 거절하므로 현재 mixed runtime을 사용자용 완료라고 하지 않는다. 서비스 재시작/Secret 갱신0, 같은 client 실제 단절 재확인은 다음 게시본에서 확인한다.

- 원문 격리 서버 `891cfd3135e5f0bcb4baab7b17c4615bbbe58e52` local/private·WSL exact/clean에서 보정된 새27만 적용·기존26 지문 불변, 실제 FN03확장+FN11 2 PASS/6327ms/skip0. 적용27 최종 SHA256 `27480EC2D09BC14BF88196E7D45104BFAC107F7FA362760246D0B49EAF043AD5`다. 초기 미적용2BB05.../SQLSTATE42601 후보는 실패 이력이며 PASS로 소급하지 않는다. 의심 원문 바이트 보존·격리 receipt/감사·같은 명령·일반 다운로드/문서/지식 차단·비회원404·app 해제42501 확인. 독립 DB25종 각0·시험root[]·지속root uid1000/0700/link0/실경로 동일/empty. 실제 사용자/Secret/서비스 변경0.
- 격리 UI 후속 후보: 검증한 격리 receipt에만 원문 ID를 보존하고 이전 단절 미확인을 해소하며 후속 저장은 진행하지 않는다. 단순 HTTP412/거절 문구만으로 앞선 미확인을 지우지 않는다. 원문/입력은 남고 명시 닫기만 가능하다. 신규 단위/브라우저 RED 각1→단위111 PASS/1350ms·UI10 fixture11 PASS/9.8초·type/build0(Web83). 기존 bundle/색상 경고 유지. 같은 client 실제 단절→격리 재확인은 다음 exact SHA에서 확인한다. 문서·가져오기·제안은 공통 업로드 변경의 직접 영향으로 제한 회귀한다.

- forward27 첫 적용 `a9896122458d70f519a77a95cf3da6add9b53ce9`는 SQLSTATE42601/position1561로 실패했다. 독립 진단에서 적용26/inspection열0을 확인했고 동일27 SQL의 BEGIN/advisory lock/항상 ROLLBACK 진단으로 같은 위치를 재현했다. 위치는 PL/pgSQL IF의 괄호 없는 CASE WHEN ... THEN ... END 비교식이다. 단일 비교식 CASE를 괄호로 묶는 보정만 수행한다. 적용된 SQL은 아니므로 미적용27 후보만 정정하며 기존26·데이터/권한/Secret/서비스 변경0. 명시 runner 밖 영속 적용0, 실제 QA 미실행을 PASS로 표시하지 않는다.

- 일반 원문 격리 후보: 게시 RED `b22fe3227cbc67a7441d4eab8a561efd71fd5dd3` WSL actual1 FAIL/6875ms/skip0은 합성 비밀 표식이 ARTIFACT_READY로 반환된 기대 신규 실패다. 새 storage/sensitive-inspection은 원시 바이트의 알려진3표식·비밀 없는 이유/한계만 생성한다. 새 업로드는 바이트 보존+QUARANTINED receipt/감사, 일반 파일 GET과 문서/지식 소비 차단, 같은 업로드 재확인을 제공한다. 옛 READY 원문도 읽는 순간 표식을 다시 확인하되 기존 행/원문을 자동 재분류·수정하지 않는다.
- 새 forward27 `0005_artifact_quarantine.sql` SHA256 `2BB05C6C3C34008ED1E3A193BEBF5F533CFB7C48571F948F65C004BEA85AC3B2`, 기존26 SQL/제안 diff guard 보존·아직 미적용. 검사 메타데이터는 현재 명령/OWNER/client/control·정확 허가/receipt와 결박하고 app UPDATE/DELETE·자동 해제는 계속 금지한다. unit 신규 RED3→전체110 PASS/1556ms/skip0·typecheck0·diff0. 실제 격리 저장/정리와 사용자용 격리 표시·단절 후 최종 상태 해소는 후속 미검증이다. 실제 사용자/Secret·CA·서비스·Agent/운영 변경0.

- 원문 선택/과거 조회 `0f63c11f7389ea7dd2f0608e335ea18e37a565fd` local/private·WSL exact/clean actual1 PASS/13612ms/skip0. 같은 Web에서 실제 지시 원문 재대조→작성 초안→명시 지식 저장/멱등·지시 source 보존·원 발언 불변 확인. 독립 DB25종 각0·시험root[]·지속root uid1000/0700/link0/실경로 동일/empty, SQL26 재적용0. 과거 버전 열기는 UI10 fixture에서 기존 exact GET으로 확인했다.
- 일반 원문 격리 보완은 `call_4b87f841c5d64bea971a63fdd129f632`의 ‘일반 원문 격리 계약·개발 DB 보완 승인’으로 현재 승인됐다. 새 업로드의 원문 바이트 보존·격리 상태/비밀 없는 사유/감사, 일반 다운로드·문서/지식 소비 차단과 새 forward만 허용한다. 기존 SQL/실제 사용자 권한·Secret/서비스/운영 변경0, 자동 삭제·격리 해제0. 알려진 raw byte 표식 검사이며 압축/암호화/표현 변형 등 완전 탐지나 기존 전 자료 재분류를 뜻하지 않는다. 합성 QA 수명/정리 조건은 앞선 UUID 사용자/프로젝트·시험 root와 같다.

- UI10 원문 재개/선택 후속 후보: 정확 supersedesRef를 따라 앞 버전 원문을 열고 현재 head와 과거/제외/확정을 구분한다. 새 API/DB0·자동 복원0. 보관 대화의 명시 선택은 원문/hash를 다시 읽고 실제 발언/지시 종류·SourceRef를 작성 버퍼에 고정한다. 사용자 판단 이유는 빈 채로 두며 명시 저장 전 쓰기0, sourceRefs 변경 뒤 재전송 거절. 신규 browser RED(버전 표시1/원문 선택1)→UI10 fixture10 PASS/9.2초, 출처 누락/factory 부재 unit RED2→전체107 PASS/1392ms, type/build0(Web82). 첫 출처 RED의 transport 내부 assert는 직접 생성 명령 비교로 보정해 실제 누락을 확인했다. 버튼 patch의 넓은 검색 조건 불일치1은 변경0 후 정확 tail로 보정했다. 기존 경고/인수 미검증 유지, 다음 exact SHA 실제 같은 client의 원문 선택→지식 저장을 확인한다.

- UI10 검토·확정 `6e9da43c320737479516f142d6d268b1b724db87` local/private·WSL exact/clean actual1 PASS/6638ms/skip0: 같은 Web에서 항목별 검토/멱등→명시 확인/별도 확정/멱등→확정 상태 검색·본문/현재 유효성→새 정정 버전과 옛 확정 보존·명시 제외까지 실제 DB/원문으로 확인했다. 독립 DB25종 각0·시험root[]·지속root uid1000/0700/link0/실경로 동일/empty, SQL26 재적용0. 단위105/UI10 fixture9와 실제 사용자 browser↔DB는 구분한다. 전체 FN05/Stage B·헌법 적용·보호 원문 격리·실제 Agent는 미완료다. 다음은 보존된 지식 버전의 목록/원문 재개와 출처 선택을 연결한다.

- FN05 검토·확정 서버 `498d1a6fa4442a5843307108aea8de4ef2c1e513` local/private·WSL exact/clean에서 새 forward26만 적용·기존25 지문 불변, actual FN03확장+FN11 2 PASS/6283ms/skip0. 최신 보완 검토 뒤 옛 합격 선택422·별도 확정/동일 명령·뒤 재검토의 현재 유효성 false·상태 검색/cursor를 확인했다. 독립 DB25종 각0·시험root[]·지속root uid1000/0700/link0/실경로 동일/empty. 실제 사용자·서비스/Secret 변경0.
- UI10 검토/확정 후보: 신규 단위 RED3→GREEN3, 확정 후 정정/제외 신규 RED2→GREEN2, 전체 단위105 PASS/1369ms/skip0. 새 검토 버튼 부재 browser RED1 후 UI10 fixture9 PASS/8.8초, 타입/빌드0(Web82). 기존 bundle500kB/NO_COLOR 경고를 유지한다. 상태 union 확장 중 화면 label 누락 타입 오류1은 CONFIRMED 표시/필터 연결로 보정했다. 경로 추측 조회 오류3은 파일 목록으로 바로잡았고 파일/권한 변경0. 같은 Web의 실제 판단/확정 저장 연결은 다음 exact 게시본에서 확인한다. 사용자 browser↔DB/헌법 적용·Agent 전달·전체 FN05는 아직 미완료다.

- FN05 내용 검토·별도 확정 후속: 게시 RED `a01a37fc529f3244764c7dd0cfd2ba820299de6d`의 WSL actual1 FAIL/6505ms/skip0은 confirmKnowledge 미연결로 정책 거절403 대신 입력400을 반환한 신규 선행 실패다. 현재 후보는 기존 recordContentReview의 KNOWLEDGE 대상·최신 실제 ACCEPTED 검토와 별도 confirmKnowledge를 결박한다. 새 forward26 `0005_knowledge_confirmation.sql` SHA256 `35BD5B9A3F6109881F0F22B1A06957114EA714556E03700678C7E1BA3D353766`, 기존25 SQL 불변·아직 미적용. 단위100 PASS/1503ms/skip0·typecheck0·diff check0. 조회 명령의 PowerShell brace 경로 문법 오류1과 문서 patch 제목 불일치1은 변경0 후 실제 경로/제목 확인으로 보정했다. 실제 DB/화면 확정은 미검증이다.
- Ruling: 한 버전의 확정 사건은 한 번만 보존한다. 확정 뒤 새 보완 검토가 있으면 과거 확정을 삭제하지 않고 currentConfirmationValid=false로 표시한다. 다시 확정하려면 정정된 새 불변 버전·새 검토가 필요하다. 판단이 틀리면 사용자가 새 버전을 만들어야 하는 비용이 있지만 옛 합격을 골라 현재 유효성으로 위장하는 것을 막는다. CONFIRMED는 헌법 적용·Agent 전달·자동 공유가 아니다.
- 이 후보 WSL QA는 기존 승인 DB의 합성 qa-document-storage-UUID 사용자/프로젝트·/tmp/anvil-v3-document-qa-UUID(0700)를 테스트 1회 수명으로 사용한다. finally에서 정확 대상만 정리하고 독립 DB25종·시험 경로·보호 원문 root 잔여를 재확인한다. 실제 사용자/Secret/서비스 변경0. 다음은 exact 게시본 forward26 적용·집중/인접 실제 검증 뒤 UI10 검토·확정 연결이다.

- 정정 UI 후속 `c2b1b75cad5c895c4f1e0c324936865b728237c9` local/private·WSL exact/clean actual1 PASS/5951ms/skip0. 같은 Web의 실제 지시 출처 지식→새 원문·정정2→앞1/이유/지시 source 보존·현재2 재조회·동일 명령 중복0을 확인했다. 독립 DB25종 각0·시험root[]·지속root uid1000/0700/link0/실경로 동일/empty. SQL25 재적용0. 다음은 별도 내용 검토/지식 확정·헌법 상태이며 전체 FN05/Stage B/사용자 browser DB 인수는 미완료다.

- 사용 제외 UI 후속 `9a9526255cb108a6c62d07633384826ea310a4bf` private/WSL exact/clean actual1 PASS/7346ms/skip0: 같은 Web의 exact 대상/사유·제외 사건·replay·기본 검색 배제·artifact 개수 불변을 확인했다. 독립 DB25종 각0·시험root[]·지속root uid1000/0700/link0/실경로 동일/empty. SQL25 재적용0. 다음 정정 쓰기 UI는 신규 unit RED2를 작성 중이며 전체 FN05/사용자 browser DB·확정/헌법·Agent/Stage B는 미완료다.

- 지식 상태/이력 후속 `eda65c855695ebb80dff5e7f6958bf455f0d16b8` local/private·WSL exact/clean actual1 PASS/5775ms/skip0: 같은 Web의 구버전/EXCLUDED 상태·명시 제외 검색과 정확 합성 정정사유 변조503→finally복원·옛 원문 보존 확인. 독립 DB25종 각0·시험root[]·지속root uid1000/0700/link0/실경로 동일/empty. SQL25 재적용0, 다음은 사용자 정정/제외 쓰기 화면이며 별도 확정/헌법·Agent/전체 인수는 미완료다.

- 지식 변경 서버 `4ce865e800be2591c5ab6b2e5121bba0155e04d1` local/private·WSL exact/clean에서 승인된 새 forward25만 적용·기존24 지문 불변, actual FN03확장+FN11 2 PASS/6012ms/skip0. 정정 버전2/앞 버전 보존·구버전/제외 상태·별도 정책·중복/구기준·기본 검색 제외·명시 조회/암묵 복원412를 확인했고 독립 DB25종/시험root0·지속root 보호/empty다. 사용자용 변경 UI/별도 확정·헌법 적용은 아직 미완료다.

- 대화 UI 후속 `2c123a45758d83dc8a7ce5c56cf3ca9c22eac91e` local/private·WSL exact/clean actual1 PASS/5561ms/skip0. 같은 Web new/prepare/sendConversation·지시 정정/순번4·read/list/멱등을 실제 원문/DB에서 확인했다. 독립 DB25종 각0·시험root[]·지속root uid1000/0700/link0/실경로 동일/empty. 기존24 SQL 재적용0. 전체 FN05/Stage B·실제 사용자 browser DB는 미완료이며 다음은 지식 정정/제외·확정이다.

- 대화 출처 후속 `2710f1d1182fd56a92f872017e17fa75e66575c9` local/private·WSL exact/clean actual1 PASS/5399ms/skip0: 보존된 사용자 원문/지시·정정 순번→지식 source→같은 Web 조회, 일반 발언 지시 위장422/가짜ID404/hash409·구원문 불변을 확인했다. 독립 DB25종 각0·시험root[]·지속root uid1000/0700/link0/실경로 동일/empty. 기존24 SQL 재적용0·전체 FN05/사용자 browser DB 인수는 미완료다. 다음은 대화 목록/원문 작성 화면이다.

- UI10 후속 `579ce2dc2da4a05f8031bded1ff00e00037696bd` local/private·WSL exact/clean actual1 PASS/5569ms/skip0: 같은 Web new/prepare/send/read/searchKnowledge가 실제 보호 원문/DB·정확 hash·동일 명령 재확인을 통과했다. 독립 DB23종 각0·시험root[]·지속root uid1000/0700/link0/실경로 동일/empty. 아래 ‘게시 전/실제 client 미검증’은 해당 시점 이력이며 실제 사용자 browser DB·전체 FN05/Stage B는 여전히 미완료다. 다음은 원문 대화와 지식 정정/제외·확정의 저장 경계다.

- FN05 저장 서버 `2b8a24227c57aa06394f21dc983de2c7849f59a1` private/WSL exact/clean에서 새 forward23만 적용·기존22 checksum 불변, 실제 FN03/FN04/FN05+FN11 2 PASS/5631ms/skip0. 원문/출처 hash·가설/제안·별도 정책·검색·교차 사용자·직접 변경 차단, 독립 DB23종 각0·시험root[]·지속root 보호/empty를 확인했다. UI10 신규 연결은 아래 후속이며 실제 사용자 browser DB/원문 대화·확정/정정/제외·전체 격리는 아직 미완료다.

- 최신 FN04 `dbd768a74184bed231963d3e31b3dfc0fd6699f3` local/private·WSL exact/clean actual1 PASS/4930ms/skip0. 같은 Web의 보관 계획 TRACE 준비·업무 선택·명시 linkTrace·receipt/hash·양방향 조회를 실제 DB에서 확인했다. 독립 DB20종 각0·시험root[]·지속root uid1000/0700/link0/실경로 동일/empty. 전체 FN04/Stage B 완료나 실제 browser DB 인수는 아니다. 다음 승인된 FN05 원문·지식 초안 저장을 시작한다.

- 추적 서버 최신 `cca0899053859ba8184535eac6645bea236e5284` 지정 private/WSL exact/clean에서 승인 forward22만 적용·기존21 불변, actual FN03/FN04+FN11 2 PASS/4532ms/skip0. 실제 설계/화면/업무 원문에 대한 명시 링크·멱등/중복/잘못된 ID/hash/관계·양방향 동일 edge·cursor·격리·직접 변경 차단 확인. 독립 DB20종 각0·시험root[]·지속root uid1000/0700/link0/실경로 동일/empty. 아직 추적 link/view Web UI·화면 검토 선택/계획 확정·변경 영향/실제 실행 출처는 미완료이며, 다음은 조회/연결 화면이다.

- 최신 후속 `c4694579547d1ad7997ca3e6021eb30c9a59f96e` local/private·WSL exact/clean actual1 PASS/3683ms/skip0: 보관 계획의 목록/문서 필터·서명 cursor 변조/조건 변경·격리·같은 Web 원문 재확인/개정 준비→새 명령/버전2 저장·과거1보존 확인. 독립 DB19종 각0·시험root[]·지속root uid1000/0700/link0/실경로 동일/empty. 단위77·계획 fixture3·Web68/type/build는 실제 browser DB/사용자 인수와 구분한다. 다음은 실제 화면 검토 선택/계획 확정·trace edge/변경 영향이다.

- 최신 코드 `cefa3fb9dd85caad2ac07adad7f33abac4443834` local/private·WSL exact/clean에서 같은 Web 작업계획 prepare/send/read actual1 PASS/4151ms/skip0. 고정 원문/설계/D/S와 업무 카드·두 선행 저장/재조회, 미확정·미검토 문제 보존과 권한/구버전/멱등을 확인했다. 독립 DB19종 각0·시험root[]·지속root uid1000/0700/link0/실경로 동일/empty. 단위76·UI06 fixture34·type/build PASS와 실제 browser↔DB/사용자 인수는 구분한다. 다음 미완료는 보관 계획 목록/개정 재개·화면 검토 선택·계획 확정·trace edge/변경 영향이며 전체 FN04/Stage B는 미완료다.

- FN04 저장 최신 `b43b26671f7b0bc5aa87d1353b4edeaf0c5ca55b` 지정 private/WSL exact/clean에서 승인된 forward21만 적용하고 FN03/FN04+FN11 실제2 PASS/3818ms/skip0. 계획 원문·설계/화면 연결·초안 저장/멱등/개정·옛 버전·문제/두 선행·권한/교차 사용자/직접 확정 변경 차단을 확인했다. 독립 DB19종 각0·시험root[]·지속root 보호/empty. 저장 API와 사용자 화면 작성·실제 browser DB 여정은 구분하며 현재 UI 작성 연결 중이다.

- 최신 FN04 `dc01cae2b8d0f9e93aff279fa7e4f1b4425c1334` local/private·WSL exact/clean actual1 PASS/4228ms/skip0. 같은 Web client의 설계/화면 위치 등록·정확 receipt/재조회 hash·동일 명령 재확인을 실제 WSL DB에서 확인했다. 독립 DB15종 각0·시험root[]·지속원문 uid1000/0700/link0/실경로 동일/empty. SQL20 재적용0. UI06 fixture32/단위72와 실제 browser↔DB·사용자 인수는 별개이며, 다음은 승인된 AF04 작업계획/업무/선행 저장이다. 아래 과거 미완료 서술은 해당 시점 이력이다.

- 현재 후속 코드 `ae2c3fd5001f90af17995929aa9abfba6ec8559e` local/private·WSL exact/clean actual FN03 1 PASS/3017ms/skip0. 보관 자료 재개·복합 충돌 수동 조정·검토/확정 거절 보관/명시 새 대상·새 판단/새 확인·옛 원문/확정 사건 보존까지 확인했다. 독립 DB13종 각0·시험root[]·지속root uid1000/0700/link0/empty. 단위65·UI06 fixture25+추가 음성2·Web62/type/build와 실제 browser↔DB/사용자 인수는 구별한다. 아래 앞선 ‘재개/복합 충돌/대상 교체 미완료’ 문구는 이전 시점 이력이다. 소스/단계 연계·실제 runtime·전체 FN03/Stage B는 여전히 미완료다.

- 최신 후속: `4997e732f6bebfca92812cc6d7a5680dcbb71664` local/private·WSL exact/clean actual FN03 1 PASS/2712ms/skip0. 보관 목록→원문/hash·고정 양식→후보 재생성 없이 새 초안, 저장 제안→과거 명령 합성 없이 별도 반영/replay·구버전 보존 확인. 독립 DB13종 각0·시험root[]·지속root uid1000/0700/link0/empty. Windows unit61/UI06 fixture20+추가 음성2·Web61/type/build PASS는 실제 browser↔DB/사용자 인수와 구별한다. 아래 이전 후보/제안 재개 미완료 문구는 이 후속 전 이력이며, 다음은 복합 충돌/대상 교체·소스/추적이다. 전체44업무 상태 합계는 유지한다.

- 기준일: **2026-10-16 / Asia/Seoul**. 기록 담당: Main 어울.
- 단계: **전체44업무 목표 유지 / Stage A 통합·smoke·정리 완료 / Stage B UI00~03·UI06·FN01~03·FN11 부분 구현**. UI06의 양식 기반 신규/개정 저장·고정 버전 내용검토·별도 확정·명확한 저장 충돌 비교/선택에 이어 텍스트/Markdown 원본 보존→가져오기 후보→명시 초안 선택을 연결했다. 화면 fixture와 동일 클라이언트의 실제 WSL API/DB 증거는 구분한다. 실제 UI DB 여정·수정 제안/후보 목록 재개·복합 충돌/추적·기존 소스·실제 Agent는 미완료다.
- 정본: [설계 r8](design/Anvil_설계서_v3_초안.md), [계획 r7](WORK_PLAN.md)(r3 직접 승인 유지·필요한 전달/복구·선행 상세화), [개발환경](DEVELOPMENT_ENVIRONMENT.md), [작성 공통 기준](design/문서작성_공통기준.md). 이전 실행안전 보완은 이력이며 추가 현행 권위 문서가 아니다.
- 최근 실제 확인: 최종 코드 `d05c3df31f7112f0cd761ea3e771d3830d42b94c` local/private·WSL exact/clean의 FN03 actual1 PASS/2756ms/skip0. 동일 Web client의 실제 제안/서버 diff/명시 반영·replay·원본/구버전 보존 확인. FN11 인접은 직전9198a9bc actual2 PASS/2343ms에 포함된다. 새 forward19/기존18 불변, Windows unit61·UI06 fixture16/13.8초·type/build/Web59 PASS와 실제 browser↔DB/사용자 인수는 구별한다. 이전 가져오기 검토/실패/검증은 아래 이력이다.
- 코드 기준: `codex/av3-stage-b`, base private main `f976ed5e29e14b13e12729d5b1ccf98f050f2210`(PR41 merged). Stage A branch 원격 부재/로컬 삭제·통합 smoke와 소유 Node 종료/3830잔여0을 확인했다. 원래 `codex/anvil-public-ui-preview`의 HEAD `ef80f61c`와 기존 삭제/dirty·미추적 자료는 보존하며 신규 코드와 합산하지 않는다.
- 다음 업무: 같은 직접 승인 아래 FN03 수정 제안/서버 차이 비교·명시 반영과 후보 목록 재개, UI06 양식/첨부 동시 변경 수동 조정·검토/확정 대상 교체, 기존 소스 선언/기준선·FN04/FN05다. 최신 사용자용 실행환경과 만료 초기 등록/relay 경계는 별도이며 실제 화면 DB 통합을 성공으로 세지 않는다. 자료 정책의 일회 승인 소비·Agent 허가·정책 편집 화면도 미완료다. P01/P02·완료 검사는 반복하지 않는다. 실제 Agent/Oracle는 미실행이다. 인증서 신뢰는 후속 HTTPS 검수 동안만 유지하며 2026-10-23 03:29:02 KST 만료 또는 검수 종료 때 정확 CA1개를 회수한다.

신산님이 지정한 `D:\Project\Daon2\docs\WORK_STATUS.md`의 **업무별 현재 요약 + 일자별 상세 이력** 형식을 참고했다. Daon2 문서는 읽기만 했으며 내용/상태를 Anvil로 이월하지 않았다.

### 상태 표기와 갱신 규칙

- **완료 [0] / 검토·테스트 중 [1] / 개발·작업 중 [2] / 시작 안 함 []**. P업무는 코드가 아니라 각 준비 산출·검토의 실제 완료를 기준으로 한다.
- [0]은 해당 카드의 완료 조건과 검수 증거가 있을 때만 표시한다. 제출만 됐으면 검수 대기이며 완료가 아니다. 실패·미검증·차단은 사유와 함께 별도 표시한다.
- 기능 사용 가능성은 `구현 완료·핵심 동작 확인 / 구현했지만 동작 미확인 / 부분 구현 / 미구현`으로 따로 기록한다. IX08 미실행을 1단계 미구현과 혼동하지 않는다.
- 현재 합계: **[0] 3 / [1] 0 / [2] 12 / [] 29 — 총44개**. P01/P02/P03 준비 수용, UI00/UI01/UI02/UI03/UI06/UI10/FN01/FN02/FN03/FN04/FN05/FN11을 Main 어울이 순차 작업 중(동시 writer 아님). 준비 산출물·schema 존재는 제품 기능 완료가 아니다.
- 시작·주요 변경·시험·오류·중단·검수 때 아래 해당 행과 일자별 기록을 함께 갱신한다. 행에는 현재 지점·담당/시작·최근 변경·증거/검수·미확인·다음을 추가한다.
- 일자별 기록에는 날짜·업무 ID·담당·branch/HEAD·변경 파일·명령/exit·결과·오류 횟수/원인/조치·QA 정리·미검증·다음 행동을 남긴다. 지시/승인과 실측을 구분한다.
- 이 파일이 실제 진행/증거의 정본이다. 계획의 정의·의존·완료 기준은 WORK_PLAN과 업무 카드가 정본이며, 계획 등록부 상태와 불일치하면 실제 증거를 대조해 함께 정정한다. 이력은 삭제하거나 과거 실패를 PASS로 덮지 않는다.

## 2. Stage별 요약

| Stage | 결과 목표 | 현재 상태·남은 일 |
|---|---|---|
| A | 설계·실행 준비 | [0] P01~P03 수용·PR41/main f976ed5e·통합 smoke·소유 자원/branch 정리 |
| B | 프로젝트·방법론·문서·지식 원본 | [2] 인증·프로젝트 조회/초안 저장·공식 양식 저장/조회 일부 연결. 방법론/문서 작성·지식·실제 UI DB 여정 미완료 |
| C | 실제 기존 Agent 작업 제어 | [] 실제 연결·임무·승인·실행/결과 회수 미구현 |
| D | 도구 교체·설계 변경 통제 | [] 최소 손실 인계·실제 다른 도구/총괄 교체 미구현 |
| E | 사람/기기 제어·백업·설치형 | [] 기능 구현·핵심 확인 미착수 |
| F | 1단계 전체 기능 사용 준비 | [] 선행 기능 완료 후 IX07, 현재 완료 후보 아님 |
| G | Oracle 후보 정밀 검증 | [] IX08 미착수. 별도 이전/배포 승인·환경 선행 필요 |

## 3. 준비 업무 — P01~P03

상세 범위: [준비·통합 업무 카드](work_packages/INTEGRATION_WORK.md).

| 업무 | 상태 | 현재 요약·근거 | 다음 수행·검수 |
|---|---|---|---|
| P01 상세 클릭형 동작·오류 검토 | [0] | 2026-10-15 Main 어울. [2차 검토·승인](04_test_reports/AV3/P01/REVIEW-02.md). 14경로×8상태 시안 검사·핵심 브라우저 확인, 사용자 원문 ‘P01 시안·양식 승인’ | 승인 hash의 시안·양식 보존. 제품 기능 완료로 이월하지 않고 P02 진행 |
| P02 Agent 지원·기술·계약 확정 | [0] | 2026-10-16 Main 어울. [종료 검토](04_test_reports/AV3/P02/RESULT.md)·TD-01~03 직접 승인·UI15/FN18 상세·6능력×4후보. 독립 C0/I3→최소 보완·추가 FK1 정정. 실제 구현/연동 미검증 | P03 정확 버전/lock·명령/환경을 준비하고 각 FN/IX의 실제 검수로 연결 |
| P03 기준선·검증 실행 환경 | [0] | 2026-10-16 Main 어울. [실제 결과](04_test_reports/AV3/P03/RESULT.md): unit13/실제 DB1/Edge1·build/타입 PASS, scoped 독립 C0/I0/M0. 준비 환경만 수용 | Stage A 통합 검수 후 UI00/FN01. 실제 제품 기능·Agent 연동 미검증 |

## 4. 화면 업무 — UI00~UI14

상세 범위: [화면 업무 카드](work_packages/SCREEN_WORK.md). 아래는 설계 시안의 존재가 아니라 **제품 화면 업무의 현재 상태**다.

| 업무·화면 | 상태 | 현재 요약 | 다음 수행·검수 |
|---|---|---|---|
| UI00 공통 작업틀·상태 표현 | [2] | 2026-10-16 Main 어울 착수·P01/P02/P03 기준. 실제 FN01 인증/제어 연결 전 부분 구현으로 관리 | shell·라우팅·오류/입력보존·same-origin client→FN01/FN11 실제 연결 |
| UI01 프로젝트 목록 | [2] | Main 어울. 허가 목록 API·검색/보관·cursor·뒤로/오래된 자료 표시 연결, 계약2 PASS. 실제 새 UI DB 여정은 미검증 | 생성·단계/담당/완료·결정/다음 행동·실제 브라우저 검수 |
| UI02 프로젝트 생성·기준선 | [2] | Main 어울. 빈소스 초안/고정 선택·직접 정의·내용 검토/별도 확정→명시 생성/단절 시 동일 명령 재확인 연결. UI02/03 fixture23, actual API/DB는 별도4 PASS | 기존 소스/문서·자료/총괄·환경·실제 UI DB 여정 |
| UI03 방법론 흐름도 | [2] | Main 어울. 공간형·노드/문서/조건 편집·공통/초안 검토·확정, 첫 프로젝트 고정 적용 snapshot을 실제 API/DB 확인. 전체 UI DB 여정 미검증 | 기존 프로젝트 개정/적용 전환·전체 편집/실제 UI DB 검수 |
| UI04 프로젝트 주 작업 | [] | S04 정적 시안 | 절차·총괄/책임자 대화·자료·지시/시작/중지 연결 |
| UI05 책임자·실행 상세 | [] | S05 정적 시안 | 실제 임무/관측·원문/diff/시험/현황 조회 |
| UI06 문서·설계·계획 추적 | [2] | Main 어울. 문서/후보/제안·검토/확정·충돌·D/S·계획·고정 단계 선택/보존·조회 일부 연결. same-client 단계 actual6cdb21cb와 합성 화면 구별 | 소스/추적 잔여·변경 적용/UI07·실제 사용자 화면 DB 여정 |
| UI07 설계 변경·영향·역사 | [] | S07 정적 시안 | 전후/영향·승인·계획개정·재개·과거근거 조회 |
| UI08 승인·중요 문제 | [] | S08 정적 시안 | 정확 범위 승인/거절/수정·원인미확인 표시 |
| UI09 새 세션·다른 도구 이전 | [] | S09 정적 시안 | 기록/안전→대상→이해대조→실제 재개 |
| UI10 헌법·지식·결정 이유 | [2] | Main 어울. 대화/출처·지식 작성/정정/제외·검토/확정·헌법 별도 적용/이력 same-client actual7cf8c005, fixture13 | 공유·임무별 선별/이해 대조·현재 사용자 browser DB |
| UI11 Agent·환경·권한 | [] | S11 정적 시안 | 실제 지원/연결/시험·환경/허용범위 설정 |
| UI12 사람·클라이언트 인계 | [] | S12 정적 시안 | 요청→안전요약→수락→단독 제어 확인 |
| UI13 모바일 작업·승인 | [] | S13 정적 시안 | 실제 같은 프로젝트/요청·지시·승인·제어권 연결 |
| UI14 설정·백업·보조 조회 | [] | S14 정적 시안 | 백업/영향·한도/알림·원화면과 같은 상태 조회 |

## 5. 기능 업무 — FN01~FN18

상세 범위: [기능 업무 카드](work_packages/FUNCTION_WORK.md). 신규 설계 기준 기능 상태는 모두 미구현이다. 과거 코드/시험은 재사용 적합성 확인 전 이 표의 완료 근거가 아니다.

| 업무 | 상태 | 현재 요약 | 다음 수행·검수 |
|---|---|---|---|
| FN01 프로젝트 원본·접근·기준선 | [2] | Main 어울. 인증 기반과 빈 초안→원자 생성/owner·client 제어1/receipt·감사·snapshot·재조회/중복/격리/DB 실패 rollback 확인. 실제 사용자/지속 QA 프로젝트0 | 기존 소스/기준선·복구/초대·실제 UI DB 여정 |
| FN02 내장/사용자 방법론·그래프 | [2] | Main 어울. 내장/공통본과 생성 초안 exact graph 검토/확정·소유·현재 버전·최신 REWORK 차단/프로젝트 전용 원본·고정 snapshot 실제 API/DB 확인 | 기존 프로젝트 개정/적용 전환·전체 편집/실제 UI DB 여정 |
| FN03 문서 가져오기·양식·확정 | [2] | Main 어울. 원문/불변 버전·검토/확정·제안/후보 재개·충돌/대상 교체·고정 적용 단계/정확 양식 연결 actual6cdb21cb·forward40·QA 잔여0 | 소스 실관측/드리프트·실제 사용자 화면 DB 여정 |
| FN04 설계 추적·계획·변경 영향 | [2] | Main 어울. 정확 AF02/AF03 원문 위치 등록·조회 actual 확인, 선행 분석 일부 구현 | AF04 작업계획/업무/선행·trace edge·3상태축·영향/계획개정 |
| FN05 헌법·지식·원문·맥락 | [2] | Main 어울. 원문/지식·이유/이력·검색/정정/제외·검토/확정·헌법 적용/교체/무효 이력 actual7cf8c005·SQL37 | 공유·맥락 선별/전달/이해(FN09/IX04 선행) |
| FN06 첫 코딩 Agent·환경 | [] | 실제 제품/버전별 연동 미확인 | 공식 지원과 실제 세션/지시/결과·권한 확인 |
| FN07 두 번째 Agent·계정 교체 | [] | 실제 두 번째 연결 미확인 | 공통계약으로 타도구·계정교체·원본유지 |
| FN08 Windows 실행·회수·중복방지 | [] | 회수/스풀 논리 계약 | 실제 관측·ACK·재전송/중복부작용 차단 |
| FN09 총괄·단계·하위 임무 | [] | 역할/위임 설계만 있음 | 필수맥락·임무·권한부분집합·단일writer |
| FN10 자동/건별·분기·한도 | [] | 진행모드/그래프 설계 | 실제 단계전이·승인지점·슬롯/대기열 |
| FN11 권한·일회 승인·통제 | [2] | Main 어울. 현재 OWNER/client/control 세대·최근 재인증의 명시 정책/불변 버전·기본 DENY·중복/거절 감사·구세대 replay actual 확인 | 일회 승인 소비·검토/한도/Agent 범위·정책 편집 화면·전체 실제 여정 |
| FN12 결과·검증·이상 판정 | [] | 제출≠완료·분류 설계 | 실제 증거 대조·보완·원인미확인/미실행 |
| FN13 체크포인트·중지·재개 | [] | 상세현황/복구 계약 | 현재지점 파일·정지확인·옛권한/중복 차단 |
| FN14 최소 손실 이전 | [] | 인계 절차/손실 측정안 | 실제 새세션/타도구/총괄 인계·공백/이해대조 |
| FN15 사람·클라이언트 제어권 | [] | 단독작업/동시조회 계약 | 인수·구기기 차단·실제 권한 검수 |
| FN16 백업·반출·검증복원 | [] | 논리 보존/복원 설계 | 실제 manifest·별도복원·원문/관계/증거 무결성 |
| FN17 중요 알림·모바일 전달 | [] | 중요/일반·미지원 구분 설계 | 실제 지원/허가·사건/인증요청 연결 |
| FN18 Windows 설치형 산출물 | [] | TD-01 Electron Windows 설계 선택, 제품 구현 미착수 | 패키징/업데이트 계약 뒤 코드/산출물·같은 서버자료·안전복원 |

## 6. 연결·통합 검수 — IX01~IX08

상세 범위: [통합 업무 카드](work_packages/INTEGRATION_WORK.md). 개별 UI/FN 시험을 합산해 아래 실제 흐름을 통과한 것으로 표시하지 않는다.

| 업무 | 상태 | 현재 요약 | 다음 수행·검수 |
|---|---|---|---|
| IX01 방법론→설계→계획→지식 | [] | 시나리오만 작성, 실제 실행 없음 | 내장/복사/직접작성→저장·확정·추적·재조회 |
| IX02 화면→실제 Agent→결과 | [] | 시나리오만 작성 | 실제 coding 임무·문서작성 임무·결과 회수/검수 |
| IX03 모드·승인·보완·중지 | [] | 시나리오만 작성 | 자동/건별·승인1회·실제 정지/재개·중복0 |
| IX04 이전·회수공백·설계변경 | [] | 시나리오만 작성 | 같은도구 새세션·다른도구·총괄 교체·변경 통제 |
| IX05 PC·모바일·사람 인계 | [] | 시나리오만 작성 | 같은요청/단독제어·실제 권한/비밀 경계 |
| IX06 복원·단절·설치형 | [] | 시나리오만 작성 | 원본반출/검증복원·체크포인트·개발산출물 |
| IX07 1단계 전체 사용 확인 | [] | 제품 사용 가능한 후보 없음 | 전체 기능4상태·핵심흐름·미구현/미확인 공개 |
| IX08 Oracle 정밀 검증 | [] | 별도 이전/배포 미실행 | 승인된 exact후보/환경 뒤 정밀 시험·사용자 확인 |

## 7. 일자별 상세 이력 — 최신순

### 2026-10-16 FN05 지식 내용 검토·별도 확정 착수 — Main 어울

- 내용 검토 입력 부재 RED2→엄격5항목/판단 이유/부분합격·증거/주체 위조·알려진 비밀 차단 GREEN2. 별도 확정 상태 부재 RED1→born→CONFIRMED→선택 EXCLUDED와 과거 대체를 구별하는 상태 판정 GREEN. actual에는 confirmKnowledge의 별도 정책·검토 없음 거절·최신 REWORK 이후 옛 ACCEPTED 거절·별도 확정/이후 재검토 표시를 추가했다.
- Ruling: 확정 사건은 지우지 않되 후속 최신 검토가 바뀌면 currentConfirmationValid=false로 공개한다. 같은 버전의 암묵 재확정/재사용 대신 새 정정 버전에서 별도 검토/확정한다. 확정은 헌법 적용/Agent 실행 허가가 아니며 잘못된 경우 비용은 명시 재확정 흐름 추가이고 원문/기존 확정 기록은 보존한다.

- 기준96213036 clean/적용25 보존. INTERFACES §15.2의 기존 recordContentReview(targetKind=KNOWLEDGE), §10.3 confirmKnowledge(versionRef/reviewRefs/reason)를 소비한다. 새 공개 연산을 임의 추가하거나 내용을 읽었다는 표시를 이해/실행/헌법 적용으로 바꾸지 않는다.
- Ruling: 지식 기준1은 목적/종류·원문/관측/가설·이유/이력·범위/민감·미확인/한계의5항목을 사람이 판단하고, 전체 ACCEPTED는 모두 ACCEPTED일 때만 저장한다. 검토와 별도 확정은 분리하며 같은 작성자의 판단은 sameAsTargetRecorder로 공개하고 독립 검수라고 주장하지 않는다. 잘못된 경우 비용은 기준의 새 버전/재검토이며 원문·과거 판단을 보존한다.
- 정확 최신 버전/실제 원문·출처·명시 정책·현재 HUMAN/control·latest 검토를 확인한다. 허가된 실제 Agent 검토·시험 증거는 아직 연결하지 않고 신규 forward26으로 기존 PROJECT/DOCUMENT 보호를 보존하면서 KNOWLEDGE만 추가한다. 합성 QA는 기존 고유 UUID/프로젝트/root·정확 정리 조건이며 실제 사용자 정책/Secret/서비스·외부 전달/공유/학습 변경0이다.

### 2026-10-16 FN05 지식 정정·사용 제외 착수 — Main 어울

- 정정 UI `c2b1b75cad5c895c4f1e0c324936865b728237c9` exact private/WSL clean actual1 PASS/5951ms/skip0: 실제 USER_INSTRUCTION 출처 지식에 같은 Web으로 새 본문/현재 판단 이유/별도 정정 사유→불변2 저장·앞1 SUPERSEDED/원문/이유/지시 source 보존·2 재조회·동일 명령 replay 중복0. 독립 DB25종 각0·임시root[]·지속root uid1000/0700/link0/실경로 동일/empty. SQL25 재적용0·실제 사용자/서비스·Secret/Agent·공유 변경0. Git fetch의 자동 background 묶음 안내는 정보이며 수동 정리/설정 변경을 하지 않았다.

- 정정 화면 fresh UI10 fixture7 PASS/6.8초·type/diff0. 옛 원문/판단 이유를 그대로 보이고 새로운 판단 이유와 정정 사유를 분리했다. 단절 후 이동해도 원래 기준/명령을 유지하며 raw 업로드1회·정정 command 동일2회이고 새2 본문/옛 출처를 재조회했다. 합성 fixture를 실제 DB로 승격하지 않으며 이번 게시본에서 같은 Web actual을 확인한다. 기존97 단위/Web79 build 증거와 제외/정정·원문/확정 경계는 유지한다.

- 정정 화면 부재 RED1→KnowledgeCorrectionForm/App root의 exact 기준·구원문/옛 판단 이유·새 제목/본문/판단 이유·별도 정정 사유를 연결했다. 단절/이동 뒤 동일 command를 유지하고 제목/본문/출처를 몰래 교체하거나 새 원문을 중복 업로드하지 않는다. 현재 단위97 PASS/1483ms·type/build0(Web79/JS540.78kB/gzip141.79)이며 UI10 fixture7 결과는 후속 기록으로 수집한다. 같은 Web actual에 실제 지시 출처 지식의 새 원문/정정2·앞1 보존/replay를 추가했다. 별도 내용 검토/확정·헌법 적용·전체 격리·Agent/공유는 미완료다.

- 정정 Web 부재 RED2→validateKnowledgeView의 exact current head/원문/hash·소유자/기기/제어를 소비하고 새 원문/기존 출처/기존 원문 source를 합친 correctKnowledge 별도 명령으로 연결, 집중2 PASS/171ms·typecheck0. 종류 변경/제외·과거본의 암묵 복원·중단/변조 입력은 전송0이다. root의 별도 정정 버퍼·편집 폼을 작성 중이며 화면/실제 같은 Web은 아직 미검증이다. 기존 raw/version/SQL25는 보존한다.

- 제외 UI `9a9526255cb108a6c62d07633384826ea310a4bf` private/WSL exact/clean actual1 PASS/7346ms/skip0. 같은 Web new/prepare/sendKnowledgeExclusion에서 원문/정확 버전/사유→EXCLUDED·replay·기본 목록 배제·artifact 개수 불변 확인. 독립 DB25종 각0·임시root[]·지속root uid1000/0700/link0/실경로 동일/empty. 새 SQL/실제 사용자·서비스/Secret/Agent 변경0.
- 다음 정정 쓰기 UI: `tests/unit/FN05/knowledge-correction.test.ts` 신규 RED2는 client 부재다. 현재 이 파일은 단독 writer 소유 untracked 작성 중이며 기존 게시본 검사/초기 준비를 반복하지 않고 정정 client/화면을 이어간다. 제출/완료가 아니며 테스트 RED를 성공으로 바꾸지 않는다.

- 제외 화면 fresh UI10 fixture6 PASS/5.3초·type/diff0. 단절 뒤 화면 이동에도 정확 대상/사유/command를 보존했고 원문 삭제·업로드·버전 생성 없이 제외 사건만 요청했다. 같은 Web actual에는 별도 미제외 지식1개를 exact 버전으로 제외·replay·기본 목록 배제·artifact 개수 불변을 확인하도록 추가했다. 게시 전에는 실제 제외 UI client PASS를 주장하지 않는다.

- 제외 Web 연결 부재 RED2→조회한 exact 원문/entry/hash·현재 actor/client/control·사유를 묶는 별도 excludeKnowledge 준비/전송 GREEN. 기존 readKnowledge의 암호학적 검증을 validateKnowledgeView로 재사용해 전송 전 대상 snapshot 변조를 거절한다. 원문 업로드/삭제·새 지식 버전을 만들지 않는다.
- 제외 요청 화면 부재 RED1→KnowledgeExclusionForm/App root의 소유자/프로젝트별 요청 보존·명시 사유·정확 원문 확인·단절/이동 뒤 동일 command만 재확인·닫기/새 작성 금지로 연결했다. 현재95 단위 PASS/1309ms·type/build0(Web77/JS531.65kB/gzip140.47)·UI10 fixture6 결과는 아래 후속으로 기록하며 같은 Web actual은 아직 게시 전 미검증이다. 정정 쓰기 UI·별도 검토/확정·헌법 적용·전체 격리·Agent는 미완료다. 기존 SQL25 불변이다.

- 상태/이력 `eda65c855695ebb80dff5e7f6958bf455f0d16b8` exact private/WSL clean actual1 PASS/5775ms/skip0. 같은 Web이 SUPERSEDED/EXCLUDED·명시 제외 목록을 검증하고 합성 correction event1개 이유 변조를 원 명령 receipt 대비503으로 차단한 뒤 finally에서 복원했다. 독립 DB25종 각0·시험root[]·지속root uid1000/0700/link0/실경로 동일/empty. SQL25/지속 서비스·Secret·실제 사용자/Agent/공유 변경0. 다음은 지식 제외/정정의 사용자 쓰기 화면이며 검수/확정·헌법 적용·전체 격리는 미완료다.

- `4ce865e800be2591c5ab6b2e5121bba0155e04d1` private/WSL exact/clean forward25 `0005_knowledge_changes` checksum03dc6518...만 적용·기존24 checksum 불변·fixture7·실제 사용자0. actual2 PASS/6012ms/skip0: 별도 정정 policy403→명시 합성 허가·새 불변2/이유/출처/앞1 보존·replay·stale409·EXCLUDED 사건/기본 검색 제외/명시 제외 조회·제외본 암묵 복원412·인접 권한을 확인했다. 독립 DB25종 각0·임시root[]·지속root uid1000/0700/link0/실경로 동일/empty. 적용 SQL25를 수정하지 않는다.
- 후속 Web 상태 부재 RED1→정확 headVersion/supersedesRef·원문/hash·PROPOSED/CORRECTED/EXCLUDED 사건과 맞는 제안/과거/제외만 수용 GREEN. 상태 필터 화면 부재 RED1→명시 EXCLUDED 검색·과거/제외 구분 표시, UI10 fixture5 PASS/5.2초·build0(Web75/JS526.27kB/gzip139.32). 미검증/가짜 확정 기준은 유지했고 v1 fixture에 서버 새 head/ref 필드만 추가했다. 테스트 배열 index 타입1은 실제 존재하는 요소를 명시했다.
- 이력/원 명령 대조 부재 RED1→actor/버전/ref·정정 이유/변경 출처/사건ID를 불변 명령 receipt와 대조하고 정정 출처 원문을 재검사한다. fresh unit93 PASS/1347ms·type/diff0. 실제 같은 Web의 과거/제외 상태와 명령 대비 변조 거절은 이번 후속 actual에서 확인한다. 변조 시험은 고유 합성 프로젝트의 정확 correction event1개만 admin으로 임시 변경하고 finally에서 즉시 복원하며 실제 사용자 데이터는 대상이 아니다.

- 게시할 forward25 `0005_knowledge_changes` SHA256 `03dc6518781e35af3a06c28d7ee18d05936b2ebc9e513cbc0b100495b36c24fe`. 기존24 지문과 current policy/control/원문 보호·고유 시험 자원 조건을 유지한 exact Git QA로 확인한다. 실제 사용자 권한 부여/서비스/Secret·운영 변경0.

- 상태 판정 부재 RED1→PROPOSED/SUPERSEDED/EXCLUDED·잘못된 사건열 거절 GREEN1. 실제 RED `e1d9aaf807901ef1440ebe5f27686bce2a929937` WSL exact/clean1 FAIL/5344ms는 correctKnowledge route enum 부재로 기대403 대신400. 후속은 exact 현재 base·같은 kind·새 불변 버전/정정 이유·출처·앞 버전 보존, exact 제외 사건/기본 검색 제외·명시 제외 필터다.
- 새 forward25 후보의 현재 권한/receipt guard와 head 증가만 보완하며 적용23/24 불변이다. Windows fresh 단위91 PASS/1628ms·type/diff0, 실제 적용/상태 전환은 아직 미검증이다. SQL CASE 조건은 기존 검증된 괄호 패턴으로 작성하고 apply 전 지문을 재계산한다. sandbox Git read가 작업공간 없음으로 실패한2출력은 기존 sandbox 제한이며 Git 복구/초기화는 하지 않는다.

- 기준fabb5e63 clean/적용24 보존. 직접 승인된 FN05 정정/제외 이력 범위다. 기존 지식/원문을 덮거나 확정·헌법 적용·공유로 승격하지 않고 새 불변 버전/사건을 저장한다. 시험은 기존 고유 qa-document-storage UUID/프로젝트/원문root·별도 합성 정책이며 종료 후 지식 사건/버전·대화를 먼저 정확 정리한다.
- Ruling: 정정은 현재 exact head/hash·같은 kind를 요구하고 새 버전은 PROPOSED, 앞 버전은 SUPERSEDED로 구별한다. 제외 사건은 삭제가 아니고 기본 검색에서 제외한다. 제외된 head의 정정으로 암묵 복원하지 않는다. 현재 미구현 복원/과거 버전 목록은 별도이며 잘못된 경우 비용은 명시 복원 흐름 추가이고 원문/이력은 보존한다.
- 새 forward25에서 정정 출처/baseRef와 기존 지식 head/INSERT guard만 보완하고 적용23/24 SQL은 수정하지 않는다. 실제 사용자 권한·Secret/서비스·Agent 전달/공유/학습 변경0. 상태 판정/actual RED를 먼저 확인한다.

### 2026-10-16 FN05 프로젝트 사용자 원문 대화 착수 — Main 어울

- UI 후속 `2c123a45758d83dc8a7ce5c56cf3ca9c22eac91e` private/WSL exact/clean actual1 PASS/5561ms/skip0. 같은 Web 원문 업로드→기존 대화 지시 정정/순번4→정확 SourceRef/hash/본문·목록 읽기→같은 명령 재확인에서 중복0을 확인했다. 독립 DB25종 각0·임시root[]·지속root uid1000/0700/link0/실경로 동일/empty. SQL24/서비스·실제 사용자/정책/Secret/Agent는 변경0. API/실제 DB+FS와 합성 Edge fixture8은 각각의 증거이며 실제 사용자 browser DB/인수를 대신하지 않는다.

- 목록 서버 `27f8a4611c90d04fa9ad8f1d9a0b687ddcdf4a30` private/WSL exact/clean actual1 PASS/5952ms/skip0: 대화2개/발언3개·서버 순번/유한 다음 페이지·서명 변조400·교차 사용자404·본문 비포함 목록을 확인했다. 독립 DB25종 각0·시험root[]·지속root uid1000/0700/link0/실경로 동일/empty, SQL24 재실행0.
- 대화 Web client 부재 RED2→별도 원문 업로드/append·현재 사람/제어·정확 source snapshot/hash·서버 순번·STORED만 수용 GREEN. 시험 fake가 업로드에도 없는 message를 해시하던 오류1은 업로드/발언 응답 생성을 분리해 보정했다. 테스트 SourceRef.kind 문자열 타입1은 literal 표기로 고쳤다. 손상 목록/순번/cursor는 명시 거절한다.
- 화면 부재 RED1→UI10 ConversationPanel·App의 프로젝트별/주체별 root 버퍼로 새 대화/기존 발언·앞 지시 정정·목록/발언 원문을 연결했다. 단절/이동 후 같은 명령 유지, 닫기/중복 발행 금지이며 저장을 Agent 전달로 표시하지 않는다. 기존 지식 fixture에는 새 명시 대화 GET만 추가하고 미정의 API503 차단은 유지한다.
- fresh unit90 PASS/1396ms·type/build0(Web75/JS525.01kB/gzip138.93)·UI10 지식/대화4+직접 영향 UI06계획4=8 PASS/7.8초·diff0. >500kB·NO_COLOR 경고는 기존대로 보존한다. 같은 대화 Web prepare/send/read/list의 actual 검증은 이번 후속에 추가했으나 게시 전 미검증이다. 전체 FN05/실제 사용자 browser DB·지식 정정/제외/확정·헌법 적용·전체 격리/Agent 전달은 미완료다.

- 대화/발언 목록 실제 RED `d3645f20402b4ba0ea350d713a43ed5e29747c7e` WSL exact/clean1 FAIL/4947ms: GET conversations 미구현404(기대200). 후속은 현재 회원·프로젝트/사용자/collection별 서명 cursor, 발언 서버순번 내림차순·본문 비포함 요약/명시 원문 GET이다. 새 SQL/지속 자원0·기존24 불변. fresh 단위87 PASS/1395ms·타입/diff0, 실제 목록 성공은 게시 후 확인한다.

- 다음 대화 목록/발언 목록·화면 연결을 착수한다. 기준4768671d clean/적용24 보존. 목록은 현 프로젝트 회원·유한 서명 cursor와 서버 순번으로 읽고 원문/지시 작성은 별도 명령만 사용한다. 기존 고유 합성 QA만 쓰며 새 DB schema/서비스/Secret 변경0. 목록 부재 실제 RED와 후속 화면 검증을 분리한다.

- 출처 소비 `2710f1d1182fd56a92f872017e17fa75e66575c9` local/private·WSL exact/clean actual1 PASS/5399ms/skip0. 실제 사용자 지시 원문/hash를 지식의 별도 source로 보존하고 같은 Web에서 재조회, 일반 USER_MESSAGE를 지시로 위장422/가짜 messageID404/hash409·직접 원문 UPDATE42501을 확인했다. 독립 DB25종 각0·시험root[]·지속root uid1000/0700/link0/실경로 동일/empty. 기존24 SQL 재실행0, 현재 사용자/Agent 실행·서비스/Secret 변경0. 다음은 프로젝트 대화 목록/원문 화면이며 기존 지식 초안 테스트를 무변경 반복하지 않는다.

- 저장 서버 `13a6fad444ba0ec2ad767a1bb6ba1f7acc0b8ad9` private/WSL exact/clean에 새 forward24만 적용·기존23 checksum 불변·fixture7·실제 사용자0. actual FN03확장+FN11 2 PASS/5465ms/skip0: 사람 발언/불변 원문·명시 별도 policy·순번1→2·같은 명령 replay·앞 USER_INSTRUCTION 정정·구발언 보존·stale409·Agent 위조412·타사용자404·app 직접 UPDATE42501. 독립 DB25종 각0·시험root[]·지속root uid1000/0700/link0/실경로 동일/empty. SQL24는 적용본이며 수정하지 않는다.
- 후속 출처 후보: CONVERSATION/USER_INSTRUCTION 입력412 RED1→실제 같은 프로젝트 저장 발언/원문/hash resolver와 USER_INSTRUCTION 실제 kind 검사 연결. 기존 형식상 미연결 거절 사례는 실제 출처를 새로 지원하므로 대체했고, 위조 ID/hash/일반 발언 지시 승격의 actual 음성은 추가해 기준을 유지한다. 단위87 PASS/1299ms·type/build0(Web73/JS509.49kB/gzip136.11)·diff0. actual 지식의 대화 출처 소비는 아직 게시 전 미검증이다. 원문 대화 목록/작성 화면·지식 정정/제외/확정·전체 격리·Agent 전달은 미완료다.

- 입력 부재 RED1→현재 사람 발언/원문/범위·주체 위조 거절 GREEN1. 실제 RED `cc78f6fc264e17a8dc3db78dcf2a93090b2d5e0b` WSL exact/clean1 FAIL/5127ms는 appendConversation route enum 부재로 기대403 대신400이며 신규 저장 성공이 아니다.
- 후속 후보는 새 forward24 `0005_conversations` checksum `8241d4e6321d8798ecc8e78d83eae1147a3c8ff7110cdd86370cab3b73be98dc`, 불변 발언/현재 사람 출처·현재 권한/별도 정책·head 순번·정확 원문/hash·앞 지시 정정 연결/멱등/GET이다. Windows 단위86 PASS/1400ms·typecheck0·diff0. 실제 적용·정상/실패 확인은 게시 후이며 기존23 SQL 불변이다.

- 기준2b4f73ef clean, SQL23 적용/원문 보호 증거는 직전 기록을 소비한다. 새 발언은 현재 사람의 USER_MESSAGE/USER_INSTRUCTION만 수용하고 Agent/도구 발언·단계책임자 연결을 위장하지 않는다. 저장 상태는 STORED이며 배정/전달/실행은 만들지 않는다. 기존 원문을 덮는 대신 새 순번·별도 정정 참조를 쓴다.
- Ruling: FN09 역할 binding 전에는 targetRoleRef=null인 프로젝트 공통 대화만 저장하고, 현재 head_sequence와 expectedVersion으로 동시/구발언을 검사한다. 미연결 역할·첨부/일반 출처·단계 scope는412로 남긴다. 잘못된 경우 비용은 역할/참조 소비 확장이고 원문/정정 이력은 보존한다.
- 신규 forward24 후보의 정확 대화/발언 테이블·현재 주체/제어/정책/receipt를 추가한다. 고유 qa-document-storage UUID/프로젝트·시험root와 합성 정책만 사용하며 대화/발언을 먼저 정확 정리한다. 실제 사용자/Agent/Secret·서비스/운영은 변경하지 않는다.

### 2026-10-16 FN05 지식 원문·초안 착수 — Main 어울

- UI10 `579ce2dc2da4a05f8031bded1ff00e00037696bd` local/private·WSL exact/clean actual1 PASS/5569ms/skip0, 동일 Web의 신규 원문 업로드→정확 PROPOSED 저장·본문/hash 재조회·제목/종류 검색·같은 명령 멱등을 확인했다. 기존23 SQL 재적용0. 독립 DB23종 각0·임시root[]·지속root uid1000/0700/link0/실경로 동일/empty. 지정 main f976ed5e 불변과 private branch 같은 SHA를 조회했다. 새로운 실제 사용자/정책·서비스·Secret 생성/변경0이다. 사용자용 backend 혼재/relay HOLD/만료 bootstrap 경계는 그대로다.
- 남은 FN05 기능: 프로젝트 대화의 불변 원문/정정 지시·실제 출처, 지식 개정/정정/제외·별도 내용 검토/확정·헌법 적용/이해 상태, 전체 노출 의심 자료 격리, 정확 scope/추적, 맥락 선별/후속 전달. 외부 Agent 전달·공유·학습은 승인 범위에 추가하지 않는다. 이번 원문·지식 초안 저장 결과를 전체 기능 완료로 승격하지 않는다.

- `2b8a2422` exact에서 forward23 checksum42efe15b...만 적용·기존22 checksum 불변·fixture7·실제 사용자 생성0. actual2 PASS/5631ms/skip0이며 FN03/FN04/FN05 정상/중요 실패와 인접 FN11 정책을 확인했다. 독립 DB23종 각0·임시root[]·지속root uid1000/0700/link0/실경로 동일/empty다. SQL23은 적용본으로 더 수정하지 않는다.
- UI10 지식 작성 API 부재 RED2→원문 업로드/새 PROPOSED 저장·같은 command 재확인·정확 버전/hash·다른 주체/중단 전송0 GREEN. 검색 손상 응답 음성에서 TypeError1(조건식 삼항 우선순위)→묶음 조건으로 RESPONSE_INVALID 거절 GREEN. type-only 참조 상대경로1은 실제 경로로 보정했다. 새 화면 부재 RED1→KnowledgePage/root 프로젝트별 버퍼/현재 actor·client·제어·명시 저장/제목·이유 검색·원문/출처 이력 조회 연결. 단절→거절도 uncertain과 command를 유지하고 닫기/중복 작성 금지다.
- fresh unit85 PASS/1242ms·type/build0(Web73/JS509.44kB/gzip136.09)·UI10 fixture3+직접 영향 UI06계획4=7 PASS/6.8초·diff0. 브라우저 API는 전부 합성 intercept/미정의503이며 실제 DB 유출0, 실제 browser↔DB 검수는 아니다. 같은 Web prepare/send/read/search의 실제 DB 시험을 이번 후속에 추가했다.
- minor (deferred): 새 build의 >500kB chunk 경고1과 기존 NO_COLOR 경고를 보존한다. 합격 기준/상한을 바꾸거나 무관한 분할 최적화는 하지 않는다. 실제 UX 성능을 측정한 것이 아니다. 공유/Agent 전달/자동 확정·지속 서비스/Secret 변경0.

- 실제 RED `6019cd77ea9fbd834506ea96e826d9e9bb268a62` private/WSL exact/clean FN03확장1 FAIL/4591ms: saveKnowledge route enum 부재로 기대 정책거절403 대신400. 기존 원문/추적 검증을 신규 지식 PASS로 바꾸지 않았다.
- 후속 후보는 별도 saveKnowledge 정책·현재 제어/receipt, 실제 DOCUMENT_VERSION/ARTIFACT 물리 원문/hash·PROPOSED 불변 저장/조회, 제목/이유 검색·서명 cursor·타사용자404다. 새 forward23 `0005_knowledge_drafts` checksum `42efe15b4ebe3a860364ef85d92631fcf85c71f7143738026155e5814893153a`, 기존22 불변. Windows unit82 PASS/1294ms·type/build0(Web71)·diff0. 실제 적용/성공은 아직 미검증이다.
- 오류/조치: 문서 버전의 body 직접 접근 타입1→기존 content.body의 보호 originalText 사용. 문서 patch hunk 불일치1은 적용 전 전부 거절 후 정확 헤더로 적용했다. 보조 rg의 PowerShell wildcard 경로1은 오류 후 디렉터리 대상 검색으로 정정했다. 파일 read 경로 오지정은 발견한 project-files.ts를 사용하고 추측 경로 재시도 금지. 비밀 의심 차단은 FN05 신규 노출 경로에 한정하며 FN03 기존 원문 전체 격리는 미완료로 남긴다.

- 지식 입력 구현 부재 RED2→출처/가설/이유·프로젝트/미지원 참조 검증 GREEN2, 비밀 표식 차단 부재 RED1→GREEN3/184ms·typecheck0·diff0. 탐지는 알려진 키/토큰 표식의 보수적 거절일 뿐 모든 비밀 탐지/원문 격리 완료가 아니다. 실제 저장/API/검색은 아직 미구현이며 이번 실제 DB 시험은 그 경계의 RED 확인이다.
- 게시 범위는 승인된 Stage B 신규 FN05 코드/테스트·계획/현황뿐이며 목적지는 기존 git@github-sinsan-develop:sinsan-develop/Anvil.git의 codex/av3-stage-b다. Git 이력에 보존하고 Backup/원문 데이터/계정/Secret/인증서·다른 프로젝트는 전송하지 않는다. 실 DB QA는 위 고유 합성 자원만 생성/정리한다.

- 기준 dbd768a7 clean. FN04 같은 Web 쓰기 actual1 PASS/4930ms와 독립 DB20종/시험root 잔여0을 확인했다. 완료된 검사는 반복하지 않고 FN04 화면 검토/계획 확정·변경/실제 실행 출처는 미완료로 보존한다.
- Ruling: 기존 SourceRef의 DOCUMENT_VERSION/ARTIFACT부터 실제 원문/hash를 결박하고 미구현 대화·Agent·단계 참조는 fail-closed한다. 지식 저장은 PROPOSED이며 확정/헌법 적용·외부 전달/공유를 만들지 않는다. 잘못된 경우 비용은 출처 resolver/해당 UI 보완이며 기존 원문은 보존한다.
- 허가된 새 forward SQL만 추가하고 기존22 SQL 불변. 시험은 기존 고유 qa-document-storage UUID/프로젝트와 /tmp/anvil-v3-document-qa-UUID root·현재 명시 합성 정책을 사용하며 종료 시 새 지식 행을 먼저 정리한다. 지속 원문 root·실제 사용자/서비스·Secret는 변경하지 않는다.
- 오류: 보조 읽기1회에서 존재하지 않는 tests/unit/FN11/project-policy.test.ts를 지정해 경로 없음. 변경0이며 이후 rg로 실제 파일을 확인한다. 정본 상태 기록/새 계약·검증을 계속하며 FN05 전체 완료를 주장하지 않는다.

### 2026-10-16 FN05 원문·헌법·지식 저장 보완 직접 승인

- 신산님 응답 `call_e1335118cbae4ec08c2018f427e10d52`: ‘FN05 원문·헌법·지식 계약·개발 DB 보완 승인’. 기존 WSL anvil_v3_development에 새 forward migration으로 프로젝트 대화 원문·헌법/지식 불변 버전·확정/정정/제외 이력·검색 참조를 추가한다. 기존 보호 원문 보관소와 현재 로그인·단독 제어·명시 정책·정확 버전·감사를 연결한다.
- 기존 원문/SQL/확정 기록은 보존하고 외부 Agent 전달·자동 공유·모델 학습·실제 사용자 권한 부여·Secret/서비스/운영 변경은 제외한다. 합성 시험 자료만 정확 정리한다. 현재 단독 writer가 FN04 추적 연결 UI를 마무리/기록한 뒤 순서대로 착수하며, 승인 자체를 구현/적용/검증 완료로 표시하지 않는다.

### 2026-10-16 FN04 추적·작업계획 저장 착수 — Main 어울

- 읽기 client `aa184edd3665133fd909456d39cbb53162ae5bff` 지정 private/WSL exact/clean actual1 PASS/4667ms/skip0: 같은 readTrace가 실제 양방향 edge/ref/hash·역 traversal·미연결 출처를 검사했다. 기존22 SQL 재실행0. 아래 후보는 이 후속 쓰기 화면이며 actual 결과는 게시 후 별도 확인한다.
- trace 쓰기 준비 부재 RED1→new/prepare/sendTaskTrace, 상위 workPlanState.traceLink·TaskTraceEditor를 연결했다. 새 저장 계획 또는 보관 계획을 현재 제어 아래 읽기 전용 TRACE 모드로 준비하고, 해당 업무 카드에 선언된 정확 D/S만 명시 연결한다. 과거 계획 저장 command를 합성하지 않고 linkTrace의 별도 명령/정책/receipt를 소비한다. root 버퍼·보류 명령/입력·미확인 상태는 화면 이동 뒤에도 유지하고, 미확인 link가 있으면 내부/상위 닫기로 버리지 못한다. 첫 명확한 거절만 별도 버림 확인을 허용하고 단절 뒤 거절은 uncertain을 지우지 않는다.
- 화면 진입점 부재 RED1→보관 계획 준비/새 작성·단절·조회·추적 단절→거절→같은 명령 재확인4 PASS/4.6초. 새 닫기 지역변수 link가 기존 연결 함수와 겹친 타입1은 traceLinkWork로 구분했다. fresh 단위79 PASS/1267ms·타입/build0(Web71/JS495.52kB/gzip132.17)·diff0. 동일 Web TRACE 준비/쓰기 actual은 게시 전 미검증이다. 전체 기능 완료/실제 browser DB·배정/계획 확정/변경 영향·Agent 수행은 주장하지 않는다. 다음 FN05 DB 보완은 위 직접 승인을 소비해 순차 착수한다.

- 추적 조회 client 부재 RED1→readTrace의 정확 설계/방향·ref/edge payload hash·제한 wire·노드/연결/반대 traversal·미연결 증거 검증 GREEN. 조회 화면 진입점 부재 RED1→DesignIndexViewer의 명시 업무 연결 조회·TraceViewer를 연결했다. GET만 수행하고 같은 edge의 정방향/역방향·유한 다음 페이지·설계 업무 연결 누락·기준 미활성/실행·시험 미연결을 표시한다. 변조 시 앞선 노드를 지운다. 새 기능과 모순된 예전 ‘등록/계획 조회 미구현’ 안내와 해당 UI 문구 기대만 바꾸고 무결성/미검증 기준은 유지했다.
- fresh 단위78 PASS/1139ms·type/build0(Web70/JS488.13kB/gzip130.53)·직접 영향 UI06 조회/계획/위치 등록12 PASS/9.2초·diff0. actual 시험의 역방향 첫 항목 possibly undefined 타입1은 개수2 검증/명시 접근으로 보정했다. same Web readTrace의 actual 양방향/동일 edge/hash 검증은 게시 후 실행 전까지 미검증이다. 아직 화면에서 새 trace link 쓰기·화면 검토 선택/계획 확정·변경 영향은 미연결이다.

- `cca08990` exact 게시본에서 승인된 forward22 `0004_trace_links` checksum `31b8f7525bf8e07c4e6e13644ea97715b39e57cb9400a7fece8cbaccf1d0d51c` 적용·기존21 지문 불변·fixture7·실제 사용자 생성0. actual FN03/FN04+FN11 2 PASS/4532ms/skip0: 별도403→합성 명시 policy→빈 연결/미연결 근거→실제 plan task/설계·화면 링크·replay·새 중복409/자기422/가짜ID404/hash409/가짜시험412→양방향 같은edge·분리 traversal·서명 cursor/방향 변조400·교차 사용자404·app 직접UPDATE42501. 독립 DB20종 각0·임시root[]·지속root uid1000/0700/link0/실경로 동일/empty와 적용22 지문을 조회했다. SQL22는 이제 적용본이며 수정하지 않는다. 추적 Web 화면/client는 아직 미구현으로 남긴다.

- 추적 연결 초기 RED `4f171714fa4b69a88a044284cc57c3aeae59dff0` WSL exact/clean actual1 FAIL/4640ms: 신규 linkTrace 연산 schema가 없어 기대403 대신400. 앞선 계획 저장 PASS를 취소하거나 신규 추적을 PASS로 승격하지 않는다. 고유 합성 QA/finally는 유지한다.
- 후보 forward22 `0004_trace_links.sql` SHA256 `31b8f7525bf8e07c4e6e13644ea97715b39e57cb9400a7fece8cbaccf1d0d51c`는 승인된 개발 DB anvil_v3_development에 불변 trace_edges/명시 policy·현재 command/receipt guard만 추가한다. 기존21 SQL/원문/확정 pointer/서비스/Secret 변경0. 테이블은 후속 개발용 보존, 합성 trace 행은 기존 고유 project UUID의 finally에서 plan/document보다 먼저 정확 정리한다. 게시 exact SHA 적용/양성·음성 실제 결과는 아직 미검증이다.
- Ruling: 초기 실제 resolver는 DESIGN_ITEM/SCREEN_REGION/PLAN_TASK/DOCUMENT_VERSION의 project/id/version/hash·원문을 대조한다. 계획 업무 id는 plan id와 정확 versionRef/필수 localCode로 식별한다. REQUIREMENT/ARTIFACT/EXECUTION/TEST_EVIDENCE는 미연결412로 거절하고 VERIFIES 근거를 만들지 않는다. 지원 관계는 계획 업무→설계/화면 IMPLEMENTS, 화면→설계/설계→문서/문서→문서 REFINES, 동일 종류의 업무/설계 DEPENDS_ON이다. 상대 조회는 같은 불변 edge의 traversal 방향만 바꾸며 복제 저장하지 않는다. 잘못되면 additive resolver/관계 계약 보완이 필요하며 허위 완료/실제 실행은 허가하지 않는다.
- GET traces는 actor/설계 버전/방향/limit에 결박된 cursor·정확 원문/관계 재확인·설계에 계획 연결 없음/실행·시험 출처 미연결·baselineRef=null을 구분한다. local 단위77 PASS/1218ms·타입/diff0. 관계 unknown을 문자열로 가정한 타입1은 명시 type 검사로 보정했다. 읽기 경로 오타(traceability.schema 계획 파일)는 실제 존재하지 않아 변경 없이 확인 불가로 남겼고 기존 정본의 상세 계약을 소비했다. 문서 diff 검사 .NET의 Han 정규식 미지원1은 rg의 실제 지원 문법으로 바꾸어 신규 혼입0을 확인했다.

- 보관 계획 `c4694579` 게시 exact SHA actual1 PASS/3683ms/skip0. 같은 Web list/read/prepareStoredWorkPlan→pending 없는 과거 자료 재개→새 명령으로 기존 계획 v2 저장·구버전1보존과 유한 목록2개·필터/cursor 변조/교차 사용자 음성을 통과했다. 독립 DB19종 각0·임시 원문root[]·지속root uid1000/0700/link0/실경로 동일/empty. fresh 단위77 PASS/1308ms·plan fixture3/3.9초·type/build(Web68/JS480.53kB/gzip128.84)·diff0. SQL21·서비스/Secret/실제 계정 변경0. 이제 보관 계획 목록/개정 재개는 위 이전 미완료 문구를 대체하지만 화면 검토 선택/확정/trace/변경 영향과 actual browser DB·전체 FN04/Stage B는 미완료다.

- 보관 계획 목록 actual RED `454a9e49825fc54cf7c5c9cacf201e0153135c0d` WSL exact/clean 1 FAIL/4435ms: 목록 GET404로 기대200에 도달하지 못했다. 후속은 같은 membership·유한 limit/actor/project/document 필터·서명 cursor를 사용하고 목록을 NOT_RECHECKED로 구분한다. Web list/read/prepareStoredWorkPlan·WorkPlanLibrary는 읽기만 수행하다 사용자 확인 후 실제 원문/양식/설계와 현재 제어를 재대조해 같은 planRef의 새 개정 버퍼를 준비한다. 과거 명령은 합성하지 않고 pending=null에서 새 명령을 만든다.
- Web 목록 부재 RED1→단위3 GREEN, 보관 화면 진입점 부재 RED1→UI 작성/단절/보관 조회·개정 준비3 PASS/3.9초·Web68(JS480.53kB/gzip128.84)/타입/build0. 실제 read/prepare/send 새 개정과 목록 클라이언트를 actual에 추가했으며 게시 전 결과는 미검증이다. 기존21 SQL은 그대로다. 읽기 파일명 오타1(material-reads)은 생성/변경 없이 거절됐고 실제 material-list/service의 기존 cursor 계약을 확인했다.

- `cefa3fb9` 지정 local/private·WSL exact/clean의 같은 Web prepare/send/readWorkPlan actual1 PASS/4151ms/skip0. 중단 화면의 POST0·실제 초안 저장/receipt/hash·고정 버전 재조회 확인을 기존 원문/권한/개정 시험과 함께 통과했다. 기존21 SQL은 재실행하지 않았다. 독립 DB19종 각0·임시 원문root[]·지속root uid1000/0700/link0/실경로 동일/empty 확인. P01/P02/무관 browser/전수 검사는 반복하지 않았다. 실제 사용자용 Node/relay·초기 비밀·CA는 변경0, actual browser DB·Oracle/Agent 미검증.

- UI06 후속은 WorkPlanEditor·상위 workPlanState·new/prepare/send/readWorkPlan이다. AF04 정확 원문에서 화면/기능/연결/준비 업무·각 입력/출력/범위/파일 선언·별도 착수/검수 선행·수행/시험/검수/증거/복구를 작성하고 실제 확인한 설계/화면 위치를 선택한다. 미확인 POST는 같은 App 버퍼/명령으로 보존하며 기존 문서/import/proposal/review/confirm writer를 막는다. 단절→다음 거절도 uncertain을 해소하지 않는다. 실제 정책 부여·확정/배정/기준 활성화는 하지 않는다.
- UI 시험 첫 실행2case는 label에 보조 설명이 합쳐져 `업무 1 입력 한 줄에 한 항목`으로 노출된 오류1이었다. 실제 접근성 tree를 읽고 label/htmlFor와 aria-describedby 설명으로 분리한 뒤 같은 기준·15초 그대로 GREEN2/3.2초. hash만 맞춘 가짜 COMPLETED 카드를 채택하던 직접 음성 RED1→정확 wire 필드/카드·선행 검증 GREEN. fresh 단위76 PASS/1234ms·타입/build exit0(Web67/JS473.43kB/gzip127.38)·UI06 fixture34 PASS/25.7초·diff0. NO_COLOR 경고 유지. 같은 Web prepare/send/read actual 연결을 추가했으며 게시 후 검증 전까지 실제 결과는 미검증이다.
- 현재 화면은 새 작업계획 초안 작성/저장한 버전의 즉시 재조회까지이며, 이미 저장한 계획 목록·개정 재개·화면 검토 선택·계획 확정·trace edge/변경 영향·실제 실행 증거는 미완료다. 메모리 버퍼 보존을 FN13 영속 체크포인트 완료로 보고하지 않는다. 다음은 이 UI client의 exact SHA actual 확인 후 보관 계획 재개와 추적 연결이다.

- 실제 `b43b2667`에서 forward21 `0004_work_plan_drafts` checksum `9ea544780d61cf7b5914b9db597eadba2291fb487f42a373d695f053b8e8610e` 추가·기존20 불변·fixture7·실제 사용자 생성0. actual2 PASS/3818ms/skip0: plan 별도403→합성 명시 policy→AF04/AF02/D/S·미확정/미검토 issues·두 선행 저장/재조회·same command replay·개정2/옛1보존·hash409/가짜ID404/가짜COMPLETED422/잘못된 양식422·중복 코드 ISSUES_ONLY·app 직접UPDATE/확정 pointer42501·원문/outbox0. 독립 DB19종 각0·시험root[]·지속root uid1000/0700/link0/실경로 동일/empty 확인. SQL21은 적용본이므로 이제 수정하지 않는다.
- Web client 부재 RED2→new/prepare/send/readWorkPlan 연결 중. 타입 오류1(명시 payload index signature)은 객체 펼침으로 보정·타입0. 브라우저 진입점 부재 RED1/15초를 확인하고 작성 UI를 연결한다. docs patch1은 개발환경 머리글 불일치로 적용 전 거부돼 실제 머리글을 확인했다. 기존 검사 기준·서비스/Secret은 바꾸지 않는다.

- 업무 카드 분석 구현 부재 RED2→착수/검수 선행 분리·입출력/범위/검수/복구·D/S 참조·정상/중요 실패/직접 영향 시험을 검사하는 분석기 GREEN2, 새 상태/완료 필드·절대/상위 경로는 거절한다. 단위74 PASS/1331ms·타입0. `f69bc27f1d9ec6c00cdd27867459c36caba21f18` 지정 private/WSL exact/clean actual1 FAIL/2957ms: 아직 신규 연산 schema가 없어 기대403 대신400, 초기 미구현 RED로 보존했다. 실제 저장 성공 아님.
- 후속은 saveWorkPlanDraft와 고정 버전 GET·새 forward21 후보 `0004_work_plan_drafts.sql`이다. 적용된20 SQL은 보존한다. 실제 AF04/AF02·등록 D/S·screen review를 대조하고 새 계획/개정 head CAS·불변 version/card·START/ACCEPTANCE·명시 policy/receipt·감사로 연결한다. 초안은 DRAFT만 반환하며 설계/계획 미확정·화면 미검토·카드 누락/순환/중복 문제는 숨기지 않는다. 실제 DB 적용·양성/음성 검증은 게시 후 수행 전까지 미검증이다.
- Ruling: TaskCard 세부 내부 형식의 미정 부분은 기존 계약의 뜻을 바꾸지 않고 문자열 목록/명시 testCases·실제 D/S TraceRef로 상세화했다(INTERFACES §10.2). 상대 파일 경로는 계획 선언이며 실제 파일 권한이 아니다. 중복 코드/순환으로 관계 테이블의 유효 연결을 만들 수 없으면 원 카드와 issues를 불변 snapshot에 모두 남기고 ISSUES_ONLY로 투영을 보류한다. 잘못되면 카드 상세 계약/초안 투영의 forward 보완이 필요하며 기존 확정/실행 권한은 확대하지 않는다.
- 오류: 신규 서버에서 문서 review 필드명을 reviews로 잘못 참조해 타입 오류1. 실제 ProjectDocuments.version 반환 contentReviews와 대조해 바로잡고 타입/단위74 통과. 읽기 경로 오타2(apps/contracts,features/documents)는 파일 변경 없이 거부됐으며 실제 traceability/design-trace/루트 contracts 경로로 확인했다. 새로운 relay 시도/서비스/Secret 변경0.

- `dc01cae2` 게시 exact SHA actual1 PASS/4228ms/skip0. 같은 prepare/sendDesignIndex의 화면 중단 요청0→등록/receipt·GET hash 확인과 replay/권한·원문 보존을 실제 DB에서 확인했다. 이후 독립 read-only로 DB15종 각0·시험root[]·지속root uid1000/0700/link0/실경로 동일/empty 확인. default sandbox의 git status는 ‘this operation must be run in a work tree’1, 프로세스 조회는 무출력이라 성공/종료로 판단하지 않고 elevated 읽기에서 clean·Node40744/relay26052의 기존 시작 시각을 재확인했다. relay 재시도/서비스 변경0.
- 다음 승인된 작업: AF04 원문과 정확 AF02/AF03 추적 ID를 업무 카드에 결박한 초안 저장/불변 버전/착수·검수 선행 별도 보존. 원문/기존 SQL은 보존하고, 불충분한 설계 확정/화면 검토/참조는 issues로 남기며 계획 작성이 실행/완료/기준 활성화가 되지 않도록 한다. 실제 Agent/사용자 권한/Secret/서비스 변경은 없다.

- 등록 UI 후속: 진입점 부재 RED1→DesignIndexEditor·상위 DocumentBuffer의 designIndexState·new/prepare/sendDesignIndex를 연결했다. AF02 exact 원문에서 D코드/제목/줄, 실제 재조회한 AF03 버전의 S코드/줄을 선택하고 별도 index 명령만 보낸다. 기존 편집/import/proposal/review/confirm과 writer를 겹치지 않으며 미확인 입력/명령은 화면 이동 후 같은 App 버퍼로 유지한다. 입력/등록 metadata를 원문 변경/확정/업무 완료로 표시하지 않는다.
- 오류: actual 시험의 UUID template 추론/일반 문자열 대입 타입1은 생성 UUID의 문자열 타입만 명시해 보정했고 검증 기준은 유지했다. 새 select의 중첩 label이 options 텍스트까지 label 탐색에 포함되는 UI 오류1(동일2case)은 실제 error-context/접근성 tree 대조 후 htmlFor/id로 명시 연결, 같은 시험/15초 한도 그대로 GREEN2/2.8초. 단절 뒤403은 uncertain을 지우지 않는 추가1도 통과했다. fresh 단위72 PASS/1246ms·타입/build(Web65/JS454.69kB/gzip123.35)·UI06 fixture32 PASS/24.5초·diff0. NO_COLOR 경고1 보존, SQL20 checksum 불변이다.
- 실제 시험에 같은 prepare/sendDesignIndex로 중단 화면 요청0→등록/정확 receipt·GET hash 확인을 추가했으며 게시 전 실제 결과는 미검증이다. 기존 원문/SQL20·실제 계정/정책/Secret/서비스 변경0, 고유 합성 QA/finally만 소비한다. 다음은 게시 exact SHA actual·정리 확인 후 AF04 작업계획/업무와 추적 edge 저장이다.

- 읽기 client 후속 `67e84b8138f74247f2ef2e85880f1efeb966c112` local/private·WSL exact/clean actual1 PASS/13968ms/skip0: 같은 Web readDesignIndex가 실제 index GET의 정확 문서/항목/화면 metadata hash를 검증했다. 기존20 SQL은 재적용하지 않았다. 이번 실행 시간1개를 성능 합격/퇴행으로 판정하지 않는다. 등록 UI·plan/task/trace 연결은 미완료로 유지하고 다음 화면 등록을 같은 App 사용자/프로젝트 버퍼·동일 명령/미확인 보존에 연결한다.

- UI06 설계 추적 읽기 진입점 부재 RED1→DesignIndexViewer/design-index-api·DocumentsPage의 명시 GET 연결. 화면은 정확 문서 버전/원문 위치/실제 저장 ID를 표시하고 항목/영역 metadata hash를 확인한다. 조회만으로 제어권/쓰기0, 변조 때 이전 항목 제거·오류, 미연결 작업/시험은 미구현으로 표시한다. fresh unit71 PASS/1175ms·type/build exit0(Web64/JS442.29kB/gzip120.81)·UI06 fixture29 PASS/21.2초·diff0. 이 화면 검증은 fixture이며 같은 Web client의 actual index GET 검증은 게시 후 확인한다. 등록 화면·작업계획/trace edge는 아직 미연결이다.

- 후속 `98b3504dcf6bc2387f317a0acfcb9eb642657044` 지정 private/WSL exact clean에서 직접 승인된 forward20만 추가 적용했다. checksum `d0d6ef9221a46c96c4e6f033d6a14e22cc07b26a8bcb1949d67dbb8e574aea6a`, 기존19 불변·fixture7·realProductUsersCreated0. 실제 FN03+FN11 인접2 PASS/3368ms/skip0: 새 index의 별도403→합성 명시 policy→정확 source/hash·실제 줄 확인/원문 없는 코드422→저장/replay/새 중복409→GET/타 사용자404·app 직접UPDATE42501·기존 원문 불변. 독립 DB15종 각0(design_items/screen_regions 포함)·시험root[]·지속원문 uid1000/0700/실경로 동일/link0/empty와 적용20 checksum을 재확인했다. SQL20은 이제 적용본으로 수정하지 않는다. 인덱스 UI/작업계획/trace edge·실제 browser DB 여정은 아직 미연결이다.

- 초기 actual RED `8e74722ef3c0f49ab01acebb07a1bdd39182e580` WSL exact/clean 1 FAIL/2912ms: 새 index 연산이 아직 schema 미등록400으로 별도 허가 거절403에 도달하지 못했다. 기존 FN03 실패를 만든 것으로 오인하지 않고 후속 연결의 예상 RED로 보존한다.
- forward20 후보 `0004_design_index.sql` SHA256 `D0D6EF9221A46C96C4E6F033D6A14E22CC07B26A8BCB1949D67DBB8E574AEA6A`: 불변 design_items/screen_regions의 같은 프로젝트·실제 문서/version/hash·원문 artifact FK와 현재 actor/client/control/명시 policy/정확 receipt guard·app UPDATE/DELETE 불허를 추가한다. 기존19 SQL 변경0. 현재 미적용이다.
- ProjectDesignIndex·기존 docs의 보호 원문 읽기·projects route/명시 연산 policy whitelist·runner20을 연결했다. AF02 D코드/제목/실제 줄 및 AF03 S코드/실제 줄에만 등록하며 원문/확정 pointer 변경0이다. 현재 한 문서 버전당 각 최대200 항목/위치, line anchor만 지원하고 이미지 내부 영역/사용자 정의 양식 유형·배정/완료 근거는 미연결이다. same command는 replay, 새 명령의 중복 인덱스409·현재 head/hash409·원문 없는 코드/위치422·교차 사용자404를 actual에 추가했다. fresh 타입/diff0·unit69/1050ms PASS. 게시 exact SHA·승인된 runner20 적용·actual/독립 잔여 확인 전에는 저장 성공으로 세지 않는다.

- Ruling: 계획의 design_items/screen_regions 쓰기 경로가 기존 연산 표에 빠져 있으므로 승인된 FN04 계약 보완 범위에서 additive indexDesignDocument를 연결한다. 현재 소유 프로젝트의 정확 AF02 원문 버전·D 코드/제목/줄, AF03 원문 버전·S 코드/줄만 인덱싱하며 원문을 바꾸거나 그림 렌더/완료를 주장하지 않는다. 기존 문서 저장 허가로 자동 허가하지 않고 별도 명시 연산 정책을 요구한다. 잘못된 위치/종류/hash·교차 프로젝트를 거절하고 인덱스는 해당 문서 버전에 불변 보존한다. 이미지 내부 좌표/실제 시험·실행 근거는 아직 연결 전이다.
- FN03 actual의 같은 합성 setup/finally에 FN04 실제 원문 준비·명시 허가 누락403 사례를 추가했다. 고유 QA 사용자/프로젝트·임시 원문 root와 정리 범위는 유지하고 신규 design_items/screen_regions가 생긴 후에만 해당 프로젝트 행을 먼저 정확 정리한다. 단독 writer·기존 서비스/계정/Secret 불변이다. 게시 후 초기 actual RED를 확인하며 이 준비를 기능 완료로 세지 않는다.

- 직접 응답 `call_11d1758230c84e00a54432ba1c926988`: ‘FN04 추적·작업계획 계약·개발 DB 보완 승인’. 대상은 기존 WSL anvil_v3_development의 새 forward migration/설계 항목·화면 위치·계획 버전/업무/선행·추적 링크다. 기존 SQL/원문/확정본 유지, 현재 로그인/제어·명시 정책/정확 버전/감사, 합성 QA만 정확 정리, 자동 완료/기준 활성화·실제 사용자 권한/Agent/Secret/서비스/운영 변경0을 유지한다.
- 시작 2b964c66 local/private 동일·clean, DB19 불변. FN03의 실제 소스/단계 연결은 DATA_MODEL §15의 FN08 실관측 선행을 따르며 미완료로 보존한다. 기본 문서/버전/검토/명시 선택의 실제 API/DB 증거를 다음 FN04의 선행 자료로 사용하며 source 미확인을 완료로 올리지 않는다. UI10/FN05는 아직 미착수다.
- 승인 전 작성한 DB 비의존 `traceability/plan-dependencies.ts`와 FN04 단위4는 DATA_MODEL §7.2 plan_dependencies의 START/ACCEPTANCE 분리만 검사한다. 최초 모듈 부재는 테스트 로드 실패로 구분했고 골격 후 중복/순환·알 수 없는 phase/상태 위장 2건의 실제 행동 RED를 확인→GREEN4/123ms. fresh 전체 단위69 PASS/1158ms·타입/diff0. 2000개 순차 업무를 재귀 없이 확인하고 입력은 복사하며 actual 권한/참조·배정 준비 PASS를 반환하지 않는다. 아직 API/UI·DB 저장에 연결 전이다.
- 새 디렉터리 준비 patch1은 권한으로 적용 전 실패→승인 경로 안의 빈 폴더2개만 elevated 준비 후 patch 적용. 문서/모듈 탐색의 추정 경로 불일치는 파일 목록으로 실제 경로를 확인하며 실행 실패/제품 실패와 구분한다. 완료된 테스트/DB SQL19는 다시 적용하지 않았다. 다음은 exact 원문/설계 항목·업무/추적 참조를 기존 공통 권한/receipt에 연결한 새 forward20와 actual 합성 검수다.

### 2026-10-16 FN03 검토·확정의 거절 보관과 대상 교체 — Main 어울

- 후속 `ae2c3fd5001f90af17995929aa9abfba6ec8559e` 지정 private/WSL exact clean actual1 PASS/3017ms/skip0. 서버409의 옛 검토/확정 명령을 보관하고 현재 v3의 검토 항목을 미확인부터 새로 작성→새 적합 검토→새 확인/새 확정 명령을 실행했다. 옛 v1 원문 hash/확정 사건·새 정확 검토 ID·outbox0 유지. 독립 DB13종 각0·시험root[]·지속root uid1000/0700/실경로 동일/link0/empty. SQL19/권한/Secret/서비스 불변이다.
- 다음 FN04의 추적/작업계획 초기 저장은 새 forward migration 승인 질문을 1회 보냈다. 승인 전 actual DB/migration 실행0, 자동 기준 활성화·사용자 정책 부여·실제 Agent0을 유지하며 기존 승인 계획의 순수 검증/화면·계약 작업은 계속한다. FN03의 소스/단계·실제 runtime 의존 잔여를 완료 처리하지 않는다.

- 직전 ba4f6caf의 실제 복합 충돌/잔여0 증거는 유지한다. 다음 미완료 검토·확정 대상 교체는 기존 recordContentReview/confirmDocument만 소비하고 SQL/권한/Secret/서비스 변경0이다.
- 원인: 기존 UI는 명확한 JSON4xx 거절 뒤에도 pending을 유지한 채 대상 교체가 영구 차단됐다. 문서 저장/import의 확인된 거절/미확인 구분과 서버 head/hash 거절을 대조했다. Ruling: 명확한 첫 거절에서만 사용자가 원래 명령·판단/대상을 보관하고 입력을 다시 열며, 새 대상의 검토 판단/확정 확인은 승계하지 않는다. 단절/손상/5xx/불명확4xx 또는 과거 uncertain은 뒤 거절로 해소하지 않고 같은 명령만 확인한다. 보관은 현재 사용자/프로젝트의 App 버퍼이며 서버 영속 인계/체크포인트로 주장하지 않는다. 잘못되면 중복 명령/옛 판단 승계 위험이 있으므로 exact receipt와 새 명시 확인·기존 서버 gate를 유지한다.
- RED: 검토·확정 각1 화면이 보관/재선택 버튼 부재로 timeout15초 실패(늘리지 않음). 최소 연결 후 집중2 PASS/3.6초. fresh 단위65 PASS/1035ms, 타입/build exit0(Web62/JS437.43kB/gzip119.67), UI06 인접25 PASS/18.3초, 추가 ‘단절→403에도 보관/교체 금지·같은 명령’2 PASS/3.3초(합27). 단위는 다른 주체/client·변조/미확인 거절·옛 명령 불변·새 확인 필수도 검사한다. NO_COLOR 경고는 보존한다.
- 실제 FN03 시험에 옛 검토/확정의 서버409→원래 명령 보관→현재 문서 새 판단/새 정확 검토·별도 확인→새 확정/옛 원문·확정 사건 보존을 추가했으며 게시 전 실제 결과는 미검증이다. QA는 기존 승인된 전용 DB/고유 합성 UUID/finally 정확 정리만 사용한다. 이전 읽기 경로 추정1(os2)은 파일 목록으로 실제 project-content-review.ts를 확인해 정정했으며 제품 오류/시험 실패와 분리한다.

### 2026-10-16 FN03 복합 충돌의 명시 수동 조정 — Main 어울

- 시작 b7309eb0 local/private 동일·clean. 동시 writer1, 기존 승인 설계 §4.3/§11.7·FN03/UI06 카드의 충돌 비교/사용자 선택을 진행한다. DB/공개 연산·권한/Secret·서비스/적용 SQL 변경0, 기존 저장·고정 양식/첨부 검사를 그대로 소비한다.
- Ruling: 양식/첨부/형식이 다른 경우 기존 ‘내 입력 그대로 새 기준’은 계속 거절한다. 별도 확인에서만 최신 양식·첨부·형식을 유지한 수동 편집 초안을 열고 내 제목/본문·이유는 유지한다. 달라진 원문에 이전 항목 위치를 자동 승계하지 않고 다시 지정하며 원래 거절 snapshot/command는 버퍼에 보관한다. 잘못되면 필수 항목이 미연결인 초안만 생길 수 있으므로 별도 저장/형식 검사/검토/확정 gate를 그대로 유지한다. 아직 실제 단계/source 연결 자료는412 경계를 넘기지 않는다.
- RED: unit 새 사례1이 DOCUMENT_CONFLICT_COMPARISON_NOT_READY로 실패, UI 새 사례1은 수동 조정 버튼 부재로 실패. 좁은 helper/UI 연결 뒤 집중 unit3 PASS/137ms·화면1 PASS/2.2초. fresh 단위62 PASS/1038ms, 타입/build exit0(Web61/JS433.92kB/gzip119.05), UI06 fixture23 PASS/16.9초·diff check0. hash 손상/조회자 쓰기 거절·원래 단절/검토/확정 회귀는 유지했다. NO_COLOR 경고1은 변경하지 않는다.
- 실제 시험은 새 고정 양식·원본 첨부/형식이 있는 v5와 거절된 내 입력을 비교→명시 수동 준비→새 v6·v4/v5 보존·outbox0의 같은 Web client→WSL API/DB/FS 검증을 추가했다. 게시 exact SHA 전이므로 현재 실제 결과는 미검증이다. 합성 QA/정리는 직전 FN03과 같은 고유 UUID·전용 root/finally이며 실제 사용자/지속 원문 root/서비스는 불변이다. 읽기 탐색의 없는 glob os123 1회는 대상 code 실행/수정0이며 이미 확인된 정본 경로로 좁혔다.
- 후속 `ba4f6caf76971d8c3a05dc08a003229a628c46cb` local/private·WSL exact clean actual1 PASS/3449ms/skip0. 서로 다른 양식·첨부·본문 형식의 v5를 명시 선택한 수동 초안→별도 v6 저장·원래 거절 snapshot 보존·v4/v5 원문 유지·미확정/outbox0을 확인했다. 독립 DB13종 각0·임시root[]·지속root uid1000/0700/실경로 일치/link0/empty. 새 SQL/권한/Secret/서비스 변경0이다. 다음은 검토/확정의 명확한 거절과 미확인 구분을 유지한 대상 교체이며 전체 FN03 완료는 아니다.

### 2026-10-16 FN03 보관 후보·제안 목록 재조회/재개 — Main 어울

- 후속 실제 결과: `4997e732f6bebfca92812cc6d7a5680dcbb71664` 지정 private/WSL exact clean actual1 PASS/2712ms/skip0. 동일 Web client로 저장 자료 목록/상세·고정 양식·후보 재개 후 신규 문서/원본 첨부·제안 재개/확인 전 쓰기0→별도 새 v4/replay·v1/v3 보존·미확정/outbox0을 확인했다. 독립 잔여 조회 exit0: users/projects/documents/versions/confirmations/proposals/proposal_selections/imports/import_selections/reviews/artifacts/policies/commands 각0, 시험 root[]·지속 원문 root uid1000/0700/실경로 동일/link0/empty. 실제 runtime/계정/Secret 변경0. 후보·제안 재개 부분은 핵심 동작 확인이며 복합 충돌/소스 연결·전체 FN03/실제 browser DB 여정은 미완료다. 문서 patch 제목 불일치1은 적용 전 거절·원문 변경0→정확 제목으로 보정했고 제품 실패와 분리한다.

- 시작 `bf83b06530028d36c868be6e00333063767abc1b` local/private 동일·지정 branch clean, 현재 WSL 검증코드 d05c3df3·SQL19 유지. 직전 실제 시험 뒤 독립 DB13종 각0·임시root[]·지속root uid1000/0700/link0/empty 확인. 완료된 제안/SQL19·단위/화면 검사는 불변이면 반복하지 않는다.
- 승인 INTERFACES §9.4의 imports/제안 목록·조회와 새 화면 재개의 미완료를 잇는다. 기존 table만 사용하고 새 DB schema/권한/사용자/Secret·서비스 변경0이다. actor/project·유한 페이지/상태/대상 filter·서명 cursor와 exact 저장 원문을 사용한다. QA는 바로 위 제안 작업과 같은 전용 DB/고유 합성 UUID/finally 정확 정리이며 실제 사용자 자료는 만들지 않는다.
- RED `f3dc5fc8d4aa8208329da2e97014c5b4d3d6196e` WSL exact/clean actual1 FAIL/2438ms: 보관 후보 GET 목록404≠200. 새 읽기 helper/경로만 추가했고 SQL19/권한/데이터 계약의 기존 저장 필드는 불변이다. limit기본50/최대200·상태/대상 조건과 actor/프로젝트/목록 종류를 서명 cursor에 결박한다. 목록은 저장 metadata hash만 검사하며 실파일 재검사와 혼동하지 않도록 integrity=NOT_RECHECKED를 반환, 상세 선택 직전 원본 검사는 기존 GET을 소비한다. 타입/diff0이며 최종 actual·화면 연결은 다음 단계다.
- 목록 GREEN `0772de45d8fed307497ec440b02ccecf9211a880` private/WSL exact·clean actual1 PASS/2238ms/skip0. 정상 페이지·상태 필터·cursor 위조/조건 변경/목록 종류 혼용400·타 사용자404를 확인했다. SQL19 불변이며 전체 FN03 완료 판정은 아니다.
- 화면 진입 버튼 부재 RED1을 확인하고 MaterialLibrary·materials-api·고정 양식 조회·기존 proposal-api/DocumentEditor의 저장 자료 재개를 연결했다. Ruling: 기존 저장 완료 제안은 과거 업로드/제안 명령을 합성하지 않고 snapshot=null의 읽기 binding으로 구분한다. 새 반영 명령만 현재 client/control·확인에 결박한다. 잘못되면 과거 명령 이력을 위장할 위험이 있으므로 실제 시험에서 과거 명령0·새 반영1·구버전 보존을 직접 확인한다.
- fresh local 단위61 PASS/1204ms, 타입/build exit0(Web61/JS431.64kB/gzip118.54), 인접 UI06 fixture20 PASS/16.2초. 추가 보관 자료 hash 손상/조회자 재개 거절 포함 fixture5 PASS/4.4초(앞20과 정상3 중복 포함). 조회만으로 제어권 읽기/쓰기0, 명시 후보 준비 후 신규 초안 저장, 제안 별도 반영, 원문 escaped 표시를 확인했다. NO_COLOR/FORCE_COLOR 경고1만 보존했다. 실제 Web client→WSL API/DB/FS의 저장 자료 재개 시험을 추가했고 아직 게시 전이므로 그 결과는 미검증이다. 사용자용 Windows backend는 구버전이며 실제 browser↔DB/인수로 승격하지 않는다.

### 2026-10-16 FN03 수정 제안·서버 차이 비교 연결 착수 — Main 어울

- 직전 goal turn은 실제 code/forward18/검증 증거가 남은 progress다. 시작 `ab085b154efafd3190406eafb33bf241961de8d7` local/private 동일·지정 branch clean, main f976ed5e 불변. 완료된 가져오기/SQL18을 다시 만들지 않고 같은 직접 승인 `call_e9907e2ffeca40bf966c6037d1e9025d`의 수정 제안/선택 계약을 이어간다. 단일 writer Main, inline 계획 실행·TDD, WORK_STATUS를 기존 ledger로 사용한다.
- Ruling: 승인 INTERFACES §9.4의 proposeDocumentChange(baseRef/proposedContent/reason/sourceRefs)→PENDING proposal·서버 diff artifact→사용자 saveDocumentDraft(proposalRef)의 명시 새 버전을 구현한다. diff는 기존 파일 저장의 원본 바이트/해시·프로젝트 quota를 소비하며 서버가 생성한다. 계획이 최소 diff 알고리즘을 요구하지 않으므로 동일 앞/뒤 줄을 제외한 손실 없는 유한 변경 구간으로 비교한다. 잘못 판단하면 비교 표시만 더 길어질 수 있지만 본문 patch/자동 반영/확정은 하지 않는다. sourceRefs/실제 Agent 연결 전에는 []만 허용한다.
- 기존 artifacts의 command당1개 제약은 유지한다. 제안 본문은 명시 업로드한 실제 artifact를 참조하고 제안 명령의 서버 diff1개만 새로 생성한다. 새 forward19로 같은 프로젝트 proposal/선택 FK·명령/receipt/허가/감사와 diff 생성 행위를 결박하며 기존18 SQL을 수정하지 않는다. 새로운 사용자 정책/계정·Secret·서비스·실제 Agent·Oracle 변경0이다.
- QA 자원은 기존 전용 WSL DB `anvil_v3_development`/PG15·Git checkout `/home/daon/deploy/anvil-v3`/보호 app·migrator 설정, 합성 `qa-document-storage-<UUID>` 사용자/프로젝트·`/tmp/anvil-v3-document-qa-<UUID>` uid1000/0700·시험1회 수명·finally 정확 UUID 정리·독립 잔여 확인이다. 지속 artifacts root와 Windows Node/relay/CA는 보존한다.
- RED `e09e97763577b3adc67ca03e6e1d4591c2517413` WSL exact/clean actual1 FAIL/1840ms: 별도 제안 권한403 대신 미연결 연산400. 서버 diff의 BOM/CRLF/빈값/변경 구간은 행동 RED1→GREEN1, unit60/1088ms·타입0·diff0. 새 forward19 `0003_document_proposals` checksum `93cb063a0214f2197afca309ed3d4482a0ea8bac765b9e72f42b110bdb6f542a`는 현재 미적용이며 기존18 수정0. 정상·replay·권한/교차 사용자·stale·제안만으로 본문 변경0·명시 반영/구버전 보존·직접 UPDATE 거절의 actual은 게시 후 확인한다. 현재 화면의 제안 작성/비교/반영은 아직 미연결이다.
- 서버 코드 `9198a9bc8e659f92e0e8345fe4f52f20e6d5a5c9` local/private·WSL exact/clean에서 forward19 적용 exit0/기존18 checksum 불변, actual FN03/FN11 2 PASS/2343ms/skip0. 제안 별도 허가403·위조/오래된 기준409·서버 diff 실파일 hash/바이트·제안 replay/diff1개·현재 원문/head 불변·명시 반영 새v2/구v1 보존·반영 replay·제안 직접 UPDATE42501·outbox0을 확인했다. 별도 DB12종 각0·임시root[]·지속root uid1000/0700/link0/empty·migration19 확인. 원본 파일/DB 실패의 orphan은 기존 보존 정책이며 DB/FS 전체 원자성으로 주장하지 않는다.
- UI 수정 제안 버튼 부재 행동 RED1→기존 편집기 단일 writer/상위 버퍼에 별도 pending upload/propose/apply·base hash/title·후보/비교를 연결했다. 생성/반영 각각의 단절·화면 이동은 같은 command/입력만 재확인, 사용자 차이 확인 전 반영0·직접 저장과 구분한다. 같은 ref/hash의 서버 diff/기준/제안 원문과 첨부·목차 차이를 읽기만 하며 patch/스크립트를 실행하지 않는다. unit61/1176ms·UI06 fixture16/13.8초·type/build0(Web59·JS418.20kB/gzip115.37·CSS7.61kB)·diff0. 전체 actual browser↔DB·후보/제안 목록 재개·소스 연결·복합 충돌/추적은 미완료다. 같은 Web client의 실제 제안/비교/명시 반영은 최종 게시 SHA에서 다음 검증하며 현재 미실행이다. 계획 실행 스킬의 inline 규칙에 따라 추가 per-task reviewer는 만들지 않고 Stage 종료 통합 검수는 남긴다.
- 최종 `d05c3df31f7112f0cd761ea3e771d3830d42b94c` local/private·WSL exact/clean에서 같은 Web client의 실제 prepare→upload/propose/replay→GET diff/기준/제안 본문 hash 대조→선택 없는 반영 거절→명시 반영/replay 새v3→구v1/v2 원문·미확정 유지 actual1 PASS/2756ms/skip0. SQL19 재적용0/불변 FN11 반복0이다. 화면 fixture16과 실제 API/DB/FS는 별도 증거이며 현재 실행 Node/relay·bootstrap/CA·Secret/실제 사용자/서비스 변경0이다. 다음은 같은 FN03의 저장한 후보/제안 목록 재조회·재개와 남은 부분이다. 전체 완료보고나 goal complete로 처리하지 않는다.

### 2026-10-16 FN03 원문 가져오기 후보·선택 연결 착수 — Main 어울

- 시작 `b69c201522fae123b72598380002a1b975feafed` local/private 동일·지정 Stage B tracked clean, main f976ed5e 불변. 이전 확정/충돌 조정·SQL17을 다시 만들지 않는다. 신산님 `call_e9907e2ffeca40bf966c6037d1e9025d` 직접 응답 ‘FN03 가져오기·제안 계약·개발 DB 보완 승인’을 확인했다. 기존 개발 DB의 새 forward로 후보/제안/선택 이력과 현재 권한/감사를 연결할 수 있으며 실제 사용자 정책 부여·원본/기존 SQL 삭제·Secret/서비스/운영 변경은 제외한다.
- 이번 연결은 먼저 UTF-8 텍스트/Markdown의 원본 그대로인 가져오기 후보→원문 확인→명시 새 초안 선택이다. 지원불가/추출 실패도 원본을 유지하고 성공/확정/실행으로 바꾸지 않는다. 수정 제안은 같은 승인 범위의 후속이며 자동 반영하지 않는다.
- QA는 기존 전용 WSL DB `anvil_v3_development`/PG15와 Git checkout `/home/daon/deploy/anvil-v3`, 기존 보호 설정만 소비한다. 합성 사용자/프로젝트 `qa-document-storage-<UUID>`·파일 root `/tmp/anvil-v3-document-qa-<UUID>` uid1000/0700, 수명 시험1회·finally 정확 UUID 정리·독립 잔여0을 확인한다. 지속 artifacts root·Windows Node/relay·CA/bootstrap은 보존한다.
- RED `df7c74591c1cf0d3414f937992bac785b7c43ca1` WSL exact/clean actual FN03 1 FAIL/2639ms: 가져오기 허가 부재403 대신 미연결 연산400. 후보 파서는 모듈 부재 로딩 오류1과 행동 RED2를 구분했다. 화면 시험의 기존 버튼 이름 오기1을 정정한 뒤 실제 파일 입력 부재 RED1을 확인했다. 기존 합격 기준을 낮추지 않았다.
- 새 forward18 `0003_document_imports` SHA256 `e143f10ee61fb78d174070cc1e0e5ab2eb55b8d35f74ec07a4c82f88594dfe57`: immutable 후보·same-project 원본/양식 FK·현재 receipt/권한/제어·명시 초안 선택 이력. 기존17 SQL 수정0. 최초 텍스트 파서는 `UTF8_IDENTITY_1`로 원본 바이트를 그대로 참조하며 별도 추출 파일을 생성한 것처럼 주장하지 않는다. UTF-8 오류/본문 2MiB 초과는 FAILED, 다른 형식은 UNSUPPORTED로 원본만 유지한다. 자동 반영/확정/Agent 실행0이다.
- 로컬 unit58 PASS/skip0, UI06 fixture15 PASS/11.6초(새 가져오기1 포함), type/build exit0·Web58(JS402.91kB/gzip111.94·CSS7.61kB), diff0. UI는 파일 선택만으로 전송0→원본 업로드/후보 명시 생성→단절 시 같은 명령 재확인·알려진 업로드 재생성0→원문 표시/명시 선택→원본 첨부를 보존한 별도 초안 저장을 확인했다. 실제 개발 DB forward18 적용/최종 코드 시험은 게시 후 진행하며 현재 미실행이다. 수정 제안/차이 비교·후보 목록 재개·소스 연계·최신 제품 실제 브라우저 DB 여정은 미완료다.
- 최초 게시 `eae43125`의 forward18 적용1회는 CASE 식 괄호 누락42601/position4148로 전체 rollback됐고 적용 수17/QA 생성0이었다. 별도 rollback-only 검사에서 같은42601을 확인→CASE 괄호 한 쌍만 보완한 SQL 정상/rollback→로컬 변경·게시 순서를 지켰다. 최종18 checksum은 `c9ffa0c09d8597e410a9b85ead5b1aad3413df82e7f6efa2169ad514fa001afb`이며 앞의 e143 값은 미적용 실패본 이력이다. 기존 적용 SQL 변경0/서버 소스 patch0/임의 우회0이다.
- 최종 코드 `6a7a3c262bbd189448a07558066d12f5390f814f` local/private·WSL exact/clean, forward18 적용 exit0·기존17 checksum 불변. actual FN03/FN11 2 PASS/1963ms/skip0. 원본 metadata/실파일 검증·후보 명령 replay1·문서 자동 생성0·외부 사용자404·현재 별도 허가403·원본 참조 누락422·미지원 선택412·직접 candidate UPDATE/가짜 selection42501, 동일 Web client의 후보 생성/GET 재확인→명시 선택→별도 초안 저장/재조회·BOM/CRLF/첨부 원본·미확정 유지·outbox0을 확인했다.
- 시험과 분리한 독립 조회 exit0: users/projects/documents/versions/confirmations/imports/selections/reviews/artifacts/policies/commands 각0, 임시 root[], 지속 artifacts uid1000/0700/link0/realpath 일치/empty. app candidate UPDATE=false/selection DELETE=false. 기존 PG full ID/image 불변, Windows Node40744/relay26052 같은 시작 시각 보존. 추가 실제 계정·Secret/CA·서비스 교체/relay 재접속·Agent/Oracle 변경0. 전체 기능 완료/인수/PR·main 병합으로 승격하지 않는다.
- 요청 코드 검토 스킬에 따른 별도 read-only reviewer는 최초 Critical0/Important2/Minor0: 파일 준비와 저장의 양방향 경합, 확정 거절 뒤 취소 경로 부재를 지적했다. Main이 실제 코드와 맞춰 공유 파일 준비 예약·동일 버퍼 재검사·부모 busy 전파, 확정4xx의 명시 닫기를 보정했다. 후속 동일 근원인 단절→4xx에서 미확인 유실, 재시도 중 이전4xx 표시 잔류는 각각 행동 RED→GREEN으로 좁혀 uncertain 보존/같은 단계 정상 receipt 때만 해소·재시도 시작 failure=null로 보정했다. 같은 reviewer가 지정 지적의 잔여0을 확인했다. 전체 Stage 독립 검수/병합 적합성 판정은 아니다.
- 최종 `73373f08ac5306e12c5f87fa84226ebd636abfb2` actual FN03 1 PASS/2443ms/skip0; 새 migration 재실행0/불변 FN11 반복0. Windows unit59/1051ms·UI06 fixture15/11.4초, 마지막 한 줄 재시도 보정 뒤 해당 집중1/3.3초·type/build0(Web58·JS404.34kB/gzip112.32·CSS7.61kB)·diff0. 최종 시험 뒤 독립 DB11종 각0·임시root[]·지속원문 uid1000/0700/link0/empty·migration18, private main f976ed5e 불변이다. 이전 검증 코드를 기능상 되돌릴 필요가 생기면 Git의 검증 checkpoint를 선택해 재검증하되 이번 실행에서 runtime 전환/DB downgrade/원본 삭제는 하지 않았다. 다음은 같은 승인 범위의 수정 제안/서버 diff·명시 반영과 후보 목록 재개다.

### 2026-10-16 FN03 별도 문서 확정 착수 — Main 어울

- 시작 `ea2041e881be5f21a56fa17accf8cbd1eda6452a` local/private 동일·지정 Stage B tracked clean. 승인된 FN11/FN03 forward 보완 범위에서 confirmDocument를 검토 저장과 별도 처리한다. 필수 본문/RECORDS 필드·정확 최신 ACCEPTED 검토·양식 준비·현재 제어/명시 권한·원문을 검사하고 확정 이력을 보존한다. 새 초안은 기존 확정 포인터/구버전을 지우지 않는다.
- 실행 자원: 기존 전용 WSL `anvil_v3_development`/PG15, Git checkout `/home/daon/deploy/anvil-v3`, 보호된 app/migrator 설정만 사용. 기존 합성 `qa-document-storage-<UUID>` 사용자/프로젝트·`/tmp/anvil-v3-document-qa-<UUID>` uid1000/0700·수명 시험1회·finally 정확 UUID 정리를 재사용한다. 지속 artifacts root·실제 사용자·Secret·서비스·CA/relay는 변경하지 않는다. 최종 exact SHA만 시험하고 미수행은 PASS로 세지 않는다.
- 현재 형식 검사와 SQL16은 그대로 이력이며 새 확정 기능의 완료 근거가 아니다. RED는 검토 허가만으로 확정을 요청하면403이어야 하나 현재 미연결 연산400인 경계를 먼저 확인한다.
- RED exact `01bdf487a78c0451569b6767e9b331515f8a7f49` actual1 FAIL/838ms(400≠403), 정리 finally 수행. 형식 검사 첫 시험은 모듈 부재의 로딩 오류1로 분리하고 현재 목차 수준 검사에서 본문/필드/코드 속 표의 행동 RED3을 확인한 뒤 강화했다. 후속 unit51 PASS·타입 시험 자료의 추론 누락1회(4진단)는 명시 타입으로 보정, build/타입0·Web53·diff0.
- 새 forward17 `0003_document_confirmations` SHA256 `58ebdd39cddb67cbbf4fa2f21bea42848dfa7e0851297bd7592f8b3ce36e9fd5`는 확정 불변 이력과 현재 command/receipt/policy/control·OWNER/최신 ACCEPTED를 결박한다. 기존16 SQL·version/link/draft-event guard는 유지하고 head만 별도 확정/개정 보존으로 분리한다. Markdown/텍스트 본문의 필수 범위와 반복 표(필드 ID/명칭·필수 셀·행)를 확인하되 사실/내용 검수 합격을 자동 선언하지 않는다. 미완성 초안 저장은 계속 허용한다.
- `a149119af41ec0d3b1cdc9602be3c7e5a52253bf` local/private·WSL exact/clean에서 forward17 적용 exit0·기존16 checksum 불변, actual FN03 1 PASS/1311ms/skip0. 별도 권한403/형식·검토 누락422/위조와 최신 재작업/옛 버전 차단·확정/replay·새 초안 뒤 구확정 유지·직접 pointer 쓰기42501·확정 이력1/실행 outbox0을 확인했다.
- UI 확정 준비 버튼 부재 RED1→App 상위 대상/검토/명령 버퍼·별도 확인 checkbox·명시 confirmDocument 클라이언트 연결. 단절/화면 이동 동일 명령, 최신 REWORK/형식 누락 차단, 인증 만료 뒤 다른 사용자 숨김/자동 전송0까지 UI06 fixture13 PASS/10.1초. 사용자 양식의 선택 항목을 필수로 취급하는 RED1은 비어 있는 선택 범위를 허용하도록 좁게 보정, 최종 unit54/타입·build0·Web55(JS388.81kB/gzip108.52·CSS7.61kB)/diff0. 실제 화면 DB 통합/전체 인수는 아직 미검증이다.
- 변경 파일: server document-validation/project-confirmation/project-documents·projects routes, 새 SQL17/migration runner, App·DocumentsPage·DocumentConfirmation/confirmation-api와 관련 unit/browser/FN03 actual. 새 UI 클라이언트의 실제 API/DB 시험은 후속 exact 게시본에서 실행하며, 새 schema/서비스 재생성·인증자료 갱신은 반복하지 않는다.
- `3ea44e32c28f66f6732c5229326cd9023136d0cb` local/private/WSL exact clean에서 같은 확정 클라이언트와 인접 FN11 실제2 PASS/1684ms/skip0. 별도 확인 전 요청 거절, 새 UI payload/ref/receipt·latest review·확정/replay·과거 보존을 확인했다. 독립 users/projects/documents/versions/confirmations/reviews/artifacts/policies0, migrations17/동일 checksum, 임시 root[]·지속 root uid1000/0700/link0/empty. 실제 browser↔DB는 별도 미검증이다.
- 이어서 명확한 save VERSION_CONFLICT409만 최신본과 비교하는 UI06 후속에 착수했다. 입력/이전 명령을 보존한 채 현재 제어·최대4페이지/200건 목록→정확 최신 버전/원문을 읽는다. 양식/첨부/원문 형식·연결 자료가 다르면 채택을 막고, 사용자의 별도 선택 후에만 내 제목/본문/위치로 새 기준 초안을 준비한다. 자동 합치기·저장·미확인 요청 우회0, 기존 실패 upload 원본/서버 구버전 보존. 비교 조정 메타는 탭 버퍼이며 FN04의 영구 추적 기능을 대신하지 않는다.
- 충돌 비교 버튼 부재 RED1→선택 뒤 별도 저장 GREEN1, unknown/다른 주체/제어 충돌과 유한 조회 단위2 추가. 현재 unit56/타입·Web56(JS392.98kB/gzip109.59)·UI06 fixture14 PASS, 최종 실제 클라이언트의 충돌 조정은 후속 exact 게시본에서 시험한다. 검토/확정 요청 자체의 버전 교체·양식/첨부 동시 변경 수동 합치기는 아직 미구현으로 분리한다.
- 최종 코드 `3f4601b8a39839240aa94884d898ead1ef8d0168` local/private 동일·WSL exact clean, 동일 클라이언트 FN03와 직접 인접 FN11 actual2 PASS/1714ms/skip0. 실제 stale1 저장409→최신2/양쪽 원문 읽기→명시 선택→새3 저장, 서버2 본문/구확정1 그대로·outbox0을 확인했다. 최종 표시 문구 정리 뒤 build/타입0·Web56(JS393.07kB/gzip109.63)·충돌 fixture1/2.7초 PASS, 앞선 전체 UI06 fixture14/10.8초·unit56과 구별한다.
- 독립 최종 조회: users/projects/documents/document_versions/document_confirmations/content_reviews/artifacts/permission_policies 각0, migrations17·원문 root uid1000/0700/link0/realpath 일치/empty, 시험 root[]다. Windows Node40744(2026-10-16 05:25:42)·relay26052(2026-10-15 21:28:17) 같은 PID/시작 시각을 읽기 확인, 서비스 교체/재접속·bootstrap/CA 변경0. 이전16 SQL/적용17 checksum 불변, private main f976ed5e 불변·Stage B branch-only·PR/merge0이다.
- 인계/rollback: 확정 전 검증 코드 ea2041e에서 기능 코드를 되돌릴 수 있지만 이미 적용한 SQL17/원본·확정 이력은 자동 downgrade/삭제하지 않는다. 인수/배포 주장은 없고 전체44 [0]3/[2]9/[]32를 유지한다. 다음은 FN03 가져오기/제안과 FN04/FN05·미연결 UI/실제 여정이며 기존 정상 기능·완료 작업은 반복하지 않는다.

### 2026-10-16 UI06 고정 버전의 내용 검토 작성·저장 연결 — Main 어울

- 시작 `5abfbeeb276b50cc4d0179aea3be55b2040b9f8b` local/private 동일·Stage B tracked clean. 기존 SQL16/검토 서버 API·문서 저장을 다시 만들지 않고 recordContentReview의 사람 입력 화면과 동일 클라이언트를 연결한다. 새 DB/계정/Secret/서비스 변경0이다.
- 변경: App 상위 검토 버퍼, DocumentReviewEditor/review-api, DocumentsPage와 unit/browser/actual FN03 시험. 양식의 실제 기준별 판단·근거와 종합 판단을 명시 저장하고 원문 버전/hash·현재 제어·명령/CSRF·응답 ref를 대조한다. 일부 재작업의 종합 ACCEPTED 거절, 검토는 확정/시험 합격/Agent 실행 아님을 유지한다.
- TDD: 작성 버튼 부재 RED1→작성/저장 GREEN3. 앞서 열린 초안 편집기가 검토 중에도 남는 RED1→원인인 독립 렌더 조건을 검토 작성기와 배타적으로 분리, 입력 자체는 보존했다. 단절/409의 동일 명령 재확인, 화면 이동 입력 보존, 인증 만료 뒤 다른 사용자 숨김/자동 요청0, 동시 편집 방지까지 UI06 전체10 PASS/7.8초.
- Windows `npm run build`/타입 exit0·Web53(JS381.19kB/gzip107.36·CSS7.61kB/gzip2.25), `npm test`48 PASS/skip0, diff check0. NO_COLOR/FORCE_COLOR 환경 경고 보존. 브라우저 시험은 모든 API 차단/대체 fixture이며 실제 DB 여정이 아니다. 같은 클라이언트 actual API/DB 후속 시험은 이 checkpoint 게시 뒤 실행하고 실제 결과를 추가한다.
- `254d84d70f1ce55bdb4e7c6875b3bac3bed7a266` local/private 동일·WSL exact/clean actual FN03 1 PASS/880ms/skip0. 같은 검토 클라이언트의 실제 HUMAN/현재 정책/제어→검토 저장/replay→DB 기록1/재조회·동일 작성자·confirmed=false·outbox0을 확인했다. 후속 화면 진입 점검에서 검토 중 편집 진입 버튼만 살아 있는 RED1을 좁게 보정해, 검토 작성기 종료 전 신규/개정 편집 진입도 차단한다. 최종 Windows build/타입0·unit48·UI06 fixture10/8.6초 PASS, Web53(JS381.22kB/gzip107.37), diff0. 이전 실패는 이력으로 보존한다.
- 최종 코드 `6ca25abf30f4595d37aebd9fc8d2c62fac14c387` local/private 동일·tracked clean/WSL exact clean의 actual1 PASS/860ms/skip0. 독립 읽기에서 users/projects/documents/document_versions/content_reviews/artifacts/permission_policies=각0, migrations16, 임시 시험 root[]·지속 원문 root uid1000/0700/link0/정확 realpath/empty를 확인했다. WSL 서비스·Windows Node40744/relay26052/만료 bootstrap·CA·기존 데이터는 변경하지 않았다.
- 확정 후속 읽기 대조: 현재 save 검사는 필수 item의 line anchor 존재 여부까지만 확인한다. 이 값을 실제 필수 본문/RECORDS 필드 내용 합격으로 승격하지 않는다. 기존 draft guard는 confirmed pointer가 있으면 후속 초안도 거절하는 구조라, 별도 확정과 이후 개정 보존은 승인 범위의 새 forward migration·정확 검토/권한 guard·음성 시험으로 연결해야 한다. 미구현 confirm route를 미리 성공 처리하지 않는다.
- 미완료: 별도 confirmDocument, 형식/필수 본문의 엄격 확정 검사, 버전 충돌 비교/새 기준 조정, 실제 browser↔DB·FN04/FN05. 전체44와 UI06/FN03 부분 구현 상태는 유지한다. rollback은 앞선 게시본 5abfbeeb이며 기존 원본/SQL/서비스를 변경하지 않았다.

### 2026-10-16 UI06 문서 편집·새 초안 버전 저장 착수 — Main 어울

- 시작 local/private `1c326deaf62051a90aa1b76b9f751bf18ed07fd0`/지정 Stage B·tracked clean, private main f976ed5e 불변. 완료된 원문/버전·검토·정책/SQL16은 다시 구현하거나 migration을 반복하지 않는다.
- 기존 승인 UI06/FN03 계약 안에서 제목/본문/원문 항목 위치·변경 이유 편집→원문 새 artifact→동일 document 새 불변 버전 저장을 연결한다. 사용자/프로젝트별 입력을 탭 상위 상태로 보존하고 응답 단절 때 같은 upload/save command만 명시 재확인한다. 형식 검사를 내용검토/사용자 확정으로 바꾸지 않는다.
- 사전 대조: FN11 현재 owner/client/controlGeneration·명시 uploadArtifact/saveDocumentDraft 정책을 서버가 다시 집행한다. 화면에서 정책/권한을 자동 생성하지 않으며 실제 계정·Secret·CA·서비스/relay·Agent 변경0. 기존 Windows relay HOLD/새 실제 화면 DB 미확인은 유지하고 우선 API 대체 화면 시험, 게시 exact SHA의 WSL 직접 실제 API/DB로 연결을 확인한다.
- RED/GREEN 대상은 화면 이동/실패/충돌 입력 보존·같은 명령/원문 바이트·정확 version/receipt·same-origin·별도 사용자 비노출이다. 기존 시험 root/합성 UUID 계약으로 시험 후 정확 정리, 새 지속 자원 없음. 다음의 검사 통과 전에는 편집 연결을 완료라 기록하지 않는다.
- 첫 구현 `2b98b720a3e5311b026cfc98a42a4f6d09b315b4` 게시 후 WSL exact actual FN03 1 PASS/1113ms/skip0. UI와 같은 클라이언트의 원문 바이트·canonical hash·현재 제어/명시 정책→새 버전3→재조회/같은 저장 replay/원본 v2 BOM·CRLF 유지·artifact 추가1을 실제 API/DB로 확인했다. Windows 단위45/타입·Web50·UI06 fixture5 PASS는 별도다. 실제 브라우저↔DB 여정으로 승격하지 않는다.
- 빈 프로젝트의 신규 작성은 기존 승인 공식 양식 선택→정확 버전/작성 기준 조회→빈 입력→명시 upload/save(target null/expected0)로 연결한다. 예시 본문 자동 삽입/자동 저장·확정/권한 부여0. 신규 화면 RED1(작성 버튼 없음)·label 안 select 옵션 문자열 혼입 실패1→명시 label 연결 뒤 GREEN1, 최신 전체 UI06 결과는 후속 기록한다. 새 server contract/schema/역할·지속 자원 변경0이다.
- 최종 게시 코드 `05da735cf241f09376b094819ea5e6b003183bd7`의 actual1 PASS/1024ms/skip0. 기존 일반 텍스트의 편집이 Markdown으로 암묵 변경되는 단위 RED1을 확인해 원래 mediaType을 보존했고 새 문서는 명시 Markdown 초안이다. actual 시험에서 두 형식/새v1·개정v3/물리 원문·정확 hash/같은 명령·구버전을 확인했다. 현재 연결은 화면과 같은 저장 클라이언트의 API/DB 시험이며 실제 browser↔DB 통합이라고 주장하지 않는다.
- 최종 Windows `npm run build`/타입 exit0, Web51(JS371.33kB/gzip105.67·CSS7.61kB/gzip2.25), `npm test`46 PASS/skip0, `npx playwright test tests/browser/UI06`6 PASS/5.0초, diff check0. NO_COLOR/FORCE_COLOR 환경 경고는 보존. 기존 UI/회귀의 기대값을 낮추지 않았고 새 코드·경계에 필요한 시험만 수행했다.
- 독립 SSH 읽기 exit0: WSL HEAD05da735c/clean·users/projects/documents/document_versions/content_reviews/artifacts/permission_policies 각각0·migration16 불변·QA 임시 root0. 지속 원문 root daon1000/0700/link0/entries0 보존. Node40744 시작UTC2026-10-15T20:25:42.3705853Z·relay26052 시작UTC2026-10-15T12:28:17.5262971Z와 private main f976ed5e 불변. 인증서/키/초기 비밀·실제 사용자·서비스 교체·Agent/Oracle 변경0.
- Ruling: 편집 버퍼는 브라우저 탭의 App 상위 상태에 사용자/프로젝트를 결박해 보존하고 localStorage에 원문/비밀을 자동 기록하지 않는다. 원문 업로드·문서 저장은 분리된 두 명령이며 각 receipt와 hash를 확인하고 확인된 업로드는 저장 retry 때 반복하지 않는다. 화면 이탈/인증 소실 뒤 자동 후속 저장은 막고 같은 명령만 명시 확인한다. 잘못되면 보존된 입력/정확 명령과 원본을 대조해 복구하며 자동 reset/덮기/정리는 하지 않는다.
- 남은 실제 기능: 별도 내용검토 작성/확정·필드/반복 RECORDS 세부 구조 검사·시안/제안/소스/추적, 충돌 난 입력의 현재 버전 비교/새 기준 채택은 아직 미연결이다. 현재 충돌은 기존 입력과 명령을 보존하고 재전송해도 새 명령/자동 덮기를 만들지 않으며, 이를 충돌 해소 완료로 포장하지 않는다. 실제 UI DB 경계는 이전 relay3회 실패 HOLD/만료 bootstrap/old backend 그대로이므로 새 사용자용 URL 준비나 Stage B 완료를 주장하지 않는다.
- 오류/원인: 기존 본문 textarea의 중첩 label에 원문 텍스트가 섞여 label 조회0/실제 textbox1임을 합성 DOM으로 확인했다. 명시 label/htmlFor로 분리해 같은 기대값 GREEN, 원래 실패 기록을 덮지 않았다. 중단 경계 단위 RED1은 업로드1≠0→쓰기 시작 전 active 확인을 추가, 이후 파일 수거 뒤 JSON 후속 저장 전에도 다시 확인한다. 자동 timeout 연장·새 정책/서비스 우회0.

### 2026-10-16 FN03 고정 양식의 사람 내용검토 기록·조회 — Main 어울

- RED `aecf675c92eb20edefc0b35053db6f87bf040166` actual400≠403 후 `7a7841a12c6f20f7c4a991be0d34be8d469eae54` actual FN03/FN11/인접 공통 METHOD3 PASS/1200ms/skip0. 새 forward16 `0003_project_document_reviews` SHA256 `f1ba53b79b95a02867822743748ead6f6dafff039a506651a26368d7b922de75`, 기존15개 불변. 이전 PROJECT 거절을 없애지 않고 DRAFT trigger 대상만 DRAFT로 명시한 뒤 PROJECT DOCUMENT 전용 guard를 추가했다.
- 명시 policy의 recordContentReview가 없으면403, 현재 owner/client/control·문서 head/hash·물리 원문을 다시 대조한다. 항목/기준은 문서에 고정된 form exact version/hash와 itemId/reviewCriteria에서 생성·snapshot으로 보존한다. 항목별 판정·이유 누락/중복·위조 hash/옛 버전·보완 항목이 남은 ACCEPTED를 거절, evidence 연결 전 비어 있지 않은 참조는412다. 실제 reviewer는 세션의 HUMAN이고 같은 작성자임을 공개한다. Agent REVIEW 위장·실행·자동 확정0.
- 내용 검토/command/receipt/audit를 한 transaction으로 append하며 같은 명령은 현재 권한 확인 후 같은 ref로 재조회한다. 기록 후 confirmed=false·불변 문서 버전/hash 유지. sourceKind/작성자 동일 여부/판정/이유·서버 감사 순서를 GET에 제공한다. 검토자가 ACCEPTED라고 적는 것과 자동 형식 검증/사용자 별도 확정·실제 시험 합격은 다른 상태다.
- UI06 검토 이력 조회 RED1(보완 판단 미표시)→현재 소스의 fixture2 PASS/2.4초, unit43/타입/Web48 PASS(JS354.91kB/gzip101.53·CSS7.61kB). 실제 원문 텍스트/위조 바이트 차단·같은 작성자 경고·구버전도 유지한다. 화면 검토 작성·편집/확정은 미연결, 새 실제 browser↔DB와 전체 제품 인수는 미검증이다.
- Ruling: 검토 기준은 임의 공통 5항목이 아니라 고정 양식의 실제 항목/검토규칙을 사용한다. 현재 HUMAN/본인 프로젝트·명시 자료 정책 범위만 지원하며 다른 검토 역할/Agent·근거 참조·확정 연산은 후속 연결 전 성공으로 처리하지 않는다. 잘못되면 기존 검토 snapshot을 보존한 새 기준/새 검토로 교정하며 과거 판단을 덮지 않는다.
- 다음 미완료: 문서 별도 확정 조건·UI06 편집/저장/검토 작성, FN04/FN05. 전체44의 상태는 [0]3/[2]9/[]32 그대로이고 완료 업무를 다시 실행하지 않는다.
- 최종 독립 조회 exit0: WSL HEAD `7a7841a12c6f20f7c4a991be0d34be8d469eae54`/tracked clean, users/projects/documents/document_versions/content_reviews/artifacts/permission_policies 각각0·migration16·QA 임시 root0. 지속 artifact root 실경로/uid1000/0700/link0/entries0. private main `f976ed5e29e14b13e12729d5b1ccf98f050f2210` 불변, Node40744 시작UTC2026-10-15T20:25:42.3705853Z·relay26052 시작UTC2026-10-15T12:28:17.5262971Z 동일. 공식6문서는 이전 소유 baseline d7ad35cc hash와 모두 일치하여 제 변경만 동기화한다. PR/main 병합·실제 Agent/서비스·Secret 변경0.

### 2026-10-16 FN03 원문·불변 버전·UI06 안전 조회 연결 — Main 어울

- 승인된 저장 위치는 생성 직전 parent/target 부재·realpath/link/owner를 대조한 뒤 신규 root만 생성했다. 실제 `/home/daon/.local/share/anvil-v3-development/artifacts` daon(uid1000)·0700·link0·entries0. 지속 개발 root는 보존하며 실제 서비스의 환경변수/설정·재시작은 수행하지 않았다.
- RED→GREEN: `f9d4af50` 파일 시험 실패 후 `6119b80f` actual 파일/정책2 PASS; `fc039be7` 문서 쓰기400≠403 후 `0583ee89cabfb4fa278e18bb878cb6c9300feb62` actual2 PASS/skip0. 원문 BOM/CRLF/공백·스크립트 문자열 바이트/hash 유지, READY 재조회, 타 사용자404·파일 누락503·명시 연산 분리·stale409·동일 명령 재조회·v2 이후 v1 제목/원본 불변을 확인했다.
- 새 forward `0003_project_artifacts` SHA256 `78a0457fda6c394605ca46a7b6aec761aec6de0a84f47450b9cda326dac9ccd8`, `0003_project_documents` SHA256 `748e8f07ffa2b1093e1141504e8a5134332518a9bf56ec04584e59e84e7a4292`. 정책13을 포함 총15개, 과거 SQL/기대값 변경0. 문서/원문은 현재 PROJECT 자료만, actual Agent/outbox0.
- UI06 RED `0eb52f643ede4115ca27d2ea52ffbf107ffe3794`: actual 목록404≠200·fixture 화면 미연결2 실패. GREEN `dc42b29c4d24d24dc4f6f8f1737ac289023ae09c`: WSL actual FN03/FN11 2 PASS/1041ms/skip0, 목록 keyset/끝/변조·소유 격리 포함. Windows 타입/Web48(JS352.50kB/gzip101.03·CSS7.61kB)/unit43·UI06 fixture2/2.4초·diff check0. NO_COLOR/FORCE_COLOR 경고는 환경 경고이며 제품 실패나 미검증을 PASS로 바꾸지 않는다.
- 독립 읽기 조회 exit0: 프로젝트/문서/버전/artifact/정책0·해당 합성 사용자0·QA 임시 root0·migration15, 지속 root0700/uid1000/empty. finally로 각 test 소유 UUID의 자료만 정리했으며 기존 서비스·DB/volume/network·Secret·CA·relay는 유지했다.
- Ruling: 저장 원문은 `staging/<projectId>/<artifactId>/body`→`blobs/<projectId>/<artifactId>`로 정확 프로젝트별 분리하고 임의 경로/전역 hash 접근을 거절한다. 파일 성공 뒤 DB 실패의 미참조 파일은 복구 대상으로 보존하며 자동 GC/완전 원자성을 주장하지 않는다. 그 중간 장애 복구·더 넓은 형식 파서는 아직 미검증/미구현이다. 잘못되면 원문을 보존한 후 참조 대조·정확 승인 정리한다.
- Ruling: 현재 문서 본문은 UTF-8 Markdown/텍스트≤2MiB만 초안으로 저장하고 null 단계/import·빈 sourceRefs만 허용한다. 지원 연결 전 참조는412이며 파일 업로드를 import/내용검토/확정으로 승격하지 않는다. UI는 HTML 렌더 대신 escaped 원문과 형식 문제/이력·버전을 표시하고 크기/hash 불일치 시 표시하지 않는다. 상세 편집/확정·추적 화면이 남은 partial이며 축소 완료가 아니다.
- 오류: 새 UI06 시험 디렉터리 부재/쓰기 제한으로 파일 추가1회 실패(기존 시험13줄은 적용됨)→실제 diff 확인·승인 내부 폴더만 준비 후 추가. App 긴 행 불일치 patch1회는 변경0 확인 후 정확 행 적용. 기준/권한 우회 없음. Windows DB relay3회 실패 HOLD·기존 Node backend000d0088/새 Web 혼재·초기 등록 비밀 만료는 유지하고 실제 새 UI DB 여정·실제 사용자 인수는 미확인이다.
- 다음: 문서 내용검토/별도 확정과 UI06 편집·저장, FN04 추적/FN05 지식을 승인 계획 순으로 진행. 총44업무의 완료는 추가하지 않으며 UI06 착수로 [2]9/[]32다.

### 2026-10-16 FN11·FN03 프로젝트 정책·문서 저장 보완 착수

- 정책 실제 결과: `447c1a02b9b2f245eb5431ca046d5c348a76058b`의 GET 정책404≠200 RED 후 `24e41a99df900a268332ddb87bff45c069f98a3e`에서 새 `0011_project_policy_control`만 적용, SHA256 `e186f87e8ba04548d5559900f5afabd9aead16b61808b066b868eaa6ea669020`/총13개·기존12개 불변. 타입/단위43 PASS. 최초 생성 인접 actual1 PASS지만 정책 시험 finally가 policy_current_version ON DELETE RESTRICT 순환 FK23503으로 실패했으므로 그 실행을 전체 PASS로 세지 않는다.
- 오류 원인/복구: RESTRICT는 DEFERRABLE여도 삭제를 즉시 검사한다. QA 전용 transaction 안에서만 삭제할 policy head를 다음 미존재 버전으로 잠시 옮겨 순환을 끊고 버전→정책→명령/receipt→나머지를 역순 삭제하도록 시험 정리2줄을 보정했다. 읽기로 검증한 합성 사용자 `3029e2e4-4a71-4601-a198-0dc484c2e5b0`/`563b9ee4-dde8-4ff4-a5ae-93f26007df55`, 프로젝트 `50c6df17-f9cd-4790-ac0e-5a9d98a00180`/`c30df727-7347-4f96-af9e-66264b1e5f25`만 exact 회수·잔여 사용자0/프로젝트0. 실제 사용자/정책·제품 FK/기준은 수정하지 않았다. 같은 정리 실패1회이며 원래 오류도 보존한다.
- 보정 게시본 `1b7783b0db2f2efed62748e969abd3d86e75c09e`의 실제 정책1 PASS/443ms/skip0: 조회 정책 자동생성0·OWNER/현재 client·세대·최근 재인증·위조 actor/타 프로젝트/실행 연산 차단, 동일 명령 재조회·본문 충돌·불변 버전·별도 DENIED 감사·옛 세대 replay 거절·outbox0·exact finally 정리. 전체 FN11/일회 승인 소비/문서 쓰기/사용자 인수는 아직 미완료다.
- 신산님 저장 위치 직접 응답 `call_17862fa527e34a4e80e94d89f70795cc`: **‘해당 신규 보관 위치 승인’**. WSL 신규 `/home/daon/.local/share/anvil-v3-development/artifacts`만 daon 소유0700으로 생성한다. staging/프로젝트별 blobs·원문 바이트/hash/불변 버전 보존, 자동 삭제/외부 반출0, 기존 폴더·계정·Secret·인증서·서비스 변경0. 생성 직전 parent realpath/owner/0700·target 부재/link0을 재확인하고 새 폴더의 owner/mode·빈 상태를 확인한다. 합성 파일 시험은 `/tmp/anvil-v3-document-qa-<난수 UUID>`의 새 전용0700 root, 같은 test 소유 UUID의 DB/파일만 finally 정확 정리한다. 지속 개발 보관 root는 삭제하지 않는다.
- 신산님 직접 응답 `call_2d1f4f3f38a445e2afcadeacc8bab034`: **‘FN11·FN03 계약·개발 DB 보완 승인’**. 기존 `anvil_v3_development`의 프로젝트 문서 원본/불변 버전/내용검토·확정과 명시적 프로젝트 권한 정책/명령·허가·감사를 새 forward migration으로 연결한다. 현재 인증·소유·단일 client 제어 세대·정확 버전/명시 허가를 검사하며 정책 없으면 거절한다. 실제 사용자에게 정책 자동 부여0, 기존 SQL·타 사용자/프로젝트·계정·Secret·인증서·서비스·실제 Agent·운영/Oracle 변경0이다. 직전 DRAFT 승인을 넓혀 해석하지 않고 별도로 받은 직접 승인이다.
- 담당 Main 어울/단일 writer, 시작 `d7ad35cc663ad49a3be1dc83c3718854b37778ea`/지정 Stage B. 우선 FN11의 현재 owner/client/세대 gate·사람의 명시 자료용 정책 저장/불변 개정·기본 DENY·권한 확인 후 같은 command 재조회·명령/receipt/허용·거절 감사의 정상/음성부터 연결한다. Agent 실행·비용·외부 환경 변경을 자료 정책에 끼워 넣지 않는다. 이후 FN03 본문 원본/양식/버전 저장→검토·확정→UI06 순이다.
- Ruling: 최초 정책 관리는 현재 프로젝트 OWNER·활성 client/control 세대·최근 재인증5분의 사람 명령만 허용하며 정책 미설정을 자동 AUTO로 채우지 않는다. 최초 연결은 명시 HUMAN·해당 프로젝트 자료 연산만 수용하고 Agent/실행·다른 프로젝트/사용자·검증 없는 limit/evidence 참조는 거절한다. 검토/한도/일회 승인·실제 실행 범위는 후속 gate로 남긴다. 이 좁은 실제 지원 범위를 전체 FN11 완료로 세지 않으며 잘못되면 명시 정책 새 버전으로 교정하고 옛 감사/버전은 보존한다.
- QA 사전등록: 기존 전용 개발 DB의 `qa-project-policy-<난수 UUID>` 합성 사용자/2 client·로그인/재인증 세션/정확 QA 프로젝트·정책/명령/receipt/감사만, Main 소유·각 test try/finally 수명. 이번 고유 UUID로 소유/참조를 대조한 migrator 역순 정리·독립 잔여 조회, 기존 DB/서비스/포트·실제 사용자/Secret 보존. 파일 원본 저장의 보호 위치/수명·정리는 구현 전 별도로 등록한다. 실제 도구 호출0.

### 2026-10-16 FN01·FN02 생성 초안 검토/확정·최초 프로젝트 생성 재개

- 게시/실측: `b93e4b0695e5b6ea7b7e245bbab4a6efac06d4ba`에서 최초 생성 route404≠403 RED→`c32d218960c8e424b06ed422ecc6fdc2143fcbdc` fixed reference 원자 생성 actual1 PASS/504ms. `00cca14e77794a1ae9dfc1a80ef805ee38ade5a4`의 DRAFT commands404≠200 RED→`04a0b2500c7b476baac3eba42fb8a283933fbe1d` 생성/공통 method·form 검토 actual3 PASS/skip0. 마지막 `ef88dfd965cedc97ee42e0545d0a79f40009b2c8`/WSL tracked clean에서 `node --test tests/integration/FN01/{draft-create,draft-storage,project-read}.test.ts tests/integration/FN02/method-review.test.ts` actual4 PASS/skip0/2.10초. 최종 GET 새 연결·동시 동일 요청1회·다른 command409·다른 사용자404/client403·CSRF403·빈 목적422·stale/미확정/위조/최신 REWORK·변경 후 옛 확정 미승계·append 보호42501을 확인했다. 실제 PG 감사 쓰기 오류를 좁게 주입해503 및 프로젝트/소유/제어/snapshot/명령/receipt rollback·초안 보존을 실제 DB로 확인했다. 제품 실패가 아니라 의도한 실패 조건 시험이며 실제 Agent/outbox0이다.
- 새 forward SQL: `0011_project_creation` SHA256 `0ad0e1e9d429afe65014492d1cb07e629df56c081d3643233c3f32ba5ff3fb95`, `0011_draft_method_reviews` SHA256 `a7aad194c8dff3a29ec502f1e94b0e4728bb5c087aba02390f11a75c3765efaf`. migrator transaction/checksum/명시 DAG로12개, 기존10개 불변. 첫 생성에서만 app snapshot INSERT·PROJECT 원본1을 허용하고 현재 인증 actor/초안 owner/client·초기 OWNER/control1/APPLIED command/receipt를 guard에서 재대조한다. SYSTEM/공통 원본/과거 version 덮어쓰기나 실행 정책/일회 승인 생성은 하지 않는다.
- UI 실제 조작 fixture: 신규 검토 버튼 없음 RED1→사람5항목/이유·별도 확정→명시 생성 GREEN2. 단절 시 같은 명령만 재확인/원본 입력 보존·준비 필요·Agent 실행0을 검수했다. UI02/03 인접23 PASS/18.3초, 마지막 helper 대상/연산 사전 차단 RED→GREEN1 뒤 unit43/skip0·타입·Web46(JS344.96kB/gzip98.72)·신규 핵심2 PASS/4.1초. 합성 UI이며 actual UI DB·사용자 인수 PASS가 아니다. 현재 Node40744는 원래 backend000d0088/시작 KST05:25:42, relay26052 그대로이며 실제 사용자0·bootstrap 만료/재생성0·CA 불변.
- Ruling: reviewRefs를 사용자 graph 입력에 자동 끼워 넣어 draft version을 바꾸지 않고 별도 DRAFT 검토/확정 metadata로 조회한다. ref는 draftId/version/graphHash이며 명시 명령만 저장한다. 초안 저장이 버전을 올리면 옛 검토·확정을 승계하지 않는다. 잘못되면 향후 explicit 버전 변환 비용이 있지만 기존 이력은 append 보존한다. 기존 ‘생성 미연결 항상 disabled’ UI 기대는 승인된 기능 연결로 대체해 저장된 고정 선택에서만 enabled·미저장 수정 즉시 disabled·자동 생성0을 함께 검사했다. 이는 보안/중복/형식 기준 완화가 아니다.
- 오류/정리: 테스트 helper unknown payload 타입 오류1은 publication 전에 Record 타입으로 보정했고, 2개의 패치는 문맥 검증 거절로 반영0/원문 손상0 후 실제 문맥에 맞춰 적용했다. 계획상 미생성 `contracts/projects.schema.json`·`content-review.schema.json` 읽기 실패는 구현 미생성을 확인한 것으로 실제 route의 strict schema/상세 계약과 구분한다. 독립 WSL 조회에서 creation_qa_users0/draft_reviews0/draft_confirmations0/projects0/applied_migrations12를 확인했다. 다른 사용자/DB/서비스 정리0. 일반 Stage B 진행이며 전체44 [0]3/[2]8/[]33, 신규 Stage 인수·PR/merge0이다.
- 신산님 직접 ‘승인해 계속하자’는 앞선 정확 승인 요청의 DRAFT/PROJECT 개발 DB 보완에 적용한다. 기존 v3 개발 DB에 forward migration으로 본인 초안의 검토/확정과 최초 프로젝트/소유 참여/단일 client 제어/고정 방법론 snapshot/명령/receipt·감사를 원자 결박한다. 기존 적용10 SQL과 다른 사용자·프로젝트·실제 계정·Secret·인증서·서비스·운영/Oracle·실제 Agent 호출은 제외한다. 과거 blocked 기록은 당시 사실이며 새 승인 후 같은 지점에서 재개한다. 전체44업무·Stage B partial 유지, 완료 선언0.
- 시작 기준: `67316225cc0fe9168fd0139814a009a3ce7adee2`, `codex/av3-stage-b`, tracked clean. 초기 sandbox Git 읽기1회는 work tree 접근 오류였고 같은 위치의 elevated read에서 HEAD/branch/clean을 확인했다. Git 설정/권한 변경0, 제품 실패로 분류하지 않는다. Windows DB 재접속 hold·기존 expired bootstrap/혼합 source HTTPS 프로세스도 유지한다.
- 이번 범위: projects의 생성/초안 명령 handler, DRAFT 검토·확정 계약, 새 `0011_draft_project_creation.sql`, 명시 runner, FN01 실제 통합 시험, UI02 연결 및 관련 계약/현황. 원본 FORM/공통 방법론 검토 기준과 기록은 보존한다. API/DB 정상·중복/다른 client·소유자/stale/미확정·rollback을 먼저 확인하고 UI를 연결한다. 영향 없는 완료 검사는 반복하지 않는다.
- QA 사전등록: WSL 전용 기존 개발 DB에서 이번 시험이 난수 UUID로 생성한 `qa-project-create-<UUID>` 합성 사용자/현재 client·세션/초안/프로젝트와 그 종속 명령·검토·receipt·감사·snapshot만 사용한다. 담당 Main 어울, 수명은 각 test try/finally, migrator로 exact 소유 UUID를 대조하여 참조 역순 정리·독립 잔여0 확인. 기존 사용자/프로젝트·DB/container/volume/network/포트·인증 자료는 보존하며 외부 Agent 실행0. 실패도 같은 정리/오류 기록을 적용한다.

### 2026-10-16 FN02·UI03 방법론 목록 페이지 조회

- 게시본 actual 추가: WSL exact `b7d64b894a49876c77f30ff88729bfcd5169e85d`/tracked clean에서 본인 공통 확정 상태/범위 필터가 현재 정확 v2 ref만 반환함을 확인했다. 기존 방법론 검토/확정·초안 선택/직접 저장 경로와 합쳐 actual1 PASS/465ms/skip0, 고유 QA finally 정리. SQL 재적용/권한 변경0, 새로운 실제 사용자·프로젝트/Agent 생성0이다.
- 승인 경계 감사: 처음 DRAFT/PROJECT 보완 승인 요청 이후 직접 작성/복사, 이번 읽기 페이지까지 승인 비의존 작업은 추가 진행했다. 직전 goal turn은 코드·actual 증거가 늘어난 진전이며 실행 handle을 기다린 verified wait가 아니다. 현재 다음 핵심 업무는 전용 초안 검토/확정→최초 프로젝트 원자 생성/소유·제어권 결박이고 FN03/FN04/FN05/IX01의 실제 저장·적용도 그 범위를 소비한다. 현재10번째 SQL guard는 USER_COMMON/FORM·METHODOLOGY만 허용하며 임의 DRAFT/PROJECT 확장은 금지된다. 같은 경계가 최초 요청/직접 작성 후/목록 페이지 후의3 goal turn에 반복됐고 승인 응답은 없다. 목표는 완료가 아니며 정확 새 승인 전 해당 DB·권한 작업을 수행하지 않는 blocked로 전환한다.
- 필요한 직접 승인 범위: 기존 Anvil v3 개발 DB에 forward migration만 추가해 본인 DRAFT의 검토/확정과 그 초안에서의 최초 PROJECT 생성/초기 소유·단일 client 제어·method snapshot/명령/허가·감사를 원자 결박한다. 기존 적용 SQL/다른 사용자·프로젝트·실제 계정·Secret·인증서·서비스·운영/Oracle·실제 Agent 호출은 변경하지 않는다. 기존 자료는 보존하고 실제 검증에는 소유가 확인된 합성 QA만 사용한다. 전체44업무·Stage B partial/기존 검사 기준을 유지하며 새 승인 후 이 지점에서 재개한다.
- 검색 라벨 RED의 근본 원인은 implicit label 내부 select option이 접근 이름에 합쳐지는 것이었다. input/select의 htmlFor/id를 명시해 같은 기대값의 검색/페이지 핵심2 PASS/2.6초를 확인했다. 실제 이름/범위/상태 query와 이전 목록 미재사용을 검증했으며 Web45(JS333.32kB/gzip96.34)·타입/diff check exit0이다. 전체 회귀·실제 사용자/운영 브라우저 시험으로 승격하지 않는다.
- 로컬 fresh 단위42 PASS/skip0·UI02/03 인접20 fixture PASS/15.8초·타입/build/diff check exit0. 생성 선택은 두 번째 페이지의 내 확정본을 불러오면서 앞의 기본본도 보존·exact ref 저장/새로고침을 확인했다. 새 검색 경로는 select의 implicit label에 option 문구가 섞여 exact label 선택 RED1을 확인했으며 htmlFor/id로 실제 접근 이름을 분리해 보정한다. 검사 이름/시간/기대값은 낮추지 않는다.
- WSL exact `7eda0b69f80f2f39b25f921de47fcc6e944669ab`/clean actual1 PASS/339ms/skip0: 내장3종의 limit2 순회/정렬·끝 cursor null, 필터 변경/변조400·CONFIRMED 필터 빈 결과·타 owner 원본404·버전 불변을 확인하고 정확 QA 정리했다. 새 SQL/권한 변경0. UI03의 기존 client가 hasMore를 거절하는 RED→명시 다음/이전·처음 갱신 GREEN1/2.1초. 이름/scope/status 적용은 첫 페이지부터, 생성 선택은 명시 더 보기로 누적하며 과거 선택을 자동 교체하지 않는다. 타입/Web45 build exit0(JS333.21kB/gzip96.30)이며 전체 actual UI DB 여정은 미검증이다.
- actual RED exact `4e2656e394e712228d0c5365d506a9dba7994c2a`: 기존 route가 limit를 거절해400≠200·skip0·고유 QA 정리. 읽기 전용 keyset/cursor를 구현했고 타입·신규 cursor 단위1/변조·다른 사용자/필터/기한 차단·diff check exit0이다. 실제 DB GREEN과 화면 연결은 아직 전이다. 실제 인증 key/계정·권한·migration은 변경하지 않는다.
- DB 권한 응답 전에도 가능한 미완료를 계획/정본/코드로 대조했다. INTERFACES §9의 이름·scope·상태/cursor 조회가 현재 201행 조회 후412로 미완성이므로 기존 인증된 SYSTEM/본인 공통 읽기만 페이지화한다. 새 도메인/권한·SQL·지속 자료/Agent 변경0이며 DRAFT/PROJECT 승인은 여전히 대기다.
- 계약 상세화: 기본50/최대200·고정 정렬 keyset, cursor는 현재 사용자·정확 이름/scope/status/limit·30분 기한에 결박한다. 페이지마다 현재 인증/소유를 다시 검사하고 전체 목록을 동일시각 snapshot이라 주장하지 않는다. 검색/필터는 LIMIT 전에 검사한다. 화면/생성 선택에서 다음 페이지를 명시 조회하고 요청 실패는 빈 성공으로 숨기지 않는다.
- 실제 QA는 기존 versions.test의 qa-methods-UUID 사용자2/소유 방법론2/정리 계약 그대로이며, 내장3종을 limit2로 나눠 읽어 더 많은 fixture를 만들지 않는다. 새 SQL/자원 생성 없이 limit 미연결 RED부터 확인한다.

### 2026-10-16 UI02 프로젝트 전용 방법론 직접 작성·복사

- checkpoint actual: WSL Git exact `72cd43affe6a738a342df3a3ca0e2e79b2e5c7de`/tracked clean, 기존 개발 DB/SQL 그대로 방법론 검토·전용 초안2 단계/조건·좌표 GET 재조회와 임의 실행 속성422를 확인, actual1 PASS/486ms/skip0·고유 QA finally 정리했다. 새 migration 적용/DB 권한/실제 프로젝트 생성0이다. 화면 UI02 인접7 PASS/6초·unit41 PASS/skip0·타입/build/diff check exit0. 전체 actual UI↔DB 여정과 제품 인수는 미검증이며 기능별 partial 상태를 유지한다.
- 남은 승인 경계: 전용 초안의 내용을 검토·확정하고 최종 프로젝트를 원자 생성하려면 DRAFT/PROJECT scope의 실제 허가/감사·초기 소유·제어 결박이 필요하다. 기존 USER_COMMON 승인을 넓혀 적용하지 않았으며 앞선 정확 승인 질문의 응답 대기다. 다음 재개는 이 경계의 승인 여부부터 확인하고, 승인 시 새 forward migration/정확 도메인·음성 검증을 거친다. 사용자 답변 없이 새 권한/실제 프로젝트/Agent·Secret·서비스를 생성하지 않는다. 전체44업무 목표는 active이며 완료/paused/blocked로 임의 전환하지 않았다.
- 복사 버튼 미연결 RED→선택 원본 exact GET/분리 복사/출처 버전 보존 GREEN. 직접 작성과 합성 Edge2 PASS/3.5초, 늦은 GET 동안 부모 중간 저장 비활성·원본 목적 불변·수정은 전용 초안에만 보존을 확인했다. 화면 이탈 후 도착 응답은 active 여부로 버리고 현재 선택/입력 교체는 확인 후에만 한다. 타입/Web45모듈 exit0(JS330.19kB/gzip95.49), 실제 DB 권한 변경0.
- actual 추가 범위는 같은 고유 qa-method-review-UUID/소유 초안2의 기존 정리 계약이며 새 자원/DB권한/프로젝트 생성0이다. 직접 작성 두 단계·음수/양수 좌표·USER_DECISION 조건을 GET 재조회하고 임의 실행 속성을 거절하는 사례만 추가한다. 다른 정상/불변 검사를 새로 반복하지 않는다.
- Main 어울은 목표의 이전 turn을 진전으로 분류했다. 공통 검토/확정·선택 저장의 코드/actual 증거가 추가됐으며 현재 e47be6db/local-private 동일·tracked clean에서 이어간다. DRAFT/PROJECT DB 권한 보완은 사용자 응답 전이라 적용하지 않는다. 승인과 무관한 기존 input_json의 프로젝트 전용 초안 편집을 먼저 완성한다.
- 직접 작성 버튼 미연결 RED→기존 UI03 공간형/단계·문서·조건 부품을 새 DraftMethodEditor에서 재사용 GREEN1/2.8초. 두 사람 단계·연결·종료점·위치 x260이 명시 중간 저장/새로고침에 보존되고, 부품 버튼 편집 중 저장 요청0을 확인했다. 페이지 form 밖에 편집기를 둬 기본 button submit으로 무단 저장되지 않게 했다. 타입/Web45 build exit0(JS329.30kB/gzip95.22), actual 신규 그래프 DB 여정은 추가 확인 전이다.
- 다음은 기존 승인된 source GET을 읽어 프로젝트 전용으로 복사/수정한다. 원본/공통본·서버 저장본을 덮어쓰지 않고 sourceRef exact 버전을 남긴다. 늦은 GET 동안 저장을 잠그고 사라진 화면의 응답을 입력에 덮어쓰지 않는 합성 시험을 먼저 작성했다. 실제 DB·권한·Secret·Agent/서비스 변경0, QA는 기존 D:\tmp\anvil-v3-stage-b/browser만 사용한다.

### 2026-10-16 UI02·FN01 프로젝트 초안 방법론 선택 연결 착수

- 현재 checkpoint: 본인 공통 방법론·양식의 쓰기/검토/확정 계약 보완은 승인 범위에서 연결했다. 프로젝트 초안 선택 저장도 새 SQL 없이 연결했지만 최종 프로젝트 생성은 여전히 차단한다. 다음 필수 DB 경계는 DRAFT의 검토/확정·PROJECT 최초 원자 생성/소유/제어·명령/감사 결박이다. 이는 최신 USER_COMMON 직접 승인과 다른 범위이므로 관련 새 migration·DB 권한/지속 프로젝트 생성은 아직0이며 정확 별도 승인을 요청한다. 실제 사용자/Secret·서버/운영·Agent 변경을 묶지 않는다. 목표 전체44업무는 미완료이며 완료보고/goal 완료 처리/예약 생성은 하지 않는다.
- actual GREEN: exact `29d70cf0795d8593b8f6e7951e43bf7eab4e2424` WSL1 PASS/455ms/skip0. 공통 확정본의 exact ref와 프로젝트 전용 graph/sourceRef/좌표를 초안2개에 저장·재조회, hash 변조409·프로젝트 생성0·finally 정확 QA 정리를 확인했다. 새 SQL 적용0. 과거 실패 QA의 별도 정확 정리도 위 기록과 대조했다.
- 화면: 다음 단계 미연결 RED→선택한 내 확정 방법론을 초안2단계 저장/새로고침 재조회 GREEN1/2.1초. 인접 UI02 합성5 PASS/4.6초·단위41 PASS/skip0·타입/Web44모듈 build/diff check exit0(JS323.45kB/gzip95.17/CSS7.09kB). 기본본/내 확정본만 선택 목록에 표시하고 저장한 ref를 목록 실패나 최신 개정으로 자동 교체하지 않는다. 기존 소스/자료 가져오기·전용 그래프 편집·최종 생성은 아직 미완료다.
- 보안 보완: 합성 다른 사용자 재로그인 뒤 이전 미저장 목적이 실제 DOM에 남는 RED를 확인했다. DraftEditorState에 owner를 결박하고 다른 owner의 입력/명령 표시·전송을 차단, 서버 자료는 지우지 않고 탭 버퍼만 사용자 선택으로 닫게 했다. 재로그인 확인 후 검증하는 동일 시험 GREEN, 동일 사용자 만료 뒤 입력 보존도 인접 PASS다. 실제 계정/권한·데이터 노출 사례를 만들지 않았고 기본 source/method/form 동작은 유지했다.
- actual RED exact `ece504dfc2c3db8c2627e81de22f0bac479ec45b`: 선택 미연결412≠201·skip0·고유 QA 정리. 앞선48e3 시험은 정리 코드가 authorization_receipts의 존재하지 않는 draft_id를 사용해42703으로 본래 실패를 가렸다. schema의 scope_kind/scope_id로 보정했고, 읽기 확인한 고유 QA `8ac11367-573b-4afd-b282-ca2df776a677` 한 명/소유 방법론·양식을 별도 정확 정리·사용자 잔여0 확인했다. 실제 사용자/공유 서비스 영향0. 정리 실패를 제품 실패/합격으로 바꾸지 않았다.
- 직전 exact `28783de90e220eb993dc6a94f9b6b1792c9b22ff` WSL 방법론 추가 음성1 PASS/444ms/skip0: 위조·이전 버전·최신 REWORK·FORM 검토를 METHODOLOGY에 잘못 사용하는 시도를 거절하고 고유 QA 정리했다. 기존 SQL 재적용0.
- 다음은 승인된 계획 UI02/FN01/02의 기존 input_json 저장에 방법론 선택을 연결한다. CONFIRMED_REFERENCE는 허가된 exact versionRef, NEW_PROJECT_DRAFT는 name/purpose/graph/sourceRefs/reviewRefs의 미완성 프로젝트 전용 초안이다. 자기 공통 확정 또는 승인된 기본본을 읽으며 타인/PROJECT 원본·잘못된 hash/위조 검토는 거절한다. 여기서 프로젝트 전용 확정·최종 생성·Agent 실행 권한을 만들지 않는다. 새 SQL/DB 권한 변경은 이번 연결에 필요하지 않다.
- QA 사전등록: 기존 qa-method-review-UUID의 소유 초안2개/명령·감사만 추가하고 정확 owner/ID를 finally 정리한다. 실제 계정·Secret·서비스/port 변경0. 현재 미연결412 RED를 먼저 확인한다. 이 단계의 형식은 기존 §15.1 안의 VersionRef 명칭을 versionRef로 고정하는 상세화다.

### 2026-10-16 본인 공통 방법론 검토·확정 연결 착수

- fresh 화면/인접 검수: 단위41 PASS/skip0, UI03 Edge12 fixture PASS/9.1초, 타입·diff check exit0. 문서 갱신 중 WORK_STATUS 전체 읽기가 도구 출력 한도를 넘겨 patch가 검증 단계에서 거절1·원본 손실0, 해당 행만 좁혀 보정했다. 임의 경로 조회의 파일 없음은 source/시험 실패가 아니며 실제 파일 목록으로 범위를 확인했다.
- actual GREEN: WSL exact `4799e2f058035358baa01b36d45c21616366a95f`/tracked clean에서 새 migration10번째 `0011_user_common_method_reviews` checksum `9e480e3bd4da152befdbb2bca8a2f5e1b3cdf0ed43336c5b210090f7ff02fea2` 적용·기존9개 checksum 불변. 방법론 확정/사용자 양식 미확정 차단·양식 확정 후 허용/새 개정 분리·프로젝트 실행 권한0과 영향받는 양식 검토 실제2 PASS/595ms/skip0·정확 고유 QA 정리. 현재 DB/지속 자원 보존, Windows relay 재접속/실제 계정/Secret 변경0이다.
- 화면 TDD: 미존재 방법론 검토 시작 버튼 RED→본인 공통 exact version의 기준5개/사람 직접 판정·이유/검토 기록·별도 확정 연결 GREEN. 새 합성 Edge1 PASS/2초, 첫 기록 응답 단절 후 같은 명령 확인·작성자와 동일 주체 공개·확정이 실행 승인이 아님을 확인했다. 타입/Web43모듈 build exit0(JS318.68kB/gzip94.22). actual UI DB 전체 여정은 여전히 미검증이며 화면 fixture와 실제 API/DB를 합산하지 않는다.
- exact `976f8f0b3708d792b7f3dd1deb1e1f29fcebf991` WSL actual RED1/skip0: confirmMethodology가 미구현400을 반환해 기대422와 달랐다. QA finally 정리 후 새 forward `0011_user_common_method_reviews`를 추가하고 현재 사용자/client/명령·버전/hash와 감사에 검토/확정을 결박했다. 기존9개 SQL은 수정하지 않았다. 로컬 타입·단위41·diff check exit0이며 새 SQL 적용/actual GREEN은 아직 전이다. 편집 patch 중복 대상 문법 오류1은 쓰기 전 거절되어 정상 update로 보정했고 소스 변경 손실0이다.
- 직전 공간형 exact `7b22c5d935025d9d065e77db3a6ff256a73d8061` WSL actual1 PASS/405ms/skip0: 본인 복사·개정/타인·내장·멱등 차단에 더해 직접 작성2단계·양수/음수 좌표·고정 문서 ref·all/not 조건 전체 JSON roundtrip·구조검사/실행 미연결을 확인하고 정확 QA 정리했다. 현재 source/local-private 동일·tracked clean, 별도 실제 UI DB 여정은 미검증이다.
- 다음은 기존 직접 승인한 USER_COMMON 범위에서 METHODOLOGY 내용검토/확정만 연결한다. 기존 양식 검토·원문·9개 적용 SQL은 보존하고 새 forward migration으로 기존 methodology_reviews에 현재 client/명령 결박을 더한다. SYSTEM/PROJECT 원본과 적용본은 변경/확정하지 않고 사용자 공통 exact ref만 다룬다. 사람 판단/구조 검사/양식 준비와 실제 프로젝트·도구 권한은 별개다.
- 양식 준비 판정: P01 REVIEW-02에서 신산님이 승인한 공식8종의 고정 배포 원본은 원 출처/지문을 대조해 ‘승인된 기본 양식’으로 소비한다. USER_COMMON 양식은 별도 실제 확정 사건/최신 내용 판단이 필요하다. 공식 원본을 사용자 확정 사건이나 제품 인수로 위조하지 않으며 검증 근거 종류를 다르게 기록한다. 이는 기본 방법론을 그대로 쓰는 기존 요구를 만족하는 기술 상세화이며 실행 권한을 늘리지 않는다.
- QA 사전 등록: 기존 지정 WSL 개발 DB/exact Git SHA에서 고유 `qa-method-review-UUID` 사용자1·본인 방법론1/버전2·본인 양식1/검토/확정·명령/감사를 만들고 정확 owner/ID 순서로 finally 정리한다. 실제 사용자/계정·Secret·다른 프로젝트/환경·Agent/port/컨테이너 변경0. 원래 미구현 confirmMethodology RED부터 확인한다.

### 2026-10-16 UI03 공간형 방법론 편집 착수

- fresh 검수: 타입/단위41/diff check exit0·Web42모듈 build(JS311.03kB/gzip92.52/CSS7.09kB)·인접 Edge11 fixture PASS/10.4초. 빈 직접 작성2단계의 오른쪽20/방향키 아래20 이동이 저장 payload/재조회에 보존되고 합성 SVG 캡처에서 읽을 수 있는 두 단계/화살표를 확인했다. all+not/유한 재작업2회/AF08 버전1 입력 ref 편집도 fixture PASS/3초. 같은 양식 목록을 쓰는 기존 조회의 버전 GET fixture 누락1은 catch-all에서503으로 차단됐고, 해당 예상 GET만 명시 보완했다. 예상 밖 호출 허용/타임아웃 완화/actual DB 우회0.
- 다음 actual은 기존 전용 WSL DB에서 같은 고유 qa-common 사용자2/방법론 정의의 기존 정리 절차로 직접 작성2단계·음수/양수 좌표·고정 문서 ref·all/not 조건 전체 roundtrip을 추가 확인한다. 새로운 DB/port/Secret/Agent 호출은 만들지 않는다. 실제 새 UI DB E2E·방법론 내용검토/확정·프로젝트 적용·실제 한도 정책 바인딩은 여전히 미검증/미완료다.
- 브라우저 RED: 단계 유형 입력 없음→구현 후 빈 방법론2단계·사람 역할/순서·USER_DECISION 비교·종료점·좌표 이동이 payload와 재조회에 보존되는 fixture1 PASS/2.6초. Web42모듈 build/typecheck exit0, 아직 실제 신규 그래프 DB roundtrip과 복합 조건/문서 ref의 추가 화면 검수는 전이다.
- 구현은 source SVG 원본/본인 편집을 구별하고 선택/확대·방향키20 이동, 노드 이름/목적/역할/범위/진행/기록·입출력 고정 양식, 시작/종료/연결 및 제한 데이터형의 all/any/not·판단 비교, 합류 규칙·유한 재작업을 제공한다. 이전 조건 계약은 자동 변환하지 않으며 미리보기 깊이/범위 제한이 저장 정의를 바꾸지 않는다. 입력 변경 시 이전 검사 결과를 지우고 저장한 exact graph의 서버 문제 위치를 표시한다. 실제 호출·정책 권한 부여0.
- checkpoint `51c74aa17e3b028dd6a33bbe0eabc9d47075a356`/local-private 동일·tracked clean·main f976ed5e 불변에서 승인된 P01 S03/계획 UI03·FN02의 남은 공간형/전체 단계 편집을 이어간다. 기존 copy/save API·허가된 양식 GET만 사용하며 새 DB/권한/API/Agent 실행 변경0. 원본/구버전과 사용자 dirty는 유지한다.
- 구현 순서: 코드형 SVG 배치/선택·확대/키보드 위치 이동→단계 역할/범위·문서 양식 ref·순서/분기/합류/재작업 조건 편집→초안 저장 후 서버 구조 오류 위치 확인. 조건은 fieldRef/operator/value와 all/any/not의 제한 자료이며 eval/스크립트/임의 URL/actual Agent binding을 넣지 않는다. 좌표 미리보기 제한은 원래 저장 좌표를 수정하지 않으며 아직 없는 실제 실행 검증을 통과로 보고하지 않는다. 새 빈 방법론2단계/판단 연결·위치의 브라우저 RED부터 확인한다.

### 2026-10-16 본인 공통 자료의 내용검토·확정 착수

- 후속 음성 actual: exact `34805ebedd2781eb23119d6d79648b1ecc585e8f` WSL1 PASS/324ms/skip0. 종합 ACCEPTED/항목 REWORK 불일치422·미연결 임의 ArtifactRef412·최신 REWORK가 있으면 이전 ACCEPTED로 확정422·보완 후 새 검토에서만 확정·새 버전 미이월 확인. 기존 SQL 재적용0·고유 QA 정리.
- 가독성 보정: 합성 최종 화면에서 판정/이유가 한 줄에 몰림을 실제 캡처로 확인하고 위치관계 RED(이유 y168.9 < 판정 하단219.5)→새 편집 영역3곳에만 grid/폭/label 배치 CSS 적용 GREEN·같은 기능/위치 기준1 PASS/2.6초. 보정 후 캡처에서 판정 아래 충분한 이유 입력 폭과 별도 확정 상태를 확인했다. 사용자 프로필/실제 자료가 아닌 기존 전용 tmp의 합성 QA이며 Stage B 종료 때 소유 자원으로 정리한다. Web37 build/typecheck exit0·JS289.37kB/gzip86.20/CSS6.32kB, 실제 소유 서버 backend는 교체하지 않았다.
- actual GREEN: WSL Git exact `7b81c6e140308103b3f4a2c192801d9b113bd653`/tracked clean에서 `0011_user_common_content_reviews` checksum `0009cfe2c02b92a4e930d538ce5c0c5d67215c6d89aca6c1a4345868ccbc4f01` 적용·이전8개 불변. 실제 검토/확정1 PASS/592ms 및 영향받는 양식 저장1 PASS/632ms(총2/skip0). 기준 누락·주체 위조·가짜 ReviewRef 거절, 같은 본문 검토 뒤 별도 확정, 새 v2에 확정 미이월, v1 이력 보존·app 검토 UPDATE42501·정확 QA 정리 확인. 이는 합성 사용자 시험이며 신산님의 제품 인수/실제 Agent 실행은 아니다.
- UI 검토/확정 연결: 버전/hash·서버 기준·미검토 기본값, 사람이 각 판정/이유를 직접 입력→검토 기록→별도 확정을 연결했다. 탭의 검토 입력/미확인 명령/owner를 보존하고 다른 사용자에게 숨긴다. 미존재 버튼 RED·select label 본문 혼입1·동일 주체 표시의 의미 단위 구분1을 보정, 같은 기대/시간 제한의 직접 검토/확정 fixture1 PASS/1.9초·Web37모듈 build/typecheck exit0. 전 과정 actual UI/DB E2E는 미검증이며 backend000d0088/relay hold/초기 비밀 만료를 그대로 보존한다. 다음은 최신 REWORK/증거 위조 음성과 인접 회귀 후 방법론 전체 편집/확정·생성 초안 연결이다.
- fresh UI/인접 검수: unit41/typecheck/diff check exit0·UI03 Edge fixture9 PASS/6.1초. 조회 DTO는 서버의 정확 ReviewRef/확정자·시각/버전을 확인하며 `CONFIRMED` 문자열만 있고 확정 사건이 없으면 거절한다. 기존 SYSTEM 필수형식은 유지하고 작성 중 USER_COMMON의 빈 초안 허용과 확정 조건을 분리한다. 현재 브라우저 build37/JS289.32kB/gzip86.18, 실제 새 UI DB 전체 여정과 실제 소유자 등록/인수는 미검증이다.
- actual RED: exact `03006a4be89cfcdbaa7d8abd0be97bb7f4501938`/WSL의 미구현 confirmForm400≠422로 실패·합성 사용자/양식 정리. 새로운 content_reviews/form_reviews를 준비하고 검토 기준5개·서버의 owner/현재 version/hash·검토 종류/기준·위조 ref를 대조한다. 내용 검토 및 확정은 공통 receipt/append-only 감사와 같은 transaction이며 기존 migration 변경0. 서버 최신 판단 순서는 클라이언트 시각이나 UUID 대신 실제 audit server_sequence를 쓴다.
- 기존 승인 범위의 다음 단계는 USER_COMMON 양식 exact version/hash의 사람 직접 검토 기록과 별도 확정이다. 보완 계약은 내용 판단과 형식 검사·프로젝트/Agent 실행 승인을 분리한다. 사람이 직접 읽고 기준별 이유를 기록하며 자료/시험 파일 저장 미연결 동안 evidenceRefs는 빈 배열만 허용하고 임의 증거 ID를 신뢰하지 않는다. 작성/검토 주체·원본과 같은 사용자 여부를 이력에 공개하며, Agent가 HUMAN_REVIEW source/주체를 payload로 선언하는 필드는 거절한다. 실제 Agent 자격/실행 호출은 아직 연결하지 않는다.
- 고정 검토 기준 버전1은 양식의 목적/역할/항목·반복 구조/작성 규칙/내용 검토 규칙 5항목이다. 누락/중복/구버전·위조 ref로 확정하지 않고 새 양식 버전은 다시 검토해야 한다. `content_reviews`와 `form_reviews`는 불변 기록으로 새 forward migration에 둔다. SYSTEM/다른 사용자 양식·기존 SQL/계정·Secret 변경0. 공통 검토 범위는 직접 승인된 owner=actor와 현재 session/client/명령/감사에만 결박한다.
- 실제 QA 사전 등록: 기존 지정 WSL 개발 DB/exact 게시 SHA, 고유 `qa-form-review-UUID` 합성 사용자1/공통 양식1·버전2·검토/확정/명령/감사를 생성하고 정확 owner/ID의 FK 순서로 finally 정리한다. 기존 원본/실제 사용자·서비스·컨테이너·port 변경0, Windows relay 재접속0. 아직 구현/적용/시험 결과는 아니다.

### 2026-10-16 FN03 본인 공통 양식 쓰기 착수

- 부분 초안 actual: exact `14cb5181ece54a108c8ac53e4ffb61e7e398efd5` WSL의 같은 시험1 PASS/453ms/skip0. 목적/목차가 빈 별도 본인 초안을 실제 저장·재조회했고 validForConfirmation=false, 원래 복사/개정2건과 새 초안1건 외 부작용 없음·생성 QA 사용자/양식 정확 정리. 이미 적용된 migration은 재실행하지 않았다.
- actual GREEN: exact `eb3b79ab211b05d31bedf41c8b256790643e28f6`/WSL tracked clean, 신규 `0011_user_common_forms` checksum `b1bb3b65bd7f9616bb6f79e456c27c042da4a2dfdfc8f3a6167e4cd06480044a` 적용 exit0·기존7개 불변. 양식 복사/개정·정확 공통 기준·구버전/공식 원본 보존·멱등/구버전409·타인404·SYSTEM403/SQL42501·변조 기준422의 실제 시험1 PASS/445ms, 영향받는 방법론 실제1 PASS/483ms(총2/skip0). 각 합성 사용자·정의 정리 확인, 실제 사용자 생성0.
- UI03 양식 복사/편집 연결: 복사 버튼 없음 RED→공통본 작성/역할·항목·반복 필드·작성/검토 기준 편집·새 버전/정확 재조회1 fixture GREEN/2.6초, 타입/Web36모듈 PASS. pending/owner 경계는 방법론과 같은 원칙으로 탭 메모리에 보존하고 receipt 적용 후 GET 실패에서는 새 명령을 만들지 않는다. 미완성 USER_COMMON 초안이 클라이언트의 SYSTEM 전용 필수내용 검사에 막히는 RED→USER_COMMON 초안 읽기만 분리 GREEN; SYSTEM 검사/실제 확정 기준 완화0. 내용 검토/사용자 확정·문서 본문 작성은 여전히 미완료다.
- 현재 fresh 검수: unit41/typecheck/diff check exit0·UI03 인접 Edge fixture8 PASS/6.5초, Web36모듈 build exit0(JS280.78kB/gzip84.27). 실제 API·DB2 PASS와 fixture8을 새 UI/DB E2E로 합산하지 않는다. 후속 부분 초안 실제 보존을 같은 지정 DB에서 확인한 뒤 본인 공통 내용검토/확정으로 이어간다.
- 실제 RED: exact `13fac4f4cebcd5c9d19a56d3872a12ae5a841f18` WSL에서 copyForm 미등록400≠200, 사용자2/양식0 finally 정리·잔여0. 확정/검토·실제 문서 작성은 아직 구현0.
- Ruling: 방법론/양식에 동일한 USER_COMMON receipt·scope digest·감사를 중복 구현하지 않고 기존 약20행을 access/common-command.ts의 내부 저장 함수로 옮겼다. 공개 범용 dispatch나 권한 엔진은 만들지 않고 기존 인증/client/멱등 검사와 transaction을 재사용하며 명시4연산만 허용한다. 변경으로 영향받는 기존 방법론 실제 시험도 함께 확인한다. 양식 정의/기준·기존 버전과 형식 검사를 성공·사람 확정으로 혼동하지 않는다.
- Stage B Main 어울, 안전 checkpoint `bf6b0f4611ff25a01ddf36ee9efa3370e2674954`/local-private 동일·tracked clean·main f976ed5e 불변. 공식 양식 복사/개정도 앞선 본인 공통 자료 직접 승인 범위이며 다른 사용자/공식 원본 쓰기는 열지 않는다. 새로운 `0011_user_common_forms` forward migration만 준비하고 이미 적용된 SQL/버전은 보존한다.
- 사전 등록: 기존 WSL checkout/exact 게시 SHA·전용 개발 DB/보호 app·migrator 참조만 사용. 고유 `qa-common-form-UUID` 합성 사용자2/본인 양식1·명령/감사2를 생성하고 finally 정확 owner/ID로 정리한다. 기존 공식8종/사용자/Secret/계정·컨테이너·port 변경0. Windows relay 접속0. 사용자 양식 검사 모듈 미존재 RED 후 제한 데이터/고유 항목·필드·반복 구조·확정 가능성 검사1 GREEN. 전체 기능 완료는 아니다.

### 2026-10-16 조건 계약 정정·공통 자료 보완 승인

- 공통 쓰기 actual: exact `0f072bb93f1a454432f8e97e3ca7a574eca1320b` WSL 시험1 PASS/388ms/skip0. copy/save·원본/과거 버전 불변·좌표345·같은 command 병렬2회 결과 동일/부작용 총2건·본문/연산 충돌409·타인404·내장403/SQL42501·CSRF/Origin403·회수401·감사 변경42501 확인. 새 migration checksum `ea3043a71f4d1557bf9620ac06f88274ed7227629fe2b1bfab00e7409d16563c`, 기존6개 불변·새 실제 사용자0.
- 첫 actual은 QA 정리23503으로 실패했다. `ON DELETE RESTRICT`는 DEFERRABLE 표기만으로 receipt 순환 삭제를 미루지 않는 것을 확인했고, admin의 정확 QA 정리에서 commands.authorization_receipt_id를 null로 끊은 뒤 receipt→command 순으로 제거했다. 첫 실패 QA2의 사용자/명령/정의/감사 각각0 독립 조회, 동일 시험 재실행 GREEN·새 QA finally 정리. 제품 FK/불변 계약 완화0, 처음 실패를 PASS 소급0.
- UI03 복사/편집/저장 착수: API는 same-origin/CSRF·명령/사용자/버전 receipt를 대조하고 저장 뒤 exact GET까지 확인한다. pending 요청/입력은 App 메모리에 보존·단절 시 같은 command만 재확인, 다른 로그인 사용자에게 앞선 편집 노출/전송 차단. 복사 버튼 없음 RED→구현 뒤 textarea label의 초기 본문 혼입으로 exact label 조회 실패1→명시적 htmlFor/id 보정·같은 기대/timeout으로 복사·편집1 GREEN/2초. 서버 API/DB actual과 브라우저 fixture는 합쳐 실제 새 UI DB E2E로 주장하지 않는다. 전체 문서 연결/분기·합류 편집·확정·Agent 실행은 미완료다.
- 인접 검수: UI03 fixture4 PASS/3.4초(읽기·권한 회수·복사/개정·단절 동일 명령). 추가 ‘저장 성공→GET403’ 음성 RED→적용 성공과 재조회 실패를 분리해 pending 유지 GREEN/1.6초. null receipt TypeError RED→형식 거절로 보정, 현재 unit39/typecheck/diff check PASS. 저장 실패를 성공으로 올리지 않으며 현재 소유 서버 backend는000d0088으로 새 코드 미반영·Web dist만 신규다. 실제 새 UI DB 여정/소유자 등록은 미검증, 기존 초기 등록 비밀 만료를 연장하거나 relay 재접속하지 않았다.
- 현재 checkpoint 검증: 최종 Web34모듈 build/typecheck exit0·JS272.48kB/gzip82.99/CSS5.44kB, UI03 인접7 fixture PASS/4.6초. 전체 Stage/실제 사용자 인수는 미완료이며 후속 내용검토/확정과 생성 초안 연결을 계속한다. 원본 root의5개 소유 문서는4dd4b56d 바이트와 일치하는지 확인한 뒤만 기계적 동기화하고 legacy dirty/Backup/다른 문서는 보존한다.
- 후속 실제 확인: Git exact `02d579be26b09d6b6825c981e8c27f59547d3702` WSL/clean에서 forward 정정 적용 exit0·FN02 실제 시험1 PASS/558ms/skip0. SYSTEM3의 v1 literal hash/본문 유지·v2 head/정식 조건·본인200/타인404/회수401·app UPDATE42501 확인. 원본 실패/조건 미적합 판정을 소급하지 않는다. 새 UI fixture2 PASS/2.7초는 실제 UI DB 여정이 아니다.
- 본인 공통 쓰기 착수: 현재 사용자/client/CSRF·USER_COMMON owner=actor·command 재전송/충돌·정확 head·도메인 변경/receipt/append-only 감사의 단일 transaction을 기존0011 뒤 forward migration으로 추가한다. PROJECT/DRAFT 계약과 적용 SQL은 그대로 보존한다. 먼저 copyMethodology/saveMethodologyDraft를 연결하며 확정/내용검토·양식 쓰기는 후속 범위다. QA는 기존 지정 WSL 개발 DB에서 고유 `qa-common-UUID` 사용자2·방법론/명령/감사만 생성하고 정확 ID로 정리, 실제 사용자/Secret/다른 프로젝트/운영 변경0. 기존 Windows relay 재접속 금지 유지.
- RED 증거: 게시 exact `6a8817d9d6b3293162bf1c0e30d6f2d2fb3e2196`/WSL clean의 공통 쓰기 실제 HTTP/DB 시험은 첫 명령404≠200으로 실패했다(미구현 경로). 합성 사용자2/관련 자격은 finally 정리·잔여 사용자/정의0. Windows 무인증 명령404≠401도 RED 확인 후 새 경로에서 GREEN. 최초 타입검사의 테스트 payload unknown 오류는 JSON 직렬화로 보정. sandbox 전체 단위는 지정 tmp mkdtemp EPERM1(권한 변경0), 승인된 실행 환경에서 같은 시험을 재검증하며 제품/DB 실패로 계산하지 않는다.
- 신산님 직접 응답 `call_07a966ef8b6d4eefac5fa279876ff3c0`: **‘본인 공통 자료용 계약·개발 DB 보완 승인’**. 대상은 현재 v3 개발 DB의 본인 USER_COMMON 명령/허가/검토·감사 범위와 현재 사용자/client·정확 버전·중복 방지의 forward migration이다. 다른 사용자/프로젝트 제어권·실제 계정·Secret·운영 DB 변경은 불포함. 이전 ‘승인 요청 중’ 기록은 당시 상태이며 지금은 해당 범위 승인됨. 공통 자료 쓰기 자체는 아직 구현/적용0.
- 중요 오류: 추가 대조에서 앞선 FN02 조건 자료 `kind:REVIEW_DECISION/USER_CHOICE`가 같은 INTERFACES §15.3의 `fieldRef/operator/value`·all/any/not 계약과 다른 것을 확인했다. 앞 절의 잠정 설명보다 후속 상세 계약을 우선해야 했는데 놓쳤다. 실제 Agent 실행·프로젝트 적용·사람 확정 사건0이므로 외부 실행/운영 영향0, 그러나 v1 구조 검증을 계약 적합/인수 증거로 승격할 수 없다. 기존 v1/과거 시험 결과는 지우거나 PASS로 소급하지 않는다.
- 회귀2 RED(버전1≠2·정식 조건의 잘못된 거절)→계약형 조건·EQ/NE/IN/IS_PRESENT·all/any/not·한정된 typed 결과/사용자 판단 필드로 정정 GREEN. 현재 단위37 PASS/typecheck/diff check exit0. 제한 자료이며 실행 평가기/실제 승인/새 권한은 아니다. 형식 충족을 실제 결과 존재·실행 준비로 해석하지 않는다.
- 정정 사전 등록: `0002_builtin_condition_contract`는 이미 적용된0002 SQL을 변경하지 않고 기존 SYSTEM3개의 정확 v1 hash·head를 확인하고 v2 head/본문만 같은 transaction에 추가한다. v1 본문/검토/적용본 수정0·삭제0, 새 사용자/Secret/프로젝트/테이블0. 기존 v1 확정/적용본이 실제 있으면 영향 검토 전 실패·rollback, 예기치 않은 hash/head도 거절한다. 새 v2 역시 Anvil 사람 확정 사건을 날조하지 않고 source 승인 출처만 보존한다. 실제 적용/legacy 보존 시험은 exact 게시 SHA 후 진행 전이다.
- 다음은 이 정정을 실제 WSL에서 확인한 뒤 승인된 본인 공통 자료 쓰기 계약과 DRAFT 편집을 이어가는 것이다. 전체 작업계획 완료/Stage B 수용/사용자 인수는 아니다.

### 2026-10-16 FN02 내장 정의·그래프 검사 착수

- actual GREEN: WSL Git exact `7590d3584fb4971b67f1c4d6fd7aace749a37504`/clean. 적용 전 `anvil.methodology_definitions`42P01 RED(실제 fixture 생성0), 계획0002 checksum `0453854b9925f5ff2eeed15babfb5dda8446fbb751b3e7caf0378a98d6dbcd34` 적용 exit0 뒤 같은 실제 API/DB 시험1 PASS/skip0·608ms. 내장3종 그래프/정확 양식/원문지문·본인USER_COMMON 읽기200/타인404/회수401/app UPDATE42501 확인, QA 사용자2·양식 아닌 방법론2와 session/credential 정확 정리. 원문 source 승인과 사람 확정 사건은 분리(`confirmation=null`), 실제 소유자/실제 Agent 생성0. 기존 migration checksum 모두 유지.
- UI03 `methodology-editor/{MethodologyEditorPage.tsx,api.ts}`는 내장3종·7단계 선택과 문서 고정 버전/목적·검수/사람확인/기록/재작업·검사 결과를 읽는다. 현재 절차는 읽기 전용이며 위치 편집·노드/연결 편집·복사/직접 작성/확정/적용은 미구현이다. 첫 요소 부재 RED→연결. 같은 기본본 재열기에서 version을 비운 뒤 effect 의존 값이 바뀌지 않아 본문이 사라지는 결함을 회귀 RED로 재현, 명시 재조회 세대를 갱신한 뒤 같은 기대값 GREEN. 방법론2+양식2 Edge fixture4 PASS/3.4초, 타입/Web32모듈 PASS. 기존 양식 fixture에 새 방법론 조회만 명시 추가했고 예상 밖 API 차단은 유지, 실제 Windows DB 요청0.
- 새 승인 경계: 사용자 공통본 쓰기는 FN02/FN03 승인 기능에 있으나 현행0011 commands/check 및 content_reviews 상세 계약은 PROJECT/DRAFT만 지원한다. 가짜 project/draft ID나 인증 actions 우회로 공통 쓰기를 구현하지 않는다. 본인 USER_COMMON 자료의 현재 사용자/client·중복 명령·정확 버전/감사를 새 forward migration/계약으로 추가하는 보완을 신산님께 비동기1회 요청했다. 답변 전에는 해당 공통본 쓰기/DB 보완을 하지 않고 기존 DRAFT scope의 프로젝트 생성 초안 편집을 계속한다. 다른 프로젝트 권한·계정/키·운영은 범위 밖이다.
- 저장/조회 후보 사전 등록: 계획0002의 새 `methodology_definitions`·`methodology_versions`·`methodology_reviews`·`project_methodologies`만 기존 승인 DB/migrator에 추가, SYSTEM 정의/버전3개는 개발 기본 자료로 보존한다. 기존0000/0001/0011/0003 SQL 수정0, 실제 사용자/키/초기화/기존 프로젝트 변경0. 기본본은 원문 승인 출처만 보존하고 사람 검토/확정 사건을 자동 생성하지 않는다(`confirmation=null`·실행 준비 필요). 새 app 권한은 읽기만, 개정/확정/적용 집행 전 쓰기 개방0. 적용 실패 transaction 전체 rollback, 이후 문제는 별도 forward migration으로 수정.
- 실제 WSL QA는 지정 Git exact 게시 SHA/기존 보호 app·migrator 참조만 사용하고 Windows DB 재접속0. `qa-methods-UUID` 일반 사용자2·USER_COMMON 정의/버전2를 고유 ID로 만들어 본인 목록/ID200·타인404·회수401·app UPDATE42501·내장 그래프/hash/양식 참조를 확인한 뒤 정확 QA ID/session/client/password만 정리한다. 실제 계정 생성/새 컨테이너/port/Secret0, 비밀 없는 auth 감사는 보존. API 인증 경계404≠401 RED→GREEN, 현재 단위36/typecheck/diff check PASS. 실제 DB 시험은 다음 exact SHA에서 진행 전이다.
- Main 어울, 시작 `4dd4b56d215a3e538c731552e17ace78fe9b1691`(private 동일·clean/main f976ed5e 불변). REVIEW-01 승인 원문 hash `1373688f969e578da3a38c52f619b878d01fdf999b717fd516ebf638d8c897d1` 기반 내장3종 각각7단계·역할/목적/입출력·실제 공식 양식 ref·완료/기록/사람 확인·재작업을 구현했다. 실제 도구/환경/유한 정책이 결합되기 전 `PROJECT_BINDINGS_REQUIRED`, Agent/DB 변경0.
- TDD: builtins0≠3 RED→GREEN, graph 초기6건 RED→GREEN. 명시 재작업 허용, 중복/참조/도달 불가/완료 누락/타 양식 hash/사람 역할 위반/조건 없는 분기·합류/코드·credential 필드 거절. AG07 정상 반복을 품질 실패로 인코딩한 원인을 원문 대조 후 `USER_CHOICE.NEXT_ITERATION`과 동일 실패 fingerprint3회 계수로 구분하는 회귀 RED→GREEN. 전체 시간/호출·비용 한도는 실제 프로젝트 정책 없이는 실행 불가다. 종료 뒤 정상 후속 작업을 추가 RED로 재현해 `TERMINAL_HAS_SUCCESSOR` 거절·유효 ALL 합류 허용까지 FN02 단위8 PASS/typecheck exit0.
- Ruling: `contracts/methodologies.ts`의 REVIEW_DECISION/USER_CHOICE는 구조 편집용 제한 자료이며 실제 승인/실행 근거가 아니다. FN10의 최종 사전·실제 결과·현재 권한/유한 정책 소비 전 실행 불가. 상세화가 잘못되면 후속 버전/참조 변환 비용이 있으므로 새 버전으로 교정한다. JSON schema·API/DB 저장·화면·복사/직접 작성·확정/적용은 아직 미완료다.
- 문서 복합 패치의 계획 행 제목 오인은 적용0을 실제 Git으로 확인한 뒤 정확 행에 재적용했다. 전체 단위35 PASS/skip0·typecheck/diff check exit0. 다음은 계획0002의 내장 버전 저장/조회다. 기존 Windows DB 접속 중단·bootstrap 재발급 금지·실제 계정 자동 생성 금지를 유지한다.

### 2026-10-16 FN03 공식 양식 저장·조회 착수

- actual GREEN: WSL `148684772ca863cc99dee5c359148b4aa1f58669`, 0003 checksum `51637420526c3bdae9c9b1ae3a020f2fd5c964125f67cd680b646eb191a0f59b`. migration exit0, 실제 catalog/API 시험1 PASS/skip0·453ms. 공식 양식8·기준1을 저장했고 사용자 공통본 두 개 중 본인 것만 목록/버전 조회, 타인404/구버전 부재404/회수401, app UPDATE42501, 같은 seed 검증과 바뀐 hash seed 거절/rollback을 확인했다. QA 두 사용자·소유 양식/버전/session/credential은 정리, 실제 소유자 생성0. 제품 형식 제공이며 실제 문서 내용 검수·사용자 확정은0이다.
- UI03 양식 조회: `features/methodologies/{FormsCatalog.tsx,forms-api.ts}`를 기존 App의 전역 방법론 분기에 연결, 승인 시안의 선택/목차·반복필드/작성 기준 원문을 데이터로만 렌더한다. HTML 실행/자료 명령 실행0·쓰기는0. 다른 양식 선택 시 앞선 본문을 버리고 늦은 응답을 무시, 재조회 실패는 오래된 자료 표시, 401/403은 자료를 회수한다. 방법론/문서 저장·확정 버튼을 허위 성공으로 노출하지 않는다. 기존 공통 App/CSS 변경은 이 경로 분기와 긴 기준 원문 읽기 스타일만이며 구조 개편이 아니다.
- UI 첫 RED: 양식 선택 요소 부재1, 새 구현 뒤 같은 기대값 Edge2 PASS. 공통 탐색/인증 오류 표현 직접 영향 회귀까지7 PASS/4.1초(API 전부 fixture 격리). 타입·Web30 build PASS(신규 UI Node/DB 실제 여정은 미검증). 첫 sandbox build는 기존 Vite 임시 파일 쓰기 EPERM, 같은 elevated build exit0·권한/ACL 변경0. UI 복합 패치의 App 문맥 불일치는 적용0·새 파일0을 확인한 뒤 정확 문맥으로 재적용했다. 새 FILE_MAP/정확 파일 재검색 전 잘못된 web 경로 읽기는 없는 파일 오류·변경0이며 실제 경로로 정정했다.
- 다음: 공식 양식의 실제 고정 ref를 내장3종 방법론 정의/저장/조회에 연결한다. UI03/FN03은 부분 구현이며 미구현 업무를 테스트 이월로 숨기지 않는다. 현재 브라우저는 Windows 실제 DB 접속 중단으로 계약 fixture만, WSL HTTPS 배포/사용자 인수는 미실행이다.
- Git exact `237899bcb318d641743068868ddc9ae8f2cab179`를 지정 branch/private와 WSL에서 일치·tracked clean 확인. WSL 실제 catalog 시험은 최초 DB 검사 `anvil.form_definitions` 부재/42P01 exit1로 RED, fixture 생성 전이며 skip0다. 이 RED를 제품 사용 성공으로 해석하지 않는다.
- 생성 전 DB 대상: 기존 승인 DB·migrator, 계획 `0003_documents`의 `anvil.authoring_standard_versions`·`form_definitions`·`form_versions` 세 테이블/버전 FK·head FK·범위 check·인덱스만 새로 만든다. 공통 기준 원문1과 공식 양식8·버전8을 지속 개발 자료로 보존하며 실제 계정/키/프로젝트 자료0. app는 이 새 catalog에 SELECT만 가능, 기존 역할/기존 테이블 권한 변경0. 같은 seed 재실행은 같은 버전 검증만, 다른 hash·본문/소유에는 rollback/거절한다. 적용 실패 전체 transaction rollback, 적용 후 기존 SQL을 수정하지 않고 별도 forward-only 수정으로 복구한다. 문서 파일 저장소·Secret·컨테이너·port 추가0.
- Main 어울, branch `codex/av3-stage-b`, 시작 `59c3444cc657812a90dc754c82f76406f66b9eda`. FN01 최종 생성이 소비할 FN03 catalog를 선행 연결한다. 공식 원문 SHA256 `622ffc6db4ccc26ae07c785c91b114467019b21571b728a71dea05d206816b13`/공통 기준 `85ec190976ce45af49b4f57fb5745d193b41640cfc62f5cbd19aa4711cb03f07`을 보존, 승인 자료 자체 수정0. 공식8종·각6목차·안정 항목/필드 ID·반복 행·작성 규칙·검수/사용자확정 분리를 구현했다.
- `forms-import` 첫 실제 RED는0≠8, 구현 뒤 GREEN. 새 목록/버전 인증 시험404≠401 RED→공통 현재 세션 gate 연결 GREEN, 익명 오류는 기존 계약 `AUTH_REQUIRED`를 사용한다. 초기 시험의 SESSION_EXPIRED 예상은 소비자 코드와 대조해 인증 부재/만료를 구분하도록 바로잡았다. 선언되지 않은 scope는400, 다른Host403. 아직 실제 저장 검증 전이며 형식 합격을 내용검수/사용자 인수로 승격하지 않는다.
- `npm test` sandbox에서는26 PASS/1 FAIL: 기존 auth-init `D:\tmp\anvil-v3-stage-b\auth-init\owned-XXXXXX` mkdtemp EPERM, 실제 인증 파일 변경0. 같은 승인 범위 elevated 전체 단위27 PASS/skip0, typecheck exit0. ACL 변경/제품 실패로 오인하지 않는다. 없는 `FN03.md`/`migrate.ts`/`environment.test.ts` 읽기는 경로 오류이며 실제 파일 등록부로 정정, 파일 변경0. 첫 forms.ts 패치는 같은 대상 delete/add가 도구에서 거절되어 적용0, 단일 update로 처리했다.
- 다음 실제 QA 사전 등록: 기존 지정 WSL v3 checkout/Git exact 게시 SHA, `anvil_v3_development`/기존 app 및 migrator 보호 참조만 사용. `qa-forms-UUID` 일반 사용자2·USER_COMMON 양식2를 고유 ID로 생성, 소유 초안/실제 사용자/키/초기화/기존 프로젝트 변경0. 테스트 종료/실패 시 생성한 두 양식/버전·사용자/session/client/credential만 정확 정리하고 잔여0 확인, 비밀 없는 auth 감사는 유지한다. Windows relay actual DB 접속 재시도0. 신규 컨테이너/port/Secret/계정 소유자 생성0.
- Ruling: 공식 양식이 참조하는 공통 작성 기준의 실제 본문/고정 버전은 FN03 `authoring_standard_versions`로 보존한다. 미래 지식 테이블의 가짜 참조를 만들지 않는다. 계획된0003의 catalog 부분을 먼저 적용하고 이후 문서 원본/제안 저장은 별도 forward-only 후속 migration으로 확장하며 이미 적용한 SQL을 수정하지 않는다. 동작 범위 변경은 없고 기술적 의존 순서 상세화다. 잘못되면 후속 명시 migration/참조 변환 비용이 있으며 기존 버전은 보존한다. SYSTEM 양식은 app 역할에서 읽기 전용, 사용자 양식 작성/개정·목록 cursor·문서 가져오기/확정은 아직 미구현이다.

### 2026-10-16 Stage A 통합 종료·Stage B UI00 시작

- 실제 초안 DB/HTTP: WSL exact `5a88d5ebea1151c1da448da7d28bb3f074dd5952`/clean에서 draft-storage1 PASS(2.10초). 동시 동일command POST1회·본문 충돌409·타 소유404·타client403·stale409·별도 새Pool/HTTP 재조회값 유지·명령/감사2건·최종프로젝트0을 확인했다. 기존 migrator로 이번 삽입 성공 추적한 QA 소유자/초안/명령/감사만 정확 정리·잔여0, 제품 app 감사 변경 금지는 유지했다.
- UI02 첫 목적/빈소스 중간저장 연결: API helper의 상대 경로/CSRF·위조ID 차단1 RED→GREEN, 화면 부재2 RED→저장/새로고침·명시 같은command 재확인 GREEN. 로그인 만료/내부 왕복 후 미저장 입력 보존1도 확인했다. 후속 Edge14(모든 API를 명시 fixture로 격리·미등록 API는 차단/FAIL) PASS·unit25/typecheck/Web28모듈 PASS. fixture를 실제 저장/새 전체 브라우저 여정 PASS로 합산하지 않는다.
- 라벨 오류: React controlled textarea의 초기 내용이 감싼 label text에 섞여 정확 label 조회2건이 실패했다. 실제 DOM은 입력을 보존했으며 진단 출력은 합성 문구 `왜 만드는가개발 주도권`이었다. id/htmlFor로 명시 연결한 뒤 같은 기대값/timeout GREEN, 선택자/합격 기준을 느슨하게 바꾸지 않았다. UI02의 응답 단절은 pending command를 탭에 유지하고 명시 재확인만, 새 명령 자동 생성0. 목적 미완성 저장은 초안일 뿐 생성 성공이 아니며 방법론/기존 소스/최종 생성 버튼은 연결 전으로 명시한다.
- 새 UI 상태/명령은 App의 탭 메모리에 보존하고 로그인 만료/화면 이동으로 버리지 않는다. 미저장/결과미확인 상태의 새로고침은 native 경고, 새 초안을 시작할 때는 명시 확인하며 결과미확인 중 새 초안 생성은 차단한다. 비밀·credential을 localStorage/URL에 저장0. 기존 source/data 자동 삭제·권한 이전0. 문서 패치의 최종 문맥 오타1은 적용0을 확인한 뒤 정확 문맥으로 재적용했다.

- FN01 중간 저장 후보: 현재 인증/CSRF·초안 소유자/client 아래 POST/GET/PATCH를 추가, create/save command·DRAFT receipt·감사를 같은 transaction에 저장한다. 사용자 행 gate 아래 create command를 전체 본인 scope에서 먼저 대조하므로 동시 새 draftId를 중복 만들지 않는다. `schemaVersion=1,commandId,clientId`와 생성 targetId=null/expectedVersion0·저장 expectedVersion/step/input은 기존 §8~9.2의 wire 상세화다. 미완성 목적은 초안에 저장 가능, 최종 프로젝트가 아니며 미정 방법론/null·자료[]만 허용한다. EXISTING 소스/실제 자료/방법론 선택은 저장 선행 전412로 차단해 거짓 기준선/성공을 만들지 않는다. 무인증GET404→401·단위24/typecheck PASS, 실제 저장 검사는 다음 WSL 게시 후보 전이다.
- 초안 실제 QA 사전 등록: Main/FN01, 기존 지정 v3 DB의 고유 `qa-draft-UUID` 일반 사용자2·초안/command/receipt/감사만 사용·실제 소유자/초기화/키0. 기존 WSL migrator 참조는 이번 삽입 성공을 추적한 QA 소유 초안 행만 정확 정리하는 별도 역할로 사용하고 Windows로 비밀 복사0·제품 코드에서 감사 우회0. 실제 사용자/프로젝트·auth 감사는 보존한다. 이 정리 권한을 제품 app의 감사 UPDATE/DELETE 허용으로 승격하지 않는다. 과거 계약 그대로 administrator 전체 변조 불가 보장은 하지 않는다.

- FN01 프로젝트 읽기 actual: WSL exact `b11167dc2748d3aab347a3db24c05d1969767ddd`/clean에서 auth 인접1·project-read1=2 PASS(1.42초). 고유 QA 사용자2/프로젝트4만 사용하고 모두 정확 정리했다. 허가 목록/직접ID404·보관 분리·membership회수·로그아웃401·서명cursor 주체·microsecond 항목 손실0을 확인했다. 합성 SQL seed를 실제 프로젝트 생성 기능 성공으로 보고하지 않는다.
- UI01 목록 partial: 기존 S01의 이름/목적·목록 검색/보관·cursor·S04이동·관측/오류 보존만 연결했다. 단계/완료 분류·담당/결정/다음 행동·생성은 연결 전임을 화면에 명시했고 진행/완료인 것처럼 꾸미지 않는다. 화면 부재2 RED→같은 fixture2 GREEN, 단위24·타입/Web26모듈 PASS. API 저장 검수와 fixture 화면을 합쳐 E2E PASS로 세지 않는다.
- 영향 브라우저11에서10 PASS/1 FAIL: 예전 ‘실제 미구현 session404’ 조건은 현재 실제 인증401로 바뀌어 ‘찾을 수 없습니다’ assertion이 실패했다. 인증/세션 구현을404로 되돌리거나 기대값을 느슨하게 바꾸지 않고, 기존404 오류표시 계약에 명시 fixture를 고정했다. 이때 미고정 탐색 시험이 AuthForm의 자동 setup 조회를 실제 서버로 보낼 수 있던 격리 누락도 확인하고 공통 session fixture로 차단했다. 이후 동일 오류/빈목록 금지 기준의 UI00/01 영향11 PASS(6.3초), 단위24 PASS. 향후 Windows 실제 auth DB 경로 재시도 금지는 그대로 유지한다. 최초10/1 실패는 원래 사실로 보존한다.
- 공식 FILE_MAP은 원문 diff에서 현재 후보의 소유 추가 문단만 빠져 있고 기존 문장 삭제/변경은 없었다. Git 이력 byte 일치 부재만으로 사용자 변경이라고 단정하지 않는다. 동기화는 삭제0·추가만인지 기계 대조 후에만 수행하고, 기존 정본3파일도 직전 소유 hash를 확인해 바뀌었으면 보존한다. 실제 source/schema/API·시험은 지정 branch에만 게시하고 원래 legacy 소스/dirty를 덮지 않는다.

- FN11 schema 실제 적용: WSL Git exact `939ff6e878cdd33359f9557a3abb69dd319c916c`/clean에서 0011 적용 exit0·schema/범위·감사1 PASS(0.19초). checksum `b5922fe31715076e7cdb1f6485f9ea5af4554c90fb957fb3b3a2c42ea22b9a21`, 0000/0001 불변. PROJECT scope NULL 우회23514·다른 command/scope receipt23503·감사 UPDATE/DELETE42501·모든 합성 transaction rollback/사용자/프로젝트잔여0. 새 테이블에만 DML 제약을 적용했다. runner는 실제 적용된 migration3개/checksum을 전부 출력하도록 receipt를 보완했고 존재를 실제 권한 집행 완료로 표시하지 않는다. 적용된0011은 이제 수정 금지, 후속은 forward migration이다.
- FN01 조회 후보: 허가된 프로젝트 목록/직접ID·보관 필터·현재 membership/세션과 서명 cursor를 연결했다. 무인증404→401, filter기본값/다른주체·필터·limit/변조·기한·microsecond 보존 cursor RED→GREEN, boolean coercion 누락1도 RED→문자열만 허용 GREEN. 당시 단위24/typecheck PASS. 실제 교차 프로젝트/회수/페이지 손실 검사는 다음 게시 SHA의 WSL에서 실행 전이다. TypeScript 시험 callback implicit any1은 명시 id 타입만 보정했다.
- 내부 상세 판정: 전역 프로젝트 목록에는 단일 프로젝트 기준선이 없으므로 `baselineVersion:null`로 미해당을 명시하며 가짜1/READY를 만들지 않는다. cursor 자체 format version1·주체/필터/limit·정확 DB microsecond·서버 서명·30분 유효 범위를 결박한다(TD-03 page50/최대200 유지). 방법론/기준선·정책 미연결은 readiness gap이며 상세 조회는 READ_PROJECT만 제공한다. 프로젝트 생성·제어 grant/쓰기 성공으로 오인하지 않는다.

- FN11 저장 RED: WSL exactd1f76dcb에서 permission_policies 부재 false!=true를 확인했다. 이제 명시 `0011_authorization`으로 정책/version·명령·정확 승인 요청/결정/소비·receipt·별도 감사/사건/outbox/draft 감사11테이블을 전용 DB에 추가한다. 신산님 P03의 전용 v3 migration 승인 범위, 기존 0000/0001 checksum 불변. 새 감사·불변 version/결정/소비/receipt만 app UPDATE/DELETE 차단하고 기존 테이블/역할/Secret는 변경하지 않는다. command↔receipt는 같은 scope/command의 지연 FK로 결박, NULL scope 우회도 CHECK로 거절한다. 실제 적용은 지정 branch 게시→WSL exact SHA/migrator/transaction/checksum 뒤, 실패는 rollback·applied SQL 수정0. 합성 사용자/client/프로젝트2/명령2·감사1은 실제 검사 transaction rollback·잔여0, 실제 사용자 생성0. 이 단계는 schema 준비이며 기능 권한집행 PASS가 아니다.

- 내부 선행 판정: FN01의 초안/프로젝트 명령은 FN11 command·draft 감사 저장을 소비하고 최종 생성은 FN02/03 확정본을 소비한다. DATA_MODEL §6.6/INTERFACES §15.3의 명시 DAG대로 이미 확인한 FN01 인증 기반 뒤 0011 저장 원시기능을 먼저 구현한다. 이는 FN01/FN11을 최종 수용하거나 선행을 삭제하는 변경이 아니며, 각각의 최종 연결 검수는 남긴다. 정확 신규 시험 `tests/integration/FN11/authorization-schema.test.ts`는 WSL Git 후보의 미존재 RED부터 확인한다. 새 schema는 지정 v3 DB/migration 승인 범위만, 적용 전 0000/0001 checksum·역할·현재 사용자0을 대조한다. 기존 migration/데이터/외부 서비스 삭제0. 미커밋 부모 디렉터리 생성 도구 제한1은 기존 자료 변경 없이 정확 새 시험 디렉터리만 준비했다.

- 초대 API 실제 검수: WSL Git exact `3b8e029d539b5be587ff0c1b178641811a3c183e`/clean·typecheck·auth DB/HTTP1 PASS(1.83초). 소유자 재인증 초대→일회 비밀1회→일반 사용자 수락/자동로그인0→새 로그인·일반 사용자 초대403을 확인, 고유 두 QA 계정/초대/세션을 정리했다. 프로젝트 grant 집행과 소유자 초대 작성 UI는 아직 미완료다.
- 초대 수락 UI00: 화면 부재 RED→등록/복구 비밀 가림·보관 확인/자동로그인0 계약 GREEN. 초대 화면 ‘로그인으로 돌아가기’가 복구로 가는 오류도 실제 RED→분기만 보정 GREEN. 현재 인증 보안 계약4·unit23·타입/Web24모듈 PASS, 실제 새 UI DB 브라우저는 relay 위험으로 미검증이다. fixtures 합격을 실제 사용자 초대 성공으로 보고하지 않는다.
- 공식 문서 대조: 이전 소유 동기화본 불변인 WORK_STATUS/WORK_PLAN/DEVELOPMENT_ENVIRONMENT와 신규 UI00 RESULT4개만 공식 root로 hash 일치 동기화했다. 공식 FILE_MAP은 현재 Git 이력과 byte 동일본을 찾지 못해 보존했으며 덮어쓰지 않았다. 실제 업무 배정 파일은 게시 후보 FILE_MAP과 대조한다. 이 정본 경로 불일치를 몰래 일괄 복사로 덮지 않는다.

- FN01 초대 기반 후속: 명시 소유자/최근 재인증/CSRF·24시간 상한·일회 비밀·일반 사용자 수락/자동로그인0 API를 추가했다. 무인증 초대404→401 RED/GREEN, 로컬 unit23/typecheck/diff PASS. 실제 저장/동시·회수/역할 검수는 다음 WSL exact 후보에서 진행 전이다. 프로젝트 grant는 FN11 실제 권한/제어 집행 전 `PROJECT_AUTHORIZATION_NOT_READY`412로 차단하며 빈 projectGrants 계정 초대만 준비했다. 이를 프로젝트 권한 초대 완료라고 표시하지 않는다. 새 계약을 임의로 완화하거나 실제 사용자 계정을 생성하지 않았다.

- 복구 API는 WSL Git exact `551b7791e74b835ce7b08eb465b420e6d592e93c`/clean에서 실제 auth DB/HTTP1 PASS(0.93초)다. 이전/소비한 비밀 차단·동일command 결과·generation/세션 회수를 포함한다. 후속 UI00은 로그인의 복구 양식, 설정의 로그인 보안(재인증→새 CSRF로 비밀번호 교체·복구 비밀 재발급 동의/가림/보관), beforeunload 경고를 연결했다. 실제 화면 부재2 RED→계약 fixture2 GREEN, 추가 동의/가림 회귀1도 PASS, 단위23·타입/Web24 모듈·diff PASS. 브라우저3은 명시 fixture이며 실제 API/DB와 합쳐 E2E PASS로 세지 않는다. Windows relay 중단 때문에 새 UI의 실제 DB 브라우저 여정은 미검증, 초대/프로젝트·내부 탐색 미저장 보호 등도 남아 UI00/FN01 [2] 유지한다.

- 복구 기능 구현 전 기준선 `25d2a2c9`를 지정 branch에 게시하고 WSL exact SHA에서 실제 rotate404!=200 RED를 확인했다. Windows relay 오류를 기능 RED로 대신하지 않았다. 이후 access repository/routes에 최근 재인증/CSRF 아래 일회 복구 비밀 재발급·이전 회수, 비밀 digest/시도 제한·일회 소비/세대 증가/전체session회수·동일command 결과만 확인을 구현했다. 로컬 unit23/typecheck/diff PASS, actual WSL GREEN은 다음 게시 SHA에서 검증 전이다. 복구 비밀/새 비밀번호 원문은 저장/출력하지 않는다.

- 중요 환경 예외: 복구 후속 검사에서 Windows→WSL relay의 같은 connectionTimeout5000 실패가 누적3번째 발생했다(이번 본문 첫 DB 조회 전, finally 포함22.8초). 해당 Windows DB 실제 시험/재접속 경로를 중단하고 네 번째 재시도·timeout 확대·공유 relay 재시작/kill·ACL 변경은 하지 않는다. WSL 내부 동일 app/DB 조회는 exit0·active1/잠금대기0이었다. 기능 RED/PASS가 아닌 연결 환경 실패이며 직접 원인 미확정. 별도 변경 권한 없이 Windows relay 복구를 시도하지 않고 단위/로컬 구현·Git exact SHA WSL 검수는 계속한다. 정식 Node40744/초기화1은 보존하며 정상 상시 로그인 사용은 현재 미확인 위험이다.
- 중간 게시 `000d0088bfab071115958211bd4426f88e77b531` local/private 동일·clean, main f976ed5e 불변. WSL exact000d008/clean·typecheck/auth DB/HTTP1 PASS(3.1초). 정상 launcher는 같은 commit·Node40744/startUTC2026-10-15T20:25:42.3705853Z·3830·기존relay26052로 시작했고 직후 실제 HTTPS setup200/true·session401을 확인했다. 이후 위 relay 재발을 정상 사용 PASS로 숨기지 않는다.

- 승인 초기화 실제 결과: 설치ID `fdd305cc-9b91-4a1f-b86f-94d2690c062e`, 두 신규 파일 배타 생성·DB행1·사용자0. 초기 등록 기한 `2026-10-15T20:51:14.749Z`(KST 2026-10-16 05:51:14.749). 독립 조회로 digest/기한 일치·미사용·소유자 없음·파일 link0·허용 SID=current user/SYSTEM만 확인했다. 비밀 원문 출력0. bootstrap 만료 후 자동 연장/파일 덮어쓰기 금지다.
- 초기화 도구 최초 실행은 `PROTECTED_ACL` 이전 자료변경0에서 실패했다. Windows PowerShell5의 Microsoft.PowerShell.Security 모듈 자동 로드 실패를 ACL-only 재현으로 확인하고 기존 설치 PowerShell7의 같은 검사 GREEN 후 실행 경로만 보정했다. ACL 변경0. 진단 --check를 추가해 filesWritten0/rowsWritten0을 확인했다. diagnostic return의 최상위 TS1108 1건은 분기 구조만 보정했다.
- 인증 후속 검수: 무인증 재인증/password404→401, 실제 최근 재인증 없는 password404→412 RED에서 구현 후 실제 DB/HTTP1 GREEN. 토큰/CSRF 교체·동일client·절대12시간 연장0·옛cookie401·비밀번호 변경 세대 증가/모든세션회수·옛비밀번호401·새비밀번호 로그인·동시 claim 멱등/시도제한을 확인했다. 보안 감사는 비밀 없이 보존, QA 사용자/세션/claim/복구/counter는 정확 회수하며 신규 영속 초기화행은 보존했다. unit23/typecheck PASS. sandbox의 D:\tmp mkdtemp EPERM1은 기능 실패가 아니며 동일 검사 elevated PASS·ACL 변경0이다.
- 미확인: 재인증/password의 실제 화면 연결, 복구/초대, 프로젝트/권한/기준선, 정식 launcher의 신규 auth 참조 실행과 후속 WSL exact SHA는 남아 있다. 잘못된 읽기 경로 scripts/validate-app-config.ts·components/AuthForm.tsx·layout/AppShell.tsx는 파일 부재였고 기존 실제 storage/shell 경로로 대조했으며 제품 장애로 세지 않는다.

- 후속 직접 승인 `call_74c28acfc6424f6fb3e31ef55262a333`: ‘신규 개발 인증 키·초기화 기록 생성 승인’. Main/FN01은 기존 보호 root `D:\Project\Anvil\.av3-data`의 신규 `auth.json`·`bootstrap.json`만 배타 생성하고 기존 전용 DB `anvil_v3_development`에 초기화 기록1건을 만든다. bootstrap30분·원문 Git/대화/로그0·실제 소유자 자동 생성0·기존 계정/키/CA/ACL 변경0. 두 파일/행 생성 전 기존 부재·root realpath/link·ACL·DB/role을 대조하며 재실행으로 덮어쓰지 않는다. 개발 키는 후속 개발용 보존, bootstrap은 기한으로 무효화한다. 준비 함수의 실제 파일 시험은 등록된 `D:\tmp\anvil-v3-stage-b\auth-init` 아래 새 일회 경로에서만 하고 시험 뒤 소유 파일/경로를 정확 정리한다.
- 진행 중 보존: config 검증1 RED→GREEN(당시 unit22/typecheck PASS). 재인증/비밀번호 변경의 무인증401 검사는 현재 endpoint 부재404에서 예상 RED이며 구현 전 PASS 아님. 신규 동시 claim/세대회수/시도제한 DB 시험은 아직 실행 전이다. `apps/server/main.ts`·개발 launcher·access/config 및 관련 시험은 Main 소유 미커밋 변경으로 이어간다.

- 실제 인증 UI 중간 결과: 승인 CA·TLS무시false의 실제 HTTPS server/전용 PG/Edge에서 초기 등록→일회 복구 비밀 가림/보관 확인→로그인→Secure/HttpOnly/Lax cookie→화면 로그아웃/쿠키회수 1 PASS(2.8초). Network same-origin·JS오류0·Agent호출0. 최초 실행은 등록/로그인 뒤 로그아웃 버튼 부재에서 RED·QA정리0, 버튼/명시 CSRF 연결 뒤 동일 검사 GREEN. 실제 계정·token·설치ID·recovery/counter·worker server는 회수하고 비밀 없는 append 감사만 보존했다. 아직 제품 초기화 보호 참조/상시 개발 실행 연결·복구/초대/재인증·프로젝트 API/권한·기준선은 미구현이므로 FN01/UI00 완료 아님.
- 정확 WSL HTTP/DB 검수: b380f687/clean에서 typecheck·auth-postgres1 PASS. Origin/추가필드 거절·실제login cookie/CSRF·logout/옛cookie401은 실제 저장·HTTP이며 브라우저 fixture 합격으로 대체하지 않았다. Windows relay의 간헐 첫 연결timeout2는 미확정 환경 위험으로 보존하며 세 번째 동일 실패 전까지 무작정 재시도하지 않는다. 실제 live시험에서는 연결과 전체여정이 성공했다.

- UI00 후속: 로그인/최초 등록·복구 비밀 가림/보관확인·자동 로그인0의 화면을 추가했다. 계약 fixture2와 실제 탐색3을 포함 Edge5 PASS, build23/typecheck·unit21 PASS. fixture를 실제 인증 성공으로 세지 않는다. 본문 skip-link의 hash경로 변경 RED→preventDefault/본문focus GREEN. 복구 입력/checkbox 선택자 충돌1은 exact 구분 뒤 같은 기준 GREEN이다. 신규 AuthForm.tsx·postAuth는 UI00 로그인표시/FN01 계약 소비이며 공개 기능 추가 아님.
- 다음 실제 HTTPS/DB/UI QA 사전 등록: Main/FN01, 기존 CA/leaf·DB만 사용. 현재 소유 Node30072(startUTC2026-10-15T19:26:50.5534635Z)를 receipt/PID/start/exe/경로로 대조한 뒤만 중지·등록 runtime 로그/receipt3개 정확 정리한다. Playwright worker의 임시 HTTPS server는 같은127.0.0.1:3830·등록 Stage B browser profile·합성 설치ID/소유자·메모리 key/비밀만 사용·테스트 후 server/Pool 종료, 생성한 계정/세션/초기화/복구/시도 counter만 정확 회수·잔여 확인한다. append-only 비밀 없는 QA 감사는 사실 증거로 보존. 실제 사용자 계정/새 CA·파일 Secret·공유 relay·기존 서비스 변경0. 실패도 cleanup하며 Windows 같은 DB 연결 timeout이 세 번째면 해당 재시도 중단/예외 보고한다.

- FN01 DB 적용 결과: WSL-server Git exact04d268bd/clean에서 전용 DB0001 적용 exit0, 실제 원본/교차client FK/빈 목적 거절·rollback/잔여0 1 PASS. 0000 checksum 불변, 0001 checksum/멱등 상태는 다음 receipt에서 별도 조회한다. migration 출력이0000만 표시하는 현재 도구 한계를 0001 미적용으로 오인하지 않는다.
- 인증 저장 core: 실제 전용 DB의 고유 합성 설치ID·초기owner→동일command재조회/본문충돌→잘못된 비밀번호→대문자명 로그인→digest만저장/session조회→logout/옛token거절 1 PASS. 실제 사용자/세션/설치·복구/시도 counter는 시험 소유 UUID만 정리하며 append-only 비밀 없는 감사는 사실 증거로 보존한다. 이 시험은 HTTP/UI 전체 PASS가 아니다. 타입추론 오류1은 transaction 결과형을 명시해 typecheck0, patch 다중동일파일 연산1은 적용 전 거부 뒤 Update 한 건으로 정정했다.
- HTTP 연결 검수는 Windows relay 접속5초 timeout이 두 번째 발생해 기능 RED에서 제외했다. 같은 Windows DB 요청을 더 반복하지 않고, 새 코드의 WSL exact SHA에서 실제 HTTP/DB를 확인한다. 독립 사전 거절 시험은 DB가 없어도401/다른 Origin403/추가필드400이 나와야 한다는 실제 assertion RED404→GREEN, 전체21 PASS/typecheck0. cookie/CSRF·positive HTTP는 아직 미확인이다. shared relay 재시작/kill·timeout 확대0.

- FN01 실제 schema 검수 사전 등록: 기존 신규 전용 PG/DB/역할만 사용, `0001_projects_access`가 사용자·client·credential/session/초기화/초대/복구/감사·프로젝트/초안/멤버/초기제어·선언/기준선 테이블을 추가한다. 기존 테이블/자료 삭제·이전 DB/권한 변경0. migration checksum/명시 순서/transaction을 적용하고 실패는 rollback, 적용 뒤 파일수정/down/drop0. 합성 QA ID는 시험에서 UUID로 생성·transaction rollback·잔여0 확인하며 실제 사용자 계정은 만들지 않는다.
- 첫 Windows DB 시험은5초 timeout으로 데이터 변경 전 실패, 기능 RED에서 제외. WSL 동일 PG ID/running/loopback·직접 app SELECT/Windows TCP 성공을 읽기 확인한 뒤 같은 timeout의1회 재확인에서 정상 연결·새 anvil.users 부재42P01 RED를 얻었다. 첫 연결 시간 초과의 직접 원인은 미확정이고 timeout/relay/서비스를 바꾸지 않았다. 첫 PowerShell finally가 외부 시험 exit1을 shell exit0으로 숨긴 점을 기록하고 이후 exit를 명시 보존했다. 실제 SQL/사용자 추가0.

- 후속 직접 승인 `call_b7ba48656c4b44d7a6ad68143308c93e`: ‘Stage B 지정 branch 게시 승인’. 같은 지정 저장소/codex/av3-stage-b·Stage B 신규 코드/시험/migration/실행·검수 기록만 게시/일반 Stage PR. Backup/legacy·실제 계정/Secret/인증서/DB 데이터/타 프로젝트 제외, 실제 Agent/Oracle/운영·main 직접 쓰기/force/rewrite 불가. 이 승인은 실제 시험 결과가 아니다.
- UI00 부분 검수: API client3·route1 RED→GREEN, 기존 회귀 포함17 PASS·타입/Web22모듈 PASS·실제 Edge2 PASS. 프로젝트 첫 화면/404 실패≠빈목록·모바일키보드/뒤로/새로고침·same-origin/JS오류0. 실제 인증/제어·입력 보존·가독성 전체는 FN01 연결 후 검수하므로 UI00 [0] 아님. 실제 native fetch를 객체 receiver로 호출해 Illegal invocation이 난1건은 Edge window/object 비교로 직접 확인 후 `.call(globalThis)`만 보완·동일2건 GREEN. CSS side-effect 타입 선언 오류1은 vite/client 선언 추가로 해결했다.
- FN01 시작: FILE_MAP access service와 auth.test에 비밀번호15~128/Unicode·공백/대소문자 보존·개별salt/Argon2id·기한/세대/회수의 RED3→GREEN3, 전체20 PASS/typecheck0. 실제 Windows Node24.18 native crypto.argon2 존재와 공식 Node24 문서를 대조해 새 암호 라이브러리 설치 없이 승인 최소19MiB/2/p1을 사용한다. 동시 hash2개로 유한 제한, 실제 서버/DB·공격 방지 PASS 아님. 근거 https://nodejs.org/docs/latest-v24.x/api/crypto.html#cryptoargon2algorithm-parameters-callback . 새 사용자·세션·키/DB 변경0.

- Stage A PR41 head ff9481d0를 일반 merge해 private main f976ed5e에 포함했다. PR 실제 mergeable=true, CI discovery의 checks/status0(설정된 CI 없음)·local 필수 검수와 독립 검토로 판정했다. account 지정 CI 조회1회 ‘account changed’는 쓰기 없이 실패, 기본 discovery의 정확 head 조회는 성공했다. CI를 실행 PASS라고 표시하지 않는다.
- merged-main source diff0, 단위13/생성타입 일치·실제 승인CA HTTPS probe exit0. merged main Node61812를 receipt/start/exe/인자 대조 후 종료·3830잔여0, 전용 로그/receipt3개 정리. 이전 Node52852 종료 guard1회는 PowerShell JSON 자동 시각 변환 때문이며 변경 전 중단. DateKind String으로 원래 시각을 보존해 같은 모든 조건으로 확인했다. 공유 relay26052/DB/보호 참조·CA는 보존.
- Stage A 원격 branch 부재·로컬 정상 삭제·정리 확인 후 main에서 `codex/av3-stage-b` 시작, 단일 writer Main 어울. 기존 원래 branch/사용자 자료는 손대지 않았다. 이전 Stage 문서7개를 공식 root로 hash 일치 동기화했다.
- UI00 목적: Dashboard 대신 프로젝트 첫 화면·내부 탐색·공통 역할/제어/오류/미전송·same-origin client. 파일은 FILE_MAP의 App/shell/api/styles와 정확 시험, 필요 SPA 진입은 server app 및 기존 P03 영향 시험만. FN01/FN11 전 인증/프로젝트를 가짜 성공으로 표시하지 않는다.
- 신규 Stage B 임시 자원: `D:\tmp\anvil-v3-stage-b\npm-cache`는 정확 lock102 설치 cache, `browser`는 Edge 별도 QA profile/결과. Main/UI00·Stage B 검수용·각 사용 종료/실패 때 정확 경로/소유 process 확인 후 정리한다. 이번 cache 디렉터리 생성이 사전 commentary/기록보다 먼저 실행된 순서 오류를 남긴다. 이후 새 자원은 생성 전 등록한다. 기존 사용자 profile/Root/전역 npm 자동 업데이트0.
- 시작 검증 오류1: fresh 설치 직후 기존 Web unit이503!=200 실패. ignored dist가 아직 build되지 않은 준비 순서이며 기능 RED가 아니다. build→기존13개 단위 확인 후 실제 UI00 RED를 시작한다. 기존 기대값/검사 기준은 변경하지 않는다.

### 2026-10-16 P03 준비 환경 수용·Stage A 통합 착수

- 담당 Main 어울, 단일 writer. `0ec17f1a` local/private 일치·tracked clean에서 P03 결과 기록을 시작했다. 준비 환경 판정은 ENVIRONMENT_READY이며 제품 사용/Agent 연결 PASS가 아니다.
- Windows Node24.18/npm11.12, WSL Node24.21/npm11.19 차이를 유지한다. 실제 WSL 검증 SHA는892ea1e1, 이후 Windows 실행/브라우저 SHA는0ec17f1a이다. 동일하지 않은 실행 SHA를 합치지 않는다.
- 실제 Windows HTTPS probe exit0, CA498348218A4015B341A90B10FF4FE176987D4424 정확1·Node52852 시작UTC2026-10-15T19:08:42.2263733Z·3830 일치. Edge155의1 PASS·Network3/off-origin0/pageerror0/TLSignorefalse는 기존 불변 소스 증거를 재사용한다. PowerShell cmdlet의 시간 초과/뒤 연결거절 실패는 아래 원래 기록대로 보존했다.
- 임시 정리 exit0: 등록한 D:\\tmp\\anvil-v3-stage-a\\npm-cache·P03-browser 부재, QA Edge process0. WSL 등록 npm-cache realpath/link 확인 뒤 제거·잔여0. 새 PG/volume/개발 자격참조·CA와 정확 소유 HTTPS는 후속 개발용 보존이다. 공유 wslrelay26052는 종료/변경하지 않았다. cache/profile은 재생성 가능한 일회성 자료다.
- 판정/다음: P03 조건별 증거/미확인/rollback을 RESULT에 연결하고 준비3/미착수41로 정정했다. 기존 문서/시안 승인 hash를 현재 관측으로 소급하지 않는다. Stage A PR 검수·통합·smoke 뒤 UI00. 코드/환경 불변의 완료 검사는 반복하지 않는다.

### 2026-10-16 P03 실행 범위 직접 승인·P02 종료 대조

- HTTPS 준비 도구 실패 보존: 새 Node process는 READY를 출력했으나 PowerShell Invoke-RestMethod가 시간 초과여서 finally에서 정확 소유 process를 종료·3830잔여0/receipt없음을 확인했다. 그 뒤 브라우저1건은 연결 거절로 실패(준비 process가 이미 종료됨)이며 TLS/제품 실패로 소급 확정하지 않는다. 같은 cmdlet 반복은 중단했다.
- 독립 전경 진단에서는 승인 CA 검증의 Node127/localhost와 Windows 기본 신뢰 HttpClient127이 모두 HTTPS200, 실제 Edge155.0.4283.45 브라우저1 PASS·Network3/off-origin0/pageerror0/TLS무시false였다. PowerShell cmdlet의 같은 localhost 읽기만 TaskCanceledException을 재현했다. 내부 직접 원인은 미확정이며 보안 기준을 낮추지 않고 CurrentUserRoot exact등록/기한 확인+동일 승인 CA의 Node2초 probe로 준비 확인을 결박한다. 인증서/설정·timeout 연장0이다.
- 로컬 runtime 첫 시도는5546 점유로 process 생성 전 안전 중단1. 읽기 조회에서 `wslrelay` PID26052/정확 Microsoft WSL 실행 파일을 확인했고 종료/포트 변경0이다. 신규 app credential로 실제127.0.0.1:5546의 DB/role/서버·fixture와 저장/조회/DDL거절·probe정리0을 독립 확인해1 PASS. 기존 자동 relay를 쓰는 명시 선택을 준비해 불필요한 SSH tunnel을 만들지 않으며 공유 relay는 절대 회수 대상이 아니다. 보호 app 참조는 이미 생성됐으므로 복사를 반복하지 않는다.
- 브라우저 일회성 자원 사전 등록: `D:\tmp\anvil-v3-stage-a\P03-browser`는 Playwright 임시 profile·검수 결과·실패 캡처만, Main/P03 소유·검수/근거 회수 후 정확 정리·잔여 확인. 기존 Windows Edge 사용·기존 사용자 profile/보안 설정/인증서 변경0, TLS 무시 OFF·Network same-origin/실제 JS 오류를 확인한다.
- WSL 실제 준비 검증: exact `892ea1e1f3e65c408910ffa3ae5f8e9f807fb361`에서 PG15.18 신규 자원 생성·instance/ID/image/loopback5546 확인. container `e6f798c3a2a3bdb2be533dd4c024d76f34d19fcfbbe4bf2acbe0437fb0cf32ba`, volume/network는 등록 이름. 보호 경로0700/app설정0600·daon 소유. lifecycle OFF 설치102·typecheck/Web14·단위13·생성 타입 일치 PASS. 0000 checksum `6ebbb9c580d54a50e0431806ee982244cbe134613354f8c3a8cd4f547e30178d` 적용/멱등 재적용·fixture7, 실제 비관리자 DB 저장→다른 연결 재조회·DDL거절·probe정리0 1건 PASS. 실제 제품 사용자/프로젝트 생성0·Agent 호출0. WSL Node24.21/npm11.19이며 로컬 버전과 다름을 보존한다.
- 로컬 후속 사전 등록: 신규 `.av3-data/db-app.json`에 방금 생성한 전용 app 역할 연결 참조만 보호 저장·값 출력0, migration/bootstrap credential은 복사하지 않는다. 신규 `.av3-data/runtime`의 소유 SSH tunnel loopback5546와 Node HTTPS3830·PID/시각 receipt/비밀 없는 로그를 생성한다. Main/P03·후속 개발용 수명, 새 프로세스만·기존 port 점유 시 중단. 실패 때 방금 시작한 PID/시각 일치 process만 종료, 정상 개발 종료/전환 때 같은 소유 확인으로 정리한다. 실제 시작은 아직 전이다.
- 중간 기준선 게시: `codex/av3-stage-a` commit `8f3af6565654af2649e2737933b243c3a969becd` 정확89파일·local/private 동일·tracked clean, private main `b4f9006e30e5afcf98ef8ef1f39707ecc8954feb` 불변을 실제 조회했다. WSL 신규 Git도 exact8f3af656/clean이며 기존 자료를 복사 배포하지 않았다. 실제 DB 생성/저장·브라우저는 아직 미검증이다.
- 생성 직전 준비 판정 보완: 공식 docker-library/postgres entrypoint의 초기 socket-only 서버와 최종 TCP 서버를 구분했다. 초기 서버를 정상 완료로 오인하는 assertion RED를 확인한 뒤 readiness를127.0.0.1 TCP로 한정했다. 근거 https://raw.githubusercontent.com/docker-library/postgres/master/docker-entrypoint.sh . 이 변경은 같은 branch의 후속 exact commit/private 게시 뒤 WSL로 받아 사용하며 서버 소스 직접 patch0이다.
- 첫 checkpoint은 exact89파일 stage 뒤 generated-types EOF 여백의 staged diff-check 실패1로 commit 전 중단했다. 기존 dirty/다른 파일은 stage하지 않았다. generator의 최종 개행을 단일화하고 .gitattributes/.gitignore LF를 고정해 재생성·exact hash/차이를 다시 대조한다. 이 중간 실패를 commit/push 완료로 표시하지 않는다.
- 다음 생성 사전 등록: WSL `/home/daon/deploy/anvil-v3`는 지정 private branch의 exact commit Git checkout용·후속 개발 보존, Git 원격 접근/부재/부모 realpath 확인 완료·생성 직전 재확인. `/home/daon/.local/share/anvil-v3-development`는 신규 DB 보호 설정만·UID1000/0700·파일0600. 신규 PG `anvil-v3-development-pg`/network `anvil-v3-development`/volume `anvil-v3-development-pgdata`는 Main/P03 소유·후속 개발 보존·기존 자원 채택0, 정확 image/digest·instance label/신규 ID/loopback5546을 검증한다. 실제 생성은 아직 전이다.
- WSL npm cache는 `/home/daon/deploy/anvil-v3/.av3-data/npm-cache`로 한정·P03 설치 후 정확 제거, 전역 npm/cache/기존 node_modules는 변경하지 않는다. 합성 fixture7개는 P03 전용 anvil_qa 저장 자료이며 제품 로그인 사용자/프로젝트 생성이 아니다. 동적 저장 probe행은 고유 ID로 시험 후 정확 삭제/0확인한다.
- 후속 실제 확인: 신산님 ‘확ㅇ니햇어’ 응답 뒤 CA 등록 호출 exit0·receipt 생성, 실제 CurrentUser Root 정확 지문1·새 root ACL 제한을 독립 조회했다. sandbox Root 조회0과 실제 조회1 차이를 구분했다. 공개 지문/기한·회수 대상은 DEVELOPMENT_ENVIRONMENT, 키 원문0이다. 기존 root `.gitignore`의 기존 내용을 보존하며 신규 `.av3-data/` 한 줄만 추가해 키 Git 제외를 확인했다.
- 코드 독립 검토 C0/I2/M0의 자원 부재 오판·DB endpoint 미결박을 각각 조회실패 즉시중단+신규 instance label/ID/image 확인, 공통127.0.0.1:5546/DB/role 검증+실제 연결 신원 확인으로 보완했다. scoped 재검토 C0/I0/M0. 음성 RED2→GREEN2·단위12 PASS, 타입 user 추론 오류1을 정확 역할 const로 정정해 typecheck PASS. 실제 DB/제품 업무 PASS는 아직 아님.
- 기본 실행에서 Git diff만 ‘must be run in a work tree’2회인 반면 root/branch 읽기는 성공했다. 읽기 진단·실제 허용된 diff exit0으로 실행 환경 제한을 분리했고 Git config/index/HEAD를 수리하지 않았다. 잘못된 trace config 진단 인자1은 실행 실패로 남기며 재사용하지 않는다.
- P03 준비 자원 사전 등록: 담당 Main 어울, `D:\tmp\anvil-v3-stage-a\npm-cache`는 npm 공식 registry metadata/lock·의존성 설치 cache이며 P03 준비 종료 때 정확 경로만 제거하고 잔여 확인한다. 제품 node_modules는 Git 제외·새 branch 소스 범위에서만 생성한다. 기존 cache/ACL/전역 도구는 변경하지 않는다. 신규 의존성은 정확 버전·출처/integrity를 registry에서 읽고 최초 설치는 lifecycle script OFF로 진행한다. 제품 자료 외부 업로드0·실제 Agent 호출0.
- HTTPS 사전 등록: 신규 `D:\Project\Anvil\.av3-data`/`dev-tls` 안에 신규 CA/leaf·private key·공개 receipt만 만든다. Main 어울/P03·후속 실제 HTTPS 개발 검수 소유, 유효7일·CurrentUser Root 신규 CA1개만, 검증 종료/만료 시 receipt의 정확 thumbprint를 회수한다. 새 보호 경로는 현 사용자/SYSTEM만 접근하도록 설정하되 기존 ACL/LocalMachine/인증서·공유 proxy는 변경하지 않는다. 기존 .av3-data가 생겨 있으면 덮거나 재생성하지 않는다.
- 실제 소규모 검증: 설정·health/구조화404의 assertion RED4→GREEN4, 정규화/중복key·잘못된 값/참조의 RED4→GREEN4, 합계 단위8 PASS·typecheck PASS. Web build는 sandbox EPERM1 뒤 허용된 실행에서 14모듈 PASS, 기존 서비스 영향0. 정확 package99 설치/lifecycle OFF·lock144 항목; optional macOS fsevents의 설치 스크립트는 실행하지 않았다. 이것은 환경 틀이며 UI/FN 업무 완료0이다.
- 사전 WSL 조회: private Git main 접근·신규 source/protected 경로 부재·부모 실경로·UID/GID1000·기존 node24.21.0과 후보 PG15/Node24 이미지·포트3830/5546·신규 container/network/volume 부재 확인. Docker image ls의 repository2개 인자 오류1은 해당 읽기만 올바른 filter로 정정했다. 자원 생성0, 기존 Agent/인증/DB 설정 변경0.
- 최소 실행 설정 검사 파일을 먼저 작성했다. 최초 실행은 app/config 파일 부재로 module-load 오류2이며 유효 동작 RED로 세지 않았다. 최소 시험 진입점을 만든 뒤 실제 assertion RED→필요 구현→GREEN으로 확인한다.
- 담당 Main 어울. 질문 `call_f2cd20981cc64d83aceff512225037b5`의 직접 응답 3개를 확인했다. `새 Stage A 기준선·private push 승인`: 기존 branch/미커밋/삭제 보존, 최신 지정 private main에서 `codex/av3-stage-a` 예외 생성·manifest의51파일과 계획 범위 신규 v3 코드/테스트/실행 문서만 지정 branch로 commit/push. Backup·legacy 제품·Secret·다른 프로젝트 제외, main 쓰기/force/history rewrite 금지.
- `새 전용 개발 자원 준비 승인`: 공통3830·WSL `/home/daon/deploy/anvil-v3`·신규 전용 PG/network/volume/DB/role·승인 v3 migration/합성 QA·loopback5546·로컬 `.av3-data`/신규 backup. 기존 DB/사용자/컨테이너/인증/proxy/운영/Oracle 변경0, 전용 개발 DB는 보존·일회성 QA만 정확 정리. 실제 유료 Agent 호출 제외.
- `개발 인증서 생성·현재 사용자 신뢰 승인`: 신규 개발 CA/leaf7일·보호 저장·새 CA 정확 thumbprint1개 CurrentUser Root에만 추가/검증 종료 또는 만료 때 회수. 기존 인증서/LocalMachine/공유 proxy 변경0, 키 Git/로그0. 상세 대상은 DEVELOPMENT_ENVIRONMENT와 결박한다. 아직 생성/전송/신뢰 변경 결과가 아니다.
- 재개 실제 상태: 기존 HEAD/branch·삭제852/수정3·staged0 불변. P01·지원/설치 조사·이미 확인한 기능은 반복하지 않는다. P02 계약 최종 누락/명칭 대조 후 P03에 착수한다.
- 도구 오류: 첫 선택 읽기 명령의 PowerShell 미지원 brace 경로 구문 때문에 parser 오류1·명령 미실행이었다. 명시 경로 목록으로 고쳐 읽었다. 이전 sandbox SSH/소켓 접근 제한과 elevated 실제 읽기 성공은 제품 장애와 분리하며 ACL/서비스/네트워크 변경0.

### 2026-10-16 P02 후속 코어·TD-02 전용 로그인 승인

- 후속 직접 결정: 신산님 **‘P02 기본 정책안으로 설계 확정’**, 질문 `call_dca9f14d6c23489b9baa952bb9600508` 응답을 TD-03/TECH_DECISIONS §12에 기록했다. 인증 만료·유한 크기/spool·단절/자동 범위·실패/호출·단독 writer·수동 backup/자동 삭제 OFF의 상세 설계 승인이고 실제 자원/비용·Secret·private 업로드/배포 허가는 아니다. 이전 ‘제안/검토 전’ 기록은 당시 사실이다.
- 후속 계약: INTERFACES §12~15·DATA_MODEL §9~11에 연결/등록·정규화 어댑터·비밀 없는 관측/spool/연속 ACK·실제 소유/회수, 임무/하위 scope·자동/건별/queue·결과/검수·checkpoint/부분 변경 분리·이전·제어 인수·backup/복원·중요 알림/설치형을 이어 작성했다. §15는 생성 전 직접 방법론 graph 저장/확정·범위가 제한된 draft 명령·실제 내용 검토/참여 변경·typed 조건/codec·catalog migration 선행의 누락을 보완했다. 모든 업무를 완료했다고 표시한 것이 아니다.
- OS 경로: TECH_DECISIONS §11에 Node 실행기+작은 Windows C# helper의 내부 상세안을 두었다. 기존 compiler2경로의 파일/version `4.8.9221.0`만 읽었고 실행/build/설치/Agent 시작0이다. 정확 helper/bridge/시험 파일·Job Object 후보와 한계·DPAPI 사용자 범위/평문 fallback 금지·공개키 지문/일회 challenge의 범위를 명시했다. 실제 소유/이탈/회수·서명/보호 저장 검수는 아직 미실행이다.
- 재개 판정/담당: 앞선 목표 turn은 초기 연산/물리 명세·WORK_STATUS를 바꾼 실제 진척이다. Main 어울, 계획 P02를 이어 수행하고 P01/완료 자료·Agent 버전/설치 조사를 재실행하지 않았다. HEAD `ef80f61c1e82ec7a70d319efb5c76061111f9228`, branch `codex/anvil-public-ui-preview`, 기존 tracked 삭제852/수정3·staged0에서 재개했다. 전체 목표는44업무이고 P02 완료가 아니다.
- 직접 결정: `call_99470fca48514e588fa272e66665be52` 응답 **‘Anvil 전용 로그인으로 설계’**를 확인했다. TD-02 1안(전용 사용자명/비밀번호+서버 세션) 선택이며 별도 OIDC/실제 사용자·DB·권한·Secret·서비스 변경·새 비용 승인이 아니다. TECH_DECISIONS §9·진입점/개발환경에 기록했다. 이전 일자의 ‘미선택/미답변’은 당시 이력으로 유지한다.
- 연산/저장: INTERFACES §10·DATA_MODEL §7에 FN11 요청/결정/일회 소비·본문/세대/정책·감사/거절·원자성, FN04 양방향 추적/AF04 업무계획·두 선행/영향 UNKNOWN/승인·계획 적용, FN05 원문/헌법·가설/결정/이유·정정/제외/공유·manifest·분할/후속 전달·6항목 이해/확인 주체를 추가했다. 실제 처리/DB 검증은 아니다.
- 인증 상세: INTERFACES §11·DATA_MODEL §8에 초기 claim/초대·로그인/로그아웃/재인증/비밀번호·복구/회수, 비밀 없는 감사·CSRF/cookie/세션/credential gate를 작성했다. 비밀번호를 일반 command/hash·로그에 넣지 않는 예외와 응답 유실 시 비밀 평문 재보관 금지를 명시했다. 수치 profile은 검토 제안이며 실제 적용하지 않았다. 신규 사용자/계정/키 생성0.
- 연결 보완/파일: 프로젝트 생성 전 방법론/양식 카탈로그 경로와 새 상세 operation의 기존 명시 목록을 맞췄다. FILE_MAP §7/8은 기존 소유 모듈·schema/시험을 연결했다. 로그인/회수의 실제 UI 구현은 승인 공통 인증 상태와 연결해 후속 배정하며 새 화면을 완료했다고 표시하지 않는다. 변경 계약/진입점·WORK_STATUS 이외의 사용자 자료/Backup는 보존한다.
- 근거/오류/미검증: OWASP 인증·세션·비밀번호 보관·CSRF 공식 문서에서 관련 보호 원칙을 확인했고 제품/도구 재실행은0이다. patch 작성 중 혼입 문자를 대조해 정정했다. 인증 라이브러리/정확 버전·정책 값/보호 키·실제 HTTPS/DB·행 경쟁/회수·제품 검증은 미실행, P02 [2]·P03 []·제품 미구현을 유지한다. 새 임시 자원·commit/push0. 다음은 도구 등록/OS·실행/관측/회수·나머지 FN 계약과 정책 검토다.
- 변경 문서 검증: 새 공개 명령4개의 기존 enum/본문 연결, 6항목 이해 코드, 인증 경로11개, 주요 저장 참조21개, 인증 시험 파일2개, TD-02 직접 선택의 manifest 단일 기록을 PowerShell로 대조해 exit0였다. 초기 계약 회귀도 연산19/초기 테이블21/소유4·변경 계약 표34개의 열수/manifest35 hash·크기/설계·계획 hash 불변·diff check exit0를 확인했다. 이것은 문서 검사이지 실제 구현/보안 합격이 아니다. 검사 중 FN05 표2행이 두 열 헤더 아래 세 열로 작성된 오류1회를 찾아 보호 설명을 두 번째 열에 합치고 fresh exit0를 확인했다. 이전 nullable 표 구분 문제와 함께 작성 시 표 폭을 사전 대조하는 것으로 조치하며, 세 번째 연속 동일 원인이 발생하면 직접 작업도 중단/예외 보고한다.

### 2026-10-16 계획 순서 재개 — P02 초기 저장 연산·물리 계약

- 지시/담당: 신산님 ‘작업 계획서의 순서와 내용으로…이전 작업을 이어서’, Main 어울. P01 완료·설계 r8/계획 r7 검토 반영을 반복하지 않고 P02 미완료의 연산/저장 명세에서 재개했다. 별도 임의 계획/새 업무 ID·Agent 세션/자동화를 만들지 않았다.
- 시작 증거: PMO/프로젝트 운영 진입점·WORK_STATUS·계획 P02 카드·설계/양식·DEVELOPMENT_ENVIRONMENT·현재 계약을 대조. branch `codex/anvil-public-ui-preview`, HEAD `ef80f61c1e82ec7a70d319efb5c76061111f9228`, staged0·tracked 삭제852/수정3 유지. origin은 다른 저장소이므로 쓰기0, development만 기존 지정 원격으로 확인했다. 설계 hash `63FD6C2E43689668345BC529F925C1BEF823833E88D59EA99310C301D1854BD3`, 계획 hash `8F5E2507E26FF4EA1B0376364365FA7C661E96B407A93E2F4BD56D6795B66727` 불변.
- 이번 작성: INTERFACES §9에 공통 참조/원문 hash·입력 검사·초안/프로젝트·방법론 graph/복사/확정/적용·양식/본문/제안/구버전 조회·stale/타 프로젝트/허위 검토 거절을 상세화했다. 기존 FN03 사용자 양식 요구의 명세 누락은 공개 명령 목록에도 맞췄으며 실제 API를 배포한 것은 아니다.
- 저장/파일: DATA_MODEL §6에 초기 테이블·타입/키/복합 참조·불변 내용/결정 이력·프로젝트당 초기 제어1행·command 중복/원자성·파일/DB 중간 실패·초안 귀속·migration 소유/검수를 작성했다. FILE_MAP §6은 기존 정확 schema/시험 파일을 연결했다. 기능 카드 머리말의 남아 있던 r5 라벨만 현행 r7로 정정했고 카드 범위/상태는 바꾸지 않았다. TECH_DECISIONS §10의 잔여 표로 완료/미결정을 구별한다.
- 기술 근거: PostgreSQL 공식 제약/행 잠금 문서를 확인해 다른 행 정합성을 CHECK에 맡기지 않고 복합 FK·UNIQUE·명령/버전 경쟁 검수를 명세했다. 실제 DB 제약/경쟁 시험은 실행하지 않았다. 기존 Agent 공식/설치 조사와 P01 브라우저 검사는 재실행0.
- 오류/자체 대조: 최초 INTERFACES patch의 잘못된 context1회는 적용 전 거부, 실제 마지막 문단을 기준으로 재작성했다. 작성 중 혼입 문자/구두점과 조회 validation 응답에 없는 validationRef 사용을 자체 대조에서 정정했다. 제품 오류/TDD 결과로 계산하지 않는다. PowerShell 다중 파일/대량 Git 목록 출력은 일부 잘려 이후 필요한 문서와 집계로 범위를 좁혔다.
- 경계/미검증/다음: 현재는 계약 작성이며 기능 추가로 실제 사용 가능해진 화면은 아직 없다. TD-02 미선택, 나머지 연산/보호/등록·OS·정책 미완료로 P02는 [2] 유지, P03/제품 코드/SQL·DB/서비스·실제 Agent/계정/Secret/비용·commit/push0. 다음은 TECH_DECISIONS §10의 순서로 이어가며 같은 완료 자료를 다시 검증하지 않는다. 기존 dirty/untracked/Backup 보존, 새 QA 자원 생성0·정리 대상0.
- 변경 문서 검증: PowerShell inline 검사에서 INTERFACES §9의 연산19개 존재·새 양식 연산3개의 기존 명령 목록 연결·물리 테이블21개의 정확 이름/중복 없음·소유4업무 연결·변경 계약 문서 표24개 열수·혼입 문자/미정의 validationRef 없음·manifest35파일 hash/크기 일치, 설계/계획 hash·HEAD 불변과 staged0를 확인했다(exit0). `git diff --check -- AGENTS.md docs` exit0. P01/Agent/제품/DB 검사는 변경 대상이 아니므로 반복하지 않았다. 이는 문서 정합 확인이며 실제 schema/SQL/권한/기능 테스트 합격이 아니다.
- 검사 중 보완: 수기 예상 테이블 수24로 검사한 오류1회는 표의 실제21개 이름 목록으로 바로잡았다. 이어 INTERFACES 두 표 행의 nullable 타입 `|`가 Markdown 열을 나누는 문제1회를 발견해 ‘또는 null’로 수정하고 같은 검사를 fresh exit0로 확인했다. 제품 합격 기준을 수정한 것이 아니며 schema 미완료/TD-02 미선택을 그대로 유지한다. BASELINE_MANIFEST는 실제 변경한 계약5파일의 hash/크기를 갱신했고 과거 승인 기록·시안 hash·설계 r8/계획 r7는 변경하지 않았다.

### 2026-10-16 Word 검토의 필요한 부분 본문 반영 — 설계 r8·계획 r7

- 지시/담당: 신산님 ‘필요한 부분만 설계서와 작업계획서에 반영해’, Main 어울. 검토의 권고를 그대로 실행하지 않고 기존 요구 내 필요한 상세화만 선택했다. 제품 구현/전체 목표 완료가 아니다.
- 변경 전→후: 설계 §2.4에 문서 상대 링크와 sourceRootId/root 상대 기계 경로 해석을 구별했다. 링크에 docs/를 일괄 붙이지 않는다. §9.1.1에 UI11 전 FN06의 인증된 API/개발 시험 진입과 실제 사용자 흐름 완료의 구분을 명시했다. §7.4.1/S05/S09에 현재 변경 계속 보완 또는 보존 검증/정확 승인 후 범위 복원을 정의했다. 미추적/바이너리·삭제 상태/사용자 혼재·직전 hash 변경을 검사하고 자동 reset/stash/clean은 추가하지 않았다.
- 전달·보호: §8.1.1은 Anvil 조회 후 분할/후속 전달을 기본으로 하고 로컬 참조 사본은 능력·허가/위치·범위/hash·읽기 통제·수명/정리 조건에서만 허용했다. 서버 링크 전달만으로 실제 접근/이해 합격 금지. §10.5에 spool/참조 캐시/백업 사본의 식별·전송/조회/복원 제한·관리 메타데이터 격리와 새 마스킹 ID/hash·승인/대체본/복구 검증 후 정리 조건을 연결했다. ACK만으로 즉시 파기하거나 원 관측/번들 hash를 덮지 않는다.
- 화면/계획: S06 문서 목록을 공식8종+헌법으로 맞췄다. 계획 등록부44행을 착수 선행/완료·연결검수 선행2열로 구분했다. UI01~14 뷰는 UI00·해당 P01/P02/P03 계약을 대조해 착수하지만 부분 구현이며 기존 완료 선행 목록은 유지한다. P/FN/IX는 원래 선행을 두 열에 동일하게 기록했다. 계획 §2.2.1에 R-01~07의 P02/FN/UI/IX 책임·검수, §3.2에 경로 기준을 명시하고 SCREEN_WORK 공통 계약에 두 선행 축의 소비 기준을 연결했다.
- 이력/범위: 변경 전 설계 r7 hash `2C9E688BC85ACC506A62B753673BC1B91CCE588610972B5FE3999DB723E73F6A`, 계획 r6 hash `A822D0FDF8C034F4BF268CFF559098D8107982836BF1A632D92A1F41429C4B2A`를 design/history/Anvil_설계서_v3_r7_20261016.md와 work_packages/history/pre-word-review-20261016/WORK_PLAN_r6.md에 텍스트 보존했다(줄바꿈 정규화 가능성/과거 승인 hash와 구별). 현재 설계 hash `63FD6C2E43689668345BC529F925C1BEF823833E88D59EA99310C301D1854BD3`를 계획에 결박하고 관련 진입점/계약 머리말의 개정 참조를 동기화했다. Word 원본·승인 시안/양식은 변경하지 않는다.
- 오류/조치: 두 문서 patch에서 뒤쪽 hunk 뒤에 앞쪽 행을 찾도록 작성해 context 검증이 적용 전 거부된 경우2회가 있었다. 실제 본문을 읽어 해당 파일의 미적용을 확인하고 hunk를 문서 순서로 배치해 적용했다. 계획 표에 불필요 공백 행1건은 즉시 제거했다. 오류를 제품 실패/RED로 쓰지 않으며 최종 표·공백 검사를 수행한다.
- 실행 경계/미검증: 단일 Main 문서 writer, 제품 코드·새 Agent 호출·서비스/DB·권한/Secret·계정·예약·새 branch·commit/push0. 실제 소스 복원/스풀·백업 생성/삭제0. 기존852삭제/수정·미추적 자료 보존. P02의 전달/복구/격리 계약 상세와 실제 시험은 미완료이며 전체44업무 집계는 P01완료1/P02작업중1/미착수42 그대로다. Stage 의무 대기·경미 변경 승인 생략·새 범용 Git/규칙 엔진은 추가하지 않았다.
- 최종 문서 검증: 읽기 전용 PowerShell 검사 exit0. 등록부44/카드44·중복0, 기존44행의 이름/Stage/완료 선행/상태 동일, UI01~14 착수 선행 분리14, 두 선행 그래프 순환0·미정의 ID0, IX01 FN11 유지. 설계 hash→계획 결박 일치, manifest35파일 hash/크기 일치, 현행 상대 링크88개 유효, 표34개 열수 일관, 위협12행/추적19행 본문·파생표 동일. 검토 원본·승인 시안/양식8개 hash 불변. 변경 전 r7/r6 보존본 hash도 관측 원본과 일치. `git diff --check -- AGENTS.md docs` exit0, HEAD/branch 불변·staged0·기존 tracked 삭제852/수정3 유지. manifest 자체와 동적 WORK_STATUS는 hash 목록에서 제외했다. 제품·Agent·DB·런타임 검증 PASS를 뜻하지 않는다.
- 검사 도구 오류 구분: 최초 로그인 PowerShell 프로필의 conda 시작 오류가 출력됐으나 문서 읽기 exit0였으며 후속 검사는 프로필 없이 수행했다. S06 확인식이 ‘테스트 결과서’ 띄어쓰기를 누락한 경우1회, 추적표 확인식이 실제 F01/절 번호 대신 AV3 접두사를 가정한 경우1회는 검사식 오류다. 실제 본문 대조 후 확인식만 정정하고 각각 fresh exit0를 확인했으며 문서 합격 기준을 완화하거나 원문을 검사에 맞춰 바꾸지 않았다.

### 2026-10-16 재검토의 필요한 부분만 반영 — 설계 r7·계획 r6

- 지시/담당: 신산님 ‘필요한 내용만 반영해’, Main 어울. receiving-code-review로 앞선 판단 중 타당한 보완만 채택하고 verification-before-completion으로 문서 변경 범위를 검증한다. 본문/카드 개정이며 제품 기능 성과로 세지 않는다.
- 변경 전→후: IX01에는 기존 타 프로젝트 조회와 FN04→FN11 간접 선행이 있었으나 만료·초기 제어 세대 사례가 명시되지 않았다. 계획 등록부/IX01 카드에 FN11 직접 선행·TC08과 두 QA 프로젝트의 ID/첨부/검색 격리·만료/옛 세대 변경 거절·부작용0을 명시하고 설계 TM07/추적표에 Stage B 검수를 연결했다. FN15 인수 기능은 Stage E 그대로다.
- P02 보완: 후보별 공식 조사가 있었으나 완료 표 형식이 없었다. 설계 §9.1.1·계획 §2.2·P02 카드에 필수6능력×후보 표를 고정하고 CAPABILITIES §7에 기존 조사 기반 6×4 표를 작성했다. 공식 경로 후보/설치 버전 적합성·실측 미확인/통제 한계를 구분했다. 버전/도움말·Agent 실제 호출을 반복하지 않았다.
- 기타 필수 보완: §11.1/12.3을 본문12·작은 설명10·보조 설명9px로 통일했다. 기존 FN10/11의 비용 통제·TM08 변조를 없던 것으로 취급하지 않고 TM10 비용 누적/관측 한계·TM11 공급망/산출물 검증·TM12 관리자와 검증 기준 동시 침해의 한계를 보완해 P03/FN10/11/18·IX03/06에 연결했다. 현재 기준 hash/기존 승인·후속 수정 지시/변경 영향은 설계 §13.5·계획 §6·위임 양식에 결박하고 소급 hash·전면 재승인/Stage C 의무 대기는 추가하지 않았다.
- 보존/변경 파일: 변경 전 설계 r6/계획 r5를 각각 design/history/Anvil_설계서_v3_r6_20261016.md, work_packages/history/pre-rereview-20261016/WORK_PLAN_r5.md에 텍스트 보존했다. 줄바꿈 정규화 가능성과 원 관측 hash는 EXTERNAL_REVIEW §6에 남겼다. 설계/계획·기능/통합/화면 카드·위임 양식·CAPABILITIES/THREAT_MODEL/TRACEABILITY와 현행 개정 참조(AGENTS/환경/기술·명령·데이터 계약 머리말)를 맞췄다. 재검토 입력 원본은 변경하지 않는다. 새 설계 hash `2C9E688BC85ACC506A62B753673BC1B91CCE588610972B5FE3999DB723E73F6A`를 계획에 연결했다.
- 오류/미검증: 작업 중 계획 표에 삽입한 불필요 공백 행1건과 문구의 이문자1건을 즉시 정정했으며 최종 표/공백 검사에서 재확인한다. 실행 명령/제품 기능 오류는 없었다. 모든 추가 보안/한도/공급망 검수는 계획 정의일 뿐 실제 시험 미실행이다. 미답변 TD-02·P02 잔여 계약·P03·전체 제품 미구현/44업무 집계는 유지한다.
- 경계: 문서 수정만 수행, 제품 코드·Agent·DB·권한·Secret·계정·서비스·예약·새 branch·commit/push0. 기존852삭제/수정·미추적 작업을 보존한다. N1의 문서 commit은 P03의 정확 범위 선정 과제로 남기며 이 보완을 커밋 승인/실행으로 해석하지 않는다. 최종 정합/보존 검증 결과는 아래에 누적한다.
- 최종 검증: 로컬 읽기 전용 문서 검사 exit0 — 15조건 충족(계획/고유/카드44·의존 순환0, IX01 FN11 직접 선행/조기 사례, 능력6×4 미실측 구분, TM12행과 추적표 일치, Stage 대기 규칙 불변, 설계 hash 결박, manifest32 hash/크기 불일치0, 연결87개 누락0·표 열 오류0, 검토/승인 원본7개 hash 불변, HEAD 불변·stage된 파일0). 보존 r6/계획 r5의 현재 hash도 개정 전 관측값과 일치했다. `git diff --check -- AGENTS.md docs` exit0. 제품/Agent·보안/과금/설치 시험은 실행하지 않았으며 위 검증을 그 PASS로 승격하지 않는다.

### 2026-10-16 P02 검토 보완 — 설계 r6·계획 r5 본문 직접 개정

- 담당/지시: Main 어울. 신산님 ‘반영을 설계서와 작업계획서를 수정해야지’에 따라 별도 보완 문서만 추가했던 방식을 정정해 본문·업무 카드에 직접 반영했다. receiving-code-review 기준으로 기존 합의와 타당성을 대조했고 verification-before-completion 기준으로 문서 정합을 새로 검사했다.
- 설계 변경 전→후: r5의 안전/검수 상세가 별도 문서였고 현재 승인 표기가 과거 상태에 머물렀다. r6의 §2.3 안전 기반 책임, §4.3 양식/드리프트, §5.1 상태, §6.2 이해 6항목, §7.3~4 증거/회수, §9.1.1 역할별 실제 능력 판정, §10 경로/Git/감사·spool/백업, §11 화면 동작, §12.1.1 TM01~09, §13.1.1 추적표·승인/개정 이력에 직접 통합했다. 새 설계 SHA256 `49F353055ABD8DAA1C72741E2DFA1B020957F04284D45CD93300444BC66C8780`.
- 계획 변경 전→후: r4의 선행 보완을 유지하고 r5 §2.2에 설계 절→담당 FN/UI/IX→구현/검수 조건 12묶음, §2.3에 Main 책임 RK01~10과 재검토 지점, 내부 검수점·상태4값·최신 다음 작업을 직접 반영했다. 기준 설계 hash를 결박하고 화면/기능/통합/위임 카드에 해당 조건을 연결했다. 44업무 범위·단독 제어·기존 합격 기준은 유지한다.
- 보존/정본: 변경 전 설계 r5와 계획 r4는 각각 `docs/design/history/Anvil_설계서_v3_r5_20261016.md`, `docs/work_packages/history/pre-integration-20261016/WORK_PLAN_r4.md`에 텍스트 보존했다. 줄바꿈 정규화 가능성과 원래 관측 hash는 EXTERNAL_REVIEW §5에 기록했다. 보존본 안 상대링크는 당시 원본 디렉터리 기준의 역사 텍스트이며 현행 탐색 링크로 사용하지 않는다. 이전 실행안전 보완은 이력으로 표시했다. AGENTS·개발환경·관련 P02 계약 머리말/추적·위험 조회표를 현행 개정과 맞췄고 현재 내용 manifest 29파일을 갱신했다. 과거 승인 hash는 새 hash로 덮지 않았다.
- 검증: 로컬 읽기 전용 문서 정합 검사 exit0 — 계획44/고유44·카드44 일치, 의존 해석44·없는 선행0·순환0, 현재 연결75개 대상 누락0, F01~15/TC01~15 추적 누락0, 설계/계획 기준 hash 일치. `git diff --check -- AGENTS.md docs` exit0. 검토 원본 MD/DOCX와 승인 HTML/양식 hash 불변 확인. 최종 manifest·표/연결 대조는 아래 결과에 누적한다. 제품 시험·불변 P01 검사를 재실행하지 않았다.
- 오류/조치: 첫 보존용 합산 읽기 결과가 출력 한도로 잘려 JSON 해석 실패1회(쓰기 전), 파일별로 분리해 보존 성공. 한 부분행 patch의 문맥 불일치1회는 적용 전 거부돼 전체 정확 행으로 수정했다. Windows rg 파일 glob 입력 오류2회는 읽기 검색 대상 표기 문제로 파일/디렉터리 지정 방식으로 정정했다. 표 삽입 때 혼입된 다음 표 머리말1건은 즉시 제거하고 실표를 대조했다. 최초 PowerShell 프로필 경고는 비로그인 실행으로 분리했으며 ACL·PATH·프로필을 변경하지 않았다. 제품 오류·기능 RED/GREEN 증거로 계산하지 않는다.
- 최종 대조: 읽기 전용 검사 exit0 — manifest29 hash/크기 불일치0, 수정 본문/카드 표 열 불일치0, 본문 TM9·계획 RK10·추적19행과 보조 조회표 차이0, 검토37항목 유지, 최신 현행 링크74개 누락0(이력 링크 기준은 위와 같음), 검토 원본/승인 자산6개 hash 변경0, 설계 기준 hash 일치·HEAD 불변. 불변 제품 검사는 재실행하지 않았다.
- 범위/미검증: 문서만 수정. 제품 코드·Agent 호출·DB·권한·Secret·계정·서비스·예약·원격 쓰기0, commit/push0. 기존 dirty/삭제·미추적 자료 보존, branch/HEAD 불변. TD-02 미답변·P02 잔여 계약/P03/신규 기능은 미완료이며 전체44 완료 집계는 1/0/1/42 그대로다. 다음은 승인 A안 P02 상세 계약이다.

### 2026-10-15 P02 계속 — HTTP 집행 경계·TD-02 인증 선택안

- 제3자 검토 보완 뒤 실제 P02 명세 작성을 재개했다. INTERFACES §8에 Node/Fastify 명시 route·초안/프로젝트 생성·자료 업로드·작업/이벤트 조회, 사용자 명령 enum과 서버 내부 authorize/consume/dispatch·관측의 구분, 오류·재전송 경계를 추가했다. 임의 함수/Plugin 호출, 직접 도구 승인 소비·중복 실행 우회는 제공하지 않는다. endpoint/schema 전체 완성·실제 API 기동을 주장하지 않는다.
- TECH_DECISIONS §9에서 TD-02 인증을 전용 계정/서버 세션(권장)과 별도 사용자 소유 OIDC 연동으로 비교했다. OWASP 인증/세션/비밀번호 보관의 기본 보호 경계를 공식 문서로 확인했다. 실제 계정·비밀·DB/권한/인증 서버는 변경하지 않았다. 로그인 방식 상세 설계 선택만 비동기 질문으로 요청했으며 현재 답변 전이다.
- 도구 오류 추가: 두 파일을 묶은 patch에 이전 문구의 불필요 hunk를 넣어 context 검증이 실패했다(1회). 파일을 다시 읽어 변경 없음/해당 최신 문구를 확인한 뒤 단일 파일·정확 문맥 patch로 수정했다. 앞선 생성 manifest 중복 대상 오류와 각각 기록하며 같은 시도를 반복하지 않았다. 제품 실행 실패·권한 변경은 없다.
- 미완료: 인증/등록·OS 회수/보호 저장·전체 연산 필드/권한/물리 저장·측정/보존 정책, P03 기준선/환경/실제 명령과 모든 제품 기능. P02 [2], 완료 집계 불변이다. 완료 P01과 불변인 제품 시험을 다시 실행하지 않았다.

### 2026-10-15 제3자 검토 대조·설계 안전 상세와 계획 r4 보완

- 지시/판정: 신산님은 타인의 의견을 정답으로 취급하지 않고 타당한 부분 보완 후 계속하라고 지시했다. P02 신규 파일 명세 작업을 잠시 멈추고 Markdown 검토 전체 및 Word 본문44문단/표·삽입 문서 아이콘을 확인했다. Word 서식/페이지 레이아웃 평가는 미실행이며 새 DOCX를 만들지 않았다. 원본 두 검토 파일은 보존했다.
- 항목별 판단: [외부 검토 대응](04_test_reports/AV3/P02/EXTERNAL_REVIEW.md)에 Markdown29항목·Word8묶음의 현재 근거/수용·이미 해소·미채택을 기록했다. P01 상세/내장 방법론·TD-01 직접 승인을 현재 사실로 대조했으며 ‘일단’을 근거로 원 승인을 잠정/P01~03으로 축소하지 않았다.
- 실제 보완: root AGENTS의 v3 진입점, 실행안전 보완 r1, 계획 r4/기능·준비·위임·UI00 카드. FN01 인증/초기 제어, FN11 변경 권한/감사, FN06·FN08의 FN11 선행, FN15 기반 소비, FN16 불필요 FN17 선행 제거, 큰 업무 내부 검수점·조기 능력 gate·독립 증거/이해 기준·문서 드리프트/경로/노출 대응을 명료화했다.
- 추가 명세: THREAT_MODEL 위험/시험 책임, TRACEABILITY 다대다 표, FILE_MAP 인증/audit 책임, DATA_MODEL 원본/투영과 통제 기반, INTERFACES 공식 상태 축. 미지원 도구/안전 회수는 실측 미검증이며 문서 존재를 보안/연동 PASS로 바꾸지 않는다.
- 미채택: 전체44업무 필수 범위 축소, 모바일 별도 승인 위임, 자동 timeout 강제 종료, 모든 시험 무조건 재실행, 고정1-hop 맥락 삭제, 자동 Plugin 로딩·임의 archive branch/일괄 Git 정리·폰트 일괄 변경. 현 요구를 바꿀 제안은 실행하지 않았다.
- 보존/변경 이력: r5·P01 승인 HTML·공식 양식은 변경하지 않았다. 계획/기능·준비·위임 카드의 변경 전 텍스트를 history/pre-review-20261015에 보존했다(줄바꿈 정규화 가능, 원 승인 바이트/hash 재현이라고 주장하지 않음). root/문서 이외 제품 코드·Agent/DB/권한·서버·원격 변경0.
- 오류: AGENTS 포함 diff check에서 기존 문장의 후행 공백1건을 검출(exit1)해 비의미 공백을 제거했다. 실행 장애/제품 실패가 아니다. 제품 검사는 코드/환경 불변이므로 반복하지 않았다. 전체 완료 아님, P01 완료/P02 진행/나머지42개 미착수 유지.
- 문서 검사: 계획44개/고유44·누락 선행0·순환0, 내용 manifest26개 hash 불일치0 확인. 상대 링크 검사에서 보존 방법론 사본의 이동 후 공통 기준 링크1건을 찾았다. 승인 원본/hash는 그대로 두고 별도 링크 안내 파일을 추가해 현재 기준과 승인 당시 바이트를 구분했다. 원 검토2종·r5/P01 HTML/양식 hash 불변을 재확인. 검사 결과는 문서 정합 범위이며 제품 PASS가 아니다.
- 도구 오류 구분: 생성 manifest를 같은 patch의 Delete/Add로 갱신하려다 도구가 중복 대상 문법을 거부했다(1회, 원본 삭제/변경 없음). 같은 파일의 단일 Update로 바로잡았다. 권한/정책 우회나 Git 삭제가 아니며 실행 장애/제품 실패와 구분한다. 링크 안내 추가 후 현재 manifest는27개 내용 관측이며 과거 승인 원문/hash는 보존한다.
- 최종 문서 재검사(19:53 KST): manifest27개 불일치0, 현재 참조 링크 누락0, 검토37항목/고유37, F01~15·TC01~15 추적 누락0. `git diff --check -- docs AGENTS.md` exit0. 테스트는 문서의 ID/연결/hash 검사이며 실제 사용자 흐름/DB/Agent/보안·Oracle 검증은 전부 별도다. 타당한 보완 후 A안 P02 인증/실행기 등록·연산·저장 명세를 계속한다.

### 2026-10-15 19:35 TD-01 A안 직접 승인·P02 파일 책임 명세

- 신산님 직접 응답 ‘A안으로 설계 확정’을 TECH_DECISIONS에 기록했다. 이전 TD-01 선택 대기 조건은 해소돼 문서 작업을 재개했다. 선택 질문 ID call_40a3fa97fcbc4300bc88198939f443a0. React/TypeScript·Node/Fastify·Electron·PostgreSQL/파일의 상세 계약 범위이며 실제 Agent 호출/DB/권한/배포로 확대하지 않는다.
- FILE_MAP.md를 추가해 공통/UI15·FN18·IX 시험의 정확 파일/소유와 생성 전 경계를 명시했다. 제품 파일을 생성하지 않았다. OS process/Secret binding·구체 인증/등록·데이터/보존 정책과 실제 계약/검증은 남았다.
- 승인 전 TECH_DECISIONS 관측 hash 6C8C8FA9F9F4D7D825BF66C63A3F320351FAF6CA85DCD6BC81569E71028FB4C5를 확인했다. 승인 내용은 TD-01 A구성에 한정하며 §5·7·8의 미결정 사항까지 승인된 것이 아니다. branch/HEAD는 ef80f61c1e82ec7a70d319efb5c76061111f9228 불변이다.

### 2026-10-15 18:56 P02 승인 경계 재대조·목표 차단 판정

- 직전 목표 turn은 DATA_MODEL·UI/FN 매핑·명칭 정합·측정/보존 제안 추가와 문서 검증으로 **진행**했다. 실행 중 프로세스 대기를 주장하지 않는다.
- 동일 경계 점검: P01 승인 응답 turn의 TD-01 요청 → 다음 목표 continuation의 독립 정리 → 이번 continuation까지 기술 선택 응답이 없다. 직접 답변으로 확인된 승인은 P01 시안·양식뿐이다. 이 3개 연속 목표 turn의 TD-01 경계를 같은 조건으로 집계한다. 사용자 질문을 재전송하거나 일반 계속 지시를 A안 채택으로 해석하지 않는다.
- 판단 이유/영향: P02는 기술 선택과 실제 파일/모델/연산 계약을 확정해야 끝나고, P03은 수용된 P02를 요구한다. 후속 제품 업무는 P03을 선행한다. 기술 독립 지원 조사·공통 관계/연산·정책 측정안은 정리했으며 남은 파일 타입/물리 구조·인증/보호 경계·실행 검증은 사용자 설계 결정 없이 확정할 수 없다. 문서를 반복 생성하거나 이미 완료한 P01을 재검증해 진도로 대체하지 않는다.
- 조치: 전체 계획 목표를 완료/축소/사용자 중지로 바꾸지 않고 실행 상태만 `blocked`로 전환한다. P02 산출물은 초안 그대로 보존, P01 [0]/P02 [2]/그 외42개 시작 전 유지. 신규 오류0, 제품/DB/권한/배포/원격 변경0. 실제 branch/HEAD는 직전과 동일함을 재확인했다.
- 정확한 재개 조건: 기존 TD-01 질문에 A/B/C 또는 수정 구성을 신산님이 직접 결정하면 해당 구성의 FILE_MAP·연산별 schema·물리 데이터·남은 정책 결정을 이어간다. 기술 선택 승인을 Agent 호출·DB·권한·배포 승인으로 확대하지 않는다. 이번 차단은 전체 완료보고가 아니다.

### 2026-10-15 P02 기술 독립 관계·매핑과 측정/보존 제안

- 앞선 목표 turn 판정: P01 사용자 승인 기록·상태 변경 및 P02 계약 초안 추가로 **진행**했다. TD-01 직접 응답은 아직 없으며 단순 시간 경과를 승인이나 실행 중 증거로 취급하지 않는다. 이번에도 해당 기술 선택을 확정하지 않았다.
- 담당/기준: Main 어울, P02 [2]. branch/HEAD 불변. tracked 삭제852/수정3과 새 문서가 있는 상태를 읽기 확인했으며 기존 소유 자료를 복구/일괄 stage하지 않았다. 제품 코드·새 자원 생성/원격 쓰기 없음.
- 산출: DATA_MODEL.md에 프로젝트·방법론/양식/문서·지식/원문·임무/세션·명령/관측·승인/회수/인계·백업·알림/패키지 관계와 보존·3상태축·파일/DB 중간 실패를 상세화했다. 물리 테이블/경로/schema 승인이나 migration 실행이 아니다.
- 명세 대조: INTERFACES.md에 FN01~FN18 대표 연산/입출력·실패 경계, UI00~UI14 소비 표를 추가했다. FUNCTION_WORK와의 expectedVersion 명칭 및 commandId/operationId 역할 불일치를 정정했다. 대표 함수 외 조회/초안/정정/정책 연산의 후속 상세 필요를 명시했으며 누락0·P02 완료로 과장하지 않는다.
- TECH_DECISIONS §7~8에 기초 표본·환경/성능/회수/손실 측정과 백업/보존·단절 정책의 결정 순서를 제안했다. 임의 숫자 합격, 자동 삭제·외부 보관·기존 Backup 경로 채택, 실제 모델 호출은 하지 않았다.
- 오류/미검증: 신규 실행 오류0. 문서 정합 보완이며 제품 테스트 미실행, endpoint/schema/파일 확정·기초 실측·인증/비용·실제 저장/Agent 연결은 남았다. TD-01 답변 후 선택 구성의 물리 계약과 파일 책임으로 이어간다. 완료 P01 검사를 반복하지 않는다.
- 문서 검사: PowerShell 정규식으로 INTERFACES 표의 FN01~18/UI00~14 누락 각0, expectedVersion 있음/expectedRevision 없음 확인 exit0. 이는 ID 행의 존재 검사일 뿐 schema/기능 완전성 합격이 아니다. `git diff --check -- docs` exit0. 확인 시각 18:55 KST.

### 2026-10-15 P02 TD-01 선택 요청·공통 계약 초안

- 판정: Main 어울, P02 [2] 유지. TECH_DECISIONS.md에서 A(TypeScript/Node/Electron), B(Python 서버/실행기), C(.NET 서버/실행기)의 장단점·가역성·안전 경계를 비교했다. A 권장은 제안이지 채택 결과가 아니다. 신산님께 TD-01 한 가지 설계 결정을 비동기로 요청했다. 현재 답변 대기이며 P02 완료/제품 착수 승인으로 표시하지 않는다.
- 독립 수행: INTERFACES.md에 Anvil ID/외부 핸들 분리, 서버 권한 확인, 명령 저장→전달, 같은 key/다른 본문 충돌, 미확인 부작용의 재실행 금지, 순번/ACK/spool, stale 관측과 현재 권한 분리, 제출/검수 및 중지/회수 상태 구분을 정리했다. 전체 UI/FN endpoint/schema·물리 데이터·파일 매핑은 미완료다.
- 공식 근거: Electron 보안/safeStorage, Fastify schema 신뢰 경계, Microsoft Windows Job Objects, PostgreSQL 트랜잭션 격리 공식 문서를 대조해 선택안에 직접 연결했다. Windows 보호 저장이 같은 사용자 앱을 완전히 격리한다거나 Agent interrupt가 모든 자식 프로세스를 중지한다고 주장하지 않는다. Node24 child_process 공식 페이지 접근 Internal Error1회는 미확인으로 분리하고 반복 조회하지 않았다.
- 기록 정합: P01 README의 미승인 문구를 REVIEW-02 승인 참조로 정정했다. 읽기 실패를 강제로 시험했다는 README 표현은 실제 fixture와 맞지 않아 ‘읽기 성공/형식/크기 시험, 강제 text() 예외 미검증’으로 바로잡았다. 승인 HTML/양식 본문과 hash는 불변이다. 코드/환경 불변이므로 이미 통과한 시안 전체 검사를 다시 실행하지 않았다.
- 검증/보존: 승인 hash2종 재확인, `git diff --check -- docs` exit0(비추적 새 문서의 완전성 검증을 뜻하지 않음). branch/HEAD 불변, 기존 삭제/dirty 보존. 신규 설치/프로세스/컨테이너/DB/Secret/원격 쓰기0. 후속 사용자 선택 전 의존 계약을 임의 확정하지 않는다.

### 2026-10-15 18:41 P01 승인 완료·P02 공식 지원 조사

- 판정: Main 어울. 신산님 직접 응답 ‘P01 시안·양식 승인’을 REVIEW-02에 기록하고 P01 [0], P02 [2]로 등록부/요약을 맞췄다. 전체44 업무 중 준비1개 완료이며 제품 UI/FN/IX는 미구현이다. 전체 계획 목표는 계속 유지한다.
- 기준: branch `codex/anvil-public-ui-preview`, HEAD `ef80f61c1e82ec7a70d319efb5c76061111f9228` 불변. 기존 보관 정리의 삭제·dirty/untracked를 보존했다. commit/push·새 실행 자원·DB/권한/배포 변경 없음.
- 승인 결박: HTML SHA256 `8B76BDE3EC24FBF37EBD53CF459D454C820098E1097171E60789C1AAC47A51D4`, 공식 양식 SHA256 `622FFC6DB4CCC26AE07C785C91B114467019B21571B728A71DEA05D206816B13` 재확인. 두 승인 원본 내용은 변경하지 않았다. 시안 승인에 실제 Agent/DB/권한/배포를 포함시키지 않는다.
- P01 후속 보완 증거: verify.cjs exit0(14경로×8상태 VM 렌더 및 주요 양성/음성 계약). 실제 브라우저의 파일 선택/탭 읽기·줄 비교, 만료 미전송 보존, 인계 미지원 차단, 계획 개정 전 재개 차단, 모바일 AP-01 중복 결정 차단, 지식 원문 보존, 기존 소스 접근불가 예시, 빈 목록→4단계 생성, 초기화 재확인을 확인했다. v13 증거와 한계는 REVIEW-02에 연결했다. beforeunload 실제 팝업과 전체112조합 실제 브라우저는 미검증. 실제 제품 시험 아님.
- P02 조사: CAPABILITIES.md에 Codex0.161.0 app-server 도움말, Claude Code2.1.224 CLI 도움말과 공식 API/인증 경계를 정리했다. Node24.18.0·npm11.12.1·Python3.14.3 확인. 실행 명령은 버전/도움말·파일 읽기뿐이며 실제 모델 호출·인증 정보 읽기·계정 변경 없음. SDK/CLI의 허용 방식·기술 스택은 미확정이다.
- 오류 분리: Codex 도움말/버전은 exit0이나 도구 자체 임시 경로/PATH 정리 AccessDenied 경고가 있었다. 권한/ACL/PATH를 변경하거나 반복 수리하지 않았다. 공식 SDK reference 링크 조회 InternalError 1회는 문서 접근 오류로 분리한다. 이번 복구 직후 로그인 셸의 기존 conda profile 오류 1회는 login=false로 사용자 profile을 실행하지 않고 읽기 작업을 이어갔으며 profile 수정 없음. 계획 TDD의 의도된 RED는 운영 오류 횟수와 구분한다.
- 임시 자원: 기존 loopback 시안 서버만 유지, 새 서버/컨테이너/DB/계정/예약 생성 없음. 사용자가 검토 중인 시안은 닫거나 삭제하지 않았다.
- 다음: P02 기술 선택안을 근거·대안·영향과 함께 제시하고 결정받은 범위로 FILE_MAP/INTERFACES/DATA_MODEL을 확정한다. 기술/인증·비용 결정 없이 P03 구현 준비나 제품 개발을 추측해 시작하지 않는다.

### 2026-10-15 P01 다음 업무 — 공간형 흐름도·4단계 생성·공식 산출물 양식

- 판정: Main 어울, P01 [1] 검토·보완 중 유지. ‘작업계획서의 다음 작업 진행’과 직전 공식 산출물 요구를 적용했다. 기존 설계 AV3-F03·P01·UI03/UI06·FN03/FN09·IX01/02의 상세화이며 새로운 제품 모듈/기술 스택을 임의 도입하지 않았다. 양식 상세 내용은 검토 초안이다. 전체44 업무 완료 집계 불변, P02/P03 미착수.
- 기준: branch `codex/anvil-public-ui-preview`, HEAD `ef80f61c1e82ec7a70d319efb5c76061111f9228`, 설계 r5 파일 변경 없음. 보존/정리의 기존 dirty/untracked는 유지했다. commit/push·서버/DB/Agent 실제 실행·예약 변경 없음.
- 산출: [공식 양식 상세 초안](design/공식산출물_양식정의.md), 공통 작성 기준 §6, 인터뷰 §14에 직접 요구/상세 초안 구분. 요구사항·설계·화면시안·작업계획·시험계획/결과·진행상황·환경 정의 8종의 필수 목차/필드·작성/검수·버전·조회 흐름을 정의했다. 기존 FN03/UI06 카드에는 해당 상세 참조를 추가했으며 업무 수/단계/기술 계약은 바꾸지 않았다.
- 시안 변경: `index.html`·`verify.cjs`·README. SVG 연결선/조건·재작업 표시, 노드 선택·방향 이동·배율(포인터 드래그 미제공). 4단계 생성·필수 입력·탭 초안·준비 필요/실행 분리. 내장 단계의 공식 양식 기본 연결과 복사본 추가 연결, 양식별 작성 규칙/LLM 임무 미리보기, 필수 목차/본문·출처/작성 주체 검사, 탭 산출물의 검토대기 본문 조회. 양식 전환 시 본문 유지. 문서 속 지시를 실행하지 않는다.
- 검증: `node docs/design/prototypes/core-workflow/verify.cjs` — 공간 이동 함수 누락 exit1→보완, 생성 다음 단계 미동작 exit1→보완, 양식 정의 미존재 exit1→보완, 양식 전환 본문 유실/필수 목차 불일치 검사·내장 기본 양식/읽기 전용 양식 조회 누락을 각각 RED 후 GREEN. 최종 exit0. 기존 14경로/6상태/정지·이해·승인·입력 보존·문서 충돌·인계/복원 계약 유지. 실제 제품/LLM/DB 시험이 아니다.
- 브라우저: v7에서 N1 오른쪽 이동 left60px·AF01 연결/작성 임무, 목적 빈값에서 1/4 차단→목적/방법론/도구/확인→생성 뒤 준비 필요·실행 기록 아님 표시, 빈 산출물 필수값 부족→수동 예시 작성→검토대기 보관→본문/출처 조회. v9 최종 제공본에서는 읽기 전용 N3에 AF02/AF03 표시와 AF03 화면시안 필수 항목·임무/양식 버전을 확인했다. 일부 locator가 native AX와 DOM role 차이로 no_matches 2건 발생해 실제 DOM/관측 ID/텍스트로 조작했다. 기능 실패나 유효 Developer 실패로 세지 않았다. 기록을 실제 LLM 작성 결과로 표시하지 않았다.
- QA/제공본: 기존 loopback 미리보기 세션62801 재사용, 새 제품 자원 생성 없음. canonical HTML = `p01-flow-wizard-artifacts-v9.html`, SHA256 `57AD3887270A4957D08F3C27621E24F5A477C609D23BD793B9E82B8F258C26FE`. 최신 탭 유지, 이전 Agent 검사용 시안 탭만 종료, 1440×900 임시 viewport는 reset. [흐름도 캡처](design/assets/p01-spatial-flow-browser.png), [공식 양식 캡처](design/assets/p01-official-forms-browser.png). v7 수동 산출물 본문 캡처는 해당 버전의 부분 증거로만 보존한다.
- 미검증/다음: 실제 LLM 전달·양식별 실제 결과 회수·영속 저장/권한·내용/첨부 검수 미구현. 양식 검사 PASS는 내용/사용자 승인 아님. 파일 선택/import·행 단위 diff·초기화/빈 초안 보호·기존 소스 조사 상세·전체 상태 및 사용자 최종 검토가 남았다. 다음은 이 P01 잔여를 수행하고 P02의 실제 지원/계약, P03의 실행 환경 순서로 연결한다.

### 2026-10-15 P01 계획순서 재개·입력/문서/인계·복원 시안 보완 — Main 어울

- 판정: P01 **[1] 검토·보완 중** 유지. 최신 계획순서 진행 지시에 따라 미완료 시안만 보완했다. 제품/UI/FN 완료로 계산하지 않는다. P02/P03 미착수, 1차 사용자 승인 스냅샷은 변경하지 않았다.
- 기준: branch `codex/anvil-public-ui-preview`, HEAD `ef80f61c1e82ec7a70d319efb5c76061111f9228` 불변. 설계 r5 SHA256 `9EF5FF5AC5E130B654F9044B35CB02BFADA554F72E7939488CC7D967B3F818E8` 재대조 일치. 기존 정리/보존 관련 dirty·untracked는 건드리지 않았다. commit/push·원격/DB/서비스 변경 없음.
- 변경: `docs/design/prototypes/core-workflow/index.html`, `verify.cjs`, `README.md`, 이 현황, 대표 PNG2개. 노드 입력→탭 초안 즉시 보존, 새 정의/복사·스냅샷 복원 전 재확인. 문서 붙여넣기→좌우 전체 본문 비교→별도 반영→이전 원문 보존, 충돌 차단. 인수 요청/안전 요약/수락 분리. 손상/누락 백업 검증 실패와 정상 검증 뒤 영향 확인을 구분. 모두 탭 메모리의 설계 예시이며 실제 저장·실행·승인이 아니다.
- 검증: `node docs/design/prototypes/core-workflow/verify.cjs` 신규 입력유지·초안복원·문서반영·새 초안 교체·인계/복원 계약에서 각각 누락을 exit1로 확인한 뒤 보완, 최종 exit0. 기존 14경로/6상태·정지/이해·일회 승인·권한·그래프 검사도 같은 시안 검사에 유지. 실제 제품 시험 아님. 테스트 준비 중 DOM double의 미생성 필드 참조 TypeError1은 준비 오류로 수정하고, 별도 assertion RED를 확인했다.
- 브라우저: 노드 이름을 반영 버튼 없이 입력→N2→N1에서 유지; 문서 충돌 차단으로 v1 유지→재비교/반영 v2→v1 원문 이력 표시. 인계 요청만으로 수락 비활성→안전 요약 후 활성. 손상 백업 영향확인 비활성→정상 검증 뒤 영향 예시 표시. `getByLabel('백업 검증 상황')` no_matches1은 확인된 DOM ID `#backup-check`로 조회/조작하여 구분했으며 제품 결함/정식 Developer 실패로 집계하지 않는다.
- 화면 규격: 주 작업 1920×1080/1440×900에서 문서 scrollWidth 각각1920/1440, 430×844에서415. 모바일 대화→절차→자료 탭 전환 및 자료 캡처 확인. 모든 화면/규격 합격이나 실기기 검증이 아니다. 임시 viewport는 reset했다. [문서 비교 캡처](../docs/design/assets/p01-document-comparison-browser.png), [모바일 캡처](../docs/design/assets/p01-mobile-430-browser.png).
- 제공본: canonical HTML과 loopback 서버의 `p01-input-documents-control-v6.html` SHA256 `0CA76A923902A645C59FD5181E2FFADFA10D006830E656201E55C9BD7D101BF5`. 기존 preview 세션62801을 재사용했고 제품 runtime·외부 endpoint 호출 없음. 최신 시안 탭을 사용자 검토용으로 유지하고 이전 Agent 검사용 시안 탭만 종료했다. 최초 PowerShell profile의 conda 출력 인코딩 오류는 제품 오류와 분리하고 이후 명령은 login=false로 실행, 프로필/권한 변경 없음.
- 수행 판단: P01은 카드에 명시된 Main 소유 설계 HTML 보완이므로 제품 Developer write lease를 발급하거나 제품 개발 기준선을 임의 변경하지 않았다. 작업 이력은 사용자 지정 정본 WORK_STATUS에 기록한다. 원본 설계/계획의 범위 변경 없이 기존 상세 동작만 구체화했다.
- 미검증/다음: 공간형 그래프·전체 다단계 프로젝트 생성·파일 선택/import·행 단위 diff·전체 폼 미전송 입력/초기화 보호·전체 화면 상태·사용자 최종 시안 검토가 남았다. 브라우저 beforeunload 경고는 코드만 있고 실제 팝업 검증 미실행. 이후 P01 수용 결과→P02 기술/Agent 실제 지원 계약→P03 개발 준비 순서를 유지한다. 부분 검증을 전체 P01 또는 제품 PASS로 승격하지 않는다.

### 2026-10-15 P01 1차 승인·절차 편집 흐름 보완 — Main 어울

- 사용자 ‘승인해’와 후속 ‘진행해’를 근거로 1차 화면 방향·기본3종 상세안 승인 기록 REVIEW-01을 생성하고 승인 시점 HTML/방법론 문서를 approved-v1에 보존했다. 미작성 동작·전체 P01 완료·제품 실행으로 확대하지 않는다.
- 변경 이유/전후: 기존 복사/직접정의는 기본 배열을 실제 편집하지 못했다. 시안 탭 메모리의 독립 초안, 빈 방법론, 노드 속성·사람/Agent·분기/합류·시작/종료, 연결/조건 추가·제거, 삭제 영향 확인, 필수값·분기/합류·도달·일반순환·중복연결 검사를 추가했다. 기본 원본 불변, 검사 후 선택한 절차가 프로젝트/주 작업 화면·단계 자료로 이어진다.
- 자체 검증: 새 복사 편집 계약은 함수 미존재 assertion RED1→보완 후 node verify.cjs exit0. 기존 14경로/6상태/정지·이해/조회자/일회결정과 신규 복사격리·빈정의·순환/분기조건·정상재작업·도달·합류·중복연결·0번 원본 복귀 확인을 함께 수행. 자기 자신 비교의 무의미 assertion은 제거하고 실제 기본본 불변 assertion으로 확인했다. 제품 시험 아님.
- 실제 브라우저: 복사→첫 노드 이름 변경/반영→검사·프로젝트 선택→주 작업에 편집 절차/입력/산출 표시 확인. 빈 정의 적용 차단, 노드 추가 후 목적/입력/산출/완료 조건 누락 표시 확인. p01-method-editor-browser.png 보존. 오류 없는 전체 브라우저/Network 검증이라고 확대하지 않는다.
- 자체 검토 보정: 원본 표시가 사용자 복사본 이름으로 보이던 부분과 원본0 전환의 falsy 확인 오류를 수정했다. 분기노드 출구/합류 입력·중복연결 검사를 추가했다. 아직 미저장 입력 보호/완전한 공간형 그래프 등 잔여는 README/요약에 공개.
- 제공: 기존 로컬 미리보기 서버/exec 세션62801 재사용, 최신 method-editor-v4.html. 새 서비스·원격 접속·Agent·DB·코드 commit/push 없음. 사용자 시안 탭 유지. 다른43개 업무 시작 전, P01 [1] 유지.

### 2026-10-15 P01 1차 클릭형·기본3종 상세 검토안 인계 — Main 어울

- 산출: core-workflow/index.html·README.md·verify.cjs, 기본방법론_상세검토안.md, assets/p01-methods-browser.png. 내장3종의 단계/역할·입력/출력·문서·승인·보완·검수 제안과 시안14경로를 작성했다. 임시 상태는 탭 메모리만 사용, 새로고침으로 초기화된다.
- 실제 확인: Node 구문/14경로 렌더·6상태·정지/이해조건3·조회자/일회결정·escape·외부API 없음의 시안 자체검사 exit0. 브라우저에서는 애자일 선택→생성→주작업 이동과 정지미확인→정지만확인→이해도확인 단계별 재개 비활성/활성을 확인. 실제 제품/DB/Agent 검증이 아니다.
- 미완료: 완전한 그래프 노드/연결 편집·직접정의, 문서 import/diff·다단계 생성, 일부 중지/인수/복구 상세, 모든 상태/버튼, 1920×1080/1440×900·430×844·실기기·사용자 시안/방법론 최종 검토. README에 현재 예시/설명 수준을 명시, P01 완료 처리 안함.
- 미리보기: localhost:57672 / 127.0.0.1 bind, exec 세션62801, skill companion의 검토전용 서버. 사용자용 key 포함 URL은 브라우저 인계와 응답에만 제공. 제공본 core-workflow-v2.html과 정본 SHA256 125F35518E90A8E828FE9EA2AA1232F110B709D9D2CC7C36569C1871F572CC14 일치. 사용자 검토 중 유지·중지 시 해당 exec 세션만 종료, 최대 idle4시간 자동 종료. 다른 서비스 영향0.
- 오류/조치: Git Bash sandbox NtCreateDirectoryObject 접근오류1→동일 승인된 로컬전용 명령 elevated 기동 성공. 첫 inline JS는 settings 템플릿 닫힘 누락으로 parse 실패1→수정 후 parse/자체검사 exit0. 브라우저 label exact 선택자1회 no-match→관측된 #stop-state로 상태 선택 확인. Windows 포트 소유자 조회1회 CIM 접근 불가, 권한변경/재시도 없음; 살아있는 서버상태 파일·실제 브라우저 표시·exec 세션으로 미리보기 확인. PID 확인은 못함.
- 후속: P01 [1] 검토/보완, 다른43개 시작 전. 제품 코드·원격 Agent/서버/DB·계정·Git commit/push 변경0. 사용자에게 방법론 화면부터 검토를 요청한다.

### 2026-10-15 P01 화면·방법론 검토 착수 — Main 어울

- 사용자 ‘2번 진행하자’는 사전 안내 2번의 화면·방법론 검토로 해석하고 명시했다. P02 기술/실제 Agent 조사·제품 코드는 이번 범위가 아니다.
- 산출 경로: docs/design/prototypes/core-workflow/index.html·README, 내장3종 상세 검토안. 실행/승인/도구 교체는 브라우저 메모리의 예시만 변경한다. 실제 외부 요청·저장·Agent·DB 실행은 없다.
- 미리보기 자원 사전등록: 소유 P01, Windows 로컬 전용 시안 미리보기 프로세스1개, 사용자 검토 동안만 사용 후 정지 시 정확 PID/세션만 종료. 시안 폴더/비밀 없는 자산만 제공, 공용 서비스·운영 컨테이너·네트워크 설정 변경0. 실제 주소/포트/프로세스는 기동 결과 후 기록한다. 파일은 검토 이력으로 보존.

### 2026-10-15 기존 Agent 사용 가능·설치 위치 전달 — Main 어울

- 신산님 확인: PC의 Codex·Claude Code 사용 가능, Hermes는 ysna-server 설치, OpenCode는 WSL 설치.
- 조치: DEVELOPMENT_ENVIRONMENT의 도구 목록에 출처·설치 위치·미확인을 구분해 기록. PC 두 도구는 사용자 사용 가능 확인과 직전 PATH 발견을 기록하며 Anvil 실제 연동 검증으로 바꾸지 않는다.
- 남은 확인: P02에서 제품/버전·공식 제어 인터페이스·지시/관측/결과/중지/승인 기능을 확인. OpenCode의 WSL 배포판/호스트는 아직 특정하지 않는다. Hermes의 원격 실행 지원은 기존 범위 대조가 필요하며 설치 정보만으로 운영 서버 실행을 허용하지 않는다.
- 이번 수행: 문서 기록만. 신규 설치·로그인/계정·SSH/원격 접속·Agent 실행·서비스/권한·제품 코드 변경 없음. 업무44개는 여전히 시작 전이다.

### 2026-10-15 현황 기록 형식 확정 — Main 어울

- 사용자 지시: P01~IX08 단계별 요약과 일자별 상황을 이 파일에 기록. Daon2 현황 형식을 참고한다.
- 조치: 현재상태·Stage 요약·44개 업무별 현황·일자별 이력으로 구성했다. 원래 날짜별 승인·설계·오류·보존 기록은 아래에 유지했다. 변경 전 원문은 [현황 보존본](04_test_reports/AV3/WORK_STATUS_20261015_단계요약추가전.md)에 보관했다.
- 현재 진도: 계획 승인과 제품 구현을 분리, 44개 전부 []·시작 전. 설계/시안/계획을 작성한 사실을 P01 또는 기능 구현 완료로 바꾸지 않았다.
- 변경 범위: 현황 문서·기록 규칙만. Daon2 원본·제품 코드·서버·DB·Agent 실행·Git 원격은 변경하지 않는다.
- 다음: 실제 업무 시작/변경/시험/검수 때 해당 행·합계·담당/증거와 아래 일자 이력을 함께 갱신한다.

### 2026-10-15 작업계획 r3 승인

- 사용자 원문: ‘작업 계획서는 일단 승인해’.
- 판정: docs/WORK_PLAN.md r3와 연결된 화면/기능/준비·통합 업무 카드, 위임·결과·검수 계약을 작업계획 승인 기준선으로 기록했다. 44개 업무는 아직 시작 전이다.
- 설계 기준 hash: 9EF5FF5AC5E130B654F9044B35CB02BFADA554F72E7939488CC7D967B3F818E8. 준비 업무 P01~P03의 선행조건·미확정 상세·별도 실행 승인 경계는 유지한다. 계획 승인을 제품 완료·실측 통과로 해석하지 않는다.
- 이번 수행: 승인 상태 기록만 변경. 구현·Agent 배정·시험·서버/DB·원격 Git 변경 없음. 실제 착수 시 승인 계획의 준비 업무부터 진행한다.

### 2026-10-15 기본 내장 3종 사용자 확정

- 신산님 결정: 구조적 방법론·객체지향 방법론·애자일 방법론. 직전 담당자의 3종 제안은 대체한다.
- 설계 r5 §4.1.2와 FN02에 SYS-M01 구조적/SYS-M02 객체지향/SYS-M03 애자일로 반영했다. 이름/목록은 확정, 상세 절차·표기·필수 양식·검수 구성은 검토 대상으로 구분한다. 선택·복사 수정·사용자 직접 정의는 유지.
- r4 설계 보존 후 계획 r3의 설계 hash를 9EF5FF5AC5E130B654F9044B35CB02BFADA554F72E7939488CC7D967B3F818E8로 갱신했다. 인터뷰 원문에 후속 결정 누적. 제품 구현·내장본 실제 생성·서버/DB·Agent 실행·원격 Git 변경은 없다.

### 2026-10-15 기본 내장 방법론 요구 추가

- 신산님 직접 지시: 방법론 몇 개를 기본 내장하고, 시스템 표준대로 진행/사용자 정의 모두 제공한다.
- 설계 r4 §4.1.1~3에 내장 선택·미리보기·프로젝트 적용, 기본본 복사·수정, 빈/가져오기 사용자 작성, 출처/버전·원본 보호·업데이트 자동 적용 금지를 상세화했다. 구체 종류는 단계형/반복·증분/기존 SW 개선 3종 제안이며 사용자 확정으로 쓰지 않았다.
- 계획 r2의 FN02·UI02·UI03·IX01에 구현/검수 범위를 연결했다. 44개 업무 유지. 정적/클릭형 선택 화면 개정은 P01 미완료로 공개했다.
- r3를 history/Anvil_설계서_v3_r3_20261015.md에 보존. r4 SHA256 7A7AB37CC6A80AB79A0A5F4619C635E601A23699391F51BFF50F69C2E054C64B로 계획 기준 갱신. 요구 원문에 후속 지시 누적.
- 문서 patch 1회는 개발환경의 전체 행과 일치하지 않아 적용 전 거부됐으며, 실제 파일 상태를 확인한 뒤 정확한 행으로 다시 적용했다. 제품 파일/권한 변경은 없었다.
- 설계·계획 문서만 변경했다. 제품 구현·내장 데이터 생성·Agent 실행·서버·DB·원격 Git 변경 없음. 내장 종류 확정·화면 검토·실제 구현/검증은 남아 있다.

### 2026-10-15 위임·검수용 작업계획과 개발 방법 공통 기준

- 판정: 계획 문서 작성·자체 대조 완료, 사용자 검토 전. 제품 구현은 시작 전이다.
- 사용자 지시: 상세 설계에 근거한 실제 작업관리 계획을 작성. 화면/기능 업무를 구분하고 다른 Agent 세션에 위임할 입력·범위·산출·검수 정보를 상세화한다. 업무 크기가 아니라 구분 가능한 책임/결과/검수 경계로 분해한다.
- 추가 직접 정의: Anvil은 우리가 SW를 개발하는 방법을 표준화·시스템화한다. Anvil을 만들며 사용하는 설계·계획·위임·검수·변경·오류·인계 방식이 원형이며, 이 대화의 방법들은 제품에서 재사용한다. 제안/시행착오를 확정 규칙과 혼동하지 않고 원문·합의·근거·버전·프로젝트 적용·실제 수행/검수로 연결한다.
- 정본: docs/WORK_PLAN.md와 docs/work_packages/SCREEN_WORK.md, FUNCTION_WORK.md, INTEGRATION_WORK.md, ASSIGNMENT_REVIEW.md. 준비3·화면15(공통틀1+상세화면14)·기능18·통합8, 합계44개 업무. 모두 시작 전으로 등록했다.
- 작성 내용: Stage A~G, 선행 의존, 설계 추적, 책임/범위/입출력·처리/파일 경계·RED/GREEN·실제 검수 순서·증거·복구·QA·결과/검수/인계 양식. P02/P03에서 실제 기술·파일/API·명령·환경을 고정한 뒤에만 구현 패킷을 발급한다. 설치/배포 실행은 별도 계획/승인으로 분리했다.
- 제품 적용 기준: docs/design/문서작성_공통기준.md 작성. 방법론의 문서양식·임무 맥락에 버전으로 연결하며 FN03/FN04/FN05/FN09, UI03/UI06, IX01/IX02에서 실제 다른 프로젝트 문서 작성 흐름까지 확인하도록 했다. 이번 계획 작성이 그 기능의 구현 완료는 아니다.
- 설계 개정: r2를 docs/design/history/Anvil_설계서_v3_r2_20261015.md에 보존하고 최신 직접 정의를 §1.4에 반영한 r3 작성. 기준 SHA256 9E0C5317E477445AB2BDFC846B3391F518356D9FA32AE577BEA270712F1159ED와 계획 hash 일치 확인. 인터뷰 후속 지시 누적. AGENTS·README·개발환경에 현행 계획 경로/상태 연결.
- 실제 확인: 등록44·고유44·업무카드44 일치, 선행 ID 유효·의존 순환0, 계획과 관련 문서 상대링크16개 존재, 공백검사 및 지정 diff --check exit0. 수정 문서/자산의 hash·설계 기준을 대조했다. 자체 문서 대조이며 독립 Agent 검수·제품 기능 시험은 미실행.
- 오류/조치: 자체 의존 검토 중 FN04 승인소비의 FN11 선행 누락과 FN16 전체원본의 제어권/알림 선행을 보정했다. 사용자 요구를 작은 코드 조각으로 분할하지 않았으며 실제 배정의 미확정 필드를 실행자에게 추측시키지 않는다.
- Git/범위: local branch codex/anvil-public-ui-preview, HEAD ef80f61c1e82ec7a70d319efb5c76061111f9228 불변. 기존 보관에 따른 삭제/수정·미추적 상태 보존. 제품 코드·DB·서버·Secret·계정·예약 변경0, 새 Agent 배정0, commit/push0. 원격을 다시 채우지 않았다.
- 다음 조치: 신산님 계획 검토 후 실제 착수 지시가 있으면 P01 상세 클릭형 검토/P02 기술·연동 계약부터 수행하고 P03 실제 개발 기준선·검증 명령을 묶는다. 지금은 계획 산출물 인계이며 제품 자동 실행 없음.

### 2026-10-15 v3 상세 설계 재작성

- 담당: 어울. 사용자 요청: 지정한 v3 초안을 인터뷰에서 설명한 내용과 상세 설계 형식으로 다시 작성.
- 단계/판정: 상세 설계 초안 r2와 정적 화면 시안 작성. 사용자 검토·클릭형 동작 검토·최종 설계 확정은 아직 하지 않았다. 제품 구현 완료가 아니다.
- 기준 확인: PMO AGENTS·문서/화면 설계 표준, 프로젝트 AGENTS 최신 재설계 지시, 인터뷰 합의사항, 기존 초안, 작업현황·개발환경을 대조했다. 기존 로컬 HEAD ef80f61c1e82ec7a70d319efb5c76061111f9228, branch codex/anvil-public-ui-preview. 기존 자료 보관으로 인한 다수 삭제/수정 상태를 보존했다.
- 변경: docs/design/Anvil_설계서_v3_초안.md를 668줄 상세 설계로 재작성. F01~F15에 입력·처리·저장·조회·조건·예외, S01~S14에 화면·필드·동작·상태를 연결했다. 헌법 적용, 총괄 포함 교체 가능한 도구, 지식 원본, 미수행/원인 미확인, 구도구 무응답 인계, 실제 상태 대조, 단독 제어, 설계→계획→코드→검증 추적을 중심으로 작성했다.
- 보존: 변경 전 초안을 docs/design/history/Anvil_설계서_v3_개괄초안_20261015.md에 복사. SHA256 901FD881F704F7E905B8352283AEAB9856B207A4F1AC8DC7A2282A20A60846FE 확인. 인터뷰 원문·기존 Backup은 변경하지 않았다.
- 시안: docs/design/assets/av3-s01.svg~av3-s14.svg 정적 화면 14개. build-mockups.ps1은 예시 벡터 이미지 생성 전용이며 제품 코드가 아니다. 방법론/주 작업/도구 이전/모바일 4화면은 PNG로 렌더하고 직접 시각 확인했다. 실제 저장·Agent 연결·작동하는 버튼은 없다.
- 문서 검사: 상대 참조16개 존재, SVG14개 XML 파싱, 지정 문서 경로의 diff --check exit0. 새 문서는 untracked이므로 추가로 원문 공백·ID·참조를 검사한다. 제품 build/test/API/DB/브라우저 기능 시험은 미실행.
- 오류/조치: 시안 생성 첫1회 PowerShell 기본 R alias 충돌 exit1→스크립트 범위 alias로 수정 후 생성 exit0. 수정 patch 중 잘못 붙은 빈 hunk 1회는 적용 전 거부→정확한 patch 적용. 브라우저 로컬 SVG 렌더 확인1회는 도구 timeout으로 확인 불가→기설치 sharp로 PNG 렌더4개 exit0 및 이미지 직접 확인. 권한·사용자 설정·패키지 설치 변경0.
- 범위 유지: 제품 코드·서버·DB·인증·외부 서비스 변경0. 새 계획 작성·개발 Agent 실행·예약 생성·Git commit/push는 하지 않았다. 비워 둔 원격에 설계 자료를 다시 올리지 않았다.
- 남은 검토: 사용자 상세 설계·정적 화면 검토→클릭형 동작/오류 시안→설계 확정→화면/기능별 상세 작업계획·테스트계획. Agent별 공식 인터페이스, 기술 선정, 손실/성능 임계값은 미확정·미검증으로 문서에 공개했다.

### 2026-10-15 Git 파일 정리 완료

신산님 정정에 따라 저장소 자체를 보존하고 현재 파일만 비웠다. 기존 작업 branch의 e0af2297 위에 빈 tree의 일반 commit 3a0882d3804797208bb2271039f3086697aaa1aa를 만들고 정상 push했다. 새 작업 branch·force push·이력 초기화는 없다. PR https://github.com/sinsan-develop/Anvil/pull/40을 통해 main b4f9006e30e5afcf98ef8ef1f39707ecc8954feb에 merge 반영했다. 기본 branch 직접 개발·직접 commit은 하지 않았다.

반영 후 Git fetch와 ls-tree로 main의 파일0개 및 이전 main04430432의 ancestry 보존을 확인했다. 독립 GitHub 조회에서 같은 저장소 ID1356865616·이름·main·공개 상태 불변과 PR40 merged=true를 확인했다. 기존 작업 branch는 저장소의 원래 auto-delete-on-merge 설정에 따라 자동 삭제됐으며 직접 branch 삭제 명령은 실행하지 않았다. 로컬 최초 mirror·bundle·기존 자료와 새 설계는 그대로 보존한다. 원격에 새 설계·로컬 백업을 업로드하지 않았다.

준비 중 로컬 bare 복사 하위 프로세스의 sandbox 실패1은 동일 로컬 복사를 elevated로 수행해 해결했다. API 확인 중 commit SHA를 tree 경로에 사용한 404 1회와 실제 빈 tree 조회404 1회를 분리했다. API 실패를 PASS로 바꾸지 않고 commit API의 빈 tree 지문 및 반영된 Git 객체를 fetch해 파일0개를 검증했다. 제품 구현·빌드·기능 시험·서비스 배포는 수행하지 않았다. 마지막 남은 정리 예외는 권한 제한 .pytest_cache 1항목이며 ACL 변경·강제 삭제는 하지 않는다.

### 2026-10-15 기존 자료 보관과 정리

- 담당: 어울
- 사용자 지시: 새 작업에 필요한 자료만 남기고 기존 자료는 로컬 backup으로 보관. WSL Anvil 폴더는 삭제한다. 신산님이 이후 정확히 정정한 Git 범위는 sinsan-develop/Anvil 저장소 자체를 유지하고 안의 파일을 모두 삭제하는 것이다. 저장소 삭제·delete_repo 권한 추가 요청은 철회한다.
- 현행 자료: v3 설계 초안과 인터뷰 합의사항. 프로젝트·헌법·지식은 Anvil 소유, 실행 도구는 교체·해제 가능, 목표는 최소 손실 이전.
- 보관 위치: D:\Project\Anvil\Backup\Anvil\legacy-20261015-1420. 기존 소스·문서·미커밋/비추적 자료 등 로컬 최상위 69개 항목을 이동했다. 원본 AGENTS.md도 사본으로 보존했다. 다른 프로젝트 Backup은 변경하지 않았다.
- 로컬 Git: local-history.bundle의 완전한 이력과 94개 ref를 검증했다. 정리 전 원격의 remote.git mirror는 fsck --full exit0, main 0443043251d25aa77c17d23165b7c9299c8dbeb8 및 codex/u01-dashboard-r2 e0af2297c0bb164b065b36067b32bedf5022d983를 확인했다. 이 최초 백업은 파일 정리 후에도 덮어쓰지 않았다.
- WSL 보관: anvil-wsl.tar.gz, SHA256 F0EC72E3B3E809464EEDE2E50038C06CE3AE5AF46BAAF1A162093A0C230EF276, 4742개 항목. .git과 kernel.py/test_kernel_lifecycle.py의 수정 및 C-04 비추적 문서 포함을 확인했다.
- WSL 삭제: 정확한 /home/daon/deploy/anvil을 사용자·소유·실경로·HEAD·압축과 원본 동일성·열린 프로세스0·mount0 검증 후 삭제, exit0. 전송용 원격 압축도 제거했다. 로컬 원본 압축은 보존한다. /srv/anvil-wsl 서비스·DB·인증자료·공유 네트워크는 대상에서 제외했다.
- 최종 확인: 독립 SSH exit0에서 요청 폴더·전송용 압축 부재와 제외한 Web677a9ceb499e/API8bd8af7bfed0/OIDCe26676734bca의 같은 full ID/running=true를 확인했다. 현행 설계2문서는 carry-forward와 hash가 같고 원격 GitHub는 같은 ID로 존재함을 재확인했다.
- GitHub 보관: 저장소 메타데이터·39개 PR 목록과 본문·이슈/댓글·리뷰댓글·릴리스·브랜치·태그 JSON 8개를 보존했다. GitHub 전체 Actions 로그·산출물·설정의 완전한 복제라고 주장하지 않는다.
- 잘못된 저장소 삭제 시도: 담당자가 Git 정리 범위를 저장소 자체 삭제로 오해해 1회 실행했지만 delete_repo 토큰 권한 부족으로 HTTP403 거부됐다. 실제 저장소 삭제0·권한 확대0이다. 신산님 정정 이후 저장소 보존과 파일 삭제로 범위를 바로잡는다. 현재 공개 여부와 계정·저장소 설정은 변경하지 않는다.
- 오류와 조치: WSL 초기 사전 검사2회는 /proc 보호 프로세스 조회에서 중단돼 삭제0. 보호 대상 sd-pam 확인 후 정확 폴더의 관리자 lsof 읽기 조회로 실제 사용 여부를 검증한 뒤 삭제했다. 로컬 .pytest_cache 1항목은 권한 때문에 이동되지 않아 기존 위치에 남겼다. ACL·OS·서비스 권한을 변경하거나 재시도하지 않았다.
- 미완료: 권한 차단된 캐시1항목. GitHub 현재 파일 비우기는 위 최신 결과로 완료했으며 저장소 삭제는 요구사항이 아니다. 신규 상세 설계·상세 클릭형 시안·작업계획·실제 도구 연결·이전 검증은 아직 미완료다. 기존 제품 검증을 신규 제품 PASS로 승격하지 않는다.
- 문서 확인: 현행6문서 존재와 기존 주요8항목의 로컬 보관, 보관된 v2 원본 hash 일치를 확인했다. 전체 diff --check는 기존 사용자 변경 AGENTS.md의 Markdown 줄바꿈용 공백1줄을 지적해 exit2이며 원문을 임의 정정하지 않았다. 신규 문서 내용 확인과 구분하고 제품 시험으로 취급하지 않는다.
- 다음 조치: 로컬 백업과 비워진 원격 저장소를 보존하고 새 설계의 핵심 이전 시나리오와 화면을 구체화한다. 저장소 재생성·삭제 권한 추가 인증은 하지 않는다.

상세 보관 목록과 복구 근거는 Backup/Anvil/legacy-20261015-1420의 ARCHIVE_STATUS.md 및 local-archive-manifest.csv에 있다. 로컬 자료는 삭제한 WSL 폴더와 기존 소스를 복구·참조할 수 있는 원본이며 과거 GitHub 서비스 상태 전체의 무손실 복구를 뜻하지 않는다.
