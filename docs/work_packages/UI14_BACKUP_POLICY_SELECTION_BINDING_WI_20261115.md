# UI14 수동 백업 정책 목록 선택의 정확 참조 결박

기준 main bc87761bddc5f3905fd463df1eae7cb77a3ddb12, branch codex/av3-plan-resume-20261115. FN16 수동 백업 정책 r2 A안의 기존 목록/고정조회 계약 소비 누락을 보완한다. 새 공개 API·저장·권한 의미는 추가하지 않는다.

## 사유와 동작

현재 BackupPolicyPanel 목록 클릭은 검산된 정책의 id/version만 fixed에 전달하고 readBackupPolicy의 기존 want 인자를 undefined로 넘긴다. 같은 id/version의 다른 유효 본문을 상세로 반환하면 목록에서 선택한 contentHash와의 대조 없이 표시하고 개정 초안의 기반으로 사용할 수 있다. 목록 선택은 원 v.ref 전체를 기존 상세 검산에 전달한다. 직접 ID/version 입력 조회는 기존처럼 별도 목록 참조 없이 조회한다. 불일치 상세는 RESPONSE_INVALID로 거절하고 선택/개정 근거로 사용하지 않는다. 기존 현재성/주체/지연응답 검사는 보존한다.

## 담당과 허용 경로

기존 developer_primary 단일 writer. Main은 문서/검수/통합하며 같은 코드를 수정하지 않는다. 다른 작성자의 변경을 되돌리지 않는다.
- apps/web/src/features/backups/BackupPolicyPanel.tsx
- tests/unit/UI14/backup-policy.test.ts (기존 React RAM 행동 시험)

정확2경로만 허용하며 추가 경로가 필요하면 쓰기 전에 근거를 반환한다. 새 DOM 모사 라이브러리/종속성·브라우저 프로필은 추가하지 않는다.

## 검증·제외

목록 선택→정확 상세 양성, 같은 id/version이나 다른 검산 가능한 contentHash의 상세 거절을 RED→GREEN으로 확인한다. 직접 입력 조회 유지·기존 영향 회귀/typecheck/diff와 정확 지문을 제출한다. API 시험만으로 화면 클릭까지 확인했다고 보고하지 말고 가능한 RAM 행동 시험과 실제 브라우저 미검증을 구분한다. 실제 DB·권한·키·자료조사·서비스·SDK/Agent·백업 생성/파일 읽기 실행0. 제품/시험 범위가 바뀌면 Main에 먼저 알린다.
