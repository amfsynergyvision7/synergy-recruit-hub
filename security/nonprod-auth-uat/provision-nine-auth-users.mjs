/**
 * Build 78 — server-side synthetic-only GoTrue Auth Admin provisioning.
 * No browser use, no service key in source, no SQL auth.users insertion.
 * Deliberately requires a credential manager at execution time.
 */
import { writeFile, access } from 'node:fs/promises';
import { isAbsolute, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

export const PROJECT_ID = 'dhlhlasnaapzckjyvffn';
export const PROJECT_URL = `https://${PROJECT_ID}.supabase.co`;
export const ACK = 'I_ACCEPT_ISOLATED_SYNTHETIC_AUTH_ADMIN_NONPROD_ONLY';
export const slotEmail = (index) =>
  `amf-uat-${String(index).padStart(2,'0')}@example.invalid`;
const uuidRE = /^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i;
const secretRE = /^(?:sb_secret_[A-Za-z0-9_-]{16,}|eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+)$/;
/**
 * Build143: all hosted test subjects must remain nine confirmed email-only
 * fictional identities, without an external contact route, privileged claims,
 * unexpected IdP linkage, or user-supplied personal metadata.
 * This checks user details locally; never print the source User object.
 */
export function isExactSyntheticAuthUser(u,slot) {
  if (!u || !Number.isInteger(slot) || slot<1 || slot>9 ||
      !uuidRE.test(u.id??'') || u.email!==slotEmail(slot) ||
      u.role!=='authenticated' || u.aud!=='authenticated' ||
      typeof u.email_confirmed_at!=='string' ||
      !Number.isFinite(Date.parse(u.email_confirmed_at)) ||
      (u.confirmed_at!=null && !Number.isFinite(Date.parse(u.confirmed_at))) ||
      (u.phone!=null && u.phone!=='') || u.phone_confirmed_at!=null ||
      u.invited_at!=null || u.banned_until!=null || u.deleted_at!=null ||
      u.new_email!=null || u.new_phone!=null ||
      u.is_anonymous===true || u.is_sso_user===true ||
      (u.factors!=null && (!Array.isArray(u.factors)||u.factors.length!==0)))
    return false;
  const app=u.app_metadata;
  if (!app || typeof app!=='object' || Array.isArray(app) ||
      Object.keys(app).some(k=>!['provider','providers'].includes(k)) ||
      (app.provider!=null && app.provider!=='email') ||
      (app.providers!=null && (!Array.isArray(app.providers) ||
        app.providers.length!==1 || app.providers[0]!=='email')))
    return false;
  // A provider list by itself is not proof of a primary email sign-in.
  // GoTrue may omit the expanded identities array in some readbacks:
  // accept either an explicit primary email provider or a validated
  // single email identity. Never accept neither.
  if (app.provider!=='email' &&
      !(Array.isArray(u.identities)&&u.identities.length===1&&
        u.identities[0]?.provider==='email'))
    return false;
  const meta=u.user_metadata;
  if (meta!=null && (typeof meta!=='object' || Array.isArray(meta) ||
      Object.keys(meta).some(k=>!['sub','email','email_verified','phone_verified'].includes(k)) ||
      (meta.sub!=null && meta.sub!==u.id) ||
      (meta.email!=null && meta.email!==u.email) ||
      (meta.email_verified!=null && meta.email_verified!==true) ||
      (meta.phone_verified!=null && meta.phone_verified!==false)))
    return false;
  if (u.identities!=null) {
    if (!Array.isArray(u.identities) || u.identities.length!==1)
      return false;
    const identity=u.identities[0],data=identity?.identity_data;
    if (identity?.provider!=='email' || identity.user_id!==u.id ||
        !data || typeof data!=='object' || Array.isArray(data) ||
        Object.keys(data).some(k=>
          !['email','sub','email_verified','phone_verified'].includes(k)) ||
        data.email!==u.email ||
        (data.sub!=null && data.sub!==u.id) ||
        (data.email_verified!=null && data.email_verified!==true) ||
        (data.phone_verified!=null && data.phone_verified!==false))
      return false;
  }
  return true;
}

/**
 * Security-relevant GoTrue identity fingerprint for a two-read snapshot.
 * Intentionally excludes mutable last_sign_in_at/updated_at fields; serializes
 * only allowlisted values and never logs any account or metadata content.
 */
export function syntheticAuthEvidenceFingerprint(u) {
  if(!u||typeof u!=='object')return null;
  const app=u.app_metadata??{}, meta=u.user_metadata??{};
  return JSON.stringify([
    u.id??null,u.email??null,u.role??null,u.aud??null,
    u.email_confirmed_at??null,u.confirmed_at??null,
    u.phone??null,u.phone_confirmed_at??null,
    u.invited_at??null,u.banned_until??null,u.deleted_at??null,
    u.new_email??null,u.new_phone??null,
    u.is_anonymous??null,u.is_sso_user??null,u.factors??null,
    app.provider??null,app.providers??null,
    meta.sub??null,meta.email??null,meta.email_verified??null,
    meta.phone_verified??null,
    u.identities==null?null:u.identities.map(identity=>[
      identity?.user_id??null,identity?.provider??null,
      identity?.identity_data?.email??null,
      identity?.identity_data?.sub??null,
      identity?.identity_data?.email_verified??null,
      identity?.identity_data?.phone_verified??null
    ])
  ]);
}

export function adminConnectionFromEnv(env) {
  if (env.AMF_UAT_MODE !== 'EXECUTE' || env.AMF_UAT_ACK !== ACK)
    throw new Error('Explicit isolated synthetic execution acknowledgement required');
  if (env.AMF_UAT_PROJECT_ID !== PROJECT_ID ||
      env.AMF_UAT_SUPABASE_URL !== PROJECT_URL)
    throw new Error('Refusing non-allowlisted Supabase project');
  const key = env.AMF_UAT_SERVICE_ROLE_KEY;
  if (typeof key !== 'string' || !secretRE.test(key))
    throw new Error('Server-only secret/service_role key required (no publishable/anon key)');
  if (key.startsWith('eyJ')) {
    let role;
    try { role = JSON.parse(Buffer.from(key.split('.')[1], 'base64url').toString()).role; }
    catch { throw new Error('Unusable service role JWT'); }
    if (role !== 'service_role') throw new Error('Service-role authorization required');
  }
  return Object.freeze({url:PROJECT_URL,key});
}

export function planFromEnv(env, cwd = process.cwd()) {
  const {key}=adminConnectionFromEnv(env);
  const mappingFile = env.AMF_UAT_MAPPING_FILE;
  if (typeof mappingFile !== 'string' || !isAbsolute(mappingFile) ||
      mappingFile.includes('..') || resolve(mappingFile).startsWith(resolve(cwd) + '/'))
    throw new Error('A separate absolute credential-manager mapping path outside the repository is required');
  const passwords = [];
  for (let i = 1; i <= 9; i++) {
    const p = env[`AMF_UAT_CASE_${String(i).padStart(2,'0')}_PASSWORD`];
    if (typeof p !== 'string' || p.length < 24 || p.length > 256 ||
        !/[A-Z]/.test(p) || !/[a-z]/.test(p) || !/[0-9]/.test(p))
      throw new Error(`Missing/weak secret-managed password in slot ${i}`);
    passwords.push(p);
  }
  if (new Set(passwords).size !== 9)
    throw new Error('Each synthetic Auth user needs a distinct password');
  return Object.freeze({
    url: PROJECT_URL,
    key,
    mappingFile,
    users: passwords.map((password,i) =>
      Object.freeze({slot:i+1,email:slotEmail(i+1),password}))
  });
}

export async function provisionNine(plan, admin, saveMapping) {
  if (!plan || plan.url !== PROJECT_URL || plan.users?.length !== 9 ||
      plan.users.some((u,i) => u.email !== slotEmail(i+1)) ||
      typeof admin?.listUsers !== 'function' ||
      typeof admin?.createUser !== 'function' ||
      typeof admin?.deleteUser !== 'function' ||
      typeof saveMapping !== 'function')
    throw new Error('Invalid isolated provisioning dependencies');
  const before = await admin.listUsers({page:1,perPage:100});
  if (before.error || !Array.isArray(before.data?.users) || before.data.users.length)
    throw new Error('Refusing to create users: lab Auth tenant not verified empty');
  const created = [];
  try {
    for (const entry of plan.users) {
      const response = await admin.createUser({
        email: entry.email,
        password: entry.password,
        email_confirm: true
        // Explicitly no privileged app_metadata, role or user_metadata.
      });
      const u = response?.data?.user;
      // Record any valid returned UUID for compensation, even if the provider
      // unexpectedly changed the email or role. We may only delete IDs created
      // in this invocation, after confirming the tenant started empty.
      if (u && uuidRE.test(u.id)) {
        created.push({slot: entry.slot, id: u.id, email: u.email});
      }
      if (response?.error || !isExactSyntheticAuthUser(u,entry.slot))
        throw new Error(`Synthetic slot ${entry.slot} did not pass user integrity`);
    }
    if (new Set(created.map(u=>u.id)).size !== 9)
      throw new Error('Auth Admin returned duplicate subject ID');
    const after = await admin.listUsers({page:1,perPage:100});
    const actual = after?.data?.users;
    const expected = new Map(created.map(u => [u.id,u.email]));
    if (after?.error || !Array.isArray(actual) || actual.length !== 9 ||
        actual.some(u => !expected.has(u.id) || expected.get(u.id) !== u.email) ||
        created.some(entry => !actual.some(u=>
          u.id===entry.id && isExactSyntheticAuthUser(u,entry.slot))))
      throw new Error('Postcreation Auth tenant is not the exact nine-user synthetic set');
    // Strictly no passwords, tokens or service key in mapping. A local owner
    // transfers it into the approved secret manager for later signed UAT.
    await saveMapping({project_id:PROJECT_ID,users:created});
    return Object.freeze({created_count:created.length,auth_tenant_verified:true});
  } catch {
    let cleanupFailures = 0;
    for (const u of created.reverse()) {
      try {
        const response = await admin.deleteUser(u.id,false);
        if (response?.error) cleanupFailures++;
      } catch { cleanupFailures++; }
    }
    // A createUser request may time out AFTER GoTrue committed the account
    // but BEFORE it returned a UUID. A successful delete response is also
    // insufficient to prove the subject is gone. Independently re-read the
    // exact isolated tenant even if created[] remained empty.
    try {
      const readback = await admin.listUsers({page:1,perPage:100});
      if (readback?.error || !Array.isArray(readback?.data?.users) ||
          readback.data.users.length !== 0)
        cleanupFailures++;
    } catch { cleanupFailures++; }
    throw new Error(`Synthetic provisioning aborted; ${cleanupFailures} cleanup operations unconfirmed. Inspect lab Auth tenant before retrying. No credentials logged.`);
  }
}

async function main() {
  const plan = planFromEnv(process.env);
  await access(resolve(plan.mappingFile,'..')).catch(() => {
    throw new Error('Protected mapping output directory does not exist');
  });
  try { await access(plan.mappingFile); throw new Error('Mapping output already exists'); }
  catch (e) { if (e.code !== 'ENOENT') throw e; }
  // Dynamic import keeps CI contract tests offline and credential-free.
  const {createClient} = await import('@supabase/supabase-js');
  const client = createClient(plan.url,plan.key,{
    auth:{autoRefreshToken:false,persistSession:false,detectSessionInUrl:false}
  });
  const save = async data => {
    await writeFile(plan.mappingFile,JSON.stringify(data,null,2)+'\n',
      {flag:'wx',mode:0o600});
  };
  const result = await provisionNine(plan,client.auth.admin,save);
  process.stdout.write(`SYNTHETIC_AUTH_ADMIN_CREATED=${result.created_count}; EXACT_TENANT_PASS=true; CREDENTIALS_NOT_LOGGED=true\n`);
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  main().catch(() => {
    process.stderr.write('Build78 Auth Admin provisioning HOLD/FAILED. Check isolation, protected mapping and lab cleanup; no secrets shown.\n');
    process.exitCode = 1;
  });
}
