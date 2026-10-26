import { castVote, raiseDispute } from './disputes';
import { apiPost } from './http';

jest.mock('./http', () => ({ apiPost: jest.fn() }));

const post = apiPost as jest.Mock;
const JOHN = '8f14e45f-ceea-467f-a8f5-2fbf7c2d9b1a';

beforeEach(() => {
  jest.clearAllMocks();
  post.mockResolvedValue({ ok: true });
});

describe('raiseDispute', () => {
  it('sends the John and the tidied reason to the API', async () => {
    await raiseDispute(JOHN, '  Still full  ');
    expect(post).toHaveBeenCalledWith('/api/disputes', { assignmentId: JOHN, reason: 'Still full' }, expect.anything());
  });

  it("says what's wrong before asking the API", async () => {
    await expect(raiseDispute(JOHN, '   ')).rejects.toThrow("Say what’s wrong with it.");
    await expect(raiseDispute(JOHN, 'x'.repeat(281))).rejects.toThrow('Keep it under 280 characters.');
    expect(post).not.toHaveBeenCalled();
  });

  it("passes on the API's refusal", async () => {
    post.mockRejectedValue(new Error("Someone’s already disputing that tick."));
    await expect(raiseDispute(JOHN, 'Still full')).rejects.toThrow("Someone’s already disputing that tick.");
  });
});

describe('castVote', () => {
  it("votes on the dispute's own route", async () => {
    await castVote('d1', true);
    expect(post).toHaveBeenCalledWith('/api/disputes/d1/votes', { uphold: true }, expect.anything());
    await castVote('d1', false);
    expect(post).toHaveBeenLastCalledWith('/api/disputes/d1/votes', { uphold: false }, expect.anything());
  });
});
