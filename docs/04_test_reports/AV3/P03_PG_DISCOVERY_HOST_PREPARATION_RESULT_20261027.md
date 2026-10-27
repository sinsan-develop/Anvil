# P03 보존 PG 구조조사 host 제어 소스 준비 검수 — 2026-10-27

## 판정
SOURCE_PREPARATION / 지정 최종 보완 범위 C0/I0/M0. 실제 실행 준비·원 volume 구조조사·PG 복구·제품 기능 완료는 아니다. 전체 WORK_PLAN은 미완료다.
기준 branch codex/av3-stage-b / 시작 checkpoint 6d584a619c457218d7b40e94e58358264270943a. 단일 담당 p03_discovery_host_control 구현, Main 어울 관리·새 검수·통합, p03_discovery_review 독립 읽기 검수. Main 제품 직접 수정0.

## 변경과 이유
신규 scripts/p03-pg-discovery-host.ts, tests/unit/P03/pg-recovery-discovery-host.test.ts, P03_PG_DISCOVERY_HOST_EXECUTION_PLAN_20261027.md의 정확3파일이다. 기존 metadata shell·원 시험·provision·guard/native·승인/소비기록은 보존했다.
기존에는 host60초/단발/신원/정리 제어 소스가 없었다. 이번에는 import/기본 plan 무효과와 실제 고정 FS/Git/Docker adapter→orchestrator 경로를 연결했다. 합성 ports/child로 같은 코드 경로를 확인한다. 미결박 grant·현재원문/기한/소진·자원 불일치는 닫으며 실제 실행 권한을 파일이 인증한다고 주장하지 않는다.
WI 최초 C08526AAB0FC26BCFD9B00BE6195FC81A67EB044B7B1F0E3700267F773FFC729, 내부제어 보완 후 9C4E5936EF733231FEB220D8968C00C69D401D0A01C068A20531681CE1E30CF1. 원 Docker/Git spawn handle TERM최대1/stdio 회수는 source-only 내부 보완이며 새 실제 실행 승인이 아니다.

## 지문
| 파일 | 최종 raw SHA256 |
|---|---|
| scripts/p03-pg-discovery-host.ts | EA54D05C9E6DB05C5BC1E34A5E5B97B10B2E2FE03E41C4E6A8ED8F2207257766 |
| tests/unit/P03/pg-recovery-discovery-host.test.ts | 7B7212AD7CFBA8417015145335296B72A4209C55228ADF697A310BCE9C33BE0D |
| docs/work_packages/P03_PG_DISCOVERY_HOST_EXECUTION_PLAN_20261027.md | 5364283F3CC761DDDDE81DE3AA5F68504202F0B86FE2D245DB9A66741A26C5BE |
기존 shell raw156867EF53948C2A18CF439EBA8DB46ECF461AB11FD86116239B2E5FEC9A480B 불변. 최초 제출 지문과 보완 이력은 담당 실행안에 남겼다.

## Main 실제 검증
- e18418: 신규4건 source 부재 RED/exit1.
- 4332ab: 최초 제출 신규18 PASS/skip0/231.6903ms, fdbdb0 타입·구문 exit0. 보완 전 증거다.
- 독립 예비3건: timeout 뒤 client/pipe 생존, deadline 밖 FS 대기, 중복 JSON 키 허용. 원 handle TERM/close 미확인·lateIO/pendingIO/소비 null·기존 parseWireJson 재사용으로 보완했다. 실제 OS 종료 보장이라고 하지 않는다.
- 최종 I1 RECEIPT_BUDGET_GAP: 최소잔여 검사 뒤 receipt가 시간을 소모해 실제 create/start가 가능했다. Main f869a7의 신규20은18 PASS/2 FAIL/236.0281ms/exit1로 mutation1!==0을 재현했다. 같은 담당 round1이 실제 호출 직전 동일57.5초 가드2곳만 추가했다. 독립 I1 ADDRESSED.
- 별도 EXPOSE_BINDING_GAP: 포트 선언 metadata와 실제 게시를 혼동한 추가 제약 및 image→container 선언 유실 수락. Main f0b877 신규24는22 PASS/2 FAIL/244.9727ms/exit1이었다. 같은 담당이 폐쇄 선언·preflight snapshot·모든 own 비교만 보완했다. 실제 image EXPOSE값은 추측하지 않는다. 게시0/networknone 조건은 유지한다.
- 8fdda4: node --test tests/unit/P03/pg-recovery-discovery-host.test.ts → 최종24 PASS/0 FAIL/skip0/242.4678ms/exit0.
- a8948f: node node_modules/typescript/bin/tsc --noEmit -p tsconfig.base.json 및 node --check 신규 source/unit → exit0.
- 383a12: 최종3지문 일치, 각 git diff --no-index --check -- /dev/null 신규파일 공백출력0(차이존재 exit1과 구별), 기존 tracked 변경은 Main WORK_STATUS뿐.
- b4e326: 보호 untracked8 지문불변, 컴파일01/02 소비marker 지문불변·QA01/02 경로부재. 소비기록은 의도적 보존이다.
독립 최종은 지정 보완 범위 C0/I0/M0이며 읽기만 수행했다. 담당24 PASS/258.1931ms는 Main 새 검사와 구분한다.

## 오류·미검증·자원
담당 신규 fixture 타입 오류 초기2+추가1은 최소 보정 후 타입0이며 제품 실행 실패로 계산하지 않는다. Main provision 파일명 추정 읽기 NOT_FOUND1과 tsconfig.json NOT_FOUND1은 실제 이름/tsconfig.base.json 확인으로 종료했다. Git sandbox 격리 오류는 정확 읽기의 허용 실행으로 분리했으며 ACL/Git설정 변경0이다. 같은 근본 원인3회는 없다.
실제 SSH/WSL/Docker/원 volume 조회·mount·metadata/PG binary/SQL/DB/서비스·Agent/PS/C#/Bash 실행은 이번 작업0이다. 새 source QA·원장·grant/nonce·컨테이너는 생성0이므로 실제 정리 수행이나 WSL 잔여0을 새 관측했다고 주장하지 않는다.
실제 image Env/EXPOSE/NetworkSettings 형태·Linux FS 신원/내구성·OS TERM/미종료·bootstrap·원 metadata는 NOT_RUN. 기본 후보 불일치는 자동 대체하지 않는다. 60초가 kernel 대기/이미 시작한 IO/child 종료를 강제로 보장하지 않는다. 소비·종료·정리 미확정은 보존하고 false로 합성하지 않는다.

## 다음과 복구
기존 branch에 소유6파일만 checkpoint/private 게시하고 exact SHA를 확인한다. 이후 실제 실행 전 source Git/도구·root·Env·record·원자원 현재 신원과 정확 권한을 대조한다. 현재 grant/실행승인 발급0. 소진된 compiler02 승인으로 재시도하지 않는다. FN16의 기존 정확 계약 결정 질문도 중복하지 않는다.
rollback은 소유 신규3 source의 검토된 정상 revert이며 기존 자료·소비marker·원 volume·서비스 삭제가 아니다. WORK_STATUS에 담당·오류·검수·미검증·다음 조치를 누적한다. 이 checkpoint로 전체 Stage/계획 완료나 병합을 주장하지 않는다.
