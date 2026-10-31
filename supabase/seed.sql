-- Local-only demo identities. Never use these accounts in a deployed environment.
-- Re-running the SQL seed updates its fixed demo identities in place. Use npm
-- run seed:users to repair only the two supported local login accounts.
do $$
declare
  account_ids uuid[] := array[
    '00000000-0000-4000-8000-000000000001'::uuid, '00000000-0000-4000-8000-000000000002'::uuid,
    '00000000-0000-4000-8000-000000000003'::uuid, '00000000-0000-4000-8000-000000000011'::uuid,
    '00000000-0000-4000-8000-000000000012'::uuid, '00000000-0000-4000-8000-000000000013'::uuid,
    '00000000-0000-4000-8000-000000000014'::uuid, '00000000-0000-4000-8000-000000000015'::uuid,
    '00000000-0000-4000-8000-000000000016'::uuid
  ];
  account_emails text[] := array['sufyanaliganatra@gmail.com','teacher1@gutech.edu','teacher2@gutech.edu','student1@gutech.edu','student2@gutech.edu','student3@gutech.edu','student4@gutech.edu','student5@gutech.edu','gutechchecker@gmail.com'];
  account_names text[] := array['Sufyan Ali Ganatra','Amina Teacher','Bilal Teacher','Ali Student','Sara Student','Omar Student','Maya Student','Hadi Student','GUTECH Checker'];
  account_roles public.user_role[] := array['admin'::public.user_role,'teacher','teacher','student','student','student','student','student','student'];
  i integer;
begin
  for i in 1..array_length(account_ids, 1) loop
    insert into auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at,
      raw_app_meta_data, raw_user_meta_data, created_at, updated_at, confirmation_token)
    values (account_ids[i], '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', account_emails[i],
      extensions.crypt(case when i = 1 then '12345678' when i = 9 then 'gutechchecker' else 'ChangeMe123!' end, extensions.gen_salt('bf')), now(),
      '{"provider":"email","providers":["email"]}'::jsonb, jsonb_build_object('full_name', account_names[i]), now(), now(), '')
    on conflict (id) do update set email = excluded.email,
      encrypted_password = excluded.encrypted_password, email_confirmed_at = now(),
      raw_user_meta_data = excluded.raw_user_meta_data, updated_at = now();

    insert into auth.identities (provider_id, user_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
    values (account_ids[i]::text, account_ids[i], jsonb_build_object('sub', account_ids[i]::text, 'email', account_emails[i]), 'email', now(), now(), now())
    on conflict (provider_id, provider) do update set identity_data = excluded.identity_data,
      updated_at = now();

    insert into public.profiles (id, full_name, username, email, role, roll_no, must_change_password)
    values (account_ids[i], account_names[i], split_part(account_emails[i], '@', 1), account_emails[i], account_roles[i],
      case when account_roles[i] = 'student' then 'GT-' || lpad((i - 2)::text, 4, '0') else null end, i not in (1, 9))
    on conflict (id) do update set full_name = excluded.full_name, username = excluded.username,
      email = excluded.email, role = excluded.role, roll_no = excluded.roll_no,
      is_active = true, must_change_password = excluded.must_change_password;
  end loop;
end $$;

-- Extend the local demo class to 25 students total (including the five named
-- demo students and the checker account above).
do $$
declare
  i integer;
  account_id uuid;
  account_name text;
  account_email text;
begin
  for i in 17..35 loop
    account_id := ('00000000-0000-4000-8000-' || lpad(i::text, 12, '0'))::uuid;
    account_name := 'Demo Student ' || lpad((i - 11)::text, 2, '0');
    account_email := 'student' || (i - 11)::text || '@gutech.edu';

    insert into auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at,
      raw_app_meta_data, raw_user_meta_data, created_at, updated_at, confirmation_token)
    values (account_id, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', account_email,
      extensions.crypt('ChangeMe123!', extensions.gen_salt('bf')), now(),
      '{"provider":"email","providers":["email"]}'::jsonb,
      jsonb_build_object('full_name', account_name), now(), now(), '')
    on conflict (id) do nothing;

    insert into auth.identities (provider_id, user_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
    values (account_id::text, account_id,
      jsonb_build_object('sub', account_id::text, 'email', account_email), 'email', now(), now(), now())
    on conflict (provider_id, provider) do nothing;

    insert into public.profiles (id, full_name, username, email, role, roll_no, must_change_password)
    values (account_id, account_name, split_part(account_email, '@', 1), account_email, 'student',
      'GT-' || lpad((i - 9)::text, 4, '0'), true)
    on conflict (id) do nothing;
  end loop;
end $$;

insert into public.courses (id, code, title, description) values
('10000000-0000-4000-8000-000000000001','CS101','Foundations of Computing','Core concepts in computer science.'),
('10000000-0000-4000-8000-000000000002','SE204','Software Engineering','Methods for building reliable software.'),
('10000000-0000-4000-8000-000000000003','DS310','Data Systems','Data modeling, storage, and analysis.'),
('10000000-0000-4000-8000-000000000004','AIT201','Data Structures','Algorithms, data structures, and problem solving.'),
('10000000-0000-4000-8000-000000000005','SE220','Software Engineering','Requirements, design, testing, and teamwork.'),
('10000000-0000-4000-8000-000000000006','DS320','Data Analytics','Practical data exploration and visualization.')
on conflict (code) do update set title = excluded.title, description = excluded.description;

insert into public.course_teachers (course_id, teacher_id) values
('10000000-0000-4000-8000-000000000001','00000000-0000-4000-8000-000000000002'),
('10000000-0000-4000-8000-000000000002','00000000-0000-4000-8000-000000000002'),
('10000000-0000-4000-8000-000000000003','00000000-0000-4000-8000-000000000003')
on conflict do nothing;

insert into public.course_teachers (course_id, teacher_id) values
('10000000-0000-4000-8000-000000000004','00000000-0000-4000-8000-000000000002'),
('10000000-0000-4000-8000-000000000005','00000000-0000-4000-8000-000000000003'),
('10000000-0000-4000-8000-000000000006','00000000-0000-4000-8000-000000000002')
on conflict do nothing;

-- A graded assignment gives every seeded student a visible marks record.
insert into public.assignments (id, course_id, created_by, title, instructions, max_marks, due_at, allow_late)
values ('20000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000001',
  '00000000-0000-4000-8000-000000000002', 'Computing Fundamentals',
  'Local demo assignment with sample grades.', 100, now() - interval '7 days', true)
on conflict (id) do nothing;

insert into public.submissions
  (assignment_id, student_id, text_answer, submitted_at, is_late, marks_obtained, feedback, graded_by, graded_at)
select '20000000-0000-4000-8000-000000000001'::uuid, p.id,
  'Sample submitted work for the local demo.', now() - interval '5 days', false,
  (60 + (row_number() over (order by p.roll_no)::integer % 41))::numeric(6,2),
  'Sample grade for local demo data.', '00000000-0000-4000-8000-000000000002'::uuid, now() - interval '4 days'
from public.profiles p
where p.role = 'student'
on conflict (assignment_id, student_id) do update set
  marks_obtained = excluded.marks_obtained,
  feedback = excluded.feedback,
  graded_by = excluded.graded_by,
  graded_at = excluded.graded_at;

insert into public.enrollments (course_id, student_id)
select c.id, p.id from public.courses c cross join public.profiles p where p.role = 'student'
on conflict do nothing;

insert into public.attendance_records
  (course_id, student_id, class_date, status, notes, marked_by)
select c.id, p.id, dates.class_date,
  case ((row_number() over (order by c.id, p.id, dates.class_date) - 1) % 10)
    when 4 then 'late' when 7 then 'absent' when 9 then 'excused' else 'present' end,
  'seed:demo', '00000000-0000-4000-8000-000000000002'::uuid
from public.courses c
cross join public.profiles p
cross join (values ('2026-10-19'::date), ('2026-10-21'::date), ('2026-10-26'::date), ('2026-10-28'::date)) as dates(class_date)
where p.role = 'student' and c.code in ('AIT201', 'SE220', 'DS320')
on conflict (course_id, student_id, class_date) do update set
  status = excluded.status, notes = excluded.notes, marked_by = excluded.marked_by;
