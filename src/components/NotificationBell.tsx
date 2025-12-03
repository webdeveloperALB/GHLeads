import React, { useState, useEffect } from 'react';
import { Bell } from 'lucide-react';
import { supabase, getCurrentUser } from '../lib/supabase';
import NotificationDropdown from './NotificationDropdown';

const NotificationBell = () => {
  const [unreadCount, setUnreadCount] = useState(0);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);

  const fetchUnreadCount = async () => {
    try {
      const currentUser = await getCurrentUser();
      if (!currentUser) return;

      const { count, error } = await supabase
        .from('lead_notifications')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', currentUser.id)
        .eq('is_read', false);

      if (error) throw error;
      setUnreadCount(count || 0);
    } catch (error) {
      console.error('Error fetching unread notification count:', error);
    }
  };

  useEffect(() => {
    fetchUnreadCount();

    const setupRealtimeSubscription = async () => {
      const currentUser = await getCurrentUser();
      if (!currentUser) return;

      const channel = supabase
        .channel('notification-count')
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'lead_notifications',
            filter: `user_id=eq.${currentUser.id}`
          },
          () => {
            fetchUnreadCount();
          }
        )
        .subscribe();

      return () => {
        channel.unsubscribe();
      };
    };

    setupRealtimeSubscription();
  }, []);

  return (
    <div className="relative">
      <button
        onClick={() => setIsDropdownOpen(!isDropdownOpen)}
        className="relative p-2 text-gray-400 hover:text-white hover:bg-gray-700 rounded-lg transition-colors"
        aria-label="Notifications"
      >
        <Bell size={20} />
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full h-5 w-5 flex items-center justify-center font-bold">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {isDropdownOpen && (
        <NotificationDropdown
          onClose={() => setIsDropdownOpen(false)}
          onNotificationRead={fetchUnreadCount}
        />
      )}
    </div>
  );
};

export default NotificationBell;
