-- Fix function security issues by setting search_path

-- Fix generate_group_code function
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
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE SET search_path = public;

-- Fix set_group_code function
CREATE OR REPLACE FUNCTION set_group_code()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.group_code IS NULL THEN
        NEW.group_code := generate_group_code();
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;