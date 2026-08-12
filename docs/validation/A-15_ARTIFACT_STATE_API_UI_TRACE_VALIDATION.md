# A-15 Artifact·§49 상태·API·화면 Trace 검증

## 판정 범위

- 할당: `AV-UI-015`, `AV-STAT-041`, `AV-STAT-042`
- 환경: `ENV-LOCAL`
- 획득: `STATIC_TRACE_CONTRACT_ONLY`
- API·DB·browser·Provider·secret·egress·deployment: `NOT_EXECUTED`
- 사용자 UX 승인: `PENDING_USER_DECISION`
- DIR-1: `NOT_REACHED`

## TDD 증거

RED 명령:

```text
C:\Users\cyhuh\anaconda3\python.exe -m unittest tests.tooling.test_a15_artifact_state_api_ui_trace
```

결과: exit `1`, 8 tests에서 3 failures·5 errors. A-15 schema/API/matrix/approval/checker 미존재를 의도대로 검출했다.

GREEN: focused A-15 `8/8`, checker `PASS (0 errors)`, hostile fixture `12/12 rejected`. A-14, G-07, Phase G standalone checker는 PASS했다. full tooling은 `282 total / 272 pass / 10 fail`이며 A-13 successor 4건과 project-progress dirty projection 6건만 남았다. 두 계열은 active Developer exact12 diff를 seq178 Main start repository projection과 동일시하지 못하는 lease 밖 successor/progress 조건이므로 PASS로 승격하지 않는다.

## 정적 판정 기준

- 모든 required domain이 artifact → canonical source/projection → API → A-14 UI → permission → AV/evidence → runtime boundary로 연결되어야 한다.
- source 누락, 잘못된 source kind, absolute/localhost API, 가짜 사람 승인, 조기 DIR, incomplete mutation envelope는 hostile mutation에서 fail-closed 해야 한다.
- `STATIC`, `FIXTURE`, `NOT_EXECUTED`는 실제 기능 PASS가 아니다.

독립 Tester 판정과 사용자 UX 결정은 이 문서 범위 밖이다.
