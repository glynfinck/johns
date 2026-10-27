import { raiseFlag } from './flags';
import { apiPost } from './http';

jest.mock('./http', () => ({ apiPost: jest.fn() }));

const post = apiPost as jest.Mock;
const JOHN = '8f14e45f-ceea-467f-a8f5-2fbf7c2d9b1a';
const FLAG = 'c4ca4238-a0b9-4382-8dcc-509a6f75849b';

beforeEach(() => {
  jest.clearAllMocks();
  post.mockResolvedValue({ ok: true, assignmentId: FLAG });
});

describe('raiseFlag', () => {
  it("flags the John through the API and answers the flag's id", async () => {
    await expect(raiseFlag(JOHN)).resolves.toBe(FLAG);
    expect(post).toHaveBeenCalledWith('/api/flags', { johnId: JOHN }, expect.anything());
  });

  it('never sends something that isn’t a John', async () => {
    await expect(raiseFlag('bins')).rejects.toThrow();
    expect(post).not.toHaveBeenCalled();
  });

  it("passes on the API's refusal", async () => {
    post.mockRejectedValue(new Error('Everyone who shares that John is away today.'));
    await expect(raiseFlag(JOHN)).rejects.toThrow('Everyone who shares that John is away today.');
  });
});
