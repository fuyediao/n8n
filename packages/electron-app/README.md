# n8n Electron Desktop Application

這是 n8n 的 Electron 桌面應用程式版本。

## 功能

- 🖥️ 原生桌面應用體驗
- 🔒 本地數據存儲（使用 SQLite）
- 🚀 一鍵啟動，無需配置
- 📦 獨立打包，包含所有依賴

## 開發

### 安裝依賴

```bash
pnpm install
```

### 開發模式

```bash
# 在根目錄
pnpm dev

# 在 electron-app 目錄
cd packages/electron-app
pnpm dev  # 編譯 TypeScript
pnpm start  # 啟動 Electron
```

### 打包

```bash
# 打包所有平台
pnpm dist

# 僅打包 Windows
pnpm dist:win

# 僅打包 macOS
pnpm dist:mac

# 僅打包 Linux
pnpm dist:linux
```

## 架構

- **主進程** (`src/main.ts`): 管理 Electron 窗口和啟動 n8n 後端服務器
- **預載入腳本** (`src/preload.ts`): 提供安全的 IPC 通信橋樑
- **i18n 模組** (`src/i18n.ts`): 國際化支持，讀取 n8n 的翻譯文件
- **渲染進程**: 加載 n8n Web UI (http://localhost:5678)

## 國際化 (i18n)

應用使用 n8n 的 i18n 系統來支持多語言。目前支持：
- 從 `@n8n/i18n` 包讀取翻譯文件
- Electron 特定的翻譯鍵值（如 `app.starting`, `app.error` 等）
- 參數插值（如 `{attempts}`）

### 使用翻譯

```typescript
import { t, initI18n } from './i18n';

// 初始化（通常在應用啟動時）
initI18n('en'); // 或 'zh-TW', 'de' 等

// 使用翻譯
const message = t('app.starting'); // "Starting n8n..."
const errorMsg = t('app.errorAfterAttempts', undefined, { attempts: 5 });
```

## 注意事項

- 應用會在 `app.getPath('userData')/.n8n` 目錄存儲數據
- 後端服務器在本地端口 5678 運行
- 首次啟動可能需要一些時間來初始化數據庫

