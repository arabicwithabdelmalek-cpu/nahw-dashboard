/* Optional, isolated preview data. Never used unless ?demo=1 is explicitly present.
   No real user accounts, passwords, grades, API calls, or Supabase writes. */
(function () {
  "use strict";
  if (!/(?:^|[?&])demo=1(?:&|$)/.test(window.location.search)) return;
  if (window.NAHW_DEMO) return;
  window.NAHW_DEMO = {
    profiles: [
      { id:"u-admin", full_name:"مدير تجريبي", email:"admin@demo.invalid", gender:"m", role:"admin" },
      { id:"u-sara", full_name:"معلمة تجريبية", email:"teacher@demo.invalid", gender:"f", role:"teacher" },
      { id:"u-st-maryam", full_name:"طالبة تجريبية", email:"student@demo.invalid", gender:"f", role:"student" }
    ],
    classes: [
      { id:"demo-class-1", name:"فصل تجريبي", teacher_id:"u-sara", gender:"f" }
    ],
    students: [
      { id:"demo-student-1", user_id:"u-st-maryam", full_name:"طالبة تجريبية", class_id:"demo-class-1", email:"student@demo.invalid", code:"DEMO1", archived:false },
      { id:"demo-student-2", user_id:null, full_name:"طالبة بلا حساب", class_id:"demo-class-1", email:"", code:"DEMO2", archived:false }
    ],
    lessons: [],
    versions: [],
    submissions: [],
    class_lessons: [],
    lesson_files: []
  };
}());
