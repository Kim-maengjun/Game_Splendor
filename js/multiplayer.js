/**
 * Splendor 3D - Multi-Platform Multiplayer & Cross-Tab Sync Engine
 * Supports:
 * 1) Local Pass & Play (Hotseat) with Privacy Shield for Reserved Cards
 * 2) Multi-Device Online P2P via WebRTC (PeerJS) + Cross-Tab BroadcastChannel & localStorage Fallback
 */

(function (global) {
  'use strict';

  class SplendorNetEngine {
    constructor() {
      this.mode = 'local'; // 'local' (Pass & Play) | 'online_host' | 'online_client'
      this.roomCode = '';
      this.peerId = '';
      this.mySlotIndex = 0; // In online mode: 0 for Host, 1..3 for Clients
      this.peer = null;
      this.connections = new Map(); // peerId -> DataConnection (Host maintains all, Client maintains host)
      this.hostConn = null;
      this.bc = null;
      this.connectedPeers = []; // List of { peerId, name, slotIndex, isReady }
      this.callbacks = {
        onStateSync: null,
        onActionReceived: null,
        onPeersUpdated: null,
        onStatusChange: null,
        onChatOrToast: null
      };
      this.isPrivacyShieldUnlocked = false;
      this._initLocalCrossTabBridge();
    }

    /**
     * Initialize BroadcastChannel & localStorage event listener
     * Ensures 100% zero-config real-time sync across tabs/windows even offline or behind strict firewalls.
     */
    _initLocalCrossTabBridge() {
      try {
        if (typeof BroadcastChannel !== 'undefined') {
          this.bc = new BroadcastChannel('splendor_3d_net_channel');
          this.bc.onmessage = (ev) => {
            if (ev && ev.data) this._handleBridgePacket(ev.data);
          };
        }
      } catch (e) {
        console.warn('[SplendorNet] BroadcastChannel unavailable:', e);
      }

      window.addEventListener('storage', (ev) => {
        if (ev.key === 'splendor_3d_net_packet' && ev.newValue) {
          try {
            const packet = JSON.parse(ev.newValue);
            this._handleBridgePacket(packet);
          } catch (err) {
            // ignore malformed packet
          }
        }
      });
    }

    on(eventName, fn) {
      if (eventName in this.callbacks) {
        this.callbacks[eventName] = fn;
      }
    }

    _emitStatus(statusText, isConnected = false) {
      if (this.callbacks.onStatusChange) {
        this.callbacks.onStatusChange({
          mode: this.mode,
          roomCode: this.roomCode,
          mySlotIndex: this.mySlotIndex,
          statusText,
          isConnected,
          peers: this.connectedPeers
        });
      }
    }

    _emitToast(msg, type = 'info') {
      if (this.callbacks.onChatOrToast) {
        this.callbacks.onChatOrToast(msg, type);
      }
    }

    generateRoomCode() {
      const num = Math.floor(1000 + Math.random() * 9000);
      return `SPL-${num}`;
    }

    /**
     * Reset existing connections and set to Local Pass & Play mode
     */
    startLocalPassAndPlay() {
      this.disconnect();
      this.mode = 'local';
      this.roomCode = '';
      this.mySlotIndex = -1; // -1 means local device controls all human slots on their turn
      this.isPrivacyShieldUnlocked = false;
      this._emitStatus('단일 기기 패스 앤 플레이 (Pass & Play)', true);
    }

    /**
     * Host a room (WebRTC PeerJS + BroadcastChannel + localStorage hybrid)
     */
    hostRoom(customCode, hostName = '방장 (Host)') {
      this.disconnect();
      this.mode = 'online_host';
      this.roomCode = (customCode || this.generateRoomCode()).toUpperCase().trim();
      this.mySlotIndex = 0;
      this.peerId = 'HOST_' + Math.random().toString(36).substring(2, 8);

      this.connectedPeers = [
        {
          peerId: this.peerId,
          name: hostName,
          slotIndex: 0,
          transport: 'host',
          joinedAt: Date.now()
        }
      ];

      this._emitStatus(`방 생성 중... (${this.roomCode})`, true);

      // 1) BroadcastChannel / LocalStorage presence announcement
      this._sendBridgePacket({
        type: 'HOST_READY',
        roomCode: this.roomCode,
        hostPeerId: this.peerId,
        peers: this.connectedPeers
      });

      // 2) WebRTC PeerJS initialization (with automatic retry if PeerJS CDN script is still loading)
      const initHostPeer = (attempt = 0) => {
        if (this.mode !== 'online_host') return;
        if (typeof Peer === 'undefined') {
          if (attempt < 25) {
            setTimeout(() => initHostPeer(attempt + 1), 200);
          } else {
            this._emitStatus(`방 활성 [코드: ${this.roomCode}] (다중 탭 실시간 동기화 모드)`, true);
          }
          return;
        }
        const peerJsId = `splendor3d-${this.roomCode.toLowerCase().replace(/[^a-z0-9]/g, '')}`;
        try {
          this.peer = new Peer(peerJsId, { debug: 1 });

          this.peer.on('open', () => {
            this._emitStatus(`방 대기 중 [코드: ${this.roomCode}] (WebRTC + 로컬탭 연동 활성)`, true);
          });

          this.peer.on('connection', (conn) => {
            this._setupPeerConnectionForHost(conn);
          });

          this.peer.on('error', (err) => {
            console.warn('[SplendorNet] PeerJS warn (Cross-tab sync still active):', err.type || err);
            this._emitStatus(`방 활성 [코드: ${this.roomCode}] (로컬 브릿지 및 P2P 대기)`, true);
          });
        } catch (e) {
          console.warn('[SplendorNet] PeerJS init skipped, using Bridge:', e);
        }
      };
      initHostPeer(0);

      if (this.callbacks.onPeersUpdated) {
        this.callbacks.onPeersUpdated(this.connectedPeers);
      }

      return this.roomCode;
    }

    /**
     * Join an existing room by Room Code
     */
    joinRoom(roomCodeInput, playerName = '참가자', preferredSlot = null) {
      this.disconnect();
      const cleanCode = (roomCodeInput || '').toUpperCase().trim();
      if (!cleanCode) {
        this._emitToast('유효한 방 코드를 입력하세요 (예: SPL-4829)', 'error');
        return false;
      }

      this.mode = 'online_client';
      this.roomCode = cleanCode;
      this.peerId = 'CLIENT_' + Math.random().toString(36).substring(2, 8);
      this.mySlotIndex = preferredSlot !== null ? preferredSlot : 1;

      this._emitStatus(`방 [${this.roomCode}] 접속 시도 중...`, false);

      // 1) Send JOIN request over BroadcastChannel / localStorage Bridge immediately
      this._sendBridgePacket({
        type: 'JOIN_REQUEST',
        roomCode: this.roomCode,
        clientPeerId: this.peerId,
        name: playerName,
        preferredSlot
      });

      // 2) Also try WebRTC PeerJS connection for remote PC / Smartphone (retry if PeerJS defer is still loading)
      const initClientPeer = (attempt = 0) => {
        if (this.mode !== 'online_client') return;
        if (typeof Peer === 'undefined') {
          if (attempt < 25) {
            setTimeout(() => initClientPeer(attempt + 1), 200);
          }
          return;
        }
        try {
          this.peer = new Peer(undefined, { debug: 1 });
          this.peer.on('open', () => {
            const targetPeerJsId = `splendor3d-${this.roomCode.toLowerCase().replace(/[^a-z0-9]/g, '')}`;
            const conn = this.peer.connect(targetPeerJsId, { reliable: true });
            this.hostConn = conn;

            conn.on('open', () => {
              conn.send({
                type: 'JOIN_REQUEST',
                roomCode: this.roomCode,
                clientPeerId: this.peerId,
                name: playerName,
                preferredSlot
              });
            });

            conn.on('data', (data) => {
              this._handleClientReceivedData(data);
            });

            conn.on('close', () => {
              this._emitToast('방장(Host)과의 WebRTC 연결이 종료되었습니다.', 'warning');
            });
          });

          this.peer.on('error', (err) => {
            console.warn('[SplendorNet] Client PeerJS notice:', err.type || err);
          });
        } catch (e) {
          console.warn('[SplendorNet] Client PeerJS error:', e);
        }
      };
      initClientPeer(0);

      return true;
    }

    _setupPeerConnectionForHost(conn) {
      conn.on('open', () => {
        this.connections.set(conn.peer, conn);
      });

      conn.on('data', (data) => {
        if (!data) return;
        if (data.type === 'JOIN_REQUEST') {
          this._registerClientOnHost(data.clientPeerId || conn.peer, data.name, data.preferredSlot, 'webrtc', conn);
        } else if (data.type === 'PLAYER_ACTION') {
          if (this.callbacks.onActionReceived) {
            this.callbacks.onActionReceived(data.action, data.slotIndex);
          }
        } else if (data.type === 'CHAT_MSG') {
          this.broadcastToast(`${data.sender}: ${data.text}`, 'info');
        }
      });

      conn.on('close', () => {
        this.connections.delete(conn.peer);
      });
    }

    _registerClientOnHost(clientPeerId, name, preferredSlot, transport, webrtcConn = null) {
      if (this.mode !== 'online_host') return;

      let existing = this.connectedPeers.find((p) => p.peerId === clientPeerId);
      if (!existing) {
        // Assign next available human slot (1, 2, 3)
        const usedSlots = new Set(this.connectedPeers.map((p) => p.slotIndex));
        let assignedSlot = preferredSlot !== null && !usedSlots.has(preferredSlot) ? preferredSlot : 1;
        while (usedSlots.has(assignedSlot) && assignedSlot < 4) {
          assignedSlot++;
        }
        // If a mobile user refreshed their browser and slot 1 was already used, reuse slot 1
        if (assignedSlot >= 2 && this.connectedPeers.length >= 2 && preferredSlot === null) {
          assignedSlot = 1;
        }

        existing = {
          peerId: clientPeerId,
          name: name || `플레이어 ${assignedSlot + 1}`,
          slotIndex: assignedSlot,
          transport,
          joinedAt: Date.now()
        };
        this.connectedPeers.push(existing);
      } else if (name) {
        existing.name = name;
      }

      const acceptPacket = {
        type: 'JOIN_ACCEPTED',
        roomCode: this.roomCode,
        targetPeerId: clientPeerId,
        assignedSlot: existing.slotIndex,
        peers: this.connectedPeers
      };

      if (webrtcConn && webrtcConn.open) {
        webrtcConn.send(acceptPacket);
      }
      this._sendBridgePacket(acceptPacket);

      this._emitStatus(
        `방 활성 [${this.roomCode}] · 접속 인원: ${this.connectedPeers.length}명`,
        true
      );
      this._emitToast(`${existing.name}님이 슬롯 P${existing.slotIndex + 1}로 참가했습니다!`, 'success');

      if (this.callbacks.onPeersUpdated) {
        this.callbacks.onPeersUpdated(this.connectedPeers, existing);
      }
    }

    _isDuplicatePacket(packet) {
      if (!packet || !packet.nonce) return false;
      if (!this.seenNonces) this.seenNonces = new Set();
      if (this.seenNonces.has(packet.nonce)) return true;
      this.seenNonces.add(packet.nonce);
      if (this.seenNonces.size > 300) {
        const first = this.seenNonces.values().next().value;
        this.seenNonces.delete(first);
      }
      return false;
    }

    _handleBridgePacket(packet) {
      if (!packet || packet.roomCode !== this.roomCode) return;
      if (packet.senderPeerId === this.peerId) return; // Ignore own echo
      if (this._isDuplicatePacket(packet)) return;

      if (this.mode === 'online_host') {
        if (packet.type === 'JOIN_REQUEST') {
          this._registerClientOnHost(
            packet.clientPeerId,
            packet.name,
            packet.preferredSlot,
            'bridge'
          );
        } else if (packet.type === 'PLAYER_ACTION') {
          if (this.callbacks.onActionReceived) {
            this.callbacks.onActionReceived(packet.action, packet.slotIndex);
          }
        } else if (packet.type === 'CHAT_MSG') {
          this.broadcastToast(`${packet.sender}: ${packet.text}`, 'info');
        }
      } else if (this.mode === 'online_client') {
        this._handleClientReceivedData(packet);
      }
    }

    _handleClientReceivedData(packet) {
      if (!packet || packet.roomCode !== this.roomCode) return;
      if (this._isDuplicatePacket(packet)) return;

      if (packet.type === 'JOIN_ACCEPTED') {
        if (!packet.targetPeerId || packet.targetPeerId === this.peerId) {
          this.mySlotIndex = packet.assignedSlot;
        }
        this.connectedPeers = packet.peers || [];
        this._emitStatus(
          `연결 완료 [${this.roomCode}] · 내 역할: 플레이어 ${this.mySlotIndex + 1}`,
          true
        );
        if (this.callbacks.onPeersUpdated) {
          this.callbacks.onPeersUpdated(this.connectedPeers);
        }
      } else if (packet.type === 'STATE_SYNC') {
        if (this.callbacks.onStateSync) {
          this.callbacks.onStateSync(packet.state, packet.meta);
        }
      } else if (packet.type === 'TOAST_BROADCAST') {
        this._emitToast(packet.message, packet.toastType || 'info');
      }
    }

    _sendBridgePacket(payload) {
      const packet = Object.assign({}, payload, {
        senderPeerId: this.peerId,
        timestamp: Date.now(),
        nonce: Math.random().toString(36).substring(2, 7)
      });

      if (this.bc) {
        try {
          this.bc.postMessage(packet);
        } catch (e) {
          // ignore
        }
      }

      try {
        localStorage.setItem('splendor_3d_net_packet', JSON.stringify(packet));
      } catch (e) {
        // ignore quota errors
      }
    }

    /**
     * Host broadcasts full authoritative game state to all connected peers (WebRTC + Bridge)
     */
    broadcastState(serializedState, meta = {}) {
      if (this.mode !== 'online_host') return;

      const packet = {
        type: 'STATE_SYNC',
        roomCode: this.roomCode,
        state: serializedState,
        meta
      };

      // Send via WebRTC
      this.connections.forEach((conn) => {
        if (conn && conn.open) {
          try {
            conn.send(packet);
          } catch (e) {
            console.warn('[SplendorNet] Failed WebRTC send:', e);
          }
        }
      });

      // Send via Cross-Tab Bridge
      this._sendBridgePacket(packet);
    }

    /**
     * Client sends an action intent to Host (or Host executes directly)
     */
    sendAction(actionObj, slotIndex) {
      if (this.mode === 'online_client') {
        const packet = {
          type: 'PLAYER_ACTION',
          roomCode: this.roomCode,
          slotIndex: slotIndex !== undefined ? slotIndex : this.mySlotIndex,
          action: actionObj
        };

        if (this.hostConn && this.hostConn.open) {
          this.hostConn.send(packet);
        }
        this._sendBridgePacket(packet);
        return true;
      }
      return false;
    }

    broadcastToast(message, toastType = 'info') {
      this._emitToast(message, toastType);
      if (this.mode === 'online_host') {
        const packet = {
          type: 'TOAST_BROADCAST',
          roomCode: this.roomCode,
          message,
          toastType
        };
        this.connections.forEach((conn) => {
          if (conn && conn.open) conn.send(packet);
        });
        this._sendBridgePacket(packet);
      }
    }

    /**
     * Determines if the current device is allowed to view private reserved cards of `playerIndex`
     */
    canViewReservedCardFront(playerIndex, currentTurnIndex, players) {
      const player = players && players[playerIndex];
      if (!player) return false;
      if (player.isAI) return false; // AI reserved from deck stays hidden until purchased, or visible if reserved from board

      if (this.mode === 'online_host' || this.mode === 'online_client') {
        return this.mySlotIndex === playerIndex;
      }

      // Local Pass & Play mode:
      // Only show if it's currently that human's turn AND they clicked the "본인 확인 (예약 카드 앞면 보기)" toggle
      const humanCount = players.filter((p) => !p.isAI).length;
      if (humanCount <= 1) {
        return true; // Single human vs AI: always show human's own reserved cards
      }
      return playerIndex === currentTurnIndex && this.isPrivacyShieldUnlocked;
    }

    /**
     * Determines if this device can control `playerIndex` right now
     */
    canControlPlayer(playerIndex, playerObj) {
      if (!playerObj || playerObj.isAI) return false;
      if (this.mode === 'local') return true;
      return this.mySlotIndex === playerIndex;
    }

    togglePrivacyShield(forceState) {
      if (typeof forceState === 'boolean') {
        this.isPrivacyShieldUnlocked = forceState;
      } else {
        this.isPrivacyShieldUnlocked = !this.isPrivacyShieldUnlocked;
      }
      return this.isPrivacyShieldUnlocked;
    }

    getInviteLink() {
      if (!this.roomCode) return window.location.href;
      const url = new URL(window.location.href);
      url.searchParams.set('room', this.roomCode);
      return url.toString();
    }

    disconnect() {
      if (this.peer) {
        try {
          this.peer.destroy();
        } catch (e) {}
        this.peer = null;
      }
      this.connections.clear();
      this.hostConn = null;
      this.connectedPeers = [];
    }
  }

  global.SplendorNet = new SplendorNetEngine();
})(window);
