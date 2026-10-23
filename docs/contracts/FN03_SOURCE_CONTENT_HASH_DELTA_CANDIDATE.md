# FN03 최초 소스 연결 — 내용 hash 관측 delta 결정 후보 v1

- **2026-10-24 원저장 관리·시각 결합 소비**: readSourceContentStoredVerificationWithManagementForDeclaredContextCandidate는 원저장 판독을 중복하지 않고 관리 범위 후보와 원관측 수신시각 기반 검증 head를 함께 소비한다. 선언/관리 입력 첫await 전 고정·원fullref/문맥·회수기한·전체보고/target 선행거절·관리음성 head0·최소refs/false8·분리조회를 유지한다. 과거 관리 client/세대/base와 이후 요청 문맥을 강제 동일시하지 않으며 operation 일치는 구조 범위일 뿐 실제 재관측/LINK 허가가 아니다. 새4 RED→직접144 합성 PASS/typecheck/diff0·독립 C0/I0/M0이며 실제 관리 원문producer/현재 권위/verifier/DB/route는 만들지 않았다. 기존 공개 소비 body/SQL/route와 미확정 §13.4 경계를 보존한다.

- **2026-10-24 서버 원관측 시각 소비**: 신규 readSourceContentVerificationAfterReceivedFromServerContextCandidate/FromHeldIdentityCandidate는 caller시각 없이 기존문맥과 저장내부 관측시각 경로를 조합한다. index 선행검사·basis 첫await전복사·fullref/전체보고/target·최신음성/원오류·최소refs/false7·분리조회를 유지한다. 새4 RED→직접146 합성 PASS/typecheck/diff0, 실제auth/verifier/current/DB·held전체성공은 이번 증거가 아니며 기존 공개/head/저장/SQL/route는 변경하지 않았다.

- **2026-10-24 검증 시각 소비**: readLatestSourceContentVerificationAfterReceivedCandidate와 별도 저장 AfterReceived 소비는 기존0040의 verified_at>=원관측received_at에 대응한다. 저장소비는 caller수신시각을 입력받지 않고 기존 원관측에서 도출한다. 동시각은 구조 후보일 뿐 실제 verifier/바이트/current 권위가 아니며 false7를 유지한다. 기존 public head/저장 동작·SQL/route는 보존하고 새경로만 이전양성을 닫으며 최신음성은 보존한다. 새6 RED→직접142 합성 PASS/typecheck/diff0·실제SQL/PG/권위는 미검증이다.

- **2026-10-24 서버 wire 소비**: 신규 readSourceContentManagementScopeWireFromServerContextCandidate/FromHeldIdentityCandidate는 첫 문맥 await 전 중복키·raw크기 검사를 수행해 기존 서버 관리 범위 조합에 전달한다. 기존 구조 함수/공개/SQL/route는 변경하지 않고 원fullref·저장scope/문맥/회수·기한과 원오류/최소refs/false6·분리조회를 보존한다. 새4 RED→직접142 합성 PASS/typecheck/diff0이며 실제 원문producer/current관리권한·DB/서비스를 제공하지 않는다.

- **2026-10-24 CM08 wire 입력 소비**: 신규 inspectSourceContentPolicyManagementWireCandidate는 4MiB 이내 JSON 문자열을 기존 중복키 파서로 판독한 뒤 기존 관리 증거 inspector에 전달한다. 공백·키순서가 아닌 원envelope canonical hash를 유지하고 오류는 원문 없는 고정 오류로 닫는다. 기존 구조 입력/공개 DTO·SQL/runner/route는 변경하지 않는다. 새4 RED→직접22 합성 PASS/typecheck/diff0이며 보호 원문 producer/DB·현재 권위는 제공하지 않는다.

- **2026-10-24 서버 관리 범위 소비**: 신규 readSourceContentManagementScopeFromServerContextCandidate/FromHeldIdentityCandidate는 기존 서버 후보 문맥과 원저장 관리 범위를 조합한다. 관리 묶음은 첫 문맥 await 전에 복사하고 과거 관리문맥/이후 요청문맥 구분·원fullref/요청 회수기한/고정음성·원오류·최소refs/false6·분리조회를 유지한다. 정상 서버1/보유2query·만료0/제어회수1, 새4 RED→직접132 합성 PASS/후속114·typecheck/diff0다. 기존 공개 경로/SQL/runner/route 무변경·실제 producer/auth/latest/current 권위는 제공하지 않는다.

- **2026-10-23 원저장 관리 범위 소비**: 신규 readSourceContentStoredManagementScopeForDeclaredContextCandidate는 기존 exact8 선언과 별도 exact2 관리 묶음(evidence/expected)을 고정한 뒤 기존 저장 판독/원fullref·요청 문맥을 대조한다. 임의 caller scope를 입력받지 않고 저장scope만 순수 정책 범위 검사에 넘긴다. 과거 관리문맥과 이후 요청문맥을 혼동하지 않으며 회수·만료를 닫고 최소refs/false6/분리조회만 반환한다. 원query1회/추가query0·기존 공개/SQL/route 변경0, 새4 RED→직접128 합성 PASS/typecheck/diff0·실제 관리권위/latest·DB/current는 미검증이다.

- **2026-10-23 관리 증거·scope 소비 접점**: 신규 inspectSourceContentPolicyScopeCandidate는 관리 원문 증거와 원scope를 순수 결합해 CM03의 네 refs/전체 target 동일집합(순서 차이 허용, 각 전체값 일치)·operation·한도를 대조한다. 관리 당시 문맥은 관리 증거 내부에서만 결박하며 이후 요청의 다른 client/세대/base정책을 현재 허가로 승인하지 않는다. 전달된 이벤트의 거절·회수/기한과 원요청 기한을 지키되 실제 최신 head 생산자가 없으므로 정상도 POLICY_SCOPE_SHAPE_ONLY/UNVERIFIED·false5다. 기존 공개 경로/최소head·SQL/runner/route 무변경·새5 RED→직접35 합성 PASS/typecheck/diff0.

- **2026-10-23 CM05~08 구조 증거 소비**: 신규 inspectSourceContentPolicyManagementEvidenceCandidate는 §12.6.2 exact6/expected8 입력과 별도 originalRequest 원문 전체 hash를 소비한다. snapshot으로 원문을 역생성하지 않으며 기존 payloadRef는 AUTO 후보에서 null로 보존한다. 내부/caller 명령ID·주체/client/세대/base정책·receipt/audit/정확target·인접 계보/시각을 구조 대조하고 최소 refs/digest·false5만 반환한다. JSON 구조 입력 전용이며 보호 원문 생산자·현재 OWNER/재인증·별도 관리허가·DB 잠금/CAS/실제 저장을 제공하지 않는다. 새6 RED→직접35 합성 PASS, 후속8/typecheck/diff0다.

- **2026-10-23 승인 형식의 첫 SOURCE 소비**: CM01~04의 payload/definition과 서버 후보값4키(projectId/actorId/sequence/recordedAt)를 신규 순수 builder에 대응했다. 기존 범위 codec만 재사용하고 정책 TTL에 요청10분 상한을 이월하지 않는다. 반환 snapshot/hash는 형식 후보이며 서버값 진위·최신 head/CAS·원명령/영수증/감사 증거를 확인하지 않아 false5를 유지한다. CM05~08 증거 inspector·실제 저장/허가는 미완료다. 새5 RED→직접/인접22 합성 PASS/typecheck/diff0, 기존 최소6/hash·공개 reader/SQL/runner/route 변경0.

- **2026-10-23 직접 승인 적용 범위**: 신산님의 ‘네 의견대로 승인해’를 직전 Main 권장안인 §12.6~12.6.2 CM01~08의 미등록 SOURCE 구현·합성 검증 기준 채택으로 기록한다. 아래 미확정/DRAFT_ONLY 문구는 승인 전 제안 이력으로 보존하며, 실제 DB 적용·관리정책 생성/권한 부여·키/서명/OS 검증·route/서비스·Agent 실행은 이번 승인에서 제외한다. 기존 최소6/hash·공개 경로는 보존하고 새 완전 형식은 별도 후보로 구현한다.

- **2026-10-23 서버문맥 검증 소비**: 기존 identity/control 후보를 원보고 검증 문맥에 한정 연결했다. 원입력 고정·전체보고/target·최신 음성·원오류·권위 false7/분리조회를 유지한다. 새4 RED→직접141 합성 PASS, 시험 타입 표기 정정 후 해당106/typecheck/diff0·독립 정적 C0/I0/M0이며 실제 인증/verifier/PG/current/원자성/served 증거가 아니다. 기존 head·정책·SQL/runner·공개 경로는 변경하지 않았다.

- **2026-10-23 저장보고 target 문맥 SOURCE**: 신규 readSourceContentStoredVerificationForDeclaredContextCandidate는 선언 문맥/원요청과 보고 전체 성공을 대조한 뒤 원scope의 target/doc/path/observer·저장 reportRef만으로 기존 head 판독 문맥을 만든다. caller 임의 refs/path·verified 입력은 받지 않고 최소 refs/index·최신 음성·분리조회/false7만 반환한다. 성공 보고의 형태/저장 head는 실제 원문 일치/OS·서명·current verifier 증거가 아니다. 새4RED→직접137 합성PASS, 후속102/type/diff0·기존head/SQL/route/관리미정형식 변경0·Minor11/기존제외 유지.

- **2026-10-23 검증 인접계보 TS SOURCE**: inspectSourceContentVerificationLineageCandidate는 기존0040의 row18와 인접 identity11/predecessor fullref·버전+1·비역행시각·첫 양성1회/후속회수·무효만 허용하는 구조를 대응한다. snapshot 의미/실제 verifier/현재 권위·관측/원문 진위는 확인하지 않고 최소 refs·UNVERIFIED/false5만 반환한다. 기존head/정책/route/SQL·관리 미확정형식은 변경하지 않는다. 새6RED→직접14 합성PASS/type/diff0·실PG/권위 미검증·Minor11/기존 제외 유지.

- **2026-10-23 서버 회수 SOURCE 소비**: 신규 서버/보유identity 조합은 첫 문맥 await 전에 기존 exact2 회수 입력을 고정하고 기존 identity/control→저장 회수 순서를 재사용한다. 기본1/구체control포함2query·고정 음성/candidate null·false5·원자료 비노출이며 실제 인증/현재정책·회수/DB/route는 제공하지 않는다. 새4RED→직접116 합성PASS, 새시험 존재 확인 보강 후 해당98/type/diff0·정적 C0/I0/M0다. PMO가 §12.6의 형식 제안을 실질 계약 delta로 판단했으므로 사용자 결정 전 문서 제안만 유지하고 이 기존 회수 SOURCE에 새 관리 형식을 적용하지 않는다.

- **2026-10-23 저장 회수 SOURCE 소비**: 별도 readSourceContentStoredRevokeForDeclaredContextCandidate가 exact8 선언문맥·payload 복사와 기존 저장 증거/원 fullref·주체/세대/base정책 대조 뒤 서버 casDigest를 순수 회수 후보에 전달한다. caller의 digest/verified 값을 입력으로 받지 않으며 원payload/보고/nonce를 반환하지 않는다. 정상도 저장인증/current/저장실행LINK false5이고 현재 정책 허가·실제 회수·원자성/DB/route는 미검증/미활성이다. 새4RED→직접112 합성PASS/type/diff0·기존 공개 경로/관리 형식 무변경·Minor11/기존 제외 유지.

- **2026-10-23 회수 SOURCE 소비**: 기존 §3 exact2 payload를 원request fullref/회수명령 UUID에 결박하고 기존 전이/CAS를 재사용한다. reason은 기존 content 요청과 같은 비공백/제어문자/20000자 규칙이며 원scope는 변경하지 않는다. 반환의 reasonDigest는 내부 후보의 canonical {reason} SHA256이지 관리 영수증·서명·현재 허가 증명이 아니다. 기존 소비자료/원기한 보존·터미널 새회수 거절·실제 회수/nonce/DB·route 미등록/권위false다. 새4RED→직접25 합성PASS/type/diff0·Minor11/기존 제외 유지.

- **2026-10-23 서버문맥 계보 SOURCE**: 신규 readSourceContentPolicyLineageFromServerContextCandidate/FromHeldIdentityCandidate는 기존 후보 문맥 판독과 저장계보를 조합한다. 새 권위 producer·관리정책을 정의하지 않고 기존 고정음성/원요청 대조와 최신 회수/null·false6·분리조회를 유지한다. 같은 db 전달은 transaction·현재성 증명이 아니다. 실제 인증·키/nonce·SQL/DB·OS/route/served는 미검증/미활성이고 기존 상태/proof/정책 기준은 변경하지 않는다. 새4 유효RED→직접119 합성PASS, 신규 null 확인 추가 후 해당90/type/diff0·Minor11/기존 제외 유지.

- **2026-10-23 저장요청 문맥·계보 SOURCE**: 별도 readSourceContentStoredPolicyLineageForDeclaredContextCandidate가 exact8 선언 문맥 복사→기존 저장 증거 판독→정확 requestRef/주체·client/두 세대/basePolicyRef 대조→복사 scope의 최신 정책계보를 순서대로 소비한다. 불일치는 정책 조회 전에 닫으며 기존 공개 reader와 실제 허가 기준은 유지한다. 최소 refs/계보·권위 false6/분리조회이고 실제 저장 인증·관리근거/current·SQL/DB·route는 미검증/미활성이다. 새4 RED→직접115 합성 PASS, fixture 타입 정정 후86 PASS/type/diff0·Minor11/기존 제외 유지.

- **2026-10-23 원scope 정책계보 SOURCE**: readSourceContentRequestPolicyLineageCandidate는 원scope를복사하고원수명내에서만최신계보판독을소비하며 exactcontentPolicyRef를대조한다. 기한밖은query0, 최신음성은그대로, 정상계보라도원정책id/version/hash불일치는refs/lineage null로닫는다. 다른project/subject·getter/변이·오류음성을확인하며최소반환/false5·옛positive0다. 기존요청정책reader/허가를바꾸지않고 fullscope/targets/관리근거/current진위·실제DB/키/route는미검증/미활성이다. 새4RED+직접음성1→29합성PASS/type/diff0·Minor11/기존제외유지.

- **2026-10-23 최신head 인접계보 SOURCE**: readLatestSourceContentPolicyLineageCandidate는 기존순수head 판독을 재사용한다. project 최신head를 CTE로먼저고정하고 sameproject sequence-1만LEFT JOIN하며 최신음성은이전행검사전그대로반환한다. AUTO후보에만 인접계보inspector를소비하고 손상/부재prev는닫으며 과거positive 재조회0이다. 최소refs/계보·UNVERIFIED/false5·fullscope/targets/관리근거/current진위미검증이며 기존reader/허가·실제SQL/PG/route미활성이다. 새6RED→직접118합성/SSR PASS/type/diff0·한정정적C0/I0/M0·Minor11/SQL145NOT_RUN/기존제외유지.

- **2026-10-23 정책계보 검토 잔여**: 정적C0/I0/M1·실행수정0. 상한 sequence 음성이 snapshot/predecessor 미갱신으로 가려지는 시험공백은보류·기존10과총 Minor11 미해결이다. 독립 상한guard 증거로주장하지않고 실제SQL/PG/관리근거/current권위는미검증으로유지한다.

- **2026-10-23 정책 인접계보 TS SOURCE**: inspectSourceContentPolicyLineageCandidate는 기존미적용0040의 exact12 row·snapshot최소6/hash/최초null·후속sameproject/seq+1/previousfullref·다른event/관리command·시각비감소를순수대조한다. 별도 정책양식·관리operation/권한은정의하지않고 추가snapshot자료는원hash에포함만한다. 최소refs/sequence·UNVERIFIED/POLICY_LINEAGE_SHAPE_ONLY·관리근거/current/저장실행LINKfalse5로만반환하며fullscope/targets/관리receipt/현재권위와PG상호운용미검증이다. 새6RED→직접18합성PASS/type/diff0·actualSQL/DB/route0·Minor10/기존제외유지.

- **2026-10-23 서버 최소표시 SOURCE**: readSourceContentScreenFromServerContextCandidate/FromHeldIdentityCandidate는 기존 서버후보/보유값·구체control과 declared screen을 명시조합한다. 기존DTO/정확13·기본표시를변경하지않고 generic record/policy2query·concretecontrol포함3query/문맥선행닫힘·최신음성/과거이력분리·false6·분리조회를유지한다. 원문/nonce/서명/proofbytes 비노출이며 실제전송/route/served/auth/current/DB/키/OS는미활성이다. 새3RED→직접129합성/SSR PASS/type/diff0·Minor10/기존제외유지.

- **2026-10-23 동일소비 표시자료 SOURCE**: readSourceContentScreenForDeclaredContextCandidate는 기존 declared proof/정책 조합의 record1/policy1 결과를 재사용해 exact13 summary와 별도 proof를 반환한다. 기존 조합 DTO는 유지하고 summary 투영은 기존 함수를 그대로 소비한다. 원자료/nonce/signature/proofbytes 비반환·중복SQL0·최신정책최상위/과거이력분리·false6/분리조회·문맥음성summary/proof null·오류원형을 유지한다. 새3RED→직접103합성/SSR PASS/type/diff0이며 실제송신/auth/current/DB/route/served는 미활성·Minor10/기존제외유지.

- **2026-10-23 서버 proof정책 SOURCE**: readSourceContentProofWithPolicyFromServerContextCandidate/FromHeldIdentityCandidate는 기존 identity/control 후보 및 declared 과거proof/최신정책을 동일db에 전달한다. generic record/policy2query·구체control포함3query이며 문맥불일치/만료·회수는선행닫힘/후속조회0이다. 최신정책음성과과거proof를혼동하지않고 fixed음성/historicalProof·policy null/false6·분리조회를유지한다. 실제auth/current/DB/키/nonce/route는활성화하지않았고 새4RED→직접123합성/SSR PASS/type/diff0·Minor10/기존제외유지.

- **2026-10-23 과거proof/정책 SOURCE**: readSourceContentStoredReportProofWithPolicyForDeclaredContextCandidate는 기존 exact8 문맥·동일 record/내부proof를 대조하고 최신정책helper 결과를 별도 결합한다. 신규 최상위 status/reason은 최신정책 결과를 보존하며 historicalProof는 과거 입력후보로만 남긴다. DENY/회수/만료/부재·ref변경/malformed를 과거양성으로 덮지 않고 문맥/ref불일치는 정책조회 전에 닫는다. 권위false6/SEPARATE_READS_NOT_ATOMIC·원문/nonce 비반환·정책오류 원형전파, 실제auth/키/DB/nonce/route 활성화0·새4RED→직접96 합성/SSR PASS/type/diff0·Minor10/기존제외 유지.

- **2026-10-23 proof 문맥 SOURCE**: 신규 readSourceContentStoredReportProofForDeclaredContextCandidate는 기존 exact8 parser가 복사한 user/client·credential/control세대/basePolicyRef를 같은 저장scope와 내부proof 소비 전에 대조한다. 기존 exact3 proof는 binding null로 동일 동작을 보존한다. readSourceContentProofFromServerContextCandidate/FromHeldIdentityCandidate는 기존 서버후보/보유값 투영·구체control 포트만 소비하고 실제 인증 producer나 등록권위를 제공하지 않는다. 정상도false6/UNVERIFIED·최소후보, 불일치/만료는 후보null이며 actualauth/키/서명/DB/nonce/route0이다. 새5RED→직접196합성/SSR PASS/type/diff0·Minor10/실verifier412/기존제외 유지.

- **2026-10-23 proof 최소 표시 SOURCE**: readSourceContentProofStatusV1은 기존 exact13 상태 계약과 분리된 비활성 판독이다. stored-proof exact9(status/reason/candidate+false6), 후보exact4(requestRef/reportRef/고정domain/proofInputHash)만 허용하고 expected request fullref를 대조한다. 부재/불일치는 고정 이유/candidate null만 표시하며 원문/permit/nonce/signature/proofbytes는 받지 않는다. UI06 기존 비활성 표시의 선택 입력일 뿐 실제 API/앱/route 등록이 아니고 서명/current 미확인·권위false를 유지한다. 새4 RED→직접75 합성/SSR PASS/type/diff0·한정정적C0/I0/M0·Minor10/실제제외 유지.

- **2026-10-23 저장 proof 독립 검토 잔여**: C0/I0/M1·실행/수정0. 신규 nonce 음성은 reportHash/관측 contentHash/감사 targetRef hash 미갱신으로 후속 hash 거절에 가려지므로 nonce 결박 단독 증거가 아니다. 보강 보류·기존9와 총 Minor10 미해결·실제 SQL/PG/서명/current/nonce소비/served 미검증 유지.

- **2026-10-23 저장 관측 내부 proof SOURCE**: readSourceContentStoredReportProofCandidate는 exact3 원요청 basis를 고정하고 기존 단일 SQL/생성·관측 감사 대조 뒤에만 내부 permit/report를 순수 proof 소비에 사용한다. 기존 readSourceContentRequestRecordCandidate 공개 반환은 변경하지 않는다. 신규 공개 결과는 최소 requestRef/reportRef/domain/proofInputHash와 저장인증/서명/current/저장실행LINK false6이며 raw 원문·permit·nonce·서명/proof bytes는 반환하지 않는다. 정상/과거 보고도 UNVERIFIED이고 실제 DB·현재 권위/등록키·nonce 소비·OS/route는 비활성이다. 새4 RED→직접186 합성/SSR PASS/type/diff0·실verifier412/Minor9/기존제외 유지.

- **2026-10-23 원 permit proof 소비 SOURCE**: readSourceContentReportProofFromPermitCandidate는 기존 sourceContentReportContextFromPermitV1의 원 요청/scope/관측 ref·nonce/기한 대조를 먼저 소비하고 그 결과만 비활성 보고 서명 입력에 전달한다. 신규 연결은 임의 report context를 받지 않고 불일치 때 보고 소비0으로 닫는다. 선언 permit 인증/실서명/current/저장/실행/LINK false이며 원 저장행 진위·nonce소비·키/DB/OS/route 활성화는 포함하지 않는다. 새3 RED→직접40 합성 PASS/type/diff0·실verifier412/Minor9/기존제외 유지.

- **2026-10-23 서명 입력 준비 SOURCE**: readSourceContentPreflightProofInputCandidate/readSourceContentChallengeProofInputCandidate는 exact2 envelope를 복사하고 canonical 64바이트 서명 형태와 기존 content 교환 codec을 소비한다. readSourceContentReportProofInputCandidate는 context를 고정하고 원 보고 codec/hash 대조 후 새 보고 domain bytes를 소비한다. 반환은 비활성 입력 후보뿐이며 SIGNATURE_VERIFIER_UNAVAILABLE/UNVERIFIED·signature/current/실행/LINK false다. 키 조회/사용·서명 진위·nonce 소비·권한/route 활성화0, 새7 RED→직접29 합성 PASS/type/diff0. 기존 metadata 서명 목적/검증을 재사용하지 않으며 실 verifier 부재412와 Minor9/실제제외 유지.

- **2026-10-23 보유identity 준비 SOURCE**: readSourceContentPreparationFromHeldIdentityCandidate는기존identity순수포트/구체control포트만신규서버문맥준비에연결한다. 실제authenticate/session·키/DB/서명/observer/OS를호출하거나인증/준비권위를만들지않고모든권위false/분리조회다. 새5RED→직접142합성/SSR PASS/type/diff0·한정독립C0/I0/M0,Minor9/SQL145NOT_RUN·실verifier412·실제실행제외/거절유지.

- **2026-10-23 문맥 준비 SOURCE**: readSourceContentStoredPreparationForDeclaredContextCandidate는기존exact8 선언문맥parser를소비하고저장scope의user/client·credential/control세대/basePolicyRef를정책조회전에대조한다. readSourceContentPreparationFromServerContextCandidate는기존identity/control후보판독을한정재사용하며고정음성은현재권위/준비false·candidate null로닫는다. 기존상태조회·기본저장준비의입력/거절/반환동작은변경하지않고새경로역시선언인증/저장인증/준비/byte/current/저장실행LINKfalse·분리조회뿐이다. 새6RED→직접137합성/ReactSSR PASS/type/diff0,실제authproducer/DB/키/OS/route/served와분리하고Minor9/SQL145NOT_RUN·실verifier412·실제제외/거절을유지한다.

- **2026-10-23 저장요청 준비 SOURCE**: readSourceContentStoredPreparationCandidate는basis exact3의requestv1fullref를고정해기존저장reader의복사scope를소비한다. requestfullref/open상태를정책조회전에대조하고최신정책음성은후속준비조회없이닫으며정상도STORED_PREPARATION_FRAMES_ONLY/UNVERIFIED·분리조회·storedRequestAuthenticated/준비/byte/current/저장실행LINKfalse다. 이력reader의terminal보존은유지하되신규준비후보만CREATED/CHALLENGED/ISSUED에서진행한다. 실제인증/current정책·등록키/observer·원문/OS/verifier·DB/route권위는아니다. 새7RED→직접100합성PASS/type/diff0,Minor9/SQL145NOT_RUN·실verifier412·실제제외/거절유지.

- **2026-10-23 준비 frame SOURCE**: readSourceContentPreparationFrameCandidate는원scope/digest를고정하고locationframe→전체문서metadata순서로소비한다. 첫음성/오류뒤후속조회·부분후보반환0이며정상도PREPARATION_FRAMES_ONLY/UNVERIFIED·최소ref/분리조회·preparationAuthorized/bodyBytesVerified/current/저장실행LINKfalse다. 이는실제인증/정책·등록키/observer/원문byte·verifier/실행준비권위가아니며route/실DB미연결이다. 새7RED→직접41합성PASS/type/diff0만확인했고Minor9/SQL145NOT_RUN·실verifier412·실제제외/거절은유지한다.

- **2026-10-23 전체targets metadata SOURCE**: readSourceContentTargetDocumentsCandidate는원scope를복사하고각target을원순서판독한다. 첫음성/오류뒤후속조회0·부분후보반환0이며실패index와고정거절상태만보존한다. 전체metadata일치도ALL_DOCUMENT_ARTIFACT_METADATA_ONLY/UNVERIFIED·분리조회·bodyBytesVerified/current/저장실행LINKfalse로서전체보고/실바이트/OS/권위를대신하지않는다. 새5RED→직접12합성PASS/type/diff0,실제route/DB미연결·기존Minor9/SQL145NOT_RUN/실verifier412·실제제외/거절유지.

- **2026-10-23 target 문서 metadata 판독 SOURCE**: readSourceContentTargetDocumentCandidate는원scope targetIndex의exact확정버전/원metadatahash와content.body ArtifactRef·같은project READY Artifact/격리metadata·보호storagekey/BODY정확1건을대조한다. 4MiB이하row projection만지원하며저장/API한도변경0이다. 정상도DOCUMENT_ARTIFACT_METADATA_ONLY/UNVERIFIED·bodyBytesVerified/current/저장실행LINKfalse다. 원문/파일읽기·재해시/완전secret탐지·확정receipt/양식/단계진위·현재권위/실DB/route는별도미검증이며새로활성화하지않는다. 합성7RED→GREEN/type/diff0만확인했고Minor9/미래SQL145NOT_RUN·실verifier412/실제제외·거절유지.

- **2026-10-23 위치 frame 조합 SOURCE**: readSourceContentLocationFrameCandidate는 복사된 원scope를 최신root 선언→상태전용등록 판독에 순서 전달한다. 선행음성이면 후속조회 없이 고정status/reason·candidate null, 정상도 LOCATION_FRAMES_ONLY/UNVERIFIED·ref3개/분리조회·권위/저장/실행/LINK false다. 현재등록키/서명/observer·인증/current정책/DBtransaction/OS 진위는 별도이며 실제route/DB에 미연결이다. 새6RED→직접22합성PASS/type/diff0만 확인, 기존Minor9/미래SQL145NOT_RUN·실verifier412·실제실행제외/거절 유지.

- **2026-10-23 등록 frame 판독 SOURCE**: readSourceContentRegistrationFrameCandidate는 기존 상태전용 connector의 현재 registration_id만 LEFT JOIN하고 exact28행·원scope10/subject5/hash·user/client/세대/host·기준policy·원기한과 content의 정확 registrationRef/connectorRef를 대조한다. 기존 ref 공식은 재사용하되 기존 credentialScope=REGISTRATION_STATUS_ONLY/grants=[]를 content허가로 쓰지 않는다. 정상도 REGISTRATION_FRAME_ONLY/UNVERIFIED·false4·최소ref2개이며 실제 키/서명/observer·세션/current정책·OS/등록권위를 증명하지 않는다. 실제DB/route 미연결·publickey/token조회/발급0, 합성7PASS/type/diff0만 확인했다. 기존Minor8/미래SQL145NOT_RUN/실verifier412·실제 제외/거절을 유지한다.

- **2026-10-23 root 후보 검토 보정**: 초기128KiB는 기존 허용 한글 선언을 거절해 내부 행 projection 상한을256KiB로 보정했다. 기존 parser/저장/API 한도 변경0, 재현 RED1→새9PASS/type/diff0이다. 아래128KiB 항목은 초기 후보 이력이며 현행 지원 상한은 이 항목을 따른다. 신규 Minor1(원scope hash 비교 반례의 선행 hash 무결성 가림)은 보류하여 기존7건과 합8건 미해결, 실제SQL/DB·등록/OS/현재권위·served 미검증/기존 실행 제외는 그대로다.

- **2026-10-23 root 선언 판독 SOURCE**: readSourceContentRootHeadCandidate는 원 scope의 root ID로 기존 source_roots 최신head만 LEFT JOIN하고 정확ref/원선언snapshot hash·connectorId/pathHintHash를 대조한다. 회수·누락·변경에서 과거head fallback0이며 정상도 SOURCE_ROOT_DECLARATION_ONLY/UNVERIFIED·false4다. canonical128KiB 이하의 지원 projection만 받으며 기존 저장/API한도 변경0이다. 실제등록키/observer·OS실경로/원문·현재권위·인증/잠금/PG진위는 별도이며 경로원문을 반환하지 않는다. route·실DB 미연결, 합성8RED→GREEN/type/diff0만 확인했고 기존Minor7/미래SQL145NOT_RUN·실verifier412/실제 제외는 유지한다.

- **2026-10-23 보유 identity 조합 SOURCE**: readSourceContentRequestStatusFromHeldIdentityCandidate는 기존 순수 identity 최소 투영/구체 control 포트를 같은 caller db에 조합하고 원요청·최신 정책의 분리 조회와 최소13키 요약을 재사용한다. 입력 identity 모양/주어진 시각·같은 db 객체는 실제 인증/현재 권위/transaction의 증명이 아니다. 실제 auth producer/route/DB·권한은 미연결이며 정상도 UNVERIFIED/모든 권위·저장·실행·LINK false다. 새5 RED→직접83PASS/type/diff0은 합성 자료에 한정한다. Minor7/SQL145 NOT_RUN·기존 fail-closed와 실제 실행 제외 유지.

- **2026-10-23 identity 최소 투영 독립 검토**: 신규2코드파일 delta C0/I0/M0·실행/수정0이다. 현재서버타입/authSession지원범위·exact키/만료/재인증Date상한·사용자Date메서드미호출,session/시각·owner/reauth비반환·최소UNVERIFIED/고정거절과getter/반환분리반례를정적으로대조했다. 실제인증생산자·DB시각·현재세션/권한은미구현/미검증이며Minor7을유지한다. 다음Main SOURCE대상은서버보유identity값의최소투영과프로젝트control포트·원요청/정책·최소요약을같은caller연결에서명시적으로조합하는비활성함수와합성여정이다. 실제authproducer/route연결·DB/권한·새Agent실행을열지않고기존제외/원실패/거절을유지하며전체계획완료로승격하지않는다.

- **2026-10-23 FN03 서버 보유 identity 최소 투영 SOURCE**: 기준fe4fd731/추적clean·보호8(raw3be7e2)에서실제AuthenticatedIdentity 타입/현재서버반환모양을읽었다. 신규 source-content-server-identity.ts는exact6 top과세션exact3·UUID/safe세대/owner bool·ISO와주어진now의세션만료·idle≤absolute·Date|null재인증형태/absolute상한을대조한다. 타입상optional인authSession이없는과거입력은이후보의지원범위밖으로닫으며기존auth타입/동작은바꾸지않는다. 정상도UNVERIFIED4키(actor/client/credential세대)·current/저장실행LINKfalse뿐이고session참조/시각·serverOwner·재인증·원문은반환하지않는다. serverOwnertrue도승격0·과거재인증기록은권위가아니다. 순수포트투영은최소4키또는고정음성2키이며실제authenticateInTransaction/session/DB/토큰·CSRF·키생성/전송·인증producer/route연결은0이다. 주어진now는실DB시각/현재인증증명이아니다. RED새10FAIL224.7584ms(rawd08bfd)→GREEN10/209.6267ms/type/diff0(rawa2d9a7),신규독립module이므로불변68재실행0이다. rawmodule48E4DEA9A29F7A132ADB64ADE0DE6D1ED66AF7DE39ECDA9426F426DF2E86DA0C/testC90AA8CC8C04CBC12171332EE49911A856A0F2B8C594547BE6711D2BDAFB9E52(rawb26da7). 실제auth/current/서버배선·transaction/DB·OWNER VIEWER/정책/등록/verifier·served는미구현/미검증·새사용가능기능0이다. Minor7/특정4파일SQL145NOT_RUN·원I1미실행/실verifier없음412/전DML·LINK거절·권한0/0039·보호8/원실패/Bv3/D2·특정거절/실제제외유지,독립정적검토중·전체계획완료가아니다.

- **2026-10-23 control 포트 투영 독립 검토**: 이번3코드파일 delta C0/I0/M0·실행/수정0이다. 정상6키/음성2키선택·오류보존,고정status/사유조합외거절·정상주체/세대/ref검사유지,음성뒤원요청조회0/순서·원문비노출을정적으로대조했다. 실제인증adapter/DB·transaction/current는미검증이며Minor7은유지한다. 다음Main SOURCE대상은기존AuthenticatedIdentity의서버보유값을identity-candidate 최소자료로투영하는별도비활성접점이다. 실제authenticateInTransaction/session호출·토큰/CSRF/키생성·전송이나현재인증주장은하지않고기존서버auth/route는바꾸지않는다. 전체계획완료/실사용준비판정은아니다.

- **2026-10-23 FN03 control-candidate 명시 투영 SOURCE adapter**: 기준78135a16/추적clean·보호8(rawba0519)에서기존최소판독을정상UNVERIFIED6키또는음성exact2로만투영하는readSourceContentProjectControlPortCandidate를추가했다. server 접점은UNAVAILABLE의PROJECT_ABSENT/BASE_POLICY_ABSENT와DENIED의고정6사유만보존해summarynull/권위false·원요청조회0으로닫는다. 자유사유·status/사유불일치·추가필드는고정거절로닫고원문출력0이며정상6키검사는유지한다. 음성보존은조회/실행허가가아니다. identity포트/원최소판독함수는무변경·실제서버배선/앱/route0,시험에서만합성identity와fakeDB로adapter를주입했다. RED13중기존/음성9PASS+새4FAIL223.0707ms(raw119842),첫68PASS782.2345ms이지만fixture readonly배열→any[] 변환TS2352 타입실패1(raw4cd2c7)은원문보존·통과승격0. rows배열복사만보정후fresh68PASS707.8695ms/type/diff0(raw4d8378)이며기대값/제품기준완화0이다. raw control FE144C5C2D8976DECAB8D28CCF2F341FF240CC46825954D6C48665590F18DFBD/server3847D56362D04A577690F12F06CEB6A1950B4E778DC01882064A68F30E22D194/test292D94304F8751DC1518DEFF18E19C5AD22A39D5232366311092F82D9140EA53(raw15fb62). 실제SQL/DB/인증·transaction/잠금·OWNER VIEWER·정책의미/content허가·서명/verifier·served는미검증/미구현·새사용가능기능0이다. Minor7/특정4파일SQL145NOT_RUN·원I1미실행/실verifier없음412/전DML·LINK거절·권한0/0039·보호8/원실패/Bv3/D2·특정거절·실제제외유지,독립정적검토중·전체계획완료아니다.

- **2026-10-23 프로젝트제어 최소 판독 독립 검토**: 신규2코드파일 delta C0/I0/M0·실행/수정0이다. 기존열/JOIN키·현재head만결박/회수와정상값선별없는조회,원hash공식·최소후보/권위false와반례가림없음을정적으로대조했다. 실제SQL/DB·인증/잠금·현재권위/전체정책의미는미검증이며Minor7을유지한다. 다음Main SOURCE대상은이최소판독결과를기존server control-candidate포트에명시적으로투영하는비활성adapter이며status UNVERIFIED/거절·부재를보존하고현재인증/content허가로승격하지않는다. 실제포트/route·정책·권한·DB연결확대0·전체계획완료아님을유지한다.

- **2026-10-23 FN03 프로젝트제어/기준정책 최소 판독 SOURCE**: 기준37a1f5b1·추적clean/보호8(rawf69a5d)에서기존0001 project_members/control·0011 permission_policies/versions와currentPolicy의원hash공식{rules,reason,reviewRefs}를대조했다. 신규 source-content-project-control.ts는project+actor만선별하는단일LEFT JOIN SQL후보로role/회수/적합hash를미리제외하지않고head_version에해당하는버전만결박한다. exact24투영·Date/정수정규화·canonical2MiB이하의한정frame에서보관프로젝트/비OWNER·참여회수/다른control actor/client·제어/사용자/client부재/회수/최신정책누락·버전/project/id/hash불일치를거절한다. 원rules/reason/reviewRefs는반환하지않고정상도UNVERIFIED/PROJECT_CONTROL_FRAME_ONLY·candidate6키와current/저장실행LINKfalse뿐이다. 2MiB는이비활성투영의지원상한이며기존정책/API한도변경0이다. 최소disposition/hash는완전한rule·허용operation/현재권위나content허가가아니며VIEWER일반조회허가를대신하지않는다. RED새8FAIL170.9877ms(raw8fa013)→GREEN8/142.0854ms/type/diff0(raw8228f5). 독립신규module이며불변기존55재실행0,실SQL/DB·현재성/잠금/인증함수·route/기존포트연결은NOT_RUN/미구현이다. 추측authorization하위폴더읽기1회오류는실제modules전체검색으로access/project-command.ts를찾아정정(raw88855f/d67955)·권한/파일복구0이다. rawmodule7DB186A797DC9C53809DC63DF79F5081D51EA0F2E566F00F55673C3B76C27EC5/test0879038A8DFE29BBDD87902CB4DCB10E586762D3310CBC3F7FFE357355033C3B(raw3aa111). Minor7/특정4파일SQL145NOT_RUN·원I1미실행/실verifier없음412/전DML·LINK거절·권한0/0039·보호8/원실패/Bv3/D2·특정거절·실제제외유지·새사용가능기능0이며독립정적검토중,전체계획완료가아니다.

- **2026-10-23 서버 후보 판독 접점 독립 검토**: 이번2코드파일delta C0/I0/M1·실행/수정0이다. 새M1은DENIED identity/control 반례가status뿐아니라누락/추가reason으로exact-key도깨져status검사제거회귀가가려지는점이다. 정상필드그대로status만바꾼반례보강은보류·수정0이며기존6건과합7건미해결이다. 새Important는없었고await전함수/basis고정·identity복사·순서/조기거절·오류/권위false는정적으로대조했다. 실제인증adapter/transaction·DB·current는미구현/미검증이다. 다음Main SOURCE대상은기존schema에근거한프로젝트제어판독의최소field 투영후보이며실제정책/권한·DB연결이나현재허가를추정하지않는다. 기존보호/특정거절·미래SQL NOT_RUN을유지한다.

- **2026-10-23 FN03 caller 연결의 서버 후보 판독 접점 SOURCE**: 기준4279b410/추적clean·보호8(raw588a69)에서source-content-server-context.ts와새6시험을작성했다. basis exact3(installation/project/requestv1fullref)와서버제공판독함수2개를고정하고같은db객체로identity후보exact4→control후보exact6→기존선언문맥/최소요약을순서소비한다. 판독기부재는UNAVAILABLE,identity권위추가/잘못된형식·다른project/actor/client제어후보는DENIED/요약null/원요청조회0,옛세대는원scope결박에서정책조회전에거절한다. 후보를복사하고control callback에는별도identity복사본을주며query/판독오류는원형전파한다. 판독포트의실제adapter(authenticateInTransaction/프로젝트제어)는제공하지않고시험은합성callback뿐이다. 동일db객체는실transaction존재/격리·현재권위의증명이아니고BEGIN/COMMIT·실제DB·인증함수·route호출0이다. 일치도declaredContextAuthenticated/currentAuthorityVerified/저장실행LINKfalse·기존13키만반환한다. RED기존29PASS+새6FAIL584.3489ms(raw7776de)→직접55PASS765.2034ms/type/diff0(raw34ea2a). rawmodule95AF710CA9E9E66B94EF5F85F533AD4BE5FE19FE449FFD4A856CD754E8566906/test200E44BBF05432CBC230634C47A6D80204F21C3F92041BD8AF1670C7B24207F6(raw0de746). 새사용가능기능0/실브라우저·DB·실auth/OWNER VIEWER/현재control·양정책·등록/verifier·잠금CAS/COMMIT는미구현/미검증이다. 기존Minor6/특정4파일SQL145NOT_RUN·원I1미실행·실verifier없음412/전DML·LINK거절/권한0·0039/보호8/원실패/Bv3/D2·특정거절/실제제외를유지하며독립정적검토중,전체계획완료가아니다.

- **2026-10-23 선언 문맥 한정 독립 검토/실제 인증 경계**: 신규3코드파일 delta C0/I0/M0·독립 실행/수정0이다. exact8 복사·원scope/fullref·세대 대조/불일치 정책조회0·요약null,일치도미인증/권위false·기존13키변환유지를정적으로대조했다. 실제DB/auth·현재성/노출·원자성은미검증이며Minor6은유지한다. 후속기존AccessRepository.session source를읽은결과실제호출은잠긴세션검사후last_seen_at/idle_expires_at UPDATE를포함한다(rawc7c923). 따라서읽기전용연결로간주해호출하지않았고기존인증/세션을수정하지않는다. 해당session응답만으로content 등록/credential·control/base정책권위가모두생기는것도아니다. 다음Main은이실효과를제외한서버auth/프로젝트제어컨텍스트의기존소비지점을좁혀대조한다. 단순선언값이나클라이언트권위true로대체하지않고실제연결/화면완료를주장하지않는다.

- **2026-10-23 FN03 선언 문맥 바인딩 SOURCE**: checkpoint0f796b2d/추적clean·보호8(raw8088e5)에서새 source-content-request-context.ts를작성했다. exact8 선언값(installation/project/request v1 fullref·user/client·credential/control세대·basePolicyRef)을await전복사/검사하고기존저장reader로선별한원scope와대조한다. 불일치면요약null/정책조회0,일치하면별도정책판독후최소13키요약만반환한다. 일치는UNVERIFIED/DECLARED_VALUES_MATCH_NOT_AUTHENTICATED이며declaredContextAuthenticated/currentAuthorityVerified/저장·실행·LINK는모두false다. 실제AccessRepository.session로그인/현재세대·등록/양정책권위·서명/잠금CAS인증은구현하지않았고route/브라우저입력에미연결이다. 원조회/표시동작유지를위해기존13키변환만순수함수로분리해재사용했으며구조개편/일반공통화가아니다. 새6반례RED(기존23PASS+새6FAIL381.9156ms/raw7b75e0)→직접49PASS427.136ms/type/diff0(raw3dc619),현재scope불일치·옛세대·기준정책/요청hash·getter/권위주장·query오류/호출중변이를확인했다. 실제DB·권한/현재세션·실브라우저·서비스/Agent증거는없고사용가능기능추가0이다. raw context CBF4AB75F74931E9763296B5468AF52FAC752312769CDF9C391E5A274A4D8119/wrapper11E2E09718010B26F36C05096153E6EB0505C5B13D6813CBCE00ED2DC629B1FE/test532BF42F7E3B72831EF276D207FD6E826BF00CB1A175354171F1199593BFCF49(rawa7127b). Minor6/특정4파일SQL145NOT_RUN/원I1미실행·실verifier없음412/전DML·LINK거절·권한0/0039·보호8/원실패/Bv3/D2·특정거절·실제제외를유지하며독립정적검토중,전체계획완료가아니다.

- **2026-10-23 최소 표시 후보 한정 독립 검토**: 새5코드파일 delta C0/I0/M0·독립 실행/수정0이다. 최소13키/context fullref·정책조합/권위false4·descriptor 복사, 서버 필드선택/이력·오류 보존과 고정 실패경고·보고됨≠성공·행동/네트워크없음을 정적으로 대조했다. 실제 브라우저·전송·OWNER/VIEWER·DB/라우트는 미검증이며 Minor6/SQL NOT_RUN을 유지한다. 비활성 표시 SOURCE checkpoint이지 UI06 기능 완료/실행 허가/전체 계획 완료가 아니다. 다음 Main 대조 대상은 저장조회 후보의 현재 actor/client/control 세대 바인딩 선행이며, 표시값의 project/ref 검사만으로 그 권위를 대신하지 않는다.

- **2026-10-23 FN03/UI06 비활성 최소 표시 SOURCE**: 기준ee9f4814의추적clean/보호8을대조(raw7ac35f)하고기존이력UI/API는수정하지않았다. contracts/source-content-status-v1.ts는Node의존성없는exact13키(원project/request fullref·기록상태/시각·대상수·고정정책상태/reason/ref·분리조회/권위false4)만받아복사하고다른context/추가본문·경로·credential·성공/권위주장을거절한다. 새 SourceContentRequestStatus.ts는stateless React표시이며저장이력과현재정책미확인·분리조회/파일일치·관측성공미확인을명시한다. 보고됨은성공이아니며정책회수/만료/없음도별도표시한다. 버튼/fetch/effect/앱연결0이다. 기존조회wrapper에추가한최소projection은전체view대신13키를선택하고codec을소비하며실제auth/OWNER·VIEWER노출검증·전송/route등록을대신하지않는다. UI RED8FAIL349.545ms(rawb4d69b)후모델capacity중단1은제품실패/승인거절과분리보존·설정권한변경0,재개상태읽기raw2a8582후GREEN8/148.5471ms/type/diff0(rawd08a64). projection RED기존20PASS+새3FAIL317.2793ms(rawf2b7fa)→fakeDB저장행/최소자료/실제React SSR·직접인접43PASS418.7154ms/type/diff0(rawfef8d4)다. 실제브라우저DOM/번들·로그인/정식DB·served사용화면은NOT_RUN이며SSR을실사용으로승격하지않는다. 신규원문/파일·QA자원/서비스/Agent실행0·새사용가능기능0,기존Minor6/특정4파일SQL145ASSERT NOT_RUN·원I1미실행/실verifier없음412·전DML/LINK거절/권한0·0039/보호8/원실패/Bv3/D2/특정거절은유지한다. 조회시추측시험경로1회없음은실제rg목록으로정정했고권한/파일복구0이다. rawhash codec931E2896CA3A6CB2E16E153A191A308451787C11A4426902DCDC8C5B7E5BF063/component1ADEEF4FE501295D96E618BE43024D6446A697804ADC7493327FCAF0147ED34B/projection포함wrapper CF5C6D96E4BED48143AEB82659B26D0FAF8CFB940F2E0B4FF3633C4C18ED0C36(전체5hash raw3e1a99). React스킬은최소직렬화/불필요상태없음에만적용·구조개편0이며독립정적검토중,전체계획완료가아니다.

- **2026-10-23 저장조회·정책 조합 한정 독립 검토**: 신규 wrapper/기존 시험 delta C0/I0/M0·독립 실행/수정0이다. 부재 시 추가 조회0/거절·오류 보존, 분리 조회/현재 권위 false, fixture의 원scope·requestRef·생성결과/receipt·감사digest 정합을 정적으로 대조했다. 실제 PG/원자성/current/정책 내용·서명/CAS는 미검증이며 Minor6을 유지한다. 후속은 이 조합 결과의 화면 표시 소비 전에 기존 승인 UI 계약의 위치·노출 범위를 읽기 대조한다. 관리 권한/실DB/실행을 열거나 미검증을 완료로 승격하지 않는다.

- **2026-10-23 FN03 저장 원요청·정책 별도 소비 SOURCE**: PMO의32e4d64e checkpoint 대조 후 기존 저장조회 함수는 수정하지 않고 신규 source-content-request-with-policy.ts를 작성했다. 저장행 부재는 null/정책조회0, 유효 저장후보는 복사된 view.scope로 기존 최신정책 결박을 소비해 request/policy를 나란히 반환한다. 회수/DENY/부재·원요청 만료에도 과거 저장 이력은 보존하며 두 단계 오류는 성공으로 숨기지 않는다. 전체 UNVERIFIED_REQUEST_WITH_POLICY_CANDIDATE/readConsistency=SEPARATE_READS_NOT_ATOMIC/currentAuthorityVerified=false·저장/실행/LINK false이며 별도 두 SELECT를 원자 snapshot/현재 권한 확인이라고 하지 않는다. route/발급/저장에는 미연결이다. 새6반례 RED(기존14PASS/새6FAIL·436.7801ms/raw1dd97d)→GREEN20/650.1509ms·type/diff0(raw49c9aa), 직접 저장/정책 소비32PASS/502.3152ms·diff0(raw6c142b)만 실행했다. fixture는 원scope/requestref·생성결과·영수증/감사digest를 정합 갱신한 합성행이다. module raw6DB71368E51333E070694888A116FCCA4AB47BBABB2D2698F7E05A41ED193166/test FFA0F781DCD3D8A15B236EABD697F2C49F47A81CC4E72DE09CAA230DC3758EEE. 실제 PG/두조회 사이 변경·잠금/CAS/COMMIT·현재 인증/전체 정책 내용·대상 허가/서명은 미검증·미구현, 새 사용 가능 화면 기능0·실DB/정책/키/native·OS/서비스/Agent 변경0이다. Minor6·특정4파일 SQL145ASSERT NOT_RUN/원I1미실행·원실패·특정거절·0039/보호8·권한0/전DML·LINK거절·실 verifier 없음412를 유지하고 독립 정적 검토 중이다. 전체 계획 완료가 아니다.

- **2026-10-23 원요청·정책 소비 한정 독립 정적 검토**: 신규2파일은 C0/I0/M0·독립 실행/수정0이다. await 전 기존 scope 복사·원 수명·최신 head exact fullref/거절 보존과 호출 중 caller 변이/오류 전파를 정적으로 대조했다. 실제 PG/정책 내용·대상 허가·현재 인증/서명·쓰기 활성화 증거가 아니며 기존 Minor6은 유지한다. 다음 Main 선정은 저장 원요청 조회 후보에서 이 정책 결박 결과를 별도 현재성 미확인 상태로 소비하는 연결이다. 새 관리 허가/DB 적용을 열지 않으며 전체 계획 완료나 PMO 배정 대기로 전환하지 않는다.

- **2026-10-23 FN03 원요청·최신 정책 결박 SOURCE**: checkpoint206e5ee7 후 새 미등록 source-content-request-policy.ts는 기존 21키 scope parser로 await 전 복사하고 원 requestedAt≤조회시각<expiresAt를 확인한다. project/subject를 기존 최신 head 판독에 전달해 한 번만 읽고 최신 회수/DENY/없음을 보존한다. 정상 AUTO의 UNVERIFIED 후보라도 원 contentPolicyRef id/version/hash와 다르면 CONTENT_POLICY_REF_CHANGED로 거절하며 일치해도 CURRENT_AUTHORITY_UNAVAILABLE/실행·LINK false다. scope 진위/전체 정책 내용·targets/현재 권한·관리 이력/서명/DB 최신성·lock/CAS를 검증했다고 주장하지 않고 route·저장/발급에 연결하지 않는다. 실제 합성 TDD RED 미구현 함수(raw4f3977)→GREEN6/164.1256ms·type/diff0(raw4e926a), 변경 helper와 직접 소비 codec/head의 한정34PASS/274.4033ms·diff0(rawd10861)이며 전체 회귀/실DB 검사는 아니다. module raw3FF0AC9A2F9D2B4A9D2A1CA77F0C5E4990D658A5D9B79FE8D1649D816F67DAC0/test876F599AFB9883F66A5E4E4E8768179726FE0AA625457A84956C423D2A54B49E. source codec 위치를 documents로 추측한 읽기2건 실패는 rg --files로 실제 contracts/runtime 경로 확인 후 정정했으며 파일/권한 복구0이다. 기존 Minor6/미래 SQL145ASSERT NOT_RUN/원실패·거절·0039/보호8·미적용/전DML 거절/실 verifier 없음412를 유지한다. 실제 DB/정책·키/OS/native/서비스/Agent 변경0·새 사용 가능 화면 기능0·전체 계획 미완료이며 독립 정적 검토 중이다.

- **2026-10-23 정책 계보 한정 독립 정적 검토**: 이번 delta C0/I0/M1·실행/수정0이다. 새 M1은 미래 POLICY_SAFE_SEQUENCE 반례가 row.sequence만 상한 초과로 바꾸고 snapshot.sequence/hash는 그대로 두어 요약 불일치에도 걸리는 점이다. 상한만 검증하도록 snapshot/hash까지 정합 갱신할 보강은 보류·수정0이며 기존5건과 합6건의 미해결 Minor로 남긴다. SQL/22ASSERT·deferred COMMIT/SET CONSTRAINTS IMMEDIATE·경합/권한은 전부 NOT_RUN, 관리 허가/현재성/프로젝트 lock·CAS·실 verifier는 미구현이다. 이번 source 후보는 기능 완료/활성화/인수 증거가 아니다. 다음 Main 선정은 기존 원요청 scope의 정확 contentPolicyRef와 최신 head 조회 결과를 결박하는 미등록 SOURCE 소비 연결이며 실제 정책/권한을 만들지 않는다.

- **2026-10-23 FN03 정책 append 구조 SOURCE**: 기준56484edf·private 동일/main f976ed5e 불변·추적 clean/보호8을 확인하고, 미적용0040에 정책 row/인접 계보 helper와 신규 정책표 INSERT deferred 최종행 callback 후보를 추가했다. 기존 최소 요약6·snapshot hash·유한 ms시각/양의 원기한(version1/safe sequence), 동일 project의 sequence+1/정확 이전 fullref·새 event/관리명령 ID·비역행시각만 대조한다. 정책 원기한에 verification의 30초 상한을 이식하지 않으며 완전한 정책 snapshot·관리 허가/회수 해제·최신 head lock/CAS/명령·영수증·감사는 미구현이다. AUTO/DENY/REVOKED 구조 기록은 허가 판정이 아니고 전DML 거절/RLSfalse/권한0/runner 미등록을 유지한다. 미래 정책22ASSERT를 먼저 작성했으나 SQL 실행 제외이므로 RED→GREEN/PG/COMMIT/SET CONSTRAINTS IMMEDIATE는 NOT_RUN이다. 기존 생성50+보고52+검증계보21에 정책22를 더한 해당 네 파일145ASSERT도 전부 NOT_RUN이며 전체 SQL 시험 재고의 합계는 아니다. 실제 수행은 diff --check exit0·해시/수량 읽기만(raw483dfa/13c5a0), TS 변경0으로 이전112 검사는 재실행하지 않았다. 0040 raw22C525905AD2E0FE918F0D8ABC013C51506011311B5D7426767A8DFC158007D4/미래정책 A9791895D2470455A9B58C2BAABA21B7B6E69ED2AA30775D01FB8204571911F1. 조회 경로 오기 tests/sql/FN03 1회 실패는 실제 tests/integration/FN03로 정정했으며 권한 변경0이다. 정본/게시 현황·계획의 기존 역사 차이는 보존하고 이번 소유 항목만 각각 추가했다. 기존 M1 다섯건/원실패·0039·보호8·특정 거절·실 verifier 없음412를 유지한다. 실제 DB/정책/키/OS/native/서비스/Agent 변경0, 새 사용 가능 화면 기능0·전체 계획 미완료이며 독립 정적 검토 중이다.

- **2026-10-23 FN03 verification append 계보/target SOURCE: 65986f7d HEAD·trackedclean/보호8대조(raw3e301b)후미적용0040에verification row/lineage/target helper와신규verification INSERT deferred final callback/constraint를작성했다. row는safe버전/ref/상대path·finite-ms검증시각/30초기한·v1ACCEPTED/후속REVOKED·INVALID 자기previous형식·snapshot object/hash만검사한다. append는project/id/원observation fullref/targetIndex/path/doc fullref/구현ref의11 identity열불변,정확이전id/version/hash·version+1·비역행시각만허용하고재양성0이다. target은원보고전체completed/root/files순수payload·원관측fullref/target/path/docref·수신이후검증시각을대조하되snapshot내부의미/current verifier/서명/실OS·원Artifact byte동일성/LINK허가는아니다. 구현ref의실현재등록진위도미검증이며valid ref모양/계보불변만대조한다. callback은NEW식별자로최종row/해당이전version/관측/request를다시읽고이전hash를정상값으로사전선별하지않은뒤target·기존finalrequestwrapper를검사한다. source_content_unavailable/RLSfalse·권한0/양성한번Unique·append불변/모든DML거절은유지한다. 신규미래계보21/보고target7추가로보고52+생성50+계보21=미래123ASSERT전부NOT_RUN,실SQL/PG·구문/제약/unique·callback/SET CONSTRAINTS IMMEDIATE/COMMIT·잠금/CAS/현재권위는미구현/미검증이다. 실제수행diff0/hash/수량읽기(rawc3f5f3)뿐,TS변경0으로직전112재실행0이다. 0040 rawFDF9DE74A80C74DF01F946E2DEF07DDCEB2C96EA107B23F877002CCE4B0C0FFD/미래보고7CC4C498C95A6D6206A8884B0668E3ACB1AF658B3F842DBAFECF5F51D3AE92AF/미래계보B01B7E260C4046A27A57B8DEB461C081C3FBFB03686E5171F8E1153C5E48F6B0. 실제DB/키/credential/권한/native/OS/서비스/Agent변경0·화면사용가능기능추가0이며기존M1다섯건/원I1미실행/0039/보호8/원실패/Bv3/D2/특정거절·미적용/runner미등록/audittrigger미연결/실verifier없음412를보존한다. 독립정적검토진행중이며전체계획완료아니다.**

- **2026-10-23 FN03 대상별verification 최신head SOURCE: 30d22bd2 기준후속으로미등록 source-content-verification-head.ts와합성시험을작성했다. expected는원observationRef/targetIndex/path/documentRef/observerImplementationRef의5키이며고정query가project/observation_id/target_index만조건으로versionDESC LIMIT1을먼저읽는다. decision/유효기한/원hash를WHERE에서선별하지않으므로회수·무효·만료·잘못된최신head에서과거ACCEPTED로fallback하지않는다. exact18행·safe integer/Date·원ref/target/doc/구현·양성v1/후속predecessor형식·snapshot canonical object/hash/30초기한을대조한다. snapshot내부의새양식을정하거나그내용의의미·실predecessor존재·서명/현재verifier/OS를검증하지않으며,내용에verified:true가있거나정상양성형태여도UNVERIFIED/CURRENT_VERIFIER_UNAVAILABLE/저장·실행·LINK false만반환한다. rawsnapshot미반환/route미등록/queryerror보존/getter실행0이다. 실제TDD RED8/218.1548ms(raw3c7495)→GREEN8/172.9324ms/type/diff0(rawa65c12), fresh직접인접112PASS1619.7338ms/type/diff0(raw04d995)이며이는합성fakeDB검증이다. 실제DB query/SQL/조회권한·실계보/서명/현재권위·원문/OS/UI·LINK는미구현/미검증이고화면에서사용가능한기능추가0이다. module raw068111AF195A164C1FFC74354BC2024DB9B8A0874D7C3B92C3244EAB9A297BF1/test5082B9AD02EEF8BF1B6DAC4DC317A799838DBD3EAA7C7B5EF9095CBE5BD11517. 미래SQL95ASSERT는NOT_RUN·기존M1다섯건/원I1미실행/0039/보호8/원실패/Bv3/D2/특정거절·전DML/LINK거절·audittrigger미연결/권한0·미적용/runner미등록/실verifier없음412·실DB/키/권한/native/OS·서비스·Agent변경0을유지한다. 독립정적검토중이며전체계획완료아니다.**

- **2026-10-23 FN03 원report/root·target SOURCE: 9eb0c40a HEAD·trackedclean/보호8대조(raw00ba7d)후미적용0040에별도content failure enum과report_payload_shape를작성했다. 기존 TS report codec의root exact3/facts6/선언root-ref·kind/identity/UTF16canonicalPath/제어문자,files exact5/원target순서·doc-ref/HASHED facts12/동일volume·link1·uint64size/filetime·bytesRead=size·EOF·identity7canonical hash/개별·누적한도,root실패전부ROOT_UNAVAILABLE·첫파일실패후NOT_ATTEMPTED·localEvidence exact5/completed집계를대조한다. canonicalPath는선언문자열과달라도되며보고blobHash를Artifact hash와같다고강제하지않는다(실OS/원문동일성/LINK는별도). 기존보고묶음에outer exact20/원scope hash/요청별 maxReportBytes·maxObservationMs/noncecanonical·서명64byte형식을연결했다. 이는형식/주장대조이지서명진위/OS/권위검증이아니다. 미래보고fixture는fullscope/root/files/evidence로보강했지만원교환/permit/명령/FK전체fixture는아니다. 기존nonce불일치반례는다른canonicalnonce로바꿔형식가림을피했고,HASHED0byte·root실패·stop/suffix·target/link/EOF/identity/집계·개별/누적cap·요청별관측시간/보고크기반례20건을추가했다. 개별/누적은identityhash를,요청별cap은scopeDigest/reporthash/audittarget을함께맞춰가림을줄였다. 보고25→45/생성50=미래95ASSERT전부NOT_RUN이다. 실제SQL/PG/구문·REDGREEN/COMMIT/SET CONSTRAINTS IMMEDIATE·잠금/CAS/서명·현재등록/원문/OS는미구현/미검증,실제수행diff0/hash/수량읽기(raw9d51d0)뿐이며TS변경0으로직전104재실행0이다. 0040 raw25C389301FE008F2FA4A2C619EFC514723D30D181595670123B4B413044C53F9/미래보고시험75D17CF5F8FFD403A5150A62698EC93BAC946520BA4CCDEF846991C600296498. 기존M1네건/원I1미실행/0039/보호8/원실패/Bv3/D2/특정거절·전DML/LINK거절·미적용/runner미등록·audittrigger미연결/권한0·실verifier없음412/실DB·키/권한/native/OS·서비스·Agent변경0유지. 독립정적검토진행중이며전체계획완료아니다.**

- **2026-10-23 FN03 원permit 중첩 SOURCE: b2358dd1 HEAD·trackedclean/보호8을대조(rawf6eac4)하고미적용0040에 source_content_request_permit_shape를작성해finalrequestwrapper의exchange후보대신연결했다. 원exchange/phase·scope를선행검사하고미발급NULL그룹또는exact16permit/3root/3credential·원scope/request/hash/관측ref·ONLYscope/원credential시각·UTF16경로4096/nonblank/제어문자제외/rawUTF8hash·canonical32nonce/digest/교환client-servernonce재사용거절·false4/추가token거절을대조한다. serverNow는보관당시permit발급이상/observeBefore미만/rowupdated이하이며현재시간허가로쓰지않는다. 미래정상serverNow>issued 및과거UNKNOWN조회, nonce재사용+맞춘digest·serverNow=관측기한+맞춘updated 등18반례를추가했다. 생성미래시험32→50/보고25=합75ASSERT전부NOT_RUN이며추가fixture는순수permit투영이지원생성명령/receipt전체저장fixture나발급/COMMIT가아니다. 실제SQL/PG/구문·REDGREEN/COMMIT/SET CONSTRAINTS IMMEDIATE·잠금/CAS/서명·현재등록·키/credential발급은미구현/미검증이다. 실제수행diff0/hash/반례수량읽기(rawae9f6b)뿐, TS변경0으로직전104재실행0이다. 0040 raw2971E9C3B14AC174B009A295EB3B45962BF3A36E86BF9FB1F2EF34B3FC40EA43/미래생성시험96129CBFCCD3A45E20B11DDA9CF5B838FCB21B246E5775D66879D07347445F94. 기존M1네건/원I1보정미실행/0039/보호8/원실패/Bv3/D2/특정거절·전DML/LINK거절·미적용/runner미등록·기존audittrigger미연결/권한0·실verifier없음412/실DB·권한·키/native/OS·서비스·Agent변경0을유지한다. 독립정적검토진행중이며전체계획미완료, 다음은원report중첩/root·target 사실의SQL결박SOURCE다.**

- **2026-10-23 FN03 미연결 감사 callback/원 교환 SOURCE: 02c0a0d1 다음으로 audit_events용 AFTER ROW INSERT callback 함수만 분리하고 CREATE TRIGGER/GRANT는 추가하지 않았다. 최종event 역검사false면거절하며기존감사저장경로/권한변경0이다. 별도 nonce32 순수형식함수는32byte decode/encode canonical일치만검사하고실nonce발급/키신뢰/소비는하지않는다. request_exchange_shape는원scope/phase·version1/row project·원시각/범위/hash를묶고 preflight exact12/challenge14·고유목적·동일ref/key/clientnonce·서로다른servernonce·원preflight hash/1MiB/원만료·당시challenge발급/만료를검사하며finalrequestwrapper에연결했다. 새자료를발행하거나과거자료를현재허가로승격하지않는다. 기존reviewer 최초30ASSERT범위delta 정적C0/I0/M0·실행/수정0회신. Main은그뒤CREATED의원row/scope/version1도초기에결박하도록조건·미래2반례를명확히추가했다. 생성시험은22→32ASSERT(신규10), 보고25와합57이며전부미실행/NOT_RUN이다. 추가2건을독립실행PASS로표시하지않고actualSQL/PG/구문·COMMIT/SET CONSTRAINTS IMMEDIATE·감사역경로실호출/권한·잠금/CAS·현재등록/서명은여전히미구현/미검증이다. 실제검증diff0/hash/수량읽기(raw7cc242/523436), TS변경0으로직전104재실행0이다. 0040 raw1296686D8BF4B7DAF60868227A2D2A953EA51021152D4B40063FA3F91B6E4356/생성미래시험E3C13765929FD002E494AAD231B35C64254DF2F611A881C520D3C6DB4619AD19. 기존M1네건/원I1미실행/0039/보호8/원실패/Bv3/D2/특정거절·전DML/LINK거절·미적용/runner미등록·실verifier없음412/실DB·키·권한/native/OS·서비스·Agent변경0을유지한다. 다음은원permit중첩과관측nonce/기한의SQL결박이며전체계획완료아니다.**

- **2026-10-23 FN03 감사 역검사/deferred SOURCE: 3613d113 기준 HEAD·trackedclean/보호8을 재대조(raw24bceb)하고 미적용0040에 source_content_audit_target_shape·audit_final_bundle_shape와 새 content 표 전용 final callback/constraint2 선언을 작성했다. 감사는 sameproject event→target ID로 관측 후보→생성commandID/요청targetID/관측requestID로 요청 후보max2를 찾고 fullref/command/source를 대조한뒤 기존 최종행 wrapper로 중복을 재확인한다. 올바른 hash/version/source만 사전선택해 잘못된 행을 숨기지 않는다. 고유 content protocol/reason의 고아는false, 무관감사의true는content대상이아님만뜻한다. 신규미래10ASSERT를기존시험에추가해보고25/생성22이며전부NOT_RUN이다. 새 requests INSERT/UPDATE 및 observations INSERT만 DEFERRABLE INITIALLY DEFERRED 선언을 추가하고 callback은최종row재조회/요청키변경거절/AFTER·ROW·schema·연산검사를한다. INSERT에서OLD필드를평가하지않도록UPDATE중첩분기를썼다. 기존audit_events에는trigger를연결하지않았고감사역검사호출권한/기존감사영향·잠금/CAS·실SQL/PG·SET CONSTRAINTS IMMEDIATE/COMMIT원자성은여전히미구현/미검증이다. 선언추가≠실DB적용/활성화이며전DML/LINK거절·미등록/권한0·실verifier없음412를그대로유지한다. 실제검증은diff0/hash/반례수량읽기(raw35eba2/8c7c94)뿐, TS변경0으로이전104재실행0이다. 0040 raw62F759EDBDD7A5AAD73669C75D0DC9B132BA2A7DEF1D8451CAE430EC6B6F6607/보고시험3671EACCF07DB8527F90A7F6FD169CCA940669E0943401C76680961FD690705E/생성시험3E8F83733B956728BA7998C7028091914AB709AC61D7D6B7D6DE1816902A6137. 기존M1네건/원I1보정미실행·0039/보호8/원실패/Bv3/D2/특정거절/실DB·키·권한/native/OS·서비스·Agent변경0을보존한다. PMO가전달한 Selected model is at capacity 중단은제품/SQL실패나승인거절로세지않고모델/설정/권한변경없이같은작업을보존해이어갔다. 전체계획완료아니다.**

- **2026-10-23 FN03 생성 최종행/조회 결박 SOURCE: 4f4571a1 다음 단위로 미적용0040에 source_content_creation_bundle_shape와 source_content_request_final_bundle_shape를 작성했다. 원11키 생성 요청의8키 payload/canonical hash·정확10키 APPLIED 결과·HUMAN receipt digest/감사를 같은 요청에 대조한다. 보고 프로토콜 감사와 생성 HUMAN 감사는 분리하며 결과는 과거 CREATED/관측미발급/권위false를 유지한다. completed_at raw microsecond는 기존 reader/TS와 같은 ms정규화로 비교하며 미래 정상+400us/음성+1ms는 result시각도 함께 맞춘다. 조회 wrapper는 project/request PK→commands/receipt/생성감사/관측/보고감사 max2를 읽고 정상reason/source를 사전선별하지 않으며 query오류를 삼키지 않는다. 독립 생성 정적 C0/I0/M1은 SQL uuid 비null 대 TS uuidV1 범위차이(명령/operation/receipt/event ID)이며 새4번째M1로 보류·수정0이다. 기존3M1과 별개이고 실제 활성화/검수 전 남은 조건이다. wrapper 한정 정적 새C0/I0/M0·독립실행0이다. 미래 생성18ASSERT/SQL·PG·REDGREEN/COMMIT 모두NOT_RUN, wrapper 실제쿼리도미실행이다. 실제 수행은 diff check0/hash/수량읽기(raw787cb4/a9407d), TS변경0으로 직전104건재실행0이다. 0040 rawC8A493B066B77CE1A0CAA54029989C94AA3007F941E3A6C96E1FE6260C99F282/미래시험0D64D85EDD2CE93A275EDCECF06A56B75F41DC5247CA016507E965F5E979F472. 호출 snapshot 구조 대조일뿐 감사 별도삽입·고아감사 역검사/잠금/CAS·deferred trigger·COMMIT원자성/현재권위·서명은 아직미구현이다. 어떤 helper도 trigger/권한/route/runner에 연결하지 않았고 전DML/LINK거절·실verifier없음412·0039/보호8/원실패/Bv3/D2/특정거절/실DB·키·native·서비스·Agent변경0을 유지한다. 다음은 감사의 고아/중복 역검사와 deferred 연결 SOURCE를 영향 분리해 작성한다. 전체계획 미완료다.**

- **2026-10-23 FN03 보고 최종행 결박 SOURCE: bff8b1f2 다음 단위로 source_content_report_bundle_shape를 미적용0040에 작성했다. 요청 phase·미소비0/0 또는 관측/감사 정확1/1, 원 project/request/scope·보고GUID/nonce/context/hash/수신시각·CONNECTOR 감사 target/basePolicy/주체·시각을 대조한다. 회수 후 원 소비자료를 보존하고 기존 audit recorded_at의 microsecond를 유지한다. 배열이 실제 DB 전체 결과라는 증명/조회·COMMIT guard/원자 저장/현재권위/서명·nonce 실제소비는 아직 미구현이며 true가 권위를 뜻하지 않는다. Ruling: 기존 감사표에 새 trigger를 즉시 부착하면 관련 없는 감사 저장/권한에 영향을 줄 수 있어 이번에는 순수 최종행 predicate로 분리했다. 생성 command/receipt 결박과 양방향 deferred 검사·동시경합/실PG 증거가 후속 필수이며 미충족이면 계속 기본 거절한다. 독립 원검토 C0/I1/M0는 credential시각 대신 permit.issuedAt−5초 및 finishedAt<observeBefore 결박 누락이다. Main이 기존 report codec과 대조해 SOURCE를 보정하고 다른 hash/감사 불일치에 가리지 않는 반례2건을 추가했지만 SQL REDGREEN/수정PASS는 NOT_RUN이다. 미래SQL19ASSERT 전부미실행; 이번 실제검증은 diff check0/반례수량/해시읽기(raw09ffd9), TS변경0으로 직전104건재실행0이다. 0040 raw12D6200023CA6D7638A0A00094B0A9DC92CDB21D0C4C55409B81E8FD54A4FEE8/미래시험95FA8FE6BF79CB4322EB96A186C1468551E97C687351B5A4995C67981280A0A4. 기존3M1/0039/보호8/원실패/Bv3/D2/특정거절·전DML/LINK거절·미등록/실verifier없음412를 보존하며 실제DB접속/적용·키/권한/native/서비스/Agent 변경0이다. 전체계획 미완료이고 다음은 생성 command/receipt/감사 최종행 결박 SOURCE다.**

- **2026-10-23 FN03 stale 기대값 CAS SOURCE 결과: 고정 project/request/opaque digest 비교 조건을 작성하는 순수 planner와 같은 SELECT의 cas_digest 조회를 연결했다. digest는 불변16열·변경20키를 UTC/ms로 정규화한 SQL hash 후보이며 권한/서명/현재 상태 증명이 아니다. replay는 비교 조건도 반환하지 않는다. CAS5 RED(exit1 rawc255a9)→GREEN5/163.332ms, 조회 tag RED1/152.8811ms(raw0d47c7)→집중19PASS331.1001ms, 최종 직접인접104PASS1124.3931ms/typecheck/diff0(rawbe61db). 미적용0040 raw919BE038ADBD0957299DD235356D42250E427765E4B6D7C8DE8CB360495C793A 및 미래SQL9ASSERT(rawCDB8A6C442FC73597FB4520B855C3DF1832BC6BBACA905DD8CCBBEA203DD913E)는 미등록/미실행이다. 실제 SQL/UPDATE rowCount/동시경합/COMMIT 원자결박·현재 권위·OS·화면은 미구현/미검증이다. 기존3 M1·0039/보호8·원실패/Bv3/D2/특정거절·전DML/LINK거절·실verifier없음412를 보존한다. 다음은 생성·관측·감사/소비의 COMMIT 원자결박 SOURCE 선행이다. 전체계획 완료가 아니다.**

상태: **SOURCE_IMPLEMENTATION_APPROVED / ACTUAL_EXECUTION_NOT_AUTHORIZED**

2026-10-23 신산님 직접 ‘네 의견대로 승인해’를 §11 권장 B의 source/codec·미적용 SQL·기본 미등록 server/native/UI·합성 검증 범위로 기록한다. 관측 시점의 byte 일치를 채택하되 COMMIT 순간 파일 lease를 보장하지 않는다. 실제 파일 읽기·키/권한·DB 적용·서비스·Agent 실행은 포함하지 않는다. 아래 후보 표현과 원 검토 지적은 결정 전 이력이며 이 단락이 현재 승인 상태다.
2026-10-23 / Project Main 어울 / 기준 codex/av3-stage-b 040548d46bc177c9d98b22fb63e1f2ec7b2cd31b.

## 1. 필요한 사용자 결과와 기존 승인과의 차이

UI06에서 확정 문서의 정확 원본 바이트와 지정 소스 파일의 관측 바이트가 같았음을 근거와 시각을 붙여 연결하고, 원문·파일·옛 버전을 변경하지 않는 것이 목표다. 단순 링크/경로 목록이나 metadata 보고의 hash로 대체하지 않는다.

| 직접 대조한 근거 | 재사용 / 재사용 불가 |
|---|---|
| SOURCE_READ_OBSERVATION_A3 r2 §1/7 | 내용 읽기/hash·FILE_READ_DATA·Git·Agent를 명시 제외. 같은 READ_ATTRIBUTES grant/token/purpose로 바이트를 읽을 수 없다 |
| A3 구현계획/TECH_DECISIONS | 로컬 source·미적용 SQL·합성 후보의 한정 구현 승인과 별도 단발 schema46 적용 이력. 내용 수집/원문 검증의 실행 승인이 아니다 |
| SourceReadReportV1.files.facts | identity/size/time/reparse만 있다. report.contentHash는 canonical 보고서 hash이고 파일 hash가 아니다 |
| ArtifactStore / ProjectDocuments.#artifact | 기존 보호 원본 바이트·SHA256·크기·project 귀속·격리 상태 조회/재해시는 재사용 가능. 업로드된 파일이 현재 지정 root/path의 바이트였음을 증명하지 않는다 |
| importDocument / proposeDocumentChange | 원본/파싱/수정 제안·불변 보존은 재사용 가능. 정규화된 텍스트 hash를 원 파일의 raw-byte hash와 동일시하지 않는다 |
| 0032_document_source_links | 기존 link/event·문서/root 연결 저장 구조는 재사용 가능하나 app의 LINKED INSERT를 명시 REVOKE했고 detach만 허용한다 |
| project-command / detach 시험 | link operation은 현재 등록되지 않았고 기존 정책 parser의 link 거절 반례가 있다. 이번 후보로 이를 바꾸지 않는다 |

기준 raw SHA256:
- A3 문서: 095B5FEFDBB2F903415AE404CC97D50FB585D1696FA6468CBFC91E805464D035
- source-read-report-v1.ts: ECD6182F477969A7D5387222F6FD0E6E659776AA44E703900EAB040F7B42F65D
- 기존 0008 SQL: 26A7B7828481689D7017836C1ECE2FC5E9F644CB9B8200122EE013E7F52DB185
- 기존 0032 SQL: 8A504C962C7D873C08CA2DCC9134CBD9759A8D8F5370D40A548969893FF8322D

새 결정은 기존 FN03 기능을 추가 발명하는 것이 아니라, metadata 접근에서 **내용 읽기·새 서명 대상·LINKED 쓰기 권한**으로 넓히는 계약 차이의 선택이다. 기존 FN06 writer Bv3/PREPARE_CURRENT·D2 컴파일과 다른 범위다.

## 2. 대안과 권장안 — 새 버전/새 표가 필수라고 단정하지 않음

A. 기존 A3 4표를 유형 discriminator로 확장하고 새 codec/권한 분기를 둔다. 기존행 METADATA_V1·옛 guard는 그대로 소비하고 새 CONTENT_HASH_V1만 새 guard를 사용한다. 표 증가가 적지만 credential CHECK/trigger/current reader의 분기 변경이 기존 인증에 영향을 줄 수 있다. 단순 v1 extra field 허용은 금지한다.

B. **권장: 새 목적의 병렬 계약과 저장을 분리한다.** 아래 namespace의 protocolVersion=1이며 기존 metadata의 version을 2로 고칠 필요는 없다. 요청/교환/credential, 불변 보고, 검증 receipt, 별도 한정 정책의 4개 후보 표를 두고 기존 0032 링크 저장을 한정 보완한다. 기존 metadata 4표/codec/서명 domain/credential는 무변경이다. 객체가 늘지만 권한 확대와 회귀를 구분하기 쉽다. 아래 이름·열은 **B를 선택할 때의 제안**이지 이미 확정된 schema가 아니다.

C. 기존 Artifact 업로드/수정 제안만 사용한다. 서버 보관 hash 비교에는 유효하지만 현재 source root/path 출처가 없으므로 UNVERIFIED 후보 비교까지만 가능하다. 최초 검증 연결/실제 드리프트 완료의 대체안은 아니다.

이 후보는 B의 source 계약 구현만 결정받는 안이다. 실제 계정/정책·키/credential·파일 읽기·DB 적용·native compile/run·서비스·Agent는 제외한다. A 선택이면 기존 guard/권한의 정확 변경 목록을 먼저 다시 대조한다. A/B 어느 안도 기존 metadata 보고를 내용 관측으로 소급 변환하지 않는다.

## 3. namespace·명령·API·기본 권한

후보 namespace SOURCE_DOCUMENT_CONTENT_HASH_V1, 목적 SOURCE_DOCUMENT_CONTENT_HASH, 파일 access=READ_CONTENT_HASH_ONLY, recursive=false. READ_ATTRIBUTES·SourceScope READ/WRITE·REGISTRATION_STATUS_ONLY·PREPARE_CURRENT는 재사용하지 않는다.

HUMAN 명령 후보:
- defineSourceContentPolicy: 정확 content-policy 개정/회수 기록. 현재 로그인·OWNER·단독 제어·재인증 및 별도 이 계약 관리 권한을 요구한다. OWNER라는 이유만으로 자동 생성/허가하지 않는다. 최초 실제 관리권한 부여는 이번 승인에 포함하지 않는다.
- requestSourceContentHash: targetId=null/expectedVersion=0, payload={sourceRootRef,connectorRef,registrationRef,observerRef,targets,limits,expiresAt,reason}. targets는 {relativePath,documentRef,documentBlobRef}; documentBlobRef는 기존 ArtifactRef 형식이다. 서버가 문서 exact 버전의 content.body와 동일함을 확인한다.
- revokeSourceContentHash: payload={requestRef,reason}. 정확 원 요청/현재 제어·정책 아래 회수 append.
- linkDocumentSource: 기존 INTERFACES의 payload 6키/targetId=null/expectedVersion=0을 유지하되 아래 새 content 근거가 없으면 412. AUTO 전용의 별도 content-policy에서만 허용한다. REQUIRE_APPROVAL은 정확 일회 소비 계약이 없는 동안 닫는다. 기존 detach 정책이 link를 허가하지 않는다.

새 source-only API 후보:
- 기존 /api/v1/projects/:pid/commands의 새 명령 분기. 기본 미등록.
- GET /api/v1/projects/:pid/source-content-requests 및 /:requestId
- GET /api/v1/projects/:pid/source-content-observations/:id/versions/1
- GET /api/v1/projects/:pid/documents/:docId/source-links/:linkId/content-evidence
- POST /api/v1/connectors/:cid/source-content-requests/:rid/exchange
- GET 동일 request 경로의 /permit, POST /reports.
기존 /source-read-*·/source-snapshots와 URL/purpose를 혼용하지 않는다. HTTP 본문≤1MiB·HTTPS 지정 서버·redirect/fallback0·HUMAN CSRF·Bearer/cookie 분리를 유지한다.

별도 content-policy는 HUMAN user/project/허용 operation/targets·기한/한도만 허용한다. DENY/만료 우선·기본 DENY, 정책 없음/회수/다른 project/세대면 거절한다. 기존 범용 materialRules의 v1 link 거절과 기존 정책/등록 binding을 바꾸지 않는다. 현재 기본 로그인/제어·등록/격리 조건과 별도 content-policy를 함께 검사한다. 기존 metadata 정책을 FILE_READ_DATA 허가로 해석하지 않으며, 새 content-plane의 명시적 권한만을 별도로 요구한다. 기존 generic parser에 미지원 link 허용을 추가하지 않는다. 기존 등록에 새 content 능력이 있다고 추정하지 않고 해당 observer의 정확 지원/보호·검증 근거가 없으면 UNAVAILABLE다.

## 4. exact scope / credential / 일회 nonce

고정 scope 키:
protocolVersion, purpose, installationId, projectId, sourceRootRef, connectorRef, registrationRef, observerRef, hostFingerprint, pathHintHash, userId, clientId, credentialGeneration, controlGeneration, basePolicyRef, contentPolicyRef, targets, limits, requestedAt, expiresAt, reason.

scopeDigest=SHA256(canonical UTF-8 scope), requestRef={id,version:1,contentHash:scopeDigest}. root 원문은 기존 방식처럼 서버가 exact 선언 snapshot/hash를 검증한 뒤 보호 permit에만 전달한다. observerRef는 승인된 구현/바이너리의 불변 참조이지 caller가 적은 image hash만이 아니다. URI·pathHint를 실제 root 권위로 자동 승격하지 않는다.

limits 권장 고정값: maxFiles=200, maxFileBytes=2097152(문서 본문2MiB), maxTotalBytes=20971520(20MiB), maxObservationMs=30000, maxReportBytes=1048576. 성공 바이트는 이 한도 이내다. EOF 확인 중 변경 탐지용으로 **요청 전체에서 추가1바이트까지만** 읽고 양수면 즉시 전체 관측 중지/CHANGED; 그 바이트를 전송·저장하지 않는다. 최대 실제 읽기는20MiB+1이며 재시도/재해시로 누적 한도를 초기화하지 않는다. 기존 metadata 200개/30초 상한은 변경하지 않는다.

요청 수명≤10분·현재 세션/양 정책/등록 기한 중 최소, challenge≤60초, 별도 credential≤60초·요청 잔여기한 중 최소다. 실제 수치는 결정 전 제안이며 기존 A3 2시간/2분/5분을 바꾸는 것이 아니다.
- credential scope SOURCE_DOCUMENT_CONTENT_HASH_ONLY, prefix av3sch1_ + random32byte base64url. 서버는 digest만 저장한다. 새 키를 자동 생성하지 않는다.
- preflight 정확 키={protocolVersion:1,purpose:SOURCE_CONTENT_PREFLIGHT,installationId,projectId,connectorRef,registrationRef,observerRef,requestRef,scopeDigest,publicKeyFingerprint,clientNonce,expiresAt}.
- challenge는 위 결박에서 purpose=SOURCE_CONTENT_EXCHANGE, serverNonce32byte·issuedAt를 추가하고 짧은 expiresAt로 고정한다. 동일 preflight만 재조회하고 기한/nonce를 갱신하지 않는다.
- ISSUE는 {step:ISSUE,challengeId,payload,signature}; payload는 원 challenge 전체와 동일해야 한다. 현재 등록/양 정책/주체·서명·한도 검사 뒤 challenge1회 소비/credential digest를 같은 transaction에 저장한다. ISSUE 원문 응답 유실은 RECONCILE_REQUIRED, raw token 재발급/재생0.
- permit은 scope/root/credential 시각과 별도 observationRequestRef·observationNonce32byte/issuedAt/observeBefore를 고정한다. 관측 nonce는 report 수신 transaction에서 한 번만 소비한다. challenge nonce와 다르고, 새 관측/재시도 창을 만들지 않는다.
- 교환 실패 카운트는 현재 등록 key로 유효 서명한 오용만 유한5회에 포함한다. 익명/위조서명은 정상 요청을 잠그지 못한다.
- status-only·A3 credential/서명·다른 request/key·만료·회수·세대 변경은 거절. raw token은 메모리만, argv/env/파일/일반 로그/Git/대화0.

P-256/SHA256 IEEE-P1363 64byte canonical base64url 서명 형식과 canonical serializer는 재사용 가능하다. domain은 각각 ASCII ANVIL_SOURCE_CONTENT_PREFLIGHT_V1 + NUL, ANVIL_SOURCE_CONTENT_EXCHANGE_V1 + NUL, ANVIL_SOURCE_CONTENT_REPORT_V1 + NUL 뒤 canonical payload다. 기존 A3의 LF domain 또는 등록/ownership domain으로 대체하지 않는다. 키 재사용 가능 여부와 purpose 제한 signer의 실제 지원은 미확인이다.

## 5. native 관측·race·EOF·취소·부분 실패

지정 Windows-local NTFS·정확 root/상대 FILE만. 원 root/중간 directory/file handle을 유지하며 상대 열기, reparse/volume 이탈/비정규파일/링크수≠1/대소문자 중복·ADS/UNC/WSL 추측 mapping을 거절한다. FILE_READ_DATA는 새 권한이며 파일 쓰기/삭제/실행·열거·재귀·Git 호출을 허가하지 않는다.

동일 파일 handle의 identity/크기/수정시각·root 귀속을 전후 대조하고, 처음 길이만큼 순차 청크≤64KiB로 raw-byte SHA256을 계산한 뒤 EOF를 확인한다. 짧은 읽기는 즉시 EOF라 간주하지 않고 0반환/실오류를 구별한다. 길이 증가/감소·identity/시각/경로 교체·예산 초과면 hash를 성공 결과로 내지 않는다. 같은 내용의 CRLF/BOM/UTF-8 정규화0이며 Git blob hash와 다르다. source 내용을 문자열로 만들거나 외부 parser/LLM에 전달하지 않는다.

공유 쓰기/삭제를 거절하는 열기를 시도하되 기존 writable mapping·관리자/커널/악성 동일사용자에 대한 완전 격리를 보장하지 않는다. 재오픈한 같은 path의 metadata만 맞아도 원 파일이라고 하지 않는다. 전후 검사만으로 ABA/관측 도중 악의적 복원까지 절대 배제했다고 하지 않는다. 실제 지원·위협모델을 만족하지 못하면 UNVERIFIED/UNSUPPORTED로 닫는다.

단조 전체30초·최초 permit 잔여기한 중 최소, UTC 역행·취소는 전체 중단. 이미 읽은 바이트를 재사용해 새 관측 창을 만들지 않는다. 타임아웃은 OS I/O/프로세스 종료 증거가 아니며 원 보유 자원 정리 확인과 분리한다. 실패/취소 뒤 다음 파일 열기0·지연 completion 채택0. 모든 target을 같은 순서로 보고하되 미시도 항목도 UNVERIFIED/NOT_ATTEMPTED로 명시한다. 하나라도 실패하면 전체 보고는 부분 결과이며 **어떤 파일도 LINK 근거로 채택하지 않는다**. 자동 재관측/남은 파일 재요청0.

중요한 한계: 이 안은 **명시 관측 시점의 byte 일치**를 기록한다. 파일시스템과 원격PG의 원자 transaction/COMMIT 순간 파일 동일성·이후 불변을 보장하지 않는다. 잠금 해제 후 수정·교체될 수 있다. UI는 관측 시각과 신뢰 범위를 붙이고 상시 현재 MATCH라고 표시하지 않는다. 연결/착수/제출/재개 시 재관측한다. COMMIT 순간까지의 엄밀한 파일 lease를 요구하면 별도 분산 lease/취소·crash 계약을 먼저 결정해야 하며, 이를 조용히 축소해서 링크를 활성화하지 않는다.

## 6. exact report / freshness / 진위 gate

보고 정확 키:
protocolVersion:1, purpose:SOURCE_CONTENT_REPORT, commandId, installationId, projectId, requestRef, scopeDigest, observationRequestRef, observationNonce, connectorRef, registrationRef, observerRef, hostFingerprint, observedAt, finishedAt, root, files, localEvidence, reportHash, signature.

root={state,facts,reasonCode}; 성공 facts={declaredRootRef,kind:DIRECTORY,canonicalPath,volumeSerialHex,fileIdHex,reparse:false}.
files는 target과 동일 개수/순서·각1개로 {relativePath,documentRef,state,facts,reasonCode}.
성공 state=HASHED, facts={kind:REGULAR_FILE,volumeSerialHex,fileIdHex,reparse:false,linkCountDecimal:"1",sizeBytesDecimal,lastWriteFileTimeDecimal,blobHash,bytesReadDecimal,eof:true,identityBeforeHash,identityAfterHash}. 두 identity hash는 고정 metadata(identity/size/time/link/reparse) canonical hash이고 전후 동일이어야 한다. bytesRead는 size와 같아야 한다. 실패 state=MISSING/DENIED/CHANGED/TOO_LARGE/TIMEOUT/CANCELLED/UNVERIFIED, facts=null·고정 code만. raw 내용/예외/argv/임의 path/추가 키는 거절한다.

localEvidence={kind:NATIVE_CONTENT_HASH_REPORT,observerRef,ownedProcessRef,observationRequestRef,completed:true|false}. 이 값 자체는 진위를 증명하지 않는다. reportHash는 signature/reportHash 제외 보고 전체의 canonical UTF-8 SHA256이다. 보고 서명 바이트는 ASCII `ANVIL_SOURCE_CONTENT_REPORT_V1` + 단일 NUL + canonical UTF-8 JSON `{protocolVersion:1,purpose:"SOURCE_CONTENT_REPORT_PROOF",installationId,projectId,connectorRef,registrationRef,observerRef,requestRef,scopeDigest,observationRequestRef,observationNonce,reportHash}`로 고정한다. Ref는 정확 {id,version,contentHash}, 나머지 식별자는 scope의 문자열이며 reportHash/scopeDigest는 소문자 64자리 hex다. 서버는 원 저장 scope/permit에서 값과 타입을 재구성하고 보고 값을 신뢰해 덮어쓰지 않는다. 현재 세대는 scopeDigest로 결박하고 수신/소비 때 원 scope와 현재 상태를 다시 비교한다. preflight/exchange는 각 고유 NUL domain 뒤 signature 없는 원 payload 전체를 canonical 직렬화한다. 동일서명·다른nonce 또는 파일 hash만 잘라 서명한 것은 거절한다.

서버 now로 만료/회수/현재 주체·정책·등록·root 버전을 검사하고 receivedAt은 서버가 정한다. 보고 구간≤30초, 주장 시계 오차±5초 안에서 issuedAt−5초≤observedAt≤finishedAt≤receivedAt+5초, receivedAt<모든 만료시각을 요구한다. 성공 관측의 native 단조 기한은 별도 검사다. LINK 사용 시 server receivedAt부터≤30초·원 요청/observer 검증 기한 중 최소이며 연장0. 이 freshness는 위 관측 이후 race를 없애는 증명이 아니다.

수신 성공은 CONTENT_REPORT_STORED/CONNECTOR_REPORTED/OS_UNVERIFIED일 뿐이다. 채택에는 **서버가 보유한 approved observer 구현/바이너리·원 factory/정확 요청/nonce/권한·실제 지원 gate와 current verifier가 낸 별도 검증 receipt**가 필요하다. protected signer는 원 native 결과→scope/nonce 조립 경계를 통해서만 사용하고 caller hash/임의 signer callback echo를 받지 않는다. 실제 concrete verifier/보호 채널·목적 제한 signer가 없으면 receipt 발행0/LINK 412다. 서명 유효성·바이너리 hash·native flag 하나만으로 OS 진위/현재 권위를 만들지 않는다. 관리자/커널·보호 주체 침해 제외를 포함한 실제 신뢰 가정은 실행 검토에서 명시하며 아직 충족됐다고 하지 않는다.

## 7. 서버 문서 결박·LINK 원자성·옛 이력

### 순수 codec 상세화 기록 — 2026-10-23 Main 비의미 보완

permit source의 exact16키는 {protocolVersion:1,purpose:SOURCE_CONTENT_PERMIT,scope,requestRef,scopeDigest,root,credential,observationRequestRef,observationNonce,issuedAt,observeBefore,serverNow,executionAuthorized:false,agentDispatchPerformed:false,baselineConfirmed:false,linkAuthorized:false}다. root={sourceRootRef,pathHint,pathHintHash}, credential={scope:SOURCE_DOCUMENT_CONTENT_HASH_ONLY,issuedAt,expiresAt}이며 token/key/rawSecret은 없고 추가키를 거절한다. 신뢰된 서버 원자료 basis는 정확 {scope,requestRef,observationRequestRef,observationNonce,credentialIssuedAt,credentialExpiresAt,issuedAt,observeBefore}다. 원자료 자체의 인증/현재 권한은 이 순수 consumer가 만들지 않는다.

credential 원수명≤60초/요청 기한 이내, permit issuedAt은 credential 안, observeBefore는 permit 발급 후·credential 종료 이하이며 serverNow/수신 now는 원 관측기한 안이어야 한다. 순수 report context 변환은 아래8키만 반환하고 credential/권위 필드는 버린다. preflight/challenge의 신뢰 basis는 {scope,requestRef,publicKeyFingerprint}이며 fingerprint의 실제 현재 등록 귀속은 서버 후속의 책임이다. preflight는 원 요청 기한 안, challenge는 원 binding/서로 다른 canonical32byte client/server nonce·원 preflight 기한 이내60초만 허용한다. 이 상세화를 실제 교환·발급·서명·권한 활성화로 쓰지 않는다.

승인 부모 raw SHA256 11AB746A30809096F22F52E73A8C3F15C2EA8793A635AA988B10335DC209066F의 범위/권한/한도는 유지한다. context는 정확 {scope,declaredPathHint,requestRef,observationRequestRef,observationNonce,issuedAt,observeBefore,receivedAt}이며 보호 permit의 원 선언 declaredPathHint UTF-8 hash만 scope.pathHintHash와 비교한다. handle에서 관측한 canonicalPath는 별도 주장이고 선언 문자열과 같다고 요구하지 않는다. 원 root ref/identity·실제 handle 귀속과 진위는 별도 current verifier 미연결 경계다. context는 한 번 복사한 값을 검증/서명 바이트 조립에 함께 사용한다.

root 성공 state=OBSERVED, 파일 성공=HASHED, 실패 facts=null로 고정한다. identityBeforeHash/identityAfterHash는 정확 {kind,volumeSerialHex,fileIdHex,reparse,linkCountDecimal,sizeBytesDecimal,lastWriteFileTimeDecimal}의 canonical hash이며 전후 같고 보고 facts에도 맞아야 한다. EOF=true/bytesRead=size·uint64·단일 링크/같은 volume·파일/합계 한도를 대조한다. 성공 파일 hash/길이가 문서 Artifact와 다르더라도 관측 주장은 보관 가능하며 실제 LINK의 문서 raw 일치는 §7 서버 단계에서 별도로 거절한다.

고정 실패 이유는 MISSING:PATH_NOT_FOUND, DENIED:ACCESS_DENIED/REPARSE_DENIED/OUTSIDE_ROOT/NOT_REGULAR_FILE/ROOT_KIND_INVALID/HARDLINK_DENIED, CHANGED:IDENTITY_CHANGED/LENGTH_CHANGED, TOO_LARGE:FILE_LIMIT_REACHED/TOTAL_LIMIT_REACHED, TIMEOUT:TIME_LIMIT_REACHED, CANCELLED:CANCEL_REQUESTED, UNVERIFIED:OBSERVER_UNAVAILABLE/UNSUPPORTED_FILESYSTEM/ROOT_UNAVAILABLE/NOT_ATTEMPTED다. root 실패 뒤 파일은 모두 UNVERIFIED/ROOT_UNAVAILABLE, 첫 파일 실패 뒤 남은 파일은 UNVERIFIED/NOT_ATTEMPTED만 허용한다. completed는 root/file 전체 성공 여부와 같아야 한다. raw 예외/본문은 받지 않는다.

이 codec의 60초 관측 permit 기한/30초 주장 구간·서버 만료 검사는 실제 단조 I/O 예산·nonce 소비·서명 진위가 아니다. 서명 필드는 canonical 64byte P1363 모양만 검사하고 검증된 서명이라고 하지 않는다. root 경로/identity·native evidence도 주장 수용일 뿐이다. 모든 보고는 CONNECTOR_REPORTED/OS_UNVERIFIED로만 취급하고 current verifier 미구현 상태에서 LINK 412를 해제하지 않는다.

최초 지원은 확정 문서 exact 버전의 content.body ArtifactRef와 소스 raw bytes의 일치다. 서버가 같은 project의 보호 Artifact 원본을 읽어 hash/길이를 재확인하고 QUARANTINED/누락/잘못된 저장키/다른 버전은 거절한다. 파싱·정규화된 파생 텍스트나 임의 import 후보를 원 raw 파일과 자동 동일시하지 않는다. 서버 본문과 다르면 최초 link는 CONTENT_MISMATCH로 거절한다. 차이 수집/제안·별도 분리는 기존 FN03/FN04의 후속이며 이번 hash-only 보고에 원문 송신 기능은 없다.

linkDocumentSource는 한 서버 transaction에서 project 제어→현재 정책/등록/root/doc→원 content 요청/보고/검증 receipt를 고정 순서로 잠그고, exact ref/hash/경로/현재성·미소비/기한을 재검사한다. 원문 재해시 후 최종 주체/세대·기한을 다시 검사하며 늦은 성공0. 전체 보고가 성공한 경우에만 report의 target별 검증 계보를 발행한다. 각 계보는 (observationRef,targetIndex,relativePath,documentRef)를 고정하고 최초 양성 receipt는 한 번만 생성한다. 회수/무효는 predecessor를 둔 새 버전이며 최신 버전이 회수·만료되면 과거 양성으로 fallback하지 않는다. 같은 보고/target의 재양성 발행은 금지하고 새 관측을 요구한다. 해당 target의 양성 verification Ref 하나는 링크 head의 same-project UNIQUE provenance로 한 번만 소비한다. report는 최대200 target의 개별 LINK를 허용하되 요청 전체를 첫 LINK에서 소진하지 않는다. 동일 원 명령은 기존 receipt만 반환하고 다른 명령의 재소비는409다. 명령/authorization receipt/audit·LINKED v1/event/head와 이 target 소비를 원자 저장한다. 중간 실패 rollback·COMMIT 응답유실 UNKNOWN/동일 원명령 재조회만, 새 INSERT 자동 반복0.

기존 sourceSnapshotRef payload 키는 유지하되 새 LINK에는 **새 content observation의 정확 Ref**만 허용하고 metadata snapshot Ref는412다. 옛 링크/metadata Ref는 변환하거나 VERIFIED로 올리지 않는다. 대상 typed namespace는 새 content-evidence 조회에서 명시한다. 기존 snapshot/event 형식·DETACHED v2 이력은 보존하며 새 검증 ref는 head의 별도 불변 provenance 열·same-project FK로 연결한다. 보호 provenance가 없거나 legacy이면 UNVERIFIED다. 검증 ref가 snapshot hash에 직접 포함되지 않는 이 설계의 한계를 guard/FK/immutable receipt 대조로 보완하며, 기존 event 재해시/overwrite0이다.

파일/PG 원자성은 위 §5 한계 그대로다. 새 byte 관측으로 현재 등록/정책·writer/Agent 실행권한·확정 baseline이 생기지 않는다.

## 8. 저장 대안과 B의 정확 변경 후보

A(혼합형)는 기존4표에 관측 kind·신규 CHECK/guard·분기 reader를 추가하는 forward 변경이 필요하다. 기존 SQL 파일을 수정하지 않아도 적용된 기존 인증/표의 행위 변경이므로 별도 승인이 필요하다. 새 표가 반드시 필요하다는 주장은 아니다.

B(격리형) 후보4표:
1. source_content_requests: PK(project_id,id),version1,scope_json/hash·created_command/주체/세대/양policy·source/등록/observer exact refs·원 기한. 같은 행의 교환 상태에 preflight hash/challenge payload·nonce/발급·만료·proof/실패0..5, credential digest/scope/발급·만료/회수/보고소비 command를 보유한다. 연결 소비는 요청 단위가 아니라 아래 target별 검증 provenance로 관리한다. scope/최초 자료 불변, 허용 상태 전이만 guard; raw token0·자동 재발급0.
2. source_content_observations: PK(project_id,id,version1), request_id UNIQUE, report_command UNIQUE, report_json/hash/signature·관측/수신 시각·집계. immutable CONNECTOR_REPORTED/OS_UNVERIFIED, 요청·동일 project refs FK. UPDATE/DELETE0.
3. source_content_verifications: PK(project_id,id,version), exact observation/request/observer implementation refs·targetIndex/relativePath/documentRef·검증 시각/기한/판정/고정 이유/근거 refs. 계보당 양성 version1은 한 번만 허용하고 (project,observation,targetIndex)의 양성 계보 UNIQUE를 강제한다. 회수/invalid는 exact predecessor를 둔 새 버전 append이며 최신 버전부터 판단하고 과거 양성 fallback/동일 보고 재양성은 금지한다. 검증 주체는 서버의 실제 current verifier만이며 caller flag/DB row 존재는 권위가 아니다. link 소비는 링크 head의 양성 Ref UNIQUE provenance와 명령/audit를 동일 transaction에서 결박한다.
4. source_content_policy_events: project 단위 순차 버전의 append-only 한정 정책/회수 이력. subject/허용3연산/targets/상한·현재 controller/재인증·관리 허가·정확 predecessor ref. project lock+기대 버전 CAS로 최신 이력 자체를 먼저 확정한다. 최신이 회수/만료/DENY이면 거절하고 오래된 AUTO로 fallback하지 않는다.  generic materialRules/기존정책 head를 바꾸지 않는다. 최초 실제 관리권한 부여는 별도이며 default deny다.

추가 forward 보완: document_source_links에 nullable content_verification_ref를 새 provenance로 추가하고 새 LINK만 NOT_NULL·exact receipt/doc/root/blob/observation/target binding을 강제한다. (project_id,양성 verification의 id/version/contentHash)에 UNIQUE를 두어 target별 소비를 보존한다. detach 후에도 provenance를 지우거나 재사용하지 않으며 소비만을 위한 다섯 번째 표는 추가하지 않는다. 기존 SELECT·detach 권한은 보존하고 INSERT는 새 link 전용 guard/현재 명령·receipt·별도정책이 모두 있을 때만 한정 허용한다. 새 정책 관리·권한·new target INSERT의 app 권한은 명백한 delta이며 실제 부여0이다.

미적용 SQL의 번호는 source inventory 충돌검사로 정하되 실제 실행 manifest·DB 적용은 별도다. 승인된 source/미적용 SQL 작성과 실제 표/열/함수 생성·권한 부여를 구분한다. source-only rollback은 미등록 유지·일반 revert, 실제 적용 후는 append 회수/forward repair다. DROP/기존행 변환/reset/force0. 위4표/열은 source 구현 기준인 B의 범위이며 실제 schema 적용 승인이 아니다.

## 9. egress·목적·보존·노출

### 저장 SOURCE 중간 구현 기록 — 2026-10-23

후속0040의 request phase helper/BEFORE wrapper는 상태별nullable그룹과finite/ms·원요청10분·교환/credential60초·관측최소기한·소비/회수pair·실패상한/조기EXPIRED를검사한다. 이는열조합검사이며중첩preflight/challenge/permit/report의전체exact shape/서명/current를대신하지않는다. 미래phase 반례20건은완전table fixture가아닌typedrow phase 투영으로작성했고실행하지않았다.

별도전이helper는nongenerated 불변16열의ROW와변경20키의명시적projection을사용한다. BEFORE에서to_jsonb(NEW)로계산전생성열을읽지않는다. CREATED→CHALLENGED→ISSUED→REPORTED, 실패+1상한5·원challenge/credential/nonce/기한고정·보고1회·소비보존회수/만료·UNKNOWN재진입거절·동일원행replay를대조한다. wrapper는최초CREATED/updated=created와실제변경시각의transaction_timestamp~clock_timestamp ms창을요구한다. 미래전이18반례는같은ms소비ID교체와회수/UNKNOWN재진입·원자료변경을구분하되실행하지않았다.

이SQL OLD/NEW 검사는클라이언트의stale 기대값 CAS나동시경합·실제nonce소비·원문/현재권위·receipt/observation/audit의COMMIT원자성을대신하지않는다. 해당guard는아직미구현/미검증이고초기fullnested/생성/보고COMMIT결박도별도다. 실제PG구문·제약/trigger동작·REDGREEN·경합/CAS·COMMIT는모두NOT_RUN이다. 현재모든새DML/LINK거절·RLSfalse·권한0·route/runner미등록·미적용을그대로유지하며helper형태true를허가/제품완료로사용하지않는다.

후속 미적용0040에는 scope21키의 순수SQL 형태검사를 추가했다. 6개 fullref·UUID/hash/유한정수·5limits·원UTC/ms시각10분·targets/ArtifactRef·바이트상한/총량·문서/경로중복을 검사하고 request CHECK에연결한다. 기존metadata의 exact/ref/UTF16/Windows상대경로/고정NodeUnicode uppercase helper만재사용하며기존purpose·scope/정책허가는재사용하지않는다. JS trim공백집합을명시해비어있는 reason/mediaType를거절한다. 이는실행하지않은SQL source이며19미래ASSERT/실PG구문·제약·상호운용은NOT_RUN이다. 새정적M1은ECMAScript연도0000와PG BC/AD표현의차이이며기본isoV1계약을임의수정하지않고공통지원범위결정/검증미완료로보류한다. 기존생성시각분기·보고크기M1과별개이고동일형태완전호환/PASS를주장하지않는다.

동일계약의 관측nonce는원challenge의client/servernonce와도달라야한다. 기존reader의digest대조만으로는이조건을보장하지못해같은nonce/digest를함께바꾸는반례후명시적비교를추가했다. 이는원계약누락보정이지새nonce발급/현재권위·DB원자소비활성화가아니다. 원실패와보정전결과를보존하고기존보고/permit·생성감사검사는유지한다.

생성 증거의 순수 SOURCE inspector는 expected={scope,requestRef,createdCommandId}와 value={request,command,receipt,audit}를 복사·대조한다. request는 기존 ProjectCommand 11키의 requestSourceContentHash/targetId=null/expectedVersion=0/baselineRefs=[]/approvalRef=null/원8키payload이며 전체 canonical requestHash를 사용한다. commands projection20키는 기존 scope/주체/client·controlGeneration/basePolicy·요청ID/operationID·authorizationReceiptID·APPLIED 결과와 결박한다. 결과10키 data는 exact {ref,status:CONTENT_REQUEST_RECORDED,requestRef,scopeDigest,storedState:CREATED,scope,observationPermit:NOT_ISSUED,executionAuthorized:false,agentDispatchPerformed:false,baselineConfirmed:false,linkAuthorized:false}이며 evidenceRefs/warnings는 빈 배열이다. 기존 helper의 transaction_timestamp/now 영수증시각은 completedAt와 같고 clock 기반 scope.requestedAt보다 늦을 수 없다.

authorization_receipts projection8키는 같은 PROJECT/command·HUMAN user/client/basePolicy와 기존 scope digest 공식을 대조하고 approvalDecisionRef는null이다. audit projection14키는 동일 project/command/operation/target/basePolicy·actor/client·digest, 양의safe sequence/UUID event와 APPLIED/HUMAN_COMMAND/EXPLICIT_SOURCE_CONTENT_HASH_REQUEST만 수용한다. receipt 존재·hash 일치가 실제 현재 허가나 tamper-proof 서명을 뜻하지 않는다. inspector는 UNVERIFIED_CREATION_EVIDENCE_CANDIDATE/저장·실행·LINK false만 반환한다. content-policy 실제 허용·현재 세션/등록·COMMIT/감사 진위는 별도 미구현이다.

후속 reader SOURCE는 같은 SQL에서 request/생성commands20키/authorization_receipt8키/감사/관측을 LEFT JOIN·상관 조회하고 inspector를 호출한다. 감사는 같은 project/command의 최대2건을 가져와 결과가 정확1건인지 검사하므로 LIMIT1로 중복을 숨기지 않는다. 조회 projection은 위14키에 correctionOf를 더하고 먼저 null인지 확인한 뒤 inspector의14키로 전달해 정정 이벤트를 원생성 증거로 쓰지 않는다. scope의 원8키payload와 저장 commandId로 baselineRefs=[]/approvalRef=null/targetId=null/version0의 원request를 재조립하여 저장 request_hash와 대조한다. 반환 creationEvidence는 구조 후보일 뿐 실제 권위가 아니다. 이 SQL의 실제 PG/driver 실행은 NOT_RUN이며 원자 guard·route/DB에는 미연결/미활성이다.

보고 소비의 report_command_id는 connector의 원보고 GUID이며 기존 사용자 commands.id와 동일 개념이 아니다. 생성 HUMAN 영수증을 보고수신 허가로 재사용하거나 보고 GUID만으로 사용자 명령 FK/권위를 만들지 않는다. 보고 소비는 별도 프로토콜 감사·원nonce/observation/원보고/현재 검증과 일회 CAS를 결박해야 하며 이번 생성 inspector의 검수 범위가 아니다.

후속 SOURCE의 보고 소비 inspector는 정확20키 저장 view와 protocol audit16키를 대조한다. 감사는 원project/CONNECTOR connectorId·registrationId/client/basePolicy/request scopeDigest 및 원reportRef target, APPLIED/SOURCE_CONTENT_REPORT_STORED/SOURCE_CONTENT_OBSERVATION_PROTOCOL이어야 한다. HUMAN commandId/operationId/approvalRef와 correctionOf는null, sequence는양의safe정수·eventUUID, 기록시각은 원요청시각이상·보고소비시각이하이다(기존 transaction_timestamp가 clock 기반수신시각보다이를수있음). 보고GUID는원view에서보존하고실제current/서명·nonce/CAS검증으로승격하지않는다. 회수후에도원소비사실은보존한다. 반환은UNVERIFIED_REPORT_CONSUMPTION_CANDIDATE/저장·실행·LINK false다.

reader SOURCE는같은SQL에서관측exact fullref target/project에해당하는감사최대2건을읽는다. 정상/허용source를WHERE에서먼저골라과거적합1건을살리지않고정확1건을요구하며관측이없으면감사도0건이어야한다. 기존report codec·permit/nonce·소비GUID/time 대조후이검사를연결한다. 실제PG/driver·COMMIT/경합/CAS·현재등록/정책/서명/OS의확인은미구현/미검증이며SQL실행·쓰기권한/route활성화는0이다.

저장행 adapter source는 한 same-project SQL에서 request/최초 생성 command/관측을 LEFT JOIN하여 누락을 숨기지 않고 원20키 view로 투영한다. 실제 query/PG 상호운용은 미실행이다. 최초 명령의 요약·scope/주체/세대/원시각과 challenge/permit/보고 codec·관측 nonce 및 소비 command/time을 대조하지만 현재 인증/정책·서명/OS·전체 receipt/payload/audit·CAS는 대신하지 않는다. 반환은 UNVERIFIED_REQUEST_RECORD_CANDIDATE/저장·실행·LINK false뿐이며 route 미등록이다. 과거 만료 기록 조회가 현재 permit 사용 권위는 아니다.

이전 checkpoint의 preflight_digest-only 누락은 후속 SOURCE에서 preflight_json 보존 열로 보완했다. challenge와 최초 원문의 NULL묶음·1MiB·canonical hash CHECK를 미적용0040에 추가하고 reader는 저장 원문/hash와 기존 exchange codec을 당시 발급시각으로 대조한다. challenge에서 원 preflight를 역으로 재구성하지 않는다. 이는 원문 구조·hash/결박 검증이지 등록 키 진위/서명 증명이 아니며 실제 SQL/PG 적용·검증은0이다. 원 receipt/관리권위·DB 원자 guard는 여전히 후속 미구현이다.

원요청 전이 source view는 정확 {scope,requestRef,state,preflightDigest,challengeDigest,challengeIssuedAt,challengeExpiresAt,credentialIssuedAt,credentialExpiresAt,observeBefore,credentialTokenDigest,observationRequestRef,observationNonceDigest,reportRef,reportCommandId,reportConsumedAt,revokedAt,revokeCommandId,exchangeFailures,updatedAt} 20키다. 원 scope/ref·최초 교환/credential/관측자료를 불변으로 두고 정해진 단계에서 null→값만 허용한다. 보고/회수는 기존 소비자료를 보존한다. 현재 단계의 기한은 원요청/아직 소비하지 않은 challenge 또는 발급된 credential/관측 최소값이며 새 기한을 만들지 않는다. 실패 count 후보는 한 번에1씩 최대5, UNKNOWN에서 재발급/재진입0·terminal replay는 저장0이다.

전이 판정은 UNVERIFIED_TRANSITION_CANDIDATE/저장·실행·LINK false만 반환한다. signature/current·관리권위/nonce 실소비·명령/audit·DB row CAS는 별도 미구현이며 caller의 verified 플래그를 받지 않는다. 이전 전이 checkpoint에서 미구현이었던 state view/실제 request·관측 JOIN adapter는 위 source 후보로 추가했으나 실제 SQL/PG 실행은 미검증이다. 미적용 request 표의 updated_at은 유한·ms단위·created_at 이상을 보존하지만 SQL의 비교/전이 guard는 여전히 미활성이다. 이 timestamp는 승인/허가 token이 아니고 actual UPDATE를 실행하지 않는다.

신규 미적용 db/migrations/0040_source_content_hash.sql.pending에 위4표·same-project FK/target별 양성·소비 UNIQUE·append/강제거절을 작성했다. 기존4개 runner/manifest에는 등록하지 않았다. 새표는 RLS false/FORCE·권한0/모든 DML·TRUNCATE 거절, 최초 LINK INSERT도 거절이다. 실제 인증·정확 shape/상태전이·정책 predecessor/CAS·nonce/서명/verifier·명령/audit/COMMIT guard는 아직 미완성이며 이 닫힌 부분을 활성화 코드라고 부르지 않는다.

content_verification_ref와 보조 id/version/hash는 모두 일반 열이다. 기존0033의 BEFORE 전체행 대조와 충돌하는 STORED 생성열안은 원 정적I1으로 보존하고 source에서 제거했다. CHECK는 legacy 전체NULL 또는 exact ref(version1 양성)·보조3열 일치를 IS TRUE로 강제하며 FK/UNIQUE·4열tuple 불변을 유지한다. 기존 적용0032/0033 원문과 기존행/권한은 변경하지 않았다. 생성열/일반열의 미래 PG 반례는 별도 .sql.pending source이며 실행/RED→GREEN/제품 실제 detach는 NOT_RUN이다.

서버 최신정책 판독 source는 project_id만 선별한 뒤 sequence DESC LIMIT1로 한 건을 고정해 최소 요약/hash를 대조한다. 최신 회수/만료/DENY/다른subject면 거절하고 과거 AUTO 재조회0, 정상 AUTO도 현재 관리 권위가 없어 UNVERIFIED/실행·LINK false다. 이 판독은 full policy/targets/관리허가·이력 계보 검증이나 정책 쓰기 기능을 대신하지 않고 route에도 등록하지 않는다. 저장 SOURCE 부분 구현과 실제 사용 가능한 기능을 구분한다.

로컬 지정 connector→같은 사용자 소유 Anvil API만. payload는 §6의 정확 root/file metadata·상대경로/문서 refs·바이트 길이/파일 SHA256·scope/nonce·observer/서명이다. **파일 본문·파생 텍스트·diff·Git/다른 프로젝트·Secret 원문 송신0**. hash도 짧은/알려진 내용 추측·파일 존재 fingerprint를 노출할 수 있음을 미리 알리고 대상/목적/수신 서버를 명시한다. 이후 원문 수집은 별도 기존 import 절차·허가·격리 검사를 거친다.

scope의 예상 문서 hash를 알고 있다는 이유로 observer의 echo를 원관측이라 하지 않는다. protected native/provider 검증 gate가 필수다. 소스 변경 중 비밀을 새로 포함할 수 있고 hash-only는 완전 비밀 탐지가 아니다. QUARANTINED 서버 자료는 미리 거절하되 unknown secret 탐지 완료를 주장하지 않는다.

OWNER만 경로/개별hash/원보고를 보호 조회, VIEWER는 refs/상태/집계/관측시각만. 일반 감사/로그/Git/대화에는 안전한 ref·집계/고정 이유만. native 청크는 메모리만/평문 스풀·본문 파일0, 정리/만료 시 참조와 버퍼를 회수하되 물리적 완전 소거는 보장하지 않는다. 서버 불변 보고/검증/정책·링크 이력은 기존 감사 보존 정책을 따르고 자동 삭제0. credential digest와 소진 상태는 감사 보존하되 raw token은 보존하지 않는다.

## 10. 필수 검증과 지원 제한

- 순수: v1/A3/등록 서명 거절 회귀, exact keys/중복 key·type/Unicode/size, scope/fullref/다른project·세대·현재정책/회수·nonce 일회/서명 재사용·기한·clock/부분 결과·추가 권위 거절.
- raw bytes: empty/BOM/CRLF/동일 size 다른 내용·독립 SHA256, 2MiB/누적20MiB/추가1byte·201파일·파일중복/EOF/짧은 읽기/증가·축소·동일 path 교체·reparse/alias/다른 volume·memory-mapped/외부 writer 위협의 실제 지원 범위.
- 내구/서버: artifact quarantine/hash/길이·문서 구버전·nonce/검증/명령/CAS 경합·위조 session setting/DML·current verifier 없음·COMMIT 유실/rollback·Node/PG canonical 동일성. 실제 PG 증거 전 적용/수용0.
- native/보호: 원 factory/file handle·observer/binary·signer purpose·TLS/server identity·늦은 completion/취소·해시중단/정확 자원정리·허가종료. 각 실제 실행은 exact source/자원/기한의 별도 결정 전 NOT_RUN.
- UI06: 문서/파일/목적/egress·관측시각·신뢰 한계 preview→명시 요청→partial/expired/UNKNOWN 구분→새 content receipt가 있는 경우만 LINK 준비. 기존 source history/list/detach/승인·buffer·늦은 응답·타 project 격리 유지.
- hash-only로 COLLECT_PROPOSAL 원문 수집, 자동 덮기/확정·Agent 실행·baseline VERIFIED는 지원하지 않는다. 실제 content verifier 부재·허용 위협범위 밖이면 UNAVAILABLE/UNVERIFIED이며 이를 추후 테스트로 숨기지 않는다.

## 11. 지금 요청하는 결정과 비승인 범위

채택된 권장 범위: **B 병렬 source 계약의 source/codec/미적용 forward SQL·기본 미등록 server/native/UI·합성 검증까지 구현한다.** 링크 실제 쓰기/정책 생성·새 키/credential 사용·파일 읽기/OS/native compile·DB 적용/서비스 반영·Agent/비용·Oracle·main은 포함하지 않는다. 실제 단계는 exact 구현/QA 근거가 준비될 때만 별도 효과를 요청한다.

채택한 의미는 §5의 관측 시점 일치·사후변경 재관측 경계다. COMMIT 순간까지의 강한 파일 lease는 미지원이며 필요하면 별도 분산 lease 계약을 보완한다. 이 선택도 actual verifier/등록 권위·QA를 생략하는 승인이 아니다.

전체계획 완료/전체 대기 전환이 아니며 Main은 영향 없는 승인 작업을 계속 선정한다. 기존 Bv3와 D2·플랫폼 특정 거절을 이 후보로 우회하지 않는다.

## 12. 정책 관리 SOURCE 상세화 검토 초안 — 형식 미확정

상태: **DRAFT_ONLY / NOT_AN_IMPLEMENTATION_BASELINE**. 2026-10-23 PMO는 후보 문서 작성만 채택했다. 아래 제안은 승인된 형식·관리권한·구현 지시가 아니며 코드/SQL/기존 reader에 반영하지 않는다. 기존 §3/§8/§11의 B SOURCE 경계와 실제 실행 제외는 유지한다.

### 12.1 목적과 기존 근거

정책 이벤트의 management_command_id가 같은 프로젝트의 commands.id를 참조한다는 사실과, 원 HUMAN 관리 명령·영수증·감사가 정확한 정책 개정을 뒷받침한다는 사실을 분리한다. FK/append/hash만으로 OWNER·재인증·별도 관리허가 또는 현재 권위를 인정하지 않는다.

| 기존 정의·실제 SOURCE | 재사용 가능한 부분 | 그대로 재사용하면 안 되는 부분 |
|---|---|---|
| §3 defineSourceContentPolicy | 개정/회수 기록, HUMAN·프로젝트, 현재 로그인/OWNER/단독 제어/재인증/별도 관리허가 원칙 | 정확 payload·정책 snapshot·결과 data·관리 audit reasonCode는 미정의 |
| 0040 source_content_policy_events | project/id/version1/sequence/subject/disposition/시각, snapshot hash, previous_ref·관리명령 FK | 관리 명령의 operation/원payload·영수증·감사 진위 검증, 최신 head lock/CAS |
| source-content-policy-lineage.ts / reader | 최소6요약·인접 predecessor fullref/sequence·최신 음성 우선·원문 비노출 | 완전한 정책 targets/허용범위, 관리근거 또는 현재 허가 |
| source-content-creation-evidence.ts | commands20 / receipt8 / audit14의 기존 projection 모양, canonical 원요청 hash와 결박 방식 | requestSourceContentHash operation·payload8·CONTENT_REQUEST_RECORDED 결과·AUTO/null 승인·EXPLICIT_SOURCE_CONTENT_HASH_REQUEST를 관리 명령에 복사 |
| §8 기록/노출 원칙 | 원문 보호·정확 참조·집계/고정 이유 중심 보고 | 일반 로그/Git에 원payload·경로·원문/Secret을 추가 |

commands20의 id는 서버 저장 명령 ID이고 commandId는 caller의 중복 명령 UUID다. receipt.commandId와 이벤트 management_command_id는 서버 저장 ID에 결박한다. 보고 프로토콜의 reportCommandId를 이 관리명령 ID로 대신하지 않는다.

### 12.2 기존 불변조건과 새 형식 제안의 분리

이미 있는 최소 snapshot6은 projectId, subjectUserId, sequence, disposition, recordedAt, expiresAt이며 기존 행과 canonical hash를 대조한다. AUTO/DENY/REVOKED·same-project·유한 원기한·인접 append/fullref·불변 과거 이력은 그대로다.

다음은 **제안일 뿐 미확정**이다.

| 결정 ID | 제안 | 기존 승인 대비 정확 차이 / 미확정 사항 |
|---|---|---|
| CM01 | 최소6에 형식 버전·고정 content namespace를 명시하는 병렬 완전 snapshot | 기존6에는 없는 키/버전 분기와 canonical hash 형식이 생김. 정확 키와 버전값은 확정 필요 |
| CM02 | allowedOperations는 §3의 requestSourceContentHash / revokeSourceContentHash / linkDocumentSource만 열거 | 열거 표현·중복/빈 목록·DENY/REVOKED snapshot 표현은 새 형식. 관리 operation의 자기 허가·임의 operation·범용 READ/WRITE는 금지 |
| CM03 | 유한 targets는 기존 documentRef/documentBlobRef/relativePath와 한도 규칙을 활용 | 정책에 root/connector/registration/observer exact refs를 함께 고정할지 결정 필요. wildcard·재귀·새 파일 자동 포함은 제안하지 않음 |
| CM04 | 관리 payload 후보는 previousPolicyRef(null 또는 exact fullref), snapshot, reason | 기존에는 정확 payload 키가 없었음. snapshot 이유 중복 여부·이유 일치 규칙, HUMAN subject와 관리 actor 분리를 확정해야 함 |
| CM05 | 새 불변 이벤트를 create(targetId=null/expectedVersion=0)하고 별도 이전 head fullref CAS로 경쟁 차단하는 안 권장 | 기존 이벤트 version은 항상1이라 그것만으로 최신성 CAS 불가. 기존 이벤트를 target으로 삼는 대안과 command/result 계약 차이가 있으므로 아직 구현하지 않음 |
| CM06 | 관리 결과의 정확 새 policy fullref를 command.resultRef 및 audit.targetRef에 결박 | resultRef.data의 정확 모양/고정 상태 코드·관리 audit reasonCode가 새 계약. 기존 생성 결과 문자열을 재사용하지 않음 |
| CM07 | 관리 당시 정확 actor/client/제어세대·기준정책·별도 관리허가·재인증을 원 명령에 연결 | 영수증/감사 projection의 모양과 현재 관리권위는 별개. 승인 필요 여부·관리 근거 참조·각 기록시각 관계는 확정 필요 |
| CM08 | 원 관리 request 전체의 canonical hash를 commands.requestHash와 비교 | 원payload의 보호 보존/참조와 복원 기준이 필요. snapshot만으로 원request를 임의 재조립하거나 hash가 맞는 새 payload를 만들어 원명령이라고 하지 않음 |

CM03의 기존 target 타입은 저장 문서 바이트의 참조이며 실제 파일 관측·OS 귀속·현재 등록/키/정책 진위를 보장하지 않는다. CM07의 관리 actor와 정책 subjectUserId가 같아야 하는지도 임의 결정하지 않는다. 현재 계보 후보의 부가 snapshot 키를 이 제안 형식으로 소급 해석하지 않는다.

### 12.3 projection 재사용 시 필요한 결박 — 구현 전 검토 목록

- commands20: id/프로젝트·scope, actorId/clientId/controlGeneration, operation/commandId/requestHash/operationId/state, authorizationReceiptId/approvalConsumptionId, expectedVersion/policyRef/payloadRef/resultRef/completedAt의 기존 모양을 보존한다. 관리 operation 일치와 정확 원payload·결과·이전 head 결박은 별도 구현 대상이다.
- receipt8: id/scopeKind/scopeId/commandId/subjectRef/policyRef/scopeDigest/approvalDecisionRef의 기존 모양을 보존한다. subjectRef는 관리 HUMAN actor/client와 결박할 제안이며 정책의 수혜 subject를 관리 actor로 바꿔치기하지 않는다. 기존 AUTO 생성처럼 approvalDecisionRef=null을 관리에 강제하지 않는다.
- 기존 digest 방식은 {projectId,actorId,clientId,controlGeneration,requestHash,policyRef,targetRef}의 canonical hash다. 여기서 policyRef는 관리허가의 기준정책이고 targetRef는 새 정책 이벤트 fullref가 될 제안이다. 새 content-policy 자체가 스스로의 관리허가가 되지 않는다.
- audit14의 projectId/serverSequence/eventId/actorRef/clientRef/commandId/operationId/targetRef/policyRef/approvalRef/outcome/reasonCode/scopeDigest/sourceKind를 원명령·영수증과 대조할 제안이다. 저장 조회 시 correctionOf 및 기록시각을 별도로 보존하고 정정/중복/누락을 과거 적합 이력으로 숨기지 않는다.
- 원request hash·receipt/digest·audit의 구조가 모두 일치해도 실제 관리허가·서명·현재권위·COMMIT/원자성이 자동으로 증명되지 않는다. 검증기/권위 생산자가 없으면 managementEvidenceVerified/currentAuthorityVerified와 저장·실행·LINK는 계속 false다.

### 12.4 호환성·이력·영향

확정 전 영향은 이 문서와 작업현황 기록뿐이다. 0040·기존 commands/receipt/audit 표·적용 SQL·reader/route·역할·정책은 변경하지 않는다.

추후 형식이 채택되더라도 기존6 snapshot을 덮거나 hash를 재계산하지 않는다. 새 완전 형식은 새 이벤트/새 fullref로만 취급하고 이전 ref/hash는 그대로 보존하는 안을 권장한다. 이전 최소 요약 행은 구조 이력으로 조회하되 관리 권위를 확인한 완전 정책으로 승격하지 않는다. 기존 head/계보 reader의 음성 우선·원기한·exact request/context binding·원문 비노출과 기존 공개 DTO/기본 경로를 바꾸려면 그 delta를 별도로 대조해야 한다.

0039·Bv3/D2·원실패/특정 거절·보호8·Minor11 및 SQL145 NOT_RUN은 변동 없다. 이 초안으로 실제 정책 생성·권한 부여·DB/키/nonce/OS/route/served/서비스·Agent/비용·main을 열지 않는다.

### 12.5 대안·권장안·다음 판단

- A: 위 CM01~08의 정확 후보 형식과 결박을 검토·확정한 뒤 병렬 미등록 순수 codec/inspector와 합성 시험부터 구현한다. 미구현 관리근거를 명확히 채울 수 있지만 canonical hash/관리 데이터 형식이라는 새 계약이 생긴다.
- B: 기존 최소6·계보 구조 판독만 유지한다. 현재 구현 변경은 없지만 관리근거/full policy가 계속 미확인이라 실제 요청/검증/LINK를 열 수 없다.
- 권장 A는 **상세화 방향에 대한 Main 제안**이다. PMO가 CM01~08을 기존 승인 구체화와 새 실질 계약 변경으로 구분한 다음 정확한 확정/보완 범위를 결정한다. 초안 작성 채택을 형식 확정·구현/SQL 반영 승인으로 해석하지 않는다. 그동안 기존에 정의된 독립 SOURCE는 계속 진행한다.

### 12.6 Main 단일 권장 후보 — CM01~08 재검토용

이 절은 2026-10-23 PMO 보완 요청에 대한 **미확정 단일 권장안**이다. §12.2의 미정 선택지를 아래와 같이 좁혔으며 코드/SQL에는 적용하지 않는다. ‘기존’은 이미 있는 불변조건이고 ‘신규’는 이 후보에서 처음 정하는 정확 형식/의미다.

**CM01 — 완전 snapshot exact16키.** protocolVersion, namespace, projectId, subjectUserId, sequence, disposition, recordedAt, expiresAt, allowedOperations, sourceRootRef, connectorRef, registrationRef, observerRef, targets, limits, reason을 권장한다. protocolVersion=1, namespace=SOURCE_DOCUMENT_CONTENT_HASH_V1이다. 최소6의 이름/값·canonical hash·version1/sequence·유한 ms시각은 기존이며, 추가10키와 완전 형식 분기는 신규다. 정책 자체의 expiresAt은 recordedAt보다 늦은 유한 UTC ms시각으로 하고 새로운 고정 TTL 상한은 넣지 않는다. 요청10분/관측30초를 정책 수명에 복사하지 않는다.

**CM02 — 허용 operation의 정확 표현.** allowedOperations는 중복 없는 배열이며 고정 정렬 순서는 linkDocumentSource, requestSourceContentHash, revokeSourceContentHash다. AUTO는 그 부분집합 중 비어 있지 않은 배열, DENY/REVOKED는 빈 배열을 권장한다. 세 operation의 이름과 기본 거절은 기존이고 배열·순서·분기별 표현은 신규다. defineSourceContentPolicy를 이 배열에 넣지 않으며 관리 정책이 자기 관리를 허가하지 않는다.

**CM03 — 정확 범위와 한도.** 네 sourceRootRef/connectorRef/registrationRef/observerRef는 기존 RuntimeRefV1 exact3키/id·version·hash 형식, targets는 기존 SourceContentTargetV1 exact3키(relativePath/documentRef/documentBlobRef), limits는 기존 exact5키(maxFiles/maxFileBytes/maxTotalBytes/maxObservationMs/maxReportBytes)를 권장한다. 기존200파일/2MiB/20MiB/30000ms/1MiB 상한, 중복 경로·문서 거절/문서 바이트 참조 규칙을 사용한다. 새 정책 형식에 이 범위를 넣는 점과 네 ref를 동시에 고정하는 점은 신규다. 정책 판독 시 요청의 네 refs·각 target 전체 값은 정책과 정확히 같고 요청 한도는 정책 한도를 넘지 않는 경우만 범위 후보로 본다. 부분 target 집합·wildcard·재귀·새 파일 자동 포함은 첫 형식에서 받지 않는 안을 권장한다. DENY/REVOKED도 같은 유한 범위 필드를 보존하되 허가로 소비하지 않는다.

**CM04 — 원payload exact3키 및 actor/subject.** previousPolicyRef, definition, reason을 단일 권장 payload로 제시한다. §12.2의 snapshot 직접 전달안 대신 definition을 쓴다. definition exact12키는 protocolVersion, namespace, subjectUserId, disposition, expiresAt, allowedOperations, sourceRootRef, connectorRef, registrationRef, observerRef, targets, limits다. projectId/sequence/recordedAt은 caller가 보내지 않으며 서버가 확인한 프로젝트·최신 head·서버 시각에서 생성한다. reason은 기존 content 요청과 같은 비공백/제어문자 거절/20000자 한도이고 완전 snapshot.reason에는 같은 문자열을 넣는다. previousPolicyRef는 최초 null 또는 정확 최신 head RuntimeRefV1이다. 이 exact3/12 형식과 생성 규칙은 신규다. 첫 형식은 subjectUserId=관리 HUMAN actorId인 본인 전용을 권장하며, OWNER라도 타인 subject의 정책은 생성하지 않는다. 본인 전용 제한도 신규 의미 결정으로 표시한다.

**CM05 — append 명령과 CAS.** 기존 명령 envelope의 operation=defineSourceContentPolicy, targetId=null, expectedVersion=0, baselineRefs=[], approvalRef=null 및 위 exact3 payload를 권장한다. 새 이벤트 UUID/version1을 발급하는 create 명령으로 취급하되, 프로젝트별 정책 head를 잠근 뒤 previousPolicyRef=null이면 head 부재, 그 외에는 최신 head exact fullref 일치를 별도로 요구한다. sequence는 최초1 또는 최신+1의 safe정수이며 같은 프로젝트·관리 command 재사용/이벤트 ID 재사용·시각 역행을 금지한다. 최신 DENY/REVOKED도 head 대조에서 제외하지 않는다. append 구조 일부는 기존이고 이 명령 envelope/잠금·CAS 결박은 신규다. 아직 실제 잠금·SQL을 구현하거나 실행하지 않는다.

**CM06 — 결과와 audit의 정확 후보.** 기존 resultRef 외곽 exact10키(operationId,commandId,projectId,status,targetId,version,data,evidenceRefs,warnings,serverReceivedAt)를 유지하는 안이다. status=APPLIED, targetId=새 이벤트 ID, version=1, evidenceRefs=[]/warnings=[]이고 data exact9키는 ref, status, policyRef, previousPolicyRef, sequence, executionAuthorized, agentDispatchPerformed, baselineConfirmed, linkAuthorized다. ref/policyRef는 동일 새 이벤트 fullref, data.status=CONTENT_POLICY_EVENT_RECORDED, 마지막 네 값은 false를 권장한다. audit14의 outcome=APPLIED/sourceKind=HUMAN_COMMAND, reasonCode=SOURCE_CONTENT_POLICY_EVENT_RECORDED, targetRef=새 이벤트 fullref를 제안한다. 새 결과 data·고정 상태/audit reasonCode는 신규이며 기존 생성 문자열을 복사한 것이 아니다. APPLIED는 정책 기록 성공의 미래 형식 후보일 뿐 지금 실제 저장됐다는 주장이 아니다.

**CM07 — 관리 근거와 시각의 정확 후보.** commands20의 actor/client/제어세대·기준 policyRef는 관리 당시 현재 서버 인증·단독 제어 자료와 같아야 한다. 별도 기준정책이 defineSourceContentPolicy를 명시 허용하고 현재 OWNER·재인증을 모두 만족하는 AUTO 관리만 첫 형식에서 받는 안을 권장한다. REQUIRE_APPROVAL은 일회 승인 소비 계약을 별도로 정의하기 전에는 거절한다. approvalConsumptionId/receipt.approvalDecisionRef/audit.approvalRef=null을 이 AUTO 전용 후보에 한해 제안한다. 기존 원칙을 AUTO 한정 값으로 구체화하는 점은 신규이며 OWNER만으로 자동 허가하지 않는다.

receipt8은 같은 PROJECT/서버 command ID와 HUMAN 관리 actor/client·기준 policyRef에 결박한다. 기존 digest 공식의 requestHash는 CM08의 원요청 hash, targetRef는 CM06의 새 이벤트 fullref다. audit는 같은 actor/client/서버 command ID/operationId/기준 policyRef/digest를 사용한다. 보호 감사 조회는 정정 여부/시각을 포함한 projection으로 가져오고 원명령당 정확1건·correctionOf=null을 요구한다. completedAt=result.serverReceivedAt, policy.recordedAt<=completedAt, audit.recordedAt<=completedAt, policy.expiresAt>policy.recordedAt을 권장한다. transaction_timestamp와 clock_timestamp 차이를 고려해 audit 시각과 policy.recordedAt의 동일성은 강제하지 않는다. 이 관리용 값/시각 결박도 신규다.

서버의 현재 인증·재인증/별도 관리허가 생산자가 없는 동안 위 자료는 구조 결박 후보만 확인한다. caller의 verified/OWNER 플래그를 근거로 받지 않으며 managementEvidenceVerified/currentAuthorityVerified를 true로 만들지 않는다. 기존 영수증 모양을 대조했다는 이유로 실제 관리허가를 증명했다고 하지 않는다.

**CM08 — 원payload와 hash의 정확 후보.** 검토 입력은 기존 명령 envelope 원문 전체를 보호 보존해 전달하며, 기존 canonicalJson UTF-8/SHA256 결과를 commands.requestHash와 대조한다. 원 envelope의 exact payload를 CM04로 검사하고 definition·reason에서 생성한 CM01 snapshot 및 CM05 previous/head와 결박하는 안이다. snapshot에서 원 envelope를 역생성해 대체하지 않는다. 프로젝트·caller command UUID·client/controlGeneration·operation/target/version/baseline/approval 값까지 원hash에 포함한다. 기존 요청 hash 방식은 재사용이고 관리 원문 보존·그 정확 형식/참조 방식·재구성 금지는 새 관리 계약의 일부다. 실제 원문 보관 위치/권한·보존 전환은 이번 후보로 변경하지 않는다.

#### 12.6.1 새 계약 변경과 무변경 목록

- 새 결정: exact16 snapshot/exact12 definition/exact3 payload, 본인 subject 전용, operation/target 범위 비교 표현, 관리 create/head-CAS, 새 결과/audit 코드, AUTO 전용 관리와 원payload/시각 결박이다. PMO가 이를 단순 구현 세부라고 간주해야 한다고 주장하지 않는다.
- 무변경: 기존 최소6 행/hash와 predecessor, 기존 source scope/요청/관측/permit/proof·공개 DTO/reader, 적용 SQL·0039/0040 runner 등록·정식 권한/계정/키·route/서비스·실제 실행 경계다.
- 채택되더라도 기존 hash를 치환하지 않고 새 fullref 이벤트로만 진행한다. 형식 없는 과거 요약을 자동 승격하지 않으며 잘못된 최신 head/회수·만료를 건너뛰어 예전 AUTO를 살리지 않는다.
- 선택은 CM01~08의 이 단일 권장 후보 전체를 SOURCE 상세 기준으로 채택하거나, 수정 지점을 지정하거나, 기존 B로 보류하는 것이다. **이번 작성 자체는 채택·코드/SQL 반영 승인이 아니다.**

#### 12.6.2 SOURCE inspector 입력과 projection 값의 단일 후보

향후 미등록 순수 inspector의 입력 exact6키는 previousEvent, policyEvent, originalRequest, command, receipt, audit를 권장한다. previousEvent는 최초 null 또는 기존 exact12 정책행, policyEvent는 새 exact12 정책행이다. expected 입력 exact8키는 projectId, policyRef, previousPolicyRef, managementCommandId, actorId, clientId, controlGeneration, basePolicyRef를 권장한다. 이 두 입력 형식은 신규 SOURCE 계약 후보이며 아직 구현하지 않는다.

command는 기존 exact20 projection, state=APPLIED/scopeKind=PROJECT/scopeId=projectId/expectedVersion=0/payloadRef=null을 권장한다. payloadRef를 원문 artifact 참조로 바꾸지 않는다. 실제 기존 project-command.ts에서 이 값은 일회 승인 scope에 사용되므로, AUTO 전용인 이 후보의 원문은 originalRequest라는 별도 입력으로만 받는다. 원본의 보호 저장·회수 생산자는 이 순수 inspector가 제공하지 않으며 위조 방지/현재 권위는 계속 미검증이다.

receipt는 기존 exact8 모양이며 id=command.authorizationReceiptId, commandId=command.id, scopeKind=PROJECT/scopeId=projectId, subjectRef={kind:HUMAN,userId:actorId,clientId:clientId}, policyRef=basePolicyRef, scopeDigest=기존 공식의 관리 digest, approvalDecisionRef=null을 권장한다. 감사는 원 audit14에 correctionOf/recordedAt을 더한 exact16 projection으로 받아 correctionOf=null을 먼저 대조한 뒤 CM06/07의 값과 결박한다.

originalRequest는 CM05의 기존 명령 envelope 전체, payload는 CM04의 exact3/definition exact12다. 서버가 정한 projectId/sequence/recordedAt과 definition/reason을 합친 exact16 snapshot이 policyEvent.snapshot_json과 같아야 한다. 단순 snapshot 재조립을 원request 보존으로 간주하지 않는다. 관리 내부 id=policyEvent.management_command_id=command.id이며 caller command UUID=originalRequest.commandId=command.commandId=resultRef.commandId로 따로 대조한다. 전체 inspector 입력 canonical bytes<=4MiB, 원request<=1MiB, snapshot<=1MiB와 기존 getter/추가키/중복키 거절을 권장한다. 상한은 기존 SOURCE 보호 입력 방식을 재사용하지만 이 관리용 입력 묶음에 적용하는 정확 형식은 신규다.

이 후보가 모두 구조적으로 맞아도 반환은 UNVERIFIED 관리근거 후보·최소 refs/digest와 managementEvidenceVerified/currentAuthorityVerified/storageMutationPerformed/executionAuthorized/linkAuthorized=false만을 권장한다. 실제 관리허가·재인증/원문 생산자·DB/COMMIT·현재성은 다른 실제 검증이 필요하다. 이 반환 계약까지 포함해 PMO 판단 전에는 코드/SQL·실제 정책 생성에 반영하지 않는다.

## 13. 관리 원명령 보호 생산자 — 재사용 조사와 결정 후보

> 2026-10-24 PMO 요청에 따른 DRAFT_ONLY / NOT_AN_IMPLEMENTATION_BASELINE. §12.6의 SOURCE 형식 채택과 구분한다. 이 절은 새 저장 형식·권한·실제 자원의 승인이나 구현이 아니다.

### 13.1 확인한 기존 수단과 한계

| 기존 수단 | 재사용 가능한 부분 | 그대로 쓸 수 없는 이유 |
|---|---|---|
| db/migrations/0011_authorization.sql의 commands 및 project-command.ts persistProjectReceipt | 내부 command ID/caller UUID·request_hash·주체/client/세대/base정책·영수증/감사 결박 | 원 envelope 전체 저장 필드가 없다. payload_ref는 일회 승인 scope 의미이고 result_ref.data는 CM06 exact9다. 여기에 원문을 끼워 넣으면 승인 형식/기존 소비 계약이 바뀐다. |
| 미적용0040 source_content_policy_events | 새 이벤트 fullref·management_command_id·인접 계보/sequence·snapshot/hash | policy snapshot은 서버 생성 값이며 원 envelope 자체가 아니다. snapshot에서 원request를 역생성해 보존 원문으로 대신할 수 없다. 전 DML 거절/미등록 상태다. |
| 0014 context_bundles.request_payload | 원 payload와 정규화 manifest를 분리해 hash를 대조하는 방식 | buildTaskContext·assignment·7개 slots 전용 제약이다. 관리 원문을 넣으면 다른 도메인의 계약/검사를 우회한다. |
| ArtifactStore | 보호 경로·비링크/소유/단일링크·0600/0700·바이트/hash·크기/사용량 검사 | 파일 보관 자체가 관리 명령 출처/관리 권한을 증명하지 않는다. 현재 project-files 일반 GET은 projectMember를 검사하므로 관리 원문을 일반 artifact로 올리면 열람 범위가 달라질 수 있다. 현재 grant를 관리 원문 grant로 재사용하지 않는다. |

이 조사는 소스·미적용 SQL만 읽었다. 실제 DB schema/원문 존재·경로/소유/ACL·현재 인증·권한은 확인하지 않았으며 조회/생성하지 않았다. 일반 감사에는 보호 ref만 남기는 기존 원칙을 유지한다(INTERFACES 감사 계약).

### 13.2 부족한 계약과 정확 차이

1. **위치/참조**: 프로젝트와 내부 관리 command ID에 귀속한 원 envelope 전체의 보호 보존·불변 참조가 없다. command.request_hash와 연결할 수 있어야 하며 snapshot 대체는 금지한다. canonical 원 envelope JSON 전체의 내용 보존과 요청 바이트의 공백/키순서까지 보존하는 것은 다르다. 기존 SOURCE 계약은 전자의 hash를 소비하며 후자의 forensic 보존까지 구현됐다고 하지 않는다.
2. **접근 권한**: 관리 생성 시 현재 OWNER·재인증·별도 명시 AUTO 허가가 필요하다. 과거 증거 조회에도 현재 로그인/프로젝트 격리·전용 원문 조회 허가가 필요하며 일반 프로젝트 참가자·일반 files GET·Agent 전달로 자동 공개하지 않는다. 기존 SOURCE 입력 expected는 이 실제 producer를 대신하지 못한다. 정확 조회 operation/허가 scope·읽기 정책은 아직 미확정이다.
3. **retention/격리**: 권장안은 기존 자동 삭제 OFF 원칙을 유지해 신규 원문도 자동 만료/삭제하지 않고, 삭제·외부 반출은 별도 결정으로 둔다. 알려진 비밀 표식 발견 자료는 일반 소비를 닫고 기존 격리 검사의 한계를 명시한다. 검사 통과를 완전한 비밀 탐지로 주장하지 않는다. raw payload/인증정보를 대화·일반 로그/감사 본문에 넣지 않는다. 새 보존 기한·암호화/키나 정리 작업은 이 후보에서 생성하지 않는다.
4. **최신 head와 원자성**: 프로젝트 최신 sequence를 먼저 고정하고 최신 거절·회수/만료를 건너뛰지 않아야 한다. 같은 프로젝트 잠금·정확 previous fullref CAS·event/command/원문/receipt/audit 동시 저장과 rollback·COMMIT은 별도 실제 검증이 필요하다. 같은 DB 객체나 하나의 SQL 모양만으로 현재 허가/원자성 PASS라 하지 않는다.
5. **현재 관리 근거**: 서버 보유 로그인/재인증·OWNER/단독 제어·현재 정책과 별도 관리 허가 producer가 필요하다. 과거 receipt/hash·caller의 verified/OWNER 플래그·새 관리 snapshot만으로 대체하지 않는다. REQUIRE_APPROVAL은 여전히 별도 계약 전 닫는다.

### 13.3 대안과 Main 권장안

- **A 권장 — 기존 개발 DB 안의 별도 보호 관리 원문 metadata 계약**: 전체 원 envelope와 canonical hash를 프로젝트/내부 command·새 event에 결박하는 불변 기록을 별도 설계한다. 일반 command payload_ref/result DTO·일반 파일 열람을 바꾸지 않고 향후 같은 transaction의 원자 저장을 검증하기 쉽다. 다만 새 데이터 계약·보호 조회/권한·미적용 forward SQL이 필요하므로 이번 SOURCE 승인만으로 작성 형식 확정/구현하지 않는다. 실제 DB 적용은 더 별도다.
- **B — 기존 ArtifactStore 물리 보관을 재사용하는 비공개 관리 원문 종류와 전용 결박**: 경로/바이트 보호를 재사용할 수 있지만 새 종류/관리 권한·일반 files GET 차단·DB 참조·게시/실패 시 복구가 추가로 필요하다. 기존 일반 업로드·다운로드 권한만 쓰는 안은 채택하지 않는다.
- **C — 원문 보존 없이 계속 입력받는 구조 후보 유지**: 신규 저장/권한 변경은 없지만 실제 provenance/관리 허가를 증명하지 못하므로 실제 요청/검증/LINK를 열 수 없다. 현재 SOURCE가 이 상태다.

권장 A의 다음 결정은 **새 보호 원문 데이터/조회 계약 후보를 구체화할지**이며, 아직 정확 테이블/필드·권한 operation·SQL·endpoint를 확정하지 않는다. 채택되지 않은 안의 형식을 코드/SQL에 먼저 넣지 않는다. 이 결정과 무관하게 승인된 wire/범위 SOURCE는 계속한다. 실제 DB/키·권한/서비스·Agent 실행은 모든 안에서 이번 범위 밖이다.

### 13.4 A 후속 상세 계약 — Main 단일 권장 후보

> PMO가 채택한 것은 **이 상세 문서 후보 작성**뿐이다. 아래 정확 필드/ref·새 조회 operation은 신규 데이터/권한 계약 제안이며, 형식 확정·코드/SQL 반영·실제 자원 생성 승인이 아니다. §12.6 SOURCE 형식과 실제 producer를 구분한다.

**저장·불변 ref 권장안.** 논리적 신규 보호 기록 이름은 anvil.source_content_policy_management_origins를 후보로 제시한다. 기존 개발 DB 안의 별도 metadata이며 새 파일 root/ArtifactStore 종류를 만들지 않는 안이다. 행 exact9 후보는 다음과 같다.

| 필드 | 단일 권장 의미 |
|---|---|
| project_id | 현재 서버가 확인한 프로젝트 UUID. 일반 caller project 주장만으로 저장하지 않는다. |
| id | 서버가 신규 발급하는 origin UUID. 기존 ID 덮기/재사용 금지. |
| version | 1 고정. 정정은 원 기록 수정이 아닌 새 관리 명령/새 정책 이벤트다. |
| management_command_id | 같은 PROJECT의 내부 commands.id. caller originalRequest.commandId와 구분한다. |
| policy_event_ref | 같은 project의 새 정책 이벤트 RuntimeRefV1 exact3. event.management_command_id와 이 행의 내부 command가 같아야 한다. |
| request_json | 수신 wire의 중복키 검사 후 보존한 원 ProjectCommand envelope 전체 JSON. snapshot 역생성이나 payload만 저장하는 것은 금지한다. |
| request_hash | request_json의 기존 canonical UTF-8 SHA256. commands.request_hash와 같아야 한다. 원 바이트 공백/키순서 지문이 아니다. |
| recorded_at | 서버의 유한 UTC ms시각. 정책 recordedAt<=origin recordedAt<=command.completedAt을 권장한다. |
| content_hash | 아래 origin snapshot의 canonical SHA256. request_hash와 다른 목적의 hash다. |

불변 snapshot exact10 후보는 schemaVersion=1, purpose=SOURCE_CONTENT_POLICY_MANAGEMENT_ORIGIN, id, version=1, projectId, managementCommandId, policyEventRef, originalRequest, requestHash, recordedAt이다. originalRequest는 request_json 전체를 그대로 쓰고 나머지는 같은 행 값에서 매핑한다. originRef는 기존 RuntimeRefV1 {id,version:1,contentHash}로만 표현한다. 원 envelope<=1MiB, origin snapshot<=2MiB를 권장하며 이는 신규 보호 기록 상한 제안이다. 기존 관리 wire4MiB/공개 HTTP 본문 한도·CM06 결과 exact9는 변경하지 않는다.

같은 project/내부 command당 origin은 1개이고 정확 policy event당 1개다. project+command 및 project+policy event fullref의 관계를 강제한다. 이전 snapshot·원문 hash를 갱신하거나 과거 원문 부재를 자동 역생성해 채우지 않는다. 출처가 없는 과거 정책은 ORIGIN_ABSENT로 닫고 관리 권위로 승격하지 않는다.

**원자 저장·실패 복구 권장안.** 기존 서버 인증/현재 OWNER·단독 제어·재인증·별도 defineSourceContentPolicy AUTO 허가를 재사용하는 방향이지만, 아직 이 operation을 기존 허용 목록/실제 역할에 넣지 않는다. 프로젝트 최신 head를 잠그고 최신 DENY/REVOKED도 포함한 exact previous CAS 후 서버가 origin/event UUID·시각을 확정한다. 같은 transaction에 원 envelope 보호 기록·정책 이벤트·command/receipt/audit를 저장하며 불변 관계는 COMMIT까지 전부 맞아야 한다. 기존 감사에는 originRef 등 최소 ref만 남기고 원문을 복사하지 않는다. 순환 FK/지연 제약·직접 DML 차단·guard 접근 방식은 미적용 SQL 작성 전에 별도 대조해야 한다.

하나라도 실패하면 전체 rollback이며 성공 receipt/부분 event를 게시하지 않는다. 연결 단절로 COMMIT 결과가 불명확하면 새 command를 만들지 않고, 동일 내부/caller command·request_hash·originRef/event fullref 관계를 재조회해 판정한다. 동일 caller command 재전송은 현재 인증/허가를 먼저 확인하고 정확 원 envelope hash와 기존 결박이 같을 때만 역사 ref를 반환한다. 다른 본문/기준 ref/주체·세대는 충돌로 닫고 기존 기록을 삭제·교체하지 않는다. 이를 actual COMMIT/경합/복구 시험 없이 원자성 PASS로 표시하지 않는다.

**전용 조회 권한·일반 GET 격리 권장안.** 새 읽기 정책 operation 후보는 readSourceContentPolicyManagementOrigin이다. 공개 endpoint는 아직 정의하지 않는다. 미등록 조회 입력 후보 exact3은 originRef, policyEventRef, managementCommandId이며 프로젝트·actor/client/현재 제어세대는 서버가 보유한 로그인/경로 문맥에서 받는다. caller verified/OWNER/auth 플래그는 입력받지 않는다.

현재 프로젝트 OWNER·재인증·동일 client의 단독 제어와 이 exact PROJECT 범위의 별도 명시 AUTO 조회 허가가 모두 있어야 한다는 안이다. 일반 projectMember 조회·uploadArtifact/일반 files GET 권한으로 대체하지 않는다. REQUIRE_APPROVAL은 조회용 일회승인 계약을 따로 정하기 전 닫는다. 해당 operation/권한은 신규 제안이며 기존 materialRules/documentOperations·DB grants에 지금 반영하지 않는다.

보호 row의 request_json은 서버 내부의 기존 관리 증거 inspector 입력으로만 전달하는 안이다. 일반 화면/파일 다운로드/Agent 컨텍스트/검색·로그/감사에는 원문을 반환하지 않는다. 일반 응답 후보 exact5는 originRef, policyEventRef, managementCommandId, requestHash, authority=UNVERIFIED이며 원문 진위/현재 권한을 이 응답만으로 증명하지 않는다. DB 직접 SELECT로 이 경계를 우회할 수 없도록 전용 보호 접근 경계를 설계해야 하며, 그 정확 role/guard SQL은 현재 인증 producer와 함께 후속 검토 사항이다.

**retention·민감 자료 권장안.** 자동 삭제 OFF·정책 만료와 독립 보존을 단일 안으로 제시한다. 실제 사용자 계정/프로젝트의 삭제·내보내기/백업 포함을 자동 허용하지 않으며 기존 원문은 덮기/정리하지 않는다. 새 입력은 기존 알려진 비밀 표식 검사를 적용해 의심 자료를 성공 origin으로 게시하지 않고 원문 없는 거절 감사만 남기는 방향이다. 보호 원문 조회 때도 다시 검사하고 의심되면 원문 반환/허가 소비를 닫아 검토 대상으로 남긴다. 검출이 완전하다고 하지 않으며 자동 마스킹 덮기·자동 파기·키 교체는 하지 않는다. 구체적인 수동 삭제/격리해제·암호화 키/백업 반출 정책은 이 후보로 생성하지 않는다.

**기존과 신규의 구분.** 기존 재사용은 원command canonical hash, RuntimeRefV1, CM01~08·현재 로그인/제어/정책/감사 접근의 확인된 계약, 자동 삭제 OFF 원칙이다. 신규 제안은 origin exact9/10·불변 ref/1:1 관계/시각/상한, 원문 보호 metadata 저장·전용 조회 operation/입력/반환 및 그 허가 범위다. 이 새 계약을 일반 구현 세부로 간주하지 않는다. Main 권장안 전체를 SOURCE 상세 기준으로 채택할지 또는 수정할지가 다음 결정이며, 문서 작성 자체로 SQL/코드 구현이나 실제 DB/권한/서비스가 승인된 것은 아니다.
