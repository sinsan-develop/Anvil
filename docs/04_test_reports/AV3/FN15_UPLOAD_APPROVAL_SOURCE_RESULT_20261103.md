# FN15 파일 업로드 기존 승인 연결 source 결과
2026-11-03 · Main 어울 검수/통합 · 기존 Primary 구현
판정: SOURCE_SCOPE_ACCEPTED. 전체 FN15/Stage/작업계획 완료 또는 실제 사용자 사용 가능 판정이 아니다.

## 범위와 기준
- codex/av3-stage-b 기준 0e5ae3327699bd93572af66a9b0cc0fba99d5ec1.
- 부모 WI r7 SHA15700DB2F63FFB6DE3F248B22142F76FBFF1B58AE30BC090EB08FAB610BDBE3F §8/U4.
- 이번 WI FN15_UPLOAD_APPROVAL_SQL_FORWARD_SOURCE_20261103.md 최초88CB4B79E07A8C0FEBC256108DA724E955C23CCAFE69854EB70823AD96124C19 → r2 46EFA54283EB230639423DE45C8F447616D3545F9EBBD4BCDFBAF87A4E3A940B.
- 정확6 source/시험만 변경. Main은 문서/독립 검수/Git만 소유. 공개 입력/응답/approval snapshot·새 정책 대상·실제 권한 확대0.

## 결과
실제 인증 callback에서 upload 전용 private context를 생산한다. 원11키 request/hash·동일DB/actor/authSession/credential·단발·finally를 유지한다. 파일 handler의 마지막 callback만 연결해 원본/hash/검사·20MiB·quota prepare/reserve/start·원본을 다시 읽는 replay·receipt/승인소비/정산·불명 보호 순서는 보존했다.
기존 request→별도 decision→원 upload→일회 consumption을 연결했다. 0073 미적용 SQL의 목적 helper와0050 요청/0011 결정/0033 before_plan alias/0052 알림 현재성의 HE 분기만 좁혔다. 원Owner·특수승인/0074 membership outer·원requiredDecider/정책/DENY·기한·control/grant·10000알림상한/원자성은 보존한다.

## 검수와 오류
- actual upload 목적context 부재 a936c1 RED→6944ed GREEN.
- 기존 승인 forward 부재0709e3 RED→dd1215 GREEN.
- Main812d7a의 missing/null status SQL 3값 판정 누락: c0a596 RED→bd5283 GREEN. COALESCE(...,true)로 명시 거절.
- Main f2501e/db0b23의 알림 capacity/지연complete Owner-only 누락 Important1: ef313d RED→9760f5 GREEN. 기존0052 함수의 upload request HE 조건 한 곳만 forward하고 나머지 원문을 보존했다. 최종한정검토에서 해당 Important는 Addressed(source).
- Primary e37e16 직접2파일33PASS/FAIL0/SKIP0/1524.4935ms. d56011 root noEmit exit0.
- Primary2e6513 기존 Owner upload 인접1PASS/1587.1636ms. 28d0e4 기존 source-detach 승인대상 인접2PASS/1FAIL/640.0381ms·exit1은 NOTIFICATION_STORAGE_FAILED다. Mainbc77cf/a6b696은 직접 ProjectApprovals.request 대역의 capacity 쿼리/authSession 부재와 production approval/notification source diff0를 확인했다. 새 wrapper를 소비하지 않는 기존 fixture 부족으로 분리하되 원FAIL은 보존한다. 해당 시험을 수정/재실행/PASS 치환하지 않았다.
- Primary edf5ee 원함수4 역차분·raw checksum·COMMIT1·diff0. Main92b9e3은 역치환 정적검사가0050/0011/0033 alias/0052의 원문과 정확 비교함을 읽었다. source 검수는 실제 SQL 실행을 대체하지 않는다.
- Main01a601 독립 직접2파일33PASS/FAIL0/SKIP0/1845.0796ms·exit0. Main23faa7 최종6hash·SQL181052B/CR0·0072/0074 diff0·보호3지문불변·diffcheck0.
- 메모리알림/인증 대역·타입/이전5op 단언 준비오류는 제품실패와 분리했다. 실제 동작 변경을 숨기는 기대값 완화0. 동일 근본 정식실패3회0.
- 추가 미해결 Critical/Important는 검토한 source 범위에서 없다. 기존 인접 FAIL과 아래 미검증은 지우지 않는다.

정확 검증 명령:
```powershell
node --test --test-concurrency=1 tests/unit/FN15/control-source-integration.test.ts tests/unit/FN15/control-acceptance-schema.test.ts
node node_modules/typescript/bin/tsc --noEmit -p tsconfig.base.json
node --test --test-name-pattern='actual upload route reserves and starts durably before put and settles original artifact receipt' tests/unit/FN13/project-storage-quota-writers.test.ts
node --test tests/unit/FN11/source-detach-approval-target.test.ts
git diff --check
```

## 최종6 지문
| 경로 | SHA256 |
|---|---|
| apps/server/modules/access/project-command.ts | 7A76EE6B0C37A58E2EB5C80202E0E6CBBC0CA5C9CE80C302CC90F26721DA4CE2 |
| apps/server/modules/documents/project-files.ts | A64B41D1EE7F49A8BF2018F0C6F7AA0D96505F1CEEF7244583949C47BED67D0E |
| db/migrations/0073_control_handoff_acceptance.sql.pending | 168EAFF50D2F33B32ACE22B09CE1B766D8802D4DDC50BD3419D1CB501F619E61 |
| apps/server/modules/control-handoff/control-acceptance.ts | D5D4D551B8242A72059350BB0071860032A3E1EB27D20FD4B3E86B0F3F5908F0 |
| tests/unit/FN15/control-source-integration.test.ts | AA4389CD25EB1B73C4F66F1CD2979784A04BEF329C25CF4C762A9C8573A224EF |
| tests/unit/FN15/control-acceptance-schema.test.ts | 997BC55D1A4F4253A76A9A0A5D98F698AF79F8BE194BAAE584F4363095EE50A5 |

0073 raw/filtered Git blob33445ffefb1dba6b7c4618438aeceb5122f85334·service checksum 일치. 실제0072/0074 파일불변.

## 미검증·잔여·복구
- 실제 PG/RLS/ACL/경합/지연trigger집행·실제 DB/권한/정책/회원·키·서비스·Agent·OS/제품네트워크·실자료/물리FS·served UI·사용자인수 NOT_RUN.
- 메모리 인증/DB/파일대역+actual handler/Repo/승인/quota 소비 시험이며 실제 파일 게시·PG 성공이 아니다. 새 일회성 자원0/미수거본인handle0.
- 기존0072 READY만 허용하는 artifact guard와 QUARANTINED 생산의 불일치는 이번에 수정하지 않았다. 격리 저장 성공으로 표시하지 않는다.
- detach/link/change의 보호원문/특수Owner·등록/observation 권위·타사용자 HE 정책 생산은 계속 별도 미완료/미채택이다. 유효 정책 fixture를 실제 정책 작성/권한 부여 증거로 세지 않는다.
- rollback은 실제 DB 적용 없이 이 source6 diff만 기준0e5와 대조해 되돌리는 방식이다. 사용자 dirty/보호3·기존자료에는 적용하지 않는다.
- 안전 checkpoint와 exact private SHA 확인은 WORK_STATUS의 후속 기록을 따른다. main/PR/merge/배포0.
