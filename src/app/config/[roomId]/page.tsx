'use client';

import { use, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { PlayerAvatar } from '@/components/ui/player-avatar';
import { toast } from 'sonner';
import { RoundConfig, RoomConfig, Player } from '@/types';
import { getAllGameMetas, GameModuleMeta } from '@/lib/gameRegistry';
import { pusherClient, PUSHER_EVENTS, getRoomChannel } from '@/lib/pusher';

export default function ConfigPage({ params }: { params: Promise<{ roomId: string }> }) {
  const router = useRouter();
  const { roomId } = use(params);

  const [rounds, setRounds] = useState<RoundConfig[]>([]);
  const [players, setPlayers] = useState<Player[]>([]);
  const [isHost, setIsHost] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const gameMetas = getAllGameMetas();

  useEffect(() => {
    const playerId = localStorage.getItem('playerId');
    if (!playerId) { router.push('/'); return; }

    const fetchData = async () => {
      try {
        const res = await fetch(`/api/rooms/${roomId}/players`);
        const data = await res.json();
        if (!res.ok) throw new Error(data.error);
        setPlayers(data.data.players);
        setIsHost(playerId === data.data.hostId);
        setLoading(false);
      } catch { router.push('/'); }
    };
    fetchData();

    const channel = pusherClient.subscribe(getRoomChannel(roomId));
    channel.bind(PUSHER_EVENTS.PLAYER_JOINED, () => fetchData());
    channel.bind(PUSHER_EVENTS.GAME_STARTED, () => router.push(`/game/${roomId}`));
    return () => { channel.unbind_all(); pusherClient.unsubscribe(getRoomChannel(roomId)); };
  }, [roomId, router]);

  const addRound = (meta: GameModuleMeta) => {
    setRounds(prev => [...prev, {
      gameId: meta.id,
      subRounds: meta.defaultSubRounds,
      rewards: { ...meta.defaultRewards },
    }]);
  };

  const removeRound = (idx: number) => {
    setRounds(prev => prev.filter((_, i) => i !== idx));
  };

  const updateRound = (idx: number, field: string, value: number) => {
    setRounds(prev => prev.map((r, i) => {
      if (i !== idx) return r;
      if (field === 'subRounds') return { ...r, subRounds: value };
      if (field === 'win') return { ...r, rewards: { ...r.rewards, win: value } };
      if (field === 'lose') return { ...r, rewards: { ...r.rewards, lose: value } };
      return r;
    }));
  };

  const moveRound = (idx: number, dir: -1 | 1) => {
    const newIdx = idx + dir;
    if (newIdx < 0 || newIdx >= rounds.length) return;
    setRounds(prev => {
      const arr = [...prev];
      [arr[idx], arr[newIdx]] = [arr[newIdx], arr[idx]];
      return arr;
    });
  };

  const startGame = async () => {
    if (rounds.length === 0) { toast.error('Thêm ít nhất 1 vòng chơi'); return; }

    setSaving(true);
    const playerId = localStorage.getItem('playerId');
    try {
      // Save config
      await fetch(`/api/rooms/${roomId}/config`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ playerId, config: { rounds } as RoomConfig }),
      });

      // Start game
      const res = await fetch(`/api/rooms/${roomId}/start`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ playerId }),
      });
      if (!res.ok) { const d = await res.json(); throw new Error(d.error); }
      router.push(`/game/${roomId}`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Lỗi');
    } finally { setSaving(false); }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0a0a1a] flex items-center justify-center">
        <p className="text-white/60 text-lg">⏳ Đang tải...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0a0a1a] text-white">
      {/* BG Effects */}
      <div className="fixed inset-0 bg-linear-to-br from-purple-900/20 via-transparent to-cyan-900/20 pointer-events-none" />
      <div className="fixed top-0 left-1/2 -translate-x-1/2 w-150 h-150 bg-purple-600/10 rounded-full blur-3xl pointer-events-none" />

      <div className="relative z-10 max-w-3xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-black tracking-tight mb-2">⚙️ Cấu Hình Game</h1>
          <div className="inline-flex items-center gap-2 bg-white/5 border border-white/10 rounded-full px-4 py-1.5 text-sm">
            <span className="font-mono text-purple-300">{roomId}</span>
            <span className="text-white/40">·</span>
            <span className="text-white/60">{players.length} người chơi</span>
          </div>
        </div>

        {/* Players */}
        <div className="flex flex-wrap justify-center gap-2 mb-8">
          {players.map(p => (
            <div key={p.id} className="flex items-center gap-1.5 bg-white/5 border border-white/10 rounded-full px-3 py-1">
              <PlayerAvatar avatar={p.avatar} name={p.name} size="sm" />
              <span className="text-sm font-medium">{p.name}</span>
            </div>
          ))}
        </div>

        {!isHost ? (
          <div className="text-center bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl p-8">
            <p className="text-white/60 text-lg animate-pulse">⏳ Đợi host cấu hình game...</p>
          </div>
        ) : (
          <>
            {/* Game Picker */}
            <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl p-6 mb-6">
              <h2 className="text-lg font-bold mb-4 text-white/80">Chọn game thêm vào</h2>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {gameMetas.map(meta => (
                  <button
                    key={meta.id}
                    onClick={() => addRound(meta)}
                    className="group flex flex-col items-center gap-2 p-4 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 hover:border-white/20 transition-all duration-200 hover:scale-[1.03]"
                  >
                    <span className="text-3xl group-hover:scale-110 transition-transform">{meta.icon}</span>
                    <span className="text-sm font-semibold text-center leading-tight">{meta.name}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Round List */}
            <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl p-6 mb-6">
              <h2 className="text-lg font-bold mb-4 text-white/80">
                Danh sách vòng chơi ({rounds.length})
              </h2>

              {rounds.length === 0 ? (
                <p className="text-white/30 text-center py-8">Chưa có vòng nào. Hãy chọn game ở trên.</p>
              ) : (
                <div className="space-y-3">
                  {rounds.map((round, idx) => {
                    const meta = gameMetas.find(m => m.id === round.gameId);
                    if (!meta) return null;
                    return (
                      <div key={idx} className="bg-white/5 border border-white/10 rounded-xl p-4">
                        <div className="flex items-center justify-between mb-3">
                          <div className="flex items-center gap-3">
                            <span className="text-white/30 font-mono text-sm w-6">{idx + 1}.</span>
                            <span className="text-2xl">{meta.icon}</span>
                            <span className="font-bold">{meta.name}</span>
                          </div>
                          <div className="flex items-center gap-1">
                            <button onClick={() => moveRound(idx, -1)} className="p-1.5 rounded-lg hover:bg-white/10 text-white/40 hover:text-white transition-colors" disabled={idx === 0}>▲</button>
                            <button onClick={() => moveRound(idx, 1)} className="p-1.5 rounded-lg hover:bg-white/10 text-white/40 hover:text-white transition-colors" disabled={idx === rounds.length - 1}>▼</button>
                            <button onClick={() => removeRound(idx)} className="p-1.5 rounded-lg hover:bg-red-500/20 text-red-400 hover:text-red-300 transition-colors ml-1">✕</button>
                          </div>
                        </div>
                        <div className="grid grid-cols-3 gap-3">
                          <div>
                            <label className="text-xs text-white/40 block mb-1">Số ván</label>
                            <input
                              type="number" min={1} max={20}
                              value={round.subRounds}
                              onChange={e => updateRound(idx, 'subRounds', Number(e.target.value))}
                              className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-center focus:outline-none focus:border-purple-400"
                            />
                          </div>
                          <div>
                            <label className="text-xs text-white/40 block mb-1">Thắng (+đ)</label>
                            <input
                              type="number" min={0} max={50}
                              value={round.rewards.win}
                              onChange={e => updateRound(idx, 'win', Number(e.target.value))}
                              className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-center text-green-400 focus:outline-none focus:border-green-400"
                            />
                          </div>
                          <div>
                            <label className="text-xs text-white/40 block mb-1">Thua (đ)</label>
                            <input
                              type="number" min={-50} max={0}
                              value={round.rewards.lose}
                              onChange={e => updateRound(idx, 'lose', Number(e.target.value))}
                              className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-center text-red-400 focus:outline-none focus:border-red-400"
                            />
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Start */}
            <Button
              size="lg"
              className="w-full py-6 text-lg font-black bg-linear-to-r from-purple-600 to-cyan-600 hover:from-purple-700 hover:to-cyan-700 border-0 shadow-lg shadow-purple-500/20"
              onClick={startGame}
              disabled={saving || rounds.length === 0}
            >
              {saving ? '⏳ Đang lưu...' : `🚀 Bắt Đầu (${rounds.length} vòng)`}
            </Button>
          </>
        )}
      </div>
    </div>
  );
}
