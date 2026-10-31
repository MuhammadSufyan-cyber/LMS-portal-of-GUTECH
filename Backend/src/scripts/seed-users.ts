import { getServiceSupabase } from '../config/supabase.js';
import { env } from '../config/env.js';

if (env.NODE_ENV !== 'development') {
  throw new Error('seed:users only runs when NODE_ENV=development.');
}
if (!env.SUPABASE_URL) throw new Error('SUPABASE_URL must be set in Backend/.env.');
console.log(`Provisioning local-development accounts against ${new URL(env.SUPABASE_URL).host}.`);

const accounts = [
  {
    email: 'sufyanaliganatra@gmail.com',
    password: '12345678',
    fullName: 'Sufyan Ali Ganatra',
    username: 'sufyanaliganatra',
    role: 'admin' as const,
  },
  {
    email: 'gutechchecker@gmail.com',
    password: 'gutechchecker',
    fullName: 'GUTECH Checker',
    username: 'gutechchecker',
    role: 'student' as const,
  },
];

const normalizeEmail = (value: string) => value.trim().toLowerCase();

async function ensureAccount(account: (typeof accounts)[number]) {
  const db = getServiceSupabase();
  const normalizedEmail = normalizeEmail(account.email);
  const matchingProfiles: { id: string; email: string; username: string }[] = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await db
      .from('profiles')
      .select('id,email,username')
      .range(from, from + 999);
    if (error) throw error;
    matchingProfiles.push(...(data ?? []).filter((profile) => normalizeEmail(profile.email) === normalizedEmail));
    if (!data || data.length < 1000) break;
  }
  if (matchingProfiles.length > 1)
    throw new Error(`Multiple profile rows match ${normalizedEmail}; resolve the duplicate rows first.`);

  let authUser = matchingProfiles[0]
    ? (await db.auth.admin.getUserById(matchingProfiles[0].id)).data.user
    : null;
  const users = [];
  for (let page = 1; ; page += 1) {
    const { data, error } = await db.auth.admin.listUsers({ page, perPage: 1000 });
    if (error) throw error;
    users.push(...data.users);
    if (data.users.length < 1000) break;
  }
  const matchingUsers = users.filter((user) => user.email && normalizeEmail(user.email) === normalizedEmail);
  if (matchingUsers.length > 1)
    throw new Error(`Multiple Supabase Auth users match ${normalizedEmail}; resolve the duplicate identities first.`);
  authUser ??= matchingUsers[0] ?? null;

  if (authUser) {
    const { data, error } = await db.auth.admin.updateUserById(authUser.id, {
      email: normalizedEmail,
      password: account.password,
      email_confirm: true,
      user_metadata: { ...authUser.user_metadata, full_name: account.fullName, username: account.username },
    });
    if (error || !data.user) throw error ?? new Error(`Could not update ${normalizedEmail}.`);
    authUser = data.user;
  } else {
    const { data, error } = await db.auth.admin.createUser({
      email: normalizedEmail,
      password: account.password,
      email_confirm: true,
      user_metadata: { full_name: account.fullName, username: account.username },
    });
    if (error || !data.user) throw error ?? new Error(`Could not create ${normalizedEmail}.`);
    authUser = data.user;
  }

  const { error: profileError } = await db.from('profiles').upsert(
    {
      id: authUser.id,
      full_name: account.fullName,
      username: account.username,
      email: normalizedEmail,
      role: account.role,
      roll_no: null,
      is_active: true,
      must_change_password: false,
    },
    { onConflict: 'id' },
  );
  if (profileError) throw profileError;
  console.log(`Provisioned ${normalizedEmail} (${account.role}); password reset and account active.`);
}

async function seedUsers() {
  for (const account of accounts) await ensureAccount(account);
}

seedUsers().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : 'Local account provisioning failed.');
  process.exitCode = 1;
});
