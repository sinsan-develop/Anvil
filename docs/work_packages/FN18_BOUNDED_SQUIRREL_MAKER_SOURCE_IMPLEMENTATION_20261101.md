# FN18 동일 Squirrel 산출물의 bounded Maker 소스 보완

2026-11-01 / Main 어울 / 기존 Primary 단일 writer / source 구현 후 별도 실제 검수.

## 기준·판정
기존 WORK_PLAN FN18 및 FN18_DEVELOPMENT_INSTALLER_ARTIFACT_IMPLEMENTATION_20261101.md SHA51A1FEB26A0B072A35F1F7E3C54E31D5BDA7E8AB09C2587B0162812078E1744B의 같은 기능·산출물·실행 제외를 유지한다. 현재 HEAD45866d5cf85a4c871d92d1007399294d48f1ff45, core8.0.1/Electron45.1.0/maker-squirrel8.0.1/winstaller5.4.4 고정, lock/dependency 변경0이다.

실제 읽기에서 core.make는 MakerBase 인스턴스/clone/prepareConfig/make를 소비한다. 현재 vendor JS는 NuGet pack에 ConfigFile을 주지 않고 자식 출력을 무제한 문자열로 누적한다. 임의 RestoreConfigFile 속성이나 환경 변수만으로 해결됐다고 하지 않는다. 동일 core.make/forgeConfig/outDir·기존 packager/SDK hook을 유지하는 bounded Maker 내부 방법으로 보완한다. 새 공개 API/권한/데이터 계약이나 설치 형식 변경이 아니다. vendor 패치/새 wrapper만의 성공/ZIP 대체·원 gate 삭제는 금지한다.

## 정확 source·시험 범위3
- apps/desktop/scripts/make-installer-development.cjs
- apps/desktop/forge.installer-development.config.cjs
- tests/desktop/installer-development.test.cjs

기존 verify script·package/lock·tsconfig·base Forge config·Shell·SDK·서버/Web·완료된 시험/보호3은 변경하지 않는다. 추가 파일이 꼭 필요하면 쓰기 전에 사유와 경로를 Main에 반환한다. Main은 제품/시험을 쓰지 않는다. import/require 자체로 child/다운로드/파일쓰기0.

## 구현할 실제 소비선
1. 실제 core8 ABI의 MakerBase 인스턴스를 전용 config에 연결해 core.make→검산된 패키지 디렉터리→동일 NuGet pack→Squirrel releasify→동일 Setup/full.nupkg/RELEASES로 이어지는 구현을 작성한다. clone/prepareConfig가 설정·phase identity를 잃지 않는지 검증한다. 기존 packager·SDK 검산·별도 outDir는 보존하고 cli/기본 config fallback0이다.
2. 정확 설치 vendor 파일과 template/메타데이터를 실제 목록으로 확인한다. NuGet pack은 공식 ConfigFile/NonInteractive와 명시 BasePath/OutputDirectory를 사용하며 .nuspec만 입력한다. MSBuild/restore/project build/임의 스크립트·원격 소스·서명/설치/update 분기는 연결하지 않는다. 기존 vendor의 실제 버전 변환·파일 배치·Squirrel 인자 의미를 보존한다. 공식 문서는 설치된 정확 도구의 실제 지원/격리 증거가 아니다.
3. 각 명령은 shell:false/windowsHide·정확 실행파일/argv·소유 cwd/root·새 빈 config/cache/tmp·기존 allowlist 환경을 사용한다. 실제 사용자/기계 NuGet 설정·credential provider·key store·network가 접근되지 않는다고 근거 없이 판정하지 않는다. signing/token/proxy/NODE_OPTIONS를 상속하거나 raw 환경/본문/출력을 보고서에 넣지 않는다. 생성된 Setup/Update/app/updater 실행0.
4. 원 작업의 최초 guard부터 절대 기한·전체 resource 용량을 유지하고 단계별 시간을 새로 연장하지 않는다. JS의 stdout/stderr 수집 자체가 각각64KiB 이내에서 제한돼야 하며 외부 observer 숫자만 제한하는 우회는 없다. 종료/stdio close·timeout/overflow·부분 산출물/COMMIT과 무관한 native 결과 불명·늦은 event를 구분한다. 불명은 보존하고 자동 retry/소거/공유 PID kill0이다. 직접 소유 handle의 회수와 descendant 안전은 구분하며 증거 없는 process tree 회수를 구현했다고 하지 않는다.
5. nativePorts.verifyIsolation의 현재 기본 차단은 실제 도구 설정/하위 프로세스·수명 근거를 Main이 별도로 검수하기 전 해제하지 않는다. 성공 콜백·고정 boolean/파일표식만 주입해 우회하지 않는다. 이번 source의 실제 소비 알고리즘과 남은 native 증명/실행 경계를 정확히 반환한다. 단지 새 추상 port만 추가하고 완료로 보고하지 않는다.

## TDD·검수·실행 경계
먼저 기존 구현이 ConfigFile/내부 수집 상한/실제 Maker 소비를 충족하지 않는 동작 반례를 실제 source/메모리 child로 확인한다. 신규 모듈 부재를 보안 반례로 부풀리지 않는다. 이후 정상 단계/정확 argv·빈 설정·환경/패키지 원형, clone/config, 입력/도구 지문/경로/기한/byte 상한, overflow/timeout/exit와 close 불일치·늦은 event/불명 보존, signing/원격/변경 요청의 실행 전 거절을 focused 검사한다. 기존 무관한 완료검사·전수 hash/npm install 반복0이다.

합성 child·메모리 IO만 실행한다. 기존 desktop strict checkJs/noEmit·직접 인접 shell-policy/diff를 선택한다. 실제 NuGet/Squirrel/7z/컴파일러·OS job/설치·키/권한·DB·서비스·Agent·실제 사용자/백업 자료 조사0. 실제 단계C는 source 독립검토/정확 SHA 게시·toolchain 근거·새 자원 등록·Main GO를 받은 뒤 진행하며 지금 이 WI로 실제 native 도구를 실행하지 않는다.

## 반환·복구
시작 HEAD/status·변경 전후3 hash/diff·정확 명령/exit/실반례→결과·오류횟수/미검증·도구/argv 근거·남은 native gate 조건·pending/QA0를 반환한다. Critical/Important는 동일 Primary 보완 후 Main 독립 검수한다. subagent commit/push0. rollback은 소유 source commit 정상 revert이며 실제 사용자 자료/환경을 reset하지 않는다. 이 source 보완은 설치·FN18/전체 계획 완료가 아니다.