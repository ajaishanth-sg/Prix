/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface Message {
  id: string;
  senderId: string;
  senderName: string;
  text: string;
  timestamp: string;
  fileUrl?: string;
  fileId?: string; // Google Drive file ID
  fileName?: string;
  fileType?: 'image' | 'video' | 'audio' | 'document';
  fileSize?: string;
  isEncrypted: boolean;
  encryptionKeyHash?: string;
  createdAt?: string; // Sort ordering metadata
  location?: { lat: number; lng: number; address: string };
  poll?: { question: string; options: { text: string; votes: number; voters: string[] }[]; totalVotes: number };
  checklist?: { title: string; items: { id: string; text: string; checked: boolean }[] };
  contactInfo?: { name: string; phone: string; email?: string };
  walletTransfer?: { amount: string; symbol: string; senderAddress: string; receiverAddress: string; txHash: string; status: 'completed' | 'pending'; isGPay?: boolean };
}

export interface Contact {
  id: string;
  name: string;
  avatar: string;
  status: string;
  isOnline: boolean;
  unreadCount?: number;
}

export interface ChatSession {
  id: string;
  name: string;
  avatar: string;
  platform: 'intergram' | 'telegram' | 'whatsapp';
  type: 'direct' | 'group' | 'bridge';
  lastMessage?: string;
  lastMessageTime?: string;
  messages: Message[];
  encryptionKey: string; // Symmetric E2EE key representing the shared secret
  contactId?: string;
  contactEmail?: string;
  contactPhone?: string;
}

export interface NewsArticle {
  id: string;
  title: string;
  category: string;
  summary: string;
  source: string;
  imageUrl: string;
  time: string;
  likes: number;
  url?: string;
  content?: string;
}
