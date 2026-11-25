/* Production UI for the proposed HTML activity RPC contract.
   Fail-closed: this module is invisible until the administrator explicitly
   enables the feature AND the server confirms its capability.
   All authorization, scores and file access must be validated on the server.
*/
(function (window, document) {
  "use strict";

  var cache = {
    identity: "", phase: "idle", epoch: 0, classId: "",
    assignments: [], results: {}, notice: "", busy: false, library:{folders:[],files:[]}, folderId:"", query:""
  };
  var labels = {lesson:"درس",homework:"واجب",exam:"اختبار"};

  function currentPath() {
    return window.location.hash.split("?")[0] || "#/";
  }
  function onActivityRoute() {
    return currentPath() === "#/activity-live" || currentPath() === "#/lessons";
  }

  function escapeText(x) {
    return String(x == null ? "" : x).replace(/[&<>"']/g, function(c) {
      return {"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c];
    });
  }
  function app() { return window.NahwApp; }
  function state() { return app() && app().S; }
  function api() { return app() && app().API && app().API.activities; }
  function enabled() {
    return window.EDU_PLATFORM &&
      window.EDU_PLATFORM.activityPersistenceEnabled === true &&
      api() && api().isEnabled() === true;
  }
  function currentRole() { return state() && state().me && state().me.role; }
  function staff() { return currentRole() === "admin" || currentRole() === "teacher"; }
  function classes() {
    var s = state();
    if (!staff() || !s || !s.data) return [];
    return (s.data.classes || []).filter(function(cl) {
      return currentRole() === "admin" || cl.teacher_id === s.me.id;
    });
  }
  function idOf(row) {
    return row && (row.assignment_id || row.id);
  }
  function reloadPage() {
    if (onActivityRoute() &&
        app() && typeof app().refresh === "function") app().refresh();
  }
  function syncIdentity() {
    var s = state();
    var identity = s && s.me ? s.me.id + "|" + s.me.role : "";
    if (cache.identity !== identity) {
      cache.identity = identity;
      cache.phase = "idle";
      cache.epoch++;
      cache.classId = "";
      cache.library = {folders:[],files:[]}; cache.folderId = ""; cache.query = "";
      cache.assignments = [];
      cache.results = {};
      cache.notice = "";
      cache.busy = false;
    }
    if (staff()) {
      var valid = classes();
      if (!valid.some(function(cl){return cl.id === cache.classId;})) {
        cache.classId = valid[0] && valid[0].id || "";
      }
    }
  }
  function report(error) {
    cache.notice = error && error.message ? error.message : String(error || "خطأ غير معروف.");
    cache.busy = false;
    reloadPage();
  }
  function validateResponseArray(result) {
    if (!Array.isArray(result)) throw new Error("ردّ الخادم لا يتوافق مع عقد الأنشطة.");
    return result;
  }

  async function fetchAssignments() {
    if (!enabled()) return;
    var epoch = ++cache.epoch, identity = cache.identity, classId = cache.classId;
    cache.phase = "loading";
    try {
      var readiness = await api().probe();
      if (!readiness || readiness.ready !== true) {
        throw new Error("خدمة الأنشطة لم تُفعّل في قاعدة البيانات بعد.");
      }
      var rows = staff() ? (classId ? await api().classAssignments(classId) : []) :
        await api().myAssignments();
      rows = validateResponseArray(rows);
      var library = staff() ? await api().library() : {folders:[],files:[]};
      if (epoch !== cache.epoch || identity !== cache.identity) return;
      if (!library || !Array.isArray(library.folders) || !Array.isArray(library.files)) throw new Error("تعذر قراءة مكتبة المحتوى.");
      cache.library = library;
      if(cache.folderId && !library.folders.some(function(f){return f.id===cache.folderId;})) cache.folderId="";
      cache.assignments = rows;
      cache.phase = "ready";
    } catch (error) {
      if (epoch !== cache.epoch || identity !== cache.identity) return;
      cache.phase = "error";
      cache.notice = error.message || "تعذر تحميل الأنشطة.";
    }
    reloadPage();
  }
  function invalidate() {
    cache.phase = "idle";
    cache.assignments = [];
    cache.results = {};
    cache.epoch++;
    reloadPage();
  }

  function renderHeader(embedded) {
    return '<div class="activity-hub-head"><div><span class="activity-hub-kicker">المحتوى التفاعلي</span>' +
      '<h1>' + (embedded ? 'المحتوى التعليمي' : 'الأنشطة المحفوظة') + '</h1>' +
      '<p>نظّم ملفات HTML في مجلدات، واحفظ الملف مرة واحدة، ثم أسنده إلى الفصول.</p></div>' +
      (embedded ? '<div class="activity-flow" aria-label="خطوات نشر النشاط"><span><b>١</b> ارفع</span><span><b>٢</b> أسند</span><span><b>٣</b> تابع</span></div>' :
        '<a href="#/lessons" class="btn ghost">العودة إلى المحتوى</a>') + '</div>';
  }
  function renderNotice() {
    return cache.notice ? '<div class="msg info" role="status" style="margin-bottom:14px">' +
      escapeText(cache.notice) + '</div>' : "";
  }
  function renderStatus() {
    if (cache.phase === "loading" || cache.phase === "idle") {
      return '<div class="card empty">جارٍ التحقق من الصلاحيات وتحميل التكليفات…</div>';
    }
    if (cache.phase === "error") {
      return '<div class="card empty">' + escapeText(cache.notice || "الخدمة غير متاحة") +
        '<div class="actions" style="margin-top:12px"><button class="btn ghost" type="button" data-live-action="retry">إعادة المحاولة</button></div></div>';
    }
    return "";
  }
  function folderPath(id) {
    var chain=[],seen=new Set();
    while(id && !seen.has(id)){
      seen.add(id); var f=cache.library.folders.find(function(x){return x.id===id;});
      if(!f)break; chain.unshift(f); id=f.parent_id;
    }
    return chain;
  }
  function folderName(id) {return id ? folderPath(id).map(function(f){return f.name;}).join(" / ") : "بدون مجلد";}
  function folderOptions(selected) {
    return '<option value="">بدون مجلد</option>'+cache.library.folders.map(function(f){
      return '<option value="'+escapeText(f.id)+'"'+(f.id===selected?' selected':'')+'>'+escapeText(folderName(f.id))+'</option>';
    }).join("");
  }
  function classOptions() {
    return classes().map(function(c){return '<option value="'+escapeText(c.id)+'"'+(c.id===cache.classId?' selected':'')+'>'+escapeText(c.name)+'</option>';}).join("");
  }
  function form() {
    var folder=cache.folderId, folders=cache.library.folders, files=cache.library.files, admin=currentRole()==="admin";
    var trail='<button type="button" class="content-crumb" data-live-action="folder" data-live-id="">المكتبة</button>'+folderPath(folder).map(function(f){return '<span aria-hidden="true">/</span><button type="button" class="content-crumb" data-live-action="folder" data-live-id="'+escapeText(f.id)+'">'+escapeText(f.name)+'</button>';}).join("");
    var cards=folders.filter(function(f){return (f.parent_id||"")===folder;}).map(function(f){
      var count=files.filter(function(x){return x.folder_id===f.id;}).length;
      var sub=folders.filter(function(x){return x.parent_id===f.id;}).length;
      return '<button type="button" class="content-folder" data-live-action="folder" data-live-id="'+escapeText(f.id)+'"><span class="content-folder-icon" aria-hidden="true"><svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M3 7V5a2 2 0 0 1 2-2h5l3 3h6a2 2 0 0 1 2 2v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2Z"/></svg></span><strong>'+escapeText(f.name)+'</strong><small>'+sub+' مجلد · '+count+' ملف</small><span class="content-folder-arrow" aria-hidden="true">‹</span></button>';
    }).join("");
    var fileRows=files.filter(function(f){return (f.folder_id||"")===folder;}).map(function(f){
      var assigned=cache.assignments.some(function(a){return a.lesson_id===f.id;});
      return '<article class="content-file" data-library-search="'+escapeText(String(f.title)+" "+String(labels[f.kind]||""))+'"><div class="content-file-main"><span class="content-file-icon" aria-hidden="true">HTML</span><div><b>'+escapeText(f.title)+'</b><small>'+escapeText(labels[f.kind]||"ملف HTML")+'</small></div></div><div class="content-file-actions">'+(f.can_move?'<details class="content-move"><summary class="btn ghost sm">نقل</summary><div><label>المجلد الجديد<select class="inp" data-move-folder>'+folderOptions(f.folder_id)+'</select></label><button class="btn sm" type="button" data-live-action="move-file" data-live-id="'+escapeText(f.id)+'">نقل الملف</button></div></details>':'')+'<button type="button" class="btn sm'+(assigned?' ghost':'')+'" data-live-action="assign-file" data-live-id="'+escapeText(f.id)+'"'+(!cache.classId||assigned||cache.busy?' disabled':'')+'>'+(assigned?'مسند بالفعل':'إسناد للفصل')+'</button></div></article>';
    }).join("");
    return '<section class="content-workspace"><div class="content-heading"><div><span class="content-kicker">المكتبة المركزية</span><h2>مناهجك وملفاتك</h2><p>احفظ مرة واحدة واستخدم الملف في أي فصل متاح لك.</p></div><span class="content-total">'+files.length+' ملف · '+folders.length+' مجلد</span></div><nav class="content-breadcrumb" aria-label="مسار المجلد">'+trail+'</nav><div class="content-folders">'+(cards||'<div class="content-no-folders">لا توجد مجلدات فرعية هنا.</div>')+'</div>'+
    (admin?'<details class="content-create"><summary>＋ إنشاء مجلد هنا</summary><div class="content-inline-form"><label for="libraryFolderName">اسم المجلد</label><input class="inp" id="libraryFolderName" maxlength="100" placeholder="مثال: الجزء الأول"><button class="btn" type="button" data-live-action="create-folder">إنشاء</button></div></details>':'')+
    '<details class="content-upload"><summary><span>＋ رفع ملف HTML</span><small>الحفظ في '+escapeText(folderName(folder))+'</small></summary><div class="content-upload-inner"><div class="activity-form-grid"><div class="field activity-title-field"><label for="liveTitle">عنوان المحتوى</label><input class="inp" id="liveTitle" maxlength="140" placeholder="عنوان الدرس أو الواجب"></div><div class="field"><label for="liveKind">النوع</label><select class="inp" id="liveKind"><option value="lesson">درس</option><option value="homework">واجب</option><option value="exam">اختبار</option></select></div></div><label class="activity-file" for="liveFile"><strong>اختر ملف HTML</strong><span>ملف مستقل · حتى ١ ميجابايت</span><input id="liveFile" type="file" accept=".html,.htm,text/html"></label><div class="activity-publish-actions"><button class="btn ghost" type="button" data-live-action="preview">معاينة قبل الحفظ</button><button class="btn" type="button" data-live-action="publish"'+(cache.busy?' disabled':'')+'>حفظ في المكتبة</button></div></div></details>'+
    '<div class="content-files-head"><h3>الملفات في هذا المجلد</h3><input class="inp" id="librarySearch" type="search" aria-label="بحث في ملفات المجلد" placeholder="بحث في هذا المجلد..." value="'+escapeText(cache.query)+'"></div><div class="content-class-target"><label for="libraryClass">الفصل المستهدف للإسناد</label><select class="inp" id="libraryClass">'+classOptions()+'</select>'+(!cache.classId?'<small>أنشئ فصلًا أولًا لإسناد الملفات.</small>':'')+'</div><div id="libraryFiles">'+(fileRows||'<div class="activity-empty"><b>هذا المجلد فارغ</b><span>أضف ملف HTML أو انقل ملفًا إليه.</span></div>')+'</div></section>';
  }
  function staffView() {
    var rows = cache.assignments.map(function(a){
      var aid = idOf(a);
      if (!aid || typeof aid !== "string") return "";
      var kind = labels[a.kind] || "نشاط";
      var list = cache.results[aid];
      var resultTable = list ?
        '<div class="tblwrap" style="margin-top:12px"><table class="tbl"><thead><tr><th>الطالب</th><th>التسليم</th></tr></thead><tbody>' +
        (list.map(function(r){
          var hasGrade = r.score != null && r.max_score != null;
          return '<tr><td>' + escapeText(r.student_name || "طالب") + '</td><td>' +
            (hasGrade ? escapeText(r.score) + " / " + escapeText(r.max_score) :
              escapeText(r.status === "completed" ? "مكتمل بلا درجة" : "لم يُسلّم")) +
            '</td></tr>';
        }).join("") || '<tr><td colspan="2">لا توجد نتائج بعد.</td></tr>') +
        '</tbody></table></div>' : "";
      return '<article class="activity-row"><div class="activity-row-main"><span class="tag">' + escapeText(kind) +
        '</span><div><h3>' + escapeText(a.title) + '</h3><p>مسند إلى الفصل المحدد</p></div></div>' +
        '<button class="btn ghost sm" type="button" data-live-action="results" data-live-id="' +
        escapeText(aid) + '">عرض النتائج</button>' + resultTable + '</article>';
    }).join("");
    var classesSelect = classes().map(function(cl){
      return '<option value="' + escapeText(cl.id) + '"' +
        (cl.id === cache.classId ? ' selected' : '') + '>' + escapeText(cl.name) + '</option>';
    }).join("");
    return form() + '<section class="activity-library"><div class="activity-library-head"><div><span class="activity-step-number">٢</span>' +
      '<div><h2>المحتوى المسند إلى الفصل</h2><p>' + cache.assignments.length + ' محتوى في الفصل الحالي</p></div></div>' +
      '<label for="liveFilterClass"><span>الفصل المعروض</span><select id="liveFilterClass" class="inp">' +
      classesSelect + '</select></label></div>' +
      (rows || '<div class="activity-empty"><b>لا يوجد محتوى منشور لهذا الفصل</b><span>اختر ملفًا من المكتبة وأسنده إلى الفصل.</span></div>') + '</section>';
  }
  function studentView() {
    var rows = cache.assignments.map(function(a){
      var aid = idOf(a);
      if (!aid || typeof aid !== "string") return "";
      return '<div class="card" style="margin-bottom:14px"><div class="row" style="justify-content:space-between;flex-wrap:wrap;gap:12px"><div><span class="tag">' +
        escapeText(labels[a.kind] || "نشاط") + '</span><h3 style="margin-top:8px">' + escapeText(a.title) +
        '</h3></div><button class="btn" type="button" data-live-action="start" data-live-id="' +
        escapeText(aid) + '">بدء النشاط</button></div></div>';
    }).join("");
    return '<h2 class="sec-t">أنشطتي المسندة (' + cache.assignments.length + ')</h2>' +
      (rows || '<div class="card empty">لا توجد أنشطة مسندة لحسابك حاليًا.</div>');
  }
  function view(options) {
    var embedded = !!(options && options.embedded);
    syncIdentity();
    if (!enabled() || !state() || !state().me) {
      return '<div class="card empty">نظام الحفظ الرسمي لم يُفعّل بعد.</div>';
    }
    if (cache.phase === "idle") {
      cache.phase = "loading";
      Promise.resolve().then(fetchAssignments);
    }
    var body = renderHeader(embedded) + renderNotice() +
      (cache.phase === "ready" ? (staff() ? staffView() : studentView()) : renderStatus());
    if (currentRole() === "student") {
      return '<header class="ptop"><div class="wrap ptop-in"><b>' +
        escapeText(window.EDU_PLATFORM.name) + '</b><span class="small muted">' +
        escapeText(state().me.full_name || "الطالب") +
        '</span><button class="link small" data-act="logout">خروج</button></div></header>' +
        '<main class="pmain"><div class="wrap"><div class="crumb"><a href="#/">واجباتي</a> ‹ الأنشطة المحفوظة</div>' +
        body + '</div></main>';
    }
    return body;
  }
  function getInput(id) { return document.getElementById(id); }

  async function libraryWrite(action, message) {
    if (!enabled() || !staff() || cache.busy || cache.phase!=="ready") return;
    cache.busy=true;
    var identity=cache.identity;
    try {
      await action();
      if(identity!==cache.identity)return;
      cache.notice=message; cache.busy=false; invalidate();
    } catch(error){if(identity===cache.identity) report(error);}
  }
  async function publish() {
    var kind=getInput("liveKind")&&getInput("liveKind").value;
    var title=getInput("liveTitle")&&getInput("liveTitle").value;
    var input=getInput("liveFile"), file=input&&input.files&&input.files[0], folderId=cache.folderId;
    if(!title||!title.trim())return report(new Error("أدخل عنوان المحتوى."));
    if(!file||! /\\.html?$/i.test(file.name)||file.size<1||file.size>window.EduActivityPersistence.maxHtmlBytes)return report(new Error("اختر ملف HTML صالحًا بحجم لا يزيد على ١ ميجابايت."));
    return libraryWrite(async function(){var html=await file.text(); await api().uploadLibrary({folderId:folderId,kind:kind,title:title,html:html});},"حُفظ الملف في المكتبة. يمكنك إسناده إلى أي فصل متاح.");
  }
  function applyLibrarySearch(){
    var value=cache.query.trim().toLowerCase();
    document.querySelectorAll("[data-library-search]").forEach(function(row){row.hidden=!(row.dataset.librarySearch.toLowerCase().includes(value));});
  }
  function previewSelectedFile() {
    var input = getInput("liveFile"), file = input && input.files && input.files[0];
    if (!file) return report(new Error("اختر ملف HTML أولًا ثم افتح المعاينة."));
    window.EduActivityPreview.openFile(file).catch(report);
  }
  async function showResults(assignmentId) {
    if (!staff() || cache.phase !== "ready" || !enabled()) return;
    if (!cache.assignments.some(function(a){return idOf(a)===assignmentId;})) return;
    var identity = cache.identity;
    try {
      var results = validateResponseArray(await api().classResults(assignmentId));
      if (identity !== cache.identity) return;
      cache.results[assignmentId] = results;
      reloadPage();
    } catch (error) { if (identity === cache.identity) report(error); }
  }
  async function start(assignmentId) {
    if (currentRole() !== "student" || cache.phase !== "ready" || !enabled()) return;
    if (!cache.assignments.some(function(a){return idOf(a)===assignmentId;})) return;
    var identity = cache.identity;
    try {
      var result = await api().beginAttempt(assignmentId);
      if (identity !== cache.identity) return;
      if (!result || typeof result.attempt_id !== "string" ||
          typeof result.html !== "string" || !result.html) {
        throw new Error("الخادم لم يُعِد ملف النشاط أو معرّف المحاولة.");
      }
      var delivered = false;
      window.EduActivityPreview.openHtml(result.html, result.title || "نشاط", function(event){
        if (delivered || identity !== cache.identity) return;
        delivered = true;
        // The iframe returns only an untrusted claimed result. The server must
        // validate ownership, assignment and deduplication for each attempt.
        return api().submitAttempt({
          attemptId:result.attempt_id,kind:event.kind,
          score:event.kind === "result" ? event.score : null,
          maxScore:event.kind === "result" ? event.maxScore : null
        }).then(function(){
          if (identity !== cache.identity) return;
          cache.notice = "أكد الخادم تسجيل التسليم.";
          invalidate();
        }).catch(function(error){
          delivered = false; // local preview remains open, can retry after closing/reopening
          if (identity === cache.identity) report(error);
          throw error;
        });
      }, {delivery:"server", context:{displayName:(state() && state().me && state().me.full_name) || "الطالب"}});
    } catch (error) { if (identity === cache.identity) report(error); }
  }
  document.addEventListener("click", function(e){
    var button = e.target && e.target.closest && e.target.closest("[data-live-action]");
    if (!button || !onActivityRoute() || !enabled()) return;
    e.preventDefault();
    e.stopPropagation();
    var act = button.dataset.liveAction;
    if (act === "publish") publish();
    if (act === "folder" && staff() && !cache.busy) {
      var id=button.dataset.liveId||"";
      if(!id||cache.library.folders.some(function(f){return f.id===id;})){cache.folderId=id;cache.query="";cache.notice="";reloadPage();}
    }
    if (act === "create-folder" && currentRole()==="admin") {
      var name=getInput("libraryFolderName")&&getInput("libraryFolderName").value;
      if(name&&name.trim())libraryWrite(function(){return api().createFolder(cache.folderId,name);},"أُنشئ المجلد بنجاح.");
      else report(new Error("أدخل اسم المجلد."));
    }
    if (act === "assign-file" && cache.classId && !button.disabled) {
      var fileId=button.dataset.liveId, classId=cache.classId;
      if(cache.library.files.some(function(f){return f.id===fileId;}))libraryWrite(function(){return api().assignLibrary(fileId,classId);},"تم إسناد الملف إلى الفصل دون إنشاء نسخة أخرى.");
    }
    if (act === "move-file") {
      var moveId=button.dataset.liveId, select=button.closest(".content-move").querySelector("[data-move-folder]");
      if(select&&cache.library.files.some(function(f){return f.id===moveId&&f.can_move;}))libraryWrite(function(){return api().moveLibrary(moveId,select.value);},"تم نقل الملف. الإسنادات والنتائج لم تتغير.");
    }
    if (act === "preview") previewSelectedFile();
    if (act === "start") start(button.dataset.liveId);
    if (act === "results") showResults(button.dataset.liveId);
    if (act === "retry") {
      cache.phase = "idle";
      cache.notice = "";
      cache.epoch++;
      reloadPage();
    }
  });
  document.addEventListener("change", function(e){
    var el = e.target;
    if (!el || !["liveFilterClass","libraryClass"].includes(el.id) || !staff() || !enabled() ||
        !onActivityRoute()) return;
    if (!classes().some(function(c){return c.id === el.value;})) return;
    cache.classId = el.value;
    invalidate();
  });
  document.addEventListener("input",function(e){if(e.target&&e.target.id==="librarySearch"){cache.query=e.target.value;applyLibrarySearch();}});
  function mountInsideLessons() {
    if (currentPath() !== "#/lessons" || !enabled() || !staff() ||
        typeof document.querySelector !== "function" || typeof document.createElement !== "function") return;
    var root = document.querySelector(".main .wrap");
    if (!root || root.dataset.activityHubReady === "true") return;
    root.dataset.activityHubReady = "true";

    var oldOfficialLink = root.querySelector('a[href="#/activity-live"]');
    if (oldOfficialLink && oldOfficialLink.closest(".msg")) oldOfficialLink.closest(".msg").remove();

    var hub = document.createElement("section");
    hub.className = "activity-hub";
    hub.setAttribute("aria-label", "إدارة الدروس التفاعلية");
    hub.innerHTML = view({embedded:true});

    var legacy = document.createElement("details");
    legacy.className = "legacy-lessons";
    legacy.innerHTML = '<summary><span><b>المكتبة القديمة</b><small>واجبات النحو السابقة والملفات التجريبية</small></span><span class="legacy-lessons-action">عرض</span></summary><div class="legacy-lessons-body"></div>';
    var legacyBody = legacy.querySelector(".legacy-lessons-body");
    Array.prototype.slice.call(root.childNodes).forEach(function(node){ legacyBody.appendChild(node); });
    root.appendChild(hub);
    root.appendChild(legacy);
    applyLibrarySearch();
  }

  if (typeof window.MutationObserver === "function" && typeof document.getElementById === "function") {
    var appRoot = document.getElementById("app");
    if (appRoot) new window.MutationObserver(mountInsideLessons).observe(appRoot,{childList:true,subtree:true});
  }
  if (typeof window.addEventListener === "function") {
    window.addEventListener("hashchange", function(){ Promise.resolve().then(mountInsideLessons); });
  }
  window.EduActivityLive = Object.freeze({view:view,enabled:enabled,mountInsideLessons:mountInsideLessons});
}(window, document));
