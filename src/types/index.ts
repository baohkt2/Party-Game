// TypeScript Types cho Party Game – Modular Architecture

export interface Player {
  id: string;
  name: string;
  avatar: string;
  totalScore: number;
  gameScores: Record<string, number>;  // roundIndex → score
}

export interface RoundConfig {
  gameId: string;       // 'reflex', 'roulette', etc.
  subRounds: number;    // number of sub-rounds in this round
  rewards: {
    win: number;
    lose: number;
  };
}

export interface RoomConfig {
  rounds: RoundConfig[];
}

export interface Room {
  id: string;
  hostId: string;
  players: Player[];
  status: RoomStatus;
  currentGame: number;    // current round index (0-based in config, 1-based in display)
  config?: RoomConfig;
}

export type RoomStatus = 'waiting' | 'configuring' | 'playing' | 'finished';

export interface RoomListItem {
  id: string;
  status: RoomStatus;
  currentGame: number;
  playerCount: number;
  createdAt: string;
  statusChangedAt: string;
}

export interface GameState {
  roomId: string;
  gameNumber: number;
  phase: string;
  data: Record<string, unknown>;
}

// Legacy GamePhase types (kept for component compatibility)
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
