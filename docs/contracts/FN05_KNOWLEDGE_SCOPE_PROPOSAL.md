# FN05 프로젝트 내부 지식의 단계·업무 선별 계약 후보

- 상태: **PARTIALLY_ADOPTED_SOURCE_ONLY**. PMO는 2026-10-25 원 후보 SHA256 0FFE97E4450FC1614CCEBCEF8CDA375A991B0B6F9B994589660C90A80BE61747의 A 중 §1과 §2의 저장·정확 조회 상세화만 위임 채택했다. §2.1 검색 query/cursor는 아직 NOT_ADOPTED이며 변경하지 않는다. 이 채택은 실제 DB/정책/서비스/인증서/Agent 실행 승인이 아니다.
- Main 어울, 2026-10-25. WORK_PLAN Stage B FN05/UI10, FUNCTION_WORK FN05, 설계 §8.1·§11.11, INTERFACES §10.3 KnowledgeEntry의 미완료 범위를 구체화한다.
- 현재 서버 knowledge-entry.ts는 stageRefs/taskRefs/relatedRefs에 값이 있으면 412, Web api.ts는 빈 배열만 저장·판독한다. 관련 source 원문·공유·실제 Agent 전달과는 별도 기능이다.

## 1. 권장안 A — 같은 프로젝트의 관련성 태그

기존 saveKnowledge/correctKnowledge, 불변 KnowledgeVersion·본문/출처/검토·확정 계약을 유지한다. scope는 접근 권한이 아니라 사용자가 선언한 관련성이다. 프로젝트 권한을 줄이거나 넓히지 않고 다른 프로젝트로 노출하지 않는다. stage/task가 현재 실행 중이거나 그 지식이 자동 적용된다고 표시하지 않는다.

- scope={projectId,stageRefs:KnowledgeStageRef[],taskRefs:KnowledgeTaskRef[]}.
- KnowledgeStageRef={applicationRef:VersionRef,nodeId:string}. 같은 프로젝트의 실제 고정 적용본 hash/version 및 그 graph의 정확 노드가 있어야 한다. 과거 적용본은 과거 관련성으로 보존하며 최신 적용본으로 자동 치환하지 않는다.
- KnowledgeTaskRef={planRef:VersionRef,taskCode:string}. 같은 프로젝트의 정확 작업계획 버전/hash와 실제 업무 코드가 있어야 한다. 초안·확정은 기존 원문 상태로 표시하고 지식 연결만으로 계획 확정/업무 실행을 하지 않는다.
- 두 배열의 합은 기존 참조 상한 200 이내, 중복·추가 키·임의 경로·잘못된 Unicode/UUID/버전/hash를 거절한다. relatedRefs=[]는 그대로 유지한다.
- PURPOSE/CONSTITUTION은 기존 프로젝트 공통 의미를 유지하여 두 배열이 비어 있어야 한다. DECISION/FACT/HYPOTHESIS/FAILURE_SOLUTION/CAUTION만 단계·업무 관련성을 선택한다. 빈 scope는 프로젝트 공통이다.
- 쓰기에서는 같은 인증 transaction/프로젝트 제어·명시 정책·정확 버전 아래 실제 참조를 다시 대조한다. 원문/출처·민감정보 검사와 불변 hash/영수증/감사는 완화하지 않는다.
- 과거 빈 scope의 JSON/hash/기존 버전은 변경하지 않는다. 범위 변경도 기존 correctKnowledge의 새 버전·정정 이력으로만 보존한다. 과거 참조가 미확인이면 이를 표시하고 다른 scope로 교체하거나 현재 적용을 추정하지 않는다.

## 2. 조회·화면 소비

UI10은 기존 프로젝트 적용본 조회와 work-plans 목록/정확 조회에서 실제 단계·업무를 선택한다. 직접 UUID/경로 입력으로 존재·권한을 우회하지 않는다. 선택한 scope 및 고정 원문/초안·확정/과거 여부를 저장 전과 저장 재조회 후 표시한다. 연결만으로 지식 확정·Agent 전달·현재 임무 채택을 하지 않는다.

기존 knowledge 목록/검색은 scope 선택이 없으면 기존 동작을 유지한다. 선택이 있을 때는 정확 stageRef 또는 taskRef와 프로젝트 공통 지식 포함 여부를 명시한다. 관련성이 여러 개면 OR로 선별한다. 검색의 scope/filter는 서버에서 검증·적용하고 cursor에도 결박한다. 현재 페이지 일부를 필터한 결과를 프로젝트 전체 검색으로 보고하지 않는다.

### 2.1 현재 검색 계약 대조 후 exact wire 후보

기존 GET `/api/v1/projects/:projectId/knowledge`의 query/kind/status/limit/cursor는 유지하고 선택적인 `scope` query 문자열 하나만 추가한다. scope가 없을 때 기존 cursor filter 직렬화도 유지한다.

- `scope`의 원문은 최대 2048자의 canonical JSON 문자열이며 `{stageRef:KnowledgeStageRef|null,taskRef:KnowledgeTaskRef|null,includeProjectWide:boolean}` 정확 세 필드다. URLSearchParams로 전송한다. canonical 재직렬화와 원문이 다른 입력·반복 query/배열·잘못된 JSON/추가키·두 ref가 모두 null인 입력은 400이다.
- 프로젝트 참여 확인 후 같은 프로젝트의 실제 고정 적용본/계획·노드/업무가 있는지 확인한다. 타 프로젝트와 미존재를 구분하는 정보를 노출하지 않는다.
- 결과는 선택 stageRef가 stageRefs에 있거나 선택 taskRef가 taskRefs에 있는 head 버전이다. includeProjectWide=true일 때만 두 scope 배열이 비어 있는 프로젝트 공통 head도 포함한다. 현행 kind/status/제목·이유 검색·정렬·행수 상한은 함께 적용한다.
- scope 필터가 있으면 기존 cursor filter에 `KNOWLEDGE_SCOPE_V1` 및 canonical scope를 별도 구조화 키로 결박한다. 다른 scope·공통 포함 여부·project/query/kind/status의 cursor 재사용은 400이다. 무필터의 기존 cursor를 필터 검색으로 가져오거나 반대로 쓰지 못한다.
- 응답 최상위 형식과 KnowledgeHit는 바꾸지 않는다. 범위 표시는 선택한 필터와 정확 KnowledgeVersion GET의 entry.scope를 소비한다. 목록의 전체 의미/본문·범위 원문은 명시 조회로 확인하고 새 자동 본문 조회를 만들지 않는다.

## 3. 구현·검증 경계와 대안

요청 범위는 위 A의 코드·Web·단위/in-process/fakeDB·합성 브라우저와 필요한 계약 본문 통합이다. 기존 knowledge_versions의 scope_json/entry_json·명령을 소비하며 새 table/SQL/migration·실제 DB 적용·사용자 정책/권한·Secret/키/인증서·서비스·실제 Agent/비용·외부/교차 프로젝트 공유는 포함하지 않는다. 기존 FN05 DD166F/공유 NOT_ADOPTED·FN03 producer/§13.4 등의 특정 거절을 해제하지 않는다.

필수 반례: 다른 프로젝트/없는 적용본·계획/다른 hash·없는 노드·업무/중복·초과/전체 목적·헌법의 국소화·옛 버전 덮기·검색 cursor 범위 전용/정정 및 조회 거절·저장 결과 불명에서 같은 명령 보존. 실제 PG/served 검수는 별도 현재 환경과 허용 범위를 대조하고 미실행은 미검증으로 남긴다.

대안 B는 단계별 읽기 ACL까지 도입하는 것이다. 이는 현재 요청이 아니고 새 권한·공유 모델이므로 권장하지 않는다. 원 후보의 저장·정확 조회는 위임 채택됐으며 그 경계 안의 제품 코드·검증을 진행한다. 검색 wire는 후보로 추가 고정했으나 채택 전까지 기존 검색 계약을 유지한다. 저장·정확 조회와 검색까지 확인해야 단계·업무별 선별 전체가 완료된다.
