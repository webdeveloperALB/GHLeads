import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { BarChart, TrendingUp, Users, DollarSign } from 'lucide-react';
import { DateTime } from 'luxon';

interface ApiStats {
  affiliator: string;
  source_prefix: string;
  total_leads: number;
  converted_leads: number;
  total_deposits: number;
  last_lead: string | null;
}

const ApiDashboard = () => {
  const [stats, setStats] = useState<ApiStats[]>([]);
  const [timeframe, setTimeframe] = useState<'24h' | '7d' | '30d' | 'all'>('30d');
  const [loading, setLoading] = useState(true);

  const fetchStats = async () => {
    try {
      // First get all API keys
      const { data: apiKeys, error: apiKeyError } = await supabase
        .from('api_keys')
        .select('name, source_prefix');

      if (apiKeyError) throw apiKeyError;

      // Then get leads for each API key
      const now = DateTime.now();
      const stats: ApiStats[] = await Promise.all(
        (apiKeys || []).map(async (key) => {
          // Fetch all leads for this API key using pagination
          let allLeads: any[] = [];
          let hasMore = true;
          let offset = 0;
          const batchSize = 1000;

          while (hasMore) {
            const { data: batchLeads, error: leadsError } = await supabase
              .from('leads')
              .select('created_at, is_converted, total_deposits, status, has_deposited')
              .eq('source', key.source_prefix)
              .range(offset, offset + batchSize - 1);

            if (leadsError) throw leadsError;
            
            if (batchLeads && batchLeads.length > 0) {
              allLeads = [...allLeads, ...batchLeads];
              
              if (batchLeads.length < batchSize) {
                hasMore = false;
              } else {
                offset += batchSize;
              }
            } else {
              hasMore = false;
            }
          }

          const leads = allLeads;

          const filteredLeads = (leads || []).filter(lead => {
            const leadDate = DateTime.fromISO(lead.created_at);
            switch (timeframe) {
              case '24h':
                return now.diff(leadDate, 'hours').hours <= 24;
              case '7d':
                return now.diff(leadDate, 'days').days <= 7;
              case '30d':
                return now.diff(leadDate, 'days').days <= 30;
              default:
                return true;
            }
          });

          const lastLead = filteredLeads.length > 0 
            ? filteredLeads.sort((a, b) => 
                DateTime.fromISO(b.created_at).toMillis() - DateTime.fromISO(a.created_at).toMillis()
              )[0].created_at
            : null;

          return {
            affiliator: key.name,
            source_prefix: key.source_prefix,
            total_leads: filteredLeads.length,
            converted_leads: filteredLeads.filter(l => 
              l.has_deposited && 
              l.status !== 'Fake FTD' && 
              l.status !== 'TEST FTD'
            ).length,
            total_deposits: filteredLeads.reduce((sum, l) => sum + (l.total_deposits || 0), 0),
            last_lead: lastLead
          };
        })
      );

      setStats(stats.sort((a, b) => b.total_leads - a.total_leads));
    } catch (error) {
      console.error('Error fetching API stats:', error);
      toast.error('Failed to fetch API stats');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStats();
  }, [timeframe]);

  if (loading) {
    return <div className="p-6">Loading...</div>;
  }

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">API Dashboard</h1>
        <div className="flex space-x-2">
          <button
            onClick={() => setTimeframe('24h')}
            className={`px-3 py-1 rounded ${
              timeframe === '24h' ? 'bg-blue-600' : 'bg-gray-700 hover:bg-gray-600'
            }`}
          >
            24h
          </button>
          <button
            onClick={() => setTimeframe('7d')}
            className={`px-3 py-1 rounded ${
              timeframe === '7d' ? 'bg-blue-600' : 'bg-gray-700 hover:bg-gray-600'
            }`}
          >
            7d
          </button>
          <button
            onClick={() => setTimeframe('30d')}
            className={`px-3 py-1 rounded ${
              timeframe === '30d' ? 'bg-blue-600' : 'bg-gray-700 hover:bg-gray-600'
            }`}
          >
            30d
          </button>
          <button
            onClick={() => setTimeframe('all')}
            className={`px-3 py-1 rounded ${
              timeframe === 'all' ? 'bg-blue-600' : 'bg-gray-700 hover:bg-gray-600'
            }`}
          >
            All Time
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
        <div className="bg-gray-800 rounded-lg p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-medium">Total Leads</h3>
            <Users className="text-blue-400" size={24} />
          </div>
          <p className="text-3xl font-bold">
            {stats.reduce((sum, s) => sum + s.total_leads, 0)}
          </p>
        </div>

        <div className="bg-gray-800 rounded-lg p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-medium">Converted Leads</h3>
            <TrendingUp className="text-green-400" size={24} />
          </div>
          <p className="text-3xl font-bold">
            {stats.reduce((sum, s) => sum + s.converted_leads, 0)}
          </p>
        </div>

        <div className="bg-gray-800 rounded-lg p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-medium">Total Deposits</h3>
            <DollarSign className="text-yellow-400" size={24} />
          </div>
          <p className="text-3xl font-bold">
            ${stats.reduce((sum, s) => sum + s.total_deposits, 0).toLocaleString()}
          </p>
        </div>
      </div>

      <div className="bg-gray-800 rounded-lg overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="bg-gray-700">
              <th className="px-6 py-3 text-left">Affiliator</th>
              <th className="px-6 py-3 text-left">Source</th>
              <th className="px-6 py-3 text-right">Leads</th>
              <th className="px-6 py-3 text-right">Converted</th>
              <th className="px-6 py-3 text-right">Deposits</th>
              <th className="px-6 py-3 text-left">Last Lead</th>
            </tr>
          </thead>
          <tbody>
            {stats.map((stat, index) => (
              <tr key={stat.source_prefix} className={index % 2 === 0 ? 'bg-gray-800' : 'bg-gray-750'}>
                <td className="px-6 py-4">{stat.affiliator}</td>
                <td className="px-6 py-4">{stat.source_prefix}</td>
                <td className="px-6 py-4 text-right">{stat.total_leads}</td>
                <td className="px-6 py-4 text-right">
                  {stat.converted_leads}
                  {stat.total_leads > 0 && (
                    <span className="text-gray-400 ml-1">
                      ({((stat.converted_leads / stat.total_leads) * 100).toFixed(1)}%)
                    </span>
                  )}
                </td>
                <td className="px-6 py-4 text-right">${stat.total_deposits.toLocaleString()}</td>
                <td className="px-6 py-4">
                  {stat.last_lead
                    ? DateTime.fromISO(stat.last_lead).toRelative()
                    : 'Never'
                  }
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default ApiDashboard;