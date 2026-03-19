'use client';

import { use, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { Player } from '@/types';
import { pusherClient, PUSHER_EVENTS, getRoomChannel } from '@/lib/pusher';

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
      if (!res.ok) throw new Error(data.error || 'Không thể tải danh sách');
      setPlayers(data.data.players);
      const playerId = localStorage.getItem('playerId');
      setIsHost(playerId === data.data.hostId);
      setLoading(false);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Lỗi');
      router.push('/');
    }
  };

  useEffect(() => {
    const playerId = localStorage.getItem('playerId');
    if (!playerId) { router.push('/'); return; }

    fetchPlayers();

    const channelName = getRoomChannel(roomId);
    const channel = pusherClient.subscribe(channelName);
    channel.bind(PUSHER_EVENTS.PLAYER_JOINED, () => fetchPlayers());
    channel.bind(PUSHER_EVENTS.GAME_STARTED, () => router.push(`/game/${roomId}`));

    return () => { channel.unbind_all(); pusherClient.unsubscribe(channelName); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roomId]);

  const goToConfig = () => router.push(`/config/${roomId}`);

  const copyRoomCode = () => {
    navigator.clipboard.writeText(roomId);
    toast.success('Đã copy mã phòng!');
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0a0a1a] flex items-center justify-center">
        <p className="text-white/60 text-lg">⏳ Đang tải...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0a0a1a] text-white relative overflow-hidden">
      {/* BG */}
      <div className="absolute inset-0 bg-gradient-to-br from-purple-900/20 via-transparent to-cyan-900/20 pointer-events-none" />
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[500px] h-[500px] bg-purple-600/10 rounded-full blur-3xl pointer-events-none" />

      <div className="relative z-10 max-w-2xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-black tracking-tight mb-3">🎮 Phòng Chờ</h1>
          <button
            onClick={copyRoomCode}
            className="inline-flex items-center gap-2 bg-white/5 hover:bg-white/10 border border-white/10 hover:border-white/20 rounded-xl px-6 py-3 transition-all duration-200 group"
          >
            <span className="text-2xl font-mono font-bold tracking-[0.2em] text-purple-300">{roomId}</span>
            <span className="text-white/30 group-hover:text-white/60 transition-colors">📋</span>
          </button>
          <p className="text-white/30 text-sm mt-2">Nhấn để copy mã phòng</p>
        </div>

        {/* Player List */}
        <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl p-6 mb-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-bold text-white/80">
              Người chơi <span className="text-white/30">({players.length}/10)</span>
            </h2>
          </div>

          <div className="space-y-2">
            {players.map((player, idx) => {
              const isMe = player.id === localStorage.getItem('playerId');
              return (
                <div
                  key={player.id}
                  className={`flex items-center gap-3 p-3 rounded-xl transition-all duration-200 ${
                    isMe ? 'bg-purple-500/10 border border-purple-500/20' : 'bg-white/5 border border-transparent'
                  }`}
                >
                  <span className="text-2xl">{player.avatar}</span>
                  <span className="font-medium flex-1">{player.name}</span>
                  {idx === 0 && (
                    <span className="text-xs font-bold bg-amber-500/20 text-amber-300 px-2 py-1 rounded-full">
                      👑 Host
                    </span>
                  )}
                  {isMe && (
                    <span className="text-xs font-bold bg-purple-500/20 text-purple-300 px-2 py-1 rounded-full">
                      Bạn
                    </span>
                  )}
                </div>
              );
            })}
          </div>

          {players.length < 2 && (
            <p className="text-center text-white/20 text-sm mt-4 py-2">
              Đợi thêm người chơi tham gia...
            </p>
          )}
        </div>

        {/* CTA */}
        {isHost ? (
          <Button
            size="lg"
            className="w-full py-6 text-lg font-black bg-gradient-to-r from-purple-600 to-cyan-600 hover:from-purple-700 hover:to-cyan-700 border-0 shadow-lg shadow-purple-500/20 transition-all hover:scale-[1.02]"
            onClick={goToConfig}
            disabled={players.length < 2}
          >
            {players.length < 2 ? '⏳ Chờ thêm người chơi...' : '⚙️ Cấu hình & Bắt đầu'}
          </Button>
        ) : (
          <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl p-6 text-center">
            <p className="text-white/40 animate-pulse">⏳ Đợi host cấu hình và bắt đầu game...</p>
          </div>
        )}

        <button
          onClick={() => router.push('/')}
          className="w-full mt-4 py-3 text-center text-white/30 hover:text-white/60 transition-colors text-sm"
        >
          ← Về trang chủ
        </button>
      </div>
    </div>
  );
}
