-- Más sistemas de selección con API pública (Workable, Recruitee, SmartRecruiters, Personio).
alter table public.source_companies drop constraint if exists source_companies_ats_check;
alter table public.source_companies add constraint source_companies_ats_check
  check (ats in ('greenhouse','lever','ashby','workable','recruitee','smartrecruiters','personio'));
