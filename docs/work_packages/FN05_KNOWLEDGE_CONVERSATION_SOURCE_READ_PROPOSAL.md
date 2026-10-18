# FN05 지식 대화 출처 원문 조회 계약 제안

상태: 결정 대기. 작성: Main 어울, 2026-10-18. 수신: PMO·신산님. 제품 기준은 `codex/av3-stage-b`의 `59604dae6fb0f2ec4ada64cc2c5bce9c6a6a3355`다.

UI10에서 지식에 연결된 대화·사용자 지시 원문을 직접 열기 위한 보호 읽기 계약만 결정한다. 승인 전 endpoint·제품 코드·DB·서비스는 변경하지 않는다. FN01 QA 패킷·H4 승인과 무관하다.

## 1 현재 경계와 변경 이유

- 설계 §6·8.1 및 WORK_PLAN FN05/UI10은 원문과 지식·결정 이유를 연결해 조회하도록 한다.
- `apps/server/modules/knowledge/knowledge-entry.ts`의 대화 출처는 `{kind,id,contentHash}`이며 conversationId가 없다. `knowledge.ts`의 #verify는 같은 프로젝트의 메시지 ID로 conversationId를 찾아 기존 readMessage를 호출하지만 이 역조회는 공개된 읽기 연산이 아니다.
- `apps/server/modules/projects/routes.ts`에는 지식 exact 버전 조회와 `conversations/:conversationId/messages/:messageId`만 있다. `KnowledgeDocumentSources.tsx`는 문서·파일만 열고 나머지는 직접 열기 미연결이라고 표시한다.
- 전체 대화 목록을 훑어 메시지를 찾거나 ID/대화 주소를 추측하지 않는다. 저장 SourceRef를 개정하거나 대화 원문을 지식 본문으로 대체하지 않는다.

## 2 요청할 결정

권장안은 새 **출처 귀속·대화 위치 확인용 보호 GET 1개**와 UI10 연결이다. 새 응답은 원문을 중복 운반하지 않고 고정 참조와 검증한 conversationId만 반환한다. Web은 기존 `readConversationMessage`를 1회 더 호출하여 이미 있는 본문 바이트·UTF-8·hash 검증을 재사용한다. 새 본문 검증기를 복사하거나 기존 읽기 API를 개편하지 않는 좁은 방식이다.

대안은 현재 직접 열기 미연결을 유지하는 것이다. 문서/파일 출처와 나머지 기능 개발은 계속 가능하지만 지식에서 해당 대화의 원문을 바로 검토할 수 없다.

승인 범위는 아래 보호 읽기 계약·구현·합성 시험·정상 Stage B commit/push까지다. 새 schema/migration·지속 도메인 데이터/정책 부여·계정/Secret·certificate·서비스/배포·실제 Agent·정식/격리 실제 DB QA는 포함하지 않는다. 기존 인증 세션 처리를 대체하거나 완화하지 않는다.

## 3 정확 요청과 응답

`GET /api/v1/projects/:projectId/knowledge/:knowledgeId/versions/:version/sources/:messageId?knowledgeHash=<64 lowercase hex>&sourceHash=<64 lowercase hex>&sourceKind=CONVERSATION|USER_INSTRUCTION`

- UUID는 기존 UUID 계약, version은 1 이상 안전 정수다. query는 위 3개 필수 키만 허용하며 중복 키·미지정·추가 키·배열·다른 kind·hash 형식은 400이다. body·cursor·limit·conversationId 입력은 받지 않는다.
- 기존 Anvil HUMAN 세션·Host·현재 프로젝트 회원/회수 경계를 적용한다. 읽기이며 제어권 획득이나 변경 허가·CSRF 발급은 하지 않는다.
- 성공은 아래 정확 5필드이며 `Cache-Control: no-store`다.

```json
{
  "schemaVersion": 1,
  "projectId": "<requested project UUID>",
  "knowledgeRef": { "id": "<knowledgeId>", "version": 1, "contentHash": "<knowledgeHash>" },
  "source": { "kind": "CONVERSATION", "id": "<messageId>", "contentHash": "<sourceHash>" },
  "conversationId": "<verified conversation UUID>"
}
```

source.kind는 요청과 지식에 실제 저장된 종류를 그대로 반환한다. USER_INSTRUCTION이면 실제 발언도 USER_INSTRUCTION이어야 한다. CONVERSATION은 기존 계약상 일반 대화 참조로 유지하며, 실제 발언 종류는 후속 기존 GET으로 읽는다. 이를 현재 유효한 지시·Agent 전달/이해·지식 확정/적용으로 승격하지 않는다.

Web은 응답의 모든 ID·version/hash·종류·필드와 UUID를 요청 snapshot에 대조한 뒤, 같은 projectId/conversationId와 `{kind:'CONVERSATION',id:messageId,contentHash:sourceHash}`로 기존 보호 원문 GET을 1회만 한다. USER_INSTRUCTION은 후속 원문에서도 종류를 재대조한다. 성공까지 원문은 표시하지 않으며 다른 대화/최신 지식으로 대체하지 않는다.

## 4 서버 확인 순서와 역조회 상한

1. 기존 인증·프로젝트 회원 확인 후, 기존 `ProjectKnowledge.read(db,actor,pid,id,version)`로 그 불변 버전의 entry·본문·이력·출처·격리 검사를 유지한다. 반환 ref가 knowledgeId/version/knowledgeHash와 정확히 같아야 한다.
2. 반환 entry.sourceRefs에서 요청 sourceKind/messageId/sourceHash와 정확히 일치하는 항목이 **1개**인지 확인한다. 현재 head·다른 버전·다른 종류로 대체하지 않는다. 과거/제외된 버전의 읽기 이력은 보존하며 현재 임무 사용 가능으로 표시하지 않는다.
3. 다음과 같은 프로젝트·메시지·hash 한정 parameterized 역조회만 추가한다.

```sql
SELECT conversation_id
FROM anvil.conversation_messages
WHERE project_id=$1 AND id=$2 AND content_hash=$3
LIMIT 2
```

기존 UNIQUE(project_id,id)와 id UNIQUE를 사용한다. 결과 0개는 404, 2개나 잘못된 conversationId는 무결성 오류다. 새 index·목록 pagination·전체 프로젝트/대화 검색·재귀/백그라운드 수집은 없다.

4. 같은 프로젝트의 기존 `ProjectConversations.readMessage`를 재사용하여 ref hash·요청 종류·message snapshot·sequence/author·scope·redaction을 대조한다. 이 함수는 `ProjectDocuments.originalText`의 READY/격리 상태·보호 저장 경로·파일 bytes/hash·UTF-8와 알려진 비밀 표식 검사를 유지한다. 새 endpoint는 이 검사를 통과한 뒤에도 본문 없이 참조만 반환한다.

**범위와 비용:** 신규 역조회는 한 행(불변조건 깨짐 감지용 LIMIT 2)이며 사용자 클릭당 새 metadata GET 최대 1회+기존 원문 GET 최대 1회다. 기존 Knowledge.read 자체는 entry 출처 최대 200개, 개정 이유의 change_sources도 최대 200개를 검증하므로 그 기존 최대 400회 출처 순회 및 관련 원문 검사는 그대로다. 이는 새 endpoint 전체를 ‘SQL 1회’ 또는 ‘항상 가벼운 조회’라고 주장하지 않는 이유다. 이 검사를 생략하거나 새로운 무한/전수 검색을 추가하지 않는다. 원문 한 건의 기존 2MiB 한도를 유지한다.

## 5 실패와 원문 비노출

| 조건 | 상태와 처리 |
|---|---|
| 만료/익명 세션 | 기존 401. 현재 요청일 때만 로그인 상실 callback |
| 잘못된 Host | 기존 403. 보호 응답/원문 반환 없음 |
| 없는 회원·교차 프로젝트·없는 지식/버전/메시지·출처 미귀속 | 기존 존재 은닉 404, 다른 프로젝트/본문 노출 없음 |
| 요청 knowledgeHash·출처의 id/kind/hash 불일치 | 409 KNOWLEDGE_SOURCE_CHANGED. 참조/본문 반환 없음 |
| USER_INSTRUCTION인데 실제 종류 불일치 | 422 KNOWLEDGE_SOURCE_KIND_MISMATCH |
| 알려진 비밀·격리 파일·저장소 미설정·미지원 원문 | 기존 412/422 코드 유지. metadata를 성공으로 대체하지 않음 |
| 지식/사건/메시지/파일 무결성 또는 중복 역조회 | 기존 503 또는 KNOWLEDGE_SOURCE_INTEGRITY_FAILED 503. raw 원문/DB row/내부경로를 오류에 넣지 않음 |
| 단절/형식 불일치·취소 | 미확인. 자동 재전송·다른 원문 fallback 없음 |

귀속 0개와 같은 ID의 종류/hash 불일치는 서로 다른 내부 사유로 판별하되, 응답에는 허가되지 않은 대상 내용이나 내부 row를 담지 않는다. 기존 보호 원문 검사에서 더 앞서 거절되면 그 오류를 보존한다. 모든 실패 시 앞선 성공 본문을 숨긴다.

## 6 UI와 늦은 응답

현재 지식 버전의 대화/지시 출처 행에 ‘대화 원문 보기’를 제공한다. 선택 당시 user/client/project/knowledgeRef/source 전체를 복사하고 외부 parent key와 내부 nonce로 분리한다. 지식·주체/client 전환/닫기·새 선택에서 결과 반영을 취소한다. 두 GET 사이에도 활성 선택을 확인하며 취소 후 후속 GET·상태/401 callback을 만들지 않는다. 이미 전송된 GET의 물리적 중단까지 보장한다고 하지 않는다.

표시는 escaped 텍스트이며 실제 발언 종류·순번·작성자·고정 hash·지식 버전·과거 출처라는 범위를 함께 제공한다. 원문 지시를 실행하거나 현재 유효한 지시로 자동 채택하지 않는다. 지식·정정/제외·결정·대화 buffer/pending은 변경하지 않는다.

## 7 최소 파일과 검수

- 서버: `apps/server/modules/knowledge/knowledge.ts`의 제한 읽기 메서드, `apps/server/modules/projects/routes.ts`의 새 보호 GET.
- Web: 신규 `features/knowledge/knowledge-conversation-source.ts`, `KnowledgeConversationOriginal.tsx`, 기존 `KnowledgeDocumentSources.tsx`의 대화 행 연결. 기존 conversation-api/readMessage/원문 저장 코드는 개편하지 않는다.
- 직접 시험: `tests/unit/FN05/knowledge-conversation-source.test.ts`, `knowledge-conversation-source-routes.test.ts`, `knowledge-conversation-original.test.ts`. 승인 후 TDD로 정확 귀속/버전·두 GET·무결성·취소, 익명/교차 프로젝트/미귀속/종류·hash/격리/변조/추가 query·중복 결과와 원문 비노출을 확인한다. fake DB/저장소·Fastify.inject·SSR의 증거 범위를 명시한다.
- 인접: 기존 knowledge API·문서/파일 출처·대화 원문 API·source attach의 영향 범위, typecheck·Web build·diff check와 기존 검토자 한정 읽기 1회.
- 계약/기록: 승인 후 `docs/contracts/INTERFACES.md`에 정확 계약을 추가하고 `docs/WORK_STATUS.md`에 단계/오류/검증·미확인을 누적한다. 이 제안과 실행 승인은 구분한다.
- 실제 DB·served browser·로그인 여정/프로젝트 권한·사용자 인수는 별도 실행 근거가 없으면 미검증으로 남긴다. 한정 합격으로 FN05/Stage/계획 완료를 선언하지 않는다.
- rollback: endpoint/표시 연결 commit의 일반 revert. 새 데이터·migration·권한 부여가 없으므로 데이터 복원은 없다. 기존 원문/지식 이력은 보존한다.

