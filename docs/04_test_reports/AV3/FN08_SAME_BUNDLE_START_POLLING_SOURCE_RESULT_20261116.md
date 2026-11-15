# FN08 같은 번들 START polling 조립 결과

기준 main19b20dbc, branch codex/av3-normal-same-bundle-polling. WI SHA256 74BFB8C5BDDC40AE6EAE9C70B65BC46E71D8072305D0E99FA784EEC662F4ADF3. 기존 승인 P3/normalpolling·통신쌍의 내부 소비 연결이며 새 root/spool purpose·ALS·host 수명/프레임 정책·권한·서버 API는 없다. Primary 제품3/시험3 구현, Main 검수·통합.

원 CJS pair를 외부 TS coordinator에 넘기면 instanceof가 달라 첫 START를 거절했다. 변경 후 owner는 자기 원 pair와 등록/실행 scope·현재성 guard만 같은 번들 목적 factory에 제공한다. 기존 typed intakeStore·journalStore·current/wire가 있어야 하며 같은 번들의 intake/spool/polling을 구성한다. 조립은 I/O0이고 명시 run에서만 기존 로직을 호출한다. 생성자의 기존 검사를 제거하지 않고 raw controller 대신 run/renew만 가진 동결 facade를 반환한다. 새 root나 CURRENT/wire 공급자를 만들지 않는다. 미등록 SEND/STOP은 기존 거절 상태다.

명시 renew는 polling이 복사한 get/post/expiry를 그 poller의 현재 쌍과 대조한 뒤 owner의 실제 predecessor만 기존 renew에 전달한다. 다른 owner/구 pair·변조/폐기와 유효 ACK 부재는 새 호스트 효과/반복 dispatch를 만들지 않는다. 보호 메서드 accessor는 접근 전에 거절한다.

## 검증

- RED b01a45 exit1/1F: REGISTERED owner의 CJS pair로 첫 non-empty page는 받았으나 외부 TS coordinator가 NORMAL_START_PORTS_REQUIRED로 거절했고 새 명시 조립 메서드도 없었다. 기존 클래스 거절 자체는 변경 후에도 유지한다.
- 핵심 GREEN71c1ab 2P: 조립 GET/저장0, 명시 run의 첫 START에서 RAM permit1/wire1·원관측5건 ACK·cursor1을 확인했다. 빈 page만으로 합격하지 않았다.
- node --experimental-strip-types --test tests/desktop/normal-execution-credential-owner.test.cjs tests/desktop/native-proof-runtime-build.test.cjs — d7eff3, 36P/0F/0SKIP/exit0. accessor 선호출1F는 checkClients 선행으로 해소했다.
- 등록 RAM 인접756ad6: node --experimental-strip-types --test --test-name-pattern="실제 IPC pair는 원 KEY_READY|인증 epoch ABA는" tests/desktop/desktop-trust-registration.test.cjs — 2P/0F/0SKIP/exit0.
- npm run typecheck 1441af→49fae8 exit0. entry strict 타입 fd721d exit0. 정확39sources/17exports/4builtins·2MiB상한·import효과0·메모리 bundle을 확인했고 diffcheck0/live0이다.
- 데스크톱 전체 타입169진단/exit1은 유지한다. 동일 TS7의 HEAD/현재 RAM overlay 비교 d5eaa4는169/169·추가0/소실0/exit0이며 전체 검사를 PASS로 승격하지 않는다.
- Main be66e0의 동일번들 첫 START/ACK 핵심1P/0F/0SKIP/exit0/1065.5007ms. 독립 최종 C0/I0/M0·6지문 일치. 최종 entry 지문 delta는 facade의 run/renew 제한이며, checkClients 선행은 직전 독립 검수에도 포함돼 있었다.

ACK 음성은 전송 뒤 유효 ACK가 없는 RAM 응답이며 실제 서버 COMMIT/유실을 입증하지 않는다. 실제 OS/fs/DB/키/권한/서비스/SDK/Agent·사용자 인수는 미검증이다. 미채택 후보9E98과 그13제품/8시험의 source GO는 열지 않았다. 전체 FN08/계획 미완료, rollback은6경로 한정 역diff다.

## 동결 지문

- trust-enrollment-owner.cjs SHA256 F853911271706EBD34BB2E7493BA536C2868A5B3DF6CCEB42FC1BFF838AFC8C5
- native-proof-runtime-entry.mts SHA256 6BE184A3F48DEAA14ABB319DB5373066379105146D968FB9E96B3106113DBA35
- native-proof-runtime-build.cjs SHA256 8B3C2FC432B8521720AD362F0AF1C2039A03275389923CEE94C905FBB4E5DF10
- normal-execution-credential-owner.test.cjs SHA256 EBFAA6784305F091483F6B83FBA7976C2DB4E14395E2F7B8621B1BD8C8BD0023
- native-proof-runtime-build.test.cjs SHA256 EAFCD22BA37173263B35897C41B540C3DDD27AACFEB134573A3E9D583E92FF78
- desktop-trust-registration.test.cjs SHA256 44C930FD3B0F8F27515E1DEC5070158A9BBF418E05ADD60C14AE28FBDB6254AD
