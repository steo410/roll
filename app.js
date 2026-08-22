(() => {
  const canvas = document.getElementById('timeline');
  const ctx = canvas.getContext('2d');

  const UI = {
    playBtn: document.getElementById('playBtn'),
    stopBtn: document.getElementById('stopBtn'),
    bpmInput: document.getElementById('bpmInput'),
    snapSelect: document.getElementById('snapSelect'),
    viewMode: document.getElementById('viewMode'),
    addTextBtn: document.getElementById('addTextBtn'),
    saveBtn: document.getElementById('saveBtn'),
    loadInput: document.getElementById('loadInput'),
    emptyInspector: document.getElementById('emptyInspector'),
    inspectorForm: document.getElementById('inspectorForm'),
    textInput: document.getElementById('textInput'),
    trackSelect: document.getElementById('trackSelect'),
    velocityInput: document.getElementById('velocityInput'),
    velocityValue: document.getElementById('velocityValue'),
    densityInput: document.getElementById('densityInput'),
    densityValue: document.getElementById('densityValue'),
    fontWeightInput: document.getElementById('fontWeightInput'),
    octaveInput: document.getElementById('octaveInput'),
    startMetric: document.getElementById('startMetric'),
    lengthMetric: document.getElementById('lengthMetric'),
    lowMetric: document.getElementById('lowMetric'),
    highMetric: document.getElementById('highMetric'),
    deleteBtn: document.getElementById('deleteBtn'),
    trackList: document.getElementById('trackList'),
    addTrackBtn: document.getElementById('addTrackBtn'),
  };

  const COLORS = ['#7c9cff', '#4fd1c5', '#ffb86b', '#c084fc', '#ff7aa2', '#8bd17c'];
  const TOP = 38;
  const LABEL_W = 105;
  const PX_PER_BEAT = 48;
  const TRACK_H = 170;
  const TOTAL_BEATS = 32;
  const PITCH_ROWS = 24;
  const HANDLE = 8;

  const MAJOR_SCALE = [0, 2, 4, 5, 7, 9, 11];
  const PENTATONIC_SCALE = [0, 2, 4, 7, 9];

  let tracks = [
    { id: crypto.randomUUID(), name: 'Piano', type: 'piano', color: COLORS[0] },
    { id: crypto.randomUUID(), name: 'Guitar', type: 'guitar', color: COLORS[1] },
    { id: crypto.randomUUID(), name: 'Bass', type: 'bass', color: COLORS[2] },
    { id: crypto.randomUUID(), name: 'Drums', type: 'drums', color: COLORS[3] },
  ];

  let blocks = [
    { id: crypto.randomUUID(), text: 'MUSIC', track: 0, x: 4.2, y: 0.15, w: 6.2, h: 0.72, velocity: .8, density: .72, weight: 600, octave: 0 },
    { id: crypto.randomUUID(), text: 'BEAT', track: 3, x: 12.0, y: 0.12, w: 5.0, h: 0.76, velocity: .84, density: .68, weight: 800, octave: 0 },
  ];

  let selectedId = blocks[0].id;
  let hoverId = null;
  let interaction = null;
  let addMode = false;
  let playheadBeat = 0;
  let isPlaying = false;
  let rafId = null;
  let startedAt = 0;
  let audioCtx = null;
  let masterBus = null;
  let scheduledNodes = [];

  function selectedBlock() { return blocks.find(b => b.id === selectedId) || null; }
  function trackY(index) { return TOP + index * TRACK_H; }
  function beatToX(beat) { return LABEL_W + beat * PX_PER_BEAT; }
  function xToBeat(x) { return (x - LABEL_W) / PX_PER_BEAT; }
  function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }
  function snapBeat(v) {
    const s = parseFloat(UI.snapSelect.value);
    if (!s) return v;
    return Math.round(v / s) * s;
  }

  function resizeCanvas() {
    const dpr = window.devicePixelRatio || 1;
    const logicalW = LABEL_W + TOTAL_BEATS * PX_PER_BEAT;
    const logicalH = TOP + tracks.length * TRACK_H;
    canvas.style.width = logicalW + 'px';
    canvas.style.height = logicalH + 'px';
    canvas.width = Math.floor(logicalW * dpr);
    canvas.height = Math.floor(logicalH * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    draw();
  }

  function roundedRect(c, x, y, w, h, r) {
    r = Math.min(r, w / 2, h / 2);
    c.beginPath();
    c.moveTo(x+r, y);
    c.arcTo(x+w, y, x+w, y+h, r);
    c.arcTo(x+w, y+h, x, y+h, r);
    c.arcTo(x, y+h, x, y, r);
    c.arcTo(x, y, x+w, y, r);
    c.closePath();
  }

  function draw() {
    const w = parseFloat(canvas.style.width);
    const h = parseFloat(canvas.style.height);
    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = '#090e1b';
    ctx.fillRect(0, 0, w, h);

    ctx.fillStyle = '#0c1324';
    ctx.fillRect(0, 0, w, TOP);
    ctx.strokeStyle = '#27314b';
    ctx.beginPath(); ctx.moveTo(0, TOP-.5); ctx.lineTo(w, TOP-.5); ctx.stroke();

    for (let beat = 0; beat <= TOTAL_BEATS; beat++) {
      const x = beatToX(beat);
      const strong = beat % 4 === 0;
      ctx.strokeStyle = strong ? '#3a4561' : '#202943';
      ctx.lineWidth = strong ? 1.2 : 1;
      ctx.beginPath(); ctx.moveTo(x+.5, 0); ctx.lineTo(x+.5, h); ctx.stroke();
      if (strong && beat < TOTAL_BEATS) {
        ctx.fillStyle = '#9ba6bf';
        ctx.font = '11px system-ui';
        ctx.fillText(String(beat / 4 + 1), x + 5, 15);
      }
    }

    tracks.forEach((t, i) => {
      const y = trackY(i);
      ctx.fillStyle = i % 2 === 0 ? '#0c1221' : '#0a101d';
      ctx.fillRect(0, y, w, TRACK_H);
      ctx.fillStyle = '#11192b';
      ctx.fillRect(0, y, LABEL_W, TRACK_H);
      ctx.strokeStyle = '#2a3450';
      ctx.beginPath(); ctx.moveTo(0, y+.5); ctx.lineTo(w, y+.5); ctx.stroke();

      ctx.fillStyle = t.color;
      ctx.fillRect(0, y, 4, TRACK_H);
      ctx.fillStyle = '#e6ebf5';
      ctx.font = '700 13px system-ui';
      ctx.fillText(t.name, 14, y + 25);
      ctx.fillStyle = '#7f8aa4';
      ctx.font = '10px system-ui';
      ctx.fillText(t.type.toUpperCase(), 14, y + 42);

      const rowH = TRACK_H / PITCH_ROWS;
      for (let r = 1; r < PITCH_ROWS; r++) {
        const yy = y + r * rowH;
        ctx.strokeStyle = r % 7 === 0 ? '#29334e' : '#151d31';
        ctx.lineWidth = r % 7 === 0 ? 1.2 : 1;
        ctx.beginPath(); ctx.moveTo(LABEL_W, yy+.5); ctx.lineTo(w, yy+.5); ctx.stroke();
      }
    });

    blocks.forEach(drawBlock);

    if (isPlaying) {
      const px = beatToX(playheadBeat);
      ctx.strokeStyle = '#f4f7ff';
      ctx.lineWidth = 1.4;
      ctx.beginPath(); ctx.moveTo(px, 0); ctx.lineTo(px, h); ctx.stroke();
      ctx.fillStyle = '#f4f7ff';
      ctx.beginPath(); ctx.moveTo(px-4, 0); ctx.lineTo(px+4, 0); ctx.lineTo(px, 7); ctx.closePath(); ctx.fill();
    }

    if (addMode) {
      ctx.fillStyle = 'rgba(124,156,255,.12)';
      ctx.fillRect(LABEL_W, TOP, w-LABEL_W, h-TOP);
      ctx.fillStyle = '#aebcff';
      ctx.font = '12px system-ui';
      ctx.fillText('트랙의 원하는 위치를 클릭하세요', LABEL_W+16, TOP+20);
    }
  }

  function drawBlock(b) {
    const t = tracks[b.track];
    if (!t) return;
    const y0 = trackY(b.track);
    const bx = beatToX(b.x);
    const by = y0 + b.y * TRACK_H;
    const bw = b.w * PX_PER_BEAT;
    const bh = b.h * TRACK_H;
    const selected = b.id === selectedId;
    const hovered = b.id === hoverId;
    const mode = UI.viewMode.value;

    if (mode === 'notes' || mode === 'both') {
      const grid = rasterBlock(b);
      const cellW = bw / grid.cols;
      const cellH = bh / grid.rows;
      ctx.fillStyle = hexToRgba(t.color, selected ? .86 : .62);
      for (const cell of grid.cells) {
        const cx = bx + cell.c * cellW;
        const cy = by + cell.r * cellH;
        ctx.fillRect(cx + .8, cy + .8, Math.max(1.4, cellW - 1.6), Math.max(1.6, cellH - 1.6));
      }
    }

    if (mode === 'text' || mode === 'both') {
      roundedRect(ctx, bx, by, bw, bh, 7);
      ctx.fillStyle = selected ? 'rgba(124,156,255,.09)' : 'rgba(18,26,46,.16)';
      ctx.fill();
      ctx.strokeStyle = selected ? '#a9b8ff' : hovered ? '#6476ac' : 'rgba(105,120,160,.25)';
      ctx.lineWidth = selected ? 1.5 : 1;
      ctx.stroke();

      ctx.save();
      ctx.beginPath(); ctx.rect(bx+2, by+2, bw-4, bh-4); ctx.clip();
      let fontSize = Math.max(12, bh * .68);
      ctx.font = `${b.weight} ${fontSize}px Inter, Pretendard, sans-serif`;
      const textWidth = ctx.measureText(b.text).width || 1;
      if (textWidth > bw * .9) fontSize *= (bw * .9) / textWidth;
      ctx.font = `${b.weight} ${Math.max(10,fontSize)}px Inter, Pretendard, sans-serif`;
      ctx.textBaseline = 'middle';
      ctx.textAlign = 'center';
      ctx.fillStyle = mode === 'both' ? 'rgba(236,241,255,.28)' : '#e9edfa';
      ctx.fillText(b.text, bx+bw/2, by+bh/2+1);
      ctx.restore();
    }

    if (selected) drawHandles(bx, by, bw, bh);
  }

  function drawHandles(x,y,w,h) {
    const pts = handlePoints(x,y,w,h);
    ctx.fillStyle = '#eef2ff';
    ctx.strokeStyle = '#6f84d6';
    for (const p of pts) {
      ctx.fillRect(p.x-HANDLE/2, p.y-HANDLE/2, HANDLE, HANDLE);
      ctx.strokeRect(p.x-HANDLE/2+.5, p.y-HANDLE/2+.5, HANDLE-1, HANDLE-1);
    }
  }

  function handlePoints(x,y,w,h) {
    return [
      {name:'nw',x,y}, {name:'ne',x:x+w,y},
      {name:'sw',x,y:y+h}, {name:'se',x:x+w,y:y+h},
      {name:'w',x,y:y+h/2}, {name:'e',x:x+w,y:y+h/2},
      {name:'n',x:x+w/2,y}, {name:'s',x:x+w/2,y:y+h},
    ];
  }

  function blockRect(b) {
    return { x: beatToX(b.x), y: trackY(b.track) + b.y*TRACK_H, w: b.w*PX_PER_BEAT, h: b.h*TRACK_H };
  }

  function hitTest(mx,my) {
    const sb = selectedBlock();
    if (sb) {
      const r = blockRect(sb);
      for (const p of handlePoints(r.x,r.y,r.w,r.h)) {
        if (Math.abs(mx-p.x) <= 7 && Math.abs(my-p.y) <= 7) return {block:sb, handle:p.name};
      }
    }
    for (let i=blocks.length-1;i>=0;i--) {
      const b = blocks[i], r = blockRect(b);
      if (mx>=r.x && mx<=r.x+r.w && my>=r.y && my<=r.y+r.h) return {block:b, handle:null};
    }
    return null;
  }

  function pointerPos(e) {
    const rect = canvas.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  }

  canvas.addEventListener('pointerdown', e => {
    const p = pointerPos(e);
    if (addMode && p.x > LABEL_W && p.y > TOP) {
      const ti = clamp(Math.floor((p.y-TOP)/TRACK_H),0,tracks.length-1);
      const localY = (p.y-trackY(ti))/TRACK_H;
      const b = {
        id: crypto.randomUUID(), text:'TEXT', track:ti,
        x: snapBeat(clamp(xToBeat(p.x),0,TOTAL_BEATS-2)), y: clamp(localY-.18,0,.72),
        w:4, h:.36, velocity:.8, density:.7, weight:600, octave:0
      };
      blocks.push(b); selectedId = b.id; addMode=false; updateInspector(); draw();
      UI.textInput.focus(); UI.textInput.select();
      return;
    }

    const hit = hitTest(p.x,p.y);
    if (!hit) { selectedId=null; updateInspector(); draw(); return; }
    selectedId = hit.block.id;
    const b = hit.block;
    interaction = {
      mode: hit.handle ? 'resize' : 'move',
      handle: hit.handle,
      startX: p.x, startY: p.y,
      orig: {...b},
    };
    canvas.setPointerCapture(e.pointerId);
    updateInspector(); draw();
  });

  canvas.addEventListener('pointermove', e => {
    const p = pointerPos(e);
    if (!interaction) {
      const h = hitTest(p.x,p.y);
      hoverId = h?.block?.id || null;
      canvas.style.cursor = h?.handle ? cursorForHandle(h.handle) : h ? 'grab' : addMode ? 'crosshair' : 'default';
      draw();
      return;
    }
    const b = selectedBlock(); if (!b) return;
    const dxBeat = (p.x-interaction.startX)/PX_PER_BEAT;
    const dyNorm = (p.y-interaction.startY)/TRACK_H;
    const o = interaction.orig;

    if (interaction.mode === 'move') {
      b.x = clamp(snapBeat(o.x + dxBeat),0,TOTAL_BEATS-b.w);
      const centerY = p.y;
      const newTrack = clamp(Math.floor((centerY-TOP)/TRACK_H),0,tracks.length-1);
      if (newTrack !== o.track) b.track = newTrack;
      const trackOffset = trackY(b.track)-trackY(o.track);
      b.y = clamp(o.y + (p.y-interaction.startY-trackOffset)/TRACK_H,0,1-b.h);
    } else {
      const h = interaction.handle;
      let x=o.x,y=o.y,w=o.w,hh=o.h;
      if (h.includes('e')) w = clamp(o.w + dxBeat,.5,TOTAL_BEATS-o.x);
      if (h.includes('w')) { const nx = clamp(o.x + dxBeat,0,o.x+o.w-.5); w=o.w+(o.x-nx); x=nx; }
      if (h.includes('s')) hh = clamp(o.h + dyNorm,.12,1-o.y);
      if (h.includes('n')) { const ny=clamp(o.y+dyNorm,0,o.y+o.h-.12); hh=o.h+(o.y-ny); y=ny; }
      b.x=snapBeat(x); b.w=Math.max(.5,snapBeat(w)); b.y=y; b.h=hh;
    }
    updateInspector(false); draw();
  });

  canvas.addEventListener('pointerup', e => {
    interaction = null;
    try { canvas.releasePointerCapture(e.pointerId); } catch {}
    updateInspector();
  });

  canvas.addEventListener('dblclick', e => {
    const p = pointerPos(e);
    if (p.x <= LABEL_W || p.y <= TOP) return;
    const ti = clamp(Math.floor((p.y-TOP)/TRACK_H),0,tracks.length-1);
    const localY = (p.y-trackY(ti))/TRACK_H;
    const b = { id:crypto.randomUUID(), text:'TEXT', track:ti, x:snapBeat(clamp(xToBeat(p.x),0,TOTAL_BEATS-4)), y:clamp(localY-.18,0,.72), w:4, h:.36, velocity:.8, density:.7, weight:600, octave:0 };
    blocks.push(b); selectedId=b.id; updateInspector(); draw(); UI.textInput.focus(); UI.textInput.select();
  });

  function cursorForHandle(h) {
    if (h==='nw'||h==='se') return 'nwse-resize';
    if (h==='ne'||h==='sw') return 'nesw-resize';
    if (h==='w'||h==='e') return 'ew-resize';
    return 'ns-resize';
  }

  function rasterBlock(b) {
    const cols = Math.max(8, Math.min(80, Math.round(b.w * 8 * b.density)));
    const rows = Math.max(8, Math.min(36, Math.round(PITCH_ROWS * b.h * 1.1)));
    const off = document.createElement('canvas');
    off.width = cols*3; off.height = rows*3;
    const oc = off.getContext('2d');
    oc.fillStyle='#000'; oc.fillRect(0,0,off.width,off.height);
    const fontSize = off.height * .76;
    oc.font = `${b.weight} ${fontSize}px Arial, sans-serif`;
    oc.textAlign='center'; oc.textBaseline='middle';
    const tw = oc.measureText(b.text).width || 1;
    const sx = Math.min(1, (off.width*.92)/tw);
    oc.save(); oc.translate(off.width/2, off.height/2); oc.scale(sx,1); oc.fillStyle='#fff'; oc.fillText(b.text,0,0); oc.restore();
    const img = oc.getImageData(0,0,off.width,off.height).data;
    const cells=[];
    for (let r=0;r<rows;r++) for (let c=0;c<cols;c++) {
      let sum=0,count=0;
      const x0=Math.floor(c*off.width/cols), x1=Math.floor((c+1)*off.width/cols);
      const y0=Math.floor(r*off.height/rows), y1=Math.floor((r+1)*off.height/rows);
      for (let y=y0;y<y1;y+=2) for (let x=x0;x<x1;x+=2) { sum += img[(y*off.width+x)*4]; count++; }
      if (count && sum/(count*255) > .18) cells.push({c,r});
    }
    return {cols,rows,cells};
  }

  function scaleMidi(type, visualRow, octave = 0) {
    const isBass = type === 'bass';
    const scale = isBass ? PENTATONIC_SCALE : MAJOR_SCALE;
    const base = isBass ? 36 : type === 'guitar' ? 40 : 48;
    const degree = Math.max(0, Math.round(visualRow));
    const oct = Math.floor(degree / scale.length);
    const index = degree % scale.length;
    return base + scale[index] + oct * 12 + octave * 12;
  }

  function blockEvents(b) {
    const grid = rasterBlock(b);
    const t = tracks[b.track];
    const events=[];
    const byCol = new Map();
    grid.cells.forEach(cell => {
      if (!byCol.has(cell.c)) byCol.set(cell.c, []);
      byCol.get(cell.c).push(cell.r);
    });

    for (const [c, rows] of byCol.entries()) {
      const uniq = [...new Set(rows)].sort((a,b)=>a-b);
      const maxNotes = t.type==='drums' ? 2 : t.type==='bass' ? 2 : t.type==='guitar' ? 3 : 4;
      const chosen=[];
      if (uniq.length <= maxNotes) chosen.push(...uniq);
      else {
        for (let i=0;i<maxNotes;i++) chosen.push(uniq[Math.round(i*(uniq.length-1)/(maxNotes-1))]);
      }

      const usedMidi = new Set();
      for (const r of chosen) {
        const beat = b.x + (c/grid.cols)*b.w;
        const dur = Math.max(.08, (b.w/grid.cols) * .9);
        if (t.type==='drums') {
          const zone = r/grid.rows;
          const drum = zone>.68 ? 'kick' : zone>.38 ? 'snare' : zone>.17 ? 'hat' : 'clap';
          events.push({beat,dur,track:b.track,drum,vel:b.velocity});
        } else {
          const normalizedY = b.y + (r/grid.rows)*b.h;
          const visualRow = Math.round((1-normalizedY)*(PITCH_ROWS-1));
          const midi = scaleMidi(t.type, visualRow, b.octave);
          if (usedMidi.has(midi)) continue;
          usedMidi.add(midi);
          events.push({beat,dur,track:b.track,midi,vel:b.velocity});
        }
      }
    }
    return events;
  }

  function allEvents() { return blocks.flatMap(blockEvents).sort((a,b)=>a.beat-b.beat); }

  function getAudio() {
    if (!audioCtx) {
      audioCtx = new (window.AudioContext || window.webkitAudioContext)();

      const input = audioCtx.createGain();
      const compressor = audioCtx.createDynamicsCompressor();
      const output = audioCtx.createGain();

      input.gain.value = 0.82;
      compressor.threshold.value = -18;
      compressor.knee.value = 18;
      compressor.ratio.value = 4;
      compressor.attack.value = 0.003;
      compressor.release.value = 0.16;
      output.gain.value = 0.9;

      input.connect(compressor);
      compressor.connect(output);
      output.connect(audioCtx.destination);
      masterBus = input;
    }
    return audioCtx;
  }

  function destination() {
    getAudio();
    return masterBus;
  }

  function midiFreq(m) { return 440 * Math.pow(2,(m-69)/12); }

  function safeExp(param, value, time) {
    param.exponentialRampToValueAtTime(Math.max(0.0001, value), time);
  }

  function scheduleOsc(osc, when, stopAt) {
    osc.start(when);
    osc.stop(stopAt);
    scheduledNodes.push(osc);
  }

  function createNoiseBuffer(duration=.2) {
    const ac=getAudio();
    const len=Math.max(1, Math.floor(ac.sampleRate*duration));
    const b=ac.createBuffer(1,len,ac.sampleRate);
    const data=b.getChannelData(0);
    for (let i=0;i<len;i++) data[i]=(Math.random()*2-1) * (1-i/len*.18);
    return b;
  }

  function playPiano(freq, when, dur, vel) {
    const ac=getAudio();
    const filter=ac.createBiquadFilter();
    const out=ac.createGain();
    filter.type='lowpass';
    filter.frequency.setValueAtTime(Math.min(7600, Math.max(1800, freq*11)), when);
    filter.Q.value=.55;
    out.gain.setValueAtTime(.0001,when);
    out.gain.linearRampToValueAtTime(.18*vel,when+.006);
    safeExp(out.gain,.075*vel,when+.11);
    safeExp(out.gain,.0001,when+Math.max(.32,Math.min(1.8,dur+1.0)));
    filter.connect(out); out.connect(destination());

    const partials=[
      [1, 'triangle', 1, 0],
      [2, 'sine', .30, 1.5],
      [3, 'sine', .12, -2],
      [4, 'sine', .055, 3]
    ];
    const stopAt=when+Math.max(.38,Math.min(1.9,dur+1.08));
    for (const [mul,type,level,detune] of partials) {
      const o=ac.createOscillator(), g=ac.createGain();
      o.type=type; o.frequency.value=freq*mul; o.detune.value=detune;
      g.gain.value=level;
      o.connect(g); g.connect(filter);
      scheduleOsc(o,when,stopAt);
    }

    const hammer=ac.createBufferSource(), hg=ac.createGain(), hp=ac.createBiquadFilter();
    hammer.buffer=createNoiseBuffer(.025);
    hp.type='highpass'; hp.frequency.value=1800;
    hg.gain.setValueAtTime(.022*vel,when);
    safeExp(hg.gain,.0001,when+.022);
    hammer.connect(hp); hp.connect(hg); hg.connect(out);
    hammer.start(when); scheduledNodes.push(hammer);
  }

  function playGuitar(freq, when, dur, vel) {
    const ac=getAudio();
    const filter=ac.createBiquadFilter();
    const out=ac.createGain();
    filter.type='lowpass'; filter.Q.value=1.15;
    filter.frequency.setValueAtTime(Math.min(5200, Math.max(1500, freq*9)),when);
    safeExp(filter.frequency,Math.max(650,freq*2.4),when+.34);
    out.gain.setValueAtTime(.0001,when);
    out.gain.linearRampToValueAtTime(.11*vel,when+.004);
    safeExp(out.gain,.055*vel,when+.08);
    safeExp(out.gain,.0001,when+Math.max(.22,Math.min(1.2,dur+.48)));
    filter.connect(out); out.connect(destination());

    const stopAt=when+Math.max(.26,Math.min(1.28,dur+.55));
    const o1=ac.createOscillator(), g1=ac.createGain();
    o1.type='sawtooth'; o1.frequency.value=freq; o1.detune.value=-2;
    g1.gain.value=.62; o1.connect(g1); g1.connect(filter); scheduleOsc(o1,when,stopAt);
    const o2=ac.createOscillator(), g2=ac.createGain();
    o2.type='triangle'; o2.frequency.value=freq*2; o2.detune.value=2;
    g2.gain.value=.22; o2.connect(g2); g2.connect(filter); scheduleOsc(o2,when,stopAt);

    const pick=ac.createBufferSource(), pg=ac.createGain(), php=ac.createBiquadFilter();
    pick.buffer=createNoiseBuffer(.018);
    php.type='bandpass'; php.frequency.value=2800; php.Q.value=.8;
    pg.gain.setValueAtTime(.035*vel,when); safeExp(pg.gain,.0001,when+.018);
    pick.connect(php); php.connect(pg); pg.connect(out); pick.start(when); scheduledNodes.push(pick);
  }

  function playBass(freq, when, dur, vel) {
    const ac=getAudio();
    const filter=ac.createBiquadFilter();
    const out=ac.createGain();
    filter.type='lowpass'; filter.Q.value=.75;
    filter.frequency.setValueAtTime(Math.max(700,freq*7),when);
    safeExp(filter.frequency,Math.max(260,freq*2.2),when+.2);
    out.gain.setValueAtTime(.0001,when);
    out.gain.linearRampToValueAtTime(.15*vel,when+.008);
    safeExp(out.gain,.095*vel,when+.09);
    safeExp(out.gain,.0001,when+Math.max(.26,Math.min(1.0,dur+.38)));
    filter.connect(out); out.connect(destination());

    const stopAt=when+Math.max(.3,Math.min(1.05,dur+.42));
    const o1=ac.createOscillator(), g1=ac.createGain();
    o1.type='sine'; o1.frequency.value=freq; g1.gain.value=1;
    o1.connect(g1); g1.connect(filter); scheduleOsc(o1,when,stopAt);
    const o2=ac.createOscillator(), g2=ac.createGain();
    o2.type='triangle'; o2.frequency.value=freq*2; g2.gain.value=.18;
    o2.connect(g2); g2.connect(filter); scheduleOsc(o2,when,stopAt);
  }

  function playSynth(freq, when, dur, vel) {
    const ac=getAudio();
    const filter=ac.createBiquadFilter();
    const out=ac.createGain();
    filter.type='lowpass'; filter.Q.value=2.2;
    filter.frequency.setValueAtTime(Math.min(4800,Math.max(1200,freq*8)),when);
    safeExp(filter.frequency,Math.max(550,freq*2),when+.28);
    out.gain.setValueAtTime(.0001,when);
    out.gain.linearRampToValueAtTime(.08*vel,when+.02);
    safeExp(out.gain,.0001,when+Math.max(.2,Math.min(1.2,dur+.28)));
    filter.connect(out); out.connect(destination());
    const stopAt=when+Math.max(.24,Math.min(1.24,dur+.32));
    [-7,7].forEach(detune=>{
      const o=ac.createOscillator(); o.type='sawtooth'; o.frequency.value=freq; o.detune.value=detune;
      o.connect(filter); scheduleOsc(o,when,stopAt);
    });
  }

  function playTone(event, when, secPerBeat) {
    const type = tracks[event.track]?.type || 'piano';
    if (event.drum) return playDrum(event.drum, when, event.vel);
    const dur = Math.max(.055, event.dur * secPerBeat);
    const freq = midiFreq(event.midi);
    if (type==='piano') playPiano(freq,when,dur,event.vel);
    else if (type==='guitar') playGuitar(freq,when,dur,event.vel);
    else if (type==='bass') playBass(freq,when,dur,event.vel);
    else playSynth(freq,when,dur,event.vel);
  }

  function playKick(when,vel) {
    const ac=getAudio(), o=ac.createOscillator(), g=ac.createGain();
    o.type='sine';
    o.frequency.setValueAtTime(155,when); safeExp(o.frequency,47,when+.12);
    g.gain.setValueAtTime(.34*vel,when); safeExp(g.gain,.0001,when+.19);
    o.connect(g); g.connect(destination()); scheduleOsc(o,when,when+.2);
  }

  function playSnare(when,vel) {
    const ac=getAudio();
    const s=ac.createBufferSource(), ng=ac.createGain(), bp=ac.createBiquadFilter();
    s.buffer=createNoiseBuffer(.22); bp.type='bandpass'; bp.frequency.value=1800; bp.Q.value=.65;
    ng.gain.setValueAtTime(.19*vel,when); safeExp(ng.gain,.0001,when+.18);
    s.connect(bp); bp.connect(ng); ng.connect(destination()); s.start(when); scheduledNodes.push(s);

    const o=ac.createOscillator(), g=ac.createGain(); o.type='triangle'; o.frequency.value=185;
    g.gain.setValueAtTime(.10*vel,when); safeExp(g.gain,.0001,when+.11);
    o.connect(g); g.connect(destination()); scheduleOsc(o,when,when+.12);
  }

  function playHat(when,vel) {
    const ac=getAudio();
    const s=ac.createBufferSource(), g=ac.createGain(), hp=ac.createBiquadFilter();
    s.buffer=createNoiseBuffer(.07); hp.type='highpass'; hp.frequency.value=6200; hp.Q.value=.8;
    g.gain.setValueAtTime(.075*vel,when); safeExp(g.gain,.0001,when+.065);
    s.connect(hp); hp.connect(g); g.connect(destination()); s.start(when); scheduledNodes.push(s);
  }

  function playClap(when,vel) {
    const ac=getAudio();
    [0,.018,.036].forEach((offset,i)=>{
      const s=ac.createBufferSource(), g=ac.createGain(), bp=ac.createBiquadFilter();
      s.buffer=createNoiseBuffer(.07); bp.type='bandpass'; bp.frequency.value=1350; bp.Q.value=.55;
      const t=when+offset;
      g.gain.setValueAtTime((i===0?.10:.07)*vel,t); safeExp(g.gain,.0001,t+.06);
      s.connect(bp); bp.connect(g); g.connect(destination()); s.start(t); scheduledNodes.push(s);
    });
  }

  function playDrum(kind, when, vel) {
    if (kind==='kick') playKick(when,vel);
    else if (kind==='snare') playSnare(when,vel);
    else if (kind==='hat') playHat(when,vel);
    else playClap(when,vel);
  }

  async function startPlayback() {
    stopPlayback();
    const ac=getAudio(); await ac.resume();
    const bpm=clamp(parseFloat(UI.bpmInput.value)||120,40,240); UI.bpmInput.value=bpm;
    const spb=60/bpm;
    const startBeat=playheadBeat >= TOTAL_BEATS-.01 ? 0 : playheadBeat;
    playheadBeat=startBeat; isPlaying=true;
    const now=ac.currentTime+.05;
    startedAt=performance.now()-startBeat*spb*1000;
    const events=allEvents().filter(e=>e.beat>=startBeat);
    for (const ev of events) {
      const when=now+(ev.beat-startBeat)*spb;
      playTone(ev,when,spb);
    }
    const loop=()=>{
      if(!isPlaying)return;
      playheadBeat=(performance.now()-startedAt)/(spb*1000);
      if(playheadBeat>=TOTAL_BEATS){ stopPlayback(); playheadBeat=0; draw(); return; }
      draw(); rafId=requestAnimationFrame(loop);
    };
    rafId=requestAnimationFrame(loop);
  }

  function stopPlayback() {
    isPlaying=false;
    if (rafId) cancelAnimationFrame(rafId);
    scheduledNodes.forEach(n=>{ try{n.stop();}catch{} });
    scheduledNodes=[];
    draw();
  }

  function noteName(midi) {
    const names=['C','C#','D','D#','E','F','F#','G','G#','A','A#','B'];
    return names[((midi%12)+12)%12] + (Math.floor(midi/12)-1);
  }

  function updateInspector(refreshInputs=true) {
    const b=selectedBlock();
    UI.emptyInspector.classList.toggle('hidden',!!b);
    UI.inspectorForm.classList.toggle('hidden',!b);
    if (!b) return;
    if (refreshInputs) {
      UI.textInput.value=b.text;
      UI.trackSelect.value=String(b.track);
      UI.velocityInput.value=Math.round(b.velocity*100);
      UI.densityInput.value=Math.round(b.density*100);
      UI.fontWeightInput.value=String(b.weight);
      UI.octaveInput.value=String(b.octave);
    }
    UI.velocityValue.textContent=Math.round(b.velocity*100)+'%';
    UI.densityValue.textContent=Math.round(b.density*100)+'%';
    UI.startMetric.textContent=b.x.toFixed(2)+' beat';
    UI.lengthMetric.textContent=b.w.toFixed(2)+' beat';
    const t=tracks[b.track];
    if (t?.type==='drums') {
      UI.lowMetric.textContent='Kick'; UI.highMetric.textContent='Clap';
    } else {
      const lowVisual=Math.round((1-(b.y+b.h))*(PITCH_ROWS-1));
      const highVisual=Math.round((1-b.y)*(PITCH_ROWS-1));
      UI.lowMetric.textContent=noteName(scaleMidi(t?.type||'piano',lowVisual,b.octave));
      UI.highMetric.textContent=noteName(scaleMidi(t?.type||'piano',highVisual,b.octave));
    }
  }

  function rebuildTrackUI() {
    UI.trackSelect.innerHTML='';
    UI.trackList.innerHTML='';
    tracks.forEach((t,i)=>{
      const opt=document.createElement('option'); opt.value=String(i); opt.textContent=t.name; UI.trackSelect.appendChild(opt);
      const row=document.createElement('div'); row.className='track-item';
      row.innerHTML=`<div><div class="name">${escapeHtml(t.name)}</div><div class="type">${escapeHtml(t.type)}</div></div><button data-i="${i}">삭제</button>`;
      row.querySelector('button').addEventListener('click',()=>deleteTrack(i));
      UI.trackList.appendChild(row);
    });
    updateInspector(); resizeCanvas();
  }

  function deleteTrack(i) {
    if (tracks.length<=1) return alert('트랙은 최소 1개가 필요합니다.');
    const count=blocks.filter(b=>b.track===i).length;
    if (count && !confirm(`이 트랙의 글자 블록 ${count}개도 함께 삭제할까요?`)) return;
    blocks=blocks.filter(b=>b.track!==i).map(b=>({...b,track:b.track>i?b.track-1:b.track}));
    tracks.splice(i,1); selectedId=null; rebuildTrackUI();
  }

  function escapeHtml(s){ return String(s).replace(/[&<>\"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;'}[c])); }
  function hexToRgba(hex,a){ const h=hex.replace('#',''); const n=parseInt(h,16); return `rgba(${(n>>16)&255},${(n>>8)&255},${n&255},${a})`; }

  UI.playBtn.addEventListener('click',startPlayback);
  UI.stopBtn.addEventListener('click',()=>{ stopPlayback(); playheadBeat=0; draw(); });
  UI.viewMode.addEventListener('change',draw);
  UI.addTextBtn.addEventListener('click',()=>{addMode=!addMode; UI.addTextBtn.textContent=addMode?'위치 선택 중…':'＋ 글자'; draw();});
  UI.bpmInput.addEventListener('change',()=>{ if(isPlaying) startPlayback(); });

  UI.textInput.addEventListener('input',()=>{ const b=selectedBlock(); if(!b)return; b.text=UI.textInput.value||' '; draw(); });
  UI.trackSelect.addEventListener('change',()=>{ const b=selectedBlock(); if(!b)return; b.track=+UI.trackSelect.value; b.y=clamp(b.y,0,1-b.h); updateInspector(false); draw(); });
  UI.velocityInput.addEventListener('input',()=>{ const b=selectedBlock(); if(!b)return; b.velocity=+UI.velocityInput.value/100; updateInspector(false); });
  UI.densityInput.addEventListener('input',()=>{ const b=selectedBlock(); if(!b)return; b.density=+UI.densityInput.value/100; updateInspector(false); draw(); });
  UI.fontWeightInput.addEventListener('change',()=>{ const b=selectedBlock(); if(!b)return; b.weight=+UI.fontWeightInput.value; draw(); });
  UI.octaveInput.addEventListener('input',()=>{ const b=selectedBlock(); if(!b)return; b.octave=clamp(+UI.octaveInput.value||0,-3,3); updateInspector(false); draw(); });
  UI.deleteBtn.addEventListener('click',()=>{ if(!selectedId)return; blocks=blocks.filter(b=>b.id!==selectedId); selectedId=null; updateInspector(); draw(); });

  UI.addTrackBtn.addEventListener('click',()=>{
    const name=prompt('트랙 이름','Synth'); if(!name)return;
    const type=(prompt('악기 종류를 입력하세요: piano / guitar / bass / drums / synth','synth')||'synth').toLowerCase();
    tracks.push({id:crypto.randomUUID(),name,type:['piano','guitar','bass','drums','synth'].includes(type)?type:'synth',color:COLORS[tracks.length%COLORS.length]});
    rebuildTrackUI();
  });

  UI.saveBtn.addEventListener('click',()=>{
    const data={version:'0.2',bpm:+UI.bpmInput.value,tracks,blocks};
    const blob=new Blob([JSON.stringify(data,null,2)],{type:'application/json'});
    const a=document.createElement('a'); a.href=URL.createObjectURL(blob); a.download='project.textroll'; a.click(); URL.revokeObjectURL(a.href);
  });

  UI.loadInput.addEventListener('change',async()=>{
    const f=UI.loadInput.files?.[0]; if(!f)return;
    try{
      const d=JSON.parse(await f.text());
      if(!Array.isArray(d.tracks)||!Array.isArray(d.blocks)) throw new Error('형식 오류');
      tracks=d.tracks; blocks=d.blocks; UI.bpmInput.value=d.bpm||120; selectedId=blocks[0]?.id||null; rebuildTrackUI();
    }catch(err){ alert('프로젝트 파일을 읽을 수 없습니다.'); }
    UI.loadInput.value='';
  });

  window.addEventListener('keydown',e=>{
    if ((e.key==='Delete'||e.key==='Backspace') && document.activeElement.tagName!=='TEXTAREA' && document.activeElement.tagName!=='INPUT') {
      if(selectedId){ blocks=blocks.filter(b=>b.id!==selectedId); selectedId=null; updateInspector(); draw(); }
    }
    if (e.code==='Space' && !['INPUT','TEXTAREA','SELECT'].includes(document.activeElement.tagName)) {
      e.preventDefault(); isPlaying ? stopPlayback() : startPlayback();
    }
  });

  rebuildTrackUI();
})();