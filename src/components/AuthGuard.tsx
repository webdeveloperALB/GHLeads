import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase, getCurrentUser } from '../lib/supabase';
import { useNotifications } from '../hooks/useNotifications';
import toast from 'react-hot-toast';

interface AuthGuardProps {
  children: React.ReactNode;
  requireAdmin?: boolean;
}

const AuthGuard: React.FC<AuthGuardProps> = ({ children, requireAdmin }) => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [authorized, setAuthorized] = useState(false);
  const { checkPendingNotifications, setupNotificationSubscription } = useNotifications();

  useEffect(() => {
    const checkAuth = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        
        if (!session) {
          setAuthorized(false);
          navigate('/login');
          return;
        }

        const user = await getCurrentUser();
        
        if (!user) {
          setAuthorized(false);
          await supabase.auth.signOut();
          navigate('/login');
          return;
        }

        if (requireAdmin && user.role !== 'admin') {
          // Check if desk role is allowed for certain admin pages
          const deskAllowedPaths = ['/users', '/statuses', '/questions', '/settings'];
          const currentPath = window.location.pathname;
          
          if (user.role === 'desk' && deskAllowedPaths.includes(currentPath)) {
            setAuthorized(true);
          } else {
            setAuthorized(false);
            toast.error('Access denied. Admin privileges required.');
            navigate('/');
            return;
          }
        } else {
          setAuthorized(true);
        }

        checkPendingNotifications();
      } catch (error) {
        console.error('Auth check failed:', error);
        setAuthorized(false);
        navigate('/login');
      } finally {
        setLoading(false);
      }
    };

    checkAuth();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event) => {
      if (event === 'SIGNED_OUT' || event === 'USER_DELETED') {
        setAuthorized(false);
        navigate('/login');
      } else if (event === 'SIGNED_IN') {
        checkAuth();
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [navigate, requireAdmin, checkPendingNotifications]);

  useEffect(() => {
    let cleanup: (() => void) | undefined;

    if (authorized) {
      setupNotificationSubscription().then((unsubscribe) => {
        cleanup = unsubscribe;
      });
    }

    return () => {
      if (cleanup) {
        cleanup();
      }
    };
  }, [authorized, setupNotificationSubscription]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="text-xl">Loading...</div>
      </div>
    );
  }

  return authorized ? <>{children}</> : null;
};

export default AuthGuard;