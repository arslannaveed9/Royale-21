"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

export function AuthForm({
  mode,
  nextPath = "/lobby",
}: {
  mode: "login" | "signup";
  nextPath?: string;
}) {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      const res = await fetch(mode === "login" ? "/api/auth/login" : "/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password, displayName }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Could not continue");
      router.push(nextPath);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not continue");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="auth-card" onSubmit={submit}>
      <p className="eyebrow">Private membership</p>
      <h1>{mode === "login" ? "Welcome back" : "Take a seat"}</h1>
      <p className="lede">
        {mode === "login"
          ? "Sign in to your club book and return to the felt."
          : "Create an account. You start with a $10,000 marker."}
      </p>
      <label>
        Username
        <input
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          autoComplete="username"
          required
          minLength={3}
          maxLength={16}
        />
      </label>
      {mode === "signup" ? (
        <label>
          Display name
          <input
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            maxLength={24}
            placeholder="Optional"
          />
        </label>
      ) : null}
      <label>
        Password
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoComplete={mode === "login" ? "current-password" : "new-password"}
          required
          minLength={6}
        />
      </label>
      {error ? <p className="error-line">{error}</p> : null}
      <button className="btn-gold wide" disabled={busy} type="submit">
        {busy ? "Please wait..." : mode === "login" ? "Enter the club" : "Create membership"}
      </button>
      <p className="switch">
        {mode === "login" ? (
          <>
            New to the floor? <Link href="/signup">Open an account</Link>
          </>
        ) : (
          <>
            Already a member? <Link href="/login">Sign in</Link>
          </>
        )}
      </p>
    </form>
  );
}
