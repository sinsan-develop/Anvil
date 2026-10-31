# FN16 수동 백업 정책 저장 r2 A안 — source 검수 결과

## 판정과 범위
부분 구현 / 승인된 source 범위 검수 완료. 실제 사용·DB 저장·백업 완료를 의미하지 않는다.
기준 branch codex/av3-stage-b, 시작 HEAD 945b6932e68b8bd737c73a0d31036517e6620576.
직접 승인 00B3FC72B8B85FD1EACEB143C8DC42B4686561768FD8D214413F5B82DB693902,
WI 03094CEDBABAF1AD937CD0B42379F38117D5461729989EDE6C7A690BF8FF802F.
기존 Primary 단일 writer가 구현하고 반환했으며 Main 검수·통합, 기존 Reviewer 독립 C0/I0다.

## 구현
- UI14 수동 정책 입력·후보 보관·보호 조회, UI08 별도 승인 결정 후 동일 원명령의 명시 저장을 연결했다.
- 현재 소유자·로그인·단독 제어·명시 정책·정확 버전·일회 소비·감사를 보존한다.
- 최초/개정 CAS, 고정 버전/페이지 조회, 동일 원명령 재조회와 불명 결과 보존을 구현했다.
- 새 0063 SQL은 미적용이다. 기본 실제 전체 coverage 공급자 미연결 및 선택파일 검증의 412를 유지한다.
- 정책 대상·키·보존·검증 참조를 검산하며 자동삭제·백업 job·파일 수집·실제 키 사용을 추가하지 않았다.
- 신규 3표 합계 10,000행/67,108,864 논리 바이트 상한; 재조회 추가 소비0. 자동삭제/초기화0.

## 검증
Main 최종 단일 실행 6b187c: 11파일, 83 PASS / FAIL0 / SKIP0 / TODO0 / cancelled0, exit0, 3082.0116ms.
명령: 고정 Node C:/Program Files/nodejs/node.exe --test 아래 파일.
- tests/unit/FN16/backup-policy-input.test.ts
- tests/unit/FN16/backup-policy-store.test.ts
- tests/unit/FN16/backup-policy-approval.test.ts
- tests/unit/FN16/backup-policy-schema.test.ts
- tests/unit/UI14/backup-policy-api.test.ts
- tests/unit/UI14/backup-policy.test.ts
- tests/unit/UI08/backup-policy-approval.test.ts
- tests/unit/FN16/backup-reference-store.test.ts
- tests/unit/FN16/export-approval-consumption.test.ts
- tests/unit/UI08/approval-api.test.ts
- tests/unit/UI14/backup-reference-api.test.ts

Main 4a8684: node node_modules/typescript/bin/tsc --noEmit -p tsconfig.base.json 및 git diff --check exit0.
Main 7e346d: Vite build({root:"apps/web",configFile:false,envDir:false,logLevel:"error",build:{write:false,emptyOutDir:false}}) exit0.
출력 chunk의 modules 키를 Set으로 집계한 487개, 출력3; 디스크 build 산출물 없음.
Primary 보고 486 transformed modules와 집계 방식이 다르며 같은 수치로 주장하지 않는다.
React 시험은 실제 컴포넌트·ReactDOM·이벤트/효과와 메모리 DOM·합성 transport를 사용했다.
실제 브라우저 레이아웃·전체 App·실제 인증/HTTP/DB 검증은 아니다.

## 발견·조치와 원래 실패 보존
- SQL 조회 $1 누락 2곳과 다른 OWNER의 승인 역사 조회 차단을 보정했다. 현재 OWNER 검사는 유지하고 과거 원작성자를 위조하지 않는다.
- DB 마이크로초와 프로토콜 밀리초 불일치를 정확 밀리초 비교로 보정했다. DB transaction 원시 정밀도는 보존한다.
- BEFORE INSERT 소비 전에는 아직 없는 소비행을 요구하지 않고 원 후보·명령·결정을 검산한다. 최종/역사 검산은 정확 소비행을 계속 요구한다.
- 변조된 원명령 tuple을 IO 전에 거절하며 APPLIED 후 고정 GET 실패는 REJECTED 대신 원명령/UNKNOWN을 보존한다.
- 현재401 인증상실과 옛 문맥401 폐기를 분리했다. 실제 POST409는 명시적 수정 흐름을 유지한다.
- 기존 export fixture는 원 모듈 공급에서도 실패했다. 승인된 부록 범위의 단일 시험만 정책·유한 세션·capacity·알림 귀속을 보강했고 기존 4종 INSERT 각1+알림1, 후보/job/소비0 단언을 보존했다.
- Primary 신규36과 인접 최초47 중46 PASS/1 FAIL, 보강 후 단일1 PASS를 단일83 결과로 합산하지 않는다. Main 최종83은 별도 실제 실행이다.
- 준비 과정의 타입/fixture 가정·UTF8 읽기·추측 경로·명령 interpolation 오류는 제품 검증과 구분한다. 동일 근본 원인 정식 실패3회·Main 코드 인수는 없었다.
- 통합 전 결과 파일 존재 확인 1회는 파일 부재와 PowerShell profile conda 인코딩 오류로 exit1이었다. login:false로 재개했으며 권한·프로필은 변경하지 않았다.

## 동결 24경로
아래는 Windows 작업 사본 원시 바이트 SHA256이며 Git blob/다른 플랫폼 checkout 해시가 아니다.

| 경로 | SHA256 |
|---|---|
| apps/server/modules/access/project-command.ts | 7603F52AC8A821B01ED1D7F3EF4F315281B5144EF8E810C044BADCF95B1F985C |
| apps/server/modules/projects/routes.ts | 0C2D7028DEA539D8D99C4D288B5FE0B737A8421C63E96E5C8D0EE161459F0726 |
| apps/server/modules/approvals/project-approvals.ts | AF80421FA4EE552B385A293C9EF035A8E299C433CE9EB15CE8FD3E25B7BB772E |
| apps/server/modules/backups/backup-reference-store.ts | 1372D6EB2771EAD77F10677173B9D7850D95516212C3255F81428CB7470CDA2C |
| apps/web/src/App.tsx | EE1DE470C2F17D96D4469389A1989C3C8301ECE1D3099015CDFA2B711944F335 |
| apps/web/src/features/decisions/api.ts | 3A7C2E3469755BB9772218745C58FAAED5E498AA05C061678C3C820EEA50572B |
| apps/web/src/features/decisions/ApprovalsPage.tsx | E8A2A64D7C9769C36F7C9A97CAAE89D338E7A0884DF29604EAD06B2945910CA3 |
| apps/web/src/features/connections/policy-editor-profile.ts | 0EB31A569F7A72FE5AE10FE9D0792C670710D3A515E1811B4FB8CCA8EC01F8CA |
| apps/server/modules/backups/backup-policy-input.ts | 566B65E7717EECD6C30FE0727AD57C5B0AA90D7908352604EDA0215382705E01 |
| apps/server/modules/backups/backup-policy-store.ts | D27EE980B5CF12CFFC45AC9F1F842127398DC61B6F1996E543270778DA68334D |
| apps/server/modules/approvals/backup-policy-approval-candidate.ts | 8CDE60E456A8E049D3617DC55965233859746E34756B6989707E5FD068374C91 |
| apps/web/src/features/backups/backup-policy-api.ts | F6AD6E3F1DF76B96AF86CE7AECEFC6DDCE597FFC42F3409A02A9C0FFCDFFFDEF |
| apps/web/src/features/backups/BackupPolicyPanel.tsx | 3CB48C3ACC172662EFE6658E5CA3557C82DBECA46F71D3A8E6BDED7DBFA9CE0B |
| apps/web/src/features/decisions/backup-policy-approval-api.ts | A1CF5B672B1A906B525488037F549D18431B36EDBE584DB52ACD4AAE55A665B5 |
| tests/unit/FN16/backup-policy-input.test.ts | 511BCAEED929B08B06091DA0DD0117AE5BB6054993A7641CCBAD6D62BBF78C88 |
| tests/unit/FN16/backup-policy-store.test.ts | 78D65AF881AE338DB697A1B6C92EAFA54BAA35ED2A91C3047CEF19859AC56C58 |
| tests/unit/FN16/backup-policy-approval.test.ts | 69449234ADF4C15E56D14D75A435DCAA3747578C0C52BB5D33F3502EF1043939 |
| tests/unit/FN16/backup-policy-schema.test.ts | 4D64A5E337BAA80F30AE711E33876E00F5E1884C27C4CF7287B712D230A252AE |
| tests/unit/UI14/backup-policy-api.test.ts | 15CDD6B81DD91D317139DB64E39A997CF4EF65DFB61D44232C6716EBFEC29501 |
| tests/unit/UI14/backup-policy.test.ts | 7DE8C4FDD58E6A130CB3A1A238489EBB3510C056C7480A29AC09C3814E2F4ED2 |
| tests/unit/UI08/backup-policy-approval.test.ts | E33D8A3954E3A46E8B7CB422730107E6AE92794EFF41612226F71F5DB15BC7B8 |
| db/migrations/0063_backup_policies.sql.pending | D85AE662A9145F9AC0F3EF4EFB13026FE925E9B2E6FBF2D9A155A95368F89ED4 |
| tests/unit/UI14/backup-reference-api.test.ts | 78CE371C352168F545455E98BB8EDA747D76B269265BFD0E327E46F11581B046 |
| tests/unit/FN16/export-approval-consumption.test.ts | CDB18CDE34EE3555956DE645CE519D917192FEA4D332A888F4E58C25D6905A0B |

## 미검증·제외·복구
실제 PG SQL 해석/RLS/COMMIT/경합·실제 전체 coverage/키·사용자 파일 조사·실제 서비스·Agent·실백업/복원·사용자 인수는 NOT_RUN 또는 명시 제외다.
기존 프로젝트 차단 해제0, 실제 DB/권한/키/서비스 변경0, 새 QA 자원0.
전체 FN16·Stage·작업계획은 미완료다. 필수 검사 기준 완화·PASS 승격0.
통합은 소유24+본 결과/WORK_PLAN/WORK_STATUS+시험 부록3의 정확30경로만 사용한다. 보호3·기존 복구 자료는 제외한다.
rollback은 해당 source commit을 정상 revert하며 실제 DB는 적용하지 않아 DB rollback 실행은 없다. main 병합·배포·기존 worktree 정리는 수행하지 않는다.
