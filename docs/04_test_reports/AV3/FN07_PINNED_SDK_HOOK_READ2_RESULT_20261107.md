# FN07 고정 SDK 훅 계약 추가 읽기 결과

- 일자: 2026-11-07.
- 판정: 추가 읽기 시도 소진·DNS 단계 실패. SDK 원문 수거와 신규 계약 확인은 미수행이다.
- 승인 근거: 구현 통제 §377의 신산님 직접 승인과 기존 읽기 담당자 단독 배정.
- 고정 읽기안: `FN07_PINNED_SDK_HOOK_CONTRACT_READ_CANDIDATE_20261106.md`, 5542B/SHA256 `2296F0EF805EB2F03D52E5FD30DD776AB1F45B14953BEC3D532FF51AB63236E9`.
- 소유 범위: 이 결과 문서 하나. 제품·계약·SDK 원문 파일은 작성하지 않았다.

## 수행과 정확한 실패

네트워크 전에 고정 읽기안의 tar NUL 정규식이 실제 문자 기준 `\0` 한 개를 사용하는지 확인했다. 내부 파싱 수정은 없었다.

지속 Node 메모리에서 `attempted:true`를 먼저 고정하고, Node 내장 `node:https`·`node:zlib`·`node:crypto`만 로드했다. 요청 대상은 다음 고정 공개 tarball 하나다.

`https://registry.npmjs.org/@anthropic-ai/claude-agent-sdk/-/claude-agent-sdk-0.3.224.tgz`

후보의 HTTPS GET을 한 번 호출했고 DNS 단계에서 다음 오류를 받았다.

```text
getaddrinfo ENOTFOUND registry.npmjs.org
```

실행 도구는 `isError:true`를 반환했다. 프로세스를 별도 실행한 셸 명령이 아니므로 별도 셸 종료 코드는 없다. 오류 처리 뒤 네트워크 없는 상태 확인에서 다음을 관측했다.

```text
attempted: true
state: FAILED_OR_UNKNOWN
sourceAvailable: false
packedAvailable: false
```

승인 시도는 소진으로 처리한다. 자동 재시도·추가 GET·다른 URL·DNS/프록시/권한 변경은 하지 않았다. 요청 함수를 한 번 호출했으나 HTTP 응답·본문은 받지 못했다. SDK 원문 bytes·무결성·훅 문맥에 대한 신규 성공 증거는 없다.

## 수행되지 않은 검산

tarball 1110841B와 기존 SHA512, 압축해제 최대16MiB, `sdk.d.ts` 333809B/SHA256 `556277033B15112811922D84EC8DC846D446CCE7BD9AA27765C52A9C09869575`, `sdk.mjs` 1145192B/SHA256 `70E00A3EE54A88382CA606893AC3C4ACDD9BB83A9E11A9D3E803FA0B63389ED5`는 고정 기대값이다. 이번 실패한 읽기에서 재검산한 값으로 표시하지 않는다.

추가로 확인하려던 callback 전체 서명·반환 동기성·실제 호출 인수와 SDK argv/env 변환 규칙은 미확인으로 남는다. 발췌할 새 SDK 메모리 원문이 없으므로 후속 원문 추출도 수행하지 않았다.

## 기존 근거와 제외 범위

기존 통제의 `spawnClaudeCodeProcess` 이름·실제 훅 호출 존재 기록과 앞선 `FN07_PINNED_SDK_SPAWN_SOURCE_READ_20261106.md`의 타입 확인은 별도 과거 증거로 유지한다. 이번 실패가 그 과거 확인을 무효화하거나 새로운 확인으로 대체하지 않는다. 훅 이름만으로 전체 callback 계약·argv/env 문법을 확정하지 않는다.

SDK 설치·SDK import/query/eval·OS child·계정/키·사용자자료·실제 실행파일·DB·권한·서비스·Agent·유료호출은 수행하지 않았다. SDK 원문 파일 저장은 없고 제품·계약·타인 자료 변경도 없다. 실제 생성 지원·실행 권위·후보 채택·제품 GO를 주장하지 않는다.

다음 조치는 Main에게 정확 실패와 시도 소진을 반환하는 것이다. 새로운 직접 지시 없이 같은 요청을 반복하지 않는다.
