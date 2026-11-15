# P03 R3 수거 ref·새 실행창 한정 보완 후보

상태: DRAFT/실행0. 기존직접승인 anvil-r3-sdk-539e7e7fbe7c4d22805103692a80af6e의제한복제1회는진입/소진0이며현재STOP이다. 이문서만으로재개하지않는다.

## 필요한 두 변경

1. 원실행안 P03_R3_ONCE_EXECUTION_PROPOSAL_20261031.md(SHA40A7A65B2BFDF12CAD70EBEE65FAF6A2286905C60CC262A349ED721E913A2B6F) 준비템플릿의 `clone --no-checkout --single-branch --branch codex/av3-stage-b` 수거인자한곳만 `--branch main`으로대체한다. 이후기존 `checkout -B codex/av3-stage-b 8d200333239f1bd7a7e8b6736a1492eb482e2de2` 및원remote·clean·고정두파일지문을그대로검산한다. clone할main HEAD를실행소스로대체하지않는다. 원격옛브랜치생성/복원/force0. main수거는고정8d이후이력/객체도내려받으므로준비시간·로컬디스크사용량이원안과달라질수있다. main에고정commit이없거나검산불일치면중단한다.
2. 기존창의진입최후07:18:13UTC를지났으므로새명시승인수신시각부터최대30분의창을허용하는결정이필요하다. 기존창을자동연장/재사용하지않는다. 실제진입시원total600초잔여를그대로요구한다. 새승인/시도식별자를별도로결박하며원R2/READ2~4/이전R3관측기록은보존한다. SDK조회1회는이미완료·소진됐으므로새창에포함하지않는다.

## 유지하는 효과·경계

고정source8d200333·원controller/shellSHA/고정Node·기존대상6/원volume RO·신규사본volume1/helper3·한도와위험4/성공·부분사본보존·정상소유helper회수·독립종료확인을유지한다. PG기동/SQL/정식전환/기존DB·키·서비스변경/Agent0. 불명시자동재시도·삭제0. 기존새대상6이예상외존재하면사용/삭제/경로대체없이중단한다.

## 현재 근거

b9b52b는원수거ref광고0/exit2로clone전STOP·새자원/소진0. 독립af1c13에서고정6대상ABSENT/원identity·consumer0확인. 고정source가localmainancestor이고controller는원격trackingref/refspec일치조건없이최종로컬branch/commit/remote/clean/두원문을검산함을Main/독립읽기로확인했다. 이사실이수거대상변경승인을자동으로주지는않는다.

Main은승인전옛수거branch의현재성을대조하지못한준비누락을인정한다. 이보완의승인과현장preflight가없으면복제를실행하지않으며해당복제/P03환경복구는미완료다.
