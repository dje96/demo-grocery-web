/**
 * Intervention eligibility (pull-path fallback).
 *
 * The push path (Signals SSE → handler → CustomEvent, see snowplow-config.ts)
 * is primary. This pull fallback re-derives eligibility from the SAME live
 * Signals attributes the Inspector reads, against the clauses declared in
 * `siteConfig.snowplow.interventionClauses`. It covers cases where the push SSE
 * lags or fails. Keep the clauses here in lock-step with the published
 * intervention recipe in Console.
 */

import { siteConfig, type InterventionClause } from './config';

type Attrs = Record<string, unknown> | null;

function unwrap(v: unknown): unknown {
  return Array.isArray(v) && v.length === 1 ? v[0] : v;
}

function readNumber(attrs: Attrs, key: string): number | null {
  if (!attrs) return null;
  const v = unwrap(attrs[key]);
  if (typeof v === 'number') return v;
  if (typeof v === 'string' && v.trim() !== '' && !Number.isNaN(Number(v))) {
    return Number(v);
  }
  return null;
}

function clauseMet(clause: InterventionClause, attrs: Attrs): boolean {
  const value = readNumber(attrs, clause.attribute) ?? 0;
  switch (clause.operator) {
    case 'gte': return value >= clause.threshold;
    case 'gt': return value > clause.threshold;
    case 'lte': return value <= clause.threshold;
    case 'lt': return value < clause.threshold;
    case 'eq': return value === clause.threshold;
    default: return false;
  }
}

/** True when EVERY configured clause is satisfied by the live attributes. */
export function isInterventionEligible(attrs: Attrs): boolean {
  const clauses = siteConfig.snowplow.interventionClauses;
  if (!clauses.length) return false;
  return clauses.every((c) => clauseMet(c, attrs));
}
