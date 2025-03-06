from flask import Flask, render_template, request, jsonify, session
from flask_socketio import SocketIO, join_room, leave_room, emit
from flask_cors import CORS
import random
import logging
import os
import string
from dotenv import load_dotenv

# 加载环境变量
load_dotenv()

# 配置日志
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = Flask(__name__)
# 启用CORS
CORS(app)

# 设置安全密钥
app.config['SECRET_KEY'] = os.getenv('SECRET_KEY', 'dev')
# 设置session配置
app.config['SESSION_COOKIE_SECURE'] = False  # 本地开发设置为False
app.config['SESSION_COOKIE_HTTPONLY'] = True
app.config['PERMANENT_SESSION_LIFETIME'] = 3600  # session有效期1小时
app.config['CORS_HEADERS'] = 'Content-Type'

# 配置Socket.IO
socketio = SocketIO(app, 
                   cors_allowed_origins="*",  # 允许所有来源
                   ping_timeout=60,
                   async_mode='eventlet',
                   logger=True,
                   engineio_logger=True)

# 游戏房间
rooms = {}

class Card:
    def __init__(self, suit, value):
        self.suit = suit
        self.value = value

    def to_dict(self):
        return {
            'suit': self.suit,
            'value': self.value
        }

class Deck:
    def __init__(self):
        self.cards = []
        suits = ['hearts', 'diamonds', 'clubs', 'spades']
        values = list(range(2, 15))  # 2-14 (14 = A)
        for suit in suits:
            for value in values:
                self.cards.append(Card(suit, value))
        random.shuffle(self.cards)

    def draw(self, count=1):
        if count == 1:
            return self.cards.pop() if self.cards else None
        return [self.cards.pop() for _ in range(min(count, len(self.cards)))]

class Player:
    def __init__(self, id, username, avatar, chips):
        self.id = id
        self.username = username
        self.avatar = avatar
        self.chips = chips
        self.cards = []
        self.bet = 0
        self.folded = False
        self.all_in = False
        self.is_host = False

    def to_dict(self):
        return {
            'id': self.id,
            'username': self.username,
            'avatar': self.avatar,
            'chips': self.chips,
            'bet': self.bet,
            'folded': self.folded,
            'all_in': self.all_in,
            'is_host': self.is_host
        }

class PokerGame:
    def __init__(self, room_id, settings):
        self.room_id = room_id
        self.settings = settings
        self.players = []
        self.deck = None
        self.community_cards = []
        self.current_player_index = 0
        self.pot = 0
        self.current_bet = 0
        self.small_blind = settings['smallBlind']
        self.big_blind = settings['bigBlind']
        self.round = 'pre-flop'  # pre-flop, flop, turn, river
        self.timer = None
        self.all_in_rounds = 0
        self.max_all_in_rounds = settings['maxRounds']
        self.leaderboard = {
            'room': [],  # 房间内排行
            'history': []  # 历史最佳
        }

    def add_player(self, player):
        if len(self.players) < self.settings['maxPlayers']:
            if not self.players:  # 第一个玩家是房主
                player.is_host = True
            self.players.append(player)
            return True
        return False

    def remove_player(self, player_id):
        self.players = [p for p in self.players if p.id != player_id]
        if self.players and not any(p.is_host for p in self.players):
            self.players[0].is_host = True  # 设置新房主

    def start_game(self):
        if len(self.players) < 4:
            return False, "至少需要4名玩家才能开始游戏"

        self.deck = Deck()
        self.deal_initial_cards()
        self.setup_blinds()
        return True, None

    def deal_initial_cards(self):
        for player in self.players:
            player.cards = self.deck.draw(2)
            player.folded = False
            player.all_in = False
            player.bet = 0

        self.community_cards = []
        self.pot = 0
        self.current_bet = self.big_blind
        self.round = 'pre-flop'

    def setup_blinds(self):
        # 小盲注
        small_blind_player = self.players[1 % len(self.players)]
        small_blind_player.chips -= self.small_blind
        small_blind_player.bet = self.small_blind
        self.pot += self.small_blind

        # 大盲注
        big_blind_player = self.players[2 % len(self.players)]
        big_blind_player.chips -= self.big_blind
        big_blind_player.bet = self.big_blind
        self.pot += self.big_blind

        # 设置起始玩家（大盲注后面的玩家）
        self.current_player_index = 3 % len(self.players)

    def get_next_player(self):
        active_players = [p for p in self.players if not p.folded and not p.all_in]
        if len(active_players) <= 1:
            return None

        while True:
            self.current_player_index = (self.current_player_index + 1) % len(self.players)
            current_player = self.players[self.current_player_index]
            if not current_player.folded and not current_player.all_in:
                return current_player

    def get_available_actions(self, player):
        actions = ['fold']
        
        # 如果当前下注等于玩家已下注，可以看牌
        if self.current_bet == player.bet:
            actions.append('check')
        else:
            actions.append('call')
        
        # 如果玩家还有筹码可以加注
        if player.chips > 0:
            actions.append('raise')

        return {
            'actions': actions,
            'callAmount': self.current_bet - player.bet if 'call' in actions else 0,
            'minRaise': self.big_blind,
            'maxRaise': player.chips
        }

    def process_action(self, player_id, action, amount=None):
        player = next((p for p in self.players if p.id == player_id), None)
        if not player or player_id != self.players[self.current_player_index].id:
            return False, "不是你的回合"

        if action == 'fold':
            player.folded = True
        elif action == 'check':
            if self.current_bet != player.bet:
                return False, "当前无法看牌"
        elif action == 'call':
            call_amount = self.current_bet - player.bet
            if call_amount > player.chips:
                call_amount = player.chips
                player.all_in = True
            player.chips -= call_amount
            player.bet += call_amount
            self.pot += call_amount
        elif action == 'raise':
            if not amount or amount < self.big_blind:
                return False, "加注金额无效"
            if amount > player.chips:
                return False, "筹码不足"
            player.chips -= amount
            player.bet += amount
            self.current_bet = player.bet
            self.pot += amount
            if player.chips == 0:
                player.all_in = True

        # 检查是否需要进入下一轮
        if self.check_round_complete():
            self.next_round()

        return True, None

    def check_round_complete(self):
        active_players = [p for p in self.players if not p.folded and not p.all_in]
        if len(active_players) <= 1:
            return True

        # 检查所有未弃牌的玩家是否都已经下注相同金额
        bet_amounts = set(p.bet for p in active_players)
        return len(bet_amounts) == 1

    def next_round(self):
        # 重置玩家下注
        for player in self.players:
            player.bet = 0
        self.current_bet = 0

        if self.round == 'pre-flop':
            self.round = 'flop'
            self.community_cards.extend(self.deck.draw(3))
        elif self.round == 'flop':
            self.round = 'turn'
            self.community_cards.append(self.deck.draw())
        elif self.round == 'turn':
            self.round = 'river'
            self.community_cards.append(self.deck.draw())
        else:
            self.determine_winner()

        # 设置第一个行动的玩家
        self.current_player_index = 0
        while self.players[self.current_player_index].folded:
            self.current_player_index = (self.current_player_index + 1) % len(self.players)

    def determine_winner(self):
        active_players = [p for p in self.players if not p.folded]
        if len(active_players) == 1:
            winner = active_players[0]
            winner.chips += self.pot
            return [{
                'player': winner,
                'hand': '其他玩家都弃牌',
                'winnings': self.pot
            }]

        # TODO: 实现德州扑克牌型判断逻辑
        # 这里简化为随机选择赢家
        winner = random.choice(active_players)
        winner.chips += self.pot
        return [{
            'player': winner,
            'hand': '随机获胜',
            'winnings': self.pot
        }]

    def update_leaderboard(self):
        # 更新房间排行
        self.leaderboard['room'] = sorted(
            [p for p in self.players],
            key=lambda x: x.chips,
            reverse=True
        )

        # 更新历史最佳（这里只存储本局游戏的最高记录）
        for player in self.players:
            existing = next((p for p in self.leaderboard['history'] if p.id == player.id), None)
            if existing:
                existing.highest_chips = max(existing.highest_chips, player.chips)
                existing.games_played += 1
            else:
                player.highest_chips = player.chips
                player.games_played = 1
                self.leaderboard['history'].append(player)

        self.leaderboard['history'].sort(key=lambda x: x.highest_chips, reverse=True)

@app.route('/')
def index():
    return render_template('index.html')

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

@app.route('/api/leaderboard/<room_id>')
def get_leaderboard(room_id):
    if room_id not in rooms:
        return jsonify({"success": False, "message": "房间不存在"})
    
    game = rooms[room_id]
    game.update_leaderboard()
    
    return jsonify({
        "success": True,
        "room_leaderboard": [{
            "username": player.username,
            "avatar": player.avatar,
            "chips": player.chips,
            "net_gain": player.chips - game.settings['initialChips']
        } for player in game.leaderboard['room']],
        "history_leaderboard": [{
            "username": player.username,
            "avatar": player.avatar,
            "highest_chips": player.highest_chips,
            "games_played": player.games_played
        } for player in game.leaderboard['history']]
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

@socketio.on('player_action')
def handle_player_action(data):
    room_id = data['roomId']
    if room_id not in rooms:
        emit('error_message', {'message': '房间不存在'})
        return

    game = rooms[room_id]
    success, error = game.process_action(request.sid, data['action'], data.get('amount'))
    
    if not success:
        emit('error_message', {'message': error})
        return

    # 发送游戏状态更新
    emit('action_result', {
        'players': [p.to_dict() for p in game.players],
        'pot': game.pot,
        'currentBet': game.current_bet,
        'round': game.round
    }, room=room_id)

    # 如果游戏还在继续，通知下一个玩家
    next_player = game.get_next_player()
    if next_player:
        emit('player_turn', {
            'playerId': next_player.id,
            'availableActions': game.get_available_actions(next_player)
        }, room=room_id)
    else:
        # 游戏结束，显示结果
        winners = game.determine_winner()
        emit('game_over', {
            'winners': [{
                'username': w['player'].username,
                'avatar': w['player'].avatar,
                'hand': w['hand'],
                'winnings': w['winnings']
            } for w in winners]
        }, room=room_id)

@socketio.on('chat_message')
def handle_chat_message(data):
    room_id = data['roomId']
    if room_id not in rooms:
        return

    game = rooms[room_id]
    player = next((p for p in game.players if p.id == request.sid), None)
    if not player:
        return

    emit('chat_message', {
        'username': player.username,
        'message': data['message']
    }, room=room_id)

if __name__ == '__main__':
    socketio.run(app, host='0.0.0.0', debug=True, allow_unsafe_werkzeug=True) 