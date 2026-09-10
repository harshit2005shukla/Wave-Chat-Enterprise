export type UserRole = 'user' | 'moderator' | 'admin';
export interface User {
  _id: string;
  name: string;
  phone: string;
  role?: UserRole;
  avatarUrl?: string;
  about?: string;
  publicKeyJwk?: JsonWebKey;
  isOnline?: boolean;
  lastSeenAt?: string;
}
export interface WrappedKey {
  user: string;
  wrappedKey: string;
  iv: string;
  wrapperPublicKeyJwk: JsonWebKey;
}
export interface Conversation {
  _id: string;
  type: 'direct' | 'group';
  title?: string;
  avatarUrl?: string;
  members: User[];
  admins: string[];
  createdBy: User | string;
  wrappedKeys: WrappedKey[];
  lastMessageAt?: string;
  createdAt: string;
}
export type MessageType = 'text' | 'image' | 'video' | 'audio' | 'document' | 'system';
export interface Message {
  _id: string;
  conversation: string;
  sender: User;
  clientId: string;
  type: MessageType;
  ciphertext: string;
  iv: string;
  mediaUrl?: string;
  mediaName?: string;
  mediaMime?: string;
  mediaSize?: number;
  replyTo?: string;
  deliveredTo: string[];
  readBy: string[];
  editedAt?: string;
  deletedForEveryoneAt?: string;
  createdAt: string;
  plaintext?: string;
}
export interface StatusItem {
  _id: string;
  owner: User;
  type: 'text' | 'image' | 'video';
  ciphertext: string;
  iv: string;
  mediaUrl?: string;
  background?: string;
  audience: string[];
  wrappedKeys: WrappedKey[];
  viewedBy: { user: string; viewedAt: string }[];
  expiresAt: string;
  createdAt: string;
  plaintext?: string;
}
export interface AuthResponse { user: User; accessToken: string; refreshToken: string }
