'use strict';
// Display references may be renamed; deterministic assertion identity stays tied
// to the original source key so legacy and current imports cannot create twins.
const RENAMES=new Map([
 ['synthetic:city-poi-identifiers:v1:2026-10-20','register:city-poi-identifiers:v1:2026-10-20'],
 ['synthetic:poi-profile-quality:v1:2026-10-29','register:poi-profile-quality:v1:2026-10-29']
]);
const ORIGINALS=new Map([...RENAMES].map(([old,current])=>[current,old]));
function canonicalSourceRef(value){return RENAMES.get(value)||value;}
function sourceIdentity(value){return ORIGINALS.get(value)||value;}
module.exports={canonicalSourceRef,sourceIdentity};
