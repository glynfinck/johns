import { DELETE_COPY, deletionDay, PAGE_TITLE, type DeletionStatus } from '@app/core';
import { useState } from 'react';

import { keepAccount } from '@/api/account';
import { signOut } from '@/api/auth';
import { Alert } from '@/components/alert';
import { Button } from '@/components/button';
import { Door, Sign, SignHeading } from '@/components/front-door/door';
import { PageTitle } from '@/components/page-title';
import { useMembership } from '@/hooks/use-membership';

/**
 * The whole app while an account waits to be deleted: when it goes, and
 * that nothing has gone yet; Keep my account (the one amber button) stops
 * it and opens the app again, and Sign out leaves it to go. Signing in
 * during the 30 days lands here, wherever the link was to.
 */
export function BeingDeleted({ deletion }: { deletion: DeletionStatus }) {
  const { house, refresh } = useMembership();
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);

  async function keep() {
    setBusy(true);
    setProblem(null);
    try {
      await keepAccount();
      await refresh();
    } catch (reason) {
      setProblem(reason instanceof Error ? reason.message : String(reason));
      setBusy(false);
    }
  }

  async function out() {
    setBusy(true);
    try {
      await signOut();
    } catch (reason) {
      console.warn('Sign out failed', reason);
      setBusy(false);
    }
  }

  const body = `${DELETE_COPY.goesOn(deletionDay(deletion.deleteAfter))} ${house ? DELETE_COPY.nothingGone : DELETE_COPY.nothingGoneNoHouse}`;
  return (
    <Door home testID="being-deleted">
      <PageTitle page={PAGE_TITLE.deleteAccount} />
      <Sign>
        <SignHeading title={DELETE_COPY.beingDeleted} body={body} />
        {problem ? <Alert message={problem} /> : null}
        <Button label={DELETE_COPY.keep} disabled={busy} onPress={() => void keep()} testID="keep-account" />
        <Button variant="outline" label={DELETE_COPY.signOut} disabled={busy} onPress={() => void out()} testID="deleted-sign-out" />
      </Sign>
    </Door>
  );
}
