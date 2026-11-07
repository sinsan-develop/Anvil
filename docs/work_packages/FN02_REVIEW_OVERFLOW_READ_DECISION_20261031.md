# FN02 검토 이력 과다 버전의 원본·이력 읽기 — 한정 결정안

상태: r2 / CANDIDATE / NOT_ADOPTED. 작성은 채택·구현 GO가 아니다. 기준 codex/av3-stage-b / 8c939d4b7ab7c08a3156b9005b3cbeff6c33f5de. Main 어울 작성.

## 실제 문제와 기존 승인 차이
- 승인 WORK_PLAN FN02/UI03는 방법론 버전·검토 원문·이력을 사용자에게 제공한다. 현재 ProjectMethodologies.read는 같은 버전의 검토201행을 발견하면 METHOD_REVIEW_PAGINATION_NOT_READY/412로 방법론 원본도 거절한다. 정적 source 확인이며 실제 DB의 발생 건수는 조사하지 않았다.
- apps/server/modules/methodologies/project-methodologies.ts SHA DFB2E829B4D44E21B7184A7F2BEBFF3E98E19D9886A7252A33159EACBD81CB85. 기존 Web project-api.ts SHA 11DC283FF627D6BA118853911C1EF928F14EC1B92CE77081BC55DD274C175EC7.
- 기존 GET은 contentReviews 전체를 반환하며 검토/확정/적용도 그 읽기를 소비한다. 최신200개만 반환하면 기존 ‘전체 이력’과 확정 검사 의미가 달라진다. 이 안은 기존 guard·명령·합격 기준을 낮추지 않고 별도 읽기 계약을 추가하는 결정이다.

## 권장 A — 읽기 전용 원본·이력 분리 source 구현

### 공개 GET 2개와 호환성
기존 /api/v1/projects/:projectId/methodologies/:id/versions/:version GET은 변경하지 않는다. 다음 같은 prefix의 읽기 전용 GET2개를 추가한다.
1. /overview?targetHash=:hash — targetHash는 이미 알고 있는 경우만 보내는 선택 입력이다. id/version만 아는 이전·다음 버전도 기존 보호 읽기와 동일하게 허용하고 원본 metadata/graph·내용 검토 기준·기록된 confirmation과 그 원 reviewRefs를 반환한다. 서버는 row()의 기존 graph·원명령 또는 최초적용 근거로 반환 ref를 검산하고, expected targetHash가 있으면 다름을 거절한다. 클라이언트는 반환 graph hash를 직접 검산한 뒤 그 fullref를 후속 페이지에 고정한다. 알 수 없는 과거 버전 hash를 현재 head에서 빌리거나 발명하지 않는다. 기존 contentReviews 배열은 반환하지 않고 historyMode=SEPARATE_PAGE/currentConfirmationState=NOT_REEVALUATED로 별도 DTO를 사용한다. projectId/ref/headVersion/name/purpose/scope/systemCode/sourceApproval/reason/createdAt 및 기존 runtimeReadiness/applicationTransition 의미를 보존한다.
2. /content-reviews?targetHash=:hash&limit=:limit&cursor=:cursor — 같은 exact fullref의 검토 원문 페이지. 기본20/최대50/최소1, 초과항목1개로 hasMore를 판단한다. items/hasMore/nextCursor/observedAt/targetRef와 고정 조회 상한 sequence를 반환하고 전체 건수/전체 완료를 합성하지 않는다.

원본·각 검토·확정 원문에 대한 기존 명령/영수증/감사·criteriaSnapshot·graph hash 검산을 유지한다. 배열을 조용히 자르거나 손상 검토를 건너뛰지 않는다. overview의 confirmation.reviewRefs는 확정 당시 참조이며 현재 마지막 검토·효력을 인증하지 않는다. 별도 DTO를 기존 MethodVersion으로 강제 캐스팅하거나 부분 이력으로 기존 mutation 검사를 실행하지 않는다.

### 현재 보호·cursor
- 현재 로그인/회원·같은 프로젝트 읽기와 no-store를 매 요청 재검사한다. 기존 읽기 범위만 사용하며 신규 role/정책/GRANT 예외0. 비회원/없는 원본은 기존404 은폐, 잘못된 입력400, exact hash/원본 변조503 등 기존 구분을 따른다.
- 첫 이력 페이지에서 target fullref·상한 audit sequence를 고정하고 sequence 내림차순으로 조회한다. 다음 cursor는 actor/project/원본 fullref/limit/상한/다음위치/기존 유한 cursor 만료정책 및 이 API 전용 용도에 서명 결박한다. 기존 ProjectListCodec의 Date/UUID position을 audit sequence로 강제 변환하지 않고, 기존 signProjectCursor 주입을 소비하는 별도 유한 sequence codec을 작성한다. 다른 API·actor·원본·limit 혼용/변조·만료는400이며 자동 첫페이지 대체0. 새로운 키 생성/교체 없이 기존 cursor signer의 승인된 주입 포트/정책을 소비하며 실제 공급자 활성화는 하지 않는다.
- 같은 sequence의 복수 행·중복 ref/누락되거나 잘못된 원명령·유한 safe integer 초과는 무결성 오류로 닫는다. 새 검토는 기존 페이지 상한에 끼워 넣지 않고 명시 재조회에서만 새 상한을 얻는다. 실제 PG snapshot/경합은 미검증으로 남긴다.
- 단일 응답 canonical UTF-8가 기존2MiB 기본 한도를 넘으면 METHOD_REVIEW_PAGE_TOO_LARGE/503으로 닫고 자동 절단/축소/재시도0. 이력 페이지는 사용자가 더 작은 유한 limit으로 명시 재조회할 수 있다. 원본 자체가 상한을 넘는 예외는 미해결로 표시한다.

### UI03 연결과 명시 비목표
기존 원본 GET이 정확 METHOD_REVIEW_PAGINATION_NOT_READY/412일 때만 ‘원본과 검토 이력 분리 조회’ 버튼을 제공한다. 다른 오류에서 자동 우회하지 않는다. 실패한 요청의 id/version과 알고 있던 expectedHash를 source 초기화 전에 별도 조회 문맥으로 보관한다. 명시 클릭 후 readonly overview와 접힘 이력 페이지/이전·다음·같은 페이지 재시도를 표시한다. 조회 도중 선택 원본/프로젝트/사용자/client·실 transport 변경과 닫기 후 늦은 JSON/digest/401을 폐기한다. 기존 편집 buffer는 보존한다.

이 별도 조회는 기존 저장·내용검토·확정·적용을 해제하지 않는다. 검토201건 이상에서 명령이 기존412로 막히는 것은 여전히 남은 기능이며 읽기 복원만으로 FN02 완료라고 하지 않는다. 기존0~200건 원본/편집 경로와 과거 확정 ref를 그대로 보존한다. 새 원본/검토 저장·자동 확정·실제 적용/Agent 실행0.

### 구현·검수 및 제외
코드·화면·SELECT adapter source·합성 검증만 채택한다. 신규 table/DDL/migration·실제 SQL/DB 접속·정책 부여·키·파일 조사·서비스·Agent/기존 프로젝트 차단 해제는 제외한다. 기존 보호3·다른 dirty·원복구본을 보존하고 단일 기존 Primary만 구현한다. Main이 정확 WI/허용 경로·독립 검토·RED→GREEN을 준비한다.

검수는 0/200/201+ 원본·역순 전체 페이지·확정 당시 ref의 페이지 밖 보존/현재효력 미확인·동시 새검토/상한·cursor혼용/만료·회원회수/손상·늦은 응답/중복GET·readonly POST0와 기존 mutation412 불변을 포함한다. mock/메모리DOM을 실제 PG/served/전체업무 PASS로 올리지 않는다.

## 대안 B·필요 결정
B는 미채택 유지다. 기존0~200건 동작은 유지하지만201건 이상 원본·이력 읽기는 미구현이다. 무제한 응답·최근200개로의 은밀 절단은 대안으로 권하지 않는다.

PMO의 위임된 Anvil 결정·지원 범위에서 위 공개 조회2/별도 응답·cursor/명시 readonly UI의 A 또는 B를 결정한다. 위임 밖이면 기존 FN14 질문과 중복하지 않게 다음 필요한 사용자 결정으로 정리한다. 이 요청은 계획 업무 재승인이나 다음 업무 배정 요청이 아니라 구체 공개 읽기 계약의 채택 결정이다.

## r2 검토 이력
- r1 D1B3F3B5053470F5AA1D1FFB3FB3D9E3AB88165DD6239719D7025C9F7DC8A3B6 독립C0/I0 뒤 Primary 실현성 검토에서 과거 버전412 시 hash를 모르는 경로1을 확인했다. overview의 known hash는 선택입력으로 하고 기존 id/version 보호조회·서버원근거/클라이언트graph 검산 뒤 후속page fullref 고정으로 보정했다. 기존 검수·명령 차단/실제실행 제외는 불변이다. 공개 조회 계약은 여전히 미채택이며 구현0이다.
