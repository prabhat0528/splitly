import React, { useState, useEffect } from 'react';
import { X } from 'lucide-react';

export default function SettleModal({ isOpen, onClose, group, currentUser, onSubmit }) {
  const [fromUserId, setFromUserId] = useState('');
  const [toUserId, setToUserId] = useState('');
  const [amount, setAmount] = useState('');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [error, setError] = useState('');

  const members = group?.members || [];

  useEffect(() => {
    if (isOpen) {
      setAmount('');
      setDate(new Date().toISOString().split('T')[0]);
      setError('');
      
      // Defaults: from currentUser to first member who isn't currentUser
      setFromUserId(currentUser.id.toString());
      const otherMember = members.find((m) => m.userId !== currentUser.id);
      if (otherMember) {
        setToUserId(otherMember.userId.toString());
      } else {
        setToUserId('');
      }
    }
  }, [isOpen, group, currentUser]);

  if (!isOpen) return null;

  const handleSubmit = (e) => {
    e.preventDefault();
    setError('');

    const parsedAmount = parseFloat(amount);
    if (isNaN(parsedAmount) || parsedAmount <= 0) {
      setError('Please enter a valid amount');
      return;
    }

    if (fromUserId === toUserId) {
      setError('A member cannot settle with themselves. Please select a different debtor or creditor.');
      return;
    }

    onSubmit({
      groupId: group.id,
      fromUserId: parseInt(fromUserId),
      toUserId: parseInt(toUserId),
      amount: parsedAmount,
      date,
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="fixed inset-0 bg-slate-950/85 backdrop-blur-sm" onClick={onClose}></div>
      <div className="relative w-full max-w-md bg-slate-900 border border-slate-800 p-6 rounded-2xl shadow-2xl">
        <div className="flex justify-between items-center mb-6 pb-4 border-b border-slate-800/80">
          <h3 className="text-xl font-bold text-slate-100">Record a Payment</h3>
          <button onClick={onClose} className="p-1 rounded-lg text-slate-400 hover:text-slate-200 transition cursor-pointer">
            <X className="w-5 h-5" />
          </button>
        </div>

        {error && (
          <div className="mb-5 p-4 rounded-xl bg-red-950/50 border border-red-800/50 text-red-400 text-sm">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
              Who Paid? (Debtor)
            </label>
            <select
              value={fromUserId}
              onChange={(e) => setFromUserId(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 focus:border-teal-500 rounded-xl px-4 py-3 text-slate-100 text-sm focus:outline-none transition cursor-pointer"
            >
              {members.map((m) => (
                <option key={m.userId} value={m.userId}>
                  {m.user.id === currentUser.id ? 'You' : m.user.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
              Who Received? (Creditor)
            </label>
            <select
              value={toUserId}
              onChange={(e) => setToUserId(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 focus:border-teal-500 rounded-xl px-4 py-3 text-slate-100 text-sm focus:outline-none transition cursor-pointer"
            >
              {members.map((m) => (
                <option key={m.userId} value={m.userId}>
                  {m.user.id === currentUser.id ? 'You' : m.user.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
              Amount ($)
            </label>
            <input
              type="number"
              step="0.01"
              min="0.01"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="0.00"
              required
              className="w-full bg-slate-950 border border-slate-800 focus:border-teal-500 rounded-xl px-4 py-3 text-slate-100 text-sm focus:outline-none transition"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
              Date
            </label>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              required
              className="w-full bg-slate-950 border border-slate-800 focus:border-teal-500 rounded-xl px-4 py-3 text-slate-100 text-sm focus:outline-none transition cursor-pointer"
            />
          </div>

          <div className="flex space-x-3 justify-end pt-4 border-t border-slate-800/80 mt-6">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl border border-slate-800 hover:bg-slate-800 text-slate-400 text-sm font-semibold transition cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-5 py-2 bg-gradient-to-r from-emerald-500 to-teal-500 text-slate-950 font-bold rounded-xl transition text-sm cursor-pointer shadow-lg shadow-teal-500/10"
            >
              Record Payment
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
