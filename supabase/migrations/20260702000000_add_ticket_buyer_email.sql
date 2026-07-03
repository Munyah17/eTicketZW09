-- Store the buyer's email directly on the ticket row so we can send the
-- PNG ticket by email without depending on the payments.metadata blob.
alter table public.tickets
  add column if not exists buyer_email text not null default '';
