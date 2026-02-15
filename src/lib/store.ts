// Zustand Store - Global state management

import { create } from 'zustand';
import { Player } from '@/types';

interface GameStore {
  // Player info
  playerId: string | null;
  playerName: string | null;
  roomId: string | null;
  
  // Game state
  players: Player[];
  currentGame: number;
  
  // Actions
  setPlayer: (id: string, name: string) => void;
  setRoom: (roomId: string) => void;
  setPlayers: (players: Player[]) => void;
  addPlayer: (player: Player) => void;
  removePlayer: (playerId: string) => void;
  updateScore: (playerId: string, game: number, score: number) => void;
  setCurrentGame: (game: number) => void;
  reset: () => void;
}

export const useGameStore = create<GameStore>((set) => ({
  // Initial state
  playerId: null,
  playerName: null,
  roomId: null,
  players: [],
  currentGame: 0,

  // Actions
  setPlayer: (id, name) => set({ playerId: id, playerName: name }),
  
  setRoom: (roomId) => set({ roomId }),
  
  setPlayers: (players) => set({ players }),
  
  addPlayer: (player) =>
    set((state) => ({
      players: [...state.players, player],
    })),
  
  removePlayer: (playerId) =>
    set((state) => ({
      players: state.players.filter((p) => p.id !== playerId),
    })),
  
  updateScore: (playerId, game, score) =>
    set((state) => ({
      players: state.players.map((p) =>
        p.id === playerId
          ? {
              ...p,
              gameScores: { ...p.gameScores, [`game${game}`]: score },
              totalScore: p.totalScore + score,
            }
          : p
      ),
    })),
  
  setCurrentGame: (game) => set({ currentGame: game }),
  
  reset: () =>
    set({
      playerId: null,
      playerName: null,
      roomId: null,
      players: [],
      currentGame: 0,
    }),
}));
