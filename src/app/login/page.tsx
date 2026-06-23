import { signInWithGoogle, continueAsGuest } from "./actions";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; message?: string }>;
}) {
  const { error, message } = await searchParams;

  return (
    <main className="flex min-h-screen items-center justify-center bg-ledger-950 px-4">
      <div className="w-full max-w-sm border border-ledger-800 bg-ledger-900 p-8">
        <p className="mb-1 font-mono text-xs tracking-[0.2em] text-foil uppercase">
          Account access
        </p>
        <h1 className="mb-1 font-display text-2xl font-medium text-ink-100">
          Credit Card Optimizer
        </h1>
        <p className="mb-6 text-sm text-ink-500">Sign in to continue, or try it out first.</p>

        {error && (
          <p className="mb-4 border border-alert/40 bg-alert/10 px-3 py-2 text-sm text-alert">
            {error}
          </p>
        )}
        {message && (
          <p className="mb-4 border border-signal/40 bg-signal/10 px-3 py-2 text-sm text-signal">
            {message}
          </p>
        )}

        <div className="space-y-3">
          <form action={signInWithGoogle}>
            <button
              type="submit"
              className="flex w-full items-center justify-center gap-2 border border-ledger-700 bg-ink-100 px-3 py-2 text-sm font-medium text-ledger-950 hover:bg-ink-300"
            >
              <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden="true">
                <path
                  fill="#4285F4"
                  d="M23.49 12.27c0-.79-.07-1.54-.2-2.27H12v4.51h6.47a5.53 5.53 0 0 1-2.4 3.63v3.02h3.86c2.26-2.09 3.56-5.17 3.56-8.89z"
                />
                <path
                  fill="#34A853"
                  d="M12 24c3.24 0 5.95-1.08 7.93-2.84l-3.86-3.02c-1.07.72-2.45 1.15-4.07 1.15-3.13 0-5.78-2.11-6.73-4.96H1.27v3.12A11.99 11.99 0 0 0 12 24z"
                />
                <path
                  fill="#FBBC05"
                  d="M5.27 14.33A7.2 7.2 0 0 1 4.88 12c0-.81.14-1.6.39-2.33V6.55H1.27A11.99 11.99 0 0 0 0 12c0 1.93.46 3.76 1.27 5.45z"
                />
                <path
                  fill="#EA4335"
                  d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42A11.95 11.95 0 0 0 12 0 11.99 11.99 0 0 0 1.27 6.55l4 3.12C6.22 6.86 8.87 4.75 12 4.75z"
                />
              </svg>
              Continue with Google
            </button>
          </form>

          <div className="flex items-center gap-3 py-1">
            <div className="h-px flex-1 bg-ledger-800" />
            <span className="font-mono text-xs uppercase text-ink-500">or</span>
            <div className="h-px flex-1 bg-ledger-800" />
          </div>

          <form action={continueAsGuest}>
            <button
              type="submit"
              className="w-full border border-ledger-700 px-3 py-2 text-sm font-medium text-ink-100 hover:bg-ledger-800"
            >
              Continue as guest
            </button>
          </form>
          <p className="text-xs text-ink-500">
            Guest sessions are temporary — sign in with Google to keep your cards saved.
          </p>
        </div>
      </div>
    </main>
  );
}
