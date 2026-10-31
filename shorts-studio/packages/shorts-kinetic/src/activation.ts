import { assertAttributes, assertEmptyElement, createMarkupSurfaceFacet, textAttribute } from "@hypit/hypit/markup";
import { canonicalize, sameType } from "@hypit/hypit/protocol";
import { sealGraphFragment } from "@hypit/hypit/author";
import { createAdmissionPackageFacet } from "@hypit/hypit/admission";
import { createProducerPackageFacet } from "@hypit/hypit/producer";
import type { ProducerPackage } from "@hypit/hypit/producer";
import type { AdmissionPackage } from "@hypit/hypit/admission";
import type { FragmentOperation } from "@hypit/hypit/author";
import type { ModuleManifest, TypeRef } from "@hypit/hypit/protocol";
import type { StructuredSurfaceHandler, SurfaceResolvedReference } from "@hypit/hypit/markup";
import { compositionTypes } from "@hypit/composition";
import { mediaTypes } from "@hypit/media";
import type { FontStackRef } from "@hypit/media";
import type { Timeline } from "@hypit/timeline";
import { timelineTypes } from "@hypit/timeline";
import { spatialTypes } from "@hypit/spatial";
import type { SpatialFrame } from "@hypit/spatial";
import { assertTemporalInstantFor, temporalTypes } from "@hypit/temporal";
import type { TemporalInstant, TemporalWindow } from "@hypit/temporal";
import { resolveTemporalInstantReference, resolveTemporalWindowReference, resolveTemporalContext,
  temporalContextAttributeVocabulary, temporalInstantAttributeNames, temporalInstantAttributeVocabulary,
  temporalWindowAttributeNames, temporalWindowAttributeVocabulary } from "@hypit/temporal/markup";
import { beatKinds, renderKinetic, tokenize } from "./render.js";
import type { Beat, BeatKind, KineticOptions } from "./render.js";

const module = { name: "@shorts/kinetic", version: "1" } as const;
const types = Object.fromEntries(["Options", "Beat", "Beats"].map(name => [name, { module, name }])) as Record<"Options" | "Beat" | "Beats", TypeRef>;
const producers = Object.fromEntries(["empty", "append", "render"].map(name => [name, { module, name }])) as Record<"empty" | "append" | "render", { module: typeof module; name: string }>;

export const manifest: ModuleManifest = { format: "hypit.module@1", ...module,
  dependencies: [compositionTypes.visualTrack, mediaTypes.fontStack, timelineTypes.timeline, spatialTypes.frame, temporalTypes.instant].map(type => ({ module: type.module })),
  types: Object.values(types).map(type => ({ name: type.name })), capabilities: [], producers: [
    { name: "empty", inputs: [], outputs: [{ name: "beats", type: types.Beats }], needs: [] },
    { name: "append", inputs: [{ name: "beats", type: types.Beats }, { name: "beat", type: types.Beat },
      { name: "at", type: temporalTypes.instant }, { name: "timeline", type: timelineTypes.timeline }], outputs: [{ name: "beats", type: types.Beats }], needs: [] },
    { name: "render", inputs: [{ name: "beats", type: types.Beats }, { name: "options", type: types.Options },
      { name: "timeline", type: timelineTypes.timeline }, { name: "within", type: spatialTypes.frame },
      { name: "window", type: temporalTypes.window }, { name: "font", type: mediaTypes.fontStack }], outputs: [{ name: "visual", type: compositionTypes.visualTrack }], needs: [] },
  ],
};

const inline = <T>(record: { value: { kind: string; value?: unknown } } | undefined): T => {
  if (record?.value.kind !== "inline") throw new Error("Kinetic inputs must be inline values.");
  return record.value.value as T;
};
const value = (data: unknown) => ({ kind: "inline" as const, value: canonicalize(data) });

const component: ProducerPackage & AdmissionPackage = { producers: [
  { producer: producers.empty, handler: () => ({ outputs: { beats: value([]) }, needs: {} }) },
  { producer: producers.append, handler: ({ inputs }) => {
    const beat = inline<Omit<Beat, "at">>(inputs.beat), at = inline<TemporalInstant>(inputs.at);
    const beats = inline<Beat[]>(inputs.beats);
    assertTemporalInstantFor(at, { subjectId: beat.id, timeline: inline<Timeline>(inputs.timeline) });
    if (beats.some(item => item.id === beat.id)) throw new Error(`Kinetic beat id "${beat.id}" is repeated.`);
    if ((beats.at(-1)?.at.frame ?? -1) >= at.frame) throw new Error(`Kinetic beat "${beat.id}" must start after the previous beat.`);
    return { outputs: { beats: value([...beats, { ...beat, at }]) }, needs: {} };
  } },
  { producer: producers.render, handler: ({ inputs }) => ({ outputs: { visual: value(renderKinetic(inline<Timeline>(inputs.timeline),
    inline<SpatialFrame>(inputs.within), inline<TemporalWindow>(inputs.window), inline<FontStackRef>(inputs.font),
    inline<Beat[]>(inputs.beats), inline<KineticOptions>(inputs.options))) }, needs: {} }) },
] };

const optional = (element: { attributes: Record<string, unknown> }, name: string, fallback: string): string => {
  const raw = element.attributes[name];
  if (raw === undefined) return fallback;
  if (typeof raw !== "string") throw new Error(`${name} must be a literal.`);
  return raw;
};
const flag = (element: { attributes: Record<string, unknown> }, name: string, fallback: boolean): boolean => {
  const raw = optional(element, name, String(fallback));
  if (raw !== "true" && raw !== "false") throw new Error(`${name} must be true or false.`);
  return raw === "true";
};
const sceneAttributes = ["background", "background-2", "accent", "ink", "stroke", "transparent", "progress", "flash", "uppercase", "stagger", "text-y"];

export const decodeSurface: StructuredSurfaceHandler = ({ element, resolveReference }) => {
  assertAttributes(element, ["id", "timeline", "within", "font", ...sceneAttributes, ...temporalWindowAttributeNames]);
  const id = textAttribute(element, "id"), context = resolveTemporalContext({ element, resolveReference });
  const window = resolveTemporalWindowReference({ element, resolveReference });
  const reference = (name: string, type: TypeRef): SurfaceResolvedReference => {
    const raw = element.attributes[name];
    if (typeof raw !== "object" || raw.kind !== "reference") throw new Error(`${name} must be a reference.`);
    const found = resolveReference(raw.path);
    if (found === undefined || !sameType(found.type, type)) throw new Error(`${name} has the wrong Type.`);
    return found;
  };
  const options: KineticOptions = {
    id,
    background: optional(element, "background", "#0b0b12"),
    background2: optional(element, "background-2", "#2a1b5c"),
    accent: optional(element, "accent", "#ffd60a"),
    ink: optional(element, "ink", "#ffffff"),
    stroke: optional(element, "stroke", "#000000"),
    transparent: flag(element, "transparent", false),
    progress: flag(element, "progress", true),
    flash: flag(element, "flash", true),
    uppercase: flag(element, "uppercase", true),
    stagger: Number(optional(element, "stagger", "3")),
    textY: Number(optional(element, "text-y", "0.45")),
  };
  const records = [{ id: `${id}.options`, type: types.Options, value: value(options), range: element.range }];
  const inputs = [{ name: "timeline", type: timelineTypes.timeline }, { name: "within", type: spatialTypes.frame },
    { name: "font", type: mediaTypes.fontStack }, { name: "window", type: temporalTypes.window }, { name: "options", type: types.Options }];
  const bindings: Record<string, SurfaceResolvedReference["ref"]> = { timeline: context.timeline.ref, within: reference("within", spatialTypes.frame).ref,
    font: reference("font", mediaTypes.fontStack).ref, window: window.ref, options: { kind: "record", id: `${id}.options` } };
  const input = (name: string) => ({ kind: "fragment-input" as const, name });
  const operation = (name: string) => ({ kind: "fragment-operation" as const, operation: name });
  const operations: FragmentOperation[] = [{ id: "empty", producer: producers.empty, inputs: {}, result: { kind: "output", name: "beats" } }];
  let previous = "empty", index = 0;
  for (const child of element.children) {
    if (child.kind === "text") { if (child.value.trim()) throw new Error("Kinetic Scene accepts Beat children."); continue; }
    if (child.name.split(":").at(-1) !== "Beat") throw new Error("Kinetic Scene accepts Beat children.");
    assertAttributes(child, ["id", "kind", "text", "sub", ...temporalInstantAttributeNames]); assertEmptyElement(child);
    const beatId = textAttribute(child, "id"), kind = optional(child, "kind", "line");
    if (!(beatKinds as readonly string[]).includes(kind)) throw new Error(`Beat kind must be one of ${beatKinds.join(", ")}.`);
    const beatText = textAttribute(child, "text");
    tokenize(beatText);
    const sub = child.attributes.sub === undefined ? undefined : textAttribute(child, "sub");
    const at = resolveTemporalInstantReference({ element: child, resolveReference });
    const key = `beat-${++index}`;
    records.push({ id: `${id}.${key}`, type: types.Beat, value: value({ id: beatId, kind: kind as BeatKind, text: beatText, ...(sub ? { sub } : {}) }), range: child.range });
    inputs.push({ name: key, type: types.Beat }, { name: `${key}-at`, type: temporalTypes.instant });
    bindings[key] = { kind: "record", id: `${id}.${key}` }; bindings[`${key}-at`] = at.ref;
    operations.push({ id: key, producer: producers.append, inputs: { beats: operation(previous), beat: input(key), at: input(`${key}-at`), timeline: input("timeline") }, result: { kind: "output", name: "beats" } });
    previous = key;
  }
  if (!index) throw new Error("Kinetic Scene requires at least one Beat.");
  operations.push({ id: "render", producer: producers.render, inputs: { beats: operation(previous), options: input("options"),
    timeline: input("timeline"), within: input("within"), font: input("font"), window: input("window") }, result: { kind: "output", name: "visual" } });
  const fragment = sealGraphFragment({ inputs, operations, exports: [{ name: "visual", type: compositionTypes.visualTrack, root: operation("render") }] });
  return { records, fragments: [fragment], components:
    [{ id, fragment: fragment.id, inputs: bindings, outputs: { visual: `${id}.visual` }, range: element.range }], exports: [`${id}.visual`] };
};

const literal = (name: string, summary: string) => ({ name, kind: "literal" as const, required: false, summary });
const declaration = { name: "scene", tag: "Scene", mode: "structured" as const,
  outputs: [compositionTypes.visualTrack, ...Object.values(types)],
  vocabulary: { summary: "Shorts-style kinetic typography: beats slam, pop or punch in on their own Instants under one camera, flash and progress bar.", attributes: [
    ...temporalContextAttributeVocabulary, ...temporalWindowAttributeVocabulary,
    ...["id", "within", "font"].map(name => ({ name, kind: "expression" as const, required: true, summary: name })),
    literal("background", "Backdrop colour (default #0b0b12)."), literal("background-2", "Gradient glow colour (default #2a1b5c)."),
    literal("accent", "Highlight colour for *marked* words, punch backdrop and progress bar (default #ffd60a)."),
    literal("ink", "Text colour (default #ffffff)."), literal("stroke", "Text outline colour (default #000000)."),
    literal("transparent", "true leaves the backdrop empty so lower Tracks (B-roll) show through."),
    literal("progress", "Show the top progress bar (default true)."), literal("flash", "White flash on every beat cut (default true)."),
    literal("uppercase", "Uppercase text (default true)."), literal("stagger", "Frames between word pops (default 3)."),
    literal("text-y", "Vertical centre of the text block in [0,1] (default 0.45)."),
  ], children: [{ tag: "Beat", cardinality: "many" as const, summary: "One on-screen statement and the Instant that cuts to it. It holds until the next Beat.", attributes: [
    { name: "id", kind: "literal" as const, required: true, summary: "Unique beat id." },
    { name: "text", kind: "literal" as const, required: true, summary: "Words; wrap accent words in *asterisks*." },
    literal("kind", `One of ${beatKinds.join(", ")} (default line).`),
    literal("sub", "Optional small label under the main text."),
    ...temporalInstantAttributeVocabulary,
  ] }], ports: [{ name: "visual", type: compositionTypes.visualTrack, summary: "The complete kinetic scene." }],
    example: '<kin:Scene id="k" timeline={t.timeline} within={canvas.bounds} font={font} during={t.window}><kin:Beat id="hook" kind="hook" text="Stop *scrolling*" at={t.hook}/></kin:Scene>',
  },
};

export const hypitPackage = { format: "hypit.package@1" as const, modules: [{ manifest }],
  facets: [createProducerPackageFacet(component), createAdmissionPackageFacet(component),
    createMarkupSurfaceFacet({ module, declaration, handler: decodeSurface })] };
export default hypitPackage;
