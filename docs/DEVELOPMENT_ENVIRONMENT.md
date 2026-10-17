# Anvil 재설계 개발환경

FN06 제한 신뢰 등록 합성 Windows 부분(2026-10-17): 신규 `D:\tmp\anvil-v3-fn06-registration-qa\{bin,protected,results}`만 현재 사용자/SYSTEM 보호로 만들고 기존 Framework64 csc4.8.9221로 빌드했다. helper SHA256 1E5689552F058C47E5D0112BD26C9CBE024869BE0DBF634E2A9F2B69CDC46055, 실제 CurrentUser DPAPI·CNG↔Node 공개 서명/변조 거절1 PASS/2157ms·skip0. exact owner/nonlink/tree/hash/process 검사 뒤 일회 자원은 모두 제거(root없음/helper0); source/공개 고정벡터만 Git 후보로 보존한다. 기존 부모 ACL·.av3-data/계정/CA·service/relay 불변이다. 서버 등록·신규43 적용/WSL 실제·Windows→WSL HTTPS·다른 OS 사용자·영구 PC/Agent/유료 호출은 미검증이며 로컬 단위와 혼동하지 않는다.

UI08 FN11 승인 소비의 실제 검증은36fa3e511c01282ca647ab8882de4a0d044d3d00 private/WSL exact clean에서 same-client1 PASS/3208.980059ms/skip0이다. 독립 QA41종 잔여0·migration42·시험root[]·원문0700/nonlink/실경로 동일/empty. Web 함수/HTTP 주입/정식 PG를 확인했으며 실제 사용자 로그인 브라우저·Agent·배포 인수는 아니다. 이후 차이는 화면 내부 목록 sequence·시험/캡처·문서뿐이고 승인/후보 API client·서버/DB 시험은 불변이다. Windows old backend/relay HOLD/만료 bootstrap·Secret·실제 사용자/권한·운영은 그대로다.

UI08 최초 화면/client 구현은 로컬 unit164·UI08/UI11 fixture20/type/build로만 확인했고 아직 UI08 same-client 실제 API/PG 소비·실제 사용자 브라우저 인수는 미실행이다. 기존 FN11/후보 DB·migration42/서비스/relay/Secret은 변경하지 않는다. 실제 검증 전 생성 자원은 별도 사전등록과 exact SHA 게시/WSL Git 대조를 거친다.

UI11 후보 same-client 실제 검증은747c6f37cb1de34436f63b3eb4fa7cc0f4e1ff72 private/WSL exact clean에서 새 UI11 시험1 PASS/865.862153ms/skip0이다. Web 함수→Fastify HTTP 주입→기존 정식 PG를 사용하며 실제 로그인 브라우저/네트워크 배포 인수는 아니다. QA41종/시험root 각0·원문 보관소 보호/empty·migration42·새 SQL/실제 사용자/서비스/Secret 변경0이다. 이후 변경은 UI11 scoped CSS·class/import·화면시험/캡처·문서이며 같은 Web API client/서버/DB 시험 내용은 불변이다. 현재 Windows old backend/relay/만료 bootstrap은 그대로라 사용자에게 전체 사용 가능으로 안내하지 않는다.

최신 FN06 검증 코드는350b2e3017012ea1774dab28209643066c6db7a3이다. 기존 WSL 정식 checkout에서 동일 private SHA·clean을 확인한 뒤 후보 내부/HTTP·기존 문서 업로드 승인·현 정책/제어 actual3 PASS/15530.534987ms/skip0을 실행했다. 이후 문서-only 기록은 이 실제 코드 SHA와 구분한다. 독립 DB41종 QA 각0·migrations42·시험root[]·원문 root uid1000/0700/nonlink/실경로 동일/empty이다. 실제 host/credential/Agent·서비스/relay/Secret 변경0이며 UI11/실제 사용자 로그인 browser 인수가 아니다. 로컬 unit150/typecheck/diff 통과는 해당 실행 범위만 증명한다.

FN06 내부 후보 저장에 사용자/PMO 승인으로 forward41 `0006_connection_candidates` checksum327af229e0a2f88f1e763e83ddebd3c522cf3cda2d2d43e9355ef2c8bc8b280d, 개정 guard alias 보정42 `0006_connection_candidate_guard_alias_fix` checksum b9642ef359ea0ed71bb0d65551feeac9a287930a2ec81ed643f3e327d0204aa0 적용 exit0·이전40/41 불변·fixtures7·실제 사용자0. d6f24ab3 exact WSL 내부+신규 HTTP actual1 PASS/1259ms/skip0이며 후보 원본2테이블만 사용한다. 실제 host/grant/credential/Agent·서비스/relay/Secret·사용자 browser DB 인수는 미변경/미검증이다. 이후 이 두 적용 SQL은 수정하지 않고 추가 보완은 새 forward를 사용한다.

FN03 고정 방법론 단계 연결 forward40 `0003_document_stage_bindings` checksum5ec9965d55ad7968d5dac7a2cf90f388b6e3bf6e1a1e74913d32bb8d1c4041e1는 직접 승인 아래 기존 개발 DB에 적용됐다. 6cdb21cb exact WSL actual 단계1 PASS/1199ms(기능952ms)/skip0·기존 문서 인접1 PASS/14585ms(기능14288ms)/skip0, 독립 DB39종 count0·시험root[]·지속원문 uid1000/0700/link0/실경로 동일/empty·migrations40이다. 기존39 SQL·서비스/relay·실제 사용자/권한·Secret은 변경하지 않았다. 실제 같은 Web 함수/API/PG 검증이며 현재 Windows old backend/만료 bootstrap/relay HOLD를 교체한 사용자 browser↔DB 인수는 아니다.

FN02 프로젝트 전용 개정/사람 검토/확정 forward39 `0002_project_methodology_revisions` checksumf816147a1454b428af090b0feb93e496b60cb4eaba7f5979fccdf919fc353e68가 직접 승인 아래 기존 개발 DB에 적용됐다. 이전38 SQL 불변·fixtures7·실제 사용자 생성0, 19ce2bb7 exact WSL의 FN02 same-client/최초 생성 actual2 PASS/1485ms/skip0·독립 DB39종/시험root 잔여0·지속원문 보호/empty. 새 개정/확정만 구현했으며 적용 전환은 실행 상태/영향 근거 부재로412다. Windows backend/relay/만료 bootstrap·CA·Secret은 교체하지 않았고 실제 사용자 browser↔DB/Agent 인수는 미확인이다.

FN01 기존 소스 사용자 선언은 직접 승인 아래 forward38 `0001_source_declarations` checksum246fd20284f998ac8d1c1cbea1570372f7d6a204dad885ea41112eeda5b3c025를 적용했다. 초기0001의 source_declarations identity와 원37 SQL은 보존하고 새 source_declaration_versions/project_source_declarations만 연결한다. 0ba2fd49 actual2 PASS/1178ms·UI02 same-client d8128157 actual1 PASS/1184ms/skip0, 독립 DB39종/등록 시험경로 잔여0. 입력 pathHint를 실제 경로로 읽거나 허가하지 않았고 새 서비스·실제 사용자/Secret·실제 소스 파일 변경0이다. 사용자용 mixed runtime/만료 bootstrap/relay HOLD는 그대로이므로 실제 browser↔DB 인수는 미확인이다.

FN05 헌법 적용/이력 forward37 `0005_project_constitutions` checksum71f4674b279ffea063e3291c392ac822ab4367a0393834079b79caeea29dd765가 직접 승인 아래 기존 개발 DB에 적용됐다. 기존36 SQL 불변·fixtures7·실제 사용자 생성0. 서버045d6996 actual2 PASS/14708ms와 UI10 same-client7cf8c005 actual1 PASS/15068ms/skip0, 독립 DB33종 각0·등록 시험root[]·지속root 보호/empty. 헌법 pointer는 프로젝트별 정확 적용 세대로만 전환하며 기존 원문/지식·확정 이력을 보존한다. Windows 서비스/relay/만료 bootstrap·CA·Secret은 교체하지 않았고 실제 사용자 browser↔DB 인수·Agent 전달/준수 판정은 미확인이다.

FN11 목록 후속 `835b9a50a7cf08855a183ec868305f57437d351d` exact private/WSL clean actual1 PASS/12553ms/skip0, SQL36 재실행0·새 DB/schema/권한/자원 생성0. 독립 DB31종 각0·시험root[]·지속root 보호/empty·migrations36 확인. 현재 Windows 실행본/relay·Secret은 그대로 보존하며 이 API 실측을 실제 사용자 브라우저 인수로 승격하지 않는다.

FN11 최신 저장 검증 `eb4f1d97c9b914a9dbd17a71d6c2e5f705d74e18` exact private/WSL clean: 같은 직접 승인 범위의 forward34/35/36으로 요청·사람 결정·원문 업로드 후보의 일회 소비를 연결했다. migration36 checksum9eab1fcba2586bf87f202cefc39f300e152e1415c8339692438074b3b800b29d, 이전 SQL 불변·fixtures7·실제 사용자 생성0. actual2 PASS/13084ms/skip0·독립 DB31종 각0/시험root[]·지속root uid1000/0700/link0/실경로 동일/empty. 실제 사용자/정책·Secret·서비스/Agent·설계 기준 변경0이며 기존 Node40744/receipt commit000d0088·relay26052는 보존했다. 새 UI browser↔DB/인수는 미검증이다.

FN04 최신 저장 검증 `df2f81ff28c0a2832dff24b87dd7dc0646a57c7c` exact private/WSL clean: 동일 승인 범위 forward30~33으로 사람 영향 버전·요청4종 출처를 추가했다. migration33 checksum1ec0d32d45a770998be2da36d2eab7cd557f16314ee41618676bcefea704b95a, 이전 SQL checksum 불변. actual1 PASS/9215ms/skip0·독립 DB28종 각0/시험root[]·지속root uid1000/0700/link0/실경로 동일/empty. 현재 기준·실제 계정·권한·Secret·서비스 변경0. Windows backend000d0088/Web 혼합 runtime·만료 bootstrap·relay HOLD는 그대로이며 실제 사용자 브라우저↔DB 인수가 아니다. 아래 초기29/이전 검증 문장은 해당 시점 이력이다.

FN04 초기 변경 요청 `d672450d004af3b9cda723557cb64be271f24eb9` exact private/WSL clean, 승인 forward29 `0004_design_change_proposals` checksum2cafd54f19dade5780c0f9dab652999c65ed1b072bafe3e64b701935ea7b7d70 적용/이전28 불변. actual2 PASS/8830ms/skip0·독립 DB28종 각0/시험root0·지속root 보호/empty. 변경 요청·초기 기계 영향 저장이며 원문/확정 기준·서비스/계정/Secret·실제 Agent 변경0. SQL29는 이후 수정하지 않고 같은 승인 범위의 후속 저장 보완도 새 forward만 사용한다.

UI06/FN04 `827f812ff1299f692830423cc6091e5405ba9877` same Web exact private/WSL clean actual1 PASS/8168ms/skip0·DB26종/시험root0·지속root 보호/empty·migrations28 불변. 현재 사용자용 Windows service는 교체하지 않았고 DB/화면 fixture·same-client 실측을 실제 browser↔DB 로그인/사용자 인수로 승격하지 않는다. 다음 설계 변경/영향 저장 DB 보완은 별도 질문 중이며 아직 미승인/미적용이다.

FN04 확정 저장 `a7d6851f28433ab9756d68431ffb09d2c4d88103` exact private/WSL clean actual1 PASS/8110ms/skip0. 승인 forward28 `0004_work_plan_confirmation` checksum8c899de2c7c5e673a8915fd2ebd83e78b32e0d87d4828b50cd76dd499b03a249 적용, 이전27 불변. 독립 DB26종/시험root0·지속root uid1000/0700/link0/실경로 동일/empty. 사용자용 Windows backend는 이전 버전·Web build만 갱신된 mixed runtime이며 로그인/실제 browser DB 인수를 주장하지 않는다. 기존 서비스·계정·Secret·CA·relay 재시작/갱신0. 화면 연결은 별도 후속이며 아래 이전 ‘미작성/미적용’은 과거 시점 이력이다.

FN04 화면 검토 선택 `ec2692212b5d4ad93d6ab5a27cd28105916840cf` exact private/WSL clean actual1 PASS/7739ms/skip0·독립 DB25종/시험root0·지속root 보호/empty. SQL27 재적용0·새 DB/schema/서비스/실제 사용자·Secret 변경0. 다음 계획 검토/확정 forward는 승인됐으나 아직 미작성/미적용이다.

격리 UI 동일 Web `391a1d6c7ec8d6e5550df48f54421fb946899a6d` exact private/WSL clean actual1 PASS/6753ms/skip0·독립 DB25종/시험root0·지속root 보호/empty. SQL27 재적용0, 실제 사용자/Secret·CA·서비스 변경0. 원문 격리는 실제 보관 성공과 사용 차단이며 사용자용 mixed runtime/실제 browser DB 인수 완료가 아니다.

원문 격리 `891cfd3135e5f0bcb4baab7b17c4615bbbe58e52` exact private/WSL clean에서 새 forward27 `0005_artifact_quarantine` checksum27480ec2d09bc14bf88196e7d45104bfac107f7fa362760246d0b49eaf043ad5 적용·기존26 불변. actual2 PASS/6327ms/skip0·독립 DB25종/시험root 잔여0·지속root 보호/empty. 첫27 후보는 구문 오류로 전체 롤백/열0을 확인했고 원문/기존 적용본을 수정하지 않았다. 실제 사용자·Secret·CA·서비스 변경0이다.

UI10 동일 Web 판단 client `6e9da43c320737479516f142d6d268b1b724db87` exact private/WSL clean actual1 PASS/6638ms/skip0·독립 DB25종/시험root0·지속root 보호/empty. 적용26 재실행0, 실제 사용자/Secret·서비스·Agent 변경0. 기존 Windows backend와 새 Web dist의 mixed runtime이므로 사용자용 exact-SHA 통합/인수 완료로 표시하지 않는다.

FN05 검토·확정 서버 `498d1a6fa4442a5843307108aea8de4ef2c1e513` exact private/WSL clean에서 승인 forward26 `0005_knowledge_confirmation` checksum35bd5b9a3f6109881f0f22b1a06957114ea714556e03700678c7e1ba3d353766 적용·기존25 불변. actual2 PASS/6283ms/skip0·독립 DB25종/시험root 잔여0·지속원문 보호/empty. 실제 사용자 정책·Secret·CA·서비스·초기 등록/relay는 변경하지 않았다. UI10 후보의 actual은 후속이며 mixed runtime/미검증 경계는 유지한다.

정정 UI 동일 Web client `c2b1b75cad5c895c4f1e0c324936865b728237c9` exact private/WSL clean actual1 PASS/5951ms/skip0·독립 DB25종/시험root0·지속root 보호/empty. SQL25 재적용0·원문/지시/이유·앞1 보존과 새2/멱등을 확인했고 사용자용 서비스/Secret·실제 사용자/Agent는 변경하지 않았다.

사용 제외 UI 동일 Web client `9a9526255cb108a6c62d07633384826ea310a4bf` exact private/WSL clean actual1 PASS/7346ms/skip0·독립 DB25종/시험root0·지속root 보호/empty. SQL25 재적용0·원문 artifact 개수 불변·서비스/Secret/실제 사용자/Agent 변경0. 전체 기능/실제 사용자 browser DB 검수는 미완료다.

지식 상태/이력 동일 Web client `eda65c855695ebb80dff5e7f6958bf455f0d16b8` exact private/WSL clean actual1 PASS/5775ms/skip0·독립 DB25종/시험root0·지속root 보호/empty. SQL25 재적용0·합성 event 정정사유 변조는 finally에서 복원했고 실제 사용자 데이터/서비스/Secret는 변경하지 않았다.

FN05 정정/제외 서버 `4ce865e800be2591c5ab6b2e5121bba0155e04d1` private/WSL exact/clean에 승인 forward25 `0005_knowledge_changes` checksum03dc6518781e35af3a06c28d7ee18d05936b2ebc9e513cbc0b100495b36c24fe만 적용·기존24 불변. actual2 PASS/6012ms/skip0·독립 DB25종/시험root 잔류0·지속 원문 보호/empty. 새 사용자/권한·Secret·서비스·Agent 전달 변경0이다.

대화 UI 동일 Web client 후속 `2c123a45758d83dc8a7ce5c56cf3ca9c22eac91e` exact private/WSL clean actual1 PASS/5561ms/skip0·독립 DB25종/시험root0·지속원문 보호/empty. 기존24 SQL 재적용0·사용자용 backend/relay/초기 비밀·CA/서비스 변경0. 실제 사용자 browser DB와 전체 기능 검수는 미완료다.

대화 원문→지식 출처 후속 `2710f1d1182fd56a92f872017e17fa75e66575c9` exact private/WSL clean actual1 PASS/5399ms/skip0·독립 DB25종/시험root0·지속root 보호/empty. SQL24 재적용0, 사용자용 runtime/relay HOLD/만료 bootstrap·CA/Secret/서비스는 불변이다.

FN05 대화 서버 `13a6fad444ba0ec2ad767a1bb6ba1f7acc0b8ad9` private/WSL exact/clean에서 승인 forward24 `0005_conversations` checksum8241d4e6321d8798ecc8e78d83eae1147a3c8ff7110cdd86370cab3b73be98dc만 적용·기존23 불변. actual2 PASS/5465ms/skip0·독립 DB25종/시험root 잔류0·지속 원문 보호/empty. 저장은 STORED이고 Agent전달/실행0·사용자용 서비스/Secret 변경0이다.

UI10 동일 Web client 실제 연결 후속 `579ce2dc2da4a05f8031bded1ff00e00037696bd` private/WSL exact/clean actual1 PASS/5569ms/skip0·독립 DB23종/시험root 잔류0·지속root uid1000/0700/link0/실경로 동일/empty. SQL23 재적용0·기존 runtime/relay/Secret 불변. 실제 사용자 browser DB·전체 후보 사용 준비와 구별한다.

2026-10-16 FN05 `2b8a24227c57aa06394f21dc983de2c7849f59a1` private/WSL exact/clean에 승인된 새 forward23 `0005_knowledge_drafts` checksum42efe15b4ebe3a860364ef85d92631fcf85c71f7143738026155e5814893153a 적용·기존22 불변. actual FN03/FN04/FN05+FN11 2 PASS/5631ms·독립 DB23종/시험root 잔여0·지속root 보호/empty. UI10후속 Web73/fixture3·단위85와 실제 browser DB 여정은 별개이며 사용자용 backend/relay/초기 비밀·CA/서비스는 변경0이다.

2026-10-16 추적 서버 후속: private/WSL exact `cca0899053859ba8184535eac6645bea236e5284` clean에서 승인 forward22 `0004_trace_links`(SHA256 `31b8f7525bf8e07c4e6e13644ea97715b39e57cb9400a7fece8cbaccf1d0d51c`) 적용·기존21 지문 불변. 실제 FN03/FN04+FN11 2 PASS/4532ms/skip0·독립 DB20종/임시 경로 잔여0·지속 원문 보호/empty. 사용자용 Node/relay·초기 비밀·CA·실제 계정/정책은 변경0이며 실제 browser↔DB·전체 exact runtime은 여전히 미검증이다.

2026-10-16 UI06 계획 client 후속: private/WSL Git exact `cefa3fb9dd85caad2ac07adad7f33abac4443834` clean의 prepare/send/readWorkPlan actual1 PASS/4151ms/skip0·독립 DB19종/시험root 잔여0. 기존21 SQL 재적용0·사용자용 Node/relay·Secret 변경0. Windows Web67(JS473.43kB/gzip127.38)/단위76/UI06 fixture34 증거와 실제 browser↔DB·사용자 인수는 구분한다.

2026-10-16 FN04 후속: 지정 private Git exact `b43b26671f7b0bc5aa87d1353b4edeaf0c5ca55b` WSL clean에서 forward21 `0004_work_plan_drafts`(SHA256 `9ea544780d61cf7b5914b9db597eadba2291fb487f42a373d695f053b8e8610e`) 적용·기존20 checksum 불변. 실제 FN03/FN04+FN11 2 PASS/3818ms/skip0, 독립 DB19종·시험 경로 잔여0·지속 원문 uid1000/0700/link0/실경로 동일/empty. Node40744/relay26052·만료 bootstrap·Secret·서비스는 변경하지 않았고 actual browser DB/전체 exact runtime은 미검증이다.

## 현재 단계와 정본

FN04 저장 첫 후속 `98b3504dcf6bc2387f317a0acfcb9eb642657044` 지정 private/WSL exact clean actual FN03/FN11 2 PASS/3368ms/skip0. 승인된 forward20 `0004_design_index` checksum `d0d6ef9221a46c96c4e6f033d6a14e22cc07b26a8bcb1949d67dbb8e574aea6a` 적용·기존19 불변, fixture7/실제 사용자0. 독립 design_items/screen_regions 포함15표 각0·시험root[]·지속원문 uid1000/0700/link0/empty. 설계 추적 조회 UI는 현재 local 단위71/fixture29·Web64/type/build이며 최신 actual Web client 검수는 게시 후다. 사용자용 runtime·relay/초기 등록·CA/Secret/서비스는 변경하지 않았다.

현재 코드 `ae2c3fd5001f90af17995929aa9abfba6ec8559e` local/private·WSL exact clean actual FN03 1 PASS/3017ms/skip0. 복합 충돌 조정·검토/확정 거절 보관/명시 새 대상까지 동일 Web client와 실제 API/DB/FS로 확인했다. 독립 DB13종 각0·시험root[]·지속원문 uid1000/0700/link0/empty, SQL19·계정·권한/Secret·서비스 불변. 단위65/UI06 fixture27·Web62/type/build는 별도이며 Windows backend 혼재/relay HOLD/만료 bootstrap·CA 경계·실제 browser DB 여정 미검증은 유지한다.

보관 자료 재개 후속 코드 `4997e732f6bebfca92812cc6d7a5680dcbb71664` 지정 private/WSL exact clean의 같은 Web client FN03 actual1 PASS/2712ms/skip0. 새 schema/실제 계정/권한·Secret·서비스 변경0, SQL19 불변이다. 독립 DB13종 각0·시험root[]·지속원문 uid1000/0700/link0/empty. Windows unit61/UI06 fixture20+추가 음성2·Web61/type/build PASS는 실제 browser DB 여정이 아니다. 기존 혼재 backend/relay HOLD/만료 bootstrap/CA 경계는 유지하며 아래 이전 목록 재개 미완료 문구만 후속 전 이력으로 본다.

제안 후속 `d05c3df31f7112f0cd761ea3e771d3830d42b94c` local/private·WSL exact/clean의 동일 Web client FN03 actual1 PASS/2756ms/skip0, 서버/권한 인접은 직전9198a9bc actual2/2343ms. 새 forward19 `0003_document_proposals` checksum `93cb063a0214f2197afca309ed3d4482a0ea8bac765b9e72f42b110bdb6f542a`만 적용(기존18 불변), 제안/명시 반영/서버 diff·구버전 보존을 확인했다. Windows unit61/UI06 fixture16/13.8초·Web59/type PASS는 실제 사용자용 runtime 전환과 다르다. 기존 Node/relay·CA/bootstrap·실제 계정/Secret/서비스 변경0, 목록 재개·actual browser↔DB·Agent/Oracle는 여전히 남는다.

최종 화면 경계 보정 `73373f08ac5306e12c5f87fa84226ebd636abfb2` local/private·WSL exact/clean의 실제 FN03 1 PASS/2443ms/skip0. 기존 FN11·서버/SQL18은 바로 아래6a7a3c26 actual2 증거가 유지되므로 재적용/반복하지 않았다. 파일 준비 경합·확정 거절/결과 미확인 구분·재시도 화면 재진입은 같은 범위 독립 검토 후 보정, Windows unit59/UI06 fixture15/11.4초·최종 집중1/3.3초·Web58/type PASS. 최종 실제 시험 뒤 독립 DB11종0·시험 root[]·지속 artifacts uid1000/0700/link0/empty·migration18. 실제 사용자용 runtime 교체는 여전히0이며 아래 backend 혼재/relay HOLD/bootstrap·CA 경계는 그대로다.

2026-10-16 가져오기 후보·명시 선택 후속: 코드 `6a7a3c262bbd189448a07558066d12f5390f814f` local/private·WSL exact/clean에서 actual FN03/FN11 2 PASS/1963ms/skip0. 직접 승인된 새 forward18 `0003_document_imports` checksum `c9ffa0c09d8597e410a9b85ead5b1aad3413df82e7f6efa2169ad514fa001afb`만 추가했고 기존17 불변이다. 최초 미적용18의 CASE 문법 오류1은 전부 rollback된 별도 실패 이력이며 소급 PASS 아님. 독립 DB 사용자/프로젝트/문서/확정/후보/선택/검토/원본/정책/명령0·시험 root[]·지속 artifacts uid1000/0700/link0/empty. Windows unit58/UI06 fixture15/11.6초·Web58/타입은 별도다. Node40744/relay26052 같은 시작 시각을 확인했고 기존 backend000d0088/새 Web 혼재·relay HOLD·만료 bootstrap·CA/실제 계정/Secret/서비스는 변경하지 않았다. 최신 실제 사용자용 exact-SHA runtime·browser↔DB 여정·제안/서버 diff·후보 목록 재개·Agent/Oracle는 미완료다. forward18 자동 downgrade/삭제는 하지 않는다.

2026-10-16 별도 확정·명확한 저장 버전 충돌 조정 후속: 최종 코드 `3f4601b8a39839240aa94884d898ead1ef8d0168` local/private 동일·WSL exact clean, 같은 클라이언트의 FN03/FN11 actual2 PASS/1714ms/skip0. 승인된 새 forward17 `0003_document_confirmations` checksum `58ebdd39cddb67cbbf4fa2f21bea42848dfa7e0851297bd7592f8b3ce36e9fd5` 1개만 적용했고 기존16 불변이다. 실제 확인 후 합성 사용자/프로젝트/문서/확정/검토/원본/정책 각0·임시 root[]·지속 artifacts root uid1000/0700/link0/empty. Windows 단위56·UI06 fixture14/10.8초·최종 Web56(JS393.07kB/gzip109.63)/타입 PASS는 실제 browser↔DB 여정과 별개다. Node40744·relay26052 같은 PID/시작 시각 보존, 만료 bootstrap/CA·기존 서비스/설정/Secret 변경0. 최신 사용자용 실행환경·실제 화면 DB 통합·Agent/Oracle는 미완료이며, 아래 이전16개/확정 미연결 관측은 이력이다. SQL17은 자동 downgrade/삭제하지 않는다.

2026-10-16 UI06 내용 검토 작성/저장 연결: 최종 코드 `6ca25abf30f4595d37aebd9fc8d2c62fac14c387` local/private 동일·WSL exact/clean, actual FN03 1 PASS/860ms/skip0. 같은 클라이언트의 현재 정책/제어·고정 문서/hash→사람 검토 기록/replay·실제 1건/재조회·미확정 유지·outbox0을 확인했다. 독립 users/projects/documents/versions/reviews/artifacts/policies0·임시 root[]·원문 root uid1000/0700/link0/empty, migration16 불변. Windows unit48·UI06 fixture10/8.6초·타입/Web53 PASS는 별도이며 실제 browser↔DB는 미검증이다. 기존 Node40744의 backend000d0088/새 Web 혼재·relay26052 HOLD·만료 bootstrap·CA·계정·Secret·서비스 설정은 변경하지 않았다. 최신 사용자용 exact-SHA runtime은 아직 준비 전이며 검토/별도 확정·Agent 실행은 구분한다.

2026-10-16 UI06 신규/편집 저장 연결: WSL exact `05da735cf241f09376b094819ea5e6b003183bd7`/clean의 actual FN03 1 PASS/1024ms/skip0. 화면과 같은 클라이언트로 신규v1·개정v3/재조회·원문 BOM/CRLF·원래 텍스트 형식·같은 저장 replay를 확인했지만 실제 브라우저↔DB 통합은 아니다. migration16 불변·DB/파일 합성 잔여0/지속 원문 root0700/empty를 독립 확인했다. Windows 단위46/UI06 fixture6·Web51(JS371.33kB/gzip105.67)/타입 PASS. 현재 원래 Node40744 backend000d0088·새 Web 혼재·relay26052 HOLD·만료 초기 등록 비밀·CA는 변경하지 않았다. 계정/키·서비스 설정·신규 migration·Agent/Oracle 변경0, 사용자용 최신 exact-SHA runtime 준비는 미완료다.

2026-10-16 후속 문서 내용검토: exact `7a7841a12c6f20f7c4a991be0d34be8d469eae54`에서 actual3 PASS/skip0(FN03·FN11·인접 공통 METHOD). 새 forward16 `0003_project_document_reviews` checksum `f1ba53b79b95a02867822743748ead6f6dafff039a506651a26368d7b922de75`만 추가, 이전15개 불변. 현재 개발 DB 총16개다. 새 역할/계정·Secret/서비스 설정·원문 root·relay/CA 변경0이며 검토 기록을 확정/제품 인수로 세지 않는다.

2026-10-16 FN11·FN03 직접 보완 승인과 신규 원문 위치 승인을 적용했다. WSL exact `dc42b29c4d24d24dc4f6f8f1737ac289023ae09c`/clean의 자료 정책·원문 보존/불변 문서 버전·목록 actual2 PASS/skip0. migration15개(정책13·원문14·문서15), 기존 SQL 불변. 원문14 checksum `78a0457fda6c394605ca46a7b6aec761aec6de0a84f47450b9cda326dac9ccd8`, 문서15 `748e8f07ffa2b1093e1141504e8a5134332518a9bf56ec04584e59e84e7a4292`. 독립 DB 조회에서 합성 프로젝트/문서/원본/정책·해당 사용자0, 임시 시험 root0. 새 지속 `/home/daon/.local/share/anvil-v3-development/artifacts`는 daon(uid1000)0700/link0/empty로 만들고 보존한다. 서버가 소비하는 선택 설정은 `ANVIL_ARTIFACT_ROOT`이며 실제 서비스 설정/재시작은 아직 하지 않았다. Windows Web48·unit43·UI06 fixture2는 실제 화면 DB 연동과 구분한다. 기존 Node40744의 backend000d0088·relay26052/재접속 HOLD·만료 bootstrap·CA·계정·Secret·기존 서비스는 변경하지 않았다. 사용자용 새 런타임 준비나 전체 기능 완료가 아니다. 아래 과거 관측은 삭제하지 않고 이력으로 유지한다.

2026-10-16 최신 직접 ‘승인해 계속하자’로 DRAFT/PROJECT 경계를 해소했다. WSL Git exact `ef88dfd965cedc97ee42e0545d0a79f40009b2c8`/clean의 최초 생성·검토·확정·고정 snapshot·감사 실패 rollback 및 인접 실제4 PASS/skip0. 새 `0011_project_creation` SHA256 `0ad0e1e9d429afe65014492d1cb07e629df56c081d3643233c3f32ba5ff3fb95`와 `0011_draft_method_reviews` SHA256 `a7aad194c8dff3a29ec502f1e94b0e4728bb5c087aba02390f11a75c3765efaf`만 추가해12개, 이전10개 불변. 독립 QA 조회에서 고유 생성 사용자/초안 검토·확정/프로젝트 잔여0을 확인했다. Windows unit43·UI02/03 fixture23·마지막 핵심2·Web46(JS344.96kB/gzip98.72)·타입은 별도 증거다. Node40744/원래 KST05:25:42 backend000d0088·relay26052를 교체/재접속하지 않았고 실제 사용자/Secret·expired bootstrap·CA·서비스 변경0이므로 actual UI DB 제품 준비/인수 PASS는 아니다. 이전 blocked·10개 SQL 관측은 당시 이력이다.

2026-10-16 방법론 목록 페이지 관측: WSL exact `b7d64b894a49876c77f30ff88729bfcd5169e85d`/clean의 실제 본인 확정 상태 필터1 PASS/465ms, 선행 `7eda0b69`에서 내장3종 페이지·변조/조건/격리1 PASS/339ms. 기존10개 SQL/권한 변경0·QA 정리. Windows unit42·UI02/03 합성20 및 검색/페이지 핵심2 PASS, Web45(JS333.32kB/gzip96.34). 새 실제 UI DB 통합/제품 인수는 미검증이다. 현재 DRAFT/PROJECT 보완 승인 경계로 goal blocked를 기록하며 소유 서비스/relay·Secret·CA·실제 계정/Agent는 변경하지 않는다.
2026-10-16 프로젝트 전용 초안 후속 관측: WSL Git exact `72cd43affe6a738a342df3a3ca0e2e79b2e5c7de`/clean에서 기존10개 SQL/DB 권한 그대로 실제1 PASS/486ms/skip0, 직접 작성2단계·음수/양수 좌표·조건/원본 ref 저장·GET 재조회 및 잘못된 실행 속성422·고유 QA 정리 확인. Windows Web45모듈(JS330.19kB/gzip95.49)·타입/단위41·UI02 합성7 PASS는 별도 증거다. backend000d0088·relay hold·인증서/초기 비밀 경계 불변, actual 새 UI DB 통합은 미검증. DRAFT/PROJECT 새 권한 보완은 승인 응답 전0.
2026-10-16 방법론 검토/초안 선택 최신 관측: WSL exact `29d70cf0795d8593b8f6e7951e43bf7eab4e2424` actual1 PASS/455ms·정확 합성 QA 정리. 새 `0011_user_common_method_reviews` checksum `9e480e3bd4da152befdbb2bca8a2f5e1b3cdf0ed43336c5b210090f7ff02fea2`를 포함해 적용10개이며 이전9개 불변. Windows44모듈 Web build/단위41·UI03 fixture12/UI02 fixture5와 실제 API/DB는 분리한다. 소유 Node40744의 원래 시작UTC2026-10-15T20:25:42.3705853Z·backend000d0088은 교체하지 않았고 Web만 새 빌드다. 전체 exact-SHA runtime/actual UI DB 여정은 미검증. 초기 비밀 만료·CA7일·relay26052 hold 유지, 재접속/실제 사용자/Secret/Agent/Oracle 변경0. 다음 DRAFT/PROJECT 권한 보완은 USER_COMMON 승인과 별도 경계로 기록했다.
2026-10-16 본인 공통 검토 최신 관측: WSL exact `34805ebedd2781eb23119d6d79648b1ecc585e8f` 실제 양식 검토/확정/새 개정·최신 보완/위조 증거 거절1 PASS·정확 QA 정리. 추가 migration `0011_user_common_content_reviews` checksum `0009cfe2c02b92a4e930d538ce5c0c5d67215c6d89aca6c1a4345868ccbc4f01`, 이전8개 SQL/checksum 불변. Windows Web37/단위41·인접 UI03 fixture9 증거와 실제 API/DB는 분리한다. Node40744 backend000d0088·relay26052/5546·bootstrap 만료·CA7일 경계는 변경하지 않았고 새 사용자 인수/실제 UI DB 여정/Agent/Oracle는 미검증이다.

2026-10-16 본인 공통 자료 최신 관측: 직접 승인 범위의 `0011_user_common_control`을 forward 적용(checksum `ea3043a71f4d1557bf9620ac06f88274ed7227629fe2b1bfab00e7409d16563c`), 기존6개 checksum 불변. WSL exact `0f072bb93f1a454432f8e97e3ca7a574eca1320b`의 실제 복사/개정·owner/client·멱등/감사1 PASS·합성 QA 정리. 기존 잘못된 정리 순환 FK 실패1은 정확 QA만 보정/정리했다. 코드/양식/방법론 v1 보존. Windows UI03 fixture7 PASS/4.6초·unit39·Web34모듈 통과, Node backend는000d0088 그대로이므로 actual UI/DB E2E 아님. Windows relay timeout3회 중단·초기 비밀 만료/자동 재발급0 유지. 실제 Agent/Oracle 미실행.

2026-10-16 방법론 후속 관측: WSL exact `7590d3584fb4971b67f1c4d6fd7aace749a37504`/clean, 계획0002 적용·내장3종 실제 저장/조회·소유 격리1 PASS. checksum `0453854b9925f5ff2eeed15babfb5dda8446fbb751b3e7caf0378a98d6dbcd34`, 기존0000/0001/0011/0003 불변. Windows Web32·방법론/양식 fixture4 PASS, Node backend는 이전 소스이므로 새 실제 UI/DB 통합 PASS 아님. 사용자 공통 쓰기 계약 보완은 별도 승인 응답 전 적용0.

2026-10-16 최신 catalog 관측: WSL Git exact `148684772ca863cc99dee5c359148b4aa1f58669`/clean에서0003 catalog를 적용하고 실제 API/DB1 PASS, app 읽기 전용·QA 사용자/양식 정리를 확인했다. 기존0000/0001/0011 SQL/checksum 불변. Windows Web은30모듈 신규 양식 조회 빌드·fixture Edge2 및 공통 탐색 포함7 PASS이나 Node40744 backend는000d008 당시 소스이며 전체 exact-SHA runtime이 아니다. 실제 Windows DB relay 접속/새 키/초기 비밀 재발급0.

2026-10-16 후속 관측: WSL Git exact5a88d5eb에서 auth/허가 프로젝트 조회·초안 저장을 실제 DB/HTTP로 확인했다. migration0000/0001/0011 적용, checksum은 WORK_STATUS. Windows 실제 DB relay timeout 누적3회로 그 경로를 중단했고 새 브라우저 검수는 모든 API fixture 격리다. Windows Node40744는 시작 당시000d008 backend를 계속 보유하며, 개발 Web dist는 후속 UI 빌드로 바뀌었다. 따라서 이를 현재 branch 전체 exact-SHA runtime/제품 ready라고 보고하지 않는다. 기존 초기화1/실제 사용자0·승인 key/CA는 보존, bootstrap은30분 기한이며 자동 재발급하지 않는다.

2026-10-16 현재 사실 갱신: Stage A는 PR41/main `f976ed5e` 통합·smoke·정리 완료, Stage B `codex/av3-stage-b`에서 UI00/FN01을 구현 중이다. 아래 초기 설계/정리 기록은 당시 관측이며 현재 구현 상태를 대신하지 않는다. 전용 WSL checkout은 `/home/daon/deploy/anvil-v3`/Git exact `246007f2`, PG `anvil-v3-development-pg`의 DB `anvil_v3_development`와 app 역할·loopback5546을 사용한다. 0000/0001 적용, 이후 migration은 별도 계약/승인 대조 후 forward-only다.

신규 인증 참조는 직접 승인 `call_74c28acfc6424f6fb3e31ef55262a333`로 `D:\Project\Anvil\.av3-data\auth.json`(서버 key/설치ID)·`bootstrap.json`(30분 일회 초기 등록 비밀)을 배타 생성했다. 파일/키 원문을 Git·로그·보고서에 넣지 않는다. root/파일은 current user/SYSTEM만 접근, 실제 소유자는 자동 생성하지 않았다. 최초 등록 기한은 KST 2026-10-16 05:51:14.749이며 만료를 자동 연장하지 않는다. 생성 도구는 기존 파일/계정/초기화행이 있으면 실패하고 `--check`는 읽기 전용이다. 정상 launcher는 auth.json을 선택적으로 서버에 전달한다. 현재 소유 Node3830은 실행 전이며 공유 wslrelay26052/5546은 변경·종료 금지다. 후속 실제 실행 때 receipt로 갱신한다.

현재는 상세 설계 r8·작업계획 r7에 검토 보완을 본문 통합하고 P02 상세 계약을 작성하는 단계다. 작업계획 r3 승인·P01 시안/양식 승인·TD-01 A안·TD-02 Anvil 전용 로그인 설계 선택을 유지하되 P02/P03 선행과 실제 실행 승인 경계는 별도로 대조한다. TD-02는 설계 선택이며 실제 사용자·DB·Secret·인증서 변경이 아니다. 제품 구현과 신규 배포는 시작하지 않았다. 새 작업의 기준은 AGENTS.md, docs/design/Anvil_설계서_v3_초안.md, docs/design/Anvil_v3_인터뷰_합의사항.md, docs/design/문서작성_공통기준.md, docs/WORK_PLAN.md와 연결된 업무 카드, docs/WORK_STATUS.md다. 예전 개발환경 문서와 실행 도구는 Backup/Anvil/legacy-20261015-1420에 보관했다.

## 합의한 제품 배치

- Anvil 서버: 현재 사용자 환경에서는 WSL-server. 헌법·지식·문서·지시·진행·결과의 원본을 관리한다.
- Agent 실행기: Windows PC. 지원되는 로컬 도구를 실행하고 중요한 기록과 결과를 Anvil로 회수한다.
- 사용자 화면: Windows 설치형·PC 브라우저·모바일 웹. 준비된 인터넷/VPN 경로와 인증·권한이 있을 때 원격 사용한다.

이 배치는 신규 제품 설계 방향이며 구현·배포 확인 기록이 아니다. 계정·토큰·Secret 원문을 문서나 Git에 기록하지 않는다.

## 기존 코딩 Agent 설치·사용 가능 정보

2026-10-15 신산님 직접 제공. 사용자 확인과 Anvil 실제 연동 검증을 구분한다.

| 도구 | 설치·사용 위치 | 현재 확인 근거 | 아직 확인하지 않은 것 |
|---|---|---|---|
| Codex | Windows PC | 신산님 사용 가능 확인. 직전 PATH 읽기에서 codex 명령 발견 | Anvil의 공식 지시/관측/결과/중지/승인 연동 |
| Claude Code | Windows PC | 신산님 사용 가능 확인. 직전 PATH 읽기에서 claude 명령 발견 | Anvil의 공식 지시/관측/결과/중지/승인 연동 |
| Hermes | ysna-server | 신산님이 설치 위치 제공 | 제품/버전·실행 형태·사용 상태·공식 연동 기능 |
| OpenCode | WSL | 신산님이 설치 위치 제공 | 정확한 WSL 배포판/호스트·제품/버전·사용 상태·공식 연동 기능 |

위 정보로 새 설치를 먼저 요구하지 않는다. P02는 기존 도구의 실제 지원과 연결 방식을 조사해 첫/둘째 연동 대상을 정한다. 설치됐다는 사실이 Anvil 연결 완료·작업 실행 승인·4종 어댑터 구현 확정을 의미하지 않는다. 특히 ‘WSL’을 WSL-server와 같다고 단정하지 않으며, ysna-server의 Hermes 실행/설정 변경이나 운영 서비스 접근으로 범위를 확대하지 않는다. 원격 설치 Agent의 실제 실행 지원은 기존 설계 범위와 영향 대조 후 필요 시 별도 결정한다.

## 기존 환경 정리 결과

- WSL-server의 /home/daon/deploy/anvil은 전체 로컬 백업·대조 후 삭제했다. /home/daon/despoy/anvil은 처음부터 없었다.
- /srv/anvil-wsl 및 기존 Anvil API/Web/OIDC 컨테이너, DB, 인증서·Secret·공유 네트워크는 이번 폴더 정리에 포함하지 않았다. 기존 화면은 새 설계의 구현 증거가 아니다.
- Git 목표는 sinsan-develop/Anvil, 저장소 ID1356865616을 그대로 유지하면서 현재 파일만 비우는 것이다. 저장소 자체 삭제는 담당자 오해였으며 실제 시도는 HTTP403으로 실패했다. 삭제 권한 추가 인증은 필요 없고 진행하지 않는다. 재생성·강제 초기화·다른 원격 push는 하지 않는다.
- 파일 정리 반영 완료: PR40 merge 뒤 main b4f9006e30e5afcf98ef8ef1f39707ecc8954feb, tree 4b825dc642cb6eb9a060e54bf8d69288fbee4904로 현재 파일0개다. Git fetch·ls-tree·기존 main ancestry와 저장소 ID 불변을 확인했다. 이력과 로컬 백업은 보존하며 새 설계 자료는 아직 원격에 올리지 않았다.
- 기존 cyhuh7950/anvil 등 다른 GitHub 저장소는 정리 대상이 아니다. 기존 로컬 Git 메타데이터는 복구·참조용으로 유지하며 현재 원격 설정으로 임의 push하지 않는다.
- 로컬 보관 위치: D:\Project\Anvil\Backup\Anvil\legacy-20261015-1420. WSL 전체 압축·원격 mirror·로컬 bundle·메타데이터·기존 파일을 보관한다.
- 접근 제한된 기존 .pytest_cache 1항목은 남아 있으며 ACL 변경·강제 삭제를 하지 않았다.

신규 port·패키지·DB 스키마·인증 방식·배포 절차는 상세 설계와 새 계획 이후 확정한다. 과거 compose나 배포 도구를 새 환경에 그대로 실행하지 않는다.

## P03 준비 범위 — 실행 승인·생성 전 관측 이력

2026-10-16 P02 종료 대조와 다음 승인 경계를 준비한 읽기 결과다. 신산님은 질문 `call_f2cd20981cc64d83aceff512225037b5`에 **‘새 Stage A 기준선·private push 승인’ / ‘새 전용 개발 자원 준비 승인’ / ‘개발 인증서 생성·현재 사용자 신뢰 승인’**으로 아래 세 범위를 직접 승인했다. 승인은 실행 결과가 아니며 P02 검수 뒤 정확 대상·생성 직전 상태를 확인한다. 실제 유료 Agent 호출·기존 서비스 교체·Oracle는 제외한다.

- 지정 development 원격의 현재 main은 실제 `git ls-remote`에서 `b4f9006e30e5afcf98ef8ef1f39707ecc8954feb`였다. 로컬 development/main은 `0443043251d25aa77c17d23165b7c9299c8dbeb8`로 오래됐으므로 그 로컬 ref를 최신으로 쓰지 않는다. 원격 수정/소스 전송0. sandbox의 MSYS SSH 오류와 WSL 접근 거부는 승인된 외부 읽기 실행 exit0 결과와 구별한다.
- WSL의 현재 container 이름/이미지/port를 읽었다. 공유 DB/다른 프로젝트·기존 서비스는 제외한다. Windows/WSL의 후보3830·5546 listener는 확인 시점0이었다. 프로세스/서비스 변경0, 생성 직전 점유/부모 realpath·소유/링크·동명 자원을 다시 대조한다.
- 로컬 `.av3-data`, `Backup/Anvil/v3-development`, `D:\tmp\anvil-v3-stage-a`는 확인 시점 존재하지 않았다. 실제 만들지 않았다. 임의 전체 디렉터리 정리/기존 Backup/자료 변경은 하지 않는다.

### Git 기준선 제안

현재 `codex/anvil-public-ui-preview`의 legacy 기준 HEAD/기존852삭제·3수정·미추적 자료는 그대로 보존한다. 기존 branch 종료 전 새 branch 예외를 위 직접 승인으로 결박한다. 최신 지정 private main에서 `codex/av3-stage-a`를 시작하고, 기존 이력을 reset/rebase/force하거나 다른 origin 저장소로 올리지 않는다.

제안 private payload는 [정확 파일 목록](contracts/STAGE_A_PAYLOAD_MANIFEST.json)의 관측51파일·7,653,332byte다. v3 정본/계약·승인/검토·상태·시안/이력이며 사용자 제공 최신 검토 Word1개도 포함한다. Backup/legacy 제품 소스/다른 프로젝트/Secret/계정/인증서/DB/스풀은 제외한다. 이후 P02 검수 기록/P03 실행 문서·승인 범위에서 새로 작성하는 v3 코드/테스트/lockfile은 exact commit 목록으로 추가 대조한다. 아직 commit/push하지 않았다. 목적은 새 개발 기준선/복구와 Git exact SHA WSL QA이며 private 저장소 일반 Git 이력으로 보존한다.

### 신규 개발 자원 — 승인된 이름·생성 전 상태

| 자원 | 대상/목적·수명·정리 |
|---|---|
| 공통 제품 port | 로컬/WSL/향후 승인 Oracle의3830을 제안. 현재는 신규 로컬/WSL 개발만, Oracle 실제 이전0. 브라우저는 HTTPS same-origin `/api/v1`, 내부 DB 주소 노출0 |
| WSL Git 경로 | `/home/daon/deploy/anvil-v3` 제안. Git의 승인 branch/exact SHA만 사용, 기존 삭제한 anvil 경로/공유 서비스를 복원/교체하지 않음. 부모/실경로·소유/부재 검증 후 생성 |
| WSL 격리 DB | 새 container `anvil-v3-development-pg`, volume `anvil-v3-development-pgdata`, network `anvil-v3-development`, DB `anvil_v3_development`, 전용 migration/app 역할. PostgreSQL15의 정확 이미지/digest 검토 뒤 사용. host DB port는 loopback5546만·공유 local-postgres/DB/권한 변경0 |
| WSL 새 server | 필요할 때 `anvil-v3-development-server`, 같은 새 network·3830만. Node24 정확 이미지/commit·migration과 합성 QA 자료로 개발 검증. 기존 API/Web/인증서·proxy 교체0 |
| 로컬 DB 연결 | 필요한 개발 process의 전용 SSH tunnel loopback5546→WSL loopback5546. 시작 전 충돌/실소유 확인, 프로젝트 사용 종료 시 정확 소유 process만 종료. 브라우저가 DB/tunnel을 직접 호출하지 않음 |
| 보호 자료 | 신규 로컬 `.av3-data`와 WSL `/home/daon/.local/share/anvil-v3-development`. 합성 QA owner·DB role·session/등록 검증용 Secret은 Git/로그/문서에 원문0, 기존 사용자/계정/키·ACL 변경0. 새 파일의 최소 접근/소유만 설정 |
| 백업/임시 QA | 새로운 `Backup/Anvil/v3-development` 수동 검증 보관·자동 삭제 OFF, 일회성 도구/fixture는 `D:\tmp\anvil-v3-stage-a`의 정확 Task 하위에 등록 후 사용/실패 즉시 정리/잔여 확인. 기존 legacy Backup 보존 |

정식 개발 DB/자료는 Stage B 이후에도 사용할 새 자원이므로 작은 검사 종료마다 volume을 삭제하지 않는다. 별도 QA 일회성 DB/container/경로는 먼저 이름/소유/수명/정리를 기록하고 종료 때 exact 자원만 제거한다. 실제 사용자 자료/운영 복제 없이 식별 가능한 합성 QA project/owner/viewer·멱등 seed/reset만 사용한다.

### 개발 HTTPS의 별도 신뢰 경계 제안

새 Anvil 개발 전용 CA/leaf 파일(대상 localhost/127.0.0.1/현재 WSL 개발주소)만 보호 경로에 생성하는 안이다. 기본 제안은 CA 유효7일·개발 leaf7일, 코드/Git에 키 원문0·기존 인증서/OS machine store 변경0이다. 일반 브라우저의 실제 로그인/CSRF를 확인하려면 신뢰 설정이 필요하며 포괄 TLS 무시/보안 flag 완화로 통과시키지 않는다.

CurrentUser Root 신뢰 저장소에 새 CA의 정확 thumbprint1개를 넣는 것은 다른 HTTPS에도 영향을 줄 수 있는 별도 보안 변경이며 위 직접 승인 대상이다. 생성 결과·subject/SAN/유효기간/hash·private key 보호를 확인하고 정확한 새 thumbprint만 추가하며, 검증 종료/만료 때 그 항목만 회수한다. LocalMachine/기존 root·인증서·VPN/공유 proxy는 건드리지 않는다. 실제 생성·추가·회수 증거는 별도 기록하고 승인만으로 브라우저 검증을 통과 처리하지 않는다.

### P03 실제 확인 — 자원 생성과 구분

- 로컬 Node24.18.0/npm11.12.1, WSL 기존 Node24.21.0을 각각 읽었다. 같은 버전이라고 보고하지 않는다. 제품 engines는 Node24.18 이상/25 미만이며 정확 lockfile을 사용한다.
- 기존 공식 PG15.18 이미지 ID `sha256:594290e91b09c09728ed945ff89db65cd0fafff251f7c03c3d99c00ae5d9442f`, digest `postgres@sha256:6eb0add3b77c081df18aa518ce43df58fdcc40f2e6d868a6fd08038dc7acd425`; 실제 `postgres --version`은15.18이었다. 전용 DB 실행은 아직 전이다.
- Node24.18.0-bookworm-slim 후보 ID `sha256:2f35c3d18013b7d65e31c40f0602e4c0a65a18efc65c16e2b98497f13f4da921`, digest `node@sha256:6f7b03f7c2c8e2e784dcf9295400527b9b1270fd37b7e9a7285cf83b6951452d`를 관측했다. 실제 사용 시 exact image와 별도 결박한다.
- 개발 CA subject `CN=Anvil v3 Development CA`, thumbprint `498348218A4015B341A90B10FF4FE176987D4424`, leaf `047CD961EB4B376350A1119C46185FB6D8721F14`; SAN localhost/127.0.0.1/172.27.253.53, 만료2026-10-23 03:29:02 KST. 신산님 OS 확인 뒤 허용된 실제 Root 조회에서 정확1개를 확인했다. sandbox 조회0과 실제 store 결과를 구별한다. 새 보호 root ACL 상속 차단·현 사용자/SYSTEM만, 키 파일은 그 제한을 상속한다. 기존 key/Root/LocalMachine 변경0, 아직 HTTPS 브라우저 PASS 아님.
- 신규 개발 DB 역할은 `anvil_v3_bootstrap`(새 컨테이너 초기화만), `anvil_v3_migrator`(신규 schema migration), `anvil_v3_app`(비관리자 DML)로 한정한다. 보호 파일은 위 WSL 경로의 bootstrap-password/migrator.json/app.json이며 stdout/Git 원문0. 기본 생성은 기존 자원/경로 발견·조회 오류 때 중단하고 새 instance label/ID/image를 다시 검증한다.

### P03 현재 실제 상태 — 2026-10-16

위 생성 전 문장들은 당시 관측이며 현재 상태는 이 절과 [P03 결과](04_test_reports/AV3/P03/RESULT.md)가 우선한다.

- branch `codex/av3-stage-a`의 코드0ec17f1a는 private 게시 완료, base main b4f9006e는 Stage A 통합 전이다. 초기51파일과89파일 checkpoint의 hash/상태는 당시 관측이다. 현재 내용은 BASELINE_MANIFEST, 실제 실행 commit은 RESULT를 구별해 조회한다.
- WSL exact892ea1e1에서 신규 PG15.18/volume/network·DB/전용 역할 생성, migration0000·합성 fixture7 및 실제 비관리자 저장/다른 연결 조회·DDL거절·고유 probe 정리0 PASS. 기존 DB/공유 인증/운영 서비스에 대한 변경 명령0이다. 새 제품 로그인 사용자/프로젝트는 아직 없다.
- 보호 WSL 설정0700/0600·daon 소유, 로컬 `.av3-data`는 현재 사용자/SYSTEM만. 새 app 설정 참조만 Windows에 전달했으며 값 출력/소스 포함0이다. 실제 PG ID/image/digest/instance·migration checksum은 RESULT에 기록했다. 정식 개발 DB/volume/참조는 다음 개발에도 보존한다.
- 로컬은 검증된 기존 Microsoft WSL relay127.0.0.1:5546을 명시 재사용한다. 공유 PID26052는 종료/교체하지 않는다. 새 SSH tunnel0, `start-development.ps1 -UseVerifiedWslRelay`는 승인 DB/role를 실제 조회한 뒤만 사용한다. 기존 relay 자체 소유권을 Anvil로 주장하지 않는다.
- 소유 Node52852·시작UTC2026-10-15T19:08:42.2263733Z·코드0ec17f1a의 준비 URL은 **https://localhost:3830/**. Root 정확 CA1·기한과 Node CA검증2초 HTTPS probe를 확인했다. Edge155/Playwright1.64.1 실제1 PASS, Network3/off-origin0/JS오류0/TLSignorefalse. 이것은 준비 화면만이며 UI00/로그인/프로젝트 구현 증거가 아니다.
- 전환 시 `.av3-data/runtime/receipt.json`의 kind·commit·PID/start/exe·3830을 다시 대조해 해당 소유 Node만 중지한다. 다른 Node나 wslrelay를 일괄 종료하지 않는다. 인증서는 후속 HTTPS 개발 검수 동안만 유지하고 2026-10-23 03:29:02 KST 또는 검수 종료 때 지문498348218A4015B341A90B10FF4FE176987D4424의 CurrentUser Root1개만 회수한다.
- 임시 Windows npm-cache/P03-browser·WSL 등록 npm-cache 정리/부재 확인0, QA Edge0·DB probe0. 새 개발 DB/volume/보호 설정·CA·현재 소유 개발 Node는 보존 대상이다. 기존 .pytest_cache ACL 문제는 별도 보존하며 재실행/권한 변경0이다.
- 불변 소스의 기존 DB/브라우저 증거는 재사용한다. Stage A 통합 전 unit13·typecheck·Web14·schema 생성 일치·diff check를 fresh exit0 확인했다. 실제 Agent/제품 기능/Oracle·전체 회귀는 미실행이며 해당 UI/FN/IX에서 검증한다.
