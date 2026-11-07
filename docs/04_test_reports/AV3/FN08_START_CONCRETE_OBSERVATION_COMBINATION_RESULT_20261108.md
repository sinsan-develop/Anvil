# FN08 구체 START 관측 결합 결과

## 판정과 범위

기존 START 보호 원문 종단의 10초 시간 초과를 해소한 source 보완 후보를 인수한다. 제품5·시험2 변경이며 원 집계 시험은 변경하지 않았다. 전체 FN08·Stage·작업계획서 완료나 실제 환경 인수는 아니다.

- 작업지시서: docs/work_packages/FN08_START_CONCRETE_OBSERVATION_COMBINATION_WI_20261108.md
- WI SHA256: 2A8A855F0C24227BC274DED99D17A260DB731A0A96EE2C948C6C4591BF388B70
- 기준 branch: codex/av3-fn09-origin-decision-storage
- 구현 착수 HEAD: 3f21170bcb68103373411714e0559409df700642
- 문서 checkpoint 후 HEAD: 9705f69cffdef8d48f69bfe549809e28e1710ec6
- 담당: 기존 Primary 구현·직접시험, Main 검수·통합, 기존 reviewer 독립 읽기·음성시험. 동시 code writer1.

## 실제 변경

실제 Store transaction에서 만든 materials와 같은 Parts/Basis/Repository/Source 조합만 private WeakMap의 단발 ticket으로 연결한다. 본문 전 원 전체 proof/target/actor/command/material 검산을 수행하고, 실제 body의 bytes/hash/UTF-8/Secret 검사 뒤 fresh-after를 검산한다. binding은 checkedAt만 제외하며 expires/writerState를 유지한다. query/xid·등록/회수·최단기한과 마지막 await 뒤 descriptor 검산을 유지한다.

일반 SEND와 구조적 합성 포트는 기존 fallback을 사용한다. caller boolean이나 raw db/actor를 받는 등록 포트는 추가하지 않는다. 두 materialFor·nonce/results·두 consume·UNKNOWN 알고리즘은 보존한다. close/실패/Tx 종료 시 private frame을 명시 삭제하고 진행 중 close도 결과 반환·phase 부활을 차단한다. 중복 관측 사이 모든 순간적 변화를 이전과 동일하게 포착한다고 주장하지 않는다.

## 증거

| 증거 | 결과와 한계 |
|---|---|
| 9ab6f9 → 5166d0 | 합성 관측수 RED inspect12/기대4 → GREEN. materialFor2회 body2/inspect4·원 단발 기록 보존. 실제 보호 source 계측으로 승격하지 않음 |
| 392693 → 38c203 | 마지막 txid await 중 메서드 가림 RED → 반환 직전 동기 pin 검산 GREEN·getter0 |
| ed4f4a → 8fab4b | BODY 대기 중 close 뒤 결과 반환 RED → owner/context·BUSY·open 재검산 GREEN |
| 1c66ef | 직접2파일 41PASS/skip0/exit0. 명시폐기 보완 전 증거 |
| 4b2a52 | 기존 SEND Parts 인접9PASS/skip0/exit0 |
| 2765e7 | 최종 구체 정상·음성10PASS/skip0/exit0 |
| c7394e | 최종 원 aggregate1PASS/skip0/exit0. 사례9867.6492ms·전체10761.9819ms |
| e5a5e2 / 287a27 | 최종 typecheck exit0 / 변경2모듈 import 정상·diff0·writer 반환 |
| Main 187bb2→518439 | 폐기 보완 전 5raw 대조·원 aggregate1PASS/skip0/exit0(9439.7353ms). 최종2변경전 증거로 분리 |
| Main 0ea28b / d56ab8→8a68b3 | 최종8raw/정렬manifest 일치·원aggregate 불변·시험2 원 접두사 보존 / 최종 typecheck exit0 |
| 독립 ed11b1 / c514f7 | 최종5raw 시작·종료 일치·source C0/I0/M0·구체 START10PASS/skip0/exit0·diff0. 원aggregate 중복실행0 |

정확 시험 명령:

```text
node --test tests/unit/FN08/execution-materials.test.ts tests/unit/FN08/execution-start-material-registration-flow.test.ts
node --test tests/unit/FN08/execution-instruction-material-parts.test.ts
node --test --test-name-pattern='구체 START' tests/unit/FN08/execution-start-material-registration-flow.test.ts
node --experimental-test-module-mocks --test --test-name-pattern='실제 보호 Context/Options→원 START queue/구체 proof/receiver' tests/unit/FN08/execution-start-context-source.test.ts
node --experimental-transform-types --experimental-test-module-mocks --disable-warning=ExperimentalWarning --test --test-name-pattern='구체 START' tests/unit/FN08/execution-start-material-registration-flow.test.ts
npm run typecheck
git diff --check
```

서로 겹치는 시험 수를 합산해 단일 전체 실행의 PASS로 보고하지 않는다. 최종 원 gate의 내부10초 여유는 약132ms이므로 안정적인 성능 여유를 확보했다고 주장하지 않는다. 같은 후보의 무변경 반복 측정이나 timeout·기대값 완화는 하지 않았다.

## 최종 고정 파일

제품 경로 접두사는 apps/server/modules/executions/, 시험은 tests/unit/FN08/이다.

| 파일 | bytes | SHA256 |
|---|---:|---|
| execution-start-material-parts.ts | 12226 | 442feb6df519ca8358c1b0d2942d0b9c266d37503ff375302928ca3d06438e1e |
| execution-start-material-basis.ts | 7946 | 5d43f2616f1347fe249f6454986cc2fe177ad24f2b81669ff3a62d93eaf2cda7 |
| execution-instruction-material-store.ts | 14813 | 7b0bb289e841a7d450054a82fa6aca4636c75bb57c661f29f77db112a335dfdc |
| execution-authenticated-materials.ts | 8581 | c9f7c53d9afb961f753b7df28d33377044e9d0c8ea2c1b5ae8eb4b2620a9aaf8 |
| execution-materials.ts | 11712 | decd413a62932cf9d0faf6d2061112b37d4e47f5c8300643b0aff17de3f4dbc2 |
| execution-materials.test.ts | 21501 | 0296d13d6d542442ccdfa5c45ca4bfe86e47cdaef904fd6a260b9f6d92bfe182 |
| execution-start-material-registration-flow.test.ts | 38378 | d6f168cd8f5ed5da3b07783007414948bb59a8491698a9285ca61a9363d0edc3 |
| execution-start-context-source.test.ts（불변） | 44490 | c42a8d6b993b3991faa4b543ba2566c673d7dd0f39e20898d3dc8c834474d61e |

경로 오름차순·각 객체 key path/bytes/sha256·소문자 hash·compact JSON 배열 UTF-8/no BOM/no 마지막 개행의 8파일 manifest는 26ee1b654f8fb32fe376ce9d01bf12ff6dc6496088e579537f8ec14552f5e013이다. 독립 WI열거순서 manifest와의 차이는 정렬 방식 차이이며 개별8raw는 일치한다.

## 오류·미검증·복구

중복 지역변수 import 준비오류1, 누적 trace 집계 준비오류1, 내부 assert가 Store 고정 오류로 감싸진 시험 준비오류1, 시험 반환형 TS18046 한 원인4위치를 보정해 제품 RED와 구분했다. 마지막 await·동시 close의 실제 결함은 각각 반례 RED→GREEN으로 기록했다. 동일 근본 원인3회 실패 없음.

실제 DB/SQL·권한·키·서비스·Agent·SSH·실자료 조사·브라우저·운영 검증은 미실행이다. 임시 실행 handle/pending0이며 시험 프로세스 외 실제 자원 생성0이다. backend10/UI4/canonical과 원 집계 시험은 보존했다. 원 canonical 실패 후보는 과거 결과보고에 그대로 남긴다.

복구는 본 보완의 소유 제품5/시험2 diff만 분리 철회하며 원 시간 초과가 다시 드러남을 기록한다. 기존 backend/UI·사용자 자료·Git 이력을 덮지 않는다. 통합 이후에는 정상 PR revert 절차로 복구한다. 다음은 기존 채택 FN09의 승인Ref가 있는 exact8키 START 소비·동일Tx 저장·v3 결과 조회이며 전체 계획은 계속 미완료다.
