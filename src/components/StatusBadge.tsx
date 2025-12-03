import React, { useState } from 'react';
import { supabase } from '../lib/supabase';
import { useQuery } from '@tanstack/react-query';
import { ChevronDown } from 'lucide-react';

interface StatusBadgeProps {
  status: string;
  onChange?: (newStatus: string) => void;
}

const StatusBadge: React.FC<StatusBadgeProps> = ({ status, onChange }) => {
  const [isOpen, setIsOpen] = useState(false);

  const { data: statusData } = useQuery({
    queryKey: ['status', status],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('lead_statuses')
        .select('color')
        .eq('name', status)
        .single();

      if (error) throw error;
      return data;
    },
    staleTime: 5 * 60 * 1000,
    placeholderData: { color: '#9CA3AF' }
  });

  // ✅ ONLY load statuses list when dropdown is opened
  const { data: statuses } = useQuery({
    queryKey: ['statuses'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('lead_statuses')
        .select('*')
        .order('name');

      if (error) throw error;
      return data || [];
    },
    staleTime: 5 * 60 * 1000,
    enabled: isOpen // ⚡ This prevents loading until dropdown is opened
  });

  if (!onChange) {
    return (
      <span
        className="px-2 py-1 rounded text-sm font-medium"
        style={{
          backgroundColor: `${statusData?.color}20`,
          color: statusData?.color
        }}
      >
        {status}
      </span>
    );
  }

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between px-2 py-1 rounded text-sm font-medium hover:bg-gray-700"
        style={{
          backgroundColor: `${statusData?.color}20`,
          color: statusData?.color
        }}
      >
        <span>{status}</span>
        <ChevronDown size={14} className="ml-1" />
      </button>

      {isOpen && (
        <>
          <div
            className="fixed inset-0 z-10"
            onClick={() => setIsOpen(false)}
          />
          <div className="absolute z-20 mt-1 w-48 bg-gray-800 rounded-lg shadow-lg py-1 max-h-48 overflow-auto">
            {statuses?.map((s) => (
              <button
                key={s.name}
                onClick={() => {
                  onChange(s.name);
                  setIsOpen(false);
                }}
                className="w-full text-left px-3 py-1 hover:bg-gray-700 text-sm"
                style={{
                  color: s.name === status ? s.color : undefined
                }}
              >
                {s.name}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
};

export default StatusBadge;
