# FN16 원문 선택 협력 예산 읽기 선행 결과 — 2026-10-29

## 판정·범위

저장 계층 내부 source·합성 검수 단위다. 실제 백업 기능 완료·파일 시스템 방어·OS 강제 회수·FN16/WORK_PLAN 완료가 아니다. 기준 codex/av3-stage-b 94737bf64cd7e4274a1733dbd0dc41db935c9423, Main 관리/검수/통합·기존 Primary 단독 구현·기존 Reviewer 읽기 검수다. 최종 WI FN16_ARTIFACT_BACKUP_BUDGET_READ_IMPLEMENTATION_20261029.md SHA256 8AF4A84E019EB1F3CCCB643CADA15112A0A2C5B9E833F99DC72BDCDCF63204F9.

기준선 원 GET의 실제 bytes 무결성503을 metadata 미확인으로 대체하지 않기 위한 선행이다. ArtifactStore.read에 선택 budget 경로와 실제 owned FileHandle을 넘기는 연결만 추가했다. 기본 read·put·DRAFT·#bytes는 신규 import/인자/분기를 역대조한 Main293c04에서 HEAD 원문과 동일하다. 후속 ProjectDocuments/ProjectBaselineSources/기준선 수집에는 아직 연결하지 않았다.

## 구현

한 내부 budget을 순차 읽기에 공유하며 필수 AbortSignal·고정 시작기한·누적 실제 bytes를 검사한다. 다른 읽기가 점유 중이면 거절하고 새로 양도받은 해당 handle만 닫는다. 기존 경로의 UUID·expected size/hash·canonical path·symlink/owner/mode·NOFOLLOW와 regular file/nlink1/20MiB 검사를 유지한다.

동일 owned-handle 알고리즘으로 최대64KiB 부분 읽기·EOF probe·정확 size/hash를 대조하고, 실제 검산 Buffer만 반환한다. 실패/취소 시 소비량을 되돌리지 않으며 자체 Buffer를 지운다. read/close를 Promise.race로 버리지 않고 기다린다. close 실패/불명은 고정503 및 sticky poison으로 다른 오류보다 우선하며 같은 budget의 다음 stat/read/open을 막는다. close 후 기한 초과도 성공 Buffer를 지우고 거절한다.

이것은 협력적 기한 검사다. 진행 중 OS IO가 영원히 pending이면 정해진 시간 내 강제 종료/회수는 보장하지 않는다. 실제 회수 성공·실행 ready로 승격하지 않는다. 원형 bytes 보호를 생략한 우회 수집도 만들지 않았다.

## 검증과 실패 이력

- 최초 신규 모듈 부재 RED 0P/12F,159.9727ms. 구현 뒤11P1F는 Windows 기존 owner/mode 조건과 맞지 않는 fixture1건이다. 제품 가드를 바꾸지 않고 시험 조건을 정합화했다. Python 기본 cp949 읽기 오류1로 보정 미적용 상태에서11P1F가 한 번 더 실행됐으며 UTF-8 명시로 교정했다.
- 첫 Main995f35는15 PASS/148.6599ms·96f221 type/diff0였지만 최종 합격이 아니다. 독립 코드 I1은 기존 취소/무결성 오류 후 close 대기 중 다른 호출이 poison을 만들면 기존409/413이 회수 불명503을 가릴 수 있다는 지적이다. 4e8884 실제 RED0P1F 후 최종 poison 우선 검사·교차 실패 반례로 보완했다.
- Main이 WI의 signal 의미를 필수로 확정했다. 0b74f1 생략 signal RED0P1F 후 undefined/null/잘못값400을 추가했다. 이후 기존 한도 음성이 signal 누락에 가려진 시험 I1을 발견해 정상 signal을 명시하고 deadlineMs 음성도 독립시켰다. 077570 maxBytes 가드만 임시 제거한 mutation0P1F로 독립성을 확인하고 finally에서 원 제품 바이트/hash를 복원했다.
- 최종 Main66b56f:17 PASS/0 FAIL/0 SKIP/160.1039ms/exit0. Main6d3583 type/diff exit0. 독립 최종 Critical0/Important0·정확3지문 일치. 독립 담당은 읽기만 했으며 실행 결과를 자신의 시험으로 표시하지 않았다.

실행 명령:

```powershell
node --test tests/unit/FN16/artifact-backup-budget-read.test.ts
npm run typecheck
git diff --check
```

모든 행동 반례는 실제 helper에 메모리 owned handle을 공급한 합성 시험이다. 별도 성공 알고리즘/provider를 시험한 것이 아니다. 기존 전체 storage/문서/백업 전수 회귀·build는 반복하지 않았다.

## 변경 코드 SHA256

- apps/server/storage/artifact-store.ts: 769F3C69FF879E1B1553AFB2D2B7E51212C467EBE9423EE0A365341E4131BFD4
- apps/server/storage/artifact-backup-budget-read.ts: C2B25D482981813C2B04BCC949D107FED04CC10BD3C06C5D36CCD69AA93FAD10
- tests/unit/FN16/artifact-backup-budget-read.test.ts: 4D6A9FF45469B4034BC32EDD2E034722E46CA3314FD23E6A8DFA0C7185B7B85B

## 미검증·잔여·다음 조치

실제 FS path/NOFOLLOW/owner/link·Unix owner/mode·Windows ACL·DB/키/서비스·Agent·브라우저·OS pending IO 강제 회수는 미실행이다. source 접점 대조만으로 실제 FS 방어 PASS를 주장하지 않는다. 새로운 실제 QA 자원0, 보호 untracked8 보존이다.

약9PB 누적 Number.MAX_SAFE_INTEGER 포화 뒤 같은 budget의 0byte 읽기 가능성은 극단 한계로 기록한다. overflow 자체는413이며 현재 실호출이 없다. 이를 Important로 승격하거나 장시간 시험으로 확장하지 않았다. 실제 연결 전 sticky exhausted 보완 필요성을 다시 대조한다.

다음은 기존 문서/기준선 원문 경로에 동일 budget을 전달하는 정확 선행 검토다. 기존23/기준선 inventory는 아직 미연결이며 전체 미수집·false를 유지한다. 실제 실행 승인을 확장하지 않는다. 복구는 부모94737bf6과 이번 정확 변경의 영향 검토 후 정상 revert로 하며 자동 reset/force/서비스·DB 복구0이다.