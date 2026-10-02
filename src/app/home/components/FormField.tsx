import type {
  InputHTMLAttributes,
  ReactNode,
  SelectHTMLAttributes,
  TextareaHTMLAttributes,
} from 'react';
import styles from './form-field.module.css';

type ShellProps = {
  /** Used for `htmlFor`, and `${id}-error` / `${id}-hint` for described-by. */
  id: string;
  label: ReactNode;
  /** Red asterisk after the label. */
  required?: boolean;
  /** Muted "(text)" after the label, e.g. "optional". */
  suffix?: ReactNode;
  /** Keep the label for screen readers only (the placeholder carries the text). */
  hideLabel?: boolean;
  error?: string;
  hint?: ReactNode;
  className?: string;
  children: ReactNode;
};

function cx(...parts: Array<string | false | null | undefined>) {
  return parts.filter(Boolean).join(' ');
}

/** Label + control slot + hint/error. Every storefront form field is built on this. */
export function FieldShell({
  id,
  label,
  required,
  suffix,
  hideLabel,
  error,
  hint,
  className,
  children,
}: ShellProps) {
  return (
    <div className={cx(styles.field, error && styles.fieldInvalid, className)}>
      <label className={cx(styles.label, hideLabel && styles.srOnly)} htmlFor={id}>
        {label}
        {suffix ? <span className={styles.suffix}>{suffix}</span> : null}
        {required ? (
          <span className={styles.requiredMark} aria-hidden="true">*</span>
        ) : null}
      </label>
      {children}
      {hint ? <em className={styles.hint} id={`${id}-hint`}>{hint}</em> : null}
      {error ? <p className={styles.error} id={`${id}-error`}>{error}</p> : null}
    </div>
  );
}

type FieldOptions = Omit<ShellProps, 'children'>;

function describedBy(id: string, error?: string, hint?: ReactNode) {
  const ids = [hint ? `${id}-hint` : '', error ? `${id}-error` : ''].filter(Boolean);
  return ids.length > 0 ? ids.join(' ') : undefined;
}

type TextFieldProps = FieldOptions &
  Omit<InputHTMLAttributes<HTMLInputElement>, 'id' | 'className'> & {
    /** Rendered inside the control, flush right (e.g. a show-password button). */
    adornment?: ReactNode;
  };

export function TextField({
  id,
  label,
  required,
  suffix,
  hideLabel,
  error,
  hint,
  className,
  adornment,
  ...input
}: TextFieldProps) {
  return (
    <FieldShell
      id={id}
      label={label}
      required={required}
      suffix={suffix}
      hideLabel={hideLabel}
      error={error}
      hint={hint}
      className={className}
    >
      <div className={styles.controlWrap}>
        <input
          {...input}
          id={id}
          required={required}
          className={cx(styles.control, Boolean(adornment) && styles.controlWithAdornment)}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy(id, error, hint)}
        />
        {adornment}
      </div>
    </FieldShell>
  );
}

type SelectFieldProps = FieldOptions &
  Omit<SelectHTMLAttributes<HTMLSelectElement>, 'id' | 'className'>;

export function SelectField({
  id,
  label,
  required,
  suffix,
  hideLabel,
  error,
  hint,
  className,
  children,
  ...select
}: SelectFieldProps) {
  return (
    <FieldShell
      id={id}
      label={label}
      required={required}
      suffix={suffix}
      hideLabel={hideLabel}
      error={error}
      hint={hint}
      className={className}
    >
      <select
        {...select}
        id={id}
        required={required}
        className={cx(styles.control, styles.controlSelect)}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy(id, error, hint)}
      >
        {children}
      </select>
    </FieldShell>
  );
}

type TextAreaFieldProps = FieldOptions &
  Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, 'id' | 'className'>;

export function TextAreaField({
  id,
  label,
  required,
  suffix,
  hideLabel,
  error,
  hint,
  className,
  ...textarea
}: TextAreaFieldProps) {
  return (
    <FieldShell
      id={id}
      label={label}
      required={required}
      suffix={suffix}
      hideLabel={hideLabel}
      error={error}
      hint={hint}
      className={className}
    >
      <textarea
        {...textarea}
        id={id}
        required={required}
        className={cx(styles.control, styles.controlTextarea)}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy(id, error, hint)}
      />
    </FieldShell>
  );
}
