import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { Clock, Monitor, MapPin } from 'lucide-react';
import { DateTime } from 'luxon';
import UAParser from 'ua-parser-js';

interface LoginLog {
  id: string;
  user_id: string;
  ip_address: string;
  user_agent: string;
  created_at: string;
  city: string | null;
  country: string | null;
  user: {
    id: string;
    full_name: string;
    role: string;
  };
}

const Settings = () => {
  const [loginLogs, setLoginLogs] = useState<LoginLog[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchLoginLogs();
  }, []);

  const fetchLoginLogs = async () => {
    try {
      const { data, error } = await supabase
        .from('login_logs')
        .select(`
          id,
          user_id,
          ip_address,
          user_agent,
          created_at,
          city,
          country,
          user:user_profiles!login_logs_user_id_fkey(
            id,
            full_name,
            role
          )
        `)
        .order('created_at', { ascending: false })
        .limit(100); // Limit to last 100 logins for performance

      if (error) throw error;
      setLoginLogs(data || []);
    } catch (error) {
      console.error('Error fetching login logs:', error);
    } finally {
      setLoading(false);
    }
  };

  const parseUserAgent = (userAgentString: string) => {
    try {
      const data = JSON.parse(userAgentString);
      const parser = new UAParser();
      const result = parser.setUA(data.ua || '').getResult();
      
      return {
        browser: `${result.browser.name || 'Unknown'} ${result.browser.version || ''}`.trim(),
        os: result.os.name || 'Unknown',
        device: result.device.type ? 
          `${result.device.vendor || ''} ${result.device.model || ''} (${result.device.type})`.trim() : 
          'Desktop'
      };
    } catch (error) {
      return {
        browser: 'Unknown Browser',
        os: 'Unknown OS',
        device: 'Unknown Device'
      };
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-400">Loading login history...</div>
      </div>
    );
  }

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">Settings</h1>

      <div className="bg-gray-800 rounded-lg p-6">
        <h2 className="text-xl font-semibold mb-4">Login History</h2>
        {loginLogs.length === 0 ? (
          <div className="text-gray-400 text-center py-8">
            No login history available
          </div>
        ) : (
          <div className="space-y-4">
            {loginLogs.map((log) => {
              const deviceInfo = parseUserAgent(log.user_agent);
              return (
                <div key={log.id} className="bg-gray-700 rounded-lg p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                      <div className="font-medium">{log.user.full_name}</div>
                      <span className={`px-2 py-0.5 rounded text-xs ${
                        log.user.role === 'admin' ? 'bg-red-500/20 text-red-400' :
                        log.user.role === 'manager' ? 'bg-blue-500/20 text-blue-400' :
                        'bg-gray-500/20 text-gray-400'
                      }`}>
                        {log.user.role}
                      </span>
                    </div>
                    <div className="flex items-center text-sm text-gray-400">
                      <Clock size={16} className="mr-2" />
                      {DateTime.fromISO(log.created_at).toFormat('dd LLL yyyy HH:mm:ss')}
                      <span className="ml-2 text-xs">
                        ({DateTime.fromISO(log.created_at).toRelative()})
                      </span>
                    </div>
                  </div>
                  <div className="mt-2 space-y-2 text-sm text-gray-400">
                    <div className="flex items-center">
                      <Monitor size={16} className="mr-2 text-blue-400" />
                      <span className="mr-2">{deviceInfo.browser}</span>
                      <span className="px-1.5 py-0.5 bg-gray-600 rounded-full text-xs">
                        {deviceInfo.os}
                      </span>
                      {deviceInfo.device !== 'Desktop' && (
                        <span className="ml-2 px-1.5 py-0.5 bg-gray-600 rounded-full text-xs">
                          {deviceInfo.device}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center">
                      <MapPin size={16} className="mr-2 text-green-400" />
                      <div>
                        <div>{log.ip_address}</div>
                        {(log.city || log.country) && (
                          <div className="text-xs text-gray-500">
                            {[log.city, log.country].filter(Boolean).join(', ')}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

export default Settings;