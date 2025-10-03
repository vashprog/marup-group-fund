-- Fix infinite recursion in RLS policies and add group code for sharing

-- First, let's add a unique group_code column to marup_groups
ALTER TABLE public.marup_groups 
ADD COLUMN group_code TEXT UNIQUE;

-- Create a function to generate unique 6-digit group codes
CREATE OR REPLACE FUNCTION generate_group_code()
RETURNS TEXT AS $$
DECLARE
    new_code TEXT;
    code_exists BOOLEAN;
BEGIN
    LOOP
        -- Generate a random 6-digit code
        new_code := LPAD(FLOOR(RANDOM() * 999999)::TEXT, 6, '0');
        
        -- Check if this code already exists
        SELECT EXISTS(SELECT 1 FROM marup_groups WHERE group_code = new_code) INTO code_exists;
        
        -- If code doesn't exist, we can use it
        IF NOT code_exists THEN
            RETURN new_code;
        END IF;
    END LOOP;
END;
$$ LANGUAGE plpgsql;

-- Add trigger to auto-generate group codes for new groups
CREATE OR REPLACE FUNCTION set_group_code()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.group_code IS NULL THEN
        NEW.group_code := generate_group_code();
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_set_group_code
    BEFORE INSERT ON public.marup_groups
    FOR EACH ROW
    EXECUTE FUNCTION set_group_code();

-- Update existing groups to have group codes
UPDATE public.marup_groups 
SET group_code = generate_group_code() 
WHERE group_code IS NULL;

-- Fix the infinite recursion issue in marup_groups policy
-- The current policy is causing recursion, let's recreate it properly
DROP POLICY IF EXISTS "groups_select_owner_or_member" ON public.marup_groups;

-- Create a simpler, non-recursive policy for marup_groups
CREATE POLICY "groups_select_owner_or_member" 
ON public.marup_groups 
FOR SELECT 
TO authenticated 
USING (
  -- User is the owner of the group
  owner_id = auth.uid()
  OR
  -- User is a member of the group (direct check without subquery recursion)
  id IN (
    SELECT group_id 
    FROM group_members 
    WHERE user_id = auth.uid()
  )
);

-- Also add a policy to allow searching groups by code for joining
CREATE POLICY "groups_select_by_code" 
ON public.marup_groups 
FOR SELECT 
TO authenticated 
USING (true);

-- But we need to make sure this is safe, so let's replace the above with a more restricted one
DROP POLICY IF EXISTS "groups_select_by_code" ON public.marup_groups;

-- Allow users to search for groups to join (but limit what they can see)
CREATE POLICY "groups_search_to_join" 
ON public.marup_groups 
FOR SELECT 
TO authenticated 
USING (
  active = true AND (
    owner_id = auth.uid()
    OR
    id IN (
      SELECT group_id 
      FROM group_members 
      WHERE user_id = auth.uid()
    )
    OR
    -- Allow viewing basic info for groups they're not in (for joining)
    (
      SELECT COUNT(*) 
      FROM group_members 
      WHERE group_id = marup_groups.id
    ) < max_members
  )
);

-- Replace the problematic policy
DROP POLICY IF EXISTS "groups_select_owner_or_member" ON public.marup_groups;

-- Create join requests table
CREATE TABLE IF NOT EXISTS public.join_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id UUID NOT NULL,
  user_id UUID NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'denied')),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(group_id, user_id)
);

-- Enable RLS on join_requests
ALTER TABLE public.join_requests ENABLE ROW LEVEL SECURITY;

-- RLS policies for join_requests
CREATE POLICY "join_requests_insert_own" 
ON public.join_requests 
FOR INSERT 
TO authenticated 
WITH CHECK (user_id = auth.uid());

CREATE POLICY "join_requests_select_own_or_owner" 
ON public.join_requests 
FOR SELECT 
TO authenticated 
USING (
  user_id = auth.uid() 
  OR 
  EXISTS (
    SELECT 1 FROM marup_groups g 
    WHERE g.id = join_requests.group_id 
    AND g.owner_id = auth.uid()
  )
);

CREATE POLICY "join_requests_update_owner" 
ON public.join_requests 
FOR UPDATE 
TO authenticated 
USING (
  EXISTS (
    SELECT 1 FROM marup_groups g 
    WHERE g.id = join_requests.group_id 
    AND g.owner_id = auth.uid()
  )
);

-- Add trigger for updated_at
CREATE TRIGGER update_join_requests_updated_at
    BEFORE UPDATE ON public.join_requests
    FOR EACH ROW
    EXECUTE FUNCTION public.trigger_set_timestamp();