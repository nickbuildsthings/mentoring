// Black-box access-control check against a live Supabase project (TECH-12).
// Run against a staging project seeded with synthetic data, never live data.
//   SUPABASE_URL=... SUPABASE_ANON_KEY=... \
//   MEMBER_EMAIL=... MEMBER_PASSWORD=... OUTSIDER_EMAIL=... OUTSIDER_PASSWORD=... npm run test:access
import { createClient } from '@supabase/supabase-js';

const env = (k) => { const v = process.env[k]; if (!v) { console.error(`Missing ${k}`); process.exit(2); } return v; };
const url = env('SUPABASE_URL'), key = env('SUPABASE_ANON_KEY');
const tables = ['profiles', 'objectives', 'sessions', 'session_objectives', 'session_preparation', 'actions', 'progress_updates'];
let failures = 0;
const check = (ok, msg) => { console.log(`${ok ? 'ok  ' : 'FAIL'} - ${msg}`); if (!ok) failures++; };
const client = () => createClient(url, key, { auth: { persistSession: false } });

async function signedIn(emailKey, passKey) {
  const c = client();
  const { error } = await c.auth.signInWithPassword({ email: env(emailKey), password: env(passKey) });
  if (error) { console.error(`Sign-in failed for ${emailKey}`); process.exit(2); }
  return c;
}

// 1. Unauthenticated
const anon = client();
for (const t of tables) {
  const { data, error } = await anon.from(t).select('*').limit(1);
  check(!!error || (data ?? []).length === 0, `anonymous cannot read ${t}`);
}
const anonInsert = await anon.from('objectives').insert({ title: 'x', success_criteria: 'y' });
check(!!anonInsert.error, 'anonymous cannot insert');

// 2. Authenticated but not approved
const outsider = await signedIn('OUTSIDER_EMAIL', 'OUTSIDER_PASSWORD');
for (const t of tables) {
  const { data, error } = await outsider.from(t).select('*').limit(1);
  check(!error && (data ?? []).length === 0, `unapproved account sees no rows in ${t}`);
}
const ins = await outsider.from('objectives').insert({ title: 'x', success_criteria: 'y' });
check(!!ins.error, 'unapproved account cannot insert');
const upd = await outsider.from('objectives').update({ title: 'hacked' }).neq('title', '').select();
check(!upd.error && (upd.data ?? []).length === 0, 'unapproved account cannot update');
const del = await outsider.from('objectives').delete().neq('title', '').select();
check(!!del.error || (del.data ?? []).length === 0, 'unapproved account cannot delete');

// 3. Approved member can read, and still cannot hard-delete
const member = await signedIn('MEMBER_EMAIL', 'MEMBER_PASSWORD');
const prof = await member.from('profiles').select('id');
check(!prof.error && prof.data.length === 2, 'approved member sees both profiles');
const mdel = await member.from('objectives').delete().neq('title', '').select();
check(!!mdel.error || (mdel.data ?? []).length === 0, 'approved member cannot hard-delete objectives');

console.log(failures ? `\n${failures} check(s) FAILED` : '\nAll access checks passed');
process.exit(failures ? 1 : 0);
