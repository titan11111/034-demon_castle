/* =========================================
   1. グローバル変数・状態管理
   ========================================= */
   let currentBgm = null;

   let gameState = {
       scene: 'prologue_1', // 開始シーンID
       textIndex: 0,        // テキスト位置
       flags: {             // フラグ管理
           hasPhoto: false, // 息子の写真
           hasKnife: false, // ナイフ
           metMina: false,  // ミナと会ったか
           minaSaved: false,// ミナを救ったか
           minaTrust: 0,    // ミナの信頼度
           isInjured: false,// 怪我をしているか
           greed: false,    // 強欲（宝石）
           madness: 0       // 狂気度
       }
   };
   
   // HTML要素の取得
   const getEl = (id) => document.getElementById(id);
   
   /* =========================================
      2. シナリオデータ (セラ削除・孤独な戦い版)
      ========================================= */
   const scenarios = {
       // ---------------------------------------------------------
       // 【序章：出発】
       // ---------------------------------------------------------
       'prologue_1': {
           bgm: './audio/Dust_city.mp3',
           image: './images/sick.png',
           texts: [
               { name: "主人公", content: "（窓の外では、冷たい雨が降り続いている……）" },
               { name: "主人公", content: "（原因不明の熱病が息子を襲ってから、もう三日が過ぎた。医者も匙を投げた状態だ。）" },
               { name: "息子", content: "「……うぅ……ママ……苦しいよ……」" },
               { name: "主人公", content: "「大丈夫よ。ここにいるわ。……代わってあげられなくて、ごめんね」" },
               { name: "主人公", content: "息子の体は火のように熱い。伝説の『万魔の雫』を手に入れなければ、この子は助からない。" }
           ],
           nextScene: 'prologue_selection'
       },
       'prologue_selection': { 
           bgm: './audio/Dust_city.mp3',
           image: './images/sick.png',
           texts: [
               { name: "主人公", content: "旅支度を整える。鞄にはもう、あと一つしか物が入らない。" },
               { name: "主人公", content: "何を持っていくべきだろうか……？" }
           ],
           choices: [
               { text: "息子の写真", nextScene: 'prologue_end', setFlag: 'hasPhoto' },
               { text: "護身用ナイフ", nextScene: 'prologue_end', setFlag: 'hasKnife' }
           ]
       },
       'prologue_end': {
           bgm: './audio/Dust_city.mp3',
           image: './images/sick.png',
           texts: [
               { name: "主人公", content: "「……行ってくるね。必ず、お薬を持ち帰るから」" },
               { name: "息子", content: "「……ママ……いかないで……」" },
               { name: "主人公", content: "後ろ髪を引かれる思いを断ち切り、私は扉を閉めた。" }
           ],
           nextScene: 'forest_entry'
       },
   
       // ---------------------------------------------------------
       // 【第1章：帰らずの森】
       // ---------------------------------------------------------
       'forest_entry': {
           bgm: './audio/Dust_city.mp3',
           image: './images/forest.png',
           texts: [
               { name: "主人公", content: "ここが『帰らずの森』……肌を刺すような瘴気（しょうき）が漂っている。" },
               { name: "主人公", content: "目の前には二つの道があった。" }
           ],
           nextScene: 'branch_path'
       },
       'branch_path': {
           bgm: './audio/Dust_city.mp3',
           image: './images/forest.png',
           texts: [
               { name: "主人公", content: "どちらへ進もうか？" }
           ],
           choices: [
               { text: "獣道のような暗い近道", nextScene: 'forest_fruit' },
               { text: "安全だが遠回りな道", nextScene: 'forest_fruit', setFlag: 'lateArrival' }
           ]
       },
       'forest_fruit': { 
           bgm: './audio/Dust_city.mp3',
           image: './images/forest.png',
           texts: [
               { name: "主人公", content: "何時間歩いただろう。空腹で目が回りそうだ。" },
               { name: "主人公", content: "目の前に、毒々しい色だが甘そうな香りの果実がある。" },
               { name: "主人公", content: "（食べたら楽になれるかもしれない……でも、嫌な予感がする）" }
           ],
           choices: [
               { text: "構わず食べる", nextScene: 'forest_plant', setFlag: 'ateFruit' },
               { text: "我慢する", nextScene: 'forest_plant', setFlag: 'starving' }
           ]
       },
       'forest_plant': { 
           bgm: './audio/Dust_city.mp3',
           image: './images/plant.png', // 変更: 植物の画像を使用
           texts: [
               { name: "主人公", content: "その時、巨大な植物の蔦（ツタ）が襲いかかってきた！" },
               { name: "主人公", content: "「嘘……生きてるの！？」" }
           ],
           choices: [
               { text: "武器で切り払う！", nextScene: 'plant_fight_check' }, 
               { text: "必死に逃げる！", nextScene: 'plant_escape' }
           ]
       },
       // --- 判定用シーン ---
       'plant_fight_check': {
           checkFlag: 'hasKnife',
           trueScene: 'plant_win',
           falseScene: 'plant_fail'
       },
       'plant_win': {
           bgm: './audio/Dust_city.mp3',
           image: './images/forest.png',
           texts: [
               { name: "主人公", content: "私は持ってきたナイフを一閃させた！" },
               { name: "主人公", content: "蔦は悲鳴のような音を上げて千切れ飛ぶ。" },
               { name: "主人公", content: "「はぁ、はぁ……持ってきてよかった……」" }
           ],
           nextScene: 'castle_view'
       },
       'plant_fail': {
           bgm: './audio/Dust_city.mp3',
           image: './images/forest.png',
           texts: [
               { name: "主人公", content: "武器がない！ 私は素手で蔦を引き剥がそうとした。" },
               { name: "主人公", content: "「ぐっ……痛いッ！」", textClass: "shaking-text" },
               { name: "主人公", content: "蔦が皮膚に食い込む。私は悲鳴を上げながら、無理やり体をひねって脱出した。" },
               { name: "主人公", content: "なんとか逃げ切ったが、腕に深い傷を負ってしまった……。" }
           ],
           nextScene: 'castle_view',
           setFlag: 'isInjured'
       },
       'plant_escape': {
           bgm: './audio/Dust_city.mp3',
           image: './images/forest.png',
           texts: [
               { name: "主人公", content: "私は泥だらけになりながら、無我夢中で走り抜けた。" },
               { name: "主人公", content: "体力を激しく消耗してしまったが、命だけは助かったようだ。" }
           ],
           nextScene: 'castle_view',
           setFlag: 'starving'
       },
   
       // ---------------------------------------------------------
       // 【第2章：魔王城・侵入】
       // ---------------------------------------------------------
       'castle_view': {
           bgm: './audio/casle.mp3',
           image: './images/palece.png',
           texts: [
               { name: "主人公", content: "森を抜けると、雷鳴と共に巨大な魔王城が姿を現した。" },
               { name: "主人公", content: "あそこに、あの子を救う薬がある……！" }
           ],
           nextScene: 'castle_gate'
       },
       'castle_gate': {
           bgm: './audio/casle.mp3',
           image: './images/palece.png',
           texts: [
               { name: "主人公", content: "巨大な門。鍵はかかっていないが、不自然な静けさだ。" }
           ],
           choices: [
               { text: "構わず扉を押し開ける", nextScene: 'gate_trap' },
               { text: "周囲を慎重に調べる", nextScene: 'gate_safe' }
           ]
       },
       'gate_trap': {
           bgm: './audio/casle.mp3',
           image: './images/palece.png',
           texts: [
               { name: "効果音", content: "プシューッ！" },
               { name: "主人公", content: "「きゃあっ！？」扉の隙間から毒霧が噴き出した。" },
               { name: "主人公", content: "「げほっ、ごほっ！ ……毒……！？」" },
               { name: "主人公", content: "口元を袖で覆い、這いつくばって煙の下をくぐり抜ける。喉が焼けるように痛い。" }
           ],
           nextScene: 'corridor_encounter',
           setFlag: 'isInjured'
       },
       'gate_safe': {
           bgm: './audio/casle.mp3',
           image: './images/palece.png',
           texts: [
               { name: "主人公", content: "よく見ると、扉の足元に細いワイヤーが張ってあった。" },
               { name: "主人公", content: "これを外して……よし。安全に中へ入れるわ。" }
           ],
           nextScene: 'corridor_encounter'
       },
   
       'corridor_encounter': { 
           bgm: './audio/Songs_of_the_Soulless.mp3',
           image: './images/gaikotu.png', // 変更: 骸骨の画像を使用
           texts: [
               { name: "主人公", content: "城内は冷え切っている。……前方から、カツン、カツンと硬質な足音が聞こえてきた。" },
               { name: "主人公", content: "（骸骨の兵士……！ 見つかったら殺される）" }
           ],
           choices: [
               { text: "物陰に隠れてやり過ごす", nextScene: 'hide_success' },
               { text: "背後から不意打ちする", nextScene: 'attack_guard' }
           ]
       },
       'hide_success': {
           bgm: './audio/Songs_of_the_Soulless.mp3',
           image: './images/rouya.png',
           texts: [
               { name: "主人公", content: "息を殺して柱の陰に隠れる。兵士は気づかずに通り過ぎていった。" }
           ],
           nextScene: 'treasure_room'
       },
       'attack_guard': {
           bgm: './audio/Songs_of_the_Soulless.mp3',
           image: './images/gaikotu.png', // 変更: 骸骨の画像を使用
           texts: [
               { name: "主人公", content: "私は近くにあった燭台を掴み、骸骨の頭蓋を打ち砕いた！" },
               { name: "効果音", content: "ガシャァン！！" },
               { name: "主人公", content: "「はぁ、はぁ……ごめんね。でも、通らなきゃいけないの」" },
               { name: "主人公", content: "（あの子のためなら、私は鬼にだってなる）" }
           ],
           nextScene: 'treasure_room',
           setFlag: 'madness' // 狂気度アップ
       },
   
       'treasure_room': { 
           bgm: './audio/Songs_of_the_Soulless.mp3',
           image: './images/rouya.png',
           texts: [
               { name: "主人公", content: "通りがかった部屋には、山のような金銀財宝が積まれていた。" },
               { name: "主人公", content: "（これがあれば、街一番の医者を雇える……いや、一生遊んで暮らせるかも……）" }
           ],
           choices: [
               { text: "宝石をひとつだけ盗む", nextScene: 'steal_gem', setFlag: 'greed' },
               { text: "目もくれずに先へ進む", nextScene: 'ignore_gem' }
           ]
       },
       'steal_gem': { 
           bgm: './audio/Songs_of_the_Soulless.mp3',
           image: './images/piero.png', 
           texts: [
               { name: "主人公", content: "魔除けになりそうな赤い宝石をポケットに入れた。その時——" },
               { name: "ピエロ", content: "「おやおや、また一つ『愛』を『執着』と履き違えましたねぇ？」" },
               { name: "主人公", content: "「！？ 誰！？」" },
               { name: "ピエロ", content: "「ククク……その必死な顔、最高の余興ですよ、お母さん」", textClass: "shaking-text" },
               { name: "主人公", content: "不気味な道化師は、煙のように消え失せた。……ただの幻覚だったのだろうか。" }
           ],
           nextScene: 'dungeon_entry'
       },
       'ignore_gem': {
           bgm: './audio/Songs_of_the_Soulless.mp3',
           image: './images/rouya.png',
           texts: [
               { name: "主人公", content: "今は金銭など無価値だ。必要なのは息子の命を繋ぐ薬だけ。" },
               { name: "主人公", content: "私は迷わず部屋を出た。" }
           ],
           nextScene: 'dungeon_entry'
       },
   
       // ---------------------------------------------------------
       // 【第3章：地下牢のミナ】
       // ---------------------------------------------------------
       'dungeon_entry': {
           bgm: './audio/Songs_of_the_Soulless.mp3',
           image: './images/rouya.png',
           texts: [
               { name: "主人公", content: "地下から、誰かのすすり泣く声が聞こえる……。" },
               { name: "主人公", content: "導かれるように地下牢へ降りると、青白く光る少女の霊がいた。" }
           ],
           nextScene: 'meet_mina'
       },
       'meet_mina': { 
           bgm: './audio/Songs_of_the_Soulless.mp3',
           image: './images/mina.png',
           texts: [
               { name: "ミナ", content: "「ひっ……こ、来ないで……痛いのは嫌……」" },
               { name: "主人公", content: "少女は怯えている。どう接しようか？" }
           ],
           choices: [
               { text: "優しく声をかける", nextScene: 'mina_friend', setFlag: 'metMina' },
               { text: "警戒して距離を取る", nextScene: 'mina_wary' }
           ]
       },
       'mina_friend': {
           bgm: './audio/Songs_of_the_Soulless.mp3',
           image: './images/mina.png',
           texts: [
               { name: "主人公", content: "「怖くないわ。私はあなたを傷つけたりしない」" },
               { name: "ミナ", content: "「……本当？ おばさん……ううん、お姉さん、優しい目をしているのね」" },
               { name: "ミナ", content: "「私はミナ。この城の抜け道を教えてあげる」" }
           ],
           nextScene: 'mina_shortcut_offer',
           setFlag: 'minaTrust'
       },
       'mina_wary': {
           bgm: './audio/Songs_of_the_Soulless.mp3',
           image: './images/mina.png',
           texts: [
               { name: "主人公", content: "（罠かもしれない）私はナイフを隠し持ちながら様子を伺った。" },
               { name: "ミナ", content: "「……あなたも、魔王様の手下なのね。……あっちへ行って」" },
               { name: "主人公", content: "少女は姿を消してしまった。" }
           ],
           nextScene: 'stairs_climb'
       },
       'mina_shortcut_offer': {
           bgm: './audio/Songs_of_the_Soulless.mp3',
           image: './images/mina.png',
           texts: [
               { name: "ミナ", content: "「こっちの『死者の谷』を通れば、玉座の裏まで行けるわ」" },
               { name: "主人公", content: "（……あんな危険な場所を？ でも、時間を短縮できるかもしれない）" }
           ],
           choices: [
               { text: "ミナを信じて近道を行く", nextScene: 'shortcut_bridge' },
               { text: "正規ルート（階段）を行く", nextScene: 'stairs_climb' }
           ]
       },
       'shortcut_bridge': { 
           bgm: './audio/casle.mp3',
           image: './images/palece.png',
           texts: [
               { name: "主人公", content: "ミナの案内で古びた吊り橋を渡る。" },
               { name: "効果音", content: "バキッ！" },
               { name: "主人公", content: "「きゃあっ！」足場が崩れた！ ミナが手を伸ばしてくれている！" }
           ],
           choices: [
               { text: "ミナの手を掴む", nextScene: 'shortcut_success' },
               { text: "自力で向こう岸へ跳ぶ", nextScene: 'shortcut_fail' }
           ]
       },
       'shortcut_success': {
           bgm: './audio/casle.mp3',
           image: './images/mina.png',
           texts: [
               { name: "主人公", content: "私はミナの手を掴んだ！ 霊体のはずなのに、確かな温もりがあった。" },
               { name: "ミナ", content: "「よかった……！ お母さん、怪我はない！？」" },
               { name: "主人公", content: "足首を捻ってしまったが、ミナとの絆は深まった気がする。" }
           ],
           nextScene: 'throne_room',
           setFlag: 'minaSaved'
       },
       'shortcut_fail': {
           bgm: './audio/casle.mp3',
           image: './images/palece.png',
           texts: [
               { name: "主人公", content: "私は反射的に対岸へ飛び移った。" },
               { name: "ミナ", content: "「あっ……」" },
               { name: "主人公", content: "ミナは崩れた橋と共に谷底へ落ちていく……いや、霧散して消えてしまった。" },
               { name: "主人公", content: "（ごめん……でも、私は生きなきゃいけないの）" }
           ],
           nextScene: 'throne_room'
       },
       'stairs_climb': {
           bgm: './audio/Songs_of_the_Soulless.mp3',
           image: './images/rouya.png',
           texts: [
               { name: "主人公", content: "長い長い階段を登り続ける。足が棒のようだ。" },
               { name: "主人公", content: "（急がないと……あの子の命が……）" }
           ],
           nextScene: 'throne_room'
       },
   
       // ---------------------------------------------------------
       // 【第4章：試練】
       // ---------------------------------------------------------
       'throne_room': {
           bgm: './audio/casle.mp3',
           image: './images/maou.png',
           texts: [
               { name: "主人公", content: "扉を開け放つと、玉座には闇を纏った魔王が座していた。" },
               { name: "魔王", content: "「……人間か。死に損ないの小娘の匂いがするな」" },
               { name: "主人公", content: "「薬をちょうだい！ 対価なら払うわ！」" }
           ],
           nextScene: 'demon_dialogue_1'
       },
       'demon_dialogue_1': { 
           bgm: './audio/casle.mp3',
           image: './images/maou.png',
           texts: [
               { name: "魔王", content: "「なぜそこまでして息子を生かそうとする？ 人はいずれ死ぬ運命だ。早いか遅いかの違いでしかない」" }
           ],
           choices: [
               { text: "「親が子を守るのは本能よ」", nextScene: 'dialogue_logic' },
               { text: "「理屈じゃない！ 愛しているからよ」", nextScene: 'dialogue_emotion' }
           ]
    
       },
       'dialogue_logic': {
           bgm: './audio/casle.mp3',
           image: './images/maou.png',
           texts: [
               { name: "主人公", content: "「親が子を守るのは生物としての本能よ。理屈なんてないわ」" },
               { name: "魔王", content: "「ほう、本能か。獣と同じだな」" }
           ],
           nextScene: 'demon_dialogue_2'
       },
       'dialogue_emotion': {
           bgm: './audio/casle.mp3',
           image: './images/maou.png',
           texts: [
               { name: "主人公", content: "「理屈なんてどうでもいい！ 愛しているからよ！ あなたに愛は分からないの！？」" },
               { name: "魔王", content: "「……愛、か。もっとも脆く、裏切りやすい感情だ」" }
           ],
           nextScene: 'demon_dialogue_2'
       },
       'demon_dialogue_2': { 
           bgm: './audio/casle.mp3',
           image: './images/maou.png',
           texts: [
               { name: "魔王", content: "「仮に薬を持ち帰り、息子が生き延びたとしよう。だが成長した息子が、老いたお前を邪魔者扱いし、捨てたらどうする？」" }
           ],
           choices: [
               { text: "それでも構わない", nextScene: 'demon_trial_start', setFlag: 'pureLove' },
               { text: "そんなことはさせない", nextScene: 'demon_trial_start', setFlag: 'yandere' }
           ]
       },
       'demon_trial_start': { 
           bgm: './audio/casle.mp3',
           image: './images/maou.png',
           texts: [
               { name: "魔王", content: "「口では何とでも言える。……試してやろう。貴様の精神を破壊する『絶望の幻影』を！」" },
               { name: "主人公", content: "視界が歪む。……そこには、元気に成長した息子の姿があった。", effect: "noise-start" },
               { name: "幻影の息子", content: "『うざいんだよババア！ さっさと死ねよ！』", textClass: "shaking-text" },
               { name: "主人公", content: "「！！ ……あ、ああ……」" }
           ],
           checkFlag: 'hasPhoto', 
           trueScene: 'trial_photo_bonus',
           falseScene: 'trial_no_item'
       },
       'trial_photo_bonus': {
           bgm: './audio/casle.mp3',
           image: './images/maou.png',
           texts: [
               { name: "主人公", content: "心が折れそうになったその時、ポケットの写真が熱を持った。" },
               { name: "主人公", content: "（違う……これは幻よ。あの子は、こんな事言わない！）" },
               { name: "主人公", content: "私は写真を握りしめ、幻影を睨み返した！" }
           ],
           nextScene: 'final_choice'
       },
       'trial_no_item': {
           bgm: './audio/casle.mp3',
           image: './images/maou.png',
           texts: [
               { name: "主人公", content: "言葉の刃が胸に突き刺さる。" },
               { name: "主人公", content: "（私が死ねば、あの子は自由になれるの……？）" },
               { name: "主人公", content: "「……いいえ、違う！ これは魔王の見せる幻よ！」" },
               { name: "主人公", content: "ギリギリのところで自我を保つ。だが、精神はボロボロだ。" }
           ],
           nextScene: 'final_choice'
       },
   
       // ---------------------------------------------------------
       // 【最終章：決断】
       // ---------------------------------------------------------
       'final_choice': { 
           bgm: './audio/casle.mp3',
           image: './images/maou.png',
           texts: [
               { name: "魔王", content: "「ほう、耐え抜くか。……よかろう、薬はやろう」", effect: "noise-stop" },
               { name: "魔王", content: "「ただし代償が必要だ。貴様の『息子に関する記憶』を全て置いていけ」" },
               { name: "主人公", content: "「えっ……？」" },
               { name: "魔王", content: "「息子は助かる。だがお前は、自分が誰を助けたのか、なぜここにいるのかも忘れるのだ」" }
           ],
           choices: [
               { text: "記憶を差し出す", nextScene: 'end_memory_loss' },
               { text: "ふざけるなと拒絶する", nextScene: 'battle_start' }
           ]
       },
   
       // --- 【エンディング演出追加・修正版】 ---
       'end_memory_loss': {
           bgm: './audio/Songs_of_the_Soulless.mp3',
           image: './images/minatenn.png',
           texts: [
               { name: "主人公", content: "「……わかったわ。あの子が助かるなら、私の思い出なんて安いものよ」" },
               { name: "魔王", content: "「契約成立だ」" },
               { name: "システム", content: "……視界が白く染まっていく。", effect: "white-out" }, 
               { name: "？？？", content: "「ママ？ ママ！ 起きて！」" },
               { name: "私", content: "「……あなたは、だぁれ？ どうして泣いているの？」" },
               { name: "システム", content: "〜 BAD END? : 母の愛はどこへ 〜", textClass: "text-blood" } 
           ],
           nextScene: null
       },
       'battle_start': {
           bgm: './audio/casle.mp3',
           image: './images/maou.png',
           texts: [
               { name: "主人公", content: "「記憶を奪ったら、あの子を愛し続けられない！ そんな条件、呑めるもんですか！」" },
               { name: "魔王", content: "「ならば死ね」" },
               { name: "主人公", content: "魔王の魔力が膨れ上がる。勝てるはずがない。でも……！" }
           ],
           choices: [
               { text: "ミナの助けを呼ぶ", nextScene: 'battle_mina_check' },
               { text: "自分自身の魂を燃やす", nextScene: 'end_sacrifice' }
           ]
       },
       'battle_mina_check': {
           checkFlag: 'minaSaved', 
           trueScene: 'end_true',
           falseScene: 'end_bad_dead'
       },
       'end_true': {
           bgm: './audio/Songs_of_the_Soulless.mp3',
           image: './images/minatenn.png',
           texts: [
               { name: "主人公", content: "「ミナ！ お願い、力を貸して！」" },
               { name: "ミナ", content: "「待ってました！ お母さんの勇気、私が守る！」" },
               { name: "システム", content: "まばゆい光が魔王の闇を切り裂く。ミナが身を挺して魔王の動きを封じた！", effect: "white-out" }, 
               { name: "魔王", content: "「ぬぅ……死人の分際で……！」" },
               { name: "主人公", content: "その隙に、私は祭壇の薬を掴み取り、出口へと走り出した！" },
               { name: "息子", content: "「……ママ、おかえり」" },
               { name: "主人公", content: "「ただいま。……愛してるわ」" },
               { name: "システム", content: "〜 TRUE END : 奇跡の生還 〜", textClass: "text-gold" } 
           ],
           nextScene: null
       },
       'end_sacrifice': {
           bgm: './audio/Songs_of_the_Soulless.mp3',
           image: './images/sick.png',
           texts: [
               { name: "主人公", content: "私は自分の生命力を魔力に変えて特攻した。" },
               { name: "主人公", content: "相打ち覚悟の一撃が、魔王の仮面を砕く。" },
               { name: "魔王", content: "「……見事だ。褒美に薬をやろう。ただし、お前の命は尽きる」" },
               { name: "主人公", content: "薄れゆく意識の中で、薬を握りしめ、出口へと這いずり始めた。", effect: "black-out" }, 
               { name: "主人公", content: "（あの子に……渡すまでは……死ねない……！）" },
               { name: "システム", content: "〜 NORMAL END : 母の執念 〜" }
           ],
           nextScene: null
       },
       'end_bad_dead': {
           bgm: null,
           image: './images/maou.png',
           texts: [
               { name: "主人公", content: "「ミナ……！」" },
               { name: "システム", content: "しかし、誰も答えない。あの時、見捨ててしまったからだ。" },
               { name: "魔王", content: "「誰も助けには来ぬ。孤独に死ね」", effect: "black-out" }, 
               { name: "システム", content: "〜 BAD END : 孤独な最期 〜", textClass: "scream-text" }
           ],
           nextScene: null
       }
   };
   
   /* =========================================
      3. 関数定義 (システム更新)
      ========================================= */
   
   function playBgm(file) {
       if (!file) return;
       if (currentBgm && currentBgm.src.indexOf(file.replace('./', '')) !== -1) return; 
   
       if (currentBgm) {
           currentBgm.pause();
           currentBgm.currentTime = 0;
       }
   
       currentBgm = new Audio(file);
       currentBgm.loop = true;
       currentBgm.volume = 0.4;
       currentBgm.play().catch(e => console.log("Waiting for interaction", e));
   }
   
   function playSe(file) {
       if (!file) return;
       try {
           const audio = new Audio(file);
           audio.volume = 0.6;
           audio.play().catch(e => console.log("SE Play failed (file missing?):", file));
       } catch (e) {
           console.warn("SE Play error:", e);
       }
   }
   
   function setFlag(flagName) {
       if (flagName) {
           gameState.flags[flagName] = true;
           console.log(`Flag set: ${flagName}`);
       }
   }
   
   function checkCondition(sceneData) {
       if (sceneData.checkFlag) {
           const isTrue = gameState.flags[sceneData.checkFlag];
           const targetScene = isTrue ? sceneData.trueScene : sceneData.falseScene;
           loadScene(targetScene);
           return true;
       }
       return false;
   }
   
   function loadScene(sceneId) {
       console.log("Loading scene:", sceneId);
       
       let sceneData = scenarios[sceneId];
       if (!sceneData) {
           console.error("Scene not found:", sceneId);
           return;
       }
   
       if (checkCondition(sceneData)) return;
   
       gameState.scene = sceneId;
       gameState.textIndex = 0;
   
       const bgImage = getEl('backgroundImage');
       if (bgImage) {
           bgImage.style.display = '';
           bgImage.setAttribute('src', sceneData.image); 
       }
   
       playBgm(sceneData.bgm);
       
       const choicesContainer = getEl('choicesContainer');
       if(choicesContainer) choicesContainer.classList.add('hidden');
       
       const textWindow = getEl('textWindow');
       if(textWindow) textWindow.classList.remove('faded');
       
       // エンディング演出リセット
       const endingOverlay = getEl('endingOverlay');
       if(endingOverlay) {
           endingOverlay.className = 'hidden'; 
       }
       
       renderText();
   }
   
   function renderText() {
       const sceneData = scenarios[gameState.scene];
       const currentText = sceneData.texts[gameState.textIndex];
       
       const noiseOverlay = getEl('noiseOverlay');
       const endingOverlay = getEl('endingOverlay');
       const textBox = getEl('gameText');
       const nameBox = getEl('speakerName');
   
       if (noiseOverlay) noiseOverlay.classList.add('hidden');
       if (textBox) textBox.className = 'game-text';
   
       if (currentText.se) playSe(currentText.se);
   
       // 演出適用
       if (currentText.effect === 'noise-start' && noiseOverlay) noiseOverlay.classList.remove('hidden');
       
       if (endingOverlay) {
           if (currentText.effect === 'white-out') {
               endingOverlay.classList.remove('hidden');
               endingOverlay.classList.add('effect-white');
           } else if (currentText.effect === 'black-out') {
               endingOverlay.classList.remove('hidden');
               endingOverlay.classList.add('effect-black');
           }
       }
   
       if (currentText.textClass && textBox) textBox.classList.add(currentText.textClass);
   
       if (nameBox) nameBox.innerText = currentText.name;
       if (textBox) textBox.innerText = currentText.content;
   }
   
   function showChoices(choices) {
       const container = getEl('choicesContainer');
       const wrapper = container.querySelector('.choices-wrapper');
       if (!wrapper) return;
       
       wrapper.innerHTML = '';
   
       choices.forEach(choice => {
           const btn = document.createElement('button');
           btn.className = 'choice-item';
           btn.innerText = choice.text;
           
           btn.onclick = function() {
               if (choice.setFlag) setFlag(choice.setFlag);
               container.classList.add('hidden');
               loadScene(choice.nextScene);
           };
           wrapper.appendChild(btn);
       });
   
       container.classList.remove('hidden');
   }
   
   function next() {
       const choicesContainer = getEl('choicesContainer');
       if (choicesContainer && !choicesContainer.classList.contains('hidden')) return;
   
       const sceneData = scenarios[gameState.scene];
       if (!sceneData) return;
   
       if (gameState.textIndex < sceneData.texts.length - 1) {
           gameState.textIndex++;
           renderText();
       } 
       else {
           if (sceneData.choices) {
               showChoices(sceneData.choices);
           } 
           else if (sceneData.nextScene) {
               loadScene(sceneData.nextScene);
           } 
           else {
               if(confirm("物語は結末を迎えました。タイトルへ戻りますか？")) {
                   location.reload();
               }
           }
       }
   }
   
   /* =========================================
      4. 初期化
      ========================================= */
   function initGame() {
       console.log("Game Initializing...");
       const gameScreen = getEl('gameScreen');
       const startBtn = getEl('startBtn');
       const titleScreen = getEl('titleScreen');
   
       if (gameScreen) gameScreen.addEventListener('click', next);
   
       if (startBtn) {
           startBtn.addEventListener('click', function(e) {
               e.preventDefault();
               if(titleScreen) {
                   titleScreen.classList.add('hidden');
                   titleScreen.classList.remove('active');
               }
               if(gameScreen) {
                   gameScreen.classList.remove('hidden');
                   gameScreen.classList.add('active');
               }
               
               // ゲーム開始
               loadScene('prologue_1');
           });
       }
   }
   
   if (document.readyState === 'loading') {
       document.addEventListener('DOMContentLoaded', initGame);
   } else {
       initGame();
   }
