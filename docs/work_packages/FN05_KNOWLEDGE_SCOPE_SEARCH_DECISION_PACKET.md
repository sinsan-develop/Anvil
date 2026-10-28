# FN05 단계·업무별 지식 검색 한정 결정안

- 상태: DECISION_PENDING / NOT_ADOPTED. 제품·시험·DB 실행 허가가 아니다.
- 기준 source bb738bc903dca93d7c513a0219f469879f6d5808, 기존 후보 docs/contracts/FN05_KNOWLEDGE_SCOPE_PROPOSAL.md SHA256 E4D828C54692F715750F66E4AC29500AD8EC9030F0C73F6AFA8360F13CF59346의 §2.1만 추가 채택 대상이다. §1/2 저장·정확 조회 채택과 기존 FN05 공유A/업로드승인을 확대하지 않는다.

## 왜 결정이 필요한가

WORK_PLAN FN05/UI10의 단계·업무별 선별은 미완료다. 저장·정확조회는 구현했지만 검색 GET은 현재 query/kind/status/limit/cursor 이외 키를400으로거절한다(ProjectKnowledge.search). PMO는 §2.1 채택근거없음/현재 P03·FN16 지원범위밖으로 직접결정필요라고 회신했다. 새API입력·서명cursor 계약을 기존 저장승인으로 임의 확대하지 않는다.

## 권장안 A

- 기존 GET /api/v1/projects/:projectId/knowledge에 선택적 scope query 하나만 추가한다. wire는 원후보§2.1의 최대2048자canonical JSON {stageRef,taskRef,includeProjectWide} 정확3필드,두ref모두null/중복·추가key/비정규형/잘못된참조는거절한다.
- 기존현재프로젝트참여확인후 같은프로젝트의실제고정적용본/계획·정확node/task를대조한다. 다른프로젝트와미존재의내용차이를노출하지않고새읽기ACL·공유권한을만들지않는다.
- 지정단계 또는 지정업무에연결된최신지식버전을서버에서OR선별하고,공통지식은includeProjectWide=true일때만함께포함한다. 제목/이유·종류/상태·기존정렬/상한을함께적용한다. 현재페이지일부필터를전체검색으로표시하지않는다.
- 필터cursor는KNOWLEDGE_SCOPE_V1+canonical scope에결박하여다른조건/프로젝트/공통포함여부로재사용하지못한다. scope없는기존검색·기존cursor직렬화·응답/KnowledgeHit형식은보존한다.
- UI10은기존고정적용본/작업계획목록에서단계·업무를선택하며선택조건·공통포함여부를보여준다. 직접UUID/경로입력으로권한을우회하지않고목록본문자동조회는추가하지않는다.

## 구현·검수·제외

채택대상은위상세계약과서버/화면/시험·계약문서의source-only 구현이다. 기존knowledge.ts/knowledge-scope.ts와Web api.ts/KnowledgePage·기존선택자료계약을소비하며정확허용파일은구현WI에고정한다. 기존 JSON 자료의 SELECT 범위 필터·cursor 조건을 source에서 구현하는 것은 포함한다. 새 table·DDL·migration·schema 변경과 실제 DB 접속/SQL 실행은 제외한다. 기존자료재작성/정정·권한/정책부여·서비스/Secret/인증서/Agent/비용·실공유/다른프로젝트쓰기0.

기존시험/합격기준불변,기존무필터호환·정확필터/공통포함·참조변조/교차프로젝트거절·cursor범위대조·현재조건의지연응답숨김을집중단위/in-process/fakeDB 및필요최소합성DOM으로검증한다. 실제PG/served/사용자인수는미검증으로분리하며이번결정으로실행하지않는다. rollback은이구현의정확source diff만되돌리는것으로DB/지속자료복구는발생하지않는다.

## 대안 B와 필요한 답

B는현재프로젝트전체제목/이유검색만유지하고단계·업무선별을미구현으로남기는것이다. 기존저장/정확조회는유지되지만FN05전체완료가아니다. 권장A는계획상선별을완성하는읽기기능이며새권한/실DB변경없이가역적으로구현한다. 필요한결정은‘§2.1 검색 계약·source-only 구현 채택’또는‘보류’다. P03/FN16/CapabilityReport기존질문은중복하지않는다.
