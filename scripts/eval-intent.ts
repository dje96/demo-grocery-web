/**
 * Intent eval — runs the Signals-shaped fixtures through the SAME code the
 * /api/intent route uses (src/lib/intent.ts: state builder → one Jev call →
 * policy), and prints one row per expectation:
 *
 *   fixture · check · expected · got · top p / margin · PASS|FAIL
 *
 * Pass rules:
 *   • Stage (code rules, deriveStage — no Jev): the gate is open and the
 *     derived label is one of the expected ones. Runs offline first.
 *   • Occasion (Jev Choice): the gate is open, an expected label wins, and it
 *     beats the best NON-expected option by ≥ MARGIN. Restock also checks the
 *     code split (weekly / top_up).
 *   • Trait high: the gate is open and the Noul clears its policy threshold
 *     (framing 0.6, plant_based 0.8 — intentPolicy in src/lib/config.ts).
 *   • Trait low (traps): the Noul stays BELOW that threshold.
 *   • Not headline (traps): the persona gate is closed, or the trait isn't
 *     the headline.
 *
 * Run:  npm run eval:intent            (needs TYPESAFE_API_KEY in .env)
 *       npm run eval:intent -- 5 11    (only those fixture ids)
 *       npm run eval:intent -- --state (also print each Jev state)
 *       npm run eval:intent -- --rules (stage rules only — no Jev, no key)
 */

import { TypeSafeClient } from '@typesafe-ai/sdk';

import { intentPolicy } from '@/lib/config';
import {
  buildIntentInputs,
  deriveStage,
  evaluateIntent,
  type IntentEvaluation,
} from '@/lib/intent';

import { FIXTURES, compileFixture, type CompiledFixture } from './intent-fixtures';

/** "Clear margin" between the expected option and the runner-up. */
const MARGIN = 0.15;

interface Row {
  fixture: string;
  check: string;
  expected: string;
  got: string;
  prob: string;
  pass: boolean;
}

const pct = (n: number) => `${Math.round(n * 100)}%`;

function topTwo(probs: Record<string, number>): [string, number, number] {
  const sorted = Object.entries(probs).sort((a, b) => b[1] - a[1]);
  return [sorted[0][0], sorted[0][1], sorted[1]?.[1] ?? 0];
}

/** Stage is pure code: no probabilities, just the rule that fired. */
function checkStage(f: CompiledFixture): Row | null {
  if (!f.expect.stage) return null;
  const expected = Array.isArray(f.expect.stage) ? f.expect.stage : [f.expect.stage];
  const s = deriveStage(buildIntentInputs(f.attributes, f.timeline));
  return {
    fixture: fixtureLabel(f),
    check: 'stage (rules)',
    expected: expected.join('|'),
    got: s.enough_signal ? s.label : 'not enough signal',
    prob: s.rule,
    pass: s.enough_signal && expected.includes(s.label),
  };
}

function checkOccasion(fixture: string, expected: string, r: IntentEvaluation): Row {
  const check = 'occasion';
  const res = r.occasion;
  const accepted = (Array.isArray(expected) ? expected : [expected]).map((e) => e.split(':'));
  const labels = accepted.map(([l]) => l);
  const expSplit = accepted[0][1];
  const [, topP] = topTwo(res.probabilities);
  // Margin = the winner over the best option that is NOT acceptable.
  const bestOther = Math.max(
    0,
    ...Object.entries(res.probabilities)
      .filter(([l]) => !labels.includes(l))
      .map(([, p]) => p)
  );
  const margin = topP - bestOther;
  const split = r.occasion.restock_split;
  const got = !res.enough_signal
    ? 'not enough signal'
    : split
      ? `${res.jev_choice}:${split}`
      : res.jev_choice;
  const pass =
    res.enough_signal &&
    labels.includes(res.jev_choice) &&
    margin >= MARGIN &&
    (!expSplit || split === expSplit);
  return {
    fixture,
    check,
    expected: Array.isArray(expected) ? expected.join('|') : expected,
    got,
    prob: `${pct(topP)} / +${pct(margin)}`,
    pass,
  };
}

function threshold(trait: string): number {
  return trait === 'plant_based'
    ? intentPolicy.plantBasedThreshold
    : intentPolicy.personaFramingThreshold;
}

function checkTrait(
  fixture: string,
  trait: string,
  high: boolean,
  r: IntentEvaluation
): Row {
  const p = r.persona.traits[trait];
  const t = threshold(trait);
  const pass = high ? r.persona.enough_signal && p >= t : p < t;
  return {
    fixture,
    check: trait,
    expected: `${high ? '≥' : '<'} ${pct(t)}`,
    got: r.persona.enough_signal ? pct(p) : `${pct(p)} (gated)`,
    prob: pct(p),
    pass,
  };
}

function fixtureLabel(f: CompiledFixture): string {
  return `${String(f.id).padStart(3)} ${f.name}`;
}

function rowsFor(f: CompiledFixture, r: IntentEvaluation): Row[] {
  const label = fixtureLabel(f);
  const rows: Row[] = [];
  if (f.expect.occasion) rows.push(checkOccasion(label, f.expect.occasion, r));
  for (const t of f.expect.traitsHigh ?? []) rows.push(checkTrait(label, t, true, r));
  for (const t of f.expect.traitsLow ?? []) rows.push(checkTrait(label, t, false, r));
  if (f.expect.notHeadline) {
    const gated = !r.persona.enough_signal;
    const p = r.persona.traits[f.expect.notHeadline];
    rows.push({
      fixture: label,
      check: 'headline',
      expected: `not ${f.expect.notHeadline}`,
      got: gated ? 'not enough signal' : r.persona.label,
      prob: pct(p),
      pass: gated || r.persona.label !== f.expect.notHeadline,
    });
  }
  return rows;
}

function printTable(rows: Row[]) {
  const head = ['fixture', 'check', 'expected', 'got', 'top p / margin · rule', 'result'];
  const body = rows.map((r) => [
    r.fixture.length > 52 ? `${r.fixture.slice(0, 51)}…` : r.fixture,
    r.check,
    r.expected,
    r.got,
    r.prob,
    r.pass ? 'PASS' : 'FAIL',
  ]);
  const widths = head.map((h, i) => Math.max(h.length, ...body.map((b) => b[i].length)));
  const line = (cells: string[]) => cells.map((c, i) => c.padEnd(widths[i])).join(' │ ');
  console.log(line(head));
  console.log(widths.map((w) => '─'.repeat(w)).join('─┼─'));
  for (const b of body) console.log(line(b));
}

function finish(rows: Row[], suffix: string): never {
  console.log('');
  printTable(rows);
  const passed = rows.filter((r) => r.pass).length;
  console.log(`\n${passed}/${rows.length} checks passed${suffix}`);
  process.exit(passed === rows.length ? 0 : 1);
}

async function main() {
  const args = process.argv.slice(2);
  const showState = args.includes('--state');
  const rulesOnly = args.includes('--rules');
  const ids = args.filter((a) => !a.startsWith('--'));
  const fixtures = FIXTURES.filter((f) => ids.length === 0 || ids.includes(String(f.id))).map(
    compileFixture
  );

  // Stage rules first — pure code, no Jev.
  const rows: Row[] = fixtures.map(checkStage).filter((r): r is Row => r !== null);
  if (rulesOnly) finish(rows, ' · stage rules only');

  try {
    process.loadEnvFile('.env');
  } catch {
    /* no .env — rely on the environment */
  }
  const apiKey = (process.env.TYPESAFE_API_KEY ?? '').trim();
  if (!apiKey || apiKey.startsWith('[')) {
    console.error('TYPESAFE_API_KEY is not set (.env or environment). Use --rules for stage only.');
    process.exit(2);
  }

  const client = new TypeSafeClient({ apiKey });
  let model = '';
  let tokens = 0;

  for (const f of fixtures) {
    const inputs = buildIntentInputs(f.attributes, f.timeline);
    const r = await evaluateIntent(client, inputs);
    model = r.model;
    tokens += r.usage.input_tokens + r.usage.output_tokens;
    if (showState) {
      console.log(`\n── fixture ${f.id} state ──`);
      console.log(JSON.stringify(inputs.state, null, 2));
    }
    console.log(
      `#${f.id}: stage ${r.stage.label} (${r.stage.rule}) · occasion ${r.occasion.label} · persona ${r.persona.headline}`
    );
    rows.push(...rowsFor(f, r));
  }

  finish(rows, ` · ${model} · ${tokens} tokens`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
