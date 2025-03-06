# 豪华德州扑克游戏

一个基于Flask和Socket.IO的在线多人德州扑克游戏。

## 特点

- 🎮 支持4-10人游戏
- 💰 完整的德州扑克规则
- 🎯 实时游戏状态更新
- 📊 实时排行榜系统
- 💬 游戏内聊天系统
- 🎨 精美的苹果风格UI设计
- 📱 响应式设计，支持手机和电脑

## 技术栈

- 后端：Flask + Flask-SocketIO
- 前端：HTML5 + CSS3 + JavaScript
- 实时通信：Socket.IO
- 样式：原生CSS，苹果设计风格

## 本地开发

1. 克隆仓库：
```bash
git clone https://github.com/yourusername/poker-game.git
cd poker-game
```

2. 安装依赖：
```bash
pip install -r requirements.txt
```

3. 运行开发服务器：
```bash
python app_simple.py
```

4. 访问 http://localhost:5000

## 部署

1. 确保安装了所有依赖：
```bash
pip install -r requirements.txt
```

2. 使用gunicorn启动（生产环境）：
```bash
gunicorn --worker-class eventlet -w 1 app_simple:app
```

## 游戏规则

1. 每个玩家初始获得1000筹码
2. 小盲/大盲可在创建房间时设置
3. 支持ALL IN，最多可设置3轮发牌
4. 每位玩家有60秒决策时间

## 功能特点

- 实时排行榜
- 游戏内聊天系统
- 玩家统计
- 房间系统
- 观战模式

## 贡献

欢迎提交Issue和Pull Request！

## 许可

MIT License
