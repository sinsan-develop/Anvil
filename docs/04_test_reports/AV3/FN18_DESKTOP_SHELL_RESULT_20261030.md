# FN18 Windows 개발 Shell 한정 구현 결과 — 2026-10-30

## 판정

**부분 구현·한정 핵심 동작 확인. 전체 FN18·Stage E·작업계획서 완료 아님.**

정확 HTTPS origin을 사용자가 입력해 같은 서버 WebUI를 여는 Windows Shell, 창 숨김/재표시, 명시 종료와 종료 거부, 연결 기한·오류, 공개 설정 원문 보존을 구현했다. 실제 Electron에서 기존 WebUI 번들을 메모리 HTTPS로 표시해 핵심 동작을 확인하고 개발 실행 디렉터리를 생성했다. 실제 서버 연결·인증·프로젝트 저장/조회, 실행기 회수, 사용자 설치를 확인한 것은 아니다.

원격 Node·IPC를 차단하고 로컬 설정 화면의 정확 main-frame/URL·닫힌 입력 형식만 IPC에 허용한다. 팝업·다운로드·브라우저 권한은 현재 거절하며 **해당 기능 미지원**이다. 이를 완료 기능이나 단순 추후 테스트로 분류하지 않는다.

## 기준과 담당

- 기존 TD-01 Electron A안·WORK_PLAN FN18·INTERFACES §14.3의 한정 단위. 새 서버 공개 API·인증/권한·Agent 계약 변경 없음.
- WI `docs/work_packages/FN18_DESKTOP_SHELL_IMPLEMENTATION_20261030.md`: SHA256 `A2E3F9F984256E4795EBA2A76AD135D8A693E0B8A8F0E88447876C10EC5DB3E7`.
- 시작 branch `codex/av3-stage-b`, baseHead `bd716e36513472be42f654fe2551838c2d4b2adf`. 시작 tracked clean·기존 보호 untracked8 보존. 새 18파일의 실제 지문으로 검수했으며 **baseHead 자체의 소스로 빌드했다고 주장하지 않는다.** 최종 Git 게시 결과는 WORK_STATUS의 후속 기록과 대조한다.
- 기존 Primary가 구현·기본 검증, 기존 Reviewer가 읽기 독립 검수, Main이 관리·fresh 검증·통합. 동일 파일 동시 writer 없음. 실제 DB·키·서비스·Agent 실행 제외 유지.

## 사용자 동작과 변경

- 로컬 폼에서 HTTPS origin을 명시 연결한다. HTTP·userinfo·임의 경로·query/fragment·제어문자와 부적합 IPC를 거절한다. 원격은 sandbox/contextIsolation/webSecurity를 유지하고 preload·Node를 주지 않는다.
- 닫기는 창 숨김이다. 같은 view를 표시하면 메모리 입력이 남는다. 명시 종료는 사용자 확인 후 beforeunload 거부를 존중한다. 종료 성공도 Agent 회수·checkpoint 성공을 의미하지 않는다.
- 원격 탐색은 10초 관측 뒤 기한 초과로 전환해 버튼을 복구한다. 늦은 완료가 현재 상태를 덮지 않으며 자동 재전송하지 않는다. 재연결은 명시 동작이다.
- 손상된 안전한 일반 설정 파일은 동의 없이 바꾸지 않는다. 명시 교체 시 원문 backup을 보존한다. 불안전한 경로·쓰기/종료 결과불명은 실패/보존한다.
- root package/lock/TypeScript 설정·기존 WebUI·server·connector·SQL 수정 없음. 신규 파일 18개는 다음과 같다.

| 경로 | SHA256 |
|---|---|
| `apps/desktop/package.json` | `e36df197f0f895ab420cedcf85ff634dd58da73986a6e930bf9ff5b6e82b4614` |
| `apps/desktop/package-lock.json` | `59297f90d5106290ac5873ef3211be29d52ea2730dac114f4e1354da0699265b` |
| `apps/desktop/.gitignore` | `267d7663e49ff901f2fc9ad72f63c7f878a16c6b5a0b274f8be8ee525b48d0de` |
| `apps/desktop/tsconfig.json` | `e8992528481e6bc579805ba9cfd7f9eede38019b830655f7b71a0a6a51d03724` |
| `apps/desktop/forge.config.cjs` | `9236140f5a214fcfc3cd291738c2af66ca541040c140896210f74abe0d46ebd4` |
| `apps/desktop/src/main.cjs` | `fe7465ebebf1b4e271167c4581252c9c010100f6445b24a066b229d1b7bae4e5` |
| `apps/desktop/src/shell.cjs` | `db550b57c176d2eee85d8fbd67aee34620660f6f2006e79d329e85a23d006fb4` |
| `apps/desktop/src/policy.cjs` | `e0a0d700a22a34aa230955c5b50bb73ca93f2d56cc90d14ea29a4eb297383a18` |
| `apps/desktop/src/preload.cjs` | `345828085a6895659f0957b84714a6a75791640fd5219d93eeb025e6d3b4e488` |
| `apps/desktop/src/settings.html` | `f2bda1747edb9e0c63c8d78235f9d5d9d0d4609d196a7e2a36b62ee0c9c54f79` |
| `apps/desktop/src/settings.js` | `0c25983de82d2581e1cb4062c8fa99cc3e34f6a969eef7eacc3726292c316698` |
| `apps/desktop/src/settings.css` | `d9f420e25a1b53c67cd81bed2afeadc0581ee73997af77352fd4e63ad109eac9` |
| `apps/desktop/scripts/prepare-sdk.cjs` | `494d6b4ea63d62ecd002b6a60bb33bfb38d16f3809ea739ea4374047992b5981` |
| `apps/desktop/scripts/verify-sdk.cjs` | `493133723bd3ba182da2cd07fbd838e646dd42174fc0810b9c4d803cd953a357` |
| `tests/desktop/shell-policy.test.cjs` | `0c9ff1eb3302fc117a954028178a29a22c633cd8c5e84422acc8047cf2316e0d` |
| `tests/desktop/shell-electron-qa.cjs` | `95db0c3ccf36f8088d77d7d8f4023272a34ab55644300b33a13b51565024ee78` |
| `tests/desktop/fixtures/qa-main.cjs` | `b0fd18854e203f132ac2b2ff44544e12f7f76ac1a1f1e619245010330598ac73` |
| `docs/desktop/README.md` | `2ba86475c38cca7648191e3f0975a4d374b12a34f3df3874bd6f3e53223bb44d` |

## Main 검증과 실제 범위

| 증거 | 명령·실제 결과 | 한계 |
|---|---|---|
| 3d1a83 | `node --test tests/desktop/shell-policy.test.cjs` — 5 PASS, 0 SKIP, 89.8845ms | origin/IPC 입력·오류 분류·SDK 출처 정책 단위 |
| 3d1a83 | `node node_modules/typescript/bin/tsc -p apps/desktop/tsconfig.json` — exit0 | 별도 strict checkJs. root 검사로 대신하지 않음 |
| 3d1a83→7be659 | `ANVIL_FN18_ELECTRON_QA=1 ANVIL_FN18_QA_CASE=full node --test tests/desktop/shell-electron-qa.cjs` — Node1 PASS, 0 SKIP, 22089.163ms | 내부 native7조건. 메모리 HTTPS·기존 실제 WebUI 번들·listener0 |
| 같은 실행의 별도 선택 | `ANVIL_FN18_QA_CASE=boundaries` — Node1 PASS, 0 SKIP, 11833.4414ms | 내부4조건: 손상 원문/backup·명시 교체, Notification 거절, attachment 취소/파일0, DOM 종료 |
| 84922e | `node apps/desktop/scripts/verify-sdk.cjs` — exit0 | 고정 ZIP의 실제 entry별 hash/bytes와 추출 SDK 독립 대조. Electron exe 실행 아님 |
| a0ed41 | r2 당시 실제 asar 목록·내용 검산 exit0 | 정확8파일, src7 원바이트 동일, package는 private/scripts/devDependencies 3필드 제거 투영 |
| 13d2df | LF 보완 r3의 source18·실제73파일·asar8/src7/package투영·검토사본 전지문 exit0 | r2 보존, 실행파일 직접 기동 아님 |
| c90757 | `git diff --cached --check` exit0 | EOF 형식4 보정 후 같은 기준, Git 설정·검사 기준 변경 없음 |
| 1c0023 | 별도 CIM/경로 관측·동결 지문·`git diff --check` exit0 | 정확 SDK 프로세스0·QA 경로 부재. 신규 파일 whitespace는 게시 전 staged 검사로 추가 확인 |

테스트 개수를 합산해 서로 다른 실행을 한 번의 PASS처럼 표시하지 않는다. Main native는 수행자의 RED/GREEN과 별도다. 확인창 응답·beforeunload veto·TLS/offline 오류는 명시 fixture 주입이며 물리 확인창·실제 TLS handshake나 네트워크 장애 시험이 아니다. 환경 변수는 finally에서 원형 복구했다. QA는 새 userData와 등록 downloads 안에서만 수행했다.

### 오류와 보완 이력

- 최초 모듈부재 RED는 동작조건0. 실제 IPC sender guard 임시변이는 수행자가 RED→원문 복구→GREEN을 별도로 관측했다.
- SDK 사전 검수 I1(가변 manifest만 신뢰), I2(실 추출량의 diskfree 선검사 누락)를 다운로드 전에 보완·독립 C0/I0. 잠긴 동일 ZIP stream에서 원본 hash·entry별 hash/bytes를 산출하고 전체 파일집합·추출본과 대조하며 실제 비압축량+여유를 사전 검사한다.
- JSDoc 같은 줄 배치 오류3회(fd1576/c73a68/5fa7c3) 후 Primary writer 회수·Main 순차 인수. chunks 주석 개행1곳만 보정한 afdcd4 strict/문법 exit0·다른 수정0 확인 후 Primary에 반환했다.
- 최초 native `22d524/f0832f`는 pending 응답에서 버튼 잠김으로 FAIL. 10초 유한 관측·generation 무효화·명시 회복 최소 보완 후 `a73747/b2a9f9` GREEN. 원본 FAIL은 그대로 보존한다. 첫 userData는 Electron이 생성해 초기화 버그는 재현되지 않았으며 불필요한 source 수정 없음.
- npm 명령 인자 결합·작성 명령 quoting·UTF8 읽기·asar Windows 선행 separator는 각각 도구/설정 오류로 구분했다. 실패 뒤 명령의 exit0을 PASS로 쓰지 않았다. sandbox CIM 거절은 실제 관측 실패이며 elevated 정확 읽기 결과로만 잔여0을 판정했다.
- 한 줄 HTML을 스칼라 인덱싱해 '<'만 읽은 Reviewer 지적은 실제 1385bytes/동일 hash 확인 뒤 철회했다. HTML 미구현이라는 제품 결함으로 기록하지 않는다. 실제 폼·버튼 QA 공백은 별개로 보완했다.

## 개발 산출물

- 고정 Electron `45.1.0`, Forge CLI `8.0.1`. root 의존성 변경 없음. 별도 lock·ignore-scripts 설치, 공식 registry 129의존성의 resolved/integrity 대조.
- 공식 ZIP `electron-v45.1.0-win32-x64.zip`: 158224448bytes, SHA256 `55eaba17abff7b5bba6c3bbc85068967379024fe742fe9c7fdba9118922ccbe2`.
- 원 SDK exe SHA256 `c579acaab64b1c456bda1693cdf1a2ec7e4de7738b0e2d1b6349d60e8087143c` 보존.
- 최초 r2 Forge `node <고정 npm-cli.js> run package --ignore-scripts`: d3b8e8→3bd71b exit0, 약12초·180초 관측기한 미초과. local 검증 ZIP만 소비, signing0·추가 다운로드 출력0. 설치된 resedit JS의 Windows 리소스 투영으로 제품 PE hash는 원 SDK와 다르다.
- 현재 r3 실행 디렉터리 **73파일·374007452bytes**. packaged PE SHA256 `f51394219b6aa44770d27231205bd93bd4af2f57a1dcd2c7b66f0b35fd08e10f`.
- `app.asar` **20155bytes**, SHA256 `068801d570526a620c8c8e3d1ccd7d9be6fb52a342a506e573d3dd376b9e6b5f`.
- 현재 정본 `FN18_NOT_RELEASE_manifest.r3.json`: SHA256 `b68e97ceebc7f8b612578e11d3799c961ee75c9c28055d54fa9096b0d7f3cb4a`. source18·lock·SDK·73파일 hash·미실행 경계를 결박한다. r1 FFE81548…와 r2 A83FB6A7…는 보존 이력이며 현재 정본 아님.
- 검토용 보관: `D:/Project/Anvil/.av3-data/v3-development/fn18-shell-20261030-01-r3`. Main 13d2df가 새 sibling에 73파일+r3 manifest를 create-new 복사·전 bytes/hash·asar/src 원형을 확인했다. 이전 r2 사본은 원래 경로에 그대로 보존했다. owner SINSAN/cyhuh·parent/target nonlink, 기존 형제 자료/ACL 변경 없음.
- **NOT_RELEASE / UNSIGNED_DEV.** 설치 프로그램·운영 배포본이 아니다. packaged Anvil.exe의 정상 main-entry 직접 기동도 아직 NOT_RUN이다.

## 자원·복구·미완료

native QA는 각 fresh root에서 child 종료·stdio·정확 SDK 프로세스0을 관측한 뒤 정리했다. Main 별도 63c88d/db72bf/1c0023도 QA 부재/SDK 프로세스0을 확인했다. toolchain 임시 cache/config/temp는 생성 marker/owner/realpath/link·사용 프로세스 검산 후 정리하며 결과는 WORK_STATUS에 누적한다. SDK/node_modules/out과 검토 artifact는 후속 개발·검수용으로 보존한다. 등록 자원 총2GiB 한도를 유지한다. 불명 자원은 추측 삭제하지 않는다.

| 항목 | 상태 |
|---|---|
| 한정 Shell·메모리 WebUI·설정 보호/숨김/종료·기한 | 구현 완료·위 표 범위의 핵심 동작 확인 |
| 원격 팝업·다운로드·브라우저 권한 사용 | 현재 미지원·거절만 확인 |
| 실제 HTTPS 서버·실 로그인·동일 프로젝트·DB 저장/조회 | 미확인/NOT_RUN |
| packaged Anvil.exe 정상 기동·물리 tray/확인창·사용자 인수 | NOT_RUN/미확인 |
| installer·OS 설치/등록·서명·업데이트/rollback | 미구현/미실행 |
| 실행기·spool/checkpoint 회수·안전 종료/수동 재개 | 미구현/미검증 |
| 전체 FN18·Stage E·전체 계획 | 미완료 |

rollback은 이 한정 source checkpoint의 일반 revert와 정확 소유 개발 산출물의 별도 정리다. 현재 실제 사용자 설치·DB·키·서비스가 바뀌지 않아 해당 원복 대상은 없다. history rewrite/force push·기존 사용자 자료 삭제를 하지 않는다.
### 게시 전 줄 끝 형식 보완·r3

staged 검사 76cf35가 package/html/tsconfig/README 4파일 EOF의 CRLF를 거절했다. 같은 Primary가 끝 CRLF 1쌍만 LF로 바꾸었고, 각 새 파일의 끝 LF를 CRLF로 되돌리면 r2 원본 hash와 정확히 일치한다. JSON 동일·다른 문자0·나머지14/lock/SDK 불변을 독립 C0/I0로 확인했다. strict checkJs0·정책5 PASS(94.303ms), Main c90757 같은 staged 기준 통과. 기능 코드가 바뀌지 않아 native7/4 전체를 재실행하지 않았다.

raw HTML byte가 바뀌어 r2 원본73파일/manifest를 canonical에 보존한 후 동일한 source 생성 중복본만 제거하고 재패키징했다. `1f336a/a1f07b` exit0, 약15초/180초 미초과. r2와 바뀐 artifact는 PE와 asar 두 개뿐이다. 위 현재 source18 표와 r3 manifest는 실제 빌드 입력 bytes의 SHA256이다. Windows Git 줄 끝 필터의 저장 bytes와는 구분하고 최종 checkpoint와 논리 내용 관계를 대조한다.

세대2 toolchain 정리의 최초 f6263c는 DateTime 자동 변환으로 시각 비교 가드에서 삭제0으로 멈췄다. 원marker5ABC3B0E…와 UTC Kind/왕복 원문 정확 일치를 재검사한 7c5f2a만 삭제 exit0이다. 정확 toolchain/QA 부재·SDK/packaged 프로세스0, 보존 SDK/deps/out/r2/r3 합계1700857278bytes<2GiB. 기존 키/형제 자료/ACL/서비스 변경 없음.
최종 게시 전 Main5c7495는 raw 빌드 source18의 SHA256을 r3와 대조했다. Git staged blob은 5파일 raw 동일, 13파일은 Windows CRLF/LF만 다르고 다른 내용 차이0이었다. 이 정상 줄 끝 필터 관계를 실제 byte 동일과 구분하며 최종 checkpoint receipt에 결박한다.
