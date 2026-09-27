# F-19 Provider·egress·Web·secret 보안 회귀 WorkInstruction

- 대상은 로컬 개발과 `ssh WSL-server` Test/Staging/격리 QA다. `ysna-server`·Production·운영 DB는 제외한다.
- 동일 Git commit을 WSL-server에서 직접 fetch/checkout하고, Provider catalog/settings/web security/secret capability 회귀를 같은 테스트 범위로 실행한다.
- 실제 Provider credential이 없는 경우 호출 결과는 `UNAVAILABLE/UNVERIFIED`로 기록하며 PASS로 승격하지 않는다. 키 오류는 계획상 지원성 판정에서 제외한다.
- 브라우저 Network·payload·DB·log·artifact에서 secret, DB 주소, OLLAMA 내부주소가 0건인지 기존 격리 evidence와 대조한다.
- 임시 checkout·venv·pytest cache는 실행 후 exact cleanup하고 residue 0을 확인한다.
