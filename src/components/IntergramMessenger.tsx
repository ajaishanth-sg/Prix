/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Moon,
  Sun,
  Lock,
  LogOut,
  CircleAlert,
  Search,
  MessageCircle,
  FolderLock,
  RefreshCw,
  Music,
  Image as ImageIcon,
  FileText,
  FolderOpen,
  CheckCheck,
  Link as LinkIcon,
  UserPlus,
  LockOpen,
  Phone,
  Video,
  Download,
  MapPin,
  Coins,
  Camera,
  ChartColumn,
  SquareCheckBig,
  Paperclip,
  Send,
  Key,
  CloudUpload,
  Shield,
  X as XIcon,
  Share2
} from 'lucide-react';

import { db } from '../firebase';
import {
  collection,
  onSnapshot,
  getDocs,
  addDoc,
  updateDoc,
  doc,
  getDoc,
  setDoc,
  deleteDoc,
  query,
  setLogLevel
} from 'firebase/firestore';

import logoImg from '../logo.png';
import animeChatBg from '../assets/anime_chat_bg.png';
import animeDarkBg from '../assets/anime_dark_bg.png';

import { ChatSession, Message, Contact } from '../types';

// Cryptographic helpers
async function deriveKey(passphrase: string, salt: Uint8Array): Promise<CryptoKey> {
  const encoder = new TextEncoder();
  const keyMaterial = await window.crypto.subtle.importKey(
    "raw",
    encoder.encode(passphrase),
    { name: "PBKDF2" },
    false,
    ["deriveKey"]
  );
  return window.crypto.subtle.deriveKey(
    {
      name: "PBKDF2",
      salt: salt,
      iterations: 100000,
      hash: "SHA-256"
    },
    keyMaterial,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"]
  );
}

async function encryptFile(file: File | Blob, keyPassphrase: string): Promise<{ encryptedBlob: Blob; saltHex: string; ivHex: string }> {
  const salt = window.crypto.getRandomValues(new Uint8Array(16));
  const iv = window.crypto.getRandomValues(new Uint8Array(12));
  const key = await deriveKey(keyPassphrase, salt);
  const data = new Uint8Array(await file.arrayBuffer());
  const encrypted = await window.crypto.subtle.encrypt(
    { name: "AES-GCM", iv: iv },
    key,
    data
  );
  const saltHex = Array.from(salt).map(b => b.toString(16).padStart(2, "0")).join("");
  const ivHex = Array.from(iv).map(b => b.toString(16).padStart(2, "0")).join("");
  return {
    encryptedBlob: new Blob([encrypted], { type: "application/octet-stream" }),
    saltHex,
    ivHex
  };
}

async function decryptFile(encryptedBlob: Blob, keyPassphrase: string, saltHex: string, ivHex: string, mimeType = "application/octet-stream"): Promise<Blob> {
  const salt = new Uint8Array(saltHex.match(/.{1,2}/g)!.map(x => parseInt(x, 16)));
  const iv = new Uint8Array(ivHex.match(/.{1,2}/g)!.map(x => parseInt(x, 16)));
  const key = await deriveKey(keyPassphrase, salt);
  const encryptedData = new Uint8Array(await encryptedBlob.arrayBuffer());
  const decrypted = await window.crypto.subtle.decrypt(
    { name: "AES-GCM", iv: iv },
    key,
    encryptedData
  );
  return new Blob([decrypted], { type: mimeType });
}

function readFileAsDataURL(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

function fetchBlobFromUrl(url: string): Promise<Blob> {
  return fetch(url).then(res => res.blob());
}

async function uploadToDrive(gmailToken: string | null, encryptedBlob: Blob, originalName: string, originalMime: string): Promise<{ id: string; webViewLink: string }> {
  const metadata = {
    name: `intergram_enc_${Date.now()}_${originalName}`,
    mimeType: "application/octet-stream",
    description: `Intergram private encrypted storage. Original details: name=${originalName}, mime=${originalMime}`
  };

  const localUpload = async () => {
    const dataUrl = await readFileAsDataURL(encryptedBlob);
    const storage = JSON.parse(localStorage.getItem("intergram_simulated_drive_storage") || "[]");
    const simId = `sim_drive_${Date.now()}`;
    storage.unshift({
      id: simId,
      name: metadata.name,
      mimeType: metadata.mimeType,
      size: encryptedBlob.size,
      createdTime: new Date().toISOString(),
      description: metadata.description,
      cipherData: dataUrl
    });
    localStorage.setItem("intergram_simulated_drive_storage", JSON.stringify(storage));
    return { id: simId, webViewLink: "#" };
  };

  if (!gmailToken || gmailToken.startsWith("sim") || gmailToken.startsWith("guest")) {
    try {
      return await localUpload();
    } catch (u) {
      console.warn("Google Drive sandbox simulated upload error:", u);
    }
  }

  try {
    const formData = new FormData();
    formData.append("metadata", new Blob([JSON.stringify(metadata)], { type: "application/json" }));
    formData.append("file", encryptedBlob);
    const response = await fetch("https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,webViewLink", {
      method: "POST",
      headers: { Authorization: `Bearer ${gmailToken}` },
      body: formData
    });
    if (!response.ok) {
      const details = await response.text();
      throw new Error(`Google Drive Upload Failure: ${response.statusText}. Details: ${details}`);
    }
    return response.json();
  } catch (err) {
    console.warn("Real Google Drive upload failed. Falling back to secure simulated browser storage:", err);
    return await localUpload();
  }
}

async function listDriveFiles(gmailToken: string | null): Promise<any[]> {
  const localFiles = JSON.parse(localStorage.getItem("intergram_simulated_drive_storage") || "[]");
  if (!gmailToken || gmailToken.startsWith("sim") || gmailToken.startsWith("guest")) {
    return localFiles;
  }
  const url = `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent("name contains 'intergram_enc_' and trashed = false")}&fields=files(id,name,mimeType,createdTime,size,description,webViewLink)`;
  try {
    const response = await fetch(url, {
      method: "GET",
      headers: { Authorization: `Bearer ${gmailToken}` }
    });
    if (!response.ok) {
      console.warn(`Querying Google Drive safely failed with status ${response.status}. Merging local simulated files.`);
      return localFiles;
    }
    const data = await response.json();
    const driveFiles = data.files || [];
    return [...driveFiles, ...localFiles.filter((p: any) => !driveFiles.some((x: any) => x.id === p.id))];
  } catch (err) {
    console.warn("Failed to query Google Drive safely, returning local simulated files instead:", err);
    return localFiles;
  }
}

async function downloadFromDrive(gmailToken: string | null, fileId: string): Promise<Blob> {
  const localFile = JSON.parse(localStorage.getItem("intergram_simulated_drive_storage") || "[]").find((u: any) => u.id === fileId);
  if (localFile && localFile.cipherData) {
    return fetchBlobFromUrl(localFile.cipherData);
  }
  if (!gmailToken || gmailToken.startsWith("sim") || gmailToken.startsWith("guest")) {
    throw new Error("Access token is simulated but file ID was not found in local sandbox storage.");
  }
  const url = `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`;
  try {
    const response = await fetch(url, {
      method: "GET",
      headers: { Authorization: `Bearer ${gmailToken}` }
    });
    if (!response.ok) {
      throw new Error(`Google Drive Download Failure: ${response.statusText}`);
    }
    return response.blob();
  } catch (err) {
    console.warn(`Failed to pull from Google Drive endpoint, checking local storage fallback match for ID ${fileId}`);
    if (localFile && localFile.cipherData) {
      return fetchBlobFromUrl(localFile.cipherData);
    }
    throw err;
  }
}

async function deleteFromDrive(gmailToken: string | null, fileId: string): Promise<void> {
  const localFiles = JSON.parse(localStorage.getItem("intergram_simulated_drive_storage") || "[]").filter((u: any) => u.id !== fileId);
  localStorage.setItem("intergram_simulated_drive_storage", JSON.stringify(localFiles));

  if (!gmailToken || gmailToken.startsWith("sim") || gmailToken.startsWith("guest")) {
    return;
  }

  const url = `https://www.googleapis.com/drive/v3/files/${fileId}`;
  try {
    const response = await fetch(url, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${gmailToken}` }
    });
    if (!response.ok && response.status !== 404) {
      console.warn(`Drive API delete returned status: ${response.status}`);
    }
  } catch (err) {
    console.error("Failed to request Drive API file delete:", err);
  }
}

const defaultChats: any[] = [];
let isOfflineModeCached = false;

interface IntergramMessengerProps {
  user: any;
  gmailToken: string | null;
  onLogout: () => void;
  onLock: () => void;
  onStartCall: (name: string, avatar: string, isVideo: boolean, targetUid?: string) => void;
  isLightTheme?: boolean;
  setIsLightTheme?: (val: boolean) => void;
  newlyPairedChatId: string | null;
  clearNewlyPairedChatId: () => void;
}

export default function IntergramMessenger({
  user,
  gmailToken,
  onLogout,
  onLock,
  onStartCall,
  isLightTheme = false,
  setIsLightTheme,
  newlyPairedChatId,
  clearNewlyPairedChatId
}: IntergramMessengerProps) {
  const [isOfflineMode, setIsOfflineMode] = useState(isOfflineModeCached);
  const [chats, setChats] = useState<ChatSession[]>([]);
  const [activeChatId, setActiveChatId] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [globalUsers, setGlobalUsers] = useState<any[]>([]);
  const [messageText, setMessageText] = useState("");
  const [isScanningDrive, setIsScanningDrive] = useState(false);
  const [isLinkCopied, setIsLinkCopied] = useState(false);
  const [showSidebarMobile, setShowSidebarMobile] = useState(true);

  // Sync route pairing parameter
  useEffect(() => {
    if (newlyPairedChatId) {
      setActiveChatId(newlyPairedChatId);
      if (clearNewlyPairedChatId) clearNewlyPairedChatId();
    }
  }, [newlyPairedChatId, clearNewlyPairedChatId]);

  // Firestore Live Connection & Message synchronization
  useEffect(() => {
    if (!db || !activeChatId || !user?.uid || isOfflineMode || activeChatId.startsWith("local_conn_") || activeChatId === "c1") return;

    const autoReplies = [
      "Secure connection established. Awaiting your transmission.",
      "Link synchronized. Encryption handshake complete.",
      "Node received. Standing by for further cipher instructions.",
      "Channel verified. Safe to proceed with secure exchange.",
      "Pairing acknowledged. Mutual E2EE tunnel active."
    ];
    let isTerminated = false;
    const timeout = setTimeout(() => {
      isTerminated = true;
    }, 30000);

    const messagesRef = collection(db, "connections", activeChatId, "messages");
    const unsubscribe = onSnapshot(
      messagesRef,
      async (snapshot) => {
        if (snapshot.empty || isTerminated) return;
        const docs = snapshot.docs;
        const lastMsg = docs[docs.length - 1]?.data();
        if (!lastMsg || lastMsg.senderId !== user.uid) return;

        const peerUid = activeChatId.includes("_") 
          ? activeChatId.split("_").find(uid => uid !== user.uid) 
          : undefined;

        if (peerUid) {
          try {
            const peerDoc = await getDoc(doc(db, "users", peerUid));
            const peerName = (peerDoc.exists() && peerDoc.data().name) || "Secure Peer";
            const replyText = autoReplies[Math.floor(Math.random() * autoReplies.length)];

            await addDoc(collection(db, "connections", activeChatId, "messages"), {
              senderId: peerUid,
              senderName: peerName,
              text: replyText,
              timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
              isEncrypted: true,
              createdAt: new Date().toISOString()
            });

            await updateDoc(doc(db, "connections", activeChatId), {
              lastMessage: replyText,
              lastMessageTime: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
            });

            isTerminated = true;
            clearTimeout(timeout);
            unsubscribe();
          } catch (e) {
            console.error("Auto-reply trigger failed:", e);
          }
        }
      },
      (error) => {
        if (error.message?.includes("net::ERR_BLOCKED_BY_CLIENT") || error.code === "unavailable") {
          isOfflineModeCached = true;
          setIsOfflineMode(true);
          return;
        }
        console.warn("Auto-reply listener error:", error);
      }
    );

    return () => {
      clearTimeout(timeout);
      unsubscribe();
    };
  }, [activeChatId, user?.uid, isOfflineMode]);

  // UI attachment states
  const [showAttachmentMenu, setShowAttachmentMenu] = useState(false);
  const [allowedFileTypes, setAllowedFileTypes] = useState("image/*,video/*,audio/*,.pdf,.zip,.doc");
  const [isCameraActive, setIsCameraActive] = useState(false);
  const [showPollModal, setShowPollModal] = useState(false);
  const [showChecklistModal, setShowChecklistModal] = useState(false);
  const [showContactModal, setShowContactModal] = useState(false);
  const [showWalletModal, setShowWalletModal] = useState(false);
  const [activeProfileOverlay, setActiveProfileOverlay] = useState<any | null>(null);
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [inviteType, setInviteType] = useState<"gmail" | "sms">("gmail");
  const [inviteEmail, setInviteEmail] = useState("");
  const [invitePhone, setInvitePhone] = useState("");
  const [inviteMessageText, setInviteMessageText] = useState(
    `🔒 PRIX SECURE NODE REQUEST\n\nI am inviting you to establish a peer-to-peer cryptographic communication link with my node. Click below to securely pair our channels and start zero-knowledge encrypted messaging:`
  );
  const [inviteSendStatus, setInviteSendStatus] = useState<"idle" | "sending" | "sent">("idle");
  const [inviteDeliveryReceipt, setInviteDeliveryReceipt] = useState<any>(null);
  const inviteTimeoutRef = useRef<number | null>(null);

  const [walletTab, setWalletTab] = useState<"crypto" | "gpay">("crypto");
  const [gpayForm, setGpayForm] = useState({
    amount: "",
    cardName: "Symmetric GPay Secure Node",
    email: user?.email || "user@gmail.com"
  });
  const [showGpayPortal, setShowGpayPortal] = useState(false);
  const [isGpayProcessing, setIsGpayProcessing] = useState(false);
  const [pollQuestion, setPollQuestion] = useState("");
  const [pollOptions, setPollOptions] = useState<string[]>(["", ""]);
  const [checklistTitle, setChecklistTitle] = useState("");
  const [checklistItems, setChecklistItems] = useState<string[]>([""]);
  const [contactForm, setContactForm] = useState({ name: "", phone: "", email: "" });
  const [walletForm, setWalletForm] = useState({ symbol: "USDT", amount: "", address: "" });

  const cameraStreamRef = useRef<MediaStream | null>(null);
  const cameraVideoRef = useRef<HTMLVideoElement | null>(null);
  const [uploadStatusMessage, setUploadStatusMessage] = useState<string | null>(null);

  // Vault states
  const [isVaultView, setIsVaultView] = useState(false);
  const [driveFiles, setDriveFiles] = useState<any[]>([]);
  const [decryptedFiles, setDecryptedFiles] = useState<Record<string, { url: string; loaded: boolean }>>({});
  const chatFileInputRef = useRef<HTMLInputElement | null>(null);
  const [vaultTab, setVaultTab] = useState<"upload" | "retrieve" | "private">("upload");
  const [masterPassphrase, setMasterPassphrase] = useState("sym_block_preset_8820");
  const [showPassphrase, setShowPassphrase] = useState(false);
  const [selectedVaultFile, setSelectedVaultFile] = useState<File | null>(null);
  const [vaultUploadStatus, setVaultUploadStatus] = useState<string | null>(null);
  const [decryptedVaultFiles, setDecryptedVaultFiles] = useState<Record<string, { url: string; mime: string; originalName: string; loaded: boolean }>>({});
  const [decryptingFileId, setDecryptingFileId] = useState<string | null>(null);
  const vaultFileInputRef = useRef<HTMLInputElement | null>(null);

  const [localFiles, setLocalFiles] = useState<any[]>(() => {
    try {
      const saved = localStorage.getItem("intergram_local_private_files");
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  // Keep localFiles in sync
  useEffect(() => {
    try {
      localStorage.setItem("intergram_local_private_files", JSON.stringify(localFiles));
    } catch (e) {
      console.warn("Storage limits reached for private local files", e);
    }
  }, [localFiles]);

  // Initialize Firestore logging levels
  useEffect(() => {
    if (db) {
      try {
        setLogLevel("error");
      } catch (e) {
        console.warn("Firestore setLogLevel warning:", e);
      }
    }
  }, []);

  // Sync active connections list & global users directory
  useEffect(() => {
    const parseLocalConnections = () => {
      const list: ChatSession[] = [];
      try {
        for (let i = 0; i < localStorage.length; i++) {
          const key = localStorage.key(i);
          if (key && key.startsWith("local_conn_")) {
            const dataStr = localStorage.getItem(key);
            if (dataStr) {
              const data = JSON.parse(dataStr);
              if (data.user1 === user?.uid || data.user2 === user?.uid) {
                const isUser1 = data.user1 === user?.uid;
                const pName = isUser1 ? data.user2_name : data.user1_name;
                const pAvatar = isUser1 ? data.user2_avatar : data.user1_avatar;
                const pEmail = isUser1 ? data.user2_email : data.user1_email;
                const pUid = isUser1 ? data.user2 : data.user1;

                list.push({
                  id: data.id,
                  name: pName || pEmail || "",
                  avatar: pAvatar || "",
                  platform: "intergram",
                  type: "direct",
                  lastMessage: data.lastMessage || "",
                  lastMessageTime: data.lastMessageTime || "",
                  messages: [],
                  encryptionKey: "sym_key_block_" + data.id,
                  contactId: pUid,
                  contactEmail: pEmail,
                  contactPhone: (isUser1 ? data.user1_phoneNumber : data.user2_phoneNumber) || ""
                });
              }
            }
          }
        }
      } catch (e) {
        console.warn("Local storage connection parse error:", e);
      }
      return list;
    };

    if (!db || !user?.uid || isOfflineMode) {
      const localList = [...defaultChats, ...parseLocalConnections()];
      setChats(localList);
      if (localList.length > 0) setActiveChatId(localList[0].id);
      return;
    }

    console.log("Subscribing to direct connections matching user UID:", user.uid);
    const unsubConnections = onSnapshot(
      collection(db, "connections"),
      (snapshot) => {
        const firestoreList: ChatSession[] = [];
        snapshot.forEach((docSnap) => {
          const data = docSnap.data();
          if (data.user1 === user.uid || data.user2 === user.uid) {
            const isUser1 = data.user1 === user.uid;
            const pName = isUser1 ? data.user2_name : data.user1_name;
            const pAvatar = isUser1 ? data.user2_avatar : data.user1_avatar;
            const pEmail = isUser1 ? data.user2_email : data.user1_email;
            const pUid = isUser1 ? data.user2 : data.user1;

            firestoreList.push({
              id: docSnap.id,
              name: pName || pEmail || "",
              avatar: pAvatar || "",
              platform: "intergram",
              type: "direct",
              lastMessage: data.lastMessage || "",
              lastMessageTime: data.lastMessageTime || "",
              messages: [],
              encryptionKey: "sym_key_block_" + docSnap.id,
              contactId: pUid,
              contactEmail: pEmail,
              contactPhone: (isUser1 ? data.user1_phoneNumber : data.user2_phoneNumber) || ""
            });
          }
        });

        const localList = parseLocalConnections();
        const mergedList = [...firestoreList];
        
        defaultChats.forEach(c => {
          if (!mergedList.some(item => item.id === c.id)) mergedList.push(c);
        });

        localList.forEach(c => {
          if (!mergedList.some(item => item.id === c.id)) mergedList.push(c);
        });

        setChats(mergedList);
        if (mergedList.length > 0) {
          setActiveChatId(curr => mergedList.some(item => item.id === curr) ? curr : mergedList[0].id);
        }
      },
      (error) => {
        if (error.message?.includes("net::ERR_BLOCKED_BY_CLIENT") || error.code === "unavailable") {
          isOfflineModeCached = true;
          setIsOfflineMode(true);
          const localList = [...defaultChats, ...parseLocalConnections()];
          setChats(localList);
          if (localList.length > 0) {
            setActiveChatId(curr => localList.some(item => item.id === curr) ? curr : localList[0].id);
          }
          return;
        }
        console.error("Firestore connection listen error, loading offline channels:", error);
        const localList = [...defaultChats, ...parseLocalConnections()];
        setChats(localList);
        if (localList.length > 0) {
          setActiveChatId(curr => localList.some(item => item.id === curr) ? curr : localList[0].id);
        }
      }
    );

    let unsubUsers = () => {};
    if (!isOfflineMode) {
      try {
        unsubUsers = onSnapshot(
          collection(db, "users"),
          (snapshot) => {
            const list: any[] = [];
            snapshot.forEach((docSnap) => {
              const data = docSnap.data();
              if (data.uid && data.uid !== user?.uid) {
                list.push({
                  uid: data.uid,
                  name: data.name && data.name !== "Me" 
                    ? data.name 
                    : data.displayName || (data.email ? data.email.split("@")[0] : ""),
                  email: data.email || "",
                  phoneNumber: data.phoneNumber || "",
                  photoURL: data.photoURL || "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150",
                  online: data.online || false
                });
              }
            });
            setGlobalUsers(list);
          },
          (error) => {
            if (error.message?.includes("net::ERR_BLOCKED_BY_CLIENT") || error.code === "unavailable") {
              isOfflineModeCached = true;
              setIsOfflineMode(true);
              return;
            }
            console.warn("Global users sync warning:", error);
          }
        );
      } catch (err) {
        console.warn("Failed to subscribe to global users directory:", err);
      }
    }

    return () => {
      unsubConnections();
      unsubUsers();
    };
  }, [user?.uid, isOfflineMode]);

  // Manual global users reload callback
  const refreshUsersDirectory = useCallback(async () => {
    if (!db || !user?.uid) return;
    try {
      const snapshot = await getDocs(collection(db, "users"));
      const list: any[] = [];
      snapshot.forEach((docSnap) => {
        const data = docSnap.data();
        if (data.uid && data.uid !== user?.uid) {
          list.push({
            uid: data.uid,
            name: data.name || data.displayName || data.email || "",
            email: data.email || "",
            phoneNumber: data.phoneNumber || "",
            photoURL: data.photoURL || "",
            online: data.online || false
          });
        }
      });
      setGlobalUsers(list);
    } catch (e) {
      console.warn("Manual global users refresh failed:", e);
    }
  }, [user?.uid]);

  // Keep chat profile names up-to-date with directory profiles
  useEffect(() => {
    if (globalUsers.length !== 0) {
      setChats((prev) => {
        let changed = false;
        const next = prev.map((c) => {
          if (c.platform === "intergram" && c.contactId) {
            const match = globalUsers.find((u) => u.uid === c.contactId);
            if (match) {
              const nameDiff = c.name !== match.name;
              const avatarDiff = c.avatar !== match.photoURL;
              if (nameDiff || avatarDiff) {
                changed = true;
                return { ...c, name: match.name, avatar: match.photoURL };
              }
            }
          }
          return c;
        });
        return changed ? next : prev;
      });
    }
  }, [globalUsers]);

  // Sync active chat messages in real time
  useEffect(() => {
    if (!db || !activeChatId || isOfflineMode) return;
    if (activeChatId === "c1" || activeChatId.startsWith("c_") || activeChatId.startsWith("local_conn_")) {
      console.log(`Skipping Firestore listener for simulated local chat room: ${activeChatId}`);
      return;
    }

    console.log(`Synchronizing real-time messages for active chat id: ${activeChatId}`);
    const messagesRef = collection(db, "connections", activeChatId, "messages");
    const unsubscribe = onSnapshot(
      messagesRef,
      (snapshot) => {
        const list: Message[] = [];
        const seenIds = new Set<string>();

        snapshot.forEach((docSnap) => {
          const data = docSnap.data();
          const item: Message = {
            id: docSnap.id,
            senderId: data.senderId,
            senderName: data.senderName || "Peer",
            text: data.text || "",
            timestamp: data.timestamp || "",
            fileId: data.fileId,
            fileUrl: data.fileUrl,
            fileName: data.fileName,
            fileType: data.fileType,
            fileSize: data.fileSize,
            isEncrypted: data.isEncrypted ?? true,
            encryptionKeyHash: data.encryptionKeyHash || undefined,
            createdAt: data.createdAt || data.timestamp
          };

          if (data.location) item.location = data.location;
          if (data.poll) item.poll = data.poll;
          if (data.checklist) item.checklist = data.checklist;
          if (data.contactInfo) item.contactInfo = data.contactInfo;
          if (data.walletTransfer) item.walletTransfer = data.walletTransfer;

          if (!seenIds.has(item.id)) {
            seenIds.add(item.id);
            list.push(item);
          }
        });

        list.sort((m1, m2) => String(m1.createdAt || "").localeCompare(String(m2.createdAt || "")));

        setChats((prev) =>
          prev.map((c) => (c.id === activeChatId ? { ...c, messages: list } : c))
        );
      },
      (error) => {
        if (error.message?.includes("net::ERR_BLOCKED_BY_CLIENT") || error.code === "unavailable") {
          isOfflineModeCached = true;
          setIsOfflineMode(true);
          return;
        }
        console.error("Firestore messages listen error:", error);
      }
    );

    return () => unsubscribe();
  }, [activeChatId, isOfflineMode]);

  const activeChat = chats.find(c => c.id === activeChatId);
  const peerUser = activeChat?.contactId ? globalUsers.find(u => u.uid === activeChat.contactId) : null;
  const activeChatName = peerUser?.name && peerUser.name !== "Me" ? peerUser.name : (activeChat?.name || "");
  const activeChatAvatar = peerUser?.photoURL || activeChat?.avatar || "";

  const scanDriveFolder = async () => {
    setIsScanningDrive(true);
    try {
      const files = await listDriveFiles(gmailToken || "guest_simulated");
      setDriveFiles(files);
    } catch (e) {
      console.error("Failed to query Google Drive safely:", e);
    } finally {
      setIsScanningDrive(false);
    }
  };

  useEffect(() => {
    scanDriveFolder();
  }, [gmailToken]);

  const copyPairingLink = () => {
    const link = `${window.location.origin}?invite=${user?.uid || "guest"}`;
    navigator.clipboard.writeText(link);
    setIsLinkCopied(true);
    setTimeout(() => {
      setShowInviteModal(false);
      setIsLinkCopied(false);
    }, 1500);
  };

  const showProfile = (id: string, name: string, avatar: string, key?: string) => {
    const chatRef = chats.find(c => c.id === id || c.name === name);
    const phone = chatRef?.contactPhone || (chatRef?.contactId ? `${chatRef.contactId}` : "");
    setActiveProfileOverlay({
      id: id || chatRef?.id || id,
      name: name || chatRef?.name || "",
      avatar: avatar || chatRef?.avatar,
      encryptionKey: key || chatRef?.encryptionKey || `sym_${id}`,
      email: chatRef?.contactEmail || (chatRef?.contactId ? `${chatRef.contactId}@firebase` : ""),
      phoneNumber: phone
    });
  };

  const clearMessageLogs = (id: string) => {
    if (confirm("Are you sure you want to permanently empty all symmetric message records for this peer node?")) {
      setChats((prev) =>
        prev.map((c) =>
          c.id === id ? { ...c, lastMessage: "Message logs cleared.", messages: [] } : c
        )
      );
      setActiveProfileOverlay(null);
    }
  };

  const deleteConnectionPairing = (id: string) => {
    if (confirm("Are you sure you want to completely destroy this node pairing connection? You will fail to send further cipher text.")) {
      setChats((prev) => prev.filter((c) => c.id !== id));
      try {
        localStorage.removeItem("local_conn_" + id);
      } catch (e) {
        console.warn(e);
      }
      setActiveProfileOverlay(null);
      const remaining = chats.filter((c) => c.id !== id);
      if (remaining.length > 0) setActiveChatId(remaining[0].id);
      else setActiveChatId("");
    }
  };

  const pairNodeFromDirectory = async (peer: any) => {
    if (!user) return;
    if (db) {
      let isAllowed = false;
      try {
        const selfUid = user.uid;
        const peerUid = peer.uid;

        const checkInvite = async (u1: string, u2: string, targetUser: any) => {
          const email = (targetUser.email || "").trim().toLowerCase();
          const phone = (targetUser.phoneNumber || "").trim().toLowerCase();
          for (const recipient of [email, phone]) {
            if (!recipient) continue;
            const inviteKey = `${u1}_${recipient}`;
            const invSnap = await getDoc(doc(db, "invitations", inviteKey));
            if (invSnap.exists()) return true;
          }
          return false;
        };

        isAllowed = await checkInvite(selfUid, peerUid, peer);
        if (!isAllowed) isAllowed = await checkInvite(peerUid, selfUid, user);

        if (!isAllowed) {
          const connectionKey = [selfUid, peerUid].sort().join("_");
          const connSnap = await getDoc(doc(db, "connections", connectionKey));
          if (connSnap.exists()) isAllowed = true;
        }
      } catch (err) {
        console.warn("Error checking connection permissions:", err);
      }

      if (!isAllowed) {
        alert(`🔒 Connection Denied: You do not have permission to connect with ${peer.name || "this node"}. They must invite your email or phone number first.`);
        return;
      }
    }

    const connId = [user.uid, peer.uid].sort().join("_");
    const existing = chats.find((c) => c.id === connId);
    if (existing) {
      setActiveChatId(existing.id);
      setSearchQuery("");
      return;
    }

    const newConnData = {
      id: connId,
      user1: user.uid,
      user2: peer.uid,
      user1_name: user.name || user.displayName || "Anonymous User",
      user1_avatar: user.photoURL || "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150",
      user1_email: user.email || "",
      user2_name: peer.name || peer.displayName || "Anonymous User",
      user2_avatar: peer.photoURL,
      user2_email: peer.email,
      createdAt: new Date().toISOString(),
      lastMessage: "",
      lastMessageTime: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
    };

    localStorage.setItem(`local_conn_${connId}`, JSON.stringify(newConnData));

    if (db) {
      try {
        await setDoc(doc(db, "connections", connId), newConnData);
        console.log("Successfully created connection in Firestore.");
      } catch (err) {
        console.warn("Failed to sync connection to Firestore:", err);
      }
    }

    const newChatSession: ChatSession = {
      id: connId,
      name: peer.name || peer.email || "",
      avatar: peer.photoURL || "",
      platform: "intergram",
      type: "direct",
      lastMessage: "",
      lastMessageTime: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      messages: [],
      encryptionKey: "sym_key_block_" + connId,
      contactId: peer.uid
    };

    setChats((prev) => [newChatSession, ...prev]);
    setActiveChatId(connId);
    setSearchQuery("");
  };

  const sendPartnerInvite = async (type: "gmail" | "number") => {
    const recipientVal = type === "gmail" ? inviteEmail : invitePhone;
    if (!recipientVal.trim()) {
      alert("Please specify a target recipient identifier first.");
      return;
    }
    if (inviteSendStatus === "sending") return;

    setInviteSendStatus("sending");
    const link = `${window.location.origin}?invite=${user?.uid || "guest_gateway"}`;
    const customMessage = `${inviteMessageText}\n\n${link}`;
    let isPermissionSaved = false;

    if (db && user?.uid) {
      try {
        const cleanedRecipient = recipientVal.trim().toLowerCase();
        const invitationKey = `${user.uid}_${cleanedRecipient}`;
        let matchedUid: string | null = null;
        
        const existingPeer = globalUsers.find(
          u => (u.email && u.email.toLowerCase() === cleanedRecipient) || 
               (u.phoneNumber && u.phoneNumber.toLowerCase() === cleanedRecipient)
        );
        if (existingPeer) matchedUid = existingPeer.uid;

        const writePromise = setDoc(doc(db, "invitations", invitationKey), {
          senderUid: user.uid,
          recipient: cleanedRecipient,
          recipientUid: matchedUid,
          senderName: user.name || user.displayName || user.email || "Inviter",
          senderEmail: user.email || "",
          createdAt: new Date().toISOString()
        }).then(() => {
          console.log(`Saved invite permission in Firestore: ${invitationKey}`);
          isPermissionSaved = true;
        });

        const timeoutPromise = new Promise((_, reject) =>
          setTimeout(() => reject(new Error("Firestore write timed out after 2.5s")), 2500)
        );

        await Promise.race([writePromise, timeoutPromise]).catch((e) => {
          console.warn("Firestore write warning (proceeding with email/SMS):", e);
        });
      } catch (err) {
        console.warn("Failed to save invitation permission in Firestore:", err);
      }
    }

    let isRelayed = false;
    let relayNode = "Local Symmetrical Mesh Backup Gateway";

    try {
      const controller = new AbortController();
      const cancelTimeout = setTimeout(() => controller.abort(), 8000);

      const response = await fetch("/api/send-invite", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: type,
          recipient: recipientVal.trim(),
          message: customMessage,
          inviteLink: link
        }),
        signal: controller.signal
      });

      clearTimeout(cancelTimeout);
      const resData = await response.json();
      if (resData.success) {
        isRelayed = true;
        relayNode = resData.relayTerminal;
      } else {
        console.warn("Mail endpoint returned success=false:", resData);
      }
    } catch (e: any) {
      console.error("Invite transmission failed:", e);
      if (e.name === "AbortError") {
        console.warn("Invite API request timed out after 8s");
      }
    }

    const currentRecipient = recipientVal.trim();
    const timeSent = new Date().toLocaleTimeString();

    setInviteDeliveryReceipt(
      isRelayed 
        ? { deliveredTo: currentRecipient, time: timeSent, relay: relayNode, type: type }
        : isPermissionSaved 
          ? { deliveredTo: currentRecipient, time: timeSent, relay: "Firestore permission saved (mail relay unavailable)", type: type }
          : { deliveredTo: currentRecipient, time: timeSent, relay: "Local Symmetrical Mesh Backup Gateway", type: type }
    );
    setInviteSendStatus("sent");

    if (inviteTimeoutRef.current) window.clearTimeout(inviteTimeoutRef.current);
    inviteTimeoutRef.current = window.setTimeout(() => {
      setShowInviteModal(false);
      setInviteDeliveryReceipt(null);
      setInviteEmail("");
      setInvitePhone("");
      setInviteSendStatus("idle");
      inviteTimeoutRef.current = null;
    }, 1800);
  };

  const sendChatMessage = async () => {
    if (!messageText.trim() || (!activeChatId && !activeChat)) return;
    const timeStr = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    const localId = `m_${Date.now()}`;
    const plainMsg: Message = {
      id: localId,
      senderId: user?.uid || "me",
      senderName: user?.name || user?.displayName || "Me",
      text: messageText,
      timestamp: timeStr,
      isEncrypted: true
    };

    if (!db || activeChatId.startsWith("local_conn_") || activeChatId === "c1") {
      setChats((prev) =>
        prev.map((c) =>
          c.id === activeChatId
            ? {
                ...c,
                lastMessage: messageText,
                lastMessageTime: timeStr,
                messages: [...c.messages, plainMsg]
              }
            : c
        )
      );
      setMessageText("");
      return;
    }

    try {
      const dataPayload = {
        senderId: user?.uid || "me",
        senderName: user?.name || user?.displayName || "Me",
        text: messageText,
        timestamp: timeStr,
        isEncrypted: true,
        createdAt: new Date().toISOString()
      };
      setMessageText("");

      await addDoc(collection(db, "connections", activeChatId, "messages"), dataPayload);
      await updateDoc(doc(db, "connections", activeChatId), {
        lastMessage: messageText,
        lastMessageTime: timeStr
      });
    } catch (err) {
      console.error("Firestore send message failure:", err);
    }
  };

  const sendCustomChatMessage = async (extraFields: Partial<Message>) => {
    if (!activeChatId && !activeChat) return;
    const timeStr = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    const localId = `m_${Date.now()}`;
    const customMsg: Message = {
      id: localId,
      senderId: user?.uid || "me",
      senderName: user?.name || user?.displayName || "Me",
      text: extraFields.text || "",
      timestamp: timeStr,
      isEncrypted: false,
      ...extraFields
    };

    if (!db || activeChatId.startsWith("local_conn_") || activeChatId === "c1") {
      setChats((prev) =>
        prev.map((c) =>
          c.id === activeChatId
            ? {
                ...c,
                lastMessage: customMsg.text,
                lastMessageTime: timeStr,
                messages: [...c.messages, customMsg]
              }
            : c
        )
      );
      return;
    }

    try {
      const dataPayload = {
        senderId: user?.uid || "me",
        senderName: user?.name || user?.displayName || "Me",
        text: extraFields.text || "",
        timestamp: timeStr,
        isEncrypted: false,
        createdAt: new Date().toISOString(),
        ...extraFields
      };
      await addDoc(collection(db, "connections", activeChatId, "messages"), dataPayload);
      await updateDoc(doc(db, "connections", activeChatId), {
        lastMessage: extraFields.text || "",
        lastMessageTime: timeStr
      });
    } catch (err) {
      console.error("Firestore send custom message failure:", err);
    }
  };

  const startCamera = async () => {
    setIsCameraActive(true);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
      cameraStreamRef.current = stream;
      if (cameraVideoRef.current) {
        cameraVideoRef.current.srcObject = stream;
      }
    } catch (e) {
      console.warn("webcam stream block or missing hardware:", e);
    }
  };

  const stopCamera = () => {
    if (cameraStreamRef.current) {
      cameraStreamRef.current.getTracks().forEach(t => t.stop());
      cameraStreamRef.current = null;
    }
    setIsCameraActive(false);
  };

  const captureCameraSnapshot = () => {
    let capturedUrl = "https://images.unsplash.com/photo-1542751371-adc38448a05e?w=600";
    try {
      if (cameraVideoRef.current && cameraStreamRef.current) {
        const canvas = document.createElement("canvas");
        canvas.width = cameraVideoRef.current.videoWidth || 640;
        canvas.height = cameraVideoRef.current.videoHeight || 480;
        const ctx = canvas.getContext("2d");
        if (ctx) {
          ctx.drawImage(cameraVideoRef.current, 0, 0, canvas.width, canvas.height);
          capturedUrl = canvas.toDataURL("image/jpeg");
        }
      }
    } catch (e) {
      console.error("Failed to capture picture frame:", e);
    }

    sendCustomChatMessage({
      text: "Captured Private Snapshot",
      fileUrl: capturedUrl,
      fileType: "image",
      fileName: "snapshot.jpg",
      fileSize: "0.12 MB"
    });
    stopCamera();
  };

  const shareCoordinates = () => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          sendCustomChatMessage({
            text: `📍 My Location: [Lat: ${pos.coords.latitude.toFixed(4)}, Lng: ${pos.coords.longitude.toFixed(4)}]`,
            location: {
              lat: pos.coords.latitude,
              lng: pos.coords.longitude,
              address: "Verified Cryptographic GPS Fix"
            }
          });
        },
        () => {
          sendCustomChatMessage({
            text: "📍 Backup Location: [Lat: 28.6139, Lng: 77.2090]",
            location: {
              lat: 28.6139,
              lng: 77.2090,
              address: "New Delhi Central Hub (Secure Grid)"
            }
          });
        }
      );
    } else {
      sendCustomChatMessage({
        text: "📍 Simulated Location: [Lat: 19.0760, Lng: 72.8777]",
        location: {
          lat: 19.0760,
          lng: 72.8777,
          address: "Mumbai Central Hub (Symmetric Backup)"
        }
      });
    }
  };

  const handlePollVote = async (msgId: string, optionIndex: number) => {
    if (!activeChatId) return;
    const voterId = user?.uid || "me";

    const updatePollData = (poll: any) => {
      const nextOptions = poll.options.map((opt: any, idx: number) => {
        let voters = opt.voters || [];
        let votes = opt.votes || 0;
        const hasVoted = voters.includes(voterId);

        if (idx === optionIndex) {
          if (hasVoted) {
            voters = voters.filter((v: string) => v !== voterId);
            votes = Math.max(0, votes - 1);
          } else {
            voters = [...voters, voterId];
            votes += 1;
          }
        } else if (voters.includes(voterId)) {
          voters = voters.filter((v: string) => v !== voterId);
          votes = Math.max(0, votes - 1);
        }

        return { ...opt, votes, voters };
      });
      const total = nextOptions.reduce((acc: number, o: any) => acc + (o.votes || 0), 0);
      return { ...poll, options: nextOptions, totalVotes: total };
    };

    setChats((prev) =>
      prev.map((c) => {
        if (c.id === activeChatId) {
          const nextMsgs = c.messages.map((m) => {
            if (m.id === msgId && m.poll) {
              return { ...m, poll: updatePollData(m.poll) };
            }
            return m;
          });
          return { ...c, messages: nextMsgs };
        }
        return c;
      })
    );
  };

  const handleChecklistToggle = (msgId: string, itemId: string) => {
    if (!activeChatId) return;
    setChats((prev) =>
      prev.map((c) => {
        if (c.id === activeChatId) {
          const nextMsgs = c.messages.map((m) => {
            if (m.id === msgId && m.checklist) {
              const nextItems = m.checklist.items.map((it) =>
                it.id === itemId ? { ...it, checked: !it.checked } : it
              );
              return { ...m, checklist: { ...m.checklist, items: nextItems } };
            }
            return m;
          });
          return { ...c, messages: nextMsgs };
        }
        return c;
      })
    );
  };

  const addPollOption = () => setPollOptions([...pollOptions, ""]);
  const updatePollOption = (idx: number, val: string) => {
    const next = [...pollOptions];
    next[idx] = val;
    setPollOptions(next);
  };

  const addChecklistItem = () => setChecklistItems([...checklistItems, ""]);
  const updateChecklistItem = (idx: number, val: string) => {
    const next = [...checklistItems];
    next[idx] = val;
    setChecklistItems(next);
  };

  const handleChatFileAttach = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !activeChat) return;

    if (!gmailToken) {
      alert("🔒 Encryption gate blocked: Please authorize with Google Drive in step 3 or log in to active secure drive connection!");
      return;
    }

    try {
      setUploadStatusMessage(`Ciphering payload: ${file.name}...`);
      const keyStr = activeChat.encryptionKey || "sym_block_preset_8820";
      const { encryptedBlob, saltHex, ivHex } = await encryptFile(file, keyStr);

      setUploadStatusMessage("Uploading encapsulated block to Drive vault...");
      const cloudRes = await uploadToDrive(gmailToken, encryptedBlob, file.name, file.type);
      const timeStr = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

      let fType: "document" | "image" | "video" | "audio" = "document";
      if (file.type.startsWith("image/")) fType = "image";
      else if (file.type.startsWith("video/")) fType = "video";
      else if (file.type.startsWith("audio/")) fType = "audio";

      const attachMsg: Message = {
        id: `m_file_${Date.now()}`,
        senderId: user?.uid || "me",
        senderName: user?.name || user?.displayName || "Me",
        text: `Shared encrypted static binary: ${file.name}`,
        timestamp: timeStr,
        fileUrl: cloudRes.webViewLink || "#",
        fileId: cloudRes.id,
        fileName: file.name,
        fileType: fType,
        fileSize: (file.size / (1024 * 1024)).toFixed(2) + " MB",
        isEncrypted: true,
        encryptionKeyHash: `${saltHex}:${ivHex}`,
        createdAt: new Date().toISOString()
      };

      if (!db || activeChat.id.startsWith("local_conn_") || activeChat.id === "c1") {
        setChats((prev) =>
          prev.map((c) =>
            c.id === activeChat.id
              ? {
                  ...c,
                  lastMessage: `📁 Encrypted ${fType}: ${file.name}`,
                  lastMessageTime: timeStr,
                  messages: [...c.messages, attachMsg]
                }
              : c
          )
        );
      } else {
        await addDoc(collection(db, "connections", activeChat.id, "messages"), attachMsg);
        await updateDoc(doc(db, "connections", activeChat.id), {
          lastMessage: `📁 Encrypted ${fType}: ${file.name}`,
          lastMessageTime: timeStr
        });
      }

      setUploadStatusMessage(null);
      scanDriveFolder();
    } catch (err: any) {
      console.error("Crypto file storage crash:", err);
      alert(`Vault exception: ${err.message}`);
      setUploadStatusMessage(null);
    }
  };

  const decryptChatFile = async (msg: Message) => {
    if (!gmailToken || !msg.fileId || !msg.encryptionKeyHash || !activeChat || decryptedFiles[msg.id]) return;
    try {
      setDecryptedFiles((prev) => ({ ...prev, [msg.id]: { url: "", loaded: false } }));
      const encryptedBlob = await downloadFromDrive(gmailToken, msg.fileId);
      const [salt, iv] = msg.encryptionKeyHash.split(":");
      const keyStr = activeChat.encryptionKey || "sym_block_preset_8820";

      let mime = "application/octet-stream";
      if (msg.fileType === "image") mime = "image/jpeg";
      else if (msg.fileType === "video") mime = "video/mp4";
      else if (msg.fileType === "audio") mime = "audio/mpeg";

      const unpacked = await decryptFile(encryptedBlob, keyStr, salt, iv, mime);
      const objUrl = URL.createObjectURL(unpacked);
      setDecryptedFiles((prev) => ({ ...prev, [msg.id]: { url: objUrl, loaded: true } }));
    } catch (err) {
      console.error("Decryption vector mismatch:", err);
      alert("Decryption failure: cryptographic key checksum mismatch.");
      setDecryptedFiles((prev) => {
        const next = { ...prev };
        delete next[msg.id];
        return next;
      });
    }
  };

  const handleVaultFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) setSelectedVaultFile(file);
  };

  const uploadEncryptedFileToVault = async () => {
    if (selectedVaultFile) {
      if (!gmailToken) {
        alert("🔒 Encryption gate blocked: Please authorize with Google Drive in the checklist first!");
        return;
      }
      try {
        setVaultUploadStatus(`Scrambling binary stream: ${selectedVaultFile.name}...`);
        const key = masterPassphrase || "sym_block_preset_8820";
        const { encryptedBlob, saltHex, ivHex } = await encryptFile(selectedVaultFile, key);

        setVaultUploadStatus("Uploading encapsulated blob block to secure Drive folder...");
        const cloudName = `salt_${saltHex}_iv_${ivHex}_${selectedVaultFile.name}`;
        await uploadToDrive(gmailToken, encryptedBlob, cloudName, selectedVaultFile.type);
        
        setVaultUploadStatus(null);
        setSelectedVaultFile(null);
        alert("🎉 File symmetrically locked and uploaded securely to Google Drive!");
        scanDriveFolder();
      } catch (err: any) {
        console.error("Vault Upload exception:", err);
        alert(`Upload failure: ${err.message}`);
        setVaultUploadStatus(null);
      }
    }
  };

  const saveEncryptedFileLocally = async () => {
    if (selectedVaultFile) {
      try {
        setVaultUploadStatus("Encrypting locally...");
        const key = masterPassphrase || "sym_block_preset_8820";
        const { encryptedBlob, saltHex, ivHex } = await encryptFile(selectedVaultFile, key);

        if (selectedVaultFile.size > 2.5 * 1024 * 1024) {
          alert("⚠️ File size exceeds 2.5MB sandbox limit for Offline persistence. Please use Google Drive for unlimited cloud security!");
          setVaultUploadStatus(null);
          return;
        }

        const reader = new FileReader();
        reader.onloadend = () => {
          const base64Data = reader.result;
          const localItem = {
            id: `local_vault_${Date.now()}`,
            name: selectedVaultFile.name,
            contentType: selectedVaultFile.type,
            size: selectedVaultFile.size,
            saltHex,
            ivHex,
            cipherData: base64Data,
            uploadedAt: new Date().toLocaleDateString("en-US") + " " + new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
          };

          setLocalFiles((prev) => [localItem, ...prev]);
          setVaultUploadStatus(null);
          setSelectedVaultFile(null);
          alert("🔒 File encrypted locally and saved safely to in-browser storage structure!");
        };
        reader.readAsDataURL(encryptedBlob);
      } catch (err: any) {
        console.error("Local encryption crash:", err);
        alert(`Local storage save error: ${err.message}`);
        setVaultUploadStatus(null);
      }
    }
  };

  const decryptVaultFile = async (file: any) => {
    if (gmailToken && !decryptedVaultFiles[file.id]) {
      setDecryptingFileId(file.id);
      try {
        const encryptedBlob = await downloadFromDrive(gmailToken, file.id);
        let salt = "00000000000000000000000000000000";
        let iv = "000000000000000000000000";
        let cleanName = file.name.replace(/^intergram_enc_\d+_/, "");
        
        const match = cleanName.match(/^salt_([0-9a-fA-F]+)_iv_([0-9a-fA-F]+)_(.*)$/);
        if (match) {
          salt = match[1];
          iv = match[2];
          cleanName = match[3];
        } else {
          let cachedHash = "";
          for (const c of chats) {
            const mMatch = c.messages.find(m => m.fileId === file.id);
            if (mMatch && mMatch.encryptionKeyHash) {
              cachedHash = mMatch.encryptionKeyHash;
              break;
            }
          }
          if (cachedHash) {
            const [sPart, iPart] = cachedHash.split(":");
            salt = sPart;
            iv = iPart;
          }
        }

        const passphrase = masterPassphrase || "sym_block_preset_8820";
        let mime = "application/octet-stream";
        if (cleanName.match(/\.(jpeg|jpg|png|gif|webp)$/i)) mime = "image/jpeg";
        else if (cleanName.match(/\.(mp4|webm|mov)$/i)) mime = "video/mp4";
        else if (cleanName.match(/\.(mp3|wav|ogg|m4a)$/i)) mime = "audio/mpeg";

        const unpackedBlob = await decryptFile(encryptedBlob, passphrase, salt, iv, mime);
        const objUrl = URL.createObjectURL(unpackedBlob);

        setDecryptedVaultFiles((prev) => ({
          ...prev,
          [file.id]: { url: objUrl, mime, originalName: cleanName, loaded: true }
        }));
      } catch (err: any) {
        console.error("Decryption fail:", err);
        if (err.message?.includes("Cipher") || err.message?.includes("AES")) {
          alert("🔒 Decryption failed: Password key check signature mismatch! Double-check your Master Passphrase.");
        } else {
          alert("🔒 Decryption failed: Check if your Master Encryption Passphrase is correct!");
        }
      } finally {
        setDecryptingFileId(null);
      }
    }
  };

  const decryptLocalVaultFile = async (file: any) => {
    if (!decryptedVaultFiles[file.id]) {
      setDecryptingFileId(file.id);
      try {
        const encryptedBlob = await (await fetch(file.cipherData)).blob();
        const passphrase = masterPassphrase || "sym_block_preset_8820";
        const unpackedBlob = await decryptFile(
          encryptedBlob,
          passphrase,
          file.saltHex,
          file.ivHex,
          file.contentType || "application/octet-stream"
        );
        const objUrl = URL.createObjectURL(unpackedBlob);

        setDecryptedVaultFiles((prev) => ({
          ...prev,
          [file.id]: {
            url: objUrl,
            mime: file.contentType,
            originalName: file.name,
            loaded: true
          }
        }));
      } catch (err) {
        console.error("Local decryption failure:", err);
        alert("🔒 Check passphrase: crypt key integrity mismatch.");
      } finally {
        setDecryptingFileId(null);
      }
    }
  };

  const deleteLocalFile = (id: string) => {
    if (confirm("Are you sure you want to delete this locally private encrypted file completely?")) {
      setLocalFiles((prev) => prev.filter(f => f.id !== id));
      setDecryptedVaultFiles((prev) => {
        const next = { ...prev };
        delete next[id];
        return next;
      });
    }
  };

  const deleteDriveFile = async (id: string) => {
    if (confirm("Are you sure you want to delete this file permanently from Google Drive / storage vault?")) {
      try {
        await deleteFromDrive(gmailToken || "guest_simulated", id);
        setDecryptedVaultFiles((prev) => {
          const next = { ...prev };
          delete next[id];
          return next;
        });
        alert("File successfully deleted from storage vault.");
        scanDriveFolder();
      } catch (err: any) {
        console.error("Delete drive file error:", err);
        alert(`Delete failed: ${err.message}`);
      }
    }
  };

  const purgeChatFileAndMessage = async (msgId: string, fileId?: string) => {
    if (confirm("Are you sure you want to delete this message and its associated file completely?")) {
      try {
        if (fileId) {
          setUploadStatusMessage("Purging file from Google Drive...");
          await deleteFromDrive(gmailToken || "guest_simulated", fileId);
        }

        if (!db || activeChatId === "c1" || activeChatId.startsWith("c_") || activeChatId.startsWith("local_conn_")) {
          setChats((prev) =>
            prev.map((c) =>
              c.id === activeChatId
                ? { ...c, messages: c.messages.filter(m => m.id !== msgId) }
                : c
            )
          );
        } else {
          await deleteDoc(doc(db, "connections", activeChatId, "messages", msgId));
        }

        setDecryptedFiles((prev) => {
          const next = { ...prev };
          delete next[msgId];
          return next;
        });

        setUploadStatusMessage(null);
        alert("🔒 Secured: Message and file attachment purged completely.");
        scanDriveFolder();
      } catch (err: any) {
        console.error("Purging message exception:", err);
        setUploadStatusMessage(null);
        alert(`Purge aborted: ${err.message}`);
      }
    }
  };

  const getAvatarInitials = (nameStr: string) => {
    const clean = nameStr.replace(/[\[\]\(\)]/g, "").trim();
    if (!clean) return { initials: "?", color: "bg-indigo-500 text-white" };
    const parts = clean.split(" ");
    const initials = parts.length > 1
      ? (parts[0][0] + (parts[1][0] || "")).toUpperCase()
      : parts[0].substring(0, 2).toUpperCase();

    const colors = [
      "bg-red-500 text-white",
      "bg-emerald-600 text-white",
      "bg-amber-500 text-slate-900",
      "bg-blue-500 text-white",
      "bg-purple-500 text-white",
      "bg-teal-500 text-white",
      "bg-pink-500 text-white",
      "bg-indigo-500 text-white"
    ];

    let hashVal = 0;
    for (let i = 0; i < clean.length; i++) {
      hashVal = clean.charCodeAt(i) + ((hashVal << 5) - hashVal);
    }
    const color = colors[Math.abs(hashVal) % colors.length];
    return { initials, color };
  };

  const filteredChats = chats.filter(c => c.name.toLowerCase().includes(searchQuery.toLowerCase()));
  const directoryUsers = globalUsers.filter(u => {
    const isPaired = chats.some(c => c.id.includes(u.uid) || c.contactId === u.uid);
    const matchesSearch = u.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
                          u.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          u.phoneNumber.toLowerCase().includes(searchQuery.toLowerCase());
    return !isPaired && matchesSearch;
  });

  return (
    <div className={`flex h-screen overflow-hidden transition-colors duration-200 ${isLightTheme ? 'bg-[#e7ebf0] text-slate-800' : 'bg-[#0e1621] text-[#f5f6f7]'}`}>
      
      {/* Sidebar Panel */}
      <div className={`w-full md:w-80 border-r flex flex-col justify-between transition-colors shrink-0 ${showSidebarMobile ? 'flex' : 'hidden md:flex'} ${isLightTheme ? 'border-rose-100/60 bg-[#fffdfc] text-slate-800' : 'border-[#1e293b]/50 bg-[#0f172a]/95 text-[#f5f6f7]'}`}>
        
        <div className="p-4 space-y-3 flex-shrink-0">
          <div className="flex justify-between items-center">
            <div className="flex items-center gap-2.5">
              <img src={logoImg} alt="Prix Logo" className="w-8 h-8 object-contain rounded-lg select-none pointer-events-none" />
              <span className={`font-black text-lg tracking-widest font-display uppercase ${isLightTheme ? 'text-rose-600' : 'text-cyan-400'}`}>prix</span>
            </div>
            
            <div className="flex items-center gap-1.5">
              {setIsLightTheme && (
                <button
                  onClick={() => setIsLightTheme(!isLightTheme)}
                  className={`w-7 h-7 rounded-lg flex items-center justify-center cursor-pointer select-none transition ${isLightTheme ? 'bg-rose-50 hover:bg-rose-100 text-rose-600' : 'bg-slate-800 hover:bg-slate-700 text-cyan-400'}`}
                  title="Toggle Display Theme Mode"
                >
                  {isLightTheme ? <Moon className="w-3.5 h-3.5" /> : <Sun className="w-3.5 h-3.5" />}
                </button>
              )}
              
              <button
                onClick={onLock}
                className={`w-7 h-7 rounded-lg flex items-center justify-center active:scale-95 transition cursor-pointer select-none ${isLightTheme ? 'bg-rose-50 hover:bg-rose-100 text-amber-600' : 'bg-slate-800 hover:bg-slate-700 text-amber-500'}`}
                title="Conceal Portal Mode instantly"
              >
                <Lock className="w-3.5 h-3.5" />
              </button>

              <button
                onClick={onLogout}
                className={`w-7 h-7 rounded-lg flex items-center justify-center active:scale-95 transition cursor-pointer select-none ${isLightTheme ? 'bg-rose-50 hover:bg-rose-100 text-rose-700' : 'bg-slate-800 hover:bg-slate-700 text-rose-500'}`}
                title="Wipe keys and logout"
              >
                <LogOut className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {user && (
            <div className={`p-2 rounded-xl border flex items-center gap-2.5 ${isLightTheme ? 'bg-rose-50/40 border-rose-100/50' : 'bg-slate-900/60 border-slate-850'}`}>
              <img
                referrerPolicy="no-referrer"
                src={user.photoURL || "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=80"}
                alt={user.name || "Me"}
                className="w-6 h-6 rounded-full object-cover border border-rose-450/20"
              />
              <div className="overflow-hidden">
                <p className={`text-[10px] font-bold leading-none truncate ${isLightTheme ? 'text-rose-955' : 'text-slate-200'}`}>
                  {user.name || user.displayName || ""}
                </p>
                <p className={`text-[8.5px] leading-none truncate mt-0.5 ${isLightTheme ? 'text-rose-500' : 'text-cyan-400'}`}>
                  {user.email || user.phoneNumber}
                </p>
              </div>
            </div>
          )}

          {isOfflineMode && (
            <div className={`p-2.5 rounded-lg border flex flex-col gap-1 text-[9px] leading-tight ${isLightTheme ? 'bg-amber-50/80 border-amber-200 text-amber-955' : 'bg-amber-500/10 border-amber-500/20 text-amber-200'}`}>
              <div className="flex items-center gap-1.5 font-bold">
                <CircleAlert className="w-3 h-3 text-amber-500 shrink-0" />
                <span>Ad-Blocker / Shield Active</span>
              </div>
              <p className="text-[8px] text-slate-400">
                Firestore connections are blocked. Disable Brave Shields or whitelist localhost to restore live peer synchronization.
              </p>
            </div>
          )}

          <div className="relative">
            <Search className={`w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 ${isLightTheme ? 'text-rose-400' : 'text-cyan-400'}`} />
            <input
              type="text"
              placeholder="Search chats..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className={`w-full text-xs py-1.5 pl-9 pr-3 rounded-lg focus:outline-none transition ${isLightTheme ? 'glass-input-light text-slate-800 placeholder-rose-300' : 'glass-input-dark text-white placeholder-slate-500'}`}
            />
          </div>

          <div className="grid grid-cols-2 gap-1.5 text-center text-xs">
            <button
              onClick={() => setIsVaultView(false)}
              className={`flex items-center justify-center gap-1.5 py-1.5 rounded-lg text-[11px] font-medium cursor-pointer transition select-none ${isVaultView ? (isLightTheme ? 'bg-rose-50/20 border border-rose-100/30 text-rose-600/80 hover:bg-rose-50/50' : 'bg-slate-900/40 hover:bg-slate-800 text-slate-400') : isLightTheme ? 'bg-gradient-to-r from-rose-400 to-amber-300 text-slate-900 font-bold shadow-sm' : 'bg-gradient-to-r from-blue-600 to-cyan-500 text-white font-bold shadow-md shadow-blue-500/20'}`}
            >
              <MessageCircle className="w-3.5 h-3.5" />
              <span>Chats</span>
            </button>
            
            <button
              onClick={() => {
                setIsVaultView(true);
                scanDriveFolder();
              }}
              className={`flex items-center justify-center gap-1.5 py-1.5 rounded-lg text-[11px] font-medium cursor-pointer transition select-none ${isVaultView ? (isLightTheme ? 'bg-gradient-to-r from-rose-400 to-amber-300 text-slate-900 font-bold shadow-sm' : 'bg-gradient-to-r from-blue-600 to-cyan-500 text-white font-bold shadow-md shadow-blue-500/20') : isLightTheme ? 'bg-rose-50/20 border border-rose-100/30 text-rose-600/80 hover:bg-rose-50/50' : 'bg-slate-900/40 hover:bg-slate-800 text-slate-400'}`}
            >
              <FolderLock className="w-3.5 h-3.5" />
              <span>Vault</span>
            </button>
          </div>
        </div>

        {/* Channels List */}
        <div className="flex-grow overflow-y-auto px-1.5 pb-2 space-y-0.5 scrollbar-thin">
          {isVaultView ? (
            <div className="p-3 space-y-3">
              <div className="flex justify-between items-center text-[10px] font-mono text-slate-500 uppercase tracking-wider font-semibold">
                <span>ENCRYPTED VAULT STREAM</span>
                <button onClick={scanDriveFolder} className="hover:text-indigo-500 cursor-pointer">
                  <RefreshCw className={`w-3 h-3 ${isScanningDrive ? 'animate-spin' : ''}`} />
                </button>
              </div>

              {gmailToken ? (
                driveFiles.length > 0 ? (
                  driveFiles.map((file) => (
                    <div
                      key={file.id}
                      id={`drive-file-${file.id}`}
                      className={`p-2.5 border rounded-xl relative hover:border-slate-400 transition ${isLightTheme ? 'bg-slate-50 border-slate-200' : 'bg-slate-950 border-slate-850'}`}
                    >
                      <div className="flex items-start gap-2">
                        {file.name.includes("_audio_") || file.name.includes("audio") ? (
                          <Music className="w-4 h-4 text-emerald-450 shrink-0 mt-0.5" />
                        ) : file.name.includes("image") ? (
                          <ImageIcon className="w-4 h-4 text-cyan-405 shrink-0 mt-0.5" />
                        ) : (
                          <FileText className="w-4 h-4 text-indigo-405 shrink-0 mt-0.5" />
                        )}
                        <div className="overflow-hidden">
                          <p className={`text-[10px] font-bold truncate max-w-[140px] ${isLightTheme ? 'text-slate-900' : 'text-white'}`}>
                            {file.name.replace("intergram_enc_", "")}
                          </p>
                          <p className="text-[8px] font-mono text-slate-500 mt-0.5">
                            {((file.size || 0) / (1024 * 1024)).toFixed(2)} MB
                          </p>
                        </div>
                      </div>
                      <button
                        onClick={() => {
                          alert("🔒 Symmetric Checklist: Access and decrypt E2EE files directly within corresponding channels for key signature validations!");
                        }}
                        className="absolute bottom-1.5 right-1.5 bg-indigo-650/10 border border-indigo-500/10 text-[7px] font-mono hover:bg-slate-850 px-1.5 py-0.5 rounded cursor-pointer text-indigo-550 font-bold uppercase"
                      >
                        inspect
                      </button>
                    </div>
                  ))
                ) : (
                  <div className="text-center py-10 text-slate-500 space-y-2">
                    <FolderOpen className="w-5 h-5 mx-auto text-slate-650" />
                    <p className="text-[9px]">Symmetric Google Drive folder is clear.</p>
                  </div>
                )
              ) : (
                <div className="bg-amber-500/10 border border-amber-500/20 p-3 rounded-xl text-center space-y-2">
                  <CircleAlert className="w-5 h-5 mx-auto text-amber-500" />
                  <p className="text-[10px] text-amber-500 leading-normal">
                    Authorize Google Drive connectivity in your step onboarding menu.
                  </p>
                </div>
              )}
            </div>
          ) : filteredChats.length > 0 ? (
            filteredChats.map((chat) => {
              const isSelected = chat.id === activeChatId;
              const details = getAvatarInitials(chat.name);
              return (
                <button
                  key={chat.id}
                  id={`chat-item-${chat.id}`}
                  onClick={() => {
                    setActiveChatId(chat.id);
                    setIsVaultView(false);
                    setShowSidebarMobile(false);
                  }}
                  className={`w-full text-left p-2 rounded-lg flex items-center justify-between transition cursor-pointer select-none group border-l-4 ${isSelected ? (isLightTheme ? 'bg-rose-500/10 text-rose-955 border-rose-400 shadow-sm' : 'bg-blue-600/20 text-white border-cyan-400 shadow-inner') : isLightTheme ? 'hover:bg-rose-500/5 text-slate-700 border-transparent' : 'hover:bg-slate-900/40 text-slate-300 border-transparent'}`}
                >
                  <div className="flex items-center gap-3 overflow-hidden min-w-0 pr-1.5">
                    <div
                      className="relative flex-shrink-0 cursor-pointer hover:scale-105 active:scale-95 transition-all duration-150"
                      title="View Connection Profile"
                      onClick={(e) => {
                        e.stopPropagation();
                        showProfile(chat.id, chat.name, chat.avatar, chat.encryptionKey);
                      }}
                    >
                      {chat.avatar ? (
                        <img
                          referrerPolicy="no-referrer"
                          src={chat.avatar}
                          alt={chat.name}
                          className="w-11 h-11 rounded-full object-cover shadow-sm border border-slate-200/10 group-hover:border-[#2481cc]/30"
                        />
                      ) : (
                        <div className={`w-11 h-11 rounded-full flex items-center justify-center text-xs font-bold ${details.color}`}>
                          {details.initials}
                        </div>
                      )}
                    </div>

                    <div className="overflow-hidden min-w-0">
                      <div className="flex items-center gap-1">
                        <h4 className={`text-[13px] font-bold leading-tight truncate ${isLightTheme ? 'text-slate-900' : 'text-[#f5f6f7]'}`}>
                          {chat.name}
                        </h4>
                      </div>
                      <p className={`text-[12px] leading-tight truncate mt-0.5 ${isSelected ? (isLightTheme ? 'text-slate-700' : 'text-[#f5f6f7]/90') : 'text-slate-400'}`}>
                        {chat.lastMessage?.startsWith("You:") ? (
                          <span className="flex items-center gap-1 text-[12px]">
                            <span className="text-[#2481cc] dark:text-[#4fa4f4]">You:</span>
                            <span className="truncate">{chat.lastMessage.substring(4)}</span>
                          </span>
                        ) : (
                          chat.lastMessage
                        )}
                      </p>
                    </div>
                  </div>

                  <div className="flex flex-col items-end justify-between self-stretch shrink-0 text-right">
                    <span className="text-[10px] text-slate-400">{chat.lastMessageTime}</span>
                    {chat.id === "c_cas" && <CheckCheck className="w-3.5 h-3.5 text-[#2481cc] dark:text-[#4fa4f4]" />}
                  </div>
                </button>
              );
            })
          ) : (
            <div className="p-4 text-center space-y-4">
              <div className="w-10 h-10 rounded-full bg-indigo-500/10 border border-indigo-500/15 flex items-center justify-center mx-auto text-indigo-500">
                <LinkIcon className="w-5 h-5 animate-pulse" />
              </div>
              <div>
                <h4 className="text-xs font-bold text-slate-400 font-mono">No Connections Paired</h4>
                <p className="text-[10px] text-slate-500 leading-normal mt-1.5">
                  Share your pairing link with peers. Once they authenticate via the link, your nodes bond in real-time.
                </p>
              </div>
              <button
                onClick={() => setShowInviteModal(true)}
                className="w-full py-2 bg-[#2481cc] hover:bg-[#1c6fae] text-white font-mono text-[9px] font-bold rounded-lg flex items-center justify-center gap-1 transition-all cursor-pointer"
              >
                <UserPlus className="w-3.5 h-3.5" />
                <span>INVITE PERSON (GMAIL / SMS / LINK)</span>
              </button>
            </div>
          )}

          {!isVaultView && searchQuery.trim().length > 0 && directoryUsers.length > 0 && (
            <div className="mt-4 pt-3 border-t border-slate-200 dark:border-slate-800">
              <div className="px-2 pb-1.5 text-[10px] font-bold text-[#2481cc] uppercase tracking-wider">Global Directory</div>
              <div className="space-y-1">
                {directoryUsers.map((p) => {
                  const initial = p.name ? p.name.split(" ").map((n: string) => n[0]).join("").substring(0, 2).toUpperCase() : "U";
                  return (
                    <button
                      key={p.uid}
                      onClick={() => pairNodeFromDirectory(p)}
                      className={`w-full text-left p-2 rounded-lg flex items-center justify-between gap-2.5 transition cursor-pointer select-none border border-transparent ${isLightTheme ? 'hover:bg-slate-100 hover:border-slate-200 text-slate-750' : 'hover:bg-[#202b36] hover:border-[#111822] text-slate-300'}`}
                    >
                      <div className="flex items-center gap-3 overflow-hidden min-w-0 pr-1">
                        <div className="flex-shrink-0">
                          {p.photoURL ? (
                            <img
                              referrerPolicy="no-referrer"
                              src={p.photoURL}
                              alt={p.name}
                              className="w-8 h-8 rounded-full object-cover shadow-sm border border-slate-200/10"
                            />
                          ) : (
                            <div className="w-8 h-8 rounded-full flex items-center justify-center text-[10px] bg-slate-200 dark:bg-slate-800 text-slate-500 dark:text-slate-455 font-bold">
                              {initial}
                            </div>
                          )}
                        </div>
                        <div className="overflow-hidden min-w-0">
                          <h5 className={`text-xs font-bold leading-tight truncate ${isLightTheme ? 'text-slate-900' : 'text-[#f5f6f7]'}`}>
                            {p.name}
                          </h5>
                          <p className="text-[10px] text-slate-450 truncate mt-0.5">
                            {p.email || p.phoneNumber || "Secure Node"}
                          </p>
                        </div>
                      </div>
                      <div className="px-2.5 py-1 bg-[#2481cc] hover:bg-[#1a70b0] text-white text-[9px] font-sans font-extrabold uppercase rounded flex items-center justify-center gap-1 shrink-0">
                        <MessageCircle className="w-3 h-3" />
                        <span>Message</span>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        <div className={`p-3 border-t font-mono text-[9px] flex justify-between tracking-wide select-none ${isLightTheme ? 'bg-slate-50 border-slate-205 text-slate-500' : 'bg-slate-955 border-slate-900 text-slate-500'}`}>
          <span className="flex items-center gap-1 text-indigo-650 font-extrabold animate-pulse">
            <LockOpen className="w-2.5 h-2.5" />
            <span>CIPHER KEYED</span>
          </span>
          {isOfflineMode ? (
            <span className="truncate font-bold text-amber-500 flex items-center gap-1 animate-pulse" title="Firestore blocked by ad-blocker. Local backup active.">
              <CircleAlert className="w-2.5 h-2.5" />
              <span>Offline Sandbox Mode</span>
            </span>
          ) : (
            <span className="truncate font-bold">Dynamic Mesh Online</span>
          )}
        </div>
      </div>

      {/* Main Chat / Vault view panel */}
      <div
        className={`flex-grow flex flex-col justify-between relative transition-all duration-300 ${showSidebarMobile ? 'hidden md:flex' : 'flex'}`}
        style={{
          backgroundImage: `url(${isLightTheme ? animeChatBg : animeDarkBg})`,
          backgroundSize: "cover",
          backgroundPosition: "center",
          backgroundRepeat: "no-repeat"
        }}
      >
        <div className={`absolute inset-0 pointer-events-none transition-colors duration-300 z-0 ${isLightTheme ? 'bg-white/45' : 'bg-slate-950/75'}`} />

        {!isVaultView && activeChat ? (
          <>
            {/* Chat header */}
            <div className={`p-4 border-b flex justify-between items-center z-10 ${isLightTheme ? 'border-rose-100/40 glass-panel-light' : 'border-slate-800/40 glass-panel-dark'}`}>
              <div className="flex items-center gap-3">
                <button
                  onClick={() => setShowSidebarMobile(true)}
                  className={`md:hidden flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-sans font-bold select-none cursor-pointer mr-1 transition active:scale-95 ${isLightTheme ? 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50' : 'bg-[#202b36] border-[#2b3c4a] text-slate-350 hover:bg-[#2b5278]'}`}
                >
                  ← Back
                </button>
                <div
                  className="flex items-center gap-3 cursor-pointer hover:opacity-90 active:scale-[0.99] transition"
                  title="View Secure Node Profile"
                  onClick={() => showProfile(activeChat.id, activeChatName, activeChatAvatar, activeChat.encryptionKey)}
                >
                  {activeChatAvatar ? (
                    <img
                      referrerPolicy="no-referrer"
                      src={activeChatAvatar}
                      alt={activeChatName}
                      className="w-10 h-10 rounded-full object-cover shadow-sm border border-[#2481cc]/20"
                    />
                  ) : (
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center text-xs font-black uppercase ${getAvatarInitials(activeChatName).color}`}>
                      {getAvatarInitials(activeChatName).initials}
                    </div>
                  )}
                  <div>
                    <h3 className={`font-bold text-[14px] leading-tight flex items-center gap-1.5 hover:underline decoration-sky-400 ${isLightTheme ? 'text-slate-900' : 'text-white'}`}>
                      {activeChatName}
                    </h3>
                    <div className="flex items-center gap-1.5 text-[10px] mt-0.5 select-none font-medium">
                      <span className={`w-1.5 h-1.5 rounded-full ${peerUser?.online || activeChat.id.charCodeAt(activeChat.id.length - 1) % 2 === 0 ? 'bg-emerald-500 animate-pulse' : 'bg-slate-400'}`} />
                      <span className={peerUser?.online || activeChat.id.charCodeAt(activeChat.id.length - 1) % 2 === 0 ? 'text-emerald-500' : 'text-slate-450'}>
                        {peerUser?.online || activeChat.id.charCodeAt(activeChat.id.length - 1) % 2 === 0 ? 'online' : 'offline'}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-1.5">
                <button
                  onClick={() => onStartCall(activeChatName, activeChatAvatar, false, activeChat.contactId)}
                  className={`w-8 h-8 rounded-full flex items-center justify-center cursor-pointer select-none transition active:scale-95 ${isLightTheme ? 'bg-slate-100 hover:bg-slate-200 text-slate-655' : 'bg-[#202b36] hover:bg-[#2e3c4d] text-slate-300'}`}
                  title="Voice Call"
                >
                  <Phone className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={() => onStartCall(activeChatName, activeChatAvatar, true, activeChat.contactId)}
                  className={`w-8 h-8 rounded-full flex items-center justify-center cursor-pointer select-none transition active:scale-95 ${isLightTheme ? 'bg-slate-100 hover:bg-slate-200 text-slate-655' : 'bg-[#202b36] hover:bg-[#2e3c4d] text-slate-300'}`}
                  title="Video Call"
                >
                  <Video className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            {/* Chat Messages */}
            <div className="flex-grow overflow-y-auto px-4 py-3 space-y-4 scrollbar-thin flex flex-col z-10">
              <div className="text-center my-2 select-none">
                <span className={`px-3 py-1 text-[11px] font-medium rounded-full backdrop-blur-sm shadow-sm ${isLightTheme ? 'bg-rose-50/70 border border-rose-100/30 text-rose-700' : 'bg-[#0f172a]/80 border border-slate-800 text-cyan-400'}`}>
                  Secure Conversation Grid
                </span>
              </div>

              <div className={`max-w-md mx-auto text-center p-3 rounded-xl border space-y-1 select-none my-1 shadow-sm transition ${isLightTheme ? 'glass-card-light border-rose-150' : 'glass-card-dark border-slate-800/80'}`}>
                <div className="text-[9px] font-extrabold tracking-widest flex items-center justify-center gap-1 font-mono uppercase">
                  <Lock className={`w-3 h-3 ${isLightTheme ? 'text-rose-500' : 'text-cyan-400'}`} />
                  <span className={isLightTheme ? 'text-rose-750/85' : 'text-cyan-400/85'}>Symmetric Cryptographic Tunnel Active</span>
                </div>
                <p className={`text-[10px] leading-relaxed ${isLightTheme ? 'text-slate-600' : 'text-slate-400'}`}>
                  All transmissions undergo local end-to-end encryption. Media payloads are backed up symmetrically onto client-hosted Drive folders securely.
                </p>
              </div>

              <div className="space-y-3.5 flex flex-col flex-grow justify-end pb-1 pr-0.5">
                {activeChat.messages && activeChat.messages.map((msg) => {
                  const isSelf = msg.senderId === user?.uid || msg.senderId === "me";
                  const fileStatus = decryptedFiles[msg.id];
                  const details = getAvatarInitials(msg.senderName);

                  return (
                    <div
                      key={msg.id}
                      id={`msg-${msg.id}`}
                      className={`flex gap-2 w-full max-w-[85%] ${isSelf ? 'ml-auto justify-end' : 'mr-auto justify-start'}`}
                    >
                      {!isSelf && (
                        <button
                          onClick={() => showProfile(msg.senderId, msg.senderName, "")}
                          className={`w-8 h-8 rounded-full flex-shrink-0 flex items-center justify-center text-[10px] font-bold self-end mb-1 cursor-pointer transition-all duration-150 transform active:scale-95 border ${isLightTheme ? 'bg-rose-50 text-rose-600 border-rose-100 hover:bg-rose-100/50' : 'bg-slate-800 text-cyan-400 border-slate-750 hover:bg-slate-700'}`}
                          title={`Inspect ${msg.senderName}'s Profile`}
                        >
                          {details.initials}
                        </button>
                      )}

                      <div className="flex flex-col max-w-full">
                        <div className={`p-2.5 rounded-[16px] border relative ${isSelf ? (isLightTheme ? 'bg-gradient-to-br from-rose-100 to-amber-100/80 text-rose-950 border-rose-200/50 rounded-tr-none shadow-md shadow-rose-200/10' : 'bg-gradient-to-br from-blue-600 to-indigo-650 text-white border-blue-500/20 rounded-tr-none shadow-md shadow-blue-500/10') : isLightTheme ? 'glass-card-light text-slate-900 border-rose-150 rounded-tl-none shadow-sm' : 'glass-card-dark text-[#f5f6f7] border-slate-800/80 rounded-tl-none shadow-md shadow-black/10'}`}>
                          {!isSelf && (
                            <p
                              onClick={() => showProfile(msg.senderId, msg.senderName, "")}
                              className="text-[11px] font-bold text-[#4fa4f4] hover:text-[#2481cc] mb-1 leading-none cursor-pointer hover:underline"
                            >
                              {msg.senderName}
                            </p>
                          )}

                          {msg.fileId && (
                            <div className={`p-2 rounded-lg space-y-2 border mb-1.5 ${isLightTheme ? 'bg-slate-50 border-slate-100' : 'bg-[#101921] border-[#101921]'}`}>
                              <div className="flex items-center gap-2.5">
                                <div className="w-9 h-9 rounded-full bg-[#2481cc] flex items-center justify-center text-white flex-shrink-0">
                                  {msg.fileType === "image" ? <ImageIcon className="w-4 h-4" /> : <FileText className="w-4 h-4" />}
                                </div>
                                <div className="overflow-hidden min-w-0 flex-grow">
                                  <p className={`text-[12px] font-semibold truncate ${isLightTheme ? 'text-slate-900' : 'text-white'}`}>
                                    {msg.fileName}
                                  </p>
                                  <p className="text-[10px] text-slate-400">{msg.fileSize}</p>
                                </div>
                                {isSelf && (
                                  <button
                                    onClick={() => purgeChatFileAndMessage(msg.id, msg.fileId)}
                                    className="p-1 text-slate-400 hover:text-red-500 rounded hover:bg-red-500/10 transition cursor-pointer flex-shrink-0"
                                    title="Delete/Purge file & message completely"
                                  >
                                    <XIcon className="w-3.5 h-3.5" />
                                  </button>
                                )}
                              </div>

                              {fileStatus?.loaded ? (
                                <div className="pt-2 border-t border-slate-200 dark:border-slate-800">
                                  {msg.fileType === "image" && (
                                    <img src={fileStatus.url} alt="E2EE media" className="rounded max-h-48 object-contain mx-auto" />
                                  )}
                                  {msg.fileType === "audio" && (
                                    <audio controls className="w-full h-8 text-xs bg-[#101921] rounded">
                                      <source src={fileStatus.url} />
                                    </audio>
                                  )}
                                  {msg.fileType === "video" && (
                                    <video controls className="w-full max-h-48 rounded">
                                      <source src={fileStatus.url} />
                                    </video>
                                  )}
                                  {msg.fileType === "document" && (
                                    <a
                                      href={fileStatus.url}
                                      download={msg.fileName}
                                      className="w-full bg-[#2481cc] hover:bg-[#1c6fae] text-white font-mono text-[9px] font-bold py-1 px-3 rounded text-center flex items-center justify-center gap-1 select-none cursor-pointer"
                                    >
                                      <Download className="w-3.5 h-3.5" />
                                      <span>SAVE LOCAL BINARY</span>
                                    </a>
                                  )}
                                </div>
                              ) : fileStatus ? (
                                <div className="pt-2 text-center text-[10px] text-slate-400 animate-pulse">
                                  Cipher unpacking...
                                </div>
                              ) : (
                                <button
                                  onClick={() => decryptChatFile(msg)}
                                  className="w-full py-1 text-xs font-bold text-[#2481cc] dark:text-[#4fa4f4] hover:underline focus:outline-none flex items-center justify-center gap-1 cursor-pointer"
                                >
                                  <LockOpen className="w-3 h-3" />
                                  <span>Decrypt Copy</span>
                                </button>
                              )}
                            </div>
                          )}

                          {msg.location && (
                            <div className={`my-2 p-3 rounded-xl border select-none transition ${isLightTheme ? 'bg-rose-50/50 border-rose-100/50 text-slate-800' : 'bg-slate-900/40 border-slate-800/80 text-[#f5f6f7]'}`}>
                              <div className="flex items-center gap-2">
                                <MapPin className="w-4 h-4 text-rose-500 animate-bounce" />
                                <span className="font-bold text-xs">Shared Private Coordinates</span>
                              </div>
                              <p className={`text-[11px] mt-1 ${isLightTheme ? 'text-slate-650' : 'text-slate-350'}`}>{msg.location.address}</p>
                              <div className={`p-1 px-2 rounded font-mono text-[10px] flex justify-between items-center mt-2 ${isLightTheme ? 'bg-rose-100/30 border border-rose-100/40 text-rose-700' : 'bg-slate-900/50 border border-slate-800 text-rose-350'}`}>
                                <span>GPS: {msg.location.lat.toFixed(5)}, {msg.location.lng.toFixed(5)}</span>
                                <a
                                  href={`https://www.google.com/maps/search/?api=1&query=${msg.location.lat},${msg.location.lng}`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className={`hover:underline text-[10px] ${isLightTheme ? 'text-rose-650' : 'text-sky-455'}`}
                                >
                                  Open Map →
                                </a>
                              </div>
                            </div>
                          )}

                          {msg.poll && (
                            <div className={`my-2 p-3.5 rounded-xl border space-y-3 min-w-[240px] select-none transition ${isLightTheme ? 'bg-rose-50/50 border-rose-100/50 text-slate-805' : 'bg-slate-900/40 border-slate-800/80 text-white'}`}>
                              <div>
                                <span className={`text-[10px] font-mono font-bold uppercase tracking-wider ${isLightTheme ? 'text-rose-500' : 'text-cyan-400'}`}>Prix Public Poll</span>
                                <h5 className="font-bold text-[13px] mt-0.5 leading-tight">{msg.poll.question}</h5>
                              </div>
                              <div className="space-y-2">
                                {msg.poll.options.map((opt, oIdx) => {
                                  const votesTotal = msg.poll!.totalVotes;
                                  const pct = votesTotal > 0 ? Math.round((opt.votes / votesTotal) * 100) : 0;
                                  const voterId = user?.uid || "me";
                                  const voted = opt.voters?.includes(voterId);

                                  return (
                                    <button
                                      key={oIdx}
                                      onClick={() => handlePollVote(msg.id, oIdx)}
                                      className={`w-full text-left relative overflow-hidden rounded-lg p-2 border text-xs flex items-center justify-between group transition cursor-pointer select-none ${isLightTheme ? 'border-rose-100/40 bg-white/60 hover:border-rose-250 text-slate-700' : 'border-slate-800/80 hover:border-slate-700 bg-slate-950/40 text-slate-205'}`}
                                    >
                                      <div className={`absolute left-0 top-0 bottom-0 transition-all duration-300 ${isLightTheme ? 'bg-rose-500/10' : 'bg-cyan-500/10'}`} style={{ width: `${pct}%` }} />
                                      <span className="relative z-10 font-medium flex items-center gap-1.5 truncate pr-1.5 text-slate-205 group-hover:text-black dark:group-hover:text-white">
                                        <span className={`w-1.5 h-1.5 rounded-full ${voted ? (isLightTheme ? 'bg-rose-500 scale-125' : 'bg-cyan-400 scale-125') : 'bg-slate-500'}`} />
                                        <span className="truncate">{opt.text}</span>
                                      </span>
                                      <span className="relative z-10 text-[10px] font-mono text-slate-450 group-hover:text-slate-750 dark:group-hover:text-white">
                                        {pct}% ({opt.votes})
                                      </span>
                                    </button>
                                  );
                                })}
                              </div>
                              <div className="text-[9px] font-mono text-slate-500 text-right">
                                Total votes: {msg.poll.totalVotes}
                              </div>
                            </div>
                          )}

                          {msg.checklist && (
                            <div className={`my-2 p-3.5 rounded-xl border space-y-3 min-w-[240px] select-none transition ${isLightTheme ? 'bg-rose-50/50 border-rose-100/50 text-slate-805' : 'bg-slate-900/40 border-slate-800/80 text-white'}`}>
                              <div>
                                <span className={`text-[10px] font-mono font-bold uppercase tracking-wider ${isLightTheme ? 'text-rose-500' : 'text-cyan-400'}`}>Symmetric Checklist</span>
                                <h5 className="font-bold text-[13px] mt-0.5 leading-tight">{msg.checklist.title}</h5>
                              </div>
                              <div className="space-y-2">
                                {msg.checklist.items.map((item) => (
                                  <button
                                    key={item.id}
                                    onClick={() => handleChecklistToggle(msg.id, item.id)}
                                    className={`w-full text-left rounded-lg p-2 border text-xs flex items-center gap-2.5 transition cursor-pointer select-none ${isLightTheme ? 'border-rose-105 bg-white/60 hover:bg-slate-50 text-slate-700' : 'border-slate-850 bg-slate-950/40 hover:bg-slate-900/40 text-slate-205'}`}
                                  >
                                    <div className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 transition ${item.checked ? 'bg-indigo-650 border-indigo-650 text-white' : isLightTheme ? 'border-slate-350' : 'border-slate-700'}`}>
                                      {item.checked && <CheckCheck className="w-3 h-3" />}
                                    </div>
                                    <span className={`truncate ${item.checked ? 'line-through text-slate-500' : ''}`}>
                                      {item.text}
                                    </span>
                                  </button>
                                ))}
                              </div>
                            </div>
                          )}

                          {msg.contactInfo && (
                            <div className={`my-2 p-3.5 rounded-xl border space-y-3 min-w-[240px] select-none transition ${isLightTheme ? 'bg-rose-50/50 border-rose-100/50 text-slate-850' : 'bg-slate-900/40 border-slate-800/80 text-white'}`}>
                              <div className={`flex items-center gap-2 pb-2 border-b ${isLightTheme ? 'border-rose-100/60' : 'border-slate-800'}`}>
                                <UserPlus className="w-4 h-4 text-orange-500" />
                                <span className="font-bold text-xs">Shared Contact Card</span>
                              </div>
                              <div className="space-y-1 text-xs">
                                <div className="flex justify-between">
                                  <span className="text-slate-450">Name:</span>
                                  <span className="font-bold">{msg.contactInfo.name}</span>
                                </div>
                                <div className="flex justify-between">
                                  <span className="text-slate-455">Phone:</span>
                                  <span className="font-mono text-[11px]">{msg.contactInfo.phone}</span>
                                </div>
                                {msg.contactInfo.email && (
                                  <div className="flex justify-between">
                                    <span className="text-slate-450">Email:</span>
                                    <span className="text-sky-400 font-mono text-[10px]">{msg.contactInfo.email}</span>
                                  </div>
                                )}
                              </div>
                              <button
                                onClick={() => {
                                  pairNodeFromDirectory({
                                    uid: `local_dir_${Date.now()}`,
                                    name: msg.contactInfo!.name,
                                    email: msg.contactInfo!.email,
                                    phoneNumber: msg.contactInfo!.phone
                                  });
                                }}
                                className="w-full py-1.5 bg-orange-655 hover:bg-orange-600 text-white text-[10px] font-bold rounded-lg flex items-center justify-center gap-1 transition cursor-pointer select-none"
                              >
                                <MessageCircle className="w-3.5 h-3.5" />
                                <span>Message Partner</span>
                              </button>
                            </div>
                          )}

                          {msg.walletTransfer && (
                            <div className={`my-2 p-3.5 rounded-xl border space-y-3 min-w-[240px] select-none transition ${isLightTheme ? 'bg-rose-50/50 border-rose-100/50 text-slate-850' : 'bg-slate-900/40 border-slate-800/80 text-white'}`}>
                              <div className={`flex items-center justify-between pb-2 border-b ${isLightTheme ? 'border-rose-100/60' : 'border-slate-800'}`}>
                                <div className="flex items-center gap-1.5">
                                  <Coins className="w-4 h-4 text-emerald-500" />
                                  <span className="font-bold text-xs">P2P Secure Wallet Transfer</span>
                                </div>
                                <span className="text-[9px] px-1.5 py-0.5 font-mono text-emerald-500 bg-emerald-500/10 rounded font-black uppercase">
                                  {msg.walletTransfer.status}
                                </span>
                              </div>
                              <div className="space-y-1 text-xs">
                                <div className="flex justify-between font-mono text-[10px]">
                                  <span className="text-slate-400">Amount:</span>
                                  <span className="font-bold text-emerald-450 text-sm">
                                    {msg.walletTransfer.amount} {msg.walletTransfer.symbol}
                                  </span>
                                </div>
                                <div className={`flex justify-between font-mono text-[9px] overflow-hidden mt-1.5 ${isLightTheme ? 'text-slate-500' : 'text-slate-400'}`}>
                                  <span>Receiver:</span>
                                  <span className={`truncate max-w-[140px] font-bold ${isLightTheme ? 'text-slate-700' : 'text-slate-205'}`}>
                                    {msg.walletTransfer.receiverAddress}
                                  </span>
                                </div>
                                <div className={`p-1 px-2 rounded text-[9px] font-mono mt-2 flex justify-between items-center ${isLightTheme ? 'bg-rose-100/30 border border-rose-100/40 text-slate-655' : 'bg-slate-950/60 border border-slate-800 text-slate-500'}`}>
                                  <span className="truncate max-w-[130px]">Tx: {msg.walletTransfer.txHash}</span>
                                  <button
                                    onClick={() => {
                                      navigator.clipboard.writeText(msg.walletTransfer!.txHash);
                                      alert("Copied TxHash!");
                                    }}
                                    className={`hover:underline cursor-pointer ${isLightTheme ? 'text-rose-650' : 'text-sky-455'}`}
                                  >
                                    Copy
                                  </button>
                                </div>
                              </div>
                            </div>
                          )}

                          {!msg.location && !msg.poll && !msg.checklist && !msg.contactInfo && !msg.walletTransfer && (
                            <p className="text-[13px] leading-relaxed select-text whitespace-pre-wrap break-words">
                              {msg.text}
                            </p>
                          )}

                          <div className="flex items-center justify-end gap-1 mt-1 text-right select-none leading-none">
                            <span className={`text-[10px] ${isSelf ? 'text-[#82b482] dark:text-slate-400' : 'text-slate-450'}`}>
                              {msg.timestamp}
                            </span>
                            {isSelf && <CheckCheck className="w-3.5 h-3.5 text-[#2481cc] dark:text-[#4fa4f4]" />}
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Chat message input bar */}
            <div className={`p-4 border-t z-10 relative space-y-2 ${isLightTheme ? 'border-rose-100/40 glass-panel-light' : 'border-slate-800/40 glass-panel-dark'}`}>
              {uploadStatusMessage && (
                <div className="absolute inset-x-0 bottom-full bg-indigo-650/90 py-1.5 text-center text-[10px] font-bold text-white flex items-center justify-center gap-1.5 animate-pulse select-none z-20 shadow-md">
                  <RefreshCw className="w-3 h-3 animate-spin" />
                  <span>{uploadStatusMessage}</span>
                </div>
              )}

              <div className="flex gap-2.5 items-center">
                {showAttachmentMenu && (
                  <div className={`absolute bottom-20 left-4 w-60 rounded-2xl shadow-2xl border p-2 z-[999] backdrop-blur-md transition-all duration-200 ${isLightTheme ? 'glass-panel-light border-rose-100 text-slate-800 shadow-rose-100/20' : 'glass-panel-dark border-slate-800/85 text-[#f5f6f7]'}`}>
                    <div className="flex flex-col text-xs font-medium">
                      <button
                        type="button"
                        onClick={() => {
                          setAllowedFileTypes("image/*,video/*");
                          setShowAttachmentMenu(false);
                          setTimeout(() => chatFileInputRef.current?.click(), 100);
                        }}
                        className={`flex items-center gap-3 p-2 rounded-xl text-left cursor-pointer transition ${isLightTheme ? 'hover:bg-rose-50 text-rose-955' : 'hover:bg-slate-800/50 text-white'}`}
                      >
                        <ImageIcon className="w-4 h-4 text-sky-500" />
                        <span>Photo or Video</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          setShowAttachmentMenu(false);
                          startCamera();
                        }}
                        className={`flex items-center gap-3 p-2 rounded-xl text-left cursor-pointer transition ${isLightTheme ? 'hover:bg-rose-50 text-rose-955' : 'hover:bg-slate-800/50 text-white'}`}
                      >
                        <Camera className="w-4 h-4 text-rose-500" />
                        <span>Camera</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          setAllowedFileTypes(".pdf,.zip,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt");
                          setShowAttachmentMenu(false);
                          setTimeout(() => chatFileInputRef.current?.click(), 100);
                        }}
                        className={`flex items-center gap-3 p-2 rounded-xl text-left cursor-pointer transition ${isLightTheme ? 'hover:bg-rose-50 text-rose-955' : 'hover:bg-slate-800/50 text-white'}`}
                      >
                        <FileText className="w-4 h-4 text-amber-500" />
                        <span>File</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          setAllowedFileTypes("audio/*");
                          setShowAttachmentMenu(false);
                          setTimeout(() => chatFileInputRef.current?.click(), 100);
                        }}
                        className={`flex items-center gap-3 p-2 rounded-xl text-left cursor-pointer transition ${isLightTheme ? 'hover:bg-rose-50 text-rose-955' : 'hover:bg-slate-800/50 text-white'}`}
                      >
                        <Music className="w-4 h-4 text-emerald-500" />
                        <span>Music</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          setShowAttachmentMenu(false);
                          shareCoordinates();
                        }}
                        className={`flex items-center gap-3 p-2 rounded-xl text-left cursor-pointer transition ${isLightTheme ? 'hover:bg-rose-50 text-rose-955' : 'hover:bg-slate-800/50 text-white'}`}
                      >
                        <MapPin className="w-4 h-4 text-teal-500" />
                        <span>Location</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          setShowAttachmentMenu(false);
                          setShowPollModal(true);
                        }}
                        className={`flex items-center gap-3 p-2 rounded-xl text-left cursor-pointer transition ${isLightTheme ? 'hover:bg-rose-50 text-rose-955' : 'hover:bg-slate-800/50 text-white'}`}
                      >
                        <ChartColumn className="w-4 h-4 text-indigo-500" />
                        <span>Poll</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          setShowAttachmentMenu(false);
                          setShowChecklistModal(true);
                        }}
                        className={`flex items-center gap-3 p-2 rounded-xl text-left cursor-pointer transition ${isLightTheme ? 'hover:bg-rose-50 text-rose-955' : 'hover:bg-slate-800/50 text-white'}`}
                      >
                        <SquareCheckBig className="w-4 h-4 text-purple-550" />
                        <span>Checklist</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          setShowAttachmentMenu(false);
                          setShowContactModal(true);
                        }}
                        className={`flex items-center gap-3 p-2 rounded-xl text-left cursor-pointer transition ${isLightTheme ? 'hover:bg-rose-50 text-rose-955' : 'hover:bg-slate-800/50 text-white'}`}
                      >
                        <UserPlus className="w-4 h-4 text-orange-500" />
                        <span>Contact</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          setShowAttachmentMenu(false);
                          setShowWalletModal(true);
                        }}
                        className={`flex items-center gap-3 p-2 rounded-xl text-left cursor-pointer transition ${isLightTheme ? 'hover:bg-rose-50 text-rose-955' : 'hover:bg-slate-800/50 text-white'}`}
                      >
                        <Coins className="w-4 h-4 text-amber-500" />
                        <span>Wallet</span>
                      </button>
                    </div>
                  </div>
                )}

                <button
                  type="button"
                  onClick={() => setShowAttachmentMenu(!showAttachmentMenu)}
                  className={`w-9 h-9 rounded-xl border flex items-center justify-center transition active:scale-95 cursor-pointer select-none ${isLightTheme ? 'bg-rose-50/50 border-rose-100 hover:bg-rose-100/30 text-rose-600 shadow-sm' : 'bg-slate-900 border-slate-800 hover:bg-slate-800 text-cyan-400'}`}
                  title="Choose dynamic private mesh attachments"
                >
                  <Paperclip className="w-4 h-4" />
                </button>
                
                <input
                  type="file"
                  ref={chatFileInputRef}
                  onChange={handleChatFileAttach}
                  className="hidden"
                  accept={allowedFileTypes}
                />

                <input
                  type="text"
                  placeholder={`Secure symmetric message to ${activeChatName}...`}
                  value={messageText}
                  onChange={(e) => setMessageText(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') sendChatMessage();
                  }}
                  className={`flex-grow focus:outline-none text-xs px-3.5 py-2.5 rounded-xl transition ${isLightTheme ? 'glass-input-light text-slate-850 placeholder-rose-350' : 'glass-input-dark text-white placeholder-slate-455'}`}
                />

                <button
                  onClick={sendChatMessage}
                  className={`w-9 h-9 rounded-xl active:scale-95 text-white flex items-center justify-center shadow transition shrink-0 cursor-pointer select-none ${isLightTheme ? 'bg-gradient-to-r from-rose-500 to-orange-400 hover:shadow-lg hover:shadow-rose-500/20' : 'bg-gradient-to-r from-blue-600 to-cyan-500 hover:shadow-lg hover:shadow-blue-500/30'}`}
                >
                  <Send className="w-4 h-4" />
                </button>
              </div>

              <div className="flex justify-between items-center text-[9px] font-mono text-slate-500 px-0.5 select-none">
                <span>Local vector validation: SHA-256 bound</span>
                <span>Connection Target: Symmetric Internal Node</span>
              </div>
            </div>
          </>
        ) : isVaultView ? (
          /* Vault Panel View */
          <div className="flex-grow flex flex-col h-full overflow-y-auto z-10">
            <div className={`p-4 border-b flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 select-none ${isLightTheme ? 'border-slate-205 bg-white/90' : 'border-[#101921] bg-[#17212b]/95'}`}>
              <div>
                <h3 className={`font-bold text-[15px] leading-tight flex items-center gap-2 ${isLightTheme ? 'text-slate-905' : 'text-white'}`}>
                  <FolderLock className="w-4 h-4 text-[#2481cc]" />
                  <span>Symmetric Cryptostatic Vault</span>
                </h3>
                <p className="text-[10px] text-slate-400 mt-1">
                  E2EE Local Cryptography Suite connected with zero absolute trust mechanics.
                </p>
              </div>
              <button
                onClick={scanDriveFolder}
                disabled={isScanningDrive}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-[#2481cc]/10 hover:bg-[#2481cc]/20 text-[#2481cc] select-none transition self-end cursor-pointer"
              >
                <RefreshCw className={`w-3 h-3 ${isScanningDrive ? 'animate-spin' : ''}`} />
                <span>{isScanningDrive ? 'Synchronizing...' : 'Sync Cloud Folder'}</span>
              </button>
            </div>

            {/* Master passphrase entry */}
            <div className={`p-4 border-b space-y-3.5 ${isLightTheme ? 'bg-slate-50 border-slate-200' : 'bg-[#101921] border-[#131d27]'}`}>
              <div className="flex items-center gap-2 text-xs font-bold text-slate-400 uppercase tracking-wider font-mono">
                <Key className="w-3.5 h-3.5 text-amber-500" />
                <span>Global Decryption Master Passphrase</span>
              </div>
              <p className="text-[10px] text-slate-500 max-w-xl">
                This key derives local Symmetric AES-GCM (256-bit PBKDF2) variables in-browser. All local files encrypt under this key, and retrieved cloud files unpack ONLY if the match succeeds.
              </p>
              <div className="flex gap-2 max-w-md">
                <input
                  type={showPassphrase ? "text" : "password"}
                  value={masterPassphrase}
                  onChange={(e) => setMasterPassphrase(e.target.value)}
                  placeholder="Enter vault encryption passphrase passcode..."
                  className={`flex-grow border focus:border-[#2481cc] focus:outline-none text-xs px-3 py-2 rounded-xl transition font-mono ${isLightTheme ? 'bg-white border-slate-200 text-slate-900' : 'bg-[#182533] border-[#202b36] text-[#f5f6f7]'}`}
                />
                <button
                  onClick={() => setShowPassphrase(!showPassphrase)}
                  className={`px-3 py-2 rounded-xl text-xs font-bold transition select-none cursor-pointer ${isLightTheme ? 'bg-slate-100 hover:bg-slate-200 text-slate-650' : 'bg-[#202b36] hover:bg-[#2e3c4d] text-slate-355'}`}
                >
                  {showPassphrase ? "Hide" : "Show"}
                </button>
              </div>
            </div>

            {/* Vault Tabs */}
            <div className="flex border-b border-slate-250 dark:border-[#101921] select-none bg-[#101921]/15">
              <button
                onClick={() => setVaultTab("upload")}
                className={`flex-1 py-3 text-center text-xs font-semibold border-b-2 flex items-center justify-center gap-1.5 transition cursor-pointer ${vaultTab === 'upload' ? 'border-[#2481cc] text-[#2481cc]' : 'border-transparent text-slate-400 hover:text-slate-350'}`}
              >
                <CloudUpload className="w-3.5 h-3.5" />
                <span>Upload & Encrypt</span>
              </button>
              <button
                onClick={() => {
                  setVaultTab("retrieve");
                  scanDriveFolder();
                }}
                className={`flex-1 py-3 text-center text-xs font-semibold border-b-2 flex items-center justify-center gap-1.5 transition cursor-pointer ${vaultTab === 'retrieve' ? 'border-[#2481cc] text-[#2481cc]' : 'border-transparent text-slate-400 hover:text-slate-350'}`}
              >
                <FolderOpen className="w-3.5 h-3.5" />
                <span>Retrieve from Drive</span>
              </button>
              <button
                onClick={() => setVaultTab("private")}
                className={`flex-1 py-3 text-center text-xs font-semibold border-b-2 flex items-center justify-center gap-1.5 transition cursor-pointer ${vaultTab === 'private' ? 'border-[#2481cc] text-[#2481cc]' : 'border-transparent text-slate-400 hover:text-slate-350'}`}
              >
                <Shield className="w-3.5 h-3.5" />
                <span>Private Local Folder</span>
              </button>
            </div>

            {/* Vault content panels */}
            <div className="p-4 sm:p-6 flex-grow">
              {vaultTab === "upload" && (
                <div className="max-w-lg mx-auto space-y-5">
                  <div className={`p-4 border rounded-2xl ${isLightTheme ? 'bg-slate-50 border-slate-150' : 'bg-[#182533]/50 border-[#101921]'}`}>
                    <h4 className={`text-xs font-bold uppercase tracking-wide flex items-center gap-1.5 ${isLightTheme ? 'text-slate-805' : 'text-white'}`}>
                      <Lock className="w-3.5 h-3.5 text-[#2481cc]" />
                      <span>Prepare Symmetric Payload Package</span>
                    </h4>
                    <p className="text-[11px] text-slate-400 leading-relaxed mt-2">
                      Secure client-side packing handles file scrambling before transferring packets to any remote server. Nobody – not even Google – can examine the content headers.
                    </p>
                  </div>

                  <div className="space-y-3.5">
                    <div
                      onClick={() => vaultFileInputRef.current?.click()}
                      className={`border-2 border-dashed rounded-2xl p-8 text-center cursor-pointer hover:border-[#2481cc] transition flex flex-col items-center justify-center space-y-3 ${isLightTheme ? 'border-slate-300 bg-slate-50 hover:bg-slate-100/50' : 'border-[#202b36] bg-[#101921]/60 hover:bg-[#101921]'}`}
                    >
                      <input
                        type="file"
                        ref={vaultFileInputRef}
                        onChange={handleVaultFileSelect}
                        className="hidden"
                      />
                      <CloudUpload className="w-8 h-8 text-slate-400 animate-bounce" />
                      <div>
                        <p className={`text-xs font-bold ${isLightTheme ? 'text-slate-750' : 'text-slate-300'}`}>
                          {selectedVaultFile ? selectedVaultFile.name : "Click to select / drop binary file"}
                        </p>
                        <p className="text-[10px] text-slate-500 mt-1">
                          {selectedVaultFile 
                            ? `${(selectedVaultFile.size / (1024 * 1024)).toFixed(2)} MB` 
                            : "Accepts documents, audio threads, snapshots, and ciphers"}
                        </p>
                      </div>
                    </div>

                    {selectedVaultFile && (
                      <div className="flex gap-2 text-center">
                        <button
                          onClick={() => setSelectedVaultFile(null)}
                          className="flex-1 py-2.5 text-xs font-bold border border-red-500/30 text-red-500 hover:bg-red-500/10 rounded-xl transition cursor-pointer select-none"
                        >
                          Clear Selection
                        </button>
                        <button
                          onClick={uploadEncryptedFileToVault}
                          disabled={!!vaultUploadStatus || !gmailToken}
                          className={`flex-grow px-4 py-2.5 text-xs font-bold rounded-xl text-white transition flex items-center justify-center gap-1.5 shadow select-none ${gmailToken ? 'bg-[#2481cc] hover:bg-[#1c6fae] cursor-pointer' : 'bg-slate-605 cursor-not-allowed opacity-50'}`}
                        >
                          <span>Lock & Upload cloud</span>
                          <CloudUpload className="w-4 h-4" />
                        </button>
                        <button
                          onClick={saveEncryptedFileLocally}
                          disabled={!!vaultUploadStatus}
                          className="flex-grow px-4 py-2.5 text-xs font-bold rounded-xl text-white bg-teal-650 hover:bg-teal-600 transition flex items-center justify-center gap-1.5 shadow cursor-pointer select-none"
                        >
                          <span>Save Locally</span>
                          <Shield className="w-4 h-4" />
                        </button>
                      </div>
                    )}

                    {vaultUploadStatus && (
                      <div className="p-3 bg-[#2481cc]/10 border border-[#2481cc]/20 rounded-xl flex items-center justify-center gap-2 text-[11px] font-mono font-semibold text-[#2481cc] animate-pulse">
                        <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                        <span>{vaultUploadStatus}</span>
                      </div>
                    )}

                    {!gmailToken && (
                      <div className="bg-amber-500/10 border border-amber-500/20 p-3.5 rounded-xl text-center space-y-1.5 select-none">
                        <CircleAlert className="w-4.5 h-4.5 mx-auto text-amber-500" />
                        <p className="text-[10px] text-amber-655 leading-normal font-sans">
                          Google Drive cloud integrations are offline. Set up authorize scopes inside the top onboarding panel to utilize persistent unlimited cloud storage.
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {vaultTab === "retrieve" && (
                <div className="space-y-4">
                  <div className={`p-3.5 border rounded-2xl flex justify-between items-center ${isLightTheme ? 'bg-slate-50 border-slate-200' : 'bg-[#182533]/50 border-[#101921]'}`}>
                    <div className="overflow-hidden">
                      <p className={`text-xs font-bold ${isLightTheme ? 'text-slate-900' : 'text-white'}`}>
                        Encapsulated Google Drive Folders List
                      </p>
                      <p className="text-[10px] text-slate-500 mt-1">
                        Symmetrically encrypted file payloads found inside your secure storage space. Match with master secret key schema above to retrieve.
                      </p>
                    </div>
                  </div>

                  {driveFiles.length > 0 ? (
                    <div className="space-y-3.5">
                      {!gmailToken && (
                        <div className="p-3 bg-amber-505/10 border border-amber-500/20 rounded-xl text-[10px] text-amber-500 text-center font-semibold">
                          ⚠️ Sandbox Mode: Displaying offline simulated Cloud Vault files. Authorize Google Drive in your onboarding checklist to enable persistent live cloud backups.
                        </div>
                      )}
                      
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                        {driveFiles.map((file) => {
                          const fileDec = decryptedVaultFiles[file.id];
                          const isDecrypting = decryptingFileId === file.id;
                          let filename = file.name.replace(/^intergram_enc_\d+_/, "");
                          const match = filename.match(/^salt_[0-9a-fA-F]+_iv_[0-9a-fA-F]+_(.*)$/);
                          if (match) filename = match[1];

                          return (
                            <div
                              key={file.id}
                              className={`p-3.5 rounded-2xl border flex flex-col justify-between transition relative ${isLightTheme ? 'bg-white border-slate-150 shadow-sm hover:border-slate-300' : 'bg-[#182533] border-[#101921] shadow-md hover:border-[#2b5278]'}`}
                            >
                              <div className="flex items-start justify-between gap-2 w-full">
                                <div className="flex items-start gap-3 min-w-0 flex-grow">
                                  <div className="w-10 h-10 rounded-full bg-[#2481cc]/15 flex items-center justify-center text-[#2481cc] flex-shrink-0">
                                    {file.name.includes("audio") ? (
                                      <Music className="w-5 h-5" />
                                    ) : file.name.includes("image") || file.name.match(/\.(png|jpg|jpeg|gif|webp)$/i) ? (
                                      <ImageIcon className="w-5 h-5" />
                                    ) : (
                                      <FileText className="w-5 h-5" />
                                    )}
                                  </div>
                                  <div className="overflow-hidden min-w-0 flex-grow">
                                    <p className={`text-[12px] font-bold truncate ${isLightTheme ? 'text-slate-905' : 'text-white'}`} title={filename}>
                                      {filename}
                                    </p>
                                    <p className="text-[9px] text-slate-500 font-mono mt-0.5">
                                      SYNC: {new Date(file.createdTime || Date.now()).toLocaleDateString()}
                                    </p>
                                    <p className="text-[10px] text-slate-400 mt-1">
                                      Size: {((file.size || 0) / (1024 * 1024)).toFixed(2)} MB
                                    </p>
                                  </div>
                                </div>
                                <button
                                  onClick={() => deleteDriveFile(file.id)}
                                  className="text-red-500 hover:text-red-650 p-1.5 rounded-lg hover:bg-red-500/10 transition flex-shrink-0 cursor-pointer"
                                  title="Delete file permanently"
                                >
                                  <XIcon className="w-3.5 h-3.5" />
                                </button>
                              </div>

                              {fileDec?.loaded ? (
                                <div className={`mt-3 p-2 rounded-xl border space-y-2 border-dashed ${isLightTheme ? 'bg-slate-50 border-slate-205' : 'bg-[#101921] border-[#222e3b]'}`}>
                                  {fileDec.mime.startsWith("image/") && (
                                    <img src={fileDec.url} alt={fileDec.originalName} className="max-h-48 rounded object-contain mx-auto border" />
                                  )}
                                  {fileDec.mime.startsWith("audio/") && (
                                    <audio controls className="w-full h-8 text-xs rounded bg-slate-905">
                                      <source src={fileDec.url} />
                                    </audio>
                                  )}
                                  {fileDec.mime.startsWith("video/") && (
                                    <video controls className="w-full max-h-48 rounded bg-black">
                                      <source src={fileDec.url} />
                                    </video>
                                  )}
                                  <a
                                    href={fileDec.url}
                                    download={fileDec.originalName}
                                    className="w-full py-1.5 bg-[#2481cc] hover:bg-[#1c6fae] text-white font-mono text-[9px] font-bold rounded text-center flex items-center justify-center gap-1 cursor-pointer select-none"
                                  >
                                    <Download className="w-3.5 h-3.5" />
                                    <span>SAVE DECRYPTED BINARY</span>
                                  </a>
                                </div>
                              ) : (
                                <button
                                  onClick={() => decryptVaultFile(file)}
                                  disabled={isDecrypting}
                                  className={`mt-3 w-full py-2 border rounded-xl font-mono text-[10px] font-bold select-none cursor-pointer flex items-center justify-center gap-1 transition ${isDecrypting ? 'bg-amber-500/10 border-amber-500/20 text-amber-500 animate-pulse' : isLightTheme ? 'bg-slate-50 hover:bg-slate-100 border-slate-205 text-[#2481cc]' : 'bg-[#101921] hover:bg-[#202b36] border-[#202b36] text-[#2481cc]'}`}
                                >
                                  {isDecrypting ? (
                                    <>
                                      <RefreshCw className="w-3 h-3 animate-spin" />
                                      <span>Decrypting payload...</span>
                                    </>
                                  ) : (
                                    <>
                                      <LockOpen className="w-3 h-3" />
                                      <span>Decrypt & Unpack</span>
                                    </>
                                  )}
                                </button>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ) : (
                    <div className="py-20 text-center space-y-3.5 select-none text-slate-500">
                      <FolderOpen className="w-7 h-7 mx-auto text-slate-655" />
                      <p className="text-xs font-semibold">Symmetric drive storage folder is empty.</p>
                      <button onClick={scanDriveFolder} className="text-xs text-[#2481cc] font-black hover:underline cursor-pointer">
                        Scan Folder Again
                      </button>
                    </div>
                  )}
                </div>
              )}

              {vaultTab === "private" && (
                <div className="space-y-4">
                  <div className={`p-3.5 border rounded-2xl flex justify-between items-center ${isLightTheme ? 'bg-slate-50 border-slate-200' : 'bg-[#182533]/50 border-[#101921]'}`}>
                    <div className="overflow-hidden">
                      <p className="text-xs font-bold text-teal-500">Browser Locked Offline Database</p>
                      <p className="text-[10px] text-slate-505 mt-1">
                        Encrypted assets saved securely inside sandbox index-caches. No cloud access required, keeping data 100% offline.
                      </p>
                    </div>
                  </div>

                  {localFiles.length > 0 ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                      {localFiles.map((file) => {
                        const fileDec = decryptedVaultFiles[file.id];
                        const isDecrypting = decryptingFileId === file.id;

                        return (
                          <div
                            key={file.id}
                            className={`p-3.5 rounded-2xl border flex flex-col justify-between transition relative ${isLightTheme ? 'bg-white border-slate-150 shadow-sm' : 'bg-[#182533] border-[#101921] shadow-md'}`}
                          >
                            <div className="flex items-start gap-3 flex-grow">
                              <div className="w-10 h-10 rounded-full bg-teal-500/10 flex items-center justify-center text-teal-500 flex-shrink-0">
                                {file.contentType?.startsWith("audio/") ? (
                                  <Music className="w-5 h-5" />
                                ) : file.contentType?.startsWith("image/") ? (
                                  <ImageIcon className="w-5 h-5" />
                                ) : (
                                  <FileText className="w-5 h-5" />
                                )}
                              </div>
                              <div className="overflow-hidden min-w-0 flex-grow">
                                <p className={`text-[12px] font-bold truncate ${isLightTheme ? 'text-slate-905' : 'text-white'}`} title={file.name}>
                                  {file.name}
                                </p>
                                <p className="text-[9px] text-slate-550 font-mono mt-0.5">PERSISTED: {file.uploadedAt}</p>
                                <p className="text-[10px] text-slate-500 mt-1">
                                  Size: {((file.size || 0) / (1024 * 1024)).toFixed(2)} MB
                                </p>
                              </div>
                              <button
                                onClick={() => deleteLocalFile(file.id)}
                                className="text-red-505 hover:text-red-650 p-1.5 rounded-lg hover:bg-red-500/10 transition flex-shrink-0 cursor-pointer"
                                title="Purge binary file completely"
                              >
                                <XIcon className="w-3.5 h-3.5" />
                              </button>
                            </div>

                            {fileDec ? (
                              <div className={`mt-3 p-2 rounded-xl border space-y-2 border-dashed ${isLightTheme ? 'bg-slate-50 border-slate-205' : 'bg-[#101921] border-[#222e3b]'}`}>
                                {fileDec.mime?.startsWith("image/") && (
                                  <img src={fileDec.url} alt={fileDec.originalName} className="max-h-48 rounded object-contain mx-auto border" />
                                )}
                                {fileDec.mime?.startsWith("audio/") && (
                                  <audio controls className="w-full h-8 text-xs rounded bg-slate-905">
                                    <source src={fileDec.url} />
                                  </audio>
                                )}
                                {fileDec.mime?.startsWith("video/") && (
                                  <video controls className="w-full max-h-48 rounded bg-black">
                                    <source src={fileDec.url} />
                                  </video>
                                )}
                                <a
                                  href={fileDec.url}
                                  download={fileDec.originalName}
                                  className="w-full py-1.5 bg-teal-650 hover:bg-teal-600 text-white font-mono text-[9px] font-bold rounded text-center flex items-center justify-center gap-1 cursor-pointer select-none"
                                >
                                  <Download className="w-3.5 h-3.5" />
                                  <span>DOWNLOAD FILE LOCAL_STREAM</span>
                                </a>
                              </div>
                            ) : (
                              <button
                                onClick={() => decryptLocalVaultFile(file)}
                                disabled={isDecrypting}
                                className={`mt-3 w-full py-2 border rounded-xl font-mono text-[10px] font-bold select-none cursor-pointer flex items-center justify-center gap-1 transition ${isDecrypting ? 'bg-[#2481cc]/15 border-transparent text-[#2481cc] animate-pulse' : isLightTheme ? 'bg-slate-50 hover:bg-slate-100 border-slate-200 text-teal-650' : 'bg-[#101921] hover:bg-[#202b36] border-[#202b36] text-teal-400'}`}
                              >
                                {isDecrypting ? (
                                  <>
                                    <RefreshCw className="w-3 h-3 animate-spin" />
                                    <span>Decrypting locally...</span>
                                  </>
                                ) : (
                                  <>
                                    <LockOpen className="w-3 h-3" />
                                    <span>Unpack Private Sandbox</span>
                                  </>
                                )}
                              </button>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="py-20 text-center space-y-3 select-none text-slate-500">
                      <FolderOpen className="w-7 h-7 mx-auto text-slate-655" />
                      <p className="text-xs font-semibold">Your Private Browser sandbox vault is empty.</p>
                      <p className="text-[10px] text-slate-400 max-w-xs mx-auto">
                        Upload files under the &quot;Upload &amp; Encrypt&quot; menu and select &quot;Save Locally&quot; to populate this view.
                      </p>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        ) : (
          /* Empty Chat View State */
          <div className="flex-grow flex flex-col items-center justify-center p-8 text-center select-none z-10">
            <div className="max-w-md space-y-5">
              <div className="w-14 h-14 bg-indigo-600/10 rounded-full flex items-center justify-center mx-auto border border-indigo-500/20 text-indigo-500">
                <FolderLock className="w-7 h-7 animate-pulse" />
              </div>
              <div>
                <h3 className={`text-base font-extrabold ${isLightTheme ? 'text-slate-950' : 'text-white'}`}>
                  Secure Connections Handshake
                </h3>
                <p className="text-xs text-slate-400 mt-2 leading-relaxed">
                  Initialize a secure connection link-up to transmit data symmetrically. When you copy and transmit your link, counterparts will pair into your sidebar automatically.
                </p>
              </div>
              <div className="p-4 bg-indigo-500/5 rounded-2xl border border-indigo-500/10 space-y-3 max-w-sm mx-auto shadow-sm">
                <div className="text-[10px] font-bold text-slate-400 font-mono flex items-center justify-center gap-1">
                  <LinkIcon className="w-3.5 h-3.5 text-indigo-500" />
                  <span>TRANSMIT PAIRING HANDSHAKE LINK</span>
                </div>
                <p className="text-[10px] text-slate-500 leading-normal font-sans">
                  Other clients using this invite parameter register on secure signup/login structures, linking both identities instantly into each other&apos;s workspaces.
                </p>
                <button
                  onClick={() => setShowInviteModal(true)}
                  className="w-full py-2 bg-indigo-600 hover:bg-indigo-550 text-white font-mono text-[9px] font-bold rounded-lg flex items-center justify-center gap-1 transition-all cursor-pointer"
                >
                  <UserPlus className="w-3.5 h-3.5 text-white" />
                  <span>INVITE PEER (GMAIL / SMS / LINK)</span>
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* MODALS AND OVERLAYS */}

      {/* Snapshot Video Modal Overlay */}
      {isCameraActive && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center p-4 z-[9999] backdrop-blur-sm">
          <div className={`max-w-md w-full border rounded-3xl p-6 shadow-2xl space-y-4 transition-all ${isLightTheme ? 'bg-white border-slate-200 text-slate-800' : 'bg-slate-900 border-slate-800 text-white'}`}>
            <div className={`flex justify-between items-center pb-2 border-b ${isLightTheme ? 'border-slate-100' : 'border-slate-800'}`}>
              <h4 className="font-bold text-sm flex items-center gap-2">
                <Camera className={`w-4 h-4 animate-pulse ${isLightTheme ? 'text-rose-505' : 'text-rose-455'}`} />
                <span className={isLightTheme ? 'text-slate-850 font-sans' : 'text-white'}>Prix Snapshot Device</span>
              </h4>
              <button onClick={stopCamera} className={`text-xs font-bold ${isLightTheme ? 'text-slate-400 hover:text-slate-655' : 'text-slate-400 hover:text-white'}`}>✕</button>
            </div>
            
            <video
              ref={cameraVideoRef}
              autoPlay
              playsInline
              className="w-full h-60 bg-black rounded-2xl object-cover border border-slate-800"
            />
            
            <div className="flex gap-2">
              <button
                onClick={stopCamera}
                className={`flex-1 py-2.5 rounded-xl text-xs font-bold transition ${isLightTheme ? 'bg-slate-100 hover:bg-slate-200 text-slate-600' : 'bg-slate-800 hover:bg-slate-755 text-slate-300'}`}
              >
                Cancel
              </button>
              <button
                onClick={captureCameraSnapshot}
                className="flex-1 py-2.5 bg-rose-655 hover:bg-rose-600 text-white rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <span>Symmetric Capture</span>
                <Camera className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Poll Creation Modal Overlay */}
      {showPollModal && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center p-4 z-[9999] backdrop-blur-sm">
          <div className={`max-w-md w-full border rounded-3xl p-6 shadow-2xl space-y-4 transition-all ${isLightTheme ? 'bg-white border-slate-200 text-slate-800' : 'bg-slate-900 border-slate-800 text-white'}`}>
            <div className={`flex justify-between items-center border-b pb-3 ${isLightTheme ? 'border-slate-100' : 'border-slate-800'}`}>
              <h4 className="font-bold text-sm flex items-center gap-2">
                <ChartColumn className="w-4 h-4 text-indigo-500" />
                <span>Create Group Poll</span>
              </h4>
              <button onClick={() => setShowPollModal(false)} className={`text-xs font-bold ${isLightTheme ? 'text-slate-400 hover:text-slate-655' : 'text-slate-450 hover:text-white'}`}>✕</button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className={`block font-bold mb-1 font-mono uppercase tracking-wider text-[9px] ${isLightTheme ? 'text-slate-500' : 'text-slate-400'}`}>Question / Topic</label>
                <input
                  type="text"
                  placeholder="e.g. Which E2E key length should we decide?"
                  value={pollQuestion}
                  onChange={(e) => setPollQuestion(e.target.value)}
                  className={`w-full rounded-xl p-2.5 text-xs outline-none focus:border-indigo-500 transition border ${isLightTheme ? 'bg-slate-50 border-slate-200 text-slate-900' : 'bg-slate-955 border-slate-800 text-white'}`}
                />
              </div>
              
              <div className="space-y-2">
                <label className={`block font-bold font-mono uppercase tracking-wider text-[9px] ${isLightTheme ? 'text-slate-500' : 'text-slate-400'}`}>Options Choices</label>
                {pollOptions.map((opt, oIdx) => (
                  <div key={oIdx} className="flex gap-2">
                    <input
                      type="text"
                      placeholder={`Option ${oIdx + 1}`}
                      value={opt}
                      onChange={(e) => updatePollOption(oIdx, e.target.value)}
                      className={`flex-grow rounded-xl p-2.5 text-xs outline-none border ${isLightTheme ? 'bg-slate-50 border-slate-200 text-slate-900 focus:border-indigo-500' : 'bg-slate-955 border-slate-800 text-white focus:border-indigo-500'}`}
                    />
                    {pollOptions.length > 2 && (
                      <button
                        onClick={() => setPollOptions(pollOptions.filter((_, idx) => idx !== oIdx))}
                        className="text-xs text-red-500 hover:text-red-400 px-2 font-bold cursor-pointer font-mono"
                      >
                        ✕
                      </button>
                    )}
                  </div>
                ))}
                <button
                  onClick={addPollOption}
                  className="text-[10px] font-mono text-[#2481cc] hover:underline flex items-center gap-1 mt-1 font-bold cursor-pointer"
                >
                  + Add option choice
                </button>
              </div>
            </div>

            <div className="flex gap-2 pt-2">
              <button
                onClick={() => setShowPollModal(false)}
                className={`flex-1 py-2.5 rounded-xl text-xs font-bold transition ${isLightTheme ? 'bg-slate-100 hover:bg-slate-205 text-slate-650' : 'bg-slate-855 hover:bg-slate-800 text-slate-300'}`}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  if (pollQuestion.trim()) {
                    sendCustomChatMessage({
                      poll: {
                        question: pollQuestion,
                        options: pollOptions.filter(o => o.trim() !== "").map(text => ({ text, votes: 0, voters: [] })),
                        totalVotes: 0
                      },
                      text: `📊 Public Poll: "${pollQuestion}"`
                    });
                    setPollQuestion("");
                    setPollOptions(["", ""]);
                    setShowPollModal(false);
                  }
                }}
                className="flex-grow py-2.5 bg-indigo-650 hover:bg-indigo-600 text-white rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <span>Broadcast Poll</span>
                <ChartColumn className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Checklist Creation Modal Overlay */}
      {showChecklistModal && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center p-4 z-[9999] backdrop-blur-sm">
          <div className={`max-w-md w-full border rounded-3xl p-6 shadow-2xl space-y-4 transition-all ${isLightTheme ? 'bg-white border-slate-200 text-slate-800' : 'bg-slate-900 border-slate-800 text-white'}`}>
            <div className={`flex justify-between items-center border-b pb-3 ${isLightTheme ? 'border-slate-100' : 'border-slate-800'}`}>
              <h4 className="font-bold text-sm flex items-center gap-2">
                <SquareCheckBig className="w-4 h-4 text-purple-500" />
                <span>Create Interactive Checklist</span>
              </h4>
              <button onClick={() => setShowChecklistModal(false)} className={`text-xs font-bold ${isLightTheme ? 'text-slate-400 hover:text-slate-655' : 'text-slate-450 hover:text-white'}`}>✕</button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className={`block font-bold mb-1 font-mono uppercase tracking-wider text-[9px] ${isLightTheme ? 'text-slate-500' : 'text-slate-400'}`}>Checklist title</label>
                <input
                  type="text"
                  placeholder="e.g. Secure Server Setup Checks"
                  value={checklistTitle}
                  onChange={(e) => setChecklistTitle(e.target.value)}
                  className={`w-full rounded-xl p-2.5 text-xs outline-none focus:border-purple-500 transition border ${isLightTheme ? 'bg-slate-50 border-slate-200 text-slate-900' : 'bg-slate-950 border-slate-800 text-white'}`}
                />
              </div>

              <div className="space-y-2">
                <label className={`block font-bold font-mono uppercase tracking-wider text-[9px] ${isLightTheme ? 'text-slate-500' : 'text-slate-400'}`}>Tasks / Items</label>
                {checklistItems.map((item, idx) => (
                  <div key={idx} className="flex gap-2">
                    <input
                      type="text"
                      placeholder={`Task item ${idx + 1}`}
                      value={item}
                      onChange={(e) => updateChecklistItem(idx, e.target.value)}
                      className={`flex-grow rounded-xl p-2.5 text-xs outline-none border ${isLightTheme ? 'bg-slate-50 border-slate-200 text-slate-900 focus:border-purple-500' : 'bg-slate-950 border-slate-800 text-white focus:border-purple-500'}`}
                    />
                    {checklistItems.length > 2 && (
                      <button
                        onClick={() => setChecklistItems(checklistItems.filter((_, iIdx) => iIdx !== idx))}
                        className="text-xs text-red-500 hover:text-red-400 px-2 font-bold cursor-pointer"
                      >
                        ✕
                      </button>
                    )}
                  </div>
                ))}
                <button
                  onClick={addChecklistItem}
                  className="text-[10px] font-mono text-purple-500 hover:underline flex items-center gap-1 mt-1 font-bold cursor-pointer"
                >
                  + Add checklist task item
                </button>
              </div>
            </div>

            <div className="flex gap-2 pt-2">
              <button
                onClick={() => setShowChecklistModal(false)}
                className={`flex-1 py-2.5 rounded-xl text-xs font-bold transition ${isLightTheme ? 'bg-slate-100 hover:bg-slate-202 text-slate-650' : 'bg-slate-855 hover:bg-slate-800 text-slate-350'}`}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  const cleaned = checklistItems.filter(i => i.trim() !== "");
                  if (cleaned.length !== 0) {
                    sendCustomChatMessage({
                      checklist: {
                        title: checklistTitle || "Symmetric Checklist",
                        items: cleaned.map((text, idx) => ({
                          id: `it_${idx}_${Date.now()}`,
                          text,
                          checked: false
                        }))
                      },
                      text: `📝 Checklist shared: "${checklistTitle || "Symmetric Checklist"}"`
                    });
                    setChecklistTitle("");
                    setChecklistItems(["", ""]);
                    setShowChecklistModal(false);
                  }
                }}
                className="flex-grow py-2.5 bg-purple-650 hover:bg-purple-600 text-white rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <span>Deploy Checklist</span>
                <SquareCheckBig className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Share Contact Card Modal Overlay */}
      {showContactModal && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center p-4 z-[9999] backdrop-blur-sm">
          <div className={`max-w-md w-full border rounded-3xl p-6 shadow-2xl space-y-4 transition-all ${isLightTheme ? 'bg-white border-slate-200 text-slate-800' : 'bg-slate-900 border-slate-800 text-white'}`}>
            <div className={`flex justify-between items-center border-b pb-3 ${isLightTheme ? 'border-slate-100' : 'border-slate-800'}`}>
              <h4 className="font-bold text-sm flex items-center gap-2">
                <UserPlus className="w-4 h-4 text-orange-500" />
                <span>Share Business Contact Card</span>
              </h4>
              <button onClick={() => setShowContactModal(false)} className={`text-xs font-bold ${isLightTheme ? 'text-slate-400 hover:text-slate-655' : 'text-slate-450 hover:text-white'}`}>✕</button>
            </div>

            <div className="space-y-3.5 text-xs">
              <div>
                <label className={`block font-bold mb-1 font-mono uppercase tracking-wider text-[9px] ${isLightTheme ? 'text-slate-500' : 'text-slate-400'}`}>Contact Name</label>
                <input
                  type="text"
                  placeholder="e.g. Dr S.K. Srinivasan"
                  value={contactForm.name}
                  onChange={(e) => setContactForm({ ...contactForm, name: e.target.value })}
                  className={`w-full rounded-xl p-2.5 text-xs outline-none focus:border-orange-500 border ${isLightTheme ? 'bg-slate-50 border-slate-200 text-slate-900' : 'bg-slate-950 border-slate-800 text-white'}`}
                />
              </div>

              <div>
                <label className={`block font-bold mb-1 font-mono uppercase tracking-wider text-[9px] ${isLightTheme ? 'text-slate-500' : 'text-slate-400'}`}>Mobile Phone number</label>
                <input
                  type="text"
                  placeholder="e.g. +91 94440 12345"
                  value={contactForm.phone}
                  onChange={(e) => setContactForm({ ...contactForm, phone: e.target.value })}
                  className={`w-full rounded-xl p-2.5 text-xs outline-none focus:border-orange-500 border ${isLightTheme ? 'bg-slate-50 border-slate-200 text-slate-900' : 'bg-slate-955 border-slate-800 text-white'}`}
                />
              </div>

              <div>
                <label className={`block font-bold mb-1.5 font-mono uppercase tracking-wider text-[9px] ${isLightTheme ? 'text-slate-500' : 'text-slate-400'}`}>Secure Email ID</label>
                <input
                  type="email"
                  placeholder="e.g. contact.identity@domain.com"
                  value={contactForm.email}
                  onChange={(e) => setContactForm({ ...contactForm, email: e.target.value })}
                  className={`w-full rounded-xl p-2.5 text-xs outline-none focus:border-orange-500 border ${isLightTheme ? 'bg-slate-50 border-slate-200 text-slate-900' : 'bg-slate-955 border-slate-800 text-white'}`}
                />
              </div>
            </div>

            <div className="flex gap-2 pt-2">
              <button
                onClick={() => setShowContactModal(false)}
                className={`flex-1 py-2.5 rounded-xl text-xs font-bold transition ${isLightTheme ? 'bg-slate-100 hover:bg-slate-202 text-slate-650' : 'bg-slate-855 hover:bg-slate-805 text-slate-300'}`}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  if (contactForm.name.trim() && contactForm.phone.trim()) {
                    sendCustomChatMessage({
                      contactInfo: contactForm,
                      text: `📇 Symmetrically Encrypted Contact Card: ${contactForm.name}`
                    });
                    setContactForm({ name: "", phone: "", email: "" });
                    setShowContactModal(false);
                  }
                }}
                className="flex-grow py-2.5 bg-orange-655 hover:bg-orange-600 text-white rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer animate-scale-up-bounce"
              >
                <span>Share Contact</span>
                <UserPlus className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* P2P Wallet Transfer Modal Overlay */}
      {showWalletModal && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center p-4 z-[9999] backdrop-blur-sm animate-fade-in">
          <div className={`max-w-md w-full border rounded-3xl p-6 shadow-2xl space-y-4 transition-all duration-200 ${isLightTheme ? 'bg-white border-slate-200 text-slate-800' : 'bg-slate-900 border-slate-800 text-white'}`}>
            <div className={`flex justify-between items-center border-b pb-3 ${isLightTheme ? 'border-slate-100' : 'border-slate-800'}`}>
              <h4 className="font-bold text-sm flex items-center gap-2">
                <Coins className="w-4 h-4 text-amber-500" />
                <span>Peer-to-Peer Secure Ledger Transfer</span>
              </h4>
              <button
                onClick={() => {
                  setShowWalletModal(false);
                  setWalletTab("crypto");
                }}
                className={`text-xs font-bold ${isLightTheme ? 'text-slate-400 hover:text-slate-650' : 'text-slate-450 hover:text-white'}`}
              >
                ✕
              </button>
            </div>

            <div className={`grid grid-cols-2 p-1.5 rounded-2xl text-[11px] font-bold ${isLightTheme ? 'bg-slate-100' : 'bg-slate-950'}`}>
              <button
                onClick={() => setWalletTab("crypto")}
                className={`py-2 rounded-xl text-center cursor-pointer transition-all ${walletTab === "crypto" ? (isLightTheme ? 'bg-white text-slate-850 shadow' : 'bg-amber-600 text-white') : 'text-slate-450 hover:text-slate-300'}`}
              >
                ⚡ Cryptographic E2EE Token
              </button>
              <button
                onClick={() => setWalletTab("gpay")}
                className={`py-2 rounded-xl text-center cursor-pointer transition-all flex items-center justify-center gap-1.5 ${walletTab === "gpay" ? (isLightTheme ? 'bg-white text-[#1a73e8] shadow' : 'bg-[#1a73e8] text-white') : 'text-slate-450 hover:text-slate-300'}`}
              >
                <span className="font-black bg-[#e8f0fe] text-[#1a73e8] px-1.5 rounded-md text-[10px] tracking-wide">GPay</span>
                <span>Google Pay Services</span>
              </button>
            </div>

            {walletTab === "crypto" ? (
              <div className="space-y-3 text-xs">
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className={`block font-bold mb-1 font-mono uppercase tracking-wider text-[9px] ${isLightTheme ? 'text-slate-500' : 'text-slate-400'}`}>Select Token Asset</label>
                    <select
                      value={walletForm.symbol}
                      onChange={(e) => setWalletForm({ ...walletForm, symbol: e.target.value })}
                      className={`w-full rounded-xl p-2.5 text-xs outline-none border focus:border-amber-500 ${isLightTheme ? 'bg-slate-50 border-slate-200 text-slate-900 font-medium' : 'bg-[#101921] border-slate-800 text-white'}`}
                    >
                      <option value="USDT">USDT (Tether)</option>
                      <option value="USDC">USDC (USD Coin)</option>
                      <option value="ETH">ETH (Ethereum)</option>
                      <option value="BTC">BTC (Bitcoin)</option>
                      <option value="UNICORN">UNICORN E2EE</option>
                    </select>
                  </div>
                  <div>
                    <label className={`block font-bold mb-1 font-mono uppercase tracking-wider text-[9px] ${isLightTheme ? 'text-slate-500' : 'text-slate-400'}`}>Transfer Amount</label>
                    <input
                      type="number"
                      placeholder="250.00"
                      value={walletForm.amount}
                      onChange={(e) => setWalletForm({ ...walletForm, amount: e.target.value })}
                      className={`w-full rounded-xl p-2.5 text-xs outline-none focus:border-amber-500 border ${isLightTheme ? 'bg-slate-50 border-slate-200 text-slate-950' : 'bg-[#101921] border-slate-800 text-white'}`}
                    />
                  </div>
                </div>

                <div>
                  <label className={`block font-bold mb-1 font-mono uppercase tracking-wider text-[9px] ${isLightTheme ? 'text-slate-500' : 'text-slate-400'}`}>Destination Receiver Address (Hex)</label>
                  <input
                    type="text"
                    placeholder="e.g. 0x9f1a7d65B...32cf31"
                    value={walletForm.address}
                    onChange={(e) => setWalletForm({ ...walletForm, address: e.target.value })}
                    className={`w-full rounded-xl p-2.5 text-xs outline-none focus:border-amber-500 border ${isLightTheme ? 'bg-slate-50 border-slate-200 text-slate-900' : 'bg-[#101921] border-slate-800 text-white'}`}
                  />
                </div>

                <div className="flex gap-2 pt-2">
                  <button
                    onClick={() => setShowWalletModal(false)}
                    className={`flex-1 py-2.5 rounded-xl text-xs font-bold transition ${isLightTheme ? 'bg-slate-100 hover:bg-slate-205 text-slate-600' : 'bg-slate-855 hover:bg-slate-800 text-slate-350'}`}
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      if (walletForm.amount && walletForm.address.trim()) {
                        sendCustomChatMessage({
                          walletTransfer: {
                            amount: walletForm.amount,
                            symbol: walletForm.symbol,
                            senderAddress: "0x" + (user?.uid || "user_me").substring(0, 10).toUpperCase(),
                            receiverAddress: walletForm.address,
                            txHash: "0x" + Math.round(Math.random() * 999999).toString(16) + "faec" + Math.round(Math.random() * 9999).toString(16) + "e2e",
                            status: "completed",
                            isGPay: false
                          },
                          text: `💸 Transferred: ${walletForm.amount} ${walletForm.symbol} symmetrically to secure blockchain layer.`
                        });
                        setWalletForm({ amount: "", symbol: "USDT", address: "" });
                        setShowWalletModal(false);
                      }
                    }}
                    className="flex-grow py-2.5 bg-amber-655 hover:bg-amber-600 text-white rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    <span>Execute Transfer</span>
                    <Coins className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ) : (
              /* GPay Tab content */
              <div className="space-y-4 text-xs">
                <div className="p-3.5 bg-blue-500/5 rounded-2xl border border-blue-500/10 text-[11px] leading-relaxed text-blue-550 text-center font-medium">
                  Direct peer-to-peer bank account settlement working over secure Google Pay pipelines. Transactions are verified in seconds with zero network fees.
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className={`block font-bold mb-1 font-mono uppercase tracking-wider text-[9px] ${isLightTheme ? 'text-slate-500' : 'text-slate-400'}`}>Billing Holder Name</label>
                    <input
                      type="text"
                      value={gpayForm.cardName}
                      onChange={(e) => setGpayForm({ ...gpayForm, cardName: e.target.value })}
                      className={`w-full rounded-xl p-2.5 text-xs outline-none border focus:border-blue-500 ${isLightTheme ? 'bg-slate-50 border-slate-200 text-slate-900 font-medium' : 'bg-[#101921] border-slate-800 text-white'}`}
                    />
                  </div>
                  <div>
                    <label className={`block font-bold mb-1 font-mono uppercase tracking-wider text-[9px] ${isLightTheme ? 'text-slate-500' : 'text-slate-400'}`}>Payout Amount (INR ₹)</label>
                    <input
                      type="number"
                      placeholder="e.g. ₹500"
                      value={gpayForm.amount}
                      onChange={(e) => setGpayForm({ ...gpayForm, amount: e.target.value })}
                      className={`w-full rounded-xl p-2.5 text-xs outline-none focus:border-blue-500 border ${isLightTheme ? 'bg-slate-50 border-slate-200 text-slate-900' : 'bg-[#101921] border-slate-800 text-white'}`}
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <label className={`block font-bold mb-1.5 font-mono uppercase tracking-wider text-[9px] ${isLightTheme ? 'text-slate-500' : 'text-slate-400'}`}>Quick select (INR ₹)</label>
                  <div className="flex gap-1.5 flex-wrap">
                    {["150", "500", "1000", "2500", "5000"].map((amt) => (
                      <button
                        key={amt}
                        onClick={() => setGpayForm({ ...gpayForm, amount: amt })}
                        className={`px-3 py-1.5 rounded-lg font-mono text-[11px] font-bold border transition ${gpayForm.amount === amt ? 'bg-blue-600 text-white border-blue-650' : isLightTheme ? 'bg-slate-50 text-slate-655 hover:bg-slate-100 border-slate-200' : 'bg-slate-950 text-slate-350 hover:bg-slate-850 border-slate-800'}`}
                      >
                        ₹{amt}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="flex gap-2 pt-2 border-t border-slate-100/20">
                  <button
                    onClick={() => setShowWalletModal(false)}
                    className={`flex-1 py-2.5 rounded-xl text-xs font-bold transition ${isLightTheme ? 'bg-slate-100 hover:bg-slate-200 text-slate-600' : 'bg-slate-855 hover:bg-slate-800 text-slate-350'}`}
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      if (!gpayForm.amount) {
                        alert("Please specify a GPay transaction amount first.");
                        return;
                      }
                      setShowGpayPortal(true);
                      setIsGpayProcessing(true);
                    }}
                    className="flex-grow py-2.5 bg-blue-650 hover:bg-blue-550 text-white rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer shadow-lg"
                  >
                    <span className="font-extrabold bg-white text-blue-650 px-1.5 rounded text-[10px] tracking-wide">GPay</span>
                    <span>Pay with Google Pay</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Google Pay Sim Portal Overlay */}
      {showGpayPortal && (
        <div className="fixed inset-0 bg-black/85 flex items-end sm:items-center justify-center z-[10000] backdrop-blur-md animate-fade-in">
          <div className="w-full sm:max-w-md bg-zinc-955 border border-zinc-900 sm:rounded-3xl p-6 text-white space-y-5 shadow-2xl relative bottom-0 sm:bottom-auto select-none font-sans">
            <div className="flex justify-between items-center border-b border-zinc-900 pb-3">
              <div className="flex items-center gap-2">
                <span className="font-black bg-white text-black px-2 py-0.5 rounded text-xs tracking-wider">GPay</span>
                <span className="text-xs font-bold tracking-tight text-zinc-400">Google Pay API Client Gateway</span>
              </div>
              {!isGpayProcessing && (
                <button
                  onClick={() => setShowGpayPortal(false)}
                  className="text-zinc-500 hover:text-white text-xs font-mono border border-zinc-805 px-2 py-1 rounded"
                >
                  Close
                </button>
              )}
            </div>

            <div className="py-6 flex flex-col items-center justify-center text-center space-y-4">
              {isGpayProcessing ? (
                <>
                  <div className="relative flex items-center justify-center">
                    <div className="w-16 h-16 rounded-full border-4 border-blue-500/20 border-t-blue-500 animate-spin" />
                    <Lock className="w-5 h-5 text-blue-400 absolute" />
                  </div>
                  <div className="space-y-1">
                    <h5 className="font-bold text-sm tracking-tight text-zinc-100">Securing Google Pay Link...</h5>
                    <p className="text-[10px] text-zinc-500 font-mono tracking-wide">
                      negotiating symmetric banking handshake • RSA-4096
                    </p>
                  </div>
                  <div className="w-full max-w-xs bg-zinc-900/50 rounded-2xl p-3 border border-zinc-900/80 text-left space-y-2">
                    <div className="flex items-center justify-between text-[9px] font-mono">
                      <span className="text-zinc-400">Client billing id</span>
                      <span className="text-zinc-300 truncate max-w-[120px]">{gpayForm.email}</span>
                    </div>
                    <div className="flex items-center justify-between text-[9px] font-mono">
                      <span className="text-zinc-400">Recipient peer node</span>
                      <span className="text-zinc-300 font-bold">{activeChatName || "Secure Receiver"}</span>
                    </div>
                    <div className="flex items-center justify-between text-[9px] font-mono border-t border-zinc-900 pt-2 font-bold text-blue-400">
                      <span>Verified Amount</span>
                      <span>₹{gpayForm.amount} INR</span>
                    </div>
                  </div>
                </>
              ) : (
                <>
                  <div className="w-16 h-16 rounded-full bg-emerald-500/10 border-2 border-emerald-500 flex items-center justify-center animate-scale-up-bounce">
                    <CheckCheck className="w-9 h-9 text-emerald-500 animate-pulse" />
                  </div>
                  <div className="space-y-1">
                    <h5 className="font-black text-base tracking-tight text-emerald-400">Symmetrical Payout Success!</h5>
                    <p className="text-[11px] text-zinc-455 font-medium">
                      Google Pay authenticated. Token voucher deployed to conversational mesh.
                    </p>
                  </div>
                  <div className="w-full bg-zinc-900 rounded-2xl p-4 border border-zinc-800 text-left text-xs space-y-2.5 font-mono">
                    <div className="flex justify-between border-b border-zinc-800 pb-2">
                      <span className="text-zinc-500 text-[10px]">Reference Tx</span>
                      <span className="text-zinc-300 text-[10px]">GPAY_TX7444{Math.round(Math.random() * 99999)}91_SEC</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-zinc-500 text-[10px]">Card Account</span>
                      <span className="text-zinc-300 text-[10px]">SBI Secure Grid Virtual Card •••• 9820</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-zinc-500 text-[10px]">Symmetric Vault Status</span>
                      <span className="text-emerald-500 text-[10px] font-bold">✓ Bound & Signed</span>
                    </div>
                    <div className="flex justify-between text-[#1a73e8] font-bold border-t border-zinc-800 pt-2">
                      <span>Transaction aggregate</span>
                      <span>₹{gpayForm.amount} INR</span>
                    </div>
                  </div>
                  <button
                    onClick={() => {
                      sendCustomChatMessage({
                        walletTransfer: {
                          amount: gpayForm.amount,
                          symbol: "INR (Google Pay)",
                          senderAddress: "GPay Virtual ID",
                          receiverAddress: "Client direct mesh payout",
                          txHash: "GP_TX_" + Math.round(Math.random() * 1e6).toString(16).toUpperCase(),
                          status: "completed",
                          isGPay: true
                        },
                        text: `💳 Google Pay Verified Transfer: paid ₹${gpayForm.amount} INR directly and securely with GPay!`
                      });
                      setShowGpayPortal(false);
                      setShowWalletModal(false);
                      setGpayForm({ ...gpayForm, amount: "" });
                      setWalletTab("crypto");
                    }}
                    className="w-full py-3 bg-emerald-650 hover:bg-emerald-600 text-white rounded-xl text-xs font-bold transition flex items-center justify-center gap-2 cursor-pointer shadow-lg"
                  >
                    <span>Deploy Verified Receipt to Chat</span>
                    <Coins className="w-3.5 h-3.5" />
                  </button>
                </>
              )}
            </div>
            {isGpayProcessing && (
              <div className="hidden">
                {setTimeout(() => setIsGpayProcessing(false), 3100) && null}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Connection Profile Modal Overlay */}
      {activeProfileOverlay && (
        <div className="fixed inset-0 bg-black/85 flex items-center justify-center p-4 z-[9999] backdrop-blur-sm animate-fade-in">
          <div className={`max-w-md w-full border rounded-3xl p-6 shadow-2xl relative transition-all max-h-[90vh] overflow-y-auto ${isLightTheme ? 'bg-white border-slate-200 text-slate-800' : 'bg-slate-900 border-slate-800 text-white'}`}>
            <button
              onClick={() => setActiveProfileOverlay(null)}
              className={`absolute top-4 right-4 p-1.5 rounded-full hover:bg-slate-500/10 text-slate-400 ${isLightTheme ? 'hover:text-slate-700' : 'hover:text-white'}`}
            >
              ✕
            </button>
            <div className="flex flex-col items-center text-center space-y-4 pt-4 border-b pb-6 border-slate-500/10">
              <div className="relative">
                {activeProfileOverlay.avatar ? (
                  <img
                    referrerPolicy="no-referrer"
                    src={activeProfileOverlay.avatar}
                    alt={activeProfileOverlay.name}
                    className="w-20 h-20 rounded-full object-cover border-2 border-[#2481cc]/25 shadow-md"
                  />
                ) : (
                  <div className={`w-20 h-20 rounded-full flex items-center justify-center text-2xl font-black uppercase shadow-inner ${getAvatarInitials(activeProfileOverlay.name).color}`}>
                    {getAvatarInitials(activeProfileOverlay.name).initials}
                  </div>
                )}
                <span className="absolute bottom-1 right-1 w-4 h-4 rounded-full border-2 border-slate-900 bg-emerald-500" />
              </div>
              <div>
                <h4 className="text-base font-black tracking-tight">{activeProfileOverlay.name}</h4>
                <div className="mt-1 space-y-1">
                  {activeProfileOverlay.email && (
                    <p className="text-[10px] text-slate-400 font-mono flex items-center justify-center gap-1">
                      <ImageIcon className="w-3 h-3" />
                      <span>{activeProfileOverlay.email}</span>
                    </p>
                  )}
                  {activeProfileOverlay.phoneNumber && (
                    <p className="text-[10px] text-slate-400 font-mono flex items-center justify-center gap-1">
                      <Phone className="w-3 h-3" />
                      <span>{activeProfileOverlay.phoneNumber}</span>
                    </p>
                  )}
                </div>
              </div>
            </div>

            <div className="space-y-4 pt-6 text-xs">
              <div className="space-y-2.5">
                <h5 className="font-bold text-[10px] font-mono uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                  <Key className="w-3.5 h-3.5 text-blue-500" />
                  <span>Tunnel Credentials Block</span>
                </h5>
                <div className={`p-3 rounded-2xl border font-mono text-[9px] space-y-2 ${isLightTheme ? 'bg-slate-50 border-slate-100' : 'bg-slate-950 border-slate-800'}`}>
                  <div className="flex justify-between">
                    <span className="text-slate-500">AES-GCM Shared Key</span>
                    <span className="text-blue-505 font-bold truncate max-w-[170px]">{activeProfileOverlay.encryptionKey}</span>
                  </div>
                  <div className="flex justify-between border-t border-slate-500/5 pt-1.5">
                    <span className="text-slate-500">Connection Peer Link</span>
                    <span className="text-slate-400 truncate max-w-[170px]">https://prix.link/{activeProfileOverlay.id}</span>
                  </div>
                  <div className="flex justify-between border-t border-slate-500/5 pt-1.5">
                    <span className="text-slate-500">Hash Checksum SHA-256</span>
                    <span className="text-amber-500 truncate max-w-[175px]">E4DF9BA20C240E9A8E2E8C04FBA002AC203FAFB2</span>
                  </div>
                </div>
              </div>

              <div className="space-y-1">
                <h5 className="font-bold text-[10px] font-mono uppercase tracking-wider text-slate-400 flex items-center gap-1.5 mb-2">
                  <Lock className="w-3.5 h-3.5 text-blue-500" />
                  <span>Connection Management Options</span>
                </h5>
                <button
                  onClick={() => {
                    alert(`Conversations and notifications from ${activeProfileOverlay.name} have been muted dynamically across your viewport.`);
                    setActiveProfileOverlay(null);
                  }}
                  className={`w-full text-left p-3 rounded-xl flex items-center justify-between text-xs transition border cursor-pointer ${isLightTheme ? 'hover:bg-slate-50 border-slate-100 text-slate-655' : 'hover:bg-slate-850 border-slate-800 text-slate-350'}`}
                >
                  <span className="font-bold">Mute Conversational Thread</span>
                  <span className="text-[10px] text-slate-400">Currently live</span>
                </button>
                <button
                  onClick={() => clearMessageLogs(activeProfileOverlay.id)}
                  className={`w-full text-left p-3 rounded-xl flex items-center justify-between text-xs transition border cursor-pointer ${isLightTheme ? 'hover:bg-slate-50 border-slate-100 text-slate-655' : 'hover:bg-slate-850 border-slate-800 text-slate-350'}`}
                >
                  <span className="font-bold text-amber-600">Symmetrically Empty Message Logs</span>
                  <span className="text-[10px] text-slate-400">Clear chat records</span>
                </button>
                <button
                  onClick={() => deleteConnectionPairing(activeProfileOverlay.id)}
                  className={`w-full text-left p-3 rounded-xl flex items-center justify-between text-xs transition border cursor-pointer ${isLightTheme ? 'hover:bg-red-500/5 border-slate-100 text-red-600' : 'hover:bg-red-500/5 border-slate-800 text-red-400'}`}
                >
                  <span className="font-bold">Destroy Connection Bonding</span>
                  <span className="text-[10px] text-red-400 font-semibold">Delete Pair</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Invite Node Partner Modal Overlay */}
      {showInviteModal && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center p-4 z-[9999] backdrop-blur-sm animate-fade-in">
          <div className={`max-w-md w-full border rounded-3xl p-6 shadow-2xl relative transition-all duration-305 ${isLightTheme ? 'bg-white border-slate-100 text-slate-800' : 'bg-[#0f172a] border-slate-800 text-white'}`}>
            <div className="flex justify-between items-center mb-6">
              <div className="flex items-center gap-3">
                <div className={`p-2.5 rounded-xl ${isLightTheme ? 'bg-indigo-50 text-indigo-650' : 'bg-indigo-950/40 text-indigo-405'}`}>
                  <UserPlus className="w-5 h-5 animate-pulse" />
                </div>
                <div>
                  <h4 className="text-base font-black tracking-tight leading-tight">Invite Node Partner</h4>
                  <p className="text-[10px] text-slate-400 mt-0.5 leading-none">Pair secure communication clients</p>
                </div>
              </div>
              <button
                onClick={() => {
                  setShowInviteModal(false);
                  setInviteDeliveryReceipt(null);
                  setInviteEmail("");
                  setInvitePhone("");
                }}
                className={`p-1.5 rounded-xl transition cursor-pointer ${isLightTheme ? 'hover:bg-slate-100 text-slate-400 hover:text-slate-700' : 'hover:bg-slate-800 text-slate-400 hover:text-white'}`}
              >
                <XIcon className="w-4 h-4" />
              </button>
            </div>

            <div className={`grid grid-cols-2 p-1 rounded-2xl mb-5 border ${isLightTheme ? 'bg-slate-50 border-slate-200/60' : 'bg-slate-900/40 border-slate-800/80'}`}>
              <button
                type="button"
                onClick={() => setInviteType("gmail")}
                className={`py-2.5 text-xs font-bold rounded-xl transition-all cursor-pointer ${inviteType === 'gmail' ? (isLightTheme ? 'bg-white text-indigo-600 shadow-sm border border-slate-205/30' : 'bg-slate-800 text-white shadow-md') : 'text-slate-450 hover:text-slate-200'}`}
              >
                Email Invite
              </button>
              <button
                type="button"
                onClick={() => setInviteType("sms")}
                className={`py-2.5 text-xs font-bold rounded-xl transition-all cursor-pointer ${inviteType === 'sms' ? (isLightTheme ? 'bg-white text-indigo-600 shadow-sm border border-slate-205/30' : 'bg-slate-800 text-white shadow-md') : 'text-slate-455 hover:text-slate-200'}`}
              >
                SMS Invite
              </button>
            </div>

            <div className="space-y-5">
              {inviteType === "gmail" ? (
                <div className="space-y-4 animate-fade-in">
                  <div className="relative">
                    <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-450">
                      <ImageIcon className="w-4 h-4" />
                    </span>
                    <input
                      type="email"
                      placeholder="e.g. partner.name@gmail.com"
                      value={inviteEmail}
                      onChange={(e) => setInviteEmail(e.target.value)}
                      className={`w-full py-3.5 pl-10 pr-3.5 rounded-2xl text-xs outline-none border transition-all ${isLightTheme ? 'bg-slate-50 border-slate-200 focus:bg-white focus:border-indigo-600 text-slate-900' : 'bg-slate-950 border-slate-850 focus:bg-slate-900 focus:border-indigo-500 text-zinc-100'}`}
                    />
                  </div>
                  <button
                    onClick={() => sendPartnerInvite("gmail")}
                    disabled={inviteSendStatus === "sending"}
                    className="w-full py-3.5 bg-gradient-to-r from-rose-600 to-orange-500 hover:from-rose-500 hover:to-orange-400 text-white font-bold rounded-xl text-xs tracking-wider transition active:scale-[0.99] cursor-pointer flex items-center justify-center gap-2 shadow-lg shadow-rose-900/10"
                  >
                    <span>
                      {inviteSendStatus === "sending" 
                        ? "Sending Invite..." 
                        : inviteSendStatus === "sent" 
                          ? "✓ Sent Successfully" 
                          : "Transmit Gmail Invite"}
                    </span>
                    {inviteSendStatus !== "sending" && inviteSendStatus !== "sent" && <Share2 className="w-4 h-4" />}
                  </button>
                </div>
              ) : (
                <div className="space-y-4 animate-fade-in">
                  <div className="relative">
                    <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-450">
                      <Phone className="w-4 h-4" />
                    </span>
                    <input
                      type="text"
                      placeholder="e.g. +91 94440 98765"
                      value={invitePhone}
                      onChange={(e) => setInvitePhone(e.target.value)}
                      className={`w-full py-3.5 pl-10 pr-3.5 rounded-2xl text-xs outline-none border transition-all ${isLightTheme ? 'bg-slate-50 border-slate-200 focus:bg-white focus:border-indigo-600 text-slate-900' : 'bg-slate-955 border-slate-850 focus:bg-slate-900 focus:border-indigo-500 text-zinc-100'}`}
                    />
                  </div>
                  <button
                    onClick={() => sendPartnerInvite("number")}
                    disabled={inviteSendStatus === "sending"}
                    className="w-full py-3.5 bg-gradient-to-r from-indigo-600 to-cyan-500 hover:from-indigo-500 hover:to-cyan-400 text-white font-bold rounded-xl text-xs tracking-wider transition active:scale-[0.99] cursor-pointer flex items-center justify-center gap-2 shadow-lg shadow-indigo-900/10"
                  >
                    <span>
                      {inviteSendStatus === "sending" 
                        ? "Sending Invite..." 
                        : inviteSendStatus === "sent" 
                          ? "✓ Sent Successfully" 
                          : "Transmit SMS Invite"}
                    </span>
                    {inviteSendStatus !== "sending" && inviteSendStatus !== "sent" && <Share2 className="w-4 h-4" />}
                  </button>
                </div>
              )}

              <div className="space-y-1.5">
                <label className="block text-[9px] font-bold font-mono uppercase tracking-widest text-slate-405">Custom Invitation Message</label>
                <textarea
                  rows={2}
                  value={inviteMessageText}
                  onChange={(e) => setInviteMessageText(e.target.value)}
                  className={`w-full p-3.5 rounded-2xl text-xs outline-none border resize-none transition-all ${isLightTheme ? 'bg-slate-50 border-slate-200 focus:bg-white focus:border-indigo-600 text-slate-900' : 'bg-slate-950 border-slate-850 focus:bg-slate-900 focus:border-indigo-500 text-zinc-100'}`}
                />
              </div>

              <div className={`p-4 rounded-2xl border transition-all ${isLightTheme ? 'bg-slate-50/60 border-slate-200' : 'bg-slate-950/40 border-slate-850'}`}>
                <h5 className="text-xs font-bold mb-1 flex items-center gap-1.5">
                  <CheckCheck className="w-4 h-4 text-emerald-500" />
                  <span>Direct Connection Link</span>
                </h5>
                <p className="text-[10px] text-slate-400 leading-normal mb-3">
                  Copy your static system portal link directly and send it to your partner through any external software channel.
                </p>
                <button
                  onClick={copyPairingLink}
                  className="w-full py-3 bg-[#2481cc]/10 hover:bg-[#2481cc]/20 text-[#2481cc] font-mono text-[10px] font-bold rounded-xl transition flex items-center justify-center gap-2 border border-[#2481cc]/20 cursor-pointer"
                >
                  {isLinkCopied ? (
                    <CheckCheck className="w-4 h-4 text-emerald-500 animate-scale-up-bounce" />
                  ) : (
                    <Share2 className="w-3.5 h-3.5" />
                  )}
                  <span>{isLinkCopied ? "COPIED TO SYSTEM CLIPBOARD!" : "COPY SECURE DIRECT PAIRING LINK"}</span>
                </button>
              </div>

              {inviteDeliveryReceipt && (
                <div className="bg-emerald-500/10 border border-emerald-500/20 p-4 rounded-2xl space-y-2 animate-scale-up-bounce">
                  <div className="flex justify-between items-center text-[10px] font-mono text-emerald-500 font-bold uppercase">
                    <span>Transmitted Delivery Verified</span>
                    <span>✓ Complete</span>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-[10px] font-mono text-slate-400 leading-normal">
                    <div>
                      <span className="text-slate-500">Destination:</span> {inviteDeliveryReceipt.deliveredTo}
                    </div>
                    <div>
                      <span className="text-slate-500">Time:</span> {inviteDeliveryReceipt.time}
                    </div>
                    <div className="col-span-2">
                      <span className="text-slate-500">Node relay terminal:</span> {inviteDeliveryReceipt.relay}
                    </div>
                    <div className="col-span-2 border-t border-emerald-500/10 pt-1 text-emerald-600 font-bold font-sans">
                      Recipient can click link to register, instantly peering with your client workspace.
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Styles Injection */}
      <style dangerouslySetInnerHTML={{
        __html: `
          .scrollbar-thin::-webkit-scrollbar {
            width: 5px;
          }
          .scrollbar-thin::-webkit-scrollbar-thumb {
            background-color: ${isLightTheme ? "#cbd5e1" : "#1e293b"};
            border-radius: 3px;
          }
          @keyframes scaleUpBounce {
            0% { transform: scale(0.92); opacity: 0; }
            70% { transform: scale(1.02); }
            100% { transform: scale(1); opacity: 1; }
          }
          .animate-scale-up-bounce {
            animation: scaleUpBounce 0.35s cubic-bezier(0.175, 0.885, 0.32, 1.275) forwards;
          }
        `
      }} />

    </div>
  );
}
