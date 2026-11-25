
import { useState, type FormEvent } from "react";
import { LockKeyhole, Mail } from "lucide-react";
import { supabase } from "../lib/supabase";
import { useAuth } from "../contexts/AuthContext";

export default function Login() {
  const { signIn } = useAuth();

  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [sendingLink, setSendingLink] = useState(false);

  const isEmail = identifier.trim().includes("@");

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    setError("");
    setMessage("");
    setSubmitting(true);

    const normalizedIdentifier = identifier.trim().toLowerCase();

    const loginEmail = isEmail
      ? normalizedIdentifier
      : `${normalizedIdentifier}@staff.invalid`;

    try {
      await signIn(loginEmail, password);
    } catch {
      setError("Invalid username/email or password. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleMagicLink() {
    const normalizedEmail = identifier.trim().toLowerCase();

    if (!normalizedEmail || !normalizedEmail.includes("@")) {
      setError("Enter your email address first.");
      return;
    }

    setError("");
    setMessage("");
    setSendingLink(true);

    try {
      const { error: linkError } = await supabase.auth.signInWithOtp({
        email: normalizedEmail,
        options: {
          emailRedirectTo: window.location.origin,
        },
      });

      if (linkError) throw linkError;

      setMessage(
        "If the email can receive a sign-in link, check its inbox and follow the instructions.",
      );
    } catch (err) {
      console.error("Magic link request failed:", err);
      setError("Unable to send the sign-in link. Please try again.");
    } finally {
      setSendingLink(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-zinc-950 px-4">
      <div className="w-full max-w-md rounded-2xl border border-zinc-800 bg-zinc-900 p-8 shadow-xl">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-400">
            <LockKeyhole size={24} />
          </div>

          <h1 className="text-2xl font-semibold text-white">
            Server Manager
          </h1>

          <p className="mt-2 text-sm text-zinc-400">
            Sign in to access your management dashboard.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label
              htmlFor="login-identifier"
              className="mb-2 block text-sm font-medium text-zinc-300"
            >
              Email or username
            </label>

            <input
              id="login-identifier"
              type="text"
              autoComplete="username"
              required
              value={identifier}
              onChange={(event) => setIdentifier(event.target.value)}
              placeholder="Email or staff username"
              className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-4 py-3 text-sm text-white outline-none transition placeholder:text-zinc-600 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20"
            />
          </div>

          <div>
            <label
              htmlFor="login-password"
              className="mb-2 block text-sm font-medium text-zinc-300"
            >
              Password
            </label>

            <input
              id="login-password"
              type="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="Enter your password"
              className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-4 py-3 text-sm text-white outline-none transition placeholder:text-zinc-600 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20"
            />
          </div>

          {error && (
            <p
              role="alert"
              className="rounded-lg border border-red-500/20 bg-red-500/10 px-3 py-2 text-sm text-red-400"
            >
              {error}
            </p>
          )}

          {message && (
            <p
              role="status"
              className="rounded-lg border border-emerald-500/20 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-400"
            >
              {message}
            </p>
          )}

          <button
            type="submit"
            disabled={submitting || sendingLink}
            className="w-full rounded-lg bg-emerald-500 px-4 py-3 text-sm font-semibold text-zinc-950 transition hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {submitting ? "Signing in..." : "Sign in"}
          </button>

          {isEmail && (
            <>
              <div className="relative flex items-center">
                <div className="flex-1 border-t border-zinc-800" />
                <span className="px-3 text-xs text-zinc-500">OR</span>
                <div className="flex-1 border-t border-zinc-800" />
              </div>

              <button
                type="button"
                onClick={handleMagicLink}
                disabled={submitting || sendingLink}
                className="flex w-full items-center justify-center gap-2 rounded-lg border border-zinc-700 bg-zinc-800 px-4 py-3 text-sm font-medium text-zinc-200 transition hover:bg-zinc-700 disabled:cursor-not-allowed disabled:opacity-60"
              >
                <Mail size={16} />
                {sendingLink ? "Sending link..." : "Sign in with email link"}
              </button>
            </>
          )}
        </form>

        <p className="mt-6 text-center text-xs text-zinc-500">
          Access is available only to authorized workspace members.
        </p>
      </div>
    </main>
  );
}
