const test=require('node:test'),assert=require('node:assert/strict');
const {assertTarget,assertAttributes}=require('../deployment/oci-resource-manager/bootstrap/database.cjs');
test('restore guard accepts only the generated destination identity',()=>{
 assert.doesNotThrow(()=>assertTarget({database_name:'IDABC123'},'TENANT_IDABC123'));
 for(const actual of ['TENANT_FU40','TENANT_FU30','TENANT_IDABC124','IDABC123'])assert.throws(()=>assertTarget({database_name:'IDABC123'},actual));
 for(const name of ['FU40','IDABC123_OR_FU40','ID123','idabc123'])assert.throws(()=>assertTarget({database_name:name},'TENANT_'+name));
});
test('AI retries accept equal attributes and reject conflicting destination definitions',()=>{
 assert.doesNotThrow(()=>assertAttributes({tools:[{a:1,b:2}],model:'example'},{model:'example',tools:[{b:2,a:1}],generated:'other'}));
 assert.throws(()=>assertAttributes({model:'expected'},{model:'different'}));
 assert.throws(()=>assertAttributes({credential_name:'OCI$RESOURCE_PRINCIPAL'},{}));
});
