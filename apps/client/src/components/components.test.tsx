import { BIN_NIGHT } from '@app/core';
import { fireEvent, render, screen } from '@testing-library/react-native';
import { CameraIcon } from 'lucide-react-native';

import { FONT, LookContext, TAP } from '@/theme';

import { Button } from './button';
import { Choice } from './choice';
import { HazardTape } from './hazard-tape';
import { Lid } from './lid';
import { StatusChip } from './status-chip';
import { Heading } from './text';
import { Toggle } from './toggle';
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

  it('can be just an icon, still named and still a thumb wide', async () => {
    const onPress = jest.fn();
    await render(<Button label="Mark done with a photo" icon={CameraIcon} iconOnly onPress={onPress} />);
    const button = screen.getByRole('button', { name: 'Mark done with a photo' });
    expect(screen.queryByText('Mark done with a photo')).toBeNull();
    expect(button).toHaveStyle({ minWidth: TAP, minHeight: TAP });
    await fireEvent.press(button);
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('dresses a link as a button, keeping its look', async () => {
    await render(<Button href="/signin" label="Start your house" />);
    const link = screen.getByRole('link', { name: 'Start your house' });
    expect(link).toHaveProp('href', '/signin');
    expect(link).toHaveStyle({ minHeight: TAP, backgroundColor: BIN_NIGHT.light.hivis });
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

describe('Choice', () => {
  const options = [
    { value: 1, label: 'Mon', spoken: 'Monday' },
    { value: 2, label: 'Tue', spoken: 'Tuesday' },
  ];

  it('picks one, saying each by its full name', async () => {
    const onChange = jest.fn();
    await render(<Choice label="Week starts" options={options} value={1} onChange={onChange} />);
    expect(screen.getByRole('radio', { name: 'Monday' })).toBeChecked();
    await fireEvent.press(screen.getByRole('radio', { name: 'Tuesday' }));
    expect(onChange).toHaveBeenCalledWith(2);
  });

  it('shows the choice without letting it change when disabled', async () => {
    const onChange = jest.fn();
    await render(<Choice label="Week starts" options={options} value={1} onChange={onChange} disabled />);
    expect(screen.getByRole('radio', { name: 'Monday' })).toBeChecked();
    expect(screen.getByRole('radio', { name: 'Tuesday' })).toBeDisabled();
    await fireEvent.press(screen.getByRole('radio', { name: 'Tuesday' }));
    expect(onChange).not.toHaveBeenCalled();
  });

  it("is labelled as a Field is, its chips in a button's words", async () => {
    await render(<Choice label="Week starts" options={options} value={1} onChange={jest.fn()} />);
    const label = screen.getByText('Week starts');
    expect(label).toHaveStyle({ fontFamily: FONT.bold, fontSize: 16 });
    expect(label).not.toHaveStyle({ textTransform: 'uppercase' });
    expect(screen.getByText('Tue')).toHaveStyle({ fontFamily: FONT.bold, fontSize: 17 });
  });
});

describe('Toggle', () => {
  it('says what it is and what it means, and flips', async () => {
    const onChange = jest.fn();
    await render(<Toggle label="Needs a photo" hint="The tick only counts with a photo." value={false} onChange={onChange} />);
    expect(screen.getByText('The tick only counts with a photo.')).toBeOnTheScreen();
    const toggle = screen.getByRole('switch', { name: 'Needs a photo' });
    expect(toggle).not.toBeChecked();
    await fireEvent(toggle, 'valueChange', true);
    expect(onChange).toHaveBeenCalledWith(true);
  });

  it.each(['light', 'dark'] as const)('stands out from the card when off, in %s', async (scheme) => {
    const colors = BIN_NIGHT[scheme];
    await render(
      <LookContext.Provider value={scheme}>
        <Toggle label="Needs a photo" value={false} onChange={jest.fn()} />
      </LookContext.Provider>,
    );
    const toggle = screen.getByRole('switch', { name: 'Needs a photo' });
    // iOS draws the off track's edge in the tint and fills it behind the thumb.
    expect(toggle).toHaveProp('tintColor', colors.mutedForeground);
    expect(toggle).toHaveStyle({ backgroundColor: colors.mutedForeground });
    expect(toggle).toHaveProp('thumbTintColor', colors.card);
    // WCAG's 3:1 for a control's edge, against the card and the pavement, and the thumb against the track.
    expect(contrast(colors.mutedForeground, colors.card)).toBeGreaterThanOrEqual(3);
    expect(contrast(colors.mutedForeground, colors.background)).toBeGreaterThanOrEqual(3);
  });
});

/** WCAG's contrast ratio between two #rrggbb colours. */
function contrast(a: string, b: string) {
  const [light, dark] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (light + 0.05) / (dark + 0.05);
}

function luminance(hex: string) {
  const [r, g, b] = [1, 3, 5].map((at) => {
    const channel = parseInt(hex.slice(at, at + 2), 16) / 255;
    return channel <= 0.03928 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}
