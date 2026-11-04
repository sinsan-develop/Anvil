import type {PoolClient} from 'pg';
import {AuthFailure,type AuthenticatedIdentity} from '../access/repository.ts';
export const commonSetupMigration='0075_user_common_setup_definitions';
export const commonSetupChecksum='c77b0101384ab91dae7474dcdf8bc48881807c8ece9b18e321d1e792012696cb';
export async function commonSetupContext(db:PoolClient,actor:AuthenticatedIdentity,lock=false){
 const s=actor.authSession,until=s?Math.min(Date.parse(s.idleExpiresAt),Date.parse(s.absoluteExpiresAt)):NaN;if(!s||!Number.isFinite(until)||until<=Date.now())throw new AuthFailure('AUTH_REQUIRED',401);
 const rows=(await db.query('SELECT id,checksum FROM anvil.schema_migrations WHERE id=$1',[commonSetupMigration])).rows;
 if(commonSetupChecksum.length!==64||rows.length!==1||rows[0].id!==commonSetupMigration||rows[0].checksum!==commonSetupChecksum)throw new AuthFailure('COMMON_SETUP_NOT_CONNECTED',412);
 await db.query('SELECT anvil.common_setup_context($1,$2,$3)',[s.id,actor.actorId,actor.clientId]);
 if(lock){const owner=(await db.query('SELECT id FROM anvil.users WHERE id=$1 FOR UPDATE',[actor.actorId])).rows;if(owner.length!==1)throw new AuthFailure('AUTH_REQUIRED',401);}
}
export async function commonSetupAccount(db:PoolClient,actor:AuthenticatedIdentity){const rows=(await db.query('SELECT * FROM anvil.common_setup_account($1)',[actor.actorId])).rows;const v=rows[0];if(rows.length!==1||!v||!['heads','versions','draft_versions','used_bytes'].every(k=>/^(0|[1-9][0-9]{0,18})$/.test(String(v[k]))))throw new AuthFailure('COMMON_SETUP_STORAGE_INTEGRITY_FAILED',503);if(BigInt(v.heads)>1000n||BigInt(v.versions)>10000n||BigInt(v.draft_versions)>10000n||BigInt(v.used_bytes)>67108864n)throw new AuthFailure('COMMON_SETUP_QUOTA_EXCEEDED',412);return v;}
export async function chargeCommonSetup(db:PoolClient,actor:AuthenticatedIdentity,commandId:string){const rows=(await db.query('SELECT anvil.common_setup_charge($1,$2) AS complete',[actor.actorId,commandId])).rows;if(rows.length!==1||rows[0].complete!==true)throw new AuthFailure('COMMON_SETUP_STORAGE_INTEGRITY_FAILED',503);await commonSetupAccount(db,actor);}
