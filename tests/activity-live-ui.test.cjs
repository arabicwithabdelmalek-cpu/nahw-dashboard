"use strict";
/* Run: node --test tests/activity-live-ui.test.cjs */
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const js = fs.readFileSync(path.join(__dirname, "../assets/js/activity-live-ui.js"),"utf8");

function fixture(role, flag) {
  const user = {id:role==="student"?"student-1":"teacher-1",role,full_name:"مستخدم"};
  const s = {me:user,data:{
    classes:[{id:"class-1",name:"الفصل",teacher_id:"teacher-1"}]
  }};
  let rendered = "", callback = null;
  const calls = [], handlers={click:[],change:[]}, fields={};
  const service = {
    isEnabled:()=>true,
    probe:async()=>{calls.push("probe");return{ready:true}},
    myAssignments:async()=>{calls.push("mine");return [{assignment_id:"assignment-1",kind:"homework",title:"تمرين"}]},
    classAssignments:async(id)=>{calls.push("class:"+id);return[{assignment_id:"assignment-1",kind:"homework",title:"تمرين"}]},
    publish:async(request)=>{calls.push(["publish",request]);return{assignment_id:"assignment-2"}},
    classResults:async(id)=>{calls.push("results:"+id);return[{student_name:"طالبة",status:"completed",score:2,max_score:2}]},
    beginAttempt:async(id)=>{calls.push("begin:"+id);return{attempt_id:"attempt-1",html:"<!doctype html><html><body></body></html>",title:"تمرين"}},
    submitAttempt:async(v)=>{calls.push(["submit",v]);return{accepted:true,duplicate:false}}
  };
  const W = {
    EDU_PLATFORM:{name:"المنصة التعليمية",activityPersistenceEnabled:flag},
    EduActivityPersistence:{maxHtmlBytes:1048576},
    location:{hash:"#/activity-live"},
    NahwApp:{S:s,API:{activities:service},refresh:()=>{rendered=W.EduActivityLive.view();}},
    EduActivityPreview:{openHtml:(html,title,fn,opts)=>{callback={fn,opts};}}
  };
  const D = {
    addEventListener:(event,fn)=>{(handlers[event]||(handlers[event]=[])).push(fn)},
    getElementById:(id)=>fields[id]||null
  };
  vm.runInNewContext(js,{window:W,document:D,Promise});
  const click = (action,id)=>{
    const button={dataset:{liveAction:action,liveId:id}};
    for(const fn of handlers.click){
      fn({target:{closest:(selector)=>selector==="[data-live-action]"?button:null},
        preventDefault(){},stopPropagation(){}});
    }
  };
  const flush = async()=>{for(let i=0;i<5;i++)await new Promise(resolve=>setImmediate(resolve));};
  return {W,D,s,service,calls,fields,click,flush,render:()=>W.EduActivityLive.view(),
    last:()=>rendered,callback:()=>callback};
}

test("feature switch is off and calls no RPC",async()=>{
  const f=fixture("teacher",false);
  assert.match(f.render(),/لم يُفعّل/);
  await f.flush();
  assert.equal(f.calls.length,0);
  f.click("retry");
  await f.flush();
  assert.equal(f.calls.length,0);
});

test("teacher loads assignments and shows safely escaped server strings",async()=>{
  const f=fixture("teacher",true);
  f.service.classAssignments=async()=>{
    return [{assignment_id:"a1",kind:"lesson",title:'<img src=x onerror="alert(1)">'}];
  };
  f.render();
  await f.flush();
  assert.match(f.last(),/إسناد نشاط HTML جديد/);
  assert.match(f.last(),/&lt;img/);
  assert.doesNotMatch(f.last(),/<img src=x/);
});

test("teacher publish sends a bounded request through RPC adapter only",async()=>{
  const f=fixture("teacher",true);
  f.render();await f.flush();
  Object.assign(f.fields,{
    liveClass:{value:"class-1"},
    liveKind:{value:"exam"},
    liveTitle:{value:"امتحان قصير"},
    liveFile:{files:[{name:"exam.html",size:80,text:async()=>"<html><body>Test</body></html>"}]}
  });
  f.click("publish");await f.flush();
  const item=f.calls.find(x=>Array.isArray(x)&&x[0]==="publish");
  assert.ok(item);
  assert.equal(item[1].classId,"class-1");
  assert.equal(item[1].kind,"exam");
  assert.equal(item[1].title,"امتحان قصير");
});

test("teacher cannot publish to a class outside owned list",async()=>{
  const f=fixture("teacher",true);f.render();await f.flush();
  Object.assign(f.fields,{
    liveClass:{value:"another-class"},
    liveKind:{value:"homework"},
    liveTitle:{value:"تمرين"},
    liveFile:{files:[{name:"x.html",size:80,text:async()=>"<html></html>"}]}
  });
  f.click("publish");await f.flush();
  assert.equal(f.calls.filter(x=>Array.isArray(x)&&x[0]==="publish").length,0);
});

test("student fetches own assignments, begins attempt and submits only attempt ID",async()=>{
  const f=fixture("student",true);
  f.render();await f.flush();
  assert.match(f.last(),/تمرين/);
  f.click("start","assignment-1");await f.flush();
  assert.ok(f.callback());
  assert.equal(f.callback().opts.delivery,"server");
  await f.callback().fn({kind:"result",score:2,maxScore:2});
  await f.flush();
  const sent=f.calls.find(x=>Array.isArray(x)&&x[0]==="submit");
  assert.ok(sent);
  assert.equal(sent[1].attemptId,"attempt-1");
  assert.equal(sent[1].kind,"result");
  assert.equal(sent[1].score,2);
  assert.equal(Object.prototype.hasOwnProperty.call(sent[1],"studentId"),false);
});

test("student cannot directly open an assignment not supplied by backend",async()=>{
  const f=fixture("student",true);f.render();await f.flush();
  f.click("start","not-assigned");await f.flush();
  assert.equal(f.calls.filter(x=>String(x).startsWith("begin:")).length,0);
});

test("teacher can query assignment results only after it appears in authorized list",async()=>{
  const f=fixture("teacher",true);f.render();await f.flush();
  f.click("results","unknown");await f.flush();
  assert.equal(f.calls.filter(x=>String(x).startsWith("results:")).length,0);
  f.click("results","assignment-1");await f.flush();
  assert.ok(f.calls.includes("results:assignment-1"));
  assert.match(f.last(),/2 \/ 2/);
});
