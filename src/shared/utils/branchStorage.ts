export const DEFAULT_BRANCH_ID = '000000000000000000000001';
const ACTIVE_BRANCH_KEY = 'inquival:active-branch';

export function getActiveBranchId(): string {
  try { return window.sessionStorage.getItem(ACTIVE_BRANCH_KEY) || DEFAULT_BRANCH_ID; }
  catch { return DEFAULT_BRANCH_ID; }
}

export function setActiveBranchId(id: string) {
  window.sessionStorage.setItem(ACTIVE_BRANCH_KEY, id);
}

export function clearActiveBranch() {
  window.sessionStorage.removeItem(ACTIVE_BRANCH_KEY);
}

export function branchStorageKey(key: string): string {
  const branchId = getActiveBranchId();
  return branchId === DEFAULT_BRANCH_ID ? key : `${key}:${branchId}`;
}
