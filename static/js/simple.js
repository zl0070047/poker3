// 德州扑克游戏简化版JavaScript - 增强版
console.log('加载简化版JavaScript (增强版)...');

// 游戏状态管理
const gameState = {
    username: '',
    room: '',
    avatar: 'avatar1',
    isHost: false,
    players: [],
    settings: {
        smallBlind: 10,
        bigBlind: 20,
        initialChips: 1000,
        allInRounds: 3
    }
};

// Socket.IO 连接
let socket;
let socketConnected = false;

// 初始化Socket.IO连接
function initializeSocket() {
    console.log('初始化Socket.IO连接...');
    
    socket = io('/', {
        transports: ['websocket', 'polling'],
        reconnection: true,
        reconnectionAttempts: 5,
        reconnectionDelay: 1000
    });
    
    // 连接成功
    socket.on('connect', function() {
        console.log('Socket.IO连接成功');
        socketConnected = true;
        window.socket = socket;  // 保存到全局变量
    });
    
    // 连接错误
    socket.on('connect_error', function(error) {
        console.error('Socket.IO连接错误:', error);
        socketConnected = false;
    });
    
    // 断开连接
    socket.on('disconnect', function() {
        console.log('Socket.IO连接断开');
        socketConnected = false;
    });
    
    // 房间创建成功
    socket.on('room_created', function(data) {
        console.log('房间创建成功:', data);
        
        // 更新游戏状态
        gameState.room = data.room_id;
        gameState.isHost = true;
        gameState.players = data.players;
        
        // 显示成功提示
        document.getElementById('room-created').classList.remove('hidden');
        document.getElementById('created-room-id').textContent = data.room_id;
        
        // 更新等待面板
        updateWaitingPanel(data);
    });
    
    // 房间加入成功
    socket.on('room_joined', function(data) {
        console.log('成功加入房间:', data);
        
        // 更新游戏状态
        gameState.room = data.room_id;
        gameState.players = data.players;
        gameState.settings = data.settings;
        
        // 切换到等待面板
        document.getElementById('login-screen').style.display = 'none';
        document.getElementById('waiting-panel').style.display = 'block';
        document.getElementById('room-id-value').textContent = data.room_id;
        
        // 更新等待面板
        updateWaitingPanel(data);
    });
    
    // 玩家列表更新
    socket.on('player_list_updated', function(data) {
        console.log('玩家列表更新:', data);
        gameState.players = data.players;
        updateWaitingPanel({ players: data.players });
    });
    
    // 游戏开始
    socket.on('game_start', function(data) {
        console.log('游戏开始:', data);
        document.getElementById('waiting-panel').style.display = 'none';
        document.getElementById('game-screen').style.display = 'block';
    });
    
    // 错误处理
    socket.on('error', function(data) {
        console.error('收到错误:', data);
        alert(data.message || '发生错误');
    });
}

// 更新等待面板
function updateWaitingPanel(data) {
    const waitingPlayers = document.getElementById('waiting-players');
    const currentPlayerCount = document.getElementById('current-player-count');
    const startGameBtn = document.getElementById('start-game-btn');
    const hostControls = document.getElementById('host-controls');
    
    if (waitingPlayers && data.players) {
        waitingPlayers.innerHTML = '';
        data.players.forEach(player => {
            const playerDiv = document.createElement('div');
            playerDiv.className = 'waiting-player';
            playerDiv.innerHTML = `
                <div class="player-avatar">
                    <i class="fas ${player.avatar === 'avatar1' ? 'fa-user-tie' : 
                                   player.avatar === 'avatar2' ? 'fa-user-ninja' :
                                   player.avatar === 'avatar3' ? 'fa-user-astronaut' :
                                   player.avatar === 'avatar4' ? 'fa-user-secret' :
                                   'fa-user-crown'}"></i>
                </div>
                <div class="player-name">${player.username}</div>
                ${player.isHost ? '<span class="host-tag">房主</span>' : ''}
            `;
            waitingPlayers.appendChild(playerDiv);
        });
        
        if (currentPlayerCount) {
            currentPlayerCount.textContent = `${data.players.length}`;
        }
        
        // 更新开始游戏按钮状态
        if (startGameBtn) {
            const canStart = data.players.length >= 4;
            startGameBtn.disabled = !canStart;
            startGameBtn.textContent = canStart ? 
                '开始游戏' : 
                `开始游戏 (至少需要${4}位玩家)`;
        }
        
        // 显示/隐藏房主控制面板
        if (hostControls) {
            const isHost = data.players.some(p => p.username === gameState.username && p.isHost);
            hostControls.style.display = isHost ? 'block' : 'none';
        }
    }
}

// 创建房间
function handleCreateRoom() {
    console.log('处理创建房间请求');
    
    const username = document.getElementById('create-username').value.trim();
    if (!username) {
        alert('请输入用户名');
        return;
    }
    
    // 获取游戏设置
    const settings = {
        smallBlind: parseInt(document.getElementById('small-blind').value) || 10,
        bigBlind: parseInt(document.getElementById('big-blind').value) || 20,
        allInRounds: parseInt(document.getElementById('all-in-rounds').value) || 3,
        initialChips: parseInt(document.getElementById('initial-chips').value) || 1000
    };
    
    // 更新游戏状态
    gameState.username = username;
    gameState.settings = settings;
    
    console.log('创建房间参数:', { username, settings });
    
    if (socketConnected && socket) {
        socket.emit('create_room', {
            username: username,
            avatar: gameState.avatar,
            ...settings
        });
    } else {
        // HTTP备用方案
        fetch('/api/create-room', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                username: username,
                avatar: gameState.avatar,
                ...settings
            })
        })
        .then(response => response.json())
        .then(data => {
            if (data.success) {
                gameState.room = data.room_id;
                gameState.isHost = true;
                gameState.players = data.players;
                
                document.getElementById('room-created').classList.remove('hidden');
                document.getElementById('created-room-id').textContent = data.room_id;
                
                updateWaitingPanel(data);
            } else {
                alert(data.message || '创建房间失败');
            }
        })
        .catch(error => {
            console.error('创建房间错误:', error);
            alert('创建房间失败: ' + error.message);
        });
    }
}

// 初始化事件监听
document.addEventListener('DOMContentLoaded', function() {
    console.log('DOM加载完成，初始化事件监听');
    
    // 初始化Socket.IO
    initializeSocket();
    
    // 创建房间按钮
    const createRoomBtn = document.getElementById('create-room-btn');
    if (createRoomBtn) {
        createRoomBtn.addEventListener('click', handleCreateRoom);
    }
    
    // 进入房间按钮
    const enterRoomBtn = document.getElementById('enter-room-btn');
    if (enterRoomBtn) {
        enterRoomBtn.addEventListener('click', function() {
            document.getElementById('room-created').classList.add('hidden');
            document.getElementById('login-screen').style.display = 'none';
            document.getElementById('waiting-panel').style.display = 'block';
            document.getElementById('room-id-value').textContent = gameState.room;
        });
    }
    
    // 开始游戏按钮
    const startGameBtn = document.getElementById('start-game-btn');
    if (startGameBtn) {
        startGameBtn.addEventListener('click', function() {
            if (gameState.room && gameState.isHost) {
                socket.emit('start_game', { room_id: gameState.room });
            }
        });
    }
    
    // 复制房间号按钮
    const copyButtons = document.querySelectorAll('.copy-btn');
    copyButtons.forEach(btn => {
        btn.addEventListener('click', function() {
            const roomId = gameState.room || document.getElementById('created-room-id').textContent;
            navigator.clipboard.writeText(roomId).then(() => {
                alert('房间号已复制到剪贴板');
            }).catch(err => {
                console.error('复制失败:', err);
                alert('复制失败，请手动复制');
            });
        });
    });
});

// 立即执行的修复函数 - 在DOM加载前就开始尝试修复按钮问题
(function() {
    console.log('立即执行的按钮修复函数启动');
    
    // 每500毫秒尝试一次，确保能找到并修复按钮
    let fixAttempts = 0;
    const maxAttempts = 20; // 最多尝试10秒
    
    function attemptButtonFix() {
        fixAttempts++;
        console.log(`尝试修复按钮 (第${fixAttempts}次)`);
        
        // 尝试找到加入房间按钮
        let joinBtn = document.getElementById('join-room-btn');
        if (!joinBtn) {
            joinBtn = document.querySelector('button[id*="join"], button:contains("加入")');
        }
        
        // 如果找到了按钮
        if (joinBtn) {
            console.log('找到加入房间按钮，正在应用强制修复');
            
            // 1. 移除所有可能的事件监听器
            const newBtn = joinBtn.cloneNode(true);
            if (joinBtn.parentNode) {
                joinBtn.parentNode.replaceChild(newBtn, joinBtn);
                joinBtn = newBtn;
            }
            
            // 2. 添加内联onclick属性（最直接的方式）
            joinBtn.setAttribute('onclick', 'console.log("加入房间按钮被点击"); handleJoinRoomDirect(); return false;');
            
            // 3. 添加显著的视觉样式以确认修复
            joinBtn.style.border = '3px solid #ff3b30';
            joinBtn.style.boxShadow = '0 0 10px rgba(255, 59, 48, 0.7)';
            
            console.log('按钮修复完成');
            return true;
        }
        
        // 如果达到最大尝试次数还没找到按钮
        if (fixAttempts >= maxAttempts) {
            console.log('无法找到加入房间按钮，创建新按钮');
            
            // 创建一个全新的、绝对可靠的按钮
            const reliableBtn = document.createElement('button');
            reliableBtn.textContent = '👉 加入房间 (修复版) 👈';
            reliableBtn.style.position = 'fixed';
            reliableBtn.style.top = '200px';
            reliableBtn.style.left = '50%';
            reliableBtn.style.transform = 'translateX(-50%)';
            reliableBtn.style.padding = '20px 40px';
            reliableBtn.style.backgroundColor = '#007aff';
            reliableBtn.style.color = 'white';
            reliableBtn.style.fontSize = '18px';
            reliableBtn.style.fontWeight = 'bold';
            reliableBtn.style.border = 'none';
            reliableBtn.style.borderRadius = '10px';
            reliableBtn.style.zIndex = '99999';
            reliableBtn.style.boxShadow = '0 0 20px rgba(0, 122, 255, 0.8)';
            reliableBtn.style.animation = 'pulse 2s infinite';
            
            // 添加动画样式
            const style = document.createElement('style');
            style.textContent = `
                @keyframes pulse {
                    0% { transform: translateX(-50%) scale(1); }
                    50% { transform: translateX(-50%) scale(1.05); }
                    100% { transform: translateX(-50%) scale(1); }
                }
            `;
            document.head.appendChild(style);
            
            // 添加内联onclick事件
            reliableBtn.setAttribute('onclick', 'handleJoinRoomDirect(); return false;');
            
            document.body.appendChild(reliableBtn);
            console.log('已创建修复版加入房间按钮');
            return true;
        }
        
        // 继续尝试
        return false;
    }
    
    // 立即尝试一次
    if (!attemptButtonFix()) {
        // 如果没成功，设置定时器继续尝试
        const interval = setInterval(() => {
            if (attemptButtonFix() || fixAttempts >= maxAttempts) {
                clearInterval(interval);
            }
        }, 500);
    }
})();

// 定义全局的直接处理函数，确保在任何时候都可以被内联事件调用
function handleJoinRoomDirect() {
    console.log('直接调用加入房间处理函数');
    try {
        // 获取输入值
        let username = '';
        let roomId = '';
        
        // 尝试多种方式获取用户名
        const usernameInput = document.getElementById('join-username');
        if (usernameInput) {
            username = usernameInput.value.trim();
        }
        
        // 尝试多种方式获取房间号
        const roomIdInput = document.getElementById('room-id');
        if (roomIdInput) {
            roomId = roomIdInput.value.trim();
        }
        
        // 如果没有获取到，使用提示框
        if (!username) {
            username = prompt('请输入您的用户名:');
        }
        
        if (!roomId) {
            roomId = prompt('请输入房间号:');
        }
        
        if (!username || !roomId) {
            alert('用户名和房间号不能为空！');
            return;
        }
        
        console.log(`准备加入房间 - 用户名: ${username}, 房间号: ${roomId}`);
        
        // 尝试使用Socket.IO加入房间
        if (window.socket && window.socket.connected) {
            console.log('使用Socket.IO发送join_room事件');
            window.socket.emit('join_room', {
                username: username,
                room_id: roomId,
                avatar: 'avatar1'
            });
            alert(`正在通过Socket.IO加入房间: ${roomId}`);
        } else {
            // 使用HTTP备用方案
            console.log('Socket.IO未连接，使用HTTP备用方案');
            
            // 同步AJAX请求（确保能执行完成）
            const xhr = new XMLHttpRequest();
            xhr.open('POST', '/api/join-room', false); // 同步请求
            xhr.setRequestHeader('Content-Type', 'application/json');
            xhr.onload = function() {
                if (xhr.status === 200) {
                    const response = JSON.parse(xhr.responseText);
                    if (response.success) {
                        alert(`成功加入房间: ${roomId}`);
                        
                        // 手动更新UI
                        if (document.getElementById('login-screen')) {
                            document.getElementById('login-screen').style.display = 'none';
                        }
                        
                        if (document.getElementById('waiting-panel')) {
                            document.getElementById('waiting-panel').style.display = 'block';
                        }
                        
                        if (document.getElementById('room-id-value')) {
                            document.getElementById('room-id-value').textContent = roomId;
                        }
                    } else {
                        alert(`加入房间失败: ${response.message || '未知错误'}`);
                    }
                } else {
                    alert(`服务器错误: ${xhr.status}`);
                }
            };
            xhr.onerror = function() {
                alert('网络错误，无法连接到服务器');
            };
            xhr.send(JSON.stringify({
                username: username,
                room_id: roomId
            }));
            
            alert(`正在通过HTTP加入房间: ${roomId}`);
        }
    } catch (error) {
        console.error('加入房间出错:', error);
        alert(`加入房间时发生错误: ${error.message}`);
    }
}

// 定义一个独立的处理函数，便于重用和调试
function handleJoinRoom() {
    try {
        console.log('原始的handleJoinRoom函数被调用');
        
        // 记录DOM状态
        console.log('DOM状态检查:');
        console.log('- join-username元素存在:', !!document.getElementById('join-username'));
        console.log('- room-id元素存在:', !!document.getElementById('room-id'));
        
        // 1. 首先尝试使用新的直接处理函数 - 这是最可靠的方法
        console.log('调用handleJoinRoomDirect()');
        handleJoinRoomDirect();
        
        // 2. 如果上面的函数没有阻止事件继续，下面的代码也会执行
        log('触发加入房间按钮点击事件');
        showMessage('正在处理加入房间请求...', 'info');
        
        // 查找输入字段，同样使用多种查找方式
        let usernameInput = document.getElementById('join-username');
        if (!usernameInput) {
            usernameInput = document.querySelector('input[placeholder*="用户名"], input[placeholder*="昵称"]');
        }
        
        let roomIdInput = document.getElementById('room-id');
        if (!roomIdInput) {
            roomIdInput = document.querySelector('input[placeholder*="房间号"]');
        }
        
        // 如果找不到输入字段，弹出提示框
        const username = usernameInput ? usernameInput.value.trim() : prompt('请输入您的用户名:');
        const roomId = roomIdInput ? roomIdInput.value.trim() : prompt('请输入房间号:');
        
        log(`加入房间信息 - 用户名: "${username}", 房间号: "${roomId}"`);
        
        if (!username) {
            showMessage('请输入用户名', 'error');
            return;
        }
        
        if (!roomId) {
            showMessage('请输入房间号', 'error');
            return;
        }
        
        // 更新游戏状态
        gameState.username = username;
        gameState.room = roomId;
        
        // 判断是使用Socket.IO还是HTTP备用方案
        if (typeof socketConnected !== 'undefined' && socketConnected) {
            log(`通过Socket.IO加入房间 (用户: ${username}, 房间: ${roomId})`);
            if (typeof socket !== 'undefined' && socket) {
                socket.emit('join_room', { 
                    username: username,
                    room_id: roomId,
                    avatar: gameState.avatar
                });
                
                // 添加加入房间提示
                showMessage(`正在加入房间: ${roomId}...`, 'info');
            } else {
                log('Socket对象不存在，无法发送join_room事件');
                showMessage('连接错误，无法加入房间', 'error');
            }
        } else {
            log('Socket.IO未连接，使用HTTP备用方案');
            joinRoomViaHttp(username, roomId);
        }
    } catch (error) {
        console.error('handleJoinRoom出错:', error);
        alert('加入房间处理函数发生错误: ' + error.message);
        
        // 尝试使用备用方法
        try {
            handleJoinRoomDirect();
        } catch (backupError) {
            console.error('备用处理函数也失败:', backupError);
            alert('所有尝试都失败，请刷新页面重试');
        }
    }
}

// 游戏状态
// ... existing code ... 