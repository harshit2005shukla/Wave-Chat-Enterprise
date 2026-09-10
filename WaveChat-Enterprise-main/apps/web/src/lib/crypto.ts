import type { Conversation, User, WrappedKey } from '../types';

const IDENTITY_KEY = 'wavechat.crypto.identity.v1';
const groupCache = new Map<string, CryptoKey>();
const directCache = new Map<string, CryptoKey>();

interface StoredIdentity { privateKeyJwk: JsonWebKey; publicKeyJwk: JsonWebKey }
const encoder = new TextEncoder();
const decoder = new TextDecoder();

function bytesToBase64(bytes: Uint8Array) {
  let binary = ''; for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}
function base64ToBytes(value: string) {
  const binary = atob(value); const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

export async function getOrCreateIdentity(): Promise<StoredIdentity> {
  const existing = localStorage.getItem(IDENTITY_KEY);
  if (existing) return JSON.parse(existing) as StoredIdentity;
  const pair = await crypto.subtle.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, true, ['deriveBits']);
  const identity = {
    privateKeyJwk: await crypto.subtle.exportKey('jwk', pair.privateKey),
    publicKeyJwk: await crypto.subtle.exportKey('jwk', pair.publicKey)
  };
  localStorage.setItem(IDENTITY_KEY, JSON.stringify(identity));
  return identity;
}

async function importPrivate(jwk: JsonWebKey) {
  return crypto.subtle.importKey('jwk', jwk, { name: 'ECDH', namedCurve: 'P-256' }, false, ['deriveBits']);
}
async function importPublic(jwk: JsonWebKey) {
  return crypto.subtle.importKey('jwk', jwk, { name: 'ECDH', namedCurve: 'P-256' }, false, []);
}
async function deriveAes(peerPublicJwk: JsonWebKey, context: string) {
  const identity = await getOrCreateIdentity();
  const privateKey = await importPrivate(identity.privateKeyJwk);
  const publicKey = await importPublic(peerPublicJwk);
  const shared = await crypto.subtle.deriveBits({ name: 'ECDH', public: publicKey }, privateKey, 256);
  const base = await crypto.subtle.importKey('raw', shared, 'HKDF', false, ['deriveKey']);
  return crypto.subtle.deriveKey({
    name: 'HKDF', hash: 'SHA-256', salt: encoder.encode(context), info: encoder.encode('wavechat-v1')
  }, base, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
}

export async function encryptText(key: CryptoKey, plaintext: string) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encrypted = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, encoder.encode(plaintext));
  return { ciphertext: bytesToBase64(new Uint8Array(encrypted)), iv: bytesToBase64(iv) };
}
export async function decryptText(key: CryptoKey, ciphertext: string, iv: string) {
  if (ciphertext === 'deleted') return 'This message was deleted';
  const decrypted = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: base64ToBytes(iv) }, key, base64ToBytes(ciphertext));
  return decoder.decode(decrypted);
}

export async function createRandomAesKey() {
  const raw = crypto.getRandomValues(new Uint8Array(32));
  const key = await crypto.subtle.importKey('raw', raw, 'AES-GCM', true, ['encrypt', 'decrypt']);
  return { key, raw };
}
export async function importRawAes(raw: Uint8Array) {
  return crypto.subtle.importKey('raw', raw, 'AES-GCM', true, ['encrypt', 'decrypt']);
}
export async function wrapRawKey(raw: Uint8Array, peerPublicJwk: JsonWebKey, recipientUserId: string): Promise<Omit<WrappedKey, 'user'>> {
  const wrapKey = await deriveAes(peerPublicJwk, `group-wrap:${recipientUserId}`);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encrypted = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, wrapKey, raw);
  const identity = await getOrCreateIdentity();
  return { wrappedKey: bytesToBase64(new Uint8Array(encrypted)), iv: bytesToBase64(iv), wrapperPublicKeyJwk: identity.publicKeyJwk };
}
export async function unwrapRawKey(envelope: WrappedKey, myUserId: string) {
  const wrapKey = await deriveAes(envelope.wrapperPublicKeyJwk, `group-wrap:${myUserId}`);
  const raw = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: base64ToBytes(envelope.iv) }, wrapKey, base64ToBytes(envelope.wrappedKey));
  return new Uint8Array(raw);
}

export async function conversationKey(conversation: Conversation, currentUser: User) {
  const cached = conversation.type === 'direct' ? directCache.get(conversation._id) : groupCache.get(conversation._id);
  if (cached) return cached;
  if (conversation.type === 'direct') {
    const peer = conversation.members.find(member => member._id !== currentUser._id);
    if (!peer?.publicKeyJwk) throw new Error('The other device has not registered an encryption key yet');
    const key = await deriveAes(peer.publicKeyJwk, `direct:${conversation._id}`);
    directCache.set(conversation._id, key); return key;
  }
  const stored = localStorage.getItem(`wavechat.group.${conversation._id}`);
  if (stored) {
    const key = await importRawAes(base64ToBytes(stored)); groupCache.set(conversation._id, key); return key;
  }
  const envelope = conversation.wrappedKeys.find(item => String(item.user) === currentUser._id);
  if (!envelope) throw new Error('No encrypted group key is available for this device');
  const raw = await unwrapRawKey(envelope, currentUser._id);
  localStorage.setItem(`wavechat.group.${conversation._id}`, bytesToBase64(raw));
  const key = await importRawAes(raw); groupCache.set(conversation._id, key); return key;
}

export function rememberGroupKey(conversationId: string, raw: Uint8Array, key: CryptoKey) {
  localStorage.setItem(`wavechat.group.${conversationId}`, bytesToBase64(raw)); groupCache.set(conversationId, key);
}

export async function createWrappedKeys(users: User[]) {
  const { key, raw } = await createRandomAesKey();
  const wrappedKeys: WrappedKey[] = [];
  for (const user of users) {
    if (!user.publicKeyJwk) throw new Error(`${user.name} has not registered an encryption key`);
    wrappedKeys.push({ user: user._id, ...(await wrapRawKey(raw, user.publicKeyJwk, user._id)) });
  }
  return { key, raw, wrappedKeys };
}

export async function statusKey(status: { _id: string; wrappedKeys: WrappedKey[] }, currentUser: User) {
  const cacheId = `status:${status._id}`;
  const cached = groupCache.get(cacheId); if (cached) return cached;
  const envelope = status.wrappedKeys.find(item => String(item.user) === currentUser._id);
  if (!envelope) throw new Error('Status key is unavailable');
  const raw = await unwrapRawKey(envelope, currentUser._id);
  const key = await importRawAes(raw); groupCache.set(cacheId, key); return key;
}
