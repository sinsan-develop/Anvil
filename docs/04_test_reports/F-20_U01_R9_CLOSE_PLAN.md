# F-20/U-01 R9 Queue host source 종료 계획

## 목적과 기준

R9 내부 Queue source host 연결의 local/WSL-server 동일 SHA 검증 뒤 epoch22 dual lease를 write→worker 순서로 회수한다. 제품 검증기록 predecessor는 `a4782daffa403a1862aaee53ac0841c887dfd253`, canonical Event seq1846이다. C30 `OPEN_BLOCKING`, release `DEFER`, U-01/F-20 미수락은 변경하지 않는다.

## 절차

1. 기존 branch `codex/f18-wsl-ops`와 사설 추적 ref·WSL 격리 QA checkout이 predecessor exact SHA/clean/G-05 seq1846임을 확인한다. R9 결과보고서의 실제 PG15·합성 OIDC·임시 자원 잔여0과 epoch22 token/만료를 대조한다.
2. control-only TDD로 기존 seq1~1846 Event bytes 보존, 올바른 lease/token·회수 순서, C30/DEFER/F-20 미수락, 제품 경로 무변경, Git ancestry·dirty scope를 검증한다. 허용 control 경로만 확장한다.
3. canonical `WRITE_LEASE_REVOKED` seq1847 → `WORKER_LEASE_REVOKED` seq1848을 append하고 progress/HANDOFF/detached digest/manifest를 재투영한다. G-05·인접 테스트·diff check 후 기존 branch에 commit/private push한다.
4. WSL-server 지정 격리 QA checkout을 동일 SHA fast-forward하고 clean/G-05·R9 임시 자원 잔여0을 확인한다. 다음 U-01 단계는 새 범위/별도 WI·dual lease 전 제품 수정 금지다.

main 병합·새 branch·ysna/Production·공개 API/UI·정식 E-SHOT/E-NET 및 전체 F-20 수락은 이 종료 control 범위 밖이다. 임시 pytest base는 Main이 이름·소유·수명·정리를 `WORK_STATUS`에 먼저 기록한다.
