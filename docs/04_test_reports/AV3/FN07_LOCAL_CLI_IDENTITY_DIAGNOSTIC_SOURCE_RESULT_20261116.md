# FN07 로컬 CLI 한정 조회 진단 소스 검증

## 판정

기준 main `188b506712a1ad65658a633465b2852e50c95365`, 브랜치 `codex/av3-cli-observation-diagnostics`, 지시서 SHA256 `F8255DB0DAD268B4B73DAFF3FCE9D389AAC4D6ECD1CD402F540470682E1D5447`. 신규 소스·후보 문서의 정적 검산과 결과 처리 함수의 RAM 검증을 마쳤다. 실행 후보의 상태는 **NOT_APPROVED_EXECUTION**이다.

원 관측 `20670a`는 UNKNOWN, 부모 exit 0이었다. 이 실행의 자식 종료 및 실패 원인은 여전히 미확인이다. 소진된 단발 승인과 원 결과서는 보존했다.

## 변경 및 지문

| 신규 파일 | SHA256 |
|---|---|
| scripts/fn07-local-cli-identity-read-v2.ps1 | `0FD03A3F62C508F1E7343FBD80DC03DED0AFE30251C1D2356450E271F5B28120` |
| docs/work_packages/FN07_LOCAL_CLI_IDENTITY_DIAGNOSTIC_CANDIDATE_20261116.md | `DB9265A3EECADBAE4DC76E8A55EDB7881D6CE195401DFEF89C3509AAFA0102E9` |
| tests/unit/FN07/local-cli-identity-diagnostic.test.ts | `7AD546ACA53BF0B4E3CFF04E474591C7B5848BEEACA23E41343BEE97EFEF1205` |

이 결과서를 포함해 신규 4경로다. 원 스크립트 `2A7E89112023DDB2F40631ABD098529B47AF1A2B6CF87317C7113F56C636F511`, 원 후보 `EEAFFF15D288F5721F00C235A3A1FB1D2806CD0E8F0080010CF1B8685F47F620`, 원 결과서 `854E62DECC567602562618A56E162AA78767130653526B72B330EFB7CEE9CB46`을 수정하지 않았다.

조회 소스에서는 단계·고정 사유 대입, 마지막 UNKNOWN 출력 및 머리말만 달라진다. 시험이 이 변경을 역치환해 원 조회 흐름과 동일한지 확인한다. 감독 후보는 자식의 검산된 첫 행과 감독 최초 실패·회수 실패·자식 종료·확인된 종료코드·총 기한 결과를 분리한다. 시작 자체가 불명인 경우 원 Process 객체를 보존하는 분기를 정적 대조했다. 조회 대상·읽기 방식·단발성·4KiB·27+3초 한도는 유지한다.

## 실행 근거

- `node --experimental-strip-types --test --test-reporter=tap tests/unit/FN07/local-cli-identity-diagnostic.test.ts` · 27b30c · exit 0 · 3 통과, 0 실패, 0 건너뜀 · 1929.6495ms. 최초 실행에서 세 시험이 통과했다.
- 첫 시험은 기준 지문과 조회 본문의 역치환을 확인했다. 둘째 시험은 감독의 단일 시작·원 객체 보존·기한·버퍼·오류 덮어쓰기 차단을 소스에서 확인했다.
- 셋째 시험은 Windows PowerShell 5.1 파서로 두 원문을 분석하고 감독 원문에서 결과 판독·형식화 함수 두 개만 추출해 호출했다. 정상 이미지·래퍼·범위 종료, 자식 고정 실패, 감독 실패와 확인된 exit 0, 시작/정지 불명, 정지 후 종료, 늦은 종단, 잘린 행·위조·출력 한도·비밀 문자열 미출력을 합성 입력으로 확인했다. 관측·감독 블록을 실행하거나 가짜 파일 I/O를 호출하지 않았다.
- `git diff --check development/main`과 네 신규 파일 각각에 대한 `git diff --no-index --check -- /dev/null <파일>`로 공백을 확인한다. 실제 개발환경의 관측 결과와 시험의 합성 종료값을 구분한다.

## 미검증과 복구

실제 PATH·설치파일·자식 프로세스 관측, 시작·정지·종료코드 회수, 파일 교체·권한·키·서비스·DB·SDK·CLI·Agent는 미실행이다. 새 후보는 고정 경로·서명·실행 권위를 제공하지 않는다. 추가 관측을 실행하려면 새 후보 지문에 대한 별도 직접 승인이 필요하다. 실제 조회 핸들과 재발행은 0이다.

복구 단위는 이번에 추가한 네 파일이다. 운영 변경이나 저장 자료가 없으므로 원 후보·스크립트·소진 기록은 그대로 보존한다. Git 및 현황은 Main 담당이다.
