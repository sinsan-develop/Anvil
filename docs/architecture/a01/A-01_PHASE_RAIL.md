# A-01 Phase Rail

Phase Rail은 `Idea → Design → Plan → Execute → Verify → Validate → Release → Learn`을 한 축에 표시한다.

| Phase | 단계 | 완료 증거 | 다음 전이 금지 조건 |
|---|---|---|---|
| Idea | STEP-01~02 | 원문·대안·미결정 | 원문 미보존 |
| Design | STEP-03~04 | 사람 결정·design hash | 결정 actor/hash 누락 |
| Plan | STEP-05~06 | WorkPlan·승인 WI | 승인 전 Execute |
| Execute | STEP-07~08 | 구조화 결과·checkpoint | lease/결과 상태 불명 |
| Verify | STEP-09 | 기술 TestReport | 실행 범위 과장 |
| Validate | STEP-10~11 | criterion·defect 분류 | 기술 PASS 자동 승격 |
| Release | STEP-12 | RELEASE/REWORK/DEFER/REJECT | blocking defect 은폐 |
| Learn | STEP-13~14 | 후보·평가·승인·rollback | 무승인 활성화 |

## Rail 상태

- `CURRENT`: 현재 사용자가 판단하거나 관찰할 위치
- `COMPLETED`: 해당 단계의 필수 artifact/hash가 고정됨
- `WAITING`: 사용자 결정 또는 외부 조건 대기
- `BLOCKED`: 차단 이유와 다음 안전 행동이 표시됨; PASS 아님
- `STOPPED`: checkpoint와 중단 이유가 보존됨
- `RESUMING`: 동일 hash와 완료 단계 복원 검증 중
- `REWORK`: 새 revision으로 영향 단계에 회귀; 구 hash 재사용 금지

현재 위치·결정 필요사항·승인 대상·차단 이유·다음 행동은 Python/DB/CLI 없이 화면에서 이해할 수 있어야 한다.

<!-- catalog-ref: STEP-01 STEP-02 STEP-03 STEP-04 STEP-05 STEP-06 STEP-07 STEP-08 STEP-09 STEP-10 STEP-11 STEP-12 STEP-13 STEP-14 PATH-REVISE PATH-STOP PATH-RESUME AV-UI-005 AV-FLOW-001 RUNTIME_DEFERRED / NOT_EXECUTED -->
