'use strict';

// Preserve the app's original default (no per-call timeout) for ordinary work.
// Request-specific limits must never leak to another pooled-connection borrower.
const DEFAULT_CALL_TIMEOUT_MS = 0;
const PROFILE_READ_CALL_TIMEOUT_MS = 30_000;
const RESTORE_CALL_TIMEOUT_MS = 300_000;

async function withCallTimeout(connection, timeoutMs, operation) {
  const previous = connection.callTimeout;
  connection.callTimeout = timeoutMs;
  let failed = false;
  try {
    // Await here so the timeout remains in force until the operation settles.
    return await operation(connection);
  } catch (error) {
    failed = true;
    throw error;
  } finally {
    try { connection.callTimeout = previous; }
    catch (error) { if (!failed) throw error; }
  }
}

async function withDatabaseConnection(pool, user, operation) {
  const connection = await pool.getConnection();
  let failed = false;
  try {
    connection.callTimeout = DEFAULT_CALL_TIMEOUT_MS;
    await connection.execute('BEGIN DBMS_SESSION.SET_IDENTIFIER(:user); END;', {user});
    return await operation(connection);
  } catch (error) {
    failed = true;
    throw error;
  } finally {
    // Close even if resetting an unusable connection raises an error.
    // Preserve the original database error when cleanup also fails.
    try {
      try { connection.callTimeout = DEFAULT_CALL_TIMEOUT_MS; }
      finally { await connection.close(); }
    } catch (error) { if (!failed) throw error; }
  }
}

function restoreErrorMessage(error) {
  // NRT can fail after restore_profile has committed but before time shifting
  // commits. Never imply that a failed response proves a complete rollback.
  return `${error.message} Refresh Data Foundation to check the active dataset before retrying; a failed response does not confirm that every restore step was rolled back.`;
}

module.exports = {DEFAULT_CALL_TIMEOUT_MS, PROFILE_READ_CALL_TIMEOUT_MS, RESTORE_CALL_TIMEOUT_MS, withCallTimeout, withDatabaseConnection, restoreErrorMessage};
