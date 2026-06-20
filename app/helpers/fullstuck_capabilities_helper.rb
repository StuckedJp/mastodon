# frozen_string_literal: true

module FullstuckCapabilitiesHelper
  def fedibird_capabilities
    capabilities = %i(
      enable_wide_emoji
      searchability
      fullstuck_reaction_deck
      status_reference
      visibility_mutual
      visibility_limited
      favourite_list
    )

    capabilities << :full_text_search if Chewy.enabled?
    if Setting.enable_emoji_reaction
      capabilities << :emoji_reaction
      capabilities << :enable_wide_emoji_reaction
    end
    capabilities << :timeline_no_local unless Setting.enable_local_timeline

    capabilities
  end

  def capabilities_for_nodeinfo
    capabilities = %i(
      enable_wide_emoji
      status_reference
      emoji_keywords
    )

    if Setting.enable_emoji_reaction
      capabilities << :emoji_reaction
      capabilities << :enable_wide_emoji_reaction
    end

    capabilities
  end
end
