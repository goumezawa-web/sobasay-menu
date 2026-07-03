---
name: poster-template
description: レイヤー式ポスターHTML(編集可能テンプレート)の規約と構造。ポスター/メニューのテンプレートを新規作成・修正するとき、poster/index.htmlの生成ロジックを触るときに使用。
---

# レイヤー式ポスターの規約

参考実装: `poster_ac_gohan.html`(単体完結型)、`poster/index.html`(AI生成+固定ガワ合成型)。

## レイヤー構成

1. **文字レイヤー**: すべてのテキスト要素に `contenteditable`。ホバー時に赤破線アウトライン
2. **図形レイヤー**: 帯・ロゴ・アイコン・装飾はCSSまたはインラインSVGで作図(ラスター画像禁止)
3. **写真レイヤー**: `[data-photo]` の空div。クリック→file input→`<img>`(object-fit:cover)を挿入

## ページ構造

- `.page` に用紙実寸をmm指定(B5=182×257 / A4=210×297)。`position:relative; overflow:hidden`
- `.stage > .scaler` で包み、`--scale` 変数+`transform:scale()`で画面幅にフィット
  (スケール計算は `page.offsetWidth` を使う。transformの影響を受けない)
- 印刷: `@page { size: WmmHmm; margin:0 }`、`@media print` でツールバー非表示・scale解除

## 自動保存

- inputイベントごとに全`[contenteditable]`のinnerHTMLと全写真のdataURLをlocalStorageへ
- 写真は保存前にcanvasで長辺1600pxへ縮小(容量対策)
- 読込時に復元。キーはポスターごとに一意(`poster_state_<uid>`)

## poster/index.html の生成契約(トークン節約設計)

- モデル(claude-opus-4-8)の出力は `<style>` + `<div class="page">…</div>` の2ブロックのみ
- 編集JS・ツールバー・印刷CSS等のガワは `SHELL_HEAD / SHELL_MID / shellTail()` が合成
- モデルがフルHTMLを返した場合のフォールバックあり(`composePoster`)
- この分担を崩さないこと(ガワをプロンプトに戻すとトークン消費が倍増する)
- リクエスト設定: `effort: medium`、`max_tokens: 16000`、画像は長辺1568pxに縮小
