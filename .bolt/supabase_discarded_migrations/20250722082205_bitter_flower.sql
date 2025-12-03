```sql
-- Disable RLS temporarily to drop policies and functions
ALTER TABLE public.user_profiles DISABLE ROW LEVEL SECURITY;

-- Drop existing policies on user_profiles
DROP POLICY IF EXISTS "Allow hierarchical user profile access" ON public.user_profiles;
DROP POLICY IF EXISTS "Users can only see own profile" ON public.user_profiles;
DROP POLICY IF EXISTS "Admins can manage all permissions" ON public.user_permissions;
DROP POLICY IF EXISTS "Managers can read team permissions" ON public.user_permissions;
DROP POLICY IF EXISTS "Users can read their own permissions" ON public.user_permissions;
DROP POLICY IF EXISTS "Admins can manage questions" ON public.lead_questions;
DROP POLICY IF EXISTS "All users can view questions" ON public.lead_questions;
DROP POLICY IF EXISTS "Admins can manage lead statuses" ON public.lead_statuses;
DROP POLICY IF EXISTS "All users can view lead statuses" ON public.lead_statuses;
DROP POLICY IF EXISTS "Only admins can manage API keys" ON public.api_keys;
DROP POLICY IF EXISTS "Users can insert leads" ON public.leads;
DROP POLICY IF EXISTS "Users can update leads they can see" ON public.leads;
DROP POLICY IF EXISTS "Strict lead visibility based on role and assignment" ON public.leads;
DROP POLICY IF EXISTS "Users can insert deposits for leads they manage" ON public.deposits;
DROP POLICY IF EXISTS "Users can view deposits they created or for leads they manage" ON public.deposits;
DROP POLICY IF EXISTS "Users can add answers to leads they manage" ON public.lead_answers;
DROP POLICY IF EXISTS "Users can view answers for leads they manage" ON public.lead_answers;
DROP POLICY IF EXISTS "Allow authenticated users to insert comments" ON public.lead_comments;
DROP POLICY IF EXISTS "Allow authenticated users to read comments" ON public.lead_comments;
DROP POLICY IF EXISTS "Users can add comments to leads they manage" ON public.lead_comments;
DROP POLICY IF EXISTS "Users can delete their own comments or if admin" ON public.lead_comments;
DROP POLICY IF EXISTS "Users can view comments for leads they manage" ON public.lead_comments;
DROP POLICY IF EXISTS "Allow authenticated users to insert activities" ON public.lead_activities;
DROP POLICY IF EXISTS "Allow authenticated users to read activities" ON public.lead_activities;
DROP POLICY IF EXISTS "Admins can view all login logs" ON public.login_logs;
DROP POLICY IF EXISTS "Allow authenticated users to log their own logins" ON public.login_logs;
DROP POLICY IF EXISTS "Managers can view their team's login logs" ON public.login_logs;
DROP POLICY IF EXISTS "Users can view their own login logs" ON public.login_logs;


-- Drop existing functions that might be problematic or are being replaced
DROP FUNCTION IF EXISTS public.get_all_subordinate_ids(uuid);
DROP FUNCTION IF EXISTS public.is_admin(uuid);
DROP FUNCTION IF EXISTS public.can_user_see_lead(public.leads);
DROP FUNCTION IF EXISTS public.can_user_see_deposit(public.deposits);
DROP FUNCTION IF EXISTS public.can_user_see_lead_answer(public.lead_answers);
DROP FUNCTION IF EXISTS public.can_user_see_lead_comment(public.lead_comments);

-- Re-enable RLS
ALTER TABLE public.user_profiles ENABLE ROW LEVEL SECURITY;

-- Create a SECURITY DEFINER function to check if a user is an admin
-- This function runs with the privileges of its owner (e.g., supabase_admin)
-- and can bypass RLS on auth.users to get the role from app_metadata.
CREATE OR REPLACE FUNCTION public.is_admin(user_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    user_role text;
BEGIN
    SELECT raw_app_meta_data->>'role' INTO user_role
    FROM auth.users
    WHERE id = user_id;

    RETURN user_role = 'admin';
END;
$$;

-- Grant execute on the is_admin function to authenticated users
GRANT EXECUTE ON FUNCTION public.is_admin(uuid) TO authenticated;

-- Create a SECURITY DEFINER function to get all subordinate IDs
-- This function recursively finds all subordinates and bypasses RLS on user_profiles
-- because it is SECURITY DEFINER.
CREATE OR REPLACE FUNCTION public.get_all_subordinate_ids(p_user_id uuid)
RETURNS SETOF uuid
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN QUERY
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
    SELECT id FROM subordinates;
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
    public.is_admin(auth.uid()) -- Admins can see all profiles
    OR
    (
        auth.role() IN ('manager', 'desk') AND
        id IN (SELECT public.get_all_subordinate_ids(auth.uid()))
    )
);

-- Re-add other RLS policies that were dropped, ensuring they are compatible
-- with the new user_profiles RLS or handle visibility appropriately.
-- For simplicity, I'm re-adding the original policies here.
-- If any of these cause recursion, they will need similar adjustments.

-- Policies for login_logs
ALTER TABLE public.login_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins can view all login logs" ON public.login_logs FOR SELECT TO authenticated USING ((EXISTS ( SELECT 1 FROM user_profiles WHERE ((user_profiles.id = auth.uid()) AND (user_profiles.role = 'admin'::role_type)))));
CREATE POLICY "Allow authenticated users to log their own logins" ON public.login_logs FOR INSERT TO authenticated WITH CHECK ((user_id = auth.uid()));
CREATE POLICY "Managers can view their team's login logs" ON public.login_logs FOR SELECT TO authenticated USING ((EXISTS ( SELECT 1 FROM user_profiles manager WHERE ((manager.id = auth.uid()) AND (manager.role = 'manager'::role_type) AND (EXISTS ( SELECT 1 FROM user_profiles team WHERE ((team.manager_id = manager.id) AND (team.id = login_logs.user_id))))))));
CREATE POLICY "Users can view their own login logs" ON public.login_logs FOR SELECT TO authenticated USING ((user_id = auth.uid()));

-- Policies for leads
ALTER TABLE public.leads ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Strict lead visibility based on role and assignment" ON public.leads FOR SELECT TO authenticated USING (can_user_see_lead(leads.*));
CREATE POLICY "Users can insert leads" ON public.leads FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Users can update leads they can see" ON public.leads FOR UPDATE TO authenticated USING (can_user_see_lead(leads.*)) WITH CHECK (can_user_see_lead(leads.*));

-- Policies for deposits
ALTER TABLE public.deposits ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can insert deposits for leads they manage" ON public.deposits FOR INSERT TO authenticated WITH CHECK ((EXISTS ( SELECT 1 FROM leads WHERE ((leads.id = deposits.lead_id) AND ((leads.assigned_to = auth.uid()) OR (EXISTS ( SELECT 1 FROM user_profiles WHERE ((user_profiles.id = auth.uid()) AND ((user_profiles.role = 'admin'::role_type) OR ((user_profiles.role = 'manager'::role_type) AND (EXISTS ( SELECT 1 FROM user_profiles agent WHERE ((agent.id = leads.assigned_to) AND (agent.manager_id = user_profiles.id))))))))))))));
CREATE POLICY "Users can view deposits they created or for leads they manage" ON public.deposits FOR SELECT TO authenticated USING (((created_by = auth.uid()) OR (EXISTS ( SELECT 1 FROM leads WHERE ((leads.id = deposits.lead_id) AND ((leads.assigned_to = auth.uid()) OR (EXISTS ( SELECT 1 FROM user_profiles WHERE ((user_profiles.id = auth.uid()) AND ((user_profiles.role = 'admin'::role_type) OR ((user_profiles.role = 'manager'::role_type) AND (EXISTS ( SELECT 1 FROM user_profiles agent WHERE ((agent.id = leads.assigned_to) AND (agent.manager_id = user_profiles.id)))))))))))))));

-- Policies for lead_answers
ALTER TABLE public.lead_answers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can add answers to leads they manage" ON public.lead_answers FOR INSERT TO authenticated WITH CHECK ((EXISTS ( SELECT 1 FROM leads WHERE ((leads.id = lead_answers.lead_id) AND ((leads.assigned_to = auth.uid()) OR (EXISTS ( SELECT 1 FROM user_profiles WHERE ((user_profiles.id = auth.uid()) AND ((user_profiles.role = 'admin'::role_type) OR ((user_profiles.role = 'manager'::role_type) AND (EXISTS ( SELECT 1 FROM user_profiles agent WHERE ((agent.id = leads.assigned_to) AND (agent.manager_id = user_profiles.id))))))))))))));
CREATE POLICY "Users can view answers for leads they manage" ON public.lead_answers FOR SELECT TO authenticated USING ((EXISTS ( SELECT 1 FROM leads WHERE ((leads.id = lead_answers.lead_id) AND ((leads.assigned_to = auth.uid()) OR (EXISTS ( SELECT 1 FROM user_profiles WHERE ((user_profiles.id = auth.uid()) AND ((user_profiles.role = 'admin'::role_type) OR ((user_profiles.role = 'manager'::role_type) AND (EXISTS ( SELECT 1 FROM user_profiles agent WHERE ((agent.id = leads.assigned_to) AND (agent.manager_id = user_profiles.id))))))))))))));

-- Policies for lead_questions
ALTER TABLE public.lead_questions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins can manage questions" ON public.lead_questions FOR ALL TO authenticated USING ((EXISTS ( SELECT 1 FROM user_profiles WHERE ((user_profiles.id = auth.uid()) AND (user_profiles.role = 'admin'::role_type)))));
CREATE POLICY "All users can view questions" ON public.lead_questions FOR SELECT TO authenticated USING (true);

-- Policies for lead_comments
ALTER TABLE public.lead_comments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow authenticated users to insert comments" ON public.lead_comments FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Allow authenticated users to read comments" ON public.lead_comments FOR SELECT TO authenticated USING (true);
CREATE POLICY "Users can add comments to leads they manage" ON public.lead_comments FOR INSERT TO authenticated WITH CHECK ((EXISTS ( SELECT 1 FROM leads WHERE ((leads.id = lead_comments.lead_id) AND ((leads.assigned_to = auth.uid()) OR (EXISTS ( SELECT 1 FROM user_profiles WHERE ((user_profiles.id = auth.uid()) AND ((user_profiles.role = 'admin'::role_type) OR ((user_profiles.role = 'manager'::role_type) AND (EXISTS ( SELECT 1 FROM user_profiles agent WHERE ((agent.id = leads.assigned_to) AND (agent.manager_id = user_profiles.id))))))))))))));
CREATE POLICY "Users can delete their own comments or if admin" ON public.lead_comments FOR DELETE TO authenticated USING (((created_by = auth.uid()) OR (EXISTS ( SELECT 1 FROM user_profiles WHERE ((user_profiles.id = auth.uid()) AND (user_profiles.role = 'admin'::role_type))))));
CREATE POLICY "Users can view comments for leads they manage" ON public.lead_comments FOR SELECT TO authenticated USING ((EXISTS ( SELECT 1 FROM leads WHERE ((leads.id = lead_comments.lead_id) AND ((leads.assigned_to = auth.uid()) OR (EXISTS ( SELECT 1 FROM user_profiles WHERE ((user_profiles.id = auth.uid()) AND ((user_profiles.role = 'admin'::role_type) OR ((user_profiles.role = 'manager'::role_type) AND (EXISTS ( SELECT 1 FROM user_profiles agent WHERE ((agent.id = leads.assigned_to) AND (agent.manager_id = user_profiles.id))))))))))))));

-- Policies for lead_activities
ALTER TABLE public.lead_activities ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow authenticated users to insert activities" ON public.lead_activities FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Allow authenticated users to read activities" ON public.lead_activities FOR SELECT TO authenticated USING (true);

-- Policies for lead_statuses
ALTER TABLE public.lead_statuses ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins can manage lead statuses" ON public.lead_statuses FOR ALL TO authenticated USING ((EXISTS ( SELECT 1 FROM user_profiles WHERE ((user_profiles.id = auth.uid()) AND (user_profiles.role = 'admin'::role_type)))));
CREATE POLICY "All users can view lead statuses" ON public.lead_statuses FOR SELECT TO authenticated USING (true);

-- Policies for user_permissions
ALTER TABLE public.user_permissions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins can manage all permissions" ON public.user_permissions FOR ALL TO authenticated USING ((EXISTS ( SELECT 1 FROM user_profiles WHERE ((user_profiles.id = auth.uid()) AND (user_profiles.role = 'admin'::role_type)))));
CREATE POLICY "Managers can read team permissions" ON public.user_permissions FOR SELECT TO authenticated USING ((EXISTS ( SELECT 1 FROM user_profiles WHERE ((user_profiles.id = auth.uid()) AND (user_profiles.role = 'manager'::role_type) AND (EXISTS ( SELECT 1 FROM user_profiles team WHERE ((team.manager_id = user_profiles.id) AND (team.id = user_permissions.user_id))))))));
CREATE POLICY "Users can read their own permissions" ON public.user_permissions FOR SELECT TO authenticated USING ((user_id = auth.uid()));

-- Policies for api_keys
ALTER TABLE public.api_keys ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Only admins can manage API keys" ON public.api_keys FOR ALL TO authenticated USING ((EXISTS ( SELECT 1 FROM user_profiles WHERE ((user_profiles.id = auth.uid()) AND (user_profiles.role = 'admin'::role_type)))));
```