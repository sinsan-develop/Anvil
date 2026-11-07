# FN14 등록 정의 과거 결박의 이전 준비 화면 보호 조회 연결

- Main 어울 / 기존 Primary 단일 writer.
- 기준 main `285a1ff5d1fecea167ba452240e93f6587e92ac3`, 현재 branch `codex/av3-fn14-transfer-followup`.
- 근거: WORK_PLAN/FUNCTION_WORK FN14·UI09, 기존 FN14_PREPARATION_RECORD_WEB_IMPLEMENTATION_20261101 및 FN09_REGISTERED_DEFINITION_RESERVATION_SOURCE_IMPLEMENTATION_20261101 계약.

## 실제 누락과 변경 전후

Web transfers/preparation-record-api.ts의 readPreparationBinding은 snapshot exact 키에서 connectionKind를 거절하고 CANDIDATE_ONLY만 허용한다. 서버 responsible-sessions의 기존 readBinding과 Web 책임세션 reader는 optional REGISTERED_DEFINITION 및 REGISTERED_DEFINITION_ONLY 쌍을 이미 지원한다. FN14의 기존 source adapter도 readBinding을 그대로 소비하며 후보 전용 제한이 없다.

실제 TransferPreparationRecordPanel은 과거 결박 선택과 저장 전 재조회에 이 reader를 사용하므로 정상 등록 정의 GET이 거절돼 oldBindingRef 선택이 끝나지 않는다.

변경 전: 후보 결박만 선택/재조회 가능.
변경 후: 종류 없음/CANDIDATE_ONLY 및 명시 REGISTERED_DEFINITION/REGISTERED_DEFINITION_ONLY 두 기존 원형만 정확 판독한다. null/unknown own kind·교차 상태는 거절한다. 새 공개 DTO/저장·서버·실행 권위는 추가하지 않는다.

## 정확 소유

- 제품: apps/web/src/features/transfers/preparation-record-api.ts 한 파일.
- 화면 시험: tests/unit/UI09/preparation-record-ui.test.ts 기존 한 파일.
- 필수 인접 시험 정합화: tests/unit/FN14/preparation-record-connection.test.ts의 buildApp용 합성 repository 두 객체에 기존 UUID 생산자의 installationId:id(99)만 추가한다. 실제 설치 ID·키를 읽지 않으며 native owner/current 검증을 성공값으로 우회하지 않는다. 기존 시험 기대값·본문·실패 조건은 바꾸지 않는다.

위 인접 시험의 두 필수 합성 metadata 필드 외에는 그 파일을 수정하지 않는다. 그 외 제품/서버/SQL/화면 구조·export는 수정하지 않는다. Main은 이 지시서/WORK_STATUS/결과 문서만 쓴다. 다른 파일이 필요하면 사유와 정확 diff를 먼저 반환한다.

## 수행과 검수

1. 기존 실제 Page 시험에서 hash가 정상인 등록 정의 결박 GET→선택→저장 전 보호 재조회→준비기록 저장/정확 GET이 현 reader에서 거절되는 RED를 확보한다.
2. 서버 기존 reader와 같은 optional discriminator의 exact 키·허용 종류·readiness 대응만 보완한다. 형상/hash/project·assignment/role·버전·RESERVED·external handle null·권위 false·active 검사를 보존한다.
3. 등록 정의 정상과 기존 후보 양성을 함께 확인한다. 재봉인 null/unknown kind·교차 readiness·추가키·hash/project/assignment/role 변조·true 권위·external handle 혼입은 보호 조회에서 거절해야 한다.
4. 늦은 GET/문맥 전환과 저장 전 재조회에서 변경된 결박 거절, 기존 UNKNOWN packet·영수증 보존·자동 재송신/추가 POST0을 유지한다. 실제 이전·이해합격·재개는 false이며 새로운 허가나 실행 버튼을 만들지 않는다.
5. 변경 시험과 직접 영향받는 기존 준비 기록 읽기/저장 시험만 선택한다. 최종 타입·UI 메모리 빌드·diff check와 독립 읽기 검수를 수행한다. 무관한 FN09/FN12 통과 검증은 반복하지 않는다.

실제 DB·권한·키·서비스·Agent/SSH·사용자 자료 조사·실이전·배포는 제외한다. 합성 Page/GET·저장 검증을 실제 서버/브라우저 인수로 승격하지 않는다.

## 반환과 복구

정확 명령/exit/결과·변경 파일 지문·RED→GREEN·오류/미검증·현재 handle을 보고하고 writer를 해제한다. 같은 branch 게시→일반 PR/Broker 통합→merged-main smoke→완료 branch 정리 뒤 다음 미완료로 이어간다. 복구는 통합 PR의 정상 revert이며 실제 DB 복구는 없다. 전체 FN14/WORK_PLAN 완료로 보고하지 않는다.
