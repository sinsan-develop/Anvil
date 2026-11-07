# FN12 저장 원장 문제근거 실저장 소비 — 실행 전 후보

- 상태: source 준비·한정 검토 완료, 실제 실행 0. 이 문서는 실행 허가가 아니다.
- 기준: 제품 source `1123ab10de1dd95e3465f1af757bf46462373481`과 이 후보의 후속 QA source. 최종 게시 exact SHA는 실행 전 PMO 패킷에서 실제 local/private 출력으로 고정한다. 기존 branch `codex/av3-stage-b`, 지정 private 저장소만 사용한다.
- 목적: 기존 정상 원제출 seed를 실제 격리 PG에 저장한 뒤 새 `issue-basis` GET → 실제 Web reader, 비노출 거절 3건과 조회 전후 8표 행수만 확인한다. 현재 원인·실Agent/OS·정식 서비스·전체 FN12 완료 검증이 아니다.

## 1. source와 완료된 검증

새 `STORED_ISSUE` case만 지정한다. 기본 `NEXT_ACTION` case는 보존한다. 자식 환경은 `ANVIL_FN12_RESULT_REVIEW_QA=1`, `ANVIL_FN12_STORED_ISSUE_BASIS_QA=1`이며 옛 `ANVIL_FN10_NEXT_ACTION_BASIS_QA`는 전달하지 않는다. 기존 정상 제출·기준 seed 이후, 옛 `REVIEW_COMMIT` 이전에 새 조회만 수행하고 반환한다. 옛 FN10 검증·검수 저장/재생·DML/고아/회수 시나리오는 재실행하지 않는다.

새 성공 표식은 다음 3개만 안전 출력으로 재구성한다.

- `STORED_ISSUE_BASIS_EMPTY_ACK_WEB_READ`: 새 조회의 ACK 없음·UNVERIFIED_CAUSE/causeUnestablished=true·7false를 실제 Web reader가 소비했다.
- `ISSUE_BASIS_DENIED_NO_CONTENT`: 타인 404 NOT_FOUND, 익명 401 AUTH_REQUIRED, 추가 query 400 INPUT_INVALID의 고정 오류 DTO/빈 details·본문 비노출을 확인했다.
- `ISSUE_BASIS_READ_LEDGER_COUNTS_UNCHANGED`: `result_reviews/result_submissions/execution_observations/execution_acknowledgements/assignment_versions/commands/authorization_receipts/audit_events` 8표의 행수가 조회 전후 같았다. 내용 전체 불변이나 물리 경합 검증은 아니다.

실행 없는 source 증거: 신규 helper/모드 분리·마지막 집계 후 기한 폐기와 기존 schema/entry/회수 guard를 포함한 직접·인접 11 PASS(351.7704ms), typecheck/diff 0, Bash 구문 2개 0. 독립 최초 C0/I0/M1은 마지막 counts await 후 active 누락이며, 반례 RED 후 보완·scoped C0/I0/M0(독립 실행/수정 0)다. `--plan`은 STORED_ISSUE/61 migration/actualExecuted=false였다.

아래 SHA256은 Git blob 원문과 Windows 파일 원문이 일치함을 확인한 값이다. WSL에서는 exact checkout 원문을 다시 대조한다.

| 파일 | SHA256 |
|---|---|
| scripts/next-action-basis-qa-bootstrap.sh | e217085bb5f65f0ee2e3a821597c4cbb41103689708512121f654547a3d5dcbf |
| scripts/next-action-basis-qa-launch.sh | 32cec5a28f1bdb653f07670e46b3fa4dfcf5714cfaf1381118522c7c7bc3b1c5 |
| scripts/next-action-basis-isolated-qa.ts | 9d9cbfbb6633d4271e7db06e8340e5accdc28028efcbe9748d78f27322072d7d |
| tests/integration/FN10/next-action-basis-lab.ts | 2c8e12a7210b2be4db3bed3aa65c14bbcff05020189344e8ad06f69688e98fa1 |
| tests/integration/FN12/issue-basis-read-qa.ts | 49bc8e3251799b19cda6ac96d1efb432236bd0fef4ec712512dfd6b77110d59d |
| tests/integration/FN12/result-submission-isolated.test.ts | b7523b007c30fad801d9f47e83c8bd7fc29db6989797bf35e1b9fb240e57af21 |

## 2. 고정 격리 자원 — 생성 전 재검증 필수

- WSL-server 전용 새 빈 checkout: `/home/daon/deploy/anvil-v3-fn12-result-reviews-qa-01`, parent `/home/daon/deploy`, UID1000/daon·realpath 일치/nonlink. 기존 자료가 있으면 생성하지 않는다.
- 공유 의존성은 `/home/daon/deploy/anvil-v3/node_modules`의 승인된 기존 내용과 package-lock 일치를 확인해 링크만 사용한다. 공유 경로 수정/삭제 금지.
- 새 PG 이름 `anvil-v3-fn10-next-basis-pg-01`, network `anvil-v3-fn10-next-basis-net-01`, owner label `AV3_FN10_NEXT_BASIS_QA`, 생성 직전 runner가 새 32hex instance를 정한다. 새 full container/network ID를 기록하고 label·이미지·network·mount/port를 다시 대조한다.
- DB `anvil_v3_fn12_result_reviews_qa_01`, 비관리자 `anvil_v3_app`/전용 migrator. 임시 합성 password/로그인/토큰은 실행 메모리·보호 시험 경로 안에서만 사용하고 원문을 출력/게시하지 않는다.
- 고정 daemon `e3349f1d-dbfc-478a-96d9-295bf6c6839e`, PG image `postgres@sha256:6eb0add3b77c081df18aa518ce43df58fdcc40f2e6d868a6fd08038dc7acd425`, image ID `sha256:594290e91b09c09728ed945ff89db65cd0fafff251f7c03c3d99c00ae5d9442f`.
- Node `/opt/node-v24.21.0-linux-x64/bin/node`, SHA256 `7fde7b8afa198da66257f42ee2001d874c7355631e6d1579a5fb5ef1f246df4c`.
- 기존59 SQL + `0026_result_review_criteria`/`0027_result_reviews` 정확61만 새 tmpfs DB에 적용. manifest SHA256 `9fd3dab149805174bc81b0abab14272adcc235ecff0eb902f19043bc5b40eb73`. 기존 SQL/정식 DB·0037/0038 변경 0.
- internal network, tmpfs 512MiB, host mount/volume·공개 port·정식 network 연결 0. root 아래 `.av3-data/fn12-raw`만 합성 원문으로 사용한다.
- 최대 10분. clone90초, launch240+30초, runner150+30초, child110초/test90초·합성 credential 최대100초, pool/PG/net 회수25초·checkout45초. 기한을 늘리지 않는다.

## 3. 실행·정리 경계

별도 exact 실행 판정과 플랫폼 재심사 전 SSH/clone/자원 생성/`--run`을 하지 않는다. 허용 시에도 시작 전 실제 Git/source 6hash·대상 부재·realpath/owner/link·daemon/image/Node·기존 정식 PG/API/Web의 full ID/image/StartedAt/running을 다시 읽고 commentary/WORK_STATUS에 등록한다. 정식 서비스·DB/권한/Secret·인증서·Agent·Oracle는 변경하지 않는다.

성공/실패 모두 runner의 exact ID·owner/instance·image·internal network·tmpfs/port/mount 대조 후 PG/net만 회수한다. 원문 파일은 hash/owner/nonlink로 정확히 정리한다. checkout은 기존 daemon·잔여 대상 부재·exact Git/dirty·owner/link set·공유 링크 대상·lsof 허용PID 가드를 통과할 때만 링크와 checkout을 제거한다. 거절 시 보존하며 sudo·가드 완화·다른 경로 우회·추가 재실행은 하지 않는다. 별도 읽기로 exact ID/name/labels/root/관련 cwd 잔여0와 정식 metadata 불변을 확인한다.

## 4. 원 실패 보존

이전 FN10 실제 한 번의 workflow DONE 뒤 launch 첫 checkout 회수 실패/exit2, outer 회수 성공, 전체 SSH exit1은 그대로다. 두 cleanup 함수의 조건을 정적으로 대조했지만 원 출력에 실패 단계가 없어 직접 원인은 미확정이다. 이번 변경은 launch에 고정 `cleanup_stage`만 추가한다. 가드·허용PID·삭제 대상·timeout은 불변이며 로컬 daemon 사전거절 함수 실행 반례만 확인했다. 실제 정리 문제가 해결됐다는 주장은 하지 않는다.

새 실제 결과에서 안전 표식/오류 code와 정리 결과를 분리한다. gap가 있는 ACK·현재 OS/권한·물리 경합·정식 served 화면·실Agent/전체 계획 인수는 이번 empty-ACK 조회로 입증하지 않는다.
