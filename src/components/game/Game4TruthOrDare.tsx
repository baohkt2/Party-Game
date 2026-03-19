'use client';

import { useState, useEffect } from 'react';
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

const TRUTHS = [
  "Nói tên người bạn từng crush trong nhóm này (nếu có)?",
  "Bí mật đáng xấu hổ nhất của bạn là gì?",
  "Người bạn nhắn tin gần đây nhất là ai?",
  "Bạn đã bao giờ nói dối để tránh đi chơi với bạn bè chưa?",
  "Điều điên rồ nhất bạn từng làm khi say là gì?"
];

const DARES = [
  "Gọi điện cho người yêu cũ (hoặc crush) và nói 'Tự nhiên nhớ ghê'.",
  "Hát một đoạn nhạc thiếu nhi bằng giọng ma mị.",
  "Đăng một status \"Tôi đang cô đơn\" lên mạng xã hội.",
  "Uống 1 ngụm bia pha với tương ớt/nước mắm (tùy host).",
  "Điệu nhảy sexy 15 giây."
];

export default function Game4TruthOrDare({ roomId, players, isHost }: GameProps) {
  const [phase, setPhase] = useState<GamePhase['truthOrDare']>('selection');
  const [currentPlayerIndex, setCurrentPlayerIndex] = useState(0);
  const [promptData, setPromptData] = useState<{ type: 'truth'|'dare', text: string } | null>(null);

  const myId = typeof window !== 'undefined' ? localStorage.getItem('playerId') : null;
  const currentPlayer = players[currentPlayerIndex % players.length] || players[0];
  const isMyTurn = currentPlayer?.id === myId;

  useEffect(() => {
    const channelName = getRoomChannel(roomId);
    const channel = pusherClient.subscribe(channelName);

    channel.bind('tod-select', (data: { type: 'truth'|'dare', text: string }) => {
      setPromptData(data);
      setPhase('prompt');
    });

    channel.bind('tod-judge', () => {
      setPhase('result');
    });

    channel.bind('tod-next', (data: { nextIndex: number }) => {
      setCurrentPlayerIndex(data.nextIndex);
      setPromptData(null);
      setPhase('selection');
    });

    return () => {
      channel.unbind('tod-select');
      channel.unbind('tod-judge');
      channel.unbind('tod-next');
    };
  }, [roomId]);

  const selectOption = async (type: 'truth' | 'dare') => {
    const list = type === 'truth' ? TRUTHS : DARES;
    const text = list[Math.floor(Math.random() * list.length)];

    await fetch(`/api/rooms/${roomId}/game/action`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        event: 'tod-select', 
        data: { type, text } 
      }),
    });
  };

  const judgeTurn = async (success: boolean) => {
    // Nếu thành công +2 điểm, thất bại -1
    const currentScore = currentPlayer.gameScores?.game4 || 0;
    const newScore = success ? currentScore + 2 : currentScore - 1;

    await fetch(`/api/rooms/${roomId}/game/score`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        playerId: currentPlayer.id,
        gameNumber: 4,
        score: newScore
      }),
    });

    if (!success) {
      toast.error(`${currentPlayer.name} bị phạt uống!`);
    } else {
      toast.success(`${currentPlayer.name} nhận 2 điểm!`);
    }

    await fetch(`/api/rooms/${roomId}/game/action`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ event: 'tod-judge', data: {} }),
    });
  };

  const nextTurn = async () => {
    const nextIndex = (currentPlayerIndex + 1) % players.length;
    await fetch(`/api/rooms/${roomId}/game/action`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ event: 'tod-next', data: { nextIndex } }),
    });
  };

  if (!currentPlayer) return <p>Đang tải...</p>;

  return (
    <Card className="p-8 max-w-2xl mx-auto w-full text-center">
      <h2 className="text-3xl font-bold mb-6">Vòng 4: Thật Hay Thách</h2>

      <div className="mb-8">
        <p className="text-gray-500 mb-2">Đang tới lượt của:</p>
        <div className="inline-flex items-center gap-2 bg-blue-50 px-6 py-3 rounded-full border border-blue-200">
          <span className="text-4xl">{currentPlayer.avatar}</span>
          <span className="text-2xl font-bold text-blue-700">{currentPlayer.name}</span>
          {isMyTurn && <span className="ml-2 text-sm bg-blue-600 text-white px-2 py-1 rounded-full">(Là bạn)</span>}
        </div>
      </div>

      {phase === 'selection' && (
        <div className="space-y-4">
          <h3 className="text-xl font-semibold mb-6">Hãy đưa ra lựa chọn!</h3>
          {isMyTurn ? (
            <div className="flex justify-center gap-6">
              <Button size="lg" className="w-40 text-lg bg-green-500 hover:bg-green-600" onClick={() => selectOption('truth')}>
                🤫 Sự Thật
              </Button>
              <Button size="lg" className="w-40 text-lg bg-red-500 hover:bg-red-600" onClick={() => selectOption('dare')}>
                🔥 Thử Thách
              </Button>
            </div>
          ) : (
            <p className="text-gray-500 animate-pulse text-lg">Đang chờ {currentPlayer.name} chọn...</p>
          )}
        </div>
      )}

      {phase === 'prompt' && promptData && (
        <div className="space-y-6">
          <div className={`p-6 rounded-xl border-2 ${promptData.type === 'truth' ? 'bg-green-50 border-green-200 text-green-800' : 'bg-red-50 border-red-200 text-red-800'}`}>
            <p className="text-sm font-bold uppercase tracking-widest mb-2">
              {promptData.type === 'truth' ? '🤫 Sự Thật' : '🔥 Thử Thách'}
            </p>
            <p className="text-2xl font-semibold">&quot;{promptData.text}&quot;</p>
          </div>

          {!isHost ? (
            <p className="text-gray-500 text-sm">Chờ host phán quyết...</p>
          ) : (
            <div className="flex gap-4 justify-center mt-6">
              <Button onClick={() => judgeTurn(true)} className="bg-blue-600 hover:bg-blue-700">
                Qua Ải (+2 điểm)
              </Button>
              <Button onClick={() => judgeTurn(false)} variant="destructive">
                Phạt Uống (-1 điểm)
              </Button>
            </div>
          )}
        </div>
      )}

      {phase === 'result' && (
        <div className="space-y-6">
          <div className="text-2xl font-bold text-gray-800">Đã Phán Quyết Xong!</div>
          {isHost && (
            <Button size="lg" className="w-full" onClick={nextTurn}>
              Lượt Tiếp Theo ⏭️
            </Button>
          )}
        </div>
      )}
    </Card>
  );
}
