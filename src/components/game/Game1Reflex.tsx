'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { GamePhase } from '@/types';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { PlayerAvatar } from '@/components/ui/player-avatar';
import { getSessionPlayerId } from '@/lib/clientSession';
import { pusherClient, getRoomChannel } from '@/lib/pusher';
import { toast } from 'sonner';
import { GameProps } from '@/lib/gameRegistry';

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
  const scoredRef = useRef(false);
  
  const timeoutRef = useRef<NodeJS.Timeout>(null);
  const myId = getSessionPlayerId();

  const endRound = useCallback(() => {
    fetch(`/api/rooms/${roomId}/game/action`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ event: 'reflex-end', data: {} }),
    });
  }, [roomId]);

  useEffect(() => {
    const channelName = getRoomChannel(roomId);
    const channel = pusherClient.subscribe(channelName);

    channel.bind('reflex-start', (data: { delay: number }) => {
      setPhase('ready');
      setResults([]);
      setMyResult(null);
      scoredRef.current = false;
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
    };
  }, [roomId]);

  // Host kết thúc game khi tất cả đã bấm
  useEffect(() => {
    if (isHost && phase === 'go' && results.length === players.length && players.length > 0) {
      endRound();
    }
  }, [results, players.length, isHost, phase, endRound]);

  // Host auto-score khi vào result
  useEffect(() => {
    if (!isHost || phase !== 'result' || scoredRef.current || results.length === 0) return;
    scoredRef.current = true;

    const sorted = [...results].sort((a, b) => a.time - b.time);
    const fastest = sorted.find(r => !r.early);
    const slowest = sorted.filter(r => !r.early).pop();

    const scoreUpdates: Promise<void>[] = [];
    sorted.forEach(r => {
      let delta = 0;
      if (r.early) {
        delta = -1;
      } else if (fastest && r.playerId === fastest.playerId) {
        delta = 3;
      } else if (slowest && r.playerId === slowest.playerId) {
        delta = -1;
      }
      if (delta !== 0) {
        const p = players.find(p => p.id === r.playerId);
        const currentScore = p?.gameScores?.game1 || 0;
        scoreUpdates.push(
          fetch(`/api/rooms/${roomId}/game/score`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ playerId: r.playerId, gameNumber: 1, score: currentScore + delta }),
          }).then(() => {})
        );
      }
    });
    Promise.all(scoreUpdates);
  }, [phase, isHost, results, players, roomId]);

  const startGame = () => {
    const delay = Math.floor(Math.random() * 4000) + 2000;
    fetch(`/api/rooms/${roomId}/game/action`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ event: 'reflex-start', data: { delay } }),
    });
  };

  const handleClick = () => {
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

    const resultData: ReflexResult = { playerId: myId ? myId : '', time, early };
    setMyResult(resultData);

    fetch(`/api/rooms/${roomId}/game/action`, {
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
      const sorted = [...results].sort((a, b) => a.time - b.time);
      const fastest = sorted.find(r => !r.early);
      const slowest = sorted.filter(r => !r.early).pop();
      
      return (
        <div className="flex flex-col gap-4">
          <h2 className="text-2xl font-bold text-center mb-4">Kết Quả Phản Xạ</h2>
          <div className="space-y-2 max-h-60 overflow-y-auto">
            {sorted.map((r) => {
              const p = players.find(p => p.id === r.playerId);
              const isFastest = fastest && r.playerId === fastest.playerId && !r.early;
              const isSlowest = (slowest && r.playerId === slowest.playerId && !r.early) || r.early;
              let badge = '';
              if (r.early) badge = '❌ Bấm sớm (-1đ)';
              else if (isFastest) badge = '🥇 Nhanh nhất (+3đ)';
              else if (isSlowest) badge = '🐢 Chậm nhất (-1đ)';

              return (
                <div key={r.playerId} className={`flex justify-between items-center p-3 rounded-lg border ${isSlowest || r.early ? 'bg-red-100 border-red-300' : isFastest ? 'bg-green-100 border-green-300' : 'bg-gray-50 border-gray-200'}`}>
                  <div className="flex items-center gap-2">
                    {p && <PlayerAvatar avatar={p.avatar} name={p.name} size="sm" />}
                    <span className="font-medium">{p?.name}</span>
                    {r.playerId === myId && <span className="text-xs bg-blue-100 text-blue-800 px-2 rounded-full">Bạn</span>}
                  </div>
                  <div className="text-right">
                    <div className="font-mono font-bold">
                      {r.early ? <span className="text-red-600">Bấm sớm!</span> : `${r.time}ms`}
                    </div>
                    {badge && <div className="text-xs font-semibold mt-1">{badge}</div>}
                  </div>
                </div>
              );
            })}
          </div>
          <div className="mt-4 p-4 bg-red-50 text-red-800 rounded-lg text-center border border-red-200">
            <p className="font-semibold">🍻 Hình phạt vòng này:</p>
            <p>Người bấm sớm/chậm nhất phải uống 1 ngụm!</p>
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
