'use client';

import { useState, useEffect } from 'react';
import { GamePhase } from '@/types';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { pusherClient, getRoomChannel } from '@/lib/pusher';
import { toast } from 'sonner';
import { GameProps } from '@/lib/gameRegistry';

const TRUTHS = [
  "Nói tên người bạn từng crush trong nhóm này (nếu có)?",
  "Bí mật đáng xấu hổ nhất của bạn là gì?",
  "Người bạn nhắn tin gần đây nhất là ai?",
  "Bạn đã bao giờ nói dối để tránh đi chơi với bạn bè chưa?",
  "Điều điên rồ nhất bạn từng làm khi say là gì?",
  "Bạn có bao giờ stalk ai trong nhóm này không?",
  "Bạn thực sự nghĩ gì về người ngồi bên trái?",
  "Lần cuối bạn khóc vì chuyện tình cảm là khi nào?"
];

const DARES = [
  "Gọi điện cho người yêu cũ (hoặc crush) và nói 'Tự nhiên nhớ ghê'.",
  "Hát một đoạn nhạc thiếu nhi bằng giọng ma mị.",
  "Đăng một status \"Tôi đang cô đơn\" lên mạng xã hội.",
  "Uống 1 ngụm bia pha với tương ớt/nước mắm (tùy chọn).",
  "Điệu nhảy sexy 15 giây.",
  "Nhắn tin cho crush hiện tại nói 'Anh/Em thích bạn'.",
  "Bắt chước 1 con vật trong 30 giây.",
  "Selfie mặt xấu nhất rồi đăng story."
];

export default function Game4TruthOrDare({ roomId, players, isHost }: GameProps) {
  const [phase, setPhase] = useState<GamePhase['truthOrDare']>('selection');
  const [currentPlayerIndex, setCurrentPlayerIndex] = useState(0);
  const [promptData, setPromptData] = useState<{ type: 'truth' | 'dare', text: string } | null>(null);

  // Voting
  const [votes, setVotes] = useState<Record<string, boolean>>({});
  const [myVote, setMyVote] = useState<boolean | null>(null);
  const [voteResult, setVoteResult] = useState<{ success: boolean, yesCount: number, noCount: number } | null>(null);

  const myId = typeof window !== 'undefined' ? localStorage.getItem('playerId') : null;
  const currentPlayer = players[currentPlayerIndex % players.length] || players[0];
  const isMyTurn = currentPlayer?.id === myId;

  useEffect(() => {
    const channelName = getRoomChannel(roomId);
    const channel = pusherClient.subscribe(channelName);

    channel.bind('tod-select', (data: { type: 'truth' | 'dare', text: string }) => {
      setPromptData(data);
      setPhase('prompt');
      setVotes({});
      setMyVote(null);
      setVoteResult(null);
    });

    channel.bind('tod-vote', (data: { voterId: string, success: boolean }) => {
      setVotes(prev => ({ ...prev, [data.voterId]: data.success }));
    });

    channel.bind('tod-result', (data: { success: boolean, yesCount: number, noCount: number }) => {
      setVoteResult(data);
      setPhase('result');
    });

    channel.bind('tod-next', (data: { nextIndex: number }) => {
      setCurrentPlayerIndex(data.nextIndex);
      setPromptData(null);
      setPhase('selection');
      setVotes({});
      setMyVote(null);
      setVoteResult(null);
    });

    return () => {
      channel.unbind('tod-select');
      channel.unbind('tod-vote');
      channel.unbind('tod-result');
      channel.unbind('tod-next');
    };
  }, [roomId]);

  // Host auto-tally votes
  useEffect(() => {
    if (!isHost || phase !== 'prompt' || !currentPlayer) return;
    const eligibleVoters = players.filter(p => p.id !== currentPlayer.id).length;
    if (Object.keys(votes).length < eligibleVoters) return;

    const yesCount = Object.values(votes).filter(v => v).length;
    const noCount = Object.values(votes).filter(v => !v).length;
    const success = yesCount > noCount;

    const currentScore = currentPlayer.gameScores?.game4 || 0;
    const newScore = success ? currentScore + 2 : currentScore - 1;

    fetch(`/api/rooms/${roomId}/game/score`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ playerId: currentPlayer.id, gameNumber: 4, score: newScore }),
    });

    if (!success) {
      toast(`${currentPlayer.name} bị phạt uống!`);
    }

    fetch(`/api/rooms/${roomId}/game/action`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ event: 'tod-result', data: { success, yesCount, noCount } }),
    });
  }, [votes, isHost, phase, currentPlayer, players, roomId]);

  const selectOption = (type: 'truth' | 'dare') => {
    const list = type === 'truth' ? TRUTHS : DARES;
    const text = list[Math.floor(Math.random() * list.length)];
    fetch(`/api/rooms/${roomId}/game/action`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ event: 'tod-select', data: { type, text } }),
    });
  };

  const castVote = (success: boolean) => {
    if (myVote !== null) return;
    setMyVote(success);
    fetch(`/api/rooms/${roomId}/game/action`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ event: 'tod-vote', data: { voterId: myId, success } }),
    });
  };

  const nextTurn = () => {
    const nextIndex = (currentPlayerIndex + 1) % players.length;
    fetch(`/api/rooms/${roomId}/game/action`, {
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

          {isMyTurn ? (
            <p className="text-gray-500 text-lg animate-pulse">Hãy thực hiện! Đợi mọi người biểu quyết...</p>
          ) : myVote === null ? (
            <div className="space-y-3">
              <p className="font-semibold text-lg">{currentPlayer.name} có qua ải không?</p>
              <div className="flex gap-4 justify-center">
                <Button onClick={() => castVote(true)} className="bg-green-600 hover:bg-green-700 text-lg px-8 py-3">
                  ✅ Qua Ải
                </Button>
                <Button onClick={() => castVote(false)} variant="destructive" className="text-lg px-8 py-3">
                  ❌ Phạt Uống
                </Button>
              </div>
            </div>
          ) : (
            <p className="text-gray-500">Đã biểu quyết! Chờ mọi người...</p>
          )}
        </div>
      )}

      {phase === 'result' && voteResult && (
        <div className="space-y-6">
          <div className={`p-6 rounded-xl border-2 ${voteResult.success ? 'bg-green-50 border-green-300' : 'bg-red-50 border-red-300'}`}>
            <p className="text-4xl mb-2">{voteResult.success ? '🎉' : '😈'}</p>
            <p className="text-2xl font-bold">{currentPlayer.name} {voteResult.success ? 'Qua Ải! (+2đ)' : 'Phạt Uống! (-1đ)'}</p>
            <p className="mt-2 text-gray-600">✅ {voteResult.yesCount} phiếu | ❌ {voteResult.noCount} phiếu</p>
          </div>
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
