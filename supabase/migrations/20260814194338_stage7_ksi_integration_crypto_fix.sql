-- Production migration 20260814194338 repaired pgcrypto lookup under the hardened
-- SECURITY DEFINER search_path. The canonical Stage 7 foundation migration in this
-- repository already uses the portable qualified forms below for fresh environments:
--   extensions.gen_random_bytes(...)
--   extensions.digest(...)
--
-- The production database received the equivalent CREATE OR REPLACE definitions at
-- this migration version. This file preserves that migration lineage without
-- reintroducing the transient unqualified-function defect into new environments.
select 1;
