import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase, type Deposit } from '../lib/supabase';
import { Euro as EuroSign } from 'lucide-react';
import { DateTime } from 'luxon';

interface DepositHistoryProps {
  leadId: string;
}

const DepositHistory: React.FC<DepositHistoryProps> = ({ leadId }) => {
  const { data: deposits, isLoading } = useQuery({
    queryKey: ['deposits', leadId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('deposits')
        .select(`
          *,
          created_by_user:user_profiles!deposits_created_by_fkey(full_name)
        `)
        .eq('lead_id', leadId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data as Deposit[];
    }
  });

  if (isLoading) {
    return <div className="text-sm text-gray-400">Loading deposits...</div>;
  }

  if (!deposits || deposits.length === 0) {
    return <div className="text-sm text-gray-400">No deposits yet</div>;
  }

  return (
    <div className="space-y-3">
      {deposits.map((deposit) => (
        <div key={deposit.id} className="bg-gray-700 rounded-lg p-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <EuroSign size={16} className="text-green-400" />
              <span className="font-medium">€{deposit.amount.toLocaleString()}</span>
            </div>
            <span className="text-sm text-gray-400">
              {DateTime.fromISO(deposit.created_at).toRelative()}
            </span>
          </div>
          <div className="text-sm text-gray-400 mt-1">
            Added by {deposit.created_by_user?.full_name}
          </div>
        </div>
      ))}
    </div>
  );
};

export default DepositHistory;