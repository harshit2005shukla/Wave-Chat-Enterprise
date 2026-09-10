import { useEffect, useRef, useState } from 'react';
import type { Socket } from 'socket.io-client';
import type { User } from '../types';
import { Avatar } from './Avatar';

export interface CallState {
  direction: 'incoming' | 'outgoing';
  peer: User;
  type: 'audio' | 'video';
  callId?: string;
  offer?: RTCSessionDescriptionInit;
}
export function CallOverlay({ socket, call, onClose }: { socket: Socket; call: CallState; onClose(): void }) {
  const localVideo = useRef<HTMLVideoElement>(null); const remoteVideo = useRef<HTMLVideoElement>(null); const pc = useRef<RTCPeerConnection | null>(null); const localStream = useRef<MediaStream | null>(null);
  const callId = useRef<string | undefined>(call.callId); const pendingIce = useRef<RTCIceCandidateInit[]>([]); const remoteIce = useRef<RTCIceCandidateInit[]>([]);
  const [phase, setPhase] = useState(call.direction === 'incoming' ? 'Incoming call' : 'Calling…'); const [accepted, setAccepted] = useState(call.direction === 'outgoing');

  async function buildPeer() {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: call.type === 'video' });
    localStream.current = stream; if (localVideo.current) localVideo.current.srcObject = stream;
    const connection = new RTCPeerConnection({ iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] }); pc.current = connection;
    stream.getTracks().forEach(track => connection.addTrack(track, stream));
    connection.ontrack = event => { if (remoteVideo.current) remoteVideo.current.srcObject = event.streams[0]; };
    connection.onicecandidate = event => {
      if (!event.candidate) return;
      if (!callId.current) pendingIce.current.push(event.candidate.toJSON());
      else socket.emit('call:ice', { targetUserId: call.peer._id, callId: callId.current, candidate: event.candidate.toJSON() });
    };
    connection.onconnectionstatechange = () => {
      if (connection.connectionState === 'connected') setPhase('Connected');
      if (['failed', 'disconnected'].includes(connection.connectionState)) setPhase('Connection interrupted');
    };
    return connection;
  }

  async function startOutgoing() {
    try {
      const connection = await buildPeer(); const offer = await connection.createOffer(); await connection.setLocalDescription(offer);
      socket.emit('call:offer', { calleeId: call.peer._id, type: call.type, offer }, (result: { ok: boolean; callId?: string; error?: string }) => {
        if (!result.ok || !result.callId) return setPhase(result.error ?? 'Call failed');
        callId.current = result.callId;
        for (const candidate of pendingIce.current) socket.emit('call:ice', { targetUserId: call.peer._id, callId: result.callId, candidate });
        pendingIce.current = [];
      });
    } catch (error) { setPhase(error instanceof Error ? error.message : 'Unable to access camera or microphone'); }
  }
  async function acceptIncoming() {
    try {
      setAccepted(true); setPhase('Connecting…'); const connection = await buildPeer();
      await connection.setRemoteDescription(call.offer!); for (const candidate of remoteIce.current.splice(0)) await connection.addIceCandidate(candidate); const answer = await connection.createAnswer(); await connection.setLocalDescription(answer);
      socket.emit('call:answer', { callId: call.callId, callerId: call.peer._id, answer });
    } catch (error) { setPhase(error instanceof Error ? error.message : 'Unable to accept call'); }
  }
  function end() {
    if (callId.current) socket.emit('call:end', { callId: callId.current, targetUserId: call.peer._id, reason: 'ended' });
    onClose();
  }
  useEffect(() => {
    const answered = async ({ callId: id, answer }: { callId: string; answer: RTCSessionDescriptionInit }) => { if (id === callId.current && pc.current) { await pc.current.setRemoteDescription(answer); for (const candidate of remoteIce.current.splice(0)) await pc.current.addIceCandidate(candidate); setPhase('Connecting…'); } };
    const ice = async ({ callId: id, candidate }: { callId: string; candidate: RTCIceCandidateInit }) => { if (!callId.current || id === callId.current) { if (pc.current?.remoteDescription) await pc.current.addIceCandidate(candidate); else remoteIce.current.push(candidate); } };
    const ended = ({ callId: id }: { callId: string }) => { if (!callId.current || id === callId.current) { setPhase('Call ended'); window.setTimeout(onClose, 700); } };
    socket.on('call:answered', answered); socket.on('call:ice', ice); socket.on('call:ended', ended);
    if (call.direction === 'outgoing') startOutgoing();
    return () => { socket.off('call:answered', answered); socket.off('call:ice', ice); socket.off('call:ended', ended); pc.current?.close(); localStream.current?.getTracks().forEach(track => track.stop()); };
  }, []);
  return <div className="call-overlay">
    <div className="call-stage">
      {call.type === 'video' && accepted ? <><video ref={remoteVideo} autoPlay playsInline className="remote-video" /><video ref={localVideo} autoPlay muted playsInline className="local-video" /></> : <div className="audio-call-identity"><Avatar user={call.peer} size="lg" /><h2>{call.peer.name}</h2><p>{phase}</p></div>}
      {call.direction === 'incoming' && !accepted && <div className="incoming-actions"><button className="accept-call" onClick={acceptIncoming}>Accept</button><button className="end-call" onClick={end}>Decline</button></div>}
      {(call.direction === 'outgoing' || accepted) && <div className="call-controls"><span>{phase}</span><button className="end-call" onClick={end}>End call</button></div>}
    </div>
  </div>;
}
