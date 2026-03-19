'use client';

import { use, useEffect, useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { Player } from '@/types';
import { pusherClient, PUSHER_EVENTS, getRoomChannel } from '@/lib/pusher';
import Game1Reflex from '@/components/game/Game1Reflex';
import Game2Roulette from '@/components/game/Game2Roulette';
import Game3WhoIsIt from '@/components/game/Game3WhoIsIt';
import Game4TruthOrDare from '@/components/game/Game4TruthOrDare';
import Game5Poker from '@/components/game/Game5Poker';

// Per-round theme config
const ROUND_THEMES: Record<number, { bg: string, accent: string, emoji: string, label: string }> = {
  0: { bg: 'from-indigo-500 to-purple-600', accent: 'bg-indigo-600', emoji: '🎮', label: 'Chuẩn bị' },
  1: { bg: 'from-red-500 via-orange-500 to-yellow-500', accent: 'bg-red-600', emoji: '⚡', label: 'Thử Thách Phản Xạ' },
  2: { bg: 'from-purple-600 via-pink-500 to-rose-500', accent: 'bg-purple-600', emoji: '🎲', label: 'Hại Người - Hại Mình' },
  3: { bg: 'from-blue-600 via-cyan-500 to-teal-500', accent: 'bg-blue-600', emoji: '🕵️', label: 'Ai Là Kẻ Tội Đồ?' },
  4: { bg: 'from-green-500 via-lime-500 to-yellow-400', accent: 'bg-green-600', emoji: '🔥', label: 'Thật Hay Thách' },
  5: { bg: 'from-gray-900 via-yellow-900 to-yellow-700', accent: 'bg-yellow-700', emoji: '🃏', label: 'Cào Tố Tam Khúc' },
  6: { bg: 'from-yellow-400 via-orange-500 to-red-500', accent: 'bg-yellow-600', emoji: '🏆', label: 'Tổng Kết' },
};

export default function GamePage({ params }: { params: Promise<{ roomId: string }> }) {
  const router = useRouter();
  const { roomId } = use(params);

  const [players, setPlayers] = useState<Player[]>([]);
  const [currentGame, setCurrentGame] = useState<number>(0);
  const [loading, setLoading] = useState(true);
  const [isHost, setIsHost] = useState(false);
  const [showConfetti, setShowConfetti] = useState(false);
  const confettiRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const playerId = localStorage.getItem('playerId');
    if (!playerId) {
      router.push('/');
      return;
    }

    const fetchState = async () => {
      try {
        const res = await fetch(`/api/rooms/${roomId}/state`);
        const data = await res.json();
        if (!res.ok) throw new Error(data.error);
        setPlayers(data.data.players);
        setCurrentGame(data.data.currentGame);
        setIsHost(data.data.hostId === playerId);
        setLoading(false);
      } catch (error) {
        console.error('Fetch state error:', error);
        toast.error('Không thể tải trạng thái game');
      }
    };

    fetchState();

    const channelName = getRoomChannel(roomId);
    const channel = pusherClient.subscribe(channelName);

    channel.bind(PUSHER_EVENTS.GAME_UPDATE, (data: { currentGame: number }) => {
      setCurrentGame(data.currentGame);
    });

    channel.bind(PUSHER_EVENTS.SCORE_UPDATE, (data: { players: Player[] }) => {
      setPlayers(data.players);
    });

    channel.bind('game-reset', () => {
      router.push(`/lobby/${roomId}`);
    });

    return () => {
      channel.unbind_all();
      pusherClient.unsubscribe(channelName);
    };
  }, [roomId, router]);

  // Trigger confetti when game ends
  useEffect(() => {
    if (currentGame === 6) {
      setShowConfetti(true);
      startConfetti();
    }
  }, [currentGame]);

  const startConfetti = () => {
    const canvas = confettiRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;

    const particles: { x: number; y: number; vx: number; vy: number; color: string; size: number; rotation: number; rotSpeed: number }[] = [];
    const colors = ['#FFD700', '#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FFEAA7', '#DDA0DD', '#FF1493'];

    for (let i = 0; i < 150; i++) {
      particles.push({
        x: Math.random() * canvas.width,
        y: -20 - Math.random() * 200,
        vx: (Math.random() - 0.5) * 4,
        vy: Math.random() * 3 + 2,
        color: colors[Math.floor(Math.random() * colors.length)],
        size: Math.random() * 8 + 4,
        rotation: Math.random() * 360,
        rotSpeed: (Math.random() - 0.5) * 10,
      });
    }

    let frame = 0;
    const animate = () => {
      if (frame > 300) { ctx.clearRect(0, 0, canvas.width, canvas.height); return; }
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      particles.forEach(p => {
        p.x += p.vx;
        p.y += p.vy;
        p.vy += 0.05;
        p.rotation += p.rotSpeed;
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate((p.rotation * Math.PI) / 180);
        ctx.fillStyle = p.color;
        ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size * 0.6);
        ctx.restore();
      });
      frame++;
      requestAnimationFrame(animate);
    };
    animate();
  };

  const nextGame = () => {
    fetch(`/api/rooms/${roomId}/game/next`, { method: 'POST' });
  };

  const resetGame = () => {
    const playerId = localStorage.getItem('playerId');
    fetch(`/api/rooms/${roomId}/reset`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ playerId }),
    });
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center">
        <Card className="p-8"><p>⏳ Đang tải game...</p></Card>
      </div>
    );
  }

  const theme = ROUND_THEMES[currentGame] || ROUND_THEMES[0];

  const renderGame = () => {
    switch (currentGame) {
      case 1: return <Game1Reflex roomId={roomId} players={players} isHost={isHost} />;
      case 2: return <Game2Roulette roomId={roomId} players={players} isHost={isHost} />;
      case 3: return <Game3WhoIsIt roomId={roomId} players={players} isHost={isHost} />;
      case 4: return <Game4TruthOrDare roomId={roomId} players={players} isHost={isHost} />;
      case 5: return <Game5Poker roomId={roomId} players={players} isHost={isHost} />;
      case 6: return renderEndGame();
      default: return <Card className="p-8 text-center max-w-2xl mx-auto w-full"><h2 className="text-2xl font-bold mb-4">Chuẩn bị...</h2></Card>;
    }
  };

  const renderEndGame = () => {
    const sorted = [...players].sort((a, b) => b.totalScore - a.totalScore);
    const medals = ['🥇', '🥈', '🥉'];

    return (
      <Card className="p-8 max-w-2xl mx-auto w-full overflow-hidden">
        <div className="text-center mb-8">
          <div className="text-6xl mb-4 animate-bounce">🏆</div>
          <h2 className="text-4xl font-black bg-gradient-to-r from-yellow-500 via-orange-500 to-red-500 bg-clip-text text-transparent mb-2">
            VUA TRÒ CHƠI
          </h2>
          {sorted[0] && (
            <div className="mt-4">
              <p className="text-6xl mb-2">{sorted[0].avatar}</p>
              <p className="text-3xl font-black text-yellow-700">{sorted[0].name}</p>
              <p className="text-xl font-bold text-yellow-600 mt-1">{sorted[0].totalScore} điểm</p>
            </div>
          )}
        </div>

        <div className="space-y-3 mb-8">
          <h3 className="text-xl font-bold text-center mb-4">🏅 Bảng Xếp Hạng</h3>
          {sorted.map((p, i) => (
            <div
              key={p.id}
              className={`flex items-center justify-between p-4 rounded-xl border-2 transition-all ${
                i === 0 ? 'bg-yellow-50 border-yellow-400 scale-105 shadow-lg' :
                i === 1 ? 'bg-gray-100 border-gray-300' :
                i === 2 ? 'bg-orange-50 border-orange-300' :
                'bg-white border-gray-200'
              }`}
            >
              <div className="flex items-center gap-3">
                <span className="text-2xl w-8">{medals[i] || `#${i + 1}`}</span>
                <span className="text-2xl">{p.avatar}</span>
                <div>
                  <span className="font-bold text-lg">{p.name}</span>
                  {p.id === localStorage.getItem('playerId') && (
                    <span className="ml-2 text-xs bg-blue-100 text-blue-800 px-2 py-0.5 rounded-full">Bạn</span>
                  )}
                </div>
              </div>
              <div className="text-right">
                <div className="font-black text-xl text-blue-700">{p.totalScore}đ</div>
                <div className="text-xs text-gray-400 font-mono">
                  {p.gameScores.game1}/{p.gameScores.game2}/{p.gameScores.game3}/{p.gameScores.game4}/{p.gameScores.game5}
                </div>
              </div>
            </div>
          ))}
        </div>

        {isHost && (
          <Button size="lg" className="w-full text-lg py-6 bg-gradient-to-r from-green-500 to-teal-500 hover:from-green-600 hover:to-teal-600" onClick={resetGame}>
            🔄 Chơi Lại
          </Button>
        )}
      </Card>
    );
  };

  return (
    <div className={`min-h-screen bg-gradient-to-br ${theme.bg} p-4 transition-all duration-1000`}>
      {showConfetti && (
        <canvas ref={confettiRef} className="fixed inset-0 pointer-events-none z-50" />
      )}

      <div className="max-w-4xl mx-auto pt-4 flex flex-col gap-4">
        {/* Header */}
        <div className="flex justify-between items-center bg-white/10 p-4 rounded-xl text-white backdrop-blur-md">
          <div className="flex items-center gap-2">
            <span className="font-mono bg-black/20 px-2 py-1 rounded text-sm">{roomId}</span>
            <span className="text-2xl">{theme.emoji}</span>
            <span className="font-semibold">Vòng {currentGame > 5 ? '🏆' : `${currentGame}/5`}</span>
          </div>
          {isHost && currentGame < 6 && (
            <Button variant="secondary" size="sm" onClick={nextGame}>
              Next Game →
            </Button>
          )}
        </div>

        {/* Round Label */}
        {currentGame >= 1 && currentGame <= 5 && (
          <div className="text-center">
            <span className="inline-block bg-white/20 backdrop-blur-sm text-white px-6 py-2 rounded-full font-bold text-lg shadow-lg">
              {theme.emoji} {theme.label}
            </span>
          </div>
        )}

        {/* Main Game Area */}
        {renderGame()}

        {/* Player Score Bar (hide during end game) */}
        {currentGame < 6 && (
          <Card className="p-4 bg-white/90 backdrop-blur-sm">
            <h3 className="font-bold text-lg mb-2">🏅 Bảng Điểm</h3>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
              {[...players].sort((a, b) => b.totalScore - a.totalScore).map((p, i) => (
                <div key={p.id} className={`flex flex-col items-center p-2 rounded border ${i === 0 ? 'bg-yellow-50 border-yellow-300' : 'bg-gray-50 border-gray-200'}`}>
                  <span className="text-2xl">{p.avatar}</span>
                  <span className="font-medium text-sm truncate w-full text-center">{p.name}</span>
                  <span className="font-bold text-blue-600">{p.totalScore} đ</span>
                </div>
              ))}
            </div>
          </Card>
        )}
      </div>
    </div>
  );
}
