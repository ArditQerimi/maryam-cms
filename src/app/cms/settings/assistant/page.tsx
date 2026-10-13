import { requireCmsSession } from '@/lib/cms/session';
import { getT } from '@/lib/i18n/server';
import { getContextDb } from '@/lib/tenant';
import { readAgentHistory, type AgentStepRow } from '@/lib/agent/store';
import { Badge, PageHeader, Table, Td, Th, type BadgeTone } from '@/components/admin/ui';
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
  const { runs, steps, summary } = await readAgentHistory(await getContextDb(), 50);
  const stepsOf = new Map<string, AgentStepRow[]>();
  for (const step of steps) stepsOf.set(step.runId, [...(stepsOf.get(step.runId) ?? []), step]);

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
                        </div>
                      </details>
                    </Td>
                    <Td><Badge tone={STATUS_TONE[run.status] ?? 'neutral'}>{status(run.status)}</Badge></Td>
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
