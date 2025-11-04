# Fullstuck 専用サーバー Mastodon

## 概要

このリポジトリは [Mastodon](https://github.com/mastodon/mastodon) のコードに対し、[kmyblue](https://github.com/kmycode/mastodon) の絵文字リアクション関係のコードをパッチ当てしたものです。「emoji」を含むコードを片っ端から取り込みましたので、

_このコードは何か分かる?_

_マジな話オレは分からない_

_でもそれってマジでクールなことでさオレは知る必要がないのさ_

という状態です。


## オリジナル

以下のコミットがベースになっています。

* Mastodon
  * [v4.5.0-rc.2](https://github.com/mastodon/mastodon/tree/v4.5.0-rc.2)
* kmyblue
  * [kb_development ブランチ](https://github.com/kmycode/mastodon/commits/kb_development/) の 2025-11-01 14:16:11 JST 時点のソースコード (コミット 6489673297d06a3dcde44c4ab0f5e94701bc91e6)
  * kmyblue は [Fedibird](https://github.com/fedibird/mastodon) のソースコードを含んでいます。


## 機能

本リポジトリでは、Mastodon のリリースバージョンに以下の機能を追加しています。

* 絵文字リアクション
* 横長絵文字のサポート
* 絵文字の前後のスペースをゼロ幅スペースに変更
* 8K 画像のサポート (8192x5760 画素、99MiB まで対応)
* 16 枚までの画像添付のサポート
* Misskey アカウントで、ユーザー名に絵文字を使っていると、ショートコードが丸出しになるのを修正。


## 用途

本リポジトリのソースコードは、[Fullstuck 専用サーバー](https://fedi.fullstuck.net/) で運用されることを想定しています。


## リポジトリの運用

* オリジナルの Mastodon に[機能](#機能)に記載されている機能を追加するパッチを提供することを目的としています。
* 履歴は残さずに squash したりして 1 コミットで機能を追加できるようにしています。
* オリジナルには rebase で追従しています。
* 機能追加でどこを変更したかについては、[カスタマイズ](#カスタマイズ)に記述しています。


## カスタマイズ

### リアクションデッキのボタンのデザイン

ボタンの形状は、`app/javascript/styles/mastodon/components.scss` の `.status__emoji-reactions-bar` → `.emoji-reactions-bar__button` で変更できます。

ボタンの色は `$emoji-reaction-selected-color` で定義され、`app/javascript/styles/mastodon/_variables.scss` と `app/javascript/styles/mastodon-light/variables.scss` にあります。


### 絵文字ピッカーのデザイン

絵文字ピッカーは `app/javascript/mastodon/features/compose/components/emoji_picker_dropdown.jsx` で実装されており、`<EmojiPicker>` の属性で変更できます。

本リポジトリでは `perLine` を 5 に、`emojiSize` を 40px に変更しています。

オリジナルは `perLine` は 8、`emojiSize` は 22px です。


### 他のリモートユーザーの絵文字リアクションを受信する

`config/settings.yml` の `receive_other_servers_emoji_reaction` で設定できます。デフォルトは false です。


### 他のリモートユーザーに絵文字リアクションを送信する

`config/settings.yml` の `streaming_other_servers_emoji_reaction` で設定できます。デフォルトは false です。


### 投稿にリアクションできる数

`.env.production` に `EMOJI_REACTION_PER_ACCOUNT_LIMIT` を設定します。デフォルトは 3 です。

受信するリモートユーザーのリアクションの最大数は `EMOJI_REACTION_PER_REMOTE_ACCOUNT_LIMIT` で設定します。デフォルトは 3 です。

### テーマカラー

`app/serializers/manifest_serializer.rb` の `theme_color` 及び `background_color` で変更できます。デフォルトは `#191b22` です。


### 添付ファイルの数

投稿に添付できるファイルの数は `app/models/status.rb` の `MEDIA_ATTACHMENTS_LIMIT` で変更できます。デフォルトは 4 です。

5 以上の添付ファイルの表示をサポートするには、以下のファイルを変更する必要があります。
* `app/javascript/styles/mastodon/components.scss`
  * `.media-gallery` の `&--layout-N` を追加します。_N_ は添付ファイルの数です。
* `app/javascript/mastodon/components/status.jsx`
  * `getAttachmentAspectRatio` でアスペクト比を変更します。添付ファイルが 5 以上の場合コンテンツが縦に潰れます。
* その他変更が必要かもしれないファイル。
  * `app/javascript/mastodon/features/compose/components/upload_form.tsx`
    * コンテンツのアップロード時の表示を改善したい場合
  * `app/javascript/mastodon/components/media_gallery.jsx`
    * 投稿の表示を改善したい場合

本リポジトリでは、16 枚までの画像投稿と画像表示に対応しています。
画像表示は kmyblue の実装を採用し、9 枚以上の添付ファイルがある場合は 3 列で表示するようにしています。
ただし、6、7、8 枚の場合の表示が窮屈な感じなのと、投稿画面は未改修ですので、このあたりに何らかの手を入れるかもしれません。

### 添付画像のサイズ

添付画像のサイズは、画素数とバイト数で制限されています。

画素数の上限は `app/models/concerns/attachmentable.rb` にハードコーディングされており、オリジナルは 7680x4320 ピクセルですが、本リポジトリは 8192x5760 に変更しています。

バイト数の上限は `app/models/media_attachment.rb` にハードコーディングされており、デフォルトは 16 GiB ですが、本リポジトリは 99GiB に変更しています。


### 絵文字の前後に入るスペースの変更

`app/javascript/mastodon/reducers/compose.js` の `insertEmoji` メソッドで絵文字の前後にスペースを入れています。
本リポジトリでは ZWSP (U+200B) に変更しています。


### 絵文字を使った Misskey アカウントのユーザー名

Misskey は絵文字の前後にスペースを入れる必要がありません。Mastodon でそれに対応するには、`app/models/custom_emoji.rb` の `SCAN_RE` を変更する必要があります。
本リポジトリでは kmyblue の実装を採用しています。