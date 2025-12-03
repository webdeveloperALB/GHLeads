```sql
-- Drop the existing restrictive policies
DROP POLICY IF EXISTS "Comprehensive user profile access" ON public.user_profiles;
DROP POLICY IF EXISTS "Admin full access to profiles" ON public.user_profiles;

-- Create a new policy that allows proper hierarchy access
CREATE POLICY "Allow hierarchical user profile access"
ON public.user_profiles FOR SELECT
TO authenticated
USING (
  -- Users can always see their own profile
  (auth.uid() = id) 
  OR
  -- Admins can see all profiles
  (EXISTS (
    SELECT 1 
    FROM public.user_profiles AS current_user_profile 
    WHERE current_user_profile.id = auth.uid() 
    AND current_user_profile.role = 'admin'
  )) 
  OR
  -- Managers and Desk users can see their direct and indirect subordinates
  (EXISTS (
    SELECT 1
    FROM public.user_hierarchy uh_subordinate
    JOIN public.user_hierarchy uh_current ON uh_current.id = auth.uid()
    WHERE
      uh_subordinate.id = user_profiles.id 
      AND uh_subordinate.path @> uh_current.path 
      AND uh_subordinate.level > uh_current.level
  ))
  OR
  -- Users can see their direct manager
  (EXISTS (
    SELECT 1
    FROM public.user_profiles AS current_user_profile
    WHERE current_user_profile.id = auth.uid()
    AND user_profiles.id = current_user_profile.manager_id
  ))
);
```