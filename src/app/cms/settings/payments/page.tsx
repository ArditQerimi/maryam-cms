import { CreditCard, Landmark, Wallet, Banknote } from 'lucide-react';
import { requireCmsSession } from '@/lib/cms/session';
import { Badge, PageHeader } from '@/components/admin/ui';
import { SettingsCard } from '@/components/settings/SettingsCard';
import SettingsForm from '@/components/settings/SettingsForm';
import {
  loadSettingsByPrefix,
  saveBankSettings,
  saveCodSettings,
  savePaypalSettings,
  saveStripeSettings,
} from '@/app/cms/actions/settings';
import { withDefaults, type SettingField, type SettingsValues } from '@/components/settings/types';
import { getT, type Translator } from '@/lib/i18n/server';

export const dynamic = 'force-dynamic';

const DEFAULTS: SettingsValues = {
  payment_stripe_enabled: false,
  payment_stripe_mode: 'test',
  payment_stripe_publishable_key: '',
  payment_stripe_secret_key: '',
  payment_paypal_enabled: false,
  payment_paypal_mode: 'sandbox',
  payment_paypal_client_id: '',
  payment_paypal_secret: '',
  payment_cod_enabled: false,
  payment_cod_instructions: 'Pay with cash when your order is delivered.',
  payment_bank_enabled: false,
  payment_bank_instructions: 'Transfer to the store account and include the order number as reference.',
  payment_bank_iban: '',
};

type Gateway = {
  id: string;
  name: string;
  description: string;
  icon: React.ComponentType<{ size?: number }>;
  fields: SettingField[];
  save: typeof saveStripeSettings;
};

function buildGateways(t: Translator): Gateway[] {
  return [
  {
    id: 'stripe',
    name: t('cmssettings.payments.stripeName'),
    description: t('cmssettings.payments.stripeDescription'),
    icon: CreditCard,
    fields: [
      {
        kind: 'toggle',
        key: 'payment_stripe_enabled',
        label: t('cmssettings.payments.stripeEnableLabel'),
        hint: t('cmssettings.payments.stripeEnableHint'),
      },
      {
        kind: 'radio',
        key: 'payment_stripe_mode',
        label: t('cmssettings.payments.modeLabel'),
        options: [
          { value: 'test', label: t('cmssettings.payments.stripeModeTest') },
          { value: 'live', label: t('cmssettings.payments.stripeModeLive') },
        ],
      },
      {
        kind: 'text',
        key: 'payment_stripe_publishable_key',
        label: t('cmssettings.payments.publishableKeyLabel'),
        placeholder: 'pk_test_…',
      },
      {
        kind: 'password',
        key: 'payment_stripe_secret_key',
        label: t('cmssettings.payments.secretKeyLabel'),
        placeholder: 'sk_test_…',
      },
    ],
    save: saveStripeSettings,
  },
  {
    id: 'paypal',
    name: t('cmssettings.payments.paypalName'),
    description: t('cmssettings.payments.paypalDescription'),
    icon: Wallet,
    fields: [
      {
        kind: 'toggle',
        key: 'payment_paypal_enabled',
        label: t('cmssettings.payments.paypalEnableLabel'),
        hint: t('cmssettings.payments.paypalEnableHint'),
      },
      {
        kind: 'radio',
        key: 'payment_paypal_mode',
        label: t('cmssettings.payments.modeLabel'),
        options: [
          { value: 'sandbox', label: t('cmssettings.payments.paypalModeSandbox') },
          { value: 'live', label: t('cmssettings.payments.paypalModeLive') },
        ],
      },
      {
        kind: 'text',
        key: 'payment_paypal_client_id',
        label: t('cmssettings.payments.clientIdLabel'),
        placeholder: 'AX9…',
      },
      {
        kind: 'password',
        key: 'payment_paypal_secret',
        label: t('cmssettings.payments.secretLabel'),
        placeholder: '••••••••',
      },
    ],
    save: savePaypalSettings,
  },
  {
    id: 'cod',
    name: t('cmssettings.payments.codName'),
    description: t('cmssettings.payments.codDescription'),
    icon: Banknote,
    fields: [
      {
        kind: 'toggle',
        key: 'payment_cod_enabled',
        label: t('cmssettings.payments.codEnableLabel'),
        hint: t('cmssettings.payments.codEnableHint'),
      },
      {
        kind: 'textarea',
        key: 'payment_cod_instructions',
        label: t('cmssettings.payments.instructionsLabel'),
        rows: 3,
        placeholder: t('cmssettings.payments.codInstructionsPlaceholder'),
      },
    ],
    save: saveCodSettings,
  },
  {
    id: 'bank',
    name: t('cmssettings.payments.bankName'),
    description: t('cmssettings.payments.bankDescription'),
    icon: Landmark,
    fields: [
      {
        kind: 'toggle',
        key: 'payment_bank_enabled',
        label: t('cmssettings.payments.bankEnableLabel'),
        hint: t('cmssettings.payments.bankEnableHint'),
      },
      {
        kind: 'textarea',
        key: 'payment_bank_instructions',
        label: t('cmssettings.payments.instructionsLabel'),
        rows: 3,
        placeholder: t('cmssettings.payments.bankInstructionsPlaceholder'),
      },
      {
        kind: 'text',
        key: 'payment_bank_iban',
        label: t('cmssettings.payments.ibanLabel'),
        placeholder: 'AL60 2121 1000 0000 0000 1234 5678',
      },
    ],
    save: saveBankSettings,
  },
  ];
}

export default async function PaymentsSettingsPage() {
  await requireCmsSession();
  const t = await getT();
  const values = withDefaults(DEFAULTS, await loadSettingsByPrefix('payment_'));

  return (
    <div>
      <PageHeader
        title={t('cmssettings.payments.title')}
        description={t('cmssettings.payments.description')}
      />

      <div className="grid gap-6 lg:grid-cols-2">
        {buildGateways(t).map((gateway) => {
          const enabled = values[`payment_${gateway.id}_enabled`] === true;
          const Icon = gateway.icon;
          return (
            <SettingsCard
              key={gateway.id}
              title={gateway.name}
              description={gateway.description}
              footer={
                <div className="flex items-center justify-between gap-3">
                  <Badge tone={enabled ? 'success' : 'neutral'}>
                    {enabled
                      ? t('cmssettings.payments.enabled')
                      : t('cmssettings.payments.disabled')}
                  </Badge>
                  <span className="text-xs text-zinc-400">
                    {t('cmssettings.payments.keysFooter')}
                  </span>
                </div>
              }
            >
              <div className="mb-4 flex items-center gap-2 text-[#5b59d6]">
                <Icon size={16} />
                <span className="text-xs font-semibold uppercase tracking-wide">
                  {t('cmssettings.payments.gatewaySettings', { name: gateway.name })}
                </span>
              </div>
              <SettingsForm
                fields={gateway.fields}
                initialValues={values}
                onSubmit={gateway.save}
                saveLabel={t('cmssettings.payments.saveGateway', { name: gateway.name })}
              />
            </SettingsCard>
          );
        })}
      </div>
    </div>
  );
}
