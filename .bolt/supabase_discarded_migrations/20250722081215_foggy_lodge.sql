
DROP POLICY IF EXISTS "Allow comprehensive user profile access" ON public.user_profiles;
DROP POLICY IF EXISTS "Simple user profile access" ON public.user_profiles;
DROP POLICY IF EXISTS "Admin full access to profiles" ON public.user_profiles;
DROP POLICY IF EXISTS "Comprehensive user profile access" ON public.user_profiles;

-- Function to check if current user is admin (SECURITY DEFINER to bypass RLS)
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN EXISTS (SELECT 1 FROM public.user_profiles WHERE id = auth.uid() AND role = 'admin');
END;
$$;
ALTER FUNCTION public.is_admin() OWNER TO supabase_admin;
GRANT EXECUTE ON FUNCTION public.is_admin() TO authenticated;

-- Function to get all subordinate IDs (direct and indirect) for a given user (SECURITY DEFINER to bypass RLS)
CREATE OR REPLACE FUNCTION public.get_all_subordinate_ids(p_user_id uuid)
RETURNS SETOF uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    RETURN QUERY
    WITH RECURSIVE subordinates AS (
        -- Anchor member: direct subordinates
        SELECT id
        FROM public.user_profiles
        WHERE manager_id = p_user_id

        UNION ALL

        -- Recursive member: subordinates of subordinates
        SELECT up.id
        FROM public.user_profiles up
        INNER JOIN subordinates s ON up.manager_id = s.id
    )
    SELECT id FROM subordinates;
END;
$$;
ALTER FUNCTION public.get_all_subordinate_ids(uuid) OWNER TO supabase_admin;
GRANT EXECUTE ON FUNCTION public.get_all_subordinate_ids(uuid) TO authenticated;

-- Create a new comprehensive SELECT policy
CREATE POLICY "Allow hierarchical user profile access"
ON public.user_profiles
FOR SELECT TO authenticated
USING (
    -- Admins can see all
    public.is_admin()
    OR
    -- Users can see their own profile
    (id = auth.uid())
    OR
    -- Users can see their direct manager
    (id = (SELECT manager_id FROM public.user_profiles WHERE id = auth.uid()))
    OR
    -- Users can see their direct and indirect subordinates
    (id IN (SELECT public.get_all_subordinate_ids(auth.uid())))
);
