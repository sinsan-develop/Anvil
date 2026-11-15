# FN08 같은 번들 START polling 명시 조립

기준 main19b20dbcc7f1a3c92fcb12bb60394a9f5ba98f86, branch codex/av3-normal-same-bundle-polling. 기존 P3 D1§3.1·FN08_NORMAL_SEND_POLLING_SOURCE_20261115 §3·통신쌍 WI의 내부 소비 연결이다. Primary 단독 제품 writer, Main 기록·검수·통합, 독립 검수 읽기 전용.

현재 owner는 CJS 번들의 보호 GET/POST 쌍을 발급하지만 별도 TS NormalStartCoordinator는 자기 모듈의 post/intake/spool instanceof를 요구한다. 빈 page는 생성자에 도달하지 않아 문제를 숨긴다. 실제 첫 START가 같은 번들의 기존 클래스를 사용하도록 조립한다.

## 제품3/시험3 경로

- apps/desktop/src/trust-enrollment-owner.cjs
- apps/desktop/scripts/native-proof-runtime-entry.mts
- apps/desktop/scripts/native-proof-runtime-build.cjs
- tests/desktop/normal-execution-credential-owner.test.cjs
- tests/desktop/native-proof-runtime-build.test.cjs
- tests/desktop/desktop-trust-registration.test.cjs

타인 편집을 되돌리지 않는다. TS polling/coordinator/store·C#·credential 계약은 수정하지 않는다. 신규 root/spool profile·ALS·host frame/수명 정책·권한/서버 API·자동 start/renew·CURRENT/wire/interrupt 생산을 추가하지 않는다. 후보9E98의 채택과 분리된 기존 내부 조립이며 실제 파일/DB/권한/키/서비스/SDK/Agent/P03 실행은 없다.

## 동작

1. owner가 자기 원 pair와 원 등록 fullref·grant·scope/세대·기한·현재성 guard를 제공한다. 같은 번들 목적 factory가 기존 typed intakeStore와 journalStore·current/wire를 받아 자기 intake/spool/polling을 생성한다. 원 port/키/signer나 범용 파일 포트를 새 export하지 않는다. 조립 자체는 GET/POST/wire/파일 I/O0이며 명시 run에서만 기존 로직을 호출한다.
2. 필수 store/current/wire 부재·다른 scope/등록·다른 owner/구 pair·변경된 전송·폐기/만료는 거절한다. caller의 transport 문자열만으로 정상 공급자를 새로 만드는 fallback을 추가하지 않는다. 기존 명시 포트와 guard를 그대로 소비한다. 실제 배정된 root 생산자가 없는 점도 해결했다고 주장하지 않는다.
3. 처음에는 START 조립만 지원하고 등록하지 않은 SEND/STOP은 기존 거절 의미를 유지할 수 있다. 지원한다고 표시할 경우 해당 구성요소도 같은 번들 브랜드와 원 검사를 만족해야 하며 새 driver를 만들지 않는다.
4. 명시 renew를 연결하면 polling이 복사한 이전 get/post/expiry가 그 poller의 현재 owner 원 pair와 일치해야 한다. 검산 뒤 owner의 실제 원 predecessor만 기존 renew에 전달한다. 다른 poller/owner·복제 임의 값은 재사용하지 않으며 자동 갱신하지 않는다. dispose/invalidate·늦은 응답은 원 guard로 차단한다.
5. SOURCES는 실제 기존 모듈 의존만 개별 등재하고 exact seen/EXPORTS·2MiB 출력·입력 전후검산을 유지한다. 기존 spool이 선언한 node:util/types만 정확 builtin 외부목록에 추가한다. fs/path/async_hooks 허용은 이번 범위에 없다. 등록 RAM loader의 정확 목록도 맞추고 import 효과0을 검산한다.

## 검증·인계

RED는 REGISTERED owner의 실제 CJS pair와 외부 TS intake/spool/coordinator에서 첫 START 클래스 거절을 확인한다. GREEN은 같은 실제 메모리 번들의 명시 조립 GET0 → 유효 non-empty START → 원 typed RAM 저장/permit1/wire1 → 원 관측 ACK coverage 이후 cursor 전진이다. 빈 page만으로 PASS하지 않는다. 클래스/기존권한검사 제거0, 선택누락/문맥변경/다른owner·poller/명시renew·dispose/만료·ACK유실/UNKNOWN·원cursor보존을 직접 영향 범위로 확인한다. 최대 frame·네트워크/실OS 내구성 합격은 주장하지 않는다.

직접/인접 CJS/RAM·루트/entry 타입·메모리 번들·diff와6지문·명령/exit/개수·실행 종단을 제출한다. 기존 데스크톱 전체169진단은 변화 여부만 별도 구분하고 PASS로 만들기 위해 기준/타입설정을 바꾸지 않는다. 실제 SDK/파일/DB/사용자 인수는 미검증이며 전체 FN08 완료가 아니다. rollback은6경로 한정 역diff다.
