-- SaleTrener branch foundation. REVIEW ONLY: do not run in production before policy audit.
begin;
create table if not exists public.company_branches (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  name text not null check (length(btrim(name)) between 1 and 120),
  created_at timestamptz not null default now(),
  unique(company_id,id),
  unique(company_id,name)
);
create table if not exists public.company_branch_members (
  company_id uuid not null,
  branch_id uuid not null,
  user_id uuid not null references auth.users(id) on delete cascade,
  branch_role text not null default 'employee' check (branch_role in ('employee','branch_director')),
  created_at timestamptz not null default now(),
  primary key(company_id,user_id),
  foreign key(company_id,branch_id) references public.company_branches(company_id,id) on delete cascade,
  foreign key(company_id,user_id) references public.organization_members(company_id,user_id)
);
-- Requires checking whether organization_members(company_id,user_id) is UNIQUE before applying.
-- No RLS policies are enabled here intentionally: these tables must remain inaccessible to
-- browser roles until secured RPC and complete RLS policy audit are ready.
alter table public.company_branches enable row level security;
alter table public.company_branch_members enable row level security;
commit;
