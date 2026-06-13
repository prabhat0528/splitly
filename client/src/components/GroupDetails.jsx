import React, { useState, useEffect, useRef } from 'react';
import { ArrowLeft, Plus, CreditCard, UserPlus, Search, MessageSquare, Trash2, Send, X, AlertCircle } from 'lucide-react';
import io from 'socket.io-client';
import api from '../utils/api.js';
import ExpenseModal from './ExpenseModal.jsx';
import SettleModal from './SettleModal.jsx';

export default function GroupDetails({ groupId, currentUser, onBack }) {
  const [group, setGroup] = useState(null);
  const [balances, setBalances] = useState({ groupBalances: [], simplifiedDebts: [] });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Modals state
  const [isExpenseOpen, setIsExpenseOpen] = useState(false);
  const [isSettleOpen, setIsSettleOpen] = useState(false);

  // Add Member State
  const [showAddMember, setShowAddMember] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [addMemberError, setAddMemberError] = useState('');

  // Active Expense Details Drawer (with Live Chat)
  const [activeExpense, setActiveExpense] = useState(null);
  const [chatMessages, setChatMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const socketRef = useRef(null);
  const chatBottomRef = useRef(null);

  const fetchGroupDetails = async () => {
    try {
      setLoading(true);
      const [groupData, balanceData] = await Promise.all([
        api.get(`/groups/${groupId}`),
        api.get(`/settlements/groups/${groupId}/balances`),
      ]);
      setGroup(groupData);
      setBalances(balanceData);
    } catch (err) {
      console.error(err);
      setError('Failed to load group details');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchGroupDetails();
  }, [groupId]);

  // Search users for invite
  useEffect(() => {
    const delayDebounce = setTimeout(async () => {
      if (searchQuery.trim().length >= 2) {
        try {
          const results = await api.get(`/auth/search?q=${searchQuery}`);
          // Filter out existing members
          const memberIds = group.members.map((m) => m.userId);
          const filtered = results.filter((r) => !memberIds.includes(r.id));
          setSearchResults(filtered);
        } catch (err) {
          console.error(err);
        }
      } else {
        setSearchResults([]);
      }
    }, 300);

    return () => clearTimeout(delayDebounce);
  }, [searchQuery, group]);

  // Handle Websocket Chat connection when an expense is selected
  useEffect(() => {
    if (activeExpense) {
      // 1. Fetch historical messages
      api.get(`/comments/expense/${activeExpense.id}`).then((msgs) => {
        setChatMessages(msgs);
        scrollToBottom();
      }).catch(err => console.error(err));

      // 2. Connect socket
      socketRef.current = io('http://localhost:5000');
      
      socketRef.current.on('connect', () => {
        socketRef.current.emit('join_expense', { expenseId: activeExpense.id });
      });

      socketRef.current.on('new_message', (comment) => {
        setChatMessages((prev) => [...prev, comment]);
        scrollToBottom();
      });

      socketRef.current.on('error', (err) => {
        console.error('Socket error:', err);
      });
    }

    return () => {
      if (socketRef.current) {
        if (activeExpense) {
          socketRef.current.emit('leave_expense', { expenseId: activeExpense.id });
        }
        socketRef.current.disconnect();
        socketRef.current = null;
      }
    };
  }, [activeExpense]);

  const scrollToBottom = () => {
    setTimeout(() => {
      chatBottomRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, 100);
  };

  // Add Member Submission
  const handleAddMember = async (userId) => {
    setAddMemberError('');
    try {
      const newMember = await api.post(`/groups/${groupId}/members`, { userId });
      // Add member locally
      setGroup({
        ...group,
        members: [...group.members, newMember],
      });
      // Refresh balances
      const balData = await api.get(`/settlements/groups/${groupId}/balances`);
      setBalances(balData);
      setSearchQuery('');
      setSearchResults([]);
      setShowAddMember(false);
    } catch (err) {
      setAddMemberError(err.message || 'Failed to add member');
    }
  };

  // Add Expense Submission
  const handleExpenseSubmit = async (payload) => {
    try {
      await api.post('/expenses', payload);
      setIsExpenseOpen(false);
      fetchGroupDetails(); // Reload expenses and balances
    } catch (err) {
      alert(err.message || 'Failed to add expense');
    }
  };

  // Record Settlement Submission
  const handleSettleSubmit = async (payload) => {
    try {
      await api.post('/settlements', payload);
      setIsSettleOpen(false);
      fetchGroupDetails(); // Reload
    } catch (err) {
      alert(err.message || 'Failed to record payment');
    }
  };

  // Delete Expense
  const handleDeleteExpense = async (expenseId, e) => {
    e.stopPropagation(); // Stop click propagating to row
    if (!window.confirm('Are you sure you want to delete this expense?')) return;
    try {
      await api.delete(`/expenses/${expenseId}`);
      if (activeExpense?.id === expenseId) {
        setActiveExpense(null);
      }
      fetchGroupDetails();
    } catch (err) {
      alert(err.message || 'Failed to delete expense');
    }
  };

  // Send Chat Message
  const handleSendChatMessage = (e) => {
    e.preventDefault();
    if (!newMessage.trim() || !socketRef.current) return;

    socketRef.current.emit('send_message', {
      expenseId: activeExpense.id,
      userId: currentUser.id,
      message: newMessage,
    });
    setNewMessage('');
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-teal-500"></div>
      </div>
    );
  }

  if (error || !group) {
    return (
      <div className="max-w-md mx-auto py-12 text-center">
        <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
        <h3 className="text-xl font-bold text-slate-100">Error Loading Group</h3>
        <p className="text-slate-400 mt-2">{error || 'Group not found'}</p>
        <button onClick={onBack} className="mt-4 px-4 py-2 bg-slate-800 rounded-xl text-slate-200">
          Go Back
        </button>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      {/* Back to Dashboard */}
      <button
        onClick={onBack}
        className="flex items-center space-x-2 text-slate-400 hover:text-slate-200 mb-6 transition cursor-pointer"
      >
        <ArrowLeft className="w-4 h-4" />
        <span className="text-sm font-semibold">Back to Dashboard</span>
      </button>

      {/* Group Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between pb-6 border-b border-slate-800/60 gap-4 mb-8">
        <div>
          <h1 className="text-3xl font-extrabold text-slate-100 tracking-tight">{group.name}</h1>
          <p className="text-slate-400 mt-1">{group.description || 'No description'}</p>
        </div>
        <div className="flex flex-wrap gap-3">
          <button
            onClick={() => setShowAddMember(true)}
            className="flex items-center space-x-2 bg-slate-900 border border-slate-800 hover:bg-slate-800 text-slate-200 px-4 py-2.5 rounded-xl text-sm font-bold transition cursor-pointer"
          >
            <UserPlus className="w-4.5 h-4.5 text-teal-400" />
            <span>Invite Friends</span>
          </button>
          <button
            onClick={() => setIsSettleOpen(true)}
            className="flex items-center space-x-2 bg-slate-900 border border-slate-850 hover:border-slate-750 text-slate-200 px-4 py-2.5 rounded-xl text-sm font-bold transition cursor-pointer"
          >
            <CreditCard className="w-4.5 h-4.5 text-emerald-400" />
            <span>Settle Up</span>
          </button>
          <button
            onClick={() => setIsExpenseOpen(true)}
            className="flex items-center space-x-2 bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 text-slate-950 font-extrabold px-5 py-2.5 rounded-xl text-sm shadow-lg shadow-teal-500/10 transition cursor-pointer"
          >
            <Plus className="w-4.5 h-4.5 stroke-[2.5]" />
            <span>Add Expense</span>
          </button>
        </div>
      </div>

      {/* Main Grid: Expenses & Group Balances */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* Expenses List Panel (Left/Center) */}
        <div className="lg:col-span-2 space-y-6">
          <h2 className="text-xl font-bold text-slate-150">Group Expenses</h2>

          {(!group.expenses || group.expenses.length === 0) ? (
            <div className="bg-slate-900/20 border border-dashed border-slate-800 p-12 rounded-2xl text-center">
              <Plus className="w-10 h-10 text-slate-600 mx-auto mb-3" />
              <h3 className="font-bold text-slate-300">No expenses yet</h3>
              <p className="text-sm text-slate-500 mt-1">
                Add an expense to start tracking splits.
              </p>
            </div>
          ) : (
            <div className="bg-slate-900/40 border border-slate-800/60 rounded-2xl overflow-hidden divide-y divide-slate-850">
              {group.expenses.map((exp) => (
                <div
                  key={exp.id}
                  onClick={() => setActiveExpense(exp)}
                  className={`p-4 sm:p-5 flex items-center justify-between hover:bg-slate-900/60 transition cursor-pointer ${activeExpense?.id === exp.id ? 'bg-slate-900/50 border-l-2 border-teal-500' : ''}`}
                >
                  <div className="flex items-center space-x-4">
                    {/* Date Block */}
                    <div className="bg-slate-950 border border-slate-800 p-2.5 rounded-xl text-center w-12 shrink-0">
                      <span className="text-[10px] uppercase font-bold text-slate-500 block leading-none">
                        {new Date(exp.date).toLocaleString('default', { month: 'short' })}
                      </span>
                      <span className="text-base font-black text-slate-200 leading-none mt-1 block">
                        {new Date(exp.date).getDate()}
                      </span>
                    </div>
                    {/* Details */}
                    <div>
                      <h4 className="font-bold text-slate-200 text-sm sm:text-base leading-snug group-hover:text-teal-400 transition">
                        {exp.description}
                      </h4>
                      <p className="text-xs text-slate-500 mt-1">
                        Paid by <span className="font-semibold">{exp.payer.id === currentUser.id ? 'You' : exp.payer.name}</span>
                      </p>
                    </div>
                  </div>

                  {/* Splits Details / Pricing */}
                  <div className="flex items-center space-x-4 text-right">
                    <div>
                      <span className="text-xs text-slate-500 block uppercase font-bold tracking-wider">Total</span>
                      <span className="text-sm sm:text-base font-black text-slate-300">
                        ${parseFloat(exp.amount).toFixed(2)}
                      </span>
                    </div>

                    {/* How this user is impacted */}
                    <div className="w-24 hidden sm:block">
                      {(() => {
                        const mySplit = exp.splits.find((s) => s.userId === currentUser.id);
                        if (exp.paidById === currentUser.id) {
                          // Current user paid
                          const othersOwe = parseFloat(exp.amount) - (mySplit ? parseFloat(mySplit.owedAmount) : 0);
                          return (
                            <>
                              <span className="text-[10px] text-emerald-500 font-bold block uppercase tracking-wider">You lent</span>
                              <span className="text-sm font-black text-emerald-400">${othersOwe.toFixed(2)}</span>
                            </>
                          );
                        } else if (mySplit) {
                          // Someone else paid, user is in split
                          return (
                            <>
                              <span className="text-[10px] text-orange-500 font-bold block uppercase tracking-wider">You borrowed</span>
                              <span className="text-sm font-black text-orange-400">${parseFloat(mySplit.owedAmount).toFixed(2)}</span>
                            </>
                          );
                        } else {
                          // Not involved
                          return <span className="text-xs text-slate-600 block">Not involved</span>;
                        }
                      })()}
                    </div>

                    {/* Chat indicator & Actions */}
                    <div className="flex items-center space-x-1">
                      <button
                        onClick={(e) => handleDeleteExpense(exp.id, e)}
                        className="p-1.5 rounded-lg text-slate-600 hover:text-red-400 hover:bg-red-500/10 active:scale-95 transition cursor-pointer"
                        title="Delete expense"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Group Balances & Debts Panel (Right) */}
        <div className="space-y-6">
          {/* Member List & Net Balances */}
          <div>
            <h2 className="text-xl font-bold text-slate-150 mb-4">Member Balances</h2>
            <div className="bg-slate-900/40 border border-slate-800/60 rounded-2xl overflow-hidden divide-y divide-slate-850">
              {balances.groupBalances.map((gb) => (
                <div key={gb.user.id} className="p-4 flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <div className="w-9 h-9 rounded-full bg-slate-850 flex items-center justify-center text-slate-300 font-bold text-sm">
                      {gb.user.name.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <h4 className="font-bold text-sm text-slate-200">{gb.user.id === currentUser.id ? 'You' : gb.user.name}</h4>
                      <span className="text-xs text-slate-500">{gb.user.email}</span>
                    </div>
                  </div>
                  <div className="text-right">
                    {gb.netBalance === 0 ? (
                      <span className="text-xs text-slate-500 font-semibold">Settled</span>
                    ) : (
                      <span className={`text-xs font-bold ${gb.netBalance > 0 ? 'text-emerald-400' : 'text-orange-400'}`}>
                        {gb.netBalance > 0 ? 'owed' : 'owes'}{' '}
                        <span className="text-sm font-black">${Math.abs(gb.netBalance).toFixed(2)}</span>
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Simplified Debts List (The Splitwise Magic) */}
          <div>
            <h2 className="text-xl font-bold text-slate-150 mb-4">Suggested Settlements</h2>
            <div className="bg-slate-900/40 border border-slate-800/60 p-4 rounded-2xl space-y-3">
              {balances.simplifiedDebts.length === 0 ? (
                <p className="text-sm text-slate-500 text-center py-2">Everyone is completely settled!</p>
              ) : (
                balances.simplifiedDebts.map((debt, index) => (
                  <div key={index} className="flex items-center justify-between text-sm bg-slate-950/40 p-3 rounded-xl border border-slate-850">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="font-semibold text-slate-300">{debt.fromUser.id === currentUser.id ? 'You' : debt.fromUser.name}</span>
                      <span className="text-slate-500 text-xs uppercase font-bold tracking-wider px-1">should pay</span>
                      <span className="font-semibold text-slate-350">{debt.toUser.id === currentUser.id ? 'You' : debt.toUser.name}</span>
                    </div>
                    <span className="font-extrabold text-teal-400 text-base shrink-0">${debt.amount.toFixed(2)}</span>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

      </div>

      {/* Invite Member Drawer/Modal */}
      {showAddMember && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm" onClick={() => setShowAddMember(false)}></div>
          <div className="relative w-full max-w-md bg-slate-900 border border-slate-800 p-6 rounded-2xl shadow-2xl">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-bold text-slate-100">Add Member to Group</h3>
              <button onClick={() => setShowAddMember(false)} className="text-slate-400 hover:text-slate-200 cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>

            {addMemberError && (
              <div className="mb-4 p-3 rounded-lg bg-red-950/50 border border-red-800/50 text-red-400 text-sm">
                {addMemberError}
              </div>
            )}

            <div className="relative mb-4">
              <Search className="absolute left-3.5 top-3.5 text-slate-500 w-4 h-4" />
              <input
                type="text"
                placeholder="Search by name or email..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 focus:border-teal-500 rounded-xl pl-10 pr-4 py-3 text-slate-100 text-sm focus:outline-none transition"
              />
            </div>

            <div className="max-h-[200px] overflow-y-auto space-y-2">
              {searchQuery.trim().length < 2 ? (
                <p className="text-xs text-slate-500 text-center py-4">Type at least 2 characters to search.</p>
              ) : searchResults.length === 0 ? (
                <p className="text-xs text-slate-500 text-center py-4">No users found matching "{searchQuery}"</p>
              ) : (
                searchResults.map((user) => (
                  <div
                    key={user.id}
                    className="p-3 bg-slate-950/40 hover:bg-slate-950 border border-slate-850 hover:border-slate-800 flex items-center justify-between rounded-xl transition cursor-pointer"
                    onClick={() => handleAddMember(user.id)}
                  >
                    <div>
                      <h4 className="text-sm font-bold text-slate-200">{user.name}</h4>
                      <p className="text-xs text-slate-500">{user.email}</p>
                    </div>
                    <button className="text-xs bg-teal-500/10 hover:bg-teal-500 text-teal-400 hover:text-slate-950 px-3 py-1.5 font-bold rounded-lg transition">
                      Add
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* Side-Drawer: Expense Details & Live Chat */}
      {activeExpense && (
        <div className="fixed inset-y-0 right-0 z-50 w-full sm:w-[450px] bg-slate-900 border-l border-slate-800 shadow-2xl flex flex-col justify-between transform transition-transform duration-300">
          {/* Header */}
          <div className="p-5 border-b border-slate-800 flex items-center justify-between">
            <div>
              <span className="text-[10px] text-slate-500 font-extrabold uppercase tracking-wider block">Expense Details</span>
              <h3 className="text-lg font-bold text-slate-100 mt-1 line-clamp-1">{activeExpense.description}</h3>
            </div>
            <button
              onClick={() => setActiveExpense(null)}
              className="p-1.5 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Body Content (Splits breakdown) */}
          <div className="p-5 border-b border-slate-800/80 bg-slate-950/20 max-h-[30%] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <span className="text-sm text-slate-400">Total Amount:</span>
              <span className="text-lg font-black text-slate-200">${parseFloat(activeExpense.amount).toFixed(2)}</span>
            </div>
            <div className="flex items-center justify-between mb-4 pb-3 border-b border-slate-850">
              <span className="text-sm text-slate-400">Paid By:</span>
              <span className="text-sm font-bold text-slate-250">
                {activeExpense.payer.id === currentUser.id ? 'You' : activeExpense.payer.name}
              </span>
            </div>

            <div className="space-y-2.5">
              <span className="text-xs text-slate-500 font-bold uppercase tracking-wider block mb-1">Splits Breakdown</span>
              {activeExpense.splits?.map((split) => (
                <div key={split.userId} className="flex justify-between items-center text-sm">
                  <span className="text-slate-400">{split.user.name}</span>
                  <span className="font-extrabold text-slate-200">${parseFloat(split.owedAmount).toFixed(2)}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Real-time Comment Board */}
          <div className="flex-1 flex flex-col justify-between overflow-hidden bg-slate-950/40">
            {/* Scrollable messages area */}
            <div className="flex-1 p-5 overflow-y-auto space-y-4">
              <span className="text-xs text-slate-500 font-bold uppercase tracking-wider block mb-2 border-b border-slate-850/40 pb-2">
                Expense Chat (Live)
              </span>

              {chatMessages.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-[180px] text-slate-600">
                  <MessageSquare className="w-8 h-8 mb-2" />
                  <p className="text-xs">No messages yet. Say something!</p>
                </div>
              ) : (
                chatMessages.map((msg) => {
                  const isMe = msg.userId === currentUser.id;
                  return (
                    <div key={msg.id} className={`flex flex-col ${isMe ? 'items-end' : 'items-start'}`}>
                      <div className="flex items-center space-x-1.5 mb-1">
                        <span className="text-[10px] font-bold text-slate-500">
                          {isMe ? 'You' : msg.user.name}
                        </span>
                        <span className="text-[9px] text-slate-600">
                          {new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                      <div className={`p-3 rounded-2xl max-w-[85%] text-sm leading-normal ${isMe ? 'bg-teal-500 text-slate-950 font-medium rounded-tr-none' : 'bg-slate-800 text-slate-100 rounded-tl-none'}`}>
                        {msg.message}
                      </div>
                    </div>
                  );
                })
              )}
              <div ref={chatBottomRef} />
            </div>

            {/* Chat Send Form */}
            <form onSubmit={handleSendChatMessage} className="p-4 border-t border-slate-800 bg-slate-900/60 flex items-center space-x-2">
              <input
                type="text"
                placeholder="Write a message..."
                value={newMessage}
                onChange={(e) => setNewMessage(e.target.value)}
                className="flex-1 bg-slate-950 border border-slate-800 focus:border-teal-500 rounded-xl px-4 py-2.5 text-slate-100 text-sm focus:outline-none transition"
              />
              <button
                type="submit"
                className="p-2.5 bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 text-slate-950 rounded-xl transition cursor-pointer shrink-0"
              >
                <Send className="w-4.5 h-4.5 stroke-[2.5]" />
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Expense Modal */}
      <ExpenseModal
        isOpen={isExpenseOpen}
        onClose={() => setIsExpenseOpen(false)}
        group={group}
        currentUser={currentUser}
        onSubmit={handleExpenseSubmit}
      />

      {/* Settle Modal */}
      <SettleModal
        isOpen={isSettleOpen}
        onClose={() => setIsSettleOpen(false)}
        group={group}
        currentUser={currentUser}
        onSubmit={handleSettleSubmit}
      />
    </div>
  );
}
