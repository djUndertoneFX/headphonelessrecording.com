// Headphoneless landing page: the bleed-cancelling scope and the waitlist form.
(() => {
  const $ = (s) => document.querySelector(s);
  const year = $('#year'); if (year) year.textContent = new Date().getFullYear();

  // ---------- The scope ----------
  // Rose = your voice, teal = the speaker sound the mic picks up, ink = what the mic actually records (the sum).
  // "Cancel the bleed" fades the teal out of the sum, so the ink trace settles onto the voice.
  const canvas = $('#wave'), sw = $('#cancel'), cap = $('#wave-caption');
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const CAPTIONS = {
    false: 'What the mic records with your speakers on: your voice, tangled up with the backing track.',
    true: 'Bleed cancelled: the speaker sound is subtracted, and the recording is your voice on its own.',
  };
  let on = false, k = 0, t = 0, visible = true, touched = false, raf = 0;

  const css = (n) => getComputedStyle(document.documentElement).getPropertyValue(n).trim();
  // A voice: sung notes (each swells and fades, with short rests between phrases), a few harmonics and a little vibrato.
  const hash = (n) => { const v = Math.sin(n * 127.1 + 311.7) * 43758.5453; return v - Math.floor(v); };
  const voice = (x) => {
    const pos = x * 0.75, n = Math.floor(pos), u = pos - n;
    if (hash(n) < 0.22) return 0;                          // a breath
    const env = Math.sin(Math.PI * u) ** 0.7 * (0.55 + 0.45 * hash(n + 7));
    const f = 15 + 9 * hash(n + 3) + 0.6 * Math.sin(x * 5.5);
    return env * (Math.sin(x * f) + 0.4 * Math.sin(x * f * 2 + 1) + 0.15 * Math.sin(x * f * 3 + 2)) * 0.8;
  };
  // The backing track: a bass line, a kick on every beat and some hi-hat fizz.
  const bleed = (x) => {
    const beat = (x * 0.8) % 1;
    const kick = Math.exp(-beat * 9) * Math.sin(beat * 40);
    const hat = Math.exp(-((x * 1.6) % 1) * 22) * Math.sin(x * 97) * 0.35;
    return 0.55 * Math.sin(x * 2.3) + 0.25 * Math.sin(x * 4.6 + 0.5) + 0.9 * kick + hat;
  };

  function draw() {
    if (!canvas) return;
    const dpr = Math.min(2, devicePixelRatio || 1), w = canvas.clientWidth, h = canvas.clientHeight;
    if (canvas.width !== Math.round(w * dpr) || canvas.height !== Math.round(h * dpr)) { canvas.width = Math.round(w * dpr); canvas.height = Math.round(h * dpr); }
    const g = canvas.getContext('2d'); g.setTransform(dpr, 0, 0, dpr, 0, 0); g.clearRect(0, 0, w, h);
    const mid = h / 2, amp = h * 0.2, step = 2, span = 14 * Math.max(1, w / 900);
    const trace = (fn, color, width, alpha = 1) => {
      g.beginPath();
      for (let px = 0; px <= w; px += step) { const y = mid - fn(t + (px / w) * span) * amp; px ? g.lineTo(px, y) : g.moveTo(px, y); }
      g.globalAlpha = alpha; g.strokeStyle = color; g.lineWidth = width; g.lineJoin = 'round'; g.stroke(); g.globalAlpha = 1;
    };
    g.strokeStyle = css('--line'); g.lineWidth = 1; g.beginPath(); g.moveTo(0, mid); g.lineTo(w, mid); g.stroke();
    const b = 1 - k;
    if (b > 0.01) trace((x) => bleed(x) * b, css('--bleed'), 2, 0.9 * b);
    trace(voice, css('--voice'), 2.5, 0.35 + 0.65 * k);
    trace((x) => voice(x) + bleed(x) * b, css('--ink'), 1.6, 0.85 - 0.45 * k);
  }
  function frame() {
    k += ((on ? 1 : 0) - k) * (reduce ? 1 : 0.06);
    if (!reduce) t += 0.012;
    draw();
    raf = visible && !reduce ? requestAnimationFrame(frame) : 0;
  }
  function set(next) {
    on = next; sw.setAttribute('aria-checked', String(on)); cap.textContent = CAPTIONS[on];
    if (reduce) { k = on ? 1 : 0; draw(); } else if (!raf) frame();
  }
  if (canvas && sw) {
    sw.addEventListener('click', () => { touched = true; set(!on); });
    new IntersectionObserver(([e]) => { visible = e.isIntersecting; if (visible && !raf && !reduce) frame(); }).observe(canvas);
    addEventListener('resize', draw);
    matchMedia('(prefers-color-scheme: dark)').addEventListener('change', draw);
    frame();
    // One orchestrated moment: shortly after load the page flips the switch itself, once, to show the idea.
    if (!reduce) setTimeout(() => { if (!touched) set(true); }, 2600);
  }

  // ---------- Waitlist ----------
  const form = $('#form'), status = $('#status'), email = $('#email');
  if (!form) return;
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = form.querySelector('.submit');
    const data = Object.fromEntries(new FormData(form));
    status.className = 'status';
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test((data.email || '').trim())) {
      email.setAttribute('aria-invalid', 'true'); status.classList.add('err');
      status.textContent = 'Enter an email address like you@example.com.'; email.focus(); return;
    }
    email.removeAttribute('aria-invalid');
    btn.disabled = true; btn.textContent = 'Joining…';
    try {
      const r = await fetch('/api/waitlist', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(data) });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(j.error || 'The waitlist could not be reached. Try again in a moment.');
      status.textContent = j.already ? "You're already on the waitlist. We'll email you when the beta opens." : "You're on the waitlist. We'll email you when the beta opens.";
      form.reset(); btn.textContent = 'Joined';
    } catch (err) {
      status.classList.add('err');
      status.textContent = err.message === 'Failed to fetch' ? 'The waitlist could not be reached. Check your connection and try again.' : err.message;
      btn.disabled = false; btn.textContent = 'Join the waitlist';
    }
  });
})();
