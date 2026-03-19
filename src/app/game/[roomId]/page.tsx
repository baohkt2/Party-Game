'use client';

import { use, useEffect, useState } from 'react';
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

export default function GamePage({ params }: { params: Promise<{ roomId: string }> }) {
  const router = useRouter();
  const { roomId } = use(params);

  const [players, setPlayers] = useState<Player[]>([]);
  const [currentGame, setCurrentGame] = useState<number>(0);
  const [loading, setLoading] = useState(true);
  const [isHost, setIsHost] = useState(false);

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

    return () => {
      channel.unbind_all();
      pusherClient.unsubscribe(channelName);
    };
  }, [roomId, router]);

  const nextGame = async () => {
    try {
      const res = await fetch(`/api/rooms/${roomId}/game/next`, {
        method: 'POST',
      });
      if (!res.ok) throw new Error('Không thể chuyển game');
    } catch (error) {
      toast.error('Lỗi khi chuyển trò chơi');
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-linear-to-br from-indigo-500 to-purple-600 flex items-center justify-center">
        <Card className="p-8"><p>⏳ Đang tải game...</p></Card>
      </div>
    );
  }

  const renderGame = () => {
    switch (currentGame) {
      case 1:
        return <Game1Reflex roomId={roomId} players={players} isHost={isHost} />;
      case 2:
        return <Game2Roulette roomId={roomId} players={players} isHost={isHost} />;
      case 3:
        return <Game3WhoIsIt roomId={roomId} players={players} isHost={isHost} />;
      case 4:
        return <Game4TruthOrDare roomId={roomId} players={players} isHost={isHost} />;
      case 5:
        return <Game5Poker roomId={roomId} players={players} isHost={isHost} />;
      case 6:
        return (
          <Card className="p-8 text-center max-w-2xl mx-auto w-full">
            <h2 className="text-3xl font-bold mb-4">🏆 Tổng Kết</h2>
            <p>Trò chơi kết thúc!</p>
          </Card>
        );
      default:
        return (
          <Card className="p-8 text-center max-w-2xl mx-auto w-full">
            <h2 className="text-2xl font-bold mb-4">Chuẩn bị...</h2>
          </Card>
        );
    }
  };

  return (
    <div className="min-h-screen bg-linear-to-br from-indigo-500 to-purple-600 p-4 transition-colors duration-500">
      <div className="max-w-4xl mx-auto pt-4 flex flex-col gap-4">
        {/* Header / StatusBar */}
        <div className="flex justify-between items-center bg-white/10 p-4 rounded-xl text-white backdrop-blur-md">
          <div>
            <span className="font-mono bg-black/20 px-2 py-1 rounded text-sm mr-2">{roomId}</span>
            <span className="font-semibold">Vòng {currentGame}/5</span>
          </div>
          {isHost && currentGame < 6 && (
            <Button variant="secondary" size="sm" onClick={nextGame}>
              Next Game →
            </Button>
          )}
        </div>

        {/* Main Game Area */}
        {renderGame()}

        {/* Player List / Leaderboard (Bottom or Sidebar) */}
        <Card className="p-4 bg-white/90">
          <h3 className="font-bold text-lg mb-2">Bảng Điểm</h3>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
            {players.concat().sort((a,b) => b.totalScore - a.totalScore).map(p => (
              <div key={p.id} className="flex flex-col items-center p-2 bg-gray-100 rounded">
                <span className="text-2xl">{p.avatar}</span>
                <span className="font-medium text-sm truncate w-full text-center">{p.name}</span>
                <span className="font-bold text-blue-600">{p.totalScore} đ</span>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
}

