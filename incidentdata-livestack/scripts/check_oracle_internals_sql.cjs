'use strict';
// Verify the displayed examples on FU40 in explicit read-only transactions.
// Only result counts leave the container; environment credentials stay inside it.
const { execFileSync } = require('node:child_process');
(async () => {
  const { ORACLE_INTERNALS } = await import('../frontend/src/oracle-internals-content.mjs');
  const examples = Object.entries(ORACLE_INTERNALS).flatMap(([page, info]) =>
    info.examples.map(example => ({ page, title: example.title, kind:example.kind||'sql', sql:example.kind==='plsql'?example.code:example.code.replace(/;\s*$/, '') })));
  if (examples.some(example => example.kind==='sql'&&!/^(SELECT|WITH)\b/i.test(example.sql))) throw Error('Expected read-only SELECT examples.');
  const code = `
    const o = require('oracledb'), fs = require('node:fs');
    (async () => {
      const examples = JSON.parse(fs.readFileSync(0, 'utf8'));
      const c = await o.getConnection({user:process.env.ORACLE_USER,password:process.env.APP_SCHEMA_PASSWORD,
        connectString:process.env.ORACLE_CONNECTION_STRING,walletLocation:process.env.ORACLE_WALLET_LOCATION,
        walletPassword:process.env.ORACLE_WALLET_PASSWORD,configDir:process.env.ORACLE_WALLET_LOCATION});
      const results = [];
      try {
        c.callTimeout = 30000;
        for (const user of ['statewide_admin', 'read_only_viewer']) {
          await c.execute('BEGIN DBMS_SESSION.SET_IDENTIFIER(:user); END;', {user});
          await c.execute('SET TRANSACTION READ ONLY');
          for (const example of examples) {
            if(example.kind==='plsql'&&user!=='statewide_admin')continue;
            try {
              if(example.kind==='plsql'){
                await c.execute('BEGIN DBMS_OUTPUT.ENABLE(NULL); END;');
                await c.execute(example.sql);
                const output=await c.execute('BEGIN DBMS_OUTPUT.GET_LINE(:line,:status); END;',{line:{dir:o.BIND_OUT,type:o.STRING,maxSize:32767},status:{dir:o.BIND_OUT,type:o.NUMBER}});
                const context=(await c.execute("SELECT SYS_CONTEXT('USERENV','CLIENT_IDENTIFIER') identifier FROM dual",{}, {outFormat:o.OUT_FORMAT_OBJECT})).rows[0].IDENTIFIER;
                if(context!==user)throw Error('Previous session context was not restored');
                results.push({user,page:example.page,title:example.title,passed:output.outBinds.status===0&&/^Visible Adelaide V2 report vectors: [0-9]+$/.test(output.outBinds.line),output:output.outBinds.line,contextRestored:true});
                continue;
              }
              const result = await c.execute(example.sql, {}, {maxRows:100});
              results.push({user,page:example.page,title:example.title,rows:result.rows.length,passed:true});
            } catch (error) {
              results.push({user,page:example.page,title:example.title,passed:false,error:error.message});
            }
          }
          await c.rollback();
        }
      } finally { await c.close(); }
      console.log(JSON.stringify({readOnly:true,checks:results.length,results}));
      if (results.some(result => !result.passed)) process.exitCode = 1;
    })().catch(error => { console.error(error.message); process.exitCode = 1; });`;
  try {
    process.stdout.write(execFileSync('podman', ['exec', '-i', 'policeadelaide_app-fu40_1', 'node', '-e', code],
      {input:JSON.stringify(examples),encoding:'utf8',timeout:180000}));
  } catch (error) {
    if (error.stdout) process.stdout.write(error.stdout);
    if (error.stderr) process.stderr.write(error.stderr);
    process.exitCode = 1;
  }
})().catch(error => { console.error(error.message); process.exitCode = 1; });
