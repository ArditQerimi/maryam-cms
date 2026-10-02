'use client';

import Link from 'next/link';
import { useActionState } from 'react';
import { submitBlogComment, type CommentState } from './comment-actions';
import { useLocale } from '@/lib/i18n/LocaleProvider';
import styles from './blog.module.css';

const INITIAL: CommentState = { status: 'idle' };

/** "Leave a Reply" box under a blog post (cream panel, olive button). */
export default function CommentForm({
  postSlug,
  viewerName,
}: {
  postSlug: string;
  /** Signed-in shopper's name; null for guests (they type a name). */
  viewerName: string | null;
}) {
  const { t } = useLocale();
  const [state, action, pending] = useActionState(
    submitBlogComment.bind(null, postSlug),
    INITIAL,
  );

  return (
    <form action={action} className={styles.replyBox} aria-busy={pending}>
      <p className={styles.replyIntro}>
        {viewerName ? (
          <>
            {t('blog.reply.loggedInAs', { name: viewerName })}{' '}
            <Link href="/home/account/profile">{t('blog.reply.editProfile')}</Link>{' '}
          </>
        ) : null}
        {t('blog.reply.required')} <span className={styles.replyRequired}>*</span>
      </p>

      {state.message ? (
        <p className={styles.replyMessage} data-tone={state.status} role="status">
          {state.message}
        </p>
      ) : null}

      {viewerName ? null : (
        <label className={styles.replyField}>
          <span>
            {t('blog.reply.name')} <span className={styles.replyRequired}>*</span>
          </span>
          <input name="name" type="text" required maxLength={120} autoComplete="name" />
        </label>
      )}

      <label className={styles.replyField}>
        <span>
          {t('blog.reply.comment')} <span className={styles.replyRequired}>*</span>
        </span>
        <textarea name="comment" rows={6} required maxLength={2000} />
      </label>

      <button type="submit" className={styles.replyButton} disabled={pending}>
        {pending ? t('blog.reply.posting') : t('blog.reply.post')}
      </button>
    </form>
  );
}
