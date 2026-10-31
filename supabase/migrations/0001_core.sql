create extension if not exists pgcrypto with schema extensions;

create type public.user_role as enum ('admin', 'teacher', 'student');

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null,
  email text not null unique,
  role public.user_role not null,
  roll_no text unique,
  is_active boolean not null default true,
  must_change_password boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.courses (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  title text not null,
  description text,
  is_archived boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.course_teachers (
  course_id uuid not null references public.courses(id) on delete cascade,
  teacher_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (course_id, teacher_id)
);

create table public.enrollments (
  course_id uuid not null references public.courses(id) on delete cascade,
  student_id uuid not null references public.profiles(id) on delete cascade,
  enrolled_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  primary key (course_id, student_id)
);

create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;
create trigger profiles_updated_at before update on public.profiles for each row execute function public.set_updated_at();
create trigger courses_updated_at before update on public.courses for each row execute function public.set_updated_at();

create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path = public
as $$ select exists(select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin' and p.is_active); $$;

create or replace function public.teaches(target_course_id uuid)
returns boolean language sql stable security definer set search_path = public
as $$ select exists(select 1 from public.course_teachers ct join public.profiles p on p.id = ct.teacher_id where ct.course_id = target_course_id and ct.teacher_id = auth.uid() and p.is_active); $$;

create or replace function public.is_enrolled(target_course_id uuid)
returns boolean language sql stable security definer set search_path = public
as $$ select exists(select 1 from public.enrollments e join public.profiles p on p.id = e.student_id where e.course_id = target_course_id and e.student_id = auth.uid() and p.is_active); $$;

create or replace function public.can_view_profile(target_profile_id uuid)
returns boolean language sql stable security definer set search_path = public
as $$
  select target_profile_id = auth.uid() or public.is_admin() or exists (
    select 1 from public.enrollments mine
    join public.enrollments theirs on theirs.course_id = mine.course_id
    where mine.student_id = auth.uid() and theirs.student_id = target_profile_id
  ) or exists (
    select 1 from public.course_teachers mine
    join public.enrollments theirs on theirs.course_id = mine.course_id
    where mine.teacher_id = auth.uid() and theirs.student_id = target_profile_id
  ) or exists (
    select 1 from public.enrollments mine
    join public.course_teachers theirs on theirs.course_id = mine.course_id
    where mine.student_id = auth.uid() and theirs.teacher_id = target_profile_id
  ) or exists (
    select 1 from public.course_teachers mine
    join public.course_teachers theirs on theirs.course_id = mine.course_id
    where mine.teacher_id = auth.uid() and theirs.teacher_id = target_profile_id
  );
$$;

alter table public.profiles enable row level security;
alter table public.courses enable row level security;
alter table public.course_teachers enable row level security;
alter table public.enrollments enable row level security;

create policy profiles_read_classmates on public.profiles for select using (public.can_view_profile(id));
create policy profiles_admin_write on public.profiles for all using (public.is_admin()) with check (public.is_admin());
create policy courses_read_members on public.courses for select using (public.is_admin() or public.teaches(id) or (public.is_enrolled(id) and not is_archived));
create policy courses_admin_write on public.courses for all using (public.is_admin()) with check (public.is_admin());
create policy course_teachers_read_members on public.course_teachers for select using (public.is_admin() or teacher_id = auth.uid() or public.is_enrolled(course_id));
create policy course_teachers_admin_write on public.course_teachers for all using (public.is_admin()) with check (public.is_admin());
create policy enrollments_read_member on public.enrollments for select using (public.is_admin() or student_id = auth.uid() or public.teaches(course_id));
create policy enrollments_admin_write on public.enrollments for all using (public.is_admin()) with check (public.is_admin());
