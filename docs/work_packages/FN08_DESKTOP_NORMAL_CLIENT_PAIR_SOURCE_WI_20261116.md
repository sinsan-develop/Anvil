# 데스크톱 owner 보호 credential과 정상 GET/POST 쌍 연결

기준 main094ff18e7c8f64256b99f4cf63ae20d81bfbd00a, branch codex/av3-normal-owner-client-pair. WORK_PLAN FN06/FN08 및 P3 실행기 §3.1의 기존 동일 grant credential 교환·갱신과 보호 통신을 잇는 내부 조립이다. Primary 단독 제품 writer, Main 기록·검수·통합, 독립 검수 읽기 전용이다.

## 누락과 구현 범위

현재 REGISTERED owner는 같은 번들의 NormalCredentialBootstrapClient를 반환하지만 그 발급 port를 polling이 요구하는 GET/POST 쌍으로 조립하는 제품 호출자가 없다. port는 class identity를 확인하므로 다른 번들에서 소비자를 생성하면 정상 발급도 거절된다. 같은 번들 안에서 명시적으로 조립하고 caller 선언 credential/signer를 사용하지 않는다.

- 기존 createNormalCredentialBootstrap 동작은 보존한다. owner 내부의 새 명시 조립 진입점은 원 등록·context·epoch·HUMAN 현재성·host factory를 기존 방식으로 검산하고 자신의 bootstrap/renew가 발급한 port만 내부 보유한다. 원 port나 signer를 새로 export하지 않는다.
- 같은 런타임 번들 factory1개가 기존 보호 GET/POST를 생성한다. origin·CA hash·전체 grant ref/실행 scope/세대·slot/정확 기한의 일치를 대조한다. 동일 owner의 실제 predecessor 쌍만 명시 갱신에 사용하고 복제·다른 owner/CA/grant/세대는 거절한다.
- 갱신 성공 뒤 이전 쌍, 명시 dispose/invalidate 뒤 현재 쌍과 이미 준비한 packet이 추가 host frame을 보내지 못하도록 내부 가드를 연결한다. 기존 port에 없는 OS/키 삭제·실권한 회수를 주장하지 않는다. 이미 발송된 결과 불명 요청을 성공/취소로 바꾸지 않는다.
- build의 SOURCES/EXPORTS는 정확히 필요한 의존 파일과 factory1개만 개별 등록한다. 기존 validateOutput/seen 전체 대조·외부3목록·상한·전후 source 검산을 유지한다. type-only pg/http를 runtime 의존이나 효과로 편입하지 않는다.
- 외부 IPC/handler/공개 API/DTO/권한·원장·SDK 호출·CURRENT 생산자·자동 polling을 추가하지 않는다. 실제 파일 실자료 조사/DB/권한/키/서비스/설치/C#/SDK/Agent/P03 실행은 제외한다. 메모리 source 빌드와 RAM 포트만 검증한다.

## 허용 5경로

1. apps/desktop/src/trust-enrollment-owner.cjs
2. apps/desktop/scripts/native-proof-runtime-entry.mts
3. apps/desktop/scripts/native-proof-runtime-build.cjs
4. tests/desktop/native-proof-runtime-build.test.cjs
5. tests/desktop/normal-execution-credential-owner.test.cjs

타인 편집을 되돌리지 않는다. 목록 밖 제품 변경이나 기존 계약으로 설명되지 않는 중요 경계를 발견하면 Main에 정확한 delta를 전달하고 해당 부분만 분리한다.

## 검증과 제출

현재 owner→쌍 제품 조립 부재를 RED로 확인한다. 실제 메모리 CJS 빌드의 정확 closure/export·import 효과0을 검사한다. 실제 등록 owner fixture→최초 발급→같은 번들 GET page/POST observations의 typed prepare/send→명시 갱신을 RAM에서 연결한다. 다른 grant hash/CA/scope/기한·구세대/복제 predecessor·dispose 후 준비 packet 거절과 추가 host frame0을 확인한다. 호출자 credential 우회와 port/signer 새 export가 없어야 한다. 기존 owner 등록/갱신의 직접 영향 검사를 선택하고 타입·diff를 확인한다. 실제 network/host/키/SDK/Agent는 실행하지 않는다.

명령·exit·정확 개수·RED/GREEN·변경 전후 diff·최종5지문·실행 세션 종단·미검증을 Main에 반환한다. 실제 설치·키·네트워크·Agent 연결 검증이나 전체 FN06/FN08 완료가 아니다. rollback은5경로 한정 diff 역적용이다.
