# sobasay-menu

そば清のメニュー/ポスター編集PWA。ビルド不要の静的HTML(素のHTML/CSS/JSのみ、外部ライブラリ禁止)。

## 構成

- `index.html` — タブコンテナ(横組み編集/縦組み編集/ポスター取込/設定)。各エディタをiframeで読み込む
- `sobasay_menu_editor.html` — 横組みエディタ(大きいファイル。全読みせず該当箇所だけGrepで探す)
- `sobasay_menu_vertical.html` — 縦組みエディタ(同上)
- `poster/` — ポスター取込。独立PWA(専用manifest/sw/icon)。画像をClaude API(claude-opus-4-8)で解析しレイヤーHTML化。モデル出力は`<style>`+`.page`のみで、編集JS等のガワは`index.html`内の固定テンプレート(SHELL_*)が合成する
- `poster_ac_gohan.html` — レイヤー式ポスターのデモ
- `sw.js` + `version.js` — SWキャッシュ。**ファイルを追加したらsw.jsのASSETSに追加し、version.jsのAPP_VERSIONを必ず上げる**

デプロイ: mainへのマージでVercelが自動デプロイ → https://sobasay-menu.vercel.app

## 規約

- 用紙サイズはmm単位(B5=182×257mm)。`@page`と`@media print`で余白なし原寸印刷対応
- 編集可能テキストは`contenteditable`、写真枠は`[data-photo]`(クリックで差し替え)
- 保存はlocalStorage(キー: `sobasay_*` / `poster_*`)。自動保存+読込時復元が基本
- 画面表示は`transform: scale()`のフィットスケール(`--scale`変数)

## 作業ルール

- このファイルに書いてある事実を再調査しない
- 修正は最小差分。無関係なリファクタ・整形を巻き込まない
- ブラウザでの動作確認・スクリーンショットの手順は `e2e-test` スキル参照
- ポスターテンプレートの新規作成・修正の規約は `poster-template` スキル参照
- 報告は簡潔に: 結果1〜2文+変更ファイルの列挙

## 自律性と品質

- 些細な判断(命名・書式・同等な実装の選択)は聞かずに妥当な方を選んで進め、選択を一言添える。スコープ変更と破壊的操作のみ確認する
- 独立した調査・検証が複数あるときはサブエージェントに並列で委任する
- UIを変更したら必ず実際にブラウザで動かして確認してから完了報告する(e2e-testスキル)
- 進捗・完了の報告は、このセッションのツール実行結果で裏付けられる事実だけを述べる。未検証なら未検証と明記する
