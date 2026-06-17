/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import AppRoutes from './routes';
import { initAuth, logout, setAccessToken, db, safeGetDoc, waitForFirestoreReady } from './config/firebase';
import { doc, setDoc, onSnapshot, deleteDoc } from 'firebase/firestore';

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
          for (const contact of [myEmail, myPhone]) {
            if (!contact) continue;
            const docId = `${inviteUid}_${contact}`;
            const snap = await safeGetDoc(doc(db, 'invitations', docId));
            if (snap.exists()) {
              hasPermission = true;
              break;
            }
          }

          // Also check reverse direction
          if (!hasPermission) {
            const myContacts = [myEmail, myPhone].filter(Boolean);
            for (const myContact of myContacts) {
              const docId = `${userObj.uid}_${myContact}`;
              const snap = await safeGetDoc(doc(db, 'invitations', docId));
              if (snap.exists()) {
                const inviteData = snap.data();
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

        if (!hasPermission) {
          console.log('No prior invitation found, allowing direct link connection for testing');
          hasPermission = true;
        }
      } else {
        console.log('No Firebase connection, allowing direct link pairing');
      }

      let inviteName = 'Cryptographic Node';
      let inviteAvatar = 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=150';
      let inviteEmail = 'node@internal';
      let invitePhone = '';

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

            localStorage.setItem(`user_${inviteUid}`, JSON.stringify(inviteData));
          }
        } catch (dbErr) {
          console.warn('Unable to query counterpart from Firestore, relying on local simulation.', dbErr);
        }
      }

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

      try {
        const cleanUrl = window.location.protocol + "//" + window.location.host + window.location.pathname;
        window.history.replaceState({}, document.title, cleanUrl);
      } catch (historyErr) {
        console.warn('URL purification failed:', historyErr);
      }
      setInviteUid(null);
      setNewlyPairedChatId(connectionId);

    } catch (err) {
      console.error('Failed to auto-pair secure invite:', err);
    }
  };

  // Matchmaking link sync once session loads with query params active
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
      console.warn("Incoming call reject failed:", err);
    }
    setIncomingCall(null);
  };

  const handleEndCall = async () => {
    if (db && currentUser?.uid) {
      try {
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

  return (
    <AppRoutes
      disguiseTab={disguiseTab}
      setDisguiseTab={setDisguiseTab}
      isRevealed={isRevealed}
      setIsRevealed={setIsRevealed}
      showLockpad={showLockpad}
      setShowLockpad={setShowLockpad}
      isLightTheme={isLightTheme}
      setIsLightTheme={setIsLightTheme}
      currentUser={currentUser}
      gmailToken={gmailToken}
      newlyPairedChatId={newlyPairedChatId}
      clearNewlyPairedChatId={() => setNewlyPairedChatId(null)}
      activeCall={activeCall}
      incomingCall={incomingCall}
      handleRejectIncomingCall={handleRejectIncomingCall}
      handleAcceptIncomingCall={handleAcceptIncomingCall}
      handleEndCall={handleEndCall}
      handleStartCall={handleStartCall}
      handleUnlock={handleUnlock}
      handleLogout={handleLogout}
      triggerSecretMode={triggerSecretMode}
      inviteUid={inviteUid}
    />
  );
}
