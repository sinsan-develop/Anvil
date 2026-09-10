# C-21 WSL QA ingress-only network 예외 승인

- 승인자: 신산님. 현재 대화의 명시적 `승인해`를 직전 Main의 WSL ingress-only non-internal network 예외 제안에 적용한다.
- 분류: 중요 위험 변경에 대한 사람 승인. 단순 내부 구현 재확정으로 분류하지 않는다.
- 이전 승인 `APPROVAL-20260904-C21-WSL-EXACT34-CLEANUP-001` 원문·hash와 과거 evidence는 보존한다.
- 대상: WSL-server의 `anvil-wsl-pg15`, `anvil-wsl-pg18rc` Git-only 격리 검증 harness. candidate `ccf5109d0640bf28c461e7754ad56e0821fd77be`, parent/control `3f52d26a61e49543dd3d3121f5cc62a04f809a3d`.
- 신규 지속 자원: project별 `anvil-ingress` service 컨테이너1개(합계2), `${project}_anvil-ingress` non-internal bridge1개(합계2). loopback4770/4870에서 nginx8080으로만 publish하고 upstream은 기존 `anvil-web:3770`으로 고정한다.
- nginx image: `nginx@sha256:a8b39bd9cf0f83869a2162827a0caf6137ddf759d50a171451b335cecc87d236`. 비root101, read-only, cap-drop ALL, no-new-privileges, /tmp tmpfs를 적용한다. 일회성 --rm 설정검사도 허용한다.
- app/DB는 기존 internal-only bridge에만 연결한다. ingress에 DB·Provider·Telegram Secret을 주입하지 않는다. nginx 자체 outbound capability는 이 승인된 예외로 인정하되 Provider/Telegram 실제 호출은 하지 않는다.
- Host/Origin/Cookie/auth/Last-Event-ID와 same-origin API/SSE 계약을 보존한다. 정적 upstream 외 임의 forward proxy 및 CONNECT는 허용하지 않는다. web 교체 후 ingress를 재생성하여 DNS를 갱신한다.
- 검증: Git candidate/control 정확성, Compose/config, UI/API/health/authenticated SSE/Last-Event-ID, backup/restore, genuine previous `324eb169fedbce958d2e8cc29362deb7af433677` application rollback 및 candidate 복귀. DB 자동 downgrade는 하지 않는다.
- 정리: 검증 후 exact project/service/Compose network/환경·scope label을 확인한 지정 ingress/web/db와 exact project network만 제거한다. 기존 승인 exact DB volume2개만 삭제하며 unrelated 자원과 사용자 데이터는 보존한다. 이미 부재한 자원은 idempotent 처리하고 잔류를 확인한다.
- 제외: ysna/NPM/공개 DNS/TLS/Secret 변경, 운영 전환, main 병합, Provider·Telegram 실제 검증. private development remote의 candidate/control push는 기존 Main 자율 정책을 유지한다.
- 상태: 승인된 구현·검증 준비. 이 문서는 새 candidate 실제 host/DB/API/SSE/rollback 성공 증거가 아니다.
- seq492 코드·보안 허용 조건 결박에 대한 후속 명시 승인: 신산님은 “기존 seq1~491과 historical evidence를 보존하면서, ccf5109용 seq492 checker·guard·manifest·승인 binding·finalizer 및 관련 생성기·계약 테스트를 보완하고, 이벤트 append·계보·변조 거부·checksum 검증을 수행하는 것을 승인한다.”라고 직접 승인했다. 이 승인은 기존 ingress 예외 범위를 넓히지 않으며 과거 검증 완화나 미실행 성공 판정을 허용하지 않는다.
