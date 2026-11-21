/** 통합 TC01 first-party 비실행 근거에만 쓰는 원 정본 경로. 정규화/별칭/IO 없음. */
export function isTc01OfficialEvidencePath(value:unknown):value is string {
 return value==='docs/design/공식산출물_양식정의.md'
  ||value==='docs/design/문서작성_공통기준.md'
  ||value==='docs/design/기본방법론_상세검토안.md';
}
