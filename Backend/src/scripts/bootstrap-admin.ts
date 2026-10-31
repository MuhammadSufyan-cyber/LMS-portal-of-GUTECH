import { env } from '../config/env.js';
import { getServiceSupabase } from '../config/supabase.js';

async function bootstrapAdmin() {
  const {
    BOOTSTRAP_ADMIN_USERNAME: username,
    BOOTSTRAP_ADMIN_EMAIL: email,
    BOOTSTRAP_ADMIN_PASSWORD: password,
  } = env;
  if (!username || !email || !password) {
    throw new Error(
      'Set BOOTSTRAP_ADMIN_USERNAME, BOOTSTRAP_ADMIN_EMAIL, and BOOTSTRAP_ADMIN_PASSWORD in Backend/.env.',
    );
  }
  const normalizedEmail = email.trim().toLowerCase();
  const normalizedUsername = username.trim().toLowerCase();
  const db = getServiceSupabase();
  const { data: existingProfile, error: emailError } = await db
    .from('profiles')
    .select('id, username')
    .ilike('email', normalizedEmail)
    .maybeSingle();
  if (emailError) throw emailError;
  const { data: existingUsername, error: usernameError } = await db
    .from('profiles')
    .select('id, email')
    .eq('username', normalizedUsername)
    .maybeSingle();
  if (usernameError) throw usernameError;
  if (existingUsername && existingUsername.id !== existingProfile?.id) {
    throw new Error('The requested administrator username is already in use.');
  }

  let authUser = existingProfile
    ? (await db.auth.admin.getUserById(existingProfile.id)).data.user
    : null;
  if (!authUser) {
    const { data: users, error: listError } = await db.auth.admin.listUsers({ perPage: 1000 });
    if (listError) throw listError;
    authUser = users.users.find((user) => user.email?.trim().toLowerCase() === normalizedEmail) ?? null;
  }

  if (authUser) {
    const { data, error } = await db.auth.admin.updateUserById(authUser.id, {
      email: normalizedEmail,
      password,
      email_confirm: true,
      user_metadata: { ...authUser.user_metadata, full_name: normalizedUsername, username: normalizedUsername },
    });
    if (error || !data.user) throw error ?? new Error('Could not update the administrator Auth user.');
    authUser = data.user;
  } else {
    const { data, error } = await db.auth.admin.createUser({
      email: normalizedEmail,
      password,
      email_confirm: true,
      user_metadata: { full_name: normalizedUsername, username: normalizedUsername },
    });
    if (error || !data.user)
      throw error ?? new Error('Supabase did not return the new administrator account.');
    authUser = data.user;
  }

  const profile = {
    id: authUser.id,
    full_name: normalizedUsername,
    username: normalizedUsername,
    email: normalizedEmail,
    role: 'admin',
    is_active: true,
    must_change_password: false,
  };
  const { error: profileError } = existingProfile
    ? await db.from('profiles').update(profile).eq('id', authUser.id)
    : await db.from('profiles').insert(profile);
  if (profileError) {
    throw new Error(`Auth user was configured, but its LMS profile could not be saved: ${profileError.message}`);
  }
  console.log(`Bootstrap administrator ${existingProfile ? 'updated' : 'created'} and confirmed; LMS role is admin.`);
}

bootstrapAdmin().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : 'Administrator provisioning failed.');
  process.exitCode = 1;
});
