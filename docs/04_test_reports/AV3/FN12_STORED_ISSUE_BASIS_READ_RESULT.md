# FN12 저장 원장 문제근거 실저장 소비 — 한정 확인 / 전체 exit 1

## 판정

2026-10-22 새 빈 격리 PG15에서 새 조회의 실저장 소비는 확인했다. 그러나 launch의 checkout 회수가 `OPEN_FILES` 가드에서 거절되어 전체 SSH는 exit1이다. 기능 긍정 증거·runner 정리·checkout 첫 회수 실패·outer 회수·별도 잔여 검사를 분리한다. 전체 실행 PASS·정식 서비스 복구·전체 FN12/UI08/계획 완료가 아니다.

## exact 실행과 확인 범위

- 실행 source: `92443f438902142ea1e34f88124247bb34e5c511`, 기존 `codex/av3-stage-b`, case `STORED_ISSUE`. PMO exact 단발 판정과 플랫폼 재심사 후 한 번만 실행했다.
- 실행 경계: Git exact 새 checkout의 bootstrap에 `SHA STORED_ISSUE`를 전달했다. SSH 전체420+50초/기존 clone·launch·runner·child·회수 기한은 유지했다. 제어 stdin에는 clone 뒤/실행 전에 후보 6파일 SHA256을 읽기 검증하는 검사만 추가했으며 Git 파일은 변경하지 않았다. `FN12_ISSUE_QA_SOURCE6_VERIFIED`를 확인했다.
- 생성 전 별도 SSH exit0: `PREFLIGHT_UTC 2026-10-22T12:31:16Z`, UID1000·등록 root/PG/net 부재, parent realpath/nonlink, 고정 daemon/image/Node 및 정식3 metadata를 대조했다. 자원/수명/회수는 [실행 전 후보](FN12_STORED_ISSUE_BASIS_READ_CANDIDATE.md)와 같다.
- 기존59+0026_result_review_criteria+0027_result_reviews 정확61, manifest `9fd3dab149805174bc81b0abab14272adcc235ecff0eb902f19043bc5b40eb73`, schema COMMIT/app 비관리자 표식을 확인했다. 정식 DB/schema/권한은 변경하지 않았다.
- 실제 PG의 정상 원제출·기준 seed 뒤 새 Fastify in-process GET와 실제 Web reader를 소비했다. 옛 NEXT_ACTION/REVIEW_COMMIT 후속 검증은 실행하지 않았다.

안전 출력은 child `phase=DONE`, `failure=null`, 다음 3개였다.

- `STORED_ISSUE_BASIS_EMPTY_ACK_WEB_READ`: ACK 없음·UNVERIFIED_CAUSE·causeUnestablished=true/7false 유지.
- `ISSUE_BASIS_DENIED_NO_CONTENT`: 타인404/익명401/query400의 정확 오류 code/빈 details·원문 비노출.
- `ISSUE_BASIS_READ_LEDGER_COUNTS_UNCHANGED`: 후보의 8표 행수만 전후 불변. 내용 전체/물리 경합 검증은 아니다.

## 자원·종료 원출력

- 새 PG: `ab0bfc373f2cbd87da299e0fdb853181a2690299037bef490e52e9e92ea0f505`
- 새 network: `2748b3f7cb8f4bcd26c38cf12cab253374fdb8b45b3ab300cb7849c342763d8b`
- instance: `e36b6651797176fb84f82b6980eaefa8`, owner `AV3_FN10_NEXT_BASIS_QA`.
- child: closeFailures0/rootCleanupFailedfalse, 원문 files2/dirs5 회수.
- runner: `failure:false,cleanupFailure:false,phase:DONE,independentResidueCheck:NOT_PERFORMED`.
- launch: `FN10_BASIS_QA_CLEANUP_INCOMPLETE stage=OPEN_FILES`, exit2.
- outer: `FN10_BASIS_QA_CHECKOUT_REMOVED`, `FN10_BASIS_BOOTSTRAP status=2 cleanup_failed=0 path_exists=0`.
- 전체 실행 tool session46239의 최종 `f81cbe`: exit1. 같은 실행을 재시도하지 않았다.

`FN10_BASIS_*`는 재사용한 runner의 출력 이름이며 실제 선택 case는 `STORED_ISSUE`다. 원 FN10 최초 exit1을 이 결과로 PASS로 바꾸지 않는다. 이번에 확인한 실패 위치는 열린 파일 가드까지다. lsof의 종료 코드·열린 PID/파일 및 직접 원인은 출력되지 않아 미확정이다.

## 독립 정리·정식 환경 대조

별도 SSH `97934a` exit0에서 새 exact ID/name/owner+instance label·전용 root·관련 cwd의 잔여0을 확인했다. daemon·PG image·Node는 후보 고정값이며 정식3의 다음 값은 사전/후속이 같았다. 모두 running=false다.

| 정식 대상 full ID | image | StartedAt |
|---|---|---|
| e6f798c3a2a3bdb2be533dd4c024d76f34d19fcfbbe4bf2acbe0437fb0cf32ba | sha256:594290e91b09c09728ed945ff89db65cd0fafff251f7c03c3d99c00ae5d9442f | 2026-10-20T11:21:54.792276193Z |
| 8bd8af7bfed0f98e02c0248f21dba62736c63dcd0ce8e7fdca2aa01f2726fc2c | sha256:6c5edefa5fc3d4038e51aa7140b4b53a9294414875af73f9d9bcd5e3aa54ac17 | 2026-10-14T12:39:20.431439158Z |
| 677a9ceb499e92a728560e882942edfcb80a7a30aedec69d69ae25567c008a0c | sha256:949aaeabd0daf44caa9341b1b2c8ddfb8409e4c2b3a8e1da0aeb3784bd0627fc | 2026-10-14T12:39:21.758759563Z |

정식 DB 접속/DDL·서비스 시작/중지·기존 Secret·Agent·Oracle·0037/거절0038은 변경0이다.

## 남은 작업

- 원 FN10 첫 정리 실패와 이번 OPEN_FILES 실패의 직접 원인은 미확정이다. 로컬 guard 반례·고정 진단으로만 좁히며 추가 원격 실행·가드/PID/timeout 완화·sudo·경로 우회는 하지 않는다.
- 이번은 empty-ACK 조회다. gap 있는 실제 ACK·실제 OS/현재 권한·물리 경합·정식 served DOM·실제 Agent/전체 FN12/UI08·Stage/사용자 인수는 미검증 또는 미완료다.
- 독립 미완료 구현은 Main이 승인된 계획에서 선정해 계속하며 기능 확인을 전체 실행/계획 완료로 승격하지 않는다.
