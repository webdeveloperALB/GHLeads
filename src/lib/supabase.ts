import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables');
}

// Regular client for normal operations
export const supabase = createClient(supabaseUrl, supabaseAnonKey);

export type Role = 'admin' | 'desk' | 'manager' | 'agent';

export type UserProfile = {
  id: string;
  role: Role;
  full_name: string;
  email: string;
  created_at: string;
  manager_id: string | null;
};

export type Lead = {
  id: number;
  source_id: number;
  first_name: string;
  last_name: string;
  email: string;
  phone: string;
  country: string;
  status: string;
  brand: string;
  balance: number;
  total_deposits: number;
  created_at: string;
  converted_at: string | null;
  last_activity: string;
  is_converted: boolean;
  ftd_date: string | null;
  ftd_date: string | null;
  assigned_to: string | null;
  assigned_to_user?: {
    id: string;
    full_name: string;
    role: string;
  } | null;
  source: string | null;
  funnel: string | null;
  desk: string | null;
};

export type UserPermissions = {
  clients: {
    view: boolean;
    register: boolean;
    remove: boolean;
    download: boolean;
    promote: boolean;
    demote: boolean;
    edit: boolean;
    phone: boolean;
    email: boolean;
    password: boolean;
    info: boolean;
    assign: boolean;
    whatsapp: boolean;
    loginLog: boolean;
  };
  leads: {
    upload: boolean;
  };
  support: {
    chat: boolean;
    deleteChat: boolean;
  };
  comments: {
    edit: boolean;
    delete: boolean;
  };
};

export async function getSubordinateIds(): Promise<string[]> {
  const currentUser = await getCurrentUser();
  if (!currentUser) return [];

  console.log(`🔍 [getSubordinateIds] Getting subordinates for ${currentUser.full_name} (${currentUser.role})`);

  try {
    // Get all users to build hierarchy on frontend
    const { data: allUsers, error } = await supabase
      .from('user_profiles')
      .select('id, manager_id, role');

    if (error) throw error;

    console.log(`📊 [getSubordinateIds] Total users in system: ${allUsers?.length || 0}`);

    // Build subordinate list recursively
    const findSubordinates = (managerId: string, users: any[]): string[] => {
      const directReports = users.filter(u => u.manager_id === managerId);
      console.log(`👥 [getSubordinateIds] Direct reports for ${managerId}:`, directReports.map(u => `${u.id} (${u.role})`));
      
      let allSubordinates = directReports.map(u => u.id);
      
      // Recursively find subordinates of direct reports
      directReports.forEach(report => {
        allSubordinates = [...allSubordinates, ...findSubordinates(report.id, users)];
      });
      
      return allSubordinates;
    };

    const subordinateIds = findSubordinates(currentUser.id, allUsers || []);
    console.log(`✅ [getSubordinateIds] Final subordinate IDs for ${currentUser.full_name}:`, subordinateIds);
    
    return subordinateIds;
  } catch (error) {
    console.error('Error in getSubordinateIds:', error);
    return [];
  }
}

export async function getCurrentUser() {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return null;

    const { data: profile, error: profileError } = await supabase
      .from('user_profiles')
      .select('id, role, full_name, email, created_at, manager_id')
      .eq('id', session.user.id)
      .single();

    if (profileError) {
      console.error('Error fetching user profile:', profileError);
      return null;
    }

    return profile;
  } catch (error) {
    console.error('Error getting current user:', error);
    return null;
  }
}

export async function getUserPermissions(userId?: string): Promise<UserPermissions | null> {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return null;

    const targetUserId = userId || session.user.id;

    const { data: permissionsData, error } = await supabase
      .from('user_permissions')
      .select('permissions')
      .eq('user_id', targetUserId)
      .maybeSingle();

    if (error && error.message !== 'JSON object requested, multiple (or no) rows returned') {
      console.error('Error fetching permissions:', error);
      return null;
    }

    if (!permissionsData) {
      return {
        clients: {
          view: false,
          register: false,
          remove: false,
          download: false,
          promote: false,
          demote: false,
          edit: false,
          phone: false,
          email: false,
          password: false,
          info: false,
          assign: false,
          whatsapp: false,
          loginLog: false
        },
        leads: {
          upload: false
        },
        support: {
          chat: false,
          deleteChat: false
        },
        comments: {
          edit: false,
          delete: false
        }
      };
    }

    return permissionsData.permissions;
  } catch (error) {
    console.error('Error getting user permissions:', error);
    return null;
  }
}

export async function getUserById(userId: string) {
  try {
    const { data: profile, error: profileError } = await supabase
      .from('user_profiles')
      .select('id, role, full_name, email, created_at, manager_id')
      .eq('id', userId)
      .single();

    if (profileError) throw profileError;

    // Get the manager data if exists
    let manager = null;
    if (profile.manager_id) {
      const { data: managerData } = await supabase
        .from('user_profiles')
        .select('id, full_name, role')
        .eq('id', profile.manager_id)
        .single();
      manager = managerData;
    }

    return {
      ...profile,
      manager
    };
  } catch (error) {
    console.error('Error fetching user:', error);
    throw error;
  }
}

export async function createUser(email: string, password: string, fullName: string, role: Role, managerId: string | null = null) {
  try {
    // First create the authentication user
    const { data: authData, error: authError } = await supabase.auth.signUp({
      email,
      password,
    });

    if (authError) throw authError;
    if (!authData.user) throw new Error('Failed to create authentication user');

    // Then create the user profile with the auth user's ID
    const { data, error } = await supabase
      .from('user_profiles')
      .insert({
        id: authData.user.id,
        email,
        full_name: fullName,
        role,
        manager_id: managerId
      })
      .select()
      .single();

    if (error) throw error;
    return data;
  } catch (error) {
    console.error('Error creating user:', error);
    throw error;
  }
}

export async function deleteUser(userId: string) {
  try {
    const { error } = await supabase
      .from('user_profiles')
      .delete()
      .eq('id', userId);

    if (error) throw error;
  } catch (error) {
    console.error('Error deleting user:', error);
    throw error;
  }
}

export async function updateUserPassword(userId: string, password: string) {
  try {
    const { error } = await supabase.auth.updateUser({
      password: password
    });

    if (error) throw error;
  } catch (error) {
    console.error('Error updating password:', error);
    throw error;
  }
}

export async function getLeadQuestions() {
  try {
    const { data, error } = await supabase
      .from('lead_questions')
      .select('*')
      .order('order');

    if (error) throw error;
    return data;
  } catch (error) {
    console.error('Error fetching lead questions:', error);
    throw error;
  }
}

export async function getLeadAnswers(leadId: string) {
  try {
    const { data, error } = await supabase
      .from('lead_answers')
      .select(`
        *,
        question:lead_questions(*)
      `)
      .eq('lead_id', leadId)
      .order('created_at');

    if (error) throw error;
    return data;
  } catch (error) {
    console.error('Error fetching lead answers:', error);
    throw error;
  }
}

export async function saveLeadAnswer(leadId: string, questionId: string, answer: string) {
  try {
    const { error } = await supabase
      .from('lead_answers')
      .upsert({
        lead_id: leadId,
        question_id: questionId,
        answer
      });

    if (error) throw error;
  } catch (error) {
    console.error('Error saving lead answer:', error);
    throw error;
  }
}