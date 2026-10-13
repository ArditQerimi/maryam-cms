'use server';

import { revalidatePath } from 'next/cache';
import { requireCmsSession } from '@/lib/cms/session';
import { getContextDb } from '@/lib/tenant';
import { deleteCorrection, rateRun, saveCorrection, setCorrectionActive, updateCorrection } from '@/lib/agent/store';

/*
 * CMS → AI assistant: staff rate answers and teach the assistant. A correction is the right
 * answer to a question; the assistant follows it for similar questions from then on, and it
 * becomes a test case (scripts/agent-evals.ts).
 */

const PAGE = '/cms/settings/assistant';
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const field = (form: FormData, name: string) => String(form.get(name) ?? '').trim();

export async function rateAnswerAction(form: FormData) {
  await requireCmsSession();
  const runId = field(form, 'runId');
  const rating = Number(field(form, 'rating'));
  if (!UUID.test(runId) || (rating !== 1 && rating !== -1)) return;
  await rateRun(await getContextDb(), runId, 'staff', rating as 1 | -1);
  revalidatePath(PAGE);
}

export async function saveCorrectionAction(form: FormData) {
  const session = await requireCmsSession();
  const runId = field(form, 'runId');
  const question = field(form, 'question');
  const answer = field(form, 'answer');
  if (question.length < 3 || answer.length < 3) return;
  const who = typeof session.name === 'string' && session.name.trim() ? session.name.trim() : typeof session.email === 'string' ? session.email : null;
  await saveCorrection(await getContextDb(), { runId: UUID.test(runId) ? runId : null, question, answer, createdBy: who });
  revalidatePath(PAGE);
}

export async function toggleCorrectionAction(form: FormData) {
  await requireCmsSession();
  const id = Number(field(form, 'id'));
  if (!Number.isSafeInteger(id) || id < 1) return;
  await setCorrectionActive(await getContextDb(), id, field(form, 'active') === 'true');
  revalidatePath(PAGE);
}

export async function deleteCorrectionAction(form: FormData) {
  await requireCmsSession();
  const id = Number(field(form, 'id'));
  if (!Number.isSafeInteger(id) || id < 1) return;
  await deleteCorrection(await getContextDb(), id);
  revalidatePath(PAGE);
}

export async function updateCorrectionAction(form: FormData) {
  await requireCmsSession();
  const id = Number(field(form, 'id'));
  const question = field(form, 'question');
  const answer = field(form, 'answer');
  if (!Number.isSafeInteger(id) || id < 1 || question.length < 3 || answer.length < 3) return;
  await updateCorrection(await getContextDb(), id, { question, answer });
  revalidatePath(PAGE);
}
