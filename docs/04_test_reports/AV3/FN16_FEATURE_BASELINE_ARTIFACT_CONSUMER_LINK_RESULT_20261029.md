# FN16 선택26 → 원문 검증 consumer 내부 연결 결과

- 작업: FN16 내부 source·메모리 합성 / 시작 2026-10-29, 최종 검수 2026-10-30 KST
- 기준 branch: codex/av3-stage-b / 시작 HEAD 514c601c6b5ba972c1682f366fac6e6fa1301175
- WI: docs/work_packages/FN16_FEATURE_BASELINE_ARTIFACT_CONSUMER_LINK_IMPLEMENTATION_20261029.md
- WI SHA256: EA6621CBA42EAC96260B8FBE236B68BCD682B38358AA11D0484218EBF80DEC03
- 판정: 한정 내부 연결 source 검수 완료. 실제 백업·복원·공개 호출·사용자 인수 및 전체 WORK_PLAN 완료가 아니다.

## 판단 이유와 변경

기존 전체 원문 검증 consumer는 guarded wrapper로 기본24만 소비했다. 명시 선택 context를 주면 실제 repository/CSRF와 baseline class를 사용하는 Root26 결과를 직접 소비하도록 연결했다. Root 동일 실행본문의 별도 frozen 내부 envelope에 실제 신원4와 최소 단조기한을 담고, 후속 실제 인증·OWNER·현재 원문/대화 body 대조에서 제한으로 사용한다. 해당 값은 인증 proof가 아니며 공개 DTO/hash/로그에 넣지 않는다.

기본24와 다른 단일·문서/대화/지식 소비자는 원 동작을 유지한다. private currentScope에만 선택 전용 resource check/remaining을 공급해 Root 및 후속 RC에서 짧아진 기한을 실제 byte verifier까지 전파한다. 외부 provider/caller boolean으로 인증을 대체하지 않는다.

D=기존24 고유 선언량, B=baseline 반복 읽기, V=후속 고유 검증량을 구분한다. D+B≤G·V≤D·B+V≤G, metadata 누적 및 Root 보수적 파일 상한을 검사한다. D를 V와 이중 차감하지 않으며 후속까지 하나의 genuine counter를 공유했다고 주장하지 않는다. class 검산은 RC 안에서 반복 IO, 후속 고유 verifier는 transaction 밖에서 원문당 open1이다. 전체 모드의 transaction0/open1 주장은 하지 않는다. 최초 의심/격리 차단과 마지막 현재성·false/미수집 항목은 유지한다.

## 변경 파일과 최종 SHA256

| 파일 | SHA256 |
|---|---|
| apps/server/modules/backups/project-inventory-composition.ts | 156F55AE8CE2EED169FC683C7082F0E4486CE64AD89A26A8E7E3FC02EC1FD450 |
| apps/server/modules/backups/artifact-current-verification.ts | 6E829EA99644F459BC54FE8E228931D18B6EB0A19B6A8BF0FCCD56247CB8847A |
| tests/unit/FN16/feature-baseline-artifact-consumer.test.ts | 07DB73DAE2CCB24B35080E32787DEB42ACB5EFF74BD24AAD710BEF51114DE56C |
| tests/unit/FN16/feature-baseline-artifact-consumer-schema.test.ts | 59DCAB9EE540ADC4E550D53C207A4F3A77297863B77FBEA4C906133C61F8A7C3 |

기존 class2792F681/helper96497534 불변. Main 같은 코드 쓰기0, Primary 단일 writer 해제. 소유 WI/본 결과/WORK_PLAN/WORK_STATUS 네 문서만 함께 게시한다. 기존 보호 미추적8은 제외한다.

## 실제 검증과 한계

수행자 최초 b03d59: 실제 envelope/소비선 부재 RED 0P/2F. 초기 타입 narrowing/반환·fixture 오류를 보완했다. Main 진행 읽기에서 context 재읽기·잔여0의 최소1 발명·동적 최소기한 전달을 대조했고 최종 source에 앞 await 복사/거절·선택 resource 전달을 확인했다. 제한 제거 변이8ecf57은 read2≠0 RED, 정확 복원은 read0/close1/413 GREEN이다. d8cd60은 앞 status 실패가 IO assertion을 가려 최종 변이 근거로 사용하지 않는다.

Main 5d4d83: 아래 명령 실제21 assertion PASS/0FAIL/0SKIP, 3288.1629ms, exit0. 당시 행동 지문은 3A3365DA…이며 제품2/schema는 최종과 같다.

```text
node --test --test-name-pattern="feature artifact consumer |featureArtifactConsumerSchema |feature composition actual context|feature composition default context|projectArtifacts 실제24|projectArtifacts 빈 실제조합|projectArtifactsSchema" tests/unit/FN16/feature-baseline-artifact-consumer.test.ts tests/unit/FN16/feature-baseline-artifact-consumer-schema.test.ts tests/unit/FN16/feature-baseline-composition.test.ts tests/unit/FN16/project-inventory-artifact-verification.test.ts tests/unit/FN16/project-inventory-artifact-verification-schema.test.ts
```

독립 코드 C0/I0 후 필수 검증 공백 Important1: actor401은 postRoot OWNER404를, physical close/pending auth는 후속 DB rollback/release 실패를 증명하지 못했다. 신규 행동 파일에만 정확 반례3·fixture trace를 추가했고 제품 변경은 없었다.

Main 7d0f31: 아래 추가3 PASS/0FAIL/0SKIP, 1518.865ms, exit0. 실제 Root 반환 경계에서 OWNER 상실→후속 실인증/OWNER 확인만·domain 조회0/physical IO0/404. ROLLBACK/release 실패는 각각 취소 유무 모두503·자기 client1·rollback1·release 시도1·COMMIT0이다.

```text
node --test --test-name-pattern="postRoot OWNER|downstream ROLLBACK failure|downstream release failure" tests/unit/FN16/feature-baseline-artifact-consumer.test.ts
npm run typecheck
git diff --check
```

Main ecb6bd: 최종 type/diff exit0·4지문 일치. Main385afe: 새 helper/시험3과 trace 계측만 메모리에서 역치환하여 이전3A3365DA 전체지문과 정확 일치. 앞21+추가3을 최종 지문의 단일 Main24 전수 실행으로 표기하지 않는다. 수행자349ad4의 최종 지정전체24 PASS/3023.2455ms는 별도 수행자 증거다. 독립 scoped 재검수에서 Important1 해소·최종 C0/I0, 직접 시험은 Main 증거와 구분한다.

Main 0aac2a diff: 기본 전체 consumer는 선택 분기 외 본문 유지, private resource 미전달 시 기존 동작. 실제 기존 회귀 prefix 매치 및 class/helper 불변 확인. 전체201/48/58/67 반복0, 기준 완화0. Main 도구 구문 오류015a02는 읽기 전 파싱 실패 후 dbbba5에서 수정·제품 오류/ACL 문제와 분리했다.

## 미실행·잔여·rollback

실제 DB/SQL·FS 원문·키·서비스·Agent·public route·설치·archive/restore·브라우저·사용자인수 NOT_RUN. 메모리 owned-handle/실 source 메서드 호출은 실제 외부 환경 증명이 아니다. 보조 joined-row의 전체 정책표 통합도 주장하지 않는다. 공개 ProjectBackups는 기존 문서/첨부1개 계약 그대로이며 158E10BC 미채택·공유요청B 권위 미충족·보호참조A 미연결·FN15 factory 미활성은 유지한다. 전체 FN16·계획은 미완료다.

rollback은 지정 내부 delta의 정상 Git revert이며 main/이력 rewrite·실자료/계정/키·DB/서비스 변경이 아니다. 다음은 기존 승인 범위의 미수집/미연결 단위와 실제 소비선을 대조해 선정하며 완료된 단위를 재실행하지 않는다.
