# FN14 준비기록 서버 연결 검수 결과

2026-11-01 / Main 어울 / 구현·독립 검수 분리

## 판정과 범위

기채택 준비기록의 서버 연결·핵심 합성 검수 완료. 전체 FN14·UI09·Stage·작업계획은 미완료다. 기준 `codex/av3-stage-b` / `b6870ce39eee0c24e83d9808a813c12399a08255`, WI SHA256 `5E6EC9566A44A2D485198172F26794B0EADB552D8A52EE92CC4EA3C0A0DB030D`.

기존 POST `createTransferPreparationRecord`와 고정 GET `/api/v1/projects/:projectId/transfer-preparations/:id/versions/1`을 실제 서버 클래스에 연결했다. 같은 PoolClient의 현재 인증·OWNER/제어·명시 정책·부모/선택 잠금·보호 재읽기, 새 저장의 최신 draft 검사와 과거 조회/replay의 고정 증빙을 구분한다. 역할 관계는 실제 보관 binding 증빙으로 검산한다. 기본 미연결은 닫혀 있고 REGISTERED_CONNECTION target reader가 없는 nonnull 선택은412다. 후보·HOST_TRUST를 실제 등록으로 대체하지 않았다.

화면은 원 직접 승인 B7F928C1에서 제외됐으므로 별도 후속 결정 전 Web6은 변경하지 않았다. 실제 DB·권한/정책 부여·키·사용자/백업 파일 조사·서비스·Agent·실제 이전/재개는 실행하지 않았다. 새 DTO·SQL·migration·목록/검색/다운로드 API는 없다.

## 최종 변경 6개

| 파일 | SHA256 |
|---|---|
| apps/server/modules/transfers/preparation-record-source-adapter.ts | 52C2E3B22C94643710315804E192EF2F513F4DE0F532AF6F5817475BA0BC8D19 |
| apps/server/modules/transfers/preparation-record-verifiers.ts | EBACFA332BDB5FFA9DC8502E090198316AD54AE32982BA703757D28A6E82B0C2 |
| apps/server/modules/transfers/preparation-records.ts | E04DADCF7491347983AAF1083BEF5604AF9589206B2A8DD3433467DD7247DD68 |
| apps/server/modules/projects/routes.ts | DF5E30F15E09EBB53A453363F23AA23F7B73BE9D8D2C2BC545FE19D679AB4536 |
| apps/server/modules/access/project-command.ts | E9597329F27DFF20D68927CF6CCE71FE679B38421FA7123D4E9FDC7919886EE1 |
| tests/unit/FN14/preparation-record-connection.test.ts | 82D56FE379A341AC2C2FEE1DA59ECCF7EE943E29871DC555E4929AF8197FD5FD |

기존 store SHA256 `565257E429A019B0B8A38A6908BD9CA32BF0C21E949F6EFAB0BFC1D5B578DF27`와 input·0060 pending·server app.ts·Web·기존 시험·보호3은 보존했다. AUTH 완료 transaction 밖의 추가 DB 호출, 임의 callback의 성공 태그만을 실제 공급자 권위로 승격하는 연결은 하지 않았다.

## 실행 증거

- Main `1d3594`: 실제 buildApp/기존 정책 조회200·동일 메모리 인증/PoolClient SQL2 성공 후 준비 고정 GET이 미등록404를 반환해 예상 인증401과 달랐다. 신규시험4D6AFAC7,0PASS/1FAIL/native1,1448.2966ms. 새 store의 성공 저장까지 도달한 증거가 아니다. Primary `0336ab`와 분리한다.
- Primary `3e0eec`: 같은 실제 route 반례가401로 연결돼 1PASS. 이후 보호 선택·저장/조회·과거 replay 반례를 보강했다.
- Main **`8950b5`: 신규9+직접 인접43=52PASS, FAIL/SKIP/CANCEL/TODO0**,2296.4347ms. 고정 Node의 아래 시험·타입·diff 모두 exit0이며 최종6지문이 일치했다. Primary `8e996b` 52PASS/2354.7111ms·타입1cfd47과 합산하지 않는다.

```powershell
& 'C:\Program Files\nodejs\node.exe' --test tests/unit/FN14/preparation-record-connection.test.ts tests/unit/FN14/preparation-record-store.test.ts tests/unit/FN14/preparation-record-input.test.ts tests/unit/FN14/preparation-record-schema.test.ts tests/unit/FN14/preparation-analysis.test.ts
& 'C:\Program Files\nodejs\node.exe' node_modules/typescript/bin/tsc --noEmit -p tsconfig.base.json
git diff --check
```

검사에는 실제 임무·맥락·역할 생산 클래스, 같은 db identity·선택 잠금/보호 재읽기, 새 저장/과거 head·intent 진행 후 조회/replay, 실제 역할 binding 유무, target412, 새 client GET·현재 OWNER/작성자/정책/세션 기한, 저장 상한429/rollback·COMMIT 불명·익명/기존 POST 경계를 포함했다. SQL·인증·COMMIT·선행 plan/method/candidate는 메모리 대역이다. 같은 DB의 잠금 호출 순서 검증은 실제 PG 경쟁 실행 증거가 아니다.

- 독립 최종 **C0/I0/M0**는 위 최종6의 소스·시험 읽기 판정이다. Main 실행과 분리한다. Web 변경이 없어 Web 빌드를 반복하지 않았다.

## 실제 보호 원문 코드의 합성 QA

기본52와 별도로, 등록된 합성 원문3개를 실제 ArtifactStore·ProjectDocuments/ProjectKnowledge/ProjectConversations와 ContextSources/Contexts가 읽고 준비기록 저장 및 문서 격리404까지 검산했다. 해당3 writer가 원문 DB행을 생산했다는 증거는 아니며 DB행은 저장형식 fixture다.

Main **b57b49 1PASS/native0,1240.5444ms**는 당시 시험5BB5E003과 현재 제품5에서 실행했고 명령 전후6지문이 불변이었다. Primary eb87a0 1PASS와 별도다. 실제 원문 환경변수는 finally 복원했다. 이후 시험 타입·음성 보강을 이유로 원문 QA를 다시 만들거나 실행하지 않았다.

QA는 새 전용 root·소유 표식1+합성 blob3, 총1086B였다. owner/link/정확 목록/bytes/hash를 대조해 **264bba에서 파일4+빈 디렉터리3만 비재귀 회수**, UTC16:25:58<등록 만료16:48:42, **c29d16에서 root 부재**를 독립 확인했다. 첫 정리836e5b는 JSON 시각 자동변환 비교 가드에서 삭제 전에 멈췄다. 37b693 원시각/해시·소유 일치·미만료 확인 후 DateKind String/DateTimeOffset 비교로 바로잡았다. 권한 변경·기한 연장·강제 삭제는 없었다. 정상 Node 명령 종료·app.close/listeningfalse·live handle0은 확인했고 정확 PID는 NOT_CAPTURED다.

## 오류·운영 예외와 남은 작업

수행자 보고의 준비 fixture5·타입4·UTF-8 1과 Main의 읽기/정리 준비 오류는 원 제품404 RED와 분리해 WORK_STATUS에 기록했다. 원 실패를 최종 PASS로 소급하지 않는다.

별도 운영 예외: 수행자는 경로 추정6건이4호출에 반복됐고 3회 중단·보고 규칙을 놓쳤다고 인정했다. Main은 해당 조사 추가 지시/재시도를 중단하고 실제 rg 목록348에서 허용6 literal을 직접 확인했다(125983). 이 누락을 코드 C0/시험 PASS로 숨기지 않았고 PMO에 보고했다. 코드 정식3실패나 실제 인수 승인으로 확대하지 않았으며 Main 제품쓰기·담당 교체·권한 변경은 없었다.

실제 PG/SQL·동시 잠금 경쟁·FS/DB 원자 snapshot·운영 HTTP·정식 환경 반영·Web 통합·사용자 인수·Agent/이전은 미검증이다. 검산한 직접 HTTP writer의 프로젝트 부모 잠금은 임의 메서드 직접 호출·외부 FS 변경·미대조 writer까지 보장하지 않는다. 실제 파일 읽기/격리/hash 실패를 성공 gap으로 넘기지 않는다.

다음은 별도 결정 대상 Web6의 명시 선택→준비기록 저장→동일 원명령 재확인→고정 조회 연결이다. target 보호 reader·실제 이전/재개도 미완료로 남긴다. 현재 화면에서 새 저장 기능을 쓸 수 있다고 안내하지 않는다. 후속 실제 환경 검수는 위 API와 현재 명시 정책·확정 임무를 사용하되 새로운 실제 실행 승인을 대조해야 한다. rollback은 이번 소유 통합 commit의 정상 revert다.
