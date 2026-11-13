// Stable three-row presentation: Australia, Europe, then USA.
// Metadata, counts and restoration capabilities still come from Z_BASE/API.
export const FOUNDATION_PROFILES = Object.freeze([
  ['ADELAIDE_DATA_V3', 'Adelaide'],
  ['PERTH_DATA_V2', 'Perth'],
  ['BRISBANE_DATA_V2', 'Brisbane'],
  ['AMSTERDAM_DATA_V1', 'Amsterdam'],
  ['BRUSSELS_DATA_V1', 'Brussels'],
  ['DUBLIN_CITY_DATA_V1', 'Dublin'],
  ['BOSTON_DATA_V2', 'Boston'],
  ['CHICAGO_DATA_V2', 'Chicago'],
  ['LAS_VEGAS_DATA_V2', 'Las Vegas'],
].map(([code, city]) => Object.freeze({code, city})));

export function foundationTiles(profiles = []) {
  return FOUNDATION_PROFILES.map(tile => ({
    ...tile, profile: profiles.find(profile => profile.PROFILE_CODE === tile.code),
  }));
}

export function additionalProfiles(profiles = []) {
  return profiles.filter(profile => !FOUNDATION_PROFILES.some(tile => tile.code === profile.PROFILE_CODE));
}
