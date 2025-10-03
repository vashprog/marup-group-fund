-- Fix security vulnerability: Restrict profiles SELECT policy
-- Users should only see their own profile or profiles of group members they share groups with

-- Drop the overly permissive existing policy
DROP POLICY IF EXISTS "profiles_select" ON public.profiles;

-- Create a secure policy that only allows:
-- 1. Users to view their own profile
-- 2. Users to view profiles of other members in groups they both belong to
CREATE POLICY "profiles_select_own_or_groupmates" 
ON public.profiles 
FOR SELECT 
TO authenticated 
USING (
  -- User can see their own profile
  id = auth.uid()
  OR
  -- User can see profiles of people in the same groups
  EXISTS (
    SELECT 1 
    FROM group_members gm1 
    JOIN group_members gm2 ON gm1.group_id = gm2.group_id
    WHERE gm1.user_id = auth.uid() 
    AND gm2.user_id = profiles.id
  )
);