import PropTypes from 'prop-types';
import { PureComponent } from 'react';

import { FormattedMessage } from 'react-intl';

import { injectIntl } from './intl';

import classNames from 'classnames';

import ImmutablePropTypes from 'react-immutable-proptypes';
import { connect } from 'react-redux';

import { fetchAccounts } from 'mastodon/actions/accounts_typed';
import { isHideItem } from 'mastodon/initial_state';

import { Avatar } from './avatar';
import { DisplayName } from './display_name';
import { EmojiView } from './emoji_view';
import { Tooltip } from './tooltip';

export class EmojiReactionButton extends PureComponent {

  static propTypes = {
    accountIds: ImmutablePropTypes.list,
    accounts: ImmutablePropTypes.map.isRequired,
    dispatch: PropTypes.func.isRequired,
    name: PropTypes.string,
    domain: PropTypes.string,
    url: PropTypes.string,
    staticUrl: PropTypes.string,
    count: PropTypes.number,
    me: PropTypes.bool,
    onEmojiReact: PropTypes.func,
    onUnEmojiReact: PropTypes.func,
  };

  fetchingAccounts = false;

  getAccountIds = () => (this.props.accountIds?.toArray() ?? [])
    .slice(0, 10);

  loadAccounts = async () => {
    const accountIds = this.getAccountIds().filter(id => !this.props.accounts.has(id));
    if (this.fetchingAccounts || accountIds.length === 0) return;

    this.fetchingAccounts = true;
    try {
      await this.props.dispatch(fetchAccounts({ accountIds }));
    } finally {
      this.fetchingAccounts = false;
    }
  };

  onClick = () => {
    const { name, domain, me } = this.props;

    const nameParameter = domain ? `${name}@${domain}` : name;
    if (me) {
      if (this.props.onUnEmojiReact) this.props.onUnEmojiReact(nameParameter);
    } else {
      if (this.props.onEmojiReact) this.props.onEmojiReact(nameParameter);
    }
  };

  render () {
    const { name, url, staticUrl, count, me } = this.props;

    const classList = {
      'emoji-reactions-bar__button': true,
      'toggled': me,
    };

    const countView = count !== undefined && <span className='count'>{count}</span>;

    const button = (props = {}) => (
      <button {...props} className={classNames(classList)} type='button'>
        <span className='emoji'>
          <EmojiView name={name} url={url} staticUrl={staticUrl} />
        </span>
        {countView}
      </button>
    );

    const accountIds = this.getAccountIds();
    if (accountIds.length === 0) return button({ onClick: this.onClick });

    const remainingCount = Math.max(0, (this.props.accountIds?.size ?? 0) - accountIds.length);
    const accounts = accountIds.map(id => this.props.accounts.get(id)).filter(Boolean);

    return (
      <Tooltip
        placement='top'
        className='emoji-reactions-bar__tooltip'
        text={(
          <>
            {accounts.length > 0 ? accounts.map(account => (
              <span className='emoji-reactions-bar__tooltip-account' key={account.id}>
                <Avatar account={account} size={20} />
                <DisplayName account={account} variant='simple' />
              </span>
            )) : name}
            {remainingCount > 0 && (
              <span className='emoji-reactions-bar__tooltip-account'>
                <FormattedMessage
                  id='status.emoji_reactions_other_users'
                  defaultMessage='(and {count, plural, one {# other user} other {# other users}})'
                  values={{ count: remainingCount }}
                />
              </span>
            )}
          </>
        )}
      >
        {({ getTooltipProps, tooltipId }) => button(getTooltipProps({
          onClick: this.onClick,
          onMouseEnter: this.loadAccounts,
          onFocus: this.loadAccounts,
          'aria-describedby': tooltipId,
        }))}
      </Tooltip>
    );
  }

}

const ConnectedEmojiReactionButton = connect(state => ({ accounts: state.get('accounts') }))(EmojiReactionButton);

class StatusEmojiReactionsBar extends PureComponent {

  static propTypes = {
    emojiReactions: ImmutablePropTypes.list.isRequired,
    status: ImmutablePropTypes.map,
    onEmojiReact: PropTypes.func,
    onUnEmojiReact: PropTypes.func,
    myReactionOnly: PropTypes.bool,
  };

  onEmojiReact = (name) => {
    if (!this.props.onEmojiReact) return;
    this.props.onEmojiReact(this.props.status, name);
  };

  onUnEmojiReact = (name) => {
    if (!this.props.onUnEmojiReact) return;
    this.props.onUnEmojiReact(this.props.status, name);
  };

  render () {
    const { emojiReactions, myReactionOnly } = this.props;

    const isShowCount = !isHideItem('emoji_reaction_count');

    const emojiButtons = Array.from(emojiReactions)
      .filter(emoji => emoji.get('count') !== 0)
      .filter(emoji => !myReactionOnly || emoji.get('me'))
      .map((emoji, index) => (
        <ConnectedEmojiReactionButton
          accountIds={myReactionOnly ? undefined : emoji.get('account_ids')}
          key={index}
          name={emoji.get('name')}
          count={isShowCount ? (myReactionOnly ? 1 : emoji.get('count')) : undefined}
          me={emoji.get('me')}
          url={emoji.get('url')}
          staticUrl={emoji.get('static_url')}
          domain={emoji.get('domain')}
          onEmojiReact={this.onEmojiReact}
          onUnEmojiReact={this.onUnEmojiReact}
        />));

    return (
      <div className='status__emoji-reactions-bar'>
        {emojiButtons}
      </div>
    );
  }

}

export default injectIntl(StatusEmojiReactionsBar);
