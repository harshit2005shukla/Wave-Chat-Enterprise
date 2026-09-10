import { useEffect, useState } from 'react';
import { io, type Socket } from 'socket.io-client';
import { storage } from '../lib/storage';
const SOCKET_URL = import.meta.env.VITE_SOCKET_URL ?? 'http://localhost:4000';
export function useSocket() {
  const [socket, setSocket] = useState<Socket | null>(null);
  useEffect(() => {
    const token = storage.getAccess(); if (!token) return;
    const next = io(SOCKET_URL, { auth: { token }, transports: ['websocket', 'polling'], reconnection: true });
    setSocket(next);
    return () => { next.disconnect(); setSocket(null); };
  }, []);
  return socket;
}
