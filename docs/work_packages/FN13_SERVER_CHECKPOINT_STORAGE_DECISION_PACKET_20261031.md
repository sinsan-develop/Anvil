# FN13 서버 체크포인트 저장·기록 조회 결정 자료 r2

2026-10-31 · Main 어울 · 기준 a78701e6 / 제품 a020931d · DRAFT / NOT_ADOPTED

## 1. 왜 이 범위가 필요한가
WORK_PLAN FN13·FUNCTION_WORK FN13·INTERFACES §13.4는 중단/세션 교체 뒤 사용자의 작업현황을 Anvil이 보유하도록 요구한다. 현재는 prepareCheckpointDraft와 내려받기만 연결됐고 서버 저장·기록 탐색은 없다. 준비 응답의 false 표식을 저장 성공으로 바꿔 완료 처리하지 않는다.
10/20 checkpoint_records 신규 영구표·권한·trigger source 작성은 자동 안전심사가 정확한 별도 승인 미확인으로 거절했다(WORK_STATUS4869). SQL 생성/DB 적용0, 임시 saveCheckpoint whitelist는 회수됐다. PMO는 원질문 ID/후속 직접답변을 현재 확보하지 못했으며 답변이 없다고 단정한 것은 아니다. 본 자료는 거절 우회가 아니라 다음 결정의 정확 대상을 만드는 초안이다. 채택 전 보호 WIP 수정·재시험·SQL 작성·저장 API 활성화0이다.

## 2. 권장 A — source-only 사용자 흐름 전체 연결
기존 UI05에서 현황 작성→기존 준비/바이트 대조→사용자의 별도 서버 저장→고정 원기록 조회→해당 임무의 기록 목록에서 이전 지점 재선택까지 연결한다. 단순 고정 GET만 만들면 새 세션이 기록 ID를 모를 때 찾지 못하므로 목록을 이번 명시 결정 delta에 포함한다. 전체 FN13의 중지·회수·안전 재개 완료는 아니다.
코드·화면·새 미적용 forward SQL·합성 검증만 승인 대상으로 한다. 실제 DB/PG/SQL 실행·GRANT/정책 부여·키/Secret·서비스·Agent·원 프로젝트 파일/기록 파일 IO·격리 PG 생성·실행 강제 종료·복원/재개는 제외한다. 기존 10/20 질문에 함께 있던 실제 격리 PG 검증을 이번에 묶지 않는다.

## 3. 입력·주장과 저장 결과
- 기존 CheckpointInput={baseRef,state,reason} 및 checkpoint-input.ts의 닫힌 CheckpointState·정확 임무/허가 소스 범위·중복/참조·텍스트/알려진 비밀 거절·기존 한도를 재사용한다. 불명/빈 근거를 가짜 검증 ref로 채우지 않는다.
- 기존 PROJECT 명령 외피 operation=saveCheckpoint, targetId=state.assignmentRef.id, expectedVersion=그 정확 임무 version, baselineRefs=[], approvalRef=null, payload=CheckpointInput이다. 현재 로그인/CSRF·활성 OWNER·현재 client·단독 제어 세대·명시 AUTO 정책·현재 확정 임무를 검사한다. DENY는403, REQUIRE_APPROVAL/non-null승인은 일반 승인 capture 전에412로 막는다. 이 후보에 일회승인 확장을 섞지 않는다.
- 최초 baseRef=null, 이후 같은 프로젝트/정확 임무의 현재 마지막 checkpoint fullref가 필요하다. 프로젝트 잠금과 동일 transaction 안에서 현재 head를 다시 검사해 stale base/다른 임무/교차 프로젝트는409 또는404로 거절한다. 같은 commandId 재조회는 원 receipt만 반환하고 새 기록/체인/sequence를 만들지 않는다. 현재 인증·접근·허가 검사 이전에 replay로 우회하지 않는다.
- 저장은 새 불변 {id,version:1,contentHash}·snapshot·recordText·원명령/허가/영수증/감사·서버 순번/시각을 같은 transaction에 결박한다. checkpointStored만 true, recordFileStored/currentFactsVerified/writerReleaseVerified/resumeAuthorized/completionAccepted/executionAuthorized/dispatchPerformed는 false다. sourceAssurance=HUMAN_RECORDED_CLAIMS_NOT_VERIFIED이며 기록의 주장/실제 시험·OS 상태를 구별한다.
- recordText는 기존 준비로 생성한 원문 바이트/hash를 보존하고 snapshot/기록의 결합 크기2MiB를 상한으로 한다. 기존 파일을 덮지 않고 실제 파일 보관 성공을 주장하지 않는다. 참조한 원문이 현재 접근 불가/격리·변경됐을 때 옛 기록을 몰래 고치지 않으며 현재 조회의 거절/무결성 오류를 구분한다.

## 4. 고정 조회와 기록 탐색
- GET /api/v1/projects/:projectId/checkpoints/:id: 현재 로그인·활성 프로젝트 회원과 기존 정확 임무 보호 조회의 접근 조건을 재검사한다. 원 immutable row·ref/hash·recordText·원명령/receipt/audit·이전 기록 관계를 대조한 뒤 반환한다. 타 프로젝트/접근 없는 임무는404, 무결성 오류는503이다. 옛 저장본이 현재 제어/재개 권한이라는 뜻이 아니다.
- GET /api/v1/projects/:projectId/checkpoints?assignmentId=<UUID>&assignmentVersion=<양의정수>&assignmentHash=<SHA256>&limit=1..50&cursor=...: 정확 임무 ref를 필수로 받고 같은 보호 접근을 검사한다. 임의 사용자/기기/다른 프로젝트 필터는 받지 않는다. cursor는 프로젝트/주체/정확 임무·정렬·고정 상한 순번/현재 페이지 계약에 결박한다. 관측 이후 새 저장이 다음 페이지에 끼어들지 않는다.
- 목록은 items[{ref,assignmentRef,previousRef,recordedAt,serverSequence}],hasMore,nextCursor,observedAt을 반환한다. 원문 본문/오류 원문/경로 목록은 목록에 넣지 않고 명시 고정 조회로만 보여준다. 현재 마지막 기록은 서버 순번으로 판단하며 timestamp만으로 결정하지 않는다. 새 세션의 목록 선택→fixed read→원문/미확인 표시→명시 준비를 연결한다. 목록·고정 GET이 save/resume/Agent 작업을 실행하지 않는다.
- 응답 유실/timeout은 저장 실패로 단정하거나 새 commandId로 자동 재전송하지 않는다. 원 명령·동일 내용으로만 재확인하고 UI buffer/정확 원명령을 보존한다. 주체/client/임무 변경·권한 상실·늦은 응답은 이전 본문/결과를 숨기고 다른 맥락에 표시하지 않는다. 기존 준비·내려받기 동작은 유지한다.

## 5. 미적용 SQL의 정확 의미·보호
- 새 0058_checkpoint_records.sql.pending 1개만 후보로 작성한다. 현재 최고0057 뒤 번호이며 기존0029·과거 SQL/적용 manifest는 수정하지 않는다. 적용 loader에 자동 등록하지 않는다.
- 새 checkpoint_records 원장1표에 정확 project/assignment fullref·이전 row/ref·immutable snapshot/recordText·본문 hash·원명령/receipt·주체/client·서버 순번/시각을 연결한다. 별도 head표 없이 프로젝트 잠금과 기존 감사 순번/이전 참조의 단일 체인 제약으로 경합을 검사한다. UPDATE/DELETE를 거절하며 기존 사용자의 역할/권한을 실제 부여하지 않는다.
- 최소 SELECT/INSERT 권한과 현재 세션/client/control/policy·원명령/허가receipt/audit/저장행 대응 guard를 SQL source에 한정한다. GUC 문자열만을 인증 권위로 삼지 않고 원서버 검증과 기존 DB 보호 관계를 대조한다. 실제 적용 권한이나 현재 DB 수용이 검증됐다고 주장하지 않는다.
- 후보 유한 상한은 프로젝트당10000기록·canonical snapshot+기록 원문 UTF8 합계1GiB다. 두 조건 중 먼저 도달하면429와 정확한 사유로 저장 전체를 거절한다. 이는 논리 바이트 상한이며 DB 물리 overhead 한도가 아니다. 자동 삭제/압축/상한 우회0, 기존 기록·조회는 보존한다. 상한 이후 추가 저장에는 별도 보존/정리 결정이 필요하다는 영향을 채택 결정에 포함한다. P02 전체 프로젝트10GiB와의 사용량 통합이 미연결이면 그 범위는 미확인으로 표시하고 완전한 전역 할당량 준수를 주장하지 않는다.

## 6. 보호 WIP와 한정 구현 파일
원 보호5는 이 chat Main10/20 미완성 작업이다. 채택 후 실제 수정 전 원5의bytes/hash를 새 복구 사본으로 보존·검산한다. 채택 자체는 보호 원본의 삭제·일괄 stage 허가가 아니다. 다른 보호3·다른 사용자 변경은 계속 제외한다.

|원파일|현재 SHA256|
|---|---|
|apps/server/modules/checkpoints/checkpoint-record.ts|84ADDFF33D4688194FD2640590A6771314D45E10C6C3A27895B83ADFAE91C461|
|apps/server/modules/checkpoints/project-checkpoints.ts|48B65C94FB40A1B06CBE33FB1ECE938F1EFAC46E76849CD1A347799B832737D0|
|tests/unit/FN13/checkpoint-fixture.ts|78704FA07D67A21F9CC955B11554B00A1C9E4382FC440FA7B997A5A951D3D368|
|tests/unit/FN13/checkpoint-record.test.ts|02FAFB578D9E2EC6D06D3FF45B13F50A29A6E5055399582F5DFEF09417BB8732|
|tests/unit/FN13/project-checkpoints.test.ts|489C69E5BB3EACB5A30CE8776A14DD09C708947E6516893EA4C5CE98527891E6|

통합 허용 후보는 위5와 기존 apps/server/modules/access/project-command.ts, apps/server/modules/projects/routes.ts, apps/server/modules/checkpoints/checkpoint-input.ts, project-checkpoint-preparation.ts, apps/web/src/features/session-detail/checkpoint-api.ts, CheckpointEditor.tsx, apps/web/src/App.tsx, tests/unit/FN13/checkpoint-routes.test.ts, tests/unit/UI05/checkpoint-api.test.ts 및 신규0058 pending SQL이다. 새 합성 UI/SQL 구조 검증 파일은 채택 후 실제 인벤토리와 WI에서 정확 경로를 고정한다. 여기서 허용 목록 밖 코드를 임의 수정하지 않는다.

## 7. 검수·판정
단일 기존 Primary가 TDD한다. Main은 같은 코드를 동시에 수정하지 않고 명세/코드 독립 검수와 직접 영향 합성·타입/빌드만 선택한다. 필수 반례는 교차 프로젝트/임무·stale base/세대·권한/기한상실·raw row/원문/receipt/hash 손상·동일 명령 replay/응답유실·예약/상한 경합·서버 저장/실파일 저장·안전재개의 구분·cursor범위/늦은응답·기존 준비/내려받기 회귀다.
순수/메모리 transaction·UI 합성/미적용 SQL 정적 검수를 실제 PG/RLS/COMMIT/경합·실서버/DB·실파일·Agent 검증으로 표시하지 않는다. source-only 연결이 끝나도 FN13 전체와 WORK_PLAN은 미완료다. 실제 DB 적용·실서비스 여정은 별도 정확 실행 결정 뒤 수행한다.

## 8. 결정 요청의 경계
A는 위 서버 저장·고정/목록 조회의 명시 상세 계약과 코드/화면/미적용 SQL·합성 구현만 채택한다. B는 특정 source 보완도 보류하고 현재 준비/내려받기만 유지한다. r2는 독립 검토 후 다음 보완의 한정 재검토 전이며 Main이 사용자/PMO 결정을 대체하지 않는다. 기존 원질문/직접답변이 복구되면 겹침·차이를 먼저 대조하며, 동일 질문을 반복하지 않는다.
## r2 — 구현 시 해석 차이와 상한 선행 고정
원 r1 SHA872FBFA953CCB4DAF12CA9B534CEF1DF5EE852650B361B9EA4F4E2E70CBBA09E의 독립 C0/I0 의견에 따라 다음 순서를 고정한다. Main은 전역 할당량 미확인 표시만으로 새 저장을 허용하면 P02 제한을 지키지 못한다는 위험도 보완했다. 후보는 계속 NOT_ADOPTED다.
- 현재 인증·접근·제어 세대·명시 AUTO/null 정책·기한을 먼저 검사한다. 정확한 같은 명령 replay이면 원 receipt를 반환하고 head/CAS·용량 예약·새 저장은 하지 않는다. 신규 명령에만 현재 마지막 checkpoint의 base/CAS·한도를 검사한다. 후속 기록이 생겼다고 과거 동일 명령 재확인을 거절하지 않는다.
- 감사 순번은 다른 프로젝트 연산과 공유한다. 같은 정확 임무의 checkpoint 순번은 단조 증가해야 하지만 연속 번호를 요구하지 않는다. 프로젝트 잠금 아래 원명령 감사 정확1개·행/receipt/ref를 결박하고 임의 MAX+1 별도 시퀀스를 만들어 실제 근거를 대신하지 않는다.
- cursor는 주체/프로젝트/정확 임무·정렬·고정 상한 순번을 서버가 봉인하고15분 유효로 한다. 순번이 JavaScript 안전 정수 범위를 넘으면503으로 닫는다. 임의 wire 형식 변경·조용한 number 반올림을 금지한다. 부정/만료/다른 범위 cursor는400으로 거절하고 첫 페이지/빈 결과로 바꾸지 않는다. 임의 전역/타인 기록 탐색0이다.
- 이번 원장1GiB/10000 상한 외에 P02 프로젝트 전체10GiB를 만족한다는 현재 사용량/예약의 검증 근거가 신규 저장의 선행이다. 같은 transaction에서 현재 사용량·새 논리 바이트 예약·최종 한도를 결박할 실제 공급자가 없거나 전체 집계 범위가 불명확하면412 PROJECT_STORAGE_QUOTA_UNVERIFIED로 저장을 막는다. 0사용량 추정·문구만 미확인 표시하고 checkpointStored:true 성공은 금지한다. 기존 저장본 조회/정확 replay는 신규 용량이 아니며 같은 현재 권한 검사를 유지한다. 이 quota 공급자의 실제 연결을 구현하지 못한 경우 명확히 미연결/저장불가로 보고하며 source 연결을 전체 사용 가능 완료로 보고하지 않는다.
- 고정/목록 조회는 현재 허가 회원의 정확 임무 보호 조회를 소비한다. 과거 기록자의 계정/client와 현재 조회자가 다르다는 사실만으로 기록을 숨기지 않는다. 반대로 현재 회원/임무 접근이 거절되면 옛 작성자였다는 이유로 원문을 노출하지 않는다. 본문 반환 직전 현재성과 위임 읽기 결과를 다시 대조한다.