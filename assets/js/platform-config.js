/* Platform presentation settings — no secrets or Supabase credentials. */
window.EDU_PLATFORM={
  name:"المنصة التعليمية",
  subtitle:"تعلم العربية وإدارة الفصول والدروس",
  legacyCourse:"النحو الواضح",
  activityPersistenceEnabled:false // require backend audit, RLS, backup and explicit activation
};
document.title=window.EDU_PLATFORM.name+" — إدارة التعليم";
