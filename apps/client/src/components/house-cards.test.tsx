import { DEAL_COPY, INVITE_COPY, NOT_DEALT_COPY } from '@app/core';
import { QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen } from '@testing-library/react-native';
import type { ReactElement } from 'react';
import { Share } from 'react-native';

import { dealThisWeek } from '@/api/settings';
import { testQueryClient } from '@/testing/query';

import { InviteCard } from './invite-card';
import { NotDealt } from './not-dealt';

jest.mock('@/api/settings', () => ({ dealThisWeek: jest.fn() }));

/** The deal is a move on the house, so the card needs the app's cache. */
const withCache = (ui: ReactElement) => <QueryClientProvider client={testQueryClient()}>{ui}</QueryClientProvider>;

describe('InviteCard', () => {
  beforeEach(() => jest.restoreAllMocks());

  it('shows the join link and the code to read out', async () => {
    await render(<InviteCard code="AB3DEF7H" houseName="Flat 3" />);
    expect(screen.getByTestId('invite-url')).toHaveTextContent('https://johns.glyn.dev/join/AB3DEF7H');
    expect(screen.getByText('AB3DEF7H')).toBeOnTheScreen();
  });

  it('hands the link to the share sheet', async () => {
    const share = jest.spyOn(Share, 'share').mockResolvedValue({ action: Share.sharedAction, activityType: undefined });
    await render(<InviteCard code="AB3DEF7H" houseName="Flat 3" />);
    await fireEvent.press(screen.getByRole('button', { name: INVITE_COPY.share }));
    expect(share).toHaveBeenCalledWith({
      title: 'Join Flat 3 on Johns',
      message: 'https://johns.glyn.dev/join/AB3DEF7H',
      url: 'https://johns.glyn.dev/join/AB3DEF7H',
    });
  });

  it("doesn't mind a share sheet that's cancelled or missing", async () => {
    jest.spyOn(Share, 'share').mockRejectedValue(new Error('Share is not supported'));
    await render(<InviteCard code="AB3DEF7H" houseName="Flat 3" />);
    await fireEvent.press(screen.getByRole('button', { name: INVITE_COPY.share }));
    expect(screen.getByTestId('invite-url')).toBeOnTheScreen();
  });
});

describe('NotDealt', () => {
  it('gives an admin the first steps, the way to House, and the deal', async () => {
    await render(withCache(<NotDealt houseId="h1" notStarted isAdmin adminName="Priya" />));
    expect(screen.getByRole('header', { name: NOT_DEALT_COPY.notYet })).toBeOnTheScreen();
    for (const [i, step] of NOT_DEALT_COPY.adminSteps.entries()) {
      expect(screen.getByText(`${i + 1}. ${step}`)).toBeOnTheScreen();
    }
    expect(screen.getByRole('link', { name: DEAL_COPY.openHouse })).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole('button', { name: DEAL_COPY.first }));
    expect(dealThisWeek).toHaveBeenCalledWith('h1');
  });

  it("says why the deal didn't happen", async () => {
    (dealThisWeek as jest.Mock).mockRejectedValueOnce(new Error('Add at least one John first.'));
    await render(withCache(<NotDealt houseId="h1" notStarted isAdmin adminName="Priya" />));
    await fireEvent.press(screen.getByRole('button', { name: DEAL_COPY.first }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Add at least one John first.');
  });

  it('tells everyone else who to wait for', async () => {
    await render(withCache(<NotDealt houseId="h1" notStarted isAdmin={false} adminName="Priya" />));
    expect(screen.getByText(NOT_DEALT_COPY.waitingFor('Priya'))).toBeOnTheScreen();
    expect(screen.queryByText(`1. ${NOT_DEALT_COPY.adminSteps[0]}`)).toBeNull();
    expect(screen.queryByRole('button', { name: DEAL_COPY.first })).toBeNull();
  });

  it('explains a quiet week in a house that has started', async () => {
    await render(withCache(<NotDealt houseId="h1" notStarted={false} isAdmin adminName="Priya" />));
    expect(screen.getByRole('header', { name: NOT_DEALT_COPY.nothingThisWeek })).toBeOnTheScreen();
    expect(screen.getByText(NOT_DEALT_COPY.nothingThisWeekBody)).toBeOnTheScreen();
  });
});
