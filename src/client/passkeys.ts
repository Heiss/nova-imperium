import {
  startAuthentication,
  startRegistration,
  type PublicKeyCredentialCreationOptionsJSON,
  type PublicKeyCredentialRequestOptionsJSON,
} from '@simplewebauthn/browser';

type Api = (url: string, body?: object) => Promise<Record<string, unknown>>;

export async function addPasskey(api: Api, password: string): Promise<void> {
  const reply = await api('/api/passkeys/register/options', { password });
  const response = await startRegistration({
    optionsJSON: reply.options as PublicKeyCredentialCreationOptionsJSON,
  });
  await api('/api/passkeys/register', { ceremony: reply.ceremony, response });
}

export async function signInWithPasskey(api: Api, remember: boolean) {
  const reply = await api('/api/passkeys/login/options', {});
  const response = await startAuthentication({
    optionsJSON: reply.options as PublicKeyCredentialRequestOptionsJSON,
  });
  return api('/api/passkeys/login', {
    ceremony: reply.ceremony,
    response,
    remember,
  });
}
