import { BIN_NIGHT } from '@app/core';
import { fireEvent, render, screen } from '@testing-library/react-native';

import { Button } from './button';
import { HazardTape } from './hazard-tape';
import { Lid } from './lid';
import { StatusChip } from './status-chip';
import { Heading } from './text';
import { Wordmark } from './wordmark';

// Lids and hazard tape are decoration, hidden from screen readers, so queries
// have to ask for hidden elements to find them.
const HIDDEN = { includeHiddenElements: true };

describe('Bin Night components', () => {
  it('presses a button, and not a disabled one', async () => {
    const onPress = jest.fn();
    const { rerender } = await render(<Button label="Hand out this week's Johns" onPress={onPress} />);
    await fireEvent.press(screen.getByRole('button', { name: "Hand out this week's Johns" }));
    expect(onPress).toHaveBeenCalledTimes(1);

    await rerender(<Button label="Hand out this week's Johns" onPress={onPress} disabled />);
    await fireEvent.press(screen.getByRole('button'));
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('labels the wordmark for screen readers', async () => {
    await render(<Wordmark />);
    expect(screen.getByLabelText('Johns')).toBeOnTheScreen();
  });

  it('announces headings as headings', async () => {
    await render(<Heading>The Table</Heading>);
    expect(screen.getByRole('header', { name: 'The Table' })).toBeOnTheScreen();
  });

  it('says what state a John is in, in the web words', async () => {
    await render(<StatusChip status="checking" />);
    expect(screen.getByText('Done, being checked')).toBeOnTheScreen();
  });

  it('wears missed in hazard', async () => {
    await render(<StatusChip status="missed" />);
    expect(screen.getByTestId('status-missed')).toHaveStyle({ backgroundColor: BIN_NIGHT.light.hazard });
  });

  it('colours a lid by its kind, and an unknown kind as other', async () => {
    const { rerender } = await render(<Lid category="bathroom" />);
    expect(screen.getByTestId('lid', HIDDEN)).toHaveStyle({ backgroundColor: BIN_NIGHT.light.bin.bathroom });
    await rerender(<Lid category="garden" />);
    expect(screen.getByTestId('lid', HIDDEN)).toHaveStyle({ backgroundColor: BIN_NIGHT.light.bin.other });
  });

  it('draws hazard tape', async () => {
    await render(<HazardTape height={6} />);
    expect(screen.getByTestId('hazard-tape', HIDDEN)).toHaveStyle({ height: 6 });
  });
});
