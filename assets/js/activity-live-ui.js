/* Production UI for the proposed HTML activity RPC contract.
   Fail-closed: this module is invisible until the administrator explicitly
   enables the feature AND the server confirms its capability.
   All authorization, scores and file access must be validated on the server.
*/
(function (window, document) {
  "use strict";

  var cache = {
    identity: "", phase: "idle", epoch: 0, classId: "",
    assignments: [], results: {}, notice: "", busy: false
  };
  var labels = {lesson:"درس",homework:"واجب",exam:"اختبار"};

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
    if (window.location.hash.split("?")[0] === "#/activity-live" &&
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
      if (epoch !== cache.epoch || identity !== cache.identity) return;
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

  function renderHeader() {
    return '<div class="ph"><div><h1>الأنشطة المحفوظة</h1><div class="sub">إسناد ملفات HTML، متابعة التسليمات والنتائج المرتبطة بالحسابات.</div></div>' +
      '<div class="actions"><a href="#/lessons" class="btn ghost">العودة إلى الدروس</a></div></div>';
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
  function form() {
    var options = classes().map(function(cl){
      return '<option value="' + escapeText(cl.id) + '"' +
        (cl.id === cache.classId ? ' selected' : '') + '>' +
        escapeText(cl.name) + '</option>';
    }).join("");
    return '<div class="card" style="margin-bottom:18px"><h2>إسناد نشاط HTML جديد</h2>' +
      '<p class="small muted">ترفع ملف HTML مستقلًا؛ يفحص الخادم صلاحيتك قبل حفظه أو إسناده.</p>' +
      '<div class="grid g2"><div class="field"><label for="liveClass">الفصل</label><select class="inp" id="liveClass">' +
      options + '</select></div>' +
      '<div class="field"><label for="liveKind">نوع النشاط</label><select class="inp" id="liveKind"><option value="lesson">درس</option><option value="homework">واجب</option><option value="exam">اختبار</option></select></div></div>' +
      '<div class="field"><label for="liveTitle">عنوان النشاط</label><input class="inp" id="liveTitle" maxlength="140" placeholder="اكتب عنوان الدرس أو الواجب"></div>' +
      '<div class="field"><label for="liveFile">ملف HTML</label><input class="inp" id="liveFile" type="file" accept=".html,.htm,text/html"><small>ملف واحد مكتفٍ بذاته، أقصاه ١ ميجابايت.</small></div>' +
      '<button class="btn" type="button" data-live-action="publish"' +
      (!cache.classId || cache.busy ? ' disabled' : '') +
      '>' + (cache.busy ? 'جارٍ الحفظ…' : 'حفظ وإسناد إلى الفصل') + '</button></div>';
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
      return '<div class="card" style="margin-bottom:14px"><div class="row" style="justify-content:space-between;flex-wrap:wrap;gap:12px">' +
        '<div><span class="tag">' + escapeText(kind) + '</span><h3 style="margin-top:8px">' +
        escapeText(a.title) + '</h3></div><button class="btn ghost sm" type="button" data-live-action="results" data-live-id="' +
        escapeText(aid) + '">عرض نتائج الطلاب</button></div>' + resultTable + '</div>';
    }).join("");
    var classesSelect = classes().map(function(cl){
      return '<option value="' + escapeText(cl.id) + '"' +
        (cl.id === cache.classId ? ' selected' : '') + '>' + escapeText(cl.name) + '</option>';
    }).join("");
    return '<div class="field" style="max-width:400px;margin-bottom:16px"><label for="liveFilterClass">الفصل المعروض</label>' +
      '<select id="liveFilterClass" class="inp">' + classesSelect + '</select></div>' + form() +
      '<h2 class="sec-t">التكليفات المحفوظة (' + cache.assignments.length + ')</h2>' +
      (rows || '<div class="card empty">لا توجد تكليفات محفوظة لهذا الفصل.</div>');
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
  function view() {
    syncIdentity();
    if (!enabled() || !state() || !state().me) {
      return '<div class="card empty">نظام الحفظ الرسمي لم يُفعّل بعد.</div>';
    }
    if (cache.phase === "idle") {
      cache.phase = "loading";
      Promise.resolve().then(fetchAssignments);
    }
    var body = renderHeader() + renderNotice() +
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

  async function publish() {
    if (!enabled() || !staff() || cache.busy || cache.phase !== "ready") return;
    var classValue = getInput("liveClass") && getInput("liveClass").value;
    var cl = classes().find(function(c){return c.id === classValue;});
    var kind = getInput("liveKind") && getInput("liveKind").value;
    var title = getInput("liveTitle") && getInput("liveTitle").value;
    var input = getInput("liveFile"), file = input && input.files && input.files[0];
    if (!cl) return report(new Error("الفصل غير متاح لهذا الحساب."));
    if (!Object.prototype.hasOwnProperty.call(labels, kind)) return report(new Error("نوع النشاط غير صالح."));
    if (!title || !title.trim() || title.trim().length > 140) return report(new Error("أدخل عنوانًا مناسبًا."));
    if (!file || !/\.html?$/i.test(file.name) || file.size < 1 ||
        file.size > window.EduActivityPersistence.maxHtmlBytes) {
      return report(new Error("اختر ملف HTML صالحًا بحجم لا يزيد على ١ ميجابايت."));
    }
    cache.busy = true;
    var identity = cache.identity;
    try {
      var html = await file.text();
      if (identity !== cache.identity) return;
      await api().publish({classId:cl.id,kind:kind,title:title,html:html});
      if (identity !== cache.identity) return;
      cache.notice = "حُفظ النشاط وأُسنِد إلى الفصل بعد موافقة الخادم.";
      cache.busy = false;
      invalidate();
    } catch (error) { if (identity === cache.identity) report(error); }
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
      }, {delivery:"server"});
    } catch (error) { if (identity === cache.identity) report(error); }
  }
  document.addEventListener("click", function(e){
    var button = e.target && e.target.closest && e.target.closest("[data-live-action]");
    if (!button || window.location.hash.split("?")[0] !== "#/activity-live" || !enabled()) return;
    e.preventDefault();
    e.stopPropagation();
    var act = button.dataset.liveAction;
    if (act === "publish") publish();
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
    if (!el || el.id !== "liveFilterClass" || !staff() || !enabled() ||
        window.location.hash.split("?")[0] !== "#/activity-live") return;
    if (!classes().some(function(c){return c.id === el.value;})) return;
    cache.classId = el.value;
    invalidate();
  });
  window.EduActivityLive = Object.freeze({view:view,enabled:enabled});
}(window, document));
