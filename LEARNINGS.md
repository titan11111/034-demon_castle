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

### 次に気をつけること
- 画像・音声合計が8MB超。次回改修なら HE-AAC(m4a) 化と PNG 圧縮が先。
- IndexedDB セーブは同一端末のみ。iPhone実機での WebAudio 復帰は未検証。
- performance 計測はユーザー通知せず内部のみ（没入感優先）。
