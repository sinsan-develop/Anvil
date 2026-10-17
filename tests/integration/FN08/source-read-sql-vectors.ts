import type{Client}from'pg';import{canonicalJson,contentHash}from'../../../contracts/canonical.ts';
/** 승인된 새 빈 A-3 PG용 준비 경로. import/기본 시험에서 접속·SQL 적용·실행하지 않는다. */
export async function runSourceReadSqlVectors(db:Pick<Client,'query'>){
 const target=(await db.query("SELECT current_database() database,current_user role,current_setting('server_version_num')::int version")).rows[0];
 if(target?.database!=='anvil_v3_a3_read_qa'||!['anvil_v3_app','anvil_v3_migrator'].includes(target?.role)||target?.version<150000||target?.version>=160000)throw Error('A3_ISOLATED_TARGET_REQUIRED');
 const migrations=(await db.query('SELECT id FROM anvil.schema_migrations ORDER BY id')).rows;
 if(migrations.length!==46||!migrations.some(r=>r.id==='0008_source_read_observation'))throw Error('A3_MIGRATION_NOT_READY');
 const cases:string[]=[];
 for(const value of [null,true,false,0,9007199254740991,'한글 😀\r\n"\\',{z:['é',null,true,17],a:'줄\r\n바꿈',empty:''}]){
  const expected=canonicalJson(value),r=(await db.query('SELECT anvil.source_read_canonical_json($1::jsonb) canonical,anvil.source_read_hash($1::jsonb) hash',[JSON.stringify(value)])).rows[0];
  if(r?.canonical!==expected||r?.hash!==contentHash(expected))throw Error('A3_SQL_CANONICAL_MISMATCH');
 }cases.push('canonical-unicode-crlf-escape-safe-integer');
 for(const [input,want]of [['straße.ts','STRASSE.TS'],['ﬃ.ts','FFI.TS'],['ı.ts','I.TS'],['ς.ts','Σ.TS'],['𐐨.ts','𐐀.TS'],['한글/é.ts','한글/É.TS']]as const){const row=(await db.query('SELECT anvil.source_read_uppercase_v1($1) value',[input])).rows[0];if(row?.value!==want)throw Error('A3_SQL_UNICODE_FOLD_MISMATCH');}cases.push('unicode-expansion-supplementary-fold');
 const targetFile=(relativePath:string)=>({relativePath,kind:'FILE',access:'READ_ATTRIBUTES',recursive:false});
 const vectors:{paths:string[];want:boolean}[]=[{paths:['src/main.ts'],want:true},{paths:Array.from({length:200},(_,i)=>`src/f${i}.ts`),want:true},{paths:Array.from({length:201},(_,i)=>`src/f${i}.ts`),want:false},{paths:['straße.ts','STRASSE.ts'],want:false},{paths:['ﬃ.ts','FFI.ts'],want:false},{paths:['ı.ts','I.ts'],want:false},{paths:['ς.ts','σ.ts'],want:false},{paths:['𐐨.ts','𐐀.ts'],want:false},{paths:['../outside'],want:false},{paths:['a\\b'],want:false},{paths:['e\u0301.ts'],want:false},{paths:['CON.ts'],want:false},{paths:['a\n.ts'],want:false}];
 for(const {paths,want}of vectors){const r=(await db.query('SELECT anvil.source_read_targets($1::jsonb) ok',[JSON.stringify(paths.map(targetFile))])).rows[0];if(r?.ok!==want)throw Error('A3_SQL_TARGET_VECTOR_MISMATCH');}cases.push('relative-target-200-201-unicode-duplicates');
 return{cases,transport:'CALLER_SUPPLIED_ISOLATED_PG',actualSchemaApplication:false,grantOrCredentialIssued:false,osVerified:false};
}
