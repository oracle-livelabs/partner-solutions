'use strict';

const oracledb = require('oracledb');

// The caller must validate generated SQL before using this executor.
function executeSelectAiV2Results(connection, validatedSql) {
  // Keep this text-fetch statement separate from default-LOB statements in the
  // driver's cache. Materialise text before db() releases the connection.
  return connection.execute(
    `SELECT /* Ask IncidentData V2 text results */ * FROM (${validatedSql}) WHERE ROWNUM<=100`,
    {},
    {
      outFormat: oracledb.OUT_FORMAT_OBJECT,
      fetchTypeHandler: metadata => {
        if (metadata.dbType === oracledb.DB_TYPE_CLOB || metadata.dbType === oracledb.DB_TYPE_NCLOB) {
          return {type: oracledb.STRING};
        }
        return undefined;
      },
    },
  );
}

module.exports = {executeSelectAiV2Results};
