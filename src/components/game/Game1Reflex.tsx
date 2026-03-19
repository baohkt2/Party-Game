'use client';

import { useState, useEffect, useRef } from 'react';
import { Player, GamePhase } from '@/types';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { pusherClient, getRoomChannel } from '@/lib/pusher';
import { toast } from 'sonner';

interface GameProps {
  roomId: string;
  players: Player[];
  isHost: boolean;
}

interface ReflexResult {
  playerId: string;
  time: number;
  early: boolean;
}

export default function Game1Reflex({ roomId, players, isHost }: GameProps) {
  const [phase, setPhase] = useState<GamePhase['reflex']>('waiting');
  const [results, setResults] = useState<ReflexResult[]>([]);
  const [myResult, setMyResult] = useState<ReflexResult | null>(null);
  const [startTime, setStartTime] = useState<number>(0);
  
  const timeoutRef = useRef<NodeJS.Timeout>(null);
  const myId = typeof window !== 'undefined' ? localStorage.getItem('playerId') : null;

  useEffect(() => {
    const channelName = getRoomChannel(roomId);
    const channel = pusherClient.subscribe(channelName);

    channel.bind('reflex-start', (data: { delay: number }) => {
      setPhase('ready');
      setResults([]);
      setMyResult(null);
      // Bắt đầu đếm ngược sang Green
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      timeoutRef.current = setTimeout(() => {
        setPhase('go');
        setStartTime(Date.now());
      }, data.delay);
    });

    channel.bind('reflex-click', (data: ReflexResult) => {
      setResults((prev) => {
        if (prev.find((r) => r.playerId === data.playerId)) return prev;
        return [...prev, data];
      });
    });

    channel.bind('reflex-end', () => {
      setPhase('result');
    });

    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      channel.unbind('reflex-start');
      channel.unbind('reflex-click');
      channel.unbind('reflex-end');
      // Không unsubscribe vì GamePage đang quản lý channel
    };
  }, [roomId]);

  // Host kết thúc game khi tất cả đã bấm
  useEffect(() => {
    if (isHost && phase === 'go' && results.length === players.length && players.length > 0) {
      endRound();
    }
  }, [results, players.length, isHost, phase]);

  const startGame = async () => {
    const delay = Math.floor(Math.random() * 4000) + 2000; // 2-6 giây
    await fetch(`/api/rooms/${roomId}/game/action`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ event: 'reflex-start', data: { delay } }),
    });
  };

  const endRound = async () => {
    await fetch(`/api/rooms/${roomId}/game/action`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ event: 'reflex-end', data: {} }),
    });
  };

  const handleClick = async () => {
    if (phase === 'waiting' || phase === 'result' || myResult) return;

    let time = 0;
    let early = false;

    if (phase === 'ready') {
      early = true;
      time = 99999;
      toast.error('Bạn bấm quá sớm!');
    } else if (phase === 'go') {
      time = Date.now() - startTime;
    }

    const resultData: ReflexResult = { playerId: myId!, time, early };
    setMyResult(resultData);

    await fetch(`/api/rooms/${roomId}/game/action`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ event: 'reflex-click', data: resultData }),
    });
  };

  const getBackgroundColor = () => {
    if (phase === 'ready') return 'bg-red-500 hover:bg-red-600 cursor-pointer';
    if (phase === 'go') return 'bg-green-500 hover:bg-green-600 cursor-pointer';
    return 'bg-white';
  };

  const renderContent = () => {
    if (phase === 'waiting') {
      return (
        <div className="flex flex-col items-center gap-6">
          <h2 className="text-3xl font-bold">Vòng 1: Thử Thách Phản Xạ</h2>
          <p className="text-gray-600">Khi màn hình chuyển sang màu Xanh, hãy bấm nhanh nhất có thể!</p>
          <p className="text-red-500 font-semibold text-sm">Cảnh báo: Bấm lúc màn hình Đỏ sẽ bị phạt!</p>
          {isHost ? (
            <Button size="lg" onClick={startGame}>Bắt đầu Vòng 1</Button>
          ) : (
            <p className="animate-pulse text-lg font-medium text-blue-600">Chờ host bắt đầu...</p>
          )}
        </div>
      );
    }

    if (phase === 'ready' || phase === 'go') {
      return (
        <div 
          className={`flex flex-col items-center justify-center h-64 rounded-xl text-white transition-colors duration-200 select-none ${getBackgroundColor()}`}
          onPointerDown={handleClick}
        >
          {phase === 'ready' ? (
            <span className="text-4xl font-bold uppercase tracking-widest">Đợi...</span>
          ) : (
            <span className="text-5xl font-bold uppercase tracking-widest">BẤM!</span>
          )}
        </div>
      );
    }

    if (phase === 'result') {
      // Sort results
      const sorted = [...results].sort((a, b) => a.time - b.time);
      const losers = sorted.filter(r => r.early || r.time === sorted[sorted.length - 1]?.time);
      
      return (
        <div className="flex flex-col gap-4">
          <h2 className="text-2xl font-bold text-center mb-4">Kết Quả Phản Xạ</h2>
          <div className="space-y-2 max-h-60 overflow-y-auto">
            {sorted.map((r, i) => {
              const p = players.find(p => p.id === r.playerId);
              const isLoser = losers.some(l => l.playerId === r.playerId);
              return (
                <div key={r.playerId} className={`flex justify-between items-center p-3 rounded-lg border ${isLoser ? 'bg-red-100 border-red-300' : 'bg-gray-50 border-gray-200'}`}>
                  <div className="flex items-center gap-2">
                    <span className="text-xl">{p?.avatar}</span>
                    <span className="font-medium">{p?.name}</span>
                    {r.playerId === myId && <span className="text-xs bg-blue-100 text-blue-800 px-2 rounded-full">Bạn</span>}
                  </div>
                  <div className="font-mono font-bold">
                    {r.early ? <span className="text-red-600">Bấm sớm!</span> : `${r.time}ms`}
                  </div>
                </div>
              );
            })}
          </div>
          <div className="mt-4 p-4 bg-red-50 text-red-800 rounded-lg text-center border border-red-200">
            <p className="font-semibold">🍻 Hình phạt vòng này:</p>
            <p>Những người bấm sớm hoặc chậm nhất phải uống 1 ngụm/chén!</p>
          </div>
        </div>
      );
    }
  };

  return (
    <Card className={`p-6 max-w-2xl mx-auto w-full shadow-lg ${phase === 'ready' ? 'ring-4 ring-red-500' : phase === 'go' ? 'ring-4 ring-green-500' : ''}`}>
      {renderContent()}
    </Card>
  );
}
