---
name: e2e-test
description: この環境でHTMLの動作確認・スクリーンショット・E2Eテストを行う手順。UIの変更を検証するとき、画面を確認したいときに使用。
---

# ブラウザ動作確認の手順

Chromiumは `/opt/pw-browsers/chromium-1194/chrome-linux/chrome` にプリインストール済み。`playwright install` は実行しないこと。

## スクリーンショット(最速)

```bash
/opt/pw-browsers/chromium-1194/chrome-linux/chrome --headless --no-sandbox --disable-gpu \
  --window-size=760,1150 --screenshot=OUT.png "file:///home/user/sobasay-menu/FILE.html"
```

撮ったPNGはReadツールで目視確認する。

## 操作を伴うテスト(playwright-core)

scratchpadディレクトリで一度だけ: `npm install playwright-core`

```js
const { chromium } = require('playwright-core');
const browser = await chromium.launch({
  executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
  args: ['--no-sandbox']
});
```

- Claude API呼び出しのモック: `page.route('https://api.anthropic.com/v1/messages', ...)` でSSE(`text/event-stream`)を返す。実APIキーはこの環境にない
- localStorage検証は `about:blank`/`setContent` では不可。ファイルに書き出して `file://` で開く

## Service Worker / PWA のテスト

`file://` ではSWが登録されないため、HTTPサーバ経由で行う:

```bash
python3 -m http.server 8321 &  # リポジトリルートで
# → http://localhost:8321/... に対して playwright でテスト
```

オフライン検証は `context.setOffline(true)` → `page.reload()`。

## 注意

- テストスクリプトや出力はscratchpadに置く(リポジトリを汚さない)
- SWキャッシュはバージョン名依存。挙動が古いときは version.js の上げ忘れを疑う
