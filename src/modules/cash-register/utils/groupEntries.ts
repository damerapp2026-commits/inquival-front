import type { CashRegisterEntry } from '../../../shared/types';

export interface EntryGroup {
  /** Present when this is a real grouped transaction (>1 entries). */
  groupId?: string;
  /** Denormalized total of the group, taken from any of its entries. */
  total?: number;
  /** Entries that make up the group. For singletons this has length 1. */
  entries: CashRegisterEntry[];
}

export function groupEntries(entries: CashRegisterEntry[]): EntryGroup[] {
  const byId = new Map<string, CashRegisterEntry[]>();
  const singletons: CashRegisterEntry[] = [];

  for (const entry of entries) {
    if (entry.paymentGroupId) {
      const arr = byId.get(entry.paymentGroupId) || [];
      arr.push(entry);
      byId.set(entry.paymentGroupId, arr);
    } else {
      singletons.push(entry);
    }
  }

  const groups: EntryGroup[] = [];
  for (const [groupId, groupEntries] of byId.entries()) {
    if (groupEntries.length === 1) {
      singletons.push(groupEntries[0]);
      continue;
    }
    const total = groupEntries[0].paymentGroupTotal
      ?? groupEntries.reduce((s, e) => s + e.amount, 0);
    groups.push({ groupId, total, entries: groupEntries });
  }

  for (const entry of singletons) {
    groups.push({ entries: [entry] });
  }

  return groups;
}
