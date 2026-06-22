import { signIn, signUp } from "./actions";

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
        <p className="mb-6 text-sm text-ink-500">Sign in or create an account to continue.</p>

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

        <form className="space-y-5">
          <div>
            <label className="mb-1 block font-mono text-xs tracking-wide text-ink-500 uppercase">
              Email
            </label>
            <input
              name="email"
              type="email"
              required
              className="field-line w-full text-sm"
            />
          </div>
          <div>
            <label className="mb-1 block font-mono text-xs tracking-wide text-ink-500 uppercase">
              Password
            </label>
            <input
              name="password"
              type="password"
              required
              minLength={6}
              className="field-line w-full text-sm"
            />
          </div>
          <div className="flex gap-2 pt-2">
            <button
              formAction={signIn}
              className="flex-1 bg-foil px-3 py-2 text-sm font-medium text-ledger-950 hover:bg-foil-dim"
            >
              Sign in
            </button>
            <button
              formAction={signUp}
              className="flex-1 border border-ledger-700 px-3 py-2 text-sm font-medium text-ink-100 hover:bg-ledger-800"
            >
              Sign up
            </button>
          </div>
        </form>
      </div>
    </main>
  );
}
