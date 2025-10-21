/* theory.js — небольшая логика для страницы теории (theme sync + appearance) */
document.addEventListener('DOMContentLoaded', ()=>{
  const t = localStorage.getItem('conics_theme') || 'dark';
  document.body.classList.toggle('theme-light', t === 'light');
  const toggleElems = document.querySelectorAll('#themeToggle, #themeToggle2');
  toggleElems.forEach(el => { if (el) el.checked = t === 'light'; el && el.addEventListener && el.addEventListener('change', ()=> {
    const isLight = el.checked;
    document.body.classList.toggle('theme-light', isLight);
    localStorage.setItem('conics_theme', isLight ? 'light' : 'dark');
  }); });

  // small fade-in for content
  setTimeout(()=> document.body.style.opacity = 1, 60);
});