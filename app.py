import os
from flask import Flask, render_template, request, jsonify
from flask_socketio import SocketIO, emit, join_room, leave_room
import random
import string
import json
import time  # 添加时间戳支持

# 初始化Flask应用
app = Flask(__name__, static_folder='static', template_folder='templates')
app.config['SECRET_KEY'] = os.environ.get('SECRET_KEY', 'poker_secret_key')
app.config['MAX_CONTENT_LENGTH'] = 16 * 1024 * 1024  # 限制上传大小为16MB

# 初始化SocketIO，允许跨域访问，使用eventlet作为异步模式
socketio = SocketIO(app, 
                   cors_allowed_origins="*", 
                   async_mode='eventlet',
                   ping_timeout=60,
                   ping_interval=25)

# 存储游戏房间信息
rooms = {}
# 存储玩家会话ID与用户名的映射
player_sessions = {}
# 记录上次活动时间，用于清理不活跃的房间
last_activity = {}

# 定期清理不活跃的房间
def cleanup_inactive_rooms():
    current_time = time.time()
    for room_id in list(rooms.keys()):
        if current_time - last_activity.get(room_id, current_time) > 3600:  # 1小时不活跃
            print(f"Cleaning up inactive room: {room_id}")
            del rooms[room_id]
            if room_id in last_activity:
                del last_activity[room_id]

# 主页路由
@app.route('/')
def index():
    return render_template('index.html')

# 健康检查路由(Render需要)
@app.route('/health')
def health_check():
    cleanup_inactive_rooms()  # 顺便清理不活跃的房间
    return jsonify({"status": "ok", "active_rooms": len(rooms)})

# 错误处理
@app.errorhandler(404)
def page_not_found(e):
    return render_template('index.html'), 404

@app.errorhandler(500)
def server_error(e):
    return jsonify({"error": "Internal server error", "message": str(e)}), 500

# Socket.IO事件处理
@socketio.on('connect')
def handle_connect():
    print(f'Client connected: {request.sid}')
    emit('connection_success', {'message': 'Successfully connected to server'})

@socketio.on('disconnect')
def handle_disconnect():
    player_id = request.sid
    print(f'Client disconnected: {player_id}')
    
    # 查找玩家所在的房间并处理退出逻辑
    for room_id, room_data in list(rooms.items()):
        players = room_data['players']
        for i, player in enumerate(players):
            if player.get('id') == player_id:
                username = player.get('username', 'Unknown')
                print(f'Player {username} left room {room_id}')
                
                # 移除玩家
                room_data['players'].pop(i)
                
                # 更新房间状态
                if len(room_data['players']) == 0:
                    # 如果房间空了，删除房间
                    del rooms[room_id]
                    if room_id in last_activity:
                        del last_activity[room_id]
                    print(f'Room {room_id} deleted (empty)')
                else:
                    # 如果房主离开，将房主转给第一个玩家
                    if room_data['host'] == player_id:
                        room_data['host'] = room_data['players'][0]['id']
                        room_data['players'][0]['isHost'] = True
                        print(f'Host transferred to {room_data["players"][0]["username"]}')
                    
                    # 通知房间其他人
                    emit('player_left', {
                        'username': username,
                        'players': room_data['players']
                    }, to=room_id)
                    
                    # 更新房间活动时间
                    last_activity[room_id] = time.time()
                
                # 玩家退出房间
                leave_room(room_id)
                
                # 从玩家会话映射中移除
                if player_id in player_sessions:
                    del player_sessions[player_id]
                    
                break

@socketio.on('create_room')
def create_room(data):
    try:
        room_id = data.get('room_id')
        username = data.get('username')
        avatar = data.get('avatar', 'avatar1')
        
        # 验证用户名
        if not username or len(username) < 2 or len(username) > 20:
            emit('error', {'message': '用户名长度应在2-20个字符之间'})
            return
            
        # 如果没有提供房间ID，生成一个
        if not room_id:
            room_id = ''.join(random.choice(string.digits) for _ in range(6))
            
        # 确保房间ID不重复
        while room_id in rooms:
            room_id = ''.join(random.choice(string.digits) for _ in range(6))
        
        # 获取游戏设置并转换为正确类型
        try:
            small_blind = int(data.get('small_blind', 10))
            big_blind = int(data.get('big_blind', 20))
            all_in_rounds = int(data.get('all_in_rounds', 3))
            initial_chips = int(data.get('initial_chips', 1000))
            
            # 验证设置的合理性
            if small_blind <= 0 or big_blind <= 0 or initial_chips <= 0:
                raise ValueError("游戏设置必须为正数")
            if big_blind < small_blind:
                raise ValueError("大盲注必须大于等于小盲注")
                
        except ValueError as e:
            emit('error', {'message': f'无效的游戏设置: {str(e)}'})
            return
        
        # 创建新房间
        rooms[room_id] = {
            'players': [],
            'host': request.sid,
            'status': 'waiting',
            'created_at': time.time(),
            'settings': {
                'small_blind': small_blind,
                'big_blind': big_blind,
                'all_in_rounds': all_in_rounds,
                'initial_chips': initial_chips
            }
        }
        
        # 添加玩家到房间
        player = {
            'id': request.sid,
            'username': username,
            'avatar': avatar,
            'chips': initial_chips,
            'isHost': True
        }
        rooms[room_id]['players'].append(player)
        
        # 记录玩家会话
        player_sessions[request.sid] = {'username': username, 'room': room_id}
        
        # 加入Socket.IO房间
        join_room(room_id)
        
        # 更新房间活动时间
        last_activity[room_id] = time.time()
        
        # 发送房间创建成功事件
        emit('room_created', {
            'room_id': room_id,
            'players': rooms[room_id]['players'],
            'settings': rooms[room_id]['settings']
        })
        
        print(f'Room created: {room_id} by {username}')
        
    except Exception as e:
        print(f"Error in create_room: {str(e)}")
        emit('error', {'message': '创建房间时发生错误'})

@socketio.on('join_room')
def join_game_room(data):
    try:
        room_id = data.get('room_id')
        username = data.get('username')
        avatar = data.get('avatar', 'avatar1')
        
        # 验证用户名
        if not username or len(username) < 2 or len(username) > 20:
            emit('error', {'message': '用户名长度应在2-20个字符之间'})
            return
        
        # 检查房间ID
        if not room_id:
            emit('error', {'message': '请输入房间号'})
            return
            
        # 检查房间是否存在
        if room_id not in rooms:
            emit('error', {'message': '房间不存在'})
            return
        
        # 检查游戏是否已开始
        if rooms[room_id]['status'] != 'waiting':
            emit('error', {'message': '游戏已开始，无法加入'})
            return
        
        # 检查玩家数量限制
        if len(rooms[room_id]['players']) >= 10:
            emit('error', {'message': '房间已满'})
            return
        
        # 检查用户名是否已存在
        for player in rooms[room_id]['players']:
            if player['username'] == username:
                emit('error', {'message': '用户名已存在，请选择其他名称'})
                return
        
        # 获取初始筹码
        initial_chips = rooms[room_id]['settings']['initial_chips']
        
        # 添加玩家到房间
        player = {
            'id': request.sid,
            'username': username,
            'avatar': avatar,
            'chips': initial_chips,
            'isHost': False
        }
        rooms[room_id]['players'].append(player)
        
        # 记录玩家会话
        player_sessions[request.sid] = {'username': username, 'room': room_id}
        
        # 加入Socket.IO房间
        join_room(room_id)
        
        # 更新房间活动时间
        last_activity[room_id] = time.time()
        
        # 发送加入房间成功事件
        emit('room_joined', {
            'room_id': room_id,
            'players': rooms[room_id]['players'],
            'settings': rooms[room_id]['settings']
        })
        
        # 通知房间其他人
        emit('room_update', {
            'players': rooms[room_id]['players']
        }, to=room_id)
        
        print(f'Player {username} joined room {room_id}')
        
    except Exception as e:
        print(f"Error in join_room: {str(e)}")
        emit('error', {'message': '加入房间时发生错误'})

@socketio.on('start_game')
def start_game(data):
    try:
        room_id = data.get('room_id')
        
        # 检查房间是否存在
        if room_id not in rooms:
            emit('error', {'message': '房间不存在'})
            return
        
        # 检查是否是房主
        if request.sid != rooms[room_id]['host']:
            emit('error', {'message': '只有房主可以开始游戏'})
            return
        
        # 检查玩家数量
        if len(rooms[room_id]['players']) < 2:
            emit('error', {'message': '至少需要2位玩家才能开始游戏'})
            return
        
        # 更新房间状态
        rooms[room_id]['status'] = 'playing'
        rooms[room_id]['game_started_at'] = time.time()
        
        # 更新房间活动时间
        last_activity[room_id] = time.time()
        
        # 发送游戏开始事件
        emit('game_start', {
            'players': rooms[room_id]['players'],
            'settings': rooms[room_id]['settings']
        }, to=room_id)
        
        print(f'Game started in room {room_id}')
        
    except Exception as e:
        print(f"Error in start_game: {str(e)}")
        emit('error', {'message': '开始游戏时发生错误'})

# 聊天功能
@socketio.on('chat_message')
def handle_chat_message(data):
    try:
        room_id = data.get('room')
        message = data.get('message')
        username = data.get('username')
        
        if not room_id or not message or not username:
            return
            
        # 检查房间是否存在
        if room_id not in rooms:
            emit('error', {'message': '房间不存在'})
            return
            
        # 检查消息长度
        if len(message) > 200:
            emit('error', {'message': '消息过长，请限制在200字符以内'})
            return
        
        # 过滤不适当内容（简单示例）
        if any(word in message.lower() for word in ['脏话1', '脏话2']):
            emit('error', {'message': '请文明聊天'}, room=request.sid)
            return
        
        # 添加时间戳
        timestamp = int(time.time() * 1000)
        
        # 更新房间活动时间
        last_activity[room_id] = time.time()
        
        # 发送消息给房间所有人
        emit('chat_message', {
            'username': username,
            'message': message,
            'timestamp': timestamp
        }, to=room_id)
        
        print(f'Chat message in room {room_id}: {username}: {message}')
        
    except Exception as e:
        print(f"Error in chat_message: {str(e)}")

# 处理表情动画
@socketio.on('send_emoji')
def handle_emoji(data):
    try:
        room_id = data.get('room')
        emoji = data.get('emoji')
        username = data.get('username')
        
        if not room_id or not emoji or not username:
            return
            
        # 检查房间是否存在
        if room_id not in rooms:
            return
            
        # 验证emoji是否在允许列表中
        allowed_emojis = ['😀', '😎', '🤔', '😂', '👍', '👎', '🎲', '🎯', '🎰', '💰', '💸', '🤑']
        if emoji not in allowed_emojis:
            return
        
        # 更新房间活动时间
        last_activity[room_id] = time.time()
        
        # 发送表情给房间所有人
        emit('emoji_animation', {
            'username': username,
            'emoji': emoji
        }, to=room_id)
        
    except Exception as e:
        print(f"Error in send_emoji: {str(e)}")

# 心跳检测，保持连接活跃
@socketio.on('ping')
def handle_ping():
    emit('pong')

if __name__ == '__main__':
    # 获取端口号（Render会自动设置PORT环境变量）
    port = int(os.environ.get('PORT', 5000))
    
    # 设置debug模式（非生产环境）
    debug = os.environ.get('ENVIRONMENT', 'development') != 'production'
    
    # 启动服务
    socketio.run(app, host='0.0.0.0', port=port, debug=debug)