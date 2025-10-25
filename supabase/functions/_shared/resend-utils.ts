import { Resend } from "npm:resend@2.0.0";

export type ResendClient = {
  emails: {
    send: (payload: Record<string, unknown>) => Promise<{
      data?: { id?: string } | null;
      error?: { message: string } | null;
    }>;
  };
};

export function createResendClient(apiKey: string | null | undefined): ResendClient {
  if (apiKey && apiKey.trim().length > 0) {
    return new Resend(apiKey) as unknown as ResendClient;
  }

  console.warn('RESEND_API_KEY not set, using noop Resend client');
  return {
    emails: {
      async send(..._args) {
        return {
          data: null,
          error: { message: 'Resend API key is not configured' },
        };
      },
    },
  };
}
