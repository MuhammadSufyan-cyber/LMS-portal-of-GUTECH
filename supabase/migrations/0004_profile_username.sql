alter table public.profiles add column username text;

with normalized as (
  select id,
         regexp_replace(lower(split_part(email, '@', 1)), '[^a-z0-9._-]', '', 'g') as base,
         row_number() over (
           partition by regexp_replace(lower(split_part(email, '@', 1)), '[^a-z0-9._-]', '', 'g')
           order by id
         ) as duplicate_number
  from public.profiles
)
update public.profiles as profile
set username = case
  when normalized.duplicate_number = 1 then left(normalized.base, 32)
  else left(normalized.base, 23) || '-' || left(profile.id::text, 8)
end
from normalized
where normalized.id = profile.id;

alter table public.profiles alter column username set not null;
alter table public.profiles add constraint profiles_username_key unique (username);
alter table public.profiles add constraint profiles_username_format
  check (username ~ '^[a-zA-Z0-9._-]{3,32}$');
