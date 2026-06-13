import React from 'react';
import { LogOut, Receipt, Users, Wallet } from 'lucide-react';

export default function Navbar({ user, onLogout }) {
  return (
    <header className="sticky top-0 z-50 w-full border-b border-slate-800/80 bg-slate-950/80 backdrop-blur-md">
      <div className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between">
        <div className="flex items-center space-x-3 cursor-pointer">
          <div className="p-2 bg-gradient-to-tr from-emerald-500 to-teal-500 rounded-xl shadow-lg shadow-teal-500/10">
            <Receipt className="w-6 h-6 text-slate-950 stroke-[2.5]" />
          </div>
          <span className="text-xl font-bold tracking-tight bg-gradient-to-r from-emerald-400 to-teal-300 bg-clip-text text-transparent">
            Splitly
          </span>
        </div>

        {user && (
          <div className="flex items-center space-x-6">
            <div className="flex items-center space-x-3 bg-slate-900/40 border border-slate-800/50 py-1.5 pl-3 pr-4 rounded-full">
              <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-emerald-400 to-teal-400 flex items-center justify-center text-slate-950 font-extrabold text-sm shadow-md">
                {user.name.charAt(0).toUpperCase()}
              </div>
              <span className="text-sm font-semibold text-slate-200 hidden sm:inline">
                {user.name}
              </span>
            </div>

            <button
              onClick={onLogout}
              className="p-2 rounded-xl text-slate-400 hover:text-red-400 hover:bg-red-500/10 active:scale-95 transition cursor-pointer"
              title="Logout"
            >
              <LogOut className="w-5 h-5" />
            </button>
          </div>
        )}
      </div>
    </header>
  );
}
