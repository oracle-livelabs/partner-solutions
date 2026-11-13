const {test}=require('node:test'),assert=require('node:assert/strict');
const {normalized}=require('../bootstrap/security.cjs');
test('policy comparison ignores formatting outside SQL literals',()=>{
 assert.deepEqual(normalized([{PREDICATE:"area_code = 'CENTRAL'\n AND active = 'Y'"}]),normalized([{PREDICATE:"area_code = 'CENTRAL' AND active = 'Y'"}]));
});
test('policy comparison preserves significant quoted whitespace',()=>{
 for(const [a,b] of [["role_name = 'Case  Lead'","role_name = 'Case Lead'"],['"Area  Code" = 1','"Area Code" = 1']])assert.notDeepEqual(normalized([{PREDICATE:a}]),normalized([{PREDICATE:b}]));
});
