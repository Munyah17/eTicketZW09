CREATE TYPE public.support_ticket_type AS ENUM ('payment', 'refund', 'account', 'organizer', 'ticket', 'general');
CREATE TYPE public.support_priority AS ENUM ('low', 'medium', 'high');
CREATE TYPE public.support_status AS ENUM ('open', 'in_progress', 'resolved', 'closed');

CREATE TABLE public.support_tickets (
  id uuid PRIMARY KEY DEFAULT extensions.uuid_generate_v4(),
  user_id uuid REFERENCES public.profiles(id),
  name text NOT NULL,
  email text NOT NULL,
  type public.support_ticket_type NOT NULL DEFAULT 'general',
  priority public.support_priority NOT NULL DEFAULT 'medium',
  status public.support_status NOT NULL DEFAULT 'open',
  subject text NOT NULL,
  message text NOT NULL DEFAULT '',
  resolved_at timestamptz,
  resolved_by uuid REFERENCES public.profiles(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_support_status ON public.support_tickets (status);
CREATE INDEX idx_support_user ON public.support_tickets (user_id);

CREATE TRIGGER support_tickets_updated_at BEFORE UPDATE ON public.support_tickets
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

ALTER TABLE public.support_tickets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can submit a support ticket" ON public.support_tickets
  FOR INSERT WITH CHECK (true);
CREATE POLICY "Admin reads support tickets" ON public.support_tickets
  FOR SELECT USING (is_admin());
CREATE POLICY "Admin updates support tickets" ON public.support_tickets
  FOR UPDATE USING (is_admin());
CREATE POLICY "User reads own support tickets" ON public.support_tickets
  FOR SELECT USING (user_id = auth.uid());
