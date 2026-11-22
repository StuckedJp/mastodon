# Repository Agent Guide

## 目的と必読資料

- このリポジトリは Mastodon をベースにした Fullstuck 専用サーバー向けのフォークです。
- 実装変更前に [`README.forked.md`](README.forked.md) を読み、独自機能と運用上の意図を確認してください。
- 環境構築は [`docs/DEVELOPMENT.md`](docs/DEVELOPMENT.md)、貢献方法は [`CONTRIBUTING.md`](CONTRIBUTING.md)、セキュリティは [`SECURITY.md`](SECURITY.md)、ActivityPub の注意点は [`FEDERATION.md`](FEDERATION.md) を参照してください。
- `README.forked.md` の一部は古い情報です。現在のコードを優先し、既存設定と実装が一致しているか確認してください。特にリモートリアクション設定は `config/settings.yml` で既定値 `true`、添付画像は 99 MiB 相当の `99.megabytes`、添付枚数は 16 です。

## フォーク固有の振る舞い

このフォークは Mastodon upstream を継続的に rebase する前提です。独自機能は upstream の実装だけで置き換えたり簡略化したりせず、各レイヤーの呼び出し元を追ってください。

独自機能は次のとおりです。

- 絵文字リアクション、ローカル・リモートリアクション、リアクション通知、リアルタイム配信、ActivityPub 配信
- 横長カスタム絵文字を含む絵文字表示
- 絵文字ピッカーの「よく使う絵文字」は使用した順番（直近使用順）で表示
- 投稿画面で絵文字の前後に挿入するゼロ幅スペース（U+200B）
- 最大 16 件のメディア添付
- 最大 47,185,920画素（8192 × 5760）、最大 99 MiB 相当の添付画像
- libvips 8.18以降の Ultra HDR JPEG gainmap 保持
- Misskey 等でユーザー名に絵文字を含むリモートアカウントのショートコード表示

変更が複数レイヤーをまたぐ場合は、入力 → 永続化/検証 → バックグラウンド処理 → REST/ActivityPub 出力 → React/streaming 表示まで追ってテストしてください。

## アーキテクチャと配置

| Area | 主な配置と責務 |
| --- | --- |
| HTTP/API | `config/routes.rb`、`config/routes/`、`app/controllers/`。Web、REST、OAuth、ActivityPub の入口 |
| Domain | `app/models/`、`app/models/concerns/`、`app/validators/`。関連、永続化、制約、ドメイン検証 |
| Authorization | `app/policies/`。可視性、アカウント制限、OAuth と権限 |
| Operations | `app/services/`。投稿、編集、リアクション、通知、リモート処理のオーケストレーション |
| Background | `app/workers/`。Sidekiq 配信、fan-out、federation、クリーンアップ |
| Serialization | `app/serializers/rest/`、`app/serializers/activitypub/`、`app/presenters/` |
| Federation | `app/lib/activitypub/`、`app/services/activitypub/`、`app/workers/activitypub/` |
| Web client | `app/javascript/mastodon/`。React、Redux、API 型、actions、reducers、クライアントモデル |
| Styles | `app/javascript/styles/mastodon/` と `mastodon-light/`、必要に応じて colocated SCSS modules |
| Streaming | `streaming/`。Node/Express/WebSocket、Redis pub/sub、PostgreSQL アクセス確認 |
| Search | `app/chewy/`、`app/lib/importer/` |
| Database | `db/migrate/`、`db/post_migrate/`、`db/schema.rb` |
| CLI/tasks | `lib/mastodon/cli/`、`lib/tasks/`、`bin/` |
| Tests | Ruby は `spec/`、frontend は `app/javascript/` 配下の colocated test/story、共有ヘルパーは `spec/support/` と `spec/fabricators/` |

PostgreSQL が主永続化ストレージ、Redis がキャッシュ・ロック・Sidekiq・リアルタイム配信に使われます。検索は Elasticsearch/OpenSearch、アセットと React は Vite を使用します。

## 絵文字リアクション

### ローカル入力と永続化

- ローカル書き込みは `app/controllers/api/v1/statuses/emoji_reactions_controller.rb` を入口にし、`EmojiReactService` / `UnEmojiReactService` を使用します。
- Fedibird互換の `update` エンドポイントと通常の create/destroy を同時に維持してください。
- `app/models/emoji_reaction.rb`、`app/validators/emoji_reaction_validator.rb`、`app/policies/status_policy.rb` の検証、Redis lock、重複、キャッシュ更新、通知を確認してください。
- `EMOJI_REACTION_LIMIT = 32767`、アカウント制限とリモートアカウント制限は環境変数 `EMOJI_REACTION_PER_ACCOUNT_LIMIT` / `EMOJI_REACTION_PER_REMOTE_ACCOUNT_LIMIT` で設定し、既定値は各 3 です。
- サーバー設定は `config/settings.yml` と `app/models/form/admin_settings.rb`、ユーザー設定は `app/models/user_settings.rb` と関連 concern を確認してください。

### Federation

- `app/lib/activitypub/activity.rb` は `Like`、`EmojiReaction`、`EmojiReact` をリアクションとして処理し、詳細は `activity/like.rb`、削除は `activity/undo.rb` です。受信側に別クラスがある前提で変更しないでください。
- `app/lib/activitypub/activity/like.rb` はリモート受信可否、リモート件数上限、Redis lock、重複、通知、トレンド更新を処理します。
- `ActivityPub::EmojiReactionSerializer` は Fedibird互換で `Like` を出力し、カスタム絵文字は `tag` に含めます。`UndoEmojiReactionSerializer` と `EmojiReactionDistributionWorker` をセットで確認してください。
- `DeliveryEmojiReactionWorker` は Redis の `emoji_reaction` イベントを配信します。`streaming/`、`actions/streaming.js`、`actions/notifications.js`、status/reaction reducers と、アカウントポリシー・ユーザー streaming 設定まで追ってください。

### Web UI とテスト

- 操作・表示は `app/javascript/mastodon/actions/interactions.js`、`components/status_emoji_reactions_bar.jsx`、`features/status/`、通知画面、リアクションデッキ、REST serializers を確認してください。
- `EmojiReactionButton` の tooltip は最大 10 件のリアクションアカウントを表示します。キャッシュ済みアカウントは再取得せず、欠落分だけ `fetchAccounts` で hover/focus 時に取得してください。現在のユーザーも表示対象に含めます。
- tooltip の各行は 20px `Avatar` と `variant='simple'` の絵文字対応 `DisplayName` を使用し、@handle は表示しません。スタイルは `.emoji-reactions-bar__tooltip` を維持し、共有 Tooltip の line clamp を上書きして全件を表示してください。
- 10件を超える場合は `status.emoji_reactions_other_users` を使い残数を表示します。`account_ids` がない場合、特に `myReactionOnly` の場合は tooltip を出さないでください。
- カスタム絵文字リアクションの追加・解除、on hover/focus、キャッシュ再利用、10件上限、残数表示の回帰テストは `app/javascript/mastodon/components/__tests__/status_emoji_reactions_bar-test.jsx` にあります。
- リアクション tooltip を変更した場合は次を実行します。

```sh
yarn test:js run app/javascript/mastodon/components/__tests__/status_emoji_reactions_bar-test.jsx
```

## メディアと絵文字レンダリング

### メディア添付

- `Status::MEDIA_ATTACHMENTS_LIMIT = 16`。投稿・編集・incoming Create/Update・instance capability・upload UI・gallery・詳細画面を一貫して確認してください。
- `MediaAttachment::IMAGE_LIMIT = 99.megabytes`、`Attachmentable::MAX_MATRIX_LIMIT = 47_185_920`（8192 × 5760）の画素数上限です。幅と高さそれぞれではなく、`width * height` を上限判定します。
- `app/javascript/mastodon/components/media_gallery.jsx` は 9件以上を3列、10～16件を4列として表示する独自レイアウトです。`app/javascript/styles/mastodon/components.scss` の `.media-gallery` 系と `StatusImageGrid` / compose upload UI の同時更新を確認してください。
- 投稿・編集・リモート受信・インスタンス API の添付上限を相互に不一致にしないでください。
- Ultra HDR の gainmap は `lib/paperclip/vips_lazy_thumbnail.rb` と `spec/lib/paperclip/lazy_thumbnail_spec.rb` を確認してください。対応 libvips がない環境では SDR にフォールバックし、EXIF/XMP 等は従来どおり削除します。

### 絵文字

- 絵文字ピッカーの最近使用絵文字は使用回数ではなく直近使用順で並べます。選択時のタイムスタンプ更新は `app/javascript/mastodon/reducers/settings.js`、並び替えは `app/javascript/mastodon/components/emoji/selectors.ts` を確認してください。
- 既存の `frequentlyUsedEmojis` に保存された使用回数データは互換性を保ちつつ扱い、タイムスタンプ形式へ移行します。
- 使用順の回帰テストは `app/javascript/mastodon/reducers/settings.test.ts` と `app/javascript/mastodon/components/emoji/selectors.test.ts` です。

- compose reducer の `insertEmoji` は絵文字を U+200B（ゼロ幅スペース）で囲みます。`needsSpace` とカーソル位置 `position + emoji.length + 1` を維持してください。
- `CustomEmoji::SCAN_RE` はローカル・リモートのショートコードを本文や表示名に対応させます。`app/lib/emoji_formatter.rb` とクライアント絵文字レンダーを確認してください。
- 横長絵文字のアスペクト比を picker、reaction、status で維持してください。リアクション色を変更する場合は `app/javascript/styles/mastodon/_variables.scss` と `mastodon-light/variables.scss` を確認してください。

## ローカル開発

- Ruby は `.ruby-version`、Node は `.nvmrc`、Yarn は `package.json` の `packageManager` を使用してください。現在は Ruby 4.0.10、Node 26.13、Yarn 4.18.1 です。
- PostgreSQL と Redis が必要です。画像・動画・ブラウザテストには libvips、ffmpeg、Chromium 等のネイティブ依存も必要です。
- 初期セットアップは `RAILS_ENV=development bin/setup`（データベース準備を含む、読み取り専用ではありません）。
- 開発起動は `bin/dev`。Rails はポート 3000、streaming は 4000、Vite と Sidekiq を起動します。
- 本番 frontend は `yarn build:production`、Rails assets は `bin/rails assets:precompile`、Storybook は `yarn storybook` です。

## 検証コマンド

変更箇所に最も近い focused check を先に実行し、境界をまたぐ変更は関連レイヤーのテストも実行してください。CI の workflow を最終基準にします。

| Change | Commands |
| --- | --- |
| Ruby behavior | `bin/rspec spec/path/to/file_spec.rb`、単一例は `bin/rspec spec/path/to/file_spec.rb:42` |
| Ruby style | `bin/rubocop` または変更した Ruby ファイル |
| Haml | `bin/haml-lint` |
| Frontend behavior | `yarn test:js run`、focused は `yarn test:js run app/javascript/path/to/file.test.tsx` |
| Component stories | `yarn test:storybook run` |
| JS/TS style/types | `yarn lint:js`、`yarn typecheck` |
| Streaming types | `yarn workspace @mastodon/streaming typecheck` |
| Styles/formatting | `yarn lint:css`、`yarn format:check` |
| Combined frontend | `yarn test` |

- Ruby テストは原則 `RAILS_ENV=test bin/rspec spec/...` またはリポジトリの `bin/rspec` を使用します。
- system test は `.github/workflows/test-ruby.yml` のセットアップとタグに従います。
- migration は ordinary/post-deployment の両フェーズを考慮し、`db/schema.rb` だけを直接更新せず migration を追加してください。削除・backfill・queued jobs との互換性を確認します。
- i18n source を変更した場合は `yarn i18n:extract --throws`、`bin/i18n-tasks check-normalized`、`bin/i18n-tasks unused -l en`、`bin/i18n-tasks missing -t used -l en`、`bin/i18n-tasks check-consistent-interpolations` を実行し、抽出された英語 catalog を確認してください。
- CI が要求する `bin/rake repo:check_locales_files` と `bin/rake yaml:lint` も必要に応じて実行します。

## 編集規約

- `.editorconfig` に従い、UTF-8・LF・末尾改行・2スペース相対インデントを使用してください。
- RuboCop、ESLint、Stylelint、formatter の既存設定に従ってください。
- サービス orchestration、永続化、authorization、serializer、worker の責務を既存レイヤーに保ってください。
- API を変更する場合は route、OAuth scope、policy、request spec、serializer、frontend consumer を確認してください。API変更には別リポジトリのドキュメント PR が必要です（`CONTRIBUTING.md`）。
- federation を変更する場合は incoming 処理と outgoing payload を分けてテストし、作成と Undo を確認してください。
- migration 以外でスキーマを変更しないでください。大きなテーブルの lock、バックフィル、デプロイ順、既存ジョブとの互換性を考慮してください。
- 既存の RSpec fabricator/support、frontend test pattern を使用してください。
- locale は Crowdin/source extraction の流れに従い、無関係な翻訳や生成物を手編集しないでください。
- 不要なリファクタリング、依存関係の無関係な更新、ファイル名・設計の一括変換を避け、ユーザーの既存変更を保持してください。
- 共有設定やデプロイ設定を変更する場合は、意図した変更であることを明示し、テストで検証してください。
- 作業完了時は変更内容、実行したチェック、未実行の依存条件を簡潔に報告してください。
