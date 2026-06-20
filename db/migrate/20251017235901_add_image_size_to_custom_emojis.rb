# frozen_string_literal: true

class AddImageSizeToCustomEmojis < ActiveRecord::Migration[6.1]
  def change
    safety_assured do
      change_table :custom_emojis, bulk: true do |t|
        t.integer :image_width
        t.integer :image_height
        t.jsonb   :aliases
        t.boolean :is_sensitive, null: false, default: false
        t.string  :license, null: true
      end
    end
  end

  def down
    safety_assured do
      change_table :custom_emojis, bulk: true do |t|
        t.remove :image_width
        t.remove :image_height
        t.remove :aliases
        t.remove :is_sensitive
        t.remove :license
      end
    end
  end
end
