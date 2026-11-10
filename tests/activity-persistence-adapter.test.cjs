"use strict";
/* Run from repository root: node --test tests/activity-persistence-adapter.test.cjs */
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const js = fs.readFileSync(path.join(__dirname, "../assets/js/activity-persistence-adapter.js"), "utf8");

function fixture() {
  let uuid = 0;
  const browser = {crypto:{randomUUID:()=> "event-" + (++uuid)}};
  vm.runInNewContext(js, {window:browser, Blob});
  const called = [];
  const current = {
    signedIn:true,
    capabilities:{api_version:"1.0",write_enabled:true},
    fail:null
  };
  const client = {
    auth:{getUser:async()=>current.signedIn?{data:{user:{id:"auth-1"}}}:{data:{user:null}}},
    rpc:async function(name,args) {
      called.push({name,args});
      if (current.fail===name) return {data:null,error:new Error("permission denied")};
      if (name==="edu_activity_capabilities") return {data:current.capabilities,error:null};
      return {data:{ok:true,name,args},error:null};
    }
  };
  return {browser,client,current,called,create:(enabled)=>
    browser.EduActivityPersistence.create(client,{enabled})};
}

test("disabled by default, no network calls",async()=>{
  const f=fixture(), api=f.browser.EduActivityPersistence.create(f.client);
  assert.equal((await api.probe()).ready,false);
  await assert.rejects(api.publish({classId:"x",kind:"lesson",title:"t",html:"<html></html>"}),/غير مفعّل/);
  assert.equal(f.called.length,0);
});

test("probe validates user and server capabilities",async()=>{
  const f=fixture(),api=f.create(true);
  assert.equal((await api.probe()).ready,true);
  f.current.signedIn=false;
  assert.equal((await api.probe()).ready,false);
  f.current.signedIn=true;
  f.current.capabilities={api_version:"1.0",write_enabled:false};
  assert.equal((await api.probe()).ready,false);
  f.current.capabilities={api_version:"0.9",write_enabled:true};
  assert.equal((await api.probe()).ready,false);
});

test("publish uses authorized RPC with validated content",async()=>{
  const f=fixture(),api=f.create(true);
  await api.publish({classId:"class-1",kind:"homework",title:" تدريب ",html:"<!doctype html><html></html>"});
  const last=f.called.at(-1);
  assert.equal(last.name,"edu_activity_publish");
  assert.equal(last.args.p_class_id,"class-1");
  assert.equal(last.args.p_title,"تدريب");
  await assert.rejects(api.publish({classId:"c",kind:"unknown",title:"t",html:"<html/>"}),/نوع النشاط/);
  await assert.rejects(api.publish({classId:"c",kind:"lesson",title:"t",html:"plaintext"}),/HTML/);
  await assert.rejects(api.publish({classId:"c",kind:"lesson",title:"t",html:"<html>"+ "x".repeat(1048576)+"</html>"}),/ميجابايت/);
});

test("server decides student identity, not client input",async()=>{
  const f=fixture(),api=f.create(true);
  await api.myAssignments();
  assert.equal(f.called.at(-1).name,"edu_activity_my_assignments");
  assert.deepEqual(Object.keys(f.called.at(-1).args),[]);
});

test("class data and attempts use only scoped identifiers",async()=>{
  const f=fixture(),api=f.create(true);
  await api.classAssignments("class-1");
  assert.equal(f.called.at(-1).args.p_class_id,"class-1");
  await api.beginAttempt("assignment-2");
  assert.equal(f.called.at(-1).args.p_assignment_id,"assignment-2");
  await api.classResults("assignment-2");
  assert.equal(f.called.at(-1).name,"edu_activity_class_results");
});

test("completed submits without a grade",async()=>{
  const f=fixture(),api=f.create(true);
  await api.submitAttempt({attemptId:"attempt-1",kind:"completed"});
  const arg=f.called.at(-1).args;
  assert.equal(arg.p_kind,"completed");
  assert.equal(arg.p_score,null);
  assert.equal(arg.p_max_score,null);
  assert.ok(arg.p_event_id);
  await assert.rejects(api.submitAttempt({attemptId:"attempt-1",kind:"completed",score:0}),/الإتمام/);
});

test("reported result sends idempotency token and valid score",async()=>{
  const f=fixture(),api=f.create(true);
  await api.submitAttempt({attemptId:"attempt-2",kind:"result",score:1.5,maxScore:2,eventId:"same-event"});
  const a=f.called.at(-1).args;
  assert.equal(a.p_score,1.5);
  assert.equal(a.p_max_score,2);
  assert.equal(a.p_event_id,"same-event");
  await assert.rejects(api.submitAttempt({attemptId:"attempt-2",kind:"result",score:3,maxScore:2}),/الدرجة/);
  await assert.rejects(api.submitAttempt({attemptId:"attempt-2",kind:"result",score:-1,maxScore:2}),/الدرجة/);
  await assert.rejects(api.submitAttempt({attemptId:"attempt-2",kind:"result",score:NaN,maxScore:2}),/الدرجة/);
});

test("server permission failures are never masked",async()=>{
  const f=fixture(),api=f.create(true);
  f.current.fail="edu_activity_publish";
  await assert.rejects(api.publish({classId:"c",kind:"lesson",title:"t",html:"<html></html>"}),/permission denied/);
});

test("client never uses direct table writes or service role",()=>{
  assert.doesNotMatch(js,/\.from\s*\(/);
  assert.doesNotMatch(js,/service_role/);
  assert.doesNotMatch(js,/\.insert\s*\(/);
  assert.doesNotMatch(js,/\.delete\s*\(/);
});
