import { sealVisualTrack } from "@hypit/composition";
import type { VisualElement } from "@hypit/composition";
import { htmlVisual } from "@hypit/html-program";
import type { FontStackRef } from "@hypit/media";
import type { Timeline } from "@hypit/timeline";
import type { SpatialFrame } from "@hypit/spatial";
import { assertTemporalWindowFor } from "@hypit/temporal";
import type { TemporalInstant, TemporalWindow } from "@hypit/temporal";

/** How a beat enters and holds. See README.md for the visual meaning of each kind. */
export const beatKinds = ["hook", "line", "punch", "stat", "list", "cta"] as const;
export type BeatKind = (typeof beatKinds)[number];

export type Beat = { id: string; kind: BeatKind; text: string; sub?: string; at: TemporalInstant };

export type KineticOptions = {
  id: string;
  /** Solid backdrop colour; ignored when `transparent` is true. */
  background: string;
  /** Second backdrop colour used for the animated gradient. */
  background2: string;
  /** Highlight colour for *marked* words, punch backdrops, progress bar and CTA. */
  accent: string;
  /** Main text colour. */
  ink: string;
  /** Text outline colour (the thick Shorts stroke). */
  stroke: string;
  /** Leave the backdrop empty so B-roll on a lower Track shows through. */
  transparent: boolean;
  progress: boolean;
  flash: boolean;
  uppercase: boolean;
  /** Frames between word pops in `line`, `list` and `cta` beats. */
  stagger: number;
  /** Vertical centre of the text block, 0 = top, 1 = bottom. */
  textY: number;
};

type Token = { text: string; highlight: boolean };

/** `*word*` or `*several words*` marks accent words. */
export function tokenize(text: string): Token[] {
  const tokens: Token[] = [];
  let open = false;
  for (const raw of text.trim().split(/\s+/u)) {
    if (!raw) continue;
    let word = raw, highlight = open;
    if (word.startsWith("*")) { word = word.slice(1); highlight = true; open = true; }
    if (word.endsWith("*")) { word = word.slice(0, -1); open = false; }
    if (word) tokens.push({ text: word, highlight });
  }
  if (!tokens.length) throw new Error("A kinetic Beat needs visible text.");
  return tokens;
}

const baseSize: Record<BeatKind, number> = { hook: 170, line: 136, punch: 260, stat: 250, list: 124, cta: 140 };

/** Shrink long lines so they stay inside a 1080 px safe area. Sizes are relative to a 1080 px wide frame. */
export function fontSizeFor(kind: BeatKind, tokens: readonly Token[], widthPx: number): number {
  const longest = Math.max(...tokens.map(token => [...token.text].length));
  const chars = tokens.reduce((sum, token) => sum + [...token.text].length, 0) + tokens.length - 1;
  let size = baseSize[kind];
  // Condensed display faces average ~0.5 em per uppercase glyph; keep the longest word inside 88% of the width
  // and the whole beat inside roughly 40% of a 9:16 frame.
  const usable = 1080 * 0.88;
  size = Math.min(size, usable / Math.max(1, longest * 0.5));
  if (kind !== "punch" && kind !== "stat") size = Math.min(size, Math.sqrt((usable * 1920 * 0.4) / Math.max(1, chars * 0.5 * 1.1)));
  return Math.round(Math.max(44, size) * (widthPx / 1080));
}

const css = (opt: KineticOptions) => `:scope{overflow:hidden;--accent:${opt.accent};--ink:${opt.ink};--stroke:${opt.stroke};
  background:${opt.transparent ? "transparent" : opt.background}}
.bg{position:absolute;inset:-10%;${opt.transparent ? "display:none;" : ""}background:radial-gradient(60% 45% at 50% 40%, ${opt.background2} 0%, ${opt.background} 70%)}
.blob{position:absolute;width:60%;aspect-ratio:1;border-radius:50%;filter:blur(110px);opacity:.22}
.blob.a{background:var(--accent);left:-20%;top:5%}.blob.b{background:${opt.background2};right:-25%;bottom:0%;opacity:.8}
.punchbg{position:absolute;inset:0;background:var(--accent);opacity:0}
.stage{position:absolute;inset:0;transform-origin:50% 50%}
.beat{position:absolute;left:6%;right:6%;top:${(opt.textY * 100).toFixed(2)}%;transform:translateY(-50%);display:none;text-align:center}
.line{display:flex;flex-wrap:wrap;justify-content:center;align-items:baseline;column-gap:.24em;row-gap:.02em;line-height:1.05}
.w{display:inline-block;color:var(--ink);-webkit-text-stroke:.09em var(--stroke);paint-order:stroke fill;
  text-shadow:0 .06em 0 var(--stroke),0 .12em .18em rgba(0,0,0,.45);${opt.uppercase ? "text-transform:uppercase;" : ""}will-change:transform,opacity}
.w.hl{color:var(--accent)}
.beat.punch .w{color:var(--ink)}
.beat.stat .w:first-child{color:var(--accent)}
.sub{margin-top:1.1em;display:inline-block;padding:.25em .7em;border-radius:.4em;background:rgba(0,0,0,.55);color:#fff;opacity:0}
.badge{display:none}
.flash{position:absolute;inset:0;background:#fff;opacity:0;pointer-events:none}
.bar{position:absolute;left:0;top:0;height:14px;width:0;background:var(--accent);${opt.progress ? "" : "display:none;"}box-shadow:0 0 18px var(--accent)}`;

/** One VisualTrack Present: backdrop, beats, flash, and progress share a clock and a camera. */
export function renderKinetic(timeline: Timeline, within: SpatialFrame, window: TemporalWindow,
  font: FontStackRef, beats: readonly Beat[], opt: KineticOptions) {
  assertTemporalWindowFor(window, { subjectId: opt.id, timeline });
  if (!Number.isSafeInteger(opt.stagger) || opt.stagger < 0) throw new Error("Kinetic stagger must be a whole number of frames.");
  if (!(opt.textY >= 0 && opt.textY <= 1)) throw new Error("Kinetic text-y must lie in [0, 1].");
  const { startFrame, endFrameExclusive } = window.span;
  if (beats.some(beat => beat.at.frame < startFrame || beat.at.frame >= endFrameExclusive)) throw new Error("Kinetic beats must start inside the scene window.");

  let order = 0;
  const children: VisualElement[] = [];
  const text = (id: string, value: string, size: number): VisualElement => ({
    id, kind: "text", parent: "kinetic", order: ++order, text: value, fonts: font.faces,
    style: [{ name: "font-size", value: `${size}px` }, { name: "line-height", value: 1.02 }],
  });
  const beatHtml = beats.map((beat, index) => {
    const tokens = tokenize(beat.text);
    const size = fontSizeFor(beat.kind, tokens, within.widthPx);
    const words = tokens.map((token, j) => {
      children.push(text(`b${index}w${j}`, token.text, size));
      return `<span class="w${token.highlight ? " hl" : ""}">{{b${index}w${j}}}</span>`;
    }).join("");
    let sub = "";
    if (beat.sub) {
      children.push(text(`b${index}s`, beat.sub, Math.round(62 * within.widthPx / 1080)));
      sub = `<div style="font-size:${Math.round(62 * within.widthPx / 1080)}px"><span class="sub">{{b${index}s}}</span></div>`;
    }
    return `<section class="beat ${beat.kind}" data-beat="${index}"><div class="line" style="font-size:${size}px">${words}</div>${sub}</section>`;
  }).join("");

  const program = htmlVisual({
    html: `<div class="bg"><div class="blob a"></div><div class="blob b"></div></div><div class="punchbg"></div>
      <div class="stage">${beatHtml}</div><div class="flash"></div><div class="bar"></div>`,
    css: css(opt),
    data: {
      starts: beats.map(beat => beat.at.frame - startFrame),
      kinds: beats.map(beat => beat.kind),
      total: endFrameExclusive - startFrame,
      stagger: opt.stagger, flash: opt.flash,
    },
    // Pure function of the local frame: any frame can be rendered directly (scrubbing, ranges, parallel workers).
    setup: `const beats=[...root.querySelectorAll('.beat')], stage=root.querySelector('.stage'), flash=root.querySelector('.flash'),
        bar=root.querySelector('.bar'), punchbg=root.querySelector('.punchbg'), blobs=[...root.querySelectorAll('.blob')];
      const words=beats.map(b=>[...b.querySelectorAll('.w')]), subs=beats.map(b=>b.querySelector('.sub'));
      const clamp=(v,a,b)=>Math.max(a,Math.min(b,v)), easeOut=t=>1-Math.pow(1-clamp(t,0,1),3);
      const back=t=>{t=clamp(t,0,1);const c=1.9;return 1+(c+1)*Math.pow(t-1,3)+c*Math.pow(t-1,2);};
      const noise=(f,s)=>Math.sin(f*12.9898+s*78.233)*0.5+Math.sin(f*4.1+s)*0.5;
      return frame=>{
        let active=-1; for(let i=0;i<data.starts.length;i++){ if(frame>=data.starts[i]) active=i; }
        bar.style.width=(100*clamp(frame/Math.max(1,data.total-1),0,1))+'%';
        blobs.forEach((b,i)=>{const t=frame/30;b.style.transform='translate('+(Math.sin(t*.7+i*2)*60)+'px,'+(Math.cos(t*.5+i)*80)+'px)';});
        beats.forEach((b,i)=>{b.style.display=i===active?'block':'none';});
        punchbg.style.opacity='0'; flash.style.opacity='0'; stage.style.transform='none';
        if(active<0) return;
        const kind=data.kinds[active], age=frame-data.starts[active];
        const next=active+1<data.starts.length?data.starts[active+1]:data.total, length=Math.max(1,next-data.starts[active]);
        // Camera: slow push across the beat plus impact shake on hooks and punches.
        let scale=1+0.05*(age/length), dx=0, dy=0, rot=0;
        if(kind==='hook'||kind==='punch'){const k=Math.max(0,1-age/9);dx=noise(frame,1)*22*k;dy=noise(frame,2)*22*k;rot=noise(frame,3)*1.6*k;}
        stage.style.transform='translate('+dx+'px,'+dy+'px) rotate('+rot+'deg) scale('+scale+')';
        if(data.flash){flash.style.opacity=String(Math.max(0,0.55*(1-age/4)));}
        if(kind==='punch') punchbg.style.opacity='1';
        const w=words[active];
        w.forEach((el,j)=>{
          let s=1,o=1,y=0,r=0;
          if(kind==='hook'){const t=age/7;s=1.7-0.7*back(t);o=clamp(age/2,0,1);}
          else if(kind==='punch'){const t=age/6;s=2.4-1.4*back(t);r=(1-easeOut(t))*-6;o=clamp(age/2,0,1);}
          else if(kind==='stat'){const t=(age-j*data.stagger)/8;s=j===0?0.3+0.7*back(t):1;y=j===0?0:60*(1-easeOut(t));o=clamp(t*2,0,1);}
          else {const t=(age-j*data.stagger)/6;o=clamp(t*2.5,0,1);s=0.55+0.45*back(t);y=36*(1-easeOut(t));}
          if(kind==='cta'&&age>w.length*data.stagger+8){s*=1+0.045*Math.sin((age)*0.25);}
          el.style.opacity=String(o);
          el.style.transform='translateY('+y+'px) rotate('+r+'deg) scale('+s+')';
        });
        const sub=subs[active];
        if(sub){const t=(age-w.length*data.stagger-4)/8;sub.style.opacity=String(clamp(t,0,1));sub.style.transform='translateY('+(30*(1-easeOut(t)))+'px)';}
      };`,
  });
  return sealVisualTrack({ id: opt.id, timelineId: timeline.id, visualIr: "hypit.visual-ir@1",
    presents: [{ id: opt.id, order: 0, z: 0, span: window.span,
      elements: [{ id: "kinetic", kind: "program", order: 0, program,
        style: [{ name: "position", value: "absolute" }, { name: "left", value: `${within.xPx}px` },
          { name: "top", value: `${within.yPx}px` },
          { name: "width", value: `${within.widthPx}px` }, { name: "height", value: `${within.heightPx}px` }] }, ...children] }] });
}
