-- Fix for Manager/Desk Visibility Issues
-- Apply this SQL directly in your Supabase SQL Editor

-- First, drop existing policies and functions that need to be updated
DROP POLICY IF EXISTS "Strict lead visibility based on role and assignment" ON public.leads;
DROP POLICY IF EXISTS "Allow hierarchical user profile access" ON public.user_profiles;
DROP FUNCTION IF EXISTS public.can_user_see_lead(public.leads);

-- Create the can_user_see_lead function with proper hierarchical logic
CREATE OR REPLACE FUNCTION public.can_user_see_lead(lead_record public.leads)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    current_user_id uuid;
    current_user_role text;
    subordinate_ids uuid[];
BEGIN
    -- Get current user ID
    current_user_id := auth.uid();
    
    -- If no user is authenticated, deny access
    IF current_user_id IS NULL THEN
        RETURN false;
    END IF;
    
    -- Get current user's role
    SELECT role INTO current_user_role
    FROM public.user_profiles
    WHERE id = current_user_id;
    
    -- If user profile not found, deny access
    IF current_user_role IS NULL THEN
        RETURN false;
    END IF;
    
    -- Admin can see all leads
    IF current_user_role = 'admin' THEN
        RETURN true;
    END IF;
    
    -- User can see leads assigned to them
    IF lead_record.assigned_to = current_user_id THEN
        RETURN true;
    END IF;
    
    -- Managers and desk users can see leads assigned to their subordinates
    IF current_user_role IN ('manager', 'desk') THEN
        -- Get all subordinate IDs (direct and indirect)
        subordinate_ids := public.get_all_subordinate_ids(current_user_id);
        
        -- Check if the lead is assigned to any subordinate
        IF lead_record.assigned_to = ANY(subordinate_ids) THEN
            RETURN true;
        END IF;
        
        -- Also check for unassigned leads (NULL assigned_to)
        -- Managers/desk can see unassigned leads to assign them
        IF lead_record.assigned_to IS NULL THEN
            RETURN true;
        END IF;
    END IF;
    
    -- Default: deny access
    RETURN false;
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION public.can_user_see_lead(public.leads) TO authenticated;

-- Create RLS policy for leads using the function
CREATE POLICY "Strict lead visibility based on role and assignment"
ON public.leads
FOR SELECT
TO authenticated
USING (public.can_user_see_lead(leads));

-- Create RLS policy for user_profiles with hierarchical access
CREATE POLICY "Allow hierarchical user profile access"
ON public.user_profiles
FOR SELECT
TO authenticated
USING (
    -- Users can see their own profile
    id = auth.uid()
    OR
    -- Admins can see all profiles
    EXISTS (
        SELECT 1 FROM public.user_profiles admin_user
        WHERE admin_user.id = auth.uid() 
        AND admin_user.role = 'admin'
    )
    OR
    -- Managers and desk users can see their subordinates
    EXISTS (
        SELECT 1 FROM public.user_profiles manager_user
        WHERE manager_user.id = auth.uid()
        AND manager_user.role IN ('manager', 'desk')
        AND user_profiles.id = ANY(public.get_all_subordinate_ids(auth.uid()))
    )
);

-- Ensure RLS is enabled on both tables
ALTER TABLE public.leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_profiles ENABLE ROW LEVEL SECURITY;