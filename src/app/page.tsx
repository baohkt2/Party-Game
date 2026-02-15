'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
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
    if (!name.trim() || name.trim().length < 2) {
      toast.error('Tên phải có ít nhất 2 ký tự');
      return;
    }

    setLoading(true);
    try {
      const res = await fetch('/api/rooms', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ hostName: name.trim() }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Không thể tạo phòng');
      }

      const { roomId, playerId } = data.data;

      // Save to localStorage and store
      localStorage.setItem('playerId', playerId);
      localStorage.setItem('playerName', name.trim());
      localStorage.setItem('roomId', roomId);
      
      setPlayer(playerId, name.trim());
      setRoom(roomId);

      toast.success(`Phòng ${roomId} đã được tạo!`);
      router.push(`/lobby/${roomId}`);
    } catch (error) {
      console.error('Create room error:', error);
      toast.error(error instanceof Error ? error.message : 'Lỗi không xác định');
    } finally {
      setLoading(false);
    }
  };

  const handleJoinRoom = async () => {
    if (!name.trim() || name.trim().length < 2) {
      toast.error('Tên phải có ít nhất 2 ký tự');
      return;
    }

    if (roomCode.length !== 6) {
      toast.error('Mã phòng phải có 6 ký tự');
      return;
    }

    setLoading(true);
    try {
      const res = await fetch('/api/rooms/join', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          roomCode: roomCode.toUpperCase(), 
          playerName: name.trim() 
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Không thể tham gia phòng');
      }

      const { roomId, playerId } = data.data;

      // Save to localStorage and store
      localStorage.setItem('playerId', playerId);
      localStorage.setItem('playerName', name.trim());
      localStorage.setItem('roomId', roomId);
      
      setPlayer(playerId, name.trim());
      setRoom(roomId);

      toast.success(`Đã tham gia phòng ${roomId}!`);
      router.push(`/lobby/${roomId}`);
    } catch (error) {
      console.error('Join room error:', error);
      toast.error(error instanceof Error ? error.message : 'Lỗi không xác định');
    } finally {
      setLoading(false);
    }
  };

  // Quick play for development
  const handleQuickPlay = () => {
    const randomName = `Player${Math.floor(Math.random() * 1000)}`;
    setName(randomName);
    setTimeout(() => {
      const btn = document.getElementById('create-room-btn');
      if (btn) btn.click();
    }, 100);
  };

  return (
    <div className="min-h-screen bg-linear-to-br from-purple-500 to-pink-500 flex items-center justify-center p-4">
      <Card className="w-full max-w-md p-6 space-y-6">
        <div className="text-center">
          <h1 className="text-4xl font-bold mb-2">🎮 Vua Trò Chơi</h1>
          <p className="text-gray-600">Party Game Platform</p>
        </div>

        {/* Name Input */}
        <div className="space-y-2">
          <label className="text-sm font-medium text-gray-700">
            Nhập tên của bạn
          </label>
          <Input
            placeholder="Tên của bạn (2-15 ký tự)"
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={15}
            className="text-lg"
            disabled={loading}
          />
        </div>

        {/* Mode Selection */}
        <div className="flex gap-2">
          <Button
            variant={mode === 'create' ? 'default' : 'outline'}
            onClick={() => setMode('create')}
            className="flex-1"
            disabled={loading}
          >
            Tạo phòng
          </Button>
          <Button
            variant={mode === 'join' ? 'default' : 'outline'}
            onClick={() => setMode('join')}
            className="flex-1"
            disabled={loading}
          >
            Tham gia
          </Button>
        </div>

        {/* Room Code Input (only for join mode) */}
        {mode === 'join' && (
          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-700">
              Mã phòng
            </label>
            <Input
              placeholder="Nhập mã phòng (6 ký tự)"
              value={roomCode}
              onChange={(e) => setRoomCode(e.target.value.toUpperCase())}
              maxLength={6}
              className="text-lg text-center font-mono tracking-wider"
              disabled={loading}
            />
          </div>
        )}

        {/* Action Button */}
        <Button
          id="create-room-btn"
          size="lg"
          className="w-full"
          onClick={mode === 'create' ? handleCreateRoom : handleJoinRoom}
          disabled={
            loading ||
            !name.trim() ||
            name.trim().length < 2 ||
            (mode === 'join' && roomCode.length !== 6)
          }
        >
          {loading
            ? '⏳ Đang xử lý...'
            : mode === 'create'
            ? '🎲 Tạo phòng mới'
            : '🚪 Vào phòng'}
        </Button>

        {/* Quick Play (dev only) */}
        {process.env.NODE_ENV === 'development' && (
          <Button
            variant="outline"
            size="sm"
            className="w-full"
            onClick={handleQuickPlay}
            disabled={loading}
          >
            ⚡ Chơi nhanh (Dev)
          </Button>
        )}
      </Card>
    </div>
  );
}
