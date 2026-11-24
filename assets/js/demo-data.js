/* Optional, isolated preview data. Never used unless ?demo=1 is explicitly present.
   No real user accounts, passwords, grades, API calls, or Supabase writes. */
(function () {
  "use strict";
  if (!/(?:^|[?&])demo=1(?:&|$)/.test(window.location.search)) return;
  if (window.NAHW_DEMO) return;

  function isoDate(offset) {
    var date = new Date();
    date.setDate(date.getDate() + offset);
    return date.toISOString().slice(0, 10);
  }

  function isoTime(offset) {
    var date = new Date();
    date.setDate(date.getDate() + offset);
    return date.toISOString();
  }

  var demoHomework = '<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8"><style>body{font-family:Arial;padding:32px;text-align:center}</style></head><body><h1>نشاط تجريبي</h1><p>هذا النشاط مخصص لمعاينة واجهة الطالب فقط.</p></body></html>';

  window.NAHW_DEMO = {
    profiles: [
      { id:"u-admin", full_name:"مدير تجريبي", email:"admin@demo.invalid", gender:"m", role:"admin" },
      { id:"u-sara", full_name:"سَارَةُ أَحْمَدُ", email:"teacher@demo.invalid", gender:"f", role:"teacher" },
      { id:"u-st-maryam", full_name:"مَرْيَمُ عَلِيّ", email:"student@demo.invalid", gender:"f", role:"student" }
    ],
    classes: [
      { id:"demo-class-1", name:"المستوى الأول — النحو الواضح", teacher_id:"u-sara", gender:"f" }
    ],
    students: [
      { id:"demo-student-1", user_id:"u-st-maryam", full_name:"مَرْيَمُ عَلِيّ", class_id:"demo-class-1", email:"student@demo.invalid", code:"DEMO1", archived:false },
      { id:"demo-student-2", user_id:null, full_name:"طالبة بلا حساب", class_id:"demo-class-1", email:"", code:"DEMO2", archived:false }
    ],
    lessons: [
      { id:"demo-lesson-1", title:"أقسامُ الكلامِ", book_line:"الاسم والفعل والحرف", page:"12", created_at:isoTime(-7) },
      { id:"demo-lesson-2", title:"الجملةُ الاسميةُ", book_line:"المبتدأ والخبر", page:"18", created_at:isoTime(-5) },
      { id:"demo-lesson-3", title:"المبتدأُ والخبرُ", book_line:"علامات الرفع", page:"24", created_at:isoTime(-3) }
    ],
    versions: [],
    submissions: [
      { id:"demo-sub-1", lesson_id:"demo-lesson-1", fingerprint:"demo", student_id:"demo-student-1", score:88, answers:[], timeouts:"", received_at:isoTime(-2), checksum_ok:true, source:"direct" }
    ],
    class_lessons: [
      { class_id:"demo-class-1", lesson_id:"demo-lesson-1", due_at:isoDate(-1), assigned_at:isoTime(-7) },
      { class_id:"demo-class-1", lesson_id:"demo-lesson-2", due_at:isoDate(2), assigned_at:isoTime(-4) },
      { class_id:"demo-class-1", lesson_id:"demo-lesson-3", due_at:isoDate(5), assigned_at:isoTime(-2) }
    ],
    lesson_files: [
      { lesson_id:"demo-lesson-1", fingerprint:"demo", updated_at:isoTime(-7), html:demoHomework },
      { lesson_id:"demo-lesson-2", fingerprint:"demo", updated_at:isoTime(-4), html:demoHomework },
      { lesson_id:"demo-lesson-3", fingerprint:"demo", updated_at:isoTime(-2), html:demoHomework }
    ]
  };
}());
