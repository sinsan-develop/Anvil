# FN05/UI10 지식 공유요청 metadata 후보

- 작성: 2026-10-28 · 단일 담당 어울 · 상태: **CANDIDATE / 미채택 / 구현·실행 승인 아님**
- 목적: 고정 지식 버전과 명시 대상을 선택한 요청을 출발 프로젝트에 보관하고, 본인이 보호 상태를 다시 조회하는 한 업무를 구체화한다.
- 기준: WORK_PLAN Stage B/FN05/UI10, FUNCTION_WORK FN05, SCREEN_WORK UI10, INTERFACES §10.3(requestKnowledgeShare), DATA_MODEL §7.3 knowledge_events. source 기준은 Main이 전달한 190ce191이며 실제 DB 상태를 새로 관측하지 않았다.
- 이번 산출은 이 문서 하나다. 코드·SQL·시험·DB·권한·서비스·Agent·공유 원문/대상 자료 변경은 0이다.

## 1. 선정 대안과 현재 소비선

**A안(권장, Main이 후보 작성 대상으로 선정):** 출발 프로젝트에 요청 metadata만 저장하고 보호 목록/고정 조회를 제공한다. 실제 복사·전송·대상 프로젝트 쓰기·수신 통지·SHARED 사건·승인 생성/자동 소비는 모두 0이다. 이 선택은 후보 작성 방향이며 아래 API/schema/권한 상세를 채택한 결정이 아니다.

B안(실제 교차 프로젝트 공유 집행까지 동시 구현)은 대상 쓰기 권한·원문 이전·승인 소비·수신/격리 경계를 추가하므로 이번 후보에서 제외한다. A의 기록을 B의 실행 허가로 재사용하지 않는다.

현재 근거:
- INTERFACES의 requestKnowledgeShare는 versionRefs/explicitTargets(projectId 또는 commonScopeId)/purpose/approvalRef?와 ‘공유 제안/상태’ 개요를 정의한다. 요청 상태·반환형·보호 GET·대상 resolver는 닫혀 있지 않다.
- DATA_MODEL의 SHARED는 지식 사건 일반 모델이다. 기존 0005_knowledge_drafts/changes/confirmation guard는 승인·target_refs를 임의 기록하거나 공유 사건으로 확장하는 경로를 허용하지 않는다. **요청 보관을 SHARED로 위장하지 않는다.**
- project-command.ts의 documentOperations 및 projects/routes.ts 명령 enum/분기에 requestKnowledgeShare가 없다. 현재 ProjectKnowledge·UI10은 저장/검색/정정/제외/검토/확정/헌법 적용을 소비하며 공유요청 소비선은 없다.
- FN03 원문/버전·프로젝트 접근·FN11 명령/감사 패턴은 재사용 후보다. 이들의 존재는 새 공유권한 또는 실제 DB 준비 완료의 증거가 아니다.

## 2. 권장 요청 상태·입출력 후보

아래 이름/형식/상한은 **채택을 요청할 상세 후보**다. 새 공개 API나 물리 schema를 이미 확정한 것으로 취급하지 않는다.

| 구분 | A안 권장 의미 |
|---|---|
| 저장 상태 | RECORDED_ONLY 한 종류. 불변 version1 요청이며 승인 대기/승인됨/수신됨/공유됨/실행가능을 뜻하지 않는다 |
| 저장 입력 | versionRefs: exact VersionRef 배열, explicitTargets: 명시 PROJECT 대상 배열, purpose. 현재 사용자/출발 project/client/control/명령은 공통 봉투에서 받는다 |
| 대상 형식 | {kind:PROJECT,projectId}. 입력 id만 믿지 않고 §3 resolver 결과와 대조한다. commonScopeId는 resolver/공간 정의가 없어 UNSUPPORTED로 거절한다 |
| 최초 명령 | operation=requestKnowledgeShare 후보, targetId=null, expectedVersion=0, baselineRefs=[], approvalRef=null. extra key·caller 상태/권한/수신/승인 필드 거절 |
| 기록 | requestRef(id/version1/contentHash), 출발 project, createdBy/client/command/control/policy 참조, 입력 원순서·목적·선택 exact refs, 서버 기록 시각. 원문 bytes·대상 이름/목적/구성원/경로·계정·Secret은 복제하지 않는다 |
| 응답 | requestRef/state/recordedAt와 현재 검사 결과. transferPerformed=false, sharedEventCreated=false, approvalConsumed=false, executionAuthorized=false |
| 현재 검사 | METADATA_ELIGIBLE 또는 UNAVAILABLE. 원문/대상/접근의 현재 재대조 결과일 뿐 의미 적합성·실제 공유 자격·수신 증명이 아니다. 이 값으로 저장 요청을 UPDATE하지 않는다 |

입력은 비어 있는 선택, 중복/불완전 ref, 자기 출발 프로젝트를 대상에 넣는 모순을 거절하는 안이다. 상한은 공통 관행의 각 배열 1..200, purpose 비공백/최대20,000 UTF-16, 공통 JSON 2MiB 이하를 후보로 제시한다. 배열 순서는 보존하고 중복은 거절한다. 다른 상한/대상 정책은 §7에서 결정하며 무제한으로 기본 처리하지 않는다.

새 요청은 현재 head의 미제외·미대체 PROPOSED/CONFIRMED 지식을 대상으로 삼는 안을 권장한다. PROPOSED는 미확정으로 보존하며 사실/헌법 승인으로 승격하지 않는다. 과거 제외/대체본 조회는 기존 보호 조회로 보존하고 새 공유요청 적격성으로 되살리지 않는다. 확정본만 허용할지 여부는 별도 결정 사항이다.

## 3. 현재 출발·대상 접근 resolver

resolver는 인증 actor와 caller 소유 transaction을 입력으로 받아 실제 프로젝트/회원/원문을 읽는 서버 내부 접점 후보다. caller의 true flag·이름·기억된 목록·입력 projectId만으로 성공하지 않는다.

1. **출발:** 현재 인증 세션/client, 활성 회원·OWNER, 보관 여부, 현재 제어 세대, 명시 정책과 유효 기한을 기존 명령 패턴으로 대조한다. 요청 저장은 새 권한 부여가 아니다.
2. **지식:** 기존 보호 exact 지식/원문 reader를 사용해 같은 출발 project의 id/version/hash·현재 head/제외/대체·격리/알려진 민감 표식을 확인한다. 문법상 ref나 DB metadata만 맞는 것으로 물리 원문 hash 검사를 대체하지 않는다. 검사 오류/불명은 저장0이다.
3. **대상:** 현재 actor가 해당 대상 프로젝트에 대해 실제 활성 회원이고 기존 READ_PROJECT 접근을 갖는지 재조회한다. 프로젝트 존재/보관 및 현재 version도 확인한다. 이 결과는 **대상 metadata를 확인할 수 있음**만 뜻하며 대상 쓰기/공유 수락 권한이 아니다. 이름을 입력해 resolver를 우회하거나 source OWNER를 target OWNER로 간주하지 않는다.
4. target read 권한만으로 A의 출발측 metadata 요청을 기록할 수 있다는 안 자체가 §7의 채택 대상이다. 현재 resolver가 이를 증명하지 못하면 UNVERIFIED로 거절한다. common 공간·삭제/보관·접근 상실·관측 오류는 fallback 없이 닫는다.
5. 같은 transaction 안에서 출발/대상 project·member와 source 상태를 잠금/재대조하고 저장 직전 현재성을 검사한다. 권한 회수·제외·head/hash·기한 경합이면 transaction 전체를 취소한다. 잠금 경합/실패를 성공이나 자동 새 명령으로 바꾸지 않는다. 구체 잠금 순서는 기존 명령 선행 잠금과 함께 구현 검수한다.

대상 선택 UI는 현재 허가 목록/직접 보호 조회만 소비할 후보이며 전역 검색/공통공간 탐색을 새로 만들지 않는다. 대상의 문서·지식·구성원·수신공간을 열거나 그 수/빈 여부를 관측하지 않는다.

## 4. 명령·원문·승인 결박과 재확인

- requestHash는 공통 명령 봉투와 exact 입력에 결박한다. 같은 actor/client/control/project/commandId·같은 payload만 기존 receipt를 반환하며 입력·대상·목적·원문 ref를 바꿔 같은 명령으로 보내면 충돌이다.
- 같은 transaction에 요청·명령 receipt·감사를 기록하는 append-only 저장 후보다. 부분 요청/고아 행을 성공으로 반환하지 않는다. 실패/응답 유실은 원 pending·uncertain을 보존하고 동일 원 명령의 재확인으로만 해소한다.
- 현재 정책 DENY는 거절한다. REQUIRE_APPROVAL 또는 non-null approvalRef는 A에서 승인 처리 미연결로 거절하는 안이다. AUTO도 현재 명시 규칙이 실제로 맞을 때만 사용한다. 새 정책/권한을 자동 생성하지 않는다.
- 저장 전 민감/격리·원문 hash 불일치·다른 project 참조는 차단하고 일반 오류/로그에 본문·목적·대상 metadata를 덧붙이지 않는다. 알려진 표식 검사는 완전한 비밀 탐지나 공유 안전 증명이 아니다.
- 요청 기록은 불변이며 변경은 새 입력/새 명령/새 요청이다. 기존 요청의 원문과 이유를 덮어쓰지 않는다. 취소/수락/거절 등 새 lifecycle 연산은 A에 포함하지 않는다.
- 후속 실제 공유 승인에는 최소 이 요청의 id/version/hash·출발 exact 지식 refs·명시 대상/당시 대상 version·목적 hash·실제 행위·현재 출발/대상 권한/정책·주체/제어·만료 및 원문/격리 재검사가 필요하다. 해당 exact ActionScope/승인 target 계약은 아직 없다. A의 metadata 승인/receipt나 digest를 실제 원문 공유 승인으로 전용하지 않는다.
- A에서는 UI08 승인 요청/결정 생성·기존 승인 소비·대상 원문 복사/전송·SHARED 기록을 호출하지 않는다. 실제 수신 확인·원문 재보호/격리·철회 후 처리·외부 공유는 모두 후속 별도 범위다.

## 5. 본인 목록·고정 조회와 누출 차단

권장 공개 접점 후보는 출발 project 아래 요청 목록과 request id/version1/hash의 고정 조회다. 정확 route·wire/cursor·오류 체계는 §7 채택 전 구현하지 않는다.

- 현재 출발 프로젝트 접근과 createdBy=현재 actor를 목록 SQL 앞에서 적용한다. 다른 OWNER/참여자도 다른 사람이 만든 요청을 자동 열 수 없다. 존재하지 않는 id와 타인 id는 같은 비밀 없는 NOT_FOUND로 처리한다. 본인도 출발 접근을 잃으면 상세0이다.
- 같은 사용자 새 client의 보호 읽기는 현재 인증/접근으로 가능하다는 안이며, 과거 client/control의 저장 명령을 새 제어 권한으로 승격하지 않는다.
- 상세 조회에서도 원문 접근/격리/hash와 대상 접근을 다시 검사한다. 현재 모든 검사가 맞을 때만 저장된 exact 선택·목적을 보여 준다. 최신 head 변경을 과거 원문 덮어쓰기로 처리하지 않는다.
- 현재 대상/원문 확인이 불가하면 본인 요청의 최소 requestRef·RECORDED_ONLY·일반 SOURCE_OR_TARGET_UNAVAILABLE와 false 효과 플래그만 반환하는 안이다. versionRefs/targets/목적/이름·개수/존재 사유는 반환하지 않는다. 저장된 당시 기록은 삭제하지 않는다.
- 미존재/무권한/보관 대상의 요청 입력은 동일한 비밀 없는 TARGET_UNAVAILABLE로 닫고 이름/역할/회원 여부·수신공간 존재·건수를 반환하지 않는다. 내부 오류 역시 원문·경로·목적을 출력하지 않는다.
- target 쪽에 incoming 목록/알림/요청 행/수신공간을 만들지 않는다. 목록은 출발·본인 범위만, 전역 총건수0·대상별 역조회0이다. cursor는 actor/project/filter/limit에 결박하고 현재 접근을 매번 대조한다. 수신공간의 metadata를 오류/목록/페이지 정보로 유출하지 않는지 음성 검수한다. 시간 부채널까지 증명했다고 주장하지 않는다.

## 6. 채택 후 source-only 구현 예상 파일·검수

**아래는 후속 WI의 예상 allowlist이며 현재 쓰기 허용 목록이 아니다.** 번호·route·schema는 새 결정 후 고정한다.

| 예상 파일 | 한정 책임 |
|---|---|
| apps/server/modules/knowledge/knowledge-share-request-input.ts | 닫힌 metadata 입력/ref/상한·민감 목적 검사 |
| apps/server/modules/knowledge/knowledge-share-targets.ts | 현재 출발/대상 접근·원문 적격 resolver, common 공간 거절 |
| apps/server/modules/knowledge/project-knowledge-share-requests.ts | 요청 저장/receipt·본인 보호 목록/고정 조회·현재 검사 |
| apps/server/modules/access/project-command.ts; apps/server/modules/projects/routes.ts | 채택된 연산/보호 GET만 명시 연결, 실제 공유 연산 추가0 |
| db/migrations/0051_knowledge_share_requests.sql.pending (번호 미배정 후보) | 채택 후 불변 요청/명령·actor·source ref/대상 snapshot/receipt 결박 후보. 기존 SQL/knowledge guard 변경0·실제 적용0 |
| apps/web/src/features/knowledge/KnowledgePage.tsx; knowledge-share-request-api.ts; KnowledgeShareRequestPanel.tsx; 필요 시 apps/web/src/App.tsx | exact 원문/대상/목적 선택→요청 보관→본인 보호 조회, 문맥별 pending/uncertain 보존. 새 전역 상태 구조 도입0 |
| tests/unit/FN05/knowledge-share-requests.test.ts; tests/unit/UI10/knowledge-share-request-api.test.ts; tests/browser/UI10/knowledge-share-request-dom.test.ts | 아래 직접 반례. 실제 QA 자원은 이번 문서 작성에 생성하지 않음 |

검수 사례:
1. 현재 source OWNER/control/AUTO와 허가된 target read·exact 원문으로 요청1/receipt1을 저장·보호 재조회. 대상 쓰기/전송/SHARED/승인 소비/Agent 호출은 전부0.
2. 출발 접근·제어/정책·기한 변화, 지식 hash/head/제외/격리 경합, target 접근 미확인/회수·common 공간·존재 위조는 저장0. 대상 이름/건수·본문 오류 노출0.
3. 같은 명령 응답 유실 후 exact 재확인1, 변조 재전송 충돌·부분 transaction 실패 뒤 고아 요청/receipt0. 다른 사용자/기기 문맥에서 예전 입력을 전송하지 않음.
4. 본인/타인·목록/직접 id/cursor·권한 회수 뒤 늦은 JSON/hash 응답을 검사. 대상 불가 시 최소 응답으로 상세/목적/대상 수집0, 원 기록 보존.
5. source-only fake ports/type와 별도 실제 DB·served·브라우저·사용자 인수 증거를 분리한다. 코드/fixture 존재나 정상 metadata 조회를 실제 공유 완료로 표시하지 않는다.

## 7. 필요한 정확한 추가 결정과 다음 단계

| 결정 | 권장안·미결 경계 |
|---|---|
| D1 업무 범위/대상 자격 | A metadata 보관·본인 조회만. target 현재 READ_PROJECT 확인은 metadata 요청 목적에만 사용, 대상 쓰기 권한 아님. commonScopeId 미지원. 본인/타인 조회 정책·자기 대상 거절도 이 상세 계약과 함께 채택 |
| D2 닫힌 상태·입력·상한 | §2 RECORDED_ONLY/동적 currentCheck·exact 필드·숫자 상한·지식 head/PROPOSED 허용 여부를 확정. 일반 SHARED 사건이나 가짜 승인상태 재사용0 |
| D3 API/저장 계약 | 명시 operation/보호 route·wire/최소 불가응답/cursor, 새 불변 요청/receipt/audit 모델과 미적용 forward 후보를 채택. 기존 SQL 수정/실DB 적용을 포함하지 않음 |
| D4 명령·승인 경계 | A는 approvalRef=null, REQUIRE_APPROVAL 미연결 거절·승인 생성/소비0. 후속 실제 공유의 exact target/ActionScope/원문 승인 계약은 별도 결정, 이번에 만들지 않음 |
| D5 구현/검수 권한 | Main 검수·PMO의 정확 상세 후보 채택 후 별도 WI/allowlist/TEST_ONLY 선행. 실제 DB/권한·서비스·원문 이전/전송/Agent/자원은 계속 제외 |

판정: **상세 후보 문서 작성 범위 완료, 새 계약 채택·source 구현·실제 공유는 미완료/미승인**이다. Main이 현재 원문 근거와 누출/권한 경계를 검수하고 PMO에 필요한 정확 결정만 전달한다. 사람/PMO 답변을 입력 id·일반 true·과거 공유 승인으로 대체하지 않으며, 결정 전 코드를 작성하지 않는다.
