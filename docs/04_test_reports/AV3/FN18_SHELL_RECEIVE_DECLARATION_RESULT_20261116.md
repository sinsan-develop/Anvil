# FN18 데스크톱 수신 IPC와 shell 상태 타입 검증 결과

## 판정

고정 desktop 검사에서 shell의 TS7006 11건과 TS7053 1건, policy의 TS18046 1건이 사라졌다. **17건 → 4건, 신규 진단 0, exit 1**이다. 남은 네 건은 생성 번들 `./native-proof-runtime.cjs`의 TS2307이다. 직전 기준의 파일·행·열·코드·전체 메시지가 네 건 모두 동일하다.

| 기준 | 내용 |
| --- | --- |
| 브랜치 / 시작 HEAD | `codex/av3-native-connection-followup` / `1ed1dffe16f9e4714862dc9ad61504e69ea4b924` |
| WI r7 SHA256 | `C766ABCB8AFF45B7538BC20418F51D99CD96979C0348905FD6E78DBE86F29E9B` |
| WI r8 SHA256 | `7E59A81F875F89921B1DA047FF6EA1F3A8267F936C2B01FF71F9FE80929E9043` |
| 직전 owner 검사 | 17건, exit 1, LF 진단 SHA256 `087B421CE8391A12928F39C6741D3317270B0182CA6BCAFD9B98CB1BE11235B5` |
| shell.cjs SHA256 | `6E9F6497240C07FB4C9933B8ED31CDE6E147F255F54316830D550FD007E81E56` |
| policy.cjs SHA256 | `0FD2289942E9968EEB15F2E945325ECCB812EEE73A0BCFAEBDF5D149DBC96A24` |
| desktop-trust-registration.test.cjs SHA256 | `D3F6FB31A82EAE1F90A8E7BE2C7B9A8FB4CA4366E8938A059A460DC7F84EF495` |

착수 시 기존 수신 client·등록 owner·시험·결과서와 Main 문서가 수정 중이었다. 위 시험에는 r8의 null ARM 반례와 후속 terminal phase 관측 두 건을 추가했다.

## 변경과 보존

- policy는 `Number.isSafeInteger(v.epoch)`를 통과한 우항 `v.epoch<1`에서만 숫자로 좁힌다. 검사 순서·반환값·오류는 그대로다.
- shell의 복사·동등 검사·오류 인자는 `unknown`이고, attemptId와 epoch는 `assertTrustIpc` 성공 뒤의 string과 number다. 초기 수신 상태의 resource/window/offer, view의 armRef/expiresAt에는 null이 포함된다. 고정 shell factory가 반환한 수신 client와 원 Window 준비의 성공 결과를 타입으로 연결했다.
- STREAM은 원 OPEN 성공 후, 관측은 원 resource/window 검사 후에 호출된다. OFFERED 설치 경로의 resource 사용은 같은 owner의 조회로 고정된 offer가 있어야 도달한다. 기존 `receiveGuard`의 매 await 후 문맥 검사는 유지되며, 이를 모든 필드가 준비됐다는 predicate로 바꾸지 않았다. 검산된 원 상태 10개에 대해 선택적인 8개 표시 매핑을 선언했다. `CONFIRMED/UNCONFIRMED`는 여전히 기존 `if(!phase)` 경로에서 거절된다. 원 상태 검산기와 동일한 매핑/거절문 대조 뒤 아래 두 RAM 호출로 각각 확인했다.
- 중간 검사에서 nullable owner를 도입한 뒤 진단이 19건이었다. 그중 ARM 예약의 `owned.window.ref`는 controller 준비가 실패하면 실제로 null일 수 있었다. r8에서만 허용한 실행문은 원 work를 만든 **뒤** 예약 직전에 null이면 `PROTECTION_UNAVAILABLE`로 거절하는 조건 하나다. 기존에도 여기서 TypeError가 외부 catch로 넘어가 같은 코드로 응답했고 requests에 저장되지 않았다. work의 catch/finally 순서와 효과 표식은 보존했다.
- 메모리 역치환 `df6a01`에서 shell 정적 편집과 r8 guard, policy 정적 편집을 제거한 두 제품 바이트가 각각 기존 Git HEAD 및 원 작업 트리와 일치했다. 시험 한 건을 역치환한 작업 트리 SHA256도 앞서 수용된 `CD92B7D2FA4F59E8D652C4BE15C22F7E0ABC7D8CA9E75182ED85063EB04C3F3C`와 일치했다.

## 검증

inner checkout에서 다음 명령을 실행했다.

```powershell
node ../../node_modules/typescript/bin/tsc --noEmit -p apps/desktop/tsconfig.json --pretty false
node --test --test-name-pattern="controller 준비 실패 뒤 ARM|첫 수신 exact5 IPC|실제 settings→preload→shell은 원 HUMAN Window|수신 exact5 실제 handler|먼저 도착한 Delivery는 ARM 유실" tests/desktop/shell-policy.test.cjs tests/desktop/desktop-trust-registration.test.cjs
git diff --check development/main
git diff --no-index --check -- /dev/null docs/04_test_reports/AV3/FN18_SHELL_RECEIVE_DECLARATION_RESULT_20261116.md
```

- TS7 `1e428f`, **4건, exit 1**. 수신 client 14:74, 등록 owner 255:24·363:104·437:4260의 TS2307만 남았다. UTF-8/LF 최종 진단 SHA256은 `D1DD62654B1A60D5AE2572F5E199CDE48A638CA50663AB1DD5E5779DCC767CAB`이다.
- RAM `e304e4`, **5 PASS, 0 FAIL, 0 SKIP**, exit 0. 원 settings→preload→shell 정상 흐름, exact5 IPC와 외부 sender 거절, ARM 유실·인증 ABA 후 UNKNOWN을 확인했다. 추가한 반례는 begin의 controller 준비 실패 뒤 같은 요청 ID에 서로 다른 두 offerRef를 전달했다. 두 ARM 모두 원 보호 오류를 반환했고 resource 관측·helper frame·HTTP 요청 수·공개 수신 상태가 변하지 않았다.
- 최초 시험 지문 `5374C15DE8CDE9EE5EEB7B758998DE04F2B56355AFDA9A7790CC36AB8576FA85`에서 두 terminal phase의 직접 관측이 빠져 있었다. 후속 `node --test --test-name-pattern="수신 refresh는 서버" tests/desktop/desktop-trust-registration.test.cjs`는 `da1b0b`, **2 PASS, 0 FAIL, 0 SKIP**, exit 0이었다. 두 phase 각각 원 Window·ARM·Delivery 뒤 RECEIVING까지 도달했고 해당 phase에 필요한 terminal/ack ref를 제공한 서버 상태에서 명시 refresh가 CONTEXT_CHANGED, 현 상태·outcome 보존, 추가 native 요청 0으로 끝났다. 제품 지문은 동일하다.
- main 대비 tracked 공백 검사 `6e7fd6`, exit 0. 신규 결과서 no-index 검사에는 공백 진단이 없으며 빈 파일 대비 내용 차이가 exit 1로 표시된다.

## 남은 검증과 복구

전체 desktop 타입 게이트에는 생성물 해석 4건이 남았다. 실제 사용자 자료·DB·권한·키·서비스·Electron 앱·설치·SDK·Agent 실행은 검증 범위 밖이다. 이번 단위 복구는 shell·policy의 위 편집, 기존 등록 시험의 이번 반례와 테스트 서버 terminal ref 보완, 이 결과서에 한정한다. 앞선 제품/시험과 Main의 문서 변경은 보존한다. Git과 현황 인계는 Main이 맡는다.
