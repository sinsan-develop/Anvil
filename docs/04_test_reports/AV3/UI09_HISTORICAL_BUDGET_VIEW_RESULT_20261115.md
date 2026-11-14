# UI09 준비기록 고정 한도 정책 조회 연결 결과

## 변경·판정

기존 준비기록에 저장된 budgetRef를 사용자가 명시적으로 눌러 기존 고정 GET으로 조회하는 source 연결. 참조없음은 GET0, 다른id/version/hash·권한거절은 정책본문표시0. 기록교체/닫기/같은기록재조회/ABA/주체전환 뒤 늦은200/401은폐기. POST/저장버퍼변경0. 표시된 정책의 현재 가용예산·실행/재개허가는 확인하지 않는다. 실제브라우저/DB/서비스/Agent 인수와전체계획은미완료.

- 기준 main68b1fdde9ab7baf201905655aca63bb25706ff85
- 기존 developer_primary 제품/시험 정확2파일 단일writer, Main문서/검수/통합
- WI: docs/work_packages/UI09_HISTORICAL_BUDGET_VIEW_WI_20261115.md
- WI SHA256: A8441E808B21645E4320A0C0D783B5668DF5D4EC11FFDC010E54A2020C364575

## 검증

- RED b4facc exit1/1F: 기존기록은검산됐으나명시정책조회버튼이없음,정책GET0.
- 수행자 node --experimental-strip-types --test --test-reporter=tap tests/unit/UI09/preparation-record-ui.test.ts tests/unit/UI11/limit-policy-api.test.ts —43P0F0SKIP exit0/6760.6894ms(a3519d), root npm run typecheck 진단0/exit0, diffcheck0.
- Main최초 --test-name-pattern="당시.*|저장된 한도"는실제개별시험선택0으로검증증거제외. 정확패턴으로교정했다.
- Main node --test --test-name-pattern="과거 한도 정책" tests/unit/UI09/preparation-record-ui.test.ts —11P0F0SKIP exit0/2492.5296ms(0f1162). 양성·null·다른유효hash·403·401·지연닫기/재열기/재조회/교체/ABA/주체교체.
- 독립 C0/I0/M1: 저장된APPLIED결정을기록생성당시유효하다고읽을수있는문구를보완한다. 기존형상/권한/검산/실행효과는변경하지않는다. 최종지문과한정재검증은WORK_STATUS후속참조.

실제React와기존RAM DOM행동시험이며실제브라우저레이아웃/DB/네트워크/서비스/키/권한/Agent검증아니다. 신규종속성/API/SQL0. 복구는정확제품/시험2경로의이번diff를이전main으로되돌리는변경이며지속데이터변경0.

## M1 보완 동결

제품: apps/web/src/features/transfers/TransferPreparationRecordPanel.tsx
SHA256: 81FA2B6ABB8FFE95D02C406A86FC3F878F03892E74E2A8D34F89C7CCF9A8402D
시험: tests/unit/UI09/preparation-record-ui.test.ts
SHA256: 38A0E03B731CE73D65758E9CCC409E833882F7392FD34443DB7E22795BCD08C8

저장된 정책 상태 문구와 양성 단언만 보완했다. 수행자 정확 양성1P0F0SKIP/exit0·diffcheck0, 쓰기반환/live0. Main제품역치환지문불변 확인. 기존11사례결과를 전체실환경PASS로표현하지않는다.
