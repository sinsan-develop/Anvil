# UI14 백업 정책 선택 참조 결박 결과

## 판정과 변경

한정 source·합성 검증 완료, 실제 서비스/브라우저 인수 미완료. 목록에서 선택한 정책과 같은 ID·버전의 다른 본문이 상세로 표시되고 개정 근거가 되던 문제를 보완했다. 기존 readBackupPolicy의 want 인자에 선택한 전체 참조를 전달한다. 직접 입력 조회는 보존한다. 새 API·SQL·권한 변경0.

- 기준 main bc87761bddc5f3905fd463df1eae7cb77a3ddb12
- 담당 기존 developer_primary, Main 검수/통합
- WI: docs/work_packages/UI14_BACKUP_POLICY_SELECTION_BINDING_WI_20261115.md
- WI SHA256: 0AF3A7BC3D6FEE9E217C8250379DC4F43FAF5312BC3E9AD23AEFE55F0AEC2842

## 정확 변경 경로와 지문

apps/web/src/features/backups/BackupPolicyPanel.tsx
SHA256: 9819C97160E80FCE26AD1F09F0E40667DB554453DC903D3E2C84B8C48E878640

tests/unit/UI14/backup-policy.test.ts
SHA256: 37B117BAF6D208ABD05FAEE8147B12BAED1EBC9792DEB73C78E41EF5894AEB20

## 검증 근거

- 초기 시험 준비는 WebCrypto 비동기 정착 전 단언해0P3F(24ae9d). 응답 종료까지 기존 RAM fixture 대기를 보완해 제품 실패와 분리했다.
- 수정 전 목적 RED:84d4eb exit1,2P1F. 목록의 원본문A와 같은id/version이지만 자체hash가유효한B를 받으면 B와 개정버튼까지 표시됐다.
- 수정 후 수행자: node --experimental-strip-types --test --test-reporter=tap tests/unit/UI14/backup-policy.test.ts tests/unit/UI14/backup-policy-api.test.ts —18P0F0SKIP exit0,1712.4037ms(f8f5ac).
- 수행자 npm run typecheck —진단0 exit0. scoped diffcheck0.
- Main node --test --test-name-pattern="목록.*|직접 입력" tests/unit/UI14/backup-policy.test.ts —4P0F0SKIP exit0,1205.9811ms(bebcf9). 선택일치/불일치/직접입력 및 느린목록client교체 반례. 신규세경로POST0.
- 실제React 이벤트와 기존 메모리DOM 시험이다. 실제브라우저/레이아웃/네트워크/DB/서비스/백업파일/Agent 검증이 아니며 전체UI14/FN16/계획완료는 아니다.

## 복구

정확 두 제품/시험 경로의 이번 diff를 이전 main으로 되돌리는 변경으로 복구할 수 있다. 데이터/서비스 migration은 없다. 독립검수·최종Git통합 근거는 WORK_STATUS에 후속 기록한다.
