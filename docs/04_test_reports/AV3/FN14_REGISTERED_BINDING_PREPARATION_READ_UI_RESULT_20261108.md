# FN14 등록 정의 과거 결박의 준비 화면 조회 연결 결과

## 판정·범위

서버가 이미 반환하는 등록 정의 책임 결박을 기존 이전 준비 Web reader가 읽도록 연결했다. 실제 Page의 결박 선택→저장 직전 보호 재조회→준비기록 저장/정확 GET을 합성 검증했다. 제품은 `apps/web/src/features/transfers/preparation-record-api.ts` 한 파일의 snapshot 키/종류·준비 상태 검사만 수정했다. 실제 이전·이해합격·재개·서버/SQL/권한은 바꾸지 않았으며 전체 FN14/WORK_PLAN 완료가 아니다.

- 기준 main `285a1ff5d1fecea167ba452240e93f6587e92ac3`.
- 작업 branch `codex/av3-fn14-transfer-followup`.
- WI `docs/work_packages/FN14_REGISTERED_BINDING_PREPARATION_READ_UI_WI_20261108.md`, 최종 SHA256 `9ebb91b995b5af18188a8838df74a7de5baca6129c94f5ab7dff999369044a1c`.
- 최종 제품1/시험2 정렬 manifest `d48f7e77d2fea4cc3b47d0c82bcf368fb122f738bb5280181fe8b84ceaaeb9af`(path/bytes/sha256 compact UTF-8 JSON·BOM/끝 개행 없음).

## 변경 전후

기존 Web reader는 binding snapshot에 connectionKind가 있으면 추가키로 거절했고 CANDIDATE_ONLY만 허용했다. 서버 responsible-sessions, Web 책임세션 reader 및 FN14 source adapter는 기존 등록 정의 원형도 이미 지원했다.

optional discriminator가 없는 후보/CANDIDATE_ONLY와 명시 REGISTERED_DEFINITION/REGISTERED_DEFINITION_ONLY 두 원형만 정확 판독한다. unknown/null own kind·교차 readiness는 거절한다. snapshot:null에서도 기존 오류 코드를 유지하도록 optional 키 판정만 null/object 안전하게 처리했다. 원 hash·임무/역할/버전·RESERVED·handle null·권위 false·active 검사는 보존했다.

## 검증

| 검증 | 결과·증거 | 범위 |
|---|---|---|
| 실제 Page 등록 정의 선택 RED | 92a59b: 1 FAIL/skip0/exit1 | 정상 GET 뒤 기존 reader의 선택 거절 재현 |
| snapshot:null RED | e91496: 1 FAIL | optional 키 인자 평가의 TypeError 확인 후 오류 코드 보존 |
| 최종 실제 Page·reader | 8cf843: 24 PASS/skip0/exit0 | 후보/등록 정의·재봉인 오염·저장 전 재조회·UNKNOWN/late·영수증/POST 보호 |
| 서버 준비 연결/저장 인접 | 47b189: 30 PASS/skip0/exit0 | 합성 auth/DB 모델·기존 route와 고정 GET |
| Main 최종 타입 | 9f78df/session52703→baebf6: exit0 | 최종 소스·시험 타입 |
| Main 메모리 빌드 | 60d32e: exit0, 518 modules/661ms | Vite write:false·출력 파일 없음 |
| 원본/diff | Main d1777f, diff check0 | 제품/시험 원본 지문과 설치ID 외 본문 대조 |

정확 명령:

```powershell
node --test --test-name-pattern='등록정의 과거 결박은 실제 Page' tests/unit/UI09/preparation-record-ui.test.ts
node --test tests/unit/UI09/preparation-record-ui.test.ts
node --test tests/unit/FN14/preparation-record-connection.test.ts tests/unit/FN14/preparation-record-store.test.ts
npm run typecheck
node --input-type=module -e "import {build} from 'vite'; await build({configFile:'apps/web/vite.config.ts',build:{write:false}})"
git diff --check
```

## 오류와 시험 정합화

- 최초 전체 UI는 22 PASS/2 FAIL이었다. 신규 ref 변경 음성은 기존 기본 TRANSFER_PREPARATION_INVALID와 다른 오류명을 기대한 준비 오류였다. POST0 거절·원 ref 보존 기대는 유지했다.
- 기존 target 사례 1건은 이미 바뀐 제품의 ‘등록 대상 보호 조회·선택’ 대신 옛 미지원 버튼을 기대했다. 현재 보호 GET 거절 때 원선택·새 pending0·추가 POST0을 검사하도록 맞췄고, 명확409 명시 복귀·reason·binding 단독 거절은 보존했다.
- 그 편집 중 기존 latePOST 한 줄이 일시 빠져 23 PASS였던 사실을 보존한다. HEAD의 원문 전체 줄을 복원했고 최종24에 포함했다. 기존20 중19개 본문은 그대로이며 위 target 사례1만 승인된 정합화다. 삭제·skip로 통과시키지 않았다.
- 최초 서버 인접은 28 PASS/2 FAIL로 현재 buildApp이 요구하는 installationId가 옛 합성 repository 두 객체에 없었다. 허용 범위를 기록한 뒤 기존 합성 UUID 생산자의 installationId:id(99) 두 필드만 추가했다. 실제 설치ID·키를 읽거나 native owner/auth 검산을 우회하지 않았다. 역치환하면 원 시험 본문 전체와 같다.
- 읽기 대조 도구의 ScriptTarget API 부재와 다중행 시험 종료 탐색 오판정은 제품/시험 실패와 구분했다. 불필요한 전수·기존 FN09/FN12 검증은 반복하지 않았다.

독립 최종 읽기 검수: C0/I0/M0. 시작/종료의 제품1·시험2 지문과 manifest를 직접 대조했고, 기존 거절·UNKNOWN 보존 및 합성 metadata 정합화의 범위를 확인했다. 독립 추가 실행·파일 수정은 없었다.

## 미검증·복구

실제 DB/ACL·키·서비스·Agent/SSH·사용자 자료·실제 이전·served 브라우저·사용자 인수는 NOT_RUN이다. 준비기록과 조회를 실제 이전 권위로 승격하지 않는다. 통합/merged-main smoke·branch 정리는 WORK_STATUS에 기록한다. 복구는 해당 PR의 정상 revert이며 실제 DB 복구는 필요 없다.
