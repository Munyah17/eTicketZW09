-- New enum value in its own migration: Postgres can't use a freshly-added
-- enum value in the same transaction that adds it.
ALTER TYPE public.event_status ADD VALUE IF NOT EXISTS 'pending_review';
