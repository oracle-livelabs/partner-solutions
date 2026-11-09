'use strict';

const crypto = require('node:crypto');
const path = require('node:path');
const yauzl = require('yauzl');
const crc32 = require('buffer-crc32');
const { parse } = require('csv-parse/sync');

const LIMITS = Object.freeze({ zipBytes: 20 * 1024 * 1024, expandedBytes: 40 * 1024 * 1024, itemBytes: 8 * 1024 * 1024, files: 100, entries: 500, csvRows: 20000 });
const STAGES = ['Load', 'Unzip', 'Ingest', 'Identify/Describe', 'Learn-what-is-there', 'Understand-Connections', 'Create-Data-products'];
const hash = buffer => crypto.createHash('sha256').update(buffer).digest('hex');
const fail = message => { throw Object.assign(new Error(message), { status: 400 }); };

function safePath(name) {
  if (!name || Buffer.byteLength(name) > 500 || /[\x00-\x1f\x7f\\:]/.test(name) || name.startsWith('/') || name.split('/').some(p => p === '..' || p === '.')) fail('The ZIP contains an unsafe or excessively long file path.');
  return name.normalize('NFC');
}

function describeItem(name, buffer) {
  const extension = path.posix.extname(name).slice(1).toLowerCase();
  const type = extension === 'jpeg' ? 'jpg' : extension;
  if (!['txt', 'csv', 'json', 'jpg', 'png', 'mp3', 'm4a', 'mp4'].includes(type)) fail(`Unsupported file type: ${name}. Use TXT, CSV, JSON, JPG, PNG, MP3, M4A or MP4.`);
  let headline, preview = null, rowCount = null;
  // Inventory descriptions are deliberately deterministic, never labelled as AI output.
  if (type === 'png' || type === 'jpg') {
    const valid = type === 'png' ? buffer.subarray(0, 8).equals(Buffer.from('89504e470d0a1a0a', 'hex')) : buffer[0] === 255 && buffer[1] === 216 && buffer[2] === 255;
    if (!valid) fail(`Image signature does not match the extension: ${name}.`);
    headline = `${type.toUpperCase()} image · visual description pending`;
  } else if (type === 'mp3' || type === 'm4a' || type === 'mp4') {
    // Check container/header signatures without decoding or interpreting media.
    const id3 = buffer.length >= 10 && buffer.subarray(0, 3).toString('ascii') === 'ID3'
      && [2, 3, 4].includes(buffer[3]) && buffer[4] !== 255
      && buffer.subarray(6, 10).every(byte => byte < 128);
    const mpeg = buffer.length >= 4 && buffer[0] === 255 && (buffer[1] & 224) === 224
      && ((buffer[1] >> 3) & 3) !== 1 && ((buffer[1] >> 1) & 3) === 1
      && (buffer[2] >> 4) !== 0 && (buffer[2] >> 4) !== 15 && ((buffer[2] >> 2) & 3) !== 3;
    const mp4 = buffer.length >= 16 && buffer.subarray(4, 8).toString('ascii') === 'ftyp'
      && buffer.readUInt32BE(0) >= 16 && buffer.readUInt32BE(0) <= buffer.length
      && buffer.readUInt32BE(0) % 4 === 0;
    if (!(type === 'mp3' ? id3 || mpeg : mp4)) fail(`Media signature does not match the extension: ${name}.`);
    headline = ['mp3','m4a'].includes(type) ? `${type.toUpperCase()} audio · original file stored; run Identify/Describe for a transcript` : 'MP4 media · original file stored; automatic analysis unavailable';
  } else {
    let text;
    try { text = new TextDecoder('utf-8', { fatal: true }).decode(buffer); }
    catch { fail(`Text must be UTF-8 encoded: ${name}.`); }
    if (text.includes('\0')) fail(`Text contains binary data: ${name}.`);
    preview = text.slice(0, 6000);
    if (type === 'json') {
      let value;
      try { value = JSON.parse(text); } catch { fail(`Invalid JSON: ${name}.`); }
      headline = Array.isArray(value) ? `JSON document · ${value.length} entries` : value && typeof value === 'object' ? `JSON document · fields: ${Object.keys(value).slice(0, 6).join(', ')}` : 'JSON value';
    } else if (type === 'csv') {
      let rows;
      try {
        rows = parse(text, { bom: true, skip_empty_lines: true, max_record_size: 128 * 1024, on_record(record, context) {
          if (context.records > LIMITS.csvRows + 1 || record.length > 200) throw new Error('CSV limit');
          return record;
        } });
      } catch { fail(`Invalid CSV or CSV exceeds ${LIMITS.csvRows} data rows / 200 columns: ${name}.`); }
      rowCount = Math.max(0, rows.length - 1);
      headline = `CSV · ${rowCount} data rows · columns: ${(rows[0] || []).slice(0, 6).join(', ')}`;
    } else {
      headline = text.split(/\r?\n/).find(line => line.trim())?.trim() || 'Empty text document';
    }
  }
  return { path: name, type, bytes: buffer.length, sha256: hash(buffer), headline: headline.replace(/\s+/g, ' ').slice(0, 450), descriptionSource: 'inventory', preview, rowCount, content: buffer };
}

// Never extract paths onto the filesystem. Bound compressed AND actual expanded bytes.
function inspectArchive(buffer) {
  if (!Buffer.isBuffer(buffer) || !buffer.length || buffer.length > LIMITS.zipBytes) return Promise.reject(new Error('ZIP must be between 1 byte and 20 MiB.'));
  return new Promise((resolve, reject) => {
    let zip, stream, finished = false, total = 0, entries = 0, ignored = 0;
    const files = [], names = new Set();
    const finish = (error) => {
      if (finished) return;
      finished = true; clearTimeout(timer); stream?.destroy(); zip?.close();
      if (error) reject(error); else resolve({ files, totalBytes: total, ignored });
    };
    const timer = setTimeout(() => finish(new Error('ZIP validation exceeded the 30-second limit.')), 30000);
    yauzl.fromBuffer(buffer, { lazyEntries: true, strictFileNames: true, validateEntrySizes: true }, (error, opened) => {
      if (error) return finish(new Error('The file is not a readable ZIP archive.'));
      zip = opened;
      if (finished) return zip.close();
      zip.on('error', () => finish(new Error('ZIP structure or expanded size is invalid.')));
      zip.on('end', () => finish(files.length ? null : new Error('The ZIP contains no supported content files.')));
      zip.on('entry', entry => {
        if (finished) return;
        try {
          if (++entries > LIMITS.entries) fail('ZIP contains too many entries.');
          const name = safePath(entry.fileName);
          const mode = (entry.externalFileAttributes >>> 16) & 0xf000;
          if (mode === 0xa000) fail('Symbolic links are not supported.');
          if ((entry.generalPurposeBitFlag & 1) || ![0, 8].includes(entry.compressionMethod)) fail('Encrypted files or unsupported compression are not allowed.');
          if (name.endsWith('/')) return zip.readEntry();
          if (name.startsWith('__MACOSX/') || path.posix.basename(name) === '.DS_Store') { ignored++; return zip.readEntry(); }
          const key = name.toLowerCase();
          if (names.has(key)) fail('ZIP contains duplicate file paths.');
          names.add(key);
          if (names.size > LIMITS.files) fail('ZIP exceeds 100 content files.');
          if (entry.uncompressedSize > LIMITS.itemBytes || total + entry.uncompressedSize > LIMITS.expandedBytes) fail('ZIP exceeds 8 MiB per file or 40 MiB expanded.');
          zip.openReadStream(entry, (readError, openedStream) => {
            if (readError) return finish(new Error('A ZIP entry cannot be read.'));
            stream = openedStream;
            if (finished) return stream.destroy();
            let size = 0;
            const chunks = [];
            stream.on('error', () => finish(new Error('A ZIP entry is corrupt or has an invalid expanded size.')));
            stream.on('data', chunk => {
              size += chunk.length; total += chunk.length;
              if (size > LIMITS.itemBytes || total > LIMITS.expandedBytes) return finish(new Error('Expanded ZIP exceeds the size limits.'));
              chunks.push(chunk);
            });
            stream.on('end', () => {
              if (finished) return;
              try {
                const content = Buffer.concat(chunks);
                if (crc32.unsigned(content) !== entry.crc32) fail('A ZIP entry failed its CRC integrity check.');
                files.push(describeItem(name, content));
                zip.readEntry();
              } catch (e) { finish(e); }
            });
          });
        } catch (e) { finish(e); }
      });
      zip.readEntry();
    });
  });
}

module.exports = { LIMITS, STAGES, hash, safePath, describeItem, inspectArchive };
