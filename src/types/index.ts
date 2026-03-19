// TypeScript Types cho Party Game

export interface Player {
  id: string;
  name: string;
  avatar: string;
  totalScore: number;
  gameScores: {
    game1: number;
    game2: number;
    game3: number;
    game4: number;
    game5: number;
  };
}

export interface Room {
  id: string;
  hostId: string;
  players: Player[];
  status: RoomStatus;
  currentGame: number;
}

export type RoomStatus = 'waiting' | 'playing' | 'finished';

export interface GameState {
  roomId: string;
  gameNumber: number;
  phase: string;
  data: Record<string, unknown>;
}

// Game-specific types
export type GamePhase = {
  reflex: 'waiting' | 'ready' | 'go' | 'result';
  wheel: 'submit' | 'spin' | 'challenge' | 'judge' | 'result';
  whoisit: 'question' | 'countdown' | 'voting' | 'result';
  truthOrDare: 'selection' | 'prompt' | 'judge' | 'result';
  poker: 'phase1' | 'phase2' | 'phase3' | 'result';
};

// API Response wrapper
export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
}

// Pusher event payloads
export interface PlayerJoinedPayload {
  playerId: string;
  playerName: string;
  avatar: string;
}

export interface ScoreUpdatePayload {
  players: Player[];
}

export interface GameUpdatePayload {
  currentGame: number;
  phase?: string;
}
