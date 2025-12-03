```sql
-- Create or replace the can_user_see_lead function to refine RLS logic
CREATE OR REPLACE FUNCTION public.can_user_see_lead(lead_row public.leads)
RETURNS boolean AS $$
DECLARE
    current_user_id uuid := auth.uid();
    user_profile public.user_profiles;
BEGIN
    IF current_user_id IS NULL THEN
        RETURN FALSE;
    END IF;

    SELECT * INTO user_profile FROM public.user_profiles WHERE id = current_user_id;

    IF user_profile.role = 'admin' THEN
        -- Admins can see all leads
        RETURN TRUE;
    ELSIF user_profile.role = 'desk' THEN
        -- Desk users can see leads belonging to their specific desk.
        -- This includes leads where:
        -- 1. The lead's 'desk' column matches the desk user's 'full_name'.
        -- 2. And the lead is assigned to the desk user, or any manager/agent under them,
        --    or is unassigned but still belongs to their desk.
        RETURN lead_row.desk = user_profile.full_name AND (
            lead_row.assigned_to = user_profile.id OR
            EXISTS (
                SELECT 1
                FROM public.user_profiles manager
                WHERE manager.manager_id = user_profile.id
                  AND manager.role = 'manager'::public.role_type
                  AND (lead_row.assigned_to = manager.id OR
                       EXISTS (
                           SELECT 1
                           FROM public.user_profiles agent
                           WHERE agent.manager_id = manager.id
                             AND agent.role = 'agent'::public.role_type
                             AND lead_row.assigned_to = agent.id
                       )
                  )
            ) OR
            EXISTS (
                SELECT 1
                FROM public.user_profiles agent
                WHERE agent.manager_id = user_profile.id
                  AND agent.role = 'agent'::public.role_type
                  AND lead_row.assigned_to = agent.id
            ) OR
            lead_row.assigned_to IS NULL -- Unassigned leads within their desk
        );
    ELSIF user_profile.role = 'manager' THEN
        -- Managers can see leads assigned to themselves or their direct agents
        RETURN lead_row.assigned_to = user_profile.id OR
               EXISTS (
                   SELECT 1
                   FROM public.user_profiles agent
                   WHERE agent.manager_id = user_profile.id
                     AND agent.role = 'agent'::public.role_type
                     AND lead_row.assigned_to = agent.id
               );
    ELSIF user_profile.role = 'agent' THEN
        -- Agents can only see leads assigned to themselves
        RETURN lead_row.assigned_to = user_profile.id;
    END IF;

    RETURN FALSE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Re-apply the policy to use the updated function
ALTER TABLE public.leads ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Team-based lead visibility" ON public.leads;
CREATE POLICY "Team-based lead visibility"
ON public.leads
FOR SELECT
TO authenticated
USING (public.can_user_see_lead(leads));
```