-- Add user_id field to profiles for unique user IDs and create necessary tables

-- Update profiles table to include a unique user_id field
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS user_id TEXT UNIQUE;

-- Create function to generate unique user IDs
CREATE OR REPLACE FUNCTION public.generate_user_id()
RETURNS TEXT AS $$
DECLARE
    new_id TEXT;
    id_exists BOOLEAN;
BEGIN
    LOOP
        -- Generate a random 8-character alphanumeric ID
        new_id := UPPER(SUBSTRING(MD5(RANDOM()::TEXT), 1, 8));
        
        -- Check if this ID already exists
        SELECT EXISTS(SELECT 1 FROM public.profiles WHERE user_id = new_id) INTO id_exists;
        
        -- If ID doesn't exist, we can use it
        IF NOT id_exists THEN
            RETURN new_id;
        END IF;
    END LOOP;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Create trigger to auto-generate user_id for new profiles
CREATE OR REPLACE FUNCTION public.set_user_id()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.user_id IS NULL THEN
        NEW.user_id := generate_user_id();
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Create trigger for profiles
DROP TRIGGER IF EXISTS trigger_set_user_id ON public.profiles;
CREATE TRIGGER trigger_set_user_id
    BEFORE INSERT ON public.profiles
    FOR EACH ROW
    EXECUTE FUNCTION public.set_user_id();

-- Create messages table for group and private chats
CREATE TABLE IF NOT EXISTS public.messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    sender_id UUID NOT NULL,
    recipient_id UUID NULL, -- NULL for group messages
    group_id UUID NULL, -- NULL for private messages
    content TEXT NOT NULL,
    message_type TEXT NOT NULL DEFAULT 'text', -- text, image, file
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    
    -- Ensure either recipient_id or group_id is set, but not both
    CONSTRAINT check_message_target CHECK (
        (recipient_id IS NOT NULL AND group_id IS NULL) OR
        (recipient_id IS NULL AND group_id IS NOT NULL)
    )
);

-- Enable RLS on messages
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;

-- Create policies for messages
CREATE POLICY "messages_select_participant" ON public.messages
FOR SELECT USING (
    sender_id = auth.uid() OR
    recipient_id = auth.uid() OR
    (group_id IS NOT NULL AND (is_group_member(group_id) OR is_group_owner(group_id)))
);

CREATE POLICY "messages_insert_own" ON public.messages
FOR INSERT WITH CHECK (
    sender_id = auth.uid() AND
    (recipient_id IS NOT NULL OR 
     (group_id IS NOT NULL AND (is_group_member(group_id) OR is_group_owner(group_id))))
);

-- Create notifications table
CREATE TABLE IF NOT EXISTS public.notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,
    type TEXT NOT NULL, -- join_request, message, group_invite, etc.
    title TEXT NOT NULL,
    content TEXT NOT NULL,
    data JSONB NULL, -- Additional data for the notification
    read BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on notifications
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- Create policies for notifications
CREATE POLICY "notifications_select_own" ON public.notifications
FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "notifications_update_own" ON public.notifications
FOR UPDATE USING (user_id = auth.uid());

CREATE POLICY "notifications_insert_system" ON public.notifications
FOR INSERT WITH CHECK (true); -- Allow system to create notifications

-- Update join_requests table to include requester profile info
ALTER TABLE public.join_requests ADD COLUMN IF NOT EXISTS requester_user_id TEXT;

-- Create function to get profile by user_id
CREATE OR REPLACE FUNCTION public.get_profile_by_user_id(target_user_id TEXT)
RETURNS TABLE(id UUID, full_name TEXT, user_id TEXT) AS $$
BEGIN
    RETURN QUERY
    SELECT p.id, p.full_name, p.user_id
    FROM public.profiles p
    WHERE p.user_id = target_user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Create function to handle join request creation with notification
CREATE OR REPLACE FUNCTION public.create_join_request(
    target_group_id UUID,
    requester_id UUID DEFAULT auth.uid()
)
RETURNS JSONB AS $$
DECLARE
    group_owner_id UUID;
    requester_profile RECORD;
    group_name TEXT;
    request_id UUID;
BEGIN
    -- Get group owner and group name
    SELECT owner_id, name INTO group_owner_id, group_name
    FROM public.marup_groups
    WHERE id = target_group_id;
    
    IF group_owner_id IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'Group not found');
    END IF;
    
    -- Get requester profile
    SELECT * INTO requester_profile
    FROM public.profiles
    WHERE id = requester_id;
    
    -- Create join request
    INSERT INTO public.join_requests (group_id, user_id, status, requester_user_id)
    VALUES (target_group_id, requester_id, 'pending', requester_profile.user_id)
    RETURNING id INTO request_id;
    
    -- Create notification for group owner
    INSERT INTO public.notifications (user_id, type, title, content, data)
    VALUES (
        group_owner_id,
        'join_request',
        'New Join Request',
        requester_profile.full_name || ' wants to join ' || group_name,
        jsonb_build_object(
            'group_id', target_group_id,
            'request_id', request_id,
            'requester_id', requester_id,
            'requester_name', requester_profile.full_name
        )
    );
    
    RETURN jsonb_build_object('success', true, 'request_id', request_id);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Create trigger for message timestamps
CREATE TRIGGER update_messages_updated_at
    BEFORE UPDATE ON public.messages
    FOR EACH ROW
    EXECUTE FUNCTION public.trigger_set_timestamp();

-- Create trigger for notification timestamps
CREATE TRIGGER update_notifications_updated_at
    BEFORE UPDATE ON public.notifications
    FOR EACH ROW
    EXECUTE FUNCTION public.trigger_set_timestamp();