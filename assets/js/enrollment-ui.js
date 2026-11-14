/* Scoped enrollment UX. Uses the existing authenticated API; no database changes. */
(function (window, document) {
  "use strict";

  var activeDialog = null;
  var previousOverflow = "";
  var labels = { m: "بنين", f: "بنات" };

  function app() { return window.NahwApp; }
  function state() { return app() && app().S; }
  function api() { return app() && app().API; }
  function esc(value) {
    return String(value == null ? "" : value).replace(/[&<>"']/g, function (char) {
      return {"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[char];
    });
  }
  function classes() { return state() && state().data && state().data.classes || []; }
  function staff() {
    var role = state() && state().me && state().me.role;
    return role === "teacher" || role === "admin";
  }
  function currentUser() { return state() && state().me; }
  function teachers() {
    var data = state() && state().data;
    return data ? data.profiles.filter(function (p) { return p.role === "teacher" || p.role === "admin"; }) : [];
  }
  function escapeClose(event) { if (event.key === "Escape") close(); }

  function close() {
    if (!activeDialog) return;
    activeDialog.remove();
    activeDialog = null;
    document.removeEventListener("keydown", escapeClose);
    document.body.style.overflow = previousOverflow;
  }
  function showToast(message) {
    var node = document.createElement("div");
    node.className = "toast";
    node.textContent = message;
    document.body.appendChild(node);
    window.setTimeout(function () { node.remove(); }, 3500);
  }
  function modal(title, subtitle, body, submitText, onSave) {
    close();
    previousOverflow = document.body.style.overflow;
    var overlay = document.createElement("div");
    overlay.className = "enroll-overlay";
    overlay.setAttribute("role", "presentation");
    overlay.innerHTML =
      '<section class="enroll-dialog" role="dialog" aria-modal="true" aria-labelledby="enroll-title">' +
      '<div class="enroll-head"><div><h2 id="enroll-title">'+esc(title)+'</h2>'+
      '<p>'+esc(subtitle)+'</p></div><button type="button" class="enroll-close" data-enroll-close aria-label="إغلاق">×</button></div>' +
      '<form class="enroll-form"><div class="enroll-body">'+body+'</div>'+
      '<div class="enroll-error" role="alert" hidden></div>'+
      '<div class="enroll-footer">'+
      (onSave ? '<button type="submit" class="btn enroll-primary">'+esc(submitText || "حفظ")+'</button>' : '')+
      '<button type="button" class="btn ghost" data-enroll-close>'+ (onSave?"إلغاء":"إغلاق") +'</button></div></form></section>';
    overlay.addEventListener("click", function (event) {
      if (event.target === overlay || event.target.closest("[data-enroll-close]")) close();
    });
    var form = overlay.querySelector("form");
    if (onSave) {
      form.addEventListener("submit", async function (event) {
        event.preventDefault();
        if (!form.reportValidity()) return;
        var error = overlay.querySelector(".enroll-error");
        error.hidden = true;
        var submit = form.querySelector('button[type="submit"]');
        submit.disabled = true;
        var old = submit.textContent;
        submit.textContent = "جارٍ الحفظ…";
        try {
          await onSave(form);
        } catch (exception) {
          error.textContent = exception && exception.message ? exception.message : "تعذر حفظ البيانات. حاول مرة أخرى.";
          error.hidden = false;
        } finally {
          if (overlay.isConnected) {
            submit.disabled = false;
            submit.textContent = old;
          }
        }
      });
    }
    document.body.appendChild(overlay);
    document.body.style.overflow = "hidden";
    activeDialog = overlay;
    document.addEventListener("keydown", escapeClose);
    var first = overlay.querySelector('input:not([type="hidden"]):not([type="radio"]),select,textarea,button');
    if (first) first.focus();
    return overlay;
  }
  async function refresh() {
    var a = app();
    a.S.data = await a.API.loadAll();
    a.refresh();
  }
  function genderChoices(current) {
    return '<div class="enroll-field"><span class="enroll-label">الفصل مخصص لمن؟</span><div class="enroll-choice-row">' +
      ["m","f"].map(function (v) {
        return '<label class="enroll-choice"><input type="radio" name="gender" value="'+v+'" '+
          (current === v ? "checked " : "")+'required><span>'+labels[v]+'</span></label>';
      }).join("")+'</div></div>';
  }
  function classForm(classId) {
    var current = classId && classes().find(function (cl) { return cl.id === classId; });
    if (classId && !current) return showToast("الفصل غير موجود.");
    var me = currentUser(), editing = !!current, admin = me.role === "admin";
    var chosenTeacher = current ? current.teacher_id : me.id;
    var teacherField = admin ? '<div class="enroll-field"><label for="enroll-teacher">المعلم المسؤول</label><select id="enroll-teacher" name="teacherId" class="inp" required>'+
        teachers().map(function (p) {return '<option value="'+esc(p.id)+'" '+(chosenTeacher===p.id?"selected":"")+'>'+esc(p.full_name||p.email||"معلم")+'</option>';}).join("")+'</select></div>' : "";
    modal(editing?"تعديل الفصل":"إضافة فصل جديد",
      editing?"تعديل بيانات الفصل دون المساس بالطلاب أو نتائجهم.":"أدخل بيانات الفصل، ثم يمكنك إضافة طلابه وتكليفهم بالأنشطة.",
      '<div class="enroll-field"><label for="enroll-classname">اسم الفصل</label>'+
      '<input class="inp" id="enroll-classname" name="className" maxlength="100" required autocomplete="off" placeholder="مثال: العربية للمبتدئين — A1" value="'+esc(current ? current.name : "")+'">'+
      '<small>اختر اسمًا واضحًا يميز الفصل عن غيره.</small></div>'+
      genderChoices(current ? current.gender : me.gender || "m")+teacherField+
      '<div class="enroll-tip">يمكنك تغيير اسم الفصل أو المعلم لاحقًا من صفحة تفاصيل الفصل.</div>',
      editing?"حفظ التعديلات":"إنشاء الفصل",
      async function (form) {
        var data = new FormData(form);
        var name = String(data.get("className")||"").trim().replace(/\s+/g," ");
        var gender = String(data.get("gender")||"");
        var teacherId = admin ? String(data.get("teacherId")||"") : me.id;
        if (name.length < 2) throw new Error("اسم الفصل يجب أن يحتوي حرفين على الأقل.");
        if (gender !== "m" && gender !== "f") throw new Error("حدد نوع الفصل.");
        if (!teachers().some(function(p){return p.id===teacherId;})) throw new Error("المعلم غير متاح.");
        if (classes().some(function(cl){return cl.id!==classId && cl.teacher_id===teacherId &&
           cl.name.trim().toLocaleLowerCase()===name.toLocaleLowerCase();})) {
          throw new Error("يوجد فصل آخر بنفس الاسم لدى هذا المعلم.");
        }
        var payload = {name:name,gender:gender};
        if (admin) payload.teacher_id = teacherId;
        if (editing) await api().updateClass(current.id,payload);
        else await api().createClass(payload);
        await refresh();
        close();
        showToast(editing?"تم تحديث بيانات الفصل.":"تم إنشاء الفصل.");
      });
  }
  function password() {
    if (!window.crypto || typeof window.crypto.getRandomValues !== "function") {
      throw new Error("المتصفح لا يتيح توليد كلمة مرور آمنة.");
    }
    var alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789";
    var values = new Uint32Array(12);
    window.crypto.getRandomValues(values);
    var text = Array.from(values,function(v){return alphabet[v % alphabet.length];}).join("");
    return text + "7Aa";
  }
  function parseLines(lines, allowWithoutAccount) {
    var results = [], errors = [];
    var used = new Set();
    String(lines).split(/\r?\n/).forEach(function (line, index) {
      if (!line.trim()) return;
      var pieces = line.split(/[|،,\t]/).map(function (s){return s.trim();}).filter(Boolean);
      var email = pieces.find(function(p){return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(p);}) || "";
      var name = pieces.filter(function(p){return p!==email;}).join(" ").trim();
      if (!name || name.length < 2 || (pieces.some(function(p){return p.includes("@") && p!==email;}))) {
        errors.push("السطر " + (index+1) + ": اكتب اسمًا وبريدًا صحيحًا.");
      } else if (!email && !allowWithoutAccount) {
        errors.push("السطر " + (index+1) + ": لا يوجد بريد إلكتروني.");
      } else if (email && used.has(email.toLowerCase())) {
        errors.push("السطر " + (index+1) + ": البريد مكرر.");
      } else {
        if (email) used.add(email.toLowerCase());
        results.push({name:name,email:email.toLowerCase()});
      }
    });
    if (errors.length) throw new Error(errors.slice(0,4).join(" | "));
    if (!results.length) throw new Error("أدخل بيانات طالب واحد على الأقل.");
    if (results.length > 30) throw new Error("يمكن إضافة 30 طالبًا في المرة الواحدة.");
    return results;
  }
  async function addOne(classId, row) {
    if (!row.email) {
      await api().addStudentsNoAccount(classId,[row.name]);
      return {name:row.name,email:"",password:"",status:"مضاف دون حساب دخول"};
    }
    var pw = password();
    var userId = await api().createAccount(row.email,pw);
    await api().attachStudent(userId,classId,row.name,row.email,null);
    return {name:row.name,email:row.email,password:pw,status:"أُنشئ حساب"};
  }
  function resultDialog(results) {
    var ok = results.filter(function(r){return !r.error;}).length;
    var body = '<div class="enroll-tip">أُضيف '+ok+' من '+results.length+' طالب. احتفظ بكلمات المرور الآن، فقد لا يمكن عرضها مرة أخرى.'+
      '<p style="margin-top:5px">قد يُطلب من الطالب تأكيد بريده الإلكتروني، حسب إعدادات تسجيل الدخول.</p></div>'+
      '<div class="enroll-results">'+results.map(function(r){
        return '<div class="enroll-result"><strong>'+esc(r.name)+'</strong><span class="enroll-status '+(r.error?"bad":"good")+'">'+esc(r.error||r.status)+'</span>'+
          (r.email?'<small dir="ltr">'+esc(r.email)+'</small>':'')+
          (r.password?'<code dir="ltr">'+esc(r.password)+'</code>':'')+'</div>';
      }).join("")+'</div>' +
      '<button type="button" class="btn ghost enroll-copy" data-enroll-copy>نسخ بيانات الدخول</button>';
    var overlay = modal("نتيجة إضافة الطلاب","راجع الطلاب الذين أضيفوا بنجاح وأي أخطاء ظهرت.",body,null,null);
    overlay.querySelector("[data-enroll-copy]").addEventListener("click",function(){
      var lines = results.map(function(r){
        return [r.name,r.email||"بدون بريد",r.password||"",r.error||r.status].join(" | ");
      }).join("\n");
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(lines).then(function(){showToast("نُسخت بيانات الطلاب.");})
          .catch(function(){window.prompt("انسخ البيانات:",lines);});
      } else window.prompt("انسخ البيانات:",lines);
    });
  }
  function studentsForm(classId) {
    var cl = classes().find(function(c){return c.id===classId;});
    if (!cl) { showToast("اختر فصلًا صالحًا أولًا."); return; }
    var html =
      '<div class="enroll-mode" role="tablist" aria-label="طريقة إضافة الطلاب">'+
      '<button type="button" class="enroll-mode-btn active" data-enroll-mode="single">طالب واحد</button>'+
      '<button type="button" class="enroll-mode-btn" data-enroll-mode="bulk">مجموعة طلاب</button></div>'+
      '<div data-enroll-panel="single">'+
      '<div class="enroll-field"><label for="enroll-student-name">اسم الطالب</label><input id="enroll-student-name" name="studentName" class="inp" autocomplete="off" required maxlength="140" placeholder="الاسم الكامل للطالب"></div>'+
      '<div class="enroll-field"><span class="enroll-label">هل يحتاج الطالب للدخول إلى المنصة؟</span><div class="enroll-choice-row">'+
      '<label class="enroll-choice"><input type="radio" name="loginMode" value="account" checked><span>نعم، أنشئ حسابًا</span></label>'+
      '<label class="enroll-choice"><input type="radio" name="loginMode" value="no-account"><span>لا، بيانات فقط</span></label></div></div>'+
      '<div class="enroll-field" data-enroll-email><label for="enroll-student-email">البريد الإلكتروني للطالب</label>'+
      '<input type="email" id="enroll-student-email" name="studentEmail" class="inp" dir="ltr" required placeholder="student@example.com"><small>يُستخدم لتسجيل الدخول إلى حساب الطالب.</small></div>'+
      '<div class="enroll-tip" data-enroll-no-account hidden>سيظهر الطالب في سجلات الفصل، لكنه لن يتمكن من دخول المنصة أو فتح الواجبات المسندة إلا بعد إنشاء حساب وربطه به.</div>'+
      '</div>'+
      '<div data-enroll-panel="bulk" hidden>'+
      '<div class="enroll-field"><label for="enroll-bulk">قائمة الطلاب</label>'+
      '<textarea class="inp enroll-multi" id="enroll-bulk" name="bulkLines" placeholder="مريم علييفا | maryam@example.com&#10;يوسف كريموف | yusuf@example.com"></textarea>'+
      '<small>كل طالب في سطر مستقل: الاسم | البريد الإلكتروني. الحد الأقصى 30 طالبًا.</small></div>'+
      '<label class="enroll-check"><input type="checkbox" name="allowWithoutAccount"> حفظ الطلاب الذين ليس لهم بريد دون حساب دخول</label>'+
      '<div class="enroll-tip">لن يستطيع أي طالب بلا حساب الدخول إلى المنصة قبل إنشاء حساب وربطه ببياناته.</div></div>';
    var overlay = modal("إضافة الطلاب", "الفصل: "+cl.name, html,"إضافة الطالب",async function(form){
      var data=new FormData(form), mode=overlay.dataset.enrollCurrentMode || "single", rows;
      if(mode==="single"){
        var name=String(data.get("studentName")||"").trim().replace(/\s+/g," ");
        if(name.length<2) throw new Error("اكتب اسم الطالب كاملًا.");
        var email= data.get("loginMode")==="account" ? String(data.get("studentEmail")||"").trim().toLowerCase():"";
        if (data.get("loginMode")==="account" && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
          throw new Error("اكتب بريد الطالب الإلكتروني بصورة صحيحة.");
        }
        rows=[{name:name,email:email}];
      }else{
        rows=parseLines(data.get("bulkLines"),data.get("allowWithoutAccount")==="on");
      }
      var results=[];
      for(var j=0;j<rows.length;j++){
        try { results.push(await addOne(classId,rows[j])); }
        catch(err){results.push({name:rows[j].name,email:rows[j].email,error:err.message||"تعذر الإضافة"});}
      }
      await refresh();
      resultDialog(results);
    });
    overlay.dataset.enrollCurrentMode="single";
    function syncMode(mode) {
      overlay.dataset.enrollCurrentMode=mode;
      overlay.querySelectorAll("[data-enroll-mode]").forEach(function(b){
        b.classList.toggle("active",b.dataset.enrollMode===mode);
      });
      overlay.querySelector('[data-enroll-panel="single"]').hidden=mode!=="single";
      overlay.querySelector('[data-enroll-panel="bulk"]').hidden=mode!=="bulk";
      overlay.querySelector("#enroll-student-name").required=mode==="single";
      overlay.querySelector("#enroll-bulk").required=mode==="bulk";
      overlay.querySelector('button[type="submit"]').textContent=mode==="single"?"إضافة الطالب":"إضافة الطلاب";
      syncLogin();
    }
    function syncLogin(){
      var account=overlay.querySelector('input[name="loginMode"]:checked').value==="account";
      var single=overlay.dataset.enrollCurrentMode==="single";
      overlay.querySelector("[data-enroll-email]").hidden=!account;
      overlay.querySelector("[data-enroll-no-account]").hidden=account;
      overlay.querySelector("#enroll-student-email").required=account&&single;
    }
    overlay.addEventListener("click",function(event){
      var t=event.target.closest("[data-enroll-mode]");
      if(t)syncMode(t.dataset.enrollMode);
    });
    overlay.addEventListener("change",function(event){
      if(event.target.name==="loginMode")syncLogin();
    });
  }

  function quickAddStudent() {
    if (!classes().length) {
      showToast("أنشئ فصلًا أولًا قبل إضافة الطلاب.");
      window.location.hash="#/classes";
      return;
    }
    if(classes().length===1){studentsForm(classes()[0].id);return;}
    var options=classes().map(function(cl){
      return '<option value="'+esc(cl.id)+'">'+esc(cl.name)+'</option>';
    }).join("");
    modal("اختيار الفصل","حدد الفصل الذي سيلتحق به الطالب.",
      '<div class="enroll-field"><label for="enroll-quick-class">الفصل</label><select class="inp" name="classId" id="enroll-quick-class" required>'+options+'</select></div>',
      "متابعة",async function(form){studentsForm(String(new FormData(form).get("classId")));});
  }
  function showStudentQuickAction() {
    if(!staff() || window.location.hash.split("?")[0]!=="#/students")return;
    var parent=document.querySelector(".main .wrap .ph .actions");
    if(!parent || parent.querySelector("[data-enroll-quick]"))return;
    var add=document.createElement("button");
    add.type="button";
    add.className="btn";
    add.dataset.enrollQuick="true";
    add.textContent="إضافة طالب";
    parent.insertBefore(add,parent.firstChild);
  }
  document.addEventListener("click",function(event){
    var quick=event.target.closest&&event.target.closest("[data-enroll-quick]");
    if(!quick || !staff())return;
    event.preventDefault();
    event.stopImmediatePropagation();
    quickAddStudent();
  },true);
  if(typeof window.MutationObserver==="function"){
    var root=document.getElementById("app");
    if(root)new window.MutationObserver(showStudentQuickAction).observe(root,{childList:true,subtree:true});
  }
  window.addEventListener("hashchange",showStudentQuickAction);
  showStudentQuickAction();

  document.addEventListener("click",function(event){
    if (!staff()) return;
    var btn=event.target.closest && event.target.closest("[data-act]");
    if(!btn) return;
    var action=btn.dataset.act;
    if(action!=="newClass" && action!=="editClass" && action!=="addStudents")return;
    event.preventDefault();
    event.stopImmediatePropagation();
    if(action==="newClass")classForm(null);
    else if(action==="editClass")classForm(btn.dataset.id);
    else studentsForm(btn.dataset.id);
  },true);
  window.NahwEnrollmentUI = Object.freeze({close:close});
}(window, document));
