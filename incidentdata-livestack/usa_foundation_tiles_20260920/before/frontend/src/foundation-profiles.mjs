// Stable six-city presentation; metadata and counts still come from Z_BASE.
export const FOUNDATION_PROFILES = Object.freeze([
  ['ADELAIDE_DATA_V2', 'Adelaide'],
  ['PERTH_DATA', 'Perth'],
  ['BRISBANE_DATA', 'Brisbane'],
  ['AMSTERDAM_DATA_V1', 'Amsterdam'],
  ['BRUSSELS_DATA_V1', 'Brussels'],
  ['DUBLIN_CITY_DATA_V1', 'Dublin'],
].map(([code, city]) => Object.freeze({code, city})));

export function foundationTiles(profiles = []) {
  return FOUNDATION_PROFILES.map(tile => ({
    ...tile, profile: profiles.find(profile => profile.PROFILE_CODE === tile.code),
  }));
}

export function additionalProfiles(profiles = []) {
  return profiles.filter(profile => !FOUNDATION_PROFILES.some(tile => tile.code === profile.PROFILE_CODE));
}
