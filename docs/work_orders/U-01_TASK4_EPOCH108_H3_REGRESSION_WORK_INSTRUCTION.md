# WI-U01-TASK4-EPOCH108-H3-REGRESSION-20261010-001

## 판정과 기준선

승인 계약 B의 U-01 Task4 비제품 검증 재작업이다. H3 `37323c39839f119137fc9b22502464034086189f`는 로컬/WSL-server clean G-05 seq2329 PASS이나 집중 시험은 WSL `1 failed, 13 passed`다. 보고 R1 `4c9aa475df4888e267e61e283424b0ebf9dc908c`와 보완 R2 `52aa0b865cc82accfd736c91790be25d52c7d639`는 기존 단일 branch의 직접 자식 chain이다. R2의 보고 SHA-256 `14786F778D504883B77246AE672B0EF2704B75CAF94EC4AC8E4CC7554A90C1DD`, `design_change.md` `3F6F83F0CF9DB9327AAF712E20BF9441E52AF39866BD2AE0B0AC4ACC64BEE98B`, 복구 계획 `F5080B4C0E455606E79205594D171A8DCE4406FB951306207ECF1385D23C5498`을 동결한다. 설계·기능 범위·요구사항·중요 위험은 바꾸지 않는다.

## 소유·write lease

- Main은 이 WI/Invocation, canonical Event·lease·progress/HANDOFF/digest/WORK_STATUS, Git checkpoint/push, 독립 판정과 WSL-server QA/정리를 소유한다.
- 단일 Developer는 Main이 명시적으로 전달한 서로 다른 유효 epoch109 worker/write fencing token, 이 WI hash, clean/private A 문서 checkpoint를 확인한 뒤 정확 `scripts/check_project_progress.py`, `tests/tooling/test_u01_postmerge_control_projection.py`만 수정한다. Main은 그 lease 동안 두 파일을 쓰지 않는다.
- 제품/API/UI/DB/브라우저/Secret, WSL-server/ysna/Production, 과거 Event·보고 원문·승인·설계변경, Git commit/push/PR/merge는 Developer write 범위 밖이다. 제품 write scope 0. 이전 epoch108 token은 REVOKED다.
- 기존 단일 `codex/u01-dashboard-r2`만 사용한다. U-01 `NOT_ACCEPTED`, Release `DEFER`, Production `NOT_EXECUTED`, U-02 `BLOCKED`를 유지한다.

## 정확 복구·실패 폐쇄 계약

1. WSL 실패 테스트의 합성 B/H3에서 `registry_refs`가 가리키는 Event file SHA와 `_file_hashes`를 실제 합성 bytes에 맞춰 결박하고 H3의 registry 검사 mock을 제거한다. 과거 A/H3를 현재 `load_bundle(ROOT)`와 혼합하지 않는다.
2. 이전 H2→R→A→C→B→H3 Event·Git blob은 변경하지 않는다. H3→R1→R2→A→코드 C→활성 B→회수 H4는 단일 부모/정확 허용 파일·실원격 SHA·dirty0·Event raw/chain·dual lease/effect·progress/HANDOFF/digest/snapshot/registry를 fail-closed로 검증한다. 이전 validator의 과거 R `design_change.md` hash를 현재 파일에 강요하지 말고 Git archive의 과거 blob에서 검사하며, R1/R2 현재 기록은 별도 정확 계보/hash로 검사한다.
3. 음성: 과거 원문·보고/DC 위조, 원격 삭제/전진/분기·tracking stale, 허용 외 경로/merge/dirty, lease token·epoch·순서·만료, 거짓 U-01 수락·Release/Production/U-02 변경은 GREEN이 아니다. 기존 route 오류 무시·기능 완화 금지.

## 검증·인계

- RED: R2/H3 현재 focused와 A의 새 route 부재를 정확 오류로 기록한다. GREEN: focused, epoch108/107/105 인접, 실제 A G-05 및 `git diff --check` 명령·exit·결과를 Main에 보고한다. 전체 suite 및 Windows 기본 fd-capture 미실행은 명시한다.
- Main은 독립 Critical0/Important0·정확 diff를 확인해 C/B/H4를 게시·검증하고 WSL-server exact-SHA focused/G-05 및 등록 QA checkout 잔여0을 별도 수행한다. 이 비제품 통제만으로 U-01 수락·PR/main은 허용하지 않는다.
- rollback은 이번 successor commit만 정상 revert하고 H3/R1/R2·승인 계약·사설 원격 복구 ref를 보존한다. 동일 정식 FAILURE_REPORT 3회면 Main 직접 인수한다.
