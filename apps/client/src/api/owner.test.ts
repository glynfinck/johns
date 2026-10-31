import { qrShape } from './owner';

jest.mock('./http', () => ({ apiPost: jest.fn() }));
jest.mock('./supabase', () => ({ supabase: {} }));

/** The shape Supabase sends: no viewBox, and every square drawn, dark or light. */
const SUPABASE_QR = `<?xml version="1.0"?>
<svg width="30" height="30"
     xmlns="http://www.w3.org/2000/svg"
     xmlns:xlink="http://www.w3.org/1999/xlink">
<rect x="12" y="12" width="3" height="3" class="color" fill="#000000" />
<rect x="15" y="12" width="3" height="3" class="color" fill="#000000" />
<rect x="12" y="15" width="3" height="3" class="bg-color" fill="#FFFFFF" />
<rect x="15" y="15" width="3" height="3" class="color" fill="#000000" />
</svg>`;

describe('qrShape', () => {
  it('keeps the dark squares as one path in a square the size of the drawing, quiet border and all', () => {
    expect(qrShape(SUPABASE_QR)).toEqual({ size: 30, path: 'M12 12h6v3h-6zM15 15h3v3h-3z' });
  });

  it('reads markup that arrives URL-encoded', () => {
    expect(qrShape(encodeURIComponent(SUPABASE_QR))).toEqual(qrShape(SUPABASE_QR));
  });

  it('works out the size from the squares when the drawing has none', () => {
    expect(qrShape(SUPABASE_QR.replace('width="30" height="30"', ''))?.size).toBe(30);
  });

  it('has nothing to draw without dark squares', () => {
    expect(qrShape('<svg width="30" height="30"></svg>')).toBeNull();
  });
});
