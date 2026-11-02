# FN03 문서 소스 관측·드리프트 선택 종단 구현 지시서

2026-11-03 / Main 어울 / 기존 승인 범위 내부 상세화 / SOURCE_ONLY

## 1. 목표·근거

INTERFACES.md §15.4:1127~1131 및 연산 등록부:557, WORK_PLAN FN03/UI06을 구현한다. 정확 원 관측으로 초기 LINKED를 저장하고, 이후 관측에서 KEEP_SERVER 또는 COLLECT_PROPOSAL을 명시 선택하며 결과·이력을 재조회한다. 원 문서 본문/확정본·소스 파일은 변경하지 않는다. 원문/미채택 FN03_SOURCE_CONTENT_HASH_DELTA_CANDIDATE §13.4 정책관리 원장과 혼동하지 않는다. 이번은 실제 DB 적용/Agent/파일 관측 승인이 아니다.

기준 branch codex/av3-stage-b, HEAD da3f4bbbaba2b59a7cb62a640e3db3489b7a1912. INTERFACES raw SHA256 1DB611C186DFD908FE4CA9CA1B25E4E82FF5CDC39511311205E0C6EFACF096E2. 기존 native/trust 미완료와 미채택 방향을 이 단위로 해소하지 않는다. 보호 untracked3는 읽기 검수 외 수정/stage/삭제하지 않는다.

기존 Reviewer 구현안 검토 C0/I1: 원 import/proposal의 자기 receipt/승인/quota를 중첩 호출할 수 없음. 아래 §4에서 단일 원명령 귀속으로 보완한다. 이 I1은 구현·검수 전 해소 판정하지 않는다.

## 2. 소유·정확 허용 경로

기존 Primary만 단일 code writer. Main은 WI/현황/결과문서·검수·Git, 기존 Reviewer는 읽기 독립 검수다. 공유 코드베이스의 타인 변경을 되돌리지 말고 충돌시 Main에 반환한다. 새 agent/chat/branch/worktree/자동화0.

기존 제품21:
- apps/server/app.ts
- apps/server/modules/projects/routes.ts
- apps/server/modules/access/project-command.ts
- apps/server/modules/approvals/approval-input.ts
- apps/server/modules/approvals/project-approvals.ts
- apps/server/modules/documents/project-source-links.ts
- apps/server/modules/documents/document-source-link-history.ts
- apps/server/modules/documents/document-source-link-records.ts
- apps/server/modules/documents/document-source-link-list.ts
- apps/server/modules/documents/project-documents.ts
- apps/server/modules/documents/project-imports.ts
- apps/server/modules/documents/project-proposals.ts
- apps/server/modules/projects/project-storage-quota.ts
- apps/web/src/App.tsx
- apps/web/src/features/design-trace/DocumentsPage.tsx
- apps/web/src/features/design-trace/DocumentSourceLinks.tsx
- apps/web/src/features/design-trace/source-links-api.ts
- apps/web/src/features/design-trace/editor-api.ts
- apps/web/src/features/connections/policy-editor-profile.ts
- apps/web/src/features/decisions/api.ts
- apps/web/src/features/decisions/ApprovalsPage.tsx

신규6(작성 직전 부재 확인):
- apps/server/modules/documents/document-source-observation.ts
- apps/web/src/features/design-trace/source-link-command-api.ts
- apps/web/src/features/decisions/source-link-approval-api.ts
- db/migrations/0072_document_source_observation.sql.pending
- tests/unit/FN03/document-source-observation.test.ts
- tests/unit/UI06/document-source-observation.test.ts

기존 인접시험7(현재 파일명 확인, 필요한 새 반례만 추가):
- tests/unit/FN03/document-source-link-history.test.ts
- tests/unit/FN03/document-source-link-records.test.ts
- tests/unit/FN03/document-source-link-list.test.ts
- tests/unit/FN13/project-storage-quota.test.ts
- tests/unit/FN13/project-storage-quota-writers.test.ts
- tests/unit/FN13/project-storage-quota-schema.test.ts
- tests/unit/UI00/settings-source-links.test.ts

추가 경로가 필요하면 정확 사유/역할만 먼저 Main에 반환한다. 기존 applied/pending SQL 수정0. 0072 번호 충돌시 쓰기 전 알린다. 기존 시험의 기준·실패 단언을 느슨하게 바꾸지 않는다.

## 3. 보호 관측·기존 v1 호환

기본 관측 공급자 미등록은 412다. caller JSON/verified:true, hash 일치, CONNECTOR_REPORTED/OS UNVERIFIED를 실제 검증 권위로 승격하지 않는다. 내부 포트는 원 authenticated Tx/현재 actor·client/control·정책·project/root·정규 상대경로·원 documentRef와 exact snapshot/hash·등록/세대·proof·기한에 결박된다. getter/포트 함수 교체·await 뒤 회수/기한 변화를 검사하고 고정 오류만 반환한다. 실제 endpoint에서 요청자가 공급자를 주입하는 경로0.

COLLECT는 같은 관측에 결박한 기존 원본 ArtifactRef만 소비한다. Artifact 접근/격리·원 bytes/hash·크기·미디어/UTF8/손실을 기존 보호 reader/parser로 확인한다. 사용자 path를 서버 파일 읽기로 해석하거나 hash에서 bytes를 만들어내지 않는다.

기존 LINKED v1/DETACHED v2 snapshot/ref/hash/receipt 및 detach 승인 target·과거 조회를 보존한다. 관측·선택은 별도 append-only stream/head로 연결하고 원 link version을 선택마다 증가시키지 않는다. 원 링크 생성은 기존 v1 snapshot 의미를 사용한다. 최초 link targetId=null/expectedVersion=0, 선택은 정확 ACTIVE sourceLinkRef가 target/expectedVersion이다. 선택 stream은 정확 이전 head/version CAS와 observedSnapshotRef 현재성을 검사한다. detach와 선택은 같은 link 잠금을 공유하며 분리 뒤 선택0.

같은 관측의 자동 재수입0, 같은 command/hash replay는 원 결과만, 같은 commandId/다른 body 또는 stale link/관측/승인409다. 관측·선택·제안의 정확 연결을 보존하고 사용자의 새 명시 선택과 단순 재전송을 구별한다. 이미 수집한 원 관측의 동일 제안을 중복 생성하지 않는다. 숨은 자동 루프0.

## 4. 원명령·승인·COLLECT 원자 귀속

기존 ProjectPolicyRepository.command의 인증/OWNER·현재 제어·명시 정책/DENY·replay·ApprovalRef·기한·단일 소비·receipt/audit 흐름을 유지한다. 원 두 연산만 allowlist에 추가하며 원문 공개/범용 승인/다른 주체·재사용 권한을 만들지 않는다. 최초 link의 승인 target null/0은 전체 payloadHash의 정확 document/root/snapshot/hash를 보호하고 가짜 link ref를 발급하지 않는다. 선택은 ACTIVE sourceLinkRef 및 observedSnapshotRef를 원 payloadHash/현재성 검사에 결박한다.

COLLECT는 파싱·proposal 계획 계산의 내부 재사용과 저장을 분리한다. 기존 함수를 가짜 importDocument/proposeDocumentChange ProjectCommand로 호출하지 않는다. 원 proposeDocumentSourceChange의 단일 command/receipt/audit/승인소비가 import candidate·proposal·diff Artifact·선택 사건을 소유하며 forward guard에서 양방향 결박한다. 기존 importDocument/proposeDocumentChange 호출자는 원 의미·결과·검증을 유지한다.

IO를 포함하는 quota prepare/reserve/start/publish/settle 및 보호 replay를 원 source-change operation/hash에 끝까지 결박한다. parent 명령을 기존 다른 operation으로 위장하거나 이중 receipt/승인을 만들지 않는다. unsupported/파싱·Artifact·quota 실패는 원 자료/링크/문서 본문을 유지하며 제안 성공으로 표시하지 않는다. COMMIT/IO 결과 불명은 원 명령과 held reservation을 보존하고 자동 재공개·새 명령·권위 없는 cleanup0이다.

## 5. 저장·한도·완결

0032/0059 등 구SQL은 불변이다. 새 forward pending SQL은 최초link 생성, 별도 관측/선택 stream/head·원 command/receipt/audit/승인·COLLECT import/proposal/Artifact 연결 및 RLS/직접 DML 거절·현재성/지연 완결을 명시한다. application 등록만으로 정책/GRANT/실DB를 변경하지 않는다.

기존20MiB 원Artifact·2MiB 본문/계획·10GiB project quota·자동삭제OFF·기존 operation 예약 계수를 완화하지 않는다. 새 SourceLinkEvent 행의 canonical record projection은 최대64KiB다. 기존 공통 command/receipt/audit/import/proposal/reservation 행에는 이 새 관측 행 상한을 일률 적용하지 않고 원 domain validator와 기존 유효 입력을 보존한다. 새 source 연산의 metadata 그룹은 project 누적10000행/64MiB를 내부 유한 한도로 둔다. 원본/증거·중복 저장행과 미래 예약을 누락/중복 계상하지 않는다. 목록은 page 최대50·bounded response2MiB와 명시 hasMore/고정 상세·기존 signed cursor pattern을 사용한다. 전체 이력을 page 생략으로 완료라 하지 않는다. 포화는 새 변경만 거절하고 기존 조회/기존 detach는 보존한다.

새 metadata 및 COLLECT diff의 미래 bytes/slot을 원명령의 목적별 quota 예약에 함께 결박한다. 필요하면 SOURCE_LINK_EVENT라는 내부 part를 두 연산에만 한정하고, 기존 ARTIFACT/CHECKPOINT operation별 count/byte·2배예약/정산 guard는 그대로 둔다. 새 metadata actual/held와 기존U/H·다른 계상소계는 같은 project 잠금 아래 disjoint로 합산한다. forward collector·SQL guard와 runtime이 같은 식을 소비하며 coverage를 상수true로 바꾸지 않는다. UNKNOWN/미정착IO·원결과 미확정에서 예약 자동해제0. 정확 projection·정산표와 branch별 남은 여유를 코드/시험에서 제시하고, 기존 guard를 건드릴 추가 경로가 필요하면 Main에 먼저 반환한다.

## 6. 화면·원명령 보존

기존 UI06 소스 영역에 정확 문서/연결·관측 선택→서버 유지/변경안 수집의 명시 행동을 연결한다. 페이지 진입 자동관측/원문 수집0. sourceRootId/경로/관측 refs를 실제 보호 선택/검산과 구분해 표시하며 미등록/미확인은 숨기지 않는다. VIEWER에게 제한 경로·사유·원문을 새로 노출하지 않는다.

App 소유의 원 command/body/hash를 현재 project/session/client/control·자료선택에 결박한다. UI08 기존 별도 승인·결정 뒤 원 미전송 명령에만 approvalRef를 붙이고 UI06 명시 재전송을 요구한다. 전송된/UNKNOWN 원명령은 선택/입력수정으로 소실시키지 않는다. transport/owner ABA·느린 응답은 폐기하되 원 outcome을 REJECTED로 바꾸지 않는다. 과거 사건·원Artifact/제안 고정 조회를 연결하고 proposal 생성이 본문 적용/확정이 아님을 구분한다. 실제 사용자에게 구현 완료/실측 지원true로 표시하지 않는다.

## 7. 수행·검수·반환

1. 기준 branch/HEAD·dirty 소유·보호3·허용 기존 경로/신규 부재/0072 충돌을 확인한다. Main 현황 dirty는 보존한다.
2. 실제 미구현 동작의 assertion RED부터 확보한다. module 부재·fixture 준비 실패와 제품 RED를 분리한다.
3. 단일 writer로 서버·forward pending SQL·화면과 생산소비 시험을 구현한다. 관련 없는 구조개편/툴도입0.
4. fake query/보호 포트→실제 command/receipt·이력/head·import/proposal/quota→고정GET을 연결한다. 정상과 핵심음성(부재412·타project404·stale409·proof/Artifact 불일치·await회수·포트교체·동일관측·승인 재사용·포화·IO/COMMIT불명·detach경합·UI ABA/원입력)을 검증한다.
5. 메모리 React 실제 클릭의 선택→별도 승인→원명령 복귀/명시전송→이력/제안조회, root noEmit·Web 메모리 build·변경 접점 인접검사를 수행한다. 실제 DB/TLS/브라우저 서비스·파일·Agent의 증거로 승격하지 않는다. 불변 전체회귀 반복0.
6. Main에 정확 변경경로/hash·diff·명령/exit·RED→GREEN·준비/제품오류횟수·독립미검증·임시자원/handle·rollback·다음잔여를 한국어 반환하고 writer를 돌려준다. 같은 근본 오류3회는 추가 재시도 전 원인/증거를 반환한다.
7. Main은 fresh 집중검증·독립 scoped C0/I0·정확 파일 checkpoint/private push를 수행한다. 전체 Stage/계획/사용자인수·main병합은 별도 전체증거 전 미완료다.

## 8. 실행 제외·복구

실제 키/CA/Secret·DB 접속/SQL 적용/정책·GRANT·권한·서비스·Agent/SDK/CLI·native/C#/OS·실파일/백업대상 조사·네트워크·P03R3 실행0. 테스트는 합성 보호대역·메모리/정해진 소스 읽기만 사용한다. 실제 파일/서비스 자원이 필요하면 자동으로 만들지 말고 대체 가능한 메모리 검증부터 사용한다.

복구는 소유 source commit의 정상 Git revert 검토다. reset/rebase/force/main직접쓰기·타인자료복구/삭제0. 실제 보호 공급자/DB/served·Agent는 계속 미확인이다.
## 9. r2 내부 한도 적용 정정·Main 재확정

부모 WI SHA256 455D63ED48F1F064216BBC06F96DFCCA079A10D7CD844948CEFFA318AAAF0619 / 기존 INTERFACES §15.4의 승인 의미·허용34경로·실효과 제외 불변.

887f45의 순수 계산은 기존 isImportArtifact를 통과하는 attachments200개와 기존 reason20000 한글을 보존한 proposal projection이94692bytes임을 보였다. 새 SourceLinkEvent의64KiB를 공통 proposal 행 전체에 적용하는 것은 기존 유효 입력을 축소하므로 정정한다. SourceLinkEvent64KiB 자체나 기존20MiB Artifact/2MiB 본문·diff/10GiB project 기준을 완화하지 않는다.

실제 collector row는 원 table별 종류와 projection을 명확히 매핑한다. caller가 COMMON이라는 표식으로 새 SourceLinkEvent 한도를 우회해서는 안 된다. 공통행은 원 validator·원 계획/명령/자료의 귀속과 실제 byte 합계로 검산하고, 실제 물리 slot≤10·중복계상0을 유지한다.

미래 metadata는 준비 시 고정한 normalized projection의 canonical bytes S를 사용해 M=4*S+10*65536의 보수 예약안으로 구체화한다. 실제 행표에서 각 projection 요소의 가변 payload 복제가4회 이내임을 검산한다. 초과하면 정확 행표로 Main에 반환하며 예약식을 증명된 값으로 조정한다. 뒤640KiB는 고정 envelope/새 로컬 시각·hash 등 여유다. 실제 정산에는 모든 최종 행 bytes를 포함한다.

단일 part의 b=M+D, r=M+2D에서는 D=r-b, M=2*b-r로 파생할 수 있다. 게시 전/정산에서 projection과 예약식을 다시 검산하며 원 Artifact 재계상0·diff 실제1배/예약2배·UNKNOWN hold·I1의 exact diffRef/단발 보호는 불변이다. M은 새로운 수용 상한이나 실제 사용량이 아니다.

새 SourceLinkEvent 초과거절, 기존 유효94692B 공통 proposal 수용, table-kind 위장·예약부족·10slot·I1 음성을 구분해 반례를 확장한다. 기존 음성 단언을 제거하거나 넓은 COMMON 예외로 우회하지 않는다. 이 r2는 기존 기능·유효 입력을 보존하는 내부 적용 정정이며 새 역할/키/권한·공개 승인 의미·실제 DB/서비스/Agent 실행은 추가하지 않는다. 과거 WI/검토는 Git 이력에 보존하고 현재 최종 지문으로만 후속 구현을 대조한다.
