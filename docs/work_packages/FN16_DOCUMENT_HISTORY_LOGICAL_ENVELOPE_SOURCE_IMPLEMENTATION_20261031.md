# FN16 DOCUMENT_VERSION 역사 논리형식·검산 source 구현 계획

> 실행: 기존 fn16_primary_recovered 단일 writer. superpowers:subagent-driven-development/TDD를 적용하고 Main은 검수·통합한다. 모든 보고·작업은 한국어로 작성한다.

**목표:** 이미 메모리에 있는 구조화 문서 DTO의 논리 타입·원hash/namespace/주체/조건부 참조·검증상태를 순수 계산한다. 이 작업은 수입 parser나 저장·복원 기능을 만들지 않는다.
**구성:** 신규 내부 모듈1+시험1. 기존 canonical/runtime validation은 수정 없이 재사용한다. 기존 route/composition/store/기본412와 실행 경로에 연결하지 않는다.
**기술:** 기존 Node24/TypeScript/node:test/assert; 의존성 추가0.
**기준:** 후보 SHA924D7359 §10 및 직접채택 E561FC13B7DEFFAA36080D65EC398F622D94E6B8FE6040AA18206D0C6D4A9912. 후보 원문·바인딩을 먼저 읽는다.

## 1. 고정 경계
- 시작 source baseline codex/av3-stage-b 7c5cc10855f455fa94be512e1eb4febc951f466d. 기존 Primary preflight에서 신규2경로 부재를 확인했으며 시작 때 재확인한다. 다른 writer·기존 dirty/untracked3을 보존한다.
- 실제 parser/외부 byte·JSON·stream 입력 해석/parseWireJson·수입/영속저장·FS/DB/endpoint/public API·schema/migration·권한·키·현재계정 연결·active 파생·복원·Agent/서비스 실행0.
- 실제 사용자의 파일/환경을 읽지 않는다. 시험은 소형 메모리 합성값만 사용한다. 새 임시 경로·서버·브라우저·QA process0.
- 원출처/필수 관계 export codec·제품 상한/접근·영속/crash 미정은 명시 상태로 유지한다. 부족한 검증을 caller 체크태그/성공 callback으로 VERIFIED로 만드는 입구를 만들지 않는다.
- 총봉투 크기 등 미채택 제품 수치를 새로 만들지 않는다. 현재 canonical의 depth64/정규 JSON과 기채택 기존 원형 제한은 재사용하되 공개 수입이 유한하게 구현됐다는 주장은 하지 않는다.

## 2. 허용 경로 — 정확2
1. 신규 apps/server/modules/backups/document-history-envelope.ts
2. 신규 tests/unit/FN16/document-history-envelope.test.ts

Main의 별도 문서/현황 쓰기 외 source·시험은 이2경로뿐이다. 중앙 contract/generated types·기존 helper·test·route·SQL·설정을 수정하지 않는다. Primary는 commit/push하지 않는다.

## 3. 내부 인터페이스
- 타입: 후보의 namespace/historyRef/originalRecord projection/principals/evidenceRefs/derivation/validation/checks/state를 readonly 타입으로 정의한다. wire/public API에 등록하지 않는다.
- hashDocumentHistoryNamespace(namespace): 정확 닫힌 namespace를 검사해 기존 canonicalJson/contentHash 결과를 반환한다. sourceManifestHash와 산출봉투/namespace hash의 역할을 구별하며 선행확정/출처진위를 증명했다고 표시하지 않는다.
- computeDocumentHistoryRecordHashes(record): 구조화 projection의 닫힌 원형과 알려진 중복 필드 대응을 검사하고 문서4필드 documentContentHash 및 projection recordHash를 계산해 반환한다. 원 DB 행 bytes hash나 Secret 검사로 표시하지 않는다.
- inspectDocumentHistoryEnvelope(envelope): 구조상 잘못된 입력은 비밀 없는 고정 오류 DOCUMENT_HISTORY_STRUCTURE_INVALID로 거절한다. 원 snapshot을 재봉인하지 않고 실제 hash/동일성 불일치는 해당 check MISMATCH/INVALID로 반환한다. 이 함수는 신뢰하지 않는 외부 bytes를 받는 decoder가 아니다.
- classifyDocumentHistoryChecks(checks): 후보의 5값/8키와 배타 우선순위만 계산해 HistoryState 문자열을 반환한다. 순수 분류는 원출처/관계/bytes 검증 증거가 아니다. 실제 inspect 경로는 caller의 checks를 입력으로 받지 않으며 실검산하지 않은 결과를 이 helper로 승격시키지 않는다.
- compareDocumentHistoryIdentity(left,right): 검산된 논리 snapshot 2개를 비교해 SAME_RECORD/KEY_CONFLICT/DISTINCT_KEY를 구분한다. 실제 ledger 조회/replay·commit·rollback을 수행하거나 REPLAY_EXISTING 저장 receipt를 발급하지 않는다.
- 결과/반환 snapshot은 입력과 분리해 원객체 변경의 영향을 받지 않도록 한다. 오류에 원문/키/주체·민감값을 출력하지 않는다.

## 4. 검산과 지원하지 않는 항목
- namespace exact keys/UUID/hash·namespaceHash와 originProjectId, originalRef(id/version/contentHash)↔record·recordHash·derivation.sourceHistoryRef·principals namespace/author/user/client 일치를 검사한다. 잘못된 추가 계정 키·getter/symbol/cycle/비정규 JSON·닫힌 키 위반은 거절한다. Proxy는 안전한 plain DTO로 가정해 보호를 통과시키지 않는다.
- 실제 계산 가능한 recordHash/documentContentHash만 그 검산 결과로 기록한다. 원 client-user 관계·명령/receipt/audit·원출처·artifact bytes는 UUID/증빙ref만 같다고 VERIFIED가 아니다. 값모순은 MISMATCH, 필요한 증빙ref가 없으면 MISSING, codec 미지원이면 UNSUPPORTED, 수행하지 않은 출처/bytes는 NOT_RUN으로 구분한다.
- form은 항상 필수다. stageNodeRef=null이면 application 증빙을 만들지 않는다. nonnull이면 nodeId는 readStageNodeRef의 비어있지않은 well-formed 문자열<=200/제어문자금지(implement 정상)다. application 버전은 제공된 고정 원snapshot/원행 증빙 없이 추정하거나 최신으로 조회하지 않는다. 새 증빙 codec/입력포트를 발명하지 않고 실제 미지원은 UNSUPPORTED로 남긴다.
- content/sourceRefs/sections/bodyArtifactId와 원 ref의 알려진 구조·중복 대응은 대조하되 양식·방법론·원command 원문이 없으면 참조폐쇄 성공0이다. derivation은 현재계정연결/derivedRef=null·NOT_CREATED_UNSUPPORTED로 닫는다. fullRestore/executionAuthorized는 false를 유지하되 단순 false wrapper로 실검산을 대신하지 않는다.

## 5. 한 업무의 TDD·검수 순서
- [ ] 허용2경로 부재/시작HEAD·보호3을 확인하고 시험부터 작성한다. 기존 함수/시험/기대값 변경0.
- [ ] 정상 typed DTO의 독립 canonical 기대hash·입력불변/반환분리, 정상 nodeId implement/null 및 form 필수 관계, 모든 hash의 단독 변조를 시험한다. 부재 모듈/함수의 실제 RED를 실행/기록한다.
- [ ] 원주체/user-client 값모순·금지계정추가키·추가임의 checks/proof flag·getter/symbol/cycle·변경 후 재봉인 금지, 잘못된 stage/version/latest 추정0·증빙 없음/미지원 상태를 시험한다.
- [ ] 같은namespace/원키·원record 동일/상반hash와 다른namespace 동일UUID를 구별하며 저장/권한·사용자 동일성/영속 uniqueness 증거로 오인하지 않는 시험을 추가한다.
- [ ] 8check의 배타 우선순위 대표 정상/음성·MISMATCH 최우선·순수ENVELOPE_ONLY·recordHash 미검산INCOMPLETE·source만미확인SOURCE_UNVERIFIED·전부VERIFIED의 순수 분류와 실제 inspect가 미지원 검증을 VERIFIED로 만들지 못함을 따로 시험한다.
- [ ] 허용 모듈만 최소 구현하고 신규 시험 GREEN. 알려지지 않은 중첩 codec을 느슨하게 승인하거나 tag 공급으로 통과시키지 않는다. 실제 parser/저장 지원 확장은 별도 결정 전 금지다.
- [ ] 아래 집중/인접 검사·typecheck·diff를 한 번 실행하고 정확 명령/exit/실제결과·오류·미검증·최종2지문·diff를 반환한다. 새 실패/변경이 없으면 동일 검사 반복0.

실행 명령(기존 source cwd/고정 Node, login:false):
- C:\Program Files\nodejs\node.exe --test tests/unit/FN16/document-history-envelope.test.ts tests/unit/FN16/document-inventory-input.test.ts
- C:\Program Files\nodejs\node.exe node_modules/typescript/bin/tsc --noEmit -p tsconfig.base.json
- git diff --check

## 6. 리뷰·통합·rollback
- Main은 WI 범위를 자체 대조하고 기존 독립 reviewer가 공개 parser·호출연결/자가 VERIFIED·정상원형 거절·출처/원hash 재봉인·숨은범위확장 여부를 검토한 뒤 기존 Primary에게만 발행한다.
- Main fresh 집중 검수/type/diff와 최종지문 일치·C/I0 후 exact source2+관련 문서만 기존branch에 보존한다. 실제 DB/브라우저/저장/복원·사용자인수 PASS로 승격하지 않는다.
- rollback은 새 내부 미연결2파일의 변경을 별도 후속commit으로 철회한다. 사용자/보호3/기존source·이력은 reset/삭제하지 않는다. main 병합/배포는 필수 실제 gate 미충족이므로 수행하지 않는다.
