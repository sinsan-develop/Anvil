# FN08 START 문맥 직렬화 할당 보완 작업지시서

> 담당자는 기존 Primary이며 subagent-driven 방식으로 순차 수행한다. Main이 검수·통합한다. 현재 UI4 writer가 반환한 뒤 Main GO로만 착수한다.

**목표**: 원 START 문맥 집계 시험의 10초·기대값을 유지하면서 순수 정규 직렬화의 불필요한 조립 할당만 줄인다.
**구조**: canonicalJson의 descriptor snapshot·정렬·검증·재귀 순서를 그대로 두고 parts/map/join 결과 배열만 문자열 누적으로 대체한다.
**기술**: 기존 Node24·TypeScript·node:test를 사용하며 새 의존성·환경 설정은 추가하지 않는다.
**근거**: WORK_PLAN의 FN08 직접 회귀, WORK_STATUS의 원 실패·진단, PMO의 현재 Stage 보호 의미 보존 성능 보완 지시. 새로운 기능/권한 계약을 채택하는 문서가 아니다.

## 고정 범위와 기준선

- 제품 수정은 `contracts/canonical.ts` 하나, 시험 수정은 `tests/unit/contracts/canonical.test.ts` 하나다. 다른 제품/시험·실환경은 쓰지 않는다.
- 원 제품 2986B SHA256 `5be93c5b92a3bda99baa9bc561e6b535c9c1ab80196601e561903a0b6f74e143`, 원 시험 1385B SHA256 `926c3abe7bce9925c2045b140fad86561c2253cda08d4b99b60f0ab2c1deaf75`를 착수 때 대조한다.
- 기존 `canonicalJson(value: unknown): string`, `contentHash`, `parseWireJson`의 공개 서명과 출력 바이트·허용/거절 의미를 보존한다. contentHash/parseWireJson 본문 변경은 제외한다.
- 권한/current/Tx/clock/xid/회수/기한/원 proof·원문 읽기/SQL 호출을 제거·캐시·성공 대역으로 바꾸지 않는다. 객체값·직렬화 결과의 memo-cache도 추가하지 않는다.
- descriptor snapshot 획득·symbol/prototype 검사·배열 length/index 관측·객체 키 UTF-16 정렬·getter 호출0·예외 순서·active Set finally 정리를 보존한다.
- 실제 DB·권한·키·OS 자료·서비스·Agent·환경 변경0. 기존 aggregate 시험·timeout10000·기대값·skip은 수정하지 않는다.

## 검토 초점

1. 유효 입력의 정규 문자열/UTF-8/hash가 바뀌는지. 음수0·한글/이모지·이스케이프/키 정렬을 고정 예제로 검산한다.
2. depth64/65·cycle와 공유 하위 객체·null/custom prototype·custom array prototype의 기존 결과를 보존하는지.
3. symbol/nonenum/accessor·getter 호출0·sparse/추가 배열키·불량 Unicode 키/값·unsafe 정수·비유한 수 거절을 유지하는지.
4. 객체/배열 Proxy의 관측 순서와 중도 throw 뒤 정리를 원 구현 관측과 비교하는지. 전역 내장함수 자체가 변조된 환경까지 동치라고 주장하지 않는다.
5. 메모리 마이크로 비교의 소폭 개선을 종단 PASS로 승격하지 않는지. 원 10초 시험 통과가 채택의 필수 조건이다.

## 단일 업무 — 순수 조립 할당 제거와 종단 회귀

**입력/출력**: 기존 canonicalJson 계약을 그대로 소비·생산한다. 신규 포트·snapshot·권한·저장 결과는 없다.

- [ ] 원 실패 RED(기존 인접/단독 timeout 및 보존 진단)를 인수한다. 같은 원본 집계 측정을 다시 반복하지 않는다.
- [ ] 기존 3개 시험을 보존하고 위 5축의 정상/음성·Proxy 관측 검산을 추가한다. 구현 복제만으로 자기 자신을 검증하지 않고 고정 출력/거절과 독립 JSON 값의 정렬 기준을 사용한다.
- [ ] 제품의 배열 parts/push/join과 객체 map/parts/join 두 조립 구간만 동순서 누적으로 보완한다. descriptor 획득을 자식 인코딩 이후로 미루거나 검사·재귀·정렬을 바꾸지 않는다.
- [ ] `node --test tests/unit/contracts/canonical.test.ts`와 `npm run typecheck`, `git diff --check`를 실행한다. 실패/skip0·기존 hash 불변이 필요하다.
- [ ] `node --experimental-test-module-mocks --test --test-name-pattern='실제 보호 Context/Options→원 START queue/구체 proof/receiver' tests/unit/FN08/execution-start-context-source.test.ts`를 변경 후 단1회 실행한다. 내부 timeout10000과 원 기대값 그대로 실제 PASS/exit0이어야 한다.
- [ ] 보완 단위의 직접 serialization 영향만 Main과 합의해 검수한다. 전체 955개 참조 파일의 광범위 회귀를 자동 실행하지 않는다.
- [ ] 종단 실패면 성능 해결로 채택하지 않는다. 원 출력·후보 diff/hash를 반환하고 같은 후보 재실행·timeout 증가·검사 생략을 하지 않는다. Main이 정확 소유 diff의 철회/다음 원인 분석을 결정한다.
- [ ] 성공 여부와 별개로 정확2파일 diff/hash·명령/exit·오류 횟수·미검증·실행 handle/자원 상태를 반환하고 writer를 해제한다. commit/push/병합은 Main만 수행한다.

## 위험과 rollback

공유 정규화 함수의 참조가 넓으므로 한 바이트의 출력 변화도 허용하지 않는다. 실패하면 다른 변경을 덮지 않고 이 두 파일의 본인 변경 hunk만 원 기준선으로 되돌릴 수 있도록 before/after를 반환한다. 원 failed gate와 진단은 WORK_STATUS에 남긴다. 현재 작업 branch의 다른 backend/UI·Git 이력·실제 자료를 복구 대상으로 삼지 않는다.
