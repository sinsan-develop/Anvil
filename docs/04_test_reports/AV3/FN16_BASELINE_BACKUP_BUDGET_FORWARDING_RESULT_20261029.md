# FN16 문서·기준선 원문 예산 전달 결과 — 2026-10-29

## 판정·범위

동일 예산 전달의 내부 source·합성 검수 단위다. 실제 파일/DB·기준선 백업 기능 완료가 아니다. 기준 codex/av3-stage-b 7ed7a72323d12a74049ecb61efa6a1d428591f7c, Main 관리/검수/통합·기존 Primary 단독 구현·기존 Reviewer 읽기다. WI FN16_BASELINE_BACKUP_BUDGET_FORWARDING_IMPLEMENTATION_20261029.md SHA256 603941E0E73095E5E862355BF8A72BE4621F36E6833F131787E54F0C660E55BF.

## 변경과 보호

readDraft/#currentCheck/#basis에서 실제 source resolver와 문서 version/originalText까지 선택 budget을 전달한다. version 자체의 첫 원문 읽기와 originalText의 후속 읽기를 둘 다 동일 budget에 누적한다. 검증을 제거하거나 중복 제거하지 않았다. 실제 ArtifactStore 선택 경로로 이어지며 별도 성공 provider/proof를 등록하지 않는다.

기존 helper의 private known WeakSet을 사용하는 정확 오류 predicate만 추가했다. 원 읽기 알고리즘은 불변이다. #currentCheck는 실제 helper가 발생시킨 입력·취소·busy·기한·누적·회수 오류를 원 객체 그대로 throw한다. 외부가 같은 message/status로 만든 AuthFailure는 helper 오류로 인정하지 않고 기존 의미를 유지한다. 일반404/409/412의 UNAVAILABLE/CHANGED와 실제 bytes/hash503·일반 예외의 전체 거절도 유지한다. UTF-8 decode catch 밖에서 예산을 검사해 취소/기한이422나성공snapshot으로 바뀌지 않는다.

기존 기본 호출의 입력/반환·저장·원 snapshot/hash·명령/receipt/audit·source/evidence 검산을 보존한다. 새 공개 route·operation·SQL·정책·권한·설치/등록·기존23조합·inventory 수집을 추가하지 않았다.

## 실행 증거

최초1628b7은 실제 save/read 원검산을 통과한 뒤 전달/predicate 부재로 RED0 PASS/6 FAIL(427.7663ms)이다. 최종 Primary aa99f6은 신규9+직접 reader17=26 PASS/410.0975ms였다. 중간 타입 오류2는 시험 fixture의 CommandResult union ref 좁힘 부족이며 시험 내부 정합화로 해결했다. 제품의 검산/기대값은 완화하지 않았다.

최종 Main035917은 아래 명령 exit0,26 PASS/0 FAIL/0 SKIP/378.1892ms다. Main950909 type/diff exit0·최종5지문 일치, 독립 최종 Critical0/Important0다. 독립 담당은 읽기만 했고 실행 결과를 실제 FS/DB 검증으로 승격하지 않았다.

```powershell
node --test tests/unit/FN16/baseline-backup-budget-forwarding.test.ts tests/unit/FN16/artifact-backup-budget-read.test.ts
npm run typecheck
git diff --check
```

신규9는 실제 baseline save/read와 source resolver/문서 메서드를 거친다. 원문 저장 포트만 메모리 owned handle로 연결한다. evidence1회+문서2회 동일 예산·두 번째 읽기 한도, 원 취소 객체·외부 동일message, 원missing/quarantine/변경/503/일반예외, invalid budget의 DB 조회 전 거절, poison503을 확인했다. 실제 두 문서 decode 단계에서 기한을 각각 넘겨413이 UTF8/currentCheck catch로 낮아지지 않음을 확인했다. 실제 FS·DB를 호출한 시험은 아니다.

## 최종 코드 SHA256

- apps/server/modules/documents/project-documents.ts: 6A1EAE7BF3D3E19EE9D20364DFDE7BBB1B225BBD437998BAAB2AF70F827F4F4C
- apps/server/modules/projects/baseline-sources.ts: 8097779134A9A4D5C71D573ED88E37CA0223C719425D635DE8D907231981BB9C
- apps/server/modules/projects/project-baselines.ts: 8BA00199D2946FFB382033A9F4314181C999AC8F4AB113DBE4AFB5611CFA8F85
- apps/server/storage/artifact-backup-budget-read.ts: FC2B044C3976A582E3378B4CEC3C328879D50B563AD8FDB2FC54FB18E66D2BEF
- tests/unit/FN16/baseline-backup-budget-forwarding.test.ts: 23E87A8BF45110650B372F5B34CEAC01BB02E63ABFA9F7BC6FC7F24A2D080A2E

## 잔여·다음 조치·복구

선택 호출 등록·기준선 inventory·기존23 조합은 미연결이다. 실제 FS/권한/DB·키·서비스·Agent·브라우저·전체 백업/복원·사용자 인수는 미검증이다. OS pending IO의 절대시간 강제 회수와 약9PB 포화 한계는 이전 reader 결과대로 남긴다. 이번 전달을 실제 실행 ready로 표시하지 않는다. 실제 QA 자원0·보호8 보존이며 main/PR/실환경 반영0이다.

다음은 실제 ProjectBaselines 인스턴스의 원 보호 조회를 재사용하는 초안 역사 수집의 최소 내부 접점 대조다. 단순metadata/NOT_PERFORMED로 원503검사를 우회하지 않는다. 복구는 부모7ed7a723과 정확 변경의 영향 검토 후 정상 revert이며 자동 reset/force/서비스·DB 복구0이다.