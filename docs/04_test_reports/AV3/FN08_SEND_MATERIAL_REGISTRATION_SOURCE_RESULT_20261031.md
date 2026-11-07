# FN08 SEND 자료 지속등록 r2 A — 소스 검수 결과

## 판정

승인된 코드·미적용 SQL·합성 검증 범위의 검수 통과. 실제 기능 제공·DB 적용·SEND·Agent 실행·전체 FN08 또는 작업계획 완료 판정은 아니다.

기준 branch codex/av3-stage-b, 시작 HEAD a77415d14cc65ca6d945900541320e1944cc958c. Main 어울은 관리·검수·통합, 기존 Primary는 단일 코드 writer, 기존 Reviewer는 읽기 전용 검수였다. writer 반환·실행 handle0·별도 QA 생성0을 확인했다.

## 승인·변경 범위

- 직접승인 FB59E8C7A040D69CF9D11D8E753A3F5573647BE430E8A95E950EC2BABACABE6C.
- r2 후보 2F04BB32F37C2968F1B1570B1792C27649C44D3E956DA5328C0FE1466F1401D5, 원계약 F379F60DD4BC5322B6EFB5694C3D4DEAA283F338C4808D6F2966753089FA349A.
- WI490C5E0D839EC380B54CCD2870FC2CDD133AC0290CB7E8B2FCF5A4ECFC36D7F6. 기존 시험 fixture 부록5FE4F963A3594772141034481A013C9CD6966E5A65EDDAFEE2C46558AED5235D 및 정책 fixture 부록DD1224786D954ADBF18771D5069DB087B014381265DF0AE6587FC7FD15DB5FCE로 같은 시험 파일만 추가 허용했다.
- 정확 소스/시험/미적용 SQL9경로와 Main 결과·계획·현황3, 부록2만 통합한다. 원 WI·승인·기존 SQL·보호 미추적3은 보존했다.

## 구현과 보호

pre-envelope descriptor의 manifest hash와 고정 현재 사실을 대조하고, 복제한 준비본을 같은 queue transaction의 append로 명시 전달한다. 같은 PoolClient에서 예약·명령·HELD_SYNTHETIC_ONLY outbox와 manifest/material을 저장하고 기존 parts reader가 정확 부분 bytes를 검산한다. 등록 의존성이 없으면 새 쓰기는 거절하며 기존 역사 read는 보존한다.

proof receipt→정확 자료 binding→challenge 소비를 연결했다. 동일 proof/명령 재확인은 추가 등록·과금 없이 원형을 검산하고, 소비 완료 후 누락 binding을 사후 생성하지 않는다. 메모리 transaction의 rollback과 COMMIT 응답 유실 뒤 원명령 재확인을 검사했다.

새3표 합산 canonical snapshot UTF-8 논리 bytes/행 수는 project100000행·1GiB, 같은 grant ID 모든 버전/credential 합산10000행·64MiB로 제한한다. 만료 이력도 산입한다. 기존 SEND100·예약/queue2MiB·0059의 별도 quota와 기존 프로젝트 차단을 유지한다. 기본 app/provider 주입·실원문 공급·USER_INSTRUCTION/DD166F 차단 해제는 없다.

미적용0062는 부모 실제 키·canonical helper·새행 immutable·project 잠금·양방향 deferred 완결을 정적으로 대조했다. SQL의 PK/FK/trigger가 실제 PostgreSQL에서 동작한다는 증거는 아니다.

## 검증 증거

Main 01dc56: 다음 정확6파일을 Node24.22.1의 --test로 실행, 107PASS/0FAIL/0SKIP/0TODO, exit0, 7619.2077ms.

```powershell
& 'C:\Program Files\nodejs\node.exe' --test tests/unit/FN08/execution-material-registration.test.ts tests/unit/FN08/execution-material-registration-store.test.ts tests/unit/FN08/execution-material-registration-schema.test.ts tests/unit/FN08/execution-instruction-queue.test.ts tests/unit/FN08/execution-instruction-material-parts.test.ts tests/unit/FN08/execution-materials.test.ts
& 'C:\Program Files\nodejs\node.exe' node_modules/typescript/bin/tsc --noEmit -p tsconfig.base.json
git diff --check
```

Main dae085의 type/noEmit·diff 모두 exit0. UI 변경이 없어 Web/browser·전수 회귀는 반복하지 않았다. 새 자료 입력·생산/조회·합성 P256 proof 결박·재확인, 정상·변조·만료·권한 표식·누적 경계·rollback 및 직접 영향 기존 소비선을 메모리에서 확인했다. source9/보호3 지문은 Main2e1d03에서 제출값과 일치했다.

독립 검수: 서버4 C0/I0, 최종 SQL4EFEF392 정적 scoped C0/I0, 최종 fixture EFC66D60 scoped C0/I0. 미해결 Critical/Important0. 실제 DB 검수로 승격하지 않는다.

## 실패·보완 이력

1. 첫 constructor 전면 거절 RED는 조회 전용 실제 소비자를 무시한 잘못된 기대였다. 철회하고 실제 역사 read 및 새 쓰기 거절로 고쳤다.
2. SQL471B76F8의 Important3: 외부 commandId project 유일성 확대, authorization_receipts의 없는 project_id 추출, START 공통 자료 경로 오분류. 해당 반례 RED→GREEN 후 035709BD에서 기존3 해소를 확인했다.
3. 그 보완에서 미등록 part가 분류 대상에서 빠지는 Important1을 발견했다. 등록 SEND command-prefix로 먼저 분류하고 exact part/target은 완결 검사에서 검산하도록 수정했다. a2f200 RED→8bfd7f 정적/모델6PASS, 최종 독립 C0/I0다.
4. Primary9e3a9c는107 중101PASS/6FAIL이었다. control 원시험0fcf9d도 동일6FAIL로 기존 정책 fixture의 원명령·receipt·audit 누락을 확인했다. 부록DD122478 범위로 그 증빙만 보강해9fb120 해당6PASS. 과거 실패를 소급 수정하지 않으며 최종 전체 PASS 근거는 별도 Main01dc56이다. 기존 guard·음성 단언·기대값은 보존했다.
5. fixture alias/캡처 및 도구 경로·PS 보조명령 오류는 현황에 분리했다. 실제 코드 실패3회로 가장하거나 검사 기준을 완화하지 않았다.

## 최종 소스 SHA256

| 경로 | SHA256 |
|---|---|
| apps/server/modules/executions/execution-instruction-store.ts | 5E3F703F2B48DFC3A2CCF6EB139864B169925A987C5267EA2C0256D197FCB78E |
| apps/server/modules/executions/execution-instruction-queue.ts | 5349670A081347C3075C12DA949CF4DC236A512DA1E901944B39645E160897CD |
| apps/server/modules/executions/execution-material-registration-input.ts | 45178F80004A0727CCF92456B6BBE41B461FBF4F6022204777C35FF5770C0026 |
| apps/server/modules/executions/execution-material-registration-store.ts | 20C915CBF2F8AB8C52655D98C62CD8820DADABEBC71568DCCC587D036CFD9257 |
| tests/unit/FN08/execution-material-registration.test.ts | C019C04A5823587297F61D1F3CB27586CD4F6F3CAE4557E2E9CCAD18799BCC95 |
| tests/unit/FN08/execution-material-registration-store.test.ts | 53CAE34D78B9F72C24960C0AAC148CC18F3582B53E9ACD37E829246BF4CE73C5 |
| tests/unit/FN08/execution-material-registration-schema.test.ts | F4D77AE52D0AC89B8CAD872D03D5096A1D6936808390A266338C106A7F4D005C |
| db/migrations/0062_execution_material_registration.sql.pending | 4EFEF392105984B5B1969B480D2D9AF2F3EFEA4F0E855F1730A9152019E3987E |
| tests/unit/FN08/execution-instruction-queue.test.ts | EFC66D603D6DA00452185637FA7D1AA748D9D2DB847EE52BDD72334E6B0AB5EC |

## 미검증·잔여와 복구

실제 DB·SQL 적용/구문/trigger/FK/원자성/경합·권한/GRANT·키·사용자 파일 조사·서비스·실제 HTTP/provider/SEND/Agent·기존 프로젝트 차단 해제는 수행하지 않았다. 원문·키·Secret을 새 저장행이나 로그에 보관하지 않았다. 실제 지속 보존·재시작 복구·사용자 화면의 기능 인수는 미확인이다. 화면/API/DB 전체 기능 완료로 표시하지 않는다.

이번 자료 등록 소스의 rollback은 게시된 소유 commit의 일반 revert다. migration은 미적용이므로 DB 되돌리기는 없다. main 통합/배포·새 branch/자동화/기존 작업 정리는 하지 않는다. WORK_PLAN의 나머지 실제 연동·미채택 계약은 남아 있으며 다음 단위는 기존 승인·선행과 실제 소비선으로 선정한다.
