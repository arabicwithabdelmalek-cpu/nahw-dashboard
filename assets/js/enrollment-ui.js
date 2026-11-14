/* Enrollment UI v3 — compact, form-first class and student management.
   Enhances the existing authenticated app; no new tables or credentials. */
(function (window, document) {
  "use strict";
  var dialog = null, beforeOpen = null, priorOverflow = "";
  var limit = 12;
  function app(){return window.NahwApp;}
  function st(){return app()&&app().S;}
  function api(){return app()&&app().API;}
  function me(){return st()&&st().me;}
  function dataset(){return st()&&st().data;}
  function classes(){return dataset()&&dataset().classes||[];}
  function staff(){return !!(me()&&["admin","teacher"].includes(me().role));}
  function esc(s){return String(s==null?"":s).replace(/[&<>"']/g,function(c){return {"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c];});}
  function teachers(){
    return (dataset()&&dataset().profiles||[]).filter(function(p){return p.role==="admin"||p.role==="teacher";});
  }
  function toast(message){
    var el=document.createElement("div");el.className="toast";el.textContent=message;
    document.body.appendChild(el);window.setTimeout(function(){el.remove();},3300);
  }
  function normName(s){return String(s||"").trim().replace(/\s+/g," ");}
  function focusedElement(){return document.activeElement;}
  function close(force){
    if(!dialog)return;
    if(dialog.dataset.busy==="yes"&&!force)return;
    var old=dialog;dialog=null;
    document.removeEventListener("keydown",onKeydown);
    old.remove();document.body.style.overflow=priorOverflow;
    if(beforeOpen&&beforeOpen.isConnected&&beforeOpen.focus)beforeOpen.focus();
    beforeOpen=null;
  }
  function onKeydown(e){
    if(!dialog)return;
    if(e.key==="Escape"){e.preventDefault();close();return;}
    if(e.key!=="Tab")return;
    var controls=Array.from(dialog.querySelectorAll('button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),a[href]'))
      .filter(function(n){return !n.closest("[hidden]");});
    if(!controls.length)return;
    if(e.shiftKey&&document.activeElement===controls[0]){e.preventDefault();controls[controls.length-1].focus();}
    else if(!e.shiftKey&&document.activeElement===controls[controls.length-1]){e.preventDefault();controls[0].focus();}
  }
  function modal(opts){
    close(true);
    priorOverflow=document.body.style.overflow;beforeOpen=focusedElement();
    var overlay=document.createElement("div");
    overlay.className="enroll-overlay enroll-v3"+(opts.wide?" enroll-wide":"");
    overlay.innerHTML='<section class="enroll-dialog" role="dialog" aria-modal="true" aria-labelledby="enroll-title" aria-describedby="enroll-subtitle">'+
      '<header class="enroll-head"><div class="enroll-heading">'+
      '<div class="enroll-eyebrow">'+esc(opts.eyebrow||"إدارة الفصول والطلاب")+'</div>'+
      '<h2 id="enroll-title">'+esc(opts.title)+'</h2>'+
      (opts.subtitle?'<p id="enroll-subtitle">'+esc(opts.subtitle)+'</p>':'<p id="enroll-subtitle" class="visually-hidden">نموذج بيانات</p>')+
      '</div><button type="button" class="enroll-close" aria-label="إغلاق" data-close>×</button></header>'+
      '<form class="enroll-form" novalidate><div class="enroll-body">'+opts.body+'</div>'+
      '<div class="enroll-error" role="alert" hidden></div>'+
      '<footer class="enroll-footer">'+
      (opts.save?'<button type="submit" class="btn enroll-primary">'+esc(opts.save)+'</button>':'')+
      '<button type="button" class="btn ghost enroll-cancel" data-close>'+(opts.save?"إلغاء":"إغلاق")+'</button>'+
      '</footer></form></section>';
    overlay.addEventListener("click",function(e){
      if(e.target===overlay||e.target.closest("[data-close]"))close();
    });
    var form=overlay.querySelector("form");
    if(opts.submit)form.addEventListener("submit",async function(e){
      e.preventDefault();
      if(overlay.dataset.busy==="yes")return;
      if(!form.checkValidity()){form.reportValidity();return;}
      var btn=form.querySelector('[type="submit"]');
      overlay.querySelector(".enroll-error").hidden=true;
      overlay.dataset.busy="yes";
      if(btn){btn.disabled=true;btn.dataset.oldLabel=btn.textContent;btn.textContent="جارٍ الحفظ…";}
      try{await opts.submit(form,overlay);}
      catch(err){
        if(overlay.isConnected){var box=overlay.querySelector(".enroll-error");
          box.textContent=err&&err.message?err.message:"تعذر حفظ البيانات. حاول مرة أخرى.";box.hidden=false;
        }
      }finally{
        if(overlay.isConnected){overlay.dataset.busy="no";if(btn){btn.disabled=false;btn.textContent=btn.dataset.oldLabel||"حفظ";}}
      }
    });
    document.body.appendChild(overlay);document.body.style.overflow="hidden";
    dialog=overlay;document.addEventListener("keydown",onKeydown);
    var first=overlay.querySelector(".enroll-body input:not([type=radio]),.enroll-body select,.enroll-body button,.enroll-head button");
    if(first)first.focus();
    return overlay;
  }
  function field(name,label,placeholder,value,required,type){
    return '<div class="enroll-field"><label for="'+name+'">'+esc(label)+'</label><input id="'+name+'" name="'+name+'" class="inp" type="'+(type||"text")+'" '+
      (required?"required ":"")+'autocomplete="off" maxlength="'+(name==="studentName"?"140":"100")+'" placeholder="'+esc(placeholder||"")+'" value="'+esc(value||"")+'"></div>';
  }
  function selectClass(selected){
    var options=classes().map(function(c){
      return '<option value="'+esc(c.id)+'"'+(c.id===selected?" selected":"")+'>'+esc(c.name)+'</option>';
    }).join("");
    return '<div class="enroll-field"><label for="enroll-class-id">الفصل</label><select name="classId" id="enroll-class-id" class="inp" required>'+options+'</select></div>';
  }
  function genderChoices(chosen){
    return '<fieldset class="enroll-field enroll-fieldset"><legend>الفصل مخصص لـ</legend><div class="enroll-choice-row">'+
      '<label class="enroll-choice"><input name="gender" type="radio" value="m" '+(chosen!=="f"?"checked":"")+'><span>البنين</span></label>'+
      '<label class="enroll-choice"><input name="gender" type="radio" value="f" '+(chosen==="f"?"checked":"")+'><span>البنات</span></label></div></fieldset>';
  }
  async function refresh(){
    if(!app()||!api())throw Error("تعذر الاتصال بالمنصة.");
    st().data=await api().loadAll();app().refresh();
  }
  function classForm(classId){
    if(!staff())return;
    var current=classId&&classes().find(function(c){return c.id===classId;});
    if(classId&&!current)return toast("الفصل غير موجود.");
    var editing=!!current,admin=me().role==="admin",list=teachers();
    var owner=current?current.teacher_id:me().id;
    var teacherSelect=admin&&list.length>1?'<div class="enroll-field"><label for="enroll-teacher">المعلم المسؤول</label><select id="enroll-teacher" name="teacherId" class="inp">'+
      list.map(function(p){return '<option value="'+esc(p.id)+'" '+(owner===p.id?"selected":"")+'>'+esc(p.full_name||p.email||"معلم")+'</option>';}).join("")+'</select></div>':"";
    modal({eyebrow:"الفصول",title:editing?"تعديل الفصل":"فصل جديد",
      subtitle:editing?"غيّر البيانات الأساسية للفصل.":"اسم واضح، ومعلم مسؤول، ثم نضيف الطلاب.",
      body:field("className","اسم الفصل","مثال: العربية — المستوى الأول",current&&current.name,true)+
        genderChoices(current?current.gender:me().gender)+teacherSelect,
      save:editing?"حفظ التغييرات":"إنشاء الفصل",
      submit:async function(form){
        var d=new FormData(form),name=normName(d.get("className")),gender=d.get("gender");
        var teacherId=admin&&list.length>1?d.get("teacherId"):owner;
        if(name.length<2)throw Error("اكتب اسمًا واضحًا للفصل.");
        if(!["m","f"].includes(gender))throw Error("اختر البنين أو البنات.");
        if(!list.some(function(p){return p.id===teacherId;}))throw Error("المعلم المسؤول غير متاح.");
        if(classes().some(function(c){return c.id!==classId&&c.teacher_id===teacherId&&c.name.trim().toLocaleLowerCase()===name.toLocaleLowerCase();}))
          throw Error("يوجد فصل بنفس الاسم لهذا المعلم.");
        var payload={name:name,gender:gender};
        if(admin)payload.teacher_id=teacherId;
        if(editing)await api().updateClass(current.id,payload);
        else await api().createClass(payload);
        await refresh();
        var newClass=classes().find(function(c){return c.name===name&&c.teacher_id===teacherId;});
        close(true);
        toast(editing?"تم حفظ التعديلات.":"تم إنشاء الفصل.");
        if(!editing&&newClass)window.location.hash="#/class/"+encodeURIComponent(newClass.id);
      }});
  }
  function password(){
    if(!window.crypto||typeof window.crypto.getRandomValues!=="function")throw Error("المتصفح لا يدعم إنشاء كلمة مرور آمنة.");
    var abc="ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789";
    var arr=new Uint32Array(14);window.crypto.getRandomValues(arr);
    return "Aa7!"+Array.from(arr,function(v){return abc[v%abc.length];}).join("");
  }
  async function createStudent(classId,name,email){
    var classExists=classes().some(function(c){return c.id===classId;});
    if(!classExists)throw Error("اختر فصلًا صحيحًا.");
    if(!email){
      await api().addStudentsNoAccount(classId,[name]);
      return {name:name,email:"",status:"بيانات فقط — بلا حساب"};
    }
    var pw=password(),id=await api().createAccount(email,pw);
    try{await api().attachStudent(id,classId,name,email,null);}
    catch(err){throw Error("تم إنشاء الحساب لكن ربطه بالفصل لم يكتمل. لا تعِد إنشاء الحساب بنفس البريد؛ راجع المسؤول. "+(err.message||""));}
    return {name:name,email:email,password:pw,status:"تم إنشاء الحساب"};
  }
  function infoNote(hasEmail){
    return hasEmail?
      '<div class="enroll-inline-note"><span class="enroll-note-dot"></span>سيُنشأ حساب للطالب، وستظهر كلمة المرور لك بعد الحفظ.</div>':
      '<div class="enroll-inline-note muted-note">بدون بريد: يُضاف الطالب إلى السجلات فقط، ولن يتمكن من دخول المنصة حتى إنشاء حساب له.</div>';
  }
  function success(results,classId,bulk){
    var good=results.filter(function(r){return !r.error;}).length;
    var failed=results.length-good;
    var text=bulk?(good+" من "+results.length+" طلاب تمت إضافتهم"):(failed?"تعذر إضافة الطالب":"تمت إضافة الطالب");
    var itemHtml=results.map(function(r){
      return '<div class="enroll-result '+(r.error?"has-error":"")+'"><div class="enroll-result-name">'+esc(r.name)+'</div>'+
        '<span class="enroll-status '+(r.error?"bad":"good")+'">'+esc(r.error?"لم يكتمل":r.status)+'</span>'+
        (r.email?'<span class="enroll-result-email" dir="ltr">'+esc(r.email)+'</span>':"")+
        (r.password?'<div class="enroll-password"><span>كلمة المرور المؤقتة</span><code dir="ltr">'+esc(r.password)+'</code></div>':"")+
        (r.error?'<p class="enroll-result-error">'+esc(r.error)+'</p>':"")+'</div>';
    }).join("");
    var copyData=results.filter(function(r){return r.password;}).map(function(r){return [r.name,r.email,r.password].join(" | ");}).join("\n");
    var body='<div class="enroll-success-summary '+(failed?"partial":"")+'"><span class="enroll-success-mark">'+(failed?"!":"✓")+'</span>'+
      '<div><strong>'+esc(text)+'</strong><p>'+(copyData?"احفظ بيانات الدخول الآن؛ كلمة المرور لا يمكن استرجاعها لاحقًا.":"يمكنك متابعة إدارة الطلاب داخل الفصل.")+'</p></div></div>'+
      '<div class="enroll-results">'+itemHtml+'</div>'+
      (copyData?'<button type="button" class="enroll-text-action" data-enroll-copy>نسخ بيانات الدخول</button>':"")+
      '<button type="button" class="enroll-text-action" data-enroll-another>+ إضافة '+(bulk?"مجموعة أخرى":"طالب آخر")+'</button>';
    var box=modal({eyebrow:"الطلاب",title:failed?"نتيجة الإضافة":"تم الحفظ",body:body});
    if(copyData)box.querySelector("[data-enroll-copy]").addEventListener("click",function(){
      if(navigator.clipboard&&navigator.clipboard.writeText)navigator.clipboard.writeText(copyData).then(function(){toast("تم نسخ البيانات.");}).catch(function(){window.prompt("انسخ بيانات الدخول:",copyData);});
      else window.prompt("انسخ بيانات الدخول:",copyData);
    });
    box.querySelector("[data-enroll-another]").addEventListener("click",function(){
      if(bulk)bulkForm(classId);else studentForm(classId);
    });
  }
  function studentForm(classId){
    if(!staff())return;
    if(!classes().length){toast("أنشئ فصلًا أولًا.");window.location.hash="#/classes";return;}
    if(classId&&!classes().some(function(c){return c.id===classId;}))return toast("الفصل غير موجود.");
    var chosen=classId||classes()[0].id,cls=classes().find(function(c){return c.id===chosen;});
    var classHtml=classId?
      '<div class="enroll-context"><span class="enroll-context-label">الفصل</span><strong>'+esc(cls.name)+'</strong></div>':
      selectClass(chosen);
    var box=modal({eyebrow:"الطلاب",title:"إضافة طالب",subtitle:"أدخل بيانات الطالب الأساسية.",
      body:classHtml+
        field("studentName","اسم الطالب","اسم الطالب الكامل","",true)+
        '<div class="enroll-field"><label for="studentEmail">البريد الإلكتروني <span class="enroll-optional">اختياري</span></label>'+
        '<input id="studentEmail" name="studentEmail" type="email" class="inp" dir="ltr" autocomplete="off" placeholder="student@example.com" maxlength="254">'+
        '<div data-email-hint>'+infoNote(false)+'</div></div>'+
        '<div class="enroll-secondary-link"><button type="button" data-show-bulk>تريد إضافة أكثر من طالب؟ <b>إضافة مجموعة</b></button></div>',
      save:"إضافة الطالب",submit:async function(form){
        var d=new FormData(form),name=normName(d.get("studentName"));
        var email=String(d.get("studentEmail")||"").trim().toLowerCase();
        var chosenClass=classId||String(d.get("classId")||"");
        if(name.length<2)throw Error("اكتب الاسم الكامل للطالب.");
        if(email&&!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))throw Error("البريد الإلكتروني غير صحيح.");
        var existing=(dataset()&&dataset().students||[]).find(function(s){return s.email&&s.email.toLowerCase()===email;});
        if(email&&existing)throw Error("البريد مستخدم لطالب موجود بالفعل.");
        var result=await createStudent(chosenClass,name,email);
        await refresh();success([result],chosenClass,false);
      }});
    box.querySelector("#studentEmail").addEventListener("input",function(e){
      var hint=box.querySelector("[data-email-hint]");hint.innerHTML=infoNote(!!e.target.value.trim());
    });
    box.querySelector("[data-show-bulk]").addEventListener("click",function(){
      var classChoice=classId||box.querySelector("#enroll-class-id").value;bulkForm(classChoice);
    });
  }
  function row(index){
    return '<div class="enroll-person-row"><span class="enroll-person-no">'+(index+1)+'</span>'+
      '<div class="enroll-row-inputs"><input class="inp" name="bulkName" placeholder="اسم الطالب" aria-label="اسم الطالب" maxlength="140">'+
      '<input class="inp" name="bulkEmail" type="email" aria-label="بريد الطالب" placeholder="البريد (اختياري)" maxlength="254" dir="ltr"></div>'+
      '<button type="button" class="enroll-remove" data-remove-row aria-label="حذف هذا الصف" title="حذف الصف">×</button></div>';
  }
  function bulkForm(classId){
    if(!staff())return;
    if(!classes().some(function(c){return c.id===classId;}))return toast("الفصل غير موجود.");
    var cls=classes().find(function(c){return c.id===classId;});
    var box=modal({eyebrow:"الطلاب",title:"إضافة مجموعة طلاب",subtitle:"بيانات واضحة لكل طالب، بدون كتابة سطور معقدة.",
      wide:true,body:'<div class="enroll-context"><span class="enroll-context-label">الفصل</span><strong>'+esc(cls.name)+'</strong></div>'+
        '<div class="enroll-people-head"><span>الطلاب</span><span>حتى '+limit+' طالبًا في المرة</span></div>'+
        '<div class="enroll-rows">'+row(0)+row(1)+'</div>'+
        '<button type="button" class="enroll-add-row" data-add-row>+ إضافة صف آخر</button>'+
        '<div class="enroll-inline-note muted-note">البريد اختياري. الطالب الذي لا يملك بريدًا يُضاف إلى السجلات فقط دون حساب دخول.</div>'+
        '<button type="button" class="enroll-back" data-show-single>إضافة طالب واحد بدلًا من ذلك</button>',
      save:"إضافة الطلاب",submit:async function(form,overlay){
        var rowNodes=Array.from(overlay.querySelectorAll(".enroll-person-row"));
        var vals=[],duplicates=new Set();
        rowNodes.forEach(function(r){
          var name=normName(r.querySelector('[name="bulkName"]').value);
          var email=r.querySelector('[name="bulkEmail"]').value.trim().toLowerCase();
          if(!name&&!email)return;
          if(name.length<2)throw Error("أدخل اسمًا صحيحًا لكل طالب.");
          if(email&&!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))throw Error("تحقق من أحد عناوين البريد الإلكتروني.");
          if(email&&duplicates.has(email))throw Error("هناك بريد إلكتروني مكرر.");
          if(email)duplicates.add(email);
          vals.push({name:name,email:email});
        });
        if(!vals.length)throw Error("أضف طالبًا واحدًا على الأقل.");
        var results=[];
        for(var i=0;i<vals.length;i++){
          try{results.push(await createStudent(classId,vals[i].name,vals[i].email));}
          catch(err){results.push({name:vals[i].name,email:vals[i].email,error:err.message||"تعذر الإضافة"});}
        }
        await refresh();success(results,classId,true);
      }});
    box.querySelector("[data-add-row]").addEventListener("click",function(){
      var wrap=box.querySelector(".enroll-rows");
      if(wrap.children.length>=limit){toast("وصلت للحد الأقصى.");return;}
      var div=document.createElement("div");div.innerHTML=row(wrap.children.length);wrap.appendChild(div.firstElementChild);
      renumberRows(box);wrap.lastElementChild.querySelector("input").focus();
    });
    box.querySelector(".enroll-rows").addEventListener("click",function(event){
      if(!event.target.closest("[data-remove-row]"))return;
      var wrap=box.querySelector(".enroll-rows");
      if(wrap.children.length<=1)return toast("لازم يكون فيه صف واحد على الأقل.");
      event.target.closest(".enroll-person-row").remove();renumberRows(box);
    });
    box.querySelector("[data-show-single]").addEventListener("click",function(){studentForm(classId);});
  }
  function renumberRows(box){
    box.querySelectorAll(".enroll-person-no").forEach(function(el,i){el.textContent=i+1;});
  }
  function addShortcut(){
    if(!staff()||window.location.hash.split("?")[0]!=="#/students")return;
    var toolbar=document.querySelector(".main .wrap .ph .actions");
    if(!toolbar||toolbar.querySelector("[data-enroll-quick]"))return;
    var b=document.createElement("button");
    b.type="button";b.className="btn";b.dataset.enrollQuick="1";b.textContent="+ إضافة طالب";
    toolbar.insertBefore(b,toolbar.firstChild);
  }
  document.addEventListener("click",function(event){
    if(!staff())return;
    var target=event.target&&event.target.closest&&event.target.closest("[data-act],[data-enroll-quick]");
    if(!target)return;
    var act=target.dataset.enrollQuick?"quick":target.dataset.act;
    if(!["quick","newClass","editClass","addStudents"].includes(act))return;
    event.preventDefault();event.stopImmediatePropagation();
    if(act==="newClass")classForm(null);
    else if(act==="editClass")classForm(target.dataset.id);
    else if(act==="addStudents")studentForm(target.dataset.id);
    else studentForm(classes().length===1?classes()[0].id:null);
  },true);
  if(typeof window.MutationObserver==="function"){
    var root=document.getElementById("app");
    if(root)new window.MutationObserver(addShortcut).observe(root,{childList:true,subtree:true});
  }
  window.addEventListener("hashchange",addShortcut);
  addShortcut();
  window.NahwEnrollmentUI=Object.freeze({close:close,openClass:classForm,openStudents:studentForm,version:"3.1"});
}(window,document));