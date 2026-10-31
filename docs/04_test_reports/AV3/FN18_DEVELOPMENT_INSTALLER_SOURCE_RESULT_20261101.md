# FN18 개발용 설치 산출물 — source·의존성 준비 부분 검수

## 판정
부분 구현. 실제 산출물 생성은 NOT_EXECUTED이며 전체 FN18·작업계획 완료가 아니다. 실제 native 격리가 입증되지 않아 `INSTALLER_NATIVE_ISOLATION_NOT_VERIFIED`로 첫 쓰기·child 전에 차단한다. 배포·설치 후보로 사용할 수 없다.

## 기준·변경
- 업무: WORK_PLAN FN18 / WI `docs/work_packages/FN18_DEVELOPMENT_INSTALLER_ARTIFACT_IMPLEMENTATION_20261101.md` SHA256 `51A1FEB26A0B072A35F1F7E3C54E31D5BDA7E8AB09C2587B0162812078E1744B`.
- 시작 기준: `codex/av3-stage-b`, `ade3cbbeeb5977bc8d7f6f4da610aaae885241b3`. 기존 보호 untracked 3개 보존. Main은 관리·검수·통합, 기존 Primary 단일 writer, 기존 Reviewer 읽기 전용.
- 제품/시험 8개: desktop package·lock·tsconfig·README, 새 전용 Forge config, 생성/검산 script 2개, 신규 desktop 시험. 기존 base Forge·Shell·SDK는 보존한다.
- 기본 config fallback 없이 검증된 Forge core8.0.1 공개 API에 `forgeConfig`·`outDir`를 명시한다. CLI가 지원하지 않는 config 인자를 사용하지 않는다.
- manifest는 항상 `NOT_RELEASE / DO_NOT_INSTALL / applicationAllowed:false`. 실패·결과 불명은 보존하며 임의 적용·성공 승격을 거절한다.

## 검증 근거
1. Main `7b2ea6`: 고정 Node24.22.1의 신규12+인접 shell-policy5 = **17PASS**, 실패·skip·cancel·todo 0, 186.2467ms. desktop strict checkJs/noEmit·diff exit0. 실제 생성/검산 함수와 명시 메모리 FS/child 시험이다. 독립 단계A C0/I0/M0·동결8지문 일치. ZIP 형식/CRC/RELEASES 대응은 nupkg 내부 앱과 패키지 디렉터리 파일별 동일성·실설치 증거가 아니다.
2. lock-only npm exit0/7305.6723ms·stdio close·unknownfalse. 상위 supervisor는 desktop dependency 지문 guard **exit1**로 별도 실패했다. lock-only가 hidden metadata를 갱신했으며 그 파일만 변경됐다는 증거는 부족하다. 전후 전수 해시 26,808파일/2,150,886,226바이트와 준비시간 미캡처·child 이후 타이머 설정은 과한 준비 범위/감독 오류로 기록했다. 이 반복은 진도에 포함하지 않는다.
3. Main `0244c0/29bcd5` 및 독립 lock C0/I0: lock 72,393바이트 SHA256 `F35B3C327DF80F0EF77FEBB3549AA6EEB72CE80E0409BEE9FC2A2A8BD0963B9B`; 기존129 항목 변경/삭제0, maker closure32 추가만 확인. 공식 registry 이외 URL·integrity 누락0. maker8.0.1의 사전 공식 integrity와 일치. electron-winstaller는5.4.4로 고정됐다.
4. B2 `4f1fdd`: 고정 Node/npm11.19.1, 상속없는 환경·등록 빈 npm 설정·공식 registry, `install --ignore-scripts --save=false` 1회. 전체 첫 가드부터5275.4674ms·exit0·stdioClosedtrue·unknownfalse/livehandle0. 신규32 metadata/버전 일치, package/lock/hidden hash 불변. npm ci/기존 모듈 일괄 삭제·설치 script/native 실행0. stderr881바이트는 원문 미보존/경고 종류 NOT_CAPTURED이며 원문 재구성을 하지 않았다.
5. 사전등록 전용 npm cache/config/tmp 자원은 Main 소유·link·수명·범위를 확인한 뒤 17:43:28.4455159Z에 회수했고 별도 `0f7e11`에서 부재 확인. 제품 의존성은 개발용으로 보존한다. 실제 사용자 자료·백업 대상 조사/DB·권한·키·서비스·Agent 실행0.

## 실제 실행을 막는 잔여 조건
- 설치된 NuGet pack의 공개 옵션/argv는 빈 config·credential-provider 차단을 전달하지 않는다. 환경변수만으로 사용자/기계 설정 미접근을 입증할 수 없다.
- vendor의 하위 도구 출력 누적에는 내부 상한이 없다. 외부 감독기의64KiB 제한이 내부 누적까지 제한하지 않는다.
- ignore-scripts로 설치했으므로 아키텍처별7z 선택 script도 실행하지 않았다. native 파일 존재/출처는 실행 성공을 뜻하지 않는다.
- 서명 옵션이 없을 때 서명 분기를 호출하지 않는 정적 근거는 있으나 실제 키·OS 설정 접근을 관측한 증거가 아니다.
- 실제 core API/native build·PE/nupkg 산출물·설치/제거/업데이트·서명·안전 종료/복구·실서버/사용자 인수는 미검증 또는 미구현이다. 기존 기능·FN08/15/16 선행과 전체 FN18 완료를 주장하지 않는다.

## 조치·재개·rollback
소유 source/lock을 부분 checkpoint로 보존한다. 정확한 도구 설정 탐색·출력 감독 근거와 기존 8경로 내 안전한 내부 방법을 검토한 뒤, 필요 변경의 독립 검수·exact SHA 게시·새 자원 사전등록을 충족해야 실제 build를 진행한다. vendor 패치/대체 호출·gate 강제 성공·실제 사용자 설정 조사는 수행하지 않는다. rollback은 소유 source commit의 정상 revert와 확인된 신규 개발 자원만의 회수이며, 사용자 자료·설치는 변경하지 않는다. 일부 경계 미충족을 이유로 무관한 승인 계획 구현을 멈추지 않는다.