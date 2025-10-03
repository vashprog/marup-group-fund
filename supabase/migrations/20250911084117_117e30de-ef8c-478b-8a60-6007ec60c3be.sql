-- Add duration_months field to marup_groups table
ALTER TABLE public.marup_groups 
ADD COLUMN duration_months INTEGER DEFAULT 12;