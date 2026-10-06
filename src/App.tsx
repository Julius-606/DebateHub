import React, { useState, useEffect } from 'react';
import { storage } from './services/storage';
import {
  Member,
  DebateSession,
  FinancialTransaction,
  AgendaItem,
  Announcement,
  CalendarEvent,
  AlumniMentorshipNote,
} from './types';
import { Header } from './components/common/Header';
import { ExecutiveDashboard } from './components/executive/ExecutiveDashboard';
import { MemberDashboard } from './components/member/MemberDashboard';
import { LiveDebateSuite } from './components/debate/LiveDebateSuite';
import { FinancialLedger } from './components/executive/FinancialLedger';
import { MeetingAgendasLogistics } from './components/executive/MeetingAgendasLogistics';
import { MemberDirectoryPool } from './components/member/MemberDirectoryPool';
import { MotionVault } from './components/member/MotionVault';
import { CalendarActivities } from './components/member/CalendarActivities';
import { AnnouncementsFeed } from './components/member/AnnouncementsFeed';
import { DrillsPractice } from './components/debate/DrillsPractice';
import { GlukDebateLogo } from './components/common/GlukDebateLogo';
import {
  QrCode,
  Download,
  RotateCcw,
  Zap,
  Bell,
  Lock,
  Eye,
  ShieldCheck,
} from 'lucide-react';

export default function App() {
  // State loaded from storage service
  const [members, setMembers] = useState<Member[]>(() => storage.getMembers());
  const [agendas, setAgendas] = useState<AgendaItem[]>(() => storage.getAgendas());
  const [transactions, setTransactions] = useState<FinancialTransaction[]>(() => storage.getTransactions());
  const [debates, setDebates] = useState<DebateSession[]>(() => storage.getDebates());
  const [announcements, setAnnouncements] = useState<Announcement[]>(() => storage.getAnnouncements());
  const [events, setEvents] = useState<CalendarEvent[]>(() => storage.getEvents());
  const [mentorshipNotes, setMentorshipNotes] = useState<AlumniMentorshipNote[]>(() => storage.getMentorshipNotes());

  // Currently logged-in persona / user
  const [currentUserId, setCurrentUserId] = useState<string>(() => storage.getCurrentUserId());
  const currentUser = members.find((m) => m.id === currentUserId) || members[0];

  const isExecutiveUser = currentUser.role === 'executive';

  // Executive mode toggle (only executive users can toggle this)
  const [isExecutiveMode, setIsExecutiveMode] = useState<boolean>(() => isExecutiveUser);

  // Active navigation tab
  const [currentTab, setCurrentTab] = useState<string>(() =>
    isExecutiveUser ? 'executive' : 'member-home'
  );

  // When user persona changes, ensure mode is aligned
  useEffect(() => {
    if (!isExecutiveUser) {
      setIsExecutiveMode(false);
      if (currentTab === 'executive' || currentTab === 'finances' || currentTab === 'agendas') {
        setCurrentTab('member-home');
      }
    } else {
      setIsExecutiveMode(true);
      if (currentTab === 'member-home') {
        setCurrentTab('executive');
      }
    }
  }, [currentUserId, isExecutiveUser]);

  // Active live debate session
  const liveSession = debates.find((d) => d.status === 'Live Now') || debates[0];

  // Show member digital pass modal
  const [showMemberPassModal, setShowMemberPassModal] = useState(false);

  // Sync state to local storage when modified
  useEffect(() => {
    storage.saveMembers(members);
  }, [members]);

  useEffect(() => {
    storage.saveAgendas(agendas);
  }, [agendas]);

  useEffect(() => {
    storage.saveTransactions(transactions);
  }, [transactions]);

  useEffect(() => {
    storage.saveDebates(debates);
  }, [debates]);

  useEffect(() => {
    storage.saveAnnouncements(announcements);
  }, [announcements]);

  useEffect(() => {
    storage.saveEvents(events);
  }, [events]);

  useEffect(() => {
    storage.saveMentorshipNotes(mentorshipNotes);
  }, [mentorshipNotes]);

  useEffect(() => {
    storage.saveCurrentUserId(currentUserId);
  }, [currentUserId]);

  // Handlers
  const handleSelectUser = (user: Member) => {
    setCurrentUserId(user.id);
  };

  const handleToggleExecutiveMode = () => {
    if (!isExecutiveUser) return;
    const nextMode = !isExecutiveMode;
    setIsExecutiveMode(nextMode);
    setCurrentTab(nextMode ? 'executive' : 'member-home');
  };

  const handleAddTransaction = (txn: FinancialTransaction) => {
    setTransactions((prev) => [txn, ...prev]);
  };

  const handleVerifyMemberPayment = (memberId: string, mpesaRef: string) => {
    setMembers((prev) =>
      prev.map((m) =>
        m.id === memberId
          ? { ...m, membershipStatus: 'Paid' as const, mpesaRef }
          : m
      )
    );

    // Auto-record in treasury ledger
    const targetMember = members.find((m) => m.id === memberId);
    if (targetMember) {
      const autoTxn: FinancialTransaction = {
        id: `txn-dues-${Date.now()}`,
        date: new Date().toISOString().split('T')[0],
        type: 'Income',
        category: 'Semester Dues',
        amountKes: 500,
        description: `Verified Semester Dues payment for ${targetMember.fullName} (${targetMember.studentId})`,
        referenceCode: mpesaRef,
        recordedBy: `${currentUser.fullName} (${currentUser.executivePosition || 'Executive'})`,
        status: 'Verified',
      };
      setTransactions((prev) => [autoTxn, ...prev]);
    }
  };

  const handleSubmitDuesMpesa = (mpesaCode: string) => {
    setMembers((prev) =>
      prev.map((m) =>
        m.id === currentUser.id
          ? { ...m, mpesaRef: mpesaCode }
          : m
      )
    );
  };

  const handleUpdateLiveSession = (updatedSession: DebateSession) => {
    setDebates((prev) =>
      prev.map((d) => (d.id === updatedSession.id ? updatedSession : d))
    );
  };

  const handleSaveSessionToArchive = (session: DebateSession) => {
    // 1. Update session status
    setDebates((prev) =>
      prev.map((d) => (d.id === session.id ? session : d))
    );

    // 2. Mark attendance for attendees
    if (session.attendeeIds && session.attendeeIds.length > 0) {
      setMembers((prev) =>
        prev.map((m) => {
          if (session.attendeeIds.includes(m.id)) {
            const nextAttended = m.debatesAttendedCount + 1;
            const nextTotal = m.totalDebatesCount + 1;
            const nextRate = Math.round((nextAttended / nextTotal) * 100);
            return {
              ...m,
              debatesAttendedCount: nextAttended,
              totalDebatesCount: nextTotal,
              attendanceRate: nextRate,
            };
          }
          return {
            ...m,
            totalDebatesCount: m.totalDebatesCount + 1,
          };
        })
      );
    }

    setCurrentTab('motion-vault');
  };

  const handleExportFullHandover = () => {
    const jsonStr = storage.exportDatabaseJson();
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `GLUK_Debate_Club_Executive_Handover_${new Date().toISOString().split('T')[0]}.json`;
    a.click();
  };

  const handleResetData = () => {
    if (window.confirm('Reset all club database records back to official GLUK factory defaults?')) {
      storage.resetAll();
      window.location.reload();
    }
  };

  // Guard: if current tab is executive-only and user is not in executive mode, protect it
  const isExecutiveTab = currentTab === 'executive' || currentTab === 'finances' || currentTab === 'agendas';
  const showAccessDenied = isExecutiveTab && !isExecutiveMode;

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans selection:bg-amber-500/20 selection:text-amber-200">
      
      {/* Top Header conforming to Section 2 Top Bar Contract */}
      <Header
        currentTab={currentTab}
        onSelectTab={setCurrentTab}
        currentUser={currentUser}
        allMembers={members}
        onSelectUser={handleSelectUser}
        isLiveDebateActive={debates.some((d) => d.status === 'Live Now')}
        isExecutiveMode={isExecutiveMode}
        onToggleExecutiveMode={isExecutiveUser ? handleToggleExecutiveMode : undefined}
      />

      {/* Sub-bar showing contextual portal mode & quick shortcuts */}
      <div className="border-b border-slate-900 bg-slate-950/70 px-4 sm:px-6 lg:px-8 py-2">
        <div className="mx-auto max-w-7xl flex flex-wrap items-center justify-between gap-3 text-xs">
          
          <div className="flex items-center gap-3">
            {isExecutiveMode ? (
              <span className="inline-flex items-center gap-1.5 text-amber-400 font-semibold">
                <ShieldCheck className="w-3.5 h-3.5" />
                <span>Executive Management Mode</span>
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 text-blue-300 font-semibold">
                <span>Member Portal</span>
              </span>
            )}

            <span className="text-slate-700">·</span>

            <button
              onClick={() => setCurrentTab('announcements')}
              className={`inline-flex items-center gap-1 transition-colors ${
                currentTab === 'announcements'
                  ? 'text-amber-400 font-semibold'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Bell className="w-3.5 h-3.5" />
              <span>Announcements ({announcements.length})</span>
            </button>

            <span className="text-slate-700">·</span>

            <button
              onClick={() => setCurrentTab('drills')}
              className={`inline-flex items-center gap-1 transition-colors ${
                currentTab === 'drills'
                  ? 'text-amber-400 font-semibold'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Zap className="w-3.5 h-3.5 text-amber-400" />
              <span>POI Drills</span>
            </button>
          </div>

          <div className="flex items-center gap-3 text-[11px] text-slate-500">
            <span>
              Signed in: <strong className="text-slate-300">{currentUser.fullName}</strong> ({currentUser.executivePosition || currentUser.role})
            </span>
            <button
              onClick={() => setShowMemberPassModal(true)}
              className="text-amber-400 hover:text-amber-300 font-medium underline underline-offset-2"
            >
              My ID Pass
            </button>
          </div>

        </div>
      </div>

      {/* Main Viewport Container */}
      <main className="flex-1 mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8 py-6">
        
        {/* Access Denied Shield if a member somehow reaches executive tabs */}
        {showAccessDenied ? (
          <div className="py-16 text-center max-w-md mx-auto space-y-4">
            <div className="w-12 h-12 rounded-full bg-rose-500/10 border border-rose-500/30 flex items-center justify-center mx-auto text-rose-400">
              <Lock className="w-6 h-6" />
            </div>
            <h2 className="text-lg font-bold text-white">
              Executive Committee Privilege Required
            </h2>
            <p className="text-xs text-slate-400 leading-relaxed">
              Treasury ledgers, financial statements, and meeting action delegations are confidential and reserved strictly for the executive committee.
            </p>
            <button
              onClick={() => setCurrentTab('member-home')}
              className="px-4 py-2 bg-amber-400 hover:bg-amber-300 text-slate-950 font-bold rounded-lg text-xs"
            >
              Return to Member Dashboard
            </button>
          </div>
        ) : (
          <>
            {/* 1. MEMBER DASHBOARD (strictly personal attendance, dues, announcements, schedule) */}
            {currentTab === 'member-home' && (
              <MemberDashboard
                currentUser={currentUser}
                announcements={announcements}
                upcomingEvents={events}
                activeDebateSession={liveSession}
                mentorshipNotes={mentorshipNotes}
                onNavigate={setCurrentTab}
                onSubmitDuesMpesa={handleSubmitDuesMpesa}
                onOpenPassModal={() => setShowMemberPassModal(true)}
              />
            )}

            {/* 2. EXECUTIVE DASHBOARD (club oversight, data intelligence, treasury balance, delegations) */}
            {currentTab === 'executive' && (
              <ExecutiveDashboard
                members={members}
                debates={debates}
                transactions={transactions}
                agendas={agendas}
                announcements={announcements}
                onNavigate={setCurrentTab}
                onExportData={handleExportFullHandover}
              />
            )}

            {/* 3. EXECUTIVE-ONLY: FINANCIAL LEDGER */}
            {currentTab === 'finances' && (
              <FinancialLedger
                transactions={transactions}
                members={members}
                onAddTransaction={handleAddTransaction}
                onVerifyMemberPayment={handleVerifyMemberPayment}
              />
            )}

            {/* 4. EXECUTIVE-ONLY: MEETING AGENDAS & LOGISTICS */}
            {currentTab === 'agendas' && (
              <MeetingAgendasLogistics
                agendas={agendas}
                members={members}
                onUpdateAgendas={setAgendas}
              />
            )}

            {/* 5. SHARED / MEMBER ALLOWED: LIVE DEBATE & MEET COMPANION */}
            {currentTab === 'live-debate' && (
              <LiveDebateSuite
                session={liveSession}
                allMembers={members}
                onUpdateSession={handleUpdateLiveSession}
                onSaveSessionToArchive={handleSaveSessionToArchive}
              />
            )}

            {/* 6. SHARED / MEMBER ALLOWED: MOTION VAULT & ARCHIVES */}
            {currentTab === 'motion-vault' && (
              <MotionVault debates={debates} />
            )}

            {/* 7. SHARED / MEMBER ALLOWED: CALENDAR OF ACTIVITIES */}
            {currentTab === 'calendar' && (
              <CalendarActivities
                events={events}
                currentUser={currentUser}
                onAddEvent={(ev) => setEvents((prev) => [ev, ...prev])}
              />
            )}

            {/* 8. SHARED / MEMBER ALLOWED: MEMBERS POOL & ALUMNI NETWORK */}
            {currentTab === 'members' && (
              <MemberDirectoryPool
                members={members}
                currentUser={currentUser}
                mentorshipNotes={mentorshipNotes}
                onAddMentorshipNote={(note) => setMentorshipNotes((prev) => [note, ...prev])}
              />
            )}

            {/* 9. SHARED / MEMBER ALLOWED: ANNOUNCEMENTS */}
            {currentTab === 'announcements' && (
              <AnnouncementsFeed
                announcements={announcements}
                currentUser={currentUser}
                onAddAnnouncement={(ann) => setAnnouncements((prev) => [ann, ...prev])}
                onSubmitDuesMpesa={handleSubmitDuesMpesa}
                onOpenPassModal={() => setShowMemberPassModal(true)}
              />
            )}

            {/* 10. SHARED / MEMBER ALLOWED: SPEAKING DRILLS */}
            {currentTab === 'drills' && (
              <DrillsPractice />
            )}
          </>
        )}

      </main>

      {/* Footer */}
      <footer className="border-t border-slate-900 bg-slate-950 py-6 px-4 sm:px-6 lg:px-8 text-xs text-slate-500">
        <div className="mx-auto max-w-7xl flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <GlukDebateLogo size={24} />
            <span>
              Great Lakes University of Kisumu Debate Club · Kibos Main Campus, Kisumu, Kenya
            </span>
          </div>

          <div className="flex items-center gap-4 text-slate-400">
            {isExecutiveMode && (
              <>
                <button
                  onClick={handleExportFullHandover}
                  className="hover:text-white transition-colors"
                >
                  Export Executive Handover (.json)
                </button>
                <span>·</span>
              </>
            )}
            <button
              onClick={handleResetData}
              className="hover:text-amber-400 transition-colors"
            >
              Reset Seed Data
            </button>
          </div>
        </div>
      </footer>

      {/* Digital Member Pass Modal */}
      {showMemberPassModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/85 backdrop-blur-sm">
          <div className="w-full max-w-sm rounded-2xl bg-gradient-to-b from-slate-900 to-slate-950 border border-amber-500/30 p-6 shadow-2xl space-y-5 text-center relative overflow-hidden">
            <div className="absolute -top-12 left-1/2 -translate-x-1/2 w-40 h-40 bg-amber-500/10 rounded-full blur-2xl pointer-events-none" />

            <div className="flex justify-center">
              <GlukDebateLogo size={64} />
            </div>

            <div>
              <span className="text-[10px] uppercase font-bold tracking-widest text-amber-400 block">
                Great Lakes University of Kisumu
              </span>
              <h3 className="text-lg font-bold text-white mt-0.5">
                {currentUser.fullName}
              </h3>
              <p className="text-xs font-mono text-slate-400">
                {currentUser.studentId}
              </p>
            </div>

            <div className="p-3 rounded-xl bg-slate-950/70 border border-slate-800 text-xs text-left space-y-1.5">
              <div className="flex justify-between">
                <span className="text-slate-400">Portfolio:</span>
                <span className="font-semibold text-slate-200 capitalize">
                  {currentUser.executivePosition || currentUser.role}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Faculty:</span>
                <span className="font-semibold text-slate-200 truncate max-w-[170px]">
                  {currentUser.faculty}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Semester Dues:</span>
                <span
                  className={`font-bold ${
                    currentUser.membershipStatus === 'Paid'
                      ? 'text-emerald-400'
                      : 'text-amber-400'
                  }`}
                >
                  {currentUser.membershipStatus} (AY 2026/2027)
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Attendance:</span>
                <span className="font-mono text-slate-200">
                  {currentUser.attendanceRate}% ({currentUser.debatesAttendedCount} Sessions)
                </span>
              </div>
            </div>

            <div className="flex flex-col items-center justify-center p-3 rounded-xl bg-white text-slate-950 space-y-1">
              <div className="w-24 h-24 border-2 border-slate-950 p-1 flex items-center justify-center bg-slate-100">
                <QrCode className="w-20 h-20 text-slate-950" />
              </div>
              <span className="text-[9px] font-mono tracking-widest uppercase font-bold text-slate-700">
                GLUK-DC-OFFICIAL-DEBATER
              </span>
            </div>

            <button
              onClick={() => setShowMemberPassModal(false)}
              className="w-full py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-xs font-semibold transition-colors"
            >
              Close Pass
            </button>
          </div>
        </div>
      )}

    </div>
  );
}
