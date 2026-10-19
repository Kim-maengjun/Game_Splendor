/**
 * Splendor 3D - Main Application & Interactive 3D Board Controller
 * Integrates:
 * - window.SplendorData (rules_data.js)
 * - window.SplendorAI (ai_engine.js)
 * - window.SplendorPhysics3D (physics_3d.js)
 * - window.SplendorNet (multiplayer.js)
 *
 * Build Version: [v1.2.3 | 2026-10-20 01:20]
 */

(function (global) {
  'use strict';

  const APP_VERSION = '[v1.2.3 | 2026-10-20 01:20]';
  const WIN_STATS_STORAGE_KEY = 'splendor_win_stats_v1';

  // Gem key mapping & UI helpers
  const GEM_KEYS = ['emerald', 'sapphire', 'ruby', 'diamond', 'onyx'];
  const ALL_TOKEN_KEYS = ['emerald', 'sapphire', 'ruby', 'diamond', 'onyx', 'gold'];

  const GEM_UI_META = {
    emerald:  { kor: '에메랄드', short: '녹', swatch: 'swatch-green', cardTheme: 'gem-green', icon: '💚', keyNum: '1', chipImg: 'assets/gems/greenGem-removebg.png' },
    sapphire: { kor: '사파이어', short: '청', swatch: 'swatch-blue',  cardTheme: 'gem-blue',  icon: '💙', keyNum: '2', chipImg: 'assets/gems/blueGem-removebg.png' },
    ruby:     { kor: '루비',     short: '적', swatch: 'swatch-red',   cardTheme: 'gem-red',   icon: '❤️', keyNum: '3', chipImg: 'assets/gems/redGem-removebg.png' },
    diamond:  { kor: '다이아몬드', short: '백', swatch: 'swatch-white', cardTheme: 'gem-white', icon: '🤍', keyNum: '4', chipImg: 'assets/gems/whiteGem-removebg.png' },
    onyx:     { kor: '오닉스',   short: '흑', swatch: 'swatch-black', cardTheme: 'gem-black', icon: '🖤', keyNum: '5', chipImg: 'assets/gems/blackGem-removebg.png' },
    gold:     { kor: '황금(조커)', short: '금', swatch: 'swatch-gold', cardTheme: 'gem-gold',  icon: '🪙', keyNum: '6', chipImg: 'assets/gems/goldGem-removebg.png' }
  };

  const ILLUST_ICONS = {
    mine: '⛏️',
    cart: '🛒',
    caravan: '🐪',
    ship: '⛵',
    quarry: '🪨',
    tunnel: '🕳️',
    camp: '⛺',
    washer: '💧',
    artisan: '💍',
    workshop: '🔨',
    guild: '⚖️',
    merchant: '💰',
    exchange: '🏛️',
    atelier: '🎨',
    palace: '🏰',
    crown: '👑',
    cathedral: '⛪',
    treasury: '🏆'
  };

  const MODERN_ABILITY_LABELS = {
    double_bonus: '✨ 쌍보석 (보너스 x2)',
    steal_token: '⚡ 페이백 (+보석 1개)',
    free_cascade: '🎁 연쇄 할인 (-2 토큰)',
    noble_reserve: '👑 왕실 명성 (+1점)'
  };

  class SplendorGameController {
    constructor() {
      // Setup Lobby State
      this.lobbyConfig = {
        ruleMode: 'classic', // 'classic' | 'modern'
        playerCount: 2,
        netMode: 'local', // 'local' | 'online'
        slots: [
          { name: '플레이어 1', isAI: false, difficulty: 'normal' },
          { name: '르네상스 AI', isAI: true, difficulty: 'normal' },
          { name: '길드장 AI', isAI: true, difficulty: 'hard' },
          { name: '견습상인 AI', isAI: true, difficulty: 'easy' }
        ]
      };

      // Active Authoritative Game State
      this.state = null;
      this.gemBasket = []; // Array of gem keys currently selected in basket
      this.highlightedNobleId = null;
      this.recommendedCardId = null;
      this.aiTimer = null;
      this.boardTiltDeg = 16;
      this.winStats = this._loadWinStats();

      this.init();
    }

    _loadWinStats() {
      try {
        const raw = global.localStorage ? global.localStorage.getItem(WIN_STATS_STORAGE_KEY) : null;
        if (raw) {
          const parsed = JSON.parse(raw);
          if (parsed && typeof parsed === 'object') return parsed;
        }
      } catch (e) {
        // Ignore storage error
      }
      return {};
    }

    _saveWinStats() {
      try {
        if (global.localStorage) {
          global.localStorage.setItem(WIN_STATS_STORAGE_KEY, JSON.stringify(this.winStats || {}));
        }
      } catch (e) {
        // Ignore storage error
      }
    }

    _recordGameWinStats(winnerName) {
      if (!this.state || !this.state.players) return;
      this.state.players.forEach((p) => {
        const key = p.name;
        if (!this.winStats[key]) {
          this.winStats[key] = { wins: 0, games: 0 };
        }
        this.winStats[key].games += 1;
        if (p.name === winnerName) {
          this.winStats[key].wins += 1;
        }
      });
      this._saveWinStats();
    }

    resetWinStats() {
      this.winStats = {};
      this._saveWinStats();
      this._playClickSound();
      this.showToast('🔄 모든 게이머의 승률 및 전적 기록이 초기화되었습니다.');
      this.renderPlayersSidebar();
    }

    _getPlayerWinRateLabel(playerName) {
      const rec = (this.winStats && this.winStats[playerName]) || { wins: 0, games: 0 };
      const pct = rec.games > 0 ? Math.round((rec.wins / rec.games) * 100) : 0;
      return `승률 ${pct}% (${rec.wins}승/${rec.games}전)`;
    }

    init() {
      document.title = `스플렌더 3D: 르네상스 & 오리엔트 에디션 ${APP_VERSION}`;
      const verEl = document.getElementById('versionBadge');
      if (verEl) verEl.textContent = APP_VERSION;

      this._bindLobbyEvents();
      this._bindHeaderAndBoardEvents();
      this._bindKeyboardShortcuts();
      this._setupMultiplayerHooks();
      this._renderSlotsConfiguration();

      // Check URL query param for `?room=SPL-XXXX` auto-join
      const params = new URLSearchParams(window.location.search);
      const roomParam = params.get('room');
      if (roomParam) {
        this.lobbyConfig.netMode = 'online';
        this._syncLobbyNetUI();
        const inputEl = document.getElementById('inputRoomCode');
        if (inputEl) inputEl.value = roomParam.toUpperCase();
        if (global.SplendorNet) {
          global.SplendorNet.joinRoom(roomParam.toUpperCase(), '원격 참가자');
        }
      }

      // Initialize default background game immediately so the 3D board is alive behind the modal
      this.startNewGame(false);
    }

    /* ========================================================================
       1. LOBBY & SETUP CONFIGURATION
       ======================================================================== */
    _bindLobbyEvents() {
      const ruleClassic = document.getElementById('ruleCardClassic');
      const ruleModern = document.getElementById('ruleCardModern');

      if (ruleClassic && ruleModern) {
        ruleClassic.addEventListener('click', () => {
          this.lobbyConfig.ruleMode = 'classic';
          ruleClassic.classList.add('selected');
          ruleModern.classList.remove('selected');
          this._playClickSound();
        });
        ruleModern.addEventListener('click', () => {
          this.lobbyConfig.ruleMode = 'modern';
          ruleModern.classList.add('selected');
          ruleClassic.classList.remove('selected');
          this._playClickSound();
        });
      }

      // Player count pills
      const countGroup = document.getElementById('playerCountGroup');
      if (countGroup) {
        countGroup.querySelectorAll('.radio-pill').forEach((pill) => {
          pill.addEventListener('click', () => {
            countGroup.querySelectorAll('.radio-pill').forEach((p) => p.classList.remove('selected'));
            pill.classList.add('selected');
            this.lobbyConfig.playerCount = Number(pill.dataset.count) || 2;
            this._renderSlotsConfiguration();
            this._playClickSound();
          });
        });
      }

      // Net mode pills
      const netGroup = document.getElementById('netModeGroup');
      if (netGroup) {
        netGroup.querySelectorAll('.radio-pill').forEach((pill) => {
          pill.addEventListener('click', () => {
            netGroup.querySelectorAll('.radio-pill').forEach((p) => p.classList.remove('selected'));
            pill.classList.add('selected');
            this.lobbyConfig.netMode = pill.dataset.net || 'local';
            this._syncLobbyNetUI();
            this._playClickSound();
          });
        });
      }

      // P2P buttons
      const btnCreateRoom = document.getElementById('btnCreateRoom');
      const btnJoinRoom = document.getElementById('btnJoinRoom');
      const btnCopyInvite = document.getElementById('btnCopyInvite');
      const inputRoomCode = document.getElementById('inputRoomCode');

      if (btnCreateRoom) {
        btnCreateRoom.addEventListener('click', () => {
          if (!global.SplendorNet) return;
          // Ensure at least 2 human slots when hosting a multiplayer room
          this.lobbyConfig.slots[0].isAI = false;
          this.lobbyConfig.slots[1].isAI = false;
          this._renderSlotsConfiguration();

          const code = global.SplendorNet.hostRoom(
            inputRoomCode ? inputRoomCode.value : '',
            this.lobbyConfig.slots[0].name
          );
          if (inputRoomCode) inputRoomCode.value = code;
          this.showToast(`P2P 방 [${code}]이 생성되었습니다! 다른 탭이나 기기에서 참가하세요.`);
        });
      }

      if (btnJoinRoom) {
        btnJoinRoom.addEventListener('click', () => {
          if (!global.SplendorNet || !inputRoomCode) return;
          const code = inputRoomCode.value.trim();
          const ok = global.SplendorNet.joinRoom(code, '참가 플레이어');
          if (ok) {
            this.showToast(`방 [${code.toUpperCase()}]에 연결 요청을 보냈습니다...`);
          }
        });
      }

      if (btnCopyInvite) {
        btnCopyInvite.addEventListener('click', () => {
          if (!global.SplendorNet) return;
          const link = global.SplendorNet.getInviteLink();
          if (navigator.clipboard && navigator.clipboard.writeText) {
            navigator.clipboard.writeText(link).then(() => {
              this.showToast('초대 링크가 클립보드에 복사되었습니다!');
            });
          } else {
            prompt('아래 초대 링크를 복사하여 친구에게 전달하세요:', link);
          }
        });
      }

      // Close / Start buttons
      const btnCloseSetup = document.getElementById('btnCloseSetupModal');
      if (btnCloseSetup) {
        btnCloseSetup.addEventListener('click', () => {
          document.getElementById('setupModalBackdrop').classList.add('hidden');
        });
      }

      const btnStartNewGame = document.getElementById('btnStartNewGame');
      if (btnStartNewGame) {
        btnStartNewGame.addEventListener('click', () => {
          document.getElementById('setupModalBackdrop').classList.add('hidden');
          if (this.lobbyConfig.netMode === 'local' && global.SplendorNet) {
            global.SplendorNet.startLocalPassAndPlay();
          }
          this.startNewGame(true);
        });
      }
    }

    _syncLobbyNetUI() {
      const p2pPanel = document.getElementById('p2pConfigPanel');
      if (!p2pPanel) return;
      if (this.lobbyConfig.netMode === 'online') {
        p2pPanel.style.display = 'flex';
      } else {
        p2pPanel.style.display = 'none';
      }
    }

    _renderSlotsConfiguration() {
      const container = document.getElementById('slotsConfigContainer');
      if (!container) return;
      container.innerHTML = '';

      for (let i = 0; i < this.lobbyConfig.playerCount; i++) {
        const slot = this.lobbyConfig.slots[i];
        const row = document.createElement('div');
        row.className = 'slot-config-row';

        const label = document.createElement('div');
        label.style.fontWeight = '800';
        label.style.color = '#fde047';
        label.textContent = `슬롯 P${i + 1}`;

        const nameInput = document.createElement('input');
        nameInput.type = 'text';
        nameInput.value = slot.name;
        nameInput.placeholder = `플레이어 ${i + 1} 이름`;
        nameInput.addEventListener('input', (e) => {
          slot.name = e.target.value || `플레이어 ${i + 1}`;
        });

        const typeSelect = document.createElement('select');
        typeSelect.innerHTML = `
          <option value="human" ${!slot.isAI ? 'selected' : ''}>👤 사람 (Human)</option>
          <option value="ai" ${slot.isAI ? 'selected' : ''}>🤖 PC 인공지능 (AI)</option>
        `;

        const diffSelect = document.createElement('select');
        diffSelect.innerHTML = `
          <option value="easy" ${slot.difficulty === 'easy' ? 'selected' : ''}>🌱 초급 (견습 상인)</option>
          <option value="normal" ${slot.difficulty === 'normal' ? 'selected' : ''}>⚖️ 중급 (숙련 길드장)</option>
          <option value="hard" ${slot.difficulty === 'hard' ? 'selected' : ''}>🔥 고급 (르네상스 거장)</option>
        `;
        diffSelect.disabled = !slot.isAI;
        diffSelect.style.opacity = slot.isAI ? '1' : '0.4';

        typeSelect.addEventListener('change', (e) => {
          slot.isAI = e.target.value === 'ai';
          diffSelect.disabled = !slot.isAI;
          diffSelect.style.opacity = slot.isAI ? '1' : '0.4';
          if (slot.isAI && slot.name.startsWith('플레이어')) {
            slot.name = `르네상스 AI ${i + 1}`;
            nameInput.value = slot.name;
          } else if (!slot.isAI && slot.name.includes('AI')) {
            slot.name = `플레이어 ${i + 1}`;
            nameInput.value = slot.name;
          }
        });

        diffSelect.addEventListener('change', (e) => {
          slot.difficulty = e.target.value;
        });

        row.appendChild(label);
        row.appendChild(nameInput);
        row.appendChild(typeSelect);
        row.appendChild(diffSelect);
        container.appendChild(row);
      }
    }

    /* ========================================================================
       2. MULTIPLAYER HOOKS (WebRTC + BroadcastChannel + Local Pass & Play)
       ======================================================================== */
    _setupMultiplayerHooks() {
      if (!global.SplendorNet) return;

      global.SplendorNet.on('onStatusChange', (info) => {
        const badge = document.getElementById('netStatusBadge');
        const p2pText = document.getElementById('p2pStatusText');
        if (badge) {
          badge.innerHTML = `<span>${info.isConnected ? '🟢' : '🟡'} ${info.statusText}</span>`;
        }
        if (p2pText) {
          p2pText.textContent = `네트워크 상태: ${info.statusText}`;
        }
      });

      global.SplendorNet.on('onChatOrToast', (msg) => {
        this.showToast(msg);
      });

      global.SplendorNet.on('onPeersUpdated', (peers, newPeer) => {
        // When a remote client joins host, automatically set their slot to Human in both lobbyConfig and active state
        if (global.SplendorNet.mode === 'online_host') {
          (peers || []).forEach((pInfo) => {
            if (pInfo.slotIndex > 0 && this.lobbyConfig.slots[pInfo.slotIndex]) {
              this.lobbyConfig.slots[pInfo.slotIndex].isAI = false;
              this.lobbyConfig.slots[pInfo.slotIndex].name = pInfo.name;
            }
            if (pInfo.slotIndex > 0 && this.state && this.state.players[pInfo.slotIndex]) {
              this.state.players[pInfo.slotIndex].isAI = false;
              this.state.players[pInfo.slotIndex].name = pInfo.name;
            }
          });
          if (newPeer && this.state && this.state.players[newPeer.slotIndex]) {
            this.state.players[newPeer.slotIndex].isAI = false;
            this.state.players[newPeer.slotIndex].name = newPeer.name;
          }
          this._renderSlotsConfiguration();
          this._broadcastAuthoritativeState('새 참가자 동기화');
          this.renderAll();
        } else if (global.SplendorNet.mode === 'online_client') {
          this.renderAll();
        }
      });

      global.SplendorNet.on('onStateSync', (remoteState, meta) => {
        // Client receives updated state from Host (first play 3D flying animations on old DOM before re-rendering!)
        if (meta && meta.animFx) {
          this._replaySyncedAnimationFX(meta.animFx, false);
        }
        this.state = remoteState;
        this.gemBasket = [];
        document.getElementById('setupModalBackdrop').classList.add('hidden');
        if (meta && meta.toast) {
          this.showToast(meta.toast);
        }
        this.renderAll();
        if (meta && meta.animFx && meta.animFx.dealAnim && global.SplendorPhysics3D) {
          const { level, slotIdx, cardObj } = meta.animFx.dealAnim;
          const deckEl = document.querySelector(`.deck-stack-3d[data-tier="${level}"]`);
          const slotEl = document.querySelector(`.dev-card[data-level="${level}"][data-slot-idx="${slotIdx}"]`);
          if (deckEl && slotEl) {
            global.SplendorPhysics3D.animateCardFlipAndMove(deckEl, slotEl, cardObj);
          }
        }
      });

      global.SplendorNet.on('onActionReceived', (actionObj, slotIndex) => {
        // Host receives action from a remote Client — strictly enforce slotIndex === currentPlayerIndex
        if (global.SplendorNet.mode !== 'online_host' || !this.state) return;
        const activeIdx = this.state.currentPlayerIndex;
        if (slotIndex !== activeIdx) {
          return;
        }
        this.executeAction(actionObj, activeIdx);
      });
    }

    _replaySyncedAnimationFX(animFx) {
      if (!animFx || !global.SplendorPhysics3D) return;
      const pIdx = animFx.playerIndex;
      const playerPanelEl = document.querySelector(`.player-card-panel[data-player-idx="${pIdx}"]`);

      if (animFx.sound === 'chip') {
        this._playChipSound();
      } else if (animFx.sound === 'card') {
        this._playCardFlipSound();
      }
      if (animFx.nobleVisited) {
        this._playNobleFanfare();
      }

      (animFx.chipsToPlayer || []).forEach((item) => {
        const bankEl = document.querySelector(`.bank-token-btn[data-bank-gem="${item.gem}"]`);
        global.SplendorPhysics3D.animateChipTransfer(bankEl, playerPanelEl, item.gem, item.count);
      });

      (animFx.chipsToBank || []).forEach((item) => {
        const bankEl = document.querySelector(`.bank-token-btn[data-bank-gem="${item.gem}"]`);
        global.SplendorPhysics3D.animateChipTransfer(playerPanelEl, bankEl, item.gem, item.count);
      });

      if (animFx.cardTake) {
        const { fromType, cardId, level, cardObj, isBlind } = animFx.cardTake;
        let fromEl = null;
        if (fromType === 'deck') {
          fromEl = document.querySelector(`.deck-stack-3d[data-tier="${level}"]`);
        } else if (fromType === 'reserved') {
          fromEl = document.querySelector(`.mini-reserved-slot[data-reserved-card-id="${cardId}"]`) || playerPanelEl;
        } else {
          fromEl = document.querySelector(`.dev-card[data-card-id="${cardId}"]`);
        }
        if (fromEl && playerPanelEl && global.SplendorPhysics3D.animateCardTakeToPlayer) {
          global.SplendorPhysics3D.animateCardTakeToPlayer(fromEl, playerPanelEl, cardObj, isBlind);
        }
      }
    }

    _broadcastAuthoritativeState(toastMsg = null, animFx = null) {
      if (global.SplendorNet && global.SplendorNet.mode === 'online_host' && this.state) {
        global.SplendorNet.broadcastState(this.state, { toast: toastMsg, animFx });
      }
    }

    /* ========================================================================
       3. GAME INITIALIZATION & STATE CREATION
       ======================================================================== */
    startNewGame(announce = true) {
      if (this.aiTimer) {
        clearTimeout(this.aiTimer);
        this.aiTimer = null;
      }

      const data = global.SplendorData;
      const count = this.lobbyConfig.playerCount;
      const modeId = this.lobbyConfig.ruleMode;
      const setupCfg = data.getSetupConfig(count, modeId);

      // Shuffle helper
      const shuffle = (arr) => {
        const copy = arr.slice();
        for (let i = copy.length - 1; i > 0; i--) {
          const j = Math.floor(Math.random() * (i + 1));
          [copy[i], copy[j]] = [copy[j], copy[i]];
        }
        return copy;
      };

      // Build decks per level
      const decks = { 1: [], 2: [], 3: [] };
      data.CARDS.forEach((c) => {
        const cloned = JSON.parse(JSON.stringify(c));
        cloned.strongholdOwner = null;
        cloned.strongholdCount = 0;
        decks[cloned.level].push(cloned);
      });
      decks[1] = shuffle(decks[1]);
      decks[2] = shuffle(decks[2]);
      decks[3] = shuffle(decks[3]);

      const boardCards = {
        1: decks[1].splice(0, 4),
        2: decks[2].splice(0, 4),
        3: decks[3].splice(0, 4)
      };

      const nobles = shuffle(JSON.parse(JSON.stringify(data.NOBLES))).slice(0, setupCfg.nobleCount);

      // If hosting an online room, ensure any connected client slots are set to Human
      if (global.SplendorNet && global.SplendorNet.mode === 'online_host') {
        this.lobbyConfig.slots[0].isAI = false;
        this.lobbyConfig.slots[1].isAI = false;
        (global.SplendorNet.connectedPeers || []).forEach((pInfo) => {
          if (pInfo.slotIndex >= 0 && pInfo.slotIndex < count && this.lobbyConfig.slots[pInfo.slotIndex]) {
            this.lobbyConfig.slots[pInfo.slotIndex].isAI = false;
          }
        });
      }

      const players = [];
      for (let i = 0; i < count; i++) {
        const slot = this.lobbyConfig.slots[i];
        players.push({
          index: i,
          name: slot.name || `플레이어 ${i + 1}`,
          isAI: Boolean(slot.isAI),
          difficulty: slot.difficulty || 'normal',
          tokens: { emerald: 0, sapphire: 0, ruby: 0, diamond: 0, onyx: 0, gold: 0 },
          purchasedCards: [],
          reservedCards: [],
          nobles: [],
          points: 0,
          strongholdsLeft: setupCfg.enableStrongholds ? 3 : 0
        });
      }

      this.state = {
        config: setupCfg,
        bankTokens: Object.assign({}, setupCfg.bankTokens),
        decks,
        boardCards,
        nobles,
        players,
        currentPlayerIndex: 0,
        roundNumber: 1,
        isFinalRound: false,
        gameOver: false,
        winnerIndex: null,
        lastActionText: '새 게임이 시작되었습니다! 보석 토큰을 모으거나 개발 카드를 구매하세요.'
      };

      this.gemBasket = [];
      this.recommendedCardId = null;

      if (global.SplendorNet) {
        global.SplendorNet.togglePrivacyShield(false);
      }

      if (announce) {
        this._playCardFlipSound();
        this.showToast(
          `${modeId === 'modern' ? '🏯 최신 확장 룰' : '🏛️ 전통 룰'} (${count}인 대전) 새 게임이 시작되었습니다!`
        );
        this._broadcastAuthoritativeState('방장이 새 게임을 시작했습니다!');
      }

      this.renderAll();
      this._checkAndScheduleAITurn();
    }

    /* ========================================================================
       4. CORE ACTION EXECUTION (TOKENS, BUY, RESERVE, STRONGHOLD, NOBLES)
       ======================================================================== */
    _canLocalUserActNow() {
      if (!this.state || this.state.gameOver) return false;
      const curIdx = this.state.currentPlayerIndex;
      const curPlayer = this.state.players[curIdx];
      if (!curPlayer || curPlayer.isAI) return false;
      if (global.SplendorNet) {
        return global.SplendorNet.canControlPlayer(curIdx, curPlayer);
      }
      return true;
    }

    /**
     * Dispatch an action either locally (Host / Local mode) or send to Host if Online Client
     */
    dispatchPlayerAction(actionObj) {
      if (!this.state || this.state.gameOver) return;
      const curIdx = this.state.currentPlayerIndex;

      if (global.SplendorNet && global.SplendorNet.mode === 'online_client') {
        if (global.SplendorNet.mySlotIndex !== curIdx) {
          this.showToast(`현재 P${curIdx + 1}의 턴입니다! 내 차례(P${global.SplendorNet.mySlotIndex + 1})를 기다려 주세요.`);
          return;
        }
        global.SplendorNet.sendAction(actionObj, curIdx);
        return;
      }

      if (global.SplendorNet && global.SplendorNet.mode === 'online_host') {
        if (global.SplendorNet.mySlotIndex !== curIdx) {
          this.showToast(`현재 P${curIdx + 1}(상대방)의 턴입니다! 상대방의 행동을 기다려 주세요.`);
          return;
        }
      }

      this.executeAction(actionObj, curIdx);
    }

    executeAction(actionObj, playerIndex) {
      if (!this.state || this.state.gameOver) return;
      const player = this.state.players[playerIndex];
      if (!player) return;

      const { actionType, payload } = actionObj;
      let actionSummary = '';
      const syncAnimFx = {
        playerIndex,
        sound: null,
        chipsToPlayer: [],
        chipsToBank: [],
        cardTake: null,
        dealAnim: null,
        nobleVisited: false
      };

      if (actionType === 'TAKE_TOKENS') {
        const tokensObj = payload.tokens || {};
        const playerPanelEl = document.querySelector(`.player-card-panel[data-player-idx="${playerIndex}"]`);
        for (const gem of ALL_TOKEN_KEYS) {
          const amt = Number(tokensObj[gem]) || 0;
          if (amt > 0) {
            const actual = Math.min(amt, this.state.bankTokens[gem] || 0);
            this.state.bankTokens[gem] -= actual;
            player.tokens[gem] = (player.tokens[gem] || 0) + actual;
            if (actual > 0) {
              syncAnimFx.chipsToPlayer.push({ gem, count: actual });
              if (global.SplendorPhysics3D) {
                const bankEl = document.querySelector(`.bank-token-btn[data-bank-gem="${gem}"]`);
                global.SplendorPhysics3D.animateChipTransfer(bankEl, playerPanelEl, gem, actual);
              }
            }
          }
        }
        const returnTokens = payload.returnTokens || {};
        for (const gem of ALL_TOKEN_KEYS) {
          const retAmt = Number(returnTokens[gem]) || 0;
          if (retAmt > 0 && (player.tokens[gem] || 0) >= retAmt) {
            player.tokens[gem] -= retAmt;
            this.state.bankTokens[gem] += retAmt;
            syncAnimFx.chipsToBank.push({ gem, count: retAmt });
            if (global.SplendorPhysics3D) {
              const bankEl = document.querySelector(`.bank-token-btn[data-bank-gem="${gem}"]`);
              global.SplendorPhysics3D.animateChipTransfer(playerPanelEl, bankEl, gem, retAmt);
            }
          }
        }

        const takenNames = Object.entries(tokensObj)
          .filter(([, v]) => v > 0)
          .map(([k, v]) => `${GEM_UI_META[k].kor} ${v}개`)
          .join(', ');
        actionSummary = `${player.name}: 보석 획득 (${takenNames})`;
        syncAnimFx.sound = 'chip';
        this._playChipSound();
      } else if (actionType === 'RESERVE_CARD') {
        if (player.reservedCards.length >= 3) {
          this.showToast('예약 카드는 최대 3장까지만 보유할 수 있습니다.');
          return;
        }
        let targetCard = null;
        let replacementCard = null;
        let replacedSlotIdx = -1;
        const level = payload.level;
        const playerPanelEl = document.querySelector(`.player-card-panel[data-player-idx="${playerIndex}"]`);

        if (payload.cardId) {
          const row = this.state.boardCards[level] || [];
          const idx = row.findIndex((c) => c && c.id === payload.cardId);
          if (idx !== -1) {
            targetCard = row[idx];
            replacedSlotIdx = idx;
            syncAnimFx.cardTake = { fromType: 'board', cardId: payload.cardId, level, cardObj: targetCard, isBlind: false };
            const oldCardEl = document.querySelector(`.dev-card[data-card-id="${payload.cardId}"]`);
            if (oldCardEl && global.SplendorPhysics3D && global.SplendorPhysics3D.animateCardTakeToPlayer) {
              global.SplendorPhysics3D.animateCardTakeToPlayer(oldCardEl, playerPanelEl, targetCard, false);
            }
            // Clear any strongholds on reserved card and return to owner
            this._returnStrongholdsOnCard(targetCard);
            replacementCard = this.state.decks[level].shift() || null;
            row[idx] = replacementCard;
          }
        } else if (this.state.decks[level] && this.state.decks[level].length > 0) {
          targetCard = this.state.decks[level].shift();
          targetCard.reservedFromDeck = true;
          syncAnimFx.cardTake = { fromType: 'deck', cardId: targetCard.id, level, cardObj: targetCard, isBlind: true };
          const deckEl = document.querySelector(`.deck-stack-3d[data-tier="${level}"]`);
          if (deckEl && global.SplendorPhysics3D && global.SplendorPhysics3D.animateCardTakeToPlayer) {
            global.SplendorPhysics3D.animateCardTakeToPlayer(deckEl, playerPanelEl, targetCard, true);
          }
        }

        if (!targetCard) {
          this.showToast('예약할 수 있는 카드가 없습니다.');
          return;
        }

        player.reservedCards.push(targetCard);
        let gotGold = false;
        if (this.state.bankTokens.gold > 0) {
          this.state.bankTokens.gold -= 1;
          player.tokens.gold = (player.tokens.gold || 0) + 1;
          gotGold = true;
          syncAnimFx.chipsToPlayer.push({ gem: 'gold', count: 1 });
          if (global.SplendorPhysics3D) {
            const goldBankEl = document.querySelector('.bank-token-btn[data-bank-gem="gold"]');
            global.SplendorPhysics3D.animateChipTransfer(goldBankEl, playerPanelEl, 'gold', 1);
          }
        }

        if (replacementCard && replacedSlotIdx >= 0) {
          this._pendingDealAnim = { level, slotIdx: replacedSlotIdx, cardObj: replacementCard };
          syncAnimFx.dealAnim = { level, slotIdx: replacedSlotIdx, cardObj: replacementCard };
        }

        const returnTokens = payload.returnTokens || {};
        for (const gem of ALL_TOKEN_KEYS) {
          const retAmt = Number(returnTokens[gem]) || 0;
          if (retAmt > 0 && (player.tokens[gem] || 0) >= retAmt) {
            player.tokens[gem] -= retAmt;
            this.state.bankTokens[gem] += retAmt;
            syncAnimFx.chipsToBank.push({ gem, count: retAmt });
          }
        }

        actionSummary = `${player.name}: 레벨 ${targetCard.level} 카드 예약${gotGold ? ' + 황금(조커) 1개 획득' : ''}`;
        syncAnimFx.sound = 'card';
        this._playCardFlipSound();
      } else if (actionType === 'BUY_CARD') {
        const { cardId, source, strongholdAction } = payload;
        let card = null;
        let boardLevel = null;
        let boardIdx = -1;
        const playerPanelEl = document.querySelector(`.player-card-panel[data-player-idx="${playerIndex}"]`);

        if (source === 'reserved') {
          const rIdx = player.reservedCards.findIndex((c) => c && c.id === cardId);
          if (rIdx !== -1) {
            card = player.reservedCards[rIdx];
            player.reservedCards.splice(rIdx, 1);
          }
        } else {
          for (const lv of [1, 2, 3]) {
            const row = this.state.boardCards[lv] || [];
            const idx = row.findIndex((c) => c && c.id === cardId);
            if (idx !== -1) {
              card = row[idx];
              boardLevel = lv;
              boardIdx = idx;
              break;
            }
          }
        }

        if (!card) {
          this.showToast('구매할 카드를 찾을 수 없습니다.');
          return;
        }

        // Check Stronghold lock in Modern mode
        if (
          this.state.config.enableStrongholds &&
          card.strongholdOwner !== null &&
          card.strongholdOwner !== undefined &&
          card.strongholdOwner !== playerIndex &&
          (card.strongholdCount || 0) > 0
        ) {
          this.showToast('상대방의 성채(Stronghold)가 배치된 카드는 구매할 수 없습니다!');
          return;
        }

        const evalRes = global.SplendorData.evaluateCardPurchase(
          player,
          card,
          this.state.config.enableOrientAbilities
        );
        if (!evalRes.canAfford) {
          this.showToast('보석 토큰이 부족하여 이 카드를 구매할 수 없습니다.');
          return;
        }

        syncAnimFx.cardTake = {
          fromType: source === 'reserved' ? 'reserved' : 'board',
          cardId: card.id,
          level: card.level,
          cardObj: card,
          isBlind: false
        };

        // Animate card flying from board/reserved slot to player
        if (global.SplendorPhysics3D && global.SplendorPhysics3D.animateCardTakeToPlayer) {
          const fromCardEl =
            source === 'reserved'
              ? document.querySelector(`.mini-reserved-slot[data-reserved-card-id="${card.id}"]`) || playerPanelEl
              : document.querySelector(`.dev-card[data-card-id="${card.id}"]`);
          if (fromCardEl && playerPanelEl) {
            global.SplendorPhysics3D.animateCardTakeToPlayer(fromCardEl, playerPanelEl, card, false);
          }
        }

        // Pay tokens to bank + 3D chip animation from player to bank
        const payment = evalRes.payment;
        for (const gem of ALL_TOKEN_KEYS) {
          const payAmt = payment[gem] || 0;
          if (payAmt > 0) {
            player.tokens[gem] -= payAmt;
            this.state.bankTokens[gem] += payAmt;
            syncAnimFx.chipsToBank.push({ gem, count: payAmt });
            if (global.SplendorPhysics3D) {
              const bankEl = document.querySelector(`.bank-token-btn[data-bank-gem="${gem}"]`);
              global.SplendorPhysics3D.animateChipTransfer(playerPanelEl, bankEl, gem, payAmt);
            }
          }
        }

        // If bought from board, return any strongholds on it and draw replacement
        if (boardLevel !== null && boardIdx !== -1) {
          this._returnStrongholdsOnCard(card);
          const replacement = this.state.decks[boardLevel].shift() || null;
          this.state.boardCards[boardLevel][boardIdx] = replacement;
          if (replacement) {
            this._pendingDealAnim = { level: boardLevel, slotIdx: boardIdx, cardObj: replacement };
            syncAnimFx.dealAnim = { level: boardLevel, slotIdx: boardIdx, cardObj: replacement };
          }
        }

        player.purchasedCards.push(card);
        player.points += card.points || 0;

        // Apply Modern Orient Special Abilities
        let abilityNote = '';
        if (this.state.config.enableOrientAbilities && card.modernAbility) {
          abilityNote = this._applyModernAbility(player, card);
        }

        // Apply Stronghold placement/removal if Modern mode
        if (this.state.config.enableStrongholds && strongholdAction) {
          this._applyStrongholdAction(playerIndex, strongholdAction);
        }

        actionSummary = `${player.name}: [${card.themeTitle}] 구매 (+${card.points}점)${abilityNote}`;
        syncAnimFx.sound = 'card';
        this._playCardFlipSound();
      } else if (actionType === 'PASS') {
        actionSummary = `${player.name}: 턴을 넘겼습니다.`;
      }

      this._lastSyncAnimFx = syncAnimFx;

      if (actionObj.reasonText) {
        this.state.lastActionText = `🤖 [${player.name}] ${actionObj.reasonText}`;
      } else {
        this.state.lastActionText = actionSummary;
      }

      this.gemBasket = [];
      this.recommendedCardId = null;

      // Check if human player exceeds 10 tokens (if AI, AI already calculated returnTokens)
      const totalTokens = this._getPlayerTotalTokens(player);
      if (totalTokens > 10 && !player.isAI) {
        this.renderAll();
        this._openTokenReturnModal(playerIndex);
        return;
      }

      // If AI somehow exceeded 10 tokens, auto-trim excess
      if (totalTokens > 10 && player.isAI) {
        this._autoTrimTokensToLimit(player);
      }

      this._finishTurnAndAdvance();
    }

    _returnStrongholdsOnCard(card) {
      if (!card) return;
      if (
        card.strongholdOwner !== null &&
        card.strongholdOwner !== undefined &&
        card.strongholdCount > 0
      ) {
        const owner = this.state.players[card.strongholdOwner];
        if (owner) {
          owner.strongholdsLeft = Math.min(3, (owner.strongholdsLeft || 0) + card.strongholdCount);
        }
      }
      card.strongholdOwner = null;
      card.strongholdCount = 0;
    }

    _applyModernAbility(player, card) {
      const ab = card.modernAbility;
      if (ab === 'double_bonus') {
        return ' [✨ 쌍보석 보너스 x2 적용!]';
      }
      if (ab === 'steal_token') {
        // Payback 1 gem of the card's bonus color from bank if available
        const g = card.bonusGem;
        if ((this.state.bankTokens[g] || 0) > 0 && this._getPlayerTotalTokens(player) < 10) {
          this.state.bankTokens[g] -= 1;
          player.tokens[g] = (player.tokens[g] || 0) + 1;
          return ` [⚡ 페이백: ${GEM_UI_META[g].kor} 토큰 +1 획득!]`;
        }
      }
      if (ab === 'free_cascade') {
        // Refund up to 2 tokens from bank
        let refunded = 0;
        for (const g of GEM_KEYS) {
          if (refunded >= 2 || this._getPlayerTotalTokens(player) >= 10) break;
          if ((this.state.bankTokens[g] || 0) > 0) {
            this.state.bankTokens[g] -= 1;
            player.tokens[g] = (player.tokens[g] || 0) + 1;
            refunded++;
          }
        }
        if (refunded > 0) return ` [🎁 연쇄 보너스: 보석 ${refunded}개 환급!]`;
      }
      if (ab === 'noble_reserve') {
        player.points += 1;
        return ' [👑 왕실 명성: 추가 +1점 획득!]';
      }
      return '';
    }

    _applyStrongholdAction(playerIndex, shAction) {
      if (!shAction || !shAction.targetCardId) return;
      const player = this.state.players[playerIndex];
      let targetCard = null;
      for (const lv of [1, 2, 3]) {
        const found = (this.state.boardCards[lv] || []).find((c) => c && c.id === shAction.targetCardId);
        if (found) {
          targetCard = found;
          break;
        }
      }
      if (!targetCard) return;

      if (shAction.type === 'REMOVE_OPPONENT' && targetCard.strongholdCount > 0) {
        const opp = this.state.players[targetCard.strongholdOwner];
        if (opp) opp.strongholdsLeft = Math.min(3, (opp.strongholdsLeft || 0) + 1);
        targetCard.strongholdCount -= 1;
        if (targetCard.strongholdCount <= 0) {
          targetCard.strongholdOwner = null;
          targetCard.strongholdCount = 0;
        }
      } else if (shAction.type === 'PLACE' && (player.strongholdsLeft || 0) > 0) {
        if (targetCard.strongholdOwner === null || targetCard.strongholdOwner === playerIndex) {
          targetCard.strongholdOwner = playerIndex;
          targetCard.strongholdCount = (targetCard.strongholdCount || 0) + 1;
          player.strongholdsLeft -= 1;
        }
      }
    }

    _finishTurnAndAdvance() {
      const curIdx = this.state.currentPlayerIndex;
      const player = this.state.players[curIdx];

      // 1. Check Noble Visits at end of turn
      const eligibleNobles = global.SplendorData.getEligibleNobles(
        player,
        this.state.nobles,
        this.state.config.enableOrientAbilities
      );
      if (eligibleNobles.length > 0) {
        const chosenNoble = eligibleNobles[0];
        const nIdx = this.state.nobles.findIndex((n) => n && n.id === chosenNoble.id);
        if (nIdx !== -1) {
          this.state.nobles.splice(nIdx, 1);
          player.nobles.push(chosenNoble);
          player.points += chosenNoble.points || 3;
          if (this._lastSyncAnimFx) this._lastSyncAnimFx.nobleVisited = true;
          this._playNobleFanfare();
          this.showToast(`👑 귀족 [${chosenNoble.korName}]님이 ${player.name}님을 방문했습니다! (+3점)`);
        }
      }

      // 2. Check target points trigger (15 pts)
      const targetPts = this.state.config.targetPoints || 15;
      if (player.points >= targetPts && !this.state.isFinalRound) {
        this.state.isFinalRound = true;
        this.showToast(
          `🔥 ${player.name}님이 ${player.points}점에 도달했습니다! 이번 라운드 마지막 플레이어까지 턴을 진행합니다.`
        );
      }

      // 3. Advance turn
      const nextIdx = (curIdx + 1) % this.state.players.length;
      if (nextIdx === 0) {
        if (this.state.isFinalRound) {
          this._concludeGame();
          return;
        }
        this.state.roundNumber += 1;
      }

      this.state.currentPlayerIndex = nextIdx;

      // Lock privacy shield on turn change in Pass & Play
      if (global.SplendorNet) {
        global.SplendorNet.togglePrivacyShield(false);
      }

      const animFxToBroadcast = this._lastSyncAnimFx || null;
      this._lastSyncAnimFx = null;
      this._broadcastAuthoritativeState(null, animFxToBroadcast);
      this.renderAll();
      this._checkAndScheduleAITurn();
    }

    _concludeGame() {
      this.state.gameOver = true;
      // Determine winner: highest points, tie-breaker: fewest purchased development cards
      const sorted = this.state.players.slice().sort((a, b) => {
        if (b.points !== a.points) return b.points - a.points;
        return a.purchasedCards.length - b.purchasedCards.length;
      });
      const winner = sorted[0];
      this.state.winnerIndex = winner.index;
      this.state.lastActionText = `🏆 최종 승리: ${winner.name} (${winner.points}점, 카드 ${winner.purchasedCards.length}장)!`;
      this._recordGameWinStats(winner.name);

      if (global.SplendorPhysics3D && global.SplendorPhysics3D.SoundFX) {
        global.SplendorPhysics3D.SoundFX.playVictoryFanfare();
      }

      this._broadcastAuthoritativeState(`🏆 ${winner.name}님이 최종 승리했습니다!`);
      this.renderAll();
      this._showVictoryModal(sorted);
    }

    /* ========================================================================
       5. AI TURN SCHEDULING & HINT SYSTEM
       ======================================================================== */
    _checkAndScheduleAITurn() {
      if (!this.state || this.state.gameOver) return;
      // In online client mode, Host runs AI and broadcasts state
      if (global.SplendorNet && global.SplendorNet.mode === 'online_client') return;

      const curIdx = this.state.currentPlayerIndex;
      const curPlayer = this.state.players[curIdx];
      if (!curPlayer || !curPlayer.isAI) return;

      const thinkBox = document.getElementById('aiThinkingText');
      if (thinkBox) {
        thinkBox.textContent = `🤖 ${curPlayer.name} (${curPlayer.difficulty.toUpperCase()}) 최적의 수를 계산 중...`;
      }

      this.aiTimer = setTimeout(() => {
        if (!this.state || this.state.gameOver) return;
        const decision = global.SplendorAI.decideMove(this.state, curIdx, curPlayer.difficulty);
        this.executeAction(decision, curIdx);
      }, 2200);
    }

    showAIHintForCurrentPlayer() {
      if (!this.state || this.state.gameOver) return;
      const curIdx = this.state.currentPlayerIndex;
      const decision = global.SplendorAI.decideMove(this.state, curIdx, 'hard');
      if (!decision) return;

      this.recommendedCardId =
        (decision.payload && decision.payload.cardId) ? decision.payload.cardId : null;

      this.showToast(`💡 AI 힌트: ${decision.reasonText}`);
      const thinkBox = document.getElementById('aiThinkingText');
      if (thinkBox) {
        thinkBox.textContent = `💡 추천 수: ${decision.reasonText}`;
      }
      this.renderAll();
    }

    /* ========================================================================
       6. GEM BASKET & VALIDATION (3 DIFFERENT OR 2 SAME WITH >=4 IN BANK)
       ======================================================================== */
    addGemToBasket(gemKey) {
      if (!this._canLocalUserActNow()) {
        this.showToast('현재 당신의 차례가 아닙니다.');
        return;
      }
      if (gemKey === 'gold') {
        this.showToast('🪙 황금(조커) 토큰은 카드를 [예약]할 때만 1개씩 얻을 수 있습니다!');
        return;
      }

      const bankAvail = (this.state.bankTokens && this.state.bankTokens[gemKey]) || 0;
      const alreadyInBasket = this.gemBasket.filter((g) => g === gemKey).length;

      if (bankAvail <= alreadyInBasket) {
        this.showToast(`${GEM_UI_META[gemKey].kor} 토큰이 은행에 남아있지 않습니다.`);
        return;
      }

      // Check Splendor official token rules
      if (this.gemBasket.length === 0) {
        this.gemBasket.push(gemKey);
      } else if (this.gemBasket.length === 1) {
        const first = this.gemBasket[0];
        if (first === gemKey) {
          // Trying to take 2 of the same color -> requires >= 4 in bank initially
          if (bankAvail < 4) {
            this.showToast(`같은 색 보석 2개를 가져오려면 은행에 최소 4개 이상 남아있어야 합니다! (현재 ${bankAvail}개)`);
            return;
          }
          this.gemBasket.push(gemKey);
        } else {
          this.gemBasket.push(gemKey);
        }
      } else if (this.gemBasket.length === 2) {
        if (this.gemBasket[0] === this.gemBasket[1]) {
          this.showToast('같은 색 보석 2개를 선택했으므로 더 이상 추가할 수 없습니다. (Space로 확정)');
          return;
        }
        if (this.gemBasket.includes(gemKey)) {
          this.showToast('서로 다른 보석 3개를 가져올 때는 같은 색을 중복 선택할 수 없습니다.');
          return;
        }
        this.gemBasket.push(gemKey);
      } else {
        this.showToast('보석 장바구니가 가득 찼습니다 (최대 3개). [획득 확정]을 누르세요.');
        return;
      }

      this._playChipSound(this.gemBasket.length);
      this.renderGemBankAndBasket();
    }

    removeGemFromBasket(index) {
      if (index >= 0 && index < this.gemBasket.length) {
        this.gemBasket.splice(index, 1);
        this.renderGemBankAndBasket();
      }
    }

    clearGemBasket() {
      this.gemBasket = [];
      this.renderGemBankAndBasket();
    }

    confirmGemBasket() {
      if (!this._canLocalUserActNow()) return;
      if (this.gemBasket.length === 0) return;

      const tokensObj = { emerald: 0, sapphire: 0, ruby: 0, diamond: 0, onyx: 0 };
      this.gemBasket.forEach((g) => {
        tokensObj[g] = (tokensObj[g] || 0) + 1;
      });

      this.dispatchPlayerAction({
        actionType: 'TAKE_TOKENS',
        payload: { tokens: tokensObj }
      });
    }

    /* ========================================================================
       7. UI RENDERING (NOBLES, 3 TIERS OF CARDS, GEM BANK, PLAYERS SIDEBAR)
       ======================================================================== */
    renderAll() {
      if (!this.state) return;

      // Update Top Header Rule Pill & Status Banner
      const ruleBadge = document.getElementById('activeRuleBadge');
      if (ruleBadge) {
        const isModern = this.state.config.modeId === 'modern';
        ruleBadge.textContent = isModern
          ? '🏯 최신 확장 룰 (성채 + 동양 특수능력)'
          : '🏛️ 전통 룰 (Classic 15점)';
        ruleBadge.classList.toggle('modern', isModern);
      }

      const curPlayer = this.state.players[this.state.currentPlayerIndex];
      const turnBanner = document.getElementById('currentTurnBanner');
      const roundBadge = document.getElementById('turnNumberBadge');
      if (turnBanner && curPlayer) {
        turnBanner.textContent = this.state.gameOver
          ? '🏁 게임 종료'
          : `현재 턴: P${curPlayer.index + 1} ${curPlayer.name} ${curPlayer.isAI ? '(AI)' : '(사람)'}`;
      }
      if (roundBadge) {
        roundBadge.textContent = `(라운드 ${this.state.roundNumber}${this.state.isFinalRound ? ' · 최종 라운드!' : ''})`;
      }

      const thinkText = document.getElementById('aiThinkingText');
      if (thinkText && this.state.lastActionText) {
        thinkText.textContent = this.state.lastActionText;
      }

      this.renderNobles();
      this.renderCardsBoard();
      this.renderGemBankAndBasket();
      this.renderPlayersSidebar();

      if (this._pendingDealAnim && global.SplendorPhysics3D) {
        const { level, slotIdx, cardObj } = this._pendingDealAnim;
        this._pendingDealAnim = null;
        const deckEl = document.querySelector(`.deck-stack-3d[data-tier="${level}"]`);
        const slotEl = document.querySelector(`.dev-card[data-level="${level}"][data-slot-idx="${slotIdx}"]`);
        if (deckEl && slotEl) {
          global.SplendorPhysics3D.animateCardFlipAndMove(deckEl, slotEl, cardObj);
        }
      }
    }

    renderNobles() {
      const container = document.getElementById('noblesContainer');
      if (!container || !this.state) return;
      container.innerHTML = '';

      const curPlayer = this.state.players[this.state.currentPlayerIndex];
      const bonuses = global.SplendorData.getPlayerBonuses(
        curPlayer,
        this.state.config.enableOrientAbilities
      );

      this.state.nobles.forEach((noble) => {
        const wrap = document.createElement('div');
        wrap.className = 'noble-item-wrap';
        wrap.title = `${noble.korName} (${noble.title}) - 클릭하여 요구 보석 카드 하이라이트`;

        const tile = document.createElement('div');
        tile.className = 'noble-tile';
        tile.dataset.nobleId = noble.id;
        if (noble.imageUrl) {
          tile.style.backgroundImage = `url('${noble.imageUrl}')`;
        }
        if (this.highlightedNobleId === noble.id) {
          tile.classList.add('highlighted');
        }

        const reqHtml = GEM_KEYS.filter((g) => (noble.requirements[g] || 0) > 0)
          .map((g) => {
            const reqCount = noble.requirements[g];
            const haveBonus = (bonuses[g] || 0) >= reqCount;
            if (!haveBonus) return '';
            return `<div class="noble-req-badge ${GEM_UI_META[g].swatch}" style="outline:2px solid #fde047; transform:scale(0.85);" title="${GEM_UI_META[g].kor} 조건 충족!">✓</div>`;
          })
          .join('');

        tile.innerHTML = `<div class="noble-reqs">${reqHtml}</div>`;

        const nameBadge = document.createElement('div');
        nameBadge.className = 'noble-external-name';
        nameBadge.textContent = noble.korName;

        wrap.appendChild(tile);
        wrap.appendChild(nameBadge);

        wrap.addEventListener('click', () => {
          this.highlightedNobleId = this.highlightedNobleId === noble.id ? null : noble.id;
          this.showToast(
            `👑 [${noble.korName}] (${noble.title}): "${noble.quote}"`
          );
          this.renderNobles();
          this.renderCardsBoard();
        });

        container.appendChild(wrap);
      });
    }

    renderCardsBoard() {
      if (!this.state) return;
      const curPlayer = this.state.players[this.state.currentPlayerIndex];
      const enableOrient = this.state.config.enableOrientAbilities;
      const enableStrongholds = this.state.config.enableStrongholds;

      // Highlighted noble required gems
      let nobleTargetGems = null;
      if (this.highlightedNobleId) {
        const n = this.state.nobles.find((x) => x.id === this.highlightedNobleId);
        if (n) nobleTargetGems = n.requirements;
      }

      for (const level of [3, 2, 1]) {
        const rowEl = document.getElementById(`tierRow${level}`);
        if (!rowEl) continue;
        rowEl.innerHTML = '';

        // 1. Deck Stack (Leftmost cell)
        const deckCount = (this.state.decks[level] || []).length;
        const deckEl = document.createElement('div');
        deckEl.className = `deck-stack-3d tier-${level}`;
        deckEl.dataset.tier = String(level);
        const dots = '●'.repeat(level);
        deckEl.innerHTML = `
          <div class="deck-level-dots">LV.${level} ${dots}</div>
          <div class="deck-title">LEVEL ${level}</div>
          <div class="deck-count-badge">${deckCount}장 남음</div>
          <div class="deck-reserve-hint">${deckCount > 0 ? '클릭: 즉시 예약(+조커)' : '소진됨'}</div>
        `;

        deckEl.addEventListener('click', () => {
          if (!this._canLocalUserActNow()) {
            this.showToast('현재 당신의 차례가 아닙니다.');
            return;
          }
          if (deckCount <= 0) {
            this.showToast(`레벨 ${level} 덱에 남은 카드가 없습니다.`);
            return;
          }
          if (curPlayer.reservedCards.length >= 3) {
            this.showToast('예약 카드는 최대 3장까지만 보유할 수 있습니다.');
            return;
          }
          this.dispatchPlayerAction({
            actionType: 'RESERVE_CARD',
            payload: { cardId: null, level }
          });
        });

        rowEl.appendChild(deckEl);

        // 2. 4 Open Face-Up Cards
        const cards = this.state.boardCards[level] || [];
        for (let i = 0; i < 4; i++) {
          const card = cards[i];
          if (!card) {
            const emptySlot = document.createElement('div');
            emptySlot.className = 'dev-card';
            emptySlot.dataset.level = String(level);
            emptySlot.dataset.slotIdx = String(i);
            emptySlot.style.opacity = '0.25';
            emptySlot.style.cursor = 'default';
            emptySlot.innerHTML = `<div style="margin:auto; font-size:0.75rem; color:#9ca3af;">빈 슬롯</div>`;
            rowEl.appendChild(emptySlot);
            continue;
          }

          const cardEl = this._createDevCardElement(
            card,
            curPlayer,
            enableOrient,
            enableStrongholds,
            nobleTargetGems,
            'board',
            i
          );
          rowEl.appendChild(cardEl);
        }
      }
    }

    _getAutoStrongholdActionForHuman(playerIndex, boughtCardId) {
      if (!this.state || !this.state.config.enableStrongholds) return null;
      const player = this.state.players[playerIndex];
      if (!player) return null;

      // Priority 1: Remove opponent stronghold if any on board
      for (const lv of [3, 2, 1]) {
        for (const c of this.state.boardCards[lv] || []) {
          if (
            c &&
            c.id !== boughtCardId &&
            c.strongholdOwner !== null &&
            c.strongholdOwner !== undefined &&
            c.strongholdOwner !== playerIndex &&
            c.strongholdCount > 0
          ) {
            return { type: 'REMOVE_OPPONENT', targetCardId: c.id };
          }
        }
      }
      // Priority 2: Place own stronghold on highest-point open card
      if ((player.strongholdsLeft || 0) > 0) {
        for (const lv of [3, 2, 1]) {
          for (const c of this.state.boardCards[lv] || []) {
            if (
              c &&
              c.id !== boughtCardId &&
              (c.strongholdOwner === null || c.strongholdOwner === undefined || c.strongholdOwner === playerIndex)
            ) {
              return { type: 'PLACE', targetCardId: c.id };
            }
          }
        }
      }
      return null;
    }

    _createDevCardElement(card, curPlayer, enableOrient, enableStrongholds, nobleTargetGems, source = 'board', slotIdx = -1) {
      const meta = GEM_UI_META[card.bonusGem] || GEM_UI_META.diamond;
      const evalRes = global.SplendorData.evaluateCardPurchase(curPlayer, card, enableOrient);

      const cardEl = document.createElement('div');
      cardEl.className = `dev-card ${meta.cardTheme}`;
      cardEl.dataset.cardId = card.id;
      cardEl.dataset.level = String(card.level);
      if (slotIdx >= 0) cardEl.dataset.slotIdx = String(slotIdx);

      if (card.imageUrl) {
        cardEl.style.backgroundImage = `url('${card.imageUrl}')`;
      }

      if (evalRes.canAfford && !curPlayer.isAI) {
        cardEl.classList.add('affordable');
      }
      if (this.recommendedCardId === card.id) {
        cardEl.classList.add('hint-recommended');
      }
      if (nobleTargetGems && (nobleTargetGems[card.bonusGem] || 0) > 0) {
        cardEl.style.outline = '2px solid #fde047';
      }

      // Modern ability pill (only displayed when Modern Rules are enabled)
      let abilityHtml = '';
      if (enableOrient && card.modernAbility && MODERN_ABILITY_LABELS[card.modernAbility]) {
        abilityHtml = `<div class="card-ability-pill" style="background:rgba(15,23,42,0.86);">${MODERN_ABILITY_LABELS[card.modernAbility]}</div>`;
      }

      // Stronghold tower badge
      let strongholdHtml = '';
      if (
        enableStrongholds &&
        card.strongholdOwner !== null &&
        card.strongholdOwner !== undefined &&
        card.strongholdCount > 0
      ) {
        const ownerP = this.state.players[card.strongholdOwner];
        strongholdHtml = `<div class="card-stronghold-marker" title="${ownerP ? ownerP.name : ''}의 성채 ${card.strongholdCount}개 배치됨">
          🏯 P${card.strongholdOwner + 1} x${card.strongholdCount}
        </div>`;
      }

      // Center Buy Button (no separate purchase modal)
      const centerBuyBtnHtml = evalRes.canAfford
        ? `<button type="button" class="card-inline-buy-btn" data-inline-buy="1" title="클릭하여 즉시 카드 구매 (${
            evalRes.goldNeeded > 0 ? `조커 ${evalRes.goldNeeded}개 사용` : '보석 지불'
          })">🛒 구매</button>`
        : `<button type="button" class="card-inline-buy-btn unaffordable" data-inline-buy="1" title="보석 ${evalRes.missingTokens}개 부족 (우측 하단 예약 버튼으로 조커 획득 가능)">부족 ${evalRes.missingTokens}</button>`;

      // Bottom-Right Compact Reserve Button (+Joker)
      const canReserve = source === 'board' && (curPlayer.reservedCards || []).length < 3;
      const reserveBtnHtml =
        source === 'board'
          ? `<button type="button" class="card-inline-reserve-btn" data-inline-reserve="1" ${
              !canReserve ? 'disabled' : ''
            } title="카드 예약하기 (+황금 조커 토큰 1개 획득)">📌예약</button>`
          : '';

      cardEl.innerHTML = `
        <div style="display:flex; justify-content:flex-end; align-items:flex-start; min-height:18px;">
          ${abilityHtml}
        </div>
        ${strongholdHtml}
        ${centerBuyBtnHtml}
        <div class="card-bottom-area">
          ${reserveBtnHtml}
        </div>
      `;

      const buyBtn = cardEl.querySelector('[data-inline-buy]');
      if (buyBtn) {
        buyBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          if (!this._canLocalUserActNow()) {
            this.showToast('현재 당신의 차례가 아닙니다.');
            return;
          }
          if (!evalRes.canAfford) {
            this.showToast(`보석 토큰이 ${evalRes.missingTokens}개 부족합니다. 우측 하단 [📌예약(+조커)] 버튼을 눌러 예약할 수 있습니다.`);
            return;
          }
          const shAction = enableStrongholds
            ? this._getAutoStrongholdActionForHuman(this.state.currentPlayerIndex, card.id)
            : null;
          this.dispatchPlayerAction({
            actionType: 'BUY_CARD',
            payload: {
              cardId: card.id,
              source,
              payment: evalRes.payment,
              strongholdAction: shAction
            }
          });
        });
      }

      const reserveBtn = cardEl.querySelector('[data-inline-reserve]');
      if (reserveBtn) {
        reserveBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          if (!this._canLocalUserActNow()) {
            this.showToast('현재 당신의 차례가 아닙니다.');
            return;
          }
          if ((curPlayer.reservedCards || []).length >= 3) {
            this.showToast('예약 카드는 최대 3장까지만 보유할 수 있습니다.');
            return;
          }
          this.dispatchPlayerAction({
            actionType: 'RESERVE_CARD',
            payload: {
              cardId: card.id,
              level: card.level
            }
          });
        });
      }

      // Clicking the card body directly also buys if affordable, or informs user
      cardEl.addEventListener('click', () => {
        if (!this._canLocalUserActNow()) {
          this.showToast('현재 당신의 차례가 아닙니다.');
          return;
        }
        if (evalRes.canAfford) {
          const shAction = enableStrongholds
            ? this._getAutoStrongholdActionForHuman(this.state.currentPlayerIndex, card.id)
            : null;
          this.dispatchPlayerAction({
            actionType: 'BUY_CARD',
            payload: {
              cardId: card.id,
              source,
              payment: evalRes.payment,
              strongholdAction: shAction
            }
          });
        } else {
          this.showToast(
            `구매에 보석 ${evalRes.missingTokens}개가 부족합니다. 카드 우측 하단 [📌예약(+조커)] 버튼으로 예약할 수 있습니다!`
          );
        }
      });

      return cardEl;
    }

    renderGemBankAndBasket() {
      const bankContainer = document.getElementById('bankTokensContainer');
      const basketContainer = document.getElementById('basketSlotsContainer');
      const btnConfirm = document.getElementById('btnConfirmGems');
      if (!bankContainer || !this.state) return;

      bankContainer.innerHTML = '';

      ALL_TOKEN_KEYS.forEach((gemKey) => {
        const meta = GEM_UI_META[gemKey];
        const inBank = this.state.bankTokens[gemKey] || 0;
        const inBasket = this.gemBasket.filter((g) => g === gemKey).length;
        const remainDisplay = Math.max(0, inBank - inBasket);

        const btn = document.createElement('div');
        btn.className = `bank-token-btn ${remainDisplay <= 0 || gemKey === 'gold' ? 'disabled' : ''}`;
        btn.dataset.bankGem = gemKey;
        btn.innerHTML = `
          <div class="token-3d-chip ${meta.swatch}" style="background-image:url('${meta.chipImg}'), radial-gradient(circle at 30% 30%, rgba(255,255,255,0.35), rgba(0,0,0,0.45));"></div>
          <div class="token-info-col">
            <span class="token-kor-name">${meta.kor}</span>
            <span class="token-hotkey-hint">${
              gemKey === 'gold' ? '예약 시 획득' : `단축키 [${meta.keyNum}]`
            }</span>
          </div>
          <span class="token-count-pill">${remainDisplay}</span>
        `;

        btn.addEventListener('click', () => {
          this.addGemToBasket(gemKey);
        });

        bankContainer.appendChild(btn);
      });

      // Render Basket
      if (basketContainer) {
        basketContainer.innerHTML = '';
        if (this.gemBasket.length === 0) {
          basketContainer.innerHTML = `<span style="font-size:0.72rem; color:#9ca3af;">보석을 클릭하여 담으세요 (클릭 시 취소)</span>`;
        } else {
          this.gemBasket.forEach((gKey, idx) => {
            const meta = GEM_UI_META[gKey];
            const chip = document.createElement('div');
            chip.className = `token-3d-chip ${meta.swatch}`;
            chip.style.cursor = 'pointer';
            chip.style.backgroundImage = `url('${meta.chipImg}'), radial-gradient(circle at 30% 30%, rgba(255,255,255,0.35), rgba(0,0,0,0.45))`;
            chip.title = '클릭하여 장바구니에서 제거';
            chip.addEventListener('click', () => this.removeGemFromBasket(idx));
            basketContainer.appendChild(chip);
          });
        }
      }

      if (btnConfirm) {
        btnConfirm.disabled = this.gemBasket.length === 0 || !this._canLocalUserActNow();
      }
    }

    renderPlayersSidebar() {
      const container = document.getElementById('playersSidebarContainer');
      if (!container || !this.state) return;
      container.innerHTML = '';

      // Top Win-Rate Header Bar + Reset Button
      const statsBar = document.createElement('div');
      statsBar.className = 'sidebar-stats-bar';
      statsBar.innerHTML = `
        <span>📊 게이머별 누적 승률</span>
        <button type="button" class="winrate-reset-btn" id="btnResetWinStats" title="모든 게이머의 승률 및 전적 초기화">🔄 승률 리셋</button>
      `;
      const resetBtn = statsBar.querySelector('#btnResetWinStats');
      if (resetBtn) {
        resetBtn.addEventListener('click', () => {
          this.resetWinStats();
        });
      }
      container.appendChild(statsBar);

      const enableOrient = this.state.config.enableOrientAbilities;
      const enableStrongholds = this.state.config.enableStrongholds;

      this.state.players.forEach((p, idx) => {
        const isCurrent = idx === this.state.currentPlayerIndex && !this.state.gameOver;
        const bonuses = global.SplendorData.getPlayerBonuses(p, enableOrient);
        const totalTokens = this._getPlayerTotalTokens(p);
        const winRateText = this._getPlayerWinRateLabel(p.name);

        const panel = document.createElement('div');
        panel.className = `player-card-panel ${isCurrent ? 'active-turn' : ''}`;
        panel.dataset.playerIdx = String(idx);

        // Resource cells (5 gems + gold) with high-visibility color themes & Korean labels
        const resCellsHtml = ALL_TOKEN_KEYS.map((gKey) => {
          const meta = GEM_UI_META[gKey];
          const tCount = p.tokens[gKey] || 0;
          const bCount = gKey === 'gold' ? 0 : bonuses[gKey] || 0;
          return `
            <div class="p-res-cell gem-col-${gKey}" data-player-gem="${gKey}" title="${meta.kor}: 보유 토큰 ${tCount}개 / 영구 보너스 카드 +${bCount}장">
              <span style="font-size:0.65rem; font-weight:900; color:#f9fafb; text-shadow:0 1px 2px #000;">${meta.short}</span>
              <span class="p-res-dot ${meta.swatch}" style="background-image:url('${meta.chipImg}'); background-size:cover; background-position:center;"></span>
              <span class="p-res-nums" title="보유 토큰 ${tCount}개">🪙${tCount}</span>
              <span class="p-res-bonus" title="${gKey === 'gold' ? '황금 조커 토큰' : `구매한 ${meta.kor} 카드 보너스 +${bCount}`}">${gKey === 'gold' ? '조커' : `🃏+${bCount}`}</span>
            </div>
          `;
        }).join('');

        // Reserved cards visibility check (Pass & Play privacy shield or Online P2P)
        const canSeeFront = global.SplendorNet
          ? global.SplendorNet.canViewReservedCardFront(idx, this.state.currentPlayerIndex, this.state.players)
          : true;

        const reservedSlotsHtml = [0, 1, 2]
          .map((slotIdx) => {
            const rCard = p.reservedCards[slotIdx];
            if (!rCard) {
              return `<div class="mini-reserved-slot"><span>빈 예약슬롯</span></div>`;
            }
            const backImg = rCard.backImageUrl || (rCard.level === 3 ? 'assets/cards/blue-00.jpg' : rCard.level === 2 ? 'assets/cards/yellow-00.jpg' : 'assets/cards/green-00.jpg');
            if (!canSeeFront) {
              return `<div class="mini-reserved-slot filled" data-rslot="${slotIdx}" style="background:linear-gradient(90deg, rgba(15,23,42,0.82), rgba(15,23,42,0.55)), url('${backImg}') center/cover no-repeat;">
                <span style="text-shadow:0 1px 3px #000; font-weight:700;">🔒 L${rCard.level} 예약됨</span>
                <span style="color:#fde047; text-shadow:0 1px 3px #000;">비공개</span>
              </div>`;
            }
            const meta = GEM_UI_META[rCard.bonusGem];
            const frontImg = rCard.imageUrl || backImg;
            const evalReserved = global.SplendorData.evaluateCardPurchase(p, rCard, enableOrient);
            const buyBadge = evalReserved.canAfford
              ? `<span style="color:#ffffff; background:#059669; padding:2px 6px; border-radius:999px; font-size:0.65rem; font-weight:900;">🛒구매</span>`
              : `<span style="color:#fca5a5; background:rgba(0,0,0,0.65); padding:1px 5px; border-radius:4px; font-size:0.62rem; font-weight:800;">부족${evalReserved.missingTokens}</span>`;
            return `<div class="mini-reserved-slot filled gem-col-${rCard.bonusGem}" data-rslot="${slotIdx}" data-reserved-card-id="${rCard.id}" style="background:linear-gradient(90deg, rgba(15,23,42,0.72), rgba(15,23,42,0.35)), url('${frontImg}') center/cover no-repeat; border-width:2px;" title="클릭하여 예약 카드 즉시 구매 (${meta.kor} 보너스 · +${rCard.points}점)">
              <span style="text-shadow:0 1px 4px #000; font-weight:900;">${meta.icon}${meta.short} L${rCard.level} (${rCard.points}점)</span>
              ${buyBadge}
            </div>`;
          })
          .join('');

        // Privacy toggle button for Pass & Play when multiple humans play on 1 device
        const humanCount = this.state.players.filter((x) => !x.isAI).length;
        const showPrivacyBtn =
          !p.isAI &&
          humanCount > 1 &&
          isCurrent &&
          (!global.SplendorNet || global.SplendorNet.mode === 'local') &&
          p.reservedCards.length > 0;

        panel.innerHTML = `
          <div class="p-header">
            <div class="p-name-wrap">
              <span class="p-name-text" title="P${idx + 1}. ${p.name}">${isCurrent ? '▶ ' : ''}P${idx + 1}. ${p.name}</span>
              <span class="p-role-tag">${p.isAI ? `AI(${p.difficulty.toUpperCase()})` : '사람'}</span>
            </div>
            <span class="p-score-badge">🏆 ${p.points} / ${this.state.config.targetPoints}점</span>
          </div>

          <div class="p-resources-grid">${resCellsHtml}</div>

          <div class="p-meta-bar">
            <span class="p-winrate-pill" title="${p.name} 누적 승률">${winRateText}</span>
            <span>🪙토큰: <strong>${totalTokens}/10</strong></span>
            <span>🃏카드: <strong>${p.purchasedCards.length}장</strong></span>
            <span>👑귀족: <strong>${p.nobles.length}명</strong></span>
            ${enableStrongholds ? `<span>🏯성채: <strong>${p.strongholdsLeft}</strong></span>` : ''}
          </div>

          <div style="display:flex; justify-content:space-between; align-items:center;">
            <span style="font-size:0.7rem; color:#d1d5db;">📌 예약 카드 (${p.reservedCards.length}/3) · 클릭 시 즉시 구매</span>
            ${
              showPrivacyBtn
                ? `<button class="privacy-btn" data-toggle-privacy="1">${
                    canSeeFront ? '🙈 예약 카드 가리기' : '👁️ 본인 확인 (앞면 보기)'
                  }</button>`
                : ''
            }
          </div>
          <div class="p-reserved-row">${reservedSlotsHtml}</div>
        `;

        // Bind privacy toggle button
        const privBtn = panel.querySelector('[data-toggle-privacy]');
        if (privBtn) {
          privBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            if (global.SplendorNet) {
              global.SplendorNet.togglePrivacyShield();
              this.renderPlayersSidebar();
            }
          });
        }

        // Bind click on reserved card slots (Direct Purchase without modal)
        panel.querySelectorAll('[data-rslot]').forEach((slotEl) => {
          slotEl.addEventListener('click', () => {
            const sIdx = Number(slotEl.dataset.rslot);
            const rCard = p.reservedCards[sIdx];
            if (!rCard) return;
            if (idx !== this.state.currentPlayerIndex || !this._canLocalUserActNow()) {
              this.showToast('본인의 턴에만 예약한 카드를 구매할 수 있습니다.');
              return;
            }
            if (!canSeeFront && global.SplendorNet) {
              global.SplendorNet.togglePrivacyShield(true);
              this.renderPlayersSidebar();
              return;
            }
            const evalRes = global.SplendorData.evaluateCardPurchase(p, rCard, enableOrient);
            if (!evalRes.canAfford) {
              this.showToast(`예약한 카드를 구매하기에 보석 토큰이 ${evalRes.missingTokens}개 부족합니다.`);
              return;
            }
            const shAction = enableStrongholds
              ? this._getAutoStrongholdActionForHuman(this.state.currentPlayerIndex, rCard.id)
              : null;
            this.dispatchPlayerAction({
              actionType: 'BUY_CARD',
              payload: {
                cardId: rCard.id,
                source: 'reserved',
                payment: evalRes.payment,
                strongholdAction: shAction
              }
            });
          });
        });

        container.appendChild(panel);
      });
    }

    /* ========================================================================
       8. INTERACTIVE MODALS (CARD BUY/RESERVE, DECK RESERVE, >10 TOKEN RETURN, RULES)
       ======================================================================== */
    _openCardActionModal(card, source = 'board') {
      const backdrop = document.getElementById('cardActionModalBackdrop');
      const titleEl = document.getElementById('cardModalTitle');
      const bodyEl = document.getElementById('cardModalBody');
      if (!backdrop || !bodyEl || !this.state) return;

      const curIdx = this.state.currentPlayerIndex;
      const player = this.state.players[curIdx];
      const enableOrient = this.state.config.enableOrientAbilities;
      const enableStrongholds = this.state.config.enableStrongholds;

      const evalRes = global.SplendorData.evaluateCardPurchase(player, card, enableOrient);
      const meta = GEM_UI_META[card.bonusGem];

      if (titleEl) {
        titleEl.textContent = `${meta.icon} [${card.themeTitle}] (레벨 ${card.level} · +${card.points}점)`;
      }

      const costDesc = GEM_KEYS.filter((g) => (card.cost[g] || 0) > 0)
        .map((g) => `${GEM_UI_META[g].kor} ${card.cost[g]}개`)
        .join(', ');

      // Stronghold target selection if Modern mode is active
      let strongholdSelectHtml = '';
      if (enableStrongholds && evalRes.canAfford) {
        const allBoard = [];
        for (const lv of [3, 2, 1]) {
          (this.state.boardCards[lv] || []).forEach((c) => {
            if (c && c.id !== card.id) allBoard.push(c);
          });
        }
        const optionsHtml = allBoard
          .map((c) => {
            const hasOpp =
              c.strongholdOwner !== null &&
              c.strongholdOwner !== undefined &&
              c.strongholdOwner !== curIdx &&
              c.strongholdCount > 0;
            const actionLabel = hasOpp
              ? `[상대 성채 제거] L${c.level} ${c.themeTitle}`
              : `[내 성채 배치] L${c.level} ${c.themeTitle} (현재 ${c.strongholdCount || 0}개)`;
            return `<option value="${hasOpp ? 'REMOVE_OPPONENT' : 'PLACE'}::${c.id}">${actionLabel}</option>`;
          })
          .join('');

        strongholdSelectHtml = `
          <div style="background:rgba(245,197,66,0.1); padding:8px; border-radius:8px; border:1px solid rgba(245,197,66,0.3);">
            <label style="font-size:0.78rem; color:#fde047; font-weight:700; display:block; margin-bottom:4px;">
              🏯 성채(Stronghold) 배치 또는 상대 성채 제거 선택:
            </label>
            <select id="modalStrongholdSelect" style="width:100%; padding:6px; background:#111827; color:#fff; border:1px solid #4b5563; border-radius:6px;">
              <option value="">성채 이동 안 함</option>
              ${optionsHtml}
            </select>
          </div>
        `;
      }

      const frontPreviewUrl = card.imageUrl || 'assets/cards/green-01.jpg';
      const backPreviewUrl = card.backImageUrl || (card.level === 3 ? 'assets/cards/blue-00.jpg' : card.level === 2 ? 'assets/cards/yellow-00.jpg' : 'assets/cards/green-00.jpg');

      bodyEl.innerHTML = `
        <div style="display:flex; gap:14px; align-items:center; flex-wrap:wrap;">
          <div style="display:flex; gap:8px; align-items:center;">
            <div style="width:118px; height:164px; border-radius:10px; border:2.5px solid #f3f4f6; background:url('${frontPreviewUrl}') center/cover no-repeat; box-shadow:0 10px 22px rgba(0,0,0,0.75);" title="카드 앞면"></div>
            <div style="width:74px; height:104px; border-radius:8px; border:2px solid #cbd5e1; background:url('${backPreviewUrl}') center/cover no-repeat; box-shadow:0 6px 14px rgba(0,0,0,0.65); opacity:0.9;" title="카드 뒷면 (레벨 ${card.level})"></div>
          </div>
          <div style="flex:1; min-width:200px; font-size:0.84rem; color:#d1d5db; line-height:1.55;">
            <div>• <strong>제공 보너스:</strong> ${meta.kor} 영구 할인 ${
              enableOrient && card.modernAbility === 'double_bonus' ? '+2개 (쌍보석)' : '+1개'
            }</div>
            <div>• <strong>명성 점수:</strong> +${card.points}점</div>
            <div>• <strong>원래 비용:</strong> ${costDesc}</div>
            <div>• <strong>할인 적용 후 지불 여부:</strong> ${
              evalRes.canAfford
                ? `<span style="color:#34d399; font-weight:800;">즉시 구매 가능! (황금 조커 ${evalRes.goldNeeded}개 사용)</span>`
                : `<span style="color:#f87171; font-weight:800;">보석 ${evalRes.missingTokens}개 부족</span>`
            }</div>
          </div>
        </div>
        ${strongholdSelectHtml}
        <div style="display:flex; gap:10px; margin-top:8px;">
          <button class="hdr-btn primary" id="modalBtnBuyCard" style="flex:1; justify-content:center; padding:10px;" ${
            !evalRes.canAfford ? 'disabled style="opacity:0.4; cursor:not-allowed; flex:1; justify-content:center; padding:10px;"' : ''
          }>
            🛒 카드 구매하기
          </button>
          ${
            source === 'board'
              ? `<button class="hdr-btn" id="modalBtnReserveCard" style="flex:1; justify-content:center; padding:10px;" ${
                  player.reservedCards.length >= 3 ? 'disabled' : ''
                }>
                  📌 카드 예약하기 (+황금 1개)
                </button>`
              : ''
          }
        </div>
      `;

      backdrop.classList.remove('hidden');

      const btnBuy = document.getElementById('modalBtnBuyCard');
      if (btnBuy && evalRes.canAfford) {
        btnBuy.addEventListener('click', () => {
          let shAction = null;
          const shSelect = document.getElementById('modalStrongholdSelect');
          if (shSelect && shSelect.value) {
            const [type, targetCardId] = shSelect.value.split('::');
            shAction = { type, targetCardId };
          }
          backdrop.classList.add('hidden');
          this.dispatchPlayerAction({
            actionType: 'BUY_CARD',
            payload: {
              cardId: card.id,
              source,
              payment: evalRes.payment,
              strongholdAction: shAction
            }
          });
        });
      }

      const btnReserve = document.getElementById('modalBtnReserveCard');
      if (btnReserve && source === 'board') {
        btnReserve.addEventListener('click', () => {
          backdrop.classList.add('hidden');
          this.dispatchPlayerAction({
            actionType: 'RESERVE_CARD',
            payload: {
              cardId: card.id,
              level: card.level
            }
          });
        });
      }
    }

    _openDeckReserveModal(level, deckCount) {
      const backdrop = document.getElementById('cardActionModalBackdrop');
      const titleEl = document.getElementById('cardModalTitle');
      const bodyEl = document.getElementById('cardModalBody');
      if (!backdrop || !bodyEl || !this.state) return;

      const player = this.state.players[this.state.currentPlayerIndex];
      if (titleEl) {
        titleEl.textContent = `🎴 레벨 ${level} 덱 맨 위 카드 비공개 예약`;
      }
      const deckBackImg = level === 3 ? 'assets/cards/blue-00.jpg' : level === 2 ? 'assets/cards/yellow-00.jpg' : 'assets/cards/green-00.jpg';

      bodyEl.innerHTML = `
        <div style="display:flex; gap:14px; align-items:center;">
          <div style="width:105px; height:146px; border-radius:10px; border:2.5px solid #f3f4f6; background:url('${deckBackImg}') center/cover no-repeat; box-shadow:-3px 3px 0 #e5e7eb, -6px 6px 0 #9ca3af, 0 10px 22px rgba(0,0,0,0.75);"></div>
          <div style="flex:1; font-size:0.84rem; color:#d1d5db; line-height:1.5;">
            레벨 ${level} 카드 더미(남은 카드 ${deckCount}장)의 맨 위 카드를 상대방에게 공개하지 않고 내 예약 슬롯으로 가져옵니다.<br/>
            은행에 황금(조커) 토큰이 남아있다면 함께 <strong>황금 토큰 1개</strong>를 획득합니다.
          </div>
        </div>
        <div style="display:flex; justify-content:flex-end; gap:10px; margin-top:8px;">
          <button class="hdr-btn primary" id="modalBtnConfirmDeckReserve" ${
            player.reservedCards.length >= 3 ? 'disabled' : ''
          }>
            📌 레벨 ${level} 덱에서 비공개 예약하기
          </button>
        </div>
      `;

      backdrop.classList.remove('hidden');

      const btn = document.getElementById('modalBtnConfirmDeckReserve');
      if (btn) {
        btn.addEventListener('click', () => {
          backdrop.classList.add('hidden');
          this.dispatchPlayerAction({
            actionType: 'RESERVE_CARD',
            payload: {
              cardId: null,
              level
            }
          });
        });
      }
    }

    _openTokenReturnModal(playerIndex) {
      const backdrop = document.getElementById('tokenReturnModalBackdrop');
      const bodyEl = document.getElementById('tokenReturnBody');
      if (!backdrop || !bodyEl || !this.state) return;

      const player = this.state.players[playerIndex];
      const renderReturnContent = () => {
        const total = this._getPlayerTotalTokens(player);
        const excess = total - 10;
        if (excess <= 0) {
          backdrop.classList.add('hidden');
          this._finishTurnAndAdvance();
          return;
        }

        const buttonsHtml = ALL_TOKEN_KEYS.filter((g) => (player.tokens[g] || 0) > 0)
          .map((g) => {
            const meta = GEM_UI_META[g];
            return `<button class="hdr-btn" data-ret-gem="${g}" style="padding:8px 12px;">
              ${meta.icon} ${meta.kor} 반납 (보유: ${player.tokens[g]})
            </button>`;
          })
          .join('');

        bodyEl.innerHTML = `
          <div style="font-weight:800; color:#fde047;">
            현재 보유 토큰: ${total}개 (추가로 ${excess}개 더 반납해야 합니다)
          </div>
          <div style="display:flex; flex-wrap:wrap; gap:8px;">${buttonsHtml}</div>
        `;

        bodyEl.querySelectorAll('[data-ret-gem]').forEach((btn) => {
          btn.addEventListener('click', () => {
            const g = btn.dataset.retGem;
            if ((player.tokens[g] || 0) > 0) {
              player.tokens[g] -= 1;
              this.state.bankTokens[g] += 1;
              this._playChipSound();
              this.renderAll();
              renderReturnContent();
            }
          });
        });
      };

      backdrop.classList.remove('hidden');
      renderReturnContent();
    }

    _showRulebookModal() {
      const backdrop = document.getElementById('infoModalBackdrop');
      const titleEl = document.getElementById('infoModalTitle');
      const bodyEl = document.getElementById('infoModalBody');
      if (!backdrop || !bodyEl) return;

      if (titleEl) titleEl.textContent = '📖 스플렌더 3D: 전통 룰 & 최신 확장 룰 완벽 가이드';
      bodyEl.innerHTML = `
        <h3 style="color:#fde047; margin-top:0;">🏛️ 1. 전통 룰 (Classic Rules - 오리지널 15점)</h3>
        <ul>
          <li><strong>내 턴의 4가지 행동 중 택 1:</strong>
            <ol>
              <li>서로 다른 색상의 보석 토큰 <strong>3개</strong> 가져오기</li>
              <li>같은 색상의 보석 토큰 <strong>2개</strong> 가져오기 (은행에 해당 보석이 <strong>4개 이상</strong> 남아있을 때만 가능)</li>
              <li>개발 카드 <strong>1장 예약하기</strong> (보드 또는 덱 맨 위) + <strong>황금(조커) 토큰 1개</strong> 획득 (최대 3장 예약 가능)</li>
              <li>오픈된 카드 또는 내가 예약한 카드 <strong>1장 비용 지불 후 구매하기</strong></li>
            </ol>
          </li>
          <li><strong>토큰 한도:</strong> 턴 종료 시 황금을 포함해 보유 토큰이 <strong>10개</strong>를 초과하면 10개가 되도록 반납합니다.</li>
          <li><strong>귀족 방문 &amp; 승리:</strong> 구매한 카드의 영구 보너스가 귀족 타일 조건을 충족하면 턴 종료 시 자동으로 귀족(+3점)이 방문합니다. 누군가 <strong>15점</strong> 이상을 달성하면 첫 플레이어 기준으로 모두 같은 횟수의 턴을 마친 뒤 최고 득점자가 승리합니다!</li>
        </ul>
        <hr style="border-color:rgba(255,255,255,0.12); margin:14px 0;"/>
        <h3 style="color:#f472b6;">🏯 2. 최신 확장 룰 (Modern Rules - 성채 거점 + 동양 특수능력)</h3>
        <ul>
          <li><strong>성채(Strongholds) 타워 3개:</strong> 카드를 구매할 때마다 보드 위의 다른 카드에 내 성채를 1개 배치하거나 상대 성채를 1개 제거할 수 있습니다. 상대 성채가 올라간 카드는 다른 플레이어가 구매하거나 예약할 수 없습니다!</li>
          <li><strong>동양의 무역로 특수능력 카드:</strong>
            <ul>
              <li><strong>✨ 쌍보석 (x2 보너스):</strong> 카드 1장으로 영구 보석 할인 보너스 2개를 제공합니다.</li>
              <li><strong>⚡ 페이백 (+1 보석):</strong> 구매 즉시 해당 카드 색상의 보석 토큰 1개를 은행에서 돌려받습니다.</li>
              <li><strong>🎁 연쇄 할인:</strong> 구매 시 은행에서 보석 최대 2개를 즉시 환급받습니다.</li>
              <li><strong>👑 왕실 명성:</strong> 구매 즉시 추가 명성 점수 +1점을 획득합니다.</li>
            </ul>
          </li>
        </ul>
      `;
      backdrop.classList.remove('hidden');
    }

    _showVictoryModal(sortedPlayers) {
      const backdrop = document.getElementById('infoModalBackdrop');
      const titleEl = document.getElementById('infoModalTitle');
      const bodyEl = document.getElementById('infoModalBody');
      if (!backdrop || !bodyEl) return;

      const winner = sortedPlayers[0];
      if (titleEl) titleEl.textContent = `🏆 게임 종료! 최종 우승: ${winner.name}`;

      const rowsHtml = sortedPlayers
        .map(
          (p, rank) => `
          <div style="display:flex; justify-content:space-between; padding:10px 12px; background:rgba(255,255,255,0.05); border-radius:8px; margin-bottom:6px; border:1px solid ${
            rank === 0 ? '#fde047' : 'rgba(255,255,255,0.1)'
          };">
            <span><strong>${rank + 1}위. ${p.name}</strong> (${p.isAI ? 'AI' : '사람'})</span>
            <span>🏆 <strong>${p.points}점</strong> (개발 카드 ${p.purchasedCards.length}장 · 귀족 ${p.nobles.length}명)</span>
          </div>
        `
        )
        .join('');

      bodyEl.innerHTML = `
        <div style="margin-bottom:12px; font-size:0.95rem; color:#fde047; font-weight:700;">
          🎉 축하합니다! ${winner.name}님이 르네상스 최고의 보석 거장으로 등극했습니다!
        </div>
        ${rowsHtml}
        <div style="display:flex; justify-content:flex-end; gap:10px; margin-top:16px;">
          <button class="hdr-btn primary" id="btnVictoryPlayAgain">🔄 같은 설정으로 다시 하기</button>
          <button class="hdr-btn" id="btnVictoryOpenLobby">⚙️ 로비 설정 열기</button>
        </div>
      `;

      backdrop.classList.remove('hidden');

      const btnAgain = document.getElementById('btnVictoryPlayAgain');
      if (btnAgain) {
        btnAgain.addEventListener('click', () => {
          backdrop.classList.add('hidden');
          this.startNewGame(true);
        });
      }

      const btnLobby = document.getElementById('btnVictoryOpenLobby');
      if (btnLobby) {
        btnLobby.addEventListener('click', () => {
          backdrop.classList.add('hidden');
          document.getElementById('setupModalBackdrop').classList.remove('hidden');
        });
      }
    }

    /* ========================================================================
       9. HEADER CONTROLS, 3D VIEW TILT & KEYBOARD SHORTCUTS
       ======================================================================== */
    _bindHeaderAndBoardEvents() {
      const slider = document.getElementById('tiltRangeSlider');
      const label = document.getElementById('tiltValLabel');
      if (slider) {
        slider.addEventListener('input', (e) => {
          this.setBoardTilt(Number(e.target.value));
          if (label) label.textContent = `${this.boardTiltDeg}°`;
        });
      }

      const btnToggleView = document.getElementById('btnToggleViewMode');
      if (btnToggleView) {
        btnToggleView.addEventListener('click', () => this.toggle2D3DView());
      }

      const btnHint = document.getElementById('btnAiHint');
      if (btnHint) {
        btnHint.addEventListener('click', () => this.showAIHintForCurrentPlayer());
      }

      const btnSound = document.getElementById('btnToggleSound');
      if (btnSound) {
        btnSound.addEventListener('click', () => {
          if (global.SplendorPhysics3D && global.SplendorPhysics3D.SoundFX) {
            const muted = global.SplendorPhysics3D.SoundFX.toggleMute();
            btnSound.textContent = muted ? '🔇 사운드 OFF' : '🔊 사운드 ON';
          }
        });
      }

      const btnRules = document.getElementById('btnOpenRules');
      if (btnRules) {
        btnRules.addEventListener('click', () => this._showRulebookModal());
      }

      const btnSetup = document.getElementById('btnOpenSetup');
      const netBadge = document.getElementById('netStatusBadge');
      const openSetupFn = () => {
        document.getElementById('setupModalBackdrop').classList.remove('hidden');
      };
      if (btnSetup) btnSetup.addEventListener('click', openSetupFn);
      if (netBadge) netBadge.addEventListener('click', openSetupFn);

      const btnConfirmGems = document.getElementById('btnConfirmGems');
      if (btnConfirmGems) {
        btnConfirmGems.addEventListener('click', () => this.confirmGemBasket());
      }

      const btnClearGems = document.getElementById('btnClearGems');
      if (btnClearGems) {
        btnClearGems.addEventListener('click', () => this.clearGemBasket());
      }

      const btnCloseCardModal = document.getElementById('btnCloseCardModal');
      if (btnCloseCardModal) {
        btnCloseCardModal.addEventListener('click', () => {
          document.getElementById('cardActionModalBackdrop').classList.add('hidden');
        });
      }

      const btnCloseInfoModal = document.getElementById('btnCloseInfoModal');
      if (btnCloseInfoModal) {
        btnCloseInfoModal.addEventListener('click', () => {
          document.getElementById('infoModalBackdrop').classList.add('hidden');
        });
      }
    }

    setBoardTilt(deg) {
      this.boardTiltDeg = Math.max(0, Math.min(35, deg));
      document.documentElement.style.setProperty('--board-tilt', `${this.boardTiltDeg}deg`);
      const slider = document.getElementById('tiltRangeSlider');
      const label = document.getElementById('tiltValLabel');
      if (slider) slider.value = String(this.boardTiltDeg);
      if (label) label.textContent = `${this.boardTiltDeg}°`;
    }

    toggle2D3DView() {
      const nextDeg = this.boardTiltDeg > 2 ? 0 : 18;
      this.setBoardTilt(nextDeg);
      this.showToast(nextDeg === 0 ? '📐 평면(2D) 시점으로 전환되었습니다.' : `📐 3D 입체 시점(${nextDeg}°)으로 전환되었습니다.`);
    }

    _bindKeyboardShortcuts() {
      window.addEventListener('keydown', (e) => {
        // Ignore shortcuts when typing inside an input/select
        if (e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT' || e.target.tagName === 'TEXTAREA')) {
          return;
        }

        const key = e.key;
        if (key >= '1' && key <= '6') {
          e.preventDefault();
          const gemKey = ALL_TOKEN_KEYS[Number(key) - 1];
          if (gemKey) this.addGemToBasket(gemKey);
        } else if (key === ' ' || key === 'Enter') {
          if (this.gemBasket.length > 0) {
            e.preventDefault();
            this.confirmGemBasket();
          }
        } else if (key === 'v' || key === 'V') {
          e.preventDefault();
          this.toggle2D3DView();
        } else if (key === 'h' || key === 'H') {
          e.preventDefault();
          this.showAIHintForCurrentPlayer();
        } else if (key === 'Escape') {
          this.clearGemBasket();
          document.getElementById('cardActionModalBackdrop').classList.add('hidden');
          document.getElementById('infoModalBackdrop').classList.add('hidden');
        }
      });
    }

    /* ========================================================================
       10. UTILITIES & SOUND WRAPPERS
       ======================================================================== */
    _getPlayerTotalTokens(player) {
      if (!player || !player.tokens) return 0;
      return ALL_TOKEN_KEYS.reduce((sum, g) => sum + (Number(player.tokens[g]) || 0), 0);
    }

    _autoTrimTokensToLimit(player) {
      while (this._getPlayerTotalTokens(player) > 10) {
        const g = GEM_KEYS.find((k) => (player.tokens[k] || 0) > 0) || 'gold';
        if ((player.tokens[g] || 0) > 0) {
          player.tokens[g] -= 1;
          this.state.bankTokens[g] += 1;
        } else {
          break;
        }
      }
    }

    _playChipSound(combo = 0) {
      if (global.SplendorPhysics3D && global.SplendorPhysics3D.SoundFX) {
        global.SplendorPhysics3D.SoundFX.playChipClink(combo);
      }
    }

    _playCardFlipSound() {
      if (global.SplendorPhysics3D && global.SplendorPhysics3D.SoundFX) {
        global.SplendorPhysics3D.SoundFX.playCardFlip();
      }
    }

    _playNobleFanfare() {
      if (global.SplendorPhysics3D && global.SplendorPhysics3D.SoundFX) {
        global.SplendorPhysics3D.SoundFX.playNobleFanfare();
      }
    }

    _playClickSound() {
      this._playChipSound(1);
    }

    showToast(message) {
      const container = document.getElementById('toastContainer');
      if (!container) return;
      const item = document.createElement('div');
      item.className = 'toast-item';
      item.textContent = message;
      container.appendChild(item);

      setTimeout(() => {
        item.style.opacity = '0';
        item.style.transition = 'opacity 0.3s ease';
        setTimeout(() => item.remove(), 300);
      }, 3400);
    }
  }

  // Boot application once DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      global.SplendorApp = new SplendorGameController();
    });
  } else {
    global.SplendorApp = new SplendorGameController();
  }
})(window);
