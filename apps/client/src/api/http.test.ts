import { FreshResponse } from '@app/core';

import { getAccessToken } from './auth';
import { apiPost, ApiRequestError } from './http';

jest.mock('./auth', () => ({ getAccessToken: jest.fn() }));

const token = getAccessToken as jest.Mock;
const fetchMock = jest.fn();

beforeAll(() => {
  globalThis.fetch = fetchMock as unknown as typeof fetch;
  process.env.EXPO_PUBLIC_API_URL = 'http://localhost:3205';
});

beforeEach(() => {
  jest.clearAllMocks();
  token.mockResolvedValue('access-token');
});

const reply = (status: number, body: unknown) => ({ ok: status < 400, status, json: async () => body });

describe('apiPost', () => {
  it('posts JSON as the signed-in user and checks the answer', async () => {
    fetchMock.mockResolvedValue(reply(200, { ticked: true }));
    await expect(apiPost('/api/fresh', { houseId: 'h1' }, FreshResponse)).resolves.toEqual({ ticked: true });
    expect(fetchMock).toHaveBeenCalledWith('http://localhost:3205/api/fresh', {
      method: 'POST',
      headers: { Authorization: 'Bearer access-token', 'Content-Type': 'application/json' },
      body: JSON.stringify({ houseId: 'h1' }),
    });
  });

  it("passes on the API's sentence and status when it refuses", async () => {
    fetchMock.mockResolvedValue(reply(404, { error: "That isn't in your house." }));
    const refusal = await apiPost('/api/fresh', {}, FreshResponse).catch((e: unknown) => e);
    expect(refusal).toBeInstanceOf(ApiRequestError);
    expect(refusal).toMatchObject({ message: "That isn't in your house.", status: 404 });
  });

  it('says something general when a refusal has no sentence', async () => {
    fetchMock.mockResolvedValue({ ok: false, status: 502, json: async () => Promise.reject(new Error('not json')) });
    await expect(apiPost('/api/fresh', {}, FreshResponse)).rejects.toMatchObject({
      message: 'Something went wrong. Try again.',
      status: 502,
    });
  });

  it("refuses an answer that isn't the agreed shape", async () => {
    fetchMock.mockResolvedValue(reply(200, { ticked: 'yes' }));
    await expect(apiPost('/api/fresh', {}, FreshResponse)).rejects.toThrow();
  });

  it("doesn't call the API signed out", async () => {
    token.mockResolvedValue(null);
    await expect(apiPost('/api/fresh', {}, FreshResponse)).rejects.toMatchObject({ status: 401 });
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
