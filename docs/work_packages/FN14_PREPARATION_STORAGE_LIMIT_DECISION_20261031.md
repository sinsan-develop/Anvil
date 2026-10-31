# FN14 준비 기록 저장 — 누적 상한·source 계약 결정안

상태: **CANDIDATE / NOT_ADOPTED**. 작성·공유는 채택이나 구현 GO가 아니다.

## 필요한 결정과 기존 승인 차이
- 기존 FN14_TRANSFER_PREPARATION_RECORD_PROPOSAL.md SHA E096C897761A71D980F19B98E7BB47623DF8933C4F456BD1592621751DB1EB9D는 미채택이다. 새 createTransferPreparationRecord·고정 GET1·불변 기록/버전2표·작성자 한정 readTransferPreparationRecord 정책을 정의한다.
- 현재 저장량 A 승인은 원본/첨부/diff·명시 checkpoint를 위한 원장2표와 source 구현이다. 기타 DB metadata는 집계 제외다. 따라서 A 승인으로 FN14 준비 기록이나 읽기 노출 계약까지 채택했다고 할 수 없다.
- 원 후보의 개별2MiB/이유4096bytes는 누적 저장량을 제한하지 않는다. 기존 독립 Important1인 프로젝트별 유한 누적 상한·초과/보존 계약은 아직 남는다. 현재 실제 DB나 저장 파일은 조사하지 않았다.

## 권장 A — 별도 논리 상한과 source-only 채택
- 기존 E096 후보에 다음 보완만 결합해 코드·미적용 SQL·합성 검증을 채택한다. 화면/실제 DB 적용·정책 부여·키·파일 조사·서비스·Agent 실행·이전/재개/제어 전환은 포함하지 않는다. 원 후보대로 source verifier가 미연결이면 닫는다.
- 프로젝트별 불변 준비 기록을 **최대10,000건 / 최종 canonical snapshot UTF-8 합계1GiB**로 제한한다. 두 상한을 모두 만족해야 한다. 수치는 기존 checkpoint의 유한 기본값과 맞춘 제안이며 이미 승인됐다고 주장하지 않는다.
- 집계는 FN14 준비기록만의 별도 논리 한도다. global10GiB A 원장에 metadata를 추가하지 않으며 DB 물리/TOAST/index/WAL·명령/영수증/감사 복제 바이트 한도는 증명하지 않는다. 기존 data와 source 계약의 집계 범위를 암묵적으로 변경하지 않는다.
- 같은 project 잠금·현재 인증/OWNER/제어·별도 쓰기/읽기 정책·원자료 보호·정확명령 검사를 마친 저장Tx에서 기존 count/bytes+신규 canonical bytes를 재검산한다. 물리 FS I/O가 없으므로 A의 별도 I/O 예약 프로토콜을 복제하지 않는다.
- 한도 초과는 신규 명령·기록·receipt/audit 전체 rollback, 유한429 TRANSFER_PREPARATION_STORAGE_LIMIT을 반환한다. 입력은 보존하며 자동 절단/삭제0이다. 정확 과거 APPLIED replay와 고정 GET은 현재 읽기/원자료 보호를 재검산한 뒤 신규량0으로 처리한다. 상한 때문에 적법한 과거 읽기를 막지 않는다.
- 만료·원문 회수는 기록 삭제나 사용량 감액 근거가 아니다. 숨겨진 기록도 누적량에 남긴다. 기존 기록은 불변으로 보존하며 자동 회수0이다. 실제 상한 해소/관리 기능은 별도 범위다.
- raw app DML·반쪽 record/version·원명령/receipt/audit 누락과 역방향 누락을 scoped guard로 거절한다. 기존 공유 guard·SQL 원문·실제 사용자 정책은 변경하지 않는다. source verifier/모든 mutation 잠금 미입증과 실제PG/경합은 미검증으로 분리한다.
- 승인 후에만 Main이 정확 파일·기존 caller·검증 범위를 WI로 고정하고 같은 Primary에게 구현을 맡긴다. 최신 실제 실행 제외 범위와 단일 writer 규칙을 유지한다.

## 대안 B — 미채택 유지
새 operation/GET/2표·읽기 노출과 source 구현을 시작하지 않는다. 기존 계산형 준비 화면은 유지하지만 준비 기록을 저장해 다시 여는 기능은 미구현으로 남긴다. 다른 승인된 독립 구현은 계속한다.

## 요청
PMO에 위임된 Anvil 결정·지원 범위 안이면 A 또는 B를 명시한다. 위임 범위를 벗어나면 어떤 계약·결정이 사용자 직접 판단인지 정확히 설명한다. 이는 다음 업무 배정 요청이 아니라 위 신규 계약/상한의 필요한 결정이다. Main이 다른 독립 업무 선정을 계속한다.
