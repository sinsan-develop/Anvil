# FN07 고정 SDK hook 공개 읽기 3차 결과

- 판정: DNS 단계 실패. 승인한 공개 GET 1회 소진. 신규 SDK 계약 확인 미수행.
- 승인: 2026-11-15 신산님의 `고정 SDK 공개 원문 읽기 1회 승인` 직접 답변.
- 수행자: 기존 developer_primary. Main은 결과 기록·검수 담당.
- 기준 읽기안: `docs/work_packages/FN07_PINNED_SDK_HOOK_CONTRACT_READ_CANDIDATE_20261106.md`, SHA256 `2296F0EF805EB2F03D52E5FD30DD776AB1F45B14953BEC3D532FF51AB63236E9`.

## 수행 결과

이전 READ2와 다른 메모리 객체 `anvilFn07SdkHookRead3`의 attempted를 네트워크 전에 true로 고정했다. 고정 URL `https://registry.npmjs.org/@anthropic-ai/claude-agent-sdk/-/claude-agent-sdk-0.3.224.tgz`에 HTTPS GET 한 번을 호출했다. 절대시간/socket 10초, redirect/재시도0, 메모리 전용 범위를 유지했다.

반환 오류 원문:

```text
getaddrinfo ENOTFOUND registry.npmjs.org
```

담당자 도구 반환 시간은 1.7초다. 셸 명령이 아니므로 셸 종료 코드는 해당하지 않는다. 반환된 상태는 `attempted:true`, `fetches:1`, `state:FAILED_OR_UNKNOWN`, `sourceAvailable:false`다. HTTP 응답/SDK bytes는 수신하지 못했다. 실제 호출 여부 불명으로 추가 요청하지 않으며 이번 1회는 소진으로 보존한다.

## 미검증과 제외

tarball 및 두 SDK 원문 파일의 고정 크기/해시는 이번에 검산하지 못했다. callback 전체 서명·동기성·실제 argv/env 규칙의 신규 확인은 없다. 이전 읽기에서 확인한 hook 이름/포트 기록을 무효화하지 않으며 이번 성공으로 재표시하지도 않는다.

추가 GET·redirect·재시도·파일 저장·SDK 설치/import/eval/query·Agent 호출·실제 DB·권한·키·서비스·사용자자료 조사는 0이다. DNS/프록시/환경을 변경하지 않았다. 같은 원인의 과거 READ2 실패와 이번 READ3 실패를 각각 보존한다. 실패는 SDK 제품 오류가 아니라 해당 조회 실행 환경의 DNS 해석 실패이며 호스트 전체의 네트워크 장애로 확대 판정하지 않는다.

## 후속

같은 조회를 자동 반복하지 않는다. SDK 호출 규칙에 의존하는 실제 생성 코드는 미확인 상태를 유지한다. 독립적인 normal SEND 서버 저장·자료·일회 소비의 상세 계약 검토는 계속하며, 새 공개/보호 읽기 의미의 채택과 실제 SDK 실행 승인은 구분한다.
