# 予定帳

自分の予定を iPhone で管理する個人用 PWA。素の HTML/CSS/JS（ビルドなし・外部ライブラリなし）。
仕様の正本は `仕様書.md`。ファイル構成もそちらの4章。

## 決まり

- 予定は端末の中（localStorage）だけ。外部サービスへ送る機能を足すときは本人に確認する。
- **保存の読み書きは `app/store.js` に閉じ込める。** 通知のために iPhone アプリの入れ物へ包むとき（仕様書 D1）、保存先を差し替える場所を1か所にするため。
- **`app/cal.js` と `app/store.js` は画面に触らない。** `tools/test.js` が Node からそのまま呼んで検査するため。どちらかを直したら `node tools/test.js` を通す。
- **予定の `id` を変えない・使い回さない。** バックアップの読み込みは `id` で同じ予定かを見分ける。
- 祝日は `app/cal.js` で計算している（2007〜2099 年。仕様書 2.7）。祝日法が変わったら、内閣府「国民の祝日について」の一覧で `tools/test.js` の答えも直す。
- 公開先は `https://qorigame256.github.io/yoteicho/`（リポジトリ `qorigame256/yoteicho`）。main へ push すると `.github/workflows/pages.yml` が `app/` だけを公開する。アカウント・作者・push の決まりは共通ルール「GitHub Pages で公開するとき」。
- 動作確認は `.claude/launch.json` の `app`（`node tools/serve.js`、http://localhost:8767/。使用中なら自動で別の番号）をブラウザ画面で開き、iPhone 幅（375px）で見る。
- サービスワーカー（`app/sw.js`）は「保存済みの版を先に出し裏で更新」方式。ファイルを足したら `FILES` にも足す。中身を変えて公開するときは `CACHE` の版数を上げる。
- 同じ住所（qorigame256.github.io）に家計簿・マリカTA記録が同居している。localStorage のキーとサービスワーカーの取っておく場所の名前は `yoteicho` で始め、ほかのアプリのものに触らない。
