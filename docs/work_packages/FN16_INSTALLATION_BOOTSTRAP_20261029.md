# FN16 보호 설치 catalog bootstrap — 내부 연결 작업

2026-10-29 / 기준70e56a2c3bd0651717cea47220de5f80050894fa / Main 어울

## 범위
직접승인3FAD0CE9·원계약5A6819 §3·POSIX 상세안§7/10의 source-only 연결이다. 실제 catalog/키/DB/서비스/권한/Secret/Agent/native load 실행은 0이다. 새 공개 API·사용자 입력·설정 자동탐색·hot reload를 만들지 않는다. 기본 UNCONFIGURED와 App의 Secret 비활성화는 유지한다.

기존 primary 단일 writer. 허용 경로는 신규 `apps/server/modules/backups/installation-resource-bootstrap.ts`, 신규 `tests/unit/FN16/installation-resource-bootstrap.test.ts`, 기존 `apps/server/modules/backups/installation-resource-catalog-provider.ts`의 snapshot validator 내부 named export와 호출명 정합만이다. provider 행동/기준 변경0, 다른 source/SQL/UI/native 수정0. Main은 문서·검수·Git 소유다.

## 최소 연결
1. 함수는 신뢰된 서버 내부의 고정 catalog/artifact descriptor와 빌드 신원, 필수 installer verifier를 받는다. 실제 설정 파일 생성/배치/승인 채택 기능이 아니다. 두 descriptor는 앞 reader 형식 그대로 CATALOG/ARTIFACT 목적·서로 다른 정확 경로/identity와 hash/size를 고정한다. 입력을 첫 await 전에 복사·동결·닫힌 구조/유한 상한으로 검증한다. 고정 빌드 신원에는 source commit/hash·compiler 식별/flags·artifact SHA256·Linux x64·Node24.22.1·Node-API8·glibc>=2.28/kernel>=4.18의 후보 결박을 둔다. 실제 빌드 출처/설치 보호는 hash 문자열만으로 인증하지 않는다.
2. 기본 reader는 기존 openProtectedInstallationFile의 실제 Node IO 본문이다. CATALOG bytes는 최대1MiB UTF-8/fatal·BOM/NUL 거절, 기존 parseWireJson의 중복키/잘못된Unicode 검사 후 기존 provider snapshot validator를 그대로 재사용한다. 파일 내용은 기존 InstallationCatalogProviderSnapshot의 JSON이며 새 공개 wire를 만들지 않는다. 잘못된 catalog/build/ABI/installer 근거는 dlopen 이전에 거절한다.
3. 필수 installer verifier는 현재 source/artifact/binary 및 loader·부모/서비스UID·다른 정상writer 분리·runtime 라이브러리 보호를 결박하는 신뢰된 내부 port다. 기본 성공 stub/검증 bool/환경변수 true를 제공하지 않는다. 실제 구현된 설치 검증기가 없으므로 이 조합의 합성 PASS를 actual VERIFIED로 보고하지 않는다. load 전과 후속 provider currentness에서 동일 고정 입력/현재 snapshot에 호출하고 void 이외 결과·오류는 거절한다.
4. artifact.withArtifactFile 안에서만 `process.dlopen(moduleObject, heldFdPath, RTLD_NOW)`의 기본 실제 본문을 제공한다. 원 전체 경로 require/dlopen 재open·자동빌드/다운로드/검색0. 정확 export createInstallationResourceNativePort만 허용한다. callback 안에서는 export 확보만 하고 reader의 callback 후검사 성공 뒤 provider를 생성한다. 같은 cap assertCurrent 재진입을 피한다. addon12 함수 검증은 기존 provider 계약을 유지한다.
5. default 실제 loader의 load 시도는 module 수명에서 1회만 수락하고 성공/실패/후검사불명 뒤 자동 재시도·다른 artifact 로드0. dispose는 native module unload라고 주장하지 않는다. 합성시험의 주입 loader는 메모리 관측만 하며 실제 process.dlopen을 부르지 않는다. 별도 실제 활성화 전까지 startup/App/Repository 기본 주입은 바꾸지 않는다.
6. provider 반환 wrapper는 기존 InstallationResourceCatalogPort의 list/prepareSlot/dispose만 제공한다. currentness에서는 catalog/artifact cap과 installer verifier를 대조한다. 보호 cap은 단일 동시 작업이므로 동시 provider 요청의 검증 중첩을 어떻게 처리할지 구현 전에 제시한다(자기 busy를 변조로 오판해 영구 회수하지 않는다; 무한queue0). dispose는 즉시 신규사용 차단→provider/adapter drain→artifact/catalog 단발 회수, 부분 초기화 실패도 얻은 자기 cap만 정리한다. load 실행 이후 실패는503 UNKNOWN·unload/성공으로 보고0. close 불명은 재시도 없이 보존한다.
7. 오류는 새 고정 AuthFailure400/409/412/503만, 원path/errno/cause/loader stack/bytes/원오류누출0. 원 설치파일 변경/삭제0. 실제 OS/loader 동작은 이번 메모리 합성으로 입증하지 않는다.

## 검수
먼저 primary가 정확 내부 함수/빌드 신원 필드·동시성/수명 인터페이스를 제안한다. Main·독립 read-only 검토 뒤 TEST_ONLY→Main RED→같은 writer 최소 제품→독립 검수→Main 신규 집중·기존 provider18·type/diff. reader17/native15는 변경 없으면 반복하지 않는다. 무효 catalog/중복키/ABI/근거/load0, 동일 held callback1, 잘못된 export, 초기 실패회수, loader실패 단발·재시도0, 현재성회수, 동시성/종료/불명오류를 검사한다. 실제 키·DB·서비스·OS FS 생성0.

rollback은 신규 bootstrap 연결 source의 검토된 revert. 전체 FN16·설치 검증·키 실사용·백업/복원 완료를 주장하지 않는다.
## Main 확정 내부 인터페이스
`bootstrapInstallationResourceCatalog({catalogDescriptor,artifactDescriptor,buildIdentity,installerVerifier},{openFile?,load?,runtime?}={}) → Promise<InstallationResourceCatalogPort>`로 고정한다. openFile 기본은 기존 reader, load 기본은 같은 heldFD의 process.dlopen(...,RTLD_NOW), runtime 기본은 Node/process/os 관측이다. getReport는 glibc header값만 소비하고 report/환경정보를 출력·보관하지 않는다. 합성은 이3경계만 대체한다.

buildIdentity의 정확 필드: `{sourceCommit,sourceSha256,compiler:{id,version,flags},artifactSha256,platform:'linux',arch:'x64',node:'24.22.1',napi:8,minimumGlibc:'2.28',minimumKernel:'4.18'}`. commit40자리/hash64자리소문자hex, compiler id1~64·version1~128 UTF-8 bytes·flags1~32/각1~256 UTF-8 bytes, 모두NUL/제어문자거절. artifactSha256은 고정artifact descriptor와같다. 빌드출처인증은이문자열검사로대체하지않는다.

runtimeObservation은 `{platform,arch,node,napi,kernel,glibc,uid,euid,pid}`의 닫힌 관측이며 linux/x64/Node24.22.1/NAPI>=8·kernel>=4.18/glibc>=2.28·비root uid=euid를대조한다. 커널/glibc 버전문자열은최대128bytes·정규숫자부분으로비교하고불명은거절한다. runtime의설치보호/출처는 installerVerifier 책임이며실제검증기미제공을숨기지않는다.

필수 `installerVerifier.assertCurrent({catalogDescriptor,artifactDescriptor,buildIdentity,runtimeObservation,snapshot}):Promise<void>`는 검증·복사·동결한 입력만 받으며 default성공구현0/void외결과거절이다. 반환 wrapper는list/prepareSlot 합쳐 active1·중첩409(noqueue)·disposed신규거절, catalog→artifact→installer검증순차·accepted작업drain→provider/adapter→artifact/catalog단발회수다. reader자기busy를침해로오인하지않는다. load후미확정은503이며 자동재로드/언로드주장0.