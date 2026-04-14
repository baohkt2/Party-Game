// Pusher configuration cho real-time communication

import Pusher from 'pusher';
import PusherClient from 'pusher-js';
import { getSessionValue } from '@/lib/clientSession';

function getChannelAuthParams() {
  return {
    playerId: getSessionValue('playerId') || '',
    playerName: getSessionValue('playerName') || '',
    playerAvatar: getSessionValue('playerAvatar') || '',
    roomId: getSessionValue('roomId') || '',
  };
}

// Server-side Pusher instance (dùng trong API routes)
export const pusherServer = new Pusher({
  appId: process.env.PUSHER_APP_ID || '',
  key: process.env.NEXT_PUBLIC_PUSHER_KEY || '',
  secret: process.env.PUSHER_SECRET || '',
  cluster: process.env.NEXT_PUBLIC_PUSHER_CLUSTER || '',
  useTLS: true,
});

// Client-side Pusher instance (dùng trong components)
export const pusherClient = new PusherClient(
  process.env.NEXT_PUBLIC_PUSHER_KEY || '',
  {
    cluster: process.env.NEXT_PUBLIC_PUSHER_CLUSTER || '',
    channelAuthorization: {
      endpoint: '/api/pusher/auth',
      transport: 'ajax',
      paramsProvider: getChannelAuthParams,
    },
  }
);

// Event types - centralized constants
export const PUSHER_EVENTS = {
  PLAYER_JOINED: 'player-joined',
  PLAYER_LEFT: 'player-left',
  GAME_STARTED: 'game-started',
  GAME_UPDATE: 'game-update',
  SCORE_UPDATE: 'score-update',
  ROOM_CLOSED: 'room-closed',
  REFLEX_RESULT: 'reflex-result',
  REFLEX_ALL_DONE: 'reflex-all-done',
  REFLEX_NEXT_ROUND: 'reflex-next-round',
} as const;

// Helper function để tạo channel name
export const getRoomChannel = (roomId: string) => `room-${roomId}`;
export const getPresenceRoomChannel = (roomId: string) => `presence-room-${roomId}`;
