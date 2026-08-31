# C-20 WorkInstruction — Telegram Notification/Command Adapter

## 범위

- 완료·오류·중단·승인대기 알림과 Web Console deep link
- 상태 조회 및 저위험 pause/resume 요청
- actor/device/session 식별, 서명·allowlist·rate/replay 방지·receipt
- 고위험 승인·배포·삭제·권한·Provider credential 변경은 거부하고 Web Console 승인으로 연결

## 완료 조건

1. Telegram-shaped update는 canonical payload, HMAC, UTC/expiry/future, allowlist를 fail-closed 검증한다.
2. nonce/command id replay와 중복 delivery를 차단하고 audit receipt를 남긴다.
3. deep link는 설정된 Web Console origin과 상대 경로만 사용하며 secret을 노출하지 않는다.
4. 고위험 명령은 실행하지 않고 ApprovalRequest와 승인 링크만 생성한다.
5. durable store가 제공되면 claim/audit를 연결하되 외부 네트워크 호출은 하지 않는다.
6. 테스트·compileall·`git diff --check`를 실행하고 실제 Telegram webhook/DB/deploy는 미검증으로 기록한다.
