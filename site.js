{
const SKILLS = [
  ['Front-End Engineering', ['React', 'Angular Material', 'TypeScript', 'JavaScript', 'HTML5', 'CSS', 'SASS', 'React Bootstrap', 'Node.js', 'NPM', 'AJAX', 'JSON', 'XML']],
  ['UI/UX & Design Systems', ['Figma', 'USWDS', 'UXDS', 'JSLinks', 'Wireframing', 'User journeys', 'Component-based architecture', 'Adobe Photoshop', 'Balsamiq', 'Visio', 'Pencil Project']],
  ['Accessibility', ['WCAG', 'Section 508', 'ARIA', 'Color contrast', 'Keyboard accessibility', 'Screen reader compatibility', 'Cross-browser compatibility', 'Interactive user testing']],
  ['Development & DevSecOps', ['GitHub', 'GitLab', 'CI/CD', 'Visual Studio Code', 'Unit testing', 'Code reviews', 'Browser developer tools', 'Front-end coding standards']],
  ['Cloud & Enterprise Platforms', ['AWS S3', 'AWS CloudFront', 'AWS Route 53', 'AWS Certificate Manager', 'SharePoint', 'Drupal', 'DNS', 'SSL/HTTPS']],
  ['Collaboration & Delivery', ['Agile', 'Jira', 'Confluence', 'Requirements gathering', 'Technical documentation', 'Application modernization', 'Stakeholder collaboration', 'End-user feedback']]
];
const esc = s => s.replace(/&/g, '&amp;').replace(/</g, '&lt;');
document.getElementById('skillgrid').innerHTML = SKILLS.map(([h, list]) => `<div class="skill"><h3>${esc(h)}</h3><ul class="tags">${list.map(x => `<li>${esc(x)}</li>`).join('')}</ul></div>`).join('');

// mobile menu
const nav = document.getElementById('nav'), menu = nav.querySelector('.menu');
menu.addEventListener('click', () => { const o = !nav.classList.contains('open'); nav.classList.toggle('open', o); menu.setAttribute('aria-expanded', o); });
nav.querySelectorAll('ul a').forEach(a => a.addEventListener('click', () => { nav.classList.remove('open'); menu.setAttribute('aria-expanded', 'false'); }));
addEventListener('keydown', e => { if (e.key === 'Escape' && nav.classList.contains('open')) { nav.classList.remove('open'); menu.setAttribute('aria-expanded', 'false'); menu.focus(); } });

// scroll + motion state shared with the scene
const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
let saved = null; try { saved = localStorage.getItem('jlb-motion'); } catch (e) {}
const orbit = { target: 0, paused: saved ? saved === 'off' : reduce };
const read = () => { const max = document.documentElement.scrollHeight - innerHeight; orbit.target = max > 0 ? Math.min(1, Math.max(0, scrollY / max)) : 0; };
addEventListener('scroll', read, { passive: true }); read();
const mb = document.getElementById('motion');
const setMotion = (p, save) => { orbit.paused = p; mb.textContent = p ? 'Play motion' : 'Pause motion'; mb.setAttribute('aria-pressed', String(p)); if (save) try { localStorage.setItem('jlb-motion', p ? 'off' : 'on'); } catch (e) {} };
mb.addEventListener('click', () => setMotion(!orbit.paused, true)); setMotion(orbit.paused, false);
window.orbit = orbit;

// email is stored encoded and only assembled in the visitor's browser
const m = document.getElementById('mail');
if (m) { const dec = s => atob(s).split('').reverse().join(''), addr = dec(m.dataset.u) + '\u0040' + dec(m.dataset.d);
  m.href = 'mailto:' + addr; document.getElementById('mailtext').textContent = addr; }
}
