// 建立WebSocket连接
const socket = io();

// 游戏状态
let gameState = {
    username: '',
    room: '',
    avatar: 'avatar1', // 默认头像
    players: [],
    currentPlayer: null,
    myCards: [],
    communityCards: [],
    pot: 0,
    myChips: 1000,
    currentBet: 0,
    gameStatus: 'waiting', // waiting, playing, finished
    isHost: false, // 是否为房主
    initialChips: 1000, // Assuming a default initialChips value
    status: 'waiting', // Assuming a default status value
    smallBlind: 10,
    bigBlind: 20,
    allInRounds: 3
};

// DOM元素
const loginScreen = document.getElementById('login-screen');
const gameScreen = document.getElementById('game-screen');
const createTab = document.getElementById('create-tab');
const joinTab = document.getElementById('join-tab');
const tabBtns = document.querySelectorAll('.tab-btn');
const avatarOptions = document.querySelectorAll('.avatar-option');
const createUsernameInput = document.getElementById('create-username');
const joinUsernameInput = document.getElementById('join-username');
const roomIdInput = document.getElementById('room-id');
const smallBlindInput = document.getElementById('small-blind');
const bigBlindInput = document.getElementById('big-blind');
const allInRoundsInput = document.getElementById('all-in-rounds');
const initialChipsInput = document.getElementById('initial-chips');
const createRoomBtn = document.getElementById('create-room-btn');
const joinRoomBtn = document.getElementById('join-room-btn');
const roomCreatedModal = document.getElementById('room-created');
const createdRoomId = document.getElementById('created-room-id');
const copyRoomIdBtn = document.getElementById('copy-room-id');
const enterRoomBtn = document.getElementById('enter-room-btn');
const displayRoomId = document.getElementById('display-room-id');
const copyGameRoomIdBtn = document.getElementById('copy-game-room-id');
const gameStatusText = document.getElementById('game-status-text');
const playersContainer = document.getElementById('players-container');
const communityCardsContainer = document.getElementById('community-cards');
const playerCardsContainer = document.getElementById('player-cards');
const potAmount = document.getElementById('pot-amount');
const playerName = document.getElementById('player-name');
const playerAvatarIcon = document.getElementById('player-avatar-icon');
const playerChips = document.getElementById('player-chips');
const currentBet = document.getElementById('current-bet');
const raiseAmount = document.getElementById('raise-amount');
const raiseSlider = document.getElementById('raise-slider');
const actionTimer = document.getElementById('action-timer');
const timerProgress = document.querySelector('.timer-progress');
const timerSeconds = document.querySelector('.timer-seconds');
const waitingPanel = document.getElementById('waiting-panel');
const currentPlayerCount = document.getElementById('current-player-count');
const waitingPlayersList = document.getElementById('waiting-players');
const hostControls = document.getElementById('host-controls');
const startGameBtn = document.getElementById('start-game-btn');
const roomIdValue = document.getElementById('room-id-value');

// 聊天系统逻辑
const chatToggle = document.getElementById('chat-toggle');
const chatContainer = document.querySelector('.chat-container');
const closeChat = document.getElementById('close-chat');
const chatMessages = document.getElementById('chat-messages');
const chatInput = document.getElementById('chat-input');
const sendMessage = document.getElementById('send-message');
const showEmojis = document.getElementById('show-emojis');
const emojiPickerContainer = document.querySelector('.emoji-picker-container');
const emojis = document.querySelectorAll('.emoji');
const pokerTable = document.querySelector('.poker-table');

// 排行榜逻辑
const leaderboardToggle = document.getElementById('leaderboard-toggle');
const leaderboardPanel = document.getElementById('leaderboard-panel');
const closeLeaderboard = document.getElementById('close-leaderboard');
const leaderboardTabs = document.querySelectorAll('.leaderboard-tab');
const roomLeaderboard = document.getElementById('room-leaderboard');
const historyLeaderboard = document.getElementById('history-leaderboard');
const roomLeaderboardBody = document.getElementById('room-leaderboard-body');
const historyLeaderboardBody = document.getElementById('history-leaderboard-body');

// 记录玩家初始筹码
const initialChips = {};
// 记录历史最高筹码
const playerStats = JSON.parse(localStorage.getItem('pokerPlayerStats') || '{}');

// 游戏历史回看逻辑
const historyPanel = document.getElementById('history-panel');
const closeHistory = document.getElementById('close-history');
const historyPrev = document.getElementById('history-prev');
const historyNext = document.getElementById('history-next');
const historyStage = document.getElementById('history-stage');
const timelineProgressBar = document.getElementById('timeline-progress-bar');
const historyCommunityCards = document.getElementById('history-community-cards');
const historyPot = document.getElementById('history-pot');
const historyPlayersContainer = document.getElementById('history-players-container');

// 历史记录状态
let gameHistory = [];
let currentHistoryIndex = 0;
const stageNames = ['发牌前', '翻牌圈', '转牌圈', '河牌圈', '摊牌'];

// 性能设置
const performanceToggle = document.getElementById('performance-toggle');
const performanceMenu = document.getElementById('performance-menu');
const toggleAnimations = document.getElementById('toggle-animations');
const toggleBlur = document.getElementById('toggle-blur');
const animationSpeed = document.getElementById('animation-speed');

// 生成随机房间ID
function generateRoomId() {
    return Math.floor(100000 + Math.random() * 900000).toString();
}

// 切换标签页
tabBtns.forEach(btn => {
    btn.addEventListener('click', () => {
        const targetTab = btn.dataset.tab;
        tabBtns.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        
        document.querySelectorAll('.tab-pane').forEach(pane => {
            pane.classList.remove('active');
        });
        
        document.getElementById(`${targetTab}-tab`).classList.add('active');
    });
});

// 选择头像
avatarOptions.forEach(option => {
    option.addEventListener('click', () => {
        const container = option.closest('.avatar-options');
        container.querySelectorAll('.avatar-option').forEach(o => {
            o.classList.remove('selected');
        });
        option.classList.add('selected');
        gameState.avatar = option.dataset.avatar;
    });
});

// 删除旧的复制函数，统一使用navigator.clipboard API
function copyToClipboard(text) {
    // 使用现代的Clipboard API
    navigator.clipboard.writeText(text).then(() => {
        // 显示复制成功提示
        showMessage('房间号已复制到剪贴板', 'success');
    }).catch(err => {
        console.error('复制失败: ', err);
        // 回退到旧方法
        const textArea = document.createElement('textarea');
        textArea.value = text;
        document.body.appendChild(textArea);
        textArea.select();
        document.execCommand('copy');
        document.body.removeChild(textArea);
        showMessage('房间号已复制到剪贴板', 'success');
    });
}

// 统一显示消息函数
function showMessage(message, type = 'info') {
    // 检查是否已有消息元素
    let messageElement = document.getElementById('toast-message');
    
    if (!messageElement) {
        // 创建新的消息元素
        messageElement = document.createElement('div');
        messageElement.id = 'toast-message';
        messageElement.className = 'toast-message';
        document.body.appendChild(messageElement);
    }
    
    // 设置消息类型和内容
    messageElement.className = `toast-message ${type}`;
    messageElement.textContent = message;
    messageElement.style.display = 'block';
    
    // 淡出效果
    setTimeout(() => {
        messageElement.style.opacity = '0';
        setTimeout(() => {
            messageElement.style.display = 'none';
            messageElement.style.opacity = '1';
        }, 500);
    }, 2000);
}

// 更新复制按钮点击事件，使用统一的样式和动画
copyRoomIdBtn.addEventListener('click', function() {
    const roomId = roomIdValue.textContent;
    copyToClipboard(roomId);
    
    // 视觉反馈
    const originalText = copyRoomIdBtn.textContent;
    const originalBg = copyRoomIdBtn.style.background;
    
    copyRoomIdBtn.textContent = '已复制!';
    copyRoomIdBtn.style.background = '#34c759'; // 苹果风格的绿色
    
    setTimeout(() => {
        copyRoomIdBtn.textContent = originalText;
        copyRoomIdBtn.style.background = originalBg;
    }, 2000);
});

copyGameRoomIdBtn.addEventListener('click', () => {
    const roomId = displayRoomId.textContent;
    copyToClipboard(roomId);
    
    // 视觉反馈
    const originalText = copyGameRoomIdBtn.innerHTML;
    const originalBg = copyGameRoomIdBtn.style.background;
    
    copyGameRoomIdBtn.innerHTML = '<i class="fas fa-check"></i>';
    copyGameRoomIdBtn.style.background = '#34c759'; // 苹果风格的绿色
    
    setTimeout(() => {
        copyGameRoomIdBtn.innerHTML = originalText;
        copyGameRoomIdBtn.style.background = originalBg;
    }, 2000);
});

// 创建房间
document.getElementById('create-room-btn').addEventListener('click', () => {
    const username = document.getElementById('create-username').value.trim();
    
    if (!username) {
        alert('请输入您的昵称');
        return;
    }
    
    // 获取选中的头像
    const selectedAvatarElement = document.querySelector('.avatar-option.selected');
    const selectedAvatar = selectedAvatarElement ? selectedAvatarElement.getAttribute('data-avatar') : 'avatar1';
    
    // 生成房间ID并显示在创建成功提示中
    const roomId = generateRoomId();
    document.getElementById('created-room-id').textContent = roomId;
    
    // 保存用户选择的设置
    const smallBlind = parseInt(document.getElementById('small-blind').value) || 10;
    const bigBlind = parseInt(document.getElementById('big-blind').value) || 20;
    const allInRounds = parseInt(document.getElementById('all-in-rounds').value) || 3;
    const initialChips = parseInt(document.getElementById('initial-chips').value) || 1000;
    
    // 保存房间设置
    gameState.smallBlind = smallBlind;
    gameState.bigBlind = bigBlind;
    gameState.allInRounds = allInRounds;
    gameState.initialChips = initialChips;
    gameState.room = roomId;
    gameState.username = username;
    gameState.isHost = true;
    gameState.avatar = selectedAvatar;
    
    // 显示房间创建成功提示
    document.getElementById('room-created').classList.remove('hidden');
    
    // 同时更新游戏界面中的房间号显示
    document.getElementById('display-room-id').textContent = roomId;
    
    // 切换到等待面板
    switchToWaitingPanel(true);
    
    // 发送创建房间事件到服务器
    socket.emit('create_room', {
        room_id: roomId,
        username: username,
        avatar: selectedAvatar
    });
});

// 点击进入房间按钮
document.getElementById('enter-room-btn').addEventListener('click', () => {
    // 隐藏房间创建成功提示
    document.getElementById('room-created').classList.add('hidden');
    
    // 加入游戏
    joinGame(gameState.username, gameState.room, {
        small_blind: gameState.smallBlind,
        big_blind: gameState.bigBlind,
        all_in_rounds: gameState.allInRounds,
        initial_chips: gameState.initialChips,
        is_host: true
    });
    
    // 更新玩家信息
    document.getElementById('player-name').textContent = gameState.username;
    updatePlayerAvatar(gameState.avatar);
    
    // 显示游戏界面
    document.getElementById('login-screen').classList.add('hidden');
    document.getElementById('game-screen').classList.remove('hidden');
    
    // 确保房间号在游戏界面中正确显示
    document.getElementById('display-room-id').textContent = gameState.room;
    
    // 延迟一下，等聊天功能初始化完成后添加系统消息
    setTimeout(() => {
        if (typeof addChatMessage === 'function') {
            addChatMessage('System', `您已创建房间，房间号：${gameState.room}，请邀请好友加入。`);
            addChatMessage('System', `至少需要4位玩家才能开始游戏。`);
        }
    }, 500);
});

// 加入房间
document.getElementById('join-room-btn').addEventListener('click', () => {
    const username = joinUsernameInput.value.trim();
    const roomId = roomIdInput.value.trim();
    
    if (!username || !roomId) {
        alert('请输入用户名和房间号');
        return;
    }
    
    joinGame(username, roomId, { is_host: false });
});

// 房主开始游戏
document.getElementById('start-game-btn').addEventListener('click', () => {
    if (!startGameBtn.disabled) {
        socket.emit('start_game', { room: gameState.room });
    }
});

// 加入游戏
function joinGame(username, room, settings = {}) {
    gameState.username = username;
    gameState.room = room;
    gameState.isHost = settings.is_host || false;
    
    const joinData = {
        username,
        room,
        avatar: gameState.avatar,
        ...settings
    };
    
    socket.emit('join_game', joinData);
    
    // 更新界面
    playerName.textContent = username;
    displayRoomId.textContent = room;
    
    // 设置头像
    updatePlayerAvatar(gameState.avatar);
    
    // 隐藏登录界面，显示游戏界面
    loginScreen.classList.add('hidden');
    roomCreatedModal.classList.add('hidden');
    gameScreen.classList.remove('hidden');
    
    // 如果不是房主，隐藏开始游戏按钮
    if (!gameState.isHost) {
        hostControls.style.display = 'none';
    }
    
    // 切换到等待面板
    switchToWaitingPanel(false);
}

// 切换到等待面板
function switchToWaitingPanel(isHost) {
    // 隐藏其他面板
    loginScreen.style.display = 'none';
    roomCreatedModal.style.display = 'none';
    gameScreen.style.display = 'none';
    // 显示等待面板
    waitingPanel.style.display = 'block';
    
    // 根据是否是房主显示或隐藏房主控制区
    hostControls.style.display = isHost ? 'block' : 'none';
    
    // 更新游戏状态
    gameState.isHost = isHost;
}

// 更新等待玩家列表
function updateWaitingPlayers() {
    // 清空现有内容
    waitingPlayersList.innerHTML = '';
    
    // 确保玩家数组已加载
    if (!gameState.players) return;
    
    // 更新当前玩家数量
    currentPlayerCount.textContent = gameState.players.length;
    
    // 显示房间号
    roomIdValue.textContent = gameState.room;
    
    // 添加每个玩家到列表
    gameState.players.forEach(player => {
        const playerElement = document.createElement('div');
        playerElement.className = 'waiting-player';
        
        const avatarElement = document.createElement('div');
        avatarElement.className = 'waiting-player-avatar';
        avatarElement.innerHTML = getAvatarSVG(player.avatar);
        
        const nameElement = document.createElement('div');
        nameElement.className = 'waiting-player-name';
        nameElement.textContent = player.username;
        
        // 如果是房主，添加标签
        if (player.isHost) {
            const hostTag = document.createElement('span');
            hostTag.className = 'host-tag';
            hostTag.textContent = '房主';
            nameElement.appendChild(hostTag);
        }
        
        playerElement.appendChild(avatarElement);
        playerElement.appendChild(nameElement);
        waitingPlayersList.appendChild(playerElement);
    });
    
    // 如果是房主并且有足够的玩家，启用开始游戏按钮
    if (gameState.isHost && gameState.players.length >= 2) {
        document.getElementById('start-game-btn').disabled = false;
        document.getElementById('start-game-btn').textContent = '开始游戏';
    } else if (gameState.isHost) {
        document.getElementById('start-game-btn').disabled = true;
        document.getElementById('start-game-btn').textContent = `开始游戏 (至少需要2位玩家)`;
    }
}

// 更新玩家头像
function updatePlayerAvatar(avatar) {
    // 移除所有图标类
    playerAvatarIcon.className = '';
    
    // 根据头像类型设置图标
    switch(avatar) {
        case 'avatar1':
            playerAvatarIcon.className = 'fas fa-user-tie';
            break;
        case 'avatar2':
            playerAvatarIcon.className = 'fas fa-user-ninja';
            break;
        case 'avatar3':
            playerAvatarIcon.className = 'fas fa-user-astronaut';
            break;
        case 'avatar4':
            playerAvatarIcon.className = 'fas fa-user-secret';
            break;
        case 'avatar5':
            playerAvatarIcon.className = 'fas fa-user-crown';
            break;
        default:
            playerAvatarIcon.className = 'fas fa-user';
    }
}

// 玩家位置计算
function calculatePlayerPositions(totalPlayers) {
    const positions = [];
    const centerX = 50;
    const centerY = 50;
    const radius = 40;

    for (let i = 0; i < totalPlayers; i++) {
        const angle = (i * 2 * Math.PI / totalPlayers) - Math.PI / 2;
        const x = centerX + radius * Math.cos(angle);
        const y = centerY + radius * Math.sin(angle);
        positions.push({ x, y });
    }

    return positions;
}

// 渲染玩家座位
function renderPlayers() {
    playersContainer.innerHTML = '';
    const positions = calculatePlayerPositions(gameState.players.length);

    gameState.players.forEach((player, index) => {
        const seat = document.createElement('div');
        seat.className = 'player-seat';
        if (player.username === gameState.currentPlayer) {
            seat.classList.add('active');
        }
        
        seat.style.left = `${positions[index].x}%`;
        seat.style.top = `${positions[index].y}%`;
        seat.style.transform = 'translate(-50%, -50%)';

        seat.innerHTML = `
            <div class="avatar">
                <i class="${getAvatarClass(player.avatar)}"></i>
            </div>
            <div>${player.username}</div>
            <div class="chips">${player.chips} 筹码</div>
            ${player.bet > 0 ? `<div class="bet">${player.bet}</div>` : ''}
            ${player.username === gameState.currentPlayer ? '<div class="timer"><div class="timer-bar"></div></div>' : ''}
        `;

        playersContainer.appendChild(seat);
    });
}

// 获取头像类名
function getAvatarClass(avatar) {
    switch(avatar) {
        case 'avatar1': return 'fas fa-user-tie';
        case 'avatar2': return 'fas fa-user-ninja';
        case 'avatar3': return 'fas fa-user-astronaut';
        case 'avatar4': return 'fas fa-user-secret';
        case 'avatar5': return 'fas fa-user-crown';
        default: return 'fas fa-user';
    }
}

// 渲染公共牌
function renderCommunityCards() {
    communityCardsContainer.innerHTML = '';
    gameState.communityCards.forEach(card => {
        const cardElement = createCardElement(card);
        communityCardsContainer.appendChild(cardElement);
    });
    
    // 如果公共牌不足5张，添加背面朝上的牌
    const remainingCards = 5 - gameState.communityCards.length;
    for (let i = 0; i < remainingCards; i++) {
        const cardBack = document.createElement('div');
        cardBack.className = 'card card-back';
        communityCardsContainer.appendChild(cardBack);
    }
}

// 渲染玩家手牌
function renderPlayerCards() {
    playerCardsContainer.innerHTML = '';
    gameState.myCards.forEach(card => {
        const cardElement = createCardElement(card);
        playerCardsContainer.appendChild(cardElement);
    });
    
    // 如果没有手牌，显示两张背面朝上的牌
    if (gameState.myCards.length === 0) {
        for (let i = 0; i < 2; i++) {
            const cardBack = document.createElement('div');
            cardBack.className = 'card card-back';
            playerCardsContainer.appendChild(cardBack);
        }
    }
}

// 创建扑克牌元素
function createCardElement(card) {
    const cardElement = document.createElement('div');
    cardElement.className = 'card';
    
    // 红色花色：红桃和方块
    const isRedSuit = card.suit === 'hearts' || card.suit === 'diamonds';
    
    const valueElement = document.createElement('div');
    valueElement.className = `card-value ${isRedSuit ? 'red' : ''}`;
    valueElement.textContent = getCardValueDisplay(card.value);
    
    const suitElement = document.createElement('div');
    suitElement.className = `card-suit ${isRedSuit ? 'red' : ''}`;
    suitElement.innerHTML = getSuitSymbol(card.suit);
    
    cardElement.appendChild(valueElement);
    cardElement.appendChild(suitElement);
    
    return cardElement;
}

// 获取花色符号
function getSuitSymbol(suit) {
    const suits = {
        'hearts': '♥',
        'diamonds': '♦',
        'clubs': '♣',
        'spades': '♠'
    };
    return suits[suit] || suit;
}

// 获取牌面值显示
function getCardValueDisplay(value) {
    // 转换J, Q, K, A为更友好的显示
    const valueMap = {
        'J': 'J',
        'Q': 'Q',
        'K': 'K',
        'A': 'A'
    };
    return valueMap[value] || value;
}

// 更新游戏状态显示
function updateGameStatus(status) {
    const statusMessages = {
        'waiting': '等待玩家加入...',
        'playing': '游戏进行中',
        'preflop': '翻牌前',
        'flop': '翻牌圈',
        'turn': '转牌圈',
        'river': '河牌圈',
        'showdown': '摊牌',
        'finished': '游戏结束'
    };
    
    gameStatusText.textContent = statusMessages[status] || status;
    
    // 如果状态是等待玩家，显示等待面板
    if (status === 'waiting') {
        waitingPanel.style.display = 'flex';
        updateWaitingPlayers();
    } else {
        waitingPanel.style.display = 'none';
    }
}

// 更新计时器
function startTimer(seconds = 30) {
    clearInterval(gameState.timerInterval);
    
    timerSeconds.textContent = seconds;
    timerProgress.style.width = '100%';
    
    let timeLeft = seconds;
    gameState.timerInterval = setInterval(() => {
        timeLeft--;
        timerSeconds.textContent = timeLeft;
        timerProgress.style.width = `${(timeLeft / seconds) * 100}%`;
        
        if (timeLeft <= 0) {
            clearInterval(gameState.timerInterval);
        }
    }, 1000);
}

// 游戏操作按钮事件
document.getElementById('fold-btn').addEventListener('click', () => {
    socket.emit('player_action', { 
        action: 'fold',
        username: gameState.username
    });
});

document.getElementById('check-btn').addEventListener('click', () => {
    socket.emit('player_action', { 
        action: 'check',
        username: gameState.username
    });
});

document.getElementById('call-btn').addEventListener('click', () => {
    socket.emit('player_action', { 
        action: 'call',
        username: gameState.username
    });
});

document.getElementById('raise-btn').addEventListener('click', () => {
    const amount = parseInt(raiseAmount.value);
    if (isNaN(amount) || amount <= 0) {
        alert('请输入有效的加注金额');
        return;
    }
    socket.emit('player_action', { 
        action: 'raise', 
        amount,
        username: gameState.username
    });
});

document.getElementById('all-in-btn').addEventListener('click', () => {
    socket.emit('player_action', { 
        action: 'all-in',
        username: gameState.username
    });
});

// 加注滑块联动
raiseSlider.addEventListener('input', () => {
    raiseAmount.value = raiseSlider.value;
});

raiseAmount.addEventListener('input', () => {
    const value = parseInt(raiseAmount.value);
    if (!isNaN(value) && value >= 0 && value <= parseInt(raiseSlider.max)) {
        raiseSlider.value = value;
    }
});

// Socket.io 事件处理
socket.on('game_update', (data) => {
    gameState.players = data.players;
    gameState.currentPlayer = data.current_player;
    gameState.pot = data.pot;
    gameState.gameStatus = data.status;
    
    // 更新界面
    renderPlayers();
    potAmount.textContent = gameState.pot;
    updateGameStatus(gameState.gameStatus);
    
    // 如果是当前玩家的回合，开始计时器
    if (gameState.currentPlayer === gameState.username) {
        startTimer(30);
    }
    
    // 如果游戏刚刚开始，记录所有玩家的初始筹码
    if (data.status === 'preflop' && gameState.status !== 'preflop') {
        data.players.forEach(player => {
            initialChips[player.username] = player.chips;
        });
    }
    
    // 游戏结束时，更新历史记录
    if (data.status === 'finished' && gameState.status !== 'finished') {
        data.players.forEach(player => {
            if (player.username === gameState.username) {
                updatePlayerStats(player.username, player.avatar, player.chips);
            }
        });
    }
    
    // 检查玩家列表变化，添加系统消息
    if (gameState.players) {
        const oldUsernames = gameState.players.map(p => p.username);
        const newUsernames = data.players.map(p => p.username);
        
        // 查找新加入的玩家
        for (const username of newUsernames) {
            if (!oldUsernames.includes(username) && username !== gameState.username) {
                addChatMessage('System', `${username} 加入了房间`);
            }
        }
        
        // 查找离开的玩家
        for (const username of oldUsernames) {
            if (!newUsernames.includes(username)) {
                addChatMessage('System', `${username} 离开了房间`);
            }
        }
    }
    
    // 更新gameState中的玩家列表
    gameState.players = data.players;
    
    // 记录游戏状态到历史记录
    recordGameState(data);
});

socket.on('deal_cards', (data) => {
    gameState.myCards = data.cards;
    renderPlayerCards();
    
    // 记录游戏状态到历史记录
});

socket.on('community_cards', (data) => {
    gameState.communityCards = data.cards;
    renderCommunityCards();
});

socket.on('player_stats', (data) => {
    if (data.username === gameState.username) {
        gameState.myChips = data.chips;
        gameState.currentBet = data.current_bet;
        
        // 更新界面
        playerChips.textContent = data.chips;
        currentBet.textContent = data.current_bet;
        
        // 更新加注滑块的最大值
        raiseSlider.max = data.chips;
    }
});

socket.on('game_result', (data) => {
    const resultContainer = document.getElementById('winners-list');
    resultContainer.innerHTML = '';
    
    data.winners.forEach(winner => {
        const winnerItem = document.createElement('div');
        winnerItem.className = 'winner-item';
        winnerItem.innerHTML = `
            <div class="winner-avatar">
                <i class="${getAvatarClass(winner.avatar)}"></i>
            </div>
            <div class="winner-info">
                <div class="winner-name">${winner.username}</div>
                <div class="hand-name">${winner.hand_name}</div>
            </div>
            <div class="winner-pot">+${winner.amount}</div>
        `;
        resultContainer.appendChild(winnerItem);
    });
    
    document.getElementById('game-result').classList.remove('hidden');
    
    // 更新排行榜
    setTimeout(() => {
        updateRoomLeaderboard();
    }, 1000);
});

document.getElementById('next-game-btn').addEventListener('click', () => {
    // 隐藏游戏结果面板
    document.getElementById('game-result').classList.add('hidden');
    
    // 发送下一局请求
    socket.emit('next_game', {
        room: gameState.room,
        username: gameState.username
    });
    
    // 更新游戏状态
    updateGameStatus('等待新一局开始...');
});

socket.on('error', (data) => {
    alert(data.message);
});

// 初始化
renderPlayerCards();
renderCommunityCards();

// 聊天框显示/隐藏
chatToggle.addEventListener('click', () => {
    chatContainer.style.display = chatContainer.style.display === 'none' || chatContainer.style.display === '' ? 'flex' : 'none';
    if (chatContainer.style.display === 'flex') {
        chatInput.focus();
        // 滚动到聊天记录底部
        chatMessages.scrollTop = chatMessages.scrollHeight;
    }
});

closeChat.addEventListener('click', () => {
    chatContainer.style.display = 'none';
});

// 表情选择器显示/隐藏
showEmojis.addEventListener('click', () => {
    emojiPickerContainer.style.display = emojiPickerContainer.style.display === 'none' || emojiPickerContainer.style.display === '' ? 'block' : 'none';
});

// 点击表情
emojis.forEach(emoji => {
    emoji.addEventListener('click', () => {
        const emojiChar = emoji.getAttribute('data-emoji');
        chatInput.value += emojiChar;
        chatInput.focus();
        emojiPickerContainer.style.display = 'none';
    });
});

// 发送消息
function sendChatMessage() {
    const message = chatInput.value.trim();
    if (message) {
        // 发送消息到服务器
        socket.emit('chat_message', {
            username: gameState.username,
            room: gameState.room,
            message: message
        });
        
        // 如果用户只发送了一个表情符号，则触发表情动画
        if (message.length <= 2 && /\p{Emoji}/u.test(message)) {
            showEmojiAnimation(message, true);
        }
        
        chatInput.value = '';
    }
}

sendMessage.addEventListener('click', sendChatMessage);

chatInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
        sendChatMessage();
    }
});

// 显示聊天消息
socket.on('chat_message', (data) => {
    addChatMessage(data.username, data.message, data.timestamp);
    
    // 如果用户只发送了一个表情符号，则触发表情动画
    if (data.message.length <= 2 && /\p{Emoji}/u.test(data.message) && data.username !== gameState.username) {
        showEmojiAnimation(data.message, false);
    }
});

// 添加聊天消息到聊天框
function addChatMessage(username, message, timestamp = null) {
    const messageElement = document.createElement('div');
    messageElement.className = `chat-message ${username === gameState.username ? 'self' : username === 'System' ? 'system' : 'other'}`;
    
    // 如果不是系统消息，显示发送者名称
    if (username !== 'System') {
        const senderElement = document.createElement('div');
        senderElement.className = 'message-sender';
        senderElement.textContent = username;
        messageElement.appendChild(senderElement);
    }
    
    const contentElement = document.createElement('div');
    contentElement.className = 'message-content';
    contentElement.textContent = message;
    messageElement.appendChild(contentElement);
    
    if (timestamp) {
        const timeElement = document.createElement('div');
        timeElement.className = 'message-time';
        timeElement.textContent = new Date(timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        messageElement.appendChild(timeElement);
    } else {
        const timeElement = document.createElement('div');
        timeElement.className = 'message-time';
        timeElement.textContent = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        messageElement.appendChild(timeElement);
    }
    
    chatMessages.appendChild(messageElement);
    
    // 滚动到底部
    chatMessages.scrollTop = chatMessages.scrollHeight;
    
    // 如果聊天框是隐藏的，显示未读消息提示
    if (chatContainer.style.display === 'none' || chatContainer.style.display === '') {
        chatToggle.classList.add('unread');
    }
}

// 在游戏桌面显示表情动画
function showEmojiAnimation(emoji, isSelf) {
    const emojiElement = document.createElement('div');
    emojiElement.className = 'game-emoji';
    emojiElement.textContent = emoji;
    
    // 设置表情的起始位置
    const playerSeats = document.querySelectorAll('.player-seat');
    let startPosition;
    
    if (isSelf) {
        // 如果是自己发送的表情，从自己的座位开始
        // 假设自己的座位样式上有所区分，或者是第一个座位
        startPosition = playerSeats[0].getBoundingClientRect();
    } else {
        // 如果是其他玩家发送的表情，从随机玩家座位开始
        const randomIndex = Math.floor(Math.random() * playerSeats.length);
        startPosition = playerSeats[randomIndex].getBoundingClientRect();
    }
    
    // 计算表情在poker-table内的位置
    const tableRect = pokerTable.getBoundingClientRect();
    emojiElement.style.left = `${startPosition.left - tableRect.left + (startPosition.width / 2)}px`;
    emojiElement.style.top = `${startPosition.top - tableRect.top + (startPosition.height / 2)}px`;
    
    pokerTable.appendChild(emojiElement);
    
    // 动画结束后移除元素
    emojiElement.addEventListener('animationend', () => {
        emojiElement.remove();
    });
}

// 系统消息
socket.on('system_message', (data) => {
    addChatMessage('System', data.message, data.timestamp);
});

// 排行榜标签切换
leaderboardTabs.forEach(tab => {
    tab.addEventListener('click', () => {
        // 取消所有标签的active状态
        leaderboardTabs.forEach(t => t.classList.remove('active'));
        // 添加当前标签的active状态
        tab.classList.add('active');
        
        // 隐藏所有面板
        roomLeaderboard.classList.remove('active');
        historyLeaderboard.classList.remove('active');
        
        // 显示对应面板
        const tabName = tab.getAttribute('data-tab');
        if (tabName === 'room') {
            roomLeaderboard.classList.add('active');
            updateRoomLeaderboard();
        } else if (tabName === 'history') {
            historyLeaderboard.classList.add('active');
            updateHistoryLeaderboard();
        }
    });
});

// 排行榜显示/隐藏
leaderboardToggle.addEventListener('click', () => {
    leaderboardPanel.style.display = leaderboardPanel.style.display === 'none' || leaderboardPanel.style.display === '' ? 'block' : 'none';
    
    if (leaderboardPanel.style.display === 'block') {
        // 默认显示房间排行榜
        updateRoomLeaderboard();
    }
});

closeLeaderboard.addEventListener('click', () => {
    leaderboardPanel.style.display = 'none';
});

// 更新房间排行榜
function updateRoomLeaderboard() {
    if (!gameState.players || gameState.players.length === 0) return;
    
    // 清空当前排行榜
    roomLeaderboardBody.innerHTML = '';
    
    // 克隆并按筹码排序
    const sortedPlayers = [...gameState.players].sort((a, b) => b.chips - a.chips);
    
    // 生成排行榜
    sortedPlayers.forEach((player, index) => {
        const row = document.createElement('tr');
        
        // 排名
        const rankCell = document.createElement('td');
        rankCell.className = `rank-cell rank-${index + 1}`;
        rankCell.textContent = index + 1;
        
        // 玩家信息
        const playerCell = document.createElement('td');
        playerCell.className = 'player-cell';
        
        const avatarElement = document.createElement('div');
        avatarElement.className = 'leaderboard-avatar';
        avatarElement.innerHTML = `<i class="fas ${getAvatarClass(player.avatar)}"></i>`;
        
        const nameElement = document.createElement('span');
        nameElement.textContent = player.username;
        
        playerCell.appendChild(avatarElement);
        playerCell.appendChild(nameElement);
        
        // 当前筹码
        const chipsCell = document.createElement('td');
        chipsCell.textContent = player.chips;
        
        // 净赢得
        const netWinCell = document.createElement('td');
        const initialChip = initialChips[player.username] || gameState.initialChips || 1000;
        const netWin = player.chips - initialChip;
        
        if (netWin > 0) {
            netWinCell.className = 'positive-change';
            netWinCell.textContent = `+${netWin}`;
        } else if (netWin < 0) {
            netWinCell.className = 'negative-change';
            netWinCell.textContent = netWin;
        } else {
            netWinCell.textContent = '0';
        }
        
        row.appendChild(rankCell);
        row.appendChild(playerCell);
        row.appendChild(chipsCell);
        row.appendChild(netWinCell);
        
        roomLeaderboardBody.appendChild(row);
    });
}

// 更新历史排行榜
function updateHistoryLeaderboard() {
    // 清空当前排行榜
    historyLeaderboardBody.innerHTML = '';
    
    // 将对象转换为数组并按最高筹码排序
    const statsArray = Object.entries(playerStats)
        .map(([username, stats]) => ({ username, ...stats }))
        .sort((a, b) => b.highestChips - a.highestChips);
    
    // 生成排行榜
    statsArray.forEach((player, index) => {
        const row = document.createElement('tr');
        
        // 排名
        const rankCell = document.createElement('td');
        rankCell.className = `rank-cell rank-${index + 1}`;
        rankCell.textContent = index + 1;
        
        // 玩家信息
        const playerCell = document.createElement('td');
        playerCell.className = 'player-cell';
        
        const avatarElement = document.createElement('div');
        avatarElement.className = 'leaderboard-avatar';
        avatarElement.innerHTML = `<i class="fas ${getAvatarClass(player.avatar)}"></i>`;
        
        const nameElement = document.createElement('span');
        nameElement.textContent = player.username;
        
        playerCell.appendChild(avatarElement);
        playerCell.appendChild(nameElement);
        
        // 最高筹码
        const chipsCell = document.createElement('td');
        chipsCell.textContent = player.highestChips;
        
        // 游戏场次
        const gamesCell = document.createElement('td');
        gamesCell.textContent = player.gamesPlayed;
        
        row.appendChild(rankCell);
        row.appendChild(playerCell);
        row.appendChild(chipsCell);
        row.appendChild(gamesCell);
        
        historyLeaderboardBody.appendChild(row);
    });
}

// 更新玩家历史记录
function updatePlayerStats(username, avatar, chips) {
    if (!playerStats[username]) {
        playerStats[username] = {
            avatar: avatar,
            highestChips: chips,
            gamesPlayed: 1
        };
    } else {
        playerStats[username].avatar = avatar; // 更新头像
        playerStats[username].gamesPlayed += 1;
        if (chips > playerStats[username].highestChips) {
            playerStats[username].highestChips = chips;
        }
    }
    
    // 保存到本地存储
    localStorage.setItem('pokerPlayerStats', JSON.stringify(playerStats));
}

// 回看按钮点击事件
document.getElementById('view-history-btn').addEventListener('click', () => {
    if (gameHistory.length > 0) {
        showHistoryPanel();
        renderHistoryState(0);
    } else {
        alert('没有可回看的历史数据');
    }
});

// 关闭历史面板
closeHistory.addEventListener('click', () => {
    historyPanel.classList.add('hidden');
});

// 上一步按钮
historyPrev.addEventListener('click', () => {
    if (currentHistoryIndex > 0) {
        currentHistoryIndex--;
        renderHistoryState(currentHistoryIndex);
    }
});

// 下一步按钮
historyNext.addEventListener('click', () => {
    if (currentHistoryIndex < gameHistory.length - 1) {
        currentHistoryIndex++;
        renderHistoryState(currentHistoryIndex);
    }
});

// 显示历史面板
function showHistoryPanel() {
    historyPanel.classList.remove('hidden');
    currentHistoryIndex = 0; // 重置到第一步
    updateHistoryControls();
}

// 更新历史控制按钮状态
function updateHistoryControls() {
    historyPrev.disabled = currentHistoryIndex === 0;
    historyNext.disabled = currentHistoryIndex === gameHistory.length - 1;
    
    // 更新进度条
    const progressPercent = gameHistory.length > 1 
        ? (currentHistoryIndex / (gameHistory.length - 1)) * 100 
        : 0;
    timelineProgressBar.style.width = `${progressPercent}%`;
    
    // 更新阶段名称
    let stageName = '等待开始';
    if (gameHistory[currentHistoryIndex]) {
        const status = gameHistory[currentHistoryIndex].status;
        if (status === 'preflop') stageName = stageNames[0];
        else if (status === 'flop') stageName = stageNames[1];
        else if (status === 'turn') stageName = stageNames[2];
        else if (status === 'river') stageName = stageNames[3];
        else if (status === 'showdown') stageName = stageNames[4];
    }
    historyStage.textContent = stageName;
}

// 渲染历史状态
function renderHistoryState(index) {
    if (!gameHistory[index]) return;
    
    const historyState = gameHistory[index];
    
    // 更新公共牌
    historyCommunityCards.innerHTML = '';
    if (historyState.communityCards && historyState.communityCards.length > 0) {
        historyState.communityCards.forEach(card => {
            const cardElement = createCardElement(card);
            historyCommunityCards.appendChild(cardElement);
        });
    }
    
    // 更新底池
    historyPot.textContent = historyState.pot || 0;
    
    // 更新玩家
    historyPlayersContainer.innerHTML = '';
    if (historyState.players && historyState.players.length > 0) {
        // 计算玩家位置
        const positions = calculatePlayerPositions(historyState.players.length);
        
        historyState.players.forEach((player, playerIndex) => {
            const pos = positions[playerIndex];
            const playerElement = document.createElement('div');
            playerElement.className = `history-player ${player.username === historyState.currentPlayer ? 'active' : ''}`;
            playerElement.style.left = `${pos.left}%`;
            playerElement.style.top = `${pos.top}%`;
            
            let playerHTML = `
                <div class="history-player-avatar">
                    <i class="fas ${getAvatarClass(player.avatar)}"></i>
                </div>
                <div class="history-player-name">${player.username}</div>
                <div class="history-player-chips">筹码: ${player.chips}</div>
                <div class="history-player-cards">
            `;
            
            // 玩家手牌
            if (player.cards && player.cards.length > 0) {
                player.cards.forEach(card => {
                    if (card) {
                        const isRedSuit = card.suit === 'hearts' || card.suit === 'diamonds';
                        playerHTML += `
                            <div class="card small">
                                <div class="card-value ${isRedSuit ? 'red' : ''}">${getCardValueDisplay(card.value)}</div>
                                <div class="card-suit ${isRedSuit ? 'red' : ''}">${getSuitSymbol(card.suit)}</div>
                            </div>
                        `;
                    }
                });
            } else if (player.hasCards) {
                // 背面牌
                playerHTML += `
                    <div class="card small card-back"></div>
                    <div class="card small card-back"></div>
                `;
            }
            
            playerHTML += `</div>`;
            
            // 下注额
            if (player.bet && player.bet > 0) {
                playerHTML += `<div class="history-bet">${player.bet}</div>`;
            }
            
            playerElement.innerHTML = playerHTML;
            historyPlayersContainer.appendChild(playerElement);
        });
    }
    
    // 更新控制按钮状态
    updateHistoryControls();
}

// 记录游戏状态到历史记录
function recordGameState(data) {
    // 只在游戏中记录历史
    if (data.status === 'waiting' || data.status === 'finished') {
        if (data.status === 'finished') {
            // 游戏结束时添加最后的摊牌状态
            const finalState = {...data, status: 'showdown'};
            if (gameHistory.length > 0) {
                // 获取上一个状态的社区牌
                const prevState = gameHistory[gameHistory.length - 1];
                if (prevState.communityCards) {
                    finalState.communityCards = prevState.communityCards;
                }
            }
            gameHistory.push(finalState);
        }
        return;
    }
    
    // 新的一局开始时，重置历史记录
    if (data.status === 'preflop' && (gameHistory.length === 0 || gameHistory[gameHistory.length - 1].status !== 'preflop')) {
        gameHistory = [];
    }
    
    // 克隆数据以避免引用问题
    const stateToRecord = JSON.parse(JSON.stringify(data));
    
    // 添加社区牌
    if (!stateToRecord.communityCards) {
        stateToRecord.communityCards = [];
        // 复制社区牌数据
        const communityCardsContainer = document.getElementById('community-cards');
        const cardElements = communityCardsContainer.querySelectorAll('.card');
        cardElements.forEach(cardEl => {
            const valueEl = cardEl.querySelector('.card-value');
            const suitEl = cardEl.querySelector('.card-suit');
            if (valueEl && suitEl) {
                const value = valueEl.textContent.trim();
                const suitHtml = suitEl.innerHTML.trim();
                
                let suit = '';
                if (suitHtml.includes('♥')) suit = 'hearts';
                else if (suitHtml.includes('♦')) suit = 'diamonds';
                else if (suitHtml.includes('♠')) suit = 'spades';
                else if (suitHtml.includes('♣')) suit = 'clubs';
                
                if (value && suit) {
                    stateToRecord.communityCards.push({value, suit});
                }
            }
        });
    }
    
    // 标记玩家是否有牌
    stateToRecord.players.forEach(player => {
        // 只保存当前玩家的实际牌面
        if (player.username === gameState.username && gameState.myCards) {
            player.cards = [...gameState.myCards];
        } else {
            // 其他玩家只记录是否有牌，不记录实际牌面
            player.hasCards = true;
            player.cards = [];
        }
    });
    
    gameHistory.push(stateToRecord);
}

// 添加等待界面复制房间号按钮功能
document.getElementById('copy-waiting-room-id').addEventListener('click', function() {
    const roomId = document.getElementById('waiting-room-id').textContent;
    copyToClipboard(roomId);
    
    // 显示复制成功提示
    this.innerHTML = '<i class="fas fa-check"></i> 已复制';
    setTimeout(() => {
        this.innerHTML = '<i class="fas fa-copy"></i> 复制';
    }, 2000);
});

// 房间创建成功事件处理
socket.on('room_created', function(data) {
    // 更新房间号显示
    roomIdValue.textContent = data.room_id;
    
    // 显示等待面板
    switchToWaitingPanel(true);
    
    // 更新玩家列表
    updateWaitingPlayers(data.players);
});

// 房间加入成功事件处理
socket.on('room_joined', function(data) {
    // 更新房间号显示
    roomIdValue.textContent = data.room_id;
    
    // 显示等待面板
    switchToWaitingPanel(false);
    
    // 更新玩家列表
    updateWaitingPlayers(data.players);
});

// 房间更新事件处理
socket.on('room_update', function(data) {
    // 更新玩家列表
    updateWaitingPlayers(data.players);
});

// 游戏开始事件处理
socket.on('game_start', function(data) {
    // 隐藏等待面板
    waitingPanel.style.display = 'none';
    
    // 显示游戏面板
    gameScreen.style.display = 'block';
    
    // 更新游戏状态
    gameState.isPlaying = true;
    gameState.playerId = data.player_id;
    
    // 初始化游戏界面
    initializeGameUI(data);
});

// 初始化游戏界面
function initializeGameUI(gameData) {
    // 清空所有牌面区域
    communityCardsContainer.innerHTML = '';
    playerCardsContainer.innerHTML = '';
    
    // 为每个玩家创建头像和信息区域
    // ... 现有代码 ...
    
    // 添加动画类到牌面元素
    document.querySelectorAll('.card').forEach(card => {
        card.style.animationName = 'dealCard';
        card.style.animationDuration = '0.6s';
        card.style.animationFillMode = 'backwards';
    });
    
    // 添加动画类到社区牌元素
    document.querySelectorAll('.community-cards .card').forEach(card => {
        card.style.animationName = 'flipCard';
        card.style.animationDuration = '0.8s';
        card.style.animationFillMode = 'backwards';
    });
}

// 获取头像SVG
function getAvatarSVG(avatarId) {
    // 这里应该根据avatar ID返回对应的SVG内容
    // 简单示例，实际应该根据你的应用设计返回不同的SVG
    const avatarColors = {
        'avatar1': '#ff9500',
        'avatar2': '#34c759',
        'avatar3': '#007aff',
        'avatar4': '#ff3b30',
        'avatar5': '#5856d6',
        'avatar6': '#ff2d55'
    };
    
    const color = avatarColors[avatarId] || '#ff9500';
    
    return `<svg viewBox="0 0 40 40" xmlns="http://www.w3.org/2000/svg">
        <circle cx="20" cy="20" r="18" fill="${color}" />
        <circle cx="20" cy="15" r="6" fill="white" />
        <path d="M10,32 C10,26 14,22 20,22 C26,22 30,26 30,32" fill="white" />
    </svg>`;
}

// 应用性能设置函数
function applyPerformanceSettings() {
    // 获取设置值
    const useAnimations = toggleAnimations.checked;
    const useBlur = toggleBlur.checked;
    const speedValue = animationSpeed.value;
    
    // 设置CSS变量
    document.documentElement.style.setProperty('--use-animations', useAnimations ? '1' : '0');
    document.documentElement.style.setProperty('--use-blur-effects', useBlur ? '1' : '0');
    document.documentElement.style.setProperty('--animation-speed', speedValue);
    
    // 添加或移除动画类
    if (useAnimations) {
        document.body.classList.add('animation-enabled');
    } else {
        document.body.classList.remove('animation-enabled');
    }
    
    // 对模糊效果进行类似处理
    if (!useBlur) {
        // 移除所有模糊效果
        document.querySelectorAll('[style*="backdrop-filter"]').forEach(el => {
            el.style.backdropFilter = 'none';
            el.style.webkitBackdropFilter = 'none';
        });
    }
    
    // 保存设置到本地存储
    localStorage.setItem('poker-performance-settings', JSON.stringify({
        animations: useAnimations,
        blur: useBlur,
        speed: speedValue
    }));
}

// 加载性能设置
function loadPerformanceSettings() {
    const savedSettings = localStorage.getItem('poker-performance-settings');
    if (savedSettings) {
        const settings = JSON.parse(savedSettings);
        toggleAnimations.checked = settings.animations;
        toggleBlur.checked = settings.blur;
        animationSpeed.value = settings.speed;
        
        // 立即应用设置
        applyPerformanceSettings();
    } else {
        // 根据设备性能自动设置
        if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
            toggleAnimations.checked = false;
        }
        
        // 检测低端设备（简单判断）
        const isLowEndDevice = navigator.hardwareConcurrency <= 2 || 
                             navigator.deviceMemory <= 2;
                             
        if (isLowEndDevice) {
            toggleAnimations.checked = false;
            toggleBlur.checked = false;
        }
        
        applyPerformanceSettings();
    }
}

// 性能设置事件监听
performanceToggle.addEventListener('click', function() {
    performanceMenu.classList.toggle('visible');
});

// 键盘无障碍支持
performanceToggle.addEventListener('keydown', function(e) {
    if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        performanceMenu.classList.toggle('visible');
    }
});

// 点击外部关闭菜单
document.addEventListener('click', function(e) {
    if (!performanceMenu.contains(e.target) && e.target !== performanceToggle) {
        performanceMenu.classList.remove('visible');
    }
});

// 设置变化事件
toggleAnimations.addEventListener('change', applyPerformanceSettings);
toggleBlur.addEventListener('change', applyPerformanceSettings);
animationSpeed.addEventListener('input', applyPerformanceSettings);

// 确保初始页面加载时应用设置
window.addEventListener('DOMContentLoaded', function() {
    // 加载性能设置
    loadPerformanceSettings();
    
    // 添加其他需要在页面加载时执行的初始化代码
    document.body.classList.add('animation-enabled');
    
    // 检查和提示浏览器支持
    checkBrowserSupport();
});

// 检查浏览器支持
function checkBrowserSupport() {
    // 检查WebSocket支持
    if (!window.WebSocket) {
        showMessage('您的浏览器不支持WebSocket，游戏可能无法正常运行', 'error');
    }
    
    // 检查Clipboard API支持
    if (!navigator.clipboard) {
        console.log('您的浏览器不支持Clipboard API，将使用兼容方法');
    }
    
    // 检查CSS变量支持
    const isCSSVarSupported = window.CSS && window.CSS.supports && window.CSS.supports('--a', '0');
    if (!isCSSVarSupported) {
        showMessage('您的浏览器可能不支持现代CSS功能，界面显示可能不正常', 'warning');
    }
}

// 统一错误处理
window.addEventListener('error', function(e) {
    console.error('页面错误:', e.message);
    // 对于关键错误，可以显示用户友好的消息
    if (e.message.includes('WebSocket') || e.message.includes('socket')) {
        showMessage('网络连接出现问题，请检查您的网络连接并刷新页面', 'error');
    }
});

// 网络状态监控
window.addEventListener('online', function() {
    showMessage('网络已恢复连接', 'success');
    // 尝试重新连接
    if (socket.disconnected) {
        socket.connect();
    }
});

window.addEventListener('offline', function() {
    showMessage('网络连接已断开，游戏可能无法正常进行', 'error');
});

// Socket.io错误处理增强
socket.on('connect_error', function(error) {
    console.error('连接错误:', error);
    showMessage('无法连接到游戏服务器，请稍后再试', 'error');
});

socket.on('error', function(error) {
    console.error('Socket错误:', error);
    showMessage('游戏连接出现问题', 'error');
});

// 服务器维护或重启通知
socket.on('server_maintenance', function(data) {
    showMessage(`服务器维护: ${data.message}. 预计${data.duration}分钟后恢复`, 'warning');
}); 