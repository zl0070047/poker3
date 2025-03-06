// 标签页切换专用脚本
(function() {
    console.log('标签页切换脚本已加载');
    
    // 等待DOM加载完成后执行
    function domReady(callback) {
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', callback);
        } else {
            callback();
        }
    }
    
    // 初始化标签页切换功能
    function initTabSwitching() {
        console.log('初始化标签页切换功能');
        
        // 获取所有标签按钮和内容面板
        const tabButtons = document.querySelectorAll('.tab-btn');
        const tabPanes = document.querySelectorAll('.tab-pane');
        
        // 为每个标签按钮添加点击事件
        tabButtons.forEach(button => {
            button.addEventListener('click', function() {
                // 移除所有活动状态
                tabButtons.forEach(btn => btn.classList.remove('active'));
                tabPanes.forEach(pane => pane.classList.remove('active'));
                
                // 添加当前标签的活动状态
                this.classList.add('active');
                const tabId = this.getAttribute('data-tab');
                document.getElementById(`${tabId}-tab`).classList.add('active');
            });
        });
        
        // 排行榜标签切换
        const leaderboardTabs = document.querySelectorAll('.leaderboard-tab');
        const leaderboardPanes = document.querySelectorAll('.leaderboard-pane');
        
        leaderboardTabs.forEach(tab => {
            tab.addEventListener('click', function() {
                leaderboardTabs.forEach(t => t.classList.remove('active'));
                leaderboardPanes.forEach(p => p.classList.remove('active'));
                
                this.classList.add('active');
                const tabId = this.getAttribute('data-tab');
                document.getElementById(`${tabId}-leaderboard`).classList.add('active');
            });
        });
        
        // 排行榜切换按钮
        const leaderboardToggle = document.getElementById('leaderboard-toggle');
        const leaderboardPanel = document.getElementById('leaderboard-panel');
        const closeLeaderboard = document.getElementById('close-leaderboard');
        
        if (leaderboardToggle && leaderboardPanel && closeLeaderboard) {
            leaderboardToggle.addEventListener('click', function() {
                leaderboardPanel.classList.toggle('show');
            });
            
            closeLeaderboard.addEventListener('click', function() {
                leaderboardPanel.classList.remove('show');
            });
        }
        
        // 头像选择逻辑
        const avatarOptions = document.querySelectorAll('.avatar-option');
        avatarOptions.forEach(option => {
            option.addEventListener('click', function() {
                avatarOptions.forEach(opt => opt.classList.remove('selected'));
                this.classList.add('selected');
                gameState.avatar = this.getAttribute('data-avatar');
            });
        });
        
        console.log('标签页切换功能初始化完成');
    }
    
    // 修复加入房间按钮
    function fixJoinRoomButton() {
        console.log('尝试修复加入房间按钮');
        
        const joinButton = document.getElementById('join-room-btn');
        if (!joinButton) {
            console.error('未找到加入房间按钮');
            return;
        }
        
        // 移除已有的事件监听器
        const newJoinButton = joinButton.cloneNode(true);
        if (joinButton.parentNode) {
            joinButton.parentNode.replaceChild(newJoinButton, joinButton);
        }
        
        // 标记按钮为已修复
        newJoinButton.setAttribute('data-fixed', 'true');
        
        // 给按钮添加视觉反馈
        newJoinButton.style.border = '2px solid #ff3b30';
        newJoinButton.style.boxShadow = '0 0 10px rgba(255, 59, 48, 0.5)';
        
        // 绑定新的点击事件
        newJoinButton.addEventListener('click', function(event) {
            event.preventDefault();
            console.log('加入房间按钮被点击');
            
            // 获取用户名和房间号
            const username = document.getElementById('join-username')?.value.trim();
            const roomId = document.getElementById('room-id')?.value.trim();
            
            if (!username) {
                alert('请输入用户名');
                return;
            }
            
            if (!roomId) {
                alert('请输入房间号');
                return;
            }
            
            console.log(`尝试加入房间 - 用户名: ${username}, 房间号: ${roomId}`);
            
            // 使用Socket.IO加入房间
            try {
                if (typeof io !== 'undefined') {
                    const socket = io();
                    
                    // 监听连接成功事件
                    socket.on('connect', function() {
                        console.log('Socket.IO连接成功，发送加入房间请求');
                        
                        socket.emit('join_room', {
                            username: username,
                            room_id: roomId,
                            avatar: 'avatar1'
                        });
                    });
                    
                    // 监听加入房间成功事件
                    socket.on('room_joined', function(data) {
                        console.log('成功加入房间:', data);
                        alert(`成功加入房间: ${data.room_id}`);
                        
                        // 更新UI显示
                        if (document.getElementById('login-screen')) {
                            document.getElementById('login-screen').style.display = 'none';
                        }
                        
                        if (document.getElementById('waiting-panel')) {
                            document.getElementById('waiting-panel').style.display = 'block';
                        }
                    });
                    
                    // 监听错误事件
                    socket.on('error', function(data) {
                        console.error('加入房间错误:', data);
                        alert(`加入房间失败: ${data.message || '未知错误'}`);
                    });
                    
                    alert(`正在加入房间: ${roomId}，请等待...`);
                } else {
                    console.error('Socket.IO未加载');
                    alert('Socket.IO未加载，无法连接到服务器');
                }
            } catch (error) {
                console.error('加入房间出错:', error);
                alert(`加入房间出错: ${error.message}`);
            }
        });
        
        console.log('加入房间按钮修复完成');
    }
    
    // 执行初始化和修复
    domReady(function() {
        console.log('DOM已加载完成，开始初始化');
        
        // 初始化标签页
        initTabSwitching();
        
        // 修复加入房间按钮
        fixJoinRoomButton();
    });
    
    // 为防止DOM加载延迟，再次尝试延时执行
    setTimeout(function() {
        initTabSwitching();
        fixJoinRoomButton();
    }, 1000);
})(); 