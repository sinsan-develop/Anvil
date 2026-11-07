# FN06 private receive credential digest 저장 상세 대조

2026-11-04 · Main 어울 · 검토 지시 · 새 열 구현 GO는 아직0

## 공통·정정

직전의 외국어가 섞인 불완전한 내부 전달은 폐기한다. Main의 긴 내부 지시는 검증된 이 문서로 전달하며 승인 범위를 넓히지 않는다. 기존 source-only 채택과 단독 Primary의 다른 구현은 계속 유효하다. 실제 DB/권한/키/서비스/Agent/컴파일/QA는 제외다.

## Primary

발견한 wire §7의 digest-only 저장과 계상 exact schema의 저장 열 누락을 수거했다. 공개 Session snapshot이나 request_hash/content_hash의 의미를 바꾸지 않은 판단이 맞다. 아래 독립 검토 동안 해당 열은 아직 쓰지 말고 독립 quota/guard 구현을 계속한다. 제안은 허용0076 records의 private receive_credential_digest text NULL 한 열이며 SESSION에만 lowercase64hex 필수, 다른 kind는 NULL이다. 공개 request/response/snapshot hash·권한·기한은 바꾸지 않는다. 평문 credential은 저장/보고하지 않는다.

## 읽기 전용 검토 담당자

현재 채택 wire6d1a727f의 digest-only 저장 요구와 계상f8667e17의 private exact columns를 대조한다. 같은 명시 데이터의 누락된 private 저장 슬롯 보완인지, 새로운 공개/인증/보관/권한 의미가 생기는지 근거를 반환한다. 제품/SQL/시험/문서 쓰기와 실제 실행은0이다. Primary에게 직접 코드 지시하지 않는다.

제안 nullable 열이 이미 비어 있지 않은 P(record)에 추가될 때 키/값의 canonical 증가량을 독립 계산한다. SESSION 한 행의 64hex 값과 다른44행의 NULL을 구분하고 records45행 전체 actual/future에 포함한다. R54 전체나 public snapshot_canonical/JSONB에 잘못 곱하거나 새로운 원문 hash에 넣지 않는다. 다른 summary도 같은 정확 분모를 써야 한다.

SQL CHECK에서 SESSION의 NULL이 UNKNOWN으로 통과하지 않도록 명시 IS NOT NULL/IS NULL 분기를 확인한다. 값은 서버가 실제 발급한 새 receive credential에서만 생산하고 발급/인증 조회가 같은 digest 표현을 써야 한다. public JSON/오류/로그·일반 조회에는 반환하지 않는다. 기존 일반 native credential 또는 다른 purpose hash로 재사용하지 않는다. 평문 저장·새 외부 권한·만료 연장·새 user decision 입력은 제안하지 않는다.

Main이 근거·정확 byte 차분·최소 producer/collector 접점을 받은 뒤 기존 직접 채택을 부모로 한 내부 상세 보완 binding을 판정한다. 답변 전 새 열을 임의 승인으로 취급하지 않는다.


## 현재 지시 단계2 — 실제 반영의 읽기 검수

이 단계가 위의 승인 전 검토 단계를 대체한다. Main 상세 binding5027015a에서기존source승인안구현GO를확정했고Primary가0076/store/시험에실제반영했다고보고했다. 읽기담당자는다음만검토하며새코드/SQL/문서쓰기·시험재실행·실환경접근은0이다.

대상은현재작성중인 db/migrations/0076_native_first_receive.sql.pending, apps/server/modules/executions/native-first-receive-store.ts 및해당native-first-receive-store/schema시험이다. 실제있는경로만먼저확인하고아직없는시험은미작성으로구분한다. source writer는계속quota를작성하므로전체파일전후hash가달라지면해당차이를드러내고관련DDL/목적함수/projection의읽은범위만판정한다. S2전체완료를요구하거나없는S3이후를결함으로세지않는다.

검수항목: (1) SESSION만nonnull64hex/다른kindNULL의SQL CHECK가UNKNOWN을허용하지않는지, (2) 발급/인증이같은ASCII43 SHA256을사용하고기존nativepurpose를전용하지않는지, (3) public snapshot/ref/hash/응답/로그로private열이흐르지않는지, (4) fn76_projection/최대template/remaining의모든record에NULL또는digest가포함돼95+44x33=1547B차분이일치하는지다. private열의actual과future전환·summary자기비용검산도실제읽은source에서확인한다.

Primary제출은발급/인증2RED→2GREEN(155.1695ms),오염응답/표현혼용/물리열전수대조/NULL CHECK/1547B직접4PASS(224.1856ms),예약83항목builder2GREEN/control codec2GREEN이다. Main이실행한시험결과는아니며실PG/전체quota역완결은미검증이다. 읽기결과와지문·정확finding을Main에게반환하고Primary에게직접수정지시하지않는다.
