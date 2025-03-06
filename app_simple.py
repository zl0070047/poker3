from flask import Flask, render_template, request, jsonify
from flask_socketio import SocketIO, join_room, leave_room, emit
import random
import logging

# 配置日志
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = Flask(__name__)
app.config['SECRET_KEY'] = 'secret!'
socketio = SocketIO(app, cors_allowed_origins="*", ping_timeout=60)

# 游戏房间
rooms = {}

@app.route('/health')
def health_check():
    return jsonify({"status": "healthy"})

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/diagnose')
def diagnose():
    return render_template('diagnose.html')

@app.route('/api/join-room', methods=['POST'])
def api_join_room():
    data = request.json
    username = data.get('username')
    room_id = data.get('room_id')
    
    if not username or not room_id:
        return jsonify({"success": False, "message": "缺少用户名或房间号"})
    
    if room_id not in rooms:
        return jsonify({"success": False, "message": "房间不存在"})
    
    # 检查用户名是否已被使用
    for player in rooms[room_id]['players']:
        if player['username'] == username:
            return jsonify({"success": False, "message": "用户名已被使用"})
    
    # 添加玩家到房间
    new_player = {
        'username': username,
        'avatar': data.get('avatar', 'avatar1'),
        'isHost': False,
        'sid': request.sid if hasattr(request, 'sid') else username
    }
    
    rooms[room_id]['players'].append(new_player)
    
    return jsonify({
        "success": True,
        "room_id": room_id,
        "players": rooms[room_id]['players']
    })

@app.route('/api/create-room', methods=['POST'])
def api_create_room():
    data = request.json
    username = data.get('username')
    
    if not username:
        return jsonify({"success": False, "message": "缺少用户名"})
    
    # 生成房间ID
    room_id = str(random.randint(10000, 99999))
    while room_id in rooms:
        room_id = str(random.randint(10000, 99999))
    
    # 创建房间
    rooms[room_id] = {
        'players': [{
            'username': username,
            'avatar': data.get('avatar', 'avatar1'),
            'isHost': True,
            'sid': request.sid if hasattr(request, 'sid') else username
        }],
        'settings': {
            'smallBlind': data.get('smallBlind', 10),
            'bigBlind': data.get('bigBlind', 20),
            'initialChips': data.get('initialChips', 1000),
            'minPlayers': 4,
            'maxPlayers': 10
        }
    }
    
    return jsonify({
        "success": True,
        "room_id": room_id,
        "players": rooms[room_id]['players']
    })

@socketio.on('connect')
def handle_connect():
    logger.info(f'Client connected: {request.sid}')
    emit('connection_response', {'status': 'connected', 'sid': request.sid})

@socketio.on('disconnect')
def handle_disconnect():
    logger.info(f'Client disconnected: {request.sid}')
    # 从所有房间中移除该玩家
    for room_id in list(rooms.keys()):
        room = rooms[room_id]
        room['players'] = [p for p in room['players'] if p.get('sid') != request.sid]
        if not room['players']:
            del rooms[room_id]
        else:
            emit('player_list_updated', {'players': room['players']}, to=room_id)

@socketio.on('join_room')
def handle_join_room(data):
    username = data.get('username')
    room_id = data.get('room_id')
    logger.info(f'Join room request: {username} -> {room_id}')
    
    if not room_id in rooms:
        emit('error', {'message': '房间不存在'})
        return
    
    room = rooms[room_id]
    if len(room['players']) >= room['settings']['maxPlayers']:
        emit('error', {'message': '房间已满'})
        return
    
    # 检查用户名是否已被使用
    if any(p['username'] == username for p in room['players']):
        emit('error', {'message': '用户名已被使用'})
        return
    
    # 添加玩家到房间
    new_player = {
        'username': username,
        'avatar': data.get('avatar', 'avatar1'),
        'isHost': False,
        'sid': request.sid
    }
    
    room['players'].append(new_player)
    join_room(room_id)
    
    emit('room_joined', {
        'room_id': room_id,
        'players': room['players'],
        'settings': room['settings']
    })
    emit('player_list_updated', {'players': room['players']}, to=room_id)

@socketio.on('create_room')
def handle_create_room(data):
    username = data.get('username')
    logger.info(f'Create room request from: {username}')
    
    if not username:
        emit('error', {'message': '缺少用户名'})
        return
    
    # 生成房间ID
    room_id = str(random.randint(10000, 99999))
    while room_id in rooms:
        room_id = str(random.randint(10000, 99999))
    
    # 创建房间
    rooms[room_id] = {
        'players': [{
            'username': username,
            'avatar': data.get('avatar', 'avatar1'),
            'isHost': True,
            'sid': request.sid
        }],
        'settings': {
            'smallBlind': data.get('smallBlind', 10),
            'bigBlind': data.get('bigBlind', 20),
            'initialChips': data.get('initialChips', 1000),
            'minPlayers': 4,
            'maxPlayers': 10
        }
    }
    
    join_room(room_id)
    emit('room_created', {
        'room_id': room_id,
        'players': rooms[room_id]['players'],
        'settings': rooms[room_id]['settings']
    })

@socketio.on('start_game')
def handle_start_game(data):
    room_id = data.get('room_id')
    logger.info(f'Start game request for room: {room_id}')
    
    if not room_id in rooms:
        emit('error', {'message': '房间不存在'})
        return
    
    room = rooms[room_id]
    
    # 检查玩家数量是否满足最低要求
    if len(room['players']) < room['settings']['minPlayers']:
        emit('error', {'message': f'至少需要{room["settings"]["minPlayers"]}名玩家才能开始游戏'})
        return
    
    # 创建扑克牌
    suits = ['♥', '♦', '♠', '♣']
    ranks = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A']
    deck = [{'suit': suit, 'rank': rank} for suit in suits for rank in ranks]
    
    # 洗牌
    random.shuffle(deck)
    
    # 为玩家发牌
    players = room['players']
    for player in players:
        player['cards'] = [deck.pop() for _ in range(2)]
        player['chips'] = room['settings']['initialChips']
    
    # 发公共牌
    community_cards = [deck.pop() for _ in range(5)]
    
    # 创建游戏状态
    room['game_state'] = {
        'deck': deck,
        'community_cards': community_cards,
        'current_stage': 'pre-flop',  # pre-flop, flop, turn, river
        'pot': 0,
        'current_player_index': 0,
        'small_blind': room['settings']['smallBlind'],
        'big_blind': room['settings']['bigBlind']
    }
    
    # 发送游戏开始事件
    emit('game_start', {
        'players': [{
            'username': p['username'],
            'avatar': p['avatar'],
            'isHost': p['isHost'],
            'chips': p['chips'],
            # 只发送当前玩家的卡牌信息
            'cards': p['cards'] if p['sid'] == request.sid else []
        } for p in players],
        'community_cards': [],  # 游戏开始时不显示公共牌
        'current_stage': 'pre-flop',
        'pot': 0,
        'small_blind': room['settings']['smallBlind'],
        'big_blind': room['settings']['bigBlind']
    }, to=room_id)
    
    # 向每个玩家单独发送他们的牌
    for player in players:
        emit('your_cards', {
            'cards': player['cards']
        }, to=player['sid'])

if __name__ == '__main__':
    socketio.run(app, debug=True) 