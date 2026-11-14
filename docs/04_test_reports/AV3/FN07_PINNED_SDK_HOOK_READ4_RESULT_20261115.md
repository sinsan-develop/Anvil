# FN07 고정 SDK 원문 READ4 결과 — 2026-11-15

## 판정

실패: DNS ENOTFOUND. 직접 승인된 추가 1회는 소진됐으며 SDK 계약은 새로 확인하지 못했다. 전체 작업계획은 미완료다.

## 승인·기준

- 직접 답변: call_93be475d52114fc7a9081fed92ceff2b — 고정 SDK 공개 원문 읽기 1회 추가 승인.
- 실행안: docs/work_packages/FN07_PINNED_SDK_HOOK_CONTRACT_READ_CANDIDATE_20261106.md
- 실행안 SHA256: 2296F0EF805EB2F03D52E5FD30DD776AB1F45B14953BEC3D532FF51AB63236E9
- 시작 main: d242b72ebe06a70545108487cc79605f8d986b71, tracked clean.
- 수행자: 기존 developer_primary. Main은 중복 요청 없이 결과·메모리 상태를 인수했다.

## 실행 증거

고정 SDK 0.3.224 URL에 메모리 전용 GET 1회. 요청·socket 10초, 도구 30초 조건. 수행자 기준 문서 해시 확인 도구 955c95. Node 도구 isError:true, functions 경과 3.7초이며 shell exit code는 해당하지 않는다.

오류 원문: `ENOTFOUND: getaddrinfo ENOTFOUND registry.npmjs.org`

후행 네트워크 없는 메모리 상태 조회는 isError:false였다.

- attempted=true, fetches=1, state=FAILED_OR_UNKNOWN
- requestClosed=true, live request=0
- sourceAvailable=false, packedAvailable=false
- 원문 수신 0, 해시/크기 검증 미실행
- callback 동기성·argv/env·도구 결정 응답 신규 확인 0

READ2/READ3 이후 동일 DNS 원인의 세 번째 실패다. 기존 실패 기록은 보존한다. 이 결과만으로 WSL이나 사용자 PC 전체의 네트워크 장애라고 단정하지 않는다.

## 조치·미검증

재시도·redirect·파일 다운로드·SDK 설치/import/eval/실행·환경 변경 0. 실제 DB·권한·키·서비스·Agent 실행 0. Main 기록 브랜치 생성은 일반 권한에서 Git ref lock Permission denied로 실패한 뒤, 같은 명령의 승인된 승격 실행으로 성공했다. SDK 요청을 재실행한 것은 아니다.

다음은 PMO에 정확한 DNS 제약과 원문 미확인을 전달하고, 고정 원문을 확보할 수 있는 실행 경로를 확인하는 것이다. 새 네트워크 시도나 DNS/proxy 변경을 이 승인으로 수행하지 않는다. 기존 STOP 소비 구현과 검수 결과는 유지하며 실제 Query/child 소유 생산자 미완료를 완료로 올리지 않는다.
