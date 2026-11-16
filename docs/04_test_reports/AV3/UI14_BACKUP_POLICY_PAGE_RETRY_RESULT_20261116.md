# UI14 수동 백업 정책 다음 페이지 재조회 결과

## 판정

검산된 첫 목록에서 다음 커서로 GET한 뒤 503이 발생하면 정책 행과 다음 버튼을 복원한다. 사용자가 다음 버튼을 다시 눌렀을 때 같은 커서로 GET했다. 세 요청의 커서는 순서대로 없음, `cursor+page/2=`, `cursor+page/2=`였고 POST는 0회였다.

## 기준과 변경

- 지시서 `docs/work_packages/UI14_BACKUP_POLICY_PAGE_RETRY_WI_20261116.md` SHA256 `ACBDE4843C44866E47EEC4967931F6F532E9B581248C2F4CFC697EE1BD137038`. branch `codex/av3-native-connection-followup`, 시작 HEAD `fcd0ed0cf7283866141496db216076f060529006`. 시작 시 Main 소유 WORK_STATUS 변경과 미추적 지시서를 확인했다.
- `apps/web/src/features/backups/BackupPolicyPanel.tsx` SHA256 `7530E46B504FD30CFBE1AF5ED6C0AF34412A24584C4179E45BA20AC320EACDA0`. 정책 목록 함수에서 기존 페이지 ticket의 현재성을 확인한 뒤 새 요청을 시작한다. 요청 중 목록과 선택 상세는 비운다. 현재 요청의 일시 오류에만 이전 페이지를 그 요청의 ticket으로 다시 묶는다. 처음 페이지 명시 조회·초안·미확인 명령·고정 조회·보호참조 함수는 기존 흐름을 유지한다.
- `tests/unit/UI14/backup-policy.test.ts` SHA256 `272F4BEA80BC4EBD94249FAD13B690BBF8A45360690E3827A7C3295DF3639476`. 기존 ReactDOM 메모리 시험에 같은 커서의 명시 재조회, 상태와 본문에 따른 복원·폐기, 프로젝트·사용자·clientId·CSRF·API 인스턴스·transport의 왕복과 지연 응답 검사를 추가했다. 기존 시험 단언은 유지했다.

## 검증

| 명령 | 결과 |
|---|---|
| `node --experimental-strip-types --test --test-name-pattern="다음 정책 페이지 503 뒤" tests/unit/UI14/backup-policy.test.ts` | 수정 전 170c61 exit1, 0P/1F/0SKIP. 503 뒤 ‘실패 후 기존 페이지’ 단언에서 첫 행이 사라졌다. 수정 후 c75b9d exit0, 1P/0F/0SKIP. |
| `node --experimental-strip-types --test --test-reporter=tap tests/unit/UI14/backup-policy.test.ts tests/unit/UI14/backup-policy-api.test.ts` | 최종 46aa39 exit0, 38P/0F/0SKIP, 982.1953ms. 목적 1건 포함. |
| `npm run typecheck` | 5877c5 → 80c7a8, exit0, 진단 0건. 세션 59879 종료. |
| `git diff --check development/main` | 9e6a36 exit0, 추적 파일 공백 오류 0건. 신규 결과서는 빈 파일과 별도로 대조한다. |

연결 오류(status 0)와 검산된 일시적 502·503·504에서 이전 행을 보존했다. 401/403/404, 503 비JSON·불완전 오류 JSON·서버가 보낸 CONNECTION_LOST, 잘못된 정책 항목 및 인증·문맥·무결성 오류에서는 이전 행과 다음 버튼을 폐기했다. 문맥이 바뀌었다 돌아온 뒤 이전 200/401/503이 도착해도 새 페이지를 대체하거나 인증 소실 처리를 부르지 않았다. 제품·시험 diff는 113행 추가·1행 삭제다.

## 미검증과 복구

검증은 RAM ReactDOM, 합성 HTTP 응답, 메모리 번들 및 타입 검사에 한한다. 실제 브라우저·사용자/백업 파일·DB·권한·키·서비스·SDK·Agent·C#·P03을 실행하거나 조사하지 않았다. 배포 및 사용자 인수는 미검증이다. 복구 기준은 시작 HEAD의 두 제품·시험 파일이다. 현황 기록·Git 통합은 Main 소유다.
