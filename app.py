import os
from flask import Flask, render_template, request, jsonify
from flask_socketio import SocketIO, emit, join_room, leave_room
import random
import string
import json

# 初始化Flask应用
app = Flask(__name__)
app.config['SECRET_KEY'] = os.environ.get('SECRET_KEY', 'poker_secret_key')

# 初始化SocketIO，允许跨域访问，使用eventlet作为异步模式
socketio = SocketIO(app, cors_allowed_origins="*", async_mode='eventlet')

# 存储游戏房间信息
rooms = {}
# 存储玩家会话ID与用户名的映射
player_sessions = {}

# 主页路由
@app.route('/')
def index():
    return render_template('index.html')

# 健康检查路由(Render需要)
@app.route('/health')
def health_check():
    return jsonify({"status": "ok"})

# Socket.IO事件处理
@socketio.on('connect')
def handle_connect():
    print(f'Client connected: {request.sid}')

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
                
                # 玩家退出房间
                leave_room(room_id)
                break

@socketio.on('create_room')
def create_room(data):
    room_id = data.get('room_id')
    username = data.get('username')
    avatar = data.get('avatar', 'avatar1')
    
    # 创建新房间
    if room_id not in rooms:
        rooms[room_id] = {
            'players': [],
            'host': request.sid,
            'status': 'waiting',
            'settings': {
                'small_blind': data.get('small_blind', 10),
                'big_blind': data.get('big_blind', 20),
                'all_in_rounds': data.get('all_in_rounds', 3),
                'initial_chips': data.get('initial_chips', 1000)
            }
        }
    
    # 添加玩家到房间
    player = {
        'id': request.sid,
        'username': username,
        'avatar': avatar,
        'chips': rooms[room_id]['settings']['initial_chips'],
        'isHost': True
    }
    rooms[room_id]['players'].append(player)
    
    # 记录玩家会话
    player_sessions[request.sid] = {'username': username, 'room': room_id}
    
    # 加入Socket.IO房间
    join_room(room_id)
    
    # 发送房间创建成功事件
    emit('room_created', {
        'room_id': room_id,
        'players': rooms[room_id]['players']
    })
    
    print(f'Room created: {room_id} by {username}')

@socketio.on('join_room')
def join_game_room(data):
    room_id = data.get('room_id')
    username = data.get('username')
    avatar = data.get('avatar', 'avatar1')
    
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
    
    # 添加玩家到房间
    player = {
        'id': request.sid,
        'username': username,
        'avatar': avatar,
        'chips': rooms[room_id]['settings']['initial_chips'],
        'isHost': False
    }
    rooms[room_id]['players'].append(player)
    
    # 记录玩家会话
    player_sessions[request.sid] = {'username': username, 'room': room_id}
    
    # 加入Socket.IO房间
    join_room(room_id)
    
    # 发送加入房间成功事件
    emit('room_joined', {
        'room_id': room_id,
        'players': rooms[room_id]['players']
    })
    
    # 通知房间其他人
    emit('room_update', {
        'players': rooms[room_id]['players']
    }, to=room_id)
    
    print(f'Player {username} joined room {room_id}')

@socketio.on('start_game')
def start_game(data):
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
    
    # 发送游戏开始事件
    emit('game_start', {
        'players': rooms[room_id]['players'],
        'settings': rooms[room_id]['settings']
    }, to=room_id)
    
    print(f'Game started in room {room_id}')

# 聊天功能
@socketio.on('chat_message')
def handle_chat_message(data):
    room_id = data.get('room')
    message = data.get('message')
    username = data.get('username')
    
    if not room_id or not message or not username:
        return
    
    # 发送消息给房间所有人
    emit('chat_message', {
        'username': username,
        'message': message,
        'timestamp': None  # 可以在此添加时间戳
    }, to=room_id)

# 更多游戏逻辑事件处理可以根据需要添加...

if __name__ == '__main__':
    # 获取端口号（Render会自动设置PORT环境变量）
    port = int(os.environ.get('PORT', 5000))
    # 启动服务
    socketio.run(app, host='0.0.0.0', port=port)