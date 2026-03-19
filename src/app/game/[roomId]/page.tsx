'use client';

import { use, useEffect, useState, useRef, ComponentType } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { Player, RoomConfig } from '@/types';
import { pusherClient, PUSHER_EVENTS, getRoomChannel } from '@/lib/pusher';
import { getGameMeta, loadGameComponent, END_GAME_THEME, type GameProps } from '@/lib/gameRegistry';

export default function GamePage({ params }: { params: Promise<{ roomId: string }> }) {
  const router = useRouter();
  const { roomId } = use(params);

  const [players, setPlayers] = useState<Player[]>([]);
  const [currentGame, setCurrentGame] = useState<number>(0);
  const [config, setConfig] = useState<RoomConfig>({ rounds: [] });
  const [loading, setLoading] = useState(true);
  const [isHost, setIsHost] = useState(false);
  const [showConfetti, setShowConfetti] = useState(false);
  const [GameComponent, setGameComponent] = useState<ComponentType<GameProps> | null>(null);
  const confettiRef = useRef<HTMLCanvasElement>(null);

  // Current round info (1-indexed: currentGame=1 → config.rounds[0])
  const roundIdx = currentGame - 1;
  const currentRound = config.rounds[roundIdx];
  const totalRounds = config.rounds.length;
  const isGameOver = currentGame > totalRounds && totalRounds > 0;

  useEffect(() => {
    const playerId = localStorage.getItem('playerId');
    if (!playerId) { router.push('/'); return; }

    const fetchState = async () => {
      try {
        const res = await fetch(`/api/rooms/${roomId}/state`);
        const data = await res.json();
        if (!res.ok) throw new Error(data.error);
        setPlayers(data.data.players);
        setCurrentGame(data.data.currentGame);
        setIsHost(data.data.hostId === playerId);
        if (data.data.config) setConfig(data.data.config);
        setLoading(false);
      } catch (error) {
        toast.error('Không thể tải trạng thái game');
      }
    };
    fetchState();

    const channel = pusherClient.subscribe(getRoomChannel(roomId));
    channel.bind(PUSHER_EVENTS.GAME_UPDATE, (data: { currentGame: number }) => setCurrentGame(data.currentGame));
    channel.bind(PUSHER_EVENTS.SCORE_UPDATE, (data: { players: Player[] }) => setPlayers(data.players));
    channel.bind('game-reset', () => router.push(`/lobby/${roomId}`));

    return () => { channel.unbind_all(); pusherClient.unsubscribe(getRoomChannel(roomId)); };
  }, [roomId, router]);

  // Load game component dynamically when round changes
  useEffect(() => {
    if (!currentRound) { setGameComponent(null); return; }
    loadGameComponent(currentRound.gameId).then(comp => {
      setGameComponent(() => comp);
    });
  }, [currentRound?.gameId]);

  // Confetti on game over
  useEffect(() => {
    if (isGameOver) { setShowConfetti(true); startConfetti(); }
  }, [isGameOver]);

  const startConfetti = () => {
    const canvas = confettiRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    const particles: { x: number; y: number; vx: number; vy: number; color: string; size: number; rot: number; rs: number }[] = [];
    const colors = ['#FFD700', '#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FFEAA7', '#DDA0DD', '#FF1493'];
    for (let i = 0; i < 150; i++) {
      particles.push({ x: Math.random() * canvas.width, y: -20 - Math.random() * 200, vx: (Math.random() - 0.5) * 4, vy: Math.random() * 3 + 2, color: colors[Math.floor(Math.random() * colors.length)], size: Math.random() * 8 + 4, rot: Math.random() * 360, rs: (Math.random() - 0.5) * 10 });
    }
    let frame = 0;
    const animate = () => {
      if (frame > 300) { ctx.clearRect(0, 0, canvas.width, canvas.height); return; }
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      particles.forEach(p => { p.x += p.vx; p.y += p.vy; p.vy += 0.05; p.rot += p.rs; ctx.save(); ctx.translate(p.x, p.y); ctx.rotate((p.rot * Math.PI) / 180); ctx.fillStyle = p.color; ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size * 0.6); ctx.restore(); });
      frame++; requestAnimationFrame(animate);
    };
    animate();
  };

  const nextGame = () => { fetch(`/api/rooms/${roomId}/game/next`, { method: 'POST' }); };
  const resetGame = () => {
    const playerId = localStorage.getItem('playerId');
    fetch(`/api/rooms/${roomId}/reset`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ playerId }),
    });
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0a0a1a] flex items-center justify-center">
        <p className="text-white/60 text-lg">⏳ Đang tải game...</p>
      </div>
    );
  }

  // Get theme
  const meta = currentRound ? getGameMeta(currentRound.gameId) : null;
  const theme = isGameOver ? END_GAME_THEME : meta?.theme;
  const bgGradient = theme?.gradient || 'from-indigo-500 to-purple-600';

  const renderEndGame = () => {
    const sorted = [...players].sort((a, b) => b.totalScore - a.totalScore);
    const medals = ['🥇', '🥈', '🥉'];

    return (
      <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl p-8 max-w-2xl mx-auto w-full">
        <div className="text-center mb-8">
          <div className="text-6xl mb-4 animate-bounce">🏆</div>
          <h2 className="text-4xl font-black bg-gradient-to-r from-yellow-400 via-orange-400 to-red-400 bg-clip-text text-transparent mb-2">
            VUA TRÒ CHƠI
          </h2>
          {sorted[0] && (
            <div className="mt-4">
              <p className="text-6xl mb-2">{sorted[0].avatar}</p>
              <p className="text-3xl font-black text-amber-300">{sorted[0].name}</p>
              <p className="text-xl font-bold text-amber-400/60 mt-1">{sorted[0].totalScore} điểm</p>
            </div>
          )}
        </div>

        <div className="space-y-2 mb-8">
          <h3 className="text-lg font-bold text-center mb-4 text-white/60">🏅 Bảng Xếp Hạng</h3>
          {sorted.map((p, i) => (
            <div key={p.id} className={`flex items-center justify-between p-4 rounded-xl border transition-all ${
              i === 0 ? 'bg-amber-500/10 border-amber-500/30 scale-[1.02]' :
              i === 1 ? 'bg-white/5 border-white/10' :
              i === 2 ? 'bg-orange-500/5 border-orange-500/20' :
              'bg-white/5 border-white/5'
            }`}>
              <div className="flex items-center gap-3">
                <span className="text-2xl w-8">{medals[i] || `#${i + 1}`}</span>
                <span className="text-xl">{p.avatar}</span>
                <span className="font-bold">{p.name}</span>
                {p.id === localStorage.getItem('playerId') && (
                  <span className="text-xs bg-purple-500/20 text-purple-300 px-2 py-0.5 rounded-full">Bạn</span>
                )}
              </div>
              <span className="font-black text-xl text-amber-300">{p.totalScore}đ</span>
            </div>
          ))}
        </div>

        {isHost && (
          <Button
            size="lg"
            className="w-full py-6 text-lg font-black bg-gradient-to-r from-green-500 to-teal-500 hover:from-green-600 hover:to-teal-600 border-0 shadow-lg"
            onClick={resetGame}
          >
            🔄 Chơi Lại
          </Button>
        )}
      </div>
    );
  };

  return (
    <div className={`min-h-screen bg-gradient-to-br ${bgGradient} p-4 transition-all duration-1000`}>
      {showConfetti && <canvas ref={confettiRef} className="fixed inset-0 pointer-events-none z-50" />}

      <div className="max-w-4xl mx-auto pt-4 flex flex-col gap-4">
        {/* Header */}
        <div className="flex justify-between items-center bg-black/20 backdrop-blur-xl p-4 rounded-xl text-white border border-white/10">
          <div className="flex items-center gap-3">
            <span className="font-mono bg-black/30 px-2.5 py-1 rounded-lg text-sm text-white/60">{roomId}</span>
            {meta && <span className="text-xl">{meta.icon}</span>}
            <span className="font-semibold">
              {isGameOver ? '🏆 Tổng Kết' : `Vòng ${currentGame}/${totalRounds}`}
            </span>
          </div>
          {isHost && !isGameOver && (
            <Button
              variant="secondary"
              size="sm"
              onClick={nextGame}
              className="bg-white/10 hover:bg-white/20 text-white border-white/10"
            >
              Vòng tiếp →
            </Button>
          )}
        </div>

        {/* Round label */}
        {meta && !isGameOver && (
          <div className="text-center">
            <span className="inline-block bg-black/20 backdrop-blur-sm text-white px-6 py-2 rounded-full font-bold shadow-lg border border-white/10">
              {meta.icon} {meta.name}
              {currentRound && <span className="ml-2 text-white/50 text-sm">({currentRound.subRounds} ván · +{currentRound.rewards.win}/-{Math.abs(currentRound.rewards.lose)}đ)</span>}
            </span>
          </div>
        )}

        {/* Game area */}
        {isGameOver ? renderEndGame() : (
          GameComponent && currentRound ? (
            <GameComponent
              roomId={roomId}
              players={players}
              isHost={isHost}
              subRounds={currentRound.subRounds}
              rewards={currentRound.rewards}
              roundIndex={roundIdx}
              onRoundComplete={nextGame}
            />
          ) : (
            <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl p-8 text-center text-white">
              <h2 className="text-2xl font-bold mb-4">Chuẩn bị...</h2>
            </div>
          )
        )}

        {/* Score bar */}
        {!isGameOver && (
          <div className="bg-black/20 backdrop-blur-xl border border-white/10 rounded-xl p-4">
            <h3 className="font-bold text-sm text-white/50 mb-2">🏅 Bảng Điểm</h3>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
              {[...players].sort((a, b) => b.totalScore - a.totalScore).map((p, i) => (
                <div key={p.id} className={`flex flex-col items-center p-2 rounded-lg border ${
                  i === 0 ? 'bg-amber-500/10 border-amber-500/20' : 'bg-white/5 border-white/5'
                }`}>
                  <span className="text-xl">{p.avatar}</span>
                  <span className="text-xs font-medium text-white/70 truncate w-full text-center">{p.name}</span>
                  <span className="font-bold text-amber-300">{p.totalScore}đ</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
