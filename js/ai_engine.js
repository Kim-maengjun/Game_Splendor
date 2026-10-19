/**
 * Splendor 3D - AI Decision Engine (Easy / Normal / Hard)
 * Supports both Classic Rules and Modern Expansion (Strongholds + Orient Abilities)
 * Exposes window.SplendorAI
 */
(function (root) {
  'use strict';

  const GEM_KEYS = ['emerald', 'sapphire', 'ruby', 'diamond', 'onyx'];

  const DIFFICULTY_PROFILES = {
    easy: {
      id: 'easy',
      korName: '초급 (견습 상인)',
      engName: 'Easy (Apprentice)',
      description: '즉시 구매 가능한 카드를 우선 사고, 부족한 보석을 단순 수집합니다.'
    },
    normal: {
      id: 'normal',
      korName: '중급 (숙련 길드장)',
      engName: 'Normal (Guild Master)',
      description: '카드 가성비(점수·보너스 대비 비용)와 귀족 조건을 계산하여 효율적으로 수집합니다.'
    },
    hard: {
      id: 'hard',
      korName: '고급 (르네상스 거장)',
      engName: 'Hard (Grand Patron)',
      description: '상대의 다음 턴 구매를 예측해 견제 예약(Block Reserve)하고, 성채 독점 및 귀족 최단 루트를 계산합니다.'
    }
  };

  function getKorGemName(gem) {
    const data = (typeof window !== 'undefined' && window.SplendorData) ? window.SplendorData : null;
    if (data && data.GEMS && data.GEMS[gem]) return data.GEMS[gem].korName;
    const fallback = {
      emerald: '에메랄드',
      sapphire: '사파이어',
      ruby: '루비',
      diamond: '다이아몬드',
      onyx: '오닉스',
      gold: '황금'
    };
    return fallback[gem] || gem;
  }

  function getPlayerTotalTokens(player) {
    if (!player || !player.tokens) return 0;
    return Object.values(player.tokens).reduce((sum, count) => sum + (Number(count) || 0), 0);
  }

  function getPlayerBonuses(player, enableOrient) {
    if (typeof window !== 'undefined' && window.SplendorData && window.SplendorData.getPlayerBonuses) {
      return window.SplendorData.getPlayerBonuses(player, enableOrient);
    }
    const bonuses = { emerald: 0, sapphire: 0, ruby: 0, diamond: 0, onyx: 0 };
    if (!player || !Array.isArray(player.purchasedCards)) return bonuses;
    for (const c of player.purchasedCards) {
      if (c && bonuses[c.bonusGem] !== undefined) {
        bonuses[c.bonusGem] += (enableOrient && c.modernAbility === 'double_bonus') ? 2 : 1;
      }
    }
    return bonuses;
  }

  function evaluatePurchase(player, card, enableOrient) {
    if (typeof window !== 'undefined' && window.SplendorData && window.SplendorData.evaluateCardPurchase) {
      return window.SplendorData.evaluateCardPurchase(player, card, enableOrient);
    }
    const bonuses = getPlayerBonuses(player, enableOrient);
    const tokens = (player && player.tokens) || {};
    const payment = { emerald: 0, sapphire: 0, ruby: 0, diamond: 0, onyx: 0, gold: 0 };
    let goldNeeded = 0;
    let totalShortfallAfterBonus = 0;

    for (const gem of GEM_KEYS) {
      const rawCost = (card.cost && card.cost[gem]) || 0;
      const netCost = Math.max(0, rawCost - (bonuses[gem] || 0));
      totalShortfallAfterBonus += netCost;
      const have = tokens[gem] || 0;
      if (have >= netCost) {
        payment[gem] = netCost;
      } else {
        payment[gem] = have;
        goldNeeded += (netCost - have);
      }
    }
    const haveGold = tokens.gold || 0;
    const canAfford = goldNeeded <= haveGold;
    payment.gold = canAfford ? goldNeeded : haveGold;
    return {
      canAfford,
      goldNeeded,
      missingTokens: Math.max(0, goldNeeded - haveGold),
      totalShortfallAfterBonus,
      payment
    };
  }

  // 성채(Stronghold)로 인해 상대방이 독점 잠금한 카드인지 확인
  function isLockedByOpponentStronghold(card, playerIndex, state) {
    if (!state || !state.config || !state.config.enableStrongholds) return false;
    if (!card || !card.strongholdOwner && card.strongholdOwner !== 0) return false;
    // 카드 위에 타 플레이어의 성채가 1개라도 있으면 성채 규칙상 다른 플레이어는 구매 불가 (또는 3개 독점)
    if (card.strongholdOwner !== null && card.strongholdOwner !== undefined && card.strongholdOwner !== playerIndex && (card.strongholdCount || 0) > 0) {
      return true;
    }
    return false;
  }

  // 보드 위의 모든 공개 카드 배열 추출
  function getAllBoardCards(state) {
    const list = [];
    if (!state || !state.boardCards) return list;
    for (const level of [1, 2, 3]) {
      const row = state.boardCards[level] || [];
      for (const card of row) {
        if (card) list.push(card);
      }
    }
    return list;
  }

  // 특정 카드가 귀족 영입에 얼마나 기여하는지 점수화
  function scoreNobleSynergy(player, card, nobles, enableOrient) {
    if (!Array.isArray(nobles) || nobles.length === 0 || !card) return 0;
    const bonuses = getPlayerBonuses(player, enableOrient);
    const cardBonusAmt = (enableOrient && card.modernAbility === 'double_bonus') ? 2 : 1;
    let synergy = 0;

    for (const noble of nobles) {
      const req = noble.requirements || {};
      const neededForThisGem = Math.max(0, (req[card.bonusGem] || 0) - (bonuses[card.bonusGem] || 0));
      if (neededForThisGem <= 0) continue;

      let totalMissingForNoble = 0;
      for (const gem of GEM_KEYS) {
        totalMissingForNoble += Math.max(0, (req[gem] || 0) - (bonuses[gem] || 0));
      }

      const afterBuyMissing = Math.max(0, totalMissingForNoble - Math.min(neededForThisGem, cardBonusAmt));
      if (afterBuyMissing === 0) {
        synergy += 18; // 이 카드를 사면 즉시 귀족(3점) 영입!
      } else if (afterBuyMissing === 1) {
        synergy += 6;
      } else if (afterBuyMissing === 2) {
        synergy += 3;
      } else {
        synergy += 1.2;
      }
    }
    return synergy;
  }

  // 카드 자체의 전략적 가치 평가 (점수, 보너스 활용도, 귀족 시너지, Modern 특수 능력, 승리 피니시)
  function evaluateCardStrategicValue(state, playerIndex, card, difficulty = 'normal') {
    const player = state.players[playerIndex];
    const enableOrient = Boolean(state.config && state.config.enableOrientAbilities);
    const targetPoints = (state.config && state.config.targetPoints) || 15;
    const purchaseInfo = evaluatePurchase(player, card, enableOrient);
    const bonuses = getPlayerBonuses(player, enableOrient);
    const totalPurchased = (player.purchasedCards || []).length;

    let score = 0;

    // 1. 기본 명성 점수 가치 (후반부일수록 가중치 급증)
    const gameProgress = Math.min(1, (player.points || 0) / targetPoints);
    score += (card.points || 0) * (3.5 + gameProgress * 3.0);

    // 2. 즉시 승리 가능한 피니시 카드면 최우선 부여
    const nobleImmediateBonus = scoreNobleSynergy(player, card, state.nobles, enableOrient) >= 15 ? 3 : 0;
    const extraOrientPoint = (enableOrient && card.modernAbility === 'noble_reserve') ? 1 : 0;
    if ((player.points || 0) + (card.points || 0) + nobleImmediateBonus + extraOrientPoint >= targetPoints) {
      score += 100;
    }

    // 3. 보석 보너스 가치 (초중반 엔진 빌딩에 핵심)
    const engineWeight = Math.max(0.5, 1.8 - totalPurchased * 0.12);
    const bonusAmt = (enableOrient && card.modernAbility === 'double_bonus') ? 2 : 1;
    score += bonusAmt * 2.4 * engineWeight;

    // 보드 위의 다른 고득점 카드들이 요구하는 색상인지 확인
    const boardCards = getAllBoardCards(state);
    let demandCount = 0;
    for (const bc of boardCards) {
      if (bc.id !== card.id && bc.points >= 2 && bc.cost && bc.cost[card.bonusGem] > (bonuses[card.bonusGem] || 0)) {
        demandCount += 1;
      }
    }
    score += Math.min(3.5, demandCount * 0.65);

    // 4. 귀족 타일 시너지
    if (difficulty !== 'easy') {
      score += scoreNobleSynergy(player, card, state.nobles, enableOrient);
    }

    // 5. Modern 특수 능력 가산점
    if (enableOrient && card.modernAbility) {
      if (card.modernAbility === 'double_bonus') score += 3.8;
      if (card.modernAbility === 'steal_token') score += 2.2;
      if (card.modernAbility === 'free_cascade') score += 3.2;
      if (card.modernAbility === 'noble_reserve') score += 3.5;
    }

    // 6. 성채(Strongholds) 시너지
    if (state.config && state.config.enableStrongholds) {
      if (card.strongholdOwner === playerIndex && (card.strongholdCount || 0) >= 2) {
        score += 3.0;
      }
    }

    // 7. 비용 효율성 차감 (실제 지불해야 하는 토큰이 적을수록, 황금 조커를 아낄수록 유리)
    score -= purchaseInfo.totalShortfallAfterBonus * 0.55;
    score -= purchaseInfo.goldNeeded * (difficulty === 'hard' ? 1.35 : 0.85);

    return score;
  }

  // 성채(Stronghold) 배치/제거 최적 타깃 계산 (Modern 모드 전용)
  function chooseStrongholdAction(state, playerIndex, purchasedCardId) {
    if (!state.config || !state.config.enableStrongholds) return null;
    const boardCards = getAllBoardCards(state).filter((c) => c.id !== purchasedCardId);
    if (boardCards.length === 0) return null;

    const enableOrient = Boolean(state.config.enableOrientAbilities);

    // 1순위: 상대가 성채 2개를 쌓아 독점 직전인 고가치 카드의 성채 제거
    let bestRemoveTarget = null;
    let bestRemoveScore = -1;
    for (const card of boardCards) {
      if (card.strongholdOwner !== null && card.strongholdOwner !== undefined && card.strongholdOwner !== playerIndex && (card.strongholdCount || 0) > 0) {
        const threatScore = (card.strongholdCount * 5) + (card.points * 2.5);
        if (threatScore > bestRemoveScore) {
          bestRemoveScore = threatScore;
          bestRemoveTarget = card;
        }
      }
    }

    // 2순위: 내 성채가 이미 올라가 있거나, 내가 곧 살 수 있는 고효율 카드에 성채 추가
    let bestPlaceTarget = null;
    let bestPlaceScore = -1;
    for (const card of boardCards) {
      if (card.strongholdOwner === null || card.strongholdOwner === undefined || card.strongholdOwner === playerIndex) {
        const purchaseInfo = evaluatePurchase(state.players[playerIndex], card, enableOrient);
        let placeScore = (card.points * 2.2) - purchaseInfo.missingTokens * 1.1;
        if (card.strongholdOwner === playerIndex) {
          placeScore += (card.strongholdCount || 0) * 6.5; // 3개 달성 유도
        }
        if (placeScore > bestPlaceScore) {
          bestPlaceScore = placeScore;
          bestPlaceTarget = card;
        }
      }
    }

    if (bestRemoveTarget && bestRemoveScore >= bestPlaceScore) {
      return {
        type: 'remove',
        targetCardId: bestRemoveTarget.id,
        note: `상대의 성채 독점을 저지하기 위해 [${bestRemoveTarget.themeTitle}]의 성채를 제거`
      };
    }

    if (bestPlaceTarget) {
      return {
        type: 'place',
        targetCardId: bestPlaceTarget.id,
        note: `[${bestPlaceTarget.themeTitle}]에 성채를 배치하여 거점 확보`
      };
    }
    return null;
  }

  // 구매 가능한 모든 카드(보드 공개 카드 + 내 예약 카드) 목록 수집
  function getAffordableMoves(state, playerIndex, difficulty) {
    const player = state.players[playerIndex];
    const enableOrient = Boolean(state.config && state.config.enableOrientAbilities);
    const candidates = [];

    // 1. 예약된 카드 확인
    if (Array.isArray(player.reservedCards)) {
      for (const card of player.reservedCards) {
        const evalRes = evaluatePurchase(player, card, enableOrient);
        if (evalRes.canAfford) {
          candidates.push({
            card,
            source: 'reserved',
            evalRes,
            score: evaluateCardStrategicValue(state, playerIndex, card, difficulty) + 1.2 // 예약 카드 해소 가산점
          });
        }
      }
    }

    // 2. 보드 공개 카드 확인
    for (const card of getAllBoardCards(state)) {
      if (isLockedByOpponentStronghold(card, playerIndex, state)) continue;
      const evalRes = evaluatePurchase(player, card, enableOrient);
      if (evalRes.canAfford) {
        candidates.push({
          card,
          source: 'board',
          evalRes,
          score: evaluateCardStrategicValue(state, playerIndex, card, difficulty)
        });
      }
    }

    candidates.sort((a, b) => b.score - a.score);
    return candidates;
  }

  // 상대방이 다음 턴에 즉시 구매할 수 있는 위협적인 고득점 카드 탐지 (Hard 난이도 견제용)
  function findOpponentThreatCardToBlock(state, playerIndex) {
    const player = state.players[playerIndex];
    if (!player || (player.reservedCards && player.reservedCards.length >= 3)) return null;

    const enableOrient = Boolean(state.config && state.config.enableOrientAbilities);
    const targetPoints = (state.config && state.config.targetPoints) || 15;
    const boardCards = getAllBoardCards(state);

    let worstThreat = null;
    let highestThreatScore = 0;

    for (let idx = 0; idx < state.players.length; idx++) {
      if (idx === playerIndex) continue;
      const opp = state.players[idx];

      for (const card of boardCards) {
        if (isLockedByOpponentStronghold(card, playerIndex, state)) continue;
        const oppEval = evaluatePurchase(opp, card, enableOrient);

        // 상대가 지금 당장 살 수 있거나 토큰 1개 차이로 다음 턴 구매가 확실시되는 고득점 카드
        if (oppEval.canAfford || (oppEval.missingTokens <= 1 && card.points >= 3)) {
          const oppNobleGain = scoreNobleSynergy(opp, card, state.nobles, enableOrient) >= 15 ? 3 : 0;
          const oppPointsAfter = (opp.points || 0) + (card.points || 0) + oppNobleGain;

          let threatScore = 0;
          if (oppPointsAfter >= targetPoints && oppEval.canAfford) {
            threatScore = 95 + card.points * 5; // 방치하면 상대가 즉시 승리하는 카드!
          } else if (oppEval.canAfford && card.points >= 3) {
            threatScore = 40 + card.points * 6 + (opp.points || 0) * 1.5;
          } else if (oppEval.canAfford && oppNobleGain > 0) {
            threatScore = 50 + card.points * 4;
          }

          if (threatScore > highestThreatScore) {
            highestThreatScore = threatScore;
            worstThreat = {
              card,
              opponentName: opp.name || `플레이어 ${idx + 1}`,
              threatScore,
              isWinningBlock: oppPointsAfter >= targetPoints
            };
          }
        }
      }
    }

    return highestThreatScore >= 48 ? worstThreat : null;
  }

  // 목표 카드들을 향해 가장 효율적인 보석 토큰 수집 조합 계산
  function chooseBestTokenAction(state, playerIndex, difficulty) {
    const player = state.players[playerIndex];
    const bank = state.bankTokens || {};
    const enableOrient = Boolean(state.config && state.config.enableOrientAbilities);
    const maxTokens = (state.config && state.config.maxTokensInHand) || 10;
    const currentTokenCount = getPlayerTotalTokens(player);
    const freeSlots = Math.max(0, maxTokens - currentTokenCount);

    const availableColors = GEM_KEYS.filter((gem) => (bank[gem] || 0) > 0);
    if (availableColors.length === 0 || freeSlots <= 0) {
      return null;
    }

    // 초급(Easy): 부족한 보석 위주로 무작위성 가미하여 선택
    if (difficulty === 'easy') {
      const shuffled = [...availableColors].sort(() => Math.random() - 0.5);
      const takeCount = Math.min(3, freeSlots, shuffled.length);
      const picked = shuffled.slice(0, takeCount);
      const tokensObj = {};
      picked.forEach((g) => { tokensObj[g] = 1; });

      return {
        actionType: 'TAKE_TOKENS',
        payload: { tokens: tokensObj, mode: 'different' },
        reasonText: `초급 상인이 필요한 원석(${picked.map(getKorGemName).join(', ')})을 수집합니다.`
      };
    }

    // 중급(Normal) & 고급(Hard): 보드 및 예약 카드 중 구매에 가장 근접하고 가치가 높은 상위 목표 3장 선정
    const targetCandidates = [];
    const allTargets = [
      ...(player.reservedCards || []).map((c) => ({ card: c, isReserved: true })),
      ...getAllBoardCards(state).filter((c) => !isLockedByOpponentStronghold(c, playerIndex, state)).map((c) => ({ card: c, isReserved: false }))
    ];

    for (const item of allTargets) {
      const evalRes = evaluatePurchase(player, item.card, enableOrient);
      if (evalRes.missingTokens > 0 && evalRes.missingTokens <= 6) {
        const stratVal = evaluateCardStrategicValue(state, playerIndex, item.card, difficulty);
        const proximityBoost = (7 - evalRes.missingTokens) * (difficulty === 'hard' ? 4.2 : 3.0);
        const reservedBoost = item.isReserved ? 4.5 : 0;
        targetCandidates.push({
          card: item.card,
          evalRes,
          priority: stratVal + proximityBoost + reservedBoost
        });
      }
    }

    targetCandidates.sort((a, b) => b.priority - a.priority);
    const topTargets = targetCandidates.slice(0, 3);

    // 각 보석 색상별 필요 가중치 산출
    const gemDesire = { emerald: 0.1, sapphire: 0.1, ruby: 0.1, diamond: 0.1, onyx: 0.1 };
    const bonuses = getPlayerBonuses(player, enableOrient);
    const pTokens = player.tokens || {};

    topTargets.forEach((t, idx) => {
      const weight = idx === 0 ? 5.0 : (idx === 1 ? 2.5 : 1.2);
      for (const gem of GEM_KEYS) {
        const rawCost = (t.card.cost && t.card.cost[gem]) || 0;
        const netNeeded = Math.max(0, rawCost - (bonuses[gem] || 0) - (pTokens[gem] || 0));
        if (netNeeded > 0) {
          gemDesire[gem] += netNeeded * weight;
        }
      }
    });

    // 같은 보석 2개 가져오기(Double Take)가 유리한지 검사 (은행에 4개 이상 있고 빈 슬롯이 2개 이상일 때)
    let bestDoubleGem = null;
    let bestDoubleScore = -1;
    if (freeSlots >= 2) {
      for (const gem of GEM_KEYS) {
        if ((bank[gem] || 0) >= 4) {
          // 1순위 타깃 카드가 해당 보석을 2개 이상 급하게 필요로 하는지 확인
          const primaryCard = topTargets[0] ? topTargets[0].card : null;
          const primaryDeficit = primaryCard
            ? Math.max(0, ((primaryCard.cost && primaryCard.cost[gem]) || 0) - (bonuses[gem] || 0) - (pTokens[gem] || 0))
            : 0;
          if (primaryDeficit >= 2) {
            const doubleScore = gemDesire[gem] * 1.65;
            if (doubleScore > bestDoubleScore) {
              bestDoubleScore = doubleScore;
              bestDoubleGem = gem;
            }
          }
        }
      }
    }

    // 서로 다른 보석 최대 3개 가져오기 점수 계산
    const sortedColors = [...availableColors].sort((a, b) => gemDesire[b] - gemDesire[a]);
    const takeDiffCount = Math.min(3, freeSlots, sortedColors.length);
    const pickedDiff = sortedColors.slice(0, takeDiffCount);
    const diffScore = pickedDiff.reduce((sum, g) => sum + gemDesire[g], 0);

    if (bestDoubleGem && bestDoubleScore > diffScore * 1.05) {
      const targetName = topTargets[0] ? `[${topTargets[0].card.themeTitle}]` : '핵심 개발 카드';
      return {
        actionType: 'TAKE_TOKENS',
        payload: { tokens: { [bestDoubleGem]: 2 }, mode: 'same' },
        reasonText: `${targetName} 구매를 앞당기기 위해 ${getKorGemName(bestDoubleGem)} 토큰 2개를 집중 확보했습니다.`
      };
    }

    const tokensObj = {};
    pickedDiff.forEach((g) => { tokensObj[g] = 1; });
    const targetDesc = topTargets[0]
      ? `[${topTargets[0].card.themeTitle}](${topTargets[0].card.points}점) 준비를 위해`
      : '보석 엔진 밸런스를 위해';

    return {
      actionType: 'TAKE_TOKENS',
      payload: { tokens: tokensObj, mode: 'different' },
      reasonText: `${targetDesc} ${pickedDiff.map(getKorGemName).join('·')} 토큰을 수집했습니다.`
    };
  }

  // 전략적 카드 예약 선택
  function chooseStrategicReserve(state, playerIndex, difficulty) {
    const player = state.players[playerIndex];
    if (!player || (player.reservedCards && player.reservedCards.length >= 3)) return null;

    const enableOrient = Boolean(state.config && state.config.enableOrientAbilities);
    const boardCards = getAllBoardCards(state).filter((c) => !isLockedByOpponentStronghold(c, playerIndex, state));
    if (boardCards.length === 0) return null;

    let bestCard = null;
    let bestScore = -999;

    for (const card of boardCards) {
      const evalRes = evaluatePurchase(player, card, enableOrient);
      // 황금 토큰 1개를 받으면 곧 살 수 있는 고득점(2~5점) 또는 핵심 카드 선호
      if (evalRes.missingTokens >= 1 && evalRes.missingTokens <= 4) {
        const score = evaluateCardStrategicValue(state, playerIndex, card, difficulty)
          + (card.points * 2.0)
          - (evalRes.missingTokens * 2.2);
        if (score > bestScore) {
          bestScore = score;
          bestCard = card;
        }
      }
    }

    if (!bestCard) {
      bestCard = boardCards[0];
    }

    const hasGold = (state.bankTokens && state.bankTokens.gold > 0);
    return {
      actionType: 'RESERVE_CARD',
      payload: {
        cardId: bestCard.id,
        level: bestCard.level,
        gainGold: Boolean(hasGold)
      },
      reasonText: `향후 고득점 루트를 확보하기 위해 [${bestCard.themeTitle}](${bestCard.points}점) 카드를 예약${hasGold ? '하고 황금 조커를 획득' : ''}했습니다.`
    };
  }

  /**
   * 메인 AI 의사결정 함수
   * @param {Object} state - 현재 게임 상태 (players, boardCards, bankTokens, nobles, config)
   * @param {number} playerIndex - 현재 AI 플레이어 인덱스
   * @param {string} difficulty - 'easy' | 'normal' | 'hard'
   * @returns {Object} { actionType, payload, reasonText }
   */
  function decideMove(state, playerIndex, difficulty = 'normal') {
    const diff = ['easy', 'normal', 'hard'].includes(difficulty) ? difficulty : 'normal';
    const player = state && state.players ? state.players[playerIndex] : null;

    if (!player) {
      return {
        actionType: 'PASS',
        payload: {},
        reasonText: '대기 중입니다.'
      };
    }

    const enableOrient = Boolean(state.config && state.config.enableOrientAbilities);
    const targetPoints = (state.config && state.config.targetPoints) || 15;
    const affordableMoves = getAffordableMoves(state, playerIndex, diff);

    // ---------------------------------------------------------
    // 1. 즉시 승리할 수 있는 카드가 있으면 난이도 불문 무조건 즉시 구매
    // ---------------------------------------------------------
    for (const move of affordableMoves) {
      const nobleGain = scoreNobleSynergy(player, move.card, state.nobles, enableOrient) >= 15 ? 3 : 0;
      const orientPoint = (enableOrient && move.card.modernAbility === 'noble_reserve') ? 1 : 0;
      if ((player.points || 0) + (move.card.points || 0) + nobleGain + orientPoint >= targetPoints) {
        const strongholdAct = chooseStrongholdAction(state, playerIndex, move.card.id);
        return {
          actionType: 'BUY_CARD',
          payload: {
            cardId: move.card.id,
            source: move.source,
            payment: move.evalRes.payment,
            strongholdAction: strongholdAct
          },
          reasonText: `승리 목표 점수를 달성하기 위해 [${move.card.themeTitle}](+${move.card.points}점) 카드를 구매하며 피니시를 선언합니다!`
        };
      }
    }

    // ---------------------------------------------------------
    // 2. 고급(Hard) 전용: 상대방이 다음 턴에 끝내거나 고득점을 독식할 카드를 견제 예약(Block Reserve)
    // ---------------------------------------------------------
    if (diff === 'hard') {
      const threat = findOpponentThreatCardToBlock(state, playerIndex);
      if (threat) {
        // 만약 내가 그 위협적인 카드를 지금 당장 살 수 있다면 아예 구매해버림
        const canBuyThreatNow = affordableMoves.find((m) => m.card.id === threat.card.id);
        if (canBuyThreatNow) {
          const strongholdAct = chooseStrongholdAction(state, playerIndex, threat.card.id);
          return {
            actionType: 'BUY_CARD',
            payload: {
              cardId: threat.card.id,
              source: 'board',
              payment: canBuyThreatNow.evalRes.payment,
              strongholdAction: strongholdAct
            },
            reasonText: `${threat.opponentName}의 핵심 노림수인 [${threat.card.themeTitle}](${threat.card.points}점)을 선점 구매하여 차단했습니다!`
          };
        }

        // 내가 당장 못 사는데 상대가 다음 턴 승리하거나 치명적 이득을 본다면 즉시 예약으로 차단
        const bestOwnBuy = affordableMoves[0];
        if (threat.isWinningBlock || !bestOwnBuy || bestOwnBuy.score < 16) {
          const hasGold = Boolean(state.bankTokens && state.bankTokens.gold > 0);
          return {
            actionType: 'RESERVE_CARD',
            payload: {
              cardId: threat.card.id,
              level: threat.card.level,
              gainGold: hasGold,
              isBlockMove: true
            },
            reasonText: `${threat.opponentName}이(가) 다음 턴 [${threat.card.themeTitle}](${threat.card.points}점)을 구매하는 것을 막기 위해 전략적 견제 예약을 수행했습니다!`
          };
        }
      }
    }

    // ---------------------------------------------------------
    // 3. 구매 가능한 카드 중 최적 카드 구매 판단
    // ---------------------------------------------------------
    if (affordableMoves.length > 0) {
      if (diff === 'easy') {
        // 초급: 구매 가능한 카드 중 무작위 선택
        const randomMove = affordableMoves[Math.floor(Math.random() * affordableMoves.length)];
        const strongholdAct = chooseStrongholdAction(state, playerIndex, randomMove.card.id);
        return {
          actionType: 'BUY_CARD',
          payload: {
            cardId: randomMove.card.id,
            source: randomMove.source,
            payment: randomMove.evalRes.payment,
            strongholdAction: strongholdAct
          },
          reasonText: `보유한 보석으로 즉시 구매할 수 있는 [${randomMove.card.themeTitle}] 카드를 구입했습니다.`
        };
      }

      // 중급 & 고급: 가장 전략 점수가 높은 카드 선택
      const bestMove = affordableMoves[0];
      const strongholdAct = chooseStrongholdAction(state, playerIndex, bestMove.card.id);
      const nobleSynergy = scoreNobleSynergy(player, bestMove.card, state.nobles, enableOrient);

      let reasonDetail = `[${bestMove.card.themeTitle}](${getKorGemName(bestMove.card.bonusGem)} 보너스${bestMove.card.points > 0 ? `, +${bestMove.card.points}점` : ''}) 카드를 구매했습니다.`;
      if (nobleSynergy >= 15) {
        reasonDetail = `귀족 후원자의 방문 조건을 완성하기 위해 [${bestMove.card.themeTitle}] 카드를 구매했습니다!`;
      } else if (strongholdAct && diff === 'hard') {
        reasonDetail += ` (${strongholdAct.note})`;
      }

      return {
        actionType: 'BUY_CARD',
        payload: {
          cardId: bestMove.card.id,
          source: bestMove.source,
          payment: bestMove.evalRes.payment,
          strongholdAction: strongholdAct
        },
        reasonText: reasonDetail
      };
    }

    // ---------------------------------------------------------
    // 4. 당장 살 수 있는 카드가 없을 때: 토큰 수집 vs 전략적 예약
    // ---------------------------------------------------------
    const currentTokens = getPlayerTotalTokens(player);
    const maxTokens = (state.config && state.config.maxTokensInHand) || 10;

    // 보유 토큰이 거의 가득 찼거나(8개 이상) 고급/중급에서 황금 조커가 절실할 때 예약 고려
    if (currentTokens >= maxTokens - 1 && (player.reservedCards || []).length < 3) {
      const reserveAct = chooseStrategicReserve(state, playerIndex, diff);
      if (reserveAct) return reserveAct;
    }

    // 최적 토큰 수집 시도
    const tokenAct = chooseBestTokenAction(state, playerIndex, diff);
    if (tokenAct) {
      return tokenAct;
    }

    // 은행에 가져올 일반 토큰이 없다면 카드 예약 수행
    const fallbackReserve = chooseStrategicReserve(state, playerIndex, diff);
    if (fallbackReserve) {
      return fallbackReserve;
    }

    return {
      actionType: 'PASS',
      payload: {},
      reasonText: '수행 가능한 행동이 없어 턴을 넘깁니다.'
    };
  }

  const SplendorAI = {
    DIFFICULTY_PROFILES,
    decideMove,
    evaluateCardStrategicValue,
    chooseStrongholdAction,
    findOpponentThreatCardToBlock
  };

  if (typeof window !== 'undefined') {
    window.SplendorAI = SplendorAI;
  }
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = SplendorAI;
  }
})(typeof window !== 'undefined' ? window : globalThis);
