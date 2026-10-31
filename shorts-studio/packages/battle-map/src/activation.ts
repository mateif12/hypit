import { assertAttributes, createMarkupSurfaceFacet, textAttribute } from "@hypit/hypit/markup";
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
import { eventKinds, renderMap } from "./render.js";
import type { EventKind, MapEvent, MapOptions } from "./render.js";

const module = { name: "@shorts/battle-map", version: "1" } as const;
const types = Object.fromEntries(["Options", "Event", "Events"].map(name => [name, { module, name }])) as Record<"Options" | "Event" | "Events", TypeRef>;
const producers = Object.fromEntries(["empty", "append", "render"].map(name => [name, { module, name }])) as Record<"empty" | "append" | "render", { module: typeof module; name: string }>;

export const manifest: ModuleManifest = { format: "hypit.module@1", ...module,
  dependencies: [compositionTypes.visualTrack, mediaTypes.fontStack, timelineTypes.timeline, spatialTypes.frame, temporalTypes.instant].map(type => ({ module: type.module })),
  types: Object.values(types).map(type => ({ name: type.name })), capabilities: [], producers: [
    { name: "empty", inputs: [], outputs: [{ name: "events", type: types.Events }], needs: [] },
    { name: "append", inputs: [{ name: "events", type: types.Events }, { name: "event", type: types.Event },
      { name: "at", type: temporalTypes.instant }, { name: "timeline", type: timelineTypes.timeline }], outputs: [{ name: "events", type: types.Events }], needs: [] },
    { name: "render", inputs: [{ name: "events", type: types.Events }, { name: "options", type: types.Options },
      { name: "timeline", type: timelineTypes.timeline }, { name: "within", type: spatialTypes.frame }, { name: "window", type: temporalTypes.window },
      { name: "font", type: mediaTypes.fontStack }, { name: "label-font", type: mediaTypes.fontStack }],
      outputs: [{ name: "visual", type: compositionTypes.visualTrack }], needs: [] },
  ],
};

const inline = <T>(record: { value: { kind: string; value?: unknown } } | undefined): T => {
  if (record?.value.kind !== "inline") throw new Error("Battle-map inputs must be inline values.");
  return record.value.value as T;
};
const value = (data: unknown) => ({ kind: "inline" as const, value: canonicalize(data) });

const component: ProducerPackage & AdmissionPackage = { producers: [
  { producer: producers.empty, handler: () => ({ outputs: { events: value([]) }, needs: {} }) },
  { producer: producers.append, handler: ({ inputs }) => {
    const event = inline<Omit<MapEvent, "at">>(inputs.event), at = inline<TemporalInstant>(inputs.at);
    const events = inline<MapEvent[]>(inputs.events);
    assertTemporalInstantFor(at, { subjectId: event.id, timeline: inline<Timeline>(inputs.timeline) });
    if (events.some(item => item.id === event.id)) throw new Error(`Battle-map event id "${event.id}" is repeated.`);
    return { outputs: { events: value([...events, { ...event, at }]) }, needs: {} };
  } },
  { producer: producers.render, handler: ({ inputs }) => ({ outputs: { visual: value(renderMap(inline<Timeline>(inputs.timeline),
    inline<SpatialFrame>(inputs.within), inline<TemporalWindow>(inputs.window), inline<FontStackRef>(inputs.font),
    inline<FontStackRef>(inputs["label-font"]), inline<MapEvent[]>(inputs.events), inline<MapOptions>(inputs.options))) }, needs: {} }) },
] };

const literal = (element: { attributes: Record<string, unknown> }, name: string, fallback: string): string => {
  const raw = element.attributes[name];
  if (raw === undefined) return fallback;
  if (typeof raw !== "string") throw new Error(`${name} must be a literal.`);
  return raw;
};
const sceneAttributes = ["title", "year", "cam-x", "cam-y", "zoom", "seed", "red", "dark", "terrain", "terrain-2", "caption-y", "caption-size"];

export const decodeSurface: StructuredSurfaceHandler = ({ element, resolveReference }) => {
  assertAttributes(element, ["id", "timeline", "within", "font", "label-font", ...sceneAttributes, ...temporalWindowAttributeNames]);
  const id = textAttribute(element, "id"), context = resolveTemporalContext({ element, resolveReference });
  const window = resolveTemporalWindowReference({ element, resolveReference });
  const reference = (name: string, type: TypeRef): SurfaceResolvedReference => {
    const raw = element.attributes[name];
    if (typeof raw !== "object" || raw.kind !== "reference") throw new Error(`${name} must be a reference.`);
    const found = resolveReference(raw.path);
    if (found === undefined || !sameType(found.type, type)) throw new Error(`${name} has the wrong Type.`);
    return found;
  };
  const n = (name: string, fallback: string) => {
    const v = Number(literal(element, name, fallback));
    if (!Number.isFinite(v)) throw new Error(`${name} must be a number.`);
    return v;
  };
  const options: MapOptions = { id, title: literal(element, "title", "BATTLE"), year: literal(element, "year", ""),
    camX: n("cam-x", "540"), camY: n("cam-y", "960"), zoom: n("zoom", "1"), seed: n("seed", "7"),
    red: literal(element, "red", "#A8402C"), dark: literal(element, "dark", "#231d10"),
    terrain: literal(element, "terrain", "#7a6127"), terrain2: literal(element, "terrain-2", "#9a7c33"),
    captionY: n("caption-y", "0.645"), captionSize: n("caption-size", "112") };
  const records = [{ id: `${id}.options`, type: types.Options, value: value(options), range: element.range }];
  const inputs = [{ name: "timeline", type: timelineTypes.timeline }, { name: "within", type: spatialTypes.frame },
    { name: "font", type: mediaTypes.fontStack }, { name: "label-font", type: mediaTypes.fontStack },
    { name: "window", type: temporalTypes.window }, { name: "options", type: types.Options }];
  const bindings: Record<string, SurfaceResolvedReference["ref"]> = { timeline: context.timeline.ref,
    within: reference("within", spatialTypes.frame).ref, font: reference("font", mediaTypes.fontStack).ref,
    "label-font": reference("label-font", mediaTypes.fontStack).ref, window: window.ref, options: { kind: "record", id: `${id}.options` } };
  const input = (name: string) => ({ kind: "fragment-input" as const, name });
  const operation = (name: string) => ({ kind: "fragment-operation" as const, operation: name });
  const operations: FragmentOperation[] = [{ id: "empty", producer: producers.empty, inputs: {}, result: { kind: "output", name: "events" } }];
  const timeNames = new Set<string>(temporalInstantAttributeNames);
  let previous = "empty", index = 0;
  for (const child of element.children) {
    if (child.kind === "text") { if (child.value.trim()) throw new Error("Battle-map Scene accepts event children only."); continue; }
    const kind = child.name.split(":").at(-1) as EventKind;
    if (!(eventKinds as readonly string[]).includes(kind)) throw new Error(`Unknown battle-map child <${child.name}>; use ${eventKinds.join(", ")}.`);
    const attrs: Record<string, string> = {};
    for (const [name, raw] of Object.entries(child.attributes)) {
      if (name === "id" || timeNames.has(name)) continue;
      if (typeof raw !== "string") throw new Error(`<${kind}> ${name} must be a literal.`);
      attrs[name] = raw;
    }
    const eventId = child.attributes.id === undefined ? `${kind.toLowerCase()}-${index + 1}` : textAttribute(child, "id");
    const at = resolveTemporalInstantReference({ element: child, resolveReference });
    const key = `event-${++index}`;
    records.push({ id: `${id}.${key}`, type: types.Event, value: value({ kind, id: eventId, attrs }), range: child.range });
    inputs.push({ name: key, type: types.Event }, { name: `${key}-at`, type: temporalTypes.instant });
    bindings[key] = { kind: "record", id: `${id}.${key}` }; bindings[`${key}-at`] = at.ref;
    operations.push({ id: key, producer: producers.append, inputs: { events: operation(previous), event: input(key), at: input(`${key}-at`), timeline: input("timeline") }, result: { kind: "output", name: "events" } });
    previous = key;
  }
  if (!index) throw new Error("Battle-map Scene needs at least one event.");
  operations.push({ id: "render", producer: producers.render, inputs: { events: operation(previous), options: input("options"),
    timeline: input("timeline"), within: input("within"), font: input("font"), "label-font": input("label-font"), window: input("window") },
    result: { kind: "output", name: "visual" } });
  const fragment = sealGraphFragment({ inputs, operations, exports: [{ name: "visual", type: compositionTypes.visualTrack, root: operation("render") }] });
  return { records, fragments: [fragment], components:
    [{ id, fragment: fragment.id, inputs: bindings, outputs: { visual: `${id}.visual` }, range: element.range }], exports: [`${id}.visual`] };
};

const lit = (name: string, summary: string) => ({ name, kind: "literal" as const, required: false, summary });
const child = (tag: EventKind, summary: string, attrs: [string, string][]) => ({ tag, cardinality: "many" as const, summary,
  attributes: [lit("id", "Optional unique id (Unit ids are referenced by Move and Label)."), ...attrs.map(([n, s]) => lit(n, s)), ...temporalInstantAttributeVocabulary] });
const declaration = { name: "scene", tag: "Scene", mode: "structured" as const,
  outputs: [compositionTypes.visualTrack, ...Object.values(types)],
  vocabulary: { summary: "Top-down battle-map Short: terrain, formations, pinned labels, self-drawing arrows, impact flashes, camera, title bar, kinetic captions and a stat end card, each event on its own Instant.",
    attributes: [...temporalContextAttributeVocabulary, ...temporalWindowAttributeVocabulary,
      ...["id", "within", "font", "label-font"].map(name => ({ name, kind: "expression" as const, required: true, summary: name })),
      lit("title", "Title-bar text."), lit("year", "Yellow date beside the title."), lit("cam-x", "Initial camera centre x (world px)."),
      lit("cam-y", "Initial camera centre y."), lit("zoom", "Initial zoom (1 = world px)."), lit("seed", "Terrain/formation random seed."),
      lit("red", "Enemy unit colour."), lit("dark", "Hero unit colour."), lit("terrain", "Base ground colour."), lit("terrain-2", "Ground patch colour."),
      lit("caption-y", "Caption centre as fraction of height (default 0.645)."), lit("caption-size", "Caption font size px (default 112).")],
    children: [
      child("Unit", "A formation of soldier dots, present from its Instant.", [["side", "red | dark"], ["colour", "override colour"], ["x", "centre x"], ["y", "centre y"], ["w", "width"], ["d", "depth"], ["curve", "centre bulge (negative = up)"], ["angle", "degrees"], ["rows", "dot rows"], ["cols", "dot columns"], ["fade", "fade-in frames"]]),
      child("Move", "Animate a Unit from its current state.", [["unit", "Unit id"], ["for", "frames"], ["ease", "inout | out | in | linear"], ["x", ""], ["y", ""], ["w", ""], ["d", ""], ["curve", ""], ["angle", ""], ["rout", "0..1 scatter"], ["dead", "0..1 fallen share"], ["path", "x,y x,y … travel along a path"]]),
      child("Label", "Pinned pill label that pops in on its Instant.", [["text", "label text"], ["unit", "follow this Unit"], ["x", "fixed x"], ["y", "fixed y"], ["dy", "offset above the unit"], ["tone", "red | blue | neutral | #hex"], ["for", "visible frames"]]),
      child("Arrow", "Self-drawing arrow along points.", [["points", "x,y x,y …"], ["colour", "pink | blue | white | yellow | #hex"], ["draw", "frames"], ["hold", "frames"], ["retract", "frames"], ["width", "px"]]),
      child("Flash", "Impact glow plus dust at points.", [["points", "x,y x,y …"], ["size", "px"]]),
      child("Camera", "Move the camera.", [["x", ""], ["y", ""], ["zoom", ""], ["for", "frames"]]),
      child("Shake", "Impact camera shake.", [["for", "frames"], ["amp", "px"]]),
      child("Caption", "Kinetic caption shown until the next Caption; *word* is the yellow keyword.", [["text", "words"]]),
      child("Stat", "End card number and sub-line.", [["number", "big text"], ["sub", "sub-line"]]),
    ],
    ports: [{ name: "visual", type: compositionTypes.visualTrack, summary: "The complete battle-map scene." }],
    example: '<map:Scene id="battle" timeline={t.timeline} within={canvas.bounds} font={display} label-font={ui} during={t.window} title="BATTLE OF CANNAE" year="216 BC"><map:Unit id="rome" side="red" x="540" y="640" w="560" d="260" rows="18" cols="60" at={t.start}/></map:Scene>',
  },
};

export const hypitPackage = { format: "hypit.package@1" as const, modules: [{ manifest }],
  facets: [createProducerPackageFacet(component), createAdmissionPackageFacet(component),
    createMarkupSurfaceFacet({ module, declaration, handler: decodeSurface })] };
export default hypitPackage;
