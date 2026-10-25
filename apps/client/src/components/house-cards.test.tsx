import { INVITE_COPY, NOT_DEALT_COPY } from '@app/core';
import { fireEvent, render, screen } from '@testing-library/react-native';
import { Share } from 'react-native';

import { InviteCard } from './invite-card';
import { NotDealt } from './not-dealt';

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
  it("gives an admin the first steps, and says they're on the web for now", async () => {
    await render(<NotDealt notStarted isAdmin adminName="Priya" />);
    expect(screen.getByRole('header', { name: NOT_DEALT_COPY.notYet })).toBeOnTheScreen();
    for (const [i, step] of NOT_DEALT_COPY.adminSteps.entries()) {
      expect(screen.getByText(`${i + 1}. ${step}`)).toBeOnTheScreen();
    }
    expect(screen.getByText('For now, do these on the web at johns.glyn.dev.')).toBeOnTheScreen();
  });

  it('tells everyone else who to wait for', async () => {
    await render(<NotDealt notStarted isAdmin={false} adminName="Priya" />);
    expect(screen.getByText(NOT_DEALT_COPY.waitingFor('Priya'))).toBeOnTheScreen();
    expect(screen.queryByText(`1. ${NOT_DEALT_COPY.adminSteps[0]}`)).toBeNull();
  });

  it('explains a quiet week in a house that has started', async () => {
    await render(<NotDealt notStarted={false} isAdmin adminName="Priya" />);
    expect(screen.getByRole('header', { name: NOT_DEALT_COPY.nothingThisWeek })).toBeOnTheScreen();
    expect(screen.getByText(NOT_DEALT_COPY.nothingThisWeekBody)).toBeOnTheScreen();
  });
});
