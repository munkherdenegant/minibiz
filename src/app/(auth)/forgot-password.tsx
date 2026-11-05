import { zodResolver } from '@hookform/resolvers/zod';
import { useState } from 'react';
import { useForm } from 'react-hook-form';

import { AuthScreen } from '@/components/auth-screen';
import { FormTextField } from '@/components/form/form-text-field';
import { TextLink } from '@/components/text-link';
import { Button, Message } from '@/components/ui';
import {
  requestPasswordReset,
  signOut,
  updatePassword,
  verifyRecoveryCode,
} from '@/features/auth/api';
import {
  forgotPasswordSchema,
  resetPasswordSchema,
  type ForgotPasswordInput,
  type ResetPasswordInput,
} from '@/features/auth/schemas';
import { useResendCooldown } from '@/features/auth/use-resend-cooldown';
import { mn } from '@/i18n/mn';
import { useAuth } from '@/lib/auth';
import { getErrorMessage } from '@/lib/errors';
import { goBack } from '@/lib/navigation';

// Step 1: email → code is sent. Step 2: code + new password.
export default function ForgotPasswordScreen() {
  const [email, setEmail] = useState<string | null>(null);

  return email ? (
    <ResetStep email={email} />
  ) : (
    <RequestStep onCodeSent={setEmail} />
  );
}

function RequestStep({ onCodeSent }: { onCodeSent: (email: string) => void }) {
  const [error, setError] = useState<string | null>(null);
  const {
    control,
    handleSubmit,
    formState: { isSubmitting },
  } = useForm<ForgotPasswordInput>({
    resolver: zodResolver(forgotPasswordSchema),
    defaultValues: { email: '' },
  });

  const onSubmit = handleSubmit(async ({ email }) => {
    setError(null);
    try {
      await requestPasswordReset(email);
      onCodeSent(email);
    } catch (e) {
      setError(getErrorMessage(e));
    }
  });

  return (
    <AuthScreen title={mn.auth.forgotTitle} subtitle={mn.auth.forgotText}>
      <FormTextField
        control={control}
        name="email"
        label={mn.auth.email}
        placeholder={mn.auth.emailPlaceholder}
        autoCapitalize="none"
        autoComplete="email"
        keyboardType="email-address"
        textContentType="emailAddress"
        returnKeyType="go"
        onSubmitEditing={() => onSubmit()}
      />
      <Message tone="error" text={error} />
      <Button title={mn.auth.sendCode} loading={isSubmitting} onPress={onSubmit} />
      <TextLink label={mn.auth.backToLogin} onPress={() => goBack('/login')} />
    </AuthScreen>
  );
}

function ResetStep({ email }: { email: string }) {
  const { setRecoveringPassword } = useAuth();
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [resending, setResending] = useState(false);
  // A code can only be used once; after it is verified only the password is retried.
  const [verified, setVerified] = useState(false);
  const cooldown = useResendCooldown();
  const {
    control,
    handleSubmit,
    formState: { isSubmitting },
  } = useForm<ResetPasswordInput>({
    resolver: zodResolver(resetPasswordSchema),
    defaultValues: { code: '', password: '', confirmPassword: '' },
  });

  const onSubmit = handleSubmit(async ({ code, password }) => {
    setError(null);
    setNotice(null);
    if (!verified) {
      // Keep this screen visible: verifying the code signs the user in.
      setRecoveringPassword(true);
      try {
        await verifyRecoveryCode(email, code);
        setVerified(true);
      } catch (e) {
        setRecoveringPassword(false);
        setError(getErrorMessage(e));
        return;
      }
    }
    try {
      await updatePassword(password);
      // Releasing the flag lets the guards open the app with the new session.
      setRecoveringPassword(false);
    } catch (e) {
      setError(getErrorMessage(e));
    }
  });

  async function leave() {
    // Don't leave a half-finished recovery session signed in.
    if (verified) await signOut().catch(() => {});
    setRecoveringPassword(false);
    goBack('/login');
  }

  async function resend() {
    setError(null);
    setNotice(null);
    setResending(true);
    try {
      await requestPasswordReset(email);
      setNotice(mn.auth.codeSent);
      cooldown.restart();
    } catch (e) {
      setError(getErrorMessage(e));
    } finally {
      setResending(false);
    }
  }

  return (
    <AuthScreen title={mn.auth.forgotTitle} subtitle={mn.auth.resetText(email)}>
      <FormTextField
        control={control}
        name="code"
        label={mn.auth.code}
        placeholder={mn.auth.codePlaceholder}
        keyboardType="number-pad"
        autoComplete="one-time-code"
        textContentType="oneTimeCode"
        maxLength={10}
        editable={!verified}
      />
      <FormTextField
        control={control}
        name="password"
        label={mn.auth.newPassword}
        placeholder={mn.auth.newPasswordPlaceholder}
        autoComplete="new-password"
        textContentType="newPassword"
        secureToggle
      />
      <FormTextField
        control={control}
        name="confirmPassword"
        label={mn.auth.confirmPassword}
        placeholder={mn.auth.confirmPasswordPlaceholder}
        autoComplete="new-password"
        textContentType="newPassword"
        secureToggle
        returnKeyType="go"
        onSubmitEditing={() => onSubmit()}
      />
      <Message tone="error" text={error} />
      <Message tone="success" text={notice} />
      <Button title={mn.auth.savePassword} loading={isSubmitting} onPress={onSubmit} />
      {!verified ? (
        <Button
          title={cooldown.remaining > 0 ? mn.auth.resendIn(cooldown.remaining) : mn.auth.resendCode}
          variant="secondary"
          disabled={cooldown.remaining > 0}
          loading={resending}
          onPress={resend}
        />
      ) : null}
      <TextLink label={mn.auth.backToLogin} onPress={leave} />
    </AuthScreen>
  );
}
