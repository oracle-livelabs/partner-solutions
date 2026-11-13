// Read-only integration check using the running app's existing ADB environment.
const assert = require('node:assert/strict');
const oracledb = require('oracledb');
const { loadGraph } = require(process.argv[2] || '../backend/result-relationships');
oracledb.outFormat = oracledb.OUT_FORMAT_OBJECT;
async function main() {
  const c = await oracledb.getConnection({ user: process.env.ORACLE_USER, password: process.env.APP_SCHEMA_PASSWORD,
    connectString: process.env.ORACLE_CONNECTION_STRING, walletLocation: process.env.ORACLE_WALLET_LOCATION,
    walletPassword: process.env.ORACLE_WALLET_PASSWORD, configDir: process.env.ORACLE_WALLET_LOCATION });
  try {
    await c.execute('BEGIN DBMS_SESSION.SET_IDENTIFIER(:usr); END;', { usr: 'statewide_admin' });
    const patterns = (await c.execute("SELECT pattern_code FROM watched_crime_patterns WHERE active=1 AND activate_ui='Y' ORDER BY pattern_code FETCH FIRST 2 ROWS ONLY")).rows;
    const seeds = { patternCodes: patterns.map(p => p.PATTERN_CODE), incidentRefs: [], postRefs: [] };
    const baseline = await loadGraph(c, seeds);
    // Reuse administrator references as forged client inputs under restricted users.
    seeds.incidentRefs = baseline.nodes.filter(n => n.type === 'incident').slice(0, 30).map(n => n.ref);
    seeds.postRefs = baseline.nodes.filter(n => n.type === 'post').slice(0, 30).map(n => n.ref);
    for (const user of ['statewide_admin', 'read_only_viewer', 'northern_analyst', 'southern_analyst']) {
      await c.execute('BEGIN DBMS_SESSION.SET_IDENTIFIER(:usr); END;', { usr: user });
      const graph = await loadGraph(c, seeds);
      assert.equal(new Set(graph.nodes.map(n => n.id)).size, graph.nodes.length);
      for (const [type, table, column] of [['incident', 'secure_crime_incidents_v', 'incident_ref'], ['post', 'secure_social_media_posts_v', 'post_ref']]) {
        const refs = graph.nodes.filter(n => n.type === type).map(n => n.ref);
        const count = (await c.execute(`SELECT COUNT(DISTINCT ${column}) total FROM ${table} WHERE ${column} IN (SELECT ref FROM JSON_TABLE(:refs, '$[*]' COLUMNS(ref VARCHAR2(120) PATH '$')))`, { refs: JSON.stringify(refs) })).rows[0].TOTAL;
        assert.equal(Number(count), refs.length, `Unauthorised ${type} leaked for ${user}`);
      }
      const ids = new Set(graph.nodes.map(n => n.id));
      assert(graph.edges.every(e => ids.has(e.source) && ids.has(e.target)));
      console.log(JSON.stringify({ user, nodes: graph.nodes.length, edges: graph.edges.length, warnings: graph.warnings, secureNodeChecks: 'passed' }));
    }
    const empty = await loadGraph(c, { patternCodes: [], incidentRefs: ['NONEXISTENT-REF'], postRefs: ['NONEXISTENT-POST'] });
    assert.equal(empty.nodes.length, 0);
    assert.equal(empty.edges.length, 0);
    console.log('Nonexistent seed checks passed. No database records changed.');
  } finally { await c.close(); }
}
main().catch(e => { console.error(e.message); process.exitCode = 1; });
