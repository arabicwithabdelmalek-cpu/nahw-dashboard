/* Isolated HTML activity preview. No Supabase calls, no grade persistence. */
(function (window, document) {
  "use strict";

  var VERSION = "1.0";
  var MAX_BYTES = 2 * 1024 * 1024;
  var current = null;

  function newId(prefix) {
    if (window.crypto && typeof window.crypto.randomUUID === "function") {
      return prefix + window.crypto.randomUUID();
    }
    if (window.crypto && typeof window.crypto.getRandomValues === "function") {
      var bytes = new Uint8Array(16);
      window.crypto.getRandomValues(bytes);
      return prefix + Array.from(bytes, function (b) {
        return b.toString(16).padStart(2, "0");
      }).join("");
    }
    throw new Error("لا يمكن إنشاء معرّف آمن في هذا المتصفح.");
  }

  function secureDocument(html) {
    // This policy is deliberately restrictive: preview only supports self-contained HTML.
    // It does not grant network requests or any access to the parent application's origin.
    var meta = '<meta http-equiv="Content-Security-Policy" content="default-src \'none\'; script-src \'unsafe-inline\'; style-src \'unsafe-inline\'; img-src data: blob:; font-src data:; connect-src \'none\'; form-action \'none\'; base-uri \'none\'; object-src \'none\'; frame-src \'none\'; worker-src \'none\'">';
    if (/<head\b[^>]*>/i.test(html)) {
      return html.replace(/<head\b[^>]*>/i, function (tag) { return tag + meta; });
    }
    if (/<html\b[^>]*>/i.test(html)) {
      return html.replace(/<html\b[^>]*>/i, function (tag) {
        return tag + "<head>" + meta + "</head>";
      });
    }
    return "<!doctype html><html lang=\"ar\"><head>" + meta + "</head><body>" + html + "</body></html>";
  }

  function close() {
    if (!current) return;
    var instance = current;
    current = null;
    window.removeEventListener("message", instance.onMessage);
    window.removeEventListener("keydown", instance.onKeydown);
    instance.overlay.remove();
    document.body.style.overflow = instance.previousOverflow;
  }

  function openHtml(html, title, onValidatedEvent, options) {
    var serverDelivery = !!(options && options.delivery === "server");
    if (typeof html !== "string" || !/<!doctype\s+html\b|<html(?:\s|>)/i.test(html)) {
      throw new Error("يلزم ملف HTML مستقل يحتوي على صفحة كاملة.");
    }
    if (new Blob([html]).size > MAX_BYTES) {
      throw new Error("الحد الأقصى للمعاينة هو ٢ ميجابايت.");
    }
    var attemptId = newId("preview-attempt-");
    var assignmentId = newId("preview-assignment-");
    close();

    var overlay = document.createElement("div");
    overlay.className = "hwframe activity-preview";
    overlay.setAttribute("role", "dialog");
    overlay.setAttribute("aria-modal", "true");
    overlay.setAttribute("aria-label", "معاينة نشاط HTML");
    overlay.innerHTML = '<div class="hwbar"><button type="button" class="btn ghost sm" data-preview-close>إغلاق</button><strong>معاينة ملف HTML</strong><span class="small muted" data-preview-title></span><span class="activity-preview-status" data-preview-status role="status" aria-live="polite">جارٍ فتح النشاط…</span></div><div class="hwbody"></div><div class="activity-preview-note">'+(serverDelivery?"نشاط مسند: يلزم تأكيد الخادم قبل اعتبار التسليم محفوظًا.":"معاينة محلية فقط — لا تُحفظ درجات أو محاولات أو ملفات في قاعدة البيانات.")+'</div>';

    var iframe = document.createElement("iframe");
    iframe.setAttribute("title", "النشاط التفاعلي المعزول");
    iframe.setAttribute("sandbox", "allow-scripts");
    iframe.setAttribute("referrerpolicy", "no-referrer");
    var status = overlay.querySelector("[data-preview-status]");
    overlay.querySelector("[data-preview-title]").textContent = String(title || "ملف تجريبي").slice(0, 120);

    var state = { completed: false, result: false, closed: false };
    var previousOverflow = document.body.style.overflow;

    function deliver(validated) {
      if (typeof onValidatedEvent !== "function") return;
      if (!serverDelivery) {
        try { onValidatedEvent(validated); } catch (ignored) { /* preview is display-only */ }
        return;
      }
      status.textContent = "وصل التسليم. جارٍ انتظار تأكيد الحفظ من الخادم…";
      Promise.resolve().then(function () {
        return onValidatedEvent(validated);
      }).then(function () {
        if (current && current.overlay === overlay)
          status.textContent = "أكد الخادم حفظ التسليم.";
      }).catch(function () {
        if (current && current.overlay === overlay)
          status.textContent = "تعذر تأكيد الحفظ. أغلق النشاط وأعد فتحه للمحاولة.";
      });
    }

    function onMessage(event) {
      if (!current || current.overlay !== overlay || event.source !== iframe.contentWindow) return;
      // A script-only sandbox produces an opaque origin. Checking source alone
      // is not enough to authorize actual database writes; this preview never writes.
      if (event.origin !== "null") return;
      var data = event.data;
      if (!data || typeof data !== "object" || data.version !== VERSION ||
          data.attemptId !== attemptId || data.assignmentId !== assignmentId) return;
      if (data.type === "EDU_ACTIVITY_COMPLETED") {
        if (state.completed) return;
        state.completed = true;
        status.textContent = "وصل إشعار إتمام بدون درجة. لم يُحفظ شيء.";
        deliver({kind:"completed",attemptId:attemptId,assignmentId:assignmentId});
      } else if (data.type === "EDU_ACTIVITY_RESULT") {
        if (state.result) return;
        if (typeof data.score !== "number" || typeof data.maxScore !== "number" ||
            !Number.isFinite(data.score) || !Number.isFinite(data.maxScore) ||
            data.maxScore <= 0 || data.maxScore > 1000 ||
            data.score < 0 || data.score > data.maxScore) {
          status.textContent = "رُفضت نتيجة غير صالحة.";
          return;
        }
        state.result = true;
        status.textContent = "وصلت نتيجة تجريبية: " + data.score + " / " +
          data.maxScore + " — لم تُحفظ في المنصة.";
        deliver({kind:"result",attemptId:attemptId,assignmentId:assignmentId,score:data.score,maxScore:data.maxScore});
      }
    }

    function onKeydown(event) {
      if (event.key === "Escape") close();
    }

    overlay.querySelector("[data-preview-close]").addEventListener("click", close);
    var body = overlay.querySelector(".hwbody");
    iframe.addEventListener("load", function () {
      if (!current || current.overlay !== overlay) return;
      status.textContent = "النشاط جاهز. لم يُرسل إتمام أو درجة بعد.";
      iframe.contentWindow.postMessage({
        type: "EDU_PLATFORM_INIT",
        version: VERSION,
        attemptId: attemptId,
        assignmentId: assignmentId,
        context: { displayName: "متعلم تجريبي" }
      }, "*");
    });
    body.appendChild(iframe);
    document.body.appendChild(overlay);
    document.body.style.overflow = "hidden";
    current = {
      overlay: overlay,
      iframe: iframe,
      onMessage: onMessage,
      onKeydown: onKeydown,
      previousOverflow: previousOverflow
    };
    window.addEventListener("message", onMessage);
    window.addEventListener("keydown", onKeydown);
    iframe.srcdoc = secureDocument(html);
    overlay.querySelector("[data-preview-close]").focus();

    return { attemptId: attemptId, assignmentId: assignmentId };
  }

  function openFile(file) {
    if (!file) return Promise.resolve();
    if (!/\.html?$/i.test(file.name || "") || file.size <= 0 || file.size > MAX_BYTES) {
      return Promise.reject(new Error("اختر ملف HTML واحدًا صالحًا بحجم لا يزيد على ٢ ميجابايت."));
    }
    return file.text().then(function (html) {
      return openHtml(html, file.name);
    });
  }

  window.EduActivityPreview = {
    openHtml: openHtml,
    openFile: openFile,
    close: close
  };
}(window, document));
