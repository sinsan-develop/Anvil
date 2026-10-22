# FN10 선택 검수 근거 조회 — 한정 실제 결과

## 판정

- 신규 조회의 격리 실제 DB 핵심 경로는 확인했다. **전체 실행은 exit1이며 성공으로 소급하지 않는다.**
- child workflow는 DONE, runner의 PG/network 회수는 성공했다. 자식 wrapper의 checkout 회수는 실패를 반환했고 outer trap이 뒤이어 전용 checkout을 회수했다.
- 별도 SSH 읽기에서 exact 자원·경로·관련 cwd 잔여0과 정식3개 metadata 불변을 확인했다. wrapper 첫 회수 실패 원인은 미확정이다. 같은 후보는 재실행하지 않았다.
- 전체 FN10/Stage/작업계획 완료가 아니다.

## 기준과 실행

- source: b4bae2962c034e80102701b48093b693b65756fa, codex/av3-stage-b, private 동일. remote main f976ed5e29e14b13e12729d5b1ccf98f050f2210 불변.
- PMO의 이 exact 후보 새 빈1회 채택 후 실행했다. 후보: FN10_NEXT_ACTION_BASIS_READ_CANDIDATE.md.
- bootstrap SHA256 E59C1332E15CCC96A845B17232F0F3E1668C01F5D4CB2FD13E2D32558387C42F. 기존 runner/launch/lab/read helper4SHA는 후보 전달값과 일치했다.
- 전체61 SQL manifest SHA256 9fd3dab149805174bc81b0abab14272adcc235ecff0eb902f19043bc5b40eb73. 기존59+0026_result_review_criteria+0027_result_reviews이며0037/0038/정식 등록은 제외했다.
- 실행: WSL-server에서 clone 전 trap bootstrap을 bash -s -- <exact SHA>로 전달했다. PowerShell stdin의 CR만 tr -d '\r'로 정규화했으며 제품 source는 Git exact clone으로만 가져왔다.
- SSH timeout420+TERM50초, launch240+30초, wrapper150+30초, child90/부모110초, runner회수25/checkout회수45초. 실제 Agent/비용0.

## 실제 확인 범위

1. 새 빈 PG15에61 SQL COMMIT·정확 ID/checksum, 비관리자 app 역할 접속.
2. 기존 정상 합성 프로젝트·문서/임무·제출·검수 저장 seed 이후 선택 원문/확정 임무 GET.
3. 실제 인증된 새 next-action-basis GET가 원 검수·제출·확정 임무·현재 방법론을 대조하고 기존 Web reader가 소비.
4. 타인404/NOT_FOUND·익명401/AUTH_REQUIRED·추가 query400/INPUT_INVALID의 고정 비노출 DTO.
5. 조회 전후 검수·제출·확정 임무·명령·허가·감사 6표 **행수** 불변. 내용 전체·물리 경합 불변을 주장하지 않는다.
6. 완료 수락·실행·dispatch 권한을 만들지 않았으며 scheduler/실제 Provider/served DOM 증거가 아니다.

## 출력과 정리

- 실행 첫 명령 session93955, 최종 polling ae545c: exit1.
- FN10_BASIS_SCHEMA_61_COMMITTED_APP_NON_SUPER
- child safe: phase DONE, SELECTED_REVIEW_BASIS_WEB_READ / OUTSIDER_ANONYMOUS_QUERY_DENIED_NO_CONTENT / READ_LEDGER_COUNTS_UNCHANGED, failure null, closeFailures0, rootCleanupFailedfalse, 원문 files2/dirs5 회수.
- PG ID: 21f37f00b53d5f1f2e8370415a2ae12222e8b382906f828cd9e7bdf20561b5ad
- network ID: c25f761a391b7c5eb27e4c4a446b96482f7955ada6a6881ca2a1e7eb982e4d18
- instance: 4ed94c2f9872fadcced9b622914af60c, owner AV3_FN10_NEXT_BASIS_QA.
- runner: failurefalse/cleanupFailurefalse/phaseDONE. 뒤 wrapper FN10_BASIS_QA_CLEANUP_INCOMPLETE/exit2.
- outer trap: FN10_BASIS_QA_CHECKOUT_REMOVED, bootstrap status2/cleanup_failed0/path_exists0.
- 별도 SSH 후검사 exit0: exact PG/network ID·이름·owner/instance label·전용 root·관련 cwd 잔여0.
- 정식 PG e6f798c3… / API8bd8af7b… / Web677a9ceb…의 full ID/image/StartedAt/runningfalse는 생성 직전과 별도 후검사에서 같았다. 정식 DB SQL 접속·서비스 변경0.

## 남은 범위와 다음 조치

- wrapper 첫 checkout 회수 실패 원인은 열린 문제로 보존한다. 안전 검사 완화·sudo·맹목 재실행 없이 필요한 경우 로컬 반례/고정 진단으로만 좁힌다.
- 정식 DB/served 화면·현재 실행 상태·물리 경합·통합 scheduler/slot·전체 FN10·Agent 작업/사용자 인수는 미검증 또는 미완료다.
- 이 결과를 정식 서비스 반영이나 전체 완료 근거로 사용하지 않는다. 보류된 bound 저장 계약/0038도 그대로다.
- 결과 checkpoint 뒤 Main은 독립 미완료 UI08 보고 문제의 기존 원문·근거 탐색 공백을 읽어 다음 구현을 선정한다. 완료 FN06/기존 QA는 반복하지 않는다.
