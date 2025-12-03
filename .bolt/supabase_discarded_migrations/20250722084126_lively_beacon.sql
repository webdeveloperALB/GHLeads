-- Temporarily disable RLS on user_profiles to break infinite recursion
ALTER TABLE public.user_profiles DISABLE ROW LEVEL SECURITY;

-- Drop all existing policies on user_profiles that might be causing recursion
DROP POLICY IF EXISTS "Allow hierarchical user profile access" ON public.user_profiles;
DROP POLICY IF EXISTS "Users can create profiles" ON public.user_profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON public.user_profiles;
DROP POLICY IF EXISTS "Users can only see own profile" ON public.user_profiles;

-- Re-enable RLS
ALTER TABLE public.user_profiles ENABLE ROW LEVEL SECURITY;

-- Create simple, non-recursive policies
CREATE POLICY "Users can view own profile" ON public.user_profiles 
FOR SELECT TO authenticated 
USING (auth.uid() = id);

CREATE POLICY "Users can insert own profile" ON public.user_profiles 
FOR INSERT TO authenticated 
WITH CHECK (auth.uid() = id);

CREATE POLICY "Users can update own profile" ON public.user_profiles 
FOR UPDATE TO authenticated 
USING (auth.uid() = id) 
WITH CHECK (auth.uid() = id);

-- Admins can see all profiles (simple check without recursion)
CREATE POLICY "Admins can view all profiles" ON public.user_profiles 
FOR SELECT TO authenticated 
USING (
  EXISTS (
    SELECT 1 FROM auth.users 
    WHERE auth.users.id = auth.uid() 
    AND auth.users.raw_app_meta_data->>'role' = 'admin'
  )
);