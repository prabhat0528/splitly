import React, { useState, useEffect } from 'react';
import { Plus, Users, TrendingUp, TrendingDown, DollarSign, ArrowRight, UserPlus, FileText } from 'lucide-react';
import api from '../utils/api.js';

export default function Dashboard({ user, onSelectGroup }) {
  const [groups, setGroups] = useState([]);
  const [balances, setBalances] = useState({ netBalance: 0, totalOwed: 0, totalOwedToYou: 0, balancesByUser: [] });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  
  // Group creation modal state
  const [showCreateGroup, setShowCreateGroup] = useState(false);
  const [groupName, setGroupName] = useState('');
  const [groupDesc, setGroupDesc] = useState('');
  const [createLoading, setCreateLoading] = useState(false);

  const fetchDashboardData = async () => {
    try {
      setLoading(true);
      const [groupsData, balancesData] = await Promise.all([
        api.get('/groups'),
        api.get('/settlements/balances'),
      ]);
      setGroups(groupsData);
      setBalances(balancesData);
    } catch (err) {
      console.error(err);
      setError('Failed to load dashboard data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const handleCreateGroup = async (e) => {
    e.preventDefault();
    if (!groupName) return;

    try {
      setCreateLoading(true);
      const newGroup = await api.post('/groups', {
        name: groupName,
        description: groupDesc,
      });
      setGroupName('');
      setGroupDesc('');
      setShowCreateGroup(false);
      // Refresh groups list
      setGroups([newGroup, ...groups]);
      // Open the newly created group details
      onSelectGroup(newGroup.id);
    } catch (err) {
      setError(err.message || 'Failed to create group');
    } finally {
      setCreateLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-teal-500"></div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      {/* Top Welcome Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between mb-8 pb-6 border-b border-slate-800/60 gap-4">
        <div>
          <h1 className="text-3xl font-extrabold text-slate-100 tracking-tight">Dashboard</h1>
          <p className="text-slate-400 mt-1">Keep track of your shared bills, groups, and settlements.</p>
        </div>
        <div className="flex space-x-3">
          <button
            onClick={() => setShowCreateGroup(true)}
            className="flex items-center space-x-2 bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 active:scale-95 text-slate-950 font-bold px-5 py-2.5 rounded-xl shadow-lg shadow-teal-500/10 transition cursor-pointer"
          >
            <Plus className="w-5 h-5 stroke-[2.5]" />
            <span>Create a Group</span>
          </button>
        </div>
      </div>

      {error && (
        <div className="mb-6 p-4 rounded-xl bg-red-950/50 border border-red-800/50 text-red-400 text-sm">
          {error}
        </div>
      )}

      {/* Financial Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        {/* Total Balance Card */}
        <div className="bg-slate-900/40 border border-slate-800/60 p-6 rounded-2xl backdrop-blur-xl">
          <div className="flex items-center justify-between">
            <span className="text-sm font-semibold text-slate-400">Total Net Balance</span>
            <div className={`p-2 rounded-lg ${balances.netBalance >= 0 ? 'bg-emerald-500/10' : 'bg-orange-500/10'}`}>
              <DollarSign className={`w-5 h-5 ${balances.netBalance >= 0 ? 'text-emerald-400' : 'text-orange-400'}`} />
            </div>
          </div>
          <div className="mt-4">
            <h3 className={`text-3xl font-black ${balances.netBalance >= 0 ? 'text-emerald-400' : 'text-orange-400'}`}>
              {balances.netBalance >= 0 ? '+' : ''}${Math.abs(balances.netBalance).toFixed(2)}
            </h3>
            <span className="text-xs text-slate-500 mt-1 block">
              {balances.netBalance >= 0 ? 'You are owed overall' : 'You owe overall'}
            </span>
          </div>
        </div>

        {/* You Owe Card */}
        <div className="bg-slate-900/40 border border-slate-800/60 p-6 rounded-2xl backdrop-blur-xl">
          <div className="flex items-center justify-between">
            <span className="text-sm font-semibold text-slate-400">You Owe</span>
            <div className="p-2 rounded-lg bg-orange-500/10">
              <TrendingDown className="w-5 h-5 text-orange-400" />
            </div>
          </div>
          <div className="mt-4">
            <h3 className="text-3xl font-black text-orange-400">
              ${balances.totalOwed.toFixed(2)}
            </h3>
            <span className="text-xs text-slate-500 mt-1 block">Total amount you need to pay back</span>
          </div>
        </div>

        {/* You Are Owed Card */}
        <div className="bg-slate-900/40 border border-slate-800/60 p-6 rounded-2xl backdrop-blur-xl">
          <div className="flex items-center justify-between">
            <span className="text-sm font-semibold text-slate-400">You Are Owed</span>
            <div className="p-2 rounded-lg bg-emerald-500/10">
              <TrendingUp className="w-5 h-5 text-emerald-400" />
            </div>
          </div>
          <div className="mt-4">
            <h3 className="text-3xl font-black text-emerald-400">
              ${balances.totalOwedToYou.toFixed(2)}
            </h3>
            <span className="text-xs text-slate-500 mt-1 block">Total amount friends owe you</span>
          </div>
        </div>
      </div>

      {/* Main Grid: Groups & Friends List */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Groups Column */}
        <div className="lg:col-span-2 space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-bold text-slate-100 flex items-center space-x-2">
              <Users className="w-5 h-5 text-teal-400" />
              <span>Your Groups ({groups.length})</span>
            </h2>
          </div>

          {groups.length === 0 ? (
            <div className="bg-slate-900/20 border border-dashed border-slate-800 p-8 rounded-2xl text-center">
              <Users className="w-10 h-10 text-slate-600 mx-auto mb-3" />
              <h3 className="font-bold text-slate-300">No groups yet</h3>
              <p className="text-sm text-slate-500 mt-1 max-w-xs mx-auto">
                Create a group to start splitting bills and expenses with friends.
              </p>
              <button
                onClick={() => setShowCreateGroup(true)}
                className="mt-4 inline-flex items-center space-x-2 text-teal-400 font-semibold hover:text-teal-300 text-sm cursor-pointer"
              >
                <span>Create one now</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {groups.map((group) => (
                <div
                  key={group.id}
                  onClick={() => onSelectGroup(group.id)}
                  className="bg-slate-900/40 hover:bg-slate-900/80 border border-slate-800/80 p-5 rounded-2xl cursor-pointer hover:border-slate-700/60 transition group flex flex-col justify-between min-h-[140px]"
                >
                  <div>
                    <h3 className="font-bold text-lg text-slate-200 group-hover:text-teal-400 transition">
                      {group.name}
                    </h3>
                    <p className="text-sm text-slate-500 mt-1 line-clamp-2">
                      {group.description || 'No description provided'}
                    </p>
                  </div>
                  <div className="flex items-center justify-between mt-4 border-t border-slate-800/40 pt-3">
                    <span className="text-xs text-slate-400">
                      {group.members.length} member{group.members.length > 1 ? 's' : ''}
                    </span>
                    <span className="text-xs font-bold text-teal-400 flex items-center space-x-1 group-hover:translate-x-1 transition-transform">
                      <span>View details</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Individual Balances Breakdown Column */}
        <div className="space-y-6">
          <h2 className="text-xl font-bold text-slate-100 flex items-center space-x-2">
            <DollarSign className="w-5 h-5 text-teal-400" />
            <span>Balances with Friends</span>
          </h2>

          {balances.balancesByUser.length === 0 ? (
            <div className="bg-slate-900/20 border border-slate-800/50 p-6 rounded-2xl text-center">
              <p className="text-sm text-slate-500">You are all settled up with your friends!</p>
            </div>
          ) : (
            <div className="bg-slate-900/40 border border-slate-800/60 rounded-2xl overflow-hidden divide-y divide-slate-850">
              {balances.balancesByUser.map((bal) => (
                <div key={bal.id} className="p-4 flex items-center justify-between hover:bg-slate-900/60 transition">
                  <div className="flex items-center space-x-3">
                    <div className="w-10 h-10 rounded-full bg-slate-800 border border-slate-700/60 flex items-center justify-center text-slate-300 font-bold text-sm">
                      {bal.name.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <h4 className="font-bold text-sm text-slate-200">{bal.name}</h4>
                      <span className="text-xs text-slate-500">{bal.email}</span>
                    </div>
                  </div>
                  <div className="text-right">
                    <span className={`text-sm font-extrabold ${bal.netBalance >= 0 ? 'text-emerald-400' : 'text-orange-400'}`}>
                      {bal.netBalance >= 0 ? 'owes you' : 'you owe'}{' '}
                      <span className="text-base font-black">${Math.abs(bal.netBalance).toFixed(2)}</span>
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Create Group Modal */}
      {showCreateGroup && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm" onClick={() => setShowCreateGroup(false)}></div>
          <div className="relative w-full max-w-md bg-slate-900 border border-slate-800 p-6 rounded-2xl shadow-2xl">
            <h3 className="text-xl font-bold text-slate-100 mb-4">Create New Group</h3>
            <form onSubmit={handleCreateGroup} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
                  Group Name
                </label>
                <input
                  type="text"
                  value={groupName}
                  onChange={(e) => setGroupName(e.target.value)}
                  placeholder="e.g. Roommates 2026, Paris Trip"
                  required
                  className="w-full bg-slate-950 border border-slate-800 focus:border-teal-500 rounded-xl px-4 py-3 text-slate-100 text-sm focus:outline-none transition"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
                  Description (Optional)
                </label>
                <textarea
                  value={groupDesc}
                  onChange={(e) => setGroupDesc(e.target.value)}
                  placeholder="e.g. Shared expenses for household items"
                  rows="3"
                  className="w-full bg-slate-950 border border-slate-800 focus:border-teal-500 rounded-xl px-4 py-3 text-slate-100 text-sm focus:outline-none transition resize-none"
                />
              </div>
              <div className="flex space-x-3 justify-end pt-2">
                <button
                  type="button"
                  onClick={() => setShowCreateGroup(false)}
                  className="px-4 py-2 rounded-xl border border-slate-800 hover:bg-slate-800 text-slate-400 text-sm font-semibold transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={createLoading}
                  className="px-5 py-2 bg-gradient-to-r from-emerald-500 to-teal-500 text-slate-950 font-bold rounded-xl transition disabled:opacity-50 text-sm cursor-pointer"
                >
                  {createLoading ? 'Creating...' : 'Create'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
