import { segmentMeaningSchema, type SegmentMeaning, type ConceptRole } from "../contracts/meaning";
import { segmentPlanSchema, type SegmentPlan } from "../contracts/plan";
import { sourceForm, phraseForm } from "./captions/textForms";
import { detectSource } from "./detectors";
import type { Candidate } from "./retrieval";
export interface ValidationIssue { code: string; message: string; conceptId: string | null }
const forced = new Set<ConceptRole>(["actor", "action", "object", "quantity", "negation", "question"]);
const surfaceForm=(text:string)=>text.normalize("NFC").replace(/\s+/gu," ").trim();
export function validateMeaning(input: unknown, text: string, before: readonly string[] = [], options = { final: false }) {
  const value = segmentMeaningSchema.parse(input), source = sourceForm(text), issues: ValidationIssue[] = [];
  const issue = (code: string, message: string, conceptId: string | null = null) => issues.push({code,message,conceptId});
  const unique = (items: {id:string}[]) => new Set(items.map(x=>x.id)).size === items.length;
  if (![value.concepts,value.referents,value.propositions].every(unique)) issue("M1", "Duplicate IDs");
  const concepts = new Map(value.concepts.map(c=>[c.id,c])), referents = new Map(value.referents.map(r=>[r.id,r]));
  for (const concept of value.concepts) {
    if (!surfaceForm(concept.surfaceBn) || !source.includes(surfaceForm(concept.surfaceBn))) issue("M1", "Concept surface is not in source", concept.id);
    if (concept.referentId && !referents.has(concept.referentId)) issue("M1", "Unknown referent", concept.id);
    if (forced.has(concept.role)) concept.critical = true;
    if (concept.role === "actor" && concept.referentId && referents.get(concept.referentId)?.resolvedFrom === "unresolved") value.ambiguities.push({conceptId:concept.id,description:"Actor referent unresolved",blocking:true});
  }
  for (const ref of value.referents) {
    if (!surfaceForm(ref.surfaceBn) || (ref.resolvedFrom === "previous_context" ? !before.some(t=>sourceForm(t).includes(surfaceForm(ref.surfaceBn))) : !source.includes(surfaceForm(ref.surfaceBn)))) issue("M1", "Referent surface is not in its declared context");
  }
  for (const p of value.propositions) if (![p.predicateConceptId,...p.argumentConceptIds].every(id=>concepts.has(id))) issue("M1", "Unknown proposition concept");
  for (const a of value.ambiguities) if (a.conceptId && !concepts.has(a.conceptId)) issue("M1", "Unknown ambiguity concept", a.conceptId);
  const detected = detectSource(source);
  const addDetected = (role: ConceptRole, surfaceBn: string, numericValue: number | null) => {
    const id = Array.from({length:100},(_,i)=>`c${i}`).find(id=>!value.concepts.some(c=>c.id===id));
    if (id && value.concepts.length < 99) value.concepts.push({ id, role, surfaceBn, lemmaBn: surfaceBn, referentId:null, numericValue, critical:true });
  };
  if (detected.negations.length && (!value.concepts.some(c=>c.role === "negation") || value.polarity === "affirmative" || value.propositions.length>0&&!value.propositions.some(p=>p.negated))) {
    issue("M3", "Source negation was omitted or contradicted");
    if (options.final) { if(value.polarity === "affirmative")value.polarity = "negative"; if (!value.concepts.some(c=>c.role === "negation")) addDetected("negation",detected.negations[0],null); }
  }
  for (const quantity of detected.quantities) if (!value.concepts.some(c=>c.role === "quantity" && c.numericValue === quantity.value && surfaceForm(c.surfaceBn) === surfaceForm(quantity.surface))) {
    issue("M3", `Source quantity ${quantity.surface} was omitted or contradicted`);
    if (options.final) addDetected("quantity",quantity.surface,quantity.value);
  }
  if (detected.question && !["yes_no_question","wh_question"].includes(value.clauseType)) {
    issue("M3", "Source question was omitted");
    if (options.final) value.clauseType = detected.whQuestion ? "wh_question" : "yes_no_question";
  }
  if (options.final) for (const problem of issues) value.ambiguities.push({conceptId:problem.conceptId,description:`${problem.code}: ${problem.message}`,blocking:true});
  return { value, issues, repairRequired: issues.length > 0 && !options.final };
}
export function validatePlan(input: unknown, meaning: SegmentMeaning, candidates: readonly Candidate[]) {
  const value = segmentPlanSchema.parse(input), issues: ValidationIssue[] = [];
  const byId = new Map(candidates.map(c=>[c.asset.id,c])), concepts = new Map(meaning.concepts.map(c=>[c.id,c]));
  const gap = (step: SegmentPlan["steps"][number], reason: "no_candidate" | "candidate_meaning_mismatch") => { step.kind="gap"; step.assetId=null; step.gapReason=reason; };
  for (const step of value.steps) {
    if (new Set(step.conceptIds).size !== step.conceptIds.length || step.conceptIds.some(id=>!concepts.has(id))) {
      issues.push({code:"P2",message:"Unknown or duplicate step concept",conceptId:null}); step.conceptIds=[...new Set(step.conceptIds.filter(id=>concepts.has(id)))]; gap(step,"candidate_meaning_mismatch");
    }
    if (step.kind === "gap") { if (step.assetId !== null || step.gapReason === null) issues.push({code:"P2",message:"Malformed gap step",conceptId:null}); step.assetId=null; step.gapReason ??= "no_candidate"; continue; }
    const candidate = step.assetId ? byId.get(step.assetId) : undefined;
    if (!candidate?.asset.eligible) { issues.push({code:"P1",message:"Asset is not an eligible request candidate",conceptId:null}); gap(step,"no_candidate"); continue; }
    if (!step.conceptIds.length || step.gapReason !== null || step.conceptIds.some(id => {
      const concept=concepts.get(id)!;
      return !candidate.conceptIds.includes(id) && ![candidate.asset.labelBn,...candidate.asset.aliases].some(label=>[concept.surfaceBn,concept.lemmaBn].some(key=>phraseForm(label) === phraseForm(key)));
    })) { issues.push({code:"P3",message:"Candidate does not support the claimed concept",conceptId:null}); gap(step,"candidate_meaning_mismatch"); }
  }
  if (value.strategy === "exact_corpus_phrase") {
    const exact = candidates.filter(c=>c.exactPhrase && c.asset.kind === "sentence");
    if (exact.length !== 1 || value.steps.length !== 1 || value.steps[0].kind !== "asset" || value.steps[0].assetId !== exact[0].asset.id) {
      issues.push({code:"P4",message:"Exact phrase requires one exact sentence asset as the only step",conceptId:null}); for (const step of value.steps) gap(step,"candidate_meaning_mismatch");
    }
  }
  if (value.strategy === "no_signing_possible" && value.steps.some(s=>s.kind === "asset")) { issues.push({code:"P4",message:"No-signing strategy contains assets",conceptId:null}); for (const step of value.steps) gap(step,"candidate_meaning_mismatch"); }
  const covered = new Set(value.steps.filter(s=>s.kind === "asset").flatMap(s=>s.conceptIds));
  const uncovered = meaning.concepts.filter(c=>!covered.has(c.id)).map(c=>c.id).sort();
  if (JSON.stringify([...value.uncoveredConceptIds].sort()) !== JSON.stringify(uncovered)) issues.push({code:"P2",message:"Uncovered concept set does not equal computed difference",conceptId:null});
  for (const id of uncovered) if (!value.steps.some(s=>s.kind === "gap" && s.conceptIds.includes(id))) {
    issues.push({code:"P2",message:"Uncovered concept needs a gap step",conceptId:id}); value.steps.push({kind:"gap",assetId:null,conceptIds:[id],gapReason:"no_candidate"});
  }
  value.uncoveredConceptIds = uncovered;
  const assets = value.steps.filter(s=>s.kind === "asset").map(s=>byId.get(s.assetId!)!.asset);
  const unitCount = assets.reduce((sum,a)=>sum+a.unitCount,0), durationMs=assets.reduce((sum,a)=>sum+a.estimatedDurationMs,0);
  const bounded = value.steps.length <= 24 && unitCount <= 40 && durationMs <= 30_000 && assets.every(a=>Number.isFinite(a.estimatedDurationMs) && a.estimatedDurationMs > 0 && Number.isInteger(a.unitCount) && a.unitCount > 0);
  if (!bounded) issues.push({code:"P5",message:"Plan exceeds step, unit or duration bounds",conceptId:null});
  return { value, issues, bounded, unitCount, durationMs };
}
