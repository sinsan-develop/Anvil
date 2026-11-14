# FN08 worker 신뢰 생산자 source 검수 결과 — 2026-11-14

## 판정
승인된 source 구현 단위 수용. 전체 작업계획과 실제 Agent 실행은 미완료다.

## 근거와 변경
직접 승인 계약 SHA256 A769DEC827F78A486CD7C6EC9EBD9D84308572AFD29481F10DDA73F647331250, WI SHA256 D5E4DC86040795DDCE848ADE3367F952004F3530E0DF4FE7CA0AB708D574911A. 기준 HEAD a207b0d80ca78deab060db360ca9bfe2002e553d / codex/av3-d1-producer-binding. Primary 단독 제품 writer가 18경로를 동결·반환했다. Main은 문서·검수·통합만 수행했다.

기존 factory 원객체에서 worker 고정 입력·PE 검산과 descriptor를 생산하고 동일 consume의 run/observer를 파생한다. 서버는 필수 원 reader DI를 통해 기존 반환 store에 연결한다. native는 pending image를 검산 후 양도하고 양도 전 실패를 회수한다. 기존 helper artifact 형상과 미등록 거절은 유지한다.

독립 검수: server, native handoff, 최종 contract/build 각각 C0/I0/M0. 최초 Important 3개(import 경계, 시각 후퇴, image 소유 공백)를 보정했다. 정식 FAILURE_REPORT 0.

## Main 직접 검증
출력 절단으로 이전 Main 실행 결과를 확보하지 못해 그 결과는 판정에서 제외했다. 동결본에 다시 수행한 최소 검증:
- Node 직접·인접 7파일: exit0, dot32개, 실패표시0 (a28b04).
- 기존 signer build/PE: exit0, dot16개, 실패표시0 (e192d4).
- physical factory 지정 7사례: exit0, dot7개, 실패표시0 (b3c05c). 등록 QA 파일 여정은 제외했다.
- root TypeScript noEmit: exit0·진단0 (0275b5).
- git diff --check: exit0 (d708ad).
총 55개 테스트의 합성/정적 검증이며 실제 설치·C# 실행 증거가 아니다. PE 의존성은 기존 pe-library1.0.1을 프로세스 메모리 resolver로 사용했다. 설치·junction 변경은 없다.

직접 7파일 명령: `node --test --test-reporter=dot tests/desktop/native-worker-build.test.cjs tests/unit/FN06/native-worker-provenance-contract.test.ts tests/unit/FN06/native-worker-ownership-basis-source.test.ts tests/unit/FN06/native-preparation-worker-provenance-native.test.ts tests/unit/FN06/native-preparation-ownership-return-store.test.ts tests/unit/FN06/native-preparation-retained-factory.test.ts tests/unit/FN06/native-preparation-ownership-return-native.test.ts`.

PE 명령은 `node --import <기존 native-worker-build.test.cjs의 resolver를 호출하는 data URL> --test --test-reporter=dot tests/desktop/desktop-trust-key-host-build.test.cjs`, physical 명령은 같은 import에 `--test-name-pattern='원 artifact|합성 CLI|basis 변조|source14|metadata|compile 원cwd|CLI/header' tests/unit/FN06/native-physical-factory-build.test.ts`다.

구현자 Desktop 타입 비교는 기준174/현재174/신규0이다. 전체 Desktop PASS로 표시하지 않는다. root 초기3진단, Desktop 신규9→2→0, 시험구성/낡은 호출선 단언 보정 이력은 WORK_STATUS 및 구현자 제출에 보존한다.

## 미완료와 제외
- build token은 SOURCE_ONLY_MODEL, compilerExecuted:false/installationVerified:false다. 실제 배포·설치·회수 근거가 아니다.
- 서버 runtime deployment/current 원 공급자 및 native ProtectedDeployment의 실제 생산자는 미연결이며 기본 거절한다.
- 서버와 native 사이 원 descriptor 전달 매체·설치 root 결박·현재 회수 상태 공급은 후속 구체화 대상이다.
- Windows journal 내구저장 unsupported는 유지한다.
- 실제 설치·사용자 파일 조사·ACL·키·DB/권한·서비스·C# compile/load·프로세스/Agent 실행은 수행하지 않았다.

## 복구
이 단위의 제품9/시험9 변경을 역변경한다. 별도 실제 환경 변경이 없어 DB·서비스 rollback은 없다. 원 계약·사용자 자료·다른 WIP를 보존한다.

## 동결 working bytes SHA256
- `apps/desktop/scripts/native-worker-build.cjs`: `C3069FD925E8D9B1FFE80016A16C91976FB931AFFA5621E550AB7E7A6E7EAA1E`
- `apps/desktop/scripts/verify-native-worker.cjs`: `39FC4386A2C165FAD43BE58094EAD9C78C6C04BDB6FC3AE3E421AB021651CB0B`
- `apps/desktop/scripts/native-physical-factory-build.cjs`: `A1EB1C2FF804CAEA388E1FC04E27ADBED0DB9E7F54FB4CF3B426D5E823AA70DF`
- `contracts/runtime/native-worker-provenance-v1.ts`: `1BB82D07E7B3201FC54901D55E5198A3FE257FB4941D245F2DE324C60926D9E8`
- `apps/server/modules/executions/native-worker-ownership-basis-source.ts`: `8DE4FA268DEC60B56CB188928D7C804C3EFD2CECC691F65148C903FF8863C9E6`
- `apps/connector/native/NativePreparationWorkerProvenanceSource.cs`: `8526B82E76E5B7A145D225334CBE9166A87E0C85E14AA63B90B9B1739C84B5EC`
- `apps/connector/native/NativePreparationRetainedFactorySource.cs`: `D9C7D21752A04E70DF4C07D41F93C3A938ABBFA05D9D85C83C7920FA26356302`
- `apps/connector/native/DesktopTrustKeyHostSource.cs`: `048022E86AC16535C4ADEF3C7907E74DD981739A09CA2323F38C745B17E83094`
- `apps/desktop/scripts/desktop-trust-key-host-build.cjs`: `75F93FEEE614AB32570DC92A7577D60FB97D96F9A208528F4B33B9B7B7F366CE`
- `tests/desktop/native-worker-build.test.cjs`: `5A6BA872C1D64FF3419C227101E6431C1C3CC5F522AE82D5C7686814CA1557A1`
- `tests/unit/FN06/native-worker-provenance-contract.test.ts`: `112844B8FD5BDC63F314BA01CEE3B0850D2834610B63D2BCF005FFBA34300033`
- `tests/unit/FN06/native-worker-ownership-basis-source.test.ts`: `DD502DFAA2E1C5E23E588EDB511FE4B8595E2A027B6861B049153C3582D875AD`
- `tests/unit/FN06/native-preparation-worker-provenance-native.test.ts`: `2B5235E451DA81155CA851FF7787996561F3CB0F8386BDC72D124D5F5F9972A8`
- `tests/unit/FN06/native-preparation-retained-factory.test.ts`: `1B10E053AE497A716A5BDBFECB5D39E59A6AEC23E315AA79790C4CBF3BFA8DA4`
- `tests/unit/FN06/native-preparation-ownership-return-native.test.ts`: `8547EE25D2DA16478C210DC67CCE931D1B0D882CD9DAD393D8565FABB178874A`
- `tests/unit/FN06/native-physical-factory-build.test.ts`: `447218BDD18F3E264CCF1EBB49E1EB35A3E6C43A8C09AB1CB221821DF1D8BAA1`
- `tests/unit/FN06/native-preparation-ownership-return-store.test.ts`: `9AB1228FF1B7466C707FA6CDD9EECAAB24BCAEEC2DA62DE3C057D877957AA8FA`
- `tests/desktop/desktop-trust-key-host-build.test.cjs`: `B572A4F4B0E98816C5F1F39E5F4F7D0BDB48A4FBD9671D0238385F4AD85A10D5`
