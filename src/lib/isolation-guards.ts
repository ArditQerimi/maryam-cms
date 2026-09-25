export function ensureTenantContext(companyId: number | null | undefined): number {
  if (!companyId) {
    throw new Error('Company ID not found');
  }

  return companyId;
}

export function ensureScopedRecordAccess(scopedIds: number[], targetId: number, entityLabel: string): void {
  if (!scopedIds.includes(targetId)) {
    throw new Error(`Invalid ${entityLabel} selected`);
  }
}

export function ensureStoreScopedRecord(activeStoreId: number | null, recordStoreId: number | null | undefined, entityLabel: string): void {
  if (!activeStoreId) {
    return;
  }

  if (recordStoreId !== activeStoreId) {
    throw new Error(`${entityLabel} is outside the active store`);
  }
}
