import React, { useState, useEffect } from 'react';
import { X, AlertCircle } from 'lucide-react';

export default function ExpenseModal({ isOpen, onClose, group, currentUser, onSubmit }) {
  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState('');
  const [paidById, setPaidById] = useState(currentUser.id.toString());
  const [splitType, setSplitType] = useState('EQUAL');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);

  // State to track split parameters for each member
  // memberValues: { [userId]: value }
  const [memberValues, setMemberValues] = useState({});
  const [validationError, setValidationError] = useState('');

  const members = group?.members || [];

  // Reset or initialize values when modal opens or group/splitType changes
  useEffect(() => {
    if (isOpen) {
      setDescription('');
      setAmount('');
      setPaidById(currentUser.id.toString());
      setSplitType('EQUAL');
      setDate(new Date().toISOString().split('T')[0]);
      setValidationError('');

      // Initialize split values
      const initial = {};
      members.forEach((m) => {
        if (splitType === 'EQUAL') {
          initial[m.userId] = true; // Selected for equal split
        } else if (splitType === 'PERCENTAGE') {
          // Equally distribute percentage initially
          initial[m.userId] = (100 / members.length).toFixed(1);
        } else if (splitType === 'SHARE') {
          initial[m.userId] = '1'; // Default 1 share
        } else {
          initial[m.userId] = ''; // Unequal empty
        }
      });
      setMemberValues(initial);
    }
  }, [isOpen, splitType, group]);

  if (!isOpen) return null;

  const handleValueChange = (userId, val) => {
    setMemberValues({
      ...memberValues,
      [userId]: val,
    });
  };

  const handleCheckboxChange = (userId) => {
    setMemberValues({
      ...memberValues,
      [userId]: !memberValues[userId],
    });
  };

  const validateAndSubmit = (e) => {
    e.preventDefault();
    setValidationError('');

    const parsedAmount = parseFloat(amount);
    if (isNaN(parsedAmount) || parsedAmount <= 0) {
      setValidationError('Please enter a valid amount greater than 0');
      return;
    }

    const payloadSplits = [];

    if (splitType === 'EQUAL') {
      const selectedMembers = Object.keys(memberValues).filter((id) => memberValues[id]);
      if (selectedMembers.length === 0) {
        setValidationError('At least one member must be selected for equal split');
        return;
      }
      selectedMembers.forEach((id) => {
        payloadSplits.push({ userId: parseInt(id) });
      });
    } else if (splitType === 'UNEQUAL') {
      let sum = 0;
      for (const m of members) {
        const val = parseFloat(memberValues[m.userId] || 0);
        if (isNaN(val) || val < 0) {
          setValidationError(`Please enter a valid positive amount for ${m.user.name}`);
          return;
        }
        sum += val;
        payloadSplits.push({ userId: m.userId, owedAmount: val });
      }

      if (Math.abs(sum - parsedAmount) > 0.02) {
        setValidationError(`Sum of splits ($${sum.toFixed(2)}) must equal total amount ($${parsedAmount.toFixed(2)})`);
        return;
      }
    } else if (splitType === 'PERCENTAGE') {
      let sumPct = 0;
      for (const m of members) {
        const val = parseFloat(memberValues[m.userId] || 0);
        if (isNaN(val) || val < 0) {
          setValidationError(`Please enter a valid percentage for ${m.user.name}`);
          return;
        }
        sumPct += val;
        payloadSplits.push({ userId: m.userId, percentageValue: val });
      }

      if (Math.abs(sumPct - 100) > 0.1) {
        setValidationError(`Sum of percentages (${sumPct.toFixed(1)}%) must equal 100%`);
        return;
      }
    } else if (splitType === 'SHARE') {
      let totalShares = 0;
      for (const m of members) {
        const val = parseFloat(memberValues[m.userId] || 0);
        if (isNaN(val) || val < 0) {
          setValidationError(`Please enter a valid share for ${m.user.name}`);
          return;
        }
        totalShares += val;
        payloadSplits.push({ userId: m.userId, shareValue: val });
      }

      if (totalShares <= 0) {
        setValidationError('Total shares must be greater than 0');
        return;
      }
    }

    // Call submit handler
    onSubmit({
      groupId: group.id,
      description,
      amount: parsedAmount,
      paidById: parseInt(paidById),
      splitType,
      date,
      splits: payloadSplits,
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="fixed inset-0 bg-slate-950/85 backdrop-blur-sm" onClick={onClose}></div>
      <div className="relative w-full max-w-lg bg-slate-900 border border-slate-800 p-6 rounded-2xl shadow-2xl overflow-y-auto max-h-[90vh]">
        <div className="flex justify-between items-center mb-6 pb-4 border-b border-slate-800/80">
          <h3 className="text-xl font-bold text-slate-100">Add an Expense</h3>
          <button onClick={onClose} className="p-1 rounded-lg text-slate-400 hover:text-slate-200 transition cursor-pointer">
            <X className="w-5 h-5" />
          </button>
        </div>

        {validationError && (
          <div className="mb-6 p-4 rounded-xl bg-red-950/50 border border-red-800/50 text-red-400 text-sm flex items-start space-x-2">
            <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
            <span>{validationError}</span>
          </div>
        )}

        <form onSubmit={validateAndSubmit} className="space-y-5">
          {/* Description */}
          <div>
            <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
              Description
            </label>
            <input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="e.g. Groceries, Dinner, Cab fare"
              required
              className="w-full bg-slate-950 border border-slate-800 focus:border-teal-500 rounded-xl px-4 py-3 text-slate-100 text-sm focus:outline-none transition"
            />
          </div>

          {/* Amount and Paid By */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
                Paid By
              </label>
              <select
                value={paidById}
                onChange={(e) => setPaidById(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 focus:border-teal-500 rounded-xl px-4 py-3 text-slate-100 text-sm focus:outline-none transition cursor-pointer"
              >
                {members.map((m) => (
                  <option key={m.userId} value={m.userId}>
                    {m.user.id === currentUser.id ? 'You' : m.user.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Split Type and Date */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
                Split Type
              </label>
              <select
                value={splitType}
                onChange={(e) => setSplitType(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 focus:border-teal-500 rounded-xl px-4 py-3 text-slate-100 text-sm focus:outline-none transition cursor-pointer"
              >
                <option value="EQUAL">Split Equally</option>
                <option value="UNEQUAL">Split Unequally ($)</option>
                <option value="PERCENTAGE">Split By Percentage (%)</option>
                <option value="SHARE">Split By Share (1.5, 2, etc.)</option>
              </select>
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
          </div>

          {/* Dynamic Split Section */}
          <div className="border-t border-slate-800/80 pt-4 mt-6">
            <h4 className="text-sm font-bold text-slate-350 mb-4">Split Details</h4>
            
            <div className="space-y-3 max-h-[220px] overflow-y-auto pr-1">
              {members.map((m) => (
                <div key={m.userId} className="flex items-center justify-between bg-slate-950/40 p-3 rounded-xl border border-slate-850">
                  <span className="text-sm font-semibold text-slate-350">{m.user.name}</span>
                  
                  {splitType === 'EQUAL' && (
                    <input
                      type="checkbox"
                      checked={!!memberValues[m.userId]}
                      onChange={() => handleCheckboxChange(m.userId)}
                      className="w-5 h-5 rounded border-slate-800 text-teal-500 focus:ring-teal-500 bg-slate-950 cursor-pointer"
                    />
                  )}

                  {splitType === 'UNEQUAL' && (
                    <div className="relative flex items-center">
                      <span className="absolute left-3 text-slate-500 text-sm">$</span>
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        placeholder="0.00"
                        value={memberValues[m.userId] || ''}
                        onChange={(e) => handleValueChange(m.userId, e.target.value)}
                        className="bg-slate-950 border border-slate-800 focus:border-teal-500 rounded-lg pl-7 pr-3 py-1.5 text-right w-28 text-sm focus:outline-none transition"
                      />
                    </div>
                  )}

                  {splitType === 'PERCENTAGE' && (
                    <div className="relative flex items-center">
                      <input
                        type="number"
                        step="0.1"
                        min="0"
                        placeholder="0.0"
                        value={memberValues[m.userId] || ''}
                        onChange={(e) => handleValueChange(m.userId, e.target.value)}
                        className="bg-slate-950 border border-slate-800 focus:border-teal-500 rounded-lg pl-3 pr-7 py-1.5 text-right w-24 text-sm focus:outline-none transition"
                      />
                      <span className="absolute right-3 text-slate-500 text-sm">%</span>
                    </div>
                  )}

                  {splitType === 'SHARE' && (
                    <input
                      type="number"
                      step="0.5"
                      min="0"
                      placeholder="0"
                      value={memberValues[m.userId] || ''}
                      onChange={(e) => handleValueChange(m.userId, e.target.value)}
                      className="bg-slate-950 border border-slate-800 focus:border-teal-500 rounded-lg px-3 py-1.5 text-right w-20 text-sm focus:outline-none transition"
                    />
                  )}
                </div>
              ))}
            </div>
          </div>

          <div className="flex space-x-3 justify-end pt-4 border-t border-slate-800/80">
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
              Add Expense
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
