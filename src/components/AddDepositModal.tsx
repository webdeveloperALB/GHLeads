import React, { useState } from 'react';
import { X, Euro as EuroSign } from 'lucide-react';
import { supabase } from '../lib/supabase';
import toast from 'react-hot-toast';

interface AddDepositModalProps {
  isOpen: boolean;
  onClose: () => void;
  leadId: string;
  onSuccess: () => void;
}

const AddDepositModal: React.FC<AddDepositModalProps> = ({ isOpen, onClose, leadId, onSuccess }) => {
  const [amount, setAmount] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!amount || isNaN(Number(amount))) return;

    setLoading(true);
    try {
      // Get current user session
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('No active session');

      // First create the deposit record
      const { error: depositError } = await supabase
        .from('deposits')
        .insert({
          lead_id: leadId,
          amount: Number(amount),
          created_by: session.user.id
        });

      if (depositError) throw depositError;

      // Get current lead data
      const { data: lead, error: leadError } = await supabase
        .from('leads') 
        .select('balance, total_deposits, has_deposited')
        .eq('id', leadId)
        .single();

      if (leadError) throw leadError;

      const depositAmount = Number(amount);
      const newBalance = (lead.balance || 0) + depositAmount;
      const newTotalDeposits = (lead.total_deposits || 0) + depositAmount;
      
      const updatePayload: Record<string, any> = {
        balance: newBalance,
        total_deposits: newTotalDeposits,
        status: 'Deposited'
      };
      if (!lead.has_deposited) {
        updatePayload.ftd_date = new Date().toISOString();
      }

      // Update lead with new balance and total deposits
      const { error: updateError } = await supabase
        .from('leads')
        .update(updatePayload)
        .eq('id', leadId);

      if (updateError) throw updateError;

      await supabase.from('lead_activities').insert({
        lead_id: leadId,
        type: 'deposit',
        description: `Deposit of €${depositAmount} added`
      });

      toast.success('Deposit added successfully');
      onSuccess();
      onClose();
      setAmount(''); // Reset form
    } catch (error) {
      console.error('Error adding deposit:', error);
      toast.error('Failed to add deposit');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-gray-800 rounded-lg p-6 w-full max-w-md">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-semibold">Add Deposit</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-white">
            <X size={24} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm text-gray-400 mb-1">Amount (EUR)</label>
            <div className="relative">
              <EuroSign size={16} className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
              <input
                type="number"
                step="0.01"
                min="0"
                required
                className="w-full bg-gray-700 rounded-lg pl-10 pr-3 py-2"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="0.00"
              />
            </div>
          </div>

          <div className="flex justify-end space-x-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-gray-700 rounded-lg hover:bg-gray-600"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading || !amount}
              className="px-4 py-2 bg-green-600 rounded-lg hover:bg-green-500 disabled:opacity-50"
            >
              {loading ? 'Adding...' : 'Add Deposit'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default AddDepositModal;