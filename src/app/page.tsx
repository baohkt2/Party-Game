'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import { useGameStore } from '@/lib/store';

export default function Home() {
  const router = useRouter();
  const { setPlayer, setRoom } = useGameStore();

  const [name, setName] = useState('');
  const [roomCode, setRoomCode] = useState('');
  const [mode, setMode] = useState<'create' | 'join'>('create');
  const [loading, setLoading] = useState(false);

  const handleCreateRoom = async () => {
    if (!name.trim() || name.trim().length < 2) { toast.error('Tên phải có ít nhất 2 ký tự'); return; }
    setLoading(true);
    try {
      const res = await fetch('/api/rooms', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ hostName: name.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Không thể tạo phòng');
      const { roomId, playerId } = data.data;
      localStorage.setItem('playerId', playerId);
      localStorage.setItem('playerName', name.trim());
      localStorage.setItem('roomId', roomId);
      setPlayer(playerId, name.trim());
      setRoom(roomId);
      toast.success(`Phòng ${roomId} đã được tạo!`);
      router.push(`/lobby/${roomId}`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Lỗi không xác định');
    } finally { setLoading(false); }
  };

  const handleJoinRoom = async () => {
    if (!name.trim() || name.trim().length < 2) { toast.error('Tên phải có ít nhất 2 ký tự'); return; }
    if (roomCode.length !== 6) { toast.error('Mã phòng phải có 6 ký tự'); return; }
    setLoading(true);
    try {
      const res = await fetch('/api/rooms/join', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ roomCode: roomCode.toUpperCase(), playerName: name.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Không thể tham gia phòng');
      const { roomId, playerId } = data.data;
      localStorage.setItem('playerId', playerId);
      localStorage.setItem('playerName', name.trim());
      localStorage.setItem('roomId', roomId);
      setPlayer(playerId, name.trim());
      setRoom(roomId);
      toast.success(`Đã tham gia phòng ${roomId}!`);
      router.push(`/lobby/${roomId}`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Lỗi không xác định');
    } finally { setLoading(false); }
  };

  return (
    <div className="min-h-screen bg-[#0a0a1a] flex items-center justify-center p-4 relative overflow-hidden">
      {/* BG effects */}
      <div className="absolute inset-0 bg-gradient-to-br from-purple-900/30 via-transparent to-cyan-900/30" />
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[500px] h-[500px] bg-purple-600/15 rounded-full blur-3xl" />
      <div className="absolute bottom-0 right-0 w-[400px] h-[400px] bg-cyan-600/10 rounded-full blur-3xl" />

      <div className="relative z-10 w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-20 h-20 rounded-2xl bg-gradient-to-br from-purple-500 to-cyan-500 shadow-lg shadow-purple-500/30 mb-4">
            <span className="text-4xl">🎮</span>
          </div>
          <h1 className="text-4xl font-black bg-gradient-to-r from-purple-400 via-pink-400 to-cyan-400 bg-clip-text text-transparent">
            Vua Trò Chơi
          </h1>
          <p className="text-white/40 mt-1">Party Game Platform</p>
        </div>

        {/* Card */}
        <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl p-6 shadow-2xl">
          {/* Name */}
          <div className="mb-5">
            <label className="text-sm font-medium text-white/50 block mb-2">Tên của bạn</label>
            <Input
              placeholder="Nhập tên (2-15 ký tự)"
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={15}
              disabled={loading}
              className="bg-white/5 border-white/10 text-white placeholder:text-white/20 text-lg h-12 focus:border-purple-400"
            />
          </div>

          {/* Mode toggle */}
          <div className="flex gap-2 mb-5">
            <button
              onClick={() => setMode('create')}
              className={`flex-1 py-2.5 rounded-xl font-semibold text-sm transition-all duration-200 ${
                mode === 'create'
                  ? 'bg-gradient-to-r from-purple-600 to-cyan-600 text-white shadow-lg shadow-purple-500/20'
                  : 'bg-white/5 text-white/40 hover:bg-white/10 hover:text-white/60 border border-white/10'
              }`}
              disabled={loading}
            >
              Tạo phòng
            </button>
            <button
              onClick={() => setMode('join')}
              className={`flex-1 py-2.5 rounded-xl font-semibold text-sm transition-all duration-200 ${
                mode === 'join'
                  ? 'bg-gradient-to-r from-purple-600 to-cyan-600 text-white shadow-lg shadow-purple-500/20'
                  : 'bg-white/5 text-white/40 hover:bg-white/10 hover:text-white/60 border border-white/10'
              }`}
              disabled={loading}
            >
              Tham gia
            </button>
          </div>

          {/* Room code */}
          {mode === 'join' && (
            <div className="mb-5">
              <label className="text-sm font-medium text-white/50 block mb-2">Mã phòng</label>
              <Input
                placeholder="XXXXXX"
                value={roomCode}
                onChange={(e) => setRoomCode(e.target.value.toUpperCase())}
                maxLength={6}
                disabled={loading}
                className="bg-white/5 border-white/10 text-white placeholder:text-white/20 text-lg text-center font-mono tracking-[0.3em] h-12 focus:border-purple-400"
              />
            </div>
          )}

          {/* CTA */}
          <Button
            size="lg"
            className="w-full h-12 text-lg font-bold bg-gradient-to-r from-purple-600 to-cyan-600 hover:from-purple-700 hover:to-cyan-700 border-0 shadow-lg shadow-purple-500/20 transition-all duration-200 hover:shadow-purple-500/30 hover:scale-[1.02]"
            onClick={mode === 'create' ? handleCreateRoom : handleJoinRoom}
            disabled={loading || !name.trim() || name.trim().length < 2 || (mode === 'join' && roomCode.length !== 6)}
          >
            {loading ? '⏳ Đang xử lý...' : mode === 'create' ? '🎲 Tạo phòng mới' : '🚪 Vào phòng'}
          </Button>
        </div>

        <p className="text-center text-white/20 text-xs mt-6">v2.0 · Modular Game Engine</p>
      </div>
    </div>
  );
}
