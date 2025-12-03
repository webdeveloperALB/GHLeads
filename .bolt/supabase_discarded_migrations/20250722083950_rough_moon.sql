-- Fix infinite recursion in user_profiles RLS policy
-- Drop the problematic policy that causes recursion
DROP POLICY IF EXISTS "Allow hierarchical user profile access" ON public.user_profiles;

-- Create simple, non-recursive policies
CREATE POLICY "Users can view own profile" ON public.user_profiles 
FOR SELECT TO authenticated 
USING (auth.uid() = id);

CREATE POLICY "Admins can view all profiles" ON public.user_profiles 
FOR SELECT TO authenticated 
USING (
  EXISTS (
    SELECT 1 FROM public.user_profiles up 
    WHERE up.id = auth.uid() AND up.role = 'admin'
  )
);

CREATE POLICY "Managers can view direct reports" ON public.user_profiles 
FOR SELECT TO authenticated 
USING (
  manager_id = auth.uid() OR
  EXISTS (
    SELECT 1 FROM public.user_profiles up 
    WHERE up.id = auth.uid() AND up.role = 'admin'
  )
);

-- Keep existing INSERT and UPDATE policies as they don't cause recursion
-- CREATE POLICY "Users can create profiles" ON public.user_profiles FOR INSERT TO authenticated WITH CHECK ((auth.uid() = id));
-- CREATE POLICY "Users can update own profile" ON public.user_profiles FOR UPDATE TO authenticated USING ((auth.uid() = id)) WITH CHECK ((auth.uid() = id));