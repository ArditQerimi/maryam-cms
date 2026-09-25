'use client';

import { useEffect, useState } from 'react';
import { Check, Pencil, Plus, Trash2, X } from 'lucide-react';
import { toast } from 'sonner';
import { Button, Input, Td, Th, cn, inputClass } from '@/components/admin/ui';
import {
  createTaxRate,
  deleteTaxRate,
  updateTaxRate,
  type TaxRateInput,
} from '@/app/cms/actions/settings';

export type TaxRateRow = {
  id: number;
  country: string;
  state: string;
  postcode: string;
  rate: string;
  name: string;
  shipping: boolean;
  enabled: boolean;
};

type DraftRow = Omit<TaxRateRow, 'id'>;

const EMPTY_DRAFT: DraftRow = {
  country: '',
  state: '',
  postcode: '',
  rate: '0',
  name: 'VAT',
  shipping: false,
  enabled: true,
};

function toInput(row: DraftRow): TaxRateInput {
  return {
    country: row.country,
    state: row.state,
    postcode: row.postcode,
    rate: row.rate,
    name: row.name,
    shipping: row.shipping,
    enabled: row.enabled,
  };
}

function CellInput({
  value,
  onChange,
  placeholder,
  className,
}: {
  value: string;
  onChange: (next: string) => void;
  placeholder?: string;
  className?: string;
}) {
  return (
    <input
      className={cn(inputClass, 'px-2 py-1.5 text-xs', className)}
      value={value}
      placeholder={placeholder}
      onChange={(event) => onChange(event.target.value)}
    />
  );
}

/**
 * CRUD table over the `tax_rates` table with inline editing, a persistent
 * "add rate" row and a two-step delete confirmation.
 */
export default function TaxRatesTable({ initialRows }: { initialRows: TaxRateRow[] }) {
  const [rows, setRows] = useState<TaxRateRow[]>(initialRows);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editDraft, setEditDraft] = useState<DraftRow | null>(null);
  const [addDraft, setAddDraft] = useState<DraftRow>(EMPTY_DRAFT);
  const [confirmDeleteId, setConfirmDeleteId] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setRows(initialRows);
    setEditingId(null);
    setEditDraft(null);
    setConfirmDeleteId(null);
  }, [initialRows]);

  function updateDraft(key: keyof DraftRow, value: string | boolean) {
    setEditDraft((previous) => (previous ? { ...previous, [key]: value } : previous));
  }

  function updateAdd(key: keyof DraftRow, value: string | boolean) {
    setAddDraft((previous) => ({ ...previous, [key]: value }));
  }

  async function handleAdd() {
    if (busy) return;
    setBusy(true);
    try {
      const result = await createTaxRate(toInput(addDraft));
      if (result.ok) {
        toast.success('Tax rate added.');
        setAddDraft(EMPTY_DRAFT);
      } else {
        toast.error(result.error || 'Could not add the tax rate.');
      }
    } finally {
      setBusy(false);
    }
  }

  async function handleSave(id: number) {
    if (busy || !editDraft) return;
    setBusy(true);
    try {
      const result = await updateTaxRate(id, toInput(editDraft));
      if (result.ok) {
        toast.success('Tax rate updated.');
        setEditingId(null);
        setEditDraft(null);
      } else {
        toast.error(result.error || 'Could not update the tax rate.');
      }
    } finally {
      setBusy(false);
    }
  }

  async function handleDelete(id: number) {
    if (busy) return;
    setBusy(true);
    try {
      const result = await deleteTaxRate(id);
      if (result.ok) {
        toast.success('Tax rate deleted.');
      } else {
        toast.error(result.error || 'Could not delete the tax rate.');
      }
    } finally {
      setBusy(false);
      setConfirmDeleteId(null);
    }
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left text-sm">
        <thead>
          <tr>
            <Th>Country</Th>
            <Th>State</Th>
            <Th>Postcode</Th>
            <Th className="text-right">Rate %</Th>
            <Th>Name</Th>
            <Th>On shipping?</Th>
            <Th>Enabled</Th>
            <Th className="text-right">Actions</Th>
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <tr>
              <Td colSpan={8} className="py-8 text-center text-sm text-zinc-500">
                No tax rates yet — add the first one below.
              </Td>
            </tr>
          ) : null}

          {rows.map((row) => {
            const editing = editingId === row.id;
            const draft = editing ? editDraft : null;
            return (
              <tr key={row.id} className="transition hover:bg-zinc-50">
                <Td>
                  {editing && draft ? (
                    <CellInput
                      value={draft.country}
                      onChange={(value) => updateDraft('country', value.toUpperCase())}
                      placeholder="AL"
                      className="w-16 uppercase"
                    />
                  ) : (
                    <span className="font-medium uppercase text-zinc-900">{row.country || '—'}</span>
                  )}
                </Td>
                <Td>
                  {editing && draft ? (
                    <CellInput value={draft.state} onChange={(value) => updateDraft('state', value)} placeholder="—" className="w-20" />
                  ) : (
                    row.state || '—'
                  )}
                </Td>
                <Td>
                  {editing && draft ? (
                    <CellInput value={draft.postcode} onChange={(value) => updateDraft('postcode', value)} placeholder="—" className="w-24" />
                  ) : (
                    row.postcode || '—'
                  )}
                </Td>
                <Td className={cn('text-right', editing ? '' : 'font-medium tabular-nums text-zinc-900')}>
                  {editing && draft ? (
                    <CellInput
                      value={draft.rate}
                      onChange={(value) => updateDraft('rate', value)}
                      className="w-20 text-right"
                    />
                  ) : (
                    `${Number(row.rate).toFixed(2).replace(/\.00$/, '')}%`
                  )}
                </Td>
                <Td>
                  {editing && draft ? (
                    <CellInput value={draft.name} onChange={(value) => updateDraft('name', value)} className="w-32" />
                  ) : (
                    row.name
                  )}
                </Td>
                <Td>
                  <input
                    type="checkbox"
                    className="h-4 w-4 accent-[#6d6be8]"
                    aria-label="Apply to shipping"
                    disabled={!editing}
                    checked={editing && draft ? draft.shipping : row.shipping}
                    onChange={(event) => updateDraft('shipping', event.target.checked)}
                  />
                </Td>
                <Td>
                  <input
                    type="checkbox"
                    className="h-4 w-4 accent-[#6d6be8]"
                    aria-label="Enabled"
                    disabled={!editing}
                    checked={editing && draft ? draft.enabled : row.enabled}
                    onChange={(event) => updateDraft('enabled', event.target.checked)}
                  />
                </Td>
                <Td className="text-right">
                  <div className="flex items-center justify-end gap-1">
                    {editing ? (
                      <>
                        <button
                          type="button"
                          aria-label="Save tax rate"
                          disabled={busy}
                          onClick={() => void handleSave(row.id)}
                          className="rounded p-1.5 text-emerald-600 transition hover:bg-emerald-50 disabled:opacity-50"
                        >
                          <Check size={14} />
                        </button>
                        <button
                          type="button"
                          aria-label="Cancel editing"
                          onClick={() => {
                            setEditingId(null);
                            setEditDraft(null);
                          }}
                          className="rounded p-1.5 text-zinc-400 transition hover:bg-zinc-100 hover:text-zinc-700"
                        >
                          <X size={14} />
                        </button>
                      </>
                    ) : (
                      <>
                        <button
                          type="button"
                          aria-label="Edit tax rate"
                          onClick={() => {
                            setEditingId(row.id);
                            setConfirmDeleteId(null);
                            setEditDraft({
                              country: row.country,
                              state: row.state,
                              postcode: row.postcode,
                              rate: row.rate,
                              name: row.name,
                              shipping: row.shipping,
                              enabled: row.enabled,
                            });
                          }}
                          className="rounded p-1.5 text-zinc-400 transition hover:bg-zinc-100 hover:text-zinc-700"
                        >
                          <Pencil size={14} />
                        </button>
                        {confirmDeleteId === row.id ? (
                          <button
                            type="button"
                            disabled={busy}
                            onClick={() => void handleDelete(row.id)}
                            className="rounded bg-red-600 px-2 py-1 text-[11px] font-medium text-white transition hover:bg-red-700"
                          >
                            Confirm?
                          </button>
                        ) : (
                          <button
                            type="button"
                            aria-label="Delete tax rate"
                            onClick={() => {
                              setEditingId(null);
                              setConfirmDeleteId(row.id);
                            }}
                            className="rounded p-1.5 text-zinc-400 transition hover:bg-red-50 hover:text-red-600"
                          >
                            <Trash2 size={14} />
                          </button>
                        )}
                      </>
                    )}
                  </div>
                </Td>
              </tr>
            );
          })}

          {/* Add rate row */}
          <tr className="bg-zinc-50/70">
            <Td>
              <CellInput
                value={addDraft.country}
                onChange={(value) => updateAdd('country', value.toUpperCase())}
                placeholder="AL"
                className="w-16 uppercase"
              />
            </Td>
            <Td>
              <CellInput value={addDraft.state} onChange={(value) => updateAdd('state', value)} placeholder="—" className="w-20" />
            </Td>
            <Td>
              <CellInput value={addDraft.postcode} onChange={(value) => updateAdd('postcode', value)} placeholder="—" className="w-24" />
            </Td>
            <Td className="text-right">
              <CellInput
                value={addDraft.rate}
                onChange={(value) => updateAdd('rate', value)}
                placeholder="20"
                className="w-20 text-right"
              />
            </Td>
            <Td>
              <CellInput value={addDraft.name} onChange={(value) => updateAdd('name', value)} className="w-32" />
            </Td>
            <Td>
              <input
                type="checkbox"
                className="h-4 w-4 accent-[#6d6be8]"
                aria-label="Apply to shipping"
                checked={addDraft.shipping}
                onChange={(event) => updateAdd('shipping', event.target.checked)}
              />
            </Td>
            <Td>
              <input
                type="checkbox"
                className="h-4 w-4 accent-[#6d6be8]"
                aria-label="Enabled"
                checked={addDraft.enabled}
                onChange={(event) => updateAdd('enabled', event.target.checked)}
              />
            </Td>
            <Td className="text-right">
              <Button size="sm" onClick={() => void handleAdd()} disabled={busy}>
                <Plus size={13} /> Add rate
              </Button>
            </Td>
          </tr>
        </tbody>
      </table>
      <p className="px-4 py-2 text-[11px] text-zinc-400">
        Use the bottom row to add a new rate — country codes are two letters (e.g. AL, MK, DE).
      </p>
    </div>
  );
}
