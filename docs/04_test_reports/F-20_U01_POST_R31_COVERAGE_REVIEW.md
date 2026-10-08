# F-20/U-01 R31 이후 Dashboard 잔여 계약 점검

## 판정

`U01_PARTIAL_INTERNAL_QA_ONLY`. R31은 기존 Dashboard GET의 수동 재연결 상태를 로컬·WSL-server 동일 SHA의 PG15/OIDC/HTTPS/Chromium에서 확인했다. U-01 독립 인수나 F-20 완료가 아니며 C30 `OPEN_BLOCKING`, ReleaseDecision `DEFER`, Production `NOT_EXECUTED`를 유지한다.

## 현재 계약과 빈자리

| 설계 §29.2 요구 | 현재 확인 | 다음 경계 |
|---|---|---|
| Project/Environment/기간 필터 | Dashboard GET은 인증된 단일 project/environment 소유자 범위이며 기간 파라미터가 없다. | 조회 계약·권한·기간 의미를 먼저 확정해야 한다. 화면에서 임의 필터링하거나 범위를 넓히지 않는다. |
| 운영 카드 6종 | snapshot에는 queue·worker·budget 등 원천 배열이 있으나 운영 카드별 분모·상태·신선도 read model이 없다. | 카운트/UNKNOWN 기준과 공개 응답 계약을 별도 정의해야 한다. |
| Next Actions 경과시간 | 같은 Dashboard snapshot의 `next_actions`는 우선순위·이유·대상·조치·경로만 가진다. `alerts`에는 대응 가능한 `observed_at`이 있고 서버는 미해결 alerts에서 next_actions를 투영한다. | 기존 응답 안에서 고유·검증된 대응 경고만 결합하여 경과시간 표시 가능성을 R32 내부 절편으로 검증한다. 매칭 불명확·시각 오류는 추정 금지/확인 불가. 공개 API 변경 없음. |
| Critical 확인 버튼 | 읽기용 `GET /api/operations/alerts`만 공개 등록되어 있다. `OperationsService.acknowledge()`는 내부 서비스이고 승인·evidence 검증이 필요하다. | 공개 쓰기 API·권한·감사 계약 없이는 버튼으로 상태를 변경하지 않는다. |
| U-01 독립 acceptance | AV-UI/AV-OPS, E-SHOT/E-NET/E-API/E-EVT 전량의 독립 Tester 판정 전이다. | 아직 `ACCEPTED` 아님. |

R32를 준비하더라도 기존 branch `codex/f18-wsl-ops` 하나를 유지하고, 정식 WorkInstruction·유효 dual lease 발급 전 제품 파일을 수정하지 않는다. R32는 화면/브라우저/테스트의 내부 표시 절편이며 새 API/schema·DB/auth/Secret·운영/ysna·main 병합은 범위 밖이다.
