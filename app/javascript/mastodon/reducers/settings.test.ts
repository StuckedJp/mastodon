import { Map as ImmutableMap } from 'immutable';

import { EMOJI_USE } from 'mastodon/actions/emojis';

import settings from './settings';

describe('settings emoji usage', () => {
  beforeEach(() => {
    vi.spyOn(Date, 'now').mockReturnValue(1_700_000_000_000);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('moves the most recently used emoji to the front', () => {
    const state = ImmutableMap({
      frequentlyUsedEmojis: ImmutableMap({
        grinning: 1_700_000_000_001,
        heart: 1_700_000_000_000,
      }),
      saved: true,
    });

    const updated = settings(state, {
      type: EMOJI_USE,
      emoji: { id: 'heart' },
    });
    const frequent = updated.get('frequentlyUsedEmojis') as ImmutableMap<
      string,
      number
    >;

    expect(frequent.get('heart')).toBe(1_700_000_000_002);
    expect(updated.get('saved')).toBe(false);
  });
});
