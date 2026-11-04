/** IX01 원장 집합 검산. SQL 적용 순서의 증거는 별도 실행 영수증이다. */
interface LedgerRow {id:string;checksum:string}
function validRows(value:unknown):value is LedgerRow[]{
 return Array.isArray(value)&&value.length===105&&value.every(row=>row!==null&&typeof row==='object'&&!Array.isArray(row)&&Object.keys(row).sort().join('|')==='checksum|id'&&typeof row.id==='string'&&/^[a-z0-9_]+$/.test(row.id)&&typeof row.checksum==='string'&&/^[0-9a-f]{64}$/.test(row.checksum))&&new Set(value.map(row=>row.id)).size===105;
}
export function assertJourneyLedgerProjection(actual:unknown,expected:unknown):true{
 if(!validRows(actual)||!validRows(expected))throw new Error('IX01_LEDGER_PROJECTION_INVALID');
 const order=(a:LedgerRow,b:LedgerRow)=>a.id<b.id?-1:a.id>b.id?1:0;
 const got=[...actual].sort(order),want=[...expected].sort(order);
 if(got.some((row,index)=>row.id!==want[index]!.id||row.checksum!==want[index]!.checksum))throw new Error('IX01_LEDGER_PROJECTION_INVALID');
 return true;
}
