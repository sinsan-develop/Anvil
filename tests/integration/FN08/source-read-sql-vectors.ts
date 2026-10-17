import type{Client}from'pg';import{canonicalJson,contentHash}from'../../../contracts/canonical.ts';
/** Node PG와 psql 후보는 같은 입력·기대값을 소비한다. 자체 실행/접속은 없다. */
export function sourceReadSqlCases(){
 const canonical=[null,true,false,0,9007199254740991,'한글 😀\r\n"\\',{z:['é',null,true,17],a:'줄\r\n바꿈',empty:''}].map(value=>{const expected=canonicalJson(value);return{query:'SELECT anvil.source_read_canonical_json($1::jsonb) canonical,anvil.source_read_hash($1::jsonb) hash',parameter:JSON.stringify(value),expected:{canonical:expected,hash:contentHash(expected)},failure:'A3_SQL_CANONICAL_MISMATCH'};});
 const unicode=[['straße.ts','STRASSE.TS'],['ﬃ.ts','FFI.TS'],['ı.ts','I.TS'],['ς.ts','Σ.TS'],['𐐨.ts','𐐀.TS'],['한글/é.ts','한글/É.TS']].map(([input,want])=>({query:'SELECT anvil.source_read_uppercase_v1($1) value',parameter:input!,expected:{value:want!},failure:'A3_SQL_UNICODE_FOLD_MISMATCH'}));
 const paths:{paths:string[];want:boolean}[]=[{paths:['src/main.ts'],want:true},{paths:Array.from({length:200},(_,i)=>'src/f'+i+'.ts'),want:true},{paths:Array.from({length:201},(_,i)=>'src/f'+i+'.ts'),want:false},{paths:['straße.ts','STRASSE.ts'],want:false},{paths:['ﬃ.ts','FFI.ts'],want:false},{paths:['ı.ts','I.ts'],want:false},{paths:['ς.ts','σ.ts'],want:false},{paths:['𐐨.ts','𐐀.ts'],want:false},{paths:['../outside'],want:false},{paths:['a\\b'],want:false},{paths:['e\u0301.ts'],want:false},{paths:['CON.ts'],want:false},{paths:['a\n.ts'],want:false}];
 const targets=paths.map(({paths,want})=>({query:'SELECT anvil.source_read_targets($1::jsonb) ok',parameter:JSON.stringify(paths.map(relativePath=>({relativePath,kind:'FILE',access:'READ_ATTRIBUTES',recursive:false}))),expected:{ok:want},failure:'A3_SQL_TARGET_VECTOR_MISMATCH'}));
 return[...canonical,...unicode,...targets];
}
/** 승인된 새 빈 A-3 PG용 준비 경로. import/기본 시험에서 접속·SQL 적용·실행하지 않는다. */
export async function runSourceReadSqlVectors(db:Pick<Client,'query'>){
 const target=(await db.query("SELECT current_database() database,current_user role,current_setting('server_version_num')::int version")).rows[0];
 if(target?.database!=='anvil_v3_a3_read_qa'||!['anvil_v3_app','anvil_v3_migrator'].includes(target?.role)||target?.version<150000||target?.version>=160000)throw Error('A3_ISOLATED_TARGET_REQUIRED');
 const migrations=(await db.query('SELECT id FROM anvil.schema_migrations ORDER BY id')).rows;
 if(migrations.length!==46||!migrations.some(r=>r.id==='0008_source_read_observation'))throw Error('A3_MIGRATION_NOT_READY');
 for(const item of sourceReadSqlCases()){const row=(await db.query(item.query,[item.parameter])).rows[0];if(canonicalJson(row??null)!==canonicalJson(item.expected))throw Error(item.failure);}
 return{cases:['canonical-unicode-crlf-escape-safe-integer','unicode-expansion-supplementary-fold','relative-target-200-201-unicode-duplicates'],transport:'CALLER_SUPPLIED_ISOLATED_PG',actualSchemaApplication:false,grantOrCredentialIssued:false,osVerified:false};
}
