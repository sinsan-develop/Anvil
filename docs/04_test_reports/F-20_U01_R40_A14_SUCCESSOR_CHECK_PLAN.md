# F-20/U-01 R40 A14 현재 브라우저 검사 successor 계획

## 판정과 경계

기존 `A-14_EVIDENCE_MANIFEST.json`은 A14 당시의 불변 증거이며 수정하지 않는다. 현행 `App.tsx`의 Alert 입력 차단 정규식은 내부 주소를 **거부**하는데 역사 `browser_source_findings()`가 문자열 자체를 내부 API 사용으로 오인한다. 기존 R6 successor registry/선택 경로를 이용해 R7 current checker checksum만 추가 결박한다. 이는 계획 범위의 검증 통제 보완이지 제품 기능·공개 API·권한·DB·Event·운영 배포 변경이 아니다.

정확 수정 경로는 `scripts/check_a14_workbench_prototype.py`, `tests/tooling/test_a14_workbench_prototype.py`, 새 `docs/evidence/manifests/A-14_A14_SUCCESSOR_R7.json`, 현재 G-05의 `scripts/f20_u01_r38b_close_overlay.py`, 이 계획·결과보고서·`docs/WORK_STATUS.md`다. `App.tsx` 및 역사 manifest/R6 원문은 변경하지 않는다. Main만 control 파일을 쓰며 제품 writer lease는 발급하지 않는다.

## 구현·검증 순서

1. 현행 A14 source 검사 실패와 기존 역사 checksum 실패를 RED로 고정한다. 새 테스트는 완결된 거부용 regex는 주소 사용이 아니며, 같은 파일의 실제 절대 URL literal/fetch는 계속 거부함을 확인한다. 기존 READY_PATH·주석·shadowing·escaping·protocol-relative 반례를 유지한다.
2. 기존 JS lexical mask가 확인한 완결 regex span만 `internal-address` 문자열 검색에서 제외한다. 실제 string/comment/code의 금지 주소 검사와 fetch 상대 경로 판단은 그대로 둔다. 전역 lexical ambiguity를 PASS로 바꾸지 않는다.
3. R6 registry SHA-256과 기존 역사 manifest SHA-256을 부모로 둔 R7 registry를 exact 3경로(공유 server, A14 checker, A14 test)의 현재 bytes/hash로 작성한다. checker는 R6 선택 **뒤에** tracked-clean R7을 적용하고 artifact/revision/parent/exact 경로 집합/row 형식·실제 hash가 틀리면 fail closed 한다. 역사 manifest/R6은 그대로 둔다.
4. 로컬 A14 전체 test/CLI, G-05, R38B 인접, diff check를 실행한다. private branch에 exact 범위만 commit/push한 뒤 WSL-server에서 같은 SHA·역사 refs로 A14 CLI/test와 현재 통제를 재실행한다. 필요 시 전체 비-opt-in suite를 별도 집계하고, C30 `OPEN_BLOCKING`·F-20/U-01 미수락을 유지한다.
5. WSL 전용 checkout·pytest 자원은 realpath/owner/link/process/clean 확인 후 정확 제거한다. 실패 시 이 작업의 commit만 정상 revert하여 R6 이전 상태로 복귀한다. 원본 Event·역사 manifest·다른 branch·공유 서비스·ysna/Production은 건드리지 않는다.

## 완료 기준

A14 current checker가 현행 source에서 PASS하되 절대 URL·protocol-relative·동적 fetch 우회·위조 R7 registry는 FAIL이어야 한다. 성공 범위는 현재 정적 검사에 한정하며 실제 Chromium Network, 11개 메뉴, C30 사고 복구 또는 F-20 인수가 아니다.
