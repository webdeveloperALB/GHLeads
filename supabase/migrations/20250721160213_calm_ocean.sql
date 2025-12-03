/*
  # Fix admin RLS policy for user visibility

  1. Changes
    - Drop the existing admin SELECT policy that may be causing issues
    - Create a new admin SELECT policy that properly uses JWT claims
    - Ensure admins can see all user profiles without recursion

  2. Security
    - Uses JWT claims to identify admin users
    - Avoids querying user_profiles table within the policy
    - Maintains security for non-admin users
*/

-- Drop the existing admin SELECT policy
DROP POLICY IF EXISTS "Admins can view all profiles" ON public.user_profiles;

-- Create a new admin SELECT policy that properly uses JWT claims
CREATE POLICY "Admin full access to profiles"
  ON public.user_profiles
  FOR SELECT
  TO authenticated
  USING (
    (auth.jwt() ->> 'user_metadata')::jsonb ->> 'role' = 'admin'
    OR
    (auth.jwt() ->> 'app_metadata')::jsonb ->> 'role' = 'admin'
  );