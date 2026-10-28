import type {InstallationKeyLeaseRegistry} from '../backups/installation-resource-store.ts';
import type {InstallationResourceCatalogPort} from '../backups/installation-resource-catalog.ts';
import { createHash, createHmac, randomBytes, randomUUID, timingSafeEqual } from 'node:crypto';
import type { Pool, PoolClient } from 'pg';
import { hashPassword, verifyPassword, sessionIsActive } from './service.ts';

export class AuthFailure extends Error {
  statusCode: number;
  constructor(code: string, status = 401) { super(code); this.statusCode = status; }
}
interface SafeUser { id: string; displayName: string; serverOwner: boolean }
interface SessionView { user: SafeUser; clientId: string; csrfToken: string; expiresAt: string; absoluteExpiresAt: string; reauthUntil: string | null }
type Result<T> = { value: T } | { failure: string; status: number };
interface AttemptBucket { kind: string; key: string; count: number; start: Date }
export interface AuthenticatedIdentity { actorId: string; clientId: string; serverOwner: boolean; credentialGeneration: number; reauthUntil: Date | null;
  authSession?: Readonly<{id:string;idleExpiresAt:string;absoluteExpiresAt:string}> }
const digest = (value: string) => createHash('sha256').update(value).digest('hex');
const same = (one: string, two: string) => /^[0-9a-f]{64}$/.test(one) && /^[0-9a-f]{64}$/.test(two) && timingSafeEqual(Buffer.from(one, 'hex'), Buffer.from(two, 'hex'));
const dummyPhc = '$argon2id$v=19$m=19456,t=2,p=1$AAAAAAAAAAAAAAAAAAAAAA$AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA';
function normalizeName(value: string) {
  if (typeof value !== 'string' || !/^[A-Za-z0-9][A-Za-z0-9._@+-]{0,127}$/.test(value)) throw new AuthFailure('INPUT_INVALID', 400);
  return value.toLowerCase();
}
export class AccessRepository {
  pool: Pool;
  installationId: string;
  installationResourceCatalog?: InstallationResourceCatalogPort;
  installationKeyRegistry?: InstallationKeyLeaseRegistry;
  #key: Buffer;
  constructor(pool: Pool, config: { installationId: string; key: Buffer }) {
    if (config.key.length !== 32 || !/^[0-9a-f-]{36}$/.test(config.installationId)) throw Error('AUTH_CONFIG_INVALID');
    this.pool = pool; this.installationId = config.installationId; this.#key = Buffer.from(config.key);
  }
  #hmac(value: string) { return createHmac('sha256', this.#key).update(value).digest('hex'); }
  #csrf(token: string) { return createHmac('sha256', this.#key).update('csrf:' + token).digest('base64url'); }
  signProjectCursor(encoded: string): string { return this.#hmac('project-list-cursor:v1:' + encoded); }
  signMethodCursor(encoded: string): string { return this.#hmac('method-list-cursor:v1:' + encoded); }
  signProviderClaimCursor(encoded: string): string { return this.#hmac('provider-claim-history-page:v1:' + encoded); }
  /** FN15 cursor의 고정 도메인만 기존 키로 서명한다. 키 원문은 노출하지 않는다. */
  signControlRequestCursor(message: string): string {
    if (!message.startsWith('anvil:fn15-control-request-cursor:v1:')) throw new AuthFailure('INPUT_INVALID', 400);
    return this.#hmac('fn15-control-request-cursor:v1:' + message);
  }
  verifyControlRequestCursor(message: string, signature: string): boolean {
    if (!message.startsWith('anvil:fn15-control-request-cursor:v1:')) return false;
    return same(this.signControlRequestCursor(message), signature);
  }
  /** 호출자가 소유한 transaction에서만 사용한다. 연결/BEGIN/COMMIT/갱신을 하지 않는다.
   * 반환값은 인증뿐이며 프로젝트 정책·제어·재인증·실행 허가를 대신하지 않는다. */
  async authenticateInTransaction(db: PoolClient, token: string, csrf: string): Promise<AuthenticatedIdentity> {
    if (typeof token !== 'string' || !/^[A-Za-z0-9_-]{43}$/.test(token)) throw new AuthFailure('AUTH_REQUIRED');
    if (typeof csrf !== 'string' || !/^[A-Za-z0-9_-]{43}$/.test(csrf)) throw new AuthFailure('CSRF_INVALID', 403);
    const row = await this.#lockedSession(db, token, async () => {
      // 행 잠금을 기다린 뒤 DB 시각을 읽는다. autocommit 조회에는 활성 xid가 없다.
      const current = (await db.query('SELECT clock_timestamp() AS at, pg_current_xact_id_if_assigned()::text AS transaction_id')).rows[0];
      if (!(current?.at instanceof Date) || !Number.isFinite(current.at.getTime()) || typeof current.transaction_id !== 'string' || !/^[1-9][0-9]*$/.test(current.transaction_id)) throw new AuthFailure('AUTH_REQUIRED');
      return new Date(current.at.getTime());
    });
    if (!same(row.csrf_digest, digest(csrf))) throw new AuthFailure('CSRF_INVALID', 403);
    return Object.freeze({actorId:row.uid,clientId:row.client_id,serverOwner:row.server_owner,credentialGeneration:Number(row.current_generation),
      reauthUntil:row.reauth_until === null ? null : new Date(row.reauth_until.getTime()),
      authSession:Object.freeze({id:row.id,idleExpiresAt:row.idle_expires_at.toISOString(),absoluteExpiresAt:row.absolute_expires_at.toISOString()})});
  }
  async authenticated<T>(token: string, csrf: string | null, operation: (db: PoolClient, identity: AuthenticatedIdentity) => Promise<T>): Promise<T> {
    if (typeof token !== 'string' || !/^[A-Za-z0-9_-]{43}$/.test(token)) throw new AuthFailure('AUTH_REQUIRED');
    return this.#transaction<T>(async db => {
      const row = await this.#lockedSession(db, token);
      if (csrf !== null && !same(row.csrf_digest, digest(csrf))) return { failure: 'CSRF_INVALID', status: 403 };
      return { value: await operation(db, Object.freeze({ actorId: row.uid, clientId: row.client_id, serverOwner: row.server_owner, credentialGeneration: Number(row.current_generation), reauthUntil: row.reauth_until,
        authSession:Object.freeze({id:row.id,idleExpiresAt:row.idle_expires_at.toISOString(),absoluteExpiresAt:row.absolute_expires_at.toISOString()}) })) };
    });
  }
  async #transaction<T>(body: (db: PoolClient) => Promise<Result<T>>): Promise<T> {
    const db = await this.pool.connect();
    let result: Result<T>;
    let committing = false, releaseError: Error | undefined;
    try { await db.query('BEGIN'); result = await body(db); committing = true; await db.query('COMMIT'); committing = false; }
    catch (error) {
      if (committing) releaseError = error instanceof Error ? error : Error('TRANSACTION_STATE_UNKNOWN');
      try { await db.query('ROLLBACK'); } catch (rollbackError) { releaseError ??= rollbackError instanceof Error ? rollbackError : Error('TRANSACTION_STATE_UNKNOWN'); }
      throw error;
    }
    finally { db.release(releaseError); }
    if ('failure' in result) throw new AuthFailure(result.failure, result.status);
    return result.value;
  }
  async #audit(db: PoolClient, operation: string, outcome: string, reason: string, subject: string | null = null, client: string | null = null) {
    await db.query('INSERT INTO anvil.auth_audit_events(id,subject_ref,client_ref,operation,outcome,reason_code) VALUES($1,$2,$3,$4,$5,$6)', [randomUUID(), subject, client, operation, outcome, reason]);
  }
  async #attempts(db: PoolClient, normalized: string, source: string): Promise<AttemptBucket[] | null> {
    const now = new Date(), buckets: AttemptBucket[] = [];
    for (const [kind, value] of [['ACCOUNT', normalized], ['SOURCE', source]]) {
      const key = this.#hmac(kind + ':' + value);
      const row = (await db.query('SELECT * FROM anvil.auth_attempt_windows WHERE bucket_kind=$1 AND bucket_key=$2 ORDER BY updated_at DESC LIMIT 1 FOR UPDATE', [kind, key])).rows[0];
      if (row?.blocked_until && row.blocked_until > now) return null;
      if (!row && (await db.query('SELECT count(*)::int AS count FROM anvil.auth_attempt_windows')).rows[0].count >= 10000) return null;
      const current = row && now.getTime() - row.window_start.getTime() < 15 * 60_000;
      buckets.push({ kind: kind!, key, count: current ? row.attempt_count : 0, start: current ? row.window_start : now });
    }
    return buckets;
  }
  async #failedAttempts(db: PoolClient, buckets: AttemptBucket[]) {
    for (const bucket of buckets) {
      await db.query('DELETE FROM anvil.auth_attempt_windows WHERE bucket_kind=$1 AND bucket_key=$2', [bucket.kind, bucket.key]);
      const count = bucket.count + 1;
      await db.query('INSERT INTO anvil.auth_attempt_windows(bucket_kind,bucket_key,window_start,attempt_count,blocked_until) VALUES($1,$2,$3,$4,$5)', [bucket.kind, bucket.key, bucket.start, count, count >= 5 ? new Date(Date.now() + 15 * 60_000) : null]);
    }
  }
  async #lockedSession(db: PoolClient, token: string, clock?: () => Promise<Date>) {
    const row = (await db.query('SELECT s.*,u.id AS uid,u.display_name,u.normalized_login_name,u.server_owner,u.status AS user_status,u.revoked_at AS user_revoked_at,u.credential_generation AS current_generation,c.revoked_at AS client_revoked_at FROM anvil.auth_sessions s JOIN anvil.users u ON u.id=s.user_id JOIN anvil.clients c ON c.id=s.client_id AND c.user_id=s.user_id WHERE token_digest=$1 FOR UPDATE OF u,s,c', [digest(token)])).rows[0];
    if (!row || row.user_status !== 'ACTIVE' || !sessionIsActive({ idleExpiresAt: row.idle_expires_at, absoluteExpiresAt: row.absolute_expires_at, revokedAt: row.revoked_at, userRevokedAt: row.user_revoked_at, clientRevokedAt: row.client_revoked_at, credentialGeneration: Number(row.credential_generation), currentCredentialGeneration: Number(row.current_generation) }, clock ? await clock() : new Date())) throw new AuthFailure('AUTH_REQUIRED');
    return row;
  }
  async setup(): Promise<{ setupRequired: boolean; policyVersion: number }> {
    const row = (await this.pool.query('SELECT consumed_at FROM anvil.installation_claims WHERE installation_id=$1', [this.installationId])).rows[0];
    return { setupRequired: !row?.consumed_at, policyVersion: 1 };
  }
  async claimOwner(input: { bootstrapSecret: string; loginName: string; displayName: string; password: string; commandId: string }): Promise<{ user: SafeUser; recoverySecret: string | null }> {
    const normalized = normalizeName(input.loginName);
    if (typeof input.displayName !== 'string' || !input.displayName.trim() || input.displayName.length > 120 || !/^[0-9a-f-]{36}$/.test(input.commandId) || typeof input.bootstrapSecret !== 'string' || input.bootstrapSecret.length > 128) throw new AuthFailure('INPUT_INVALID', 400);
    const fingerprint = this.#hmac(JSON.stringify(['claim', this.installationId, input.commandId, input.bootstrapSecret, input.loginName, input.displayName, input.password]));
    return this.#transaction<{ user: SafeUser; recoverySecret: string | null }>(async db => {
      const claim = (await db.query('SELECT * FROM anvil.installation_claims WHERE installation_id=$1 FOR UPDATE', [this.installationId])).rows[0];
      if (!claim || claim.expires_at.getTime() <= Date.now() || !same(claim.bootstrap_digest, digest(input.bootstrapSecret))) {
        await this.#audit(db, 'CLAIM', 'DENIED', 'CLAIM_UNAVAILABLE'); return { failure: 'CLAIM_UNAVAILABLE', status: 403 };
      }
      const previous = (await db.query("SELECT protected_fingerprint,safe_result_ref FROM anvil.auth_actions WHERE actor_scope=$1 AND operation='CLAIM' AND command_id=$2", [this.installationId, input.commandId])).rows[0];
      if (previous) {
        if (!same(previous.protected_fingerprint, fingerprint)) return { failure: 'IDEMPOTENCY_CONFLICT', status: 409 };
        return { value: { user: previous.safe_result_ref as SafeUser, recoverySecret: null } };
      }
      if (claim.consumed_at || (await db.query("SELECT 1 FROM anvil.users WHERE server_owner AND status='ACTIVE'")).rowCount) return { failure: 'CLAIM_UNAVAILABLE', status: 409 };
      const phc = await hashPassword(input.password);
      const user = { id: randomUUID(), displayName: input.displayName, serverOwner: true };
      const recoverySecret = randomBytes(32).toString('base64url');
      await db.query("INSERT INTO anvil.users(id,login_name,normalized_login_name,display_name,status,server_owner) VALUES($1,$2,$3,$4,'ACTIVE',true)", [user.id, input.loginName, normalized, input.displayName]);
      await db.query('INSERT INTO anvil.password_credentials(user_id,argon2_phc,credential_generation) VALUES($1,$2,1)', [user.id, phc]);
      await db.query('INSERT INTO anvil.recovery_credentials(id,user_id,secret_digest) VALUES($1,$2,$3)', [randomUUID(), user.id, digest(recoverySecret)]);
      await db.query('UPDATE anvil.installation_claims SET consumed_at=now(),owner_user_id=$2,version=version+1 WHERE installation_id=$1', [this.installationId, user.id]);
      await db.query("INSERT INTO anvil.auth_actions(id,actor_scope,operation,command_id,protected_fingerprint,result_status,safe_result_ref) VALUES($1,$2,'CLAIM',$3,$4,'APPLIED',$5)", [randomUUID(), this.installationId, input.commandId, fingerprint, JSON.stringify(user)]);
      await this.#audit(db, 'CLAIM', 'APPLIED', 'OWNER_CREATED', user.id);
      return { value: { user, recoverySecret } };
    });
  }
  async login(loginName: string, password: string, label: string, source: string): Promise<SessionView & { token: string }> {
    const normalized = normalizeName(loginName);
    if (typeof password !== 'string' || password.length > 256 || typeof label !== 'string' || !label.trim() || label.length > 120 || typeof source !== 'string' || source.length > 128) throw new AuthFailure('INPUT_INVALID', 400);
    return this.#transaction<SessionView & { token: string }>(async db => {
      await db.query("SELECT pg_advisory_xact_lock(hashtext('anvil-auth-attempts'))");
      const now = new Date();
      const buckets = await this.#attempts(db, normalized, source);
      if (!buckets) { await this.#audit(db, 'LOGIN', 'DENIED', 'AUTH_RATE_LIMITED'); return { failure: 'AUTH_RATE_LIMITED', status: 429 }; }
      const row = (await db.query('SELECT u.*,p.argon2_phc,p.credential_generation AS password_generation FROM anvil.users u JOIN anvil.password_credentials p ON p.user_id=u.id WHERE normalized_login_name=$1 FOR UPDATE OF u', [normalized])).rows[0];
      const correct = await verifyPassword(password, row?.argon2_phc ?? dummyPhc);
      if (!row || row.status !== 'ACTIVE' || row.revoked_at || !correct || row.password_generation !== row.credential_generation) {
        await this.#failedAttempts(db, buckets);
        await this.#audit(db, 'LOGIN', 'DENIED', 'AUTH_REQUIRED'); return { failure: 'AUTH_REQUIRED', status: 401 };
      }
      const token = randomBytes(32).toString('base64url'), csrfToken = this.#csrf(token), clientId = randomUUID();
      const expiresAt = new Date(now.getTime() + 30 * 60_000).toISOString(), absoluteExpiresAt = new Date(now.getTime() + 12 * 60 * 60_000).toISOString();
      await db.query('INSERT INTO anvil.clients(id,user_id,label) VALUES($1,$2,$3)', [clientId, row.id, label]);
      await db.query('INSERT INTO anvil.auth_sessions(id,token_digest,user_id,client_id,credential_generation,csrf_digest,idle_expires_at,absolute_expires_at) VALUES($1,$2,$3,$4,$5,$6,$7,$8)', [randomUUID(), digest(token), row.id, clientId, row.credential_generation, digest(csrfToken), expiresAt, absoluteExpiresAt]);
      await this.#audit(db, 'LOGIN', 'APPLIED', 'SESSION_CREATED', row.id, clientId);
      return { value: { user: { id: row.id, displayName: row.display_name, serverOwner: row.server_owner }, clientId, token, csrfToken, expiresAt, absoluteExpiresAt, reauthUntil: null } };
    });
  }
  async session(token: string): Promise<SessionView> {
    if (typeof token !== 'string' || !/^[A-Za-z0-9_-]{43}$/.test(token)) throw new AuthFailure('AUTH_REQUIRED');
    return this.#transaction<SessionView>(async db => {
      const row = await this.#lockedSession(db, token);
      const now = new Date();
      const expiresAt = new Date(Math.min(row.absolute_expires_at.getTime(), now.getTime() + 30 * 60_000)).toISOString();
      await db.query('UPDATE anvil.auth_sessions SET last_seen_at=$2,idle_expires_at=$3 WHERE id=$1', [row.id, now, expiresAt]);
      return { value: { user: { id: row.uid, displayName: row.display_name, serverOwner: row.server_owner }, clientId: row.client_id, csrfToken: this.#csrf(token), expiresAt, absoluteExpiresAt: row.absolute_expires_at.toISOString(), reauthUntil: row.reauth_until?.toISOString() ?? null } };
    });
  }
  async reauthenticate(token: string, csrf: string, password: string, source: string): Promise<SessionView & { token: string }> {
    if (!/^[A-Za-z0-9_-]{43}$/.test(token)) throw new AuthFailure('AUTH_REQUIRED');
    return this.#transaction<SessionView & { token: string }>(async db => {
      await db.query("SELECT pg_advisory_xact_lock(hashtext('anvil-auth-attempts'))");
      const row = await this.#lockedSession(db, token);
      if (!same(row.csrf_digest, digest(csrf))) return { failure: 'CSRF_INVALID', status: 403 };
      const buckets = await this.#attempts(db, row.normalized_login_name, source);
      if (!buckets) return { failure: 'AUTH_RATE_LIMITED', status: 429 };
      const credential = (await db.query('SELECT argon2_phc,credential_generation FROM anvil.password_credentials WHERE user_id=$1', [row.uid])).rows[0];
      if (!credential || credential.credential_generation !== row.current_generation || !await verifyPassword(password, credential.argon2_phc)) {
        await this.#failedAttempts(db, buckets);
        await this.#audit(db, 'REAUTHENTICATE', 'DENIED', 'AUTH_REQUIRED', row.uid, row.client_id);
        return { failure: 'AUTH_REQUIRED', status: 401 };
      }
      const now = new Date(), nextToken = randomBytes(32).toString('base64url'), csrfToken = this.#csrf(nextToken);
      const expiresAt = new Date(Math.min(row.absolute_expires_at.getTime(), now.getTime() + 30 * 60_000)).toISOString();
      const reauthUntil = new Date(Math.min(row.absolute_expires_at.getTime(), now.getTime() + 5 * 60_000)).toISOString();
      this.installationKeyRegistry?.invalidateSession(row.id);
      await db.query('UPDATE anvil.auth_sessions SET revoked_at=$2 WHERE id=$1', [row.id, now]);
      await db.query('INSERT INTO anvil.auth_sessions(id,token_digest,user_id,client_id,credential_generation,csrf_digest,idle_expires_at,absolute_expires_at,reauth_until) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9)', [randomUUID(), digest(nextToken), row.uid, row.client_id, row.current_generation, digest(csrfToken), expiresAt, row.absolute_expires_at, reauthUntil]);
      await this.#audit(db, 'REAUTHENTICATE', 'APPLIED', 'SESSION_ROTATED', row.uid, row.client_id);
      return { value: { user: { id: row.uid, displayName: row.display_name, serverOwner: row.server_owner }, clientId: row.client_id, token: nextToken, csrfToken, expiresAt, absoluteExpiresAt: row.absolute_expires_at.toISOString(), reauthUntil } };
    });
  }
  async changePassword(token: string, csrf: string, input: { currentPassword: string; newPassword: string; commandId: string }, source: string): Promise<void> {
    if (!/^[A-Za-z0-9_-]{43}$/.test(token)) throw new AuthFailure('AUTH_REQUIRED');
    return this.#transaction<void>(async db => {
      await db.query("SELECT pg_advisory_xact_lock(hashtext('anvil-auth-attempts'))");
      const row = await this.#lockedSession(db, token);
      if (!same(row.csrf_digest, digest(csrf))) return { failure: 'CSRF_INVALID', status: 403 };
      if (!row.reauth_until || row.reauth_until.getTime() <= Date.now()) return { failure: 'REAUTHENTICATION_REQUIRED', status: 412 };
      const buckets = await this.#attempts(db, row.normalized_login_name, source);
      if (!buckets) return { failure: 'AUTH_RATE_LIMITED', status: 429 };
      const fingerprint = this.#hmac(JSON.stringify(['password', row.uid, input.commandId, input.currentPassword, input.newPassword]));
      const previous = (await db.query("SELECT protected_fingerprint FROM anvil.auth_actions WHERE actor_scope=$1 AND operation='PASSWORD' AND command_id=$2", [row.uid, input.commandId])).rows[0];
      if (previous) return same(previous.protected_fingerprint, fingerprint) ? { value: undefined } : { failure: 'IDEMPOTENCY_CONFLICT', status: 409 };
      const credential = (await db.query('SELECT argon2_phc,credential_generation FROM anvil.password_credentials WHERE user_id=$1', [row.uid])).rows[0];
      if (!credential || credential.credential_generation !== row.current_generation || !await verifyPassword(input.currentPassword, credential.argon2_phc)) {
        await this.#failedAttempts(db, buckets); await this.#audit(db, 'PASSWORD', 'DENIED', 'AUTH_REQUIRED', row.uid, row.client_id);
        return { failure: 'AUTH_REQUIRED', status: 401 };
      }
      const phc = await hashPassword(input.newPassword);
      this.installationKeyRegistry?.invalidateActor(row.uid);
      await db.query('UPDATE anvil.users SET credential_generation=credential_generation+1,version=version+1 WHERE id=$1', [row.uid]);
      await db.query('UPDATE anvil.password_credentials SET argon2_phc=$2,credential_generation=credential_generation+1,changed_at=now() WHERE user_id=$1', [row.uid, phc]);
      await db.query('UPDATE anvil.auth_sessions SET revoked_at=COALESCE(revoked_at,now()) WHERE user_id=$1', [row.uid]);
      await db.query("INSERT INTO anvil.auth_actions(id,actor_scope,operation,command_id,protected_fingerprint,result_status,safe_result_ref) VALUES($1,$2,'PASSWORD',$3,$4,'APPLIED',$5)", [randomUUID(), row.uid, input.commandId, fingerprint, JSON.stringify({ userId: row.uid, status: 'RELOGIN_REQUIRED' })]);
      await this.#audit(db, 'PASSWORD', 'APPLIED', 'CREDENTIAL_GENERATION_INCREASED', row.uid, row.client_id);
      return { value: undefined };
    });
  }
  async rotateRecovery(token: string, csrf: string, commandId: string): Promise<{ recoverySecret: string | null }> {
    if (!/^[A-Za-z0-9_-]{43}$/.test(token)) throw new AuthFailure('AUTH_REQUIRED');
    return this.#transaction<{ recoverySecret: string | null }>(async db => {
      const row = await this.#lockedSession(db, token);
      if (!same(row.csrf_digest, digest(csrf))) return { failure: 'CSRF_INVALID', status: 403 };
      if (!row.reauth_until || row.reauth_until.getTime() <= Date.now()) return { failure: 'REAUTHENTICATION_REQUIRED', status: 412 };
      const fingerprint = this.#hmac(JSON.stringify(['rotate-recovery', row.uid, commandId]));
      const previous = (await db.query("SELECT protected_fingerprint FROM anvil.auth_actions WHERE actor_scope=$1 AND operation='ROTATE_RECOVERY' AND command_id=$2", [row.uid, commandId])).rows[0];
      if (previous) return same(previous.protected_fingerprint, fingerprint) ? { value: { recoverySecret: null } } : { failure: 'IDEMPOTENCY_CONFLICT', status: 409 };
      const recoverySecret = randomBytes(32).toString('base64url');
      await db.query('UPDATE anvil.recovery_credentials SET revoked_at=now() WHERE user_id=$1 AND consumed_at IS NULL AND revoked_at IS NULL', [row.uid]);
      await db.query('INSERT INTO anvil.recovery_credentials(id,user_id,secret_digest) VALUES($1,$2,$3)', [randomUUID(), row.uid, digest(recoverySecret)]);
      await db.query("INSERT INTO anvil.auth_actions(id,actor_scope,operation,command_id,protected_fingerprint,result_status,safe_result_ref) VALUES($1,$2,'ROTATE_RECOVERY',$3,$4,'APPLIED',$5)", [randomUUID(), row.uid, commandId, fingerprint, JSON.stringify({ userId: row.uid, secretDeliveredOnce: true })]);
      await this.#audit(db, 'ROTATE_RECOVERY', 'APPLIED', 'PREVIOUS_SECRET_REVOKED', row.uid, row.client_id);
      return { value: { recoverySecret } };
    });
  }
  async recover(input: { loginName: string; recoverySecret: string; newPassword: string; commandId: string }, source: string): Promise<void> {
    const normalized = normalizeName(input.loginName);
    return this.#transaction<void>(async db => {
      await db.query("SELECT pg_advisory_xact_lock(hashtext('anvil-auth-attempts'))");
      const buckets = await this.#attempts(db, normalized, source);
      if (!buckets) return { failure: 'AUTH_RATE_LIMITED', status: 429 };
      const user = (await db.query('SELECT * FROM anvil.users WHERE normalized_login_name=$1 FOR UPDATE', [normalized])).rows[0];
      const secret = (await db.query('SELECT * FROM anvil.recovery_credentials WHERE user_id=$1 AND secret_digest=$2 FOR UPDATE', [user?.id ?? null, digest(input.recoverySecret)])).rows[0];
      const fingerprint = this.#hmac(JSON.stringify(['recover', normalized, input.commandId, input.recoverySecret, input.newPassword]));
      if (user?.status === 'ACTIVE' && !user.revoked_at && secret && !secret.revoked_at) {
        const previous = (await db.query("SELECT protected_fingerprint FROM anvil.auth_actions WHERE actor_scope=$1 AND operation='RECOVER' AND command_id=$2", [user.id, input.commandId])).rows[0];
        if (previous) return same(previous.protected_fingerprint, fingerprint) ? { value: undefined } : { failure: 'IDEMPOTENCY_CONFLICT', status: 409 };
        if (!secret.consumed_at) {
          const phc = await hashPassword(input.newPassword);
          this.installationKeyRegistry?.invalidateActor(user.id);
          await db.query('UPDATE anvil.users SET credential_generation=credential_generation+1,version=version+1 WHERE id=$1', [user.id]);
          await db.query('UPDATE anvil.password_credentials SET argon2_phc=$2,credential_generation=credential_generation+1,changed_at=now() WHERE user_id=$1', [user.id, phc]);
          await db.query('UPDATE anvil.auth_sessions SET revoked_at=COALESCE(revoked_at,now()) WHERE user_id=$1', [user.id]);
          await db.query('UPDATE anvil.recovery_credentials SET consumed_at=now() WHERE id=$1', [secret.id]);
          await db.query("INSERT INTO anvil.auth_actions(id,actor_scope,operation,command_id,protected_fingerprint,result_status,safe_result_ref) VALUES($1,$2,'RECOVER',$3,$4,'APPLIED',$5)", [randomUUID(), user.id, input.commandId, fingerprint, JSON.stringify({ userId: user.id, status: 'RELOGIN_REQUIRED' })]);
          await this.#audit(db, 'RECOVER', 'APPLIED', 'RECOVERY_CONSUMED', user.id);
          return { value: undefined };
        }
      }
      await this.#failedAttempts(db, buckets); await this.#audit(db, 'RECOVER', 'DENIED', 'AUTH_REQUIRED');
      return { failure: 'AUTH_REQUIRED', status: 401 };
    });
  }
  async createInvitation(token: string, csrf: string, input: { loginName: string; displayName: string; projectGrants: { projectId: string; participation: string }[]; expiresAt: string; commandId: string }): Promise<{ invitationId: string; invitationSecret: string | null; expiresAt: string }> {
    if (!/^[A-Za-z0-9_-]{43}$/.test(token)) throw new AuthFailure('AUTH_REQUIRED');
    const normalized = normalizeName(input.loginName), expires = Date.parse(input.expiresAt);
    if (!input.displayName.trim() || !Number.isFinite(expires) || expires <= Date.now() || expires > Date.now() + 24 * 3600000) throw new AuthFailure('INPUT_INVALID', 400);
    return this.#transaction(async db => {
      const actor = await this.#lockedSession(db, token);
      if (!same(actor.csrf_digest, digest(csrf))) return { failure: 'CSRF_INVALID', status: 403 };
      if (!actor.server_owner) return { failure: 'ACCESS_DENIED', status: 403 };
      if (!actor.reauth_until || actor.reauth_until.getTime() <= Date.now()) return { failure: 'REAUTHENTICATION_REQUIRED', status: 412 };
      // 계정 초대와 프로젝트 변경 권한은 별개다. FN11 집행 전 프로젝트 grant는 열지 않는다.
      if (input.projectGrants.length) return { failure: 'PROJECT_AUTHORIZATION_NOT_READY', status: 412 };
      const fingerprint = this.#hmac(JSON.stringify(['invitation', actor.uid, input]));
      const previous = (await db.query("SELECT protected_fingerprint,safe_result_ref FROM anvil.auth_actions WHERE actor_scope=$1 AND operation='INVITE' AND command_id=$2", [actor.uid, input.commandId])).rows[0];
      if (previous) return same(previous.protected_fingerprint, fingerprint) ? { value: { ...previous.safe_result_ref, invitationSecret: null } } : { failure: 'IDEMPOTENCY_CONFLICT', status: 409 };
      if ((await db.query('SELECT 1 FROM anvil.users WHERE normalized_login_name=$1', [normalized])).rowCount) return { failure: 'INVITATION_UNAVAILABLE', status: 409 };
      const invitationId = randomUUID(), invitationSecret = randomBytes(32).toString('base64url');
      const safeResult = { invitationId, expiresAt: new Date(expires).toISOString() };
      await db.query('INSERT INTO anvil.user_invitations(id,normalized_login_name,display_name,secret_digest,project_grants_json,expires_at,created_by) VALUES($1,$2,$3,$4,$5,$6,$7)', [invitationId, normalized, input.displayName, digest(invitationSecret), JSON.stringify(input.projectGrants), safeResult.expiresAt, actor.uid]);
      await db.query("INSERT INTO anvil.auth_actions(id,actor_scope,operation,command_id,protected_fingerprint,result_status,safe_result_ref) VALUES($1,$2,'INVITE',$3,$4,'APPLIED',$5)", [randomUUID(), actor.uid, input.commandId, fingerprint, JSON.stringify(safeResult)]);
      await this.#audit(db, 'INVITE', 'APPLIED', 'INVITATION_CREATED', actor.uid, actor.client_id);
      return { value: { ...safeResult, invitationSecret } };
    });
  }
  async acceptInvitation(input: { invitationId: string; invitationSecret: string; password: string; commandId: string }, source: string): Promise<{ user: SafeUser; recoverySecret: string | null }> {
    return this.#transaction<{ user: SafeUser; recoverySecret: string | null }>(async db => {
      await db.query("SELECT pg_advisory_xact_lock(hashtext('anvil-auth-attempts'))");
      const buckets = await this.#attempts(db, 'invitation:' + input.invitationId, source);
      if (!buckets) return { failure: 'AUTH_RATE_LIMITED', status: 429 };
      const ref = (await db.query('SELECT created_by FROM anvil.user_invitations WHERE id=$1', [input.invitationId])).rows[0];
      const creator = (await db.query('SELECT status,server_owner,revoked_at FROM anvil.users WHERE id=$1 FOR UPDATE', [ref?.created_by ?? null])).rows[0];
      const invite = (await db.query('SELECT * FROM anvil.user_invitations WHERE id=$1 FOR UPDATE', [input.invitationId])).rows[0];
      if (!creator || creator.status !== 'ACTIVE' || !creator.server_owner || creator.revoked_at || !invite || invite.revoked_at || invite.expires_at.getTime() <= Date.now() || !same(invite.secret_digest, digest(input.invitationSecret))) {
        await this.#failedAttempts(db, buckets); await this.#audit(db, 'ACCEPT_INVITATION', 'DENIED', 'INVITATION_UNAVAILABLE');
        return { failure: 'INVITATION_UNAVAILABLE', status: 403 };
      }
      const fingerprint = this.#hmac(JSON.stringify(['accept-invitation', input]));
      const previous = (await db.query("SELECT protected_fingerprint,safe_result_ref FROM anvil.auth_actions WHERE actor_scope=$1 AND operation='ACCEPT_INVITATION' AND command_id=$2", [input.invitationId, input.commandId])).rows[0];
      if (previous) return same(previous.protected_fingerprint, fingerprint) ? { value: { user: previous.safe_result_ref, recoverySecret: null } } : { failure: 'IDEMPOTENCY_CONFLICT', status: 409 };
      if (invite.consumed_at || (await db.query('SELECT 1 FROM anvil.users WHERE normalized_login_name=$1', [invite.normalized_login_name])).rowCount) return { failure: 'INVITATION_UNAVAILABLE', status: 409 };
      if (!Array.isArray(invite.project_grants_json) || invite.project_grants_json.length) return { failure: 'PROJECT_AUTHORIZATION_NOT_READY', status: 412 };
      const phc = await hashPassword(input.password), recoverySecret = randomBytes(32).toString('base64url');
      const user = { id: randomUUID(), displayName: invite.display_name as string, serverOwner: false };
      await db.query("INSERT INTO anvil.users(id,login_name,normalized_login_name,display_name,status,server_owner) VALUES($1,$2,$2,$3,'ACTIVE',false)", [user.id, invite.normalized_login_name, user.displayName]);
      await db.query('INSERT INTO anvil.password_credentials(user_id,argon2_phc,credential_generation) VALUES($1,$2,1)', [user.id, phc]);
      await db.query('INSERT INTO anvil.recovery_credentials(id,user_id,secret_digest) VALUES($1,$2,$3)', [randomUUID(), user.id, digest(recoverySecret)]);
      await db.query('UPDATE anvil.user_invitations SET consumed_at=now(),consumed_by=$2 WHERE id=$1', [invite.id, user.id]);
      await db.query("INSERT INTO anvil.auth_actions(id,actor_scope,operation,command_id,protected_fingerprint,result_status,safe_result_ref) VALUES($1,$2,'ACCEPT_INVITATION',$3,$4,'APPLIED',$5)", [randomUUID(), invite.id, input.commandId, fingerprint, JSON.stringify(user)]);
      await this.#audit(db, 'ACCEPT_INVITATION', 'APPLIED', 'INVITATION_CONSUMED', user.id);
      return { value: { user, recoverySecret } };
    });
  }
  async logout(token: string, csrf: string): Promise<void> {
    if (!/^[A-Za-z0-9_-]{43}$/.test(token)) return;
    return this.#transaction<void>(async db => {
      const row = (await db.query('SELECT id,csrf_digest,revoked_at FROM anvil.auth_sessions WHERE token_digest=$1 FOR UPDATE', [digest(token)])).rows[0];
      if (!row || row.revoked_at) return { value: undefined };
      if (!same(row.csrf_digest, digest(csrf))) return { failure: 'CSRF_INVALID', status: 403 };
      this.installationKeyRegistry?.invalidateSession(row.id);
      await db.query('UPDATE anvil.auth_sessions SET revoked_at=now() WHERE id=$1', [row.id]);
      await this.#audit(db, 'LOGOUT', 'APPLIED', 'SESSION_REVOKED'); return { value: undefined };
    });
  }
}
