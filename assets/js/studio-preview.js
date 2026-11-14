/* Studio design preview bootstrap — UI-only, no data or auth access. */
(function(window,document){
  "use strict";
  if(new URLSearchParams(window.location.search).get("design")!=="studio")return;
  var root=document.documentElement;
  root.setAttribute("data-design","studio");
  var labels={
    "home":"الرئيسية","classes":"الفصول","class":"تفاصيل الفصل",
    "students":"الطلاب","student":"ملف الطالب","lessons":"الدروس",
    "lesson":"تفاصيل الدرس","accounts":"الحسابات","teachers":"المعلمون",
    "inbox":"النتائج الواردة","activity-live":"الأنشطة التفاعلية",
    "activity-demo":"تجربة الأنشطة","r":"نتائج الواجب"
  };
  function route(){
    var url=(window.location.hash||"#/").slice(1).split("?")[0].split("/").filter(Boolean);
    return url[0]||"home";
  }
  function sync(){
    var view=route();
    root.setAttribute("data-view",view);
    var main=document.querySelector("#app .shell .main");
    if(!main)return;
    var bar=main.querySelector(".vision-topbar");
    if(!bar){
      bar=document.createElement("div");
      bar.className="vision-topbar";
      bar.setAttribute("aria-label","مسار الصفحة الحالي");
      bar.innerHTML='<div class="vision-location"><span class="vision-dot" aria-hidden="true"></span>'+
        '<span>مساحة العمل</span><span aria-hidden="true">/</span><strong data-vision-page></strong></div>'+
        '<div class="vision-top-actions"><a href="#/lessons">إدارة الدروس</a>'+
        '<span class="vision-preview-tag">معاينة التصميم</span></div>';
      main.insertBefore(bar,main.firstChild);
    }
    var text=bar.querySelector("[data-vision-page]");
    if(text)text.textContent=labels[view]||"لوحة العمل";
  }
  window.addEventListener("hashchange",sync);
  var app=document.getElementById("app");
  if(app&&typeof MutationObserver==="function"){
    var observer=new MutationObserver(sync);
    observer.observe(app,{childList:true});
  }
  sync();
})(window,document);