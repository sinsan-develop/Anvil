# F-20 WSL Final Validation WorkInstruction

## 범위

동일 ReleaseManifest/commit의 11개 메뉴 smoke, 중단·재개·복구, monitoring·ProductValidation·Defect, backup/restore·rollback을 `ssh WSL-server`에서 최종 검증한다. Production·ysna-server 배포와 사용자 RELEASED는 제외하고 ReleaseDecision은 DEFER로 유지한다.

## 완료조건

WSL-server에서 실제 runtime·브라우저 클릭·same-origin Network·DB/queue/worker/Provider 상태를 실행 범위별로 기록하고 blocking defect 0, 관찰구간 critical alert 0, temporary resource residue 0을 확인한다.
