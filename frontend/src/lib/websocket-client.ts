'use client';

import { io, Socket } from 'socket.io-client';
import { tokenStore } from './token-store';

const WS_URL = process.env.NEXT_PUBLIC_WS_URL ?? 'http://localhost:3000';

/**
 * Thin wrapper around socket.io-client, matching backend's ChatGateway
 * contract exactly (see backend/src/modules/websocket/chat.gateway.ts):
 * connects to the /chat namespace with the JWT access token in the
 * handshake auth payload, and exposes the same event names the gateway
 * emits/listens for. A single shared instance is reused across the app
 * (created lazily on first use, disconnected on logout).
 */
class ChatSocketClient {
  private socket: Socket | null = null;

  connect(): Socket {
    if (this.socket?.connected) return this.socket;

    const token = tokenStore.getAccessToken();
    this.socket = io(`${WS_URL}/chat`, {
      auth: { token },
      transports: ['websocket'],
      autoConnect: true,
    });
    return this.socket;
  }

  getSocket(): Socket | null {
    return this.socket;
  }

  joinConversation(conversationId: string) {
    this.socket?.emit('joinConversation', { conversationId });
  }

  leaveConversation(conversationId: string) {
    this.socket?.emit('leaveConversation', { conversationId });
  }

  sendMessage(conversationId: string, text: string) {
    this.socket?.emit('sendMessage', { conversationId, text });
  }

  sendTyping(conversationId: string, isTyping: boolean) {
    this.socket?.emit('typing', { conversationId, isTyping });
  }

  markRead(conversationId: string, upToMessageId?: string) {
    this.socket?.emit('markRead', { conversationId, upToMessageId });
  }

  disconnect() {
    this.socket?.disconnect();
    this.socket = null;
  }
}

export const chatSocket = new ChatSocketClient();
