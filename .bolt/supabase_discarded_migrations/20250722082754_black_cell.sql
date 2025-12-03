```sql
-- Disable RLS temporarily to drop policies and functions
ALTER TABLE public.user_profiles DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.leads DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.deposits DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.lead_answers DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.lead_comments DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.lead_questions DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.api_keys DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_permissions DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.login_logs DISABLE ROW LEVEL SECURITY;

-- Drop existing triggers that depend on functions we will drop/recreate
DROP TRIGGER IF EXISTS on_user_profile_role_change ON public.user_profiles;
DROP TRIGGER IF EXISTS on_user_delete ON public.user_profiles;
DROP TRIGGER IF EXISTS update_lead_deposit_status ON public.deposits;
DROP TRIGGER IF EXISTS update_user_permissions_updated_at ON public.user_permissions;

-- Drop existing policies
DROP POLICY IF EXISTS "Admins can view all login logs" ON public.login_logs;
DROP POLICY IF EXISTS "Allow authenticated users to log their own logins" ON public.login_logs;
DROP POLICY IF EXISTS "Managers can view their team's login logs" ON public.login_logs;
DROP POLICY IF EXISTS "Users can view their own login logs" ON public.login_logs;
DROP POLICY IF EXISTS "Strict lead visibility based on role and assignment" ON public.leads;
DROP POLICY IF EXISTS "Users can insert leads" ON public.leads;
DROP POLICY IF EXISTS "Users can update leads they can see" ON public.leads;
DROP POLICY IF EXISTS "Users can insert deposits for leads they manage" ON public.deposits;
DROP POLICY IF EXISTS "Users can view deposits they created or for leads they manage" ON public.deposits;
DROP POLICY IF EXISTS "Users can add answers to leads they manage" ON public.lead_answers;
DROP POLICY IF EXISTS "Users can view answers for leads they manage" ON public.lead_answers;
DROP POLICY IF EXISTS "Admins can manage questions" ON public.lead_questions;
DROP POLICY IF EXISTS "All users can view questions" ON public.lead_questions;
DROP POLICY IF EXISTS "Allow authenticated users to insert comments" ON public.lead_comments;
DROP POLICY IF EXISTS "Allow authenticated users to read comments" ON public.lead_comments;
DROP POLICY IF EXISTS "Users can add comments to leads they manage" ON public.lead_comments;
DROP POLICY IF EXISTS "Users can delete their own comments or if admin" ON public.lead_comments;
DROP POLICY IF EXISTS "Users can view comments for leads they manage" ON public.lead_comments;
DROP POLICY IF EXISTS "Users can create profiles" ON public.user_profiles;
DROP POLICY IF EXISTS "Users can only see own profile" ON public.user_profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON public.user_profiles;
DROP POLICY IF EXISTS "Only admins can manage API keys" ON public.api_keys;
DROP POLICY IF EXISTS "Admins can manage all permissions" ON public.user_permissions;
DROP POLICY IF EXISTS "Managers can read team permissions" ON public.user_permissions;
DROP POLICY IF EXISTS "Users can read their own permissions" ON public.user_permissions;
DROP POLICY IF EXISTS "Allow authenticated users to insert activities" ON public.lead_activities;
DROP POLICY IF EXISTS "Allow authenticated users to read activities" ON public.lead_activities;
DROP POLICY IF EXISTS "Admins can manage lead statuses" ON public.lead_statuses;
DROP POLICY IF EXISTS "All users can view lead statuses" ON public.lead_statuses;

-- Drop existing functions
DROP FUNCTION IF EXISTS public.update_auth_user_role();
DROP FUNCTION IF EXISTS public.handle_deleted_user();
DROP FUNCTION IF EXISTS public.update_lead_deposit_status();
DROP FUNCTION IF EXISTS public.update_updated_at_column();
DROP FUNCTION IF EXISTS public.is_admin CASCADE;
DROP FUNCTION IF EXISTS public.get_all_subordinate_ids CASCADE;
DROP FUNCTION IF EXISTS public.can_user_see_lead CASCADE;

-- Create or replace functions
CREATE OR REPLACE FUNCTION public.is_admin(user_id uuid)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
BEGIN
  RETURN EXISTS (SELECT 1 FROM public.user_profiles WHERE id = user_id AND role = 'admin');
END;
$function$;

CREATE OR REPLACE FUNCTION public.get_all_subordinate_ids(p_user_id uuid)
 RETURNS SETOF uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
BEGIN
  RETURN QUERY
  WITH RECURSIVE subordinates AS (
    SELECT id, manager_id
    FROM public.user_profiles
    WHERE manager_id = p_user_id -- Direct subordinates
    UNION ALL
    SELECT up.id, up.manager_id
    FROM public.user_profiles up
    JOIN subordinates s ON up.manager_id = s.id
  )
  SELECT id FROM subordinates;
END;
$function$;

CREATE OR REPLACE FUNCTION public.can_user_see_lead(lead_row public.leads)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
  user_role public.role_type;
  current_user_id uuid := auth.uid();
BEGIN
  -- Get the current user's role
  SELECT role INTO user_role FROM public.user_profiles WHERE id = current_user_id;

  -- Admins can see all leads
  IF user_role = 'admin' THEN
    RETURN TRUE;
  END IF;

  -- Users can see leads assigned to them
  IF lead_row.assigned_to = current_user_id THEN
    RETURN TRUE;
  END IF;

  -- Managers and Desk users can see leads assigned to their subordinates
  IF user_role IN ('manager', 'desk') THEN
    RETURN EXISTS (
      SELECT 1
      FROM public.get_all_subordinate_ids(current_user_id) AS sub_id
      WHERE sub_id = lead_row.assigned_to
    );
  END IF;

  RETURN FALSE;
END;
$function$;

-- Recreate the functions that were dropped (if they exist in the schema)
CREATE OR REPLACE FUNCTION public.update_auth_user_role()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
BEGIN
  IF NEW.role IS DISTINCT FROM OLD.role THEN
    -- Update the auth.users table's app_metadata
    UPDATE auth.users
    SET raw_app_meta_data = raw_app_meta_data || jsonb_build_object('role', NEW.role)
    WHERE id = NEW.id;
  END IF;
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.handle_deleted_user()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
BEGIN
  -- Delete the corresponding auth.users entry
  DELETE FROM auth.users WHERE id = OLD.id;
  RETURN OLD;
END;
$function$;

CREATE OR REPLACE FUNCTION public.update_lead_deposit_status()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
BEGIN
  -- Update the total_deposits and has_deposited fields in the leads table
  UPDATE public.leads
  SET
    total_deposits = (SELECT COALESCE(SUM(amount), 0) FROM public.deposits WHERE lead_id = NEW.lead_id),
    has_deposited = TRUE
  WHERE id = NEW.lead_id;
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$function$;

-- Grant execute permissions on functions
GRANT EXECUTE ON FUNCTION public.is_admin(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_all_subordinate_ids(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.can_user_see_lead(public.leads) TO authenticated;
GRANT EXECUTE ON FUNCTION public.update_auth_user_role() TO authenticated;
GRANT EXECUTE ON FUNCTION public.handle_deleted_user() TO authenticated;
GRANT EXECUTE ON FUNCTION public.update_lead_deposit_status() TO authenticated;
GRANT EXECUTE ON FUNCTION public.update_updated_at_column() TO authenticated;

-- Re-enable RLS and apply policies
ALTER TABLE public.user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.deposits ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lead_answers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lead_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lead_questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.api_keys ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.login_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lead_statuses ENABLE ROW LEVEL SECURITY; -- Ensure this is also enabled

-- Policies for login_logs
CREATE POLICY "Admins can view all login logs" ON public.login_logs FOR SELECT TO authenticated USING (public.is_admin(auth.uid()));
CREATE POLICY "Allow authenticated users to log their own logins" ON public.login_logs FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "Managers can view their team's login logs" ON public.login_logs FOR SELECT TO authenticated USING (EXISTS ( SELECT 1 FROM user_profiles manager WHERE ((manager.id = auth.uid()) AND (manager.role = 'manager'::role_type) AND (EXISTS ( SELECT 1 FROM user_profiles team WHERE ((team.manager_id = manager.id) AND (team.id = login_logs.user_id)))))));
CREATE POLICY "Users can view their own login logs" ON public.login_logs FOR SELECT TO authenticated USING (user_id = auth.uid());

-- Policies for leads
CREATE POLICY "Strict lead visibility based on role and assignment" ON public.leads FOR SELECT TO authenticated USING (public.can_user_see_lead(leads.*));
CREATE POLICY "Users can insert leads" ON public.leads FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Users can update leads they can see" ON public.leads FOR UPDATE TO authenticated USING (public.can_user_see_lead(leads.*)) WITH CHECK (public.can_user_see_lead(leads.*));

-- Policies for deposits
CREATE POLICY "Users can insert deposits for leads they manage" ON public.deposits FOR INSERT TO authenticated WITH CHECK ((EXISTS ( SELECT 1 FROM leads WHERE ((leads.id = deposits.lead_id) AND ((leads.assigned_to = auth.uid()) OR (EXISTS ( SELECT 1 FROM user_profiles WHERE ((user_profiles.id = auth.uid()) AND ((user_profiles.role = 'admin'::role_type) OR ((user_profiles.role = 'manager'::role_type) AND (EXISTS ( SELECT 1 FROM user_profiles agent WHERE ((agent.id = leads.assigned_to) AND (agent.manager_id = user_profiles.id)))))))))))));
CREATE POLICY "Users can view deposits they created or for leads they manage" ON public.deposits FOR SELECT TO authenticated USING (((created_by = auth.uid()) OR (EXISTS ( SELECT 1 FROM leads WHERE ((leads.id = deposits.lead_id) AND ((leads.assigned_to = auth.uid()) OR (EXISTS ( SELECT 1 FROM user_profiles WHERE ((user_profiles.id = auth.uid()) AND ((user_profiles.role = 'admin'::role_type) OR ((user_profiles.role = 'manager'::role_type) AND (EXISTS ( SELECT 1 FROM user_profiles agent WHERE ((agent.id = leads.assigned_to) AND (agent.manager_id = user_profiles.id))))))))))))));

-- Policies for lead_answers
CREATE POLICY "Users can add answers to leads they manage" ON public.lead_answers FOR INSERT TO authenticated WITH CHECK ((EXISTS ( SELECT 1 FROM leads WHERE ((leads.id = lead_answers.lead_id) AND ((leads.assigned_to = auth.uid()) OR (EXISTS ( SELECT 1 FROM user_profiles WHERE ((user_profiles.id = auth.uid()) AND ((user_profiles.role = 'admin'::role_type) OR ((user_profiles.role = 'manager'::role_type) AND (EXISTS ( SELECT 1 FROM user_profiles agent WHERE ((agent.id = leads.assigned_to) AND (agent.manager_id = user_profiles.id)))))))))))));
CREATE POLICY "Users can view answers for leads they manage" ON public.lead_answers FOR SELECT TO authenticated USING ((EXISTS ( SELECT 1 FROM leads WHERE ((leads.id = lead_answers.lead_id) AND ((leads.assigned_to = auth.uid()) OR (EXISTS ( SELECT 1 FROM user_profiles WHERE ((user_profiles.id = auth.uid()) AND ((user_profiles.role = 'admin'::role_type) OR ((user_profiles.role = 'manager'::role_type) AND (EXISTS ( SELECT 1 FROM user_profiles agent WHERE ((agent.id = leads.assigned_to) AND (agent.manager_id = user_profiles.id)))))))))))));

-- Policies for lead_questions
CREATE POLICY "Admins can manage questions" ON public.lead_questions FOR ALL TO authenticated USING (public.is_admin(auth.uid()));
CREATE POLICY "All users can view questions" ON public.lead_questions FOR SELECT TO authenticated USING (true);

-- Policies for lead_comments
CREATE POLICY "Allow authenticated users to insert comments" ON public.lead_comments FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Allow authenticated users to read comments" ON public.lead_comments FOR SELECT TO authenticated USING (true);
CREATE POLICY "Users can add comments to leads they manage" ON public.lead_comments FOR INSERT TO authenticated WITH CHECK ((EXISTS ( SELECT 1 FROM leads WHERE ((leads.id = lead_comments.lead_id) AND ((leads.assigned_to = auth.uid()) OR (EXISTS ( SELECT 1 FROM user_profiles WHERE ((user_profiles.id = auth.uid()) AND ((user_profiles.role = 'admin'::role_type) OR ((user_profiles.role = 'manager'::role_type) AND (EXISTS ( SELECT 1 FROM user_profiles agent WHERE ((agent.id = leads.assigned_to) AND (agent.manager_id = user_profiles.id)))))))))))));
CREATE POLICY "Users can delete their own comments or if admin" ON public.lead_comments FOR DELETE TO authenticated USING (((created_by = auth.uid()) OR (EXISTS ( SELECT 1 FROM user_profiles WHERE ((user_profiles.id = auth.uid()) AND (user_profiles.role = 'admin'::role_type))))));
CREATE POLICY "Users can view comments for leads they manage" ON public.lead_comments FOR SELECT TO authenticated USING ((EXISTS ( SELECT 1 FROM leads WHERE ((leads.id = lead_comments.lead_id) AND ((leads.assigned_to = auth.uid()) OR (EXISTS ( SELECT 1 FROM user_profiles WHERE ((user_profiles.id = auth.uid()) AND ((user_profiles.role = 'admin'::role_type) OR ((user_profiles.role = 'manager'::role_type) AND (EXISTS ( SELECT 1 FROM user_profiles agent WHERE ((agent.id = leads.assigned_to) AND (agent.manager_id = user_profiles.id)))))))))))));

-- Policies for user_profiles
CREATE POLICY "Users can create profiles" ON public.user_profiles FOR INSERT TO authenticated WITH CHECK ((auth.uid() = id));
CREATE POLICY "Users can only see own profile" ON public.user_profiles FOR SELECT TO authenticated USING ((id = auth.uid()));
CREATE POLICY "Users can update own profile" ON public.user_profiles FOR UPDATE TO authenticated USING ((auth.uid() = id)) WITH CHECK ((auth.uid() = id));
CREATE POLICY "Allow hierarchical user profile access" ON public.user_profiles FOR SELECT TO authenticated USING (
  public.is_admin(auth.uid()) OR
  id = auth.uid() OR
  EXISTS (
    SELECT 1
    FROM public.get_all_subordinate_ids(auth.uid()) AS sub_id
    WHERE sub_id = user_profiles.id
  )
);

-- Policies for api_keys
CREATE POLICY "Only admins can manage API keys" ON public.api_keys FOR ALL TO authenticated USING (public.is_admin(auth.uid()));

-- Policies for user_permissions
CREATE POLICY "Admins can manage all permissions" ON public.user_permissions FOR ALL TO authenticated USING (public.is_admin(auth.uid()));
CREATE POLICY "Managers can read team permissions" ON public.user_permissions FOR SELECT TO authenticated USING ((EXISTS ( SELECT 1 FROM user_profiles WHERE ((user_profiles.id = auth.uid()) AND (user_profiles.role = 'manager'::role_type) AND (EXISTS ( SELECT 1 FROM user_profiles team WHERE ((team.manager_id = user_profiles.id) AND (team.id = user_permissions.user_id))))))));
CREATE POLICY "Users can read their own permissions" ON public.user_permissions FOR SELECT TO authenticated USING ((user_id = auth.uid()));

-- Policies for lead_activities
CREATE POLICY "Allow authenticated users to insert activities" ON public.lead_activities FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Allow authenticated users to read activities" ON public.lead_activities FOR SELECT TO authenticated USING (true);

-- Policies for lead_statuses
CREATE POLICY "Admins can manage lead statuses" ON public.lead_statuses FOR ALL TO authenticated USING (public.is_admin(auth.uid()));
CREATE POLICY "All users can view lead statuses" ON public.lead_statuses FOR SELECT TO authenticated USING (true);

-- Recreate Triggers
CREATE TRIGGER on_user_profile_role_change AFTER INSERT OR UPDATE OF role ON public.user_profiles FOR EACH ROW EXECUTE FUNCTION public.update_auth_user_role();
CREATE TRIGGER on_user_delete BEFORE DELETE ON public.user_profiles FOR EACH ROW EXECUTE FUNCTION public.handle_deleted_user();
CREATE TRIGGER update_lead_deposit_status AFTER INSERT ON public.deposits FOR EACH ROW EXECUTE FUNCTION public.update_lead_deposit_status();
CREATE TRIGGER update_user_permissions_updated_at BEFORE UPDATE ON public.user_permissions FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
```