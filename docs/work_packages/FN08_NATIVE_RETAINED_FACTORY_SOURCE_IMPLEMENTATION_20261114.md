# FN08 native retained 생성 조립기 source 구현 지시서

## 목적·승인·기준
- Stage C FN08 / D1: 원 native 준비 authority·consume·permit의 같은 host 소유 아래 기존 factory primitive를 조립한다. 기존 `retainedPort`와 원 객체 보유 호출선의 source 연결이 목표다.
- 반환 A안 §3·§6 원 승인 SHA256 CFF94F6704B91556A0DBBD21353F5F2D29A8CA0F4340E3C0413A7841B849EFA4; 현 채택기록 포함 문서 SHA256 E5F650BD401E01D856ABF678AA994D7BB8162D1E241F3F6BFB3AB654ED53DBBF.
- anchor 정정 원 승인 SHA256 6BF3B5F2734F5F365674E9AC895D226B1EC3359336504F7D5A41728A7ECE95CA; 현 채택기록 포함 문서 SHA256 AC0688E995F278D22CDBC660E0337C4D8C129F99ED2920C17DC408A349124A34.
- 기준 main6c4974c453cb667d93c4a8b7559ca4279b36c2d1(PR109), 현재 codex/av3-d1-runtime-followup / 8ddf2a14b0264b6d4ad574cbbbf79aeec892fe07.
- 기존 Primary 단일 code writer. Main 관리·검수·기록. 다른 변경 보존. 새로운 공개 API·서명 목적·DB·권한·지속 저장 계약 없음.

## 정확 허용 경로 6개
```
apps/connector/native/NativePreparationRetainedFactorySource.cs
apps/connector/native/DesktopTrustKeyHostSource.cs
apps/desktop/scripts/desktop-trust-key-host-build.cjs
tests/unit/FN06/native-preparation-retained-factory.test.ts
tests/desktop/desktop-trust-key-host-build.test.cjs
tests/unit/FN06/native-preparation-ownership-return-native.test.ts
```
추가 경로 필요 시 이유를 Main에 전달한다. 기존 primitive의 의미·승인 플래그를 임의로 변경하지 않는다.

## 내부 구현
1. 같은 host ReturnRecord가 검산한 원 context snapshot과 current/budget closure를 사용한다. authority/receipt/consumeRecordRef/permit fullref·hash·부모 관계 및 원 등록을 다시 대조한다. callback 이후 원 context 변조·다른 host·기한 연장을 거절한다.
2. normal selection 중 원 authority scope/subject/parent/policy에서 생산 가능한 필드를 실제 source에서 파생한다. 과거 PREPARATION_GRANTED profile을 만들거나 그 부모로 바꾸지 않는다.
3. root/image mapping, 원 runId/processGeneration/observerRef는 원 factory/consume에 고정된 별도 내부 보호 입력이어야 한다. IPC caller JSON/processRef에서 역으로 만들지 않는다. 실제 mapping 생산자는 미구현임을 명시하고, 기본 미등록은 거절한다. Trust 저장 root를 worker image root로 전용하지 않는다.
4. 원 입력이 모두 확인된 source 경로에서 기존 CreateEmptyJobSource → PrepareAtomicJobAssignmentSource → PrepareSuspendedStartupSource → BindWorkerPlanSource → CreateSuspendedProcessSource를 같은 수명·기한 안에서 조립한다. 신규 endpoint/설정파일/환경변수로 누락 근거를 받지 않는다.
5. 단발 생성 시도·취소·부분실패·원 객체 반환 전 오류의 정리 소유권을 명확히 한다. 반환 성공한 원 retained 객체는 기존 owner가 수명·관측·종료를 소유한다. 원 Image/Job/Startup을 조기 처분하거나 실패 자원을 잃지 않는다. process 생성·resume·grant/current 권위 플래그를 source 후보에서 승격하지 않는다.
6. Windows journal unsupported 경계와 기존 임무/등록/서명 동작을 그대로 유지한다. 이 조립은 정상 Windows 실행 활성화가 아니다.

## 검증·완료 표현
- 기존 null retained 경계 RED를 source/합성에서 확인하고 조립 연결 GREEN을 검산한다. 단순 문자열 존재 검사와 실제 product 함수 동작 시험을 분리한다.
- 부모·등록·image/hash·세대 교차, 부분 생성 실패, 기한/취소, 동일 시도1회, 원 객체 보존/해제 소유를 합성 또는 정적 근거로 명시한다. C# 미실행 상태의 모델 시험을 실제 C# 호출 증거로 표시하지 않는다.
- root typecheck·직접 build/PE 합성·diffcheck. 기존 미해결 Desktop174진단은 기준선과 구분한다. 실제 C# compile/로드·FS/키/DB/권한/서비스/Agent/process 실행은 제외.
- 독립 검수 후 source 연결 범위만 수용한다. 실제 보호 mapping 생산·Windows journal·실process·normal grant/current는 미완료로 남는다.
- 완료된 PR109 시험을 무조건 반복하지 않는다. Host/build의 직접 영향과 새 조립 범위에 필요한 검사만 실행한다.

## 반환
변경 전후·정확 경로·지문·검증 명령/exit·실패/미실행·원 입력 생산/소비 경계를 반환한다. Primary commit/push/병합 금지. Main이 WORK_STATUS/WORK_CHECK와 결과서 기록·통합한다.

## Main 내부 보완 기록
- 직접 인접 ownership-return 정적 시험은 기존 null retainedProvider 문구에 결박돼 있었다. 기본 조립기로 이동한 미설정 거절을 host 기본 입력 null → 조립기 → 보호 source null 거절 전체로 검사하도록 시험 1경로를 추가했다. 기능·권한·공개 계약·합격 기준은 변경하지 않는다. 기존 등록·서명·단발 검사는 유지한다.
