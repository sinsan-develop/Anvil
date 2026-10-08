# F-18 R45C rollback rehearsal 보완 계획

## 목적

R45C에서 확인된 `old image + OIDC trust 미구성` 503을 제품 결함으로 오인하지 않고, old artifact의 승인된 역사 실행환경과 restore head0016 DB를 동일한 비-OIDC 설정으로 재기동해 code/container rollback을 재검증한다.

## 범위

- 대상: WSL-server 격리 QA 전용 자원만 사용한다.
- old source/image: R21 `4eadfcd441b55445237545146ae5ba4051739904`와 기존 결박 image ID를 재빌드 없이 사용한다.
- DB: R45C old backup을 별도 restore DB/role에 복원하고 head0016을 확인한다.
- old runtime: `ANVIL_AUTH_MODE=WSL_ACCEPTANCE` 및 old compose 환경으로 API/Worker readiness를 확인한다.
- 금지: 현행 DB in-place downgrade, 공유 DB/Web 변경, Production·ysna-server 접근, 실제 Secret·운영 credential 사용.

## 완료조건

1. old image·restore head0016 DB·old 비-OIDC 환경의 API/Worker readiness가 PASS다.
2. 현행 OIDC target과 old rollback 환경을 서로 다른 Compose project/network/DB/role로 분리한다.
3. wrong head/dirty checkout/image mismatch가 mutation 전에 거부된다.
4. 전용 자원·backup·credential·checkout·port를 종료 후 정확히 제거하고 잔여 0, 공유 자원 ID 불변을 확인한다.
5. 미실행 범위와 Production 제외를 evidence와 `WORK_STATUS`에 기록한다.

이 계획은 F-18의 기존 승인 범위 안 보완이며, F-18 accepted 판정을 낮추거나 Production 검증으로 확장하지 않는다.
