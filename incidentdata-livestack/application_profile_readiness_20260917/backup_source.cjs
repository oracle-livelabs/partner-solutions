/* Recoverable copies of only the existing source files this task will edit. */
const fs=require('fs'),path=require('path'),crypto=require('crypto');
const root=path.resolve(__dirname,'..'),out=path.join(__dirname,'source_before');
const files=['backend/server.js','frontend/src/main.jsx','frontend/src/app-use-notice.css'];
fs.mkdirSync(out,{recursive:true});const manifest={};
for(const file of files){const bytes=fs.readFileSync(path.join(root,file)),dest=path.join(out,file);fs.mkdirSync(path.dirname(dest),{recursive:true});fs.writeFileSync(dest,bytes,{flag:'wx',mode:0o600});manifest[file]=crypto.createHash('sha256').update(bytes).digest('hex');}
fs.writeFileSync(path.join(out,'manifest.json'),JSON.stringify(manifest,null,2)+'\n',{flag:'wx'});console.log(JSON.stringify({backed_up:files}));
