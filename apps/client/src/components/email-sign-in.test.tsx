import { EMAIL_SIGN_IN_COPY as COPY } from '@app/core';
import { fireEvent, render, screen } from '@testing-library/react-native';

import {
  confirmEmail,
  resendSignUpCode,
  resetPassword,
  sendPasswordReset,
  signInWithEmail,
  signUpWithEmail,
} from '@/api/email-auth';

import { EmailSignIn } from './email-sign-in';

jest.mock('@/api/email-auth', () => ({
  confirmEmail: jest.fn(),
  resendSignUpCode: jest.fn(),
  resetPassword: jest.fn(),
  sendPasswordReset: jest.fn(),
  signInWithEmail: jest.fn(),
  signUpWithEmail: jest.fn(),
}));

const type = (testID: string, text: string) => fireEvent.changeText(screen.getByTestId(testID), text);

beforeEach(() => {
  jest.clearAllMocks();
  jest.spyOn(console, 'warn').mockImplementation(() => undefined);
});

it('signs in with an email and password', async () => {
  (signInWithEmail as jest.Mock).mockResolvedValue(undefined);
  await render(<EmailSignIn />);
  await type('email-address', 'sam@example.com');
  await type('email-password', 'correct horse');
  await fireEvent.press(screen.getByRole('button', { name: COPY.signIn }));
  expect(signInWithEmail).toHaveBeenCalledWith('sam@example.com', 'correct horse');
  expect(screen.queryByRole('alert')).toBeNull();
});

it('checks the address before asking, and says when the password is wrong', async () => {
  (signInWithEmail as jest.Mock).mockRejectedValue({ code: 'invalid_credentials', status: 400 });
  await render(<EmailSignIn />);
  await type('email-address', 'sam@example');
  await fireEvent.press(screen.getByRole('button', { name: COPY.signIn }));
  expect(signInWithEmail).not.toHaveBeenCalled();
  expect(screen.getByRole('alert')).toHaveTextContent(COPY.badEmail);
  await type('email-address', 'sam@example.com');
  await type('email-password', 'wrong one');
  await fireEvent.press(screen.getByRole('button', { name: COPY.signIn }));
  expect(screen.getByRole('alert')).toHaveTextContent(COPY.wrongPassword);
});

it('makes an account, then takes the emailed code', async () => {
  (signUpWithEmail as jest.Mock).mockResolvedValue('code-sent');
  (confirmEmail as jest.Mock).mockResolvedValue(undefined);
  await render(<EmailSignIn />);
  await fireEvent.press(screen.getByRole('button', { name: COPY.toSignUp }));
  await type('email-address', 'sam@example.com');
  await type('email-password', 'short');
  await fireEvent.press(screen.getByRole('button', { name: COPY.signUp }));
  expect(signUpWithEmail).not.toHaveBeenCalled();
  expect(screen.getByRole('alert')).toHaveTextContent(COPY.shortPassword);
  await type('email-password', 'long enough');
  await fireEvent.press(screen.getByRole('button', { name: COPY.signUp }));
  expect(signUpWithEmail).toHaveBeenCalledWith('sam@example.com', 'long enough');
  expect(screen.getByText(COPY.codeHint('sam@example.com'))).toBeOnTheScreen();
  expect(screen.getByText(COPY.existingHint)).toBeOnTheScreen();
  await type('email-code', '123 456');
  await fireEvent.press(screen.getByRole('button', { name: COPY.confirm }));
  expect(confirmEmail).toHaveBeenCalledWith('sam@example.com', '123 456');
});

it('sends a new sign-up code, and says a wrong one is wrong', async () => {
  (signUpWithEmail as jest.Mock).mockResolvedValue('code-sent');
  (confirmEmail as jest.Mock).mockRejectedValue({ code: 'otp_expired', status: 403 });
  (resendSignUpCode as jest.Mock).mockResolvedValue(undefined);
  await render(<EmailSignIn />);
  await fireEvent.press(screen.getByRole('button', { name: COPY.toSignUp }));
  await type('email-address', 'sam@example.com');
  await type('email-password', 'long enough');
  await fireEvent.press(screen.getByRole('button', { name: COPY.signUp }));
  await type('email-code', '000000');
  await fireEvent.press(screen.getByRole('button', { name: COPY.confirm }));
  expect(screen.getByRole('alert')).toHaveTextContent(COPY.wrongCode);
  await fireEvent.press(screen.getByRole('button', { name: COPY.resend }));
  expect(resendSignUpCode).toHaveBeenCalledWith('sam@example.com');
  expect(screen.getByText(COPY.resent)).toBeOnTheScreen();
});

it('resets a forgotten password with an emailed code', async () => {
  (sendPasswordReset as jest.Mock).mockResolvedValue(undefined);
  (resetPassword as jest.Mock).mockResolvedValue(undefined);
  await render(<EmailSignIn />);
  await fireEvent.press(screen.getByRole('button', { name: COPY.toForgot }));
  await type('email-address', 'sam@example.com');
  await fireEvent.press(screen.getByRole('button', { name: COPY.sendReset }));
  expect(sendPasswordReset).toHaveBeenCalledWith('sam@example.com');
  expect(screen.getByText(COPY.resetBody('sam@example.com'))).toBeOnTheScreen();
  await type('email-code', '654321');
  await type('email-password', 'a new one please');
  await fireEvent.press(screen.getByRole('button', { name: COPY.reset }));
  expect(resetPassword).toHaveBeenCalledWith('sam@example.com', '654321', 'a new one please');
});

it('says email sign-in is not open yet, where production still has it off', async () => {
  (signUpWithEmail as jest.Mock).mockRejectedValue({ code: 'signup_disabled', status: 422 });
  await render(<EmailSignIn />);
  await fireEvent.press(screen.getByRole('button', { name: COPY.toSignUp }));
  await type('email-address', 'sam@example.com');
  await type('email-password', 'long enough');
  await fireEvent.press(screen.getByRole('button', { name: COPY.signUp }));
  expect(screen.getByRole('alert')).toHaveTextContent(COPY.notOpen);
});
