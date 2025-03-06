# 德州扑克在线游戏

这是一个基于 Flask 和 Socket.IO 的在线德州扑克游戏。

## 功能特点

- 支持多人在线游戏（4-10人）
- 实时游戏状态更新
- 房间系统
- 玩家筹码管理
- 完整的德州扑克游戏流程

## 技术栈

- 后端：Flask + Flask-SocketIO
- 前端：HTML5 + CSS3 + JavaScript
- WebSocket：Socket.IO
- 部署：Render

## 目录结构

```
.
├── app_simple.py          # 主应用文件
├── static/               # 静态文件目录
│   ├── css/             # CSS 样式文件
│   │   └── style.css    # 主样式文件
│   ├── js/              # JavaScript 文件
│   │   ├── simple.js    # 主要游戏逻辑
│   │   └── tabs.js      # 标签页切换逻辑
│   └── images/          # 图片资源
├── templates/           # HTML 模板
│   ├── index.html      # 主页面
│   └── diagnose.html   # 诊断页面
├── requirements.txt     # Python 依赖
├── Procfile            # Render 部署配置
├── runtime.txt         # Python 运行时版本
└── render.yaml         # Render 服务配置
```

## 安装和运行

1. 克隆仓库：
```bash
git clone [repository-url]
cd poker-game
```

2. 创建虚拟环境：
```bash
python -m venv .venv
source .venv/bin/activate  # Linux/Mac
# 或
.venv\Scripts\activate  # Windows
```

3. 安装依赖：
```bash
pip install -r requirements.txt
```

4. 运行应用：
```bash
python app_simple.py
```

5. 访问应用：
打开浏览器访问 http://localhost:5000

## 游戏规则

1. 每个房间需要 4-10 名玩家
2. 游戏使用标准的德州扑克规则
3. 每位玩家初始筹码为 1000
4. 小盲注默认为 10，大盲注默认为 20

## 部署

本项目已配置为可在 Render 上部署。详细部署步骤请参考部署文档。

## 开发说明

- `app_simple.py` 包含所有后端逻辑
- `simple.js` 包含主要的前端游戏逻辑
- `style.css` 包含所有样式定义
- Socket.IO 用于实时游戏状态更新

## 贡献

欢迎提交 Issue 和 Pull Request。

## 许可证

MIT License
