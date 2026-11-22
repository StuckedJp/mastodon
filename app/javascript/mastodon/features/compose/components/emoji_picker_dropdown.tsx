import type React from 'react';
import { PureComponent } from 'react';

import { defineMessages, FormattedMessage, useIntl } from 'react-intl';
import type { IntlShape } from 'react-intl';

import classNames from 'classnames';
import { supportsPassiveEvents } from 'detect-passive-events';
import { SmileyIcon } from '@phosphor-icons/react';
import type {
  EmojiData,
  EmojiProps,
  EmojiSkin,
  PickerProps,
} from 'emoji-mart';

import { IconButton } from '@/mastodon/components/button/redesign';
import { Popover } from '@/mastodon/components/popover';

import { EmojiPicker as EmojiPickerAsync } from '../../ui/util/async-components';

const messages = defineMessages({
  emoji: { id: 'emoji_button.label', defaultMessage: 'Insert emoji' },
  emoji_search: { id: 'emoji_button.search', defaultMessage: 'Search...' },
  custom: { id: 'emoji_button.custom', defaultMessage: 'Custom' },
  recent: { id: 'emoji_button.recent', defaultMessage: 'Frequently used' },
  search_results: {
    id: 'emoji_button.search_results',
    defaultMessage: 'Search results',
  },
  people: { id: 'emoji_button.people', defaultMessage: 'People' },
  nature: { id: 'emoji_button.nature', defaultMessage: 'Nature' },
  food: { id: 'emoji_button.food', defaultMessage: 'Food & Drink' },
  activity: { id: 'emoji_button.activity', defaultMessage: 'Activity' },
  travel: { id: 'emoji_button.travel', defaultMessage: 'Travel & Places' },
  objects: { id: 'emoji_button.objects', defaultMessage: 'Objects' },
  symbols: { id: 'emoji_button.symbols', defaultMessage: 'Symbols' },
  flags: { id: 'emoji_button.flags', defaultMessage: 'Flags' },
});

type EmojiComponent = React.ComponentType<EmojiProps>;
type PickerComponent = React.ComponentType<PickerProps>;

let EmojiPicker: PickerComponent | undefined;
let Emoji: EmojiComponent | undefined;

const listenerOptions: AddEventListenerOptions | boolean = supportsPassiveEvents
  ? { passive: true, capture: true }
  : true;

const notFoundFn = () => {
  const EmojiComponent = Emoji;

  if (!EmojiComponent) {
    return null;
  }

  return (
    <div className='emoji-mart-no-results'>
      <EmojiComponent emoji='sleuth_or_spy' size={32} />

      <div className='emoji-mart-no-results-label'>
        <FormattedMessage
          id='emoji_button.not_found'
          defaultMessage='No matching emojis found'
        />
      </div>
    </div>
  );
};

const LazyEmoji: React.FC<EmojiProps> = (props) => {
  const EmojiComponent = Emoji;

  return EmojiComponent ? <EmojiComponent {...props} /> : null;
};

interface ModifierPickerMenuProps {
  active?: boolean;
  onSelect: (modifier: EmojiSkin) => void;
  onClose: () => void;
}

class ModifierPickerMenu extends PureComponent<ModifierPickerMenuProps> {
  private node: HTMLDivElement | null = null;

  handleClick: React.MouseEventHandler<HTMLButtonElement> = (event) => {
    this.props.onSelect(Number(event.currentTarget.dataset.index) as EmojiSkin);
  };

  componentDidMount() {
    if (this.props.active) {
      this.attachListeners();
    }
  }

  componentDidUpdate() {
    if (this.props.active) {
      this.attachListeners();
    } else {
      this.removeListeners();
    }
  }

  componentWillUnmount() {
    this.removeListeners();
  }

  handleDocumentClick = (event: MouseEvent | TouchEvent) => {
    if (
      this.node &&
      event.target instanceof Node &&
      !this.node.contains(event.target)
    ) {
      this.props.onClose();
    }
  };

  attachListeners() {
    document.addEventListener('click', this.handleDocumentClick, {
      capture: true,
    });
    document.addEventListener(
      'touchend',
      this.handleDocumentClick,
      listenerOptions,
    );
  }

  removeListeners() {
    document.removeEventListener('click', this.handleDocumentClick, {
      capture: true,
    });
    document.removeEventListener(
      'touchend',
      this.handleDocumentClick,
      listenerOptions,
    );
  }

  setRef = (node: HTMLDivElement | null) => {
    this.node = node;
  };

  render() {
    const { active } = this.props;

    return (
      <div
        className='emoji-picker-dropdown__modifiers__menu'
        style={{ display: active ? 'block' : 'none' }}
        ref={this.setRef}
      >
        {[1, 2, 3, 4, 5, 6].map((modifier) => (
          <button
            key={modifier}
            type='button'
            onClick={this.handleClick}
            data-index={modifier}
          >
            <LazyEmoji emoji='fist' size={22} skin={modifier as EmojiSkin} />
          </button>
        ))}
      </div>
    );
  }
}

interface ModifierPickerProps {
  active: boolean;
  modifier: EmojiSkin;
  onChange: (modifier: EmojiSkin) => void;
  onClose: () => void;
  onOpen: () => void;
}

class ModifierPicker extends PureComponent<ModifierPickerProps> {
  handleClick = () => {
    if (this.props.active) {
      this.props.onClose();
    } else {
      this.props.onOpen();
    }
  };

  handleSelect = (modifier: EmojiSkin) => {
    this.props.onChange(modifier);
    this.props.onClose();
  };

  render() {
    const { active, modifier, onClose } = this.props;

    return (
      <div className='emoji-picker-dropdown__modifiers'>
        <LazyEmoji
          emoji='fist'
          size={22}
          skin={modifier}
          onClick={this.handleClick}
        />
        <ModifierPickerMenu
          active={active}
          onSelect={this.handleSelect}
          onClose={onClose}
        />
      </div>
    );
  }
}

interface EmojiPickerMenuProps {
  frequentlyUsedEmojis?: string[];
  loading?: boolean;
  onClose: () => void;
  onPick: (emoji: EmojiData) => void;
  onSkinTone: (skinTone: EmojiSkin) => void;
  style?: React.CSSProperties;
  intl: IntlShape;
  skinTone: EmojiSkin;
}

interface EmojiPickerMenuState {
  modifierOpen: boolean;
  readyToFocus: boolean;
}

class EmojiPickerMenuImpl extends PureComponent<
  EmojiPickerMenuProps,
  EmojiPickerMenuState
> {
  static defaultProps = {
    style: {},
    loading: true,
    frequentlyUsedEmojis: [],
  };

  state: EmojiPickerMenuState = {
    modifierOpen: false,
    readyToFocus: false,
  };

  private node: HTMLDivElement | null = null;

  componentDidMount() {
    requestAnimationFrame(() => {
      this.setState({ readyToFocus: true });
      this.node
        ?.querySelector<HTMLInputElement>('input[type="search"]')
        ?.focus();
    });
  }

  setRef = (node: HTMLDivElement | null) => {
    this.node = node;
  };

  getI18n = (): NonNullable<PickerProps['i18n']> => {
    const { intl } = this.props;

    return {
      search: intl.formatMessage(messages.emoji_search),
      categories: {
        search: intl.formatMessage(messages.search_results),
        recent: intl.formatMessage(messages.recent),
        people: intl.formatMessage(messages.people),
        nature: intl.formatMessage(messages.nature),
        foods: intl.formatMessage(messages.food),
        activity: intl.formatMessage(messages.activity),
        places: intl.formatMessage(messages.travel),
        objects: intl.formatMessage(messages.objects),
        symbols: intl.formatMessage(messages.symbols),
        flags: intl.formatMessage(messages.flags),
        custom: intl.formatMessage(messages.custom),
      },
    };
  };

  handleClick = (emoji: EmojiData, event: React.MouseEvent<HTMLElement>) => {
    const nativeEmoji = 'native' in emoji ? emoji.native : undefined;
    const selectedEmoji = nativeEmoji
      ? emoji
      : { ...emoji, native: `:${emoji.id}:` };

    if (!(event.ctrlKey || event.metaKey)) {
      this.props.onClose();
    }

    this.props.onPick(selectedEmoji);
  };

  handleModifierOpen = () => {
    this.setState({ modifierOpen: true });
  };

  handleModifierClose = () => {
    this.setState({ modifierOpen: false });
  };

  handleModifierChange = (modifier: EmojiSkin) => {
    this.props.onSkinTone(modifier);
  };

  render() {
    const {
      loading = true,
      style = {},
      intl,
      skinTone,
      frequentlyUsedEmojis = [],
    } = this.props;

    if (loading) {
      return <div style={{ width: 299 }} />;
    }

    const title = intl.formatMessage(messages.emoji);
    const { modifierOpen } = this.state;

    return (
      <div
        className={classNames('emoji-picker-dropdown__menu', {
          selecting: modifierOpen,
        })}
        style={style}
        ref={this.setRef}
      >
        {EmojiPicker && (
          <EmojiPicker
            perLine={5}
            emojiSize={40}
            color=''
            emoji=''
            title={title}
            i18n={this.getI18n()}
            onClick={this.handleClick}
            recent={frequentlyUsedEmojis}
            skin={skinTone}
            showPreview={false}
            showSkinTones={false}
            notFound={notFoundFn as unknown as PickerProps['notFound']}
            autoFocus={this.state.readyToFocus}
            emojiTooltip
          />
        )}

        <ModifierPicker
          active={modifierOpen}
          modifier={skinTone}
          onOpen={this.handleModifierOpen}
          onClose={this.handleModifierClose}
          onChange={this.handleModifierChange}
        />
      </div>
    );
  }
}

const EmojiPickerMenu: React.FC<Omit<EmojiPickerMenuProps, 'intl'>> = (props) => {
  const intl = useIntl();

  return <EmojiPickerMenuImpl {...props} intl={intl} />;
};

interface EmojiPickerDropdownProps {
  frequentlyUsedEmojis?: string[];
  button?: React.ReactNode;
  onPickEmoji: (emoji: EmojiData) => void;
  onSkinTone: (skinTone: EmojiSkin) => void;
  skinTone: EmojiSkin;
  disabled?: boolean;
  inverted?: boolean;
}

interface EmojiPickerDropdownState {
  active: boolean;
  loading: boolean;
  target: HTMLDivElement | null;
}

class EmojiPickerDropdown extends PureComponent<
  EmojiPickerDropdownProps,
  EmojiPickerDropdownState
> {
  state: EmojiPickerDropdownState = {
    active: false,
    loading: false,
    target: null,
  };

  onShowDropdown = () => {
    this.setState({ active: true });

    if (!EmojiPicker) {
      this.setState({ loading: true });

      EmojiPickerAsync()
        .then((emojiMart) => {
          EmojiPicker = emojiMart.Picker as PickerComponent;
          Emoji = emojiMart.Emoji as EmojiComponent;
          this.setState({ loading: false });
        })
        .catch(() => {
          this.setState({ loading: false, active: false });
        });
    }
  };

  onHideDropdown = () => {
    this.setState({ active: false });
  };

  onToggle: React.MouseEventHandler<HTMLButtonElement> = () => {
    if (this.state.loading) {
      return;
    }

    if (this.state.active) {
      this.onHideDropdown();
    } else {
      this.onShowDropdown();
    }
  };

  setTargetRef = (target: HTMLDivElement | null) => {
    this.setState({ target });
  };

  render() {
    const {
      onPickEmoji,
      onSkinTone,
      skinTone,
      frequentlyUsedEmojis,
      disabled,
    } = this.props;
    const { active, loading, target } = this.state;

    return (
      <div ref={this.setTargetRef}>
        <IconButton
          size='sm'
          variant='ghost'
          icon={SmileyIcon}
          onClick={this.onToggle}
          disabled={disabled}
          aria-expanded={active}
        >
          <FormattedMessage
            id='emoji_button.label'
            defaultMessage='Insert emoji'
          />
        </IconButton>

        <Popover
          isOpen={active}
          reference={target}
          onClose={this.onHideDropdown}
        >
          {({ props, placement }) => (
            <div {...props} className={`dropdown-animation ${placement}`}>
              <EmojiPickerMenu
                loading={loading}
                onClose={this.onHideDropdown}
                onPick={onPickEmoji}
                onSkinTone={onSkinTone}
                skinTone={skinTone}
                frequentlyUsedEmojis={frequentlyUsedEmojis}
              />
            </div>
          )}
        </Popover>
      </div>
    );
  }
}

export default EmojiPickerDropdown;