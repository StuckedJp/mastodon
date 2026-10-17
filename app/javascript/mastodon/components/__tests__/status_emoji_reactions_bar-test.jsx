import { List, Map } from 'immutable';

import { render, fireEvent, screen, waitFor } from '@/testing/rendering';

import { fetchAccounts } from 'mastodon/actions/accounts_typed';
import { accountDefaultValues, createAccountFromServerJSON } from 'mastodon/models/account';

import { EmojiReactionButton } from '../status_emoji_reactions_bar';

vi.mock('mastodon/initial_state', async importOriginal => ({
  ...await importOriginal(),
  me: 'self',
}));

vi.mock('mastodon/actions/accounts_typed', async importOriginal => ({
  ...await importOriginal(),
  fetchAccounts: vi.fn(args => ({ type: 'fetch-accounts', payload: args })),
}));

const account = (id) => createAccountFromServerJSON({
  ...accountDefaultValues,
  id,
  username: id,
  acct: `${id}@example.org`,
  display_name: `Name ${id}`,
  avatar: `/avatars/${id}.png`,
  avatar_static: `/avatars/${id}.png`,
});

const accounts = Map(['self', 'alice', 'bob', 'carol', 'dave', 'eve', 'frank'].map(id => [id, account(id)]));

const props = {
  name: 'party',
  domain: 'example.org',
  accountIds: List(['self', 'alice', 'bob', 'carol', 'dave', 'eve', 'frank']),
  accounts,
  dispatch: vi.fn(() => Promise.resolve()),
};

describe('<EmojiReactionButton />', () => {
  beforeEach(() => vi.clearAllMocks());

  it('shows accounts including the current account on hover without fetching cached accounts', async () => {
    render(<EmojiReactionButton {...props} />);
    expect(screen.queryByText('Name alice')).toBeNull();
    fireEvent.mouseEnter(screen.getByRole('button'));
    expect(await screen.findByText('Name alice')).toBeTruthy();
    expect(screen.queryByText('@alice@example.org')).toBeNull();
    expect(screen.getByText('Name alice').closest('.emoji-reactions-bar__tooltip-account').querySelector('img').getAttribute('src')).toBe('/avatars/alice.png');
    expect(screen.getByText('Name dave')).toBeTruthy();
    expect(screen.getByText('Name eve')).toBeTruthy();
    expect(screen.getByText('Name self')).toBeTruthy();
    expect(screen.getByText('Name frank')).toBeTruthy();
    expect(props.dispatch).not.toHaveBeenCalled();
    fireEvent.mouseLeave(screen.getByRole('button'));
    await waitFor(() => expect(screen.queryByText('Name alice')).toBeNull());
  });


  it.each([10, 11, 12])('shows ten accounts and the remaining count for %i reactions', async (count) => {
    const ids = Array.from({ length: count }, (_, index) => `user${index}`);
    const allAccounts = Map(ids.map(id => [id, account(id)]));
    render(<EmojiReactionButton {...props} accountIds={List(ids)} accounts={allAccounts} />);
    fireEvent.mouseEnter(screen.getByRole('button'));
    expect(await screen.findByText('Name user9')).toBeTruthy();
    expect(screen.queryByText('Name user10')).toBeNull();
    if (count > 10) {
      expect(screen.getByText(`(and ${count - 10} other user${count > 11 ? 's' : ''})`)).toBeTruthy();
    } else {
      expect(screen.queryByText(/other user/)).toBeNull();
    }
  });

  it('fetches only missing accounts on hover and displays them when received', async () => {
    const { rerender } = render(<EmojiReactionButton {...props} accounts={accounts.delete('alice')} />);
    expect(props.dispatch).not.toHaveBeenCalled();
    fireEvent.mouseEnter(screen.getByRole('button'));
    expect(fetchAccounts).toHaveBeenCalledWith({ accountIds: ['alice'] });
    rerender(<EmojiReactionButton {...props} />);
    expect(await screen.findByText('Name alice')).toBeTruthy();
  });

  it('fetches missing accounts on keyboard focus', () => {
    render(<EmojiReactionButton {...props} accounts={Map()} />);
    fireEvent.focus(screen.getByRole('button'));
    expect(fetchAccounts).toHaveBeenCalledWith({ accountIds: ['self', 'alice', 'bob', 'carol', 'dave', 'eve', 'frank'] });
  });

  it('shows a tooltip when only the current account reacted', async () => {
    render(<EmojiReactionButton {...props} accountIds={List(['self'])} />);
    fireEvent.mouseEnter(screen.getByRole('button'));
    expect(await screen.findByText('Name self')).toBeTruthy();
    expect(props.dispatch).not.toHaveBeenCalled();
  });

  it('preserves adding and removing remote custom emoji reactions', () => {
    const onEmojiReact = vi.fn();
    const onUnEmojiReact = vi.fn();
    const { rerender } = render(<EmojiReactionButton {...props} onEmojiReact={onEmojiReact} />);
    fireEvent.click(screen.getByRole('button'));
    expect(onEmojiReact).toHaveBeenCalledWith('party@example.org');
    rerender(<EmojiReactionButton {...props} me onUnEmojiReact={onUnEmojiReact} />);
    fireEvent.click(screen.getByRole('button'));
    expect(onUnEmojiReact).toHaveBeenCalledWith('party@example.org');
  });
});
