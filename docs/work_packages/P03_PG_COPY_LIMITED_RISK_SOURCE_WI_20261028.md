# P03 별도 한정위험 소스 경로 — 단일 구현 업무

2026-10-28 · Main 어울 · SOURCE/SYNTHETIC ONLY. 부모 후보 P03_PG_COPY_LIMITED_RISK_DELTA_CANDIDATE_20261027.md SHA256 FFC3F2A2979A7845C48B61946A32F0B142C698ED7C6E8004D3038BAD777670D3. PMO가 후보 전문/hash를 직접 대조하여 정확5 source·합성 계약으로 채택했다. PMO는 구현/시험PASS를 독립 확인한 것이 아니며 실제 위험수락/grant/실행은 승인하지 않았다.

## 선행과 한 작성자

먼저 strict source 준비의 원stderr I1을 같은 담당이 마무리하고 Main·독립 검수/안전 checkpoint로 고정한다. 그 strict baseline의 코드/시험 raw를 새 시작 manifest에 고정한 뒤 TEST_ONLY→Main RED→제품 GO로 이어간다. 기존 원R2 4·보호8·사용자dirty는 보존한다. Main은 제품파일을 쓰지 않는다. 새 branch/worktree/세션/예약·DB·Agent·자원 실행0이다.

허용파일은 다음5뿐이며 기존 Stage B branch를 사용한다:
1. scripts/p03-pg-copy-host.ts
2. scripts/pg-recovery-copy.sh
3. tests/unit/P03/pg-recovery-copy-host.test.ts
4. tests/unit/P03/pg-recovery-copy-preparation.test.ts
5. docs/work_packages/P03_PG_COPY_EXECUTION_PLAN_20261027.md

## 고정할 경계와 접점

- strict --apply·기존 grant/evidence/parser/결과/양성·음성 합격 기준을 보존한다. strict 실패→limited 자동 전환0, default/import/plan 무효과. 새 경로는 별도 명시 CLI --apply-limited-risk와 scope P03_PROTECTED_COPY_LIMITED_RISK_R1, 정책 P03_COPY_LIMITED_RISK_POLICY_R1_20261028로만 선택한다. CLI 교차인자/일반 allowUnknown·true·옛R2ack는 거절한다.
- 새 parser/run 접점은 parseLimitedRiskCopyResult/runLimitedRiskCopyHost로 구별한다. 기존 bounded Docker/FS 기반을 재사용할 수 있지만 새 grant shape와 최초시간창/사안별수락을 strict와 혼용하지 않는다. 준비 제안 접점 proposalLimitedRiskCopy는 actualExecutionAuthorized=false·externalUserApprovalVerified=false 및 미확인 상태를 낸다. 이 출력은 실제 사람 승인 인증이 아니다.
- 새 binding은 정확 scope/policy/후보hash/최종 commit/controller·shellhash/원본·사본 instance/decisionDigest·각 사안의 delta(완전writer통제미입증/실quota미강제/선택한toolunavailable ACL-xattr범위/새UID1001위험)·최초 발행/만료를 검사한다. 외부 실제 사람 결정의 근거는 최종 실행 결정 단계에서 제공·대조하고, 내부 파일/digest가 그 자체로 사람을 인증한다고 표시하지 않는다. 실제 grant 작성/소비는 이 업무에서0이다.
- 부재/교차scope·run·대상/시간·재소비/불일치·새위반은 consume/mutation 전 거절. 최초600초/원내용500초/회수25초·첫grant30분·각helper1번·원본RO/새사본RW/nocopy와resource literal은 그대로다. 새helper/서비스/설치·권한확대0.
- 후보의 logical256MiB/entry100000·관측할당guard512MiB·예상량식/가용bytes·inode/128MiB reserve임계값/최대10초 관측을 구현한다. quota512MiB/여유128MiB 보장을 주장0. cp 실행 중 감시의 원 PID/자식 신원·원 container fullID를 고정하고 최초deadline에 결박한다. 관측 지연/실패·임계위반이면 확인한 자기 작업에 정상 TERM 최대1·유한종료관측·부분사본/불명helper보존. 감시종료/cp종료/늦은성공의 경합에서 최초 위반 latch를 성공으로 덮지 않는다. 프로세스/타이머/pipe 회수를 명확히 한다.
- ACL/xattr tool UNAVAILABLE/필요기능미지원으로 조회하지 못한 경우만 선택한다. PRESENT/ERROR/PRESERVATION_FAILED/짧은출력·exit0+stderr/known owner-link-mount 위반·내용/선정metadata 불일치는 계속 거절한다. preserve 옵션/오류검사를 제거하지 않는다.
- 결과는 COPY_BYTES_AND_SELECTED_METADATA_MATCH_WITH_ACCEPTED_UNCERTAINTY, writerFullyControlled=false/hardQuotaVerified=false/pointInTimeConsistencyProven=false/postgresStarted=false를 사용한다. 선정항목 일치/잔여수락/회수 상태를 각각 나타내며 strict PROTECTED_COPY_VERIFIED/CONTROLLED/ENFORCED·DB복구·사용가능·전체계획완료로 승격하지 않는다.

## 검증 순서

1. 허용 test2에 strict 기존 기대 보존·새 grant/모드 부재, 정상 합성, 교차·만료·재소비, ACL 분류, 관측 실패/임계·10초지연·실행중 감시/정상TERM1·자식/컨테이너신원/종료경합·늦은성공 latch의 반례를 작성한다. 실제cp/probe/init·Docker·WSL·파일grant/Secret0인 주입 ports만 사용한다. TEST_ONLY 동결 제출.
2. Main이 정확 raw에서 fresh 기능부재 RED를 확인한 뒤 같은 단일담당에게 제품 GO. 새scope를기존strictgrant나과거허가로만족시키지않는다.
3. 최소 구현 후 신규 집중/직접영향 strict 회귀·type·정확GitBash -n과 부작용없는 library/fake명령 시험만 실행한다. 실제경로를 fake positive로연결/표시하지않는다. 실관측 못한image/FS/OS/PG/성능은 NOT_RUN.
4. 독립 검토→필요 최소보완→Main fresh검증·정확5raw/원R2·보호8·diff·실행안 갱신. Main소유 결과/현황·승인기록을정확파일로commit/private게시한다. source준비완료와실제run/복구완료를분리한다.
5. 최종exact commit/hash/행위·원본·새자원/한도·미확인수락·회수/rollback을묶어 PMO에 실제1회 실행결정 지원만요청한다. 그전 실제실행0/추가사용자질문0.

에러는같은근본원인정식실패3회인수규칙으로관리하되단순내부턴/도구문제를정식실패로세지않는다. 미완료·불가를현황에사실대로남기고차단을이유로원strict검수까지멈추지않는다.
