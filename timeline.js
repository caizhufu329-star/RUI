/* timeline.js — render 23 clips on the timeline, click to seek, ruler ticks */
(function () {
  'use strict';

  const ACT_CLASS = {
    '片头': 'act-card',
    '片尾': 'act-card',
    '第一幕 · 开场':    'act-1',
    '第二幕 · Demo 演示': 'act-2',
    '第三幕 · 结尾':     'act-3',
  };

  function pad(n, w) { return String(n).padStart(w, '0'); }
  function tc(sec) {
    const s = Math.max(0, sec);
    const hh = Math.floor(s / 3600);
    const mm = Math.floor((s % 3600) / 60);
    const ss = Math.floor(s % 60);
    const ms = Math.round((s - Math.floor(s)) * 1000);
    return `${pad(hh,2)}:${pad(mm,2)}:${pad(ss,2)}.${pad(ms,3)}`;
  }
  function tcShort(sec) {
    const s = Math.max(0, sec);
    const mm = Math.floor(s / 60);
    const ss = Math.floor(s % 60);
    return `${pad(mm,2)}:${pad(ss,2)}`;
  }

  function actClass(act) { return ACT_CLASS[act] || 'act-1'; }

  function pxPerSecond(totalSec) {
    // Make all clips fit the visible track width by default.
    // Track spans the window minus the left browser panel and paddings.
    const trackW = window.innerWidth - 280 - 24;  // browser col + paddings
    const pps = Math.max(0.02, trackW / Math.max(1, totalSec));
    return pps;
  }

  function buildRuler(totalSec, pps) {
    const ruler = document.getElementById('tl-ruler');
    ruler.innerHTML = '';
    // Pick a tick interval that yields ~6-12 ticks across the width.
    const candidates = [15, 30, 60, 120, 180, 300, 600];
    const targetTicks = 10;
    let step = candidates[candidates.length - 1];
    for (const c of candidates) {
      if (totalSec / c <= targetTicks) { step = c; break; }
    }
    for (let t = 0; t <= totalSec + 0.01; t += step) {
      const tick = document.createElement('div');
      tick.className = 'tl-tick';
      tick.style.left = (t * pps) + 'px';
      tick.textContent = tcShort(t);
      ruler.appendChild(tick);
    }
  }
  function buildClips(shots, pps) {
    const track = document.getElementById('tl-track');
    track.innerHTML = '';
    track.querySelectorAll('.tl-cursor').forEach(n => n.remove());

    shots.forEach((s, idx) => {
      const w = Math.max(6, s.dur * pps);
      const clip = document.createElement('div');
      clip.className = 'tl-clip ' + actClass(s.act);
      clip.style.width = w + 'px';
      clip.dataset.id = s.id;
      clip.dataset.index = idx;
      // Only show text when the clip is wide enough
      const showText = w >= 34;
      const showTc = w >= 54;
      clip.innerHTML = `
        ${showText ? `<div class="clip-id">${s.id === 'TITLE' ? '片头' : (s.id === 'END' ? '片尾' : '#' + s.id)}</div>` : ''}
        ${showText ? `<div class="clip-title">${s.title}</div>` : ''}
        ${showTc ? `<div class="clip-tc"><span>${tcShort(s.t_in)}</span><span>${s.dur.toFixed(0)}s</span></div>` : ''}
      `;
      clip.title = `${s.id} · ${s.title}\n${tcShort(s.t_in)} → ${tcShort(s.t_out)}（${s.dur}s）`;
      clip.addEventListener('click', () => {
        if (window.STATION_APP) window.STATION_APP.seekTo(s.t_in, s);
      });
      clip.addEventListener('dblclick', () => {
        if (window.STATION_APP) window.STATION_APP.seekTo(s.t_in, s);
      });
      track.appendChild(clip);
    });

    const cursor = document.createElement('div');
    cursor.id = 'tl-cursor';
    cursor.style.left = '0px';
    track.appendChild(cursor);
  }

  function setActiveShot(id) {
    document.querySelectorAll('.tl-clip').forEach(n => {
      n.classList.toggle('active', n.dataset.id === id);
    });
    document.querySelectorAll('.shot-item').forEach(n => {
      n.classList.toggle('active', n.dataset.id === id);
    });
  }

  function updateCursor(time, pps) {
    const cursor = document.getElementById('tl-cursor');
    if (!cursor) return;
    cursor.style.display = 'block';
    // Track has 12px horizontal padding; clips start there.
    cursor.style.left = (12 + time * pps) + 'px';
  }

  function render(shots) {
    const totalSec = shots[shots.length - 1].t_out;
    const pps = pxPerSecond(totalSec);
    buildRuler(totalSec, pps);
    buildClips(shots, pps);
    return pps;
  }

  // Expose
  window.STATION_TIMELINE = {
    render, setActiveShot, updateCursor, pxPerSecond, tc, tcShort,
  };
})();