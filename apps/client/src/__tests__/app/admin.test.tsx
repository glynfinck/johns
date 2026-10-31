import { ADMIN_COPY, NOT_FOUND_COPY, type AuditEntry, type Notice } from '@app/core';
import { fireEvent, screen, waitFor, within } from 'expo-router/testing-library';
import { useWindowDimensions } from 'react-native';

import { auditEntry, auditPage, endNotice, enrollFactor, ownerNotices, ownerStatus, saveNotice, verifiedFactor } from '@/api/owner';
import AdminLayout from '@/app/admin/_layout';
import AuditEntryPage from '@/app/admin/audit/[id]';
import AuditPage from '@/app/admin/audit/index';
import AdminIndex from '@/app/admin/index';
import NoticesPage from '@/app/admin/notices';
import { renderPages, untilRead } from '@/testing/pages';

jest.mock('@/api/owner', () => ({
  ownerStatus: jest.fn(),
  verifiedFactor: jest.fn(),
  enrollFactor: jest.fn(),
  checkCode: jest.fn(),
  ownerNotices: jest.fn(),
  saveNotice: jest.fn(),
  endNotice: jest.fn(),
  auditPage: jest.fn(),
  auditEntry: jest.fn(),
}));
jest.mock('@/api/supabase', () => ({ supabase: {} }));
jest.mock('react-native/Libraries/Utilities/useWindowDimensions', () => ({ __esModule: true, default: jest.fn() }));
jest.mock('@/hooks/use-membership', () => ({
  useMembership: () => ({ session: { user: { id: 'owner' } }, house: null, refresh: jest.fn() }),
}));

const PHONE = { width: 390, height: 844, scale: 3, fontScale: 1 };
const LAPTOP = { width: 1440, height: 900, scale: 1, fontScale: 1 };

const notice = (over: Partial<Notice>): Notice => ({
  id: 'n1',
  kind: 'status',
  title: 'Jonz is slow right now',
  body: 'Our database host is fixing a problem.',
  linkLabel: null,
  linkUrl: null,
  startsAt: '2026-10-30T16:05:00Z',
  endsAt: null,
  ...over,
});
const SLOW = notice({});
const LATER = notice({ id: 'n2', kind: 'news', title: 'Jonz is on iPhone and Android', startsAt: '2099-02-09T09:00:00Z' });
const OLD = notice({ id: 'n3', kind: 'offer', title: 'Beta week', startsAt: '2026-10-01T09:00:00Z', endsAt: '2026-10-08T09:00:00Z' });

const entry = (id: number, over: Partial<AuditEntry> = {}): AuditEntry => ({
  id,
  at: '2026-10-30T16:41:07Z',
  actor: 'owner',
  action: 'notice.save',
  targetKind: 'notice',
  targetId: 'n1',
  reason: null,
  before: { kind: 'status', title: 'Ticks may be slow' },
  after: { kind: 'status', title: 'Jonz is slow right now' },
  ...over,
});

const ROUTES = {
  'admin/_layout': AdminLayout,
  'admin/index': AdminIndex,
  'admin/notices': NoticesPage,
  'admin/audit/index': AuditPage,
  'admin/audit/[id]': AuditEntryPage,
};

beforeEach(() => {
  (useWindowDimensions as jest.Mock).mockReturnValue(PHONE);
  jest.mocked(ownerStatus).mockResolvedValue({ owner: true, mfa: true });
  jest.mocked(ownerNotices).mockResolvedValue([SLOW, LATER, OLD]);
  jest.mocked(saveNotice).mockResolvedValue({ id: 'n9', copied: true });
  jest.mocked(endNotice).mockResolvedValue({ copied: true });
  jest.mocked(auditPage).mockResolvedValue({ entries: [entry(2), entry(1, { before: null, actor: 'someone-else' })], more: false });
  jest.mocked(auditEntry).mockResolvedValue(entry(2));
});

describe('who gets in', () => {
  it('shows anyone who is not the owner the page that is not there', async () => {
    jest.mocked(ownerStatus).mockResolvedValue({ owner: false, mfa: true });
    await renderPages(ROUTES, '/admin/notices');
    expect(await screen.findByText(NOT_FOUND_COPY.title)).toBeVisible();
    expect(ownerNotices).not.toHaveBeenCalled();
  });

  it('asks the owner for their code before anything else', async () => {
    jest.mocked(ownerStatus).mockResolvedValue({ owner: true, mfa: false });
    jest.mocked(verifiedFactor).mockResolvedValue('f1');
    await renderPages(ROUTES, '/admin/notices');
    expect(await screen.findByTestId('code-gate')).toBeVisible();
    expect(screen.getByText(ADMIN_COPY.codeTitle)).toBeVisible();
    expect(ownerNotices).not.toHaveBeenCalled();
  });

  it('adds the authenticator the first time: the QR code drawn to fit its square, and the key to type', async () => {
    jest.mocked(ownerStatus).mockResolvedValue({ owner: true, mfa: false });
    jest.mocked(verifiedFactor).mockResolvedValue(null);
    jest.mocked(enrollFactor).mockResolvedValue({
      id: 'f1',
      qr: { size: 30, path: 'M12 12h6v3h-6z' },
      secret: 'JBSWY3DPEHPK3PXP',
      uri: 'otpauth://totp/Jonz:owner?secret=JBSWY3DPEHPK3PXP',
    });
    await renderPages(ROUTES, '/admin/notices');
    expect(await screen.findByTestId('admin-qr')).toBeVisible();
    expect(screen.getByText(ADMIN_COPY.lockTitle)).toBeVisible();
    expect(screen.getByTestId('admin-key')).toHaveTextContent('JBSW Y3DP EHPK 3PXP');
  });

  it('opens /admin on the notices', async () => {
    await renderPages(ROUTES, '/admin');
    expect(await screen.findByTestId('admin-notices')).toBeVisible();
  });
});

describe('notices on a phone', () => {
  it('shows what people see now, then each notice by whether it is showing, later or over, with tabs at the bottom', async () => {
    await renderPages(ROUTES, '/admin/notices');
    await untilRead();
    expect(within(screen.getByTestId('what-people-see')).getByText('Jonz is slow right now')).toBeVisible();
    expect(within(screen.getByTestId('notices-showing')).getByTestId('notice-row-n1')).toBeVisible();
    expect(within(screen.getByTestId('notices-later')).getByTestId('notice-row-n2')).toBeVisible();
    expect(screen.getByText(ADMIN_COPY.endedCount(1))).toBeVisible();
    expect(screen.getByTestId('admin-tabs')).toBeVisible();
    expect(screen.queryByTestId('admin-rail')).toBeNull();
  });

  it('edits a notice in a sheet, and ends it', async () => {
    await renderPages(ROUTES, '/admin/notices');
    await untilRead();
    expect(screen.queryByTestId('notice-editor')).toBeNull();
    await fireEvent.press(screen.getByTestId('notice-row-n1'));
    const sheet = await screen.findByTestId('notice-sheet');
    expect(within(sheet).getByDisplayValue('Jonz is slow right now')).toBeVisible();
    await fireEvent.press(within(sheet).getByTestId('notice-end'));
    await waitFor(() => expect(endNotice).toHaveBeenCalledWith('n1'));
    expect(await screen.findByText(ADMIN_COPY.ended)).toBeVisible();
  });

  it('writes a new notice and says so when the copy for outages did not update', async () => {
    jest.mocked(saveNotice).mockResolvedValue({ id: 'n9', copied: false });
    await renderPages(ROUTES, '/admin/notices');
    await untilRead();
    await fireEvent.press(screen.getByTestId('start-status'));
    const sheet = await screen.findByTestId('notice-sheet');
    await fireEvent.changeText(within(sheet).getByTestId('notice-title'), 'Ticks may be slow');
    await fireEvent.press(within(sheet).getByTestId('notice-save'));
    await waitFor(() => expect(saveNotice).toHaveBeenCalledWith(expect.objectContaining({ id: null, kind: 'status', title: 'Ticks may be slow' })));
    expect(await screen.findByText(ADMIN_COPY.copyFailed)).toBeVisible();
  });
});

describe('starting a notice', () => {
  it('starts from what is happening: Something is wrong offers the outage words, News starts as news', async () => {
    await renderPages(ROUTES, '/admin/notices');
    await untilRead();
    await fireEvent.press(screen.getByTestId('start-status'));
    let sheet = await screen.findByTestId('notice-sheet');
    expect(within(sheet).getByText(ADMIN_COPY.start.status.title)).toBeVisible();
    expect(within(sheet).getByText(ADMIN_COPY.startFrom)).toBeVisible();
    await fireEvent.press(within(sheet).getByLabelText('Close'));
    await fireEvent.press(screen.getByTestId('start-news'));
    sheet = await screen.findByTestId('notice-sheet');
    expect(within(sheet).getByRole('header', { name: ADMIN_COPY.start.news.title })).toBeVisible();
    expect(within(sheet).getByRole('radio', { name: 'News' })).toBeChecked();
    expect(within(sheet).queryByText(ADMIN_COPY.startFrom)).toBeNull();
  });
});

describe('notices on a laptop', () => {
  beforeEach(() => (useWindowDimensions as jest.Mock).mockReturnValue(LAPTOP));

  it('has the rail, and the editor in the side panel', async () => {
    await renderPages(ROUTES, '/admin/notices');
    await untilRead();
    expect(screen.getByTestId('admin-rail')).toBeVisible();
    expect(screen.queryByTestId('admin-tabs')).toBeNull();
    const side = screen.getByTestId('notice-side');
    expect(within(side).getByText(ADMIN_COPY.start.status.title)).toBeVisible();
    await fireEvent.press(screen.getByTestId('notice-row-n2'));
    expect(await within(screen.getByTestId('notice-side')).findByDisplayValue('Jonz is on iPhone and Android')).toBeVisible();
  });
});

describe('the audit log', () => {
  it('lists entries by day, yours with what you did, and opens one as its own page on a phone', async () => {
    await renderPages(ROUTES, '/admin/audit');
    await untilRead();
    expect(screen.getByText('You changed a status notice')).toBeVisible();
    expect(screen.getByText('The owner wrote a status notice')).toBeVisible();
    await fireEvent.press(screen.getByTestId('audit-row-2'));
    expect(await screen.findByTestId('audit-detail-2')).toBeVisible();
    expect(auditEntry).toHaveBeenCalledWith(2);
    expect(screen.getByText('Ticks may be slow')).toBeVisible();
    expect(screen.getByText(ADMIN_COPY.appendOnly)).toBeVisible();
  });

  it('shows the chosen entry beside the list on a laptop', async () => {
    (useWindowDimensions as jest.Mock).mockReturnValue(LAPTOP);
    await renderPages(ROUTES, '/admin/audit');
    await untilRead();
    expect(screen.getByTestId('audit-detail-2')).toBeVisible();
    await fireEvent.press(screen.getByTestId('audit-row-1'));
    expect(await screen.findByTestId('audit-detail-1')).toBeVisible();
  });

  it('reads older entries as you scroll near the end, from the last one shown', async () => {
    jest.mocked(auditPage).mockImplementation(async (before) =>
      before === null ? { entries: [entry(80), entry(79)], more: true } : { entries: [entry(12)], more: false },
    );
    await renderPages(ROUTES, '/admin/audit');
    await untilRead();
    expect(screen.getByTestId('audit-older')).toBeVisible();
    await fireEvent.scroll(screen.getByTestId('page-scroll'), {
      nativeEvent: { contentOffset: { y: 300 }, contentSize: { height: 1200 }, layoutMeasurement: { height: 800 } },
    });
    await waitFor(() => expect(auditPage).toHaveBeenLastCalledWith(79));
    expect(await screen.findByTestId('audit-row-12')).toBeVisible();
    expect(screen.queryByTestId('audit-older')).toBeNull();
  });
});
