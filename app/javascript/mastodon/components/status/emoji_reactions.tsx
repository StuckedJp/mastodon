import { useCallback } from 'react';

import type { List as ImmutableList, Map as ImmutableMap } from 'immutable';

import StatusEmojiReactionsBar from '@/mastodon/components/status_emoji_reactions_bar';
import { emojiReact, unEmojiReact } from '@/mastodon/actions/interactions';
import {
  enableEmojiReaction,
  isHideItem,
  isShowItem,
} from '@/mastodon/initial_state';
import { useAppDispatch, useAppSelector } from '@/mastodon/store';

type EmojiReactionStatus = ImmutableMap<string, unknown>;
type EmojiReactionValue = ImmutableMap<string, unknown>;

export const StatusEmojiReactions: React.FC<{
  statusId: string;
  myEmojiReactionsOnly?: boolean;
}> = ({ statusId, myEmojiReactionsOnly }) => {
  const dispatch = useAppDispatch();
  const status = useAppSelector((state) => state.statuses.get(statusId));
  const emojiReactions = status?.get('emoji_reactions') as
    | ImmutableList<EmojiReactionValue>
    | undefined;
  const serverSupportsReactions = useAppSelector((state) =>
    state.accounts.getIn([
      state.statuses.getIn([statusId, 'account']),
      'server_features',
      'emoji_reaction',
    ]),
  );
  const handleEmojiReact = useCallback(
    (targetStatus: EmojiReactionStatus, emoji: unknown) => {
      dispatch(emojiReact(targetStatus, emoji));
    },
    [dispatch],
  );
  const handleUnEmojiReact = useCallback(
    (targetStatus: EmojiReactionStatus, emoji: unknown) => {
      dispatch(unEmojiReact(targetStatus, emoji));
    },
    [dispatch],
  );

  if (
    !enableEmojiReaction ||
    !status ||
    !emojiReactions?.size ||
    (isHideItem('emoji_reaction_unavailable_server') &&
      !serverSupportsReactions)
  ) {
    return null;
  }

  return (
    <StatusEmojiReactionsBar
      emojiReactions={emojiReactions}
      myReactionOnly={
        myEmojiReactionsOnly || !isShowItem('emoji_reaction_on_timeline')
      }
      status={status}
      onEmojiReact={handleEmojiReact}
      onUnEmojiReact={handleUnEmojiReact}
    />
  );
};