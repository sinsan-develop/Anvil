# FN03 보호 관리 원문 생산자 A안 채택 결정 패킷

판정: 새 계약 결정 필요/미채택/제품 구현 GO0. 기존 작업계획 FN03의 실제 관측 생산자 선행이며 범위 밖 새 제품을 제안하는 것이 아니다. 기준main969cebbc4a69dda633da0b05f16fabf4c0f070c1, 검토 branch codex/av3-source-content-origin-contract. 기술 후보 docs/contracts/FN03_SOURCE_CONTENT_MANAGEMENT_ORIGIN_PRODUCER_CANDIDATE_20261108.md, SHA256 cbefc3e3736301e9a49b8b26db41fcc3c0cedbb0a052c9e0cdaedde0b93c5230. 기존 FN03_SOURCE_CONTENT_HASH_DELTA_CANDIDATE.md §13.4에서 명시적으로 미채택인 새 보호 원문 저장/전용읽기·관리 생산권한·저장량 귀속만 이번 결정 대상이다.

## 1. 왜 새 결정인가
이미 채택된 CM01~08의 순수 SOURCE 형상·codec/inspector와 drift선택소비기를 다시 승인받는 것이 아니다. 현재 commands는 원 envelope를 저장하지 않고, policy snapshot을 원명령으로 역생성하면 출처 증명을 만들 수 없다. 미적용0040은4개 SOURCE_CONTENT표의 RLSfalse/권한회수/무조건거절trigger로 실제생산을 닫았다. 단순현재true adapter나 security-definer 별칭으로 우회할 수 없다. 첫필수단위는 실제관리 명령→원 envelope origin/event/C/A/U·quota→전용내부 보호조회이며 이 단위만으로 nonce/native서명/실파일관측/LINK·전체FN03를 완료하지 않는다.

## 2. 권장 A — DB보호 원문·현재 관리 목적·단일 계상 계약 채택
- 후보§2의 origin exact9/도출snapshot exact10·불변1:1·원 envelope≤1MiB/snapshot≤2MiB, 원문없는역사 ORIGIN_ABSENT·역생성0.
- 실제Access token/non-null43CSRF→현재OWNER·동일client단독제어·재인증·정확PROJECT/HUMAN 별도AUTO. private callback/samequery/PoolClient/xid·원명령 고정과DB행현재검산을 분리한다. token소유를fn01_active/GUC/DTO가 증명한다고 하지 않는다. REQUIRE_APPROVAL은정확소비계약전닫는다.
- readSourceContentPolicyManagementOrigin exact3·원문서버내inspector한정/일반반환 exact5·UNVERIFIED. 새HTTPread endpoint/일반files/검색/Agent원문전달0.
- 후보§7의새purpose NOLOGIN/NOINHERIT/NOBYPASS역할·앱membership0·표비소유/고정search_path·FORCERLS·역할전용정책/SELECT·INSERT만,policy_events의무조건거절trigger1개를명시INSERTguard로교체한다. 다른SOURCE관측표·LINK/UPDATE/DELETE/TRUNCATE차단은보존한다. 일반app/PUBLIC의원문직접조회/DML·내부helperEXECUTE를열지않는다. 목적RPC만제한하고잠금에필요한정확열권한을WI에서동결한다.
- O/E/C/A/U5물리행과단일R예약자기비용을원defineSourceContentPolicy 명령에각한번귀속한다. 새part_kind=SOURCE_CONTENT_POLICY_MANAGEMENT/part_key=management_origin/purpose=SOURCE_CONTENT_POLICY_MANAGEMENT_STORAGE. 기존project10GiB 동일분모에새관리metadata를편입하는의미를채택한다. 무필터SETTLED에새R이이미포함되므로새actual소계/FN75·76중복가산0이다.
- 실고정wire/refs/IDs와정해진물리시각·순번/타입·nullable/generated투영으로M을도출하고r/s 최소고정점·B≤M/s≤r를검산한다. 임의여유byte배수·사용자비용0. 미상계필드가남으면준비거절,actualCOMMIT/정산을합성으로완료주장0.
- 현재0082뒤신규0083 forward만제안하며원0040/적용SQL은보존한다. 실제DDL·GRANT·DB연결/정책부여·키/서비스·Agent/실자료·nonce/native내용읽기·J3/P03실행0이다.

이번 A채택의 구현 범위는 코드·정책선택화면·미적용SQL·합성검증이다. 신산님결정후 Main이기술WI의정확파일·함수시그니처/각열ACL·함수DAG/잠금/완결·Mtemplate를동결하고독립검토후기존Primary단일writer에위임한다. 같은의미의내부기술구체화로재승인을반복하지않고새인증/공개/데이터의미변경만다시구분한다. Main은관리·검수·통합을소유한다.

## 3. 대안
- B: 비공개ArtifactStore 보관 방식으로수정한다. 기존경로보호를재사용하나새관리자료종류/일반GET차단·DB/FS게시와COMMIT불명·복제비용의별도상세가필요하며이문서가그코드GO가되지는않는다.
- C: 이생산자경로를보류한다. 새권한/비용효과0이지만실제관리원문과관측생산미완료를해소하지못하며전체계획완료로표시하지않는다. 다른승인된독립작업은계속한다.
A는DB/원명령원자관계와원문격리를같은목적으로검산할수있어권장한다. 실제계정·키·권한부여나실환경변경은모든안에서이번범위외다.

## 4. 검토·검수와 복구
기존reader의비용전용검수 C0/I0/M0와 독립전체사전기술검수 C0/I0는위후보SHA에서확인했다. 이는정적안의일관성이지SQL실행·실제인증/저장원자성PASS가아니다. exactSQL시그니처/열ACL·DAG/잠금순서·비용template/수렴은구현전WI동결조건이며구현후별도검수한다.

필수합성은실클래스/인증거래경계→본인AUTO관리→원문/event/C/A/U·예약정착→내부보호조회→기존UNVERIFIED형상,회수/만료/타인/세대/재인증/DENY·CAS·원문hash·누락/중복/부분저장·B>M/s>r·coverage/plan·replay/UNKNOWN추가효과0이다. 실제PG/ACL/COMMIT·served/사용자인수는미검증으로분리한다. rollback은신규producer주입/route를미구성으로되돌리고보호원문·과거감사/보고를보존하는정상revert다. DROP/과거hash재작성·UNKNOWN자동정리·키교체0이다.

## 5. 신산님께 필요한 결정
위SHA후보의 A안을 source-only 상세계약과구현범위로채택할지, B로수정할지또는C로보류할지결정한다. 기존계획/CM형상승인·횟수확대승인으로이새보호권한/metadata계상차이를임의채택하지않았다. PMO는이패킷의정확차이결정만지원하고다음작업을배정하는주체는아니다.
