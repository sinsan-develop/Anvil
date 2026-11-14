# FN08 worker 배포 전달 source 구현 WI

## 근거·담당
- Stage C/FN08, WORK_PLAN 등록부·worker 전달 후보 SHA50596FFCAD26EC0FE9F5BC9AB43A5948BE87BF549C2E989E216D297442FD4389 및 직접 채택 기록 FN08_WORKER_DEPLOYMENT_HANDOFF_A_ADOPTION_20261114.md.
- 기준 e4d44b29, codex/av3-d1-deployment-contract. 기존 Primary 단일 제품writer, Main은 문서/검수/통합. Main 문서WIP를 보존한다. 다른 참여자가 있으므로 타인 변경을 되돌리지 않는다.
- 실제DB·권한·키·사용자/백업 파일조사·설치·서비스·C# compile/load·OS/Agent 실행0. 제품/시험 source 읽기와 RAM 합성만 실행한다. 컴파일·복사·SQL 등 기능 코드를 작성하되 실제 실행은 하지 않는다. 기존 파일QA/forge 실제 build를 자동 실행하지 않는다.
- 이전 A769 구현·실제 미검증 및 journal unsupported를 보존한다. SOURCE_ONLY_MODEL을 실배포 원천으로 승격하지 않는다. 새 의존성 설치/공개계약/권한 확장0.

## 허용 제품23·시험10 경로
```
contracts/runtime/native-worker-deployment-v1.ts
apps/server/modules/executions/native-worker-deployment-store.ts
apps/server/modules/executions/native-worker-deployment-routes.ts
db/migrations/0095_native_worker_deployment.sql.pending
apps/server/app.ts
apps/desktop/scripts/native-worker-build.cjs
apps/desktop/scripts/native-worker-compiler.cjs
apps/desktop/scripts/native-worker-package.cjs
apps/desktop/scripts/native-worker-deployment-publisher.cjs
apps/desktop/forge.config.cjs
apps/desktop/src/native-worker-deployment-client.cjs
apps/desktop/src/native-worker-installation-coordinator.cjs
apps/desktop/src/trust-enrollment-owner.cjs
apps/connector/native/NativeWorkerInstallationRootSource.cs
apps/connector/native/NativeWorkerInstallationStoreSource.cs
apps/connector/native/NativeWorkerDeploymentSource.cs
apps/connector/native/DesktopTrustKeyHostSource.cs
apps/server/modules/executions/native-worker-ownership-basis-source.ts
apps/desktop/scripts/desktop-trust-key-host-build.cjs
tests/unit/FN06/native-worker-deployment.test.ts
tests/unit/FN06/native-worker-deployment-sql.test.ts
tests/unit/FN06/native-worker-deployment-journey.test.ts
tests/desktop/native-worker-publication.test.cjs
tests/desktop/native-worker-installation.test.cjs
tests/unit/FN06/native-worker-installation-native.test.ts
tests/desktop/native-worker-build.test.cjs
tests/desktop/desktop-trust-key-host-build.test.cjs
apps/desktop/src/settings.html
apps/desktop/src/settings.js
apps/desktop/src/policy.cjs
apps/desktop/src/shell.cjs
tests/desktop/shell-policy.test.cjs
tests/desktop/settings-worker-installation.test.cjs
```
추가 경로는 이유/직접 영향 제출 후 Main이 의미불변 여부를 판단한다. 원 계약 의미 변경은 임의 수행하지 않는다. Primary Git mutation/문서쓰기0.

## 순서와 인수 조건
1. 계약/저장/읽기: exact3 bundle·고유 headId·ACTIVE1/REVOKED2·CAS/동일요청·회수1행 사전예약·상한. app읽기/publisher함수/owner RLS와 fixed search_path/PUBLIC거절을 SQL 원문·합성거래로 검산. 새 GET exact입력/정보projection·미등록503·기존app기능 보존. 일반JSON/modeltoken의 게시 거절을 먼저 RED로 만든다.
2. compile/package/publisher: 부모없는 고정worker compile 입력/원결과→package worker payload고정→원factory/parent→같은bytes검산/descriptor→목적publisher 순서. 실제 명령 실행과 RAM port를 명확히 분리한다. source/model 원객체가 production 게시 원천이 되지 않게 한다. compile/source/tool/RootPath 공개0. 원 package/ASAR 수정순환0.
3. 설치/native: 별도 KnownFolder Anvil/NativeWorkers/v1, SID/SYSTEM/nonlink/identity·rootId결박·64package/1GiB/20MiB·8MiB512revision·next/previous/UNKNOWN/lock/예약 산입. 원 TLSbundle+실bytes전제→단발예약→설치→readback/CAS, 불명 보존/실행거절. 제거미지원·기록손실 신규설치0. Windows 실제보장 미지원은 unsupported, RAM을 지원으로 승격0.
4. 소비조립: 고정 origin/systemchain/TLS1.2/no credential/nonce/no-store/1초·부모/fullref/head검산→설치coordinator/원ProtectedDeployment→기존retained/서버basis→기존returnstore의 실제제품함수를 RAM여정으로 연결. 함수교체/시각후퇴/취소/늦은응답/회수0반례. UI 동작을 새로 상상하지 말고 기존 명시 local action 내부 연결과 승인계약을 따른다.

각 묶음은 TDD RED→GREEN 뒤 정확파일hash·명령/exit·실제테스트수·실행handle상태와 함께 잠정동결을 Main에 보고한다. 같은 파일에 reviewer 쓰기0. 단일writer가 후속 비충돌묶음을 진행하는 동안 앞부분 읽기검수 가능. 핵심 source 종단 연결까지 끝낸 후 최종동결.

## 최종 검수
- 직접/인접 합성·정적 검사, roottsc, Desktop 기존174와 신규차이 분리, diffcheck. 불변한 과거 전체시험 반복0. SKIP/미실행 PASS승격0.
- 부정사례만으로 완료하지 말고 원publisher→저장→GET→설치RAM→원소비 정상경로와 회수/UNKNOWN을 검산한다. 원 SQL 실행은 미검증으로 남긴다.
- 실제 OS 내구성·원 compile/실배포 생산·Agent 동작 미완료를 구체적으로 기록할 수 있는 결과를 반환한다. source지원과 실환경지원 분리.
- 최종 정확33hash·diff·시험·오류이력·미검증·rollback 제출 후 write 반환. 같은 근본 정식 실패3회 규칙은 유지한다.

## Main 명시 설치 호출선 보완
채택 계약 §5/§6의 명시 설치는 기존 설정에 action이 없어 6경로를 추가한다. settings의 별도 worker 설치 버튼→기존 trustAct bridge의 INSTALL_WORKER→policy/shell 검산→owner/coordinator다. preload 형식은 재사용한다. 기존 CHECK_CURRENT/ISSUE/ARM/조회/시작 행동에 설치를 넣지 않는다.

대상은 같은 원 등록 attempt/epoch의 main 소유 OFFERED offer다. shell의 owned.offer를 readReceiveOffer로 다시 검산하고 원 command의 payload.nativeFactoryRef fullref를 추출한다. renderer가 factory/URL/root/경로/hash를 전달하지 않는다. offer/current가 없거나 바뀌면 설치하지 않는다. ARM 전 명시설치이며 ARM 실행 허가를 만들지 않는다. 원offer·부모·현재성·기한·중복request/내용을 끝까지 결박한다. 표시에는 준비/불가/불명/설치기록 상태만 제공하고 비밀/원command본문을 노출하지 않는다. 새 권한·계약 확장 없이 채택된 설치source의 사용자 진입을 연결하는 내부 보완이다.

settings 버튼은 합성 DOM/IPC로 직접검산하며 실제Electron/OS/네트워크/설치실행0. 버튼외조회와거절시coordinator호출0, 다른창/iframe/epoch·offer교체·중복/늦은완료도검산한다. 실제상태공급자미등록인 경우 가짜설치성공을보여주지않는다.

## Main 정본 검산기 재사용 보완
Desktop client가 CJS에서 정본 bundle/head/wire 검산을 복제하지 않도록 추가 3경로를 허용한다: `apps/desktop/scripts/native-proof-runtime-entry.mts`, `apps/desktop/scripts/native-proof-runtime-build.cjs`, `tests/desktop/native-proof-runtime-build.test.cjs`. 기존 native-proof-runtime의 readWorkerDeploymentRead/readWorkerDeploymentBundle 및 parseWireJson 명시 export·고정 closure·합성 loader 검증만 보완한다. 기존 33경로에 더해 총36경로이며 새 공개응답·권한 의미는 없다. 실제 설치/외부 SDK/사용자 파일자료 조사/서비스 실행 제외는 불변이다.
