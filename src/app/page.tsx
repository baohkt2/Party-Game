'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import { useGameStore } from '@/lib/store';
import { createRandomAvatarSeed, DICEBEAR_STYLES, DiceBearStyle, getDiceBearAvatarUrl } from '@/lib/avatar';
import { PlayerAvatar } from '@/components/ui/player-avatar';
import { RoomListItem, RoomStatus } from '@/types';

export default function Home() {
  const router = useRouter();
  const { setPlayer, setRoom } = useGameStore();

  const [name, setName] = useState('');
  const [roomCode, setRoomCode] = useState('');
  const [mode, setMode] = useState<'create' | 'join'>('create');
  const [loading, setLoading] = useState(false);
  const [avatarStyle, setAvatarStyle] = useState<DiceBearStyle>('pixel-art');
  const [avatarSalt, setAvatarSalt] = useState('');
  const [rooms, setRooms] = useState<RoomListItem[]>([]);
  const [roomsLoading, setRoomsLoading] = useState(false);

  const trimmedName = name.trim();
  const avatarSeed = `${trimmedName || 'player'}${avatarSalt ? `-${avatarSalt}` : ''}`;

  const selectedAvatarUrl = useMemo(
    () => getDiceBearAvatarUrl({ style: avatarStyle, format: 'svg', seed: avatarSeed, size: 128 }),
    [avatarStyle, avatarSeed]
  );

  const avatarOptions = useMemo(
    () => DICEBEAR_STYLES.map((style) => ({
      style,
      url: getDiceBearAvatarUrl({ style, format: 'svg', seed: avatarSeed, size: 96 }),
    })),
    [avatarSeed]
  );

  const statusMeta: Record<RoomStatus, { label: string; badgeClass: string }> = {
    waiting: {
      label: 'Đang chờ',
      badgeClass: 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30',
    },
    configuring: {
      label: 'Đang cấu hình',
      badgeClass: 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/30',
    },
    playing: {
      label: 'Đang chơi',
      badgeClass: 'bg-amber-500/20 text-amber-300 border border-amber-500/30',
    },
    finished: {
      label: 'Kết thúc',
      badgeClass: 'bg-white/10 text-white/70 border border-white/20',
    },
  };

  const fetchRooms = useCallback(async () => {
    setRoomsLoading(true);
    try {
      const res = await fetch('/api/rooms', { cache: 'no-store' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Không thể tải danh sách phòng');
      setRooms(data.data.rooms || []);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Lỗi tải danh sách phòng');
    } finally {
      setRoomsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchRooms();
    const timer = window.setInterval(fetchRooms, 10000);
    return () => window.clearInterval(timer);
  }, [fetchRooms]);

  const saveSession = (roomId: string, playerId: string, playerName: string, avatar: string) => {
    localStorage.setItem('playerId', playerId);
    localStorage.setItem('playerName', playerName);
    localStorage.setItem('playerAvatar', avatar);
    localStorage.setItem('roomId', roomId);
    setPlayer(playerId, playerName);
    setRoom(roomId);
  };

  const handleCreateRoom = async () => {
    if (!trimmedName || trimmedName.length < 2) { toast.error('Tên phải có ít nhất 2 ký tự'); return; }
    setLoading(true);
    try {
      const res = await fetch('/api/rooms', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ hostName: trimmedName, avatar: selectedAvatarUrl }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Không thể tạo phòng');
      const { roomId, playerId, avatar } = data.data;
      saveSession(roomId, playerId, trimmedName, avatar || selectedAvatarUrl);
      toast.success(`Phòng ${roomId} đã được tạo!`);
      router.push(`/lobby/${roomId}`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Lỗi không xác định');
    } finally { setLoading(false); }
  };

  const handleJoinRoom = async (targetRoomCode?: string) => {
    const finalRoomCode = (targetRoomCode || roomCode).toUpperCase();

    if (!trimmedName || trimmedName.length < 2) { toast.error('Tên phải có ít nhất 2 ký tự'); return; }
    if (finalRoomCode.length !== 6) { toast.error('Mã phòng phải có 6 ký tự'); return; }

    setLoading(true);
    try {
      const res = await fetch('/api/rooms/join', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ roomCode: finalRoomCode, playerName: trimmedName, avatar: selectedAvatarUrl }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Không thể tham gia phòng');
      const { roomId, playerId, avatar } = data.data;
      saveSession(roomId, playerId, trimmedName, avatar || selectedAvatarUrl);
      toast.success(`Đã tham gia phòng ${roomId}!`);
      router.push(`/lobby/${roomId}`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Lỗi không xác định');
    } finally { setLoading(false); }
  };

  const formatStatusAge = (isoDate: string) => {
    const ageMs = Date.now() - new Date(isoDate).getTime();
    const ageMin = Math.max(0, Math.floor(ageMs / 60000));
    return `${ageMin} phút`;
  };

  return (
    <div className="min-h-screen bg-[#0a0a1a] flex items-center justify-center p-4 relative overflow-hidden">
      {/* BG effects */}
      <div className="absolute inset-0 bg-linear-to-br from-purple-900/30 via-transparent to-cyan-900/30" />
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-125 h-125 bg-purple-600/15 rounded-full blur-3xl" />
      <div className="absolute bottom-0 right-0 w-100 h-100 bg-cyan-600/10 rounded-full blur-3xl" />

      <div className="relative z-10 w-full max-w-6xl">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-20 h-20 rounded-2xl bg-linear-to-br from-purple-500 to-cyan-500 shadow-lg shadow-purple-500/30 mb-4">
            <span className="text-4xl">🎮</span>
          </div>
          <h1 className="text-4xl font-black bg-linear-to-r from-purple-400 via-pink-400 to-cyan-400 bg-clip-text text-transparent">
            Vua Trò Chơi
          </h1>
          <p className="text-white/40 mt-1">Party Game Platform</p>
        </div>

        <div className="grid lg:grid-cols-[minmax(0,430px)_1fr] gap-6 items-start">
          {/* Create / Join Card */}
          <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl p-6 shadow-2xl">
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

            <div className={`mb-5 rounded-xl border border-white/10 bg-white/5 p-4 ${trimmedName.length < 2 ? 'opacity-50' : ''}`}>
              <div className="flex items-center justify-between mb-3">
                <p className="text-sm font-semibold text-white/70">Chọn avatar DiceBear</p>
                <button
                  type="button"
                  onClick={() => setAvatarSalt(createRandomAvatarSeed('rnd'))}
                  disabled={loading || trimmedName.length < 2}
                  className="text-xs px-2.5 py-1 rounded-full border border-white/20 text-white/70 hover:text-white hover:bg-white/10 transition"
                >
                  🎲 Random seed
                </button>
              </div>

              <div className="flex items-center gap-3 mb-4">
                <PlayerAvatar avatar={selectedAvatarUrl} name={trimmedName || 'player'} size="xl" />
                <div>
                  <p className="text-sm text-white/80 font-medium">{trimmedName || 'Player'}</p>
                  <p className="text-xs text-white/40">Style: {avatarStyle}</p>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-2">
                {avatarOptions.map((option) => (
                  <button
                    key={option.style}
                    type="button"
                    disabled={loading || trimmedName.length < 2}
                    onClick={() => setAvatarStyle(option.style)}
                    className={`flex items-center gap-2 rounded-lg border px-2 py-1.5 text-left transition ${
                      avatarStyle === option.style
                        ? 'border-purple-400 bg-purple-500/20 text-white'
                        : 'border-white/10 bg-white/5 text-white/70 hover:bg-white/10'
                    }`}
                  >
                    <PlayerAvatar avatar={option.url} name={trimmedName || 'player'} size="sm" />
                    <span className="text-xs truncate">{option.style}</span>
                  </button>
                ))}
              </div>
              {trimmedName.length < 2 && (
                <p className="mt-3 text-xs text-white/40">Nhập tên từ 2 ký tự để mở chọn avatar.</p>
              )}
            </div>

            <div className="flex gap-2 mb-5">
              <button
                onClick={() => setMode('create')}
                className={`flex-1 py-2.5 rounded-xl font-semibold text-sm transition-all duration-200 ${
                  mode === 'create'
                    ? 'bg-linear-to-r from-purple-600 to-cyan-600 text-white shadow-lg shadow-purple-500/20'
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
                    ? 'bg-linear-to-r from-purple-600 to-cyan-600 text-white shadow-lg shadow-purple-500/20'
                    : 'bg-white/5 text-white/40 hover:bg-white/10 hover:text-white/60 border border-white/10'
                }`}
                disabled={loading}
              >
                Tham gia
              </button>
            </div>

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

            <Button
              size="lg"
              className="w-full h-12 text-lg font-bold bg-linear-to-r from-purple-600 to-cyan-600 hover:from-purple-700 hover:to-cyan-700 border-0 shadow-lg shadow-purple-500/20 transition-all duration-200 hover:shadow-purple-500/30 hover:scale-[1.02]"
              onClick={mode === 'create' ? handleCreateRoom : () => handleJoinRoom()}
              disabled={loading || !trimmedName || trimmedName.length < 2 || (mode === 'join' && roomCode.length !== 6)}
            >
              {loading ? '⏳ Đang xử lý...' : mode === 'create' ? '🎲 Tạo phòng mới' : '🚪 Vào phòng'}
            </Button>
          </div>

          {/* Room list */}
          <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl p-6 shadow-2xl">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-black text-white/90">Danh sách phòng hiện hữu</h2>
              <button
                type="button"
                onClick={fetchRooms}
                disabled={roomsLoading}
                className="text-xs px-3 py-1.5 rounded-full border border-white/20 text-white/70 hover:text-white hover:bg-white/10 transition"
              >
                {roomsLoading ? 'Đang tải...' : 'Làm mới'}
              </button>
            </div>

            <div className="space-y-3 max-h-115 overflow-y-auto pr-1">
              {rooms.length === 0 && !roomsLoading && (
                <div className="text-center py-10 text-white/35 border border-white/10 rounded-xl bg-white/5">
                  Hiện chưa có phòng nào.
                </div>
              )}

              {rooms.map((room) => {
                const canJoin = room.status === 'waiting' && room.playerCount < 10;
                return (
                  <div key={room.id} className="rounded-xl border border-white/10 bg-white/5 p-4">
                    <div className="flex items-start justify-between gap-3 mb-3">
                      <div>
                        <p className="font-mono text-xl tracking-[0.2em] text-purple-300">{room.id}</p>
                        <p className="text-xs text-white/40 mt-1">
                          Trạng thái hiện tại: {formatStatusAge(room.statusChangedAt)}
                        </p>
                      </div>
                      <span className={`text-xs px-2.5 py-1 rounded-full font-semibold ${statusMeta[room.status].badgeClass}`}>
                        {statusMeta[room.status].label}
                      </span>
                    </div>

                    <div className="flex items-center justify-between text-sm text-white/65 mb-3">
                      <span>👥 {room.playerCount}/10 người</span>
                      <span>🎯 Vòng {room.currentGame}</span>
                    </div>

                    <Button
                      size="sm"
                      className="w-full"
                      variant={canJoin ? 'default' : 'secondary'}
                      disabled={!canJoin || loading}
                      onClick={() => handleJoinRoom(room.id)}
                    >
                      {canJoin ? 'Vào phòng ngay' : 'Chỉ vào được khi phòng ở trạng thái waiting'}
                    </Button>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        <p className="text-center text-white/20 text-xs mt-6">v2.0 · Modular Game Engine</p>
      </div>
    </div>
  );
}
