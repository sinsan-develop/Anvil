import {createHash} from 'node:crypto';
import {assignmentDevelopmentBaselineNames} from './assignment-draft-development-guard.ts';

const fail=():never=>{throw Error('FN02_TOC_INVALID');};
const expected=[...assignmentDevelopmentBaselineNames].sort(),sequence='anvil.auth_audit_events_server_sequence_seq';
const supported=Object.freeze({
 'DATABASE PROPERTIES':'database_settings','SEQUENCE OWNED BY':'sequence','SEQUENCE SET':'sequence','TABLE DATA':'table_data','FK CONSTRAINT':'constraints','CHECK CONSTRAINT':'constraints','DEFAULT ACL':'default_privileges',
 DATABASE:'database',SCHEMA:'schemas',TABLE:'relations',SEQUENCE:'sequence',INDEX:'indexes',CONSTRAINT:'constraints',FUNCTION:'functions',PROCEDURE:'functions',TRIGGER:'triggers',DEFAULT:'columns',ACL:'privileges',COMMENT:'comments',EXTENSION:'extensions',CAST:'casts',ENCODING:'metadata',STDSTRINGS:'metadata',SEARCHPATH:'metadata',
});
const unsupported=Object.freeze(['MATERIALIZED VIEW DATA','PUBLICATION TABLES IN SCHEMA','TEXT SEARCH CONFIGURATION','TEXT SEARCH DICTIONARY','TEXT SEARCH TEMPLATE','TEXT SEARCH PARSER','FOREIGN DATA WRAPPER','MATERIALIZED VIEW','PUBLICATION TABLE','DOMAIN CONSTRAINT','PROCEDURAL LANGUAGE','OPERATOR FAMILY','OPERATOR CLASS','FOREIGN TABLE','TABLE ATTACH','INDEX ATTACH','EVENT TRIGGER','SECURITY LABEL','USER MAPPING','ROW SECURITY','BLOB COMMENTS','SHELL TYPE','SUBSCRIPTION','PUBLICATION','STATISTICS','CONVERSION','COLLATION','AGGREGATE','OPERATOR','SERVER','POLICY','DOMAIN','TYPE','VIEW','RULE','BLOBS','BLOB']);
const descriptors=[...Object.keys(supported),...unsupported].sort((a,b)=>b.length-a.length);
const identifier=(v:string)=>/^[a-z_][a-z0-9_]{0,62}$/.test(v);
type Issue={id:number;code:string};

/** pg_restore 목록 문자열의 보수적 분류만 한다. archive를 열거나 복원 선택목록을 만들지 않는다. */
export function classifyFn02ArchiveToc(input:unknown){
 if(typeof input!=='string'||Buffer.byteLength(input,'utf8')>2097152||/[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]/.test(input)||/\r(?!\n)/.test(input))throw Error('FN02_TOC_INVALID');
 const lines=input.replaceAll('\r\n','\n').split('\n');if(lines.length>22000)fail();
 const header=(name:string)=>{const prefix=';';const found=lines.filter(line=>line.startsWith(prefix)&&line.slice(1).trimStart().startsWith(name+':')).map(line=>line.slice(1).trimStart().slice(name.length+1).trim());if(found.length!==1)fail();return found[0]!;};
 if(header('dbname')!=='anvil_v3_development'||header('Format')!=='CUSTOM'||!/^15\.[0-9]{1,3}(?:\s.*)?$/.test(header('Dumped from database version'))||!/^15\.[0-9]{1,3}(?:\s.*)?$/.test(header('Dumped by pg_dump version'))||!/^[1-9][0-9]{0,4}$/.test(header('TOC Entries'))||Number(header('TOC Entries'))>20000)fail();
 if(expected.length!==81||createHash('sha256').update(JSON.stringify(expected)).digest('hex')!=='0212665828281ced090d33d1c73888cd439b54eacac24bc4bcaebc1e30b306a6')fail();
 const ids=new Set<number>(),issues:Issue[]=[],counts:Record<string,number>=Object.create(null),familyCounts:Record<string,number>=Object.create(null),table=new Map<string,number>(),data=new Map<string,number>(),sequences=new Map<string,number>();
 let unresolvedObjectIdentities=0,unknownEntries=0,unsupportedEntries=0,databaseEntries=0;
 const issue=(id:number,code:string)=>issues.push(Object.freeze({id,code}));
 for(const raw of lines){
  const line=raw.trim();if(!line)continue;if(line.length>16384)fail();
  if(line.startsWith(';')){if(/^;\s*[1-9][0-9]*;/.test(line))fail();continue;}
  const match=/^([1-9][0-9]{0,9});\s+([0-9]{1,10})\s+([0-9]{1,10})\s+(.+)$/.exec(line);if(!match)fail();
  const id=Number(match![1]),catalogOid=Number(match![2]),objectOid=Number(match![3]),tail=match![4]!;
  if(id>2147483647||catalogOid>4294967295||objectOid>4294967295||ids.has(id)||ids.size>=20000)fail();ids.add(id);
  const descriptor=descriptors.find(desc=>tail.startsWith(desc+' '))??'UNKNOWN';counts[descriptor]=(counts[descriptor]??0)+1;
  if(descriptor==='UNKNOWN'){unknownEntries++;issue(id,'UNKNOWN_DESCRIPTOR');continue;}
  if(unsupported.includes(descriptor)){unsupportedEntries++;issue(id,'UNSUPPORTED_DESCRIPTOR');continue;}
  const family=(supported as Readonly<Record<string,string>>)[descriptor]!;familyCounts[family]=(familyCounts[family]??0)+1;
  if(!['TABLE','TABLE DATA','SEQUENCE','SEQUENCE OWNED BY','SEQUENCE SET','DATABASE'].includes(descriptor)){unresolvedObjectIdentities++;continue;}
  const fields=tail.slice(descriptor.length+1).trim().split(/\s+/);
  if(fields.length!==3||!(fields[0]==='-'||identifier(fields[0]!))||!identifier(fields[1]!)||!/^[A-Za-z_][A-Za-z0-9_$-]{0,62}$/.test(fields[2]!)){unresolvedObjectIdentities++;issue(id,'AMBIGUOUS_IDENTITY');continue;}
  const name=fields[0]+'.'+fields[1];
  if(descriptor==='DATABASE'){
   databaseEntries++;if(fields[0]!=='-'||fields[1]!=='anvil_v3_development'||catalogOid!==1262||objectOid===0)issue(id,'DATABASE_IDENTITY_MISMATCH');continue;
  }
  if(descriptor==='TABLE'||descriptor==='TABLE DATA'){
   if(!expected.includes(name)){issue(id,'UNEXPECTED_TABLE');continue;}
   const target=descriptor==='TABLE'?table:data;
   if(target.has(name))issue(id,'DUPLICATE_TABLE_IDENTITY');
   if(objectOid===0||catalogOid!==(descriptor==='TABLE'?1259:0))issue(id,'TABLE_CATALOG_IDENTITY_MISMATCH');
   target.set(name,objectOid);continue;
  }
  if(name!==sequence){issue(id,'UNEXPECTED_SEQUENCE');continue;}
  sequences.set(descriptor,(sequences.get(descriptor)??0)+1);
  if(descriptor==='SEQUENCE'&&(catalogOid!==1259||objectOid===0))issue(id,'SEQUENCE_CATALOG_IDENTITY_MISMATCH');
 }
 if(ids.size===0||Number(header('TOC Entries'))<ids.size)fail();
 let matchedTablePairs=0,missingTables=0,missingTableData=0;
 for(const name of expected){if(!table.has(name))missingTables++;if(!data.has(name))missingTableData++;if(table.has(name)&&data.has(name)){if(table.get(name)===data.get(name))matchedTablePairs++;else issue(0,'TABLE_DATA_OID_MISMATCH');}}
 if(missingTables)issue(0,'MISSING_TABLES');if(missingTableData)issue(0,'MISSING_TABLE_DATA');
 if(databaseEntries!==1)issue(0,'DATABASE_NOT_LISTED_EXACTLY_ONCE');
 for(const kind of ['SEQUENCE','SEQUENCE SET'])if(sequences.get(kind)!==1)issue(0,'SEQUENCE_NOT_LISTED_EXACTLY_ONCE');
 if(sequences.has('SEQUENCE OWNED BY'))issue(0,'UNEXPECTED_IDENTITY_OWNERSHIP_ENTRY');
 return Object.freeze({kind:'ARCHIVE_TOC_CLASSIFICATION_ONLY',status:issues.length?'TOC_REQUIRES_REVIEW':'TOC_CLASSIFIED_NOT_VERIFIED',tocTextHash:createHash('sha256').update(input).digest('hex'),listedEntries:ids.size,declaredArchiveEntries:Number(header('TOC Entries')),descriptorCounts:Object.freeze(counts),familyCounts:Object.freeze(familyCounts),matchedTablePairs,missingTables,missingTableData,sequenceEntries:[...sequences.values()].reduce((a,b)=>a+b,0),unresolvedObjectIdentities,unknownEntries,unsupportedEntries,issues:Object.freeze(issues),logicalObjectIdentityVerified:false,selectedListCompletenessVerified:false,archiveBytesVerified:false,fullArchiveCoverageVerified:false,executionAllowed:false});
}
