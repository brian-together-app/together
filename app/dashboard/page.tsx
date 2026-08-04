"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/app/lib/supabase";

type CoupleDetails = {
  id: string;
  couple_name: string;
  invite_code: string;
};

type CheckIn = {
  user_id: string;
  mood: string;
  happiness_score: number;
  connection_score: number;
};

function getToday() {
  const now = new Date();
  const localDate = new Date(
    now.getTime() - now.getTimezoneOffset() * 60000
  );

  return localDate.toISOString().slice(0, 10);
}

function moodEmoji(mood?: string) {
  if (mood === "Rough") return "😞";
  if (mood === "Distant") return "😕";
  if (mood === "Okay") return "😐";
  if (mood === "Happy") return "🙂";
  if (mood === "Loved") return "🥰";
  return "⏳";
}

export default function DashboardPage() {
  const router = useRouter();

  const [name, setName] = useState("Brian");
  const [userId, setUserId] = useState("");
  const [couple, setCouple] = useState<CoupleDetails | null>(null);
  const [memberCount, setMemberCount] = useState(1);
  const [myCheckIn, setMyCheckIn] = useState<CheckIn | null>(null);
  const [partnerCheckIn, setPartnerCheckIn] = useState<CheckIn | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadDashboard();
  }, []);

  async function loadDashboard() {
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      router.replace("/login");
      return;
    }

    setUserId(user.id);

    const displayName =
      user.user_metadata?.display_name ||
      user.email?.split("@")[0] ||
      "Brian";

    setName(displayName);

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
      .select("id, couple_name, invite_code")
      .eq("id", membership.couple_id)
      .single();

    if (coupleData) {
      setCouple(coupleData);
    }

    const { data: members } = await supabase
      .from("couple_members")
      .select("user_id")
      .eq("couple_id", membership.couple_id);

    setMemberCount(members?.length || 1);

    const { data: checkIns } = await supabase
      .from("daily_checkins")
      .select("user_id, mood, happiness_score, connection_score")
      .eq("couple_id", membership.couple_id)
      .eq("checkin_date", getToday());

    const mine =
      checkIns?.find((checkIn) => checkIn.user_id === user.id) || null;

    const partner =
      checkIns?.find((checkIn) => checkIn.user_id !== user.id) || null;

    setMyCheckIn(mine);
    setPartnerCheckIn(partner);
    setLoading(false);
  }

  async function handleSignOut() {
    await supabase.auth.signOut();
    router.replace("/login");
  }

  function getGreeting() {
    const hour = new Date().getHours();

    if (hour < 12) return "Good morning";
    if (hour < 18) return "Good afternoon";
    return "Good evening";
  }

  const bothCheckedIn = Boolean(myCheckIn && partnerCheckIn);

  const averageHappiness = bothCheckedIn
    ? (
        (myCheckIn!.happiness_score +
          partnerCheckIn!.happiness_score) /
        2
      ).toFixed(1)
    : null;

  const averageConnection = bothCheckedIn
    ? (
        (myCheckIn!.connection_score +
          partnerCheckIn!.connection_score) /
        2
      ).toFixed(1)
    : null;

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-gradient-to-br from-pink-100 via-rose-50 to-pink-200">
        <div className="text-center">
          <div className="animate-pulse text-6xl">❤️</div>
          <p className="mt-4 font-semibold text-pink-700">
            Opening Together...
          </p>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-gradient-to-br from-pink-100 via-rose-50 to-pink-200 px-4 py-6 sm:px-6 sm:py-10">
      <div className="mx-auto max-w-5xl">
        <header className="mb-8 flex items-start justify-between gap-4">
          <div>
            <p className="text-sm font-bold uppercase tracking-[0.25em] text-pink-600">
              Together ❤️
            </p>

            <h1 className="mt-2 text-3xl font-bold text-gray-900 sm:text-5xl">
              {getGreeting()}, {name}
            </h1>

            <p className="mt-2 text-gray-600">
              I hope today treated you well.
            </p>
          </div>

          <button
            type="button"
            onClick={handleSignOut}
            className="rounded-full border border-pink-200 bg-white px-4 py-2 text-sm font-semibold text-pink-700 shadow-sm"
          >
            Sign Out
          </button>
        </header>

        <section className="mb-6 overflow-hidden rounded-[2rem] bg-white shadow-xl">
          <div className="bg-gradient-to-r from-pink-600 to-rose-500 p-6 text-white sm:p-8">
            <p className="text-sm font-semibold uppercase tracking-[0.2em] text-pink-100">
              Your relationship
            </p>

            <h2 className="mt-2 text-3xl font-bold sm:text-4xl">
              {couple?.couple_name || "Brian & Kimberly"}
            </h2>

            <p className="mt-3 text-pink-50">
              Your private home for happiness, memories, and love.
            </p>
          </div>

          <div className="grid gap-4 p-5 sm:grid-cols-3 sm:p-6">
            <div className="rounded-2xl bg-pink-50 p-5">
              <p className="text-sm font-semibold text-gray-500">
                Partner status
              </p>

              <p className="mt-2 text-xl font-bold text-gray-900">
                {memberCount >= 2 ? "Connected ❤️" : "Waiting for Kimberly"}
              </p>
            </div>

            <div className="rounded-2xl bg-pink-50 p-5">
              <p className="text-sm font-semibold text-gray-500">
                Today’s happiness
              </p>

              <p className="mt-2 text-xl font-bold text-gray-900">
                {averageHappiness ? `${averageHappiness}/5` : "Waiting..."}
              </p>
            </div>

            <div className="rounded-2xl bg-pink-50 p-5">
              <p className="text-sm font-semibold text-gray-500">
                Today’s connection
              </p>

              <p className="mt-2 text-xl font-bold text-gray-900">
                {averageConnection ? `${averageConnection}/5` : "Waiting..."}
              </p>
            </div>
          </div>
        </section>

        {memberCount < 2 && (
          <section className="mb-6 rounded-3xl border border-pink-200 bg-white p-6 shadow-md">
            <p className="text-sm font-bold uppercase tracking-widest text-pink-600">
              Invite Kimberly
            </p>

            <h2 className="mt-2 text-2xl font-bold text-gray-900">
              Your relationship space is ready
            </h2>

            {couple?.invite_code && (
              <p className="mt-4 text-2xl font-bold tracking-[0.2em] text-pink-700">
                {couple.invite_code}
              </p>
            )}

            <Link
              href="/couple"
              className="mt-5 inline-block rounded-full bg-pink-600 px-6 py-3 font-semibold text-white"
            >
              View Invite
            </Link>
          </section>
        )}

        <section className="mb-6 rounded-[2rem] bg-white p-6 shadow-xl sm:p-8">
          <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
            <div>
              <p className="text-sm font-bold uppercase tracking-widest text-pink-600">
                Today’s Check-In
              </p>

              <h2 className="mt-2 text-3xl font-bold text-gray-900">
                How are you two doing today?
              </h2>
            </div>

            <Link
              href="/checkin"
              className="rounded-full bg-pink-600 px-6 py-3 text-center font-semibold text-white shadow-md"
            >
              {myCheckIn ? "Update My Check-In" : "Check In Now"}
            </Link>
          </div>

          <div className="mt-6 grid gap-4 sm:grid-cols-2">
            <div className="rounded-3xl bg-pink-50 p-6">
              <p className="text-sm font-bold uppercase tracking-widest text-pink-600">
                {name}
              </p>

              <div className="mt-4 text-5xl">
                {moodEmoji(myCheckIn?.mood)}
              </div>

              <h3 className="mt-3 text-2xl font-bold text-gray-900">
                {myCheckIn?.mood || "Not checked in yet"}
              </h3>

              {myCheckIn && (
                <div className="mt-4 space-y-1 text-gray-600">
                  <p>Happiness: {myCheckIn.happiness_score}/5</p>
                  <p>Connection: {myCheckIn.connection_score}/5</p>
                </div>
              )}
            </div>

            <div className="rounded-3xl bg-pink-50 p-6">
              <p className="text-sm font-bold uppercase tracking-widest text-pink-600">
                Kimberly
              </p>

              <div className="mt-4 text-5xl">
                {moodEmoji(partnerCheckIn?.mood)}
              </div>

              <h3 className="mt-3 text-2xl font-bold text-gray-900">
                {partnerCheckIn?.mood ||
                  (memberCount >= 2
                    ? "Waiting for today’s check-in"
                    : "Not connected yet")}
              </h3>

              {partnerCheckIn && (
                <div className="mt-4 space-y-1 text-gray-600">
                  <p>
                    Happiness: {partnerCheckIn.happiness_score}/5
                  </p>
                  <p>
                    Connection: {partnerCheckIn.connection_score}/5
                  </p>
                </div>
              )}
            </div>
          </div>

          {bothCheckedIn && (
            <div className="mt-6 rounded-3xl bg-gradient-to-r from-pink-600 to-rose-500 p-6 text-center text-white">
              <div className="text-4xl">💕</div>

              <h3 className="mt-3 text-2xl font-bold">
                You both checked in today!
              </h3>

              <p className="mt-2 text-pink-50">
                Today’s shared happiness is {averageHappiness}/5 and your
                connection is {averageConnection}/5.
              </p>
            </div>
          )}
        </section>

        <section className="grid gap-4 sm:grid-cols-2">
          <Link
            href="/checkin"
            className="rounded-3xl bg-white p-6 shadow-md transition hover:-translate-y-1 hover:shadow-xl"
          >
            <span className="text-4xl">😊</span>

            <h2 className="mt-4 text-2xl font-bold text-gray-900">
              Daily Check-In
            </h2>

            <p className="mt-2 text-gray-600">
              Record how connected and happy you felt today.
            </p>
          </Link>

          <div className="rounded-3xl bg-white p-6 shadow-md">
            <span className="text-4xl">💌</span>

            <h2 className="mt-4 text-2xl font-bold text-gray-900">
              Love Jar
            </h2>

            <p className="mt-2 text-gray-600">
              Leave Kimberly a sweet note to open later.
            </p>
          </div>

          <div className="rounded-3xl bg-white p-6 shadow-md">
            <span className="text-4xl">📸</span>

            <h2 className="mt-4 text-2xl font-bold text-gray-900">
              Memories
            </h2>

            <p className="mt-2 text-gray-600">
              Save photos and meaningful moments.
            </p>
          </div>

          <div className="rounded-3xl bg-white p-6 shadow-md">
            <span className="text-4xl">✨</span>

            <h2 className="mt-4 text-2xl font-bold text-gray-900">
              Relationship Wrapped
            </h2>

            <p className="mt-2 text-gray-600">
              See your monthly happiness story.
            </p>
          </div>
        </section>
      </div>
    </main>
  );
}