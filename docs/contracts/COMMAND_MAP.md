# Anvil v3 실행·검증 명령표

P03 준비 문서다. 명령은 `codex/av3-stage-a`의 저장소 root에서 실행하고 `git rev-parse --show-toplevel`로 확인한다. 공식 문서 기준은 `D:\Project\Anvil`, WSL 신규 Git root는 `/home/daon/deploy/anvil-v3`다. 기존 보존본·다른 프로젝트에서 제품 명령을 실행하지 않는다. 파일/명령 존재는 실제 합격이 아니며 현재 결과는 WORK_STATUS·업무 RESULT를 따른다.

## 1. 현재 준비·실행 명령

| ID/명령 | 실행 조건·기대 결과·실패/증거 |
|---|---|
| P01 | 사용자 승인 완료, 재실행하지 않음. REVIEW-02 참조 |
| P02 | 계약 수용, 재조사하지 않음. P02/RESULT 및 TD-01~03·현재 manifest 참조 |
| P03 `npm ci --ignore-scripts --no-audit --no-fund` | Node24.18+/25미만·npm11.12.1+/12미만·정확 lock. 등록된 전용 cache만 사용. lifecycle OFF·전역 설치/자동 업데이트0 |
| `npm run contracts:generate` | 신뢰 repo schema catalog만 타입 생성. 사용자 문서/방법론을 compiler 입력으로 실행하지 않음 |
| `node scripts/generate-contract-types.ts --check` | 현재 schema와 타입 같으면 exit0, 다르면 STALE exit1·기대값 완화 금지 |
| `npm test` | 현재 단위 전체. API/DB/Agent/브라우저 PASS로 이월하지 않음 |
| `npm run build` | typecheck 뒤 Web build. 기존 dist만 대체, 새 제품 기능 합격 아님 |
| WSL `node scripts/provision-development.ts --plan` | 비밀 없는 정확 이름/이미지/loopback·보존 범위 조회만 |
| WSL `node scripts/provision-development.ts --create` | 별도 승인·생성 전 부재/realpath/port·현재 exact SHA/clean 확인. 새 container/network/volume/보호 파일만. 기존 발견/조회 실패/label·ID 불일치 중단 |
| WSL `ANVIL_DB_CONFIG=/home/daon/.local/share/anvil-v3-development/migrator.json node scripts/migrate-development.ts` | 정확 승인 DB/role/host/port·실제 접속 신원 검증 후 migration checksum·멱등 fixture. 제품 사용자 생성0 |
| WSL `ANVIL_DB_CONFIG=/home/daon/.local/share/anvil-v3-development/app.json npm run test:db` | 새 DB의 비관리자 저장→별도 연결 재조회→정확 QA행 삭제·DDL 거절. 연결/권한 미확인도 실패/미검증 표시 |
| Windows `scripts/prepare-dev-https.ps1 -DataRoot D:\Project\Anvil\.av3-data` | 이번 승인 대상은 이미 생성한 CA1개. 기존 경로에서 재실행 불가·새 CA 임의 추가 금지. Root 신규 지문은 DEVELOPMENT_ENVIRONMENT 참조 |
| `npm start` | ANVIL_TLS_KEY·ANVIL_TLS_CERT·ANVIL_DB_CONFIG 보호 경로 참조 필요. 공통3830·로컬127.0.0.1. 키/DSN/계정 원문 출력0. `/api/v1/health`는 process-only |
| 화면 확인 | `https://localhost:3830/`는 P03 준비 화면만. 로그인·프로젝트·방법론·Agent가 완료된 것으로 해석하지 않음 |

설치 출처: 공식 npm registry의 exact version·tarball integrity를 lock에 고정했다. Fastify5.12.7·pg8.23.1·React/DOM19.3.1·Ajv8.20.0, TypeScript7.0.2·Vite8.3.4·json-schema-to-typescript16.0.0·Playwright1.64.1. 공식 근거 [Node TS](https://nodejs.org/docs/latest-v24.x/api/typescript.html), [Fastify LTS](https://fastify.dev/docs/latest/Reference/LTS/), [Vite 시작](https://vite.dev/guide/), [React 버전](https://react.dev/versions). 실제 호환성은 실행 증거로 따로 확인한다. Windows의 기존 Edge를 별도 시험 프로필로 사용하고 기존 사용자 프로필/보안 설정은 바꾸지 않는다. 브라우저 binary의 자동 다운로드/전역 설치는 아직 하지 않았다.

## 2. 계획별 후속 명령

아래는 FILE_MAP의 정확 시험 위치와 연결한 준비 명령이다. **현재 UI/FN/IX 제품 구현·시험은 미착수**다. 파일이 없거나 환경/허가가 없으면 미실행/불가이며 빈 suite/skip을 합격으로 세지 않는다. 실제 구현에서 추가 검수 파일과 실행 옵션을 갱신하고 각 ID의 RESULT에 exact 명령·exit·범위·미확인을 적는다. 외부 Agent가 필요한 FN06/07·IX02/04, 실제 기기·설치/Oracle는 별도 실행 허가를 검사한다.

| 업무 | 정확 명령 | 대상/결과·선행 |
|---|---|---|
| UI00 | `npm exec --no -- playwright test tests/browser/UI00/shell.spec.ts` | 해당 화면 정상·중요 실패/Network; 구현 전 미실행 |
| UI01 | `npm exec --no -- playwright test tests/browser/UI01/projects.spec.ts` | 해당 화면 정상·중요 실패/Network; 구현 전 미실행 |
| UI02 | `npm exec --no -- playwright test tests/browser/UI02/project-create.spec.ts` | 해당 화면 정상·중요 실패/Network; 구현 전 미실행 |
| UI03 | `npm exec --no -- playwright test tests/browser/UI03/methodology-editor.spec.ts` | 해당 화면 정상·중요 실패/Network; 구현 전 미실행 |
| UI04 | `npm exec --no -- playwright test tests/browser/UI04/workspace.spec.ts` | 해당 화면 정상·중요 실패/Network; 구현 전 미실행 |
| UI05 | `npm exec --no -- playwright test tests/browser/UI05/session-detail.spec.ts` | 해당 화면 정상·중요 실패/Network; 구현 전 미실행 |
| UI06 | `npm exec --no -- playwright test tests/browser/UI06/design-trace.spec.ts` | 해당 화면 정상·중요 실패/Network; 구현 전 미실행 |
| UI07 | `npm exec --no -- playwright test tests/browser/UI07/design-change.spec.ts` | 해당 화면 정상·중요 실패/Network; 구현 전 미실행 |
| UI08 | `npm exec --no -- playwright test tests/browser/UI08/decisions.spec.ts` | 해당 화면 정상·중요 실패/Network; 구현 전 미실행 |
| UI09 | `npm exec --no -- playwright test tests/browser/UI09/transfers.spec.ts` | 해당 화면 정상·중요 실패/Network; 구현 전 미실행 |
| UI10 | `npm exec --no -- playwright test tests/browser/UI10/knowledge.spec.ts` | 해당 화면 정상·중요 실패/Network; 구현 전 미실행 |
| UI11 | `npm exec --no -- playwright test tests/browser/UI11/connections.spec.ts` | 해당 화면 정상·중요 실패/Network; 구현 전 미실행 |
| UI12 | `npm exec --no -- playwright test tests/browser/UI12/control-handoff.spec.ts` | 해당 화면 정상·중요 실패/Network; 구현 전 미실행 |
| UI13 | `npm exec --no -- playwright test tests/browser/UI13/mobile.spec.ts` | 해당 화면 정상·중요 실패/Network; 구현 전 미실행 |
| UI14 | `npm exec --no -- playwright test tests/browser/UI14/settings.spec.ts` | 해당 화면 정상·중요 실패/Network; 구현 전 미실행 |
| FN01 | `node --test tests/unit/FN01/*.test.ts tests/integration/FN01/*.test.ts` | 해당 기능 단위·실제 저장/연동을 분리; 현재 제품 시험 파일 미생성 |
| FN02 | `node --test tests/unit/FN02/*.test.ts tests/integration/FN02/*.test.ts` | 해당 기능 단위·실제 저장/연동을 분리; 현재 제품 시험 파일 미생성 |
| FN03 | `node --test tests/unit/FN03/*.test.ts tests/integration/FN03/*.test.ts` | 해당 기능 단위·실제 저장/연동을 분리; 현재 제품 시험 파일 미생성 |
| FN04 | `node --test tests/unit/FN04/*.test.ts tests/integration/FN04/*.test.ts` | 해당 기능 단위·실제 저장/연동을 분리; 현재 제품 시험 파일 미생성 |
| FN05 | `node --test tests/unit/FN05/*.test.ts tests/integration/FN05/*.test.ts` | 해당 기능 단위·실제 저장/연동을 분리; 현재 제품 시험 파일 미생성 |
| FN06 | `node --test tests/unit/FN06/*.test.ts tests/integration/FN06/*.test.ts` | 해당 기능 단위·실제 저장/연동을 분리; 현재 제품 시험 파일 미생성 |
| FN07 | `node --test tests/unit/FN07/*.test.ts tests/integration/FN07/*.test.ts` | 해당 기능 단위·실제 저장/연동을 분리; 현재 제품 시험 파일 미생성 |
| FN08 | `node --test tests/unit/FN08/*.test.ts tests/integration/FN08/*.test.ts` | 해당 기능 단위·실제 저장/연동을 분리; 현재 제품 시험 파일 미생성 |
| FN09 | `node --test tests/unit/FN09/*.test.ts tests/integration/FN09/*.test.ts` | 해당 기능 단위·실제 저장/연동을 분리; 현재 제품 시험 파일 미생성 |
| FN10 | `node --test tests/unit/FN10/*.test.ts tests/integration/FN10/*.test.ts` | 해당 기능 단위·실제 저장/연동을 분리; 현재 제품 시험 파일 미생성 |
| FN11 | `node --test tests/unit/FN11/*.test.ts tests/integration/FN11/*.test.ts` | 해당 기능 단위·실제 저장/연동을 분리; 현재 제품 시험 파일 미생성 |
| FN12 | `node --test tests/unit/FN12/*.test.ts tests/integration/FN12/*.test.ts` | 해당 기능 단위·실제 저장/연동을 분리; 현재 제품 시험 파일 미생성 |
| FN13 | `node --test tests/unit/FN13/*.test.ts tests/integration/FN13/*.test.ts` | 해당 기능 단위·실제 저장/연동을 분리; 현재 제품 시험 파일 미생성 |
| FN14 | `node --test tests/unit/FN14/*.test.ts tests/integration/FN14/*.test.ts` | 해당 기능 단위·실제 저장/연동을 분리; 현재 제품 시험 파일 미생성 |
| FN15 | `node --test tests/unit/FN15/*.test.ts tests/integration/FN15/*.test.ts` | 해당 기능 단위·실제 저장/연동을 분리; 현재 제품 시험 파일 미생성 |
| FN16 | `node --test tests/unit/FN16/*.test.ts tests/integration/FN16/*.test.ts` | 해당 기능 단위·실제 저장/연동을 분리; 현재 제품 시험 파일 미생성 |
| FN17 | `node --test tests/unit/FN17/*.test.ts tests/integration/FN17/*.test.ts` | 해당 기능 단위·실제 저장/연동을 분리; 현재 제품 시험 파일 미생성 |
| FN18 | `node --test tests/unit/FN18/*.test.ts tests/integration/FN18/*.test.ts` | 해당 기능 단위·실제 저장/연동을 분리; 현재 제품 시험 파일 미생성 |
| IX01 | `node --test tests/integration/IX01/journey.test.ts` 및 `npm exec --no -- playwright test tests/browser/IX01/journey.spec.ts` | 계획상 해당 전체 여정. 선행/실제 환경·허가 전 실행 금지 |
| IX02 | `node --test tests/integration/IX02/journey.test.ts` 및 `npm exec --no -- playwright test tests/browser/IX02/journey.spec.ts` | 계획상 해당 전체 여정. 선행/실제 환경·허가 전 실행 금지 |
| IX03 | `node --test tests/integration/IX03/journey.test.ts` 및 `npm exec --no -- playwright test tests/browser/IX03/journey.spec.ts` | 계획상 해당 전체 여정. 선행/실제 환경·허가 전 실행 금지 |
| IX04 | `node --test tests/integration/IX04/journey.test.ts` 및 `npm exec --no -- playwright test tests/browser/IX04/journey.spec.ts` | 계획상 해당 전체 여정. 선행/실제 환경·허가 전 실행 금지 |
| IX05 | `node --test tests/integration/IX05/journey.test.ts` 및 `npm exec --no -- playwright test tests/browser/IX05/journey.spec.ts` | 계획상 해당 전체 여정. 선행/실제 환경·허가 전 실행 금지 |
| IX06 | `node --test tests/integration/IX06/journey.test.ts` 및 `npm exec --no -- playwright test tests/browser/IX06/journey.spec.ts` | 계획상 해당 전체 여정. 선행/실제 환경·허가 전 실행 금지 |
| IX07 | `node --test tests/integration/IX07/journey.test.ts` 및 `npm exec --no -- playwright test tests/browser/IX07/journey.spec.ts` | 계획상 해당 전체 여정. 선행/실제 환경·허가 전 실행 금지 |
| IX08 | `node --test tests/integration/IX08/journey.test.ts` 및 `npm exec --no -- playwright test tests/browser/IX08/journey.spec.ts` | 계획상 해당 전체 여정. 선행/실제 환경·허가 전 실행 금지 |

## 3. 증거와 자원 정리

결과는 `docs/04_test_reports/AV3/<ID>/RESULT.md`, 실제 진행은 WORK_STATUS다. CI/fixture/health는 실제 저장/Agent/브라우저·인수와 구분한다. 원문 Secret은 결과에 남기지 않는다. 실패 시 해당 task의 test output·정확 권한/연결·자료 버전을 먼저 대조하고 같은 오류 반복3회면 같은 방법을 중단한다.

P03 새 정식 DB/volume·신규 보호 파일은 후속 개발용으로 보존한다. 독립 저장 probe는 생성한 고유 `p03-probe-UUID`행만 finally 삭제하고 다시 0건을 확인한다. 일회성 npm/브라우저 cache·로그/process는 등록된 소유 경로/PID만 작업 끝에 정리하며 다른 서비스·프로세스·DB를 정리하지 않는다. 신뢰 CA는 검증 종료/만료 때 정확 지문1개만 회수하고 결과를 기록한다. 새 source/개발 DB를 임의 reset/drop/down-volume하지 않는다.
