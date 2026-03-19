// ─── Modular Game Registry ───
// Mỗi game module đăng ký tại đây. Để thêm game mới, chỉ cần import component và thêm vào GAME_MODULES.

import { ComponentType } from 'react';

// ─── Interfaces ───

export interface GameModuleTheme {
  gradient: string;     // Tailwind gradient classes
  accent: string;       // Tailwind bg class for accent
  textAccent: string;   // Tailwind text class
}

export interface GameModuleMeta {
  id: string;
  name: string;
  icon: string;
  description: string;
  minPlayers: number;
  maxPlayers: number;
  defaultSubRounds: number;
  defaultRewards: { win: number; lose: number };
  theme: GameModuleTheme;
}

export interface GameProps {
  roomId: string;
  players: import('@/types').Player[];
  isHost: boolean;
  subRounds: number;
  rewards: { win: number; lose: number };
  roundIndex: number;
  onRoundComplete: () => void;
}

export interface GameModule extends GameModuleMeta {
  component: ComponentType<GameProps>;
}

// ─── Registry ───

const GAME_MODULES: GameModuleMeta[] = [
  {
    id: 'reflex',
    name: 'Thử Thách Phản Xạ',
    icon: '⚡',
    description: 'Ai bấm nhanh nhất khi màn hình chuyển xanh?',
    minPlayers: 2,
    maxPlayers: 20,
    defaultSubRounds: 3,
    defaultRewards: { win: 3, lose: -1 },
    theme: { gradient: 'from-red-500 via-orange-500 to-yellow-500', accent: 'bg-red-600', textAccent: 'text-red-400' },
  },
  {
    id: 'roulette',
    name: 'Hại Người - Hại Mình',
    icon: '🎲',
    description: 'Viết thử thách, quay vòng quay, biểu quyết thành/bại.',
    minPlayers: 3,
    maxPlayers: 20,
    defaultSubRounds: 5,
    defaultRewards: { win: 3, lose: -1 },
    theme: { gradient: 'from-purple-600 via-pink-500 to-rose-500', accent: 'bg-purple-600', textAccent: 'text-purple-400' },
  },
  {
    id: 'whoisit',
    name: 'Ai Là Kẻ Tội Đồ?',
    icon: '🕵️',
    description: 'Bình chọn ai phù hợp nhất với câu hỏi bí ẩn.',
    minPlayers: 3,
    maxPlayers: 20,
    defaultSubRounds: 3,
    defaultRewards: { win: 1, lose: -2 },
    theme: { gradient: 'from-blue-600 via-cyan-500 to-teal-500', accent: 'bg-blue-600', textAccent: 'text-blue-400' },
  },
  {
    id: 'truthordare',
    name: 'Thật Hay Thách',
    icon: '🔥',
    description: 'Chọn Sự Thật hoặc Thử Thách, mọi người biểu quyết.',
    minPlayers: 2,
    maxPlayers: 20,
    defaultSubRounds: 1, // 1 lượt per player
    defaultRewards: { win: 2, lose: -1 },
    theme: { gradient: 'from-green-500 via-lime-500 to-yellow-400', accent: 'bg-green-600', textAccent: 'text-green-400' },
  },
  {
    id: 'poker',
    name: 'Cào Tố Tam Khúc',
    icon: '🃏',
    description: 'Trò chơi cào 3 lá – Theo, Tăng, Gấp Đôi hoặc Bỏ Bài.',
    minPlayers: 2,
    maxPlayers: 10,
    defaultSubRounds: 1,
    defaultRewards: { win: 5, lose: -2 },
    theme: { gradient: 'from-gray-900 via-yellow-900 to-yellow-700', accent: 'bg-yellow-700', textAccent: 'text-yellow-400' },
  },
];

// ─── Public API ───

export function getAllGameMetas(): GameModuleMeta[] {
  return GAME_MODULES;
}

export function getGameMeta(id: string): GameModuleMeta | undefined {
  return GAME_MODULES.find(g => g.id === id);
}

// Dynamic component loader (for game page)
export async function loadGameComponent(id: string): Promise<ComponentType<GameProps> | null> {
  switch (id) {
    case 'reflex': return (await import('@/components/game/Game1Reflex')).default;
    case 'roulette': return (await import('@/components/game/Game2Roulette')).default;
    case 'whoisit': return (await import('@/components/game/Game3WhoIsIt')).default;
    case 'truthordare': return (await import('@/components/game/Game4TruthOrDare')).default;
    case 'poker': return (await import('@/components/game/Game5Poker')).default;
    default: return null;
  }
}

// End-game theme
export const END_GAME_THEME: GameModuleTheme = {
  gradient: 'from-yellow-400 via-orange-500 to-red-500',
  accent: 'bg-yellow-600',
  textAccent: 'text-yellow-400',
};
