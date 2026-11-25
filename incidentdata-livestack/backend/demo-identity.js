'use strict';

const DEMO_USERS = new Set(['statewide_admin', 'central_analyst', 'northern_analyst', 'southern_analyst', 'read_only_viewer']);

// Keep existing browser/API clients working while the canonical identity changes.
function canonicalDemoUser(user) {
  return user === 'adelaide_central_analyst' ? 'central_analyst' : user;
}

module.exports = {DEMO_USERS, canonicalDemoUser};
