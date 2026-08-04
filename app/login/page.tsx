"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/app/lib/supabase";

export default function LoginPage() {
  const router = useRouter();

  const [isSigningUp, setIsSigningUp] = useState(false);
  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit() {
    setMessage("");

    if (isSigningUp && !displayName.trim()) {
      setMessage("Please enter your name.");
      return;
    }

    if (!email.trim() || !password) {
      setMessage("Please enter your email and password.");
      return;
    }

    setLoading(true);

    if (isSigningUp) {
      const { error } = await supabase.auth.signUp({
        email: email.trim(),
        password,
        options: {
          data: {
            display_name: displayName.trim(),
          },
        },
      });

      if (error) {
        setMessage(error.message);
      } else {
        setMessage(
          "Account created! Check your email to confirm your account."
        );
      }
    } else {
      const { error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });

      if (error) {
        setMessage(error.message);
      } else {
        router.push("/dashboard");
      }
    }

    setLoading(false);
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-gradient-to-br from-pink-200 via-rose-100 to-pink-300 px-5">
      <section className="w-full max-w-md rounded-3xl bg-white/90 p-8 shadow-xl">
        <div className="text-center">
          <div className="text-5xl">❤️</div>

          <h1 className="mt-3 text-4xl font-bold text-pink-700">
            Together
          </h1>

          <p className="mt-2 text-gray-600">
            {isSigningUp ? "Create your account" : "Welcome back"}
          </p>
        </div>

        <div className="mt-8 space-y-4">
          {isSigningUp && (
            <input
              type="text"
              placeholder="Your name"
              value={displayName}
              onChange={(event) => setDisplayName(event.target.value)}
              className="w-full rounded-xl border border-pink-200 px-4 py-3 text-gray-900 outline-none focus:border-pink-500"
            />
          )}

          <input
            type="email"
            placeholder="Email address"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            className="w-full rounded-xl border border-pink-200 px-4 py-3 text-gray-900 outline-none focus:border-pink-500"
          />

          <input
            type="password"
            placeholder="Password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                handleSubmit();
              }
            }}
            className="w-full rounded-xl border border-pink-200 px-4 py-3 text-gray-900 outline-none focus:border-pink-500"
          />

          <button
            type="button"
            onClick={handleSubmit}
            disabled={loading}
            className="w-full rounded-full bg-pink-600 px-6 py-3 font-semibold text-white shadow-md transition hover:bg-pink-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {loading
              ? "Please wait..."
              : isSigningUp
                ? "Create Account"
                : "Sign In"}
          </button>
        </div>

        {message && (
          <p className="mt-4 text-center text-sm text-gray-700">
            {message}
          </p>
        )}

        <button
          type="button"
          onClick={() => {
            setIsSigningUp(!isSigningUp);
            setMessage("");
          }}
          className="mt-6 w-full text-sm font-medium text-pink-700"
        >
          {isSigningUp
            ? "Already have an account? Sign in"
            : "New to Together? Create an account"}
        </button>
      </section>
    </main>
  );
}