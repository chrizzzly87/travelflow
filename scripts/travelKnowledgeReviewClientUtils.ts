import type { SupabaseClient } from '@supabase/supabase-js';
import type { TravelKnowledgeReviewedChange } from './travelKnowledgeArtifactUtils';

interface CandidateRow {
  id: string;
  target_kind: string;
  target_key: string;
  field_path: string;
  change_kind: TravelKnowledgeReviewedChange['changeKind'];
}

interface DecisionRow {
  id: string;
  candidate_id: string;
  decision: 'accept' | 'accept_with_edit';
  accepted_value: unknown;
  reviewed_at: string;
}

export const loadTravelKnowledgeReviewedChanges = async (
  client: SupabaseClient,
  countryCode = 'TH',
): Promise<TravelKnowledgeReviewedChange[]> => {
  const { data: candidates, error: candidateError } = await client
    .from('travel_change_candidates')
    .select('id,target_kind,target_key,field_path,change_kind')
    .eq('country_code', countryCode)
    .eq('status', 'accepted')
    .order('id', { ascending: true });
  if (candidateError) throw new Error(`Could not load accepted candidates: ${candidateError.message}`);
  const typedCandidates = (candidates ?? []) as CandidateRow[];
  if (typedCandidates.length === 0) return [];
  const candidateIds = typedCandidates.map((candidate) => candidate.id);
  const { data: decisions, error: decisionError } = await client
    .from('travel_review_decisions')
    .select('id,candidate_id,decision,accepted_value,reviewed_at')
    .in('candidate_id', candidateIds)
    .in('decision', ['accept', 'accept_with_edit'])
    .order('reviewed_at', { ascending: true });
  if (decisionError) throw new Error(`Could not load review decisions: ${decisionError.message}`);
  const latestDecisionByCandidate = new Map<string, DecisionRow>();
  for (const decision of (decisions ?? []) as DecisionRow[]) {
    latestDecisionByCandidate.set(decision.candidate_id, decision);
  }
  return typedCandidates.map((candidate) => {
    const decision = latestDecisionByCandidate.get(candidate.id);
    if (!decision) throw new Error(`Accepted candidate ${candidate.id} has no terminal accept decision.`);
    return {
      candidateId: candidate.id,
      decisionId: decision.id,
      targetKind: candidate.target_kind,
      targetKey: candidate.target_key,
      fieldPath: candidate.field_path,
      changeKind: candidate.change_kind,
      acceptedValue: decision.accepted_value,
    };
  });
};
