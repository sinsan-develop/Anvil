# FN13 r2 A 구현 작업지시서 — 2026-10-31

## 기준·담당
- 승인: FN13_SERVER_CHECKPOINT_STORAGE_APPROVAL_20261031.md의 직접 지시. 동결 r2 SHA256 61BBF0DC715F6326E17791147F604ED0E7921C5AD28B1858DD7486F29071C26F 전체가 명세다.
- 기존 codex/av3-stage-b, 시작HEAD 6fd38caec82e6483d312ce361f6e3690060e24b1. 새 branch/worktree/agent 없음.
- 단일 code writer: 기존 fn16_primary_recovered. Main은 코드 동시 수정 없이 관리·검수·통합, fn16_review_recovered는 읽기 전용 독립 검수.
- 기능 단위: 명시 저장 명령→불변 기록→보호 고정/목록 조회→UI 원문 선택. 서버 저장과 실제 파일/OS/중지회수/재개를 구분한다.

## 수정 전 WIP 보존 자원 사전 등록
- 정확 신규 root: D:/Project/Anvil/.av3-data/v3-development/fn13-checkpoint-wip-recovery-20261031-01
- owner: SINSAN\cyhuh / 담당 Main·Primary, 목적은 이 chat Main10/20 WIP5의 원형 복구 보존. 프로세스·port·container·image 없음.
- 수명: 이번 수정 전 생성, 인계/복구용 보존. 자동 삭제 금지. 원파일 삭제/이동/일괄 stage 없음.
- 생성 직전 root 부재, 부모 realpath/owner/link0, 등록 경로 이내를 확인한다. 아래5를 동결 후보 표의 원 bytes/hash와 대조하고 create-new 복사한다. manifest에 상대경로·bytes·SHA256·owner·생성시각을 남기고 복사본 재검산 뒤에만 코드 수정한다. 실패 시 원본 그대로 보존하고 보고한다.
- 다른 보호3(FN06_NATIVE_COMPILE_ONLY_CANDIDATE.md, FN04/design-change-conversation-source.test.ts, FN10/stage-queue-assignment.test.ts.pending)는 수정/stage/삭제0.

## 정확 허용 코드18경로
1. apps/server/modules/checkpoints/checkpoint-record.ts
2. apps/server/modules/checkpoints/project-checkpoints.ts
3. tests/unit/FN13/checkpoint-fixture.ts
4. tests/unit/FN13/checkpoint-record.test.ts
5. tests/unit/FN13/project-checkpoints.test.ts
6. apps/server/modules/access/project-command.ts
7. apps/server/modules/projects/routes.ts
8. apps/server/modules/checkpoints/checkpoint-input.ts
9. apps/server/modules/checkpoints/project-checkpoint-preparation.ts
10. apps/web/src/features/session-detail/checkpoint-api.ts
11. apps/web/src/features/session-detail/CheckpointEditor.tsx
12. apps/web/src/App.tsx
13. tests/unit/FN13/checkpoint-routes.test.ts
14. tests/unit/UI05/checkpoint-api.test.ts
15. db/migrations/0058_checkpoint_records.sql.pending
16. tests/unit/FN13/checkpoint-storage-schema.test.ts
17. tests/browser/UI05/checkpoint-storage-dom.test.ts
18. tests/browser/UI05/checkpoint-storage-dom-harness.tsx
불필요한 기존 파일은 변경하지 않는다.

## 구현·TDD 순서와 불변 조건
1. 현재 미연결 저장/목록의 실제 consumer RED를 기록한다. 해당 source 검사를 통과시키기 위한 기대값 완화/시험 삭제 금지.
2. 현재 로그인/세션기한·활성회원/단독제어·정확 임무/명시 AUTO/null 정책·정책기한을 replay 반환 전에도 검사한다. saveCheckpoint 한정으로 기존 명령 보호 접점을 보완하고 다른 명령 의미는 유지한다. DENY403, REQUIRE_APPROVAL/non-null412는 generic 승인 capture 전 거절한다.
3. 정확 같은 원명령은 기존 receipt만 반환하며 새 head/quota 검사를 하지 않는다. 신규만 프로젝트 잠금·정확 임무별 마지막 ref/base CAS·10000건/논리1GiB·전체10GiB 검사를 한다. 공유 감사 순번은 단조증가이며 비연속 허용, unsafe JS정수503. transaction rollback/명령·receipt·감사·행 원자성을 실제 메모리 모델에서도 검증한다.
4. 실제 전역 quota producer가 없음은 현재 확인된 사실이다. 제품에서 가짜0사용량/테스트용 성공 callback/환경우회/임의 범용 quota표를 만들지 않는다. 신규 저장은412 PROJECT_STORAGE_QUOTA_UNVERIFIED·저장0. 허가된 source 저장 처리·체인/한도·합성 성공 모델은 구현하되 이 차단과 실제 사용불가를 UI/결과에 명시한다. quota 공급자 신설은 이번 범위 밖이다.
5. 단일 immutable checkpoint_records 표만0058 pending에 정의. 이전SQL/적용 manifest/loader 수정0. 원명령/receipt/audit/현재 세션·제어·정책/이전 ref를 양방향 검산하며 GUC문자열만을 인증으로 삼지 않는다. UPDATE/DELETE 거절. 실제 SQL/PG/GRANT 실행0.
6. fixed GET와 assignment fullref 필수 list GET을 연결한다. 현재 허가 회원의 기존 임무 보호 reader를 소비하며 과거작성자/client와 다르다는 이유만으로 막지 않는다. 반환직전 현재성 재검사. 원문/ref/hash/receipt/audit/이전관계 오류503, 접근없는 범위404. 목록엔 본문/경로/오류원문 없음.
7. cursor는 서버봉인 actor/project/정확assignment/정렬/고정상한·15분. 부정/만료/다른범위400, append 고정 snapshot pagination·unsafe integer503. GET의 mutation0.
8. UI는 기존 prepare/download 유지. App 소유 입력/동결 원명령/buffer·응답미확인 상태, 명시 저장/같은 commandId 재확인/목록 선택/고정 원문읽기. 자동 재전송/새command 재시도/자동resume0. actor/client/assignment ABA·권한상실/늦은JSON/hash 결과를 폐기한다.
9. checkpointStored 외 모든 authority flagfalse, HUMAN_RECORDED_CLAIMS_NOT_VERIFIED 유지. 원 prepared recordText/hash 불변, combined2MiB. fileStored/currentFacts/writerRelease/resume/completion/execution/dispatch 승격0.

## 검수·반출 경계
- 정상 합성/응답유실/replay-after-newhead, 교차범위·stale권한/기한·head·quota/cap경합·raw/receipt/audit변조·cursor·UI경쟁·prepare/download 회귀를 검증한다.
- 설치/새 process/listener/실FS QA/실browser 자원은 이 GO에 포함하지 않는다. 기존 도구 기반 순수·메모리·번들 합성 DOM과 type/build를 사용한다. 별도 자원이 필요하면 정확 등록·기존 허가 범위를 먼저 Main과 대조한다.
- 결과에 정확 명령/exit/RED→GREEN·변경경로·실제 미실행·남은 기능을 적는다. Main fresh검증 및 독립 C/I0 후 정확 소유경로만 checkpoint한다. 실제 PG/RLS/COMMIT/동시성·served/UI사용자인수는 NOT_RUN이다.
