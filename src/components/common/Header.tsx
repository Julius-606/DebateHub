import React, { useState } from 'react';
import { GlukDebateLogo } from './GlukDebateLogo';
import { Member } from '../../types';
import { useAuth } from '../../contexts/AuthContext';
import {
  Radio,
  Users,
  ShieldAlert,
  Sparkles,
  ChevronDown,
  Eye,
  ShieldCheck,
  Database,
  LogOut,
  LogIn,
} from 'lucide-react';

interface HeaderProps {
  currentTab: string;
  onSelectTab: (tab: string) => void;
  currentUser: Member;
  allMembers: Member[];
  onSelectUser: (user: Member) => void;
  isLiveDebateActive: boolean;
  isExecutiveMode: boolean;
  onToggleExecutiveMode?: () => void;
  onOpenNeonModal: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  currentTab,
  onSelectTab,
  currentUser,
  allMembers,
  onSelectUser,
  isLiveDebateActive,
  isExecutiveMode,
  onToggleExecutiveMode,
  onOpenNeonModal,
}) => {
  const { firebaseUser, loginWithGoogle, logoutGoogle, isLoggedInWithGoogle, authLoading } = useAuth();
  const [showUserMenu, setShowUserMenu] = useState(false);

  // Executive Navigation Items
  const executiveNavItems = [
    { id: 'executive', label: 'Executive Suite' },
    { id: 'finances', label: 'Treasury Ledger' },
    { id: 'agendas', label: 'Agendas & Logistics' },
    { id: 'live-debate', label: 'Live Debate & Meet' },
    { id: 'members', label: 'Members & Pool' },
    { id: 'motion-vault', label: 'Motion Vault' },
    { id: 'calendar', label: 'Calendar' },
  ];

  // Member Navigation Items
  const memberNavItems = [
    { id: 'member-home', label: 'My Member Hub' },
    { id: 'announcements', label: 'Announcements' },
    { id: 'live-debate', label: 'Live Debate & Meet' },
    { id: 'motion-vault', label: 'Motion Vault' },
    { id: 'calendar', label: 'Club Calendar' },
    { id: 'members', label: 'Alumni & Members' },
    { id: 'drills', label: 'Speaking Drills' },
  ];

  const activeNavItems = isExecutiveMode ? executiveNavItems : memberNavItems;

  return (
    <header className="sticky top-0 z-40 w-full border-b border-slate-800 bg-slate-950/95 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        
        {/* Zone 1: Single Brand element */}
        <div className="flex items-center gap-3">
          <GlukDebateLogo size={36} />
          <a
            href="#dashboard"
            onClick={(e) => {
              e.preventDefault();
              onSelectTab(isExecutiveMode ? 'executive' : 'member-home');
            }}
            className="text-base font-bold tracking-tight text-white hover:text-amber-300 transition-colors whitespace-nowrap"
          >
            GLUK Debate Club
          </a>

          {/* Portal badge */}
          <span
            className={`hidden sm:inline-block px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
              isExecutiveMode
                ? 'bg-amber-500/15 text-amber-300 border border-amber-500/30'
                : 'bg-blue-500/15 text-blue-300 border border-blue-500/30'
            }`}
          >
            {isExecutiveMode ? 'Executive Suite' : 'Member Portal'}
          </span>
        </div>

        {/* Zone 2: Nav Links, single line, subtle hover underline */}
        <nav className="hidden lg:flex items-center gap-5 text-xs font-medium tracking-wide">
          {activeNavItems.map((item) => {
            const isActive = currentTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => onSelectTab(item.id)}
                className={`relative py-1 whitespace-nowrap transition-colors ${
                  isActive
                    ? 'text-amber-400 font-semibold'
                    : 'text-slate-400 hover:text-slate-100'
                }`}
              >
                {item.label}
                {isActive && (
                  <span className="absolute inset-x-0 -bottom-3.5 h-0.5 bg-amber-400 rounded-full" />
                )}
                {item.id === 'live-debate' && isLiveDebateActive && (
                  <span className="ml-1.5 inline-flex items-center gap-1 text-[10px] text-emerald-400 font-bold">
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
                    LIVE
                  </span>
                )}
              </button>
            );
          })}
        </nav>

        {/* Zone 3: 1-2 Primary Actions (Google Sign-In, Neon DB Status, User Switcher) */}
        <div className="flex items-center gap-2.5">
          
          {/* Neon DB Modal button */}
          <button
            onClick={onOpenNeonModal}
            className="p-1.5 rounded-lg bg-slate-900 border border-slate-800 hover:border-slate-700 text-slate-300 hover:text-emerald-400 transition-colors"
            title="Neon PostgreSQL Database Status"
          >
            <Database className="w-4 h-4 text-emerald-400" />
          </button>

          {/* Executive toggle to preview member view if user is executive */}
          {currentUser.role === 'executive' && onToggleExecutiveMode && (
            <button
              onClick={onToggleExecutiveMode}
              className={`hidden sm:inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                isExecutiveMode
                  ? 'bg-slate-900 text-slate-300 border-slate-800 hover:text-white'
                  : 'bg-amber-500/20 text-amber-300 border-amber-500/40'
              }`}
              title="Toggle between Executive Suite and Member View"
            >
              <Eye className="w-3.5 h-3.5 text-amber-400" />
              <span>{isExecutiveMode ? 'View as Member' : 'Return to Executive'}</span>
            </button>
          )}

          {/* Google Sign-in / Signed-in user */}
          {isLoggedInWithGoogle && firebaseUser ? (
            <div className="flex items-center gap-2">
              <div
                className="hidden md:flex items-center gap-2 px-2.5 py-1 rounded-lg bg-slate-900 border border-slate-800 text-xs"
                title={`Signed in as ${firebaseUser.email}`}
              >
                {firebaseUser.photoURL ? (
                  <img
                    src={firebaseUser.photoURL}
                    alt={firebaseUser.displayName || 'Google user'}
                    className="w-5 h-5 rounded-full"
                    referrerPolicy="no-referrer"
                  />
                ) : (
                  <div className="w-5 h-5 rounded-full bg-blue-500 flex items-center justify-center text-[10px] text-white font-bold">
                    G
                  </div>
                )}
                <span className="text-slate-300 max-w-[100px] truncate">
                  {firebaseUser.displayName?.split(' ')[0] || firebaseUser.email}
                </span>
                <button
                  onClick={logoutGoogle}
                  className="text-slate-400 hover:text-rose-400 ml-1"
                  title="Sign out of Google"
                >
                  <LogOut className="w-3 h-3" />
                </button>
              </div>
            </div>
          ) : (
            <button
              onClick={loginWithGoogle}
              disabled={authLoading}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white text-slate-900 hover:bg-slate-100 rounded-lg text-xs font-bold transition-all shadow-sm whitespace-nowrap"
            >
              <svg className="w-3.5 h-3.5" viewBox="0 0 24 24">
                <path
                  fill="#4285F4"
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                />
                <path
                  fill="#34A853"
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                />
                <path
                  fill="#FBBC05"
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                />
                <path
                  fill="#EA4335"
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                />
              </svg>
              <span>Google Sign-In</span>
            </button>
          )}

          {/* User Persona Dropdown Switcher */}
          <div className="relative">
            <button
              onClick={() => setShowUserMenu(!showUserMenu)}
              className="flex items-center gap-2 p-1.5 pl-2 rounded-lg bg-slate-900 border border-slate-800 hover:border-slate-700 text-left transition-colors whitespace-nowrap"
            >
              <div className="flex flex-col text-right">
                <span className="text-xs font-semibold text-slate-200 max-w-[110px] sm:max-w-[130px] truncate">
                  {currentUser.fullName}
                </span>
                <span className="text-[10px] text-amber-400 font-medium capitalize truncate">
                  {currentUser.executivePosition || currentUser.role}
                </span>
              </div>
              <div className="w-7 h-7 rounded-md bg-gradient-to-br from-amber-500/30 to-blue-600/30 border border-amber-500/40 flex items-center justify-center text-amber-200 text-xs font-bold shrink-0">
                {currentUser.fullName.charAt(0)}
              </div>
              <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
            </button>

            {showUserMenu && (
              <>
                <div
                  className="fixed inset-0 z-40"
                  onClick={() => setShowUserMenu(false)}
                />
                <div className="absolute right-0 mt-2 w-80 rounded-xl bg-slate-900 border border-slate-800 shadow-2xl p-2 z-50">
                  <div className="px-3 py-2 border-b border-slate-800 mb-1">
                    <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                      Switch User Persona
                    </p>
                    <p className="text-xs text-slate-300 mt-0.5">
                      Select an Executive, Student Member, or Alumni profile
                    </p>
                  </div>
                  <div className="max-h-72 overflow-y-auto space-y-1">
                    {allMembers.map((member) => (
                      <button
                        key={member.id}
                        onClick={() => {
                          onSelectUser(member);
                          setShowUserMenu(false);
                        }}
                        className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-left text-xs transition-colors ${
                          member.id === currentUser.id
                            ? 'bg-amber-500/15 text-amber-300 border border-amber-500/30'
                            : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                        }`}
                      >
                        <div className="flex flex-col truncate pr-2">
                          <span className="font-medium truncate">{member.fullName}</span>
                          <span className="text-[10px] text-slate-500 truncate">
                            {member.executivePosition || (member.role === 'alumni' ? member.alumniOccupation : `${member.yearOfStudy} · ${member.faculty}`)}
                          </span>
                        </div>
                        <span
                          className={`text-[9px] uppercase font-mono px-1.5 py-0.5 rounded shrink-0 ${
                            member.role === 'executive'
                              ? 'bg-amber-500/20 text-amber-300'
                              : member.role === 'alumni'
                              ? 'bg-purple-500/20 text-purple-300'
                              : 'bg-blue-500/20 text-blue-300'
                          }`}
                        >
                          {member.role}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              </>
            )}
          </div>

        </div>

      </div>

      {/* Mobile nav drawer row */}
      <div className="lg:hidden flex items-center gap-2 overflow-x-auto px-4 py-2 border-t border-slate-900 bg-slate-950 no-scrollbar">
        {activeNavItems.map((item) => (
          <button
            key={item.id}
            onClick={() => onSelectTab(item.id)}
            className={`px-3 py-1 text-xs rounded-md whitespace-nowrap transition-colors ${
              currentTab === item.id
                ? 'bg-amber-400/20 text-amber-300 font-semibold'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            {item.label}
          </button>
        ))}
      </div>
    </header>
  );
};
