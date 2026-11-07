# FN03 저장 문서 본문 원본 다운로드 연결

기준 codex/av3-stage-b b9672277f25dd215562735039abb94144cd5fda2. 기존 FN03/UI06·보호 GET files 계약(INTERFACES541)의 본문 다운로드 소비 누락을 연결한다. FN16 전체 반출/백업/복원 구현으로 올리지 않는다. 기존본문 reader는 고정 ArtifactRef/bytes/hash를 검증하고 첨부 링크는 보호GET을 소비하지만 저장본문링크는없다. Main ruling: 동일계약소비화면연결, 새API/권한·데이터계약/Blob변환/다운로드서비스0.

## 단일 writer 허용 2경로

1. apps/web/src/features/design-trace/DocumentsPage.tsx — 확인된 선택 저장 버전의 content.body.artifactId로 같은origin 보호GET 링크/명확한 원본 다운로드 이름을 제공한다. 기존첨부와같은 artifact-UUID.bin 명명·서버응답소비, preview/body문자열을다시인코딩하지않는다. 기존페이지재작성/공통화/기존정상동작변경0.
2. tests/browser/UI06/document-read.spec.ts — 기존기대/원검수보존+새본문다운로드검수. 새QA exactroot 전용 env/loader는이spec안에만추가한다. 옛fixtureenv/옛하드코딩TEMP는신규env에적용하지않는다. sharedbundlehelper/기존config/다른spec수정0.

## 보호 경계

확인된 고정 버전의 id/version/hash/bodyref만사용, 읽기대기/무결성오류/목록오류/선택전환·stage변경/주체·project/client/ApiClient·transport교체/unmount·늦은결과에는이전링크를숨긴다. 링크전용scope만최소결박하고다른기존view의계약을암묵수정하지않는다. actor/context ABA로옛링크가되살아나지않는다. 자동다운로드/원문변형/POST/제어·승인/정책변경0. actual 다운로드GET의인증/격리·bytes/hash는기존서버가재검사하며UI표시가다운로드허가가아니다.

## TDD·검수 순서

- 실제rg경로/기준hash/PMO AGENTS·프로젝트v3/계획·설계·환경확인, 보호untracked8/다른writer범위보존. impeccable기존스타일/craft-floor적용·새인터뷰/테마/메뉴0.
- 먼저spec의신규고정본문링크반례를작성하고제품변경전freeze를Main에게알린다. Main이사전등록된30분일회QA에서현재제품링크부재RED를확인한뒤동일writer최소구현을이어간다. 이TDD순서대기는사용자/PMO승인대기가아니고Main실행중에도독립작업은계속한다.
- v1/v2 서로다른bodyartifact와bytes: 선택ref/href/파일명·자동추가GET/POST0, 읽기대기/원문hash오류·선택/주체변경·늦은응답때oldlink0. 기존Appfixture소비, pageerror/offorigin0·원문script실행0.
- 가능하면 같은 사전등록합성route가 Content-Disposition attachment와정확바이트를응답하도록하여실제Edge download event/파일byte동일·SHA/BOM/CRLF보존을검수한다. 실제보호서버검수와구분한다. 실제TLSlistener/인증서생성/기존만료인증서재사용/서비스실행0. routefulfill로실다운로드가불가능하면실패원문을보존하고Main에정확한경계보고, 임의TLS우회0.
- typecheck/diff와직접영향만, 완료기존첨부/전체문서회귀반복0. QA Main사전등록전생성/실행0. 새SQL/DB/정책/Secret/서비스/Agent/외부송신0.
- 구현담당은변경전후이유/정확명령·종료코드·hash/미검증/오류횟수·writer해제보고, Main독립검수/실제선택DOM·정확원본download·등록자원정리0/commit·privatepush통합.

완료표시는source+합성핵심에한정한다. 정식서비스·실DB·본문서버인증/다운로드/사용자인수·전체FN16은미검증/미완료다. rollback은소유source checkpoint정상revert, 실제원문/자료변경0.
