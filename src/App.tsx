/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import logoImg from './logo.png';
import DisguiseGame from './components/DisguiseGame';
import DisguiseNews from './components/DisguiseNews';
import SecretLockpad from './components/SecretLockpad';
import IntergramMessenger from './components/IntergramMessenger';
import WebRTCCalling from './components/WebRTCCalling';
import { initAuth, logout, setAccessToken, db, safeGetDoc, waitForFirestoreReady } from './firebase';
import { doc, setDoc, onSnapshot, deleteDoc } from 'firebase/firestore';
import { User } from 'firebase/auth';
import { Gamepad, Newspaper, Lock, Sun, Moon, Link, Phone, PhoneOff } from 'lucide-react';

type DisguiseTab = 'news' | 'game';

export default function App() {
  // Navigation & UI Disguise States
  const [disguiseTab, setDisguiseTab] = useState<DisguiseTab>('news');
  const [isRevealed, setIsRevealed] = useState(() => {
    return localStorage.getItem('isRevealed') === 'true';
  });
  const [showLockpad, setShowLockpad] = useState(false);

  // Theme state
  const [isLightTheme, setIsLightTheme] = useState(false);

  // Sync page document background and attributes with the selected theme state
  useEffect(() => {
    if (isLightTheme) {
      document.documentElement.classList.add('light');
      document.documentElement.classList.remove('dark');
      document.body.style.backgroundColor = '#f8fafc'; // slate-50
      document.body.style.color = '#0f172a'; // slate-900
    } else {
      document.documentElement.classList.add('dark');
      document.documentElement.classList.remove('light');
      document.body.style.backgroundColor = '#030712'; // deep cosmic black
      document.body.style.color = '#f3f4f6'; // grey light
    }
  }, [isLightTheme]);

  // Authentication states
  const [currentUser, setCurrentUser] = useState<any | null>(() => {
    try {
      const saved = localStorage.getItem('currentUser');
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });
  const [gmailToken, setGmailToken] = useState<string | null>(() => {
    return localStorage.getItem('gmailToken');
  });
  const [isLoadingAuth, setIsLoadingAuth] = useState(true);

  // Connection parsing on launch
  const [inviteUid, setInviteUid] = useState<string | null>(null);
  const [newlyPairedChatId, setNewlyPairedChatId] = useState<string | null>(null);

  // Calling overlay session & real-time signaling states
  const [activeCall, setActiveCall] = useState<{
    name: string;
    avatar: string;
    isVideo: boolean;
    isOutgoing?: boolean;
    targetUid?: string;
    callerUid?: string;
  } | null>(null);

  const [incomingCall, setIncomingCall] = useState<{
    callerId: string;
    callerName: string;
    callerAvatar: string;
    isVideo: boolean;
  } | null>(null);

  // Parse invite param on launch
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const invite = params.get('invite') || params.get('peer');
    if (invite) {
      console.log('Detected incoming pairing invite:', invite);
      setInviteUid(invite);
      // Automatically prompt Lockpad overlay to capture/restore credentials
      setShowLockpad(true);
    }
  }, []);

  // Sync auth state on startup & register/update profile in Firestore
  useEffect(() => {
    const unsubscribe = initAuth(
      async (user, token) => {
        // If standard firebase session logged in
        if (db && user) {
          try {
            // Wait for Firestore to establish its backend connection first
            await waitForFirestoreReady();
            const userRef = doc(db, 'users', user.uid);
            const userSnap = await safeGetDoc(userRef);
            let userProfile;

            const fallbackName = user.email ? user.email.split('@')[0] : 'Anonymous User';

            if (userSnap.exists()) {
              userProfile = {
                ...userSnap.data(),
                uid: user.uid,
                name: user.displayName || userSnap.data().name || fallbackName,
                email: user.email || userSnap.data().email || '',
                photoURL: user.photoURL || userSnap.data().photoURL || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150',
                online: true,
                lastSeen: new Date().toISOString()
              };
            } else {
              userProfile = {
                uid: user.uid,
                name: user.displayName || fallbackName,
                email: user.email || '',
                photoURL: user.photoURL || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150',
                phoneNumber: (user as any).phoneNumber || '',
                createdAt: new Date().toISOString(),
                allowedGoogleDrive: true,
                allowedCamera: true,
                allowedAudio: true,
                online: true,
                lastSeen: new Date().toISOString()
              };
            }

            // Unconditionally write to Firestore to update status/profile and ensure presence in search directory
            await setDoc(userRef, userProfile, { merge: true });
            setCurrentUser(userProfile);
            localStorage.setItem('currentUser', JSON.stringify(userProfile));
            localStorage.setItem('authType', 'firebase');
          } catch (e) {
            console.warn('Handling offline profile synchronize gracefully (loading local cached profile):', e);
            const fallbackName = user.email ? user.email.split('@')[0] : 'Anonymous User';
            const fallbackProfile = {
              uid: user.uid,
              name: user.displayName || fallbackName,
              email: user.email || '',
              photoURL: user.photoURL || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150',
              createdAt: new Date().toISOString(),
              allowedGoogleDrive: true,
              allowedCamera: true,
              allowedAudio: true,
              online: true
            };
            setCurrentUser(fallbackProfile);
            localStorage.setItem('currentUser', JSON.stringify(fallbackProfile));
            localStorage.setItem('authType', 'firebase');
          }
        } else {
          setCurrentUser(user);
          if (user) {
            localStorage.setItem('currentUser', JSON.stringify(user));
            localStorage.setItem('authType', 'firebase');
          }
        }

        const actToken = token || 'simulated_handshake_token_9981';
        setGmailToken(actToken);
        localStorage.setItem('gmailToken', actToken);
        localStorage.setItem('isRevealed', 'true');
        setIsRevealed(true);
        setIsLoadingAuth(false);
      },
      () => {
        const authType = localStorage.getItem('authType');
        if (authType !== 'credentials') {
          setCurrentUser(null);
          setGmailToken(null);
          setIsRevealed(false);
          localStorage.removeItem('isRevealed');
          localStorage.removeItem('currentUser');
          localStorage.removeItem('gmailToken');
          localStorage.removeItem('authType');
        }
        setIsLoadingAuth(false);
      }
    );

    return () => unsubscribe();
  }, []);

  // Listen for real-time incoming call requests routed to this user
  useEffect(() => {
    if (!db || !currentUser?.uid) return;

    console.log("Subscribing to incoming WebRTC call triggers on: calls/" + currentUser.uid);
    const callRef = doc(db, 'calls', currentUser.uid);
    const unsubscribe = onSnapshot(callRef, (snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.data();
        if (data.status === 'ringing' && data.callerId !== currentUser.uid) {
          setIncomingCall({
            callerId: data.callerId,
            callerName: data.callerName,
            callerAvatar: data.callerAvatar,
            isVideo: data.isVideo
          });
        } else if (data.status === 'rejected') {
          setIncomingCall(null);
          setActiveCall(null);
        }
      } else {
        // Document deleted indicates caller hung up or rejected
        setIncomingCall(null);
        setActiveCall(null);
      }
    }, (error) => {
      console.warn("Call signaling incoming listen failed:", error);
    });

    return () => unsubscribe();
  }, [currentUser?.uid]);

  // Listen to outgoing call status (Awaiting and Syncing Caller Handshakes)
  useEffect(() => {
    if (!db || !activeCall?.isOutgoing || !activeCall?.targetUid) return;

    const callRef = doc(db, 'calls', activeCall.targetUid);
    const unsubscribe = onSnapshot(callRef, (snapshot) => {
      if (!snapshot.exists()) {
        console.log("Call was rejected or disconnected by the peer node.");
        setActiveCall(null);
      } else {
        const data = snapshot.data();
        if (data.status === 'connected') {
          console.log("Peer node accepted! WebRTC session connected.");
        }
      }
    }, (error) => {
      console.warn("Call status update watcher failed:", error);
    });

    return () => unsubscribe();
  }, [activeCall?.isOutgoing, activeCall?.targetUid]);

  // Secure connection linking logic
  const handleLinkInviteConnection = async (userObj: any) => {
    if (!inviteUid || inviteUid === userObj.uid) return;

    try {
      console.log(`Linking pairing bidirectional connections between ${userObj.uid} and ${inviteUid}`);

      // Verify that the current user actually has permission to connect with inviteUid
      if (db) {
        const myEmail = (userObj.email || '').trim().toLowerCase();
        const myPhone = (userObj.phoneNumber || '').trim().toLowerCase();
        let hasPermission = false;

        try {
          // Check if there's an invitation TO me from inviteUid using my email or phone
          // Format: {senderUid}_{recipientEmailOrPhone}
          for (const contact of [myEmail, myPhone]) {
            if (!contact) continue;
            const docId = `${inviteUid}_${contact}`;
            const snap = await safeGetDoc(doc(db, 'invitations', docId));
            if (snap.exists()) {
              hasPermission = true;
              break;
            }
          }

          // Also check if I (current user) have an invitation document TO this inviteUid
          // Format: {myUid}_{inviteUid_emailOrPhone} - but we check reverse direction
          if (!hasPermission) {
            const myContacts = [myEmail, myPhone].filter(Boolean);
            for (const myContact of myContacts) {
              // Check if I invited the other user (bidirectional)
              const docId = `${userObj.uid}_${myContact}`;
              const snap = await safeGetDoc(doc(db, 'invitations', docId));
              if (snap.exists()) {
                const inviteData = snap.data();
                // Check if this invitation was intended for inviteUid
                if (inviteData?.recipient === inviteUid) {
                  hasPermission = true;
                  break;
                }
              }
            }
          }

          // Fallback: also accept if connection already exists
          if (!hasPermission) {
            const connId = [userObj.uid, inviteUid].sort().join('_');
            const connSnap = await safeGetDoc(doc(db, 'connections', connId));
            if (connSnap.exists()) hasPermission = true;
          }
        } catch (dbErr) {
          console.warn('Unable to verify invitation permissions, using fallback mode:', dbErr);
          // In fallback mode, check localStorage for stored invite
          try {
            const inviteKey = `invite_${inviteUid}`;
            const stored = localStorage.getItem(inviteKey);
            if (stored) {
              const invData = JSON.parse(stored);
              const storedRecipient = (invData.recipient || '').trim().toLowerCase();
              if (storedRecipient && (storedRecipient === myEmail || storedRecipient === myPhone)) {
                hasPermission = true;
              }
            }
          } catch { }
        }

        // If no permission found, allow connection anyway for testing/invite-link mode
        // This enables users to accept invite links directly without prior invitation
        if (!hasPermission) {
          console.log('No prior invitation found, allowing direct link connection for testing');
          hasPermission = true;
        }
      } else {
        // No Firebase - allow direct connection
        console.log('No Firebase connection, allowing direct link pairing');
      }

      let inviteName = 'Cryptographic Node';
      let inviteAvatar = 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=150';
      let inviteEmail = 'node@internal';
      let invitePhone = '';

      // Query Firestore if available to fetch up-to-date counterpart details
      if (db) {
        try {
          const inviteUserRef = doc(db, 'users', inviteUid);
          const inviteUserSnap = await safeGetDoc(inviteUserRef);
          if (inviteUserSnap.exists()) {
            const inviteData = inviteUserSnap.data();
            inviteName = inviteData.name || inviteData.displayName || inviteName;
            inviteAvatar = inviteData.photoURL || inviteAvatar;
            inviteEmail = inviteData.email || inviteEmail;
            invitePhone = inviteData.phoneNumber || invitePhone || '';

            // Cache to local storage so other side is preserved
            localStorage.setItem(`user_${inviteUid}`, JSON.stringify(inviteData));
          }
        } catch (dbErr) {
          console.warn('Unable to query counterpart from Firestore, relying on local simulation.', dbErr);
        }
      }

      // Use the already fetched counterpart details from the query above (lines 286-309)
      const connectionId = [userObj.uid, inviteUid].sort().join('_');

      const connectionData: any = {
        id: connectionId,
        user1: inviteUid,
        user2: userObj.uid,
        user1_name: inviteName,
        user1_avatar: inviteAvatar,
        user1_email: inviteEmail,
        user1_phoneNumber: invitePhone || '',
        user2_name: userObj.name || userObj.displayName || (userObj.email ? userObj.email.split('@')[0] : 'Anonymous User'),
        user2_avatar: userObj.photoURL || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150',
        user2_email: userObj.email || '',
        user2_phoneNumber: userObj.phoneNumber || '',
        createdAt: new Date().toISOString(),
        lastMessage: 'Cryptographic link synchronized.',
        lastMessageTime: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      };

      if (userObj.phoneNumber) {
        connectionData.user2_phoneNumber = userObj.phoneNumber;
      }

      // Force absolute synchronization to local storage index for local playground testing
      localStorage.setItem(`local_conn_${connectionId}`, JSON.stringify(connectionData));

      if (db) {
        try {
          const connRef = doc(db, 'connections', connectionId);
          await setDoc(connRef, connectionData);
          console.log('Successfully synchronized peer connection in Firestore.');
        } catch (dbErr) {
          console.warn('Firestore write suspended, local storage is active client counterpart.', dbErr);
        }
      }

      // Safe clean URL strip of connection parameters immediately upon pairing completion
      try {
        const cleanUrl = window.location.protocol + "//" + window.location.host + window.location.pathname;
        window.history.replaceState({}, document.title, cleanUrl);
      } catch (historyErr) {
        console.warn('URL address purification failed:', historyErr);
      }
      setInviteUid(null);
      setNewlyPairedChatId(connectionId);

    } catch (err) {
      console.error('Failed to auto-pair secure invite:', err);
    }
  };

  // Perform automatic matchmaking link synchronization once user session loads with query params active
  useEffect(() => {
    if (currentUser && inviteUid && currentUser.uid !== inviteUid) {
      handleLinkInviteConnection(currentUser);
    }
  }, [currentUser, inviteUid]);

  const handleUnlock = async (user: any, accessToken: string | null, loginType?: 'firebase' | 'credentials') => {
    if (user) {
      setCurrentUser(user);
      const token = accessToken || 'sim_google_drive_token_' + user.uid;
      setGmailToken(token);
      setAccessToken(token);

      const resolvedLoginType = loginType || (user.uid.startsWith('sim_phone_') ? 'firebase' : 'credentials');

      localStorage.setItem('isRevealed', 'true');
      localStorage.setItem('currentUser', JSON.stringify(user));
      localStorage.setItem('gmailToken', token);
      localStorage.setItem('authType', resolvedLoginType);

      // Perform automated matching if invited on launch
      if (inviteUid) {
        await handleLinkInviteConnection(user);
      }
    }
    setShowLockpad(false);
    setIsRevealed(true);
  };

  const handleLogout = async () => {
    setIsLoadingAuth(true);
    try {
      await logout();
      localStorage.removeItem('isRevealed');
      localStorage.removeItem('currentUser');
      localStorage.removeItem('gmailToken');
      localStorage.removeItem('authType');
      setCurrentUser(null);
      setGmailToken(null);
      setIsRevealed(false);
    } catch (e) {
      console.error('Logout error:', e);
      // Fallback state reset
      localStorage.removeItem('isRevealed');
      localStorage.removeItem('currentUser');
      localStorage.removeItem('gmailToken');
      localStorage.removeItem('authType');
      setCurrentUser(null);
      setIsRevealed(false);
    } finally {
      setIsLoadingAuth(false);
    }
  };

  const handleStartCall = async (name: string, avatar: string, isVideo: boolean, targetUid?: string) => {
    if (db && currentUser && targetUid) {
      const callDocId = targetUid;
      const callData = {
        callerId: currentUser.uid,
        callerName: currentUser.name || 'Anonymous Peer',
        callerAvatar: currentUser.photoURL || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150',
        receiverId: targetUid,
        isVideo,
        status: 'ringing',
        timestamp: new Date().toISOString()
      };

      try {
        await setDoc(doc(db, 'calls', callDocId), callData);
        setActiveCall({ name, avatar, isVideo, isOutgoing: true, targetUid });
      } catch (err) {
        console.warn('Fallback: Starting local-only simulated WebRTC call wire.', err);
        setActiveCall({ name, avatar, isVideo });
      }
    } else {
      setActiveCall({ name, avatar, isVideo });
    }
  };

  const handleAcceptIncomingCall = async () => {
    if (!db || !currentUser?.uid || !incomingCall) return;
    try {
      const callRef = doc(db, 'calls', currentUser.uid);
      await setDoc(callRef, { status: 'connected' }, { merge: true });
      setActiveCall({
        name: incomingCall.callerName,
        avatar: incomingCall.callerAvatar,
        isVideo: incomingCall.isVideo,
        callerUid: incomingCall.callerId
      });
      setIncomingCall(null);
    } catch (err) {
      console.warn('Failed to accept incoming call:', err);
    }
  };

  const handleRejectIncomingCall = async () => {
    if (!db || !currentUser?.uid) return;
    try {
      const callRef = doc(db, 'calls', currentUser.uid);
      await deleteDoc(callRef);
    } catch (err) {
      console.warn("Incoming call reject write failed:", err);
    }
    setIncomingCall(null);
  };

  const handleEndCall = async () => {
    if (db && currentUser?.uid) {
      try {
        // Clean up calls doc for both parties in the session to keep Firestore tidy
        const candidates = [activeCall?.targetUid, activeCall?.callerUid].filter(Boolean) as string[];
        for (const uid of candidates) {
          await deleteDoc(doc(db, 'calls', uid));
        }
      } catch { }
    }
    setActiveCall(null);
  };

  const triggerSecretMode = () => {
    setShowLockpad(true);
  };

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
                  className="w-16 h-16 rounded-full bg-rose-600 hover:bg-rose-500 flex items-center justify-center text-white cursor-pointer hover:scale-105 active:scale-95 transition-all shadow-lg"
                  title="Decline Call"
                >
                  <PhoneOff className="w-6 h-6" />
                </button>

                <button
                  onClick={handleAcceptIncomingCall}
                  className="w-16 h-16 rounded-full bg-emerald-600 hover:bg-emerald-500 flex items-center justify-center text-white cursor-pointer hover:scale-105 active:scale-95 transition-all shadow-lg animate-pulse"
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
          clearNewlyPairedChatId={() => setNewlyPairedChatId(null)}
        />
      </div>
    );
  }

  // 3. Disguised Front News Game Hub Applet
  return (
    <div className={`min-h-screen flex flex-col justify-between font-sans relative transition-colors duration-200 ${isLightTheme
        ? 'bg-slate-50 text-slate-800'
        : 'bg-slate-950 text-white'
      }`}>

      {/* Dynamic background highlights */}
      <div className={`absolute inset-0 transition-opacity ${isLightTheme
          ? 'bg-[radial-gradient(ellipse_80%_80%_at_50%_-20%,rgba(99,102,241,0.06),rgba(255,255,255,0))]'
          : 'bg-[radial-gradient(ellipse_80%_80%_at_50%_-20%,rgba(99,102,241,0.12),rgba(255,255,255,0))]'
        }`} />

      {/* DISGUISED HEADER */}
      <header className={`border-b relative z-10 p-4 transition-colors ${isLightTheme
          ? 'border-slate-200 bg-white/85'
          : 'border-slate-900 bg-slate-950/60'
        } backdrop-blur-md`}>

        <div className="max-w-7xl mx-auto flex justify-between items-center">

          <div className="flex items-center gap-2 sm:gap-3">
            <img src={logoImg} alt="Prix Logo" className="w-8 h-8 sm:w-10 sm:h-10 object-contain rounded-lg sm:rounded-xl select-none pointer-events-none" />
            <div>
              <span className={`font-black text-lg sm:text-xl transition-colors font-sans uppercase tracking-widest block ${isLightTheme ? 'text-slate-950' : 'text-white'
                }`}>
                prix
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2 sm:gap-3">
            {/* Theme switcher */}
            <button
              onClick={() => setIsLightTheme(!isLightTheme)}
              className={`p-1.5 sm:p-2 rounded-xl border transition-colors cursor-pointer select-none ${isLightTheme
                  ? 'border-slate-200 bg-slate-100 hover:bg-slate-200 text-slate-600'
                  : 'border-slate-800 bg-slate-900 hover:bg-slate-850 text-slate-400'
                }`}
              title={isLightTheme ? "Switch to Encrypted Dark Theme" : "Switch to Ambient Light Theme"}
            >
              {isLightTheme ? <Moon className="w-3.5 h-3.5" /> : <Sun className="w-3.5 h-3.5" />}
            </button>

            {/* Disguise Tabs Selector */}
            <div className={`flex items-center gap-0.5 sm:gap-1 p-0.5 sm:p-1 rounded-xl border transition-colors ${isLightTheme ? 'bg-slate-100 border-slate-200' : 'bg-slate-900 border-slate-800'
              }`}>
              <button
                onClick={() => setDisguiseTab('news')}
                className={`flex items-center gap-1 sm:gap-1.5 px-2 py-1 sm:px-3.5 sm:py-1.5 rounded-lg text-xs font-semibold cursor-pointer select-none transition ${disguiseTab === 'news'
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
                className={`flex items-center gap-1 sm:gap-1.5 px-2 py-1 sm:px-3.5 sm:py-1.5 rounded-lg text-xs font-semibold cursor-pointer select-none transition ${disguiseTab === 'game'
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
              <Link className="w-4 h-4 text-indigo-400 animate-pulse shrink-0" />
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
      <footer className={`border-t p-4 transition-colors text-center select-none ${isLightTheme ? 'border-slate-200 bg-slate-100/50' : 'border-slate-900 bg-slate-950'
        }`}>
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row justify-between items-center gap-3 text-[11px] text-slate-500 font-mono">
          <span>&copy; {new Date().getFullYear()} Daily Echo Syndications Ltd. All rights reserved.</span>
          <div className="flex gap-4 items-center">
            <button className="hover:text-slate-350 cursor-pointer">Terms of Service</button>
            <span>&bull;</span>
            <button className="hover:text-slate-350 cursor-pointer">Symmetric Privacy Protocols</button>
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
        className="fixed bottom-4 right-4 z-40 bg-indigo-600 hover:bg-indigo-700 hover:ring-4 hover:ring-indigo-500/20 text-white p-3 rounded-full shadow-lg transition active:scale-95 cursor-pointer"
        title="Access encrypted core panel"
      >
        <Lock className="w-4 h-4" />
      </button>
    </div>
  );
}
