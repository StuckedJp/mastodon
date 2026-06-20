import { configureStore } from '@reduxjs/toolkit';
import { Map, fromJS } from 'immutable';
import { Provider } from 'react-redux';

import type * as InitialState from '@/mastodon/initial_state';
import { reducerWithInitialState } from '@/mastodon/reducers';
import {
  accountFactoryAPI,
  accountFactoryImmutable,
  statusFactoryImmutable,
} from '@/testing/factories';
import { render, screen } from '@/testing/rendering';

import { Status } from '..';

vi.mock('@/mastodon/initial_state', async (importOriginal) => ({
  ...(await importOriginal<typeof InitialState>()),
  enableEmojiReaction: true,
  isHideItem: () => false,
  isShowItem: () => true,
}));

vi.mock('../action_bar', () => ({ StatusActionBar: () => null }));
vi.mock('../meta', () => ({ StatusMeta: () => null }));
vi.mock('@/mastodon/components/emoji_view', () => ({
  EmojiView: ({ name }: { name: string }) => <span>{name}</span>,
}));

function renderStatus(
  props: Partial<React.ComponentProps<typeof Status>> = {},
  reblog = false,
) {
  const status = statusFactoryImmutable({
    id: 'post',
    account: accountFactoryAPI({ id: 'author' }),
  }).set(
    'emoji_reactions',
    fromJS([
      { name: '😀', count: 2, me: false },
      { name: '🎉', count: 1, me: true },
    ]),
  );
  const store = configureStore({
    reducer: reducerWithInitialState({
      meta: Map({ locale: 'en', emoji_style: 'native' }),
      accounts: Map({ author: accountFactoryImmutable({ id: 'author' }) }),
      statuses: Map({
        post: status,
        boost: statusFactoryImmutable({
          id: 'boost',
          account: accountFactoryAPI({ id: 'author' }),
        }).set('reblog', 'post'),
      }),
    }),
  });
  return render(
    <Provider store={store}>
      <Status id={reblog ? 'boost' : 'post'} muted {...props} />
    </Provider>,
  );
}

describe('Status emoji reactions', () => {
  beforeEach(() => {
    vi.stubGlobal(
      'ResizeObserver',
      class {
        observe = vi.fn();
        unobserve = vi.fn();
        disconnect = vi.fn();
      },
    );
  });

  afterEach(() => vi.unstubAllGlobals());

  it.each(['feed', 'thread', 'page'] as const)(
    'shows existing reactions in the %s variant',
    (variant) => {
      renderStatus({ variant });
      expect(screen.getByRole('button', { name: /😀\s*2/ })).toBeTruthy();
      expect(screen.getByRole('button', { name: /🎉\s*1/ })).toBeTruthy();
    },
  );

  it('shows reactions on the original post when boosted', () => {
    renderStatus({}, true);
    expect(screen.getByRole('button', { name: /😀\s*2/ })).toBeTruthy();
  });

  it('preserves the option to show only my reactions', () => {
    renderStatus({ myEmojiReactionsOnly: true });
    expect(screen.queryByRole('button', { name: /😀\s*2/ })).toBeNull();
    expect(screen.getByRole('button', { name: /🎉\s*1/ })).toBeTruthy();
  });

  it.each([{ showActions: false }, { isQuotedPost: true }, { hidden: true }])(
    'hides reactions with %o',
    (props) => {
      renderStatus(props);
      expect(screen.queryByRole('button', { name: /😀\s*2/ })).toBeNull();
      expect(screen.queryByRole('button', { name: /🎉\s*1/ })).toBeNull();
    },
  );
});
