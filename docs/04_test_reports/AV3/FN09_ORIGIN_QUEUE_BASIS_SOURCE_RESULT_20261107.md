# FN09 원자료 기반 합성 START 입력 검수 결과 — 2026-11-07

판정: **기존 승인 범위의 내부 입력 생산과 합성 검수 단위 인수**. 전체 FN09, 큐 연결, 실제 권한 발급, Stage, 작업계획서 완료는 아니다.

- 담당: 기존 Primary 단일 writer, 독립 검토 담당, Main 어울 검수·통합.
- 기준: 원자료 bbd20aa5, 시험 보완 5bac8073765ed5b69ae64c81b750bcf8a664df43, 지시서 FN09_ORIGIN_QUEUE_BASIS_SOURCE_WI_20261107.md SHA256 981850DAB32F3219B5D40B3DE5E8B21AD63849D8B1210599E8541CEA0712BA10. 사용자 FN09 r2 source-only 승인 안의 내부 구현.
- 동일 보호 PoolClient·actor/Session/H·현재 제어/정책·S/Q·FRESH 출처·DB 관측 및 단조 기한을 대조한 뒤 기존 정확 {intent,claim}을 반환한다. 등록 준비 공통11·원 준비/Options·실행/논리 Session/임무/한도와 새 queue commandId를 검산한다. 별도 명시 합성 수요는 기존 readClaim을 그대로 소비한다.
- 현재 사실·실행 허가/소비·credential·예약·저장·네트워크를 생산하지 않는다. 취소/기한을 넘긴 응답은 거절하고 기존 읽기가 정착하기 전 Tx를 반환하지 않는다.

| 정확 변경 경로 | 바이트 | SHA256 |
|---|---:|---|
| apps/server/modules/executions/execution-start-origin-queue-basis.ts | 11012 | D00041F5534357427104CA4052FB1F38A195701862AF943215CCCCEB6098EE01 |
| apps/server/modules/executions/execution-budget.ts | 20198 | D17202FBC3213888FCC317BBC754BE1F98B3CE6FF4A785F985CF6CD2052278D5 |
| tests/unit/FN09/execution-start-origin-queue-basis.test.ts | 13738 | 12E2DBFE6389F4CBBB0F6014EB8E74700B22464A46C1EC7499928F2D41765D60 |

## 검사와 보완

- 실제 메모리 S/Q 저장 후 생산자 부재 857978 RED 1FAIL→e938d9 GREEN. DB 시각 역행 8221f8 RED→df01a5 GREEN. 시험 준비 오류1은 동결 인증 객체를 수정하는 대신 시험용 사본을 사용해 정정했다.
- Primary 63da7b 및 Main f83cac: node --experimental-test-module-mocks --test tests/unit/FN09/execution-start-origin-queue-basis.test.ts tests/unit/FN08/execution-command-ledger.test.ts. Main 신규9·인접15=24PASS/0FAIL/0SKIP·6558.9922ms·exit0.
- 독립 C0/I1/M0: AbortSignal own 속성이 실제 취소를 숨긴다. Main e120ad 순수 재현 후 Primary 24fbc9 음성3 RED→11e7fd GREEN. 고정한 내장 getter와 Proxy 선차단으로 가림/가짜/진행 중 취소를 거절한다. Node 내부 심벌을 변조하는 프로세스 코드의 권위 검증은 범위 밖이다.
- 최종 Primary 715670 12PASS, b1819c npm run typecheck exit0, f31f92 diff0. Main 4a5b28: node --experimental-test-module-mocks --test tests/unit/FN09/execution-start-origin-queue-basis.test.ts, 12PASS/0FAIL/0CANCEL/0SKIP/0TODO·7784.5745ms·exit0. 원 시험10955B prefix 2883883C… 불변·budget 별칭만. 최종 독립 scoped C0/I0/M0. 인접15는 보완 전 불변 파일에서 통과했으며 변경 없는 반복0이다. 고유 결과 신규12와 인접15를 분리한다.
- 미검증: 실제 PG/정책 변경·HTTP/UI·실제 queue에 이 공급자를 조립해 정착·current/grant/E/첫 SEND/SDK·OS·Agent·키·서비스. 실제 실행·원격 게시·PR/병합0. 롤백은 정확3 소스 변경의 역패치로 가능하며 DB·서비스 롤백이 필요한 변경은 없다.

## 다음 선행

동결 정책 후보 D4DCBC7F §4에서 S의 원 등록 정책과 후속 정확 ID별 최신 실행 정책의 선행 충돌을 분리했다. 기존 S/Q와 원 영수증을 보존하는 A(별도 최신 실행 정책 결박) 또는 사전 서버 식별 승인 B 중 미채택이다. 현재 동일 정책 비교를 제거하거나 합성 정책 대역으로 정상 저장을 주장하지 않는다. PMO에 판단 근거를 전달했고 새 권위/공개/저장 계약은 구현하지 않았다. 발급·전달·SDK 첫 SEND 순서도 별도 미결정이며 추가 SDK 읽기 1회 ENOTFOUND 후 재시도0이다.
