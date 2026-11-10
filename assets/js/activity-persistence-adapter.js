/* Production activity API adapter, intentionally disabled until backend is audited.
   No service role, direct table access, automatic login, or implicit writes.
   RPC names are a proposed v1 CONTRACT — functions do not exist yet. */
(function (window) {
  "use strict";

  var VERSION = "1.0";
  var MAX_HTML_BYTES = 1024 * 1024;
  var RPC = Object.freeze({
    capabilities: "edu_activity_capabilities",
    publish: "edu_activity_publish",
    classAssignments: "edu_activity_class_assignments",
    myAssignments: "edu_activity_my_assignments",
    beginAttempt: "edu_activity_begin_attempt",
    submitAttempt: "edu_activity_submit_attempt",
    classResults: "edu_activity_class_results"
  });

  function requireText(text, label, maxLength) {
    if (typeof text !== "string" || !text.trim() || text.length > maxLength) {
      throw new Error("قيمة غير صالحة: " + label);
    }
    return text.trim();
  }

  function errorForBackend() {
    return new Error("حفظ الأنشطة غير مفعّل: يلزم تدقيق Supabase وتركيب دوال الخادم أولًا.");
  }

  function checkHtml(html) {
    if (typeof html !== "string" ||
        !/<!doctype\s+html\b|<html(?:\s|>)/i.test(html)) {
      throw new Error("يجب أن يكون النشاط ملف HTML مستقلًا.");
    }
    if (new Blob([html]).size > MAX_HTML_BYTES) {
      throw new Error("حجم ملف HTML أكبر من ١ ميجابايت.");
    }
    return html;
  }

  function create(client, config) {
    var enabled = !!(config && config.enabled === true);
    // Setting enabled=true is NOT an authorization control.
    // RPCs must authorize every operation using auth.uid() and secure database state.
    var functions = client && typeof client.rpc === "function" && client.auth &&
      typeof client.auth.getUser === "function";

    async function requireCapability() {
      if (!enabled) throw errorForBackend();
      if (!functions) throw new Error("عميل Supabase غير متاح.");
      var who = await client.auth.getUser();
      if (who.error) throw who.error;
      if (!who.data || !who.data.user || !who.data.user.id) {
        throw new Error("يجب تسجيل الدخول أولًا.");
      }
      var response = await client.rpc(RPC.capabilities, {});
      if (response.error) throw response.error;
      var flags = response.data;
      if (!flags || Array.isArray(flags) || flags.api_version !== VERSION ||
          flags.write_enabled !== true) {
        throw errorForBackend();
      }
      return {userId:who.data.user.id, apiVersion:VERSION};
    }

    async function call(name, args) {
      await requireCapability();
      var response = await client.rpc(name, args || {});
      if (response.error) throw response.error;
      return response.data;
    }

    function ensureIdentifier(id, field) {
      // Server still checks that this ID belongs to the authenticated user.
      return requireText(id, field, 128);
    }

    return Object.freeze({
      isEnabled: function () { return enabled; },
      apiVersion: VERSION,
      probe: async function () {
        if (!enabled) return {ready:false,reason:"disabled"};
        try {
          await requireCapability();
          return {ready:true,version:VERSION};
        } catch (error) {
          return {ready:false,reason:"unavailable",message:error.message};
        }
      },
      publish: async function (request) {
        if (!enabled) throw errorForBackend();
        request = request || {};
        var pClass = ensureIdentifier(request.classId, "معرّف الفصل");
        if (!["lesson","homework","exam"].includes(request.kind)) {
          throw new Error("نوع النشاط غير صالح.");
        }
        var pTitle = requireText(request.title, "العنوان", 140);
        var pHtml = checkHtml(request.html);
        return call(RPC.publish, {
          p_class_id:pClass,
          p_kind:request.kind,
          p_title:pTitle,
          p_html:pHtml
        });
      },
      myAssignments: function () {
        return call(RPC.myAssignments, {});
      },
      classAssignments: function (classId) {
        if (!enabled) return Promise.reject(errorForBackend());
        try { return call(RPC.classAssignments, {p_class_id:ensureIdentifier(classId,"معرّف الفصل")}); }
        catch (e) { return Promise.reject(e); }
      },
      beginAttempt: function (assignmentId) {
        if (!enabled) return Promise.reject(errorForBackend());
        try { return call(RPC.beginAttempt, {p_assignment_id:ensureIdentifier(assignmentId,"معرّف النشاط")}); }
        catch (e) { return Promise.reject(e); }
      },
      submitAttempt: function (submission) {
        if (!enabled) return Promise.reject(errorForBackend());
        try {
          submission = submission || {};
          var attemptId = ensureIdentifier(submission.attemptId,"معرّف المحاولة");
          var eventId = submission.eventId ||
            (window.crypto && typeof window.crypto.randomUUID === "function" ?
              window.crypto.randomUUID() : null);
          eventId = ensureIdentifier(eventId,"معرّف الإرسال");
          if (!["completed","result"].includes(submission.kind)) {
            throw new Error("نوع التسليم غير صالح.");
          }
          var score = null, maxScore = null;
          if (submission.kind === "result") {
            score = submission.score;
            maxScore = submission.maxScore;
            if (typeof score !== "number" || typeof maxScore !== "number" ||
                !Number.isFinite(score) || !Number.isFinite(maxScore) ||
                score < 0 || maxScore <= 0 || score > maxScore || maxScore > 1000) {
              throw new Error("الدرجة غير صالحة.");
            }
          } else if (submission.score != null || submission.maxScore != null) {
            throw new Error("الإتمام بلا درجة يجب ألا يتضمن درجة.");
          }
          return call(RPC.submitAttempt, {
            p_attempt_id:attemptId,
            p_event_id:eventId,
            p_kind:submission.kind,
            p_score:score,
            p_max_score:maxScore
          });
        } catch (e) { return Promise.reject(e); }
      },
      classResults: function (assignmentId) {
        if (!enabled) return Promise.reject(errorForBackend());
        try { return call(RPC.classResults, {p_assignment_id:ensureIdentifier(assignmentId,"معرّف النشاط")}); }
        catch (e) { return Promise.reject(e); }
      }
    });
  }

  window.EduActivityPersistence = Object.freeze({
    create:create,
    rpcNames:RPC,
    apiVersion:VERSION,
    maxHtmlBytes:MAX_HTML_BYTES
  });
}(window));
