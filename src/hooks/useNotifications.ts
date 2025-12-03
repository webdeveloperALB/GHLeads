import { useCallback } from 'react';
import { supabase, getCurrentUser } from '../lib/supabase';
import toast from 'react-hot-toast';

interface LeadNotification {
  id: string;
  lead_id: number;
  notification_type: string;
  message: string;
  is_read: boolean;
  created_at: string;
}

export const useNotifications = () => {
  // Play notification sound
  const playNotificationSound = useCallback(async () => {
    try {
      const audio = new Audio('/notification.mp3');
      audio.volume = 0.7;
      await audio.play();
    } catch (error) {
      console.error('Error playing notification sound:', error);
      // Fallback: try to play a system beep
      try {
        const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
        const oscillator = audioContext.createOscillator();
        const gainNode = audioContext.createGain();

        oscillator.connect(gainNode);
        gainNode.connect(audioContext.destination);

        oscillator.frequency.value = 800;
        oscillator.type = 'sine';
        gainNode.gain.value = 0.3;

        oscillator.start();
        oscillator.stop(audioContext.currentTime + 0.3);
      } catch (fallbackError) {
        console.error('Error playing fallback sound:', fallbackError);
      }
    }
  }, []);

  // Show in-app notification
  const showNotification = useCallback((title: string, body: string) => {
    toast.success(body, {
      duration: 8000,
      icon: '🔔',
      style: {
        background: '#1f2937',
        color: '#fff',
        border: '1px solid #374151'
      }
    });
  }, []);

  // Process a notification
  const processNotification = useCallback(async (notification: LeadNotification) => {
    console.log('🔔 Processing notification:', notification);

    // Play sound first
    await playNotificationSound();

    // Show in-app toast notification
    showNotification(
      'New Lead Received!',
      notification.message
    );

    // Don't mark as read automatically - let user mark it when they view it
  }, [playNotificationSound, showNotification]);

  // Check for pending notifications on login/mount
  const checkPendingNotifications = useCallback(async () => {
    try {
      const currentUser = await getCurrentUser();
      if (!currentUser) return;

      const { data: notifications, error } = await supabase
        .from('lead_notifications')
        .select('*')
        .eq('user_id', currentUser.id)
        .eq('is_read', false)
        .order('created_at', { ascending: true });

      if (error) throw error;

      // Process each notification with a delay
      if (notifications && notifications.length > 0) {
        console.log(`Found ${notifications.length} pending notifications`);
        
        for (let i = 0; i < notifications.length; i++) {
          const notification = notifications[i];
          // Add delay between notifications to avoid overwhelming the user
          setTimeout(() => {
            processNotification(notification);
          }, i * 2000); // 2 second delay between each notification
        }
      }
    } catch (error) {
      console.error('Error checking pending notifications:', error);
    }
  }, [processNotification]);

  // Set up real-time subscription for new notifications
  const setupNotificationSubscription = useCallback(async () => {
    try {
      const currentUser = await getCurrentUser();
      if (!currentUser) {
        console.log('❌ No current user, skipping notification subscription');
        return;
      }

      console.log('🔄 Setting up notification subscription for user:', currentUser.id);

      const channel = supabase
        .channel(`notifications-${currentUser.id}`)
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'lead_notifications',
            filter: `user_id=eq.${currentUser.id}`
          },
          (payload) => {
            console.log('🔔 Real-time notification received:', payload);
            const notification = payload.new as LeadNotification;
            processNotification(notification);
          }
        )
        .subscribe((status) => {
          if (status === 'SUBSCRIBED') {
            console.log('✅ Successfully subscribed to real-time notifications');
          } else if (status === 'CHANNEL_ERROR') {
            console.error('❌ Error subscribing to notifications, status:', status);
          } else if (status === 'TIMED_OUT') {
            console.error('⏱️ Subscription timed out');
          }
        });

      return () => {
        console.log('🔌 Unsubscribing from notifications');
        channel.unsubscribe();
      };
    } catch (error) {
      console.error('❌ Error setting up notification subscription:', error);
    }
  }, [processNotification]);

  return {
    checkPendingNotifications,
    setupNotificationSubscription
  };
};