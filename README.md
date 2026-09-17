# 🕳️ 黑洞 · Black Hole

在無限宇宙地圖中移動黑洞（WASD / 方向鍵），吞噬一切天體——
**吃得越多，黑洞就越大，重力範圍也越廣！**

## ▶️ 立即遊玩（線上）

🔗 **永久公開網址：** https://kan1214.github.io/default-project/

純前端 Canvas 遊戲，無需安裝，任何瀏覽器（含手機）即可暢玩。

### 本地遊玩

直接用瀏覽器開啟 `web/index.html`，或：

```bash
cd web
python3 -m http.server 8080
# 開啟 http://localhost:8080
```

### 遊戲內容

| 天體 | 質量 | 說明 |
|------|------|------|
| 🌑 隕石 | 1 | 低質量，滿地都是 |
| ⭐ 恆星 | 3 | 中等質量 |
| 💫 彗星 | 2 | 移動速度快 |
| 🪐 行星 | 10 | 高質量 |
| ☀️ 巨星 | 40 | 超大量，一口超補！ |

- 吞噬越多物體，黑洞等級（LV）提升，重力範圍與吸力越強
- 支援鍵盤（WASD / 方向鍵）與手機觸控方向鍵
- P / ESC 暫停，右上角可靜音

## Project Structure

```
├── web/                # 🎮 遊戲本體（靜態網頁，供 GitHub Pages 部署）
│   ├── index.html      #   遊戲頁面
│   ├── style.css       #   樣式
│   └── game.js         #   遊戲引擎（Canvas）
├── src/                # TypeScript 應用程式邏輯
│   ├── app/            #   Application logic
│   ├── config/         #   Configuration files
│   ├── middleware/     #   Middleware functions
│   ├── models/         #   Data models
│   ├── services/       #   Business logic services
│   ├── types/          #   TypeScript type definitions
│   └── utils/          #   Utility functions
├── tests/
│   ├── unit/           # Unit tests
│   ├── integration/    # Integration tests
│   └── e2e/            # End-to-end tests
├── docs/               # Documentation
├── scripts/            # Build and utility scripts
└── .github/            # GitHub workflows (CI + Pages 部署)
```

## Development

```bash
# 安裝套件（用於 TS/測試環境）
npm install

# 跑測試
npm test

# TypeScript 型別檢查
npm run typecheck
```

## Deployment

「黑洞」遊戲透過 [GitHub Actions](.github/workflows/deploy-pages.yml) 自動部署到 GitHub Pages：
每次 push 到 `main` 分支，`web/` 目錄的內容會自動上線。

## Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

This project is licensed under the MIT License.