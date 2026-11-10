/* DEMO-ONLY HTML class assignments and results.
   Never stores credentials, writes to Supabase, or persists anything. */
(function (win, doc) {
  "use strict";
  if (!/(?:^|[?&])demo=1(?:&|$)/.test(win.location.search)) return;
  var assignments=[], attempts=[], chosenFile=null, message="";
  var kinds={lesson:"درس",homework:"واجب",exam:"اختبار"};
  function esc(v){return String(v==null?"":v).replace(/[&<>"']/g,function(c){return{"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]});}
  function state(){return win.NahwApp&&win.NahwApp.S;}
  function role(){var s=state();return s&&s.me&&s.me.role||"";}
  function staff(){return role()==="admin"||role()==="teacher";}
  function refresh(){if(win.NahwApp&&win.NahwApp.refresh)win.NahwApp.refresh();}
  function currentStudent(){var s=state();return role()==="student"&&s&&s.portal?{
    id:s.portal.student.id,name:s.portal.student.full_name,classId:s.portal.class.id}:null;}
  function classes(){var s=state();return staff()&&s.data?(s.data.classes||[]).filter(function(c){
    return role()==="admin"||c.teacher_id===s.me.id;}):[];}
  function classStudents(id){var s=state();return(s&&s.data&&s.data.students||[]).filter(function(p){return p.class_id===id&&!p.archived;});}
  function latest(aid,sid){return attempts.filter(function(r){return r.assignmentId===aid&&r.studentId===sid;}).slice(-1)[0]||null;}
  function mark(r){return r?r.kind==="result"?'<span class="tag ok">'+r.score+' / '+r.maxScore+'</span>':'<span class="tag ok">مكتمل بلا درجة</span>':'<span class="tag warn">لم يُسلَّم</span>';}
  function newId(){if(!win.crypto||!win.crypto.randomUUID)throw Error("يتطلب هذا العرض متصفحًا آمنًا حديثًا.");return"demo-"+win.crypto.randomUUID();}
  function banner(){return'<div class="msg info" style="margin-bottom:16px">تجربة مؤقتة داخل المتصفح: التكليفات والنتائج تختفي بعد تحديث الصفحة، ولا تُرسل إلى Supabase.</div>';}
  function renderStaff(){
    var permitted=classes(), ids=permitted.map(function(c){return c.id;});
    var visible=assignments.filter(function(a){return ids.indexOf(a.classId)!==-1;});
    var options=permitted.map(function(c){return'<option value="'+esc(c.id)+'">'+esc(c.name)+'</option>';}).join("");
    var cards=visible.map(function(a){
      var list=classStudents(a.classId),completed=list.filter(function(p){return !!latest(a.id,p.id)}).length;
      return'<div class="card" style="margin-bottom:14px"><div class="row" style="justify-content:space-between;flex-wrap:wrap;gap:12px"><div><span class="tag">'+kinds[a.kind]+'</span><h3 style="margin-top:8px">'+esc(a.title)+'</h3><div class="small muted">'+esc(a.className)+'</div></div><b>'+completed+' / '+list.length+' سلّموا</b></div><div class="tblwrap" style="margin-top:12px"><table class="tbl"><thead><tr><th>الطالب</th><th>آخر تسليم</th></tr></thead><tbody>'+
        (list.map(function(p){return'<tr><td>'+esc(p.full_name)+'</td><td>'+mark(latest(a.id,p.id))+'</td></tr>';}).join("")||'<tr><td colspan="2">لا يوجد طلاب.</td></tr>')+'</tbody></table></div></div>';
    }).join("");
    return'<div class="ph"><div><h1>ربط أنشطة HTML بالفصول</h1><div class="sub">جرّب دورة التكليف والتسليم كاملة قبل إنشاء قاعدة البيانات.</div></div><div class="actions"><a class="btn ghost" href="#/lessons">العودة إلى الدروس</a><button class="btn" type="button" data-flow-action="switch-student">تجربة واجهة الطالب</button></div></div>'+banner()+
      (message?'<div class="msg info" style="margin-bottom:14px">'+esc(message)+'</div>':"")+
      '<div class="card" style="margin-bottom:18px"><h2>إسناد نشاط إلى فصل</h2><div class="grid g2" style="margin-top:12px"><div class="field"><label>الفصل</label><select class="inp" id="flowClass">'+options+'</select></div><div class="field"><label>نوع النشاط</label><select class="inp" id="flowKind"><option value="lesson">درس</option><option value="homework">واجب</option><option value="exam">اختبار</option></select></div></div>'+
      '<div class="field"><label>ملف HTML اختياري</label><input class="inp" type="file" id="flowFile" accept=".html,.htm,text/html"><small>بدون ملف سيُستخدم النموذج النحوي الجاهز. الملف الجديد يُقرأ محليًا فقط.</small></div>'+
      '<p class="small muted" id="flowNotice"></p><div class="actions"><button type="button" class="btn" data-flow-action="assign"'+(permitted.length?'':' disabled')+'>إسناد النشاط</button></div></div>'+
      '<h2 class="sec-t">التكليفات التجريبية ('+visible.length+')</h2>'+(cards||'<div class="card empty">لا توجد تكليفات. حدّد الفصل ونوع النشاط أولًا.</div>');
  }
  function renderStudent(){
    var student=currentStudent();if(!student)return'<div class="card empty">لم يتم ربط حساب الطالب بفصل.</div>';
    var mine=assignments.filter(function(a){return a.classId===student.classId;}),done=mine.filter(function(a){return !!latest(a.id,student.id)}).length;
    var cards=mine.map(function(a){var record=latest(a.id,student.id);return'<div class="card" style="margin-bottom:12px"><div class="row" style="justify-content:space-between;gap:12px;flex-wrap:wrap"><div><span class="tag">'+kinds[a.kind]+'</span><h3 style="margin-top:8px">'+esc(a.title)+'</h3><div class="small muted">'+esc(a.className)+'</div></div>'+mark(record)+'</div><div class="actions" style="margin-top:14px"><button type="button" class="btn" data-flow-action="start" data-flow-id="'+esc(a.id)+'">'+(record?"إعادة المحاولة":"بدء النشاط")+'</button></div></div>';}).join("");
    return'<div class="demo-banner">وضع المعاينة: لا توجد درجات أو حضور رسمي.</div><header class="ptop"><div class="wrap ptop-in"><b>أنشطة HTML التجريبية</b><span class="small muted">'+esc(student.name)+'</span><button class="btn ghost sm" type="button" data-flow-action="switch-teacher">العودة لواجهة المعلم</button><button class="link small" data-act="logout">خروج</button></div></header><main class="pmain"><div class="wrap"><div class="crumb"><a href="#/">واجباتي القديمة</a> ‹ أنشطة HTML التجريبية</div><div class="ph"><div><h1>أنشطتي الجديدة</h1><div class="sub">أنشطة الفصل المسندة إليك في هذه الجلسة التجريبية.</div></div></div>'+banner()+'<div class="grid g3 kpis" style="margin-bottom:18px"><div class="card kpi"><small>الأنشطة</small><b>'+mine.length+'</b></div><div class="card kpi"><small>مكتملة</small><b>'+done+'</b></div><div class="card kpi"><small>لم تُستكمل</small><b>'+(mine.length-done)+'</b></div></div>'+
      (message?'<div class="msg info" style="margin-bottom:14px">'+esc(message)+'</div>':"")+(cards||'<div class="card empty">لم يُسنَد إلى فصلك أي نشاط تجريبي بعد.</div>')+'</div></main>';
  }
  function render(){return role()==="student"?renderStudent():staff()?renderStaff():'<div class="card empty">يرجى تسجيل الدخول.</div>';}
  function problem(text){message=text;refresh();}
  function assign(){
    if(!staff())return;
    var cls=doc.getElementById("flowClass"),typ=doc.getElementById("flowKind");
    var c=classes().find(function(x){return cls&&x.id===cls.value;});
    var kind=typ&&typ.value;
    if(!c||!Object.prototype.hasOwnProperty.call(kinds,kind))return problem("اختر فصلًا ونوعًا صالحين.");
    var promise=chosenFile?Promise.resolve(chosenFile):fetch("./examples/html-activity-example.html").then(function(r){if(!r.ok)throw Error("تعذر تحميل النشاط النموذجي.");return r.text();}).then(function(h){return{html:h,title:"نموذج نشاط نحوي"};});
    promise.then(function(item){
      if(!/<html(?:\s|>)/i.test(item.html)||new Blob([item.html]).size>2*1024*1024)throw Error("الملف غير صالح للمعاينة.");
      assignments.push({id:newId(),classId:c.id,className:c.name,kind:kind,title:item.title,html:item.html});
      chosenFile=null;message="أُسنِد النشاط إلى فصل «"+c.name+"» في المعاينة فقط.";refresh();
    }).catch(function(e){problem(e.message||"تعذر الإسناد.");});
  }
  function switchRole(target){
    var app=win.NahwApp,api=app&&app.API;
    if(!api||!api.demo||!state()||(target!=="student"&&target!=="teacher"))return;
    if(target==="student"&&!staff())return;
    if(target==="teacher"&&role()!=="student")return;
    api.signOut().then(function(){return api.signIn("","",target);}).then(function(){return api.me();}).then(function(me){
      if(!me||me.role!==target)throw Error("تعذر تبديل دور المعاينة.");
      state().me=me;state().data=null;state().portal=null;
      return target==="student"?api.portal().then(function(portal){state().portal=portal;}):
        api.loadAll().then(function(data){state().data=data;});
    }).then(function(){
      message=target==="student"?"أنت الآن في واجهة الطالب التجريبية.":"عُدتَ إلى واجهة المعلم التجريبية.";
      win.location.hash="#/activity-demo";refresh();
    }).catch(function(e){problem(e&&e.message||"تعذر تبديل دور المعاينة.");});
  }
  function start(button){
    var student=currentStudent();if(!student)return;
    var a=assignments.find(function(x){return x.id===button.dataset.flowId&&x.classId===student.classId;});
    if(!a)return problem("هذا النشاط غير مسند لفصلك.");
    try{
      win.EduActivityPreview.openHtml(a.html,a.title,function(result){
        // Trusted for UI demo display only; not an authenticated grade.
        if(!currentStudent()||currentStudent().id!==student.id)return;
        if(result.kind!=="completed"&&result.kind!=="result")return;
        attempts.push({assignmentId:a.id,studentId:student.id,kind:result.kind,score:result.kind==="result"?result.score:null,maxScore:result.kind==="result"?result.maxScore:null});
        message="وصل تسليم تجريبي؛ يمكن للمعلم رؤيته عند تغيير الدور.";refresh();
      });
    }catch(e){problem(e.message||"تعذر فتح النشاط.");}
  }
  doc.addEventListener("click",function(e){
    var button=e.target&&e.target.closest&&e.target.closest("[data-flow-action]");
    if(!button||!/^#\/activity-demo(?:\?|$)/.test(win.location.hash))return;
    e.preventDefault();e.stopPropagation();
    if(button.dataset.flowAction==="assign")assign();
    if(button.dataset.flowAction==="start")start(button);
    if(button.dataset.flowAction==="switch-student")switchRole("student");
    if(button.dataset.flowAction==="switch-teacher")switchRole("teacher");
  });
  doc.addEventListener("change",function(e){
    var fileInput=e.target;
    if(!fileInput||fileInput.id!=="flowFile"||!staff()||!/^#\/activity-demo(?:\?|$)/.test(win.location.hash))return;
    chosenFile=null;
    var file=fileInput.files&&fileInput.files[0];if(!file)return;
    if(!/\.html?$/i.test(file.name)||file.size<1||file.size>2*1024*1024){fileInput.value="";return problem("اختر ملف HTML صالحًا بحجم لا يزيد عن ٢ ميجابايت.");}
    file.text().then(function(h){
      if(!/<html(?:\s|>)/i.test(h))throw Error("الملف ليس صفحة HTML مستقلة.");
      chosenFile={html:h,title:file.name.replace(/\.html?$/i,"")};
      var note=doc.getElementById("flowNotice");if(note)note.textContent="ملف جاهز للإسناد محليًا: "+file.name;
    }).catch(function(e){problem(e.message||"تعذر قراءة الملف.");});
  });
  win.EduActivityFlowDemo={render:render,inspect:function(){
    return{assignments:assignments.map(function(a){return{id:a.id,classId:a.classId,kind:a.kind,title:a.title};}),attempts:attempts.slice()};}};
}(window,document));
