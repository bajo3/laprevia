import { useState, type FormEvent } from "react";

type AdminLoginProps = {
  onLogin: (token: string) => void;
};

export default function AdminLogin({ onLogin }: AdminLoginProps) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setIsSubmitting(true);
    try {
      const response = await fetch("/api/admin/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });
      const payload = (await response.json().catch(() => ({}))) as { token?: string; error?: string };
      if (!response.ok || !payload.token) {
        throw new Error(payload.error || "Usuario o contraseña incorrectos.");
      }
      onLogin(payload.token);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo iniciar sesión.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-cream p-5">
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-sm rounded-3xl border-[3px] border-ink bg-white p-6 shadow-[6px_6px_0_var(--color-ink)] sm:p-8"
      >
        <p className="text-xs font-extrabold uppercase tracking-[0.18em] text-pink">La Previa · interno</p>
        <h1 className="font-display mt-1 text-3xl">Ingresar al panel</h1>
        <p className="mt-1 text-sm text-ink/60">Usuario y contraseña de administración.</p>

        <label className="mt-6 block text-xs font-extrabold uppercase tracking-widest text-ink/50" htmlFor="admin-username">
          Usuario
        </label>
        <input
          id="admin-username"
          name="username"
          type="text"
          autoComplete="username"
          autoFocus
          value={username}
          onChange={(event) => setUsername(event.target.value)}
          className="mt-1 w-full rounded-full border-2 border-ink bg-cream px-4 py-2.5 text-sm font-semibold outline-none focus:ring-4 focus:ring-pink/20"
        />

        <label className="mt-4 block text-xs font-extrabold uppercase tracking-widest text-ink/50" htmlFor="admin-password">
          Contraseña
        </label>
        <input
          id="admin-password"
          name="password"
          type="password"
          autoComplete="current-password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          className="mt-1 w-full rounded-full border-2 border-ink bg-cream px-4 py-2.5 text-sm font-semibold outline-none focus:ring-4 focus:ring-pink/20"
        />

        {error && (
          <p role="alert" className="mt-3 text-sm font-bold text-pink">
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={isSubmitting}
          className="mt-6 flex h-12 w-full items-center justify-center rounded-full border-2 border-ink bg-yellow font-extrabold text-ink shadow-[3px_3px_0_var(--color-ink)] transition hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {isSubmitting ? "Ingresando…" : "Ingresar"}
        </button>

        <a href="/" className="mt-4 block text-center text-xs font-extrabold uppercase tracking-widest text-ink/40 hover:text-pink">
          Volver al catálogo
        </a>
      </form>
    </div>
  );
}
