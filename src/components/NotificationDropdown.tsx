import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase, getCurrentUser } from '../lib/supabase';
import { CheckCheck, X } from 'lucide-react';
import { DateTime } from 'luxon';
import toast from 'react-hot-toast';

interface Notification {
  id: string;
  lead_id: number;
  notification_type: string;
  message: string;
  is_read: boolean;
  created_at: string;
}

interface NotificationDropdownProps {
  onClose: () => void;
  onNotificationRead: () => void;
}

const NotificationDropdown: React.FC<NotificationDropdownProps> = ({ onClose, onNotificationRead }) => {
  const navigate = useNavigate();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const fetchNotifications = async () => {
      try {
        const currentUser = await getCurrentUser();
        if (!currentUser) return;

        const { data, error } = await supabase
          .from('lead_notifications')
          .select('*')
          .eq('user_id', currentUser.id)
          .order('created_at', { ascending: false })
          .limit(20);

        if (error) throw error;
        setNotifications(data || []);
      } catch (error) {
        console.error('Error fetching notifications:', error);
        toast.error('Failed to load notifications');
      } finally {
        setLoading(false);
      }
    };

    fetchNotifications();

    // Set up real-time subscription for updates
    const setupSubscription = async () => {
      const currentUser = await getCurrentUser();
      if (!currentUser) return;

      const channel = supabase
        .channel(`dropdown-notifications-${currentUser.id}`)
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'lead_notifications',
            filter: `user_id=eq.${currentUser.id}`
          },
          () => {
            // Refresh notifications when any change occurs
            fetchNotifications();
          }
        )
        .subscribe();

      return () => {
        channel.unsubscribe();
      };
    };

    setupSubscription();
  }, []);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        onClose();
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [onClose]);

  const handleNotificationClick = async (notification: Notification) => {
    try {
      if (!notification.is_read) {
        await supabase
          .from('lead_notifications')
          .update({ is_read: true })
          .eq('id', notification.id);

        onNotificationRead();
      }

      onClose();
      navigate(`/lead/${notification.lead_id}`);
    } catch (error) {
      console.error('Error marking notification as read:', error);
    }
  };

  const handleMarkAllRead = async () => {
    try {
      const currentUser = await getCurrentUser();
      if (!currentUser) return;

      const { error } = await supabase
        .from('lead_notifications')
        .update({ is_read: true })
        .eq('user_id', currentUser.id)
        .eq('is_read', false);

      if (error) throw error;

      setNotifications(notifications.map(n => ({ ...n, is_read: true })));
      onNotificationRead();
      toast.success('All notifications marked as read');
    } catch (error) {
      console.error('Error marking all as read:', error);
      toast.error('Failed to mark all as read');
    }
  };

  const getNotificationIcon = (type: string) => {
    switch (type) {
      case 'new_lead':
        return '🆕';
      case 'assignment':
        return '📌';
      case 'deposit':
        return '💰';
      default:
        return '🔔';
    }
  };

  const formatTimeAgo = (timestamp: string) => {
    const dt = DateTime.fromISO(timestamp);
    const diff = DateTime.now().diff(dt, ['days', 'hours', 'minutes']);

    if (diff.days >= 1) {
      return `${Math.floor(diff.days)}d ago`;
    } else if (diff.hours >= 1) {
      return `${Math.floor(diff.hours)}h ago`;
    } else if (diff.minutes >= 1) {
      return `${Math.floor(diff.minutes)}m ago`;
    } else {
      return 'Just now';
    }
  };

  return (
    <div
      ref={dropdownRef}
      className="absolute right-0 top-12 w-96 bg-gray-800 rounded-lg shadow-xl border border-gray-700 z-50"
    >
      <div className="flex items-center justify-between p-4 border-b border-gray-700">
        <h3 className="text-lg font-semibold">Notifications</h3>
        <div className="flex items-center space-x-2">
          {notifications.some(n => !n.is_read) && (
            <button
              onClick={handleMarkAllRead}
              className="text-xs text-blue-400 hover:text-blue-300 flex items-center space-x-1"
              title="Mark all as read"
            >
              <CheckCheck size={14} />
              <span>Mark all read</span>
            </button>
          )}
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white p-1 rounded hover:bg-gray-700"
          >
            <X size={18} />
          </button>
        </div>
      </div>

      <div className="max-h-96 overflow-y-auto">
        {loading ? (
          <div className="p-8 text-center text-gray-400">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mx-auto"></div>
            <p className="mt-2">Loading notifications...</p>
          </div>
        ) : notifications.length === 0 ? (
          <div className="p-8 text-center text-gray-400">
            <p>No notifications yet</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-700">
            {notifications.map((notification) => (
              <button
                key={notification.id}
                onClick={() => handleNotificationClick(notification)}
                className={`w-full p-4 text-left hover:bg-gray-700 transition-colors ${
                  !notification.is_read ? 'bg-gray-750' : ''
                }`}
              >
                <div className="flex items-start space-x-3">
                  <span className="text-2xl flex-shrink-0">
                    {getNotificationIcon(notification.notification_type)}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className={`text-sm ${!notification.is_read ? 'font-semibold text-white' : 'text-gray-300'}`}>
                      {notification.message}
                    </p>
                    <p className="text-xs text-gray-500 mt-1">
                      {formatTimeAgo(notification.created_at)}
                    </p>
                  </div>
                  {!notification.is_read && (
                    <div className="w-2 h-2 bg-blue-500 rounded-full flex-shrink-0 mt-1"></div>
                  )}
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default NotificationDropdown;
