// 游戏状态管理
const gameState = {
    username: '',
    roomId: '',
    avatar: '',
    isHost: false,
    players: [],
    settings: {
        maxPlayers: 6,
        smallBlind: 1,
        bigBlind: 2,
        initialChips: 1000,
        maxRounds: 3
    },
    currentTurn: null,
    pot: 0,
    communityCards: [],
    playerCards: [],
    timer: null,
    timerDuration: 60,
    socket: null
};

// Socket.IO 连接初始化
function initializeSocket() {
    gameState.socket = io();

    // 连接成功
    gameState.socket.on('connect', () => {
        console.log('Connected to server');
        updateConnectionStatus(true);
    });

    // 连接错误
    gameState.socket.on('connect_error', (error) => {
        console.error('Connection error:', error);
        updateConnectionStatus(false);
    });

    // 断开连接
    gameState.socket.on('disconnect', () => {
        console.log('Disconnected from server');
        updateConnectionStatus(false);
    });

    // 房间创建成功
    gameState.socket.on('room_created', (data) => {
        gameState.roomId = data.roomId;
        gameState.isHost = true;
        showWaitingPanel();
        updateRoomDisplay();
    });

    // 加入房间成功
    gameState.socket.on('room_joined', (data) => {
        gameState.roomId = data.roomId;
        gameState.isHost = false;
        showWaitingPanel();
        updateRoomDisplay();
    });

    // 玩家列表更新
    gameState.socket.on('players_updated', (data) => {
        gameState.players = data.players;
        updateWaitingPanel();
        checkGameStart();
    });

    // 游戏开始
    gameState.socket.on('game_started', (data) => {
        hideWaitingPanel();
        showGameScreen();
        initializeGame(data);
    });

    // 轮到玩家行动
    gameState.socket.on('player_turn', (data) => {
        updatePlayerTurn(data);
        startTimer();
    });

    // 玩家行动结果
    gameState.socket.on('action_result', (data) => {
        updateGameState(data);
    });

    // 发牌
    gameState.socket.on('deal_cards', (data) => {
        dealCards(data);
    });

    // 游戏结束
    gameState.socket.on('game_over', (data) => {
        showGameResults(data);
    });

    // 错误消息
    gameState.socket.on('error_message', (data) => {
        showError(data.message);
    });

    // 聊天消息
    gameState.socket.on('chat_message', (data) => {
        addChatMessage(data);
    });
}

// UI 更新函数
function updateConnectionStatus(connected) {
    const statusElement = document.getElementById('connection-status');
    if (statusElement) {
        statusElement.textContent = connected ? '已连接' : '未连接';
        statusElement.className = connected ? 'connected' : 'disconnected';
    }
}

function showWaitingPanel() {
    document.getElementById('login-screen').style.display = 'none';
    document.getElementById('waiting-panel').style.display = 'block';
    
    if (gameState.isHost) {
        document.getElementById('host-controls').style.display = 'block';
    }
}

function updateRoomDisplay() {
    const roomIdDisplay = document.getElementById('display-room-id');
    if (roomIdDisplay) {
        roomIdDisplay.textContent = gameState.roomId;
    }
}

function updateWaitingPanel() {
    const waitingPlayers = document.querySelector('.waiting-players');
    waitingPlayers.innerHTML = '';

    gameState.players.forEach(player => {
        const playerElement = document.createElement('div');
        playerElement.className = 'waiting-player';
        playerElement.innerHTML = `
            <div class="player-avatar">${player.avatar}</div>
            <div class="player-name">${player.username}</div>
            ${player.isHost ? '<span class="host-tag">房主</span>' : ''}
        `;
        waitingPlayers.appendChild(playerElement);
    });

    // 更新开始游戏按钮状态
    if (gameState.isHost) {
        const startButton = document.getElementById('start-game-btn');
        startButton.disabled = gameState.players.length < 4;
    }
}

function showGameScreen() {
    document.getElementById('waiting-panel').style.display = 'none';
    document.getElementById('game-screen').style.display = 'block';
    initializeGameUI();
}

function initializeGameUI() {
    // 初始化游戏界面
    const playersContainer = document.querySelector('.players-container');
    playersContainer.innerHTML = '';

    // 根据玩家数量计算座位位置
    const totalPlayers = gameState.players.length;
    const radius = 200; // 调整这个值来改变座位距离中心的距离
    const centerX = playersContainer.offsetWidth / 2;
    const centerY = playersContainer.offsetHeight / 2;

    gameState.players.forEach((player, index) => {
        const angle = (index / totalPlayers) * 2 * Math.PI - Math.PI / 2;
        const x = centerX + radius * Math.cos(angle);
        const y = centerY + radius * Math.sin(angle);

        const playerSeat = document.createElement('div');
        playerSeat.className = 'player-seat';
        playerSeat.id = `player-${player.id}`;
        playerSeat.style.left = `${x}px`;
        playerSeat.style.top = `${y}px`;
        playerSeat.innerHTML = `
            <div class="player-avatar">${player.avatar}</div>
            <div class="player-name">${player.username}</div>
            <div class="player-chips">${player.chips}</div>
            <div class="player-cards"></div>
            <div class="player-bet"></div>
            <div class="timer" style="display: none;">
                <div class="timer-progress"></div>
                <span class="timer-value">60</span>
            </div>
        `;
        playersContainer.appendChild(playerSeat);
    });
}

function updatePlayerTurn(data) {
    // 重置所有玩家的活跃状态
    document.querySelectorAll('.player-seat').forEach(seat => {
        seat.classList.remove('active');
    });

    // 高亮当前玩家
    const currentPlayerSeat = document.getElementById(`player-${data.playerId}`);
    if (currentPlayerSeat) {
        currentPlayerSeat.classList.add('active');
    }

    // 如果是当前用户的回合，启用操作按钮
    const isCurrentPlayer = data.playerId === gameState.socket.id;
    document.querySelectorAll('.action-btn').forEach(btn => {
        btn.disabled = !isCurrentPlayer;
    });

    // 更新可用操作
    if (isCurrentPlayer) {
        updateAvailableActions(data.availableActions);
    }
}

function updateAvailableActions(actions) {
    const foldBtn = document.querySelector('.fold-btn');
    const checkBtn = document.querySelector('.check-btn');
    const callBtn = document.querySelector('.call-btn');
    const raiseBtn = document.querySelector('.raise-btn');

    foldBtn.disabled = !actions.includes('fold');
    checkBtn.disabled = !actions.includes('check');
    callBtn.disabled = !actions.includes('call');
    raiseBtn.disabled = !actions.includes('raise');

    if (actions.includes('call')) {
        callBtn.textContent = `跟注 ${actions.callAmount}`;
    }
}

function startTimer() {
    const timerElement = document.querySelector('.timer');
    const timerValue = document.querySelector('.timer-value');
    const timerProgress = document.querySelector('.timer-progress');

    timerElement.style.display = 'block';
    let timeLeft = gameState.timerDuration;

    clearInterval(gameState.timer);
    gameState.timer = setInterval(() => {
        timeLeft--;
        timerValue.textContent = timeLeft;

        if (timeLeft <= 0) {
            clearInterval(gameState.timer);
            // 自动弃牌
            if (document.querySelector('.fold-btn').disabled === false) {
                performAction('fold');
            }
        }
    }, 1000);

    // 重置并启动进度条动画
    timerProgress.style.animation = 'none';
    timerProgress.offsetHeight; // 触发重排
    timerProgress.style.animation = 'countdown 60s linear forwards';
}

function dealCards(data) {
    // 处理公共牌
    if (data.communityCards) {
        const communityCardsContainer = document.querySelector('.community-cards');
        communityCardsContainer.innerHTML = data.communityCards.map(card => 
            createCardElement(card)
        ).join('');
    }

    // 处理玩家手牌
    if (data.playerCards) {
        const playerCardsContainer = document.querySelector(`#player-${gameState.socket.id} .player-cards`);
        if (playerCardsContainer) {
            playerCardsContainer.innerHTML = data.playerCards.map(card =>
                createCardElement(card)
            ).join('');
        }
    }
}

function createCardElement(card) {
    const suit = {
        'hearts': '♥',
        'diamonds': '♦',
        'clubs': '♣',
        'spades': '♠'
    };
    const value = {
        '11': 'J',
        '12': 'Q',
        '13': 'K',
        '14': 'A'
    };

    const displayValue = value[card.value] || card.value;
    const suitClass = card.suit === 'hearts' || card.suit === 'diamonds' ? 'red' : 'black';

    return `
        <div class="card ${suitClass}">
            <div class="card-value">${displayValue}</div>
            <div class="card-suit">${suit[card.suit]}</div>
        </div>
    `;
}

function updateGameState(data) {
    // 更新底池
    document.getElementById('pot-value').textContent = data.pot;

    // 更新玩家筹码和下注
    data.players.forEach(player => {
        const playerSeat = document.getElementById(`player-${player.id}`);
        if (playerSeat) {
            playerSeat.querySelector('.player-chips').textContent = player.chips;
            const betElement = playerSeat.querySelector('.player-bet');
            if (player.bet > 0) {
                betElement.textContent = player.bet;
                betElement.style.display = 'block';
            } else {
                betElement.style.display = 'none';
            }
        }
    });

    // 更新排行榜
    updateLeaderboard();
}

function showGameResults(data) {
    const resultsContainer = document.createElement('div');
    resultsContainer.className = 'game-result';
    resultsContainer.innerHTML = `
        <div class="result-content">
            <h2>游戏结束</h2>
            <div class="winners-list">
                ${data.winners.map(winner => `
                    <div class="winner-item">
                        <div class="winner-avatar">${winner.avatar}</div>
                        <div class="winner-info">
                            <div class="winner-name">${winner.username}</div>
                            <div class="winner-hand">${winner.hand}</div>
                        </div>
                        <div class="winner-pot">+${winner.winnings}</div>
                    </div>
                `).join('')}
            </div>
            <button class="gold-btn" onclick="startNewGame()">开始新游戏</button>
        </div>
    `;
    document.body.appendChild(resultsContainer);
}

// 事件处理函数
function handleCreateRoom() {
    const username = document.getElementById('create-username').value.trim();
    const avatar = document.querySelector('.avatar-option.selected')?.dataset.avatar;
    const maxPlayers = document.getElementById('max-players').value;
    const smallBlind = document.getElementById('small-blind').value;
    const bigBlind = document.getElementById('big-blind').value;
    const initialChips = document.getElementById('initial-chips').value;
    const maxRounds = document.getElementById('max-rounds').value;

    if (!username || !avatar) {
        showError('请输入用户名并选择头像');
        return;
    }

    gameState.username = username;
    gameState.avatar = avatar;
    gameState.settings = {
        maxPlayers: parseInt(maxPlayers),
        smallBlind: parseInt(smallBlind),
        bigBlind: parseInt(bigBlind),
        initialChips: parseInt(initialChips),
        maxRounds: parseInt(maxRounds)
    };

    gameState.socket.emit('create_room', {
        username: username,
        avatar: avatar,
        settings: gameState.settings
    });
}

function handleJoinRoom() {
    const username = document.getElementById('join-username').value.trim();
    const avatar = document.querySelector('.avatar-option.selected')?.dataset.avatar;
    const roomId = document.getElementById('room-id').value.trim();

    if (!username || !avatar || !roomId) {
        showError('请填写所有必要信息');
        return;
    }

    gameState.username = username;
    gameState.avatar = avatar;

    gameState.socket.emit('join_room', {
        username: username,
        avatar: avatar,
        roomId: roomId
    });
}

function handleStartGame() {
    if (gameState.isHost && gameState.players.length >= 4) {
        gameState.socket.emit('start_game', { roomId: gameState.roomId });
    }
}

function performAction(action, amount = null) {
    gameState.socket.emit('player_action', {
        action: action,
        amount: amount,
        roomId: gameState.roomId
    });
}

// 聊天系统
function initializeChat() {
    const chatInput = document.getElementById('chat-input');
    const sendBtn = document.querySelector('.send-btn');
    const emojiBtn = document.querySelector('.emoji-btn');
    const emojiPicker = document.querySelector('.emoji-picker');

    // 初始化表情选择器
    const emojis = ['😊', '😂', '🤣', '😅', '😆', '😉', '😋', '😎', '😍', '🤩', '😏', '😒', '😔', '😢', '😭', '😤', '😠', '🤔', '🤗', '🤫', '🤭', '🤪', '😴', '🤑'];
    emojiPicker.innerHTML = emojis.map(emoji => `
        <div class="emoji" data-emoji="${emoji}">${emoji}</div>
    `).join('');

    // 发送消息
    function sendMessage() {
        const message = chatInput.value.trim();
        if (message) {
            gameState.socket.emit('chat_message', {
                message: message,
                roomId: gameState.roomId
            });
            chatInput.value = '';
        }
    }

    // 事件监听
    sendBtn.addEventListener('click', sendMessage);
    chatInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            sendMessage();
        }
    });

    emojiBtn.addEventListener('click', () => {
        emojiPicker.style.display = emojiPicker.style.display === 'none' ? 'grid' : 'none';
    });

    emojiPicker.addEventListener('click', (e) => {
        if (e.target.classList.contains('emoji')) {
            chatInput.value += e.target.dataset.emoji;
            emojiPicker.style.display = 'none';
            chatInput.focus();
        }
    });

    // 点击其他地方关闭表情选择器
    document.addEventListener('click', (e) => {
        if (!e.target.closest('.emoji-picker') && !e.target.closest('.emoji-btn')) {
            emojiPicker.style.display = 'none';
        }
    });
}

function addChatMessage(data) {
    const chatMessages = document.querySelector('.chat-messages');
    const messageElement = document.createElement('div');
    messageElement.className = `chat-message ${data.username === gameState.username ? 'self' : 'other'}`;
    messageElement.innerHTML = `
        <div class="message-sender">${data.username}</div>
        <div class="message-content">${data.message}</div>
        <div class="message-time">${new Date().toLocaleTimeString()}</div>
    `;
    chatMessages.appendChild(messageElement);
    chatMessages.scrollTop = chatMessages.scrollHeight;
}

// 工具函数
function showError(message) {
    const errorElement = document.createElement('div');
    errorElement.className = 'toast-message error';
    errorElement.textContent = message;
    document.body.appendChild(errorElement);

    setTimeout(() => {
        errorElement.remove();
    }, 3000);
}

function copyRoomId() {
    const roomId = document.getElementById('display-room-id').textContent;
    navigator.clipboard.writeText(roomId).then(() => {
        showError('房间号已复制到剪贴板');
    });
}

// 排行榜功能
function initializeLeaderboard() {
    const leaderboardToggle = document.getElementById('leaderboard-toggle');
    const leaderboardPanel = document.getElementById('leaderboard-panel');
    const closeLeaderboard = document.getElementById('close-leaderboard');
    const leaderboardTabs = document.querySelectorAll('.leaderboard-tab');

    // 切换排行榜显示
    leaderboardToggle.addEventListener('click', () => {
        leaderboardPanel.classList.add('active');
        updateLeaderboard();
    });

    // 关闭排行榜
    closeLeaderboard.addEventListener('click', () => {
        leaderboardPanel.classList.remove('active');
    });

    // 标签切换
    leaderboardTabs.forEach(tab => {
        tab.addEventListener('click', () => {
            const targetTab = tab.dataset.tab;
            
            // 更新标签状态
            leaderboardTabs.forEach(t => t.classList.remove('active'));
            tab.classList.add('active');
            
            // 更新内容显示
            document.querySelectorAll('.leaderboard-pane').forEach(pane => {
                pane.classList.remove('active');
            });
            document.getElementById(`${targetTab}-leaderboard`).classList.add('active');
        });
    });

    // 点击面板外部关闭
    document.addEventListener('click', (e) => {
        if (e.target === leaderboardPanel) {
            leaderboardPanel.classList.remove('active');
        }
    });
}

function updateLeaderboard() {
    if (!gameState.roomId) return;

    fetch(`/api/leaderboard/${gameState.roomId}`)
        .then(response => response.json())
        .then(data => {
            if (data.success) {
                updateRoomLeaderboard(data.room_leaderboard);
                updateHistoryLeaderboard(data.history_leaderboard);
            }
        })
        .catch(error => console.error('获取排行榜数据失败:', error));
}

function updateRoomLeaderboard(data) {
    const tbody = document.getElementById('room-leaderboard-body');
    tbody.innerHTML = data.map((player, index) => `
        <tr>
            <td class="rank-number">#${index + 1}</td>
            <td>
                <div class="player-info">
                    <div class="player-avatar">
                        <i class="fas ${player.avatar}"></i>
                    </div>
                    <span>${player.username}</span>
                </div>
            </td>
            <td class="chips-amount">${player.chips}</td>
            <td class="net-gain ${player.net_gain >= 0 ? 'positive' : 'negative'}">
                ${player.net_gain >= 0 ? '+' : ''}${player.net_gain}
            </td>
        </tr>
    `).join('');
}

function updateHistoryLeaderboard(data) {
    const tbody = document.getElementById('history-leaderboard-body');
    tbody.innerHTML = data.map((player, index) => `
        <tr>
            <td class="rank-number">#${index + 1}</td>
            <td>
                <div class="player-info">
                    <div class="player-avatar">
                        <i class="fas ${player.avatar}"></i>
                    </div>
                    <span>${player.username}</span>
                </div>
            </td>
            <td class="chips-amount">${player.highest_chips}</td>
            <td class="games-played">${player.games_played}场</td>
        </tr>
    `).join('');
}

// 初始化函数
function initialize() {
    // 初始化Socket连接
    initializeSocket();

    // 初始化聊天系统
    initializeChat();

    // 标签页切换
    document.querySelectorAll('.tab-btn').forEach(button => {
        button.addEventListener('click', () => {
            const tabId = button.dataset.tab;
            document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
            document.querySelectorAll('.tab-content').forEach(content => content.classList.remove('active'));
            button.classList.add('active');
            document.getElementById(`${tabId}-tab`).classList.add('active');
        });
    });

    // 头像选择
    document.querySelectorAll('.avatar-option').forEach(option => {
        option.addEventListener('click', () => {
            document.querySelectorAll('.avatar-option').forEach(opt => opt.classList.remove('selected'));
            option.classList.add('selected');
        });
    });

    // 玩家数量滑块
    const maxPlayersSlider = document.getElementById('max-players');
    const maxPlayersValue = document.getElementById('max-players-value');
    maxPlayersSlider.addEventListener('input', () => {
        maxPlayersValue.textContent = `${maxPlayersSlider.value}人`;
    });

    // 按钮事件
    document.getElementById('create-room-btn').addEventListener('click', handleCreateRoom);
    document.getElementById('join-room-btn').addEventListener('click', handleJoinRoom);
    document.getElementById('start-game-btn').addEventListener('click', handleStartGame);

    // 游戏操作按钮
    document.querySelectorAll('.action-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const action = btn.classList.contains('fold-btn') ? 'fold' :
                          btn.classList.contains('check-btn') ? 'check' :
                          btn.classList.contains('call-btn') ? 'call' :
                          'raise';
            
            if (action === 'raise') {
                // TODO: 实现加注金额选择UI
                const amount = prompt('请输入加注金额：');
                if (amount) {
                    performAction(action, parseInt(amount));
                }
            } else {
                performAction(action);
            }
        });
    });

    // 初始化排行榜
    initializeLeaderboard();
}

// 当页面加载完成时初始化
document.addEventListener('DOMContentLoaded', initialize); 