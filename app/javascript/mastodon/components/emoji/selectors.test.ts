import { Map as ImmutableMap } from 'immutable';

import { selectFrequentlyUsedEmoji } from './selectors';

describe('selectFrequentlyUsedEmoji', () => {
  it('returns emojis ordered by most recent use', () => {
    const state = {
      settings: ImmutableMap({
        frequentlyUsedEmojis: ImmutableMap({
          first: 100,
          second: 200,
          third: 300,
        }),
      }),
    } as never;

    expect(selectFrequentlyUsedEmoji(state).slice(0, 3)).toEqual([
      'third',
      'second',
      'first',
    ]);
  });

  it('prefers timestamp values over legacy frequency values', () => {
    const state = {
      settings: ImmutableMap({
        frequentlyUsedEmojis: ImmutableMap({
          legacy: 10,
          recent: 1_700_000_000_000,
        }),
      }),
    } as never;

    expect(selectFrequentlyUsedEmoji(state)[0]).toBe('recent');
  });
});
