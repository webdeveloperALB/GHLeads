-- Disable RLS temporarily to drop policies and functions
ALTER TABLE public.user_profiles DISABLE ROW LEVEL SECURITY;

-- Drop existing policies on user_profiles
DROP POLICY IF EXISTS "Allow hierarchical user profile access" ON public.user_profiles;
DROP POLICY IF EXISTS "Users can only see own profile" ON public.user_profiles;
DROP POLICY IF EXISTS "Users can create profiles" ON public.user_profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON public.user_profiles;

-- Drop existing functions that might be problematic or are being replaced
DROP FUNCTION IF EXISTS public.get_all_subordinate_ids(uuid);
DROP FUNCTION IF EXISTS public.is_admin();
DROP FUNCTION IF EXISTS public.can_user_see_lead(public.leads);

-- Re-enable RLS
ALTER TABLE public.user_profiles ENABLE ROW LEVEL SECURITY;

-- Create a SECURITY DEFINER function to check if a user is an admin
-- This function runs with the privileges of its owner (e.g., supabase_admin)
-- and can bypass RLS to safely check user roles
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    user_role role_type;
BEGIN
    SELECT role INTO user_role
    FROM public.user_profiles
    WHERE id = auth.uid();

    RETURN user_role = 'admin';
EXCEPTION
    WHEN OTHERS THEN
        RETURN false;
END;
$$;

-- Grant execute on the is_admin function to authenticated users
GRANT EXECUTE ON FUNCTION public.is_admin() TO authenticated;

-- Create a SECURITY DEFINER function to get all subordinate IDs
-- This function recursively finds all subordinates and bypasses RLS on user_profiles
-- because it is SECURITY DEFINER.
CREATE OR REPLACE FUNCTION public.get_all_subordinate_ids(p_user_id uuid)
RETURNS uuid[]
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    subordinate_ids uuid[];
BEGIN
    WITH RECURSIVE subordinates AS (
        -- Anchor member: direct reports of the given user
        SELECT id, manager_id
        FROM public.user_profiles
        WHERE manager_id = p_user_id
        UNION ALL
        -- Recursive member: find reports of the subordinates found so far
        SELECT up.id, up.manager_id
        FROM public.user_profiles up
        INNER JOIN subordinates s ON up.manager_id = s.id
    )
    SELECT array_agg(id) INTO subordinate_ids FROM subordinates;
    
    RETURN COALESCE(subordinate_ids, ARRAY[]::uuid[]);
EXCEPTION
    WHEN OTHERS THEN
        RETURN ARRAY[]::uuid[];
END;
$$;

-- Grant execute on the get_all_subordinate_ids function to authenticated users
GRANT EXECUTE ON FUNCTION public.get_all_subordinate_ids(uuid) TO authenticated;

-- RLS Policy for user_profiles table
-- This policy allows:
-- 1. A user to see their own profile.
-- 2. Admins to see all user profiles (using the is_admin SECURITY DEFINER function).
-- 3. Managers and Desk users to see their direct and indirect subordinates
--    (using the get_all_subordinate_ids SECURITY DEFINER function).
CREATE POLICY "Allow hierarchical user profile access"
ON public.user_profiles
FOR SELECT
TO authenticated
USING (
    (id = auth.uid()) -- User can see their own profile
    OR
    public.is_admin() -- Admins can see all profiles
    OR
    (id = ANY(public.get_all_subordinate_ids(auth.uid()))) -- Managers can see subordinates
);

-- Re-add the other user_profiles policies
CREATE POLICY "Users can create profiles" ON public.user_profiles FOR INSERT TO authenticated WITH CHECK ((auth.uid() = id));
CREATE POLICY "Users can update own profile" ON public.user_profiles FOR UPDATE TO authenticated USING ((auth.uid() = id)) WITH CHECK ((auth.uid() = id));