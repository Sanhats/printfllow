-- PrintFlow: esquema inicial para Supabase
create table if not exists public.print_jobs (
  id text primary key,
  filename text not null,
  storage_path text not null,
  copies integer not null default 1 check (copies between 1 and 99),
  status text not null default 'PENDING' check (status in ('PENDING','PRINTING','COMPLETED','FAILED','CANCELLED')),
  error_message text,
  created_at timestamptz not null default now(),
  started_at timestamptz,
  completed_at timestamptz
);

create index if not exists print_jobs_status_created_idx on public.print_jobs(status, created_at desc);

-- Para el MVP personal, el backend usa la service role key y no expone esta tabla al navegador.
alter table public.print_jobs enable row level security;
