import type {TraceRef} from './trace-api.ts';
/** 같은 추적 원문 참조만 같은 표시 항목으로 취급한다. */
export function traceReferenceKey(reference:TraceRef):string {
 return JSON.stringify([reference.kind,reference.id,reference.versionRef.id,reference.versionRef.version,reference.versionRef.contentHash,reference.localCode??null,reference.anchor??null]);
}
