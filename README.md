# GiftBoxStoryGenerator
簡単な操作でキャラクター同士がプレゼントを交換し合うグリーディング動画が作成できます

**GiftBoxStoryGeneratorJS** は、  
主に同人作家がイベントごとに利用する「贈る・受け取る」をテーマとした  
**演出付きストーリー（画像／動画／テキスト）を生成するWebベースのOSS**です。

バレンタイン・ホワイトデーなどなど企画や記念イベントなどで、  
参加者同士の直接交流を必要とせず、  
**静かに楽しめる個人体験型の演出**を提供することを目的としています。

もちろん作成した動画を各種SNSや個人サイトにアップロードして見せあって楽しむこともできます。

---

## 特徴

- 🎁 プレゼントボックス演出（開封・トランジション）
- 💬 キャラクター同士のセリフ表示（ADV風・チャット風）
- 💖 ハート・キラキラなどのパーティクル演出（Canvas / JS）
- 📱 スマートフォン縦画面対応
- 🎥 生成結果を **動画 or 静止画として保存・共有可能**
- 🔒 生成物は一時保存前提（イベント向け設計）
- 🤝 参加者同士の交流不要な設計

---

## 重要な方針

### ❌ 生成AIは使用しません

本プロジェクトは **生成AIを用いた文章・画像生成を行いません**。

- 参加者が入力したテキスト・画像
- 主催者が用意した素材
- JavaScript / Canvas による演出処理

これらを組み合わせて結果を生成します。

また、生成させた動画をクローラーに食べさせて生成AIの学習データに利用もさせないような仕組みをとっております。

創作物の責任所在が曖昧になることを避け、  
**人の手による創作体験を尊重する設計**を採用しています。

※作った動画を自分でSNSにアップなど、ジェネレータから手を離れた場合は担保してません。

---

## 想定ユースケース

- バレンタイン／ホワイトデー企画
- 記念日・誕生日演出
- 一次創作・二次創作イベント
- なんとなく作ってみたい時

---

## 技術スタック

- Frontend
  - HTML / CSS
  - JavaScript (ES6+)
  - Canvas API
- Optional Backend
  - Firebase Storage（一時保存）
  - Firebase Cloud Functions(またはHTTP APIが実装できる環境であれば何でも)

※ フロントエンド単体でも動作する構成を想定しています。

---

## 構成イメージ

GiftBoxStoryGenerator/
│
├─ public/ # 静的ファイル（ホスティング対象）
│ ├─ index.html # 入力フォーム
│ ├─ result.html # 確認画面
│ ├─ result.html # リザルト画面
│ │
│ ├─ css/ # スタイル定義
│ │ ├─ base.css
│ │ ├─ ui.css
│ │ └─ animation.css
│ │
│ ├─ js/
│ │ ├─ app/ # 入力UI・状態管理・画面遷移
│ │ │ ├─ form.js
│ │ │ ├─ state.js
│ │ │ └─ router.js
│ │ │
│ │ ├─ canvas/ # Canvas演出・シーン描画
│ │ │ ├─ sceneManager.js
│ │ │ ├─ heartEffect.js
│ │ │ ├─ particle.js
│ │ │ ├─ transition.js
│ │ │ └─ textEffect.js
│ │ │
│ │ ├─ video/ # 動画生成・書き出し
│ │ │ ├─ recorder.js
│ │ │ └─ export.js
│ │ │
│ │ └─ storage/ # 保存・共有（任意）
│ │ ├─ firebase.js
│ │ ├─ upload.js
│ │ └─ share.js
│ │
│ └─ assets/ # 素材（画像・UI・演出用）
│ ├─ images/
│ ├─ effects/
│ └─ ui/
│
├─ functions/ # Firebase Cloud Functions（任意）
│ ├─ index.js
│ ├─ cleanup.js # 期限切れデータ削除
│ └─ auth.js
│
├─ tools/ # 補助スクリプト（将来用）
│ └─ python/
│ ├─ cleanup.py
│ └─ analyze.py
│
├─ firebase.json
├─ firestore.rules
└─ storage.rules

---

## 開発方針

- JavaScriptとCSSのみで完結する演出を優先
- フレームワーク依存を極力避ける
- 主催者が「配布・運用」しやすい構成
- セキュリティとプライバシーへの配慮

---

## ライセンス

MIT License

本ソフトウェアは MIT ライセンスの下で公開されています。  
商用・非商用を問わず利用可能ですが、  
各イベント・作品における権利関係は利用者側で管理してください。

---

## 作者

- Author: まさご
- Project: GiftBoxStoryGenerator

---

## 注意事項

- 本OSSは特定のプラットフォームやイベントを公式に保証するものではありません。
- 使用により生じたトラブルについて、作者は責任を負いません。
- 二次創作イベント等で使用する場合は、各公式ガイドラインを遵守してください。
