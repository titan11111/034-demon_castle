# 034-demon_castle LEARNINGS（魔王城と母）

## 2026-08-14 最新JS 10搭載（サウンドノベル世界観維持）

### やったこと
- 既存3件（Proxy / Map・Set / Async-Await）に加え、#4〜#10を実装して計10件を搭載。
- iOS必須（viewport-fit / touch-action / ダブルタップ防止 / WebAudio unlock）を index.html / style.css に追加。
- 演出用 canvas・endingOverlay・セーブUI（💾記憶を刻む / 記憶を辿る）を追加。世界観語彙に合わせた命名。

### 搭載一覧（体感との対応）
| # | 技術 | サウンドノベルでの使い道 |
|---|------|--------------------------|
| 1 | Proxy | フラグ変更時の狂気・怪我演出トリガ |
| 2 | Map / Set | itemInventory（写真・ナイフ・宝石）/ completedScenes |
| 3 | Async / Await | シーン遷移の iris ワイプ待ち合わせ |
| 4 | Web Audio API | BGM decode + gain 制御 + タップSE + ミュート永続化 |
| 5 | Canvas clipping | IrisWipeEffect（evenodd 穴あき円）で場面転換 |
| 6 | IndexedDB | 進行・フラグ・アイテムの自動/手動セーブ |
| 7 | Vibration API | 震える台詞・毒霧・絶望幻影・選択肢タップ |
| 8 | requestAnimationFrame | タイプライター表示 / Canvas演出ループ |
| 9 | Performance API | シーン読込 mark/measure（内部計測） |
| 10 | Class / Inheritance | SceneEffect → IrisWipe / NoiseCanvas |

### 効いたこと
- 台詞は RAF タイプライターで「読む余白」が生まれ、ホラー演出と相性が良い。
- セーブを「記憶」表現にしたので、UI追加でも世界観を壊しにくい。

## 2026-08-18 サウンドノベル演出 #11〜#20（本文は無改変）

### やったこと
- 台詞・分岐・4結末の文言は触っていない。魔王CGの背景合成は未着手（タイタン指示で後回し）。
- 8MB圧縮は今回しない（タイタン許可。iOSの滑らかさを優先）。
- 1000行超えのためシナリオを `story.js` に分割。エンジンは `script.js`。

### 搭載
| # | 技術 | 使い道 |
|---|------|--------|
| 11 | AudioParam + BiquadFilter | BGMクロスフェード、負傷/狂気時のローパス |
| 12 | StereoPanner + 生成SE | プシュー／ガシャァン／バキッ／カツンを実音化（新音声ファイルなし） |
| 13 | Intl.Segmenter | 約物で呼吸する日本語タイプライター、万魔の雫／死者の谷にルビ |
| 14 | Web Animations API | CGのKen Burns（病室・城・ミナ・魔王など） |
| 15 | Convolver + 生成アンビエント | 病室の雨、城の残響、幻影の心拍 |
| 16 | CSS @property --madness | 狂気・負傷の画面汚染。TRUE ENDで浄化 |
| 17 | 回想パネル + 長押し送り | 既読は速く、未読は長押しでもタイプし切る。`confirm` 廃止 |
| 18 | Image.decode 先読み | 同室は切替なし、森→城はアイリス、ほかはクロスフェード |
| 19 | 結末の音と光 | 白アウト／黒アウトにBGM変化。記憶の扉でタイトルへ |
| 20 | Wake Lock + visibilitychange | 復帰時に AudioContext.resume と BGM再接続 |

### 本文側の修正（欠落していた演出の復旧）
- `demon_trial_start` は texts と checkFlag が同居していたため、旧エンジンでは幻影シーンが飛ばされていた。判定はテキスト終了後に行うよう変更。文言自体は変更していない。

## 2026-08-18 魔王CGに玉座背景を合成

- タイタン格納の玉座背景を `images/throne.png` に正規化。
- 立ち絵原板は `images/maou-sprite.png` に退避。
- ゲーム参照の `images/maou.png` は玉座＋魔王の合成CG。下40%を暗くしてテキスト窓と重なっても読めるようにした。
- 長い生成ファイル名は重複のため削除。

## 2026-08-18 エンディング6本化

既存4結末の台詞は無改変。分岐だけ足した。

| 種別 | シーン | 条件 |
|---|---|---|
| TRUE | end_true | 拒絶 × ミナ救出 |
| GOOD | end_remembered | 記憶を出す × ミナ救出（新規） |
| NORMAL | end_sacrifice | 魂を燃やす |
| BAD | end_memory_loss | 記憶を出す × ミナ未救出 |
| BAD | end_bad_dead | ミナを呼ぶが未救出 |
| BAD | end_amusement | 拒絶 × greed × yandere（新規） |

エンジンは `checkAll`（AND）を追加。

## 2026-08-18 追加CGをシーンへ接続

短いファイル名に正規化し、本文は変えず参照だけ差し替えた。

| ファイル | 担当 |
|---|---|
| bridge.png | 吊り橋（死者の谷） |
| treasure.png | 宝物庫 |
| piero.png | ピエロ＋背景合成（steal_gem / 余興） |
| phantom.png | 絶望の幻影（罵る息子） |
| phantom-face.png | 幻影に呑まれたとき |
| remembered.png | GOOD「誰かが覚えている」 |

## 2026-08-18 出荷

- SPEC.md を最低限で作成。
- 8MB超過はタイタン許可済み。harnessの通信量項目はFAILになりうる。
- GitHub Pages 公開 + Slack通知。



### 次に気をつけること
- 8MBは許可済みだが、実機でデコードが重い場合は WebP 化を検討する。
