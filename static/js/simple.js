// 德州扑克游戏简化版JavaScript - 增强版
console.log('加载简化版JavaScript (增强版)...');

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