-- KAEC School Health Check — Supabase schema
-- Run this once in the Supabase SQL editor (or it is created automatically
-- when using DATABASE_URL mode). The app only reads/writes via the service
-- role key, so RLS stays enabled for every other principal.

create extension if not exists pgcrypto;

create table if not exists schools (
  id uuid primary key default gen_random_uuid(),
  school_name text not null,
  contact_name text not null,
  email text not null,
  phone text default '',
  state text default '',
  country text default '',
  school_type text default '',
  school_level text default '',
  student_population text default '',
  staff_population text default '',
  assessment_date timestamptz default now(),
  created_at timestamptz default now()
);

create table if not exists assessments (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references schools(id) on delete cascade,
  overall_score integer,
  health_rating text,
  priority_area text,
  created_at timestamptz default now(),
  completed_at timestamptz
);

create table if not exists answers (
  id uuid primary key default gen_random_uuid(),
  assessment_id uuid not null references assessments(id) on delete cascade,
  question_id text not null,
  chapter text not null,
  score integer not null check (score between 1 and 5),
  answer text default '',
  created_at timestamptz default now(),
  unique (assessment_id, question_id)
);

create table if not exists reports (
  id uuid primary key default gen_random_uuid(),
  assessment_id uuid not null unique references assessments(id) on delete cascade,
  executive_summary text default '',
  strengths jsonb default '[]'::jsonb,
  weaknesses jsonb default '[]'::jsonb,
  recommendations jsonb default '[]'::jsonb,
  ninety_day_plan jsonb default '{}'::jsonb,
  full_report jsonb not null,
  created_at timestamptz default now()
);

create table if not exists contact_requests (
  id uuid primary key default gen_random_uuid(),
  school_name text default '',
  name text default '',
  email text default '',
  phone text default '',
  request_type text default 'talk',
  message text default '',
  created_at timestamptz default now()
);

-- Anonymous statistics only: no school identifiers by design.
create table if not exists analytics (
  id uuid primary key default gen_random_uuid(),
  state text default '',
  country text default '',
  school_type text default '',
  overall_score integer,
  chapter_scores jsonb default '{}'::jsonb,
  completion_seconds integer default 0,
  created_at timestamptz default now()
);

create table if not exists email_log (
  id uuid primary key default gen_random_uuid(),
  to_email text not null,
  subject text not null,
  status text default 'queued',
  detail text default '',
  created_at timestamptz default now()
);

create index if not exists idx_answers_assessment on answers (assessment_id);
create index if not exists idx_assessments_school on assessments (school_id);
create index if not exists idx_analytics_state on analytics (state);

-- Lock everything down: the app talks to these tables with the service role
-- key, which bypasses RLS. No public access is ever granted.
alter table schools enable row level security;
alter table assessments enable row level security;
alter table answers enable row level security;
alter table reports enable row level security;
alter table contact_requests enable row level security;
alter table analytics enable row level security;
alter table email_log enable row level security;
