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

const GATEWAYS: Gateway[] = [
  {
    id: 'stripe',
    name: 'Stripe',
    description: 'Cards, Apple Pay and Google Pay via Stripe.',
    icon: CreditCard,
    fields: [
      {
        kind: 'toggle',
        key: 'payment_stripe_enabled',
        label: 'Enable Stripe',
        hint: 'Shows card payment at checkout.',
      },
      {
        kind: 'radio',
        key: 'payment_stripe_mode',
        label: 'Mode',
        options: [
          { value: 'test', label: 'Test mode (test keys)' },
          { value: 'live', label: 'Live mode (real charges)' },
        ],
      },
      {
        kind: 'text',
        key: 'payment_stripe_publishable_key',
        label: 'Publishable key',
        placeholder: 'pk_test_…',
      },
      {
        kind: 'password',
        key: 'payment_stripe_secret_key',
        label: 'Secret key',
        placeholder: 'sk_test_…',
      },
    ],
    save: saveStripeSettings,
  },
  {
    id: 'paypal',
    name: 'PayPal',
    description: 'PayPal wallet and card payments through PayPal.',
    icon: Wallet,
    fields: [
      {
        kind: 'toggle',
        key: 'payment_paypal_enabled',
        label: 'Enable PayPal',
        hint: 'Shows the PayPal button at checkout.',
      },
      {
        kind: 'radio',
        key: 'payment_paypal_mode',
        label: 'Mode',
        options: [
          { value: 'sandbox', label: 'Sandbox (buyer account)' },
          { value: 'live', label: 'Live (real payments)' },
        ],
      },
      {
        kind: 'text',
        key: 'payment_paypal_client_id',
        label: 'Client ID',
        placeholder: 'AX9…',
      },
      { kind: 'password', key: 'payment_paypal_secret', label: 'Secret', placeholder: '••••••••' },
    ],
    save: savePaypalSettings,
  },
  {
    id: 'cod',
    name: 'Cash on delivery',
    description: 'Collect payment when the order is delivered.',
    icon: Banknote,
    fields: [
      {
        kind: 'toggle',
        key: 'payment_cod_enabled',
        label: 'Enable cash on delivery',
        hint: 'Available for shipping zones that allow it.',
      },
      {
        kind: 'textarea',
        key: 'payment_cod_instructions',
        label: 'Instructions',
        rows: 3,
        placeholder: 'Pay with cash when your order is delivered.',
      },
    ],
    save: saveCodSettings,
  },
  {
    id: 'bank',
    name: 'Bank transfer',
    description: 'Manual bank transfer with instructions for the customer.',
    icon: Landmark,
    fields: [
      {
        kind: 'toggle',
        key: 'payment_bank_enabled',
        label: 'Enable bank transfer',
        hint: 'Orders stay “pending” until the payment is confirmed.',
      },
      {
        kind: 'textarea',
        key: 'payment_bank_instructions',
        label: 'Instructions',
        rows: 3,
        placeholder: 'Transfer to the store account…',
      },
      {
        kind: 'text',
        key: 'payment_bank_iban',
        label: 'Account number / IBAN',
        placeholder: 'AL60 2121 1000 0000 0000 1234 5678',
      },
    ],
    save: saveBankSettings,
  },
];

export default async function PaymentsSettingsPage() {
  await requireCmsSession();
  const values = withDefaults(DEFAULTS, await loadSettingsByPrefix('payment_'));

  return (
    <div>
      <PageHeader
        title="Payments"
        description="Enable the gateways you accept and configure their credentials."
      />

      <div className="grid gap-6 lg:grid-cols-2">
        {GATEWAYS.map((gateway) => {
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
                    {enabled ? 'Enabled' : 'Disabled'}
                  </Badge>
                  <span className="text-xs text-zinc-400">
                    Keys are stored server-side and never exposed to the storefront.
                  </span>
                </div>
              }
            >
              <div className="mb-4 flex items-center gap-2 text-[#5b59d6]">
                <Icon size={16} />
                <span className="text-xs font-semibold uppercase tracking-wide">
                  {gateway.name} settings
                </span>
              </div>
              <SettingsForm
                fields={gateway.fields}
                initialValues={values}
                onSubmit={gateway.save}
                saveLabel={`Save ${gateway.name}`}
              />
            </SettingsCard>
          );
        })}
      </div>
    </div>
  );
}
