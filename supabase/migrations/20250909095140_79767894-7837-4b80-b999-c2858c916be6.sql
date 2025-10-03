-- Fix infinite recursion in RLS policies by creating security definer functions

-- Create function to check if user is member of a group
CREATE OR REPLACE FUNCTION public.is_group_member(group_id_param uuid, user_id_param uuid DEFAULT auth.uid())
RETURNS boolean AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.group_members 
    WHERE group_id = group_id_param AND user_id = user_id_param
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Create function to check if user is group owner
CREATE OR REPLACE FUNCTION public.is_group_owner(group_id_param uuid, user_id_param uuid DEFAULT auth.uid())
RETURNS boolean AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.marup_groups 
    WHERE id = group_id_param AND owner_id = user_id_param
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Drop and recreate group_members policies to fix infinite recursion
DROP POLICY IF EXISTS "group_members_select_member" ON public.group_members;
CREATE POLICY "group_members_select_member" ON public.group_members
FOR SELECT USING (
  public.is_group_member(group_id) OR public.is_group_owner(group_id)
);

-- Update other policies that reference group_members to use the new functions
DROP POLICY IF EXISTS "contributions_select_member" ON public.contributions;
CREATE POLICY "contributions_select_member" ON public.contributions
FOR SELECT USING (
  public.is_group_member(group_id) OR public.is_group_owner(group_id)
);

DROP POLICY IF EXISTS "group_rounds_select_member" ON public.group_rounds;
CREATE POLICY "group_rounds_select_member" ON public.group_rounds
FOR SELECT USING (
  public.is_group_member(group_id) OR public.is_group_owner(group_id)
);

DROP POLICY IF EXISTS "payouts_select_member" ON public.payouts;
CREATE POLICY "payouts_select_member" ON public.payouts
FOR SELECT USING (
  public.is_group_member(group_id) OR public.is_group_owner(group_id)
);

-- Fix profiles policy that also references group_members
DROP POLICY IF EXISTS "profiles_select_own_or_groupmates" ON public.profiles;
CREATE POLICY "profiles_select_own_or_groupmates" ON public.profiles
FOR SELECT USING (
  id = auth.uid() OR 
  EXISTS (
    SELECT 1 FROM public.group_members gm1 
    JOIN public.group_members gm2 ON gm1.group_id = gm2.group_id
    WHERE gm1.user_id = auth.uid() AND gm2.user_id = profiles.id
  )
);