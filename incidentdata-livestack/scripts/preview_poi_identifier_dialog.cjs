'use strict';
// Local, read-only endpoint for browser validation before replacing the app.
const express=require('express');
const {connect}=require('./evidence-intelligence/connection.cjs');
const {registerPoiIdentifierDetail}=require('../backend/poi-identifier-detail');
const app=express();app.use((req,res,next)=>{req.demoUser=req.get('X-Demo-User')||'statewide_admin';res.set('Cache-Control','no-store');next();});
registerPoiIdentifierDetail(app,async(user,fn)=>{const c=await connect();try{await c.execute('BEGIN DBMS_SESSION.SET_IDENTIFIER(:name); END;',{name:user});return await fn(c);}finally{await c.close();}});
app.listen(8717,'127.0.0.1',()=>console.log('Read-only POI detail preview listening on localhost:8717'));
