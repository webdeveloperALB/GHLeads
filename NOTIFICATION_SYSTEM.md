# Lead Notification System - UPDATED & FIXED

## ⚠️ CRITICAL: Enable Supabase Realtime

**YOU MUST DO THIS FOR REAL-TIME NOTIFICATIONS TO WORK:**

1. Go to: https://supabase.com/dashboard/project/kwiuzntxxsmezjgswact/database/replication
2. Find `lead_notifications` in the table list
3. Toggle the switch to **ENABLE** replication
4. Refresh your application

Without this, notifications will only show when you navigate between pages!

## Recent Updates (Latest)

### Fixed Issues:
- ✅ Real-time subscription now properly set up and maintained
- ✅ Notifications NO LONGER auto-mark as read on arrival
- ✅ Sound plays for EVERY new notification (not just on page change)
- ✅ Works even when on different tabs or different pages
- ✅ Better logging for debugging subscription issues
- ✅ Proper async handling in AuthGuard

### What Changed:
1. **useNotifications.ts**:
   - Removed auto-read marking (notifications stay unread until clicked)
   - Improved subscription setup with better error handling
   - Added comprehensive console logging
   - Unique channel names per user

2. **AuthGuard.tsx**:
   - Fixed async subscription cleanup
   - Proper promise handling

3. **NotificationDropdown.tsx**:
   - Added real-time updates when dropdown is open
   - Automatically refreshes notification list

## Overview
The lead notification system provides real-time notifications when:
- New leads are created (for admins and relevant desk/manager/agent users)
- Leads are assigned to them
- Works across tabs, even when browser is in background

## Database Infrastructure
- ✅ `lead_notifications` table with proper RLS policies
- ✅ Database triggers that automatically create notifications on:
  - New lead insertion (`on_lead_insert_notification`)
  - Lead assignment changes (`on_lead_assignment_notification`)
- ✅ Hierarchy-aware notification creation (admins see all, desk sees their team, etc.)

### 2. Frontend Integration (Newly Added)

#### Components Created:
- **NotificationBell.tsx**: Bell icon with unread count badge
- **NotificationDropdown.tsx**: Dropdown panel showing recent notifications

#### Components Modified:
- **AuthGuard.tsx**: 
  - Integrated `useNotifications` hook
  - Calls `checkPendingNotifications()` on login
  - Sets up real-time subscription via `setupNotificationSubscription()`
  
- **Sidebar.tsx**: 
  - Added NotificationBell component to header
  - Available on both desktop and mobile views

- **SalesLeads.tsx**: 
  - Removed duplicate notification logic
  - Kept only lead data refresh subscription
  - All notifications now handled centrally

### 3. Notification Flow

#### When a New Lead is Created:
1. Database trigger fires (`on_lead_insert_notification`)
2. `create_lead_notifications()` function evaluates hierarchy
3. Notifications created in database for appropriate users:
   - **Admins**: Get notified about ALL new leads
   - **Desk**: Get notified if lead is unassigned or assigned to their team
   - **Managers**: Get notified if lead assigned to them or their agents
   - **Agents**: Get notified only if lead assigned directly to them
4. Real-time subscription detects new notification
5. Browser notification + sound plays
6. Toast notification shows as fallback
7. Bell icon updates with unread count

#### When a Lead is Assigned:
1. Database trigger fires (`on_lead_assignment_notification`)
2. Notification created for the assigned user
3. Real-time notification delivered
4. User sees: "Lead assigned to you: [Name] ([Email])"

## Features

### Notification Bell
- Shows unread count badge (red circle with number)
- Displays "9+" for 10 or more unread notifications
- Click to open dropdown

### Notification Dropdown
- Shows last 20 notifications
- Grouped by type (new lead, assignment, deposit)
- Each notification shows:
  - Icon based on type (🆕 for new, 📌 for assignment, 💰 for deposit)
  - Message text
  - Time ago (e.g., "5m ago", "2h ago", "3d ago")
  - Blue dot for unread notifications
- Click notification to:
  - Mark as read
  - Navigate to lead details page
- "Mark all as read" button at top

### Sound & Visual Notifications
- Browser notification (if permission granted)
- Notification sound (`/public/notification.mp3`)
- Toast notification (always shown as fallback)
- Notifications auto-close after 10 seconds

## How to Test

### 1. Login and Enable Notifications
- Login to the application
- Grant browser notification permission when prompted
- You should see the notification bell icon in the sidebar

### 2. Test New Lead Notification (Admin)
- As admin, create a new lead via "Add Lead" button
- You should immediately:
  - Hear notification sound
  - See browser notification
  - See toast notification
  - See bell icon update with unread count (red badge)

### 3. Test Assignment Notification
- Assign a lead to another user (manager, agent, etc.)
- The assigned user should:
  - Receive real-time notification
  - See bell icon update
  - Get message: "Lead assigned to you: [Name]"

### 4. Test Hierarchy Notifications
- **Admin**: Creates lead → All admins notified
- **Desk User**: Gets notified about leads in their desk
- **Manager**: Gets notified about leads assigned to their team
- **Agent**: Only gets notified about leads assigned to them

### 5. Check Notification History
- Click the bell icon
- See all recent notifications
- Click a notification to view lead details
- Use "Mark all as read" to clear all unread

## Technical Details

### Real-Time Subscriptions
The system uses Supabase Realtime with two subscriptions:

1. **Notification Subscription** (in `useNotifications` hook):
   - Listens for INSERT events on `lead_notifications` table
   - Filtered by current user's ID
   - Triggers sound + visual notifications

2. **Notification Count Subscription** (in `NotificationBell`):
   - Listens for all changes on `lead_notifications` table
   - Updates unread count in real-time

### Database Triggers
Located in migration: `supabase/migrations/20250912105801_calm_dawn.sql`

Two main triggers:
- `on_lead_insert_notification`: Fires on new lead creation
- `on_lead_assignment_notification`: Fires on assignment changes

### Notification Types
- `new_lead`: A new lead was created
- `assignment`: A lead was assigned to the user
- `deposit`: A deposit was made on user's lead (future enhancement)

## Troubleshooting

### No Notifications Appearing
1. Check browser notification permission (should be "granted")
2. Verify you're logged in and authenticated
3. Check browser console for errors
4. Ensure Supabase Realtime is enabled for your project

### Sound Not Playing
1. Check browser allows audio playback
2. Verify `/public/notification.mp3` exists
3. Check browser console for audio errors
4. Try interacting with page first (browsers block audio on page load)

### Wrong Users Getting Notified
1. Check user hierarchy in database (`user_profiles.manager_id`)
2. Review lead's `assigned_to` and `desk` fields
3. Check database trigger logic in migration file

## Future Enhancements

Possible improvements:
- [ ] Notification preferences (enable/disable by type)
- [ ] Different sounds for different notification types
- [ ] Notification history page (beyond dropdown)
- [ ] Mark individual notifications as read from dropdown
- [ ] Desktop notification persistence
- [ ] Email notifications for important leads
- [ ] Notification grouping (e.g., "3 new leads from Source X")

## Files Changed

### New Files:
- `src/components/NotificationBell.tsx`
- `src/components/NotificationDropdown.tsx`

### Modified Files:
- `src/components/AuthGuard.tsx`
- `src/components/Sidebar.tsx`
- `src/pages/SalesLeads.tsx`

### Existing Infrastructure:
- `src/hooks/useNotifications.ts` (now being used)
- `supabase/migrations/20250912105801_calm_dawn.sql` (database triggers)
- `supabase/migrations/20250915100548_holy_ember.sql` (notification enhancements)
- `public/notification.mp3` (notification sound)

## Summary

The notification system is now fully functional and integrated. Users will receive real-time notifications based on their role and hierarchy when new leads arrive or when leads are assigned to them. The system includes visual indicators, sound alerts, and a clean UI for managing notifications.
