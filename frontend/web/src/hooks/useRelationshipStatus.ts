import { useEffect } from "react";
import { useRelationshipStore } from "../stores/relationshipStore";
import {
  createEmptyRelationshipEntry,
  type RelationshipEntry,
} from "../utils/relationship";

type UseRelationshipStatusOptions = {
  enabled?: boolean;
  currentUserId?: string | null;
};

export function useRelationshipStatus(
  targetUserId: string | null | undefined,
  options: UseRelationshipStatusOptions = {},
) {
  const normalizedTargetUserId = String(targetUserId ?? "").trim();
  const entry = useRelationshipStore(
    (state) =>
      (normalizedTargetUserId
        ? state.entries[normalizedTargetUserId]
        : null) as RelationshipEntry | null | undefined,
  );
  const fetchEntry = useRelationshipStore((state) => state.fetchEntry);

  useEffect(() => {
    if (!options.enabled || !normalizedTargetUserId) {
      return;
    }

    void fetchEntry(normalizedTargetUserId, options.currentUserId);
  }, [fetchEntry, normalizedTargetUserId, options.currentUserId, options.enabled]);

  return {
    relationship: entry ?? createEmptyRelationshipEntry(normalizedTargetUserId),
    refresh: () => {
      if (!normalizedTargetUserId) {
        return Promise.resolve(createEmptyRelationshipEntry(normalizedTargetUserId));
      }
      return fetchEntry(normalizedTargetUserId, options.currentUserId);
    },
  };
}
