-- Create payments table to track all group payments
CREATE TABLE public.payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id UUID NOT NULL,
  user_id UUID NOT NULL,
  stripe_session_id TEXT,
  stripe_subscription_id TEXT,
  amount NUMERIC NOT NULL,
  payment_month INTEGER NOT NULL, -- 1-12 for month
  payment_year INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  payment_date TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;

-- Policies for payments
CREATE POLICY "payments_select_group_member" ON public.payments
FOR SELECT
USING (is_group_member(group_id) OR is_group_owner(group_id));

CREATE POLICY "payments_insert_own" ON public.payments
FOR INSERT
WITH CHECK (user_id = auth.uid());

CREATE POLICY "payments_update_own" ON public.payments
FOR UPDATE
USING (user_id = auth.uid());

-- Create unique constraint to prevent duplicate payments per user per month per group
CREATE UNIQUE INDEX payments_user_month_group_unique 
ON public.payments (user_id, group_id, payment_month, payment_year);

-- Create monthly_notifications table for tracking sent notifications
CREATE TABLE public.monthly_notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id UUID NOT NULL,
  notification_month INTEGER NOT NULL,
  notification_year INTEGER NOT NULL,
  sent_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS for notifications
ALTER TABLE public.monthly_notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "monthly_notifications_select_all" ON public.monthly_notifications
FOR SELECT
USING (true);

CREATE POLICY "monthly_notifications_insert_system" ON public.monthly_notifications
FOR INSERT
WITH CHECK (true);

-- Create unique constraint for monthly notifications
CREATE UNIQUE INDEX monthly_notifications_group_month_unique 
ON public.monthly_notifications (group_id, notification_month, notification_year);