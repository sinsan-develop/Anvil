# C-21 WorkInstruction — Successor 운영 검증

## 범위

- C-16~C-20 계약의 persistence/API/DB/browser/provider/Telegram webhook 운영 유사 검증
- 기존 서버·DB·webhook 상태에 대한 read-only health, schema, same-origin, secret 비노출, replay/audit 확인
- 승인된 환경에서만 최소한의 안전한 probe를 수행하고 모든 외부 쓰기는 금지

## 완료 조건

1. 운영 유사 환경의 commit/manifest/hash 계보와 서비스 health를 증거로 기록한다.
2. PostgreSQL persistence와 event/audit/replay 계약을 실제 연결 경계에서 검증한다.
3. Web Console/API same-origin·SSE/Last-Event-ID 및 브라우저 응답의 secret/internal endpoint 비노출을 확인한다.
4. Provider routing은 실제 key 값을 노출하지 않고 configured capability/drift 상태만 검증한다.
5. Telegram webhook은 allowlist/secret/replay/audit 및 고위험 거부를 검증한다.
6. 실패·미검증 경계를 정직하게 기록하며 public exposure/deploy/schema destructive change는 수행하지 않는다.

## 제한

- 운영 데이터 변경, 배포, webhook 변경, Provider 과금 호출, 공개 노출은 승인 없이는 수행하지 않는다.
- 실행하지 못한 브라우저·DB·Provider·Telegram 검증은 PASS로 승격하지 않는다.
