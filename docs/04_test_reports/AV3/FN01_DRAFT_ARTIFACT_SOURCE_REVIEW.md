# FN01 원문 첨부 source 검수 기록

## 범위와 상태

2026-10-26, 승인 r3 F4E734B396485E574A8119AECA1731D4F38C2114B15AB285EF18DA1EABC584D0·WI r2 CFD7F41AB1967105177D82850B64830034661A20AA20D82677CFD249D02D84E3 기준이다. 담당 구현과 분리된 읽기 전용 검수이며 실제 PG/SQL 실행·파일·서비스·브라우저 검증은 하지 않았다. UI와 시험은 아직 작성 중이고 전체 업무 검수 완료가 아니다.

## 첫 고정 서버·SQL 판정: 보완 필요 C0/I2/M1

| ID | 관측·반례 | 필수 조치 |
|---|---|---|
| I1 | route onRequest 예약 COMMIT 후 parser413/연결 단절 처리와 finishUpload의 try 이전 bytes/hash 불일치 기록이 없다. REJECTED/미생성 예약 해제 전이가 없어 파일0 잘못된 본문 반복도 RESERVED/초안20·owner quota를 소진한다. | 동일 intent의 실제 attempt/작성 상태와 실패를 결박한다. 생성 없음과 다른 작성 차단을 입증한 예약만 해제하고 불명은 UNKNOWN·원문/예약 보존이다. 프로세스 메모리 부재/TTL만으로 해제하지 않는다. |
| I2 | 지연 완결 trigger가 intent만 감시하여 FINALIZED 후 commands의 receipt NULL/request_hash/state/result_ref 별도 변조를 차단하지 못한다. 귀속도 원 command/receipt/audit 결박을 재검사하지 않는다. | FN01 완료 command만 후속 변조를 제한하고 귀속에서 원 upload fact를 정확 검증한다. 정상 최종 transaction 안의 최초 결과 완성은 유지한다. |
| M1 | 다른 미확정 생성 명령은 partial UNIQUE23505→공통503/reconcile-first로 반환되어 r3의409와 다르다. quota/초안 한도도503으로 분류된다. | 정확 충돌/한도만 제한적으로 매핑하고 무관 DB 오류를409로 숨기지 않는다. |

Main 판단: I1/I2는 필수 보완이다. M1도 명시 계약과 다른 복구 분류이므로 이 업무 안에서 보완한다. 원 구현 담당에게 수정 round1을 배정했고 Main은 같은 제품 파일을 수정하지 않는다. 정적 finding을 정식 Developer FAILURE_REPORT 횟수로 계산하지 않는다.

초기 관측 누락 중 GET 권한 gate와 attempt 전달, PUBLIC 실행권/지연 완결 제약 자체의 추가는 고정 source에서 확인했다. #active 부재만으로 이전 writer 종료를 인정하지 않고 독점 경로·closed seal·원 bytes/hash를 요구한다. 기존 PROJECT upload guard/보호 GET는 변경하지 않고 귀속 위치를 해당 GET로 읽는 정적 연결을 확인했다. 이 확인은 실제 동작·SQL 권한 PASS가 아니다.

## 검수 지문

| 파일 | SHA256 |
|---|---|
| apps/server/modules/projects/repository.ts | D771047F73B132A76031EA0D029D87374EE9E1F1E341CB0422CE68FE120B24AD |
| apps/server/modules/projects/routes.ts | A8EE19D955812139622D0F69ADEC8765D54FEBFF5EB19D5A1C9B6C947408EA24 |
| apps/server/modules/projects/draft-artifacts.ts | 51BFE8F14C29E999FFF7EBDAF22E629BD1AE4B9FEA5597136D91E3D5F74D6319 |
| apps/server/modules/projects/draft-artifact-routes.ts | EF9239F04B39C1A01062C29D8CE40C00E6A9D33B4063442758A4610E77CE7A8D |
| apps/server/modules/projects/draft-artifact-files.ts | 73CC68FC43431DE035C929D2A99B4C99F4939BFCAAA874C66331E69FDD675CE8 |
| apps/server/storage/artifact-store.ts | D2F45213C69CBD4B3991A62AC91AEED92C2C970D0541EA1D4399891BED45FA31 |
| contracts/draft-artifacts.ts | D33E299929915CC72240FDD2EAB9032D11ECF85A19E54C5D9007572129EE0AD5 |
| db/migrations/0042_draft_artifact_storage.sql.pending | 0AC1B370146E8924DCC412A5053E649F12B9281B6B2C2022AF38F5190E2D566F |

## 실행 증거와 남은 검증

- Main c23d47: 실제 ApiClient→buildApp.inject→기존 인증/초안GET200 후 DRAFT upload404≠201, exit1/1FAIL/0skip. 초기 route 부재 RED이며 후속 저장/귀속 검증을 대신하지 않는다.
- 담당 보고: 실제 service/repository·transaction fake·메모리 file port 8건과 입력2건, 10PASS/0FAIL/0skip. Main 최종 직접 재실행 전이며 실제 PostgreSQL·파일·경합 증거가 아니다.
- 수정 후 예약 뒤 단절/413/hash불일치와 동일 intent 시도, 원 command 사후 변조 방지·정상 귀속, 다른 생성 명령409를 검수한다. 실제 PG 직접 DML·trigger/FK/권한/COMMIT는 이번 승인에서 제외되어 NOT_RUN으로 유지한다.
- 등록된 일회 root의 실제 ArtifactStore 수직 시험·UI/DOM·기존 직접 영향 회귀와 최종 독립 검수는 남아 있다. 현재 해당 QA 자원은 생성0이다.

## 수정 round1 — scoped 재검수

- 담당은 I1/I2/M1 반례3건의 RED(exit1/0PASS/3FAIL/0skip) 후 수정했다. Main이 과거 RED를 다시 실행하지는 않았다.
- Main21ae21: node --test tests/unit/FN01/draft-artifact-input.test.ts tests/unit/FN01/draft-artifact-service.test.ts → exit0/14PASS/0FAIL/0skip. 실제 서비스·route와 transaction fake/메모리 파일 port이며 SQL 정의1건은 source assertion이다. 실제 PG 직접 DML·구문·권한/제약·경합·COMMIT 증거가 아니다.
- 실행 대상 지문: input F222AD479C59D1F29802FF2FE44080045D31AB0965A627204A7A07E2ABD5FDB0, service A6C68328A899FE6C48FAA29CC56D2AD2E62CD712AE26735033CC5798C24D8998, fixture 54666C734B4C94415A742E0448ED943968481CD0DEF9CF65B51CEB912DE9B34A.
- 독립 scoped 재검수: I1/I2/M1 모두 ADDRESSED, 수정에서 새 C/I0. parser/abort→제한 종결 함수와 body mismatch 처리, attempt0만 해제/시작 이력 UNKNOWN 보존, 원command/receipt/audit 후속 불변 및 선택/귀속 공통 provenance, 정확 오류만409/413 매핑을 정적으로 대조했다. 검수자는 시험을 재실행하지 않았다.
- 재검수 시작/종료 지문: draft-artifacts.ts 7A041336B45822D72FEB58F4EB8FC4156CDFE386978F07806EDF7E901242F7B0; draft-artifact-routes.ts 47B3A75AE917EE7F53CE9A911F50F6E7DF689970DA1AAAA09397D6D64D30D5F8; pending0042 C75EE6247C792EDDF3778245491B02B657B95E89DDA7B68DD31CBCCEC67B7CD3.
- 실제 abort socket·파일 close/sync·프로세스 재시작·PG 직접변조 거절과 서비스/사용자 인수는 NOT_RUN이다. UI/실제ArtifactStore 수직 시험·전체 업무 최종 검수는 남아 있다.

## 파일·UI 후속 검수와 최종 실행

- A1 실제 Windows fsync EPERM은 새 DRAFT 게시 파일의 O_RDONLY sync에서 재현했다. 새 복사본 O_RDWR sync/readhash/close·lstat/realpath/fd identity의 좁은 보완은 독립 C0/I0/M0다. 기존 PROJECT put/read/#bytes는 보존했다. A2 실제파일/in-process3건 PASS, EOF후 본문 동일성을 Main이 대조했다. 실제 OS crash/디렉터리 fsync 내구성·악성 symlink 생성은 NOT_RUN이다.
- REJECTED 미생성 이력21개가 보관 projection20개 상한을 깨는 조합은 원 intent/event를 보존한 채 조회에서 REJECTED만 제외했다. UNKNOWN·격리·미선택은 유지되며 추가 한정 C0/I0/M0다.
- UI 초기 C0/I3/M0: native fetch 결박,403/remount 뒤 옛ref/hash표시,CSRF교체전 지연GET채택. B1 실제5반례 RED 뒤 보완했고 scoped 모두 ADDRESSED였다. 그 delta의 다른초안metadata 혼합1건은 B2 실제RED로 확인하고 actual targetDraftId→current buffer 결박으로 수정했다. round2 새I1 ADDRESSED·새C/I0다.
- Main은 EOF 여분개행만 정리된23현재hash와21이전검수/실행hash의suffix 복원을 독립 확인했다. 기능/본문/중간개행/기대·timeout 불변이며 직접 diffcheck0다. 실제파일 시험의unit→integration 분류 이동도 이전bytes를 먼저 확인했다. 현재 지문·비의미 부모는 SourceManifest를 따른다.
- 마지막 test-only3파일 검수 C0/I0: 기존DOM14552bytes prefix D0F46477를 보존하고 새초안 첫저장case만 추가했다. 기본 nativefetch/actual app.inject 응답을 사용하며 고정201/핵심 경로 bypass는 없다. fixture empty옵션만 초안0개, 기본초안1개·정확 INSERT/UUID/owner/client·전체transaction rollback 모델을 보존했다.
- Main aa1e89 최종48PASS/0skip·타입0, 제품불변10009f build0. B3 914794 기존6반례/원문귀속과빈초안 첫POST→ID GET→업로드/선택/save/재조회/원문 두case 모두PASS(0skip)다. B3 자원은86a9bf 정확 정리·968a68별도양root부재/관련process0이다. 실제PG/served/로그인·권한/실Agent·전체Stage PASS로 승격하지 않는다.
- 원담당은 승인 r3 source/UI/pendingSQL/syntheticQA 범위 COMPLETED로 제출하고 writer 소유권을 해제했다. Main은 같은 제품 파일을 직접 수정하지 않았다. 전체 결과는 FN01_DRAFT_ARTIFACT_STORAGE_RESULT.md다.
