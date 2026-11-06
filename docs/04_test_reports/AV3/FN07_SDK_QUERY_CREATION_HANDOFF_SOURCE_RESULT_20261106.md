# FN07 내부 SDK Query 생성·기존 owner 인계 소스 검수 결과

- 판정: 승인된 내부 소스·합성 단위 인수. 실제 Claude SDK·프로세스·Agent 실행 및 FN07 전체 완료는 아님.
- 기준: WORK_PLAN FN07, PMO 내부 구현 분류, Main SOURCE_GO §297.
- 작업지시서: docs/work_packages/FN07_SDK_QUERY_CREATION_HANDOFF_SOURCE_IMPLEMENTATION_20261106.md
- 작업지시서 SHA256: 1DA9D3580ACC60CB743579F05396F97F15B9EEBE78DA40BCD783D8D353B46673
- 시작·검수 HEAD: 8402d9dc250531ed374b069b20932043a37fd46d, branch codex/av3-stage-b.
- 담당: 기존 Primary 구현, 기존 읽기 전용 담당자 독립 검토, Main 직접 검증·통합.

## 변경과 동작

기존 모듈은 수정하지 않고 신규 두 파일을 추가했다.

| 경로 | bytes | SHA256 |
|---|---:|---|
| apps/connector/adapters/secondary/sdk-query-factory.ts | 16133 | ACACF14DD16378F1EFD95DD241D190432E47D54C9F724D46BDF97F603E2B4F19 |
| tests/unit/FN07/claude-sdk-query-factory.test.ts | 21438 | 0ABFA47181780A4F13D993B9DAD55D38E3500AE43414AB98C3FED12B52C09D5D |

명시 합성 receiver의 원 START envelope와 Options bytes를 기존 reader로 검산하고, 한 factory 인스턴스의 동일 시도에서 driver create를 최대 한 번 호출한다. 원 Query의 iterator를 한 번 획득하고 지원되는 init 전 관측과 init을 제한된 메모리에 보존해 기존 owner/codec에 순서대로 인계한다. 자동 prompt 전송·새 SID 채택·새 실행 권위는 추가하지 않았다.

대기 중 취소·기한 만료·생성 오류·다른 SID·불량 Query·EOF는 성공으로 바꾸지 않는다. 외부 UNKNOWN 뒤 늦게 정착한 원 Query는 같은 소유 자원으로 보존·정리하며 재생성하지 않는다. raw close는 단발이고, 메서드 정착을 OS 회수 증거로 표시하지 않는다. 모든 실행·수락·소유 검증 표시는 false/UNVERIFIED다.

## 발견·보완

- 행동 RED f07562: 인계 후 await 중 원 Query 함수가 교체돼도 OBSERVED를 반환했다. await 뒤 원 함수 재검산으로 UNKNOWN 거절을 확인했다.
- 독립 첫 검토 C0/I1/M0: 검산한 가변 call을 microtask/await 뒤 다시 읽어 원 signal 취소와 listener 제거 대상을 놓칠 수 있었다.
- 실제 RED 6ddf94: 원 A 취소 후 OWNER_AVAILABLE 반환 및 close getter 2회 실행. 원 signal·expiresAt을 own 데이터 속성으로 복사·고정한 뒤 GREEN 441c63에서 반례 2개를 통과했다.
- 최종 독립 검토: 두 파일의 시작·종료 지문 동일, C0/I0/M0. 시험은 읽기만 했으며 실행 결과에 합산하지 않았다.
- 최초 export 부재·definite-assignment/임시 facade 타입 오류·음성 주입 순서 오류는 준비 오류로 분리한다. 같은 원인의 정식 Developer FAILURE_REPORT 3회 또는 Main 인수는 없다.

## Main 직접 검증

검사 전 93de26과 검사 후 cd8054에서 신규 두 파일 및 기존 owner/options 지문이 같았다. 보호 중인 관련 없는 3파일은 인수 범위에서 제외했다.

| 증거 | 정확 명령 | 실제 결과 |
|---|---|---|
| 8f690f | node --test tests/unit/FN07/claude-sdk-query-factory.test.ts tests/unit/FN07/claude-start-options.test.ts tests/unit/FN07/claude-sdk-session-owner.test.ts | 36 PASS / fail0 / cancelled0 / skip0 / todo0 / 542.0223ms / exit0 |
| 213456 | npm run typecheck | exit0 |
| 213456 | git diff --check | exit0 |

36개는 신규16·직접 인접20의 고유 합계다. Primary의 중간11/14/34 및 최종36을 더하지 않는다. 코드·환경이 바뀌지 않은 이전 FN08/codec 전수 검사는 반복하지 않았다.

## 미검증·다음 작업·복구

실제 SDK import/query·OS child·원 SID 출처·실제 current/권한·모델/비용·process 보호·사용자 최초 입력·도구 중재·영속 중복 방지·DB·서비스·브라우저·사용자 인수는 실행하지 않았다. 인스턴스 내 단발만 검증했으며 재시작 이후 보장은 없다. 합성 포트는 실제 coding Agent 기능을 대신하지 않는다.

기존 owner/options/codec/schema·SQL·package·native 원문 변경0, 실제 DB·권한·키·서비스·Agent·실자료 실행0이다. Primary는 live/pending0을 제출했고 Main 시험도 종료 코드0으로 정착했다. 로컬 소스 checkpoint만 작성하며 private push·PR·main 통합·배포 증거는 없다.

복구는 이 신규 두 파일과 이 단위 문서 기록을 검토해 정상 revert하는 범위다. 관련 없는 dirty/untracked 자료는 보존한다. 후속은 기존 계약에서 실행 준비·첫 입력·SID·도구 중재의 미완료 공급 경계를 좁혀 별도 업무를 선정한다. 전체 작업계획은 진행 중이며 완료보고 조건 미충족이다.
