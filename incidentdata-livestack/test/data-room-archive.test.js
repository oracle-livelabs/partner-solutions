const test = require('node:test');
const assert = require('node:assert/strict');
const yazl = require('yazl');
const { LIMITS, safePath, describeItem, inspectArchive } = require('../backend/data-room-archive');
const { demoArchive } = require('../backend/data-room-demo');

function zip(entries, options = {}) {
  const archive = new yazl.ZipFile();
  return new Promise((resolve, reject) => {
    const chunks = [];
    archive.outputStream.on('data', c => chunks.push(c));
    archive.outputStream.on('end', () => resolve(Buffer.concat(chunks)));
    archive.on('error', reject);
    for (const [name, body] of entries) archive.addBuffer(Buffer.isBuffer(body) ? body : Buffer.from(body), name, options);
    archive.end();
  });
}
test('ZIP inventory preserves bytes and distinguishes formats without pretending to use AI', async () => {
  const result = await inspectArchive(await zip([['narrative.txt', 'Synthetic fictional source text\nsecond line'], ['nested/records.csv', 'id,note\n1,"quoted, value"\n'], ['incident.json', '{"synthetic_record":true}']]));
  assert.equal(result.files.length, 3);
  assert.equal(result.files[0].headline, 'Synthetic fictional source text');
  assert.equal(result.files[0].content.toString(), 'Synthetic fictional source text\nsecond line');
  assert.equal(result.files[1].rowCount, 1);
  assert.equal(result.files[2].descriptionSource, 'inventory');
  assert.equal(result.files[0].sha256.length, 64);
});
test('sample has eight valid items and two existing synthetic scene photos', async () => {
  const result = await inspectArchive(await demoArchive());
  assert.equal(result.files.length, 8);
  assert.equal(result.files.filter(f => f.type === 'png').length, 2);
  assert.equal(result.files.filter(f => f.type === 'csv').length, 3);
  assert(!result.files.some(f => /eve|philip|george|clara/i.test(f.path)));
});
test('MP3 and MP4 inventory preserves original binary bytes and checksums without text decoding', async () => {
  const mp3 = Buffer.from([0xff, 0xfb, 0x90, 0x64, 0, 0xff, 0xfe, 0]);
  const mp4 = Buffer.concat([Buffer.from('000000146674797069736f6d000000006d703432', 'hex'), Buffer.from([0xff, 0, 0xfe])]);
  const result = await inspectArchive(await zip([['audio.MP3', mp3], ['nested/video.mp4', mp4]]));
  assert.deepEqual(result.files.map(f => f.type), ['mp3', 'mp4']);
  for (const [i, original] of [mp3, mp4].entries()) {
    assert.deepEqual(result.files[i].content, original);
    assert.equal(result.files[i].preview, null);
    assert.equal(result.files[i].rowCount, null);
    assert.equal(result.files[i].descriptionSource, 'inventory');
    assert.match(result.files[i].headline, /original file stored/);
  }
  assert.equal(result.totalBytes, mp3.length + mp4.length);
});
test('MP3 accepts an ID3 header and rejects misleading or reserved media signatures', () => {
  assert.equal(describeItem('audio.mp3', Buffer.from('49443304000000000000fffb9064', 'hex')).type, 'mp3');
  for (const type of ['mp3', 'mp4']) assert.throws(() => describeItem(`fake.${type}`, Buffer.from('ordinary text')), /Media signature/);
  assert.throws(() => describeItem('invalid.mp3', Buffer.from([255, 251, 0, 0])), /Media signature/);
  assert.throws(() => describeItem('truncated.mp4', Buffer.from('000000206674797069736f6d00000000', 'hex')), /Media signature/);
});
test('rejects unsafe filenames, including Windows paths and Unicode byte overflow', () => {
  for (const name of ['../test.txt', '/root.txt', 'C:/a.txt', 'a\\b.txt', 'a/../b.txt', 'a\0.txt', 'x'.repeat(501), 'é'.repeat(251)]) assert.throws(() => safePath(name));
});
test('rejects duplicate paths, including case-only differences', async () => {
  await assert.rejects(inspectArchive(await zip([['a.txt', 'a'], ['A.txt', 'b']])), /duplicate/i);
});
test('rejects unsupported, nested and misleading files', async () => {
  for (const name of ['a.html', 'nested.zip', 'a.exe', 'a.png', 'a.jpg']) await assert.rejects(inspectArchive(await zip([[name, 'not an image or permitted text']])));
});
test('rejects invalid JSON, CSV and non-UTF8 text', () => {
  assert.throws(() => describeItem('a.json', Buffer.from('{oops')));
  assert.throws(() => describeItem('a.csv', Buffer.from('id,note\n1,"unclosed')));
  assert.throws(() => describeItem('a.txt', Buffer.from([255, 254, 0])));
  assert.throws(() => describeItem('a.txt', Buffer.from('x\0y')));
});
test('CSV row and column limits apply', () => {
  assert.throws(() => describeItem('a.csv', Buffer.from('id\n' + 'x\n'.repeat(LIMITS.csvRows + 1))));
  assert.throws(() => describeItem('a.csv', Buffer.from(Array(201).fill('x').join(','))));
});
test('empty and malformed archives fail', async () => {
  await assert.rejects(inspectArchive(await zip([])), /no supported/i);
  await assert.rejects(inspectArchive(Buffer.from('not zip')), /readable ZIP/i);
  await assert.rejects(inspectArchive(Buffer.alloc(0)));
});
test('ignores only OS metadata and counts real files', async () => {
  const result = await inspectArchive(await zip([['.DS_Store', 'metadata'], ['__MACOSX/._a.txt', 'metadata'], ['a.txt', 'real content']]));
  assert.equal(result.ignored, 2); assert.equal(result.files.length, 1);
});
test('bounds item size, file count, total expansion and compressed input', async () => {
  await assert.rejects(inspectArchive(await zip([['a.txt', Buffer.alloc(LIMITS.itemBytes + 1, 65)]])), /8 MiB/);
  await assert.rejects(inspectArchive(await zip(Array.from({ length: 101 }, (_, i) => [`${i}.txt`, 'x']))), /100 content/);
  await assert.rejects(inspectArchive(await zip(Array.from({ length: 6 }, (_, i) => [`${i}.txt`, Buffer.alloc(LIMITS.itemBytes, 65)]))), /40 MiB/);
  await assert.rejects(inspectArchive(Buffer.alloc(LIMITS.zipBytes + 1)));
});
test('rejects symlinks and CRC-tampered stored entries', async () => {
  await assert.rejects(inspectArchive(await zip([['a.txt', 'target']], { mode: 0o120777 })), /Symbolic/);
  const buffer = await zip([['a.txt', 'original marker']], { compress: false });
  const at = buffer.indexOf(Buffer.from('original marker')); assert(at > 0); buffer[at] ^= 1;
  await assert.rejects(inspectArchive(buffer), /CRC/);
});
test('rejects encrypted entries and traversal in archive metadata', async () => {
  const encrypted = await zip([['a.txt', 'data']]);
  const central = encrypted.indexOf(Buffer.from('504b0102', 'hex')); encrypted.writeUInt16LE(encrypted.readUInt16LE(central + 8) | 1, central + 8);
  await assert.rejects(inspectArchive(encrypted), /Encrypted/);
  const unsafe = await zip([['xx/a.txt', 'data']]);
  let at = unsafe.indexOf(Buffer.from('xx/a.txt'));
  while (at !== -1) { unsafe.write('../a.txt', at); at = unsafe.indexOf(Buffer.from('xx/a.txt'), at + 1); }
  await assert.rejects(inspectArchive(unsafe));
});

test('M4A is ingested as original binary audio, with uppercase extensions and MP4 container validation',async()=>{
 const audio=Buffer.concat([Buffer.from('00000018667479704d3441200000000069736f6d6d703432','hex'),Buffer.from([255,0,254])]);
 const result=await inspectArchive(await zip([['recording.M4A',audio]]));assert.equal(result.files[0].type,'m4a');assert.deepEqual(result.files[0].content,audio);assert.equal(result.files[0].preview,null);assert.match(result.files[0].headline,/run Identify\/Describe/);
 assert.throws(()=>describeItem('fake.m4a',Buffer.from('ordinary text')),/Media signature/);
 assert.throws(()=>describeItem('truncated.m4a',Buffer.from('00000020667479704d34412000000000','hex')),/Media signature/);
});
