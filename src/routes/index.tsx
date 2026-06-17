import React from 'react';
import WebRTCCalling from '../features/messenger/components/WebRTCCalling';
import IntergramMessenger from '../features/messenger/components/IntergramMessenger';
import DisguiseNews from '../features/news/DisguiseNews';
import DisguiseGame from '../features/games/DisguiseGame';
import SecretLockpad from '../features/security/SecretLockpad';
import logoImg from '../assets/logo.png';
import { Sun, Moon, Newspaper, Gamepad, Lock, Phone, PhoneOff } from 'lucide-react';

interface AppRoutesProps {
  // Navigation & UI States
  disguiseTab: 'news' | 'game';
  setDisguiseTab: (tab: 'news' | 'game') => void;
  isRevealed: boolean;
  setIsRevealed: (revealed: boolean) => void;
  showLockpad: boolean;
  setShowLockpad: (show: boolean) => void;
  isLightTheme: boolean;
  setIsLightTheme: (light: boolean) => void;
  currentUser: any;
  gmailToken: string | null;
  newlyPairedChatId: string | null;
  clearNewlyPairedChatId: () => void;
  
  // Call States
  activeCall: any;
  incomingCall: any;
  handleRejectIncomingCall: () => void;
  handleAcceptIncomingCall: () => void;
  handleEndCall: () => void;
  handleStartCall: (name: string, avatar: string, isVideo: boolean, targetUid?: string) => void;
  
  // Handlers
  handleUnlock: (user: any, accessToken: string | null, loginType?: 'firebase' | 'credentials') => void;
  handleLogout: () => void;
  triggerSecretMode: () => void;
  inviteUid: string | null;
}

export default function AppRoutes({
  disguiseTab,
  setDisguiseTab,
  isRevealed,
  setIsRevealed,
  showLockpad,
  setShowLockpad,
  isLightTheme,
  setIsLightTheme,
  currentUser,
  gmailToken,
  newlyPairedChatId,
  clearNewlyPairedChatId,
  activeCall,
  incomingCall,
  handleRejectIncomingCall,
  handleAcceptIncomingCall,
  handleEndCall,
  handleStartCall,
  handleUnlock,
  handleLogout,
  triggerSecretMode,
  inviteUid
}: AppRoutesProps) {
  
  // 1. Ongoing secure WebRTC Voice/Video call frame
  if (activeCall) {
    return (
      <WebRTCCalling
        contactName={activeCall.name}
        contactAvatar={activeCall.avatar}
        isVideo={activeCall.isVideo}
        onCallEnd={handleEndCall}
      />
    );
  }

  // 2. Unlocked primary private messaging dashboard
  if (isRevealed && currentUser) {
    return (
      <div className={`${isLightTheme ? 'light-mode' : 'dark-mode'} h-[100dvh] w-screen overflow-hidden relative`}>
        {/* Real-time WebRTC incoming call ringer overlay */}
        {incomingCall && (
          <div className="fixed inset-0 bg-black/90 flex flex-col items-center justify-center p-4 z-[99999] backdrop-blur-md animate-fade-in text-white select-none">
            <div className="w-full max-w-sm text-center space-y-8 animate-scale-up">
              <div className="relative inline-block">
                {incomingCall.callerAvatar ? (
                  <img
                    referrerPolicy="no-referrer"
                    src={incomingCall.callerAvatar}
                    className="w-24 h-24 rounded-full mx-auto object-cover border-4 border-indigo-600 animate-pulse shadow-2xl"
                    alt={incomingCall.callerName}
                  />
                ) : (
                  <div className="w-24 h-24 rounded-full mx-auto bg-indigo-900 border-4 border-indigo-600 flex items-center justify-center text-2xl font-bold animate-pulse shadow-2xl">
                    {incomingCall.callerName.charAt(0)}
                  </div>
                )}
                <div className="absolute -bottom-1 -right-1 bg-rose-500 text-[10px] uppercase font-bold tracking-widest px-2.5 py-1 text-white rounded-full animate-bounce">
                  Ringing
                </div>
              </div>

              <div className="space-y-2">
                <h3 className="text-xl font-extrabold tracking-tight">{incomingCall.callerName}</h3>
                <p className="text-xs text-[#2481cc] font-mono tracking-wider uppercase">
                  Incoming {incomingCall.isVideo ? 'Secure Video Session' : 'Encrypted Voice Call'}
                </p>
              </div>

              <div className="flex items-center justify-center gap-6 pt-4">
                <button
                  onClick={handleRejectIncomingCall}
                  className="w-16 h-16 rounded-full bg-rose-600 hover:bg-rose-550 flex items-center justify-center text-white cursor-pointer hover:scale-105 active:scale-95 transition-all shadow-lg"
                  title="Decline Call"
                >
                  <PhoneOff className="w-6 h-6" />
                </button>

                <button
                  onClick={handleAcceptIncomingCall}
                  className="w-16 h-16 rounded-full bg-emerald-600 hover:bg-emerald-550 flex items-center justify-center text-white cursor-pointer hover:scale-105 active:scale-95 transition-all shadow-lg animate-pulse"
                  title="Accept Call"
                >
                  <Phone className="w-6 h-6" />
                </button>
              </div>
            </div>
          </div>
        )}

        <IntergramMessenger
          user={currentUser}
          gmailToken={gmailToken}
          onLogout={handleLogout}
          onLock={() => setIsRevealed(false)} // Safe conceal
          onStartCall={handleStartCall}
          isLightTheme={isLightTheme}
          setIsLightTheme={setIsLightTheme}
          newlyPairedChatId={newlyPairedChatId}
          clearNewlyPairedChatId={clearNewlyPairedChatId}
        />
      </div>
    );
  }

  // 3. Disguised Front News Game Hub Applet
  return (
    <div className={`min-h-screen flex flex-col justify-between font-sans relative transition-colors duration-200 ${
      isLightTheme ? 'bg-slate-50 text-slate-800' : 'bg-slate-950 text-white'
    }`}>
      {/* Dynamic background highlights */}
      <div className={`absolute inset-0 transition-opacity ${
        isLightTheme
          ? 'bg-[radial-gradient(ellipse_80%_80%_at_50%_-20%,rgba(99,102,241,0.06),rgba(255,255,255,0))]'
          : 'bg-[radial-gradient(ellipse_80%_80%_at_50%_-20%,rgba(99,102,241,0.12),rgba(255,255,255,0))]'
      }`} />

      {/* DISGUISED HEADER */}
      <header className={`border-b relative z-10 p-4 transition-colors ${
        isLightTheme ? 'border-slate-200 bg-white/85' : 'border-slate-900 bg-slate-950/60'
      } backdrop-blur-md`}>
        <div className="max-w-7xl mx-auto flex justify-between items-center">
          <div className="flex items-center gap-2 sm:gap-3">
            <img src={logoImg} alt="Prix Logo" className="w-8 h-8 sm:w-10 sm:h-10 object-contain rounded-lg sm:rounded-xl select-none pointer-events-none" />
            <div>
              <span className={`font-black text-lg sm:text-xl transition-colors font-sans uppercase tracking-widest block ${
                isLightTheme ? 'text-slate-950' : 'text-white'
              }`}>
                prix
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2 sm:gap-3">
            {/* Theme switcher */}
            <button
              onClick={() => setIsLightTheme(!isLightTheme)}
              className={`p-1.5 sm:p-2 rounded-xl border transition-colors cursor-pointer select-none ${
                isLightTheme
                  ? 'border-slate-200 bg-slate-100 hover:bg-slate-200 text-slate-600'
                  : 'border-slate-800 bg-slate-900 hover:bg-slate-850 text-slate-400'
              }`}
              title={isLightTheme ? "Switch to Encrypted Dark Theme" : "Switch to Ambient Light Theme"}
            >
              {isLightTheme ? <Moon className="w-3.5 h-3.5" /> : <Sun className="w-3.5 h-3.5" />}
            </button>

            {/* Disguise Tabs Selector */}
            <div className={`flex items-center gap-0.5 sm:gap-1 p-0.5 sm:p-1 rounded-xl border transition-colors ${
              isLightTheme ? 'bg-slate-100 border-slate-200' : 'bg-slate-900 border-slate-800'
            }`}>
              <button
                onClick={() => setDisguiseTab('news')}
                className={`flex items-center gap-1 sm:gap-1.5 px-2 py-1 sm:px-3.5 sm:py-1.5 rounded-lg text-xs font-semibold cursor-pointer select-none transition ${
                  disguiseTab === 'news'
                    ? (isLightTheme ? 'bg-white text-slate-900 shadow-sm border border-slate-200' : 'bg-slate-800 text-white shadow-md')
                    : (isLightTheme ? 'text-slate-500 hover:text-slate-900' : 'text-slate-400 hover:text-white')
                }`}
                title="News Hunt"
              >
                <Newspaper className="w-3.5 h-3.5 text-red-500" />
                <span className="hidden sm:inline">News Hunt</span>
              </button>

              <button
                onClick={() => setDisguiseTab('game')}
                className={`flex items-center gap-1 sm:gap-1.5 px-2 py-1 sm:px-3.5 sm:py-1.5 rounded-lg text-xs font-semibold cursor-pointer select-none transition ${
                  disguiseTab === 'game'
                    ? (isLightTheme ? 'bg-white text-slate-900 shadow-sm border border-slate-200' : 'bg-slate-800 text-white shadow-md')
                    : (isLightTheme ? 'text-slate-500 hover:text-slate-900' : 'text-slate-400 hover:text-white')
                }`}
                title="Shift Games"
              >
                <Gamepad className="w-3.5 h-3.5 text-indigo-500" />
                <span className="hidden sm:inline">Shift Games</span>
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* DISGUISE MAIN FEED AREA */}
      <main className="max-w-7xl mx-auto w-full px-4 py-8 relative z-10 flex-grow flex flex-col justify-center">
        {inviteUid && (
          <div className="max-w-md mx-auto w-full mb-6 p-4 bg-indigo-500/10 border border-indigo-500/20 rounded-2xl flex items-center justify-between gap-4">
            <div className="flex items-center gap-2.5">
              <span className="text-indigo-400 animate-pulse shrink-0">🔗</span>
              <div>
                <p className="text-xs font-bold text-white leading-tight">Cryptographic Invitation</p>
                <p className="text-[10px] text-slate-400 mt-1">Unlock console to sync secure mesh node connection</p>
              </div>
            </div>
            <button
              onClick={() => setShowLockpad(true)}
              className="bg-indigo-600 hover:bg-indigo-550 text-white font-mono text-[9px] font-bold py-1.5 px-3 rounded-lg select-none cursor-pointer"
            >
              PAIR NODE
            </button>
          </div>
        )}

        {disguiseTab === 'news' ? (
          <div className="space-y-6">
            <DisguiseNews onSecretTrigger={triggerSecretMode} isLightTheme={isLightTheme} />
          </div>
        ) : (
          <div className="space-y-6">
            <DisguiseGame onSecretTrigger={triggerSecretMode} isLightTheme={isLightTheme} />
          </div>
        )}
      </main>

      {/* FOOTER */}
      <footer className={`border-t p-4 transition-colors text-center select-none ${
        isLightTheme ? 'border-slate-200 bg-slate-100/50' : 'border-slate-900 bg-slate-950'
      }`}>
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row justify-between items-center gap-3 text-[11px] text-slate-500 font-mono">
          <span>&copy; {new Date().getFullYear()} Daily Echo Syndications Ltd. All rights reserved.</span>
          <div className="flex gap-4 items-center">
            <button className="hover:text-slate-350 cursor-pointer bg-transparent border-0">Terms of Service</button>
            <span>&bull;</span>
            <button className="hover:text-slate-350 cursor-pointer bg-transparent border-0">Symmetric Privacy Protocols</button>
          </div>
        </div>
      </footer>

      {/* DECRYPTION LOCKPAD COMPONENT */}
      {showLockpad && (
        <SecretLockpad
          onUnlock={handleUnlock}
          onCancel={() => setShowLockpad(false)}
        />
      )}

      {/* Micro Floating Access button for seamless accessibility testing */}
      <button
        onClick={triggerSecretMode}
        className="fixed bottom-4 right-4 z-40 bg-indigo-600 hover:bg-indigo-700 hover:ring-4 hover:ring-indigo-500/20 text-white p-3 rounded-full shadow-lg transition active:scale-[0.95] cursor-pointer border-0"
        title="Access encrypted core panel"
      >
        <Lock className="w-4 h-4" />
      </button>
    </div>
  );
}
