# FN09 정상 최초 이해응답 선택·검토 연결 — 직접 결정 후보 r1

상태: **DRAFT / NOT_ADOPTED / 구현·실행 승인 아님**. 기준 소스 `34e1ed20`. 담당 developer_primary, 결정·후속 파일 배정은 Main. 이번 작성은 문서 한 개이며 제품·SQL·실자료·DB·키·권한·서비스·SDK·Agent·WSL 실행은 없다.

## 1. 결정할 사용자 흐름과 범위

권장 A: 사용자가 현재 임무에 결박된 **같은 CONTEXT_REVIEW 세션**의 보호된 출력에서 고정된 범위를 직접 선택하고, 원 맥락과 응답을 보며 6기준별 근거·판단·이유를 작성한다. 선택한 응답의 불변 보관 근거를 만든 뒤 기존 `reviewUnderstanding`와 일회 승인·이력 경로로 최초 검토를 저장한다. 저장 결과는 사람의 검토 기록이다. Agent의 자동 MATCH, 개별 SEND에 대한 응답 귀속, 현재 WORK 허가·dispatch·재개는 만들지 않는다.

대안 B: 기존 보관 이력을 이용한 재검토만 유지한다. 신규 노출·저장 의미는 없으나 첫 검토가 없을 때 정상 화면에서 시작할 수 없는 공백이 남는다. 이 문서는 A의 최소 차이를 결정 대상으로 제시하며 A를 이미 승인됐다고 취급하지 않는다.

성공 동선은 `UI04 임무/책임 세션 선택 → 같은 실행·세대 CONTEXT_REVIEW의 출력 명시 조회 → 고정 범위와 원문 확인 → 6기준별 근거 선택 → 응답 선택 보관 → 최초 검토 명령 준비 → 필요하면 기존 별도 승인 → 명시 저장 → 정확 이력 재조회`다. 결과 제출을 첫 이해 검토의 선행으로 요구하지 않는다. ID 수기 입력, 가짜 제출 결과 생성, 최신 세션 추측으로 기존 재검토 폼에 진입하지 않는다.

## 2. 현재 근거와 재사용 한계

아래 줄 번호는 기준 소스의 위치다. 문서의 새 제안과 현재 구현 사실을 구분한다.

| 근거 | 확인한 사실 / 한계 |
|---|---|
| `docs/design/Anvil_설계서_v3_초안.md:297–313,414`; `docs/work_packages/FUNCTION_WORK.md:113–122` | 기준 원문/버전→대상 응답→6항목 판단·확인 주체를 보관하고, 필수 맥락·이해 대조 전 실행을 막는다. hash나 읽음만으로 의미 합격을 만들지 않는다. |
| `docs/approvals/FN09_UNDERSTANDING_REVIEW_SOURCE_DIRECT_APPROVAL_20261030.json:5–13`; r1 결정안 `FN09_UNDERSTANDING_REVIEW_APPROVAL_DECISION_PACKET_20261030.md:16–27` | 기존 원명령의 승인 후보·조회·일회 소비 연결은 채택됐다. 실제 응답 공급자 활성화는 제외됐고 current/수신/6기준 불일치 시 승인도 저장을 우회하지 못한다. 이를 재승인할 필요는 없다. |
| `apps/connector/runtime/normal-sdk-session-output.ts:19–35,49–51,99–112,203–224` | 원 owner/attempt/query/iterator 및 실행·등록·profile·assignment·slot·grant·START/FIRST·session scope에서 canonical SDK 메시지의 base64 원문, payload digest, 순번/previousRef를 보호 저장한다. row fullref hash는 snapshot hash다. init 확인 뒤 반환은 `SESSION_ONLY/outputRef/initConfirmationRef/processRef:null`. init 전 원 row를 다시 쓰지 않는다. |
| `apps/connector/runtime/normal-start-file-store.ts:83–90,115–145`; `normal-owned-spool-profile.ts:333–372,375–417` | `sdk-session-output`은 원 output owner에 결박된 private 접근만 가능하다. canonical JSON+LF, 연속 파일/행, NOFOLLOW·파일 신원·길이, append/sync·재판독·정상 종결 및 공동 예약을 확인한다. 이 내부 읽기가 HUMAN 공개 원문 조회 권한을 뜻하지 않는다. |
| `apps/connector/runtime/normal-start-coordinator.ts:70–83,120,175–176`; `apps/server/modules/executions/normal-start-materials.ts:27–45,81,152`; `normal-start-context-source.ts:29–99` | 원 START의 맥락/Options와 수신·READY 근거를 exact 검산한다. 정상 grant/명령/실행·세대/원 맥락/등록·회수/기한을 확인하는 입력 경로다. `receivedRef` 하나를 모든 requiredPartRefs의 수신으로 치환하거나 READY를 이해응답으로 사용하지 않는다. |
| `apps/server/modules/executions/execution-understanding.ts:13–23,39–49,68–84,86–110`; `execution-understanding-store.ts:12–33` | 기존 입력은 bundleRef/responseRef/subjectBindingRef와 6항목이다. current는 원 기준·최신 지시·필수/수신/응답 부분과 항목별 매핑을 전후 대조한다. 현재 store/facts는 `SYNTHETIC_ONLY`이며 실제 응답 현재성은 공급하지 않는다. 이력은 command/receipt/audit와 대조한다. |
| `db/migrations/0019_understanding_reviews.sql:4–16,25–50`; `0056_understanding_review_one_time_approval.sql.pending:131–208` | 기존 검토 이력과 불변/완결 검산을 재사용할 토대가 있다. 그러나 `understanding_input_valid`는 `SYNTHETIC_ONLY`의 exact binding을 요구한다. 기존 표가 있으므로 새 표·역할·GRANT가 반드시 필요하다고 단정하지 않으며, 정상 형상의 추가도 단순 이름 치환으로 처리하지 않는다. 실제 ACL/PG 검증은 미실행이다. |
| `apps/server/modules/executions/provider-session-claim-history-routes.ts:20–55`; `apps/web/src/features/workspace/ClaimUnderstandingHistory.tsx:6–12` | 기존 보호 claim 목록에서 실행·세대를 탐색하고 과거 검토로 이동할 수 있다. claim은 응답 원문/부분 선택이 아니고, 화면도 claim과 검토 응답의 직접 대응 미확인을 표시한다. |
| `apps/web/src/features/session-detail/understanding-review-write.ts:17–28`; `apps/server/app.ts:95`; `apps/server/main.ts:23` | 웹은 이전 검토의 고정 근거로만 재검토를 시작한다. 이력 route는 합성 제공자만 공급받고 main은 실제 공급자를 조립하지 않는다. 기존 소비자만 바꾸면 최초 원 근거가 생기는 상태가 아니다. |

## 3. 선택과 참조의 의미 — A의 신규 한정 계약

### 3.1 선택의 출처와 범위

- UI04에서 이미 보호 조회한 임무/책임 세션과 claim의 실행·세대는 **탐색 입력**으로만 사용한다. 서버는 그 입력과 정상 START/FIRST의 실제 불변 원장·현재 등록/역할/세션/맥락을 독립 대조한다. claim을 선택한 응답의 부모 또는 개별 SEND의 귀속 증거로 선언하지 않는다.
- 하나의 원 CONTEXT_REVIEW scope, 하나의 initConfirmationRef와 조회 때 고정한 tail에 한정한다. project/execution/generation/assignment/session/role binding 및 원 등록·slot·START/FIRST 결박이 달라지면 섞지 않는다. mode는 출력 row 자체에 없으므로 원 START/준비 원문에서 검산한다.
- 사람은 검산된 유계 목록의 **연속 순번 구간**을 고른다. 선택에는 각 원 outputRef·순번·payload digest와 원 init 확인, 범위 앞/뒤 경계 및 고정 tail을 결박한다. UI가 보낸 ID/hash만으로 채택하지 않고 원 소유 보호 저장에서 재검산한다. 목록 자동 요청·다른 세션 fallback·전체 스풀 다운로드를 열지 않는다.
- 보여 줄 자료는 기존 ORDINARY 분류와 서버의 현재 보호 읽기 판단을 모두 통과한 응답 본문이다. ORDINARY만으로 공개를 허용하지 않는다. QUARANTINED·미지원·본문 해석 불명·필수 행 누락을 건너뛰어 완전한 응답처럼 만들지 않는다. SYSTEM_INIT/제어 row는 원 범위의 검산 근거이고 사람의 응답 내용으로 표시하지 않는다. raw SDK 전체 object, SID/프로세스·OS 경로·Secret·도구 인수/환경을 일반 JSON details로 노출하지 않는다.
- 표시 가능한 본문 projection은 원 row와 정확한 부분 위치/유형·hash를 함께 결박한다. 승인된 text 구조로 분해할 수 없는 family/부분은 미지원이다. 임의 문자열 검색·재서술·합성 요약으로 응답을 만들지 않는다. projection만 있고 원 canonical 자료를 대조할 수 없으면 선택 보관을 거절한다.
- 스풀 DONE이나 SDK RESULT_SUCCESS가 의미 검토의 완료·정확성을 증명하지 않는다. 유효한 고정 prefix는 선택할 수 있으나 전체 대화 완료라고 표시하지 않는다. init 미확인·UNKNOWN 정착·부분 쓰기/수거 불명은 신규 선택 불가다. tail 뒤 새 출력은 원 선택을 자동 확장하지 않고 명시 재조회로만 보인다.

### 3.2 불변 선택과 6기준

- 선택 보관은 기존 ref 문법의 새 `responseRef`와 선택된 `responsePartRefs`를 만드는 **신규 불변 자료 의미**다. 원 outputRef/initConfirmationRef를 덮거나 그 hash를 다른 내용의 ref에 재사용하지 않는다. 선택 snapshot은 원 scope/범위/원 참조/현재 보호 대조 근거/확인 주체를 보관하며 `SESSION_ONLY`를 유지한다. 별도 SEND 응답, 도구 실행·시험 성공, WORK 허가를 뜻하지 않는다.
- bundleRef와 subjectBindingRef는 원 맥락·책임 세션에서 확인한 정확 fullref다. 6코드 `PURPOSE_REASON/BASELINE_AUTHORITY/DECISIONS_REASON/CURRENT_POSITION/ACTUAL_GAPS/NEXT_ACTION` 각각의 sourceRefs는 원 맥락에서 검산한 basis의 부분집합, responsePartRefs는 위 선택 부분의 부분집합이어야 한다. 사람이 원문을 대조해 선택하고 이유를 쓴다. 서버는 존재·해시·귀속·범위만 확인하며 MATCH를 자동 작성하지 않는다.
- 각 항목과 전체 ref 배열에서 중복·순서 변조·영역 밖 부분은 거절한다. 서로 다른 기준이 같은 부분을 근거로 쓰는 것은 허용하되 공유 참조임을 표시하고 자료/비용을 중복 계산하지 않는다. 과거 선택과 겹친 새 선택은 새 범위를 명시 확인한 불변 선택이며 과거를 덮거나 새 출력·새 수신 사건으로 계산하지 않는다. 같은 명령의 동일 원문은 replay, 같은 commandId의 다른 범위는 충돌이다.
- 기존 6항목의 비어 있지 않은 source/response refs 규칙은 유지한다. 필수 전달 부분이 없거나 확인할 응답 부분이 전혀 없으면 최초 검토 저장으로 가지 않고 부족을 표시한다. 유효한 원 부분을 대조해 사람이 `MISMATCH/INSUFFICIENT`라고 판단하는 것은 그대로 허용한다. ‘부족’ 판단을 저장하기 위해 가짜 빈 ref를 만들지 않는다.
- 유계 선택의 canonical 저장·전송 전체는 기존 검토 2MiB 이하, 각 기존 ref 배열 200 이하, 이력 1,000 이하를 유지한다. 원 스풀의 3MiB/행·64MiB/채널·10,000행은 공개 선택 한도가 아니다. 원 자료/encoding/metadata를 포함해 한도를 넘으면 잘라 성공시키지 않고 범위 축소를 명시 요청한다. 보호 호출은 기존 30초와 원 인증/등록/소유/자료 유효기한 중 최단을 전후 검산한다. 신규 무기한 선택 권위는 없다.

## 4. 조회·원자 저장·현재성과 과거

**새로 필요한 경계:** 현재 private output 읽기의 서버 전달과 HUMAN 유계 목록/고정 원문 조회, 그리고 선택 snapshot의 불변 보관이다. 현재 보호 claim GET이나 이해검토 history GET에는 이 원문이 없으므로 응답 필드만 켜는 내부 수정으로 분류하지 않는다. 기존 인증·동일 origin·no-store·project/정확 실행 scope를 재사용한다. 첫 A는 현재 HUMAN OWNER/제어 보유자가 명시적으로 수행하고, 정상 출력 읽기/선택 보관은 별도 목적의 명시 PROJECT 정책으로 제한하는 안이다. 이 새 읽기/보관 목적은 AUTO만 허용, DENY 우선·REQUIRE_APPROVAL은 미연결 거절을 제안한다. 기존 reviewUnderstanding의 AUTO/일회 승인 의미는 바꾸지 않는다. 이 정책 차이도 **미채택**이다.

원 실행기→서버 전달은 동일 등록/slot/attempt/범위·기한과 현재 요청에 결박된 보호 읽기여야 한다. 일반 renderer upload나 caller의 verified boolean, 자기 hash만으로 원 출력 진위를 발급하지 않는다. 현재 내부 outputExclusive를 HTTP로 직접 노출하지 않는다. 실제 수송/서버 검증 방식은 이 조건을 만족하는 기존 등록 통신의 재사용 가능성을 채택 후 검수해 고정하며, 불충족 시 원문 전송을 열지 않는다. 실제 스풀/OS 공급자 미연결은 unavailable로 유지한다.

선택 보관의 원자성은 서버의 불변 선택/부분·원 command/receipt/audit·저장량 정산 사이에 적용한다. 원 SDK 스풀과 PG를 하나의 분산 transaction처럼 보증하지 않는다. 원 출력 prefix와 선택 경계는 보호 소유자가 정상 닫힌 읽기로 봉인한 유한 증거를 소비하고, 같은 서버 거래에서 현재 HUMAN/제어/정책/등록·실행 세대/role·필수 맥락을 잠그고 전후 대조한다. 원 저장과 정확 결박을 입증하지 못하면 COMMIT하지 않는다. 봉인 이후의 모든 OS 변화를 영구 보증한다고 표현하지 않는다.

기존 `understanding_reviews`에는 검토 기록, 기존 승인 후보 표에는 승인 요청을 계속 둔다. 응답 선택의 불변 원본을 기존 보호 artifact/자료 보관으로 담을 수 있는지 **원 출처 의미·quota·불변성·조회 ACL·FK/완결을 먼저 대조**한다. 사용자 제출 산출물이나 START 입력으로 이름만 바꾸어 넣지 않는다. 기존 저장소가 이 의미를 수용하지 못할 때만 최소 전용 자료 구조와 forward SQL/목적 권한을 후속 구현 명세에 확정한다. 이 후보는 새 표/역할/광범위 GRANT를 미리 승인하지 않으며 실제 PG/ACL을 검증한 상태도 아니다.

선택 저장 뒤 기존 reviewUnderstanding의 payload와 원명령 승인 규칙을 재사용한다. normal용 current 공급은 검산된 선택과 현재 원 맥락/수신/역할에서만 구성하고 합성 marker를 정상 자료에 붙이지 않는다. 현재 `SYNTHETIC_ONLY` exact TS/SQL/history 분기는 그대로 보존하고, 새 normal 분기를 별도로 닫아 검산하는 것이 A의 변경이다. 기존 0019/0056을 직접 고치지 않고 필요한 forward 검산을 작성한다. 정상·합성 이력의 혼합/자동 변환을 허용하지 않는다.

최초 검토는 exact 실행·세대의 이력 부재를 CAS로 확인하고 version1을 같은 거래에 저장한다. 경합해 기존 검토가 생겼으면 새 최초 저장을 거절하고 보호 이력 조회를 안내한다. 이후 검토는 기존 latest/previousRef와 현재성 대조를 유지한다. 새 선택 보관은 검토 없이 남을 수 있으나 `검토 미완료` 자료이며 ACCEPTED가 아니다. 삭제·자동 만료청소·quota 면제는 이 후보에 추가하지 않는다.

COMMIT 응답 유실은 원 commandId/hash/입력/선택 refs를 보존한다. 자동 새 명령·재전송·새 선택 생성 없이 사용자 명시 동일 명령 재확인만 한다. 정확 과거 receipt/완결을 조회하는 replay는 원 사건을 돌려줄 뿐 현재 선택 적격성/WORK 허가를 복원하지 않는다. 저장 후 재조회 실패는 저장 실패로 단정하거나 영수증을 지우지 않는다.

현재 출력 선택은 현재 role/세대·grant/등록/기한·정책을 요구한다. 과거 검토 이력은 기존 projectMember/인증의 역사 조회 의미를 유지하고 `NOT_RECHECKED`로 표시한다. 새 응답 원문 조회에는 **현재 새 읽기 목적 권한**이 필요하며 과거 grant/OWNER였다는 사실로 열지 않는다. 만료·회수된 실행의 과거 선택 원문도 현재 읽기 권한과 불변 원본이 검산되는 경우에만 열며 재사용·현재성은 부여하지 않는다. 원 자료 소실/접근불가와 정상 빈 이력을 구분한다.

## 5. 구현맵과 완료 경계

| 기존 재사용 지점 | 채택 후 필요한 최소 변경 후보 |
|---|---|
| `normal-sdk-session-output.ts`, `normal-start-file-store.ts`, `normal-owned-spool-profile.ts` | 원 scope/init/prefix/hash/정상 close를 재사용한 보호 유계 읽기. 출력 생산·SDK 호출/분류 권위 변경 없음. 원 public 수송은 현재 없으므로 별도 정확 소비선 검수 필요. |
| `normal-start-context-source.ts`, `normal-start-materials.ts`, 현재 정상 grant/역할 조회 | original bundle·실행·수신/필수 부분을 서버에서 대조. 실행기용 credential을 HUMAN 읽기에 재사용하지 않음. |
| `execution-understanding.ts`, `execution-understanding-store.ts`, `understanding-history-routes.ts` | normal 선택 원본/current 분기, 원자 기록·CAS·보호 역사 검산. 기존 AUTO/승인/replay와 합성 분기 보존. |
| `project-runtime-commands.ts`, `projects/routes.ts`, `app.ts` | 기존 reviewUnderstanding 명령 진입 재사용 검토, 새 출력 읽기/선택 보관 목적의 정확 배선. main 실제 공급자 활성화는 별도 실행 범위. |
| `WorkspaceResponsibleSessions.tsx`, `ClaimUnderstandingHistory.tsx`, `UnderstandingReviewEditor.tsx`, `understanding-review-write.ts` | UI04의 원 선택에서 최초 검토에 진입. 과거 결과를 만들어 기존 폼을 우회하지 않고, 저장된 정상 선택만 최초 base로 공급. 기존 결과→재검토/상위 pending 버퍼 보존. |
| `0019_understanding_reviews.sql`, `0056_understanding_review_one_time_approval.sql.pending`의 계약 | 기존 source를 수정하지 않고 forward가 필요한 exact 정상 형상/자료 정착·정산·완결을 확인. 기존 표 재사용 가능 여부에 따라 최소 DDL/ACL 후보를 확정. |

정확 endpoint/operation 이름·normal wire shape·source→server 신뢰 전달·보관 구조/권한은 위 의미를 구현하는 후속 WI에서 파일/상한/호출선과 함께 고정한다. **그 세부가 없는 상태에서 fake resolver만 main에 꽂는 것을 A 완료로 세지 않는다.** 이번 직접 결정은 이 신규 의미와 source/합성 구현 범위를 선택하는 것이며, 실제 OS 스풀 관측·DB 적용·권한/서비스 변경·SDK/Agent 실행·PRESPAWN/lease·WORK 활성화는 포함하지 않는다.

## 6. 검수표·미검증·rollback

| 사례 | source/RAM에서 요구할 결과 |
|---|---|
| 최초 정상 선택→6기준→AUTO/기존 일회 승인→저장/조회 | 같은 CONTEXT_REVIEW scope·원 바이트/ref·주체, 원자 선택·검토 완결. 사람이 작성한 판단만 저장, 실행 false. 실제 SDK/DB PASS 아님. |
| init 없음/부분쓰기/UNKNOWN/미완료 prefix | 원 확인 부재는 선택0. 정상 고정 prefix도 전체 대화 완료로 표시0. |
| 중복 row/ref·동일 명령의 다른 내용·구간 순서/chain 손상 | 거절·새 저장0. 동일 원명령 replay는 정확 과거 결과만. |
| 두 기준의 겹친 부분·과거 선택과 겹친 새 범위 | 기준 간 공유는 명시, 중복비용/새 출력 주장0. 범위 안 중복·암묵적 확장/덮어쓰기 거절. |
| 필수 전달 부족·기준 sourceRefs 밖·6코드 누락·응답부분 없음 | 신규 검토 저장0, 가짜 ref/자동 MATCH0. 유효 근거의 인간 MISMATCH/INSUFFICIENT는 보존. |
| canonical body/payload hash/outputRef/init/prefix 변조·재봉인된 다른 원본 | 원 보호 owner의 동일 근거 대조 실패, 표시·저장0. |
| 다른 project/실행·세대/등록·slot/session/role·WORK mode | 조회/저장 거절. 개별 SEND 귀속으로 보정0. |
| 인증/role/제어·정책 전환, 만료/회수, 지연·취소·transport/화면 ABA | 원기한·현재 문맥 상실 후 표시/저장 수용0, 늦은401이 새 화면 인증을 회수하지 않음. |
| 원 prefix/자료 교체·현재 맥락/지시 변화·동시 최초 저장 CAS | 서로 다른 시점 혼합0. 충돌 후 자동 최신 선택/새 명령0, 원 입력 보존. |
| 선택 또는 review transaction의 부분 실패·COMMIT 불명·후속 조회 실패 | 부분 APPLIED0, 불명 원명령·영수증 보존·명시 동일 명령 재확인. 재조회 실패를 자동 재저장으로 바꾸지 않음. |
| 과거 이력·새 원문 읽기 권한 없음·자료 부재 | 과거 사실과 현재 적격성 분리. 기존 history 권한을 새 원문 권한으로 확대0. |
| 2MiB/200refs/1,000이력·시간·quarantine 초과 | 한도 거절, 조용한 잘림/건너뛰기·무한 수집0. 원본/Secret/경로 오류·로그 노출0. |
| 기존 합성 AUTO/승인/이력·원 START/SEND/STOP | 기존 형상·거절·수신/명령 소비·pending 재확인 회귀 유지. |

현재 작성 검증은 소스/정본 읽기와 문서 공백·지문 확인뿐이다. 실제 보호 스풀 공급, 원격 수송 신원, PG transaction/락/RLS/ACL/정산, OS·SDK 및 실제 사용자 인수는 미검증이다. 후보 채택 뒤에도 이 범위를 나눠 보고한다.

후보 단계 rollback은 이 신규 문서의 철회다. 후속 source는 한정 변경을 되돌릴 수 있게 기존 합성/정상 분기를 분리한다. 실제 데이터가 생긴 뒤에는 불변 선택·검토 이력을 삭제하거나 과거 권한으로 재노출하지 않고 새 선택/저장 진입만 닫는 별도 복구안을 적용한다. 기존 승인·소진 기록과 원 스풀을 정리 대상으로 삼지 않는다.
