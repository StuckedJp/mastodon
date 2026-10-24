# Repository Agent Guide

## Read before changing code

- Read [`README.forked.md`](README.forked.md) before changing behavior documented as specific to this fork.
- Use [`docs/DEVELOPMENT.md`](docs/DEVELOPMENT.md) for environment setup and [`CONTRIBUTING.md`](CONTRIBUTING.md) for contribution expectations.

## Preserve fork-specific behavior

This repository follows Mastodon upstream while carrying local customizations. Do not replace or simplify behavior based only on upstream implementations; first identify the fork's purpose and affected call sites.

The customizations documented in `README.forked.md` include emoji reactions and federation, wide-emoji handling, zero-width spacing around inserted emoji, support for up to 16 media attachments and larger images, and emoji in remote usernames. Keep these behaviors consistent across relevant Rails models, services, controllers, serializers, workers, settings, ActivityPub handling, and the React client.

When a change crosses application boundaries, trace the full path from input through persistence and background/federation processing to API or UI output. Update the related tests at each affected boundary.

## Project-specific workflow

- This is a fork intended to rebase onto Mastodon upstream. Before syncing or replacing upstream code, check the documented customizations and preserve their intent.
- Keep changes narrowly scoped and follow the surrounding Rails, React/Redux, and streaming-service patterns.
- API changes or additions also require a documentation pull request; see `CONTRIBUTING.md`.

## Architecture and source map

| Area | Locations and responsibilities |
| --- | --- |
| HTTP and API | `config/routes.rb`, `config/routes/`, `app/controllers/`; web, REST API, and ActivityPub entry points |
| Domain data | `app/models/`, `app/models/concerns/`, `app/validators/`; persistence, associations, validation, and shared model behavior |
| Authorization | `app/policies/`; preserve visibility, account restrictions, and OAuth checks at relevant entry points |
| Operations | `app/services/`; orchestration of posting, editing, notifications, reactions, and remote processing |
| Background jobs | `app/workers/`; Sidekiq delivery, fan-out, cleanup, and processing |
| Output | `app/serializers/rest/`, `app/serializers/activitypub/`, `app/presenters/`; API representations, federation payloads, and preloaded relationships |
| Federation | `app/lib/activitypub/`, `app/services/activitypub/`; parsing, dispatch, incoming activities, and remote data fetching; see also `FEDERATION.md` |
| Web client | `app/javascript/mastodon/`; React components, feature screens, API types, actions, reducers, and client models |
| Styling | `app/javascript/styles/`; shared styles and light/dark themes; components may also use colocated SCSS modules |
| Real-time service | `streaming/`; separate Node/Express/WebSocket service consuming Redis events, with PostgreSQL-backed access checks |
| Search | `app/chewy/`, `app/lib/importer/`; search indexes and bulk importers |
| Database | `db/migrate/`, `db/post_migrate/`, `db/schema.rb`; schema and post-deployment migrations |
| CLI and tasks | `lib/mastodon/cli/`, `lib/tasks/`, `bin/`; administration, maintenance, and development commands |
| Tests | `spec/` for Rails; colocated frontend tests and stories under `app/javascript/`; shared Ruby helpers and fabricators in `spec/support/` and `spec/fabricators/` |
| Runtime and delivery | `config/`, `Procfile.dev`, `Dockerfile`, `docker-compose.yml`, `.devcontainer/`, `.github/workflows/` |

PostgreSQL stores application data. Redis supports caching, locking, Sidekiq, and real-time pub/sub. Search integration additionally uses Elasticsearch or OpenSearch. Rails assets and the React client are built with Vite.

## Fork implementation checkpoints

Treat the following as navigation aids, not an exhaustive list of affected files. Search references before changing behavior, including notification types, settings, serializers, and timeline presenters.

### Emoji reactions

- Local writes enter through `app/controllers/api/v1/statuses/emoji_reactions_controller.rb` and use `EmojiReactService` / `UnEmojiReactService`. Preserve the Fedibird-compatible update endpoint as well as create/delete behavior.
- `app/models/emoji_reaction.rb`, `app/validators/emoji_reaction_validator.rb`, and `app/policies/status_policy.rb` participate in persistence, limits, and permissions. Preserve Redis locking, duplicate handling, grouped-reaction cache refresh, and notification behavior.
- Incoming federation dispatch in `app/lib/activitypub/activity.rb` recognizes `Like`, `EmojiReaction`, and `EmojiReact`; reaction handling is in `activity/like.rb` and removal in `activity/undo.rb`. Do not assume there is a separate incoming emoji-reaction activity class.
- Outgoing `ActivityPub::EmojiReactionSerializer` currently emits `Like` with emoji content and custom-emoji tags. Check `UndoEmojiReactionSerializer` and `ActivityPub::EmojiReactionDistributionWorker` when changing federation output.
- `DeliveryEmojiReactionWorker` publishes the `emoji_reaction` event to Redis timelines. Follow it through `streaming/`, client `actions/streaming.js`, `actions/notifications.js`, and status reducers. Preserve account policy and user streaming preferences.
- Client reaction controls span `actions/interactions.js`, `components/status_emoji_reactions_bar.jsx`, `features/status/`, notification screens, and the reaction deck. Check both timeline and detailed-status rendering, along with REST serializers and client API/model types.
- `EmojiReactionButton` in `app/javascript/mastodon/components/status_emoji_reactions_bar.jsx` uses the existing `Tooltip` on hover and keyboard focus to show up to 10 reacting accounts, including the current account. Each row shows a 20px `Avatar` and an emoji-aware `DisplayName` with `variant='simple'`; do not show the @handle. Preserve the white background, black text, border, and shadow in `.emoji-reactions-bar__tooltip` in `app/javascript/styles/mastodon/components.scss`, and its override of the shared Tooltip's line clamp so the full list remains visible.
- The reaction tooltip uses each reaction's `account_ids` and cached Redux accounts, fetching only missing accounts among the first 10 through `fetchAccounts` in `app/javascript/mastodon/actions/accounts_typed.ts` on hover/focus. Preserve the in-flight request guard and existing click-to-react/unreact behavior. When more than 10 accounts reacted, append the localized `status.emoji_reactions_other_users` message with the number beyond 10 (Japanese: `（他、N人のユーザー）`). No tooltip is shown without account IDs, including when the bar uses `myReactionOnly`.
- Regression coverage for the reaction tooltip is in `app/javascript/mastodon/components/__tests__/status_emoji_reactions_bar-test.jsx`. Run `yarn test:js run app/javascript/mastodon/components/__tests__/status_emoji_reactions_bar-test.jsx` when changing it; preserve coverage for avatars/display names, inclusion of the current account, the 10-account limit and remaining count, lazy fetching/cache reuse, focus, and custom-emoji reaction clicks.
- `EMOJI_REACTION_PER_ACCOUNT_LIMIT` and `EMOJI_REACTION_PER_REMOTE_ACCOUNT_LIMIT` default to 3 in the model. Server-wide switches live in `config/settings.yml`; user-level preferences also affect availability and delivery.

### Media and emoji rendering

- `Status::MEDIA_ATTACHMENTS_LIMIT` is 16. Trace local posting/editing, incoming ActivityPub create/update, instance capability serializers, upload UI, gallery layouts, and detailed-status rendering when changing it.
- `MediaAttachment::IMAGE_LIMIT` is `99.megabytes`. `Attachmentable::MAX_MATRIX_LIMIT` is 47,185,920 pixels (8192 × 5760); this is a pixel-count limit, not independent width and height limits. Keep upload validation, remote fetching, processing, and advertised capabilities consistent.
- `app/javascript/mastodon/reducers/compose.js` inserts U+200B zero-width spaces around emoji. Preserve cursor behavior and the distinction controlled by `needsSpace`.
- `CustomEmoji::SCAN_RE` supports emoji shortcodes adjacent to other text, including remote display names. Check `app/lib/emoji_formatter.rb` and client emoji rendering before tightening matching rules.
- Preserve wide-emoji aspect ratios in picker, reaction, and status rendering. Check theme variables and styles in both `mastodon/` and `mastodon-light/` when changing reaction colors.
- Some details in `README.forked.md` are historical: it references an older `.jsx` picker filename, describes remote reaction switches as false although the checked-in settings are true, and contains inconsistent image-size units. Resolve these against current code; do not restore historical values merely to match that text. Document any intentional behavior change.

## Local development

- Use the Ruby version in `.ruby-version`, Node version in `.nvmrc`, and Yarn version in `package.json` (`packageManager`). Resolve dependencies with the existing Gemfile/Yarn lockfiles.
- Follow `docs/DEVELOPMENT.md` for platform dependencies and container setup. Rails development and tests need PostgreSQL and Redis; image/video and browser tests need the corresponding native tools and browser setup.
- For initial development setup, use `RAILS_ENV=development bin/setup` after configuring the local environment. This installs dependencies and prepares the database; it is not a read-only check.
- Start the development stack with `bin/dev`. `Procfile.dev` defines Rails on port 3000, streaming on port 4000, Sidekiq, and Vite.
- Production frontend builds use `yarn build:production`; Rails asset precompilation uses `bin/rails assets:precompile`. Storybook uses `yarn storybook`.

## Validation commands

Run checks appropriate to the changed behavior. Start with focused tests and include affected boundary tests for cross-layer changes. CI workflows in `.github/workflows/` are authoritative; report missing dependencies or services and distinguish unrun checks from passing checks.

| Change | Commands |
| --- | --- |
| Ruby behavior | `bin/rspec spec/path/to/file_spec.rb`; one example: `bin/rspec spec/path/to/file_spec.rb:42`; full suite: `bin/rspec` |
| Ruby style | `bin/rubocop` (optionally pass changed Ruby files) |
| Haml | `bin/haml-lint` |
| Frontend behavior | `yarn test:js run`; focused: `yarn test:js run app/javascript/path/to/file.test.tsx`; add `-t "test name"` for one test |
| Component stories | `yarn test:storybook run` (uses Playwright Chromium) |
| JS/TS style and types | `yarn lint:js`, `yarn typecheck` |
| Streaming types | `yarn workspace @mastodon/streaming typecheck` |
| Styles and formatting | `yarn lint:css`, `yarn format:check` |
| Combined frontend checks | `yarn test` (lint, typecheck, and JavaScript tests) |

- For system tests that exercise JavaScript or streaming, use the setup and tags in `.github/workflows/test-ruby.yml`. Search integration tests require a configured search backend.
- Migration changes must account for both ordinary and post-deployment phases. Review `.github/workflows/test-migrations.yml` for one-step and two-step upgrade checks; its database-drop commands belong only in disposable test databases.
- For source-string changes, run `yarn i18n:extract --throws`, `bin/i18n-tasks check-normalized`, `bin/i18n-tasks unused -l en`, `bin/i18n-tasks missing -t used -l en`, and `bin/i18n-tasks check-consistent-interpolations`. Extraction writes the English frontend catalog; review the result. CI also checks `bin/rake repo:check_locales_files` and `bin/rake yaml:lint`.

## Editing conventions and completion

- Follow `.editorconfig`: UTF-8, LF, two-space indentation, final newline, and no trailing whitespace. Follow the repository's RuboCop, ESLint, Stylelint, and formatter configuration for language-specific rules.
- Keep service orchestration, persistence, authorization, serializers, and jobs in their existing layers. Preserve existing JS/JSX and TS/TSX conventions around the changed component; avoid unrelated conversions or state-management rewrites.
- For API changes, check route definitions, OAuth scopes, policies, request specs, serializers, and frontend consumers. For federation changes, test incoming handling and outgoing payloads separately, including Undo where applicable.
- Add database changes through migrations rather than editing only `db/schema.rb`. Consider large-table locking, backfills, deployment order, and compatibility with queued jobs.
- Use existing RSpec fabricators/support helpers and frontend test patterns. Regression tests should verify externally visible behavior, including limits, authorization, remote/custom emoji, and undo behavior where relevant.
- Keep locale updates aligned with Crowdin and source-string extraction. Avoid manual edits to unrelated translations, generated assets, or vendored data.
- Preserve existing user changes and keep patches focused on the request. Do not alter operational configuration or run deployment/maintenance commands as incidental validation.
- On completion, summarize changed behavior, checks run, and any remaining limitations. For documentation-only changes, verify referenced paths and commands without requiring the application test suite.
