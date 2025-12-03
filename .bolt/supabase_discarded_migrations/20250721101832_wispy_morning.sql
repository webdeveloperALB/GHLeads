```sql
-- Step 1: Drop all existing policies on user_profiles to ensure a clean slate.
-- This is crucial to remove any conflicting or problematic policies.
DROP POLICY IF EXISTS "Admins can view all user profiles" ON public.user_profiles;
DROP POLICY IF EXISTS "Agents can view their own profile" ON public.user_profiles;
DROP POLICY IF EXISTS "Managers can view their team" ON public.user_profiles;
DROP POLICY IF EXISTS "Desk users can view their hierarchy" ON public.user_profiles;
DROP POLICY IF EXISTS "Allow all authenticated users to read user_profiles" ON public.user_profiles;
DROP POLICY IF EXISTS "Users can read basic profile info" ON public.user_profiles;

-- Step 2: Create a SECURITY DEFINER function to safely get the current user's role.
-- The SECURITY DEFINER clause makes this function run with the privileges of the user
-- who created it (typically the postgres superuser), bypassing RLS checks on user_profiles
-- when this function is called from within an RLS policy.
CREATE OR REPLACE FUNCTION public.get_my_user_role()
RETURNS public.role_type
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
  DECLARE
    user_role public.role_type;
  BEGIN
    -- Retrieve the role from user_profiles for the current authenticated user
    SELECT role INTO user_role FROM public.user_profiles WHERE id = auth.uid();
    RETURN user_role;
  END;
$$;

-- Step 3: Re-create RLS SELECT policies using the new `get_my_user_role()` function.

-- Policy for Admin: Admins can see all user profiles.
-- If the current user's role is 'admin', this policy evaluates to TRUE, allowing full access.
CREATE POLICY "Admins can view all user profiles"
ON public.user_profiles
FOR SELECT
TO authenticated
USING (
  public.get_my_user_role() = 'admin'::public.role_type
);

-- Policy for Agent: Agents can only see their own profile.
-- If the current user's role is 'agent', they can only see the profile matching their own user ID.
CREATE POLICY "Agents can view their own profile"
ON public.user_profiles
FOR SELECT
TO authenticated
USING (
  public.get_my_user_role() = 'agent'::public.role_type AND id = auth.uid()
);

-- Policy for Manager: Managers can see themselves and their direct reports (agents).
-- If the current user's role is 'manager', they can see their own profile or any profile
-- where their ID is listed as the manager_id.
CREATE POLICY "Managers can view their team"
ON public.user_profiles
FOR SELECT
TO authenticated
USING (
  public.get_my_user_role() = 'manager'::public.role_type AND
  (id = auth.uid() OR manager_id = auth.uid())
);

-- Policy for Desk: Desk users can see themselves, their direct reports (managers),
-- and agents who report to those managers.
-- This policy allows desk users to see their own profile, managers directly reporting to them,
-- and agents whose manager_id is one of their direct reports.
CREATE POLICY "Desk users can view their hierarchy"
ON public.user_profiles
FOR SELECT
TO authenticated
USING (
  public.get_my_user_role() = 'desk'::public.role_type AND
  (
    id = auth.uid() OR -- Desk user sees themselves
    manager_id = auth.uid() OR -- Desk user sees their direct reports (managers)
    -- Desk user sees agents under their managers (managers who report to the desk user)
    manager_id IN (SELECT id FROM public.user_profiles WHERE manager_id = auth.uid() AND role = 'manager'::public.role_type)
  )
);

-- Ensure Row Level Security is enabled for the user_profiles table.
-- This command is idempotent, so it's safe to run even if RLS is already enabled.
ALTER TABLE public.user_profiles ENABLE ROW LEVEL SECURITY;
```