-- BEGIN supabase/migrations/0001_core.sql
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
-- END supabase/migrations/0001_core.sql

-- BEGIN supabase/migrations/0002_learning_content.sql
create table public.resources (
  id uuid primary key default gen_random_uuid(), course_id uuid not null references public.courses(id) on delete cascade,
  uploaded_by uuid not null references public.profiles(id), title text not null, description text,
  file_path text not null, file_name text not null, mime_type text not null,
  size_bytes bigint not null check (size_bytes > 0), created_at timestamptz not null default now()
);

create table public.assignments (
  id uuid primary key default gen_random_uuid(), course_id uuid not null references public.courses(id) on delete cascade,
  created_by uuid not null references public.profiles(id), title text not null, instructions text not null,
  max_marks numeric(6,2) not null check (max_marks > 0), due_at timestamptz not null,
  allow_late boolean not null default false, attachment_path text,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);

create table public.submissions (
  id uuid primary key default gen_random_uuid(), assignment_id uuid not null references public.assignments(id) on delete cascade,
  student_id uuid not null references public.profiles(id) on delete cascade, text_answer text, file_path text,
  submitted_at timestamptz not null default now(), is_late boolean not null default false,
  marks_obtained numeric(6,2), feedback text, graded_by uuid references public.profiles(id), graded_at timestamptz,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  unique (assignment_id, student_id), check (marks_obtained is null or marks_obtained >= 0)
);

create type public.question_type as enum ('mcq_single', 'mcq_multi', 'true_false');
create table public.quizzes (
  id uuid primary key default gen_random_uuid(), course_id uuid not null references public.courses(id) on delete cascade,
  created_by uuid not null references public.profiles(id), title text not null, description text,
  time_limit_minutes int not null check (time_limit_minutes > 0), opens_at timestamptz not null,
  closes_at timestamptz not null, is_published boolean not null default false,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  check (closes_at > opens_at)
);
create table public.quiz_questions (
  id uuid primary key default gen_random_uuid(), quiz_id uuid not null references public.quizzes(id) on delete cascade,
  position int not null, type public.question_type not null, prompt text not null,
  options jsonb not null check (jsonb_typeof(options) = 'array'),
  marks numeric(5,2) not null default 1 check (marks > 0),
  created_at timestamptz not null default now(), unique (quiz_id, position)
);
create table public.quiz_answers (
  question_id uuid primary key references public.quiz_questions(id) on delete cascade,
  correct_option_ids text[] not null, created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table public.quiz_attempts (
  id uuid primary key default gen_random_uuid(), quiz_id uuid not null references public.quizzes(id) on delete cascade,
  student_id uuid not null references public.profiles(id) on delete cascade,
  started_at timestamptz not null default now(), submitted_at timestamptz,
  answers jsonb not null default '{}', score numeric(6,2),
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  unique (quiz_id, student_id)
);
create table public.announcements (
  id uuid primary key default gen_random_uuid(), course_id uuid references public.courses(id) on delete cascade,
  author_id uuid not null references public.profiles(id), title text not null, body text not null,
  is_pinned boolean not null default false, created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table public.announcement_reads (
  user_id uuid not null references public.profiles(id) on delete cascade,
  announcement_id uuid not null references public.announcements(id) on delete cascade,
  read_at timestamptz not null default now(), created_at timestamptz not null default now(),
  primary key(user_id, announcement_id)
);
create table public.audit_log (
  id bigint generated always as identity primary key, actor_id uuid references public.profiles(id), action text not null,
  entity text not null, entity_id uuid, at timestamptz not null default now(), created_at timestamptz not null default now()
);
create table public.chat_messages (
  id uuid primary key default gen_random_uuid(), course_id uuid not null references public.courses(id) on delete cascade,
  sender_id uuid not null references public.profiles(id), body text not null check (char_length(body) between 1 and 2000),
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(), deleted_at timestamptz
);

-- Direct clients may edit only the response content; grading and quiz timing remain server-owned.
create or replace function public.guard_student_submission()
returns trigger language plpgsql security definer set search_path = public
as $$
declare
  assignment_due_at timestamptz;
  assignment_allows_late boolean;
begin
  if auth.uid() is null or public.is_admin() or public.teaches((select a.course_id from public.assignments a where a.id = new.assignment_id)) then
    return new;
  end if;
  if tg_op = 'INSERT' then
    select a.due_at, a.allow_late into assignment_due_at, assignment_allows_late
    from public.assignments a where a.id = new.assignment_id;
    if now() > assignment_due_at and not assignment_allows_late then
      raise exception 'assignment deadline has passed' using errcode = '23514';
    end if;
    new.student_id := auth.uid();
    new.submitted_at := now();
    new.is_late := now() > assignment_due_at;
    new.marks_obtained := null;
    new.feedback := null;
    new.graded_by := null;
    new.graded_at := null;
  else
    if old.student_id <> auth.uid() then
      raise exception 'submission owner mismatch' using errcode = '42501';
    end if;
    new.student_id := old.student_id;
    new.assignment_id := old.assignment_id;
    select a.due_at, a.allow_late into assignment_due_at, assignment_allows_late
    from public.assignments a where a.id = old.assignment_id;
    if now() > assignment_due_at and not assignment_allows_late then
      raise exception 'assignment deadline has passed' using errcode = '23514';
    end if;
    new.submitted_at := now();
    new.is_late := now() > assignment_due_at;
    new.marks_obtained := null;
    new.feedback := null;
    new.graded_by := null;
    new.graded_at := null;
  end if;
  return new;
end;
$$;
create trigger submissions_guard_student before insert or update on public.submissions
for each row execute function public.guard_student_submission();

create or replace function public.guard_student_quiz_attempt()
returns trigger language plpgsql security definer set search_path = public
as $$
begin
  if auth.uid() is null or public.is_admin() or exists (
    select 1 from public.quizzes q where q.id = new.quiz_id and public.teaches(q.course_id)
  ) then
    return new;
  end if;
  if tg_op = 'INSERT' then
    new.student_id := auth.uid();
    new.started_at := now();
    new.submitted_at := null;
    new.score := null;
  else
    if old.student_id <> auth.uid() or old.submitted_at is not null then
      raise exception 'quiz attempt is not editable' using errcode = '42501';
    end if;
    new.quiz_id := old.quiz_id;
    new.student_id := old.student_id;
    new.started_at := old.started_at;
    new.submitted_at := null;
    new.score := null;
  end if;
  return new;
end;
$$;
create trigger quiz_attempts_guard_student before insert or update on public.quiz_attempts
for each row execute function public.guard_student_quiz_attempt();

create trigger assignments_updated_at before update on public.assignments for each row execute function public.set_updated_at();
create trigger submissions_updated_at before update on public.submissions for each row execute function public.set_updated_at();
create trigger quizzes_updated_at before update on public.quizzes for each row execute function public.set_updated_at();
create trigger quiz_answers_updated_at before update on public.quiz_answers for each row execute function public.set_updated_at();
create trigger quiz_attempts_updated_at before update on public.quiz_attempts for each row execute function public.set_updated_at();
create trigger announcements_updated_at before update on public.announcements for each row execute function public.set_updated_at();
create trigger chat_messages_updated_at before update on public.chat_messages for each row execute function public.set_updated_at();

create index resources_course_created_idx on public.resources(course_id, created_at desc);
create index assignments_course_due_idx on public.assignments(course_id, due_at);
create index submissions_assignment_idx on public.submissions(assignment_id);
create index quiz_attempts_quiz_idx on public.quiz_attempts(quiz_id);
create index announcements_course_created_idx on public.announcements(course_id, created_at desc);
create index chat_messages_course_created_idx on public.chat_messages(course_id, created_at desc);

alter table public.resources enable row level security;
alter table public.assignments enable row level security;
alter table public.submissions enable row level security;
alter table public.quizzes enable row level security;
alter table public.quiz_questions enable row level security;
alter table public.quiz_answers enable row level security;
alter table public.quiz_attempts enable row level security;
alter table public.announcements enable row level security;
alter table public.announcement_reads enable row level security;
alter table public.audit_log enable row level security;
alter table public.chat_messages enable row level security;

create policy resources_course_read on public.resources for select using (public.is_admin() or public.teaches(course_id) or public.is_enrolled(course_id));
create policy resources_teacher_insert on public.resources for insert with check (public.is_admin() or (uploaded_by = auth.uid() and public.teaches(course_id)));
create policy resources_uploader_delete on public.resources for delete using (public.is_admin() or uploaded_by = auth.uid());
create policy assignments_course_read on public.assignments for select using (public.is_admin() or public.teaches(course_id) or public.is_enrolled(course_id));
create policy assignments_teacher_write on public.assignments for all using (public.is_admin() or (created_by = auth.uid() and public.teaches(course_id))) with check (public.is_admin() or (created_by = auth.uid() and public.teaches(course_id)));
create policy submissions_student_or_teacher_read on public.submissions for select using (public.is_admin() or student_id = auth.uid() or exists(select 1 from public.assignments a where a.id = assignment_id and public.teaches(a.course_id)));
create policy submissions_student_insert on public.submissions for insert with check (student_id = auth.uid() and exists(select 1 from public.assignments a where a.id = assignment_id and public.is_enrolled(a.course_id)));
create policy submissions_owner_update on public.submissions for update using (student_id = auth.uid() or public.is_admin() or exists(select 1 from public.assignments a where a.id = assignment_id and public.teaches(a.course_id))) with check (student_id = auth.uid() or public.is_admin() or exists(select 1 from public.assignments a where a.id = assignment_id and public.teaches(a.course_id)));
create policy quizzes_course_read on public.quizzes for select using (public.is_admin() or public.teaches(course_id) or (public.is_enrolled(course_id) and is_published));
create policy quizzes_teacher_write on public.quizzes for all using (public.is_admin() or (created_by = auth.uid() and public.teaches(course_id))) with check (public.is_admin() or (created_by = auth.uid() and public.teaches(course_id)));
create policy quiz_questions_member_read on public.quiz_questions for select using (exists(select 1 from public.quizzes q where q.id = quiz_id and (public.is_admin() or public.teaches(q.course_id) or (public.is_enrolled(q.course_id) and q.is_published))));
create policy quiz_questions_teacher_write on public.quiz_questions for all using (exists(select 1 from public.quizzes q where q.id = quiz_id and (public.is_admin() or (q.created_by = auth.uid() and public.teaches(q.course_id)))));
create policy quiz_answers_teacher_only on public.quiz_answers for all using (exists(select 1 from public.quiz_questions qq join public.quizzes q on q.id = qq.quiz_id where qq.id = question_id and (public.is_admin() or (q.created_by = auth.uid() and public.teaches(q.course_id))))) with check (exists(select 1 from public.quiz_questions qq join public.quizzes q on q.id = qq.quiz_id where qq.id = question_id and (public.is_admin() or (q.created_by = auth.uid() and public.teaches(q.course_id)))));
create policy quiz_attempts_student_or_teacher_read on public.quiz_attempts for select using (public.is_admin() or student_id = auth.uid() or exists(select 1 from public.quizzes q where q.id = quiz_id and public.teaches(q.course_id)));
create policy quiz_attempts_student_insert on public.quiz_attempts for insert with check (student_id = auth.uid() and exists(select 1 from public.quizzes q where q.id = quiz_id and q.is_published and public.is_enrolled(q.course_id)));
create policy quiz_attempts_owner_update on public.quiz_attempts for update using (student_id = auth.uid() or public.is_admin()) with check (student_id = auth.uid() or public.is_admin());
create policy announcements_feed_read on public.announcements for select using (public.is_admin() or course_id is null or public.teaches(course_id) or public.is_enrolled(course_id));
create policy announcements_author_write on public.announcements for all using (public.is_admin() or (author_id = auth.uid() and course_id is not null and public.teaches(course_id))) with check (public.is_admin() or (author_id = auth.uid() and course_id is not null and public.teaches(course_id)));
create policy announcement_reads_self on public.announcement_reads for all using (user_id = auth.uid() or public.is_admin()) with check (user_id = auth.uid() or public.is_admin());
create policy audit_log_admin_read on public.audit_log for select using (public.is_admin());
create policy audit_log_server_insert on public.audit_log for insert with check (actor_id = auth.uid() or public.is_admin());
create policy chat_member_read on public.chat_messages for select using (public.is_admin() or public.teaches(course_id) or public.is_enrolled(course_id));
create policy chat_member_insert on public.chat_messages for insert with check (sender_id = auth.uid() and (public.teaches(course_id) or public.is_enrolled(course_id)));
create policy chat_sender_or_staff_update on public.chat_messages for update using (sender_id = auth.uid() or public.is_admin() or public.teaches(course_id)) with check (sender_id = auth.uid() or public.is_admin() or public.teaches(course_id));

create or replace view public.v_student_marks with (security_invoker = true) as
  select s.student_id, a.course_id, 'assignment'::text as kind, a.id as item_id, a.title,
         s.marks_obtained as obtained, a.max_marks as max, s.graded_at
  from public.submissions s join public.assignments a on a.id = s.assignment_id where s.graded_at is not null
  union all
  select qa.student_id, q.course_id, 'quiz'::text as kind, q.id as item_id, q.title,
         qa.score as obtained, coalesce(sum(qq.marks), 0)::numeric(6,2) as max, qa.submitted_at as graded_at
  from public.quiz_attempts qa join public.quizzes q on q.id = qa.quiz_id
  left join public.quiz_questions qq on qq.quiz_id = q.id
  where qa.submitted_at is not null group by qa.id, q.id;
-- END supabase/migrations/0002_learning_content.sql

-- BEGIN supabase/migrations/0003_complaints_storage.sql
create type public.complaint_status as enum ('open', 'in_review', 'resolved', 'rejected');
create table public.complaints (
  id uuid primary key default gen_random_uuid(), raised_by uuid not null references public.profiles(id),
  course_id uuid references public.courses(id),
  category text not null check (category in ('academic','technical','facility','conduct','other')),
  subject text not null, description text not null, attachment_path text,
  status public.complaint_status not null default 'open', admin_response text,
  resolved_by uuid references public.profiles(id),
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create index complaints_status_created_idx on public.complaints(status, created_at desc);
create trigger complaints_updated_at before update on public.complaints for each row execute function public.set_updated_at();
alter table public.complaints enable row level security;
create policy complaints_owner_read on public.complaints for select using (raised_by = auth.uid() or public.is_admin());
create policy complaints_user_insert on public.complaints for insert with check (raised_by = auth.uid() and (course_id is null or public.is_enrolled(course_id) or public.teaches(course_id)));
create policy complaints_admin_update on public.complaints for update using (public.is_admin()) with check (public.is_admin());

insert into storage.buckets (id, name, public, file_size_limit)
values ('resources', 'resources', false, 26214400),
       ('submissions', 'submissions', false, 31457280),
       ('complaint-attachments', 'complaint-attachments', false, 10485760)
on conflict (id) do update set public = false, file_size_limit = excluded.file_size_limit;

create policy private_course_files_read on storage.objects for select using (
  bucket_id = 'resources' and (public.is_admin() or public.teaches((storage.foldername(name))[1]::uuid) or public.is_enrolled((storage.foldername(name))[1]::uuid))
);
create policy private_course_files_insert on storage.objects for insert with check (
  (bucket_id = 'resources' and (public.is_admin() or public.teaches((storage.foldername(name))[1]::uuid))) or
  (bucket_id = 'submissions' and (storage.foldername(name))[1] = auth.uid()::text) or
  (bucket_id = 'complaint-attachments' and (storage.foldername(name))[1] = auth.uid()::text)
);
create policy private_complaint_files_read on storage.objects for select using (
  bucket_id = 'complaint-attachments' and (public.is_admin() or (storage.foldername(name))[1] = auth.uid()::text)
);
create policy private_files_delete on storage.objects for delete using (public.is_admin() or owner::text = auth.uid()::text);
-- END supabase/migrations/0003_complaints_storage.sql

-- BEGIN supabase/migrations/0004_profile_username.sql
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
-- END supabase/migrations/0004_profile_username.sql
