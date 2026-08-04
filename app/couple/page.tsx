"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/app/lib/supabase";

type CoupleInfo = {
  coupleName: string;
  inviteCode: string;
};

export default function CouplePage() {
  const router = useRouter();

  const [couple, setCouple] = useState<CoupleInfo | null>(null);
  const [inviteCode, setInviteCode] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState(false);

  useEffect(() => {
    loadCouple();
  }, []);

  async function loadCouple() {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      router.replace("/login");
      return;
    }

    const { data: membership } = await supabase
      .from("couple_members")
      .select("couple_id")
      .eq("user_id", user.id)
      .maybeSingle();

    if (!membership) {
      setLoading(false);
      return;
    }

    const { data: coupleData } = await supabase
      .from("couples")
      .select("couple_name, invite_code")
      .eq("id", membership.couple_id)
      .single();

    if (coupleData) {
      setCouple({
        coupleName: coupleData.couple_name,
        inviteCode: coupleData.invite_code,
      });
    }

    setLoading(false);
  }

  async function createCouple() {
    setWorking(true);
    setMessage("");

    const { data, error } = await supabase.rpc("create_couple", {
      requested_name: "Brian & Kimberly",
    });

    if (error) {
      setMessage(error.message);
    } else {
      const result = data?.[0];

      if (result) {
        setCouple({
          coupleName: "Brian & Kimberly",
          inviteCode: result.invite_code,
        });

        setMessage("Your private couple space was created! ❤️");
      }
    }

    setWorking(false);
  }

  async function joinCouple() {
    if (!inviteCode.trim()) {
      setMessage("Please enter the invitation code.");
      return;
    }

    setWorking(true);
    setMessage("");

    const { error } = await supabase.rpc("join_couple", {
      requested_invite_code: inviteCode.trim(),
    });

    if (error) {
      setMessage(error.message);
    } else {
      setMessage("You are now connected! ❤️");
      await loadCouple();
    }

    setWorking(false);
  }

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-gradient-to-br from-pink-100 via-rose-50 to-pink-200">
        <p className="font-semibold text-pink-700">
          Opening your relationship space... ❤️
        </p>
      </main>
    );
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-gradient-to-br from-pink-100 via-rose-50 to-pink-200 px-5 py-10">
      <section className="w-full max-w-lg rounded-3xl bg-white p-8 shadow-xl">
        <div className="text-center">
          <div className="text-5xl">💕</div>

          <h1 className="mt-3 text-4xl font-bold text-pink-700">
            Connect Together
          </h1>

          <p className="mt-2 text-gray-600">
            Create your private relationship space or join your partner.
          </p>
        </div>

        {couple ? (
          <div className="mt-8 text-center">
            <p className="text-sm font-semibold uppercase tracking-widest text-pink-600">
              Your relationship
            </p>

            <h2 className="mt-2 text-3xl font-bold text-gray-900">
              {couple.coupleName}
            </h2>

            <div className="mt-6 rounded-2xl bg-pink-50 p-5">
              <p className="text-sm font-semibold text-gray-600">
                Kimberly’s invitation code
              </p>

              <p className="mt-2 text-3xl font-bold tracking-[0.2em] text-pink-700">
                {couple.inviteCode}
              </p>

              <p className="mt-3 text-sm text-gray-600">
                Kimberly will enter this code after creating her account.
              </p>
            </div>

            <button
              type="button"
              onClick={() => router.push("/dashboard")}
              className="mt-6 w-full rounded-full bg-pink-600 px-6 py-3 font-semibold text-white shadow-md hover:bg-pink-700"
            >
              Return to Dashboard
            </button>
          </div>
        ) : (
          <div className="mt-8 space-y-6">
            <div className="rounded-2xl border border-pink-200 p-5">
              <h2 className="text-xl font-bold text-gray-900">
                Brian: Create your space
              </h2>

              <p className="mt-2 text-gray-600">
                Create the private relationship space, then send Kimberly the
                invitation code.
              </p>

              <button
                type="button"
                onClick={createCouple}
                disabled={working}
                className="mt-4 w-full rounded-full bg-pink-600 px-6 py-3 font-semibold text-white disabled:opacity-50"
              >
                Create Brian & Kimberly
              </button>
            </div>

            <div className="text-center font-semibold text-gray-500">or</div>

            <div className="rounded-2xl border border-pink-200 p-5">
              <h2 className="text-xl font-bold text-gray-900">
                Kimberly: Join Brian
              </h2>

              <p className="mt-2 text-gray-600">
                Enter the private invitation code Brian sends you.
              </p>

              <input
                type="text"
                placeholder="Invitation code"
                value={inviteCode}
                onChange={(event) =>
                  setInviteCode(event.target.value.toUpperCase())
                }
                className="mt-4 w-full rounded-xl border border-pink-200 px-4 py-3 text-center text-xl font-bold uppercase tracking-widest text-gray-900 outline-none focus:border-pink-500"
              />

              <button
                type="button"
                onClick={joinCouple}
                disabled={working}
                className="mt-4 w-full rounded-full border border-pink-600 bg-white px-6 py-3 font-semibold text-pink-700 disabled:opacity-50"
              >
                Join Relationship
              </button>
            </div>
          </div>
        )}

        {message && (
          <p className="mt-5 text-center text-sm font-medium text-gray-700">
            {message}
          </p>
        )}
      </section>
    </main>
  );
}