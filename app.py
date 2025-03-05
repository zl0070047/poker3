from flask import Flask, render_template
from flask_socketio import SocketIO, emit, join_room, leave_room
import json
import random
import eventlet
import uuid
import datetime

eventlet.monkey_patch()

app = Flask(__name__)
app.config['SECRET_KEY'] = 'poker_game_secret!'
socketio = SocketIO(app)

# 游戏状态
games = {}
# 玩家信息（已不再使用，但保留以兼容现有代码）
players = {}

class Card:
    def __init__(self, suit, value):
        self.suit = suit
        self.value = value

    def to_dict(self):
        return {
            'suit': self.suit,
            'value': self.value
        }

class Game:
    def __init__(self, room_id, small_blind, big_blind, all_in_rounds, initial_chips=1000):
        self.room_id = room_id
        self.players = []  # 玩家名称列表
        self.player_data = {}  # 玩家详细数据
        self.deck = []
        self.community_cards = []
        self.small_blind = small_blind
        self.big_blind = big_blind
        self.all_in_rounds = all_in_rounds
        self.initial_chips = initial_chips
        self.current_player_index = 0
        self.pot = 0
        self.status = 'waiting'  # waiting, playing, preflop, flop, turn, river, showdown, finished
        self.timer = None
        self.current_bet = 0
        self.last_raise = 0
        self.round_bets = {}  # 本轮下注
        self.initialize_deck()
        self.game_round = 0
        self.host = None  # 房主

    def initialize_deck(self):
        suits = ['hearts', 'diamonds', 'clubs', 'spades']
        values = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A']
        self.deck = [Card(suit, value) for suit in suits for value in values]
        random.shuffle(self.deck)

    def add_player(self, username, avatar, is_host=False):
        """添加玩家到游戏"""
        if username not in self.players:
            self.players.append(username)
            self.player_data[username] = {
                'username': username,
                'avatar': avatar,
                'chips': self.initial_chips,
                'cards': [],
                'bet': 0,
                'status': 'active',  # active, folded, all-in
                'isHost': is_host
            }
            
            # 设置房主
            if is_host and not self.host:
                self.host = username
            
            return True
        return False

    def get_player_data(self):
        """获取当前所有玩家的数据"""
        return [self.player_data[player] for player in self.players if player in self.player_data]
    
    def get_current_player(self):
        """获取当前行动的玩家"""
        if 0 <= self.current_player_index < len(self.players):
            return self.players[self.current_player_index]
        return None

    def deal_cards(self):
        """发牌给所有玩家"""
        for player in self.players:
            if player in self.player_data:
                self.player_data[player]['cards'] = [self.deck.pop().to_dict() for _ in range(2)]

    def deal_community_cards(self, count=1):
        """发公共牌"""
        for _ in range(count):
            if len(self.deck) > 0:
                self.community_cards.append(self.deck.pop().to_dict())

@app.route('/')
def index():
    return render_template('index.html')

@socketio.on('join_game')
def on_join(data):
    username = data['username']
    room = data['room']
    avatar = data.get('avatar', 'avatar1')
    is_host = data.get('is_host', False)
    
    if room not in games:
        # 创建新游戏
        games[room] = Game(
            room_id=room,
            small_blind=data.get('small_blind', 10),
            big_blind=data.get('big_blind', 20),
            all_in_rounds=data.get('all_in_rounds', 3),
            initial_chips=data.get('initial_chips', 1000)
        )
    
    game = games[room]
    if len(game.players) >= 10:
        emit('error', {'message': '房间已满'})
        return
    
    # 加入房间
    join_room(room)
    
    # 添加玩家到游戏，同时更新旧的players字典以兼容现有代码
    if game.add_player(username, avatar, is_host):
        players[username] = {
            'room': room,
            'chips': game.player_data[username]['chips'],
            'cards': [],
            'status': 'active'
        }
        
        # 发送玩家个人状态信息
        emit('player_stats', {
            'username': username,
            'chips': game.player_data[username]['chips'],
            'current_bet': game.player_data[username]['bet']
        })
        
        # 发送游戏状态更新
        emit('game_update', {
            'players': [
                {
                    'username': p['username'],
                    'chips': p['chips'],
                    'avatar': p['avatar'],
                    'bet': p['bet'],
                    'status': p['status'],
                    'isHost': p['isHost']
                } 
                for p in game.get_player_data()
            ],
            'current_player': game.get_current_player(),
            'status': game.status,
            'pot': game.pot,
            'communityCards': [card.to_dict() for card in game.community_cards] if game.community_cards else []
        }, room=room)

@socketio.on('player_action')
def on_player_action(data):
    username = data.get('username')
    action = data.get('action')
    amount = data.get('amount', 0)
    
    room = None
    for player_username, player_info in players.items():
        if player_username == username:
            room = player_info['room']
            break
    
    if not room or room not in games:
        emit('error', {'message': '游戏不存在'})
        return
        
    game = games[room]
    if game.get_current_player() != username:
        emit('error', {'message': '不是你的回合'})
        return
        
    if action == 'fold':
        game.player_data[username]['status'] = 'folded'
        next_player(game)
    elif action == 'check':
        # 检查是否可以看牌
        if game.current_bet > game.player_data[username]['bet']:
            emit('error', {'message': '当前无法看牌，请跟注或弃牌'})
            return
        next_player(game)
    elif action == 'call':
        # 计算需要跟注的金额
        call_amount = game.current_bet - game.player_data[username]['bet']
        if call_amount > game.player_data[username]['chips']:
            call_amount = game.player_data[username]['chips']
            game.player_data[username]['status'] = 'all-in'
        
        game.player_data[username]['chips'] -= call_amount
        game.player_data[username]['bet'] += call_amount
        game.pot += call_amount
        
        # 更新旧的players字典
        players[username]['chips'] = game.player_data[username]['chips']
        
        # 发送玩家状态更新
        emit('player_stats', {
            'username': username,
            'chips': game.player_data[username]['chips'],
            'current_bet': game.player_data[username]['bet']
        })
        
        next_player(game)
    elif action == 'raise':
        # 验证加注金额
        if amount <= game.current_bet:
            emit('error', {'message': '加注金额必须大于当前下注'})
            return
        
        if amount > game.player_data[username]['chips']:
            emit('error', {'message': '加注金额不能超过持有的筹码'})
            return
        
        # 计算实际下注金额
        raise_amount = amount - game.player_data[username]['bet']
        game.player_data[username]['chips'] -= raise_amount
        game.player_data[username]['bet'] = amount
        game.pot += raise_amount
        game.current_bet = amount
        game.last_raise = username
        
        # 更新旧的players字典
        players[username]['chips'] = game.player_data[username]['chips']
        
        # 发送玩家状态更新
        emit('player_stats', {
            'username': username,
            'chips': game.player_data[username]['chips'],
            'current_bet': game.player_data[username]['bet']
        })
        
        next_player(game)
    elif action == 'all-in':
        all_in_amount = game.player_data[username]['chips']
        game.player_data[username]['bet'] += all_in_amount
        game.pot += all_in_amount
        game.player_data[username]['chips'] = 0
        game.player_data[username]['status'] = 'all-in'
        
        # 更新旧的players字典
        players[username]['chips'] = 0
        
        # 更新当前最大下注
        if game.player_data[username]['bet'] > game.current_bet:
            game.current_bet = game.player_data[username]['bet']
            game.last_raise = username
        
        # 发送玩家状态更新
        emit('player_stats', {
            'username': username,
            'chips': 0,
            'current_bet': game.player_data[username]['bet']
        })
        
        next_player(game)
    
    # 更新游戏状态
    emit('game_update', {
        'players': [
            {
                'username': p['username'],
                'chips': p['chips'],
                'avatar': p['avatar'],
                'bet': p['bet'],
                'status': p['status'],
                'isHost': p['isHost']
            } 
            for p in game.get_player_data()
        ],
        'current_player': game.get_current_player(),
        'status': game.status,
        'pot': game.pot,
        'communityCards': [card.to_dict() for card in game.community_cards] if game.community_cards else []
    }, room=room)

@socketio.on('start_game')
def on_start_game(data):
    room = data.get('room')
    if room not in games:
        emit('error', {'message': '房间不存在'})
        return
        
    game = games[room]
    
    # 验证是否由房主发起
    if 'username' in data and data['username'] != game.host:
        emit('error', {'message': '只有房主可以开始游戏'})
        return
    
    # 检查玩家数量
    if len(game.players) < 4:
        emit('error', {'message': '至少需要4名玩家才能开始游戏'})
        return
    
    # 开始游戏
    start_game(room)

@socketio.on('next_game')
def on_next_game(data):
    room = data.get('room')
    if room in games:
        game = games[room]
        # 重置游戏状态准备下一局
        game.status = 'waiting'
        
        # 向所有玩家发送准备开始新一局的消息
        emit('system_message', {
            'message': '准备开始新一局游戏...',
            'timestamp': datetime.datetime.now().isoformat()
        }, room=room)
        
        # 延迟1秒后自动开始新一局
        socketio.sleep(1)
        start_game(room)

@socketio.on('chat_message')
def on_chat_message(data):
    username = data.get('username')
    room = data.get('room')
    message = data.get('message')
    
    if not all([username, room, message]):
        return
    
    # 添加时间戳
    timestamp = datetime.datetime.now().isoformat()
    
    # 向房间内所有玩家广播消息
    emit('chat_message', {
        'username': username,
        'message': message,
        'timestamp': timestamp
    }, room=room)

def next_player(game):
    """移动到下一位玩家"""
    active_players = [p for p in game.players if game.player_data[p]['status'] == 'active']
    
    # 检查是否只剩一个活跃玩家
    if len(active_players) <= 1:
        end_game(game)
        return
    
    # 检查当前轮次是否结束
    round_complete = True
    for player in active_players:
        if game.player_data[player]['bet'] < game.current_bet and game.player_data[player]['chips'] > 0:
            round_complete = False
            break
    
    if round_complete:
        # 进入下一轮
        if game.status == 'preflop':
            # 发三张翻牌
            game.deal_community_cards(3)
            game.status = 'flop'
            # 重置下注
            reset_bets(game)
            emit('community_cards', {'cards': game.community_cards}, room=game.room_id)
        elif game.status == 'flop':
            # 发一张转牌
            game.deal_community_cards(1)
            game.status = 'turn'
            # 重置下注
            reset_bets(game)
            emit('community_cards', {'cards': game.community_cards}, room=game.room_id)
        elif game.status == 'turn':
            # 发一张河牌
            game.deal_community_cards(1)
            game.status = 'river'
            # 重置下注
            reset_bets(game)
            emit('community_cards', {'cards': game.community_cards}, room=game.room_id)
        elif game.status == 'river':
            # 游戏结束，进行结算
            end_game(game)
            return
    
    # 移动到下一位活跃玩家
    while True:
        game.current_player_index = (game.current_player_index + 1) % len(game.players)
        current_player = game.players[game.current_player_index]
        if game.player_data[current_player]['status'] == 'active':
            break

def reset_bets(game):
    """重置当前轮次的下注"""
    game.current_bet = 0
    game.last_raise = None
    for player in game.players:
        game.player_data[player]['bet'] = 0

def end_game(game):
    """结束游戏并结算"""
    # 这里简化为随机选择一个赢家
    active_players = [p for p in game.players if game.player_data[p]['status'] != 'folded']
    if active_players:
        winner = random.choice(active_players)
        game.player_data[winner]['chips'] += game.pot
        
        # 更新旧的players字典
        if winner in players:
            players[winner]['chips'] = game.player_data[winner]['chips']
        
        # 发送游戏结果
        emit('game_result', {
            'winners': [{
                'username': winner,
                'avatar': game.player_data[winner]['avatar'],
                'amount': game.pot,
                'hand_name': '随机获胜手牌'  # 简化版，实际应该计算牌型
            }]
        }, room=game.room_id)
    
    # 重置游戏状态
    game.status = 'finished'
    game.pot = 0
    game.community_cards = []
    game.current_bet = 0
    
    # 更新游戏状态
    emit('game_update', {
        'players': [
            {
                'username': p['username'],
                'chips': p['chips'],
                'avatar': p['avatar'],
                'bet': 0,
                'status': 'active',
                'isHost': p['isHost']
            } 
            for p in game.get_player_data()
        ],
        'current_player': None,
        'status': game.status,
        'pot': 0
    }, room=game.room_id)

def start_game(room):
    """开始游戏"""
    if room not in games:
        return
    
    game = games[room]
    game.game_round += 1
    game.status = 'preflop'
    game.initialize_deck()
    game.deal_cards()
    game.community_cards = []
    game.pot = 0
    game.current_bet = game.big_blind
    
    # 重置玩家状态
    for player in game.players:
        game.player_data[player]['status'] = 'active'
        game.player_data[player]['bet'] = 0
        game.player_data[player]['cards'] = [game.deck.pop().to_dict() for _ in range(2)]
    
    # 设置庄家和盲注位置（简化为第一个玩家是小盲，第二个是大盲）
    game.current_player_index = 0
    if len(game.players) >= 1:
        small_blind_player = game.players[0]
        small_blind_amount = min(game.small_blind, game.player_data[small_blind_player]['chips'])
        game.player_data[small_blind_player]['chips'] -= small_blind_amount
        game.player_data[small_blind_player]['bet'] += small_blind_amount
        game.pot += small_blind_amount
        
        # 更新旧的players字典
        if small_blind_player in players:
            players[small_blind_player]['chips'] = game.player_data[small_blind_player]['chips']
    
    if len(game.players) >= 2:
        big_blind_player = game.players[1]
        big_blind_amount = min(game.big_blind, game.player_data[big_blind_player]['chips'])
        game.player_data[big_blind_player]['chips'] -= big_blind_amount
        game.player_data[big_blind_player]['bet'] += big_blind_amount
        game.pot += big_blind_amount
        
        # 更新旧的players字典
        if big_blind_player in players:
            players[big_blind_player]['chips'] = game.player_data[big_blind_player]['chips']
    
    # 发手牌给所有玩家
    for player in game.players:
        emit('deal_cards', {
            'cards': game.player_data[player]['cards']
        }, room=room)
    
    # 第一位行动的玩家是大盲注后面的玩家（从第三位开始）
    game.current_player_index = 2 % len(game.players)
    
    # 发送玩家状态更新
    for player in game.players:
        emit('player_stats', {
            'username': player,
            'chips': game.player_data[player]['chips'],
            'current_bet': game.player_data[player]['bet']
        }, room=room)
    
    # 发送游戏状态更新
    emit('game_update', {
        'players': [
            {
                'username': p['username'],
                'chips': p['chips'],
                'avatar': p['avatar'],
                'bet': p['bet'],
                'status': p['status'],
                'isHost': p['isHost']
            } 
            for p in game.get_player_data()
        ],
        'current_player': game.get_current_player(),
        'status': game.status,
        'pot': game.pot,
        'communityCards': [card.to_dict() for card in game.community_cards] if game.community_cards else []
    }, room=room)

if __name__ == '__main__':
    try:
        socketio.run(app, debug=True, host='0.0.0.0', port=8080)
    except OSError as e:
        print(f"Error: {e}")
        print("请尝试使用其他端口，例如: 8000, 8888, 3000 等")