# FN08 worker 배포 근거 전달 — source 검수 기록

## 판정
한정 source 검수 완료. 전체 작업계획 및 실제 설치·Agent 실행은 미완료다. 승인된 source·미적용 SQL·합성/정적 범위만 인수하며 Git 통합은 후속 확인한다.

## 기준과 담당
- 채택 후보: `docs/contracts/FN08_WORKER_DEPLOYMENT_HANDOFF_CANDIDATE_20261114.md`, SHA256 `50596FFCAD26EC0FE9F5BC9AB43A5948BE87BF549C2E989E216D297442FD4389`.
- 지시서: `docs/work_packages/FN08_WORKER_DEPLOYMENT_HANDOFF_SOURCE_IMPLEMENTATION_20261114.md`, 현재 내부 접점 보완 포함 37경로.
- 기존 Primary 단일 writer, Main 어울 검수·기록·통합. d2_preflight/d2_scope_audit 읽기 검수.
- 작업 branch `codex/av3-d1-deployment-contract`; 중간 source checkpoint `c1b16ee1`, `e8ab3ccc` private 보존.

## 현재 연결
- 배포 bundle/head 보호 저장·조회 계약과 미적용0095.
- 부모 없는 worker compile 입력 → 고정 package payload → 원 factory 검산 → 게시 source. 실제 compiler는 실행하지 않았다.
- 정본 runtime parser를 사용하는 HTTPS metadata client. 실제 TLS 연결은 검증하지 않았다.
- sibling 설치 root/store 및 고정 parent worker reader·native 소비 source. Windows 내구성 미지원 거절을 유지한다.
- 별도 설치 버튼 → main 소유 OFFERED 재조회 → owner → coordinator → typed host를 합성으로 확인. 실제 앱 설치 성공이 아니다.
- 서버 보호 배포 원천 → 기존 consume/관측 반환 request/results/head까지 제품 함수 종단 합성 2사례를 검증했다. DB·TLS·native 설치 포트는 RAM이다.

## 검수 중 보완한 문제
- 오래된 observedAt 자기검증과 원 요청 1초 누락, 동일 factory id/version의 다른 hash 게시.
- compiler UNKNOWN 소유기록 소실, package late-create handle 소실, close 불명 뒤 재호출.
- root 최초 부재를 독점 생성 사실로 오인, packages/hashdir ancestry 및 예상 밖 잔여 누락.
- native Observe 이후 원 기한 소실.
- 설치 후 UNKNOWN을 INPUT_INVALID로 덮는 화면 경로 및 같은 owner의 새 request 재효과.
각 해당 수정과 최종 연결은 scoped 독립 C0/I0/M0 확인을 받았다. 마지막 회수 시험 표현 M1도 실제 store.revoke의 정규 sequence2 head로 보강해 해소했다.

## Main 실행 증거
- 계약/저장/route 직접 합성 9사례, async reader 변경 집중 4사례 exit0.
- publication 7사례 및 close/late-create 변경 집중 3사례 exit0.
- client/정본 bundle 두 파일 17사례 exit0.
- native 정적 5사례 및 원 기한 변경 집중 1사례 exit0. C# 실행 증거가 아니다.
- settings/coordinator/client 두 파일 13사례, shell policy 6사례 exit0.
- build 묶음 기준 root TypeScript exit0, diff check exit0. 최종 root 타입 검사도 exit0이며, Main Desktop 메모리 비교는 기준 e4d44b29의174개 → 현재169개/신규0이다. Desktop 전체 PASS가 아니다.
위 수치는 중복 범위가 있어 합산한 고유 시험 수가 아니다. 상세 명령·오류 이력은 WORK_STATUS의 해당 일자 기록을 따른다.

## 미검증·제외
실제 DB/DDL/역할·권한, 키, 사용자·백업 파일 조사, 실제 설치/ACL/내구성, 서비스, C# 컴파일/실행, 실제 Agent 실행은 수행하지 않았다. 실제 Windows 설치는 unsupported이며 제품 사용 가능/Agent 실행 완료로 승격하지 않는다. Desktop 기존 타입 진단은 최종 신규 차이 대조와 분리한다.

## 남은 작업
정확 source 변경의 Git 통합·동기화와 다음 미완료 계획 작업. 실제 환경 검증·Windows 내구성 지원·Agent 실행은 여전히 미완료다.

## 복구
실제 환경 변경이 없으므로 런타임 복구 작업은 없다. source 변경은 해당 작업 branch의 검증된 checkpoint로 추적하며, 통합 후 문제가 확인되면 이력 보존 방식의 revert 대상으로 삼는다. 다른 worktree나 사용자 변경을 reset하지 않는다.

## 최종 추가 증거
- Main 정규 회수 여정2 + publication 직접8 = 10사례 exit0(037800), 중복 import 등록0.
- Main fixed closure 집중1사례 exit0(104cec). 이전 위치 assertion 실패1건은 정확26개 및 마지막5개 순서·옛22/23개 누락 거절로 보완했다.
- Main Desktop 비교 exit0(b5d5c6): 174→169, 신규0. 기존169진단은 잔존한다.
- 실파일 QA opt-in `ANVIL_DESKTOP_TRUST_BUILD_QA`는 미설정으로 해당 분기 미등록/EXCLUDED이며 PASS나 SKIP으로 계수하지 않았다.
- 허용37 중 실제 제품/시험 변경36, shell-policy 시험 파일은 무변경이다. Primary 제품쓰기 반환·실행 handle0, Main 문서만 작성한다.

## 최종 허용 파일 지문

| 경로 | SHA256 |
|---|---|
| `contracts/runtime/native-worker-deployment-v1.ts` | `FE9453CBD01E2D44186430E8CC813114B46B7932FC5DF75338A195F25593E0DC` |
| `apps/server/modules/executions/native-worker-deployment-store.ts` | `3F27CD53DF51E9E9189A50478D04DD8F8452FCF7DDE4F6BD6E813024EE068E5E` |
| `apps/server/modules/executions/native-worker-deployment-routes.ts` | `E092F700D95BD89C79D75A88525CB739E358C8C339258CF6A4C164DD0CB4AB37` |
| `db/migrations/0095_native_worker_deployment.sql.pending` | `D00E773103E2FC961DD36E0C6CA6457C626274CF8C45F7EB90EE94D99CAC683F` |
| `apps/server/app.ts` | `51688B154C7C825DE6D82693113CCD11576A34FA1F7910869D7076EF1C0F9BBE` |
| `apps/desktop/scripts/native-worker-build.cjs` | `053B030025A3FB4DFA9D0DBFE91372AB61048D381835CA3DD77421FAE6B53D59` |
| `apps/desktop/scripts/native-worker-compiler.cjs` | `4D672E3B4BB59BCAD538D876A9C644D08B9329D6B7B5DA8FF866B87CA7409806` |
| `apps/desktop/scripts/native-worker-package.cjs` | `4384E147BB368E81F79FD0FAE1C7493690B701499472CFAF26A552EF6BD16A6C` |
| `apps/desktop/scripts/native-worker-deployment-publisher.cjs` | `2323736478D628B2EFE8955BAB032A64A4BBF1C994E7209DFFE6A6E785530C40` |
| `apps/desktop/forge.config.cjs` | `AEB4446A37B981A89ABA30C9E60C0F2BD468D5265077BFC654EE70CE3225C0D2` |
| `apps/desktop/src/native-worker-deployment-client.cjs` | `3241B9F9C7B00871F68C1BEA59C02BB8B49186F5F66666B639EC18E833808303` |
| `apps/desktop/src/native-worker-installation-coordinator.cjs` | `2DE0879CF70FC9BE7A707C82CD3BA8A15C325B1AD0F9707A580DCF699DC840EC` |
| `apps/desktop/src/trust-enrollment-owner.cjs` | `8DC1E8F4691124C71E7BF6BA0B3FB776375608C38A6BB97F4D4F6A45B7684462` |
| `apps/connector/native/NativeWorkerInstallationRootSource.cs` | `8782098D10BF72841259F85F9A555411A4CF39979A0391C5B5DF4E826B563F9A` |
| `apps/connector/native/NativeWorkerInstallationStoreSource.cs` | `C2BD456888709608DC6018DB7E5432CDEF68D7FD9972F8D0C0BE7699C946C5EC` |
| `apps/connector/native/NativeWorkerDeploymentSource.cs` | `648B2CD2970084A26884646868568120185F1D467151F2AA233480D35170F9CC` |
| `apps/connector/native/DesktopTrustKeyHostSource.cs` | `7BFAE2B2CBAD14C12B38483303D0E7AF96D4783A111D0AD6AEC6EF078B1E2191` |
| `apps/server/modules/executions/native-worker-ownership-basis-source.ts` | `38A44FF18049FBE0C9FBFAF0E48685E73CBD5BD50C1BA1F2C075DD5FBC4BBE56` |
| `apps/desktop/scripts/desktop-trust-key-host-build.cjs` | `3FCEA6CAE0544325FA29D09AA3C2419261E5837E013B6397A0E5FEBBE70F6D23` |
| `tests/unit/FN06/native-worker-deployment.test.ts` | `75D1268925AA8286E738C9611BAB23C75FAA36C74B0B93792183C76446AC18AB` |
| `tests/unit/FN06/native-worker-deployment-sql.test.ts` | `F737BE99B24A91EA157C0E6CC25F45E9AF1821DF1EC415C5346E02C2D8B3AE35` |
| `tests/unit/FN06/native-worker-deployment-journey.test.ts` | `CEA4E56DE44A40ED6A46A68C2EC8B3C72DEDB46426C93134982846E48991FC26` |
| `tests/desktop/native-worker-publication.test.cjs` | `CE3B8D10D456D74355925A399D64BB733615B497F98C38A6A333940CC408C3CA` |
| `tests/desktop/native-worker-installation.test.cjs` | `E12F67E47597D3A6180CCAC6AC2E72FC758416880731053332BA0813DFDBA748` |
| `tests/unit/FN06/native-worker-installation-native.test.ts` | `246FAD69396D6F1F666226FAC89EE60A3A599D570803E5D906F28CBB3CFD0C03` |
| `tests/desktop/native-worker-build.test.cjs` | `DA245F8C9D66B130C0707E062A05D96729BAEFF1102905BD98E666EFB2D6C0F6` |
| `tests/desktop/desktop-trust-key-host-build.test.cjs` | `38EADD47085A13F2470CA03E29CFD6EB78E3FF1547BEEBF35D52F2A839299405` |
| `apps/desktop/src/settings.html` | `577CE06BED3B6C89BC75678F8AE6811C5EF42A59E52DA282D2011A423A4152EC` |
| `apps/desktop/src/settings.js` | `1399B9CF0D47CDA3264C627118BE91C83076FF02E016E7335BD95BCFEFBDAB6D` |
| `apps/desktop/src/policy.cjs` | `8DDA4A0233B7FD4EE3E469D0515DB3DED04480091887BB8F19816A3FCC898445` |
| `apps/desktop/src/shell.cjs` | `08B73F2C1DCDED3A25AD6385A3DD3F1FD1442ED9142339B076F00B669C095E2B` |
| `tests/desktop/shell-policy.test.cjs` | `79B5CBF15546BB87180FB8265A791A33BFFA4BA02F49A9138CD988DA5A646C75` |
| `tests/desktop/settings-worker-installation.test.cjs` | `FEDAC94D5AF066FE043E204A1F785E807DAB4F49856F98F4C9BAF41EA44E1BA9` |
| `apps/desktop/scripts/native-proof-runtime-entry.mts` | `31D4A03F26BA58633DA78DB780E56909BF61F0ADEAE2D25229DB1DA4243E50ED` |
| `apps/desktop/scripts/native-proof-runtime-build.cjs` | `38F37F050E616AA25AAC13A36085D168C9AE20FE7282F13D3C37646A08CAB705` |
| `tests/desktop/native-proof-runtime-build.test.cjs` | `2E99D832374A8FFAAE440BD089A1714AE3420E78093B47E6A59E5D5C331BE7F5` |
| `apps/connector/native/DesktopTrustKeyPeerSource.cs` | `E7761D8CABD7B1B2537006E85F96DAE166F83A0B759071262827AF2D4F7887A8` |

지시서 SHA256: `608FF04741370B69D3098333747257D147330CE3D670CB581D94554CA1F56486`.
