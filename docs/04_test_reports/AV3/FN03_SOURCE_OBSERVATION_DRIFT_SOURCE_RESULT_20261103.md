# FN03 문서 소스 관측·선택 — 소스 구현·합성 검수 결과

작성일: 2026-11-03 / Main 어울 / 기존 Primary 구현·기존 Reviewer 독립 읽기 검수

## 판정

승인된 INTERFACES §15.4의 초기 연결·변경 유지·제안 수집에 대한 소스 생산·소비 연결과 수행한 합성 검수를 마쳤다. 실제 보호 관측 공급자·DB·서비스·사용자 인수는 미검증이며, FN03/UI06 전체와 Stage B·작업계획은 부분 구현 상태다. 기본 공급자 부재는 412로 닫힌다. 이 결과는 실제 파일 관측·제품 실행 허가가 아니다.

## 기준과 변경

- branch: codex/av3-stage-b. 코드 시작 기준은 da3f4bbb, WI 게시 기준 a5a2b229이다. 보존 WIP는 52a5ea32→f8ecde82이며 최종 게시 SHA는 WORK_STATUS와 실제 Git으로 확인한다.
- WI: docs/work_packages/FN03_SOURCE_OBSERVATION_DRIFT_IMPLEMENTATION_20261103.md / SHA256 B78564830DF2E99D344B7A106C0799240256A1BFD7236ADA5FAD60A2C08B7281
- INTERFACES SHA256 1DB611C186DFD908FE4CA9CA1B25E4E82FF5CDC39511311205E0C6EFACF096E2 / 원 연산 linkDocumentSource·proposeDocumentSourceChange를 구현했다. 미채택 정책관리 후보를 채택한 것이 아니다.
- 정확 허용34 중 변경27이며 새 SQL은0072.pending 하나다. Main 문서 외 관련 없는 자료·보호 untracked3는 보존했다. 원 applied/pending SQL을 고치지 않았다.

## 구현한 흐름

1. UI06의 환경·경로·관측시각 선택으로 내부 exact ref/hash를 고정한다. UUID/hash 직접 입력, 자동 파일 관측·수집·POST는 없다. 저장 전 보호 포트가 원 문서·프로젝트·등록·세션·현재 정책/제어·proof·기한을 재검산한다.
2. 초기 LINKED v1과 기존 DETACHED v2 원형을 보존하고, 관측·KEEP_SERVER·COLLECT_PROPOSAL은 별도 불변 stream/head로 보관한다. 과거 비교와 현재 OS 검증을 구분하고 viewer에 원상세를 공개하지 않는다.
3. COLLECT는 기존 보호 Artifact reader·UTF8 parser·proposal/diff 경로를 실제 소비한다. 원 부모 명령의 단일 receipt/audit·승인 소비·quota 아래 import/proposal/diff를 묶는다. 본문·확정본·소스 원문은 바꾸지 않으며 별도 사용자 채택/확정이 필요하다.
4. SOURCE_LINK_EVENT의 개별64KiB와 기존 공통행의 유효 입력을 구분한다. metadata 미래예약은4S+640KiB/최대10행, 원 Artifact 재계상0·diff 예약2배/실제1배다. table별 collector·최초 생성 명령 귀속·고정폭 비용·양방향 완결을 구현했다. 실제 SQL 실행 증거는 없다.
5. UI08의 별도 승인 작성·결정·exact 원명령 결박→원 문서 버전 복귀→명시 전송을 연결했다. UNKNOWN은 원 명령을 보존하며 자동 재전송하지 않는다. IO/COMMIT 불명은 held를 보존하고 재게시·재수입을 막는다.
6. 원10초·세션·정책의 최소기한을 넓히지 않는다. 응답 기한과 원 DB query의 실제 정착을 구분하고, 늦은 source query 재진입을 막는다. 기존 인증/CSRF/COMMIT·rollback·release 소유와 별도 DENIED 감사는 원 repository에 남긴다.

## 실제 수행 증거

| 범위 | 실제 결과·적용 한계 |
|---|---|
| Main 최종 UI06 전체 | bb648a:26PASS/FAIL0/skip0/6852.3218ms, node --test tests/unit/UI06/document-source-observation.test.ts. 최종 시험60F650FE 지문. 실제 React App·보호 원문 코드·명령 helper를 메모리 DOM/API/DB/store 대역으로 실행했다. 실제 서비스 UI→DB E2E는 아니다. |
| Main 직접 인접3 | 6e9629→3585b2의 기존 history/list/records19건 PASS. 파일/관련 제품은 이후 불변이다. 같은 묶음의 당시 UI는25PASS/1FAIL이었고 이 실패를 숨기거나 소급 PASS하지 않았다. 수정된 UI 파일만26건 다시 확인했다. |
| 새 query 수명 음성 | ef3a9c:1PASS/skip0/1314.6741ms. 정확 명령: node --test --test-name-pattern='관측 기한종료' tests/unit/FN03/document-source-observation.test.ts. 실제 query 대신 deferred 대역이며, 응답 종료를 정착으로 표시하지 않는 동작을 확인했다. |
| Main 타입 | 1aca56: node node_modules/typescript/bin/tsc --noEmit -p tsconfig.base.json, exit0. 시험 보완 뒤 최종 확인이다. |
| Main Web 메모리 build | 62773e:원 Web root 설정을 사용하고 configFile/envDir/publicDir=false·write=false·emptyOutDir=false. outputs3/chunk1/modules504/2650447bytes·exit0. dist/실행 서비스·배포 artifact를 만들지 않았다. |
| quota·게시 핵심 이력 | 08e384:당시 core25+기존quota19=44PASS/skip0/1593.9349ms. quota6939272B/관측D728DEFB는 불변이다. 현재 core98F78222에는 query 수명 음성1이 추가됐으며 이전44를 현재 전체 재실행으로 표기하지 않았다. |
| UI00 인접 문구 정합 | Primary852eea:2PASS/skip0/887.469ms.10/27 source92cef047 이후의 현재 문구1개만 맞췄고 5링크·렌더IO0·비실행·미선택 단언은 유지했다. Main의 추가 확인은 Vite cache쓰기 EPERM으로 단언 전 종료해 별도 도구 오류로 남겼다. |

Web 메모리 build의 실제 명령 구성(파일 저장 없음):

```javascript
import {build} from 'vite';
import config from './apps/web/vite.config.ts';
await build({...config, configFile:false, envDir:false, publicDir:false, logLevel:'warn', build:{...config.build, write:false, emptyOutDir:false}});
```

위 코드는 Node --input-type=module로 실행했다. 제품/시험 소스와 일반 컴파일러 캐시를 실사용 원문/백업자료 검증으로 취급하지 않았다.

서버 정상 LINK/KEEP·고정GET/replay, COLLECT의 실제 보호 reader/parser/proposal/diff·단일 부모 귀속·기존200첨부/한글사유20000자 보존, COMMIT/게시 응답유실·원Artifact 부재/격리, 원문 불변, 원10초/최소정책100ms·원callback 정착 분리, 실제 UI08 왕복·원명령/UNKNOWN 보존을 위 합성 경로에서 확인했다. DB trigger/RLS/직접 DML·실제 경합과 실제 OS provenance는 이 합성 결과로 증명하지 않는다.

## 발견·보완과 독립 검수

- 예정 diffRef와 실제 id/bytes/hash·단발 게시의 결박 I1을 보완했다. 기존 유효94692B 공통 proposal을 새 SourceEvent64KiB로 잘못 제한하지 않도록 table별 계상을 정정했다.
- 저장 Promise가 끝나기 전 lease가 닫히는 문제, 최초/최종 query의 원기한 보호 및 최소 정책기한 연결을 보완했다. 원권한·timeout은 완화하지 않았다.
- UI08 복귀 링크, 인증/권한 오류 뒤 관측 원상세 회수·401 부모 전달·늦은 응답 소유, optional session 없는 기존 읽기 전용 호출을 보완했다. 원 pending/UNKNOWN buffer는 지우지 않았다.
- 새 소스·첨부·기록주체 패널의 sibling key 충돌을 종류 prefix3개로만 구분했다. 원 정체성 suffix는 유지하며 실제 App 시험은 경고0·세 패널 각1개·원명령 보존을 확인한다.
- Main fresh의44PASS/1FAIL은 정상 crypto/UI 표시 선행 대기 누락이었다. 최초 시험 보완의25PASS/1FAIL은 legacy Response.json 소비에 잘못 요구한 body.locked 관측 조건이었다. 원 JSON method/receiver/실제 parse와 반환을 유지한 유한 대기로 정정했으며 crypto stub·skip·제품기한 확대·단언 삭제는 없다. 최종26PASS와 이전 실패를 각각 기록했다.
- 기존 Reviewer가 원 guard/승인 결박·SQL collector/정산·최소기한·전체 연결·UI 회수/optional/key·시험 선행 정착을 각 정확 지문에서 독립 읽기 검수했다. 최종 변경 범위의 미해결 Critical/Important는0이다. 시험 선행 정착 검토는60F650FE, source UI38035FE2·승인1C756D1A·DocsPage7EFD7C5D, service15B9CA18·documents41C4DC28·SQL E561CDAD에 적용한다. 독립 시험 실행이나 실환경 PASS가 아니다.

## 미검증·남은 작업

- 실제 보호 관측 공급자의 생성/검증·OS/CNG/서명·설치·실제 source 파일 접근은 미구현 또는 미연결이다. 현재 기본412를 PASS/지원true로 바꾸지 않는다.
- 0072를 포함한 실제 DB 적용·SQL 문법/trigger/RLS/ACL·quota/승인/탈퇴·detach의 실제 동시 경합, 실서비스 로그인·브라우저 Network·시각/사용자 인수는 NOT_RUN이다. DB 상태를 새로 조회하지 않았다.
- 키·CA/Secret·실제 DB/권한·정책/GRANT·서비스·Agent/SDK/CLI·제품의 실제 네트워크/HTTP·실자료/백업파일·P03R3는 실행하지 않았다. 승인된 Git private 게시 통신은 별도 보존 절차다. 이 단위에서 실제 키/권한을 새로 부여하지 않았다.
- native 최초 수신·위임 R2는 여전히 미채택이며 이 구현으로 해결되지 않는다. FN04 실행·시험 영향 증거와 실제 writer 안전 선행도 남는다. 보관 주장이나 합성 complete를 실제 증거로 승격하지 않는다.
- 다음 계획 작업은 위 실제 공급자/환경·미결 의미와 독립적인 승인 기능을 구분해 선정한다. 전체 작업계획 완료·PR/main 병합·배포·사용자 인수는 선언하지 않는다.

## 복구·무결성

실제 환경 변경은 없어 DB/service rollback은 없다. 코드 복구는 소유 source commit의 정상 Git revert 검토이며 f8ecde82가 마지막 추가 WIP 기준이다. 그 뒤5개 제품/시험 변경을 회수해도 f8ec의 미완료 구현이 남으므로 기능 전체 원복과 구분한다. 초기 코드 기준으로 돌아갈 때는 해당 범위의 여러 commit을 근거와 함께 검토하고 기존 다른 기능·보호3를 보존한다. reset/rebase/force/new branch·main 직접쓰기는 하지 않는다.

WORK_STATUS는 f8ec의 원 bytes를 prefix로 보존한 누적 기록임을 확인했다. 로컬 main04430432와 private mainf976ed5e를 각각 구분하며 변경하지 않았다.

## 최종 검수 파일 지문

저장소 상대 경로 / SHA256. 허용34 중 아래27이 a5a2b229 대비 변경됐다. 결과문서 자체의 지문·최종 게시 commit은 WORK_STATUS에 별도로 남긴다.

| 경로 | bytes | SHA256 |
|---|---:|---|
| apps/server/app.ts | 5514 | A36753547852614F9AFABDB0F898EC1017DDFFFE10699F030AB2C23A0EC1EC3B |
| apps/server/modules/access/project-command.ts | 28904 | BB14BA694EC6F28CF2B65BEB4FD73B54ECC26FEBDCEF52DBDAD08C86A031CF5C |
| apps/server/modules/approvals/approval-input.ts | 10835 | A4D2A8D1BA8F363196D13BA2E15F1DA41F4B7CF779A351213154249C49DECE7F |
| apps/server/modules/approvals/project-approvals.ts | 41195 | 35F37A756D82834F067F7267B2D113DD3733975E79595258D09FCCF8FC689AF6 |
| apps/server/modules/documents/document-source-link-history.ts | 6275 | 0467A556C1E02C2FFC6F0F3382922E6803635D7A9AB2610BFD66D70BCACF971B |
| apps/server/modules/documents/document-source-link-list.ts | 5950 | 50A72C49684CCC34F311F60718187CEFFB46B2E34157878DA60066D3B1CF999F |
| apps/server/modules/documents/document-source-link-records.ts | 11134 | F00FCBF2A863EC5E1BEFC11851BAA9ABBED1DD2B5B34C290D2AFFB8CE6A6D471 |
| apps/server/modules/documents/document-source-observation.ts | 11027 | D728DEFB1FA8911DE17546D8851FCD324F4AD8ABECD33CCCEE75897B801614C1 |
| apps/server/modules/documents/project-documents.ts | 35171 | 41C4DC28B621DEEC263E1ECE46560A03C3D8AA7917B59FBB6A41D4D129404482 |
| apps/server/modules/documents/project-imports.ts | 7351 | A0CDAFAB66FF412328332DE94A6ED96996B6DC604F7B20680ACA143C3A478F20 |
| apps/server/modules/documents/project-proposals.ts | 10892 | 6AFFB7F24F539D4118198FBC1CA0E73338AA771B847CC3B70B61B87BFC7DCAC8 |
| apps/server/modules/documents/project-source-links.ts | 33043 | 15B9CA18122C78E2243538D515B569E9D601F4408E056B9138AF956334F21167 |
| apps/server/modules/projects/project-storage-quota.ts | 27404 | 6939272B4E7CEC25B1CAD8F69D70D38F76EF8136B059DFC529FBB31BC12224D7 |
| apps/server/modules/projects/routes.ts | 81534 | F10F60577DDA57B745119CD86647E122BA43161838D03EF937C17FD2E296EFCA |
| apps/web/src/App.tsx | 65764 | AA04307AE08760CD45FAA543EDF47B7FDAEFBD3FDC1630191925D68101A082C6 |
| apps/web/src/features/connections/policy-editor-profile.ts | 4720 | A2B1C2B902915D73292B42506A89A45141371C41B54ED6787B5FFB806D839E91 |
| apps/web/src/features/decisions/ApprovalsPage.tsx | 47504 | 1C756D1A404F0A49CDE2B57B4EE00C0BF6741F43D342CA694D0EF2094A68E930 |
| apps/web/src/features/decisions/api.ts | 28411 | FE86D104C66F135B57533A6B57E6473C4F8C9D18263FE216864F8286E6C19129 |
| apps/web/src/features/decisions/source-link-approval-api.ts | 6381 | BD51A837B73A21A1B05B4C9D23579490D24DA335C6EEEBF41BBB3AC60A57B61B |
| apps/web/src/features/design-trace/DocumentSourceLinks.tsx | 15995 | 38035FE2D4AE49A082F340D9CB87B00EE54D9AEDBAEE8EB4E9788F7241446988 |
| apps/web/src/features/design-trace/DocumentsPage.tsx | 46098 | 7EFD7C5D21F3B10B01884B903EA62D96BD2F9C9FB9DBB46AA25DAA11AADBE973 |
| apps/web/src/features/design-trace/editor-api.ts | 18786 | 35CD2B5EC19C1EE51210E6D6B3F657ABF960DABAB3217794A4F8D4235AC53B63 |
| apps/web/src/features/design-trace/source-link-command-api.ts | 21627 | 8BA5700A03CA703C56707A01F175DB3CE6C10E2B10F251AD5497678D49AD0AB4 |
| db/migrations/0072_document_source_observation.sql.pending | 78912 | E561CDADB1BC68E426B6CD8D62417822B549756263463F252A9B032493706B06 |
| tests/unit/FN03/document-source-observation.test.ts | 24402 | 98F78222C9E2F04C4BA28365779A47E5EDED0866D90AD99D717961C03AC4B341 |
| tests/unit/UI00/settings-source-links.test.ts | 2006 | C3BF76CCD7F9A82C594C0B003E420AE231FA3F5B8EEDCF6D2170A7192609A952 |
| tests/unit/UI06/document-source-observation.test.ts | 88151 | 60F650FE0A40333785A21022F23E774D616AB810E41918BBC0E66EFC73C9357D |
