// 游戏状态管理
const gameState = {
    username: '',
    roomId: '',
    avatar: 'user-tie',
    isHost: false,
    players: [],
    settings: {
        maxPlayers: 6,
        smallBlind: 10,
        bigBlind: 20,
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
    gameState.socket = io({
        transports: ['websocket', 'polling'],
        reconnection: true,
        reconnectionAttempts: 5,
        reconnectionDelay: 1000
    });

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
        gameState.roomId = data.room_id;
        gameState.isHost = true;
        showRoomCreatedNotification(data.room_id);
    });

    // 进入房间成功
    gameState.socket.on('room_joined', (data) => {
        gameState.roomId = data.room_id;
        gameState.isHost = data.isHost;
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

function showRoomCreatedNotification(roomId) {
    const roomCreated = document.getElementById('room-created');
    const createdRoomId = document.getElementById('created-room-id');
    
    if (roomCreated && createdRoomId) {
        createdRoomId.textContent = roomId;
        roomCreated.classList.remove('hidden');
    }
}

function showWaitingPanel() {
    document.getElementById('login-screen').style.display = 'none';
    document.getElementById('room-created').classList.add('hidden');
    document.getElementById('game-screen').classList.add('hidden');
    document.getElementById('waiting-panel').style.display = 'block';
    
    if (gameState.isHost) {
        document.getElementById('host-controls').style.display = 'block';
    } else {
        document.getElementById('host-controls').style.display = 'none';
    }
}

function hideWaitingPanel() {
    document.getElementById('waiting-panel').style.display = 'none';
}

function updateRoomDisplay() {
    const roomIdDisplay = document.getElementById('room-id-value');
    const gameRoomId = document.getElementById('display-room-id');
    
    if (roomIdDisplay) {
        roomIdDisplay.textContent = gameState.roomId;
    }
    
    if (gameRoomId) {
        gameRoomId.textContent = gameState.roomId;
    }
}

function updateWaitingPanel() {
    const waitingPlayers = document.getElementById('waiting-players');
    const playerCount = document.getElementById('current-player-count');
    
    if (waitingPlayers) {
        waitingPlayers.innerHTML = '';
        
        gameState.players.forEach(player => {
            const playerElement = document.createElement('div');
            playerElement.className = 'waiting-player';
            playerElement.innerHTML = `
                <div class="player-avatar">
                    <i class="fas fa-${player.avatar}"></i>
                </div>
                <div class="player-name">${player.username}</div>
                ${player.isHost ? '<span class="host-tag">房主</span>' : ''}
            `;
            waitingPlayers.appendChild(playerElement);
        });
    }
    
    if (playerCount) {
        playerCount.textContent = gameState.players.length;
    }
}

function checkGameStart() {
    if (gameState.isHost) {
        const startButton = document.getElementById('start-game-btn');
        if (startButton) {
            startButton.disabled = gameState.players.length < 2;
            
            if (gameState.players.length >= 2) {
                startButton.textContent = '开始游戏';
            } else {
                startButton.textContent = '开始游戏 (至少需要2位玩家)';
            }
        }
    }
}

function showGameScreen() {
    document.getElementById('login-screen').style.display = 'none';
    document.getElementById('game-screen').classList.remove('hidden');
    initializeGameUI();
}

function initializeGameUI() {
    // 初始化游戏界面
    const playersContainer = document.getElementById('players-container');
    if (!playersContainer) return;
    
    playersContainer.innerHTML = '';

    // 根据玩家数量计算座位位置
    const totalPlayers = gameState.players.length;
    const radius = 200; // 调整这个值来改变座位距离中心的距离
    const centerX = 250;
    const centerY = 250;

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
            <div class="player-avatar">
                <i class="fas fa-${player.avatar}"></i>
            </div>
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
    
    // 更新玩家信息
    const currentPlayer = gameState.players.find(p => p.id === gameState.socket.id);
    if (currentPlayer) {
        document.getElementById('player-name').textContent = currentPlayer.username;
        document.getElementById('player-chips').textContent = currentPlayer.chips;
        document.getElementById('player-avatar-icon').className = `fas fa-${currentPlayer.avatar}`;
    }
    
    // 初始化聊天系统
    initializeChat();
}

// 事件处理函数
function handleCreateRoom() {
    const username = document.getElementById('create-username').value.trim();
    const avatar = document.querySelector('.avatar-option.selected')?.dataset.avatar || 'user-tie';
    const smallBlind = document.getElementById('small-blind').value;
    const bigBlind = document.getElementById('big-blind').value;
    const allInRounds = document.getElementById('all-in-rounds').value;
    const initialChips = document.getElementById('initial-chips').value;

    if (!username) {
        showError('请输入用户名');
        return;
    }

    gameState.username = username;
    gameState.avatar = avatar;
    gameState.settings = {
        maxPlayers: 10,
        smallBlind: parseInt(smallBlind),
        bigBlind: parseInt(bigBlind),
        initialChips: parseInt(initialChips),
        maxRounds: parseInt(allInRounds)
    };

    gameState.socket.emit('create_room', {
        username: username,
        avatar: avatar,
        settings: gameState.settings
    });
}

function handleJoinRoom() {
    const username = document.getElementById('join-username').value.trim();
    const avatar = document.querySelector('#join-tab .avatar-option.selected')?.dataset.avatar || 'user-tie';
    const roomId = document.getElementById('room-id').value.trim();

    if (!username || !roomId) {
        showError('请填写所有必要信息');
        return;
    }

    gameState.username = username;
    gameState.avatar = avatar;

    gameState.socket.emit('join_room', {
        username: username,
        avatar: avatar,
        room_id: roomId
    });
}

function handleEnterRoom() {
    const roomId = document.getElementById('created-room-id').textContent;
    if (roomId) {
        document.getElementById('room-created').classList.add('hidden');
        gameState.socket.emit('join_room', {
            username: gameState.username,
            avatar: gameState.avatar,
            room_id: roomId
        });
    }
}

function handleStartGame() {
    if (gameState.isHost && gameState.players.length >= 2) {
        gameState.socket.emit('start_game', { room_id: gameState.roomId });
    }
}

function performAction(action, amount = null) {
    gameState.socket.emit('player_action', {
        action: action,
        amount: amount,
        room_id: gameState.roomId
    });
}

// 聊天系统
function initializeChat() {
    const chatToggle = document.getElementById('chat-toggle');
    const chatContainer = document.querySelector('.chat-container');
    const chatInput = document.getElementById('chat-input');
    const sendBtn = document.querySelector('.send-btn');
    const emojiBtn = document.querySelector('.emoji-btn');
    const emojiPicker = document.querySelector('.emoji-picker');
    const closeChat = document.getElementById('close-chat');
    
    if (chatToggle && chatContainer) {
        chatToggle.addEventListener('click', () => {
            chatContainer.classList.toggle('active');
        });
    }
    
    if (closeChat && chatContainer) {
        closeChat.addEventListener('click', () => {
            chatContainer.classList.remove('active');
        });
    }
    
    // 发送消息
    function sendMessage() {
        if (!chatInput) return;
        
        const message = chatInput.value.trim();
        if (message) {
            gameState.socket.emit('chat_message', {
                message: message,
                room_id: gameState.roomId
            });
            chatInput.value = '';
        }
    }
    
    // 事件监听
    if (sendBtn) {
        sendBtn.addEventListener('click', sendMessage);
    }
    
    if (chatInput) {
        chatInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                sendMessage();
            }
        });
    }
    
    if (emojiBtn && emojiPicker) {
        emojiBtn.addEventListener('click', () => {
            emojiPicker.style.display = emojiPicker.style.display === 'none' ? 'grid' : 'none';
        });
    }
    
    if (emojiPicker && chatInput) {
        document.querySelectorAll('.emoji').forEach(emoji => {
            emoji.addEventListener('click', () => {
                chatInput.value += emoji.dataset.emoji;
                emojiPicker.style.display = 'none';
                chatInput.focus();
            });
        });
    }
}

function addChatMessage(data) {
    const chatMessages = document.getElementById('chat-messages');
    if (!chatMessages) return;
    
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

// 复制房间号
function copyRoomId(elementId) {
    const roomId = document.getElementById(elementId).textContent;
    navigator.clipboard.writeText(roomId).then(() => {
        showError('房间号已复制到剪贴板');
    });
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

// 初始化函数
function initialize() {
    // 初始化Socket连接
    initializeSocket();
    
    // 标签页切换
    document.querySelectorAll('.tab-btn').forEach(button => {
        button.addEventListener('click', () => {
            const tabId = button.dataset.tab;
            document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
            document.querySelectorAll('.tab-pane').forEach(content => content.classList.remove('active'));
            button.classList.add('active');
            document.getElementById(`${tabId}-tab`).classList.add('active');
        });
    });
    
    // 头像选择
    document.querySelectorAll('.avatar-option').forEach(option => {
        option.addEventListener('click', () => {
            const parent = option.closest('.avatar-options');
            parent.querySelectorAll('.avatar-option').forEach(opt => opt.classList.remove('selected'));
            option.classList.add('selected');
        });
    });
    
    // 创建房间按钮
    const createRoomBtn = document.getElementById('create-room-btn');
    if (createRoomBtn) {
        createRoomBtn.addEventListener('click', handleCreateRoom);
    }
    
    // 加入房间按钮
    const joinRoomBtn = document.getElementById('join-room-btn');
    if (joinRoomBtn) {
        joinRoomBtn.addEventListener('click', handleJoinRoom);
    }
    
    // 进入房间按钮
    const enterRoomBtn = document.getElementById('enter-room-btn');
    if (enterRoomBtn) {
        enterRoomBtn.addEventListener('click', handleEnterRoom);
    }
    
    // 复制房间号
    const copyRoomIdBtn = document.getElementById('copy-room-id');
    if (copyRoomIdBtn) {
        copyRoomIdBtn.addEventListener('click', () => copyRoomId('created-room-id'));
    }
    
    const copyGameRoomIdBtn = document.getElementById('copy-game-room-id');
    if (copyGameRoomIdBtn) {
        copyGameRoomIdBtn.addEventListener('click', () => copyRoomId('display-room-id'));
    }
    
    const copyWaitingRoomIdBtn = document.getElementById('copy-waiting-room-id');
    if (copyWaitingRoomIdBtn) {
        copyWaitingRoomIdBtn.addEventListener('click', () => copyRoomId('room-id-value'));
    }
    
    // 开始游戏按钮
    const startGameBtn = document.getElementById('start-game-btn');
    if (startGameBtn) {
        startGameBtn.addEventListener('click', handleStartGame);
    }
    
    // 游戏操作按钮
    const foldBtn = document.getElementById('fold-btn');
    if (foldBtn) {
        foldBtn.addEventListener('click', () => performAction('fold'));
    }
    
    const checkBtn = document.getElementById('check-btn');
    if (checkBtn) {
        checkBtn.addEventListener('click', () => performAction('check'));
    }
    
    const callBtn = document.getElementById('call-btn');
    if (callBtn) {
        callBtn.addEventListener('click', () => performAction('call'));
    }
    
    const raiseBtn = document.getElementById('raise-btn');
    if (raiseBtn) {
        raiseBtn.addEventListener('click', () => {
            const amount = document.getElementById('raise-amount').value;
            if (amount) {
                performAction('raise', parseInt(amount));
            }
        });
    }
    
    const allInBtn = document.getElementById('all-in-btn');
    if (allInBtn) {
        allInBtn.addEventListener('click', () => performAction('all_in'));
    }
    
    // 初始化排行榜
    initializeLeaderboard();
}

// 排行榜功能
function initializeLeaderboard() {
    const leaderboardToggle = document.getElementById('leaderboard-toggle');
    const leaderboardPanel = document.getElementById('leaderboard-panel');
    const closeLeaderboard = document.getElementById('close-leaderboard');
    const leaderboardTabs = document.querySelectorAll('.leaderboard-tab');
    
    if (leaderboardToggle && leaderboardPanel) {
        leaderboardToggle.addEventListener('click', () => {
            leaderboardPanel.classList.add('active');
            updateLeaderboard();
        });
    }
    
    if (closeLeaderboard && leaderboardPanel) {
        closeLeaderboard.addEventListener('click', () => {
            leaderboardPanel.classList.remove('active');
        });
    }
    
    if (leaderboardTabs.length) {
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
    }
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
    if (!tbody) return;
    
    tbody.innerHTML = data.map((player, index) => `
        <tr>
            <td class="rank-number">#${index + 1}</td>
            <td>
                <div class="player-info">
                    <div class="player-avatar">
                        <i class="fas fa-${player.avatar}"></i>
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
    if (!tbody) return;
    
    tbody.innerHTML = data.map((player, index) => `
        <tr>
            <td class="rank-number">#${index + 1}</td>
            <td>
                <div class="player-info">
                    <div class="player-avatar">
                        <i class="fas fa-${player.avatar}"></i>
                    </div>
                    <span>${player.username}</span>
                </div>
            </td>
            <td class="chips-amount">${player.highest_chips}</td>
            <td class="games-played">${player.games_played}场</td>
        </tr>
    `).join('');
}

// 游戏逻辑函数 (未实现的函数保留接口)
function dealCards(data) {
    console.log("发牌数据:", data);
    // 实现逻辑后面补充
}

function updatePlayerTurn(data) {
    console.log("玩家回合数据:", data);
    // 实现逻辑后面补充
}

function startTimer() {
    console.log("启动计时器");
    // 实现逻辑后面补充
}

function updateGameState(data) {
    console.log("游戏状态更新:", data);
    // 实现逻辑后面补充
}

function showGameResults(data) {
    console.log("游戏结果:", data);
    // 实现逻辑后面补充
}

function initializeGame(data) {
    console.log("初始化游戏:", data);
    // 实现逻辑后面补充
}

// 当页面加载完成时初始化
document.addEventListener('DOMContentLoaded', initialize); 