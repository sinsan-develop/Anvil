# F-11 OLLAMA local adapter 독립 검토

## 판정

`ACCEPT` — Critical 0 / Important 0 / Minor 0. 승인된 F-11 host-injected exact6 범위의 계약 검증에 한한다. 실제 socket·egress·Ollama·WSL 운용 인수 판정은 아니다.

## 근거·재작업

- 1차 `REWORK`: 공식 Ollama `/api/chat` 스트림에는 `message` 없이 `done:true`와 최종 usage만 있는 프레임이 있는데 초기 파서가 이를 거부했다(Important 1). 공식 문서는 `message`가 빈 텍스트로 있는 최종 프레임도 제시한다. 두 형태를 모두 허용하되 최종 프레임의 tool·이미지·thinking·오류·비정상 종료는 거부하도록 수정했다.
- 재작업 중간 RED에서 `tool_calls:[]`·`images:[]` 존재를 truthiness 검사로 놓치는 2건을 확인했다. 존재 자체를 거부하도록 보완하고 회귀 테스트를 추가했다. 재검토에서 신규 Critical/Important/Minor는 0건이다.
- Endpoint는 canonical URL/IP, metadata·link-local·특수 주소의 절대 차단, 환경별 exact allowlist, 전체 DNS 답변 검사, 매 요청 fresh resolve를 적용한다. Adapter는 pinned IP 연결 후 전송 전에 peer IP를 대조하고, 서버 소유 경로와 redirect/proxy 금지 flag만 전달한다. 오류·receipt·probe payload에 endpoint 원문 노출을 확인하지 못했다.
- 설치/오프라인/모델 부재/사용 가능/stream ready 상태는 `/api/version`·`/api/tags`·선택적 `/api/ps` 및 완료된 stream 증거에 따라 구분한다.
- 독립 검증: `D:\tmp\anvil-main-integration\.venv\Scripts\python.exe -B -m pytest -q -rs --import-mode=importlib -p no:cacheprovider --basetemp=D:\Project\Anvil\.codex-sandbox\f11-review-110a66c4145849998c1c5f2fd4bff72a tests\providers tests\llm_gateway tests\provider_catalog tests\model_registry tests\budget` → exit 0, 699 passed/4 skipped(PG18 DSN 미구성). 임시 경로는 확인 후 삭제해 잔여 False.
- Main 별도 재검증: 같은 관련 suite + `tests/tooling/test_f11_progress_overlay.py` → exit 0, 706 passed/4 skipped. Main 임시 `.f11-main-final-20260924b` 삭제 확인.
- 제품 exact6 외 변경 없음. 검토 시 HEAD `ebe39c2ee7f27bfe3bd73937c385eac9e6c865ec`, 6파일만 untracked.

## 미검증·잔여 위험

- 주입형 transport 테스트는 host 구현이 실제 연결 peer를 검증하기 전 HTTP byte를 보내지 않는지, 같은 socket을 쓰는지, redirect·proxy·egress를 차단하는지 증명하지 못한다. F-12에서 실제 host transport와 egress 검증이 필요하다.
- 실제 Ollama/network/credential, DB, browser, WSL-server, deployment는 실행하지 않았다. PostgreSQL 18 DSN 필요 테스트 4건은 skip이다.
- 보조 wire 근거: [Ollama 공식 API](https://github.com/ollama/ollama/blob/main/docs/api.md?plain=1). SSRF 방어 원칙은 [OWASP SSRF Prevention](https://cheatsheetseries.owasp.org/cheatsheets/Server_Side_Request_Forgery_Prevention_Cheat_Sheet.html). 실제 배포 구성의 egress 증거로 승격하지 않는다.
