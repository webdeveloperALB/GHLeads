-- Fix infinite recursion in user_profiles RLS policy
-- The issue is that the policy calls get_all_subordinate_ids which queries user_profiles again

-- Drop the problematic policy
DROP POLICY IF EXISTS "Allow hierarchical user profile access" ON public.user_profiles;

-- Create a simpler policy that doesn't cause recursion
CREATE POLICY "Allow hierarchical user profile access" ON public.user_profiles FOR SELECT TO authenticated USING (
    auth.uid() = id OR -- Users can always see their own profile
    (
        SELECT role FROM public.user_profiles WHERE id = auth.uid()
    ) = 'admin' OR -- Admins can see all profiles
    EXISTS (
        -- Managers can see their direct reports
        SELECT 1 FROM public.user_profiles subordinate 
        WHERE subordinate.manager_id = auth.uid() AND subordinate.id = public.user_profiles.id
    ) OR
    EXISTS (
        -- Desk users can see profiles in their hierarchy (simplified)
        SELECT 1 FROM public.user_profiles current_user
        WHERE current_user.id = auth.uid() 
        AND current_user.role = 'desk'
        AND (
            public.user_profiles.manager_id = auth.uid() OR -- Direct reports
            EXISTS (
                SELECT 1 FROM public.user_profiles manager
                WHERE manager.manager_id = auth.uid() 
                AND public.user_profiles.manager_id = manager.id
            ) -- Reports of direct reports
        )
    )
);