create table public.attendance_records (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references public.courses(id) on delete cascade,
  student_id uuid not null references public.profiles(id) on delete cascade,
  class_date date not null,
  status text not null check (status in ('present', 'absent', 'late', 'excused')),
  notes text,
  marked_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now(),
  unique (course_id, student_id, class_date)
);

create index attendance_student_date_idx on public.attendance_records(student_id, class_date desc);
create index attendance_course_date_idx on public.attendance_records(course_id, class_date desc);
alter table public.attendance_records enable row level security;

create policy attendance_member_read on public.attendance_records for select using (
  public.is_admin() or student_id = auth.uid() or public.teaches(course_id)
);
create policy attendance_staff_write on public.attendance_records for all using (
  public.is_admin() or public.teaches(course_id)
) with check (
  public.is_admin() or public.teaches(course_id)
);
