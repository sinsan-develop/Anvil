# C-09 시작 투영 보고서

판정: START_CONTROL_READY_FOR_REVIEW, 제품 완료 아님.
담당 developer-primary, seq795 C-08 ACCEPTED에서 seq796~798 exact11을 생성한다.
기준 HEAD 08aae12fdc4f8bd2d38b455f23408796ab4b8c82, branch codex/c09-execution-backends-r1, 시작 clean.
R2는 승인 범위 복원이며 C3/I7을 WI completion contract에 반영했다. 제품 exact18은 아직 수정하지 않았다.
RED: python -B -m pytest tests/tooling/test_project_progress.py -q -p no:cacheprovider -k seq798; exit1, 4 failed, 416 deselected, C-09 start builder missing. 의도된 TDD RED 1회, 제품 정식 실패 0회.
도구 오류: apply deny-read ACLs 1건; 승인된 apply_patch wrapper로 해결, wrapper 반복 오류0.
추가 RED: C08 predecessor manifest hash 누락 1 failed/421 deselected를 재현해 결박했다.
내부 문맥 오류: dispatcher patch hunk 순서 불일치1회, 정렬 적용으로 해결; 동일 오류 반복0.
GREEN: C09 focused 6 passed/416 deselected; C09+C08 회귀 15 passed/407 deselected, exit0.
canonical checker PASS sequence=798 reporting=AUTO_CONTINUE; py_compile/diff-check exit0.
C08 함수23개/테스트class2개 AST 및 선행 제품·역사 evidence bytes 불변을 확인했다.
staged exact11, unstaged0, untracked0; 결과는 시작 제어 검증이며 제품/backend 실행 증거가 아니다.
독립 review round1 C0/I2: AV-STAT-021 L5 복원 및 실제 parent approval SHA 검증 누락을 보완했다.
R1 전용 RED 2 failed/422 deselected → GREEN 2 passed/422 deselected; 두 root cause 각1회, 반복0.
Git fixture/Docker/WSL/DB/API/browser/Provider/Telegram/network/deploy/Secret 실행0.
commit/push/PR/merge 미실행. Main 독립 검토가 다음 단계다.
rollback: commit 전 exact11 diff를 보존하고 Main 통제하에 되돌림; commit 뒤 해당 control commit 정상 git revert.
