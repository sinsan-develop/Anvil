# FN16 원문 바이트 검증 결과

2026-10-29 · Main 어울 · codex/av3-stage-b · 부모 2a7cfa4e1a7f68df4db76744ccedc195760497d9

## 판정
단일 artifact 내부 byte 검증 로직 구현·핵심 합성 확인. 전체 FN16, 실제 원문 백업·복원 및 사용자 사용 가능한 화면 연결은 미완료다.

기준 WI: docs/work_packages/FN16_ARTIFACT_BYTE_VERIFICATION_20261029.md
SHA256 60B68CB48741A4CB3BF328C75D8313B7F326015EC2DA1891209AD195282429D7

## 변경·근거
- 신규 apps/server/modules/backups/artifact-byte-verification.ts: BEA4EC06E8468F8FE7FF6FF3251F0B9338CA937D8F72272610F02D9587DD80BA
- 신규 tests/unit/FN16/artifact-byte-verification.test.ts: EE23487BE609625BB69C7A622C1FD2BF9FE6752E7147908AF873632EFCD72896
- 변경 전 이 내부 verifier는 없었다. 변경 후 exact project/artifact/bytes/hash와 필수 reader port로 단일 원문의 크기·SHA256·기존 알려진 비밀 표식을 검사한다. 입력 own-data snapshot, 최대64KiB 및 선언 크기+1 EOF, 조기/추가/과대 읽기 거절, 취소·기한, 단발 close와 고정 오류를 포함한다.
- 자체 버퍼만 finally에 best-effort zero한다. 포트 chunk·원문·파일·DB를 수정하지 않는다. 반환은 검사 metadata뿐이며 authorityVerified/sourceStabilityVerified/restorable=false다. 원 inventory의 NOT_PERFORMED와 전체 coverage 차단을 유지한다.

## 실행 증거
| 수행 | 정확 명령/범위 | 결과 |
|---|---|---|
| Main a9b2cf | node --test tests/unit/FN16/artifact-byte-verification.test.ts | 제품 부재 RED 0PASS/13FAIL/skip0,177.5816ms,exit1 |
| Primary 396282 | 같은 신규 시험 | 13PASS/skip0,240.0835ms,exit0 |
| Main e5a8f9 | 같은 신규 시험 | 13PASS/skip0,257.1254ms,exit0 |
| Primary ece94c | typecheck/diff | exit0 |
| Main 1709fc | npm run typecheck; git diff --check; 제품/시험 SHA256 | exit0,최종지문 일치 |
| 독립 reviewer | WI·시험·최종 제품 정적 읽기 | 각각 scoped C0/I0/M0,실행0 |

정상 다중/짧은 양수chunk·빈 원문·20MiB, 닫힌 입력/Proxy·caller 변경, 요청초과/추가byte/조기EOF/hash변조, chunk 경계 marker, 원오류·위장 AuthFailure 비노출, open/read/close 실패·회수1회, 늦은 응답·취소·기한·close후취소를 확인했다. 첫 RED는 미구현이며 제품/환경 사고로 바꾸지 않는다. 기존 기대값 완화0, 기존 불변 전체 시험 반복0.

## 미검증·제약·회수
실제 OS reader, 현재 DB/권한/격리 재검사 orchestration, 실제 파일·키·DB·서비스·P03·Agent 실행은 NOT_RUN 또는 미구현이다. 포트 open/read/close가 영원히 settle하지 않으면 강제 중단할 수 있다는 보장은 없다. 내부 버퍼 소거는 OS 메모리 전체 소거 증거가 아니다. 실제 안전한 파일 읽기·전체 backup/job/bundle·복원 성공으로 이 결과를 사용하지 않는다.

이번 시험은 공개 메모리 fixture만 사용했다. QA 디렉터리·container·listener·실제 원문 생성0이며 정리할 외부 QA 자원0이다. 기존 보호 미추적8은 stage/수정하지 않는다. rollback은 신규 제품/시험의 검토된 revert이며 원자료·키·DB·서비스 삭제가 아니다. 다음은 실제 원문 보관소의 readonly bounded reader 공급과 별도 현재 권한/상태 대조 연결이다.
