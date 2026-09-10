import type { Server as HttpServer } from 'node:http';
import { Server, type Socket } from 'socket.io';
import { z } from 'zod';
import { User } from '../models/User.js';
import { Conversation } from '../models/Conversation.js';
import { Message } from '../models/Message.js';
import { CallSession } from '../models/CallSession.js';
import { verifyAccessToken } from '../services/tokenService.js';
import { env } from '../config/env.js';

interface AuthSocket extends Socket { data: { userId: string; role: string } }
const messageSchema = z.object({
  conversationId: z.string().min(1), clientId: z.string().uuid(),
  type: z.enum(['text', 'image', 'video', 'audio', 'document', 'system']),
  ciphertext: z.string().min(1), iv: z.string().min(1),
  mediaUrl: z.string().optional(), mediaName: z.string().optional(), mediaMime: z.string().optional(),
  mediaSize: z.number().optional(), replyTo: z.string().optional()
});

export function createSocketServer(httpServer: HttpServer) {
  const io = new Server(httpServer, { cors: { origin: env.CLIENT_ORIGIN, credentials: true }, maxHttpBufferSize: 2e6 });

  io.use(async (socket, next) => {
    try {
      const raw = socket.handshake.auth?.token || socket.handshake.headers.authorization?.toString().replace('Bearer ', '');
      if (!raw) return next(new Error('Authentication required'));
      const payload = verifyAccessToken(raw);
      const user = await User.findById(payload.sub);
      if (!user || !user.isActive) return next(new Error('Account unavailable'));
      socket.data.userId = String(user._id); socket.data.role = user.role;
      next();
    } catch { next(new Error('Invalid or expired token')); }
  });

  io.on('connection', async (rawSocket) => {
    const socket = rawSocket as AuthSocket;
    const userId = socket.data.userId;
    socket.join(`user:${userId}`);
    const conversations = await Conversation.find({ members: userId }).select('_id members');
    for (const conversation of conversations) socket.join(`conversation:${conversation._id}`);
    await User.updateOne({ _id: userId }, { isOnline: true, lastSeenAt: new Date() });
    broadcastPresence(io, conversations, userId, true);

    socket.on('conversation:join', async (conversationId: string, ack?: Function) => {
      const allowed = await Conversation.exists({ _id: conversationId, members: userId });
      if (!allowed) return ack?.({ ok: false, error: 'Access denied' });
      await socket.join(`conversation:${conversationId}`);
      ack?.({ ok: true });
    });

    socket.on('message:send', async (raw: unknown, ack?: Function) => {
      try {
        const body = messageSchema.parse(raw);
        const conversation = await Conversation.findOne({ _id: body.conversationId, members: userId });
        if (!conversation) throw new Error('Conversation not found');
        let message = await Message.findOne({ sender: userId, clientId: body.clientId });
        if (!message) {
          message = await Message.create({
            conversation: body.conversationId, sender: userId, clientId: body.clientId,
            type: body.type, ciphertext: body.ciphertext, iv: body.iv,
            mediaUrl: body.mediaUrl, mediaName: body.mediaName, mediaMime: body.mediaMime,
            mediaSize: body.mediaSize, replyTo: body.replyTo,
            deliveredTo: [userId], readBy: [userId]
          });
          conversation.lastMessageAt = message.createdAt; await conversation.save();
        }
        await message.populate('sender', 'name avatarUrl');
        io.to(`conversation:${body.conversationId}`).emit('message:new', message);
        ack?.({ ok: true, messageId: String(message._id) });
      } catch (error: any) { ack?.({ ok: false, error: error.message ?? 'Unable to send message' }); }
    });

    socket.on('message:delivered', async ({ messageId }: { messageId: string }) => {
      const message = await Message.findById(messageId);
      if (!message || !(await Conversation.exists({ _id: message.conversation, members: userId }))) return;
      await Message.updateOne({ _id: messageId }, { $addToSet: { deliveredTo: userId } });
      io.to(`conversation:${message.conversation}`).emit('message:receipt', { messageId, userId, kind: 'delivered', at: new Date() });
    });

    socket.on('message:read', async ({ conversationId, messageIds }: { conversationId: string; messageIds: string[] }) => {
      if (!(await Conversation.exists({ _id: conversationId, members: userId }))) return;
      await Message.updateMany({ _id: { $in: messageIds }, conversation: conversationId }, {
        $addToSet: { deliveredTo: userId, readBy: userId }
      });
      io.to(`conversation:${conversationId}`).emit('message:receipt', { messageIds, userId, kind: 'read', at: new Date() });
    });

    socket.on('message:edit', async (raw: unknown, ack?: Function) => {
      try {
        const body = z.object({ messageId: z.string(), ciphertext: z.string().min(1), iv: z.string().min(1) }).parse(raw);
        const message = await Message.findOne({ _id: body.messageId, sender: userId });
        if (!message) throw new Error('Message not found');
        message.ciphertext = body.ciphertext; message.iv = body.iv; message.editedAt = new Date(); await message.save();
        io.to(`conversation:${message.conversation}`).emit('message:edited', { messageId: body.messageId, ciphertext: body.ciphertext, iv: body.iv, editedAt: message.editedAt });
        ack?.({ ok: true });
      } catch (error: any) { ack?.({ ok: false, error: error.message }); }
    });

    socket.on('message:delete', async ({ messageId }: { messageId: string }, ack?: Function) => {
      const message = await Message.findOne({ _id: messageId, sender: userId });
      if (!message) return ack?.({ ok: false, error: 'Message not found' });
      message.ciphertext = 'deleted'; message.iv = 'deleted'; message.deletedForEveryoneAt = new Date(); await message.save();
      io.to(`conversation:${message.conversation}`).emit('message:deleted', { messageId, deletedAt: message.deletedForEveryoneAt });
      ack?.({ ok: true });
    });

    for (const eventName of ['typing:start', 'typing:stop'] as const) {
      socket.on(eventName, async ({ conversationId }: { conversationId: string }) => {
        if (!(await Conversation.exists({ _id: conversationId, members: userId }))) return;
        socket.to(`conversation:${conversationId}`).emit('typing:update', {
          conversationId, userId, isTyping: eventName === 'typing:start'
        });
      });
    }

    socket.on('call:offer', async (raw: unknown, ack?: Function) => {
      try {
        const body = z.object({ calleeId: z.string(), type: z.enum(['audio', 'video']), offer: z.any() }).parse(raw);
        const shared = await Conversation.exists({ type: 'direct', members: { $all: [userId, body.calleeId] } });
        if (!shared) throw new Error('A direct conversation is required before calling');
        const call = await CallSession.create({ caller: userId, callee: body.calleeId, type: body.type, status: 'ringing' });
        io.to(`user:${body.calleeId}`).emit('call:incoming', { callId: String(call._id), callerId: userId, type: body.type, offer: body.offer });
        ack?.({ ok: true, callId: String(call._id) });
      } catch (error: any) { ack?.({ ok: false, error: error.message }); }
    });

    socket.on('call:answer', async (raw: unknown) => {
      const body = z.object({ callId: z.string(), callerId: z.string(), answer: z.any() }).parse(raw);
      await CallSession.updateOne({ _id: body.callId, callee: userId }, { status: 'accepted', answeredAt: new Date() });
      io.to(`user:${body.callerId}`).emit('call:answered', { callId: body.callId, answer: body.answer });
    });

    socket.on('call:ice', (raw: unknown) => {
      const body = z.object({ targetUserId: z.string(), callId: z.string(), candidate: z.any() }).parse(raw);
      io.to(`user:${body.targetUserId}`).emit('call:ice', { callId: body.callId, fromUserId: userId, candidate: body.candidate });
    });

    socket.on('call:end', async (raw: unknown) => {
      const body = z.object({ callId: z.string(), targetUserId: z.string(), reason: z.string().optional() }).parse(raw);
      await CallSession.updateOne({ _id: body.callId, $or: [{ caller: userId }, { callee: userId }] }, { status: 'ended', endedAt: new Date() });
      io.to(`user:${body.targetUserId}`).emit('call:ended', { callId: body.callId, reason: body.reason ?? 'ended' });
    });

    socket.on('disconnect', async () => {
      const remaining = await io.in(`user:${userId}`).fetchSockets();
      if (remaining.length === 0) {
        const now = new Date();
        await User.updateOne({ _id: userId }, { isOnline: false, lastSeenAt: now });
        broadcastPresence(io, conversations, userId, false, now);
      }
    });
  });
  return io;
}

function broadcastPresence(io: Server, conversations: any[], userId: string, isOnline: boolean, lastSeenAt = new Date()) {
  const memberIds = new Set<string>();
  for (const conversation of conversations) for (const id of conversation.members ?? []) memberIds.add(String(id));
  for (const id of memberIds) if (id !== userId) io.to(`user:${id}`).emit('presence:update', { userId, isOnline, lastSeenAt });
}
