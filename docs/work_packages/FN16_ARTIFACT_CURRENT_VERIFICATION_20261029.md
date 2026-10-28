# FN16 단일 원문 현재 권한·상태 검증 연결

2026-10-29 · Main 어울 · codex/av3-stage-b · 기준 43f8f908b59b722c1cefdd3f11fb0456863edfee

## 범위
승인된 FN16 source/합성 범위에서 기존 document inventory의 원문 검사 선행을 연결한다. 신규 공개 route·정책·SQL migration·설정·키·실제 DB/파일/서비스 실행은 없다. 기존 fn16_primary 단독 구현, Main 관리·검수·통합, fn16_review 독립 읽기 검수. 보호 미추적 자료·기존 구현은 수정하지 않는다.

신규 허용2경로:
- apps/server/modules/backups/artifact-current-verification.ts
- tests/unit/FN16/artifact-current-verification.test.ts

## 동작
verifyCurrentArtifact(access,token,input,reader,signal)는 단일 project artifact만 다룬다. input은 exact own-data snapshot {projectId,artifactId,bytes,contentHash,mediaType,maxBytes,deadlineMs}; UUID/해시/크기·한도는 기존 byte verifier 기준, mediaType은 기존 artifact ref 허용 형식과 일치한다. accessor/추가 키/변경되는 caller 입력은 거절 또는 최초 snapshot으로 고정한다. reader는 필수 trusted 내부 포트이며 env/default root 활성화0이다.

시작 access.authenticated READ COMMITTED → 현재 projectMember(false)의 OWNER·비보관 프로젝트 → exact artifact 조회 → callback/COMMIT 종료 → verifyArtifactBytes → 종료 별도 authenticated RC에서 같은 identity·OWNER·artifact 재대조 순서다. 파일 읽기 동안 DB transaction/client/session lock을 보유하지 않는다. actor/client/authSession.id/credentialGeneration을 최초 값과 비교하고 notificationSessionDeadline로 서버 시각을 반영한 최초 최소 기한을 유지한다. 각 외부 COMMIT 뒤에도 취소/총기한·세션기한을 확인한다. query별 statement_timeout은 남은 기한으로 제한한다. auth 내부 선행 query timeout과 임의 pending IO 강제 종료는 이 단위의 보장이 아니다.

artifacts 조회는 id,project_id,draft_id,bytes,content_hash,media_type,storage_key,state,inspection_json 명시열만 사용한다. projectId+artifactId로 조회하고 결과1건·모든 exact 참조·draft_id null·storage_key=blobs/projectId/artifactId를 확인한다. 시작/종료 snapshot은 값으로 복사해 DB 객체 변경에 흔들리지 않는다. 문서 BODY/첨부/import/proposal에 실제 포함됐다는 판단은 하지 않는다.

READY+정확한 기존 NO_KNOWN_MARKER 검사기록만 바이트 읽기를 허용한다. nullable inspection은 inventory 계약의 UNKNOWN이므로 IO0 차단한다. QUARANTINED/STAGING/FAILED/SUSPECTED·변조 inspection도 IO0 차단한다. 기존 일반 다운로드의 null 허용 계약은 수정하지 않는다. byte 결과 markerCheck와 저장 검사기록을 canonical exact 비교하고 종료 RC에서 ref/state/inspection을 다시 대조한다. 정상 반환은 원문 bytes/경로/token/DB row 없이 byte 결과와 시작·종료 권한/상태 확인 사실만 포함한다. 그 사실은 관측시점의 검사이지 지속 권한·원문 안정성·inventory 포함·전체 백업/복원 성공이 아니다. byte 결과의 authorityVerified/sourceStabilityVerified/restorable false는 바꾸지 않는다.

오류는 고정 AuthFailure만 반환한다. 원 DB/reader Error의 message/cause/경로/token을 노출하지 않는다. AUTH_REQUIRED401/NOT_FOUND404의 기존 허가된 조합만 보존할 수 있고 나머지는 해당 단위 고정 오류로 정규화한다. query/COMMIT/close 오류·취소/기한은 성공으로 바꾸지 않는다. 실제 reader 강제종료·실제 PostgreSQL/RLS·동시 변경 원자성·runtime root 연결은 미검증/미구현이다.

## 검수
TEST_ONLY에서 신규 시험만 먼저 작성하여 Main 미구현 RED 확인 후 제품 GO한다. 공개 fake DB/access와 메모리 reader만 사용한다. 정상 호출순서/DB client 반환 후 IO, 0bytes/정확 ref, snapshot·변조/교차프로젝트·소유권/세션/세대/보관 변화, nullable/격리/변조 inspection IO0, 종료 상태변경, COMMIT 이후 취소/만료, 검사/close/DB 실패·오류 비노출을 검증한다. 실제 verifier를 소비하고 assert만 맞추는 stub으로 대체하지 않는다. 실제 DB 접속/파일 runtime0.

Main 신규시험·typecheck·diff 및 독립 C/I0 후 결과·WORK_STATUS·WORK_PLAN 기록과 기존 branch 게시. 이미 검증한 불변 시험 반복0. rollback은 이 신규2파일 검토 revert이며 실제 데이터/키/서비스 복원이 아니다. 전체 FN16 미완료를 유지한다.
