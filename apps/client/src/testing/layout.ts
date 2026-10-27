import { View, type MeasureLayoutOnSuccessCallback } from 'react-native';

/**
 * Jest lays nothing out, and its Views share one `measureLayout` mock that
 * never answers: from here on, every view measures at `y` (a sheet's anchor,
 * say), until `measureNowhere()`.
 */
export function measureAt(y: number) {
  jest
    .spyOn(View.prototype, 'measureLayout')
    .mockImplementation((...args: unknown[]) => (args[1] as MeasureLayoutOnSuccessCallback)(0, y, 300, 80));
}

/** Back to Jest's own: a measure that never answers. */
export function measureNowhere() {
  jest.spyOn(View.prototype, 'measureLayout').mockReset();
}
