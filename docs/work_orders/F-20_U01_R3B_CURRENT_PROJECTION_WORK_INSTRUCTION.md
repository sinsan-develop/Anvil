# F-20/U-01 R3b 현재 projection 계약 테스트 WorkInstruction

- 발행 준비자: Main Agent 어울. **DRAFT — canonical WI Event·epoch15 exact2 dual lease/G-05 PASS 전 제품 exact2 수정 금지.**
- 상위 권위: 승인된 `Anvil_작업계획서_v1.md` §13 U-01, `Anvil_통합검증매트릭스_v1.md` U-01, `docs/04_test_reports/F-20_FULL_SUITE_RECOVERY_PLAN.md` U-01 R3b.
- 환경: Windows 로컬 개발, 지정 원격 exact SHA를 `ssh WSL-server`에서 격리 검증. 기존 branch 하나만 사용하며 새 branch·main 병합·ysna-server·Production 제외.

## 정확한 제품 쓰기 범위

1. `tests/tooling/test_project_progress.py`
2. `docs/04_test_reports/F-20_U01_R3B_CURRENT_PROJECTION_RESULT.md`

Main은 R3a epoch14 write→worker lease를 순서대로 회수하고 새 epoch15 worker/write exact2를 발급한다. 단일 Developer의 제품 경로를 Main이 동시에 수정하지 않는다.

## 구현·검증

- WSL-server 전체 suite의 line1189 실패를 로컬 RED로 재현한다. 현 progress mode와 마지막 canonical Event의 `step_id`를 대조하고, progress/digest/manifest 변조가 현 route 오류로 거부되는지 확인한다. 고정된 과거 R2b/R3a 문자열을 현재 bundle의 기대값으로 사용하지 않는다.
- 역사 Git blob/hash, C30 `OPEN_BLOCKING`, release `DEFER`, manifest 미수락과 공통 handoff 변조 거부를 유지한다. assertion 삭제·skip·xfail이나 검증기 완화는 허용하지 않는다.
- 변경은 exact2에만 한정한다. 로컬 집중·인접 역사군/G-05 RED→GREEN, Main 독립 검토·commit/push, WSL-server 동일 SHA 정식 전체 suite 결과와 미검증을 결과보고서에 기록한다. 임시 자원은 사전 이름/수명/정리 기준을 기록하고 정확한 대상만 제거한다.
- API/DB/auth/UI, canonical Event/progress/digest/manifest, 다른 테스트 및 승인된 제품 계약은 수정하지 않는다.

## 완료 경계

R3b GREEN도 U-01/F-20 수락이나 C30 사고 복구가 아니다. `OPEN_BLOCKING`·`DEFER`, 기존 skip/warning 및 미실행 브라우저/운영 범위를 유지한다. rollback은 exact2 변경만 후속 정상 Git commit으로 되돌리는 것이다.
