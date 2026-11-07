# Anvil Windows 개발 Shell

현재 범위는 정확 HTTPS origin을 명시 설정해 같은 서버 WebUI를 여는 개발 클라이언트입니다. 설치 프로그램·서명·업데이트·실행기 회수·checkpoint 안전종료를 제공하지 않습니다.

## 연결과 종료

서버 기본주소에 HTTPS origin만 입력하고 `명시 연결/재연결`을 누릅니다. 경로·query·fragment·사용자명/비밀번호는 입력하지 않습니다. 서버 화면의 기존 Anvil 로그인을 사용하며 Shell에는 토큰이나 LLM 자격증명을 입력하지 않습니다.

원격 팝업·다운로드·브라우저 권한 요청과 다른 origin 탐색은 차단합니다. 이 기능이 필요한 경우 기존 브라우저를 사용합니다. TLS/연결 오류가 나도 인증서를 무시하거나 자동 재전송하지 않습니다.

창의 닫기는 숨김입니다. 트레이의 `Anvil 다시 표시`로 같은 화면과 메모리 입력을 다시 볼 수 있습니다. `클라이언트 종료`는 미저장 입력의 beforeunload 거절을 존중합니다. 종료가 거부되거나 불명확하면 성공으로 처리하지 않습니다. 실제 프로세스가 끝나더라도 서버 작업·Agent 회수·안전 checkpoint 완료의 증거가 아닙니다.

설정에는 schemaVersion과 공개 serverOrigin만 저장합니다. 손상 설정은 자동 덮어쓰기하지 않으며 안전한 일반 파일에 한해 명시 교체 시 원문을 보존합니다. 불안전한 경로·쓰기 결과불명은 자동 복구하지 않습니다.

## 개발 단계

별도 desktop package/lock의 직접 의존성은 Electron45.1.0과 Forge CLI8.0.1입니다. root package/lock은 변경하지 않습니다. npm 설치는 빈 전용 userconfig/globalconfig와 허용 환경으로 `ignore-scripts`를 사용합니다.

1. policy 단위시험과 desktop 전용 strict checkJs를 수행합니다.
2. package/lock·prepare-sdk/verify-sdk의 출처·hash·경로·한도 검수 후 별도 단계 GO를 받습니다.
3. 고정 공식 ZIP을 `prepare-sdk.cjs --download`로 받고 SHA256 일치를 확인합니다. 검수 전에는 실행하지 않습니다.
4. `prepare-sdk.cjs --extract`는 고정 ZIP의 실제 entry hash/bytes와 자원 잔여를 확인해 새 디렉터리에만 추출합니다. `verify-sdk.cjs`는 ZIP·전체 파일집합·manifest·실행파일을 대조합니다.
5. Forge package는 그 검증된 local ZIP만 소비합니다. 실행디렉터리 산출물을 사용자 설치본으로 표시하지 않습니다.

단위시험: `node --test tests/desktop/shell-policy.test.cjs`

별도 타입검사: `node node_modules/typescript/bin/tsc -p apps/desktop/tsconfig.json`

Node 문법검사는 실행파일을 기동하지 않습니다. 실제 Electron 합성 QA는 검증된 SDK와 QA 전용 entry/stdio를 사용하고 CDP·inspector·listener를 열지 않습니다. 메모리 HTTPS는 실제 TLS/서버/계정 검증이 아닙니다. 실제 실행·검증 완료 여부는 Main의 해당 지문 보고로 판단합니다.

## 보존과 미검증

cache·node_modules·out은 한정 개발자원입니다. 실패한 다운로드/추출/물리 종료가 불명하면 자동 삭제·재시도·강제 종료하지 않고 정확 자원과 고정 오류코드를 보존합니다. 사용자 설정·다른 앱 자료·실제 계정·키는 정리 대상이 아닙니다.

현재 실제 DB·키·서비스·Agent, 실제 서버/TLS, installer 설치·OS 등록·서명·업데이트, 실행기/spool/checkpoint 회수는 미검증/미구현입니다. 이번 부분 구현으로 FN18 전체 완료를 주장하지 않습니다.

## 개발용 설치 artifact — 단계 A

별도 `forge.installer-development.config.cjs`와 `make-installer-development.cjs`/`verify-installer-development.cjs`는 개발 산출물 생성·형식/hash 검산을 위한 source입니다. 모든 manifest는 `NOT_RELEASE`, `DO_NOT_INSTALL`, `applicationAllowed:false`를 고정합니다. 생성된 Setup.exe·Update.exe·앱을 실행하거나 설치하는 안내가 아닙니다. 기존 package 명령과 base Forge 설정·Shell identity는 유지합니다.

새 직접 의존성 초안은 `@electron-forge/maker-squirrel` **8.0.1** 하나입니다. 단계 A에서는 `package-lock.json`을 갱신하지 않습니다. 현재 package/lock 불일치는 의도된 준비 상태이며 install/build 가능 판정이 아닙니다. Main이 전용 cache·빈 npm 설정·수명·정리를 등록한 단계 B GO 후에만 lock/ignore-scripts 의존성 준비를 수행합니다. 기존 SDK 다운로드·업그레이드는 하지 않습니다.

현재 native preflight는 `INSTALLER_NATIVE_ISOLATION_NOT_VERIFIED`로 **첫 쓰기/child 전에 닫힙니다**. NuGet/npm/signing 도구가 사용자 설정·credential-provider를 읽지 않는다는 증거는 아직 없습니다. 환경변수 제거만으로 이를 보증하지 않습니다. 단계 B에서 설치한 정확 전이 도구의 소스·argv·config 옵션과 등록된 빈 config/cache 소비를 toolchain receipt로 검수한 뒤 이 한정 gate의 구현을 마쳐야 합니다. 실제 사용자 config·키를 열거나 도구를 실행해 조사하지 않습니다. 메모리 FS/child 시험의 성공은 이 native 선행을 충족하지 않습니다.

후속 실제 생성은 별도 Main 단계 C GO와 정확 source commit/hash, Node24.22.1·Forge CLI/core8.0.1·SDK/lock/toolchain 지문, 새 등록 root·owner.json·15분 이하 UTC 창을 요구합니다. root 아래 고정 `output`/`tmp`가 이미 존재하면 거절합니다. config 선택은 지원되지 않는 CLI `--config`를 쓰지 않고, 고정 Node의 전용 child가 CLI 의존성 그래프에서 검산한 core 공개 `api.make`에 별도 config와 같은 outDir를 명시합니다. stdout/stderr 각각64KiB, artifact 각1GiB, output/tmp 합계4GiB를 관측합니다. 이는 OS hard quota가 아닙니다.

source-only 진입 형식은 `node apps/desktop/scripts/make-installer-development.cjs --make-development <등록root의 installer-development-plan.json>`입니다. 계획 입력은 정확 source18 지문·node/git/core/CLI/tool 지문·SDK/lock·owner/수명을 포함합니다. 요구 입력이나 native 격리 증거가 미충족이면 실행하지 않습니다. 임의 sign/publish/install/update/추가 flag, `--from-package`와 기존 산출물 재사용은 허용하지 않습니다. 기록한 원 manifest SHA256을 별도로 보존한 뒤 `node apps/desktop/scripts/verify-installer-development.cjs --verify <등록root> --manifest-sha256 <고정SHA256>`으로 새 파일집합/PE/ZIP/RELEASES/hash를 대조합니다. 자체 manifest 일치나 형식 검사는 출처·서명 신뢰·실제 설치 성공을 증명하지 않습니다.

실패·timeout·overflow·close 불명은 새 output/tmp와 소유 증거를 보존하고 자동 재시도·삭제·PID kill을 하지 않습니다. 감독기는 소유 child의 exit/stdio close를 분리 관측하며, 제한을 넘겨 불명 반환한 경우에도 child close까지 관측을 유지합니다. 설치 lifecycle, 서명 신뢰, 업데이트·제거·자료 보존·rollback·안전 종료·사용자 인수와 전체 FN18은 미완료입니다.
