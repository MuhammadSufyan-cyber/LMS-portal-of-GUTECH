-- Keep profile email matching case-insensitive and whitespace-safe.
update public.profiles set email = lower(btrim(email))
where email <> lower(btrim(email));

create unique index profiles_email_normalized_key on public.profiles (lower(btrim(email)));
