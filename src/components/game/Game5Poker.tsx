'use client';

import { useState, useEffect, useCallback } from 'react';
import { Player } from '@/types';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { pusherClient, getRoomChannel } from '@/lib/pusher';
import { toast } from 'sonner';

interface GameProps {
  roomId: string;
  players: Player[];
  isHost: boolean;
}

type CardType = { suit: '♠' | '♣' | '♦' | '♥', rank: string, value: number };

type PokerPhase = 'waiting' | 'phase1' | 'phase2' | 'phase3' | 'result';

interface PokerState {
  phase: PokerPhase;
  hands: Record<string, CardType[]>;
  activePlayers: string[];
  bets: Record<string, number>;
  pot: number;
  actedThisRound: string[];
  currentBet: number; // current bet level per player this round
}

const generateDeck = (): CardType[] => {
  const suits: ('♠' | '♣' | '♦' | '♥')[] = ['♠', '♣', '♦', '♥'];
  const ranks = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];
  const deck: CardType[] = [];
  suits.forEach(suit => {
    ranks.forEach(rank => {
      let value = parseInt(rank);
      if (['J', 'Q', 'K'].includes(rank)) value = 10;
      if (rank === 'A') value = 1;
      deck.push({ suit, rank, value });
    });
  });
  for (let i = deck.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [deck[i], deck[j]] = [deck[j], deck[i]];
  }
  return deck;
};

const calculateHand = (cards: CardType[]) => {
  if (cards.length !== 3) return -1;
  const isBaTay = cards.every(c => ['J', 'Q', 'K'].includes(c.rank));
  if (isBaTay) return 99; // Ba Tây
  const isSap = cards[0].rank === cards[1].rank && cards[1].rank === cards[2].rank;
  if (isSap) return 999; // Sáp
  const sum = cards.reduce((acc, curr) => acc + curr.value, 0);
  return sum % 10 === 0 ? 10 : sum % 10;
};

const INITIAL_STATE: PokerState = {
  phase: 'waiting',
  hands: {},
  activePlayers: [],
  bets: {},
  pot: 0,
  actedThisRound: [],
  currentBet: 1,
};

export default function Game5Poker({ roomId, players, isHost }: GameProps) {
  const [state, setState] = useState<PokerState>(INITIAL_STATE);
  const [hostDeck, setHostDeck] = useState<CardType[]>([]);
  const [scored, setScored] = useState(false);

  const myId = typeof window !== 'undefined' ? localStorage.getItem('playerId') : null;

  useEffect(() => {
    const channelName = getRoomChannel(roomId);
    const channel = pusherClient.subscribe(channelName);

    channel.bind('poker-sync', (data: PokerState) => {
      setState(data);
    });

    return () => { channel.unbind('poker-sync'); };
  }, [roomId]);

  // Host scores on result
  useEffect(() => {
    if (!isHost || state.phase !== 'result' || scored) return;
    setScored(true);

    // Sort active players by hand value
    const ranked = state.activePlayers
      .map(pId => ({ id: pId, score: calculateHand(state.hands[pId]) }))
      .sort((a, b) => b.score - a.score);

    // Number of winners = ceil(total players / 2)
    const winnerCount = Math.ceil(players.length / 2);

    const updates: Promise<void>[] = [];
    ranked.forEach((r, i) => {
      const p = players.find(p => p.id === r.id);
      if (!p) return;
      const isWinner = i < winnerCount;
      const delta = isWinner ? 5 : -2;
      updates.push(fetch(`/api/rooms/${roomId}/game/score`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ playerId: r.id, gameNumber: 5, score: (p.gameScores?.game5 || 0) + delta }),
      }).then(() => {}));
    });

    // Folded players get -2
    players.filter(p => !state.activePlayers.includes(p.id)).forEach(p => {
      updates.push(fetch(`/api/rooms/${roomId}/game/score`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ playerId: p.id, gameNumber: 5, score: (p.gameScores?.game5 || 0) - 2 }),
      }).then(() => {}));
    });

    Promise.all(updates);
  }, [state.phase, isHost, scored, state.activePlayers, state.hands, players, roomId]);

  const broadcastState = useCallback((newState: PokerState) => {
    setState(newState);
    fetch(`/api/rooms/${roomId}/game/action`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ event: 'poker-sync', data: newState }),
    });
  }, [roomId]);

  // Host deals cards
  const dealNext = () => {
    let deck = [...hostDeck];
    let newState: PokerState;

    if (state.phase === 'waiting') {
      deck = generateDeck();
      const hands: Record<string, CardType[]> = {};
      const active = players.map(p => p.id);
      active.forEach(pId => { hands[pId] = [deck.pop()!]; });
      setHostDeck(deck);
      setScored(false);
      newState = { phase: 'phase1', hands, activePlayers: active, bets: {}, pot: 0, actedThisRound: [], currentBet: 1 };
    } else {
      const nextPhase: PokerPhase =
        state.phase === 'phase1' ? 'phase2' :
        state.phase === 'phase2' ? 'phase3' : 'result';

      const hands = { ...state.hands };
      if (nextPhase !== 'result') {
        state.activePlayers.forEach(pId => {
          hands[pId] = [...(hands[pId] || []), deck.pop()!];
        });
      }
      setHostDeck(deck);
      // Reset currentBet to 1 for new round
      newState = { ...state, phase: nextPhase, hands, actedThisRound: [], currentBet: 1 };
    }

    broadcastState(newState);
  };

  // Player actions
  const handleAction = (action: 'call' | 'raise' | 'double' | 'fold') => {
    if (!myId) return;

    let newState = { ...state };
    let betAmount = 0;

    switch (action) {
      case 'call':
        betAmount = state.currentBet;
        break;
      case 'raise':
        betAmount = state.currentBet + 1;
        newState.currentBet = betAmount; // raise the current bet for others
        break;
      case 'double':
        betAmount = state.currentBet * 2;
        newState.currentBet = betAmount; // double the current bet for others
        break;
      case 'fold':
        newState.activePlayers = state.activePlayers.filter(id => id !== myId);
        betAmount = 1; // penalty for folding
        break;
    }

    newState.pot = state.pot + betAmount;
    newState.bets = { ...state.bets, [myId]: (state.bets[myId] || 0) + betAmount };
    newState.actedThisRound = [...state.actedThisRound, myId];

    setState(newState);

    fetch(`/api/rooms/${roomId}/game/action`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ event: 'poker-sync', data: newState }),
    });
  };

  const renderCard = (card?: CardType, hidden = false) => {
    if (hidden || !card) {
      return (
        <div className="w-14 h-20 bg-gradient-to-br from-blue-800 to-blue-950 rounded-lg border-2 border-blue-400 flex justify-center items-center shadow-lg">
          <span className="text-blue-200 text-xl">🂠</span>
        </div>
      );
    }
    const color = ['♥', '♦'].includes(card.suit) ? 'text-red-600' : 'text-gray-900';
    return (
      <div className="w-14 h-20 bg-white rounded-lg border border-gray-300 flex flex-col justify-between p-1.5 shadow-lg">
        <span className={`text-sm font-bold leading-none ${color}`}>{card.rank}</span>
        <span className={`text-2xl self-center ${color}`}>{card.suit}</span>
      </div>
    );
  };

  if (state.phase === 'waiting') {
    return (
      <Card className="p-8 text-center max-w-2xl mx-auto w-full">
        <h2 className="text-3xl font-bold mb-4">Vòng 5: Cào Tố Tam Khúc</h2>
        <p className="text-gray-600 mb-4">Trò chơi đấu trí cuối cùng!</p>
        <div className="bg-gray-50 p-4 rounded-xl text-left text-sm text-gray-600 mb-6 space-y-1">
          <p>🃏 Mỗi vòng nhận 1 lá bài (tổng 3 lá)</p>
          <p>🍺 Khởi điểm cược: <b>1 ngụm</b>. Mỗi lần tăng: +1 ngụm</p>
          <p>📌 Hành động: <b>Theo</b> | <b>Tăng (+1)</b> | <b>Gấp đôi (x2)</b> | <b>Bỏ bài</b></p>
          <p>🏆 Số người thắng = Tổng người chơi / 2 (làm tròn lên)</p>
        </div>
        {isHost ? (
          <Button size="lg" onClick={dealNext}>🃏 Chia Bài (Vòng 1)</Button>
        ) : (
          <p className="animate-pulse text-blue-600">Đợi host chia bài...</p>
        )}
      </Card>
    );
  }

  if (state.phase === 'result') {
    const ranked = state.activePlayers
      .map(pId => ({ id: pId, score: calculateHand(state.hands[pId]) }))
      .sort((a, b) => b.score - a.score);

    const winnerCount = Math.ceil(players.length / 2);
    const winnerIds = ranked.slice(0, winnerCount).map(r => r.id);
    const loserIds = ranked.slice(winnerCount).map(r => r.id);
    const foldedIds = players.filter(p => !state.activePlayers.includes(p.id)).map(p => p.id);

    return (
      <Card className="p-8 max-w-2xl mx-auto w-full">
        <h2 className="text-3xl font-bold mb-6 text-center">Kết Quả Cào</h2>
        
        {/* Winners */}
        <div className="bg-yellow-50 border-2 border-yellow-400 p-4 rounded-xl mb-6">
          <p className="text-lg font-bold text-yellow-800 mb-3">🎉 NGƯỜI THẮNG (+5đ, không phải uống)</p>
          <div className="space-y-2">
            {winnerIds.map((id, i) => {
              const p = players.find(p => p.id === id);
              const hand = state.hands[id];
              const score = calculateHand(hand);
              return (
                <div key={id} className="flex items-center justify-between bg-white p-3 rounded-lg">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-yellow-600">#{i + 1}</span>
                    <span className="text-xl">{p?.avatar}</span>
                    <span className="font-bold">{p?.name}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="flex gap-1">{hand?.map((c, j) => <div key={j}>{renderCard(c)}</div>)}</div>
                    <span className="font-bold text-blue-700 ml-2">
                      {score === 999 ? 'Sáp!' : score === 99 ? 'Ba Tây!' : `${score} nút`}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Losers still in game */}
        {loserIds.length > 0 && (
          <div className="bg-red-50 border-2 border-red-300 p-4 rounded-xl mb-4">
            <p className="text-lg font-bold text-red-700 mb-3">😢 THUA (-2đ)</p>
            <p className="text-sm text-gray-600 mb-3">Công thức: Bia đã cược + (Bia người thắng cược / Số người thua)</p>
            <div className="space-y-2">
              {loserIds.map(id => {
                const p = players.find(p => p.id === id);
                const totalWinnerBets = winnerIds.reduce((s, wid) => s + (state.bets[wid] || 0), 0);
                const totalLosers = loserIds.length + foldedIds.length;
                const penalty = (state.bets[id] || 0) + (totalLosers > 0 ? totalWinnerBets / totalLosers : 0);
                return (
                  <div key={id} className="flex items-center justify-between bg-white p-3 rounded-lg">
                    <div className="flex items-center gap-2">
                      <span className="text-xl">{p?.avatar}</span>
                      <span className="font-bold">{p?.name}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="flex gap-1">{state.hands[id]?.map((c, j) => <div key={j}>{renderCard(c)}</div>)}</div>
                      <span className="text-red-600 font-bold ml-2">🍺 {penalty.toFixed(1)} ngụm</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Folded players */}
        {foldedIds.length > 0 && (
          <div className="bg-gray-100 border border-gray-300 p-4 rounded-xl">
            <p className="text-lg font-bold text-gray-600 mb-3">🏳️ BỎ BÀI (-2đ)</p>
            <div className="space-y-2">
              {foldedIds.map(id => {
                const p = players.find(p => p.id === id);
                const penalty = state.bets[id] || 0;
                return (
                  <div key={id} className="flex items-center justify-between bg-white p-3 rounded-lg">
                    <div className="flex items-center gap-2">
                      <span className="text-xl">{p?.avatar}</span>
                      <span className="font-bold text-gray-500">{p?.name}</span>
                    </div>
                    <span className="text-gray-600 font-bold">🍺 {penalty} ngụm</span>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </Card>
    );
  }

  // Phase 1, 2, 3 - Betting rounds
  const hasActed = state.actedThisRound.includes(myId!);
  const isActive = state.activePlayers.includes(myId!);
  const allActed = state.activePlayers.every(id => state.actedThisRound.includes(id));
  const phaseNumber = state.phase === 'phase1' ? 1 : state.phase === 'phase2' ? 2 : 3;

  return (
    <Card className="p-6 max-w-4xl mx-auto w-full">
      <div className="flex justify-between items-center mb-6 border-b pb-4">
        <div>
          <h2 className="text-2xl font-bold">Lá bài {phaseNumber} / 3</h2>
          <p className="text-sm text-gray-500">Mức cược hiện tại: <b>{state.currentBet} ngụm</b></p>
        </div>
        <div className="text-lg font-bold text-green-700 bg-green-100 px-4 py-2 rounded-lg">Pot: {state.pot} 🍺</div>
      </div>

      {/* Player cards grid */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-6">
        {players.map(p => {
          const pActive = state.activePlayers.includes(p.id);
          const pCards = state.hands[p.id] || [];
          const pActed = state.actedThisRound.includes(p.id);
          return (
            <div key={p.id} className={`flex flex-col items-center p-3 rounded-xl border-2 relative ${pActive ? 'bg-gray-50 border-blue-200' : 'bg-gray-200 border-gray-300 opacity-60'}`}>
              <span className="font-bold mb-1">{p.name} {p.id === myId && '(Bạn)'}</span>
              {!pActive && <span className="text-red-600 text-xs font-bold bg-white px-2 rounded shadow absolute top-1 right-1">Bỏ</span>}
              {pActed && pActive && <span className="text-green-600 text-xs font-bold bg-white px-2 rounded shadow absolute top-1 right-1">✓</span>}
              <div className="flex gap-1 my-2">
                {[0, 1, 2].map(idx => {
                  if (idx >= pCards.length) return <div key={idx} className="w-14 h-20 border-2 border-dashed border-gray-300 rounded-lg"></div>;
                  return <div key={idx}>{renderCard(pCards[idx], p.id !== myId)}</div>;
                })}
              </div>
              <p className="text-xs text-gray-500">Cược: {state.bets[p.id] || 0} ngụm</p>
            </div>
          );
        })}
      </div>

      {/* Action buttons */}
      <div className="flex flex-col items-center bg-blue-50 p-6 rounded-xl border border-blue-200">
        {isActive && !hasActed ? (
          <div className="text-center w-full">
            <p className="mb-4 font-semibold text-lg">Đến lượt bạn! (Mức cược: {state.currentBet} ngụm)</p>
            <div className="flex flex-wrap justify-center gap-3">
              <Button size="lg" className="bg-green-600 hover:bg-green-700" onClick={() => handleAction('call')}>
                ✅ Theo ({state.currentBet} 🍺)
              </Button>
              <Button size="lg" className="bg-blue-600 hover:bg-blue-700" onClick={() => handleAction('raise')}>
                ⬆️ Tăng ({state.currentBet + 1} 🍺)
              </Button>
              <Button size="lg" className="bg-purple-600 hover:bg-purple-700" onClick={() => handleAction('double')}>
                💥 Gấp Đôi ({state.currentBet * 2} 🍺)
              </Button>
              <Button size="lg" variant="destructive" onClick={() => handleAction('fold')}>
                🏳️ Bỏ Bài
              </Button>
            </div>
          </div>
        ) : (
          <p className="text-gray-500 font-medium">
            {!isActive ? 'Bạn đã bỏ bài.' : 'Đã hành động. Chờ mọi người...'}
          </p>
        )}

        {isHost && (
          <div className="mt-6 border-t pt-4 w-full text-center">
            <Button variant="secondary" onClick={dealNext} disabled={!allActed}>
              {state.phase === 'phase3' ? '🃏 Mở Bài (Kết Quả)' : `🃏 Chia Lá Tiếp (${state.actedThisRound.length}/${state.activePlayers.length})`}
            </Button>
          </div>
        )}
      </div>
    </Card>
  );
}
