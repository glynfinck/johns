import { FOCUS_SHELL_COPY, PAGE_TITLE, PASS_COPY, SECTION_LABEL } from '@app/core';
import { screen, within } from 'expo-router/testing-library';

import { loadHouse } from '@/api/board';
import { catchUp } from '@/api/house';
import PassScreen from '@/app/(house)/house/pass';
import { snapshot } from '@/testing/house';
import { renderPages, untilRead } from '@/testing/pages';

jest.mock('@/api/board', () => ({ loadHouse: jest.fn() }));
jest.mock('@/api/house', () => ({ catchUp: jest.fn() }));
jest.mock('@/api/supabase', () => ({ supabase: {} }));
jest.mock('@/locale', () => ({ deviceTimeZone: () => 'Europe/London' }));
jest.mock('@/hooks/use-membership', () => ({
  useMembership: () => ({ session: { user: { id: 'priya' } }, house: { id: 'h1', name: 'Flat 3' } }),
}));

const DAY = 86_400_000;

function withPass(pass: ReturnType<typeof snapshot>['house']['pass']) {
  const base = snapshot();
  (loadHouse as jest.Mock).mockResolvedValue({ ...base, house: { ...base.house, pass } });
}

async function open() {
  await renderPages({ 'house/pass': PassScreen }, '/house/pass');
  await untilRead();
}

beforeEach(() => {
  jest.clearAllMocks();
  (loadHouse as jest.Mock).mockResolvedValue(snapshot());
  (catchUp as jest.Mock).mockResolvedValue(false);
});

it('sits under a title bar with the way back to House', async () => {
  await open();
  const bar = within(screen.getByTestId('title-bar'));
  expect(bar.getByRole('header', { name: PAGE_TITLE.pass })).toBeOnTheScreen();
  expect(bar.getByRole('button', { name: FOCUS_SHELL_COPY.backTo(SECTION_LABEL.house) })).toBeOnTheScreen();
});

it('thanks a Founding house, and offers it no plans', async () => {
  await open();
  expect(screen.getByTestId('pass-lead')).toHaveTextContent(PASS_COPY.foundingLead);
  expect(screen.getByTestId('pass-line')).toHaveTextContent(PASS_COPY.founding);
  expect(screen.getByText(PASS_COPY.stake)).toBeOnTheScreen();
  expect(screen.queryByTestId('pass-plans')).toBeNull();
  expect(screen.queryByTestId('pass-soon')).toBeNull();
});

it('shows a house on its free month the plans in its own currency, Yearly first, not yet for sale', async () => {
  withPass({ plan: 'trial', until: new Date(Date.now() + 12 * DAY - 60_000), buyerId: null });
  await open();
  expect(screen.getByTestId('pass-lead')).toHaveTextContent(PASS_COPY.lead);
  expect(screen.getByTestId('pass-line')).toHaveTextContent(PASS_COPY.trialLeft(12));
  const plans = within(screen.getByTestId('pass-plans'));
  for (const price of ['£24.99 a year', '£3.49 a month', '£39.99 once']) expect(plans.getByText(price)).toBeOnTheScreen();
  expect(within(screen.getByTestId('plan-yearly')).getByText(PASS_COPY.yearly)).toBeOnTheScreen();
  expect(screen.getByTestId('pass-soon')).toHaveTextContent(PASS_COPY.buyingSoon);
});

it('says who bought it', async () => {
  withPass({ plan: 'yearly', until: new Date(Date.now() + 200 * DAY), buyerId: 'sam' });
  await open();
  expect(screen.getByTestId('pass-line')).toHaveTextContent(PASS_COPY.boughtBy('Sam'), { exact: false });
});
