'use client';

import { use, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { Player } from '@/types';

export default function LobbyPage({ params }: { params: Promise<{ roomId: string }> }) {
  const router = useRouter();
  const { roomId } = use(params);

  const [players, setPlayers] = useState<Player[]>([]);
  const [loading, setLoading] = useState(true);
  const [isHost, setIsHost] = useState(false);

  const fetchPlayers = async () => {
    try {
      const res = await fetch(`/api/rooms/${roomId}/players`);
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Không thể tải danh sách');
      }

      setPlayers(data.data.players);

      const playerId = localStorage.getItem('playerId');
      setIsHost(playerId === data.data.hostId);
      setLoading(false);
    } catch (error) {
      console.error('Fetch players error:', error);
      toast.error(error instanceof Error ? error.message : 'Lỗi không xác định');
      router.push('/');
    }
  };

  useEffect(() => {
    // Check if user is logged in
    const playerId = localStorage.getItem('playerId');
    const playerName = localStorage.getItem('playerName');

    if (!playerId || !playerName) {
      toast.error('Bạn chưa đăng nhập');
      router.push('/');
      return;
    }

    // Fetch initial players
    fetchPlayers();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roomId]);

  const handleStartGame = async () => {
    const playerId = localStorage.getItem('playerId');

    if (!playerId) {
      toast.error('Không tìm thấy thông tin người chơi');
      return;
    }

    try {
      const res = await fetch(`/api/rooms/${roomId}/start`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ playerId }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Không thể bắt đầu');
      }

      toast.success('Bắt đầu game!');
      router.push(`/game/${roomId}`);
    } catch (error) {
      console.error('Start game error:', error);
      toast.error(error instanceof Error ? error.message : 'Lỗi không xác định');
    }
  };

  const copyRoomCode = () => {
    navigator.clipboard.writeText(roomId);
    toast.success('Đã copy mã phòng!');
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-linear-to-br from-blue-500 to-purple-600 flex items-center justify-center">
        <Card className="p-8">
          <p className="text-lg">⏳ Đang tải...</p>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-linear-to-br from-blue-500 to-purple-600 p-4">
      <div className="max-w-2xl mx-auto pt-8">
        <Card className="p-6 mb-4">
          <div className="text-center mb-6">
            <h1 className="text-3xl font-bold mb-2">🎮 Phòng Chờ</h1>
            <div
              className="text-2xl font-mono bg-gray-100 py-2 px-4 rounded-lg inline-block cursor-pointer hover:bg-gray-200 transition"
              onClick={copyRoomCode}
            >
              {roomId} 📋
            </div>
            <p className="text-sm text-gray-600 mt-2">
              Nhấn để copy mã phòng
            </p>
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="font-semibold text-lg">
                Người chơi ({players.length}/10)
              </h2>
              <Button
                variant="outline"
                size="sm"
                onClick={fetchPlayers}
              >
                🔄 Làm mới
              </Button>
            </div>

            {players.map((player, idx) => (
              <div
                key={player.id}
                className="flex items-center gap-3 bg-gray-50 p-3 rounded-lg"
              >
                <span className="text-2xl">{player.avatar}</span>
                <span className="font-medium flex-1">{player.name}</span>
                {idx === 0 && (
                  <Badge variant="default">
                    👑 Host
                  </Badge>
                )}
                {player.id === localStorage.getItem('playerId') && (
                  <Badge variant="outline">
                    Bạn
                  </Badge>
                )}
              </div>
            ))}
          </div>

          {isHost && (
            <Button
              size="lg"
              className="w-full mt-6"
              onClick={handleStartGame}
              disabled={players.length < 2}
            >
              {players.length < 2
                ? '⏳ Chờ thêm người chơi...'
                : '🎮 Bắt đầu trò chơi'}
            </Button>
          )}

          {!isHost && (
            <div className="mt-6 text-center text-gray-600 p-4 bg-gray-50 rounded-lg">
              ⏳ Đợi host bắt đầu game...
            </div>
          )}
        </Card>

        <Button
          variant="outline"
          className="w-full"
          onClick={() => router.push('/')}
        >
          ← Về trang chủ
        </Button>
      </div>
    </div>
  );
}
