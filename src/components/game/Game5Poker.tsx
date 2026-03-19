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

type CardType = { suit: '♠'|'♣'|'♦'|'♥', rank: string, value: number };

// Generate Deck
const generateDeck = (): CardType[] => {
  const suits: ('♠'|'♣'|'♦'|'♥')[] = ['♠','♣','♦','♥'];
  const ranks = ['A','2','3','4','5','6','7','8','9','10','J','Q','K'];
  const deck: CardType[] = [];
  suits.forEach(suit => {
    ranks.forEach(rank => {
      let value = parseInt(rank);
      if (['J','Q','K'].includes(rank)) value = 10;
      if (rank === 'A') value = 1;
      deck.push({ suit, rank, value });
    });
  });
  // Shuffle
  return deck.sort(() => Math.random() - 0.5);
};

// Calculate 3-card point
const calculateHand = (cards: CardType[]) => {
  if (cards.length !== 3) return -1;
  const isBaTay = cards.every(c => ['J','Q','K'].includes(c.rank));
  if (isBaTay) return 99; // Ba Tây (Max)
  const isSap = cards[0].rank === cards[1].rank && cards[1].rank === cards[2].rank;
  if (isSap) return 999; // Sáp (Super Max)
  const sum = cards.reduce((acc, curr) => acc + curr.value, 0);
  return sum % 10 === 0 ? 10 : sum % 10; // Bù = 10, 9 = 9...
};

export default function Game5Poker({ roomId, players, isHost }: GameProps) {
  const [phase, setPhase] = useState<GamePhase['poker'] | 'waiting'>('waiting');
  
  // States received from Host
  const [hands, setHands] = useState<Record<string, CardType[]>>({});
  const [activePlayers, setActivePlayers] = useState<string[]>([]);
  const [bets, setBets] = useState<Record<string, number>>({});
  const [pot, setPot] = useState(0);

  // Local actions state
  const [hasActedThisRound, setHasActedThisRound] = useState(false);

  // Host only states
  const [hostDeck, setHostDeck] = useState<CardType[]>([]);
  
  const myId = typeof window !== 'undefined' ? localStorage.getItem('playerId') : null;

  useEffect(() => {
    const channelName = getRoomChannel(roomId);
    const channel = pusherClient.subscribe(channelName);

    channel.bind('poker-state-update', (data: any) => {
      setPhase(data.phase);
      setHands(data.hands);
      setActivePlayers(data.activePlayers);
      setBets(data.bets);
      setPot(data.pot);
      setHasActedThisRound(false);
    });

    channel.bind('poker-action', (data: { playerId: string, action: 'call'|'fold', betAmount: number }) => {
      // Host intercepts these actions to update its master state
      // We will handle this in an effect below using the raw event data if needed, 
      // but simpler: just wait for Host to broadcast State Update.
    });

    return () => {
      channel.unbind('poker-state-update');
      channel.unbind('poker-action');
    };
  }, [roomId]);

  // HOST LOGIC: Listening to player actions and managing master state
  const [pendingActions, setPendingActions] = useState<any[]>([]);
  useEffect(() => {
    if (!isHost) return;
    const channelName = getRoomChannel(roomId);
    const channel = pusherClient.subscribe(channelName);
    
    const listener = (data: any) => {
      setPendingActions(prev => [...prev, data]);
    };
    channel.bind('poker-action', listener);
    return () => { channel.unbind('poker-action', listener); };
  }, [isHost, roomId]);

  useEffect(() => {
    if (!isHost || pendingActions.length === 0) return;
    const action = pendingActions[0];
    
    // Process action
    let newActive = [...activePlayers];
    let newBets = { ...bets };
    let newPot = pot;

    if (action.action === 'fold') {
      newActive = newActive.filter(id => id !== action.playerId);
      // Penalize early fold
      newPot += 1;
      newBets[action.playerId] = (newBets[action.playerId] || 0) + 1;
    } else if (action.action === 'call') {
      newPot += action.betAmount;
      newBets[action.playerId] = (newBets[action.playerId] || 0) + action.betAmount;
    }

    setActivePlayers(newActive);
    setBets(newBets);
    setPot(newPot);
    setPendingActions(prev => prev.slice(1)); // pop

    // Broadcast updated state
    fetch(`/api/rooms/${roomId}/game/action`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        event: 'poker-state-update', 
        data: { phase, hands, activePlayers: newActive, bets: newBets, pot: newPot } 
      }),
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingActions, isHost]);


  // Host Action: Deal next card
  const dealNext = async () => {
    let currentHands = { ...hands };
    let deck = [...hostDeck];
    let nextPhase: any = 'phase1';

    if (phase === 'waiting') {
      deck = generateDeck();
      players.forEach(p => { currentHands[p.id] = [] });
      setActivePlayers(players.map(p => p.id));
      setBets({});
      setPot(0);
      nextPhase = 'phase1';
    } else if (phase === 'phase1') nextPhase = 'phase2';
    else if (phase === 'phase2') nextPhase = 'phase3';
    else if (phase === 'phase3') nextPhase = 'result';

    if (nextPhase !== 'result') {
      // Deal 1 card to active
      activePlayers.forEach(pId => {
        const card = deck.pop()!;
        currentHands[pId] = [...(currentHands[pId] || []), card];
      });
    }

    setHostDeck(deck);
    setHands(currentHands);
    setPhase(nextPhase);

    await fetch(`/api/rooms/${roomId}/game/action`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        event: 'poker-state-update', 
        data: { phase: nextPhase, hands: currentHands, activePlayers, bets, pot } 
      }),
    });
  };

  const sendAction = async (action: 'call'|'fold', betAmount: number) => {
    setHasActedThisRound(true);
    await fetch(`/api/rooms/${roomId}/game/action`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        event: 'poker-action', 
        data: { playerId: myId, action, betAmount } 
      }),
    });
  };

  const getRequiredBet = () => {
    if (phase === 'phase1') return 1;
    if (phase === 'phase2') return 2;
    if (phase === 'phase3') return 3;
    return 0;
  };

  const renderCard = (card?: CardType, hidden = false) => {
    if (hidden || !card) {
      return (
        <div className="w-16 h-24 bg-blue-800 rounded-lg border-2 border-white flex justify-center items-center shadow-md">
          <span className="text-white text-2xl">🂠</span>
        </div>
      );
    }
    const color = ['♥','♦'].includes(card.suit) ? 'text-red-600' : 'text-black';
    return (
      <div className="w-16 h-24 bg-white rounded-lg border border-gray-300 flex flex-col justify-between p-2 shadow-md">
        <span className={`text-lg font-bold leading-none ${color}`}>{card.rank}</span>
        <span className={`text-3xl self-center ${color}`}>{card.suit}</span>
      </div>
    );
  };

  if (phase === 'waiting') {
    return (
      <Card className="p-8 text-center max-w-2xl mx-auto w-full">
        <h2 className="text-3xl font-bold mb-4">Vòng 5: Cào Tố Tam Khúc</h2>
        <p className="text-gray-600 mb-6">Trò chơi đấu trí cuối cùng. Ai sẽ là Vua Trò Chơi?</p>
        <p className="mb-6 text-sm text-gray-500">Mỗi vòng được xem 1 lá. Quyền: Theo bớt (Cược bia) hoặc Bỏ bài.</p>
        {isHost ? (
          <Button size="lg" onClick={dealNext}>Chia Bài (Vòng 1)</Button>
        ) : (
          <p className="animate-pulse text-blue-600">Đợi host chia bài...</p>
        )}
      </Card>
    );
  }

  if (phase === 'result') {
    // Calc logic
    let winnerId = activePlayers[0];
    let maxScore = -1;
    activePlayers.forEach(pId => {
      const score = calculateHand(hands[pId]);
      if (score > maxScore) {
        maxScore = score;
        winnerId = pId;
      }
    });

    const losers = activePlayers.filter(id => id !== winnerId);
    const winnerBet = bets[winnerId] || 0;
    const penaltyPerLoser = losers.length > 0 ? (winnerBet / losers.length) : 0;

    return (
      <Card className="p-8 max-w-2xl mx-auto w-full">
        <h2 className="text-3xl font-bold mb-6 text-center">Kết Quả Vòng Cuối</h2>
        <div className="bg-yellow-50 border-2 border-yellow-400 p-6 rounded-xl text-center mb-8">
          <p className="text-xl font-bold text-yellow-800">🎉 NGƯỜI CHIẾN THẮNG</p>
          <p className="text-4xl font-black mt-2">{players.find(p => p.id === winnerId)?.name}</p>
          <div className="flex justify-center gap-2 mt-4">
            {hands[winnerId]?.map((c, i) => <div key={i}>{renderCard(c)}</div>)}
          </div>
          <p className="mt-2 font-bold text-blue-800">
            Điểm: {maxScore === 999 ? 'Sáp!!' : maxScore === 99 ? 'Ba Tây!' : maxScore}
          </p>
        </div>

        <h3 className="text-xl font-bold mb-4">Mức Phạt:</h3>
        <p className="text-gray-600 mb-4">*Công thức: Số bia đã cược + (Bia người thắng cược / Số người thua)</p>
        
        <div className="space-y-3">
          {players.filter(p => p.id !== winnerId).map(p => {
            const hasFolded = !activePlayers.includes(p.id);
            let penalty = 0;
            if (hasFolded) {
              penalty = bets[p.id] || 0;
            } else {
              penalty = (bets[p.id] || 0) + penaltyPerLoser;
            }

            return (
              <div key={p.id} className="flex justify-between items-center p-3 border rounded-lg bg-red-50">
                <span className="font-semibold">{p.name} {hasFolded ? '(Bỏ bài)' : ''}</span>
                <span className="text-red-600 font-bold font-mono">🍺 Uống {penalty.toFixed(1)} đơn vị</span>
              </div>
            );
          })}
        </div>
      </Card>
    );
  }

  // Phase 1, 2, 3
  const isMyTurnActive = activePlayers.includes(myId!) && !hasActedThisRound;

  return (
    <Card className="p-6 max-w-4xl mx-auto w-full">
      <div className="flex justify-between items-center mb-6 border-b pb-4">
        <h2 className="text-2xl font-bold">Vòng {phase === 'phase1' ? 1 : phase === 'phase2' ? 2 : 3}</h2>
        <div className="text-lg font-bold text-green-700 bg-green-100 px-4 py-2 rounded-lg">Tổng Pot: {pot} 🍺</div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 gap-6 mb-8">
        {players.map(p => {
          const isActive = activePlayers.includes(p.id);
          const pCards = hands[p.id] || [];
          return (
            <div key={p.id} className={`flex flex-col items-center p-4 rounded-xl border-2 ${isActive ? 'bg-gray-50 border-blue-200' : 'bg-gray-200 border-gray-300 opacity-60'}`}>
              <span className="font-bold text-lg mb-2">{p.name} {p.id === myId && '(Bạn)'}</span>
              {!isActive && <span className="text-red-600 text-sm font-bold absolute mt-12 bg-white px-2 uppercase shadow">Đã Bỏ</span>}
              <div className="flex gap-1">
                {/* Render cards. Hide others' cards until result */}
                {[0, 1, 2].map(idx => {
                  if (idx >= pCards.length) return <div key={idx} className="w-16 h-24 bg-transparent border-2 border-dashed border-gray-300 rounded-lg"></div>;
                  const isVisible = p.id === myId;
                  return <div key={idx}>{renderCard(pCards[idx], !isVisible)}</div>;
                })}
              </div>
              <p className="mt-2 text-sm text-gray-600">Đã cược: {bets[p.id] || 0}</p>
            </div>
          );
        })}
      </div>

      <div className="flex flex-col items-center bg-blue-50 p-6 rounded-xl border border-blue-200">
        {isMyTurnActive ? (
          <div className="text-center w-full">
            <p className="mb-4 font-semibold text-lg">Đến lượt bạn hành động!</p>
            <div className="flex justify-center gap-4">
              <Button size="lg" className="w-40 bg-green-600 hover:bg-green-700" onClick={() => sendAction('call', getRequiredBet())}>
                Theo (Cược {getRequiredBet()})
              </Button>
              <Button size="lg" variant="destructive" className="w-40" onClick={() => sendAction('fold', 0)}>
                Bỏ Bài
              </Button>
            </div>
          </div>
        ) : (
          <p className="text-gray-500 font-medium">
            {!activePlayers.includes(myId!) ? 'Bạn đã bỏ bài. Hãy xem người khác chơi!' : 'Đã hành động. Chờ những người khác...'}
          </p>
        )}

        {isHost && (
          <div className="mt-6 border-t pt-6 w-full text-center">
            <p className="mb-2 text-sm text-gray-500">Host Controls (Chờ mọi người chọn xong):</p>
            <Button variant="secondary" onClick={dealNext}>
              {phase === 'phase3' ? 'Mở Bài (Kết Quả)' : 'Chia Vòng Tiếp Theo'}
            </Button>
          </div>
        )}
      </div>
    </Card>
  );
}
