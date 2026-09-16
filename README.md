# 投資ラボ ダッシュボード

株式模擬トレード授業向けの資産報告・ランキングダッシュボードです。

- 生徒は `/`(入力フォーム)からハンドルネーム・PIN・総資産・含み益損を報告します。
- 教員/生徒は `/dashboard`(共通パスワード保護)からランキングと資産推移グラフを閲覧できます。
- Cloudflare Pages + Pages Functions + D1 で構築し、GitHub リポジトリと連携して push すると自動デプロイされます。

## セットアップ手順

### 1. 依存関係のインストール

```bash
npm install
```

### 2. Cloudflare へログイン

```bash
npx wrangler login
```

### 3. D1 データベースの作成

```bash
npx wrangler d1 create investment_lab_db
```

出力される `database_id` を `wrangler.toml` の `database_id = "REPLACE_WITH_YOUR_D1_DATABASE_ID"` に貼り付けてください。

### 4. スキーマの適用

```bash
# ローカル動作確認用
npm run db:migrate:local

# 本番(Cloudflare上のD1)用
npm run db:migrate:remote
```

### 5. ダッシュボード用パスワードの設定

ローカル確認用に `.dev.vars` ファイルを作成(Gitには含めないでください):

```
DASHBOARD_PASSWORD=好きな共通パスワード
```

本番環境では Cloudflare Pages の管理画面(Settings → Environment variables)で `DASHBOARD_PASSWORD` を **Secret** として設定してください。

### 6. ローカルで動作確認

```bash
npm run build
npm run pages:dev
```

表示されたURLで `/`(入力フォーム)と `/dashboard`(ランキング)を確認してください。

### 7. GitHub 連携 & Cloudflare Pages への接続

1. このリポジトリを GitHub にプッシュします(`git push -u origin main`)。
2. Cloudflare ダッシュボード → Workers & Pages → Pages → "Connect to Git" から `investment_lab` リポジトリを選択。
3. ビルド設定:
   - Build command: `npm run build`
   - Build output directory: `dist`
4. Settings → Functions → D1 database bindings で `DB` を作成済みの `investment_lab_db` にバインド。
5. Settings → Environment variables で `DASHBOARD_PASSWORD` を Secret として登録。
6. 以降は `main` ブランチに push するたびに自動でビルド・デプロイされます。

## データモデル

- `students(handle_name, pin_hash, created_at)`: ハンドルネームごとのPIN(ハッシュ化済み)を保持。
- `entries(id, handle_name, total_assets, unrealized_pl, created_at)`: 報告するたびに1行追加される履歴テーブル。ランキングは各生徒の最新行、資産推移グラフは全履歴を使用します。

## セキュリティに関する補足

- PINは平文で保存せず、SHA-256でハッシュ化して保存しています。
- ダッシュボードの共通パスワードは環境変数として管理し、認証成功時のみ署名付きHttpOnly Cookieを発行します。
- 生徒間のなりすまし防止のためのPIN認証であり、厳格な本人確認ではない点にご留意ください(教室内利用を想定した簡易的な仕組みです)。
