import { requireCmsSession } from '@/lib/cms/session';
import { getT } from '@/lib/i18n/server';
import { getContextDb } from '@/lib/tenant';
import { listCorrections, readAgentHistory, readAgentReport, readRunExtras, type AgentStepRow } from '@/lib/agent/store';
import { deleteCorrectionAction, rateAnswerAction, saveCorrectionAction, toggleCorrectionAction } from '@/app/cms/actions/agent';
import { Badge, Button, PageHeader, Table, Td, Th, Textarea, Input, type BadgeTone } from '@/components/admin/ui';
import { SettingsCard } from '@/components/settings/SettingsCard';
import type { Dictionary } from '@/lib/i18n/dictionaries/en';

export const dynamic = 'force-dynamic';

const STATUS_TONE: Record<string, BadgeTone> = {
  completed: 'success',
  fallback: 'warning',
  rate_limited: 'warning',
  daily_limit: 'warning',
  max_steps: 'warning',
  failed: 'danger',
  running: 'neutral',
};

/** The assistant's audit trail: every customer message, its steps, time, tokens and errors. */
export default async function AssistantHistoryPage() {
  await requireCmsSession();
  const t = await getT();
  const db = await getContextDb();
  const { runs, steps, summary } = await readAgentHistory(db, 50);
  const [report, corrections, extras] = await Promise.all([
    readAgentReport(db),
    listCorrections(db),
    readRunExtras(db, runs.map((run) => run.id)),
  ]);
  const stepsOf = new Map<string, AgentStepRow[]>();
  for (const step of steps) stepsOf.set(step.runId, [...(stepsOf.get(step.runId) ?? []), step]);
  const ratingOf = (runId: string, source: 'customer' | 'staff') =>
    extras.feedback.find((item) => item.runId === runId && item.source === source)?.rating ?? 0;
  const correctionOf = (runId: string) => extras.corrections.find((item) => item.runId === runId);
  const thumbs = (rating: number) => (rating > 0 ? '👍' : rating < 0 ? '👎' : '');

  const seconds = (ms: number | null) => (ms === null ? '—' : `${(ms / 1000).toFixed(1)} s`);
  const when = (iso: string) => iso.replace('T', ' ').slice(0, 16);
  const status = (value: string) => t(`cmssettings.agentRuns.status.${value}` as keyof Dictionary);
  const answeredShare = summary.runs ? Math.round((summary.completed / summary.runs) * 100) : 0;

  const stats: Array<[string, string]> = [
    [t('cmssettings.agentRuns.messages'), String(summary.runs)],
    [t('cmssettings.agentRuns.answered'), summary.runs ? `${summary.completed} (${answeredShare}%)` : '0'],
    [t('cmssettings.agentRuns.fallbacks'), String(summary.fallback)],
    [t('cmssettings.agentRuns.orders'), String(summary.orders)],
    [t('cmssettings.agentRuns.avgTokens'), summary.avgTokens.toLocaleString('en-US')],
    [t('cmssettings.agentRuns.avgTime'), seconds(summary.avgDurationMs)],
  ];

  return (
    <div>
      <PageHeader title={t('cmssettings.agentRuns.title')} description={t('cmssettings.agentRuns.description')} />
      <div className="max-w-5xl space-y-6">
        <SettingsCard title={t('cmssettings.agentRuns.summaryTitle')}>
          <dl className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
            {stats.map(([label, value]) => (
              <div key={label} className="rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2.5">
                <dt className="text-xs text-zinc-500">{label}</dt>
                <dd className="mt-0.5 text-lg font-semibold text-zinc-900">{value}</dd>
              </div>
            ))}
          </dl>
          <p className="mt-3 text-xs text-zinc-500">{t('cmssettings.agentRuns.privacy')}</p>
        </SettingsCard>

        <SettingsCard title={t('cmssettings.agentRuns.reportTitle')}>
          <div className="mb-4 flex flex-wrap gap-3 text-sm">
            <Badge tone="success">👍 {t('cmssettings.agentRuns.liked')}: {report.liked}</Badge>
            <Badge tone="danger">👎 {t('cmssettings.agentRuns.disliked')}: {report.disliked}</Badge>
          </div>
          <div className="grid gap-6 md:grid-cols-2">
            <div>
              <h3 className="mb-2 text-sm font-semibold text-zinc-800">{t('cmssettings.agentRuns.unansweredTitle')}</h3>
              {report.unanswered.length === 0 ? (
                <p className="text-sm text-zinc-500">{t('cmssettings.agentRuns.nothing')}</p>
              ) : (
                <ul className="space-y-1.5 text-sm">
                  {report.unanswered.map((item, index) => (
                    <li key={index} className="flex gap-2">
                      <Badge tone={STATUS_TONE[item.status] ?? 'neutral'}>{status(item.status)}</Badge>
                      <span className="text-zinc-700">{item.message}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <div>
              <h3 className="mb-1 text-sm font-semibold text-zinc-800">{t('cmssettings.agentRuns.notFoundTitle')}</h3>
              <p className="mb-2 text-xs text-zinc-500">{t('cmssettings.agentRuns.notFoundHint')}</p>
              {report.notFound.length === 0 ? (
                <p className="text-sm text-zinc-500">{t('cmssettings.agentRuns.nothing')}</p>
              ) : (
                <ul className="space-y-1 text-sm">
                  {report.notFound.map((item) => (
                    <li key={item.query} className="flex justify-between gap-3">
                      <span className="text-zinc-700">“{item.query}”</span>
                      <span className="tabular-nums text-zinc-500">× {item.times}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </SettingsCard>

        <SettingsCard title={t('cmssettings.agentRuns.teachTitle')} description={t('cmssettings.agentRuns.teachDescription')}>
          <form action={saveCorrectionAction} className="space-y-3">
            <Input name="question" required minLength={3} maxLength={1000} placeholder={t('cmssettings.agentRuns.question')} aria-label={t('cmssettings.agentRuns.question')} />
            <Textarea name="answer" required minLength={3} maxLength={3000} rows={3} placeholder={t('cmssettings.agentRuns.correctAnswer')} aria-label={t('cmssettings.agentRuns.correctAnswer')} />
            <Button type="submit">{t('cmssettings.agentRuns.saveCorrection')}</Button>
          </form>

          <h3 className="mb-2 mt-6 text-sm font-semibold text-zinc-800">{t('cmssettings.agentRuns.correctionsTitle')} ({corrections.length})</h3>
          {corrections.length === 0 ? (
            <p className="text-sm text-zinc-500">{t('cmssettings.agentRuns.noCorrections')}</p>
          ) : (
            <ul className="divide-y divide-zinc-100 rounded-lg border border-zinc-200">
              {corrections.map((item) => (
                <li key={item.id} className="flex flex-col gap-2 px-3 py-2.5 text-sm sm:flex-row sm:items-start sm:justify-between">
                  <div className={item.active ? '' : 'opacity-50'}>
                    <div className="font-medium text-zinc-800">{item.question}</div>
                    <div className="whitespace-pre-wrap text-zinc-600">→ {item.answer}</div>
                    <div className="mt-0.5 text-xs text-zinc-400">{when(item.createdAt)}{item.createdBy ? ` · ${item.createdBy}` : ''}</div>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <Badge tone={item.active ? 'success' : 'neutral'}>
                      {item.active ? t('cmssettings.agentRuns.activeLabel') : t('cmssettings.agentRuns.inactiveLabel')}
                    </Badge>
                    <form action={toggleCorrectionAction}>
                      <input type="hidden" name="id" value={item.id} />
                      <input type="hidden" name="active" value={item.active ? 'false' : 'true'} />
                      <Button type="submit" variant="outline" size="sm">
                        {item.active ? t('cmssettings.agentRuns.turnOff') : t('cmssettings.agentRuns.turnOn')}
                      </Button>
                    </form>
                    <form action={deleteCorrectionAction}>
                      <input type="hidden" name="id" value={item.id} />
                      <Button type="submit" variant="ghost" size="sm">{t('cmssettings.agentRuns.delete')}</Button>
                    </form>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </SettingsCard>

        <SettingsCard title={t('cmssettings.agentRuns.latest')}>
          {runs.length === 0 ? (
            <p className="text-sm text-zinc-500">{t('cmssettings.agentRuns.empty')}</p>
          ) : (
            <Table bare>
              <thead>
                <tr>
                  <Th>{t('cmssettings.agentRuns.when')}</Th>
                  <Th>{t('cmssettings.agentRuns.channel')}</Th>
                  <Th>{t('cmssettings.agentRuns.message')}</Th>
                  <Th>{t('cmssettings.agentRuns.status')}</Th>
                  <Th className="text-right">{t('cmssettings.agentRuns.steps')}</Th>
                  <Th className="text-right">{t('cmssettings.agentRuns.tokens')}</Th>
                  <Th className="text-right">{t('cmssettings.agentRuns.time')}</Th>
                </tr>
              </thead>
              <tbody>
                {runs.map((run) => (
                  <tr key={run.id} className="align-top">
                    <Td className="whitespace-nowrap text-xs text-zinc-500">{when(run.startedAt)}</Td>
                    <Td className="text-xs">
                      {run.channel}
                      <div className="font-mono text-[10px] text-zinc-400" title={t('cmssettings.agentRuns.chat')}>{run.sessionHash.slice(0, 8)}</div>
                    </Td>
                    <Td className="max-w-md">
                      <details>
                        <summary className="cursor-pointer text-sm text-zinc-800">{run.message.slice(0, 120)}</summary>
                        <div className="mt-2 space-y-2 text-xs">
                          {run.reply ? (
                            <div>
                              <div className="font-semibold text-zinc-600">{t('cmssettings.agentRuns.reply')}</div>
                              <p className="whitespace-pre-wrap text-zinc-700">{run.reply}</p>
                            </div>
                          ) : null}
                          {run.error ? (
                            <div>
                              <div className="font-semibold text-red-700">{t('cmssettings.agentRuns.error')}</div>
                              <p className="whitespace-pre-wrap text-red-700">{run.error}</p>
                            </div>
                          ) : null}
                          <ol className="space-y-1 border-l border-zinc-200 pl-3">
                            {(stepsOf.get(run.id) ?? []).map((step) => (
                              <li key={step.step}>
                                <span className={step.ok ? 'text-zinc-500' : 'text-red-700'}>
                                  {step.step}. {step.kind === 'tool' ? '🔧' : '🧠'} <span className="font-medium">{step.name}</span>
                                  {' · '}{seconds(step.durationMs)}
                                  {step.promptTokens + step.completionTokens > 0 ? ` · ${step.promptTokens + step.completionTokens} tok` : ''}
                                </span>
                                {step.input ? <div className="break-all font-mono text-[11px] text-zinc-500">→ {step.input}</div> : null}
                                {step.output ? <div className="break-all font-mono text-[11px] text-zinc-500">← {step.output}</div> : null}
                              </li>
                            ))}
                          </ol>

                          <div className="flex flex-wrap items-center gap-2 border-t border-zinc-100 pt-2">
                            <span className="text-zinc-500">{t('cmssettings.agentRuns.rating')}:</span>
                            {([1, -1] as const).map((value) => (
                              <form key={value} action={rateAnswerAction}>
                                <input type="hidden" name="runId" value={run.id} />
                                <input type="hidden" name="rating" value={value} />
                                <Button
                                  type="submit"
                                  size="sm"
                                  variant={ratingOf(run.id, 'staff') === value ? 'primary' : 'outline'}
                                  title={value > 0 ? t('cmssettings.agentRuns.rateGood') : t('cmssettings.agentRuns.rateBad')}
                                >
                                  {value > 0 ? '👍' : '👎'}
                                </Button>
                              </form>
                            ))}
                            {ratingOf(run.id, 'customer') !== 0 ? (
                              <span className="text-zinc-500">
                                {t('cmssettings.agentRuns.customerRated', { rating: thumbs(ratingOf(run.id, 'customer')) })}
                              </span>
                            ) : null}
                          </div>

                          <form action={saveCorrectionAction} className="space-y-2">
                            <input type="hidden" name="runId" value={run.id} />
                            <input type="hidden" name="question" value={run.message} />
                            <div className="font-semibold text-zinc-600">{t('cmssettings.agentRuns.fixThis')}</div>
                            <Textarea name="answer" rows={3} required minLength={3} maxLength={3000} defaultValue={correctionOf(run.id)?.answer ?? ''} className="text-xs" />
                            <Button type="submit" size="sm">{t('cmssettings.agentRuns.saveCorrection')}</Button>
                          </form>
                        </div>
                      </details>
                    </Td>
                    <Td>
                      <Badge tone={STATUS_TONE[run.status] ?? 'neutral'}>{status(run.status)}</Badge>
                      <div className="mt-1 text-xs">
                        {thumbs(ratingOf(run.id, 'customer'))}
                        {thumbs(ratingOf(run.id, 'staff'))}
                        {correctionOf(run.id) ? ` ✏️ ${t('cmssettings.agentRuns.corrected')}` : ''}
                      </div>
                    </Td>
                    <Td className="text-right tabular-nums">{run.steps}</Td>
                    <Td className="text-right tabular-nums">{(run.promptTokens + run.completionTokens).toLocaleString('en-US')}</Td>
                    <Td className="text-right tabular-nums">{seconds(run.durationMs)}</Td>
                  </tr>
                ))}
              </tbody>
            </Table>
          )}
        </SettingsCard>
      </div>
    </div>
  );
}
