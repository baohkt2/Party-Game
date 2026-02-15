// Score calculation utilities

// Game 1: Reflex Test - scoring based on reaction time
export function calculateReflexScore(reactionTime: number): number {
  if (reactionTime < 0) {
    // Early tap penalty
    return -2;
  }
  
  if (reactionTime < 200) {
    return 10;
  } else if (reactionTime < 400) {
    return 7;
  } else if (reactionTime < 700) {
    return 5;
  } else {
    return 3;
  }
}

// Game 2: Spin Wheel - simple success/fail scoring
export function calculateWheelScore(success: boolean): number {
  return success ? 3 : -1;
}

// Game 3: Who Is It - voting game scoring
export function calculateWhoIsItScore(
  voterId: string,
  targetId: string,
  allVotes: Record<string, string>
): number {
  // Count votes for each player
  const voteCounts: Record<string, number> = {};
  Object.values(allVotes).forEach((target) => {
    voteCounts[target] = (voteCounts[target] || 0) + 1;
  });

  // Find the most voted player
  let maxVotes = 0;
  let mostVotedPlayer = '';
  Object.entries(voteCounts).forEach(([playerId, count]) => {
    if (count > maxVotes) {
      maxVotes = count;
      mostVotedPlayer = playerId;
    }
  });

  // Scoring logic:
  // - If you are the most voted: 0 points
  // - If you voted for the most voted (majority): +2 points
  // - Otherwise: +1 point
  
  if (voterId === mostVotedPlayer) {
    return 0; // You are the "guilty one"
  }
  
  if (targetId === mostVotedPlayer) {
    return 2; // You voted with the majority
  }
  
  return 1; // You voted but not with majority
}
