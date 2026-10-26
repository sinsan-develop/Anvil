# UI10 보관 지식의 항목별 내용검토 상세 조회

## 승인된 업무와 누락

WORK_PLAN Stage B FN05/UI10, FUNCTION_WORK FN05의 원문·이유·이력 조회, SCREEN_WORK UI10 및 설계 §11.11을 소비하는 화면 업무다. 기존 ProjectKnowledge.read/readKnowledge/validateKnowledgeView가 반환하는 contentReviews를 사용한다. 현재 KnowledgePage는 해당 내용을 JSON으로만 노출한다. 기존 검토·확정 저장을 재구현하지 않고 사용자가 검토의 각 판단과 이유를 펼쳐 읽도록 한다. 새 API/SQL/권한·계약 변경이 아니다.

## 담당과 허용 파일

Main 어울은 관리·독립 검수·통합, 별도 단일 구현 subagent가 수행한다. 앞선 UI02 round2 writer 해제 뒤에만 착수한다. 현재 dirty·보호 미추적 자료 및 N4 source를 보존한다.

- apps/web/src/features/knowledge/KnowledgePage.tsx
- 신규 apps/web/src/features/knowledge/KnowledgeStoredReviewDetails.tsx
- 신규 tests/unit/FN05/knowledge-stored-review-details.test.ts
- 신규 tests/browser/UI10/knowledge-stored-review-details.spec.ts
- 필요 시 같은 이름의 전용 harness.tsx (Main에게 실제 필요를 알리고 허용한 뒤 작성)

서버·reader/validator·공통 계약·DB·서비스·Secret·Agent·다른 제품 파일·기존 시험 기대는 수정하지 않는다. 구현자는 Git·문서·자원 생성을 하지 않는다.

## 사용자 화면 동작

1. 현재 보호 조회된 KnowledgeView의 보관 검토 목록을 기본 접힘으로 표시한다. 이력 순서와 정확 대상 id/version/hash, 검토 ID·총판정·이유·검토자·기록자 동일 여부·원시각·serverSequence를 읽는다.
2. 각 검토가 보관한 criteria.items의 당시 제목과 criterionId로 항목별 outcome/reason을 연결한다. 현재 화면의 양식 제목으로 대체하지 않는다. 항목 5개, 적합/재작업/차단/미실행을 구분하며 미실행을 PASS로 표시하지 않는다.
3. 기존 원문 출처·검토·확정 JSON과 변경·확정 동작을 보존한다. 읽기 화면에서 명령·확정·헌법 적용·Agent 허가를 만들지 않는다. 내용은 React 텍스트로 escape한다.
4. 현재 view가 사라지거나 다른 정확 버전/프로젝트/주체로 바뀌면 과거 펼침 내용이 남지 않게 기존 Page 경계를 소비한다. 별도 데이터 캐시·자동 GET/POST를 만들지 않는다. 검토 없음과 메타데이터 미제공을 구분한다.

## TDD와 검수

- 제품 작성 전 신규 SSR 시험으로 모듈/상세 표시 부재 RED 확인. 두 검토·각 5항목·보관 제목/판정/이유·긴 ref·악의적 텍스트 escaping·빈 목록/미제공·읽기 전용·입력 불변을 검증한다.
- 실제 KnowledgePage 합성 DOM에서 명시 원문 조회→접힘/펼침, 다른 버전 선택·403 뒤 이전 상세 숨김을 확인할 준비를 한다. 실제 ApiClient/기존 validator를 소비하고 same-origin 합성 transport만 사용한다.
- 직접 인접 조회/검토/이력 단위 검사, typecheck, 메모리 제품 build와 diff. 무관 전수 회귀 반복0. 시험 기대·합격 기준 완화0.
- 실제 브라우저 자원은 Main이 이름/owner/수명/정리 사전등록 후 실행·정리한다. 담당은 spec/harness만 작성하고 브라우저·QA 경로·캐시를 생성하지 않는다.
- 정확 변경 파일·working SHA·RED/GREEN 명령/exit·미검증/rollback·writer 해제 제출. Main이 독립 검수·한정 DOM 후 게시한다. 실제 DB/served/사용자 인수·전체 FN05/UI10/Stage/계획 완료로 승격하지 않는다.

## 선행 읽기 검수 보완

- 기존 서버·클라이언트는 저장 criteria snapshot과 고정 v1 기준 동등성을 검사한다. 검증된 r.criteria.items를 표시하되, 같은 성공 응답의 두 검토에 서로 다른 기준 제목을 합성하지 않는다. 과거 기준 변경 지원을 새로 도입하지 않는다. 검토 당시 제목 보존은 기존 응답이 제공한 저장 snapshot을 그대로 읽는 의미다.
- 신규 상세는 state/cache 없이 현재 view만 렌더링하고 프로젝트/사용자/client/정확 view.ref key로 펼침 상태를 초기화한다. 항목은 배열 위치가 아니라 criterionId로 연결한다.
- DOM의403은 지식 원문 GET 거절로 한정한다. 기존 Page inspect의 setView(null)/요청ID 경계를 소비하며 변경 명령의 모든403까지 숨긴다고 확대 주장하지 않는다.
