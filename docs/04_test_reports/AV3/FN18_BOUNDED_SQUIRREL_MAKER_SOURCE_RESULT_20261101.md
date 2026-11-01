# FN18 동일 Squirrel bounded Maker 소스 보완 결과

2026-11-01 / Main 어울 관리·검수·통합 / 기존 Primary 구현·기존 Reviewer 독립 읽기.

## 판정·범위
기존 설치 산출물의 실제 Maker/phase 소비 소스를 보완했다. Main 소유21+직접 인접 shell5=26PASS, desktop strict/diff0, 독립 최종 C0/I0다. 이는 source·합성 child/메모리 IO 검수이며 실제 설치 산출물을 생성했다는 보고가 아니다. 실제 NuGet/Squirrel/7z·kernel/설정/하위 프로세스 격리·전체 core packaging·PE/nupkg·설치/제거/업데이트·FN18/전체 계획은 미검증·미완료다. 기본 INSTALLER_NATIVE_ISOLATION_NOT_VERIFIED 차단을 유지했다.

기준 HEAD170bbf61b302f00f28deb2c87bc7c9e0e54ff8e3, branch codex/av3-stage-b. WI docs/work_packages/FN18_BOUNDED_SQUIRREL_MAKER_SOURCE_IMPLEMENTATION_20261101.md SHA8EBE558518305FABC44A79504C88F80CC22A71859CF794F1CF703DE2291023FF, 독립 preflight C0/I0. 기존 원WI51A1FEB2의 기능·의존성·실행 제외는 유지하며 공개/권한/데이터·설치 형식 변경0이다.

## 실제 변경과 이유
기존 core.make→maker-squirrel→winstaller 경로는 NuGet ConfigFile을 전달하지 않고 vendor JS 내부 child 출력을 무제한 문자열로 누적했다. 임의 옵션/빈 성공으로 바꾸지 않고, 같은 core8 MakerBase clone/prepareConfig/make에서 실제 패키지 복사/원형 대조→고정 nuspec metadata→명시 ConfigFile의 NuGet pack→Squirrel releasify→기존 Setup 이름/목록 검산으로 연결했다. 기존 packager/outDir/offline Electron archive·SDK hook, noMsi·publishers 없음, NOT_RELEASE/DO_NOT_INSTALL/applicationAllowedfalse는 보존한다. vendor patch/새 dependency/ZIP 대체·생성 Setup/Update/app 실행0이다.

정확3 최종 raw SHA256:
| 경로 | SHA256 |
|---|---|
| apps/desktop/scripts/make-installer-development.cjs | EA28FBD614FDC794BDB346929ED3E5AD30C29CEF67B3724C423667EA2BBBE2E2 |
| apps/desktop/forge.installer-development.config.cjs | AC938E268968F5A34E83DC96AE45F823632125D0F53342EDD560FE6A040193BC |
| tests/desktop/installer-development.test.cjs | 263F346349315AA5CFD0E224F97FD226E9C192B670EF34AEF904333F64D52126 |

각 phase는 정확 executable/argv·소유 root/cwd·명시 config/cache·allowlist 환경과 원 수명/용량을 소비한다. 내부 stdout/stderr도 각각64KiB 상한이며 외부 숫자만 제한하지 않는다. byte-identical vendor의 소유 cache 복사 알고리즘은 메모리 IO로 검수했고 실제 복사는 하지 않았다. 실제 설치된 도구의 명령 지원/설정 접근을 검증했다고 하지 않는다. [NuGet pack 공식 옵션](https://learn.microsoft.com/en-us/nuget/reference/cli-reference/cli-ref-pack)과 [명시 config의 설정 적용 규칙](https://learn.microsoft.com/en-us/nuget/consume-packages/configuring-nuget-behavior)은 소스 인자의 근거이며 실제 native 격리 증거가 아니다.

## 반례·보완·검증
- 시작2c96d7 및 Main9178cc: 새 bounded MakerBase 소비 경로가 없는 반례1. Main0PASS/1FAIL/native1·106.5445ms. 기존 문자열 descriptor는 일반 Forge에서 유효하므로 기존 ABI 자체의 결함이라고 하지 않는다. 뒤 clone/phase·설정 보안 사례는 이 실행에서 미도달이다. 수행자는 후속 hash 명령의 wrapper0/개별 native exit 미캡처를 별도 기록했다.
- I1: 작성 중 inner overflow/timeout/exit-close 불명→CLI 일반 exit1→outer FAILED 축약. Main67c8f0 호출선 대조, 수행자 abeb25 종단 FAILED≠UNKNOWN 실반례→plan별 불명 latch·고정 exit75·outer UNKNOWN/preserved로 보완했다. core 오류 재포장도 같은 latch를 소비한다. 알려진 native nonzero는 FAILED로 구분하며 다음 phase·자동 retry는 하지 않는다.
- I2: HEAD에도 있던 wall-only 수명 접점. 정상 wall에서는 expiresAt이 preflight 시간을 포함하므로 단순 start 위치의 버그로 분류하지 않는다. 수행자 acb72b 원 current 문장 복원 반례는 Missing expected rejection/native1, 이후 최초 guard OS monotonic 최소 예산을 preflight await 전 고정하고 내부 stdin까지 같은 deadline을 전달했다. 진입60초 잔여→preflight120초+wall 후퇴 시 첫 mkdir/spawn0을 확인했다.

Main500088 정확 명령:
```
node --test tests/desktop/installer-development.test.cjs tests/desktop/shell-policy.test.cjs
node node_modules/typescript/bin/tsc --noEmit -p apps/desktop/tsconfig.json
git diff --check
```
26PASS/FAIL0/SKIP0/CANCEL0/TODO0·232.4659ms·각 exit0, 수행자870bdc의26PASS/252.3206ms와 구분한다. 공식 template/동일 vendor bytes·환경/인자·phase 시간/출력·늦은 error·불명/known 실패·경로/도구/SDK 변조·단계 전 거절을 검수했다. 독립 최종 exact3 시작/끝 지문일치·C0/I0이며 I1/I2 해소다. 기존 무관한 전체 회귀·npm/lock 설치·의존성 전수 hash는 반복하지 않았다.

## 운영 오류·미검증·복구
처음 generic 진행 final만 받은 응답은 INCOMPLETE로 분류해 동일 Primary를 재개했고 정식 FAILURE_REPORT/동일 실패3회로 세지 않았다. vendor BOM의 출력 인코딩 준비오류1은 원본을 변환하지 않고 출력만 교정했다. sandbox Git/work-tree/profile 조회 오류는 실제 Git 손상과 구분해 Main이 login:false/elevated 읽기로 확인했으며 ACL/Git 설정을 바꾸지 않았다. 초기 strict7진단의 개별 native exit는 이 보고에서 재구성하지 않고 최종 Main strict0과 구분한다. Git LF→CRLF 주의는 관측만 했고 설정/전체 정규화 변경0이다.

실 QA 경로/child/native/npm/OS job·DB/권한/키·서비스·Agent·사용자/백업 자료 조사0, live handle0. source 외의 기존 산출물/사용자 탭/SDK·package/lock·base Forge·보호3은 보존한다. source 검수로 실제 isolation gate를 열거나 설치·사용자 인수를 PASS로 표시하지 않는다. 다음 actual 단계는 정확 source/private SHA와 설치 도구·명령/하위 프로세스 근거를 대조하고 새 소유 자원·수명·정리를 등록한 뒤 Main GO로만 진행한다. 근거가 불충분하면 차단·미검증을 유지한다. rollback은 소유 source commit 정상 revert이며 실제 사용자 환경/자료를 reset하지 않는다.