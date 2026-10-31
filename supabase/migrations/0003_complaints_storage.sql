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
