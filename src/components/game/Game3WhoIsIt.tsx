'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { GamePhase } from '@/types';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { pusherClient, getRoomChannel } from '@/lib/pusher';
import { GameProps } from '@/lib/gameRegistry';

const QUESTIONS = [
  "Ai là người tửu lượng kém nhất?",
  "Ai hay nợ tiền không trả?",
  "Ai là người hay bùng kèo nhất?",
  "Ai đang ế lâu năm nhất?",
  "Ai hay nói đạo lý nhất?",
  "Ai simp chúa nhất?",
  "Ai có nguy cơ ngoại tình cao nhất?",
  "Ai ở dơ nhất đám?",
  "Ai là người hay ngủ ngáy to nhất?",
  "Ai thường xuyên đi trễ nhất?"
];

export default function Game3WhoIsIt({ roomId, players, isHost }: GameProps) {
  const [phase, setPhase] = useState<GamePhase['whoisit']>('question');
  const [currentQuestion, setCurrentQuestion] = useState('');
  const [countdown, setCountdown] = useState(3);
  const [votes, setVotes] = useState<Record<string, string>>({});
  const [myVote, setMyVote] = useState<string | null>(null);
  const scoredRef = useRef(false);

  const myId = typeof window !== 'undefined' ? localStorage.getItem('playerId') : null;

  const nextQuestion = useCallback(() => {
    const randomQ = QUESTIONS[Math.floor(Math.random() * QUESTIONS.length)];
    fetch(`/api/rooms/${roomId}/game/action`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ event: 'whoisit-new-question', data: { question: randomQ } }),
    });
  }, [roomId]);

  const revealResult = useCallback(() => {
    fetch(`/api/rooms/${roomId}/game/action`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ event: 'whoisit-result', data: {} }),
    });
  }, [roomId]);

  useEffect(() => {
    const channelName = getRoomChannel(roomId);
    const channel = pusherClient.subscribe(channelName);

    channel.bind('whoisit-new-question', (data: { question: string }) => {
      setCurrentQuestion(data.question);
      setPhase('question');
      setVotes({});
      setMyVote(null);
      scoredRef.current = false;
    });

    channel.bind('whoisit-countdown-start', () => {
      setPhase('countdown');
      let count = 3;
      setCountdown(count);
      const timer = setInterval(() => {
        count -= 1;
        if (count > 0) {
          setCountdown(count);
        } else {
          clearInterval(timer);
          setPhase('voting');
        }
      }, 1000);
    });

    channel.bind('whoisit-vote', (data: { voterId: string, votedId: string }) => {
      setVotes(prev => ({ ...prev, [data.voterId]: data.votedId }));
    });

    channel.bind('whoisit-result', () => {
      setPhase('result');
    });

    return () => {
      channel.unbind('whoisit-new-question');
      channel.unbind('whoisit-countdown-start');
      channel.unbind('whoisit-vote');
      channel.unbind('whoisit-result');
    };
  }, [roomId]);

  useEffect(() => {
    if (isHost && phase === 'question' && !currentQuestion) {
      nextQuestion();
    }
  }, [isHost, phase, currentQuestion, nextQuestion]);

  // Host auto-end voting if all voted
  useEffect(() => {
    if (isHost && phase === 'voting' && Object.keys(votes).length >= players.length) {
      revealResult();
    }
  }, [votes, players.length, isHost, phase, revealResult]);

  // Host auto-score on result
  useEffect(() => {
    if (!isHost || phase !== 'result' || scoredRef.current) return;
    scoredRef.current = true;

    const voteCounts: Record<string, number> = {};
    Object.values(votes).forEach(votedId => {
      voteCounts[votedId] = (voteCounts[votedId] || 0) + 1;
    });

    let maxVotes = 0;
    const losers: string[] = [];
    Object.entries(voteCounts).forEach(([votedId, count]) => {
      if (count > maxVotes) { maxVotes = count; losers.length = 0; losers.push(votedId); }
      else if (count === maxVotes) { losers.push(votedId); }
    });

    const scoreUpdates: Promise<void>[] = [];
    // Losers get -2
    losers.forEach(loserId => {
      const p = players.find(p => p.id === loserId);
      const cur = p?.gameScores?.game3 || 0;
      scoreUpdates.push(
        fetch(`/api/rooms/${roomId}/game/score`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ playerId: loserId, gameNumber: 3, score: cur - 2 }),
        }).then(() => {})
      );
    });
    // Others get +1
    players.filter(p => !losers.includes(p.id)).forEach(p => {
      const cur = p.gameScores?.game3 || 0;
      scoreUpdates.push(
        fetch(`/api/rooms/${roomId}/game/score`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ playerId: p.id, gameNumber: 3, score: cur + 1 }),
        }).then(() => {})
      );
    });
    Promise.all(scoreUpdates);
  }, [phase, isHost, votes, players, roomId]);

  const startCountdown = () => {
    fetch(`/api/rooms/${roomId}/game/action`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ event: 'whoisit-countdown-start', data: {} }),
    });
  };

  const castVote = (playerId: string) => {
    if (myVote) return;
    setMyVote(playerId);
    fetch(`/api/rooms/${roomId}/game/action`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ event: 'whoisit-vote', data: { voterId: myId, votedId: playerId } }),
    });
  };

  if (phase === 'countdown') {
    return (
      <Card className="p-12 text-center max-w-2xl mx-auto w-full">
        <h2 className="text-2xl font-semibold mb-6">Chuẩn bị chỉ tay...</h2>
        <div className="text-8xl font-black text-red-500 animate-ping">{countdown}</div>
      </Card>
    );
  }

  if (phase === 'voting') {
    return (
      <Card className="p-8 max-w-2xl mx-auto w-full">
        <h2 className="text-2xl font-bold mb-6 text-center">{currentQuestion}</h2>
        <p className="text-center text-gray-500 mb-6">Hãy chọn (chỉ tay) người phù hợp nhất!</p>
        <div className="grid grid-cols-2 gap-4">
          {players.map(p => (
            <Button 
              key={p.id} 
              variant={myVote === p.id ? "default" : "outline"}
              className="h-16 text-lg"
              onClick={() => castVote(p.id)}
              disabled={!!myVote}
            >
              {p.avatar} {p.name}
            </Button>
          ))}
        </div>
        {isHost && (
          <Button className="w-full mt-8" variant="secondary" onClick={revealResult}>
            Kết Thúc Bình Chọn Ngay ({Object.keys(votes).length}/{players.length})
          </Button>
        )}
      </Card>
    );
  }

  if (phase === 'result') {
    const voteCounts: Record<string, number> = {};
    Object.values(votes).forEach(votedId => {
      voteCounts[votedId] = (voteCounts[votedId] || 0) + 1;
    });
    let maxVotes = 0;
    const losers: string[] = [];
    Object.entries(voteCounts).forEach(([votedId, count]) => {
      if (count > maxVotes) { maxVotes = count; losers.length = 0; losers.push(votedId); }
      else if (count === maxVotes) { losers.push(votedId); }
    });

    return (
      <Card className="p-8 text-center max-w-2xl mx-auto w-full">
        <h2 className="text-2xl font-bold mb-4">{currentQuestion}</h2>
        <div className="bg-red-50 border border-red-200 p-6 rounded-xl mb-6">
          <p className="text-red-600 font-semibold mb-2">🚨 Kẻ mang tội danh này là 🚨</p>
          <div className="flex flex-wrap justify-center gap-4 mt-4">
            {losers.length > 0 ? losers.map(loserId => {
              const player = players.find(p => p.id === loserId);
              return (
                <div key={loserId} className="flex flex-col items-center">
                  <span className="text-4xl">{player?.avatar}</span>
                  <span className="text-xl font-black">{player?.name}</span>
                  <span className="text-sm text-red-500 mt-1">({maxVotes} phiếu, -2đ)</span>
                </div>
              );
            }) : <p>Chưa ai bị bình chọn!</p>}
          </div>
        </div>
        <p className="text-sm text-green-700 mb-2">Những người không bị chọn nhận +1 điểm</p>
        <p className="text-lg font-bold mb-8">🍻 {losers.length > 0 ? 'Kẻ tội đồ phải uống 1 ly!' : 'Không ai phải uống!'}</p>

        <div className="text-left text-sm text-gray-500">
          <p className="font-semibold mb-2">Chi tiết phiếu bầu:</p>
          <ul className="space-y-1">
            {Object.entries(votes).map(([voter, voted]) => {
              const voterP = players.find(p => p.id === voter);
              const votedP = players.find(p => p.id === voted);
              return <li key={voter}>- {voterP?.name} 👉 {votedP?.name}</li>;
            })}
          </ul>
        </div>

        {isHost && (
          <Button className="w-full mt-6" onClick={nextQuestion}>
            Câu Hỏi Khác
          </Button>
        )}
      </Card>
    );
  }

  return (
    <Card className="p-8 text-center max-w-2xl mx-auto w-full">
      <h2 className="text-3xl font-bold mb-8">Vòng 3: Ai Là Kẻ Tội Đồ?</h2>
      {currentQuestion ? (
        <div className="mb-8">
          <p className="text-gray-500 mb-2">Câu hỏi hiện tại:</p>
          <p className="text-2xl font-semibold bg-blue-50 p-4 rounded-xl border border-blue-100">
            {currentQuestion}
          </p>
        </div>
      ) : (
        <p className="animate-pulse text-gray-500 mb-8">Đang tải câu hỏi...</p>
      )}
      {isHost ? (
        <div className="flex gap-4 justify-center">
          <Button variant="outline" onClick={nextQuestion}>Đổi Câu Khác</Button>
          <Button size="lg" onClick={startCountdown}>Bắt Đầu (3s)</Button>
        </div>
      ) : (
        <p className="text-blue-600 font-medium">Đợi host bắt đầu...</p>
      )}
    </Card>
  );
}
