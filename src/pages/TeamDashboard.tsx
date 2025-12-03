import React, { useState, useEffect } from 'react';
import { supabase, type UserProfile, type Lead } from '../lib/supabase';
import { Users, TrendingUp, UserCheck } from 'lucide-react';
import { Link } from 'react-router-dom';

const TeamDashboard = () => {
  const [teamMembers, setTeamMembers] = useState<UserProfile[]>([]);
  const [teamStats, setTeamStats] = useState<{[key: string]: { leads: number, conversions: number }>>();
  const [loading, setLoading] = useState(true);

  const fetchTeamData = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Fetch team members (direct reports)
      const { data: members, error: membersError } = await supabase
        .from('user_profiles')
        .select('*')
        .eq('manager_id', user.id);

      if (membersError) throw membersError;
      setTeamMembers(members || []);

      // Fetch stats for each team member
      const stats: {[key: string]: { leads: number, conversions: number }} = {};
      
      for (const member of members || []) {
        const { data: leads } = await supabase
          .from('leads')
          .select('id, is_converted')
          .eq('assigned_to', member.id);

        stats[member.id] = {
          leads: leads?.length || 0,
          conversions: leads?.filter(l => l.is_converted).length || 0
        };
      }

      setTeamStats(stats);
    } catch (error) {
      console.error('Error fetching team data:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTeamData();
  }, []);

  if (loading) {
    return <div className="p-6">Loading...</div>;
  }

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-6">Team Dashboard</h1>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {teamMembers.map((member) => (
          <div key={member.id} className="bg-gray-800 rounded-lg p-6">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-lg font-semibold">{member.full_name}</h3>
                <p className="text-sm text-gray-400">{member.role}</p>
              </div>
              <Users className="text-blue-500" size={24} />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="bg-gray-700 rounded-lg p-4">
                <div className="flex items-center justify-between">
                  <TrendingUp size={20} className="text-green-500" />
                  <span className="text-2xl font-bold">
                    {teamStats?.[member.id]?.leads || 0}
                  </span>
                </div>
                <p className="text-sm text-gray-400 mt-1">Active Leads</p>
              </div>

              <div className="bg-gray-700 rounded-lg p-4">
                <div className="flex items-center justify-between">
                  <UserCheck size={20} className="text-purple-500" />
                  <span className="text-2xl font-bold">
                    {teamStats?.[member.id]?.conversions || 0}
                  </span>
                </div>
                <p className="text-sm text-gray-400 mt-1">Conversions</p>
              </div>
            </div>

            <Link
              to={`/team/${member.id}`}
              className="mt-4 block text-center py-2 px-4 bg-blue-600 rounded-lg hover:bg-blue-500 transition-colors"
            >
              View Details
            </Link>
          </div>
        ))}
      </div>
    </div>
  );
};

export default TeamDashboard;