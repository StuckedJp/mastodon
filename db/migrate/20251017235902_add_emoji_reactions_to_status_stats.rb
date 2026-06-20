# frozen_string_literal: true

class AddEmojiReactionsToStatusStats < ActiveRecord::Migration[6.1]
  def change
    add_column :status_stats, :emoji_reactions, :string
    add_column :status_stats, :emoji_reactions_count, :integer, null: false, default: 0
    add_column :status_stats, :emoji_reaction_accounts_count, :integer, null: false, default: 0
  end
end
