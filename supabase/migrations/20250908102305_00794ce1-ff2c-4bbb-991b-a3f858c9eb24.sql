-- Fix security vulnerability: Restrict marup_groups SELECT policy
-- Groups should only be visible to owners and members

-- Drop the overly permissive existing policy
DROP POLICY IF EXISTS "groups_select_auth" ON public.marup_groups;

-- Create a secure policy that only allows:
-- 1. Group owners to view their groups
-- 2. Group members to view groups they belong to
CREATE POLICY "groups_select_owner_or_member" 
ON public.marup_groups 
FOR SELECT 
TO authenticated 
USING (
  -- User is the owner of the group
  owner_id = auth.uid()
  OR
  -- User is a member of the group
  EXISTS (
    SELECT 1 
    FROM group_members gm
    WHERE gm.group_id = marup_groups.id 
    AND gm.user_id = auth.uid()
  )
);