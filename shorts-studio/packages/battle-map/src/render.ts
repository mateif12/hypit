import { sealVisualTrack } from "@hypit/composition";
import type { VisualElement } from "@hypit/composition";
import { htmlVisual } from "@hypit/html-program";
import type { FontStackRef } from "@hypit/media";
import type { Timeline } from "@hypit/timeline";
import type { SpatialFrame } from "@hypit/spatial";
import { assertTemporalWindowFor } from "@hypit/temporal";
import type { TemporalInstant, TemporalWindow } from "@hypit/temporal";

/** Every child of a battle-map Scene is one timed event. Attribute values stay strings until render. */
export const eventKinds = ["Unit", "Move", "Label", "Arrow", "Flash", "Camera", "Shake", "Caption", "Stat"] as const;
export type EventKind = (typeof eventKinds)[number];
export type MapEvent = { kind: EventKind; id: string; attrs: Record<string, string>; at: TemporalInstant };

export type MapOptions = {
  id: string; title: string; year: string;
  camX: number; camY: number; zoom: number; seed: number;
  /** Colours of the two sides plus terrain tint; defaults reproduce the measured reference palette. */
  red: string; dark: string; terrain: string; terrain2: string;
  captionY: number; captionSize: number;
};

const num = (attrs: Record<string, string>, name: string, fallback: number): number => {
  const raw = attrs[name];
  if (raw === undefined) return fallback;
  const value = Number(raw);
  if (!Number.isFinite(value)) throw new Error(`Attribute ${name}="${raw}" must be a number.`);
  return value;
};
const points = (raw: string | undefined, id: string): number[][] => {
  if (!raw) throw new Error(`${id} needs points="x,y x,y …".`);
  const list = raw.trim().split(/\s+/u).map(pair => pair.split(",").map(Number));
  if (list.some(p => p.length !== 2 || p.some(v => !Number.isFinite(v)))) throw new Error(`${id} has malformed points.`);
  return list;
};

const toneColour: Record<string, string> = { red: "#B94D3D", blue: "#627CB2", neutral: "#D9CFA8" };
const arrowColour: Record<string, string> = { pink: "#EFA199", blue: "#B1C4D6", white: "#F2F2F2", yellow: "#FAD306" };

/** `*word*` marks the yellow keyword of a caption. */
function captionWords(text: string) {
  return text.trim().split(/\s+/u).map(raw => {
    const key = raw.startsWith("*") && raw.endsWith("*") && raw.length > 2;
    return { word: key ? raw.slice(1, -1) : raw, key };
  });
}

/** Normalised, frame-resolved event data handed to the page. All times are local frames. */
function compile(events: readonly MapEvent[], start: number, opt: MapOptions) {
  const units: Record<string, unknown>[] = [], moves: Record<string, unknown>[] = [], labels: Record<string, unknown>[] = [];
  const arrows: Record<string, unknown>[] = [], flashes: Record<string, unknown>[] = [], cameras: Record<string, unknown>[] = [];
  const shakes: Record<string, unknown>[] = [], captions: Record<string, unknown>[] = [], stats: Record<string, unknown>[] = [];
  const unitIds = new Set<string>();
  for (const event of [...events].sort((a, b) => a.at.frame - b.at.frame)) {
    const a = event.attrs, f = event.at.frame - start;
    switch (event.kind) {
      case "Unit":
        unitIds.add(event.id);
        units.push({ id: event.id, at: f, side: a.side ?? "red", colour: a.colour ?? null, x: num(a, "x", 540), y: num(a, "y", 960),
          w: num(a, "w", 200), d: num(a, "d", 60), curve: num(a, "curve", 0), angle: num(a, "angle", 0),
          rows: num(a, "rows", 6), cols: num(a, "cols", 30), fade: num(a, "fade", 0), rout: 0, dead: 0 });
        break;
      case "Move": {
        const unit = a.unit;
        if (!unit || !unitIds.has(unit)) throw new Error(`Move ${event.id} names unknown or later unit "${unit}".`);
        const target: Record<string, number> = {};
        for (const key of ["x", "y", "w", "d", "curve", "angle", "rout", "dead"]) if (a[key] !== undefined) target[key] = num(a, key, 0);
        moves.push({ unit, at: f, dur: Math.max(1, num(a, "for", 60)), ease: a.ease ?? "inout", target,
          path: a.path ? points(a.path, event.id) : null });
        break;
      }
      case "Label":
        labels.push({ id: event.id, at: f, dur: num(a, "for", 1e9), unit: a.unit ?? null, x: num(a, "x", 540), y: num(a, "y", 960),
          dy: num(a, "dy", -70), tone: toneColour[a.tone ?? "neutral"] ?? a.tone, text: a.text ?? "" });
        break;
      case "Arrow":
        arrows.push({ at: f, draw: Math.max(1, num(a, "draw", 30)), hold: num(a, "hold", 60), retract: num(a, "retract", 20),
          colour: arrowColour[a.colour ?? "blue"] ?? a.colour, width: num(a, "width", 22), pts: points(a.points, event.id) });
        break;
      case "Flash":
        flashes.push({ at: f, pts: points(a.points, event.id), size: num(a, "size", 70) });
        break;
      case "Camera":
        cameras.push({ at: f, dur: Math.max(1, num(a, "for", 90)), x: num(a, "x", opt.camX), y: num(a, "y", opt.camY), zoom: num(a, "zoom", opt.zoom) });
        break;
      case "Shake":
        shakes.push({ at: f, dur: Math.max(1, num(a, "for", 20)), amp: num(a, "amp", 14) });
        break;
      case "Caption":
        captions.push({ id: event.id, at: f, words: captionWords(a.text ?? "") });
        break;
      case "Stat":
        stats.push({ id: event.id, at: f, number: a.number ?? "", sub: a.sub ?? "" });
        break;
    }
  }
  return { units, moves, labels, arrows, flashes, cameras, shakes, captions, stats };
}

const css = (opt: MapOptions) => `:scope{overflow:hidden;background:#1b160c}
canvas{position:absolute;inset:0;width:100%;height:100%}
.vig{position:absolute;inset:0;background:radial-gradient(120% 85% at 50% 45%,rgba(0,0,0,0) 45%,rgba(18,13,5,.72) 100%);pointer-events:none}
.title{position:absolute;left:50%;top:44px;transform:translateX(-50%);display:flex;align-items:baseline;gap:22px;padding:14px 34px 12px;
  background:rgba(14,12,9,.82);border-radius:18px;white-space:nowrap}
.title .t{color:#fff;font-size:64px;line-height:1;letter-spacing:.5px}.title .y{color:#D0C935;font-size:40px;line-height:1}
.label{position:absolute;left:0;top:0;display:flex;align-items:center;gap:12px;padding:11px 22px 10px;border-radius:12px;border:3px solid;
  background:rgba(16,14,11,.86);color:#fff;font-size:42px;line-height:1;white-space:nowrap;transform-origin:50% 100%;opacity:0}
.label i{width:16px;height:16px;border-radius:50%;display:block}
.cap{position:absolute;left:5%;right:5%;top:${(opt.captionY * 100).toFixed(2)}%;transform:translateY(-50%);display:none;flex-wrap:wrap;justify-content:center;
  column-gap:.22em;font-size:${opt.captionSize}px;line-height:1.02;text-align:center}
.cap span{color:#fff;-webkit-text-stroke:.085em #000;paint-order:stroke fill;text-shadow:0 .05em 0 #000,0 .08em .16em rgba(0,0,0,.6);text-transform:uppercase}
.cap span.k{color:#FAD306}
.stat{position:absolute;left:0;right:0;top:170px;text-align:center;opacity:0}
.stat .n{display:block;color:#fff;font-size:210px;line-height:1;-webkit-text-stroke:.05em #000;paint-order:stroke fill;text-shadow:0 8px 24px rgba(0,0,0,.55)}
.stat .s{display:inline-block;margin-top:18px;color:#EB958C;font-size:46px;line-height:1.1;text-shadow:0 3px 10px rgba(0,0,0,.8)}`;

/* The page program: pure function of the local frame, so any frame renders directly (ranges, workers, scrubbing). */
const setup = String.raw`
const W=data.width,H=data.height,P=data.plan,opt=data.opt;
const cv=root.querySelector('canvas');cv.width=W;cv.height=H;const g=cv.getContext('2d');
const rnd=(s=>()=>{s|=0;s=s+0x6D2B79F5|0;let t=Math.imul(s^s>>>15,1|s);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296;})(opt.seed);
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v)), lerp=(a,b,t)=>a+(b-a)*t;
const ease={inout:t=>t<.5?4*t*t*t:1-Math.pow(-2*t+2,3)/2,out:t=>1-Math.pow(1-t,3),in:t=>t*t*t,linear:t=>t};
// Terrain: drawn once into an oversized world texture.
const TX=-700,TY=-900,TW=W+1400,TH=H+1800,tex=document.createElement('canvas');tex.width=TW;tex.height=TH;const t=tex.getContext('2d');
t.fillStyle=opt.terrain;t.fillRect(0,0,TW,TH);
for(let i=0;i<260;i++){const x=rnd()*TW,y=rnd()*TH,r=60+rnd()*340,gr=t.createRadialGradient(x,y,0,x,y,r);
  const c=rnd()<.5?opt.terrain2:'#5c4719';gr.addColorStop(0,c+'55');gr.addColorStop(1,c+'00');t.fillStyle=gr;t.fillRect(x-r,y-r,2*r,2*r);}
t.globalAlpha=.3;for(let i=0;i<16000;i++){t.fillStyle=rnd()<.5?'#3e3012':'#b39a52';t.fillRect(rnd()*TW,rnd()*TH,2+rnd()*5,1+rnd()*2);}
t.globalAlpha=.22;t.strokeStyle='#4a3a14';t.lineWidth=2;for(let i=0;i<2600;i++){const x=rnd()*TW,y=rnd()*TH;t.beginPath();t.moveTo(x,y);t.lineTo(x+(rnd()-.5)*10,y-6-rnd()*8);t.stroke();}
t.globalAlpha=.35;t.strokeStyle='#9b8243';t.lineWidth=26;t.beginPath();t.moveTo(0,TH*.18);t.bezierCurveTo(TW*.3,TH*.1,TW*.6,TH*.3,TW,TH*.2);t.stroke();
t.globalAlpha=.55;for(let i=0;i<70;i++){const x=rnd()*TW,y=rnd()*TH;if(Math.abs(x-TW/2)<520&&Math.abs(y-TH/2)<900)continue;
  t.fillStyle='#2f3a16';t.beginPath();t.arc(x,y,8+rnd()*16,0,6.283);t.fill();}
t.globalAlpha=1;
// Formations: fixed per-soldier offsets.
const units=P.units.map(u=>{const dots=[];for(let r=0;r<u.rows;r++)for(let c=0;c<u.cols;c++)
  dots.push({u:(c+.5)/u.cols+(rnd()-.5)*.6/u.cols,v:(r+.5)/u.rows+(rnd()-.5)*.5/u.rows,s:.75+rnd()*.5,ox:rnd()-.5,oy:rnd()-.5,ph:rnd()*6.283});
  return {...u,dots};});
const byId=Object.fromEntries(units.map(u=>[u.id,u]));
function pathAt(pts,p){let L=0;const seg=[];for(let i=1;i<pts.length;i++){const l=Math.hypot(pts[i][0]-pts[i-1][0],pts[i][1]-pts[i-1][1]);seg.push(l);L+=l;}
  let d=p*L;for(let i=0;i<seg.length;i++){if(d<=seg[i]||i===seg.length-1){const q=seg[i]?clamp(d/seg[i],0,1):1;
    return [lerp(pts[i][0],pts[i+1][0],q),lerp(pts[i][1],pts[i+1][1],q),Math.atan2(pts[i+1][1]-pts[i][1],pts[i+1][0]-pts[i][0])];}d-=seg[i];}return pts[pts.length-1];}
function unitState(u,f){const s={x:u.x,y:u.y,w:u.w,d:u.d,curve:u.curve,angle:u.angle,rout:0,dead:0};
  for(const m of P.moves){if(m.unit!==u.id||f<m.at)continue;const e=ease[m.ease]||ease.inout,p=e(clamp((f-m.at)/m.dur,0,1));
    const from={...s};for(const k in m.target)s[k]=lerp(from[k],m.target[k],p);
    if(m.path){const q=pathAt(m.path,p);s.x=q[0];s.y=q[1];}}return s;}
function camera(f){let c={x:opt.camX,y:opt.camY,zoom:opt.zoom};for(const k of P.cameras){if(f<k.at)continue;const p=ease.inout(clamp((f-k.at)/k.dur,0,1));
  c={x:lerp(c.x,k.x,p),y:lerp(c.y,k.y,p),zoom:lerp(c.zoom,k.zoom,p)};}
  let sx=0,sy=0;for(const k of P.shakes){const a=f-k.at;if(a<0||a>k.dur)continue;const m=k.amp*(1-a/k.dur);sx+=Math.sin(a*1.7+1)*m;sy+=Math.cos(a*2.3)*m;}
  return {...c,sx,sy};}
const toScreen=(c,x,y)=>[(x-c.x)*c.zoom+W/2+c.sx,(y-c.y)*c.zoom+H/2+c.sy];
function dotPos(st,d){const lx=(d.u-.5)*st.w,ly=(d.v-.5)*st.d+st.curve*(1-Math.pow(2*d.u-1,2));
  const a=st.angle*Math.PI/180,ca=Math.cos(a),sa=Math.sin(a);let x=st.x+lx*ca-ly*sa,y=st.y+lx*sa+ly*ca;
  if(st.rout>0){x+=d.ox*st.rout*260;y+=d.oy*st.rout*260;}return [x,y];}
function smooth(pts){const out=[];for(let i=0;i<pts.length-1;i++){const p0=pts[Math.max(0,i-1)],p1=pts[i],p2=pts[i+1],p3=pts[Math.min(pts.length-1,i+2)];
  for(let j=0;j<16;j++){const q=j/16,q2=q*q,q3=q2*q;out.push([0,1].map(k=>.5*((2*p1[k])+(-p0[k]+p2[k])*q+(2*p0[k]-5*p1[k]+4*p2[k]-p3[k])*q2+(-p0[k]+3*p1[k]-3*p2[k]+p3[k])*q3)));}}
  out.push(pts[pts.length-1]);return out;}
const arrows=P.arrows.map(a=>{const s=smooth(a.pts),cum=[0];for(let i=1;i<s.length;i++)cum.push(cum[i-1]+Math.hypot(s[i][0]-s[i-1][0],s[i][1]-s[i-1][1]));return {...a,s,cum,len:cum[cum.length-1]};});
function sub(a,from,to){const pts=[];for(let i=0;i<a.s.length;i++){if(a.cum[i]>=from&&a.cum[i]<=to)pts.push(a.s[i]);}
  const at=d=>{for(let i=1;i<a.s.length;i++)if(a.cum[i]>=d){const q=(d-a.cum[i-1])/((a.cum[i]-a.cum[i-1])||1);return [lerp(a.s[i-1][0],a.s[i][0],q),lerp(a.s[i-1][1],a.s[i][1],q)];}return a.s[a.s.length-1];};
  return [at(from),...pts,at(to)];}
const labelEls=[...root.querySelectorAll('.label')],capEls=[...root.querySelectorAll('.cap')],statEls=[...root.querySelectorAll('.stat')];
return frame=>{
  const c=camera(frame);g.setTransform(1,0,0,1,0,0);g.fillStyle='#1b160c';g.fillRect(0,0,W,H);
  g.setTransform(c.zoom,0,0,c.zoom,W/2-c.x*c.zoom+c.sx,H/2-c.y*c.zoom+c.sy);g.drawImage(tex,TX,TY);
  // dust under units
  for(const u of units){if(frame<u.at)continue;const st=unitState(u,frame),alpha=u.fade?clamp((frame-u.at)/u.fade,0,1):1;
    const col=u.colour||(u.side==='red'?opt.red:opt.dark),deadCol='#4a2a1a';
    for(const d of u.dots){const [x,y]=dotPos(st,d);const r=3.1*d.s;
      g.globalAlpha=.32*alpha;g.fillStyle='#1d1608';g.beginPath();g.ellipse(x+5,y+4,r*1.4,r*.8,0,0,6.283);g.fill();
      g.globalAlpha=alpha*(st.dead>0&&d.ph<st.dead*6.283?.55:1);g.fillStyle=st.dead>0&&d.ph<st.dead*6.283?deadCol:col;
      g.beginPath();g.arc(x,y,r,0,6.283);g.fill();
      if(u.side==='red'){g.globalAlpha=.55*alpha;g.fillStyle='#d9b38c';g.fillRect(x-1,y-r,2,1.6);}}}
  g.globalAlpha=1;
  for(const a of arrows){const age=frame-a.at;if(age<0)continue;const total=a.draw+a.hold+a.retract;if(age>total)continue;
    const head=ease.out(clamp(age/a.draw,0,1))*a.len,tail=age>a.draw+a.hold?ease.inout(clamp((age-a.draw-a.hold)/a.retract,0,1))*a.len:0;
    if(head-tail<4)continue;const pts=sub(a,tail,head);g.lineCap='round';g.lineJoin='round';
    g.strokeStyle='rgba(0,0,0,.28)';g.lineWidth=a.width+6;g.beginPath();pts.forEach((p,i)=>i?g.lineTo(p[0]+4,p[1]+5):g.moveTo(p[0]+4,p[1]+5));g.stroke();
    const grd=g.createLinearGradient(pts[0][0],pts[0][1],pts[pts.length-1][0],pts[pts.length-1][1]);grd.addColorStop(0,a.colour+'30');grd.addColorStop(1,a.colour);
    g.strokeStyle=grd;g.lineWidth=a.width;g.beginPath();pts.forEach((p,i)=>i?g.lineTo(p[0],p[1]):g.moveTo(p[0],p[1]));g.stroke();
    const p1=pts[pts.length-1],p0=pts[Math.max(0,pts.length-3)],ang=Math.atan2(p1[1]-p0[1],p1[0]-p0[0]),h=a.width*2.1;
    g.fillStyle=a.colour;g.beginPath();g.moveTo(p1[0]+Math.cos(ang)*h*.6,p1[1]+Math.sin(ang)*h*.6);
    g.lineTo(p1[0]+Math.cos(ang+2.5)*h,p1[1]+Math.sin(ang+2.5)*h);g.lineTo(p1[0]+Math.cos(ang-2.5)*h,p1[1]+Math.sin(ang-2.5)*h);g.closePath();g.fill();}
  for(const fl of P.flashes){const age=frame-fl.at;if(age<0||age>90)continue;
    fl.pts.forEach((p,i)=>{const a=age-i*3;if(a<0)return;
      const dust=clamp(a/90,0,1),dr=fl.size*(.5+1.0*ease.out(dust));g.globalAlpha=.24*(1-dust);g.fillStyle='#c9ad74';
      g.beginPath();g.arc(p[0],p[1]-a*.3,dr,0,6.283);g.fill();
      if(a<24){const q=a/24,r=fl.size*(.5+1.1*q),gr=g.createRadialGradient(p[0],p[1],0,p[0],p[1],r);
        gr.addColorStop(0,'rgba(255,250,215,'+(1-q)+')');gr.addColorStop(.35,'rgba(255,214,120,'+(.85*(1-q))+')');gr.addColorStop(1,'rgba(255,170,60,0)');
        g.globalAlpha=1;g.fillStyle=gr;g.beginPath();g.arc(p[0],p[1],r,0,6.283);g.fill();}});}
  g.globalAlpha=1;
  P.labels.forEach((l,i)=>{const el=labelEls[i],age=frame-l.at,left=l.at+l.dur-frame;
    if(age<0||left<0){el.style.opacity='0';return;}
    let wx=l.x,wy=l.y;if(l.unit&&byId[l.unit]){const s=unitState(byId[l.unit],frame);wx=s.x;wy=s.y-s.d/2;}
    const [sx,sy]=toScreen(c,wx,wy),inn=ease.out(clamp(age/9,0,1)),out=clamp(left/9,0,1),sc=.55+.45*inn+(inn<1?.08*Math.sin(inn*3.14):0);
    el.style.opacity=String(Math.min(inn*1.6,1)*out);
    el.style.transform='translate('+(sx-el.offsetWidth/2)+'px,'+(sy+l.dy*c.zoom-el.offsetHeight)+'px) scale('+sc+')';});
  let ci=-1;P.captions.forEach((k,i)=>{if(frame>=k.at)ci=i;});
  capEls.forEach((el,i)=>{el.style.display=i===ci?'flex':'none';if(i===ci){const a=frame-P.captions[i].at,s=1+.07*Math.max(0,1-a/5);el.style.transform='translateY(-50%) scale('+s+')';}});
  P.stats.forEach((s,i)=>{const a=frame-s.at,el=statEls[i];if(a<0){el.style.opacity='0';return;}
    const q=ease.out(clamp(a/14,0,1));el.style.opacity=String(q);el.style.transform='scale('+(1.25-.25*q)+')';});
};`;

export function renderMap(timeline: Timeline, within: SpatialFrame, window: TemporalWindow,
  display: FontStackRef, ui: FontStackRef, events: readonly MapEvent[], opt: MapOptions) {
  assertTemporalWindowFor(window, { subjectId: opt.id, timeline });
  const { startFrame, endFrameExclusive } = window.span;
  if (events.some(event => event.at.frame < startFrame || event.at.frame >= endFrameExclusive)) throw new Error("Battle-map events must lie inside the scene window.");
  const plan = compile(events, startFrame, opt);

  let order = 0;
  const children: VisualElement[] = [];
  const text = (id: string, value: string, fonts: FontStackRef): string => {
    children.push({ id, kind: "text", parent: "map", order: ++order, text: value, fonts: fonts.faces, style: [] });
    return `{{${id}}}`;
  };
  const title = `<div class="title"><span class="t">${text("title", opt.title, display)}</span><span class="y">${text("year", opt.year, display)}</span></div>`;
  const labels = plan.labels.map((label, i) =>
    `<div class="label" style="border-color:${label.tone}"><i style="background:${label.tone}"></i>${text(`label-${i}`, String(label.text), ui)}</div>`).join("");
  const captions = plan.captions.map((caption, i) => `<div class="cap">${(caption.words as { word: string; key: boolean }[])
    .map((word, j) => `<span class="${word.key ? "k" : ""}">${text(`cap-${i}-${j}`, word.word, display)}</span>`).join("")}</div>`).join("");
  const stats = plan.stats.map((stat, i) =>
    `<div class="stat"><span class="n">${text(`stat-${i}-n`, String(stat.number), display)}</span>${stat.sub ? `<span class="s">${text(`stat-${i}-s`, String(stat.sub), ui)}</span>` : ""}</div>`).join("");

  const program = htmlVisual({
    html: `<canvas></canvas><div class="vig"></div>${labels}${title}${stats}${captions}`,
    css: css(opt),
    // JSON round-trip yields plain canonical data (numbers, strings, arrays, objects).
    data: JSON.parse(JSON.stringify({ width: within.widthPx, height: within.heightPx, plan, opt })),
    setup,
  });
  return sealVisualTrack({ id: opt.id, timelineId: timeline.id, visualIr: "hypit.visual-ir@1",
    presents: [{ id: opt.id, order: 0, z: 0, span: window.span,
      elements: [{ id: "map", kind: "program", order: 0, program,
        style: [{ name: "position", value: "absolute" }, { name: "left", value: `${within.xPx}px` }, { name: "top", value: `${within.yPx}px` },
          { name: "width", value: `${within.widthPx}px` }, { name: "height", value: `${within.heightPx}px` }] }, ...children] }] });
}
