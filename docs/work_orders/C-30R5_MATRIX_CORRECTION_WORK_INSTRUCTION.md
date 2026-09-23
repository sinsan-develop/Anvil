# C-30R5 WorkInstruction — historical matrix/current successor 분리

## 판정과 목적

- 분류: 승인된 C-30 final gate 내부의 비기능 corrective revision
- 기능·요구사항·공개 API·DB·인증·Secret·배포 변경: 없음
- 목적: `tests/integration/test_c30_contract_matrix.py`가 frozen C30 evidence와 현재 seq1345 successor를 같은 시점으로 비교하는 두 assertion을 분리한다.
- RED 근거: fresh `16 passed / 2 failed`; 제품 Python159와 Windows 정상 권한 web88은 별도 PASS다.

## 권위와 lease

- base/dispatch HEAD: `ec9ee09daa6c8ecc042f8ace313e6bda5dd42f5e`
- branch/upstream: `codex/c09-execution-backends-r1` / `development/codex/c09-execution-backends-r1`
- actor: `developer-primary-c30-final-gate-matrix-r1`
- worker lease: `worker-lease-c30-final-gate-matrix-r1-20260923-001`
- execution fence: `c30-final-gate-matrix-execution-fence-epoch-1-ec9ee09`
- write lease: `write-lease-c30-final-gate-matrix-r1-20260923-001`
- write fence: `c30-final-gate-matrix-write-fence-epoch-1-ec9ee09`

## exact product write scope

1. `tests/integration/test_c30_contract_matrix.py`

다른 제품·테스트·manifest·progress·checker·문서 파일을 수정하지 않는다. stage·commit·push는 Main 소유다.

## 구현 계약

1. frozen checkpoint `abb736108e60a5bc3c93c3ca531f71d70a3c5ee2`의 Git bytes로 historical manifest와 30개 source hash를 검증한다.
2. `base_head=98e218...`는 dirty successor 시작 기준이며 frozen snapshot commit으로 오용하지 않는다.
3. historical HANDOFF 문구는 checkpoint bytes에서 검증한다.
4. current HANDOFF는 `anvil-recovery-summary` JSON을 파싱해 seq1345 progress와 C30R3 fixture-only scope, 여섯 미검증 경계를 검증한다.
5. 현재 hash로 historical 기대값을 갱신하거나 mismatch를 허용하지 않는다.

## 검증과 rollback

- focused2, 전체 matrix18, 관련 Python159, `git diff --check`를 실행한다.
- 실제 Provider·production auth·PG18·actual server-generated400·Oracle·새 브라우저/WSL 실행은 하지 않는다.
- rollback은 이 exact1 delta만 되돌리며 historical manifest/event와 사용자 자료를 변경하지 않는다.
