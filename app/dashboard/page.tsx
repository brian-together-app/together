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
  checkin_date: string;
  mood: string;
  happiness_score: number;
  connection_score: number;
};

type LoveNote = {
  id: string;
  sender_id: string;
  recipient_id: string | null;
  category: string;
  message: string;
  open_on: string | null;
  opened_at: string | null;
  created_at: string;
};

function getToday() {
  const now = new Date();
  const localDate = new Date(
    now.getTime() - now.getTimezoneOffset() * 60000
  );

  return localDate.toISOString().slice(0, 10);
}

function getPreviousDate(date: string) {
  const value = new Date(`${date}T12:00:00`);
  value.setDate(value.getDate() - 1);
  return value.toISOString().slice(0, 10);
}

function moodEmoji(mood?: string) {
  if (mood === "Rough") return "😞";
  if (mood === "Distant") return "😕";
  if (mood === "Okay") return "😐";
  if (mood === "Happy") return "🙂";
  if (mood === "Loved") return "🥰";
  return "⏳";
}

function formatDate(date: string) {
  return new Date(date).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
}

function calculateSharedStreak(
  checkIns: CheckIn[],
  expectedMembers: number
) {
  if (expectedMembers < 2) return 0;

  const usersByDate = new Map<string, Set<string>>();

  for (const checkIn of checkIns) {
    if (!usersByDate.has(checkIn.checkin_date)) {
      usersByDate.set(checkIn.checkin_date, new Set());
    }

    usersByDate.get(checkIn.checkin_date)?.add(checkIn.user_id);
  }

  const today = getToday();
  let currentDate = today;

  if ((usersByDate.get(today)?.size || 0) < expectedMembers) {
    currentDate = getPreviousDate(today);
  }

  let streak = 0;

  while (
    (usersByDate.get(currentDate)?.size || 0) >= expectedMembers
  ) {
    streak += 1;
    currentDate = getPreviousDate(currentDate);
  }

  return streak;
}

export default function DashboardPage() {
  const router = useRouter();

  const [myName, setMyName] = useState("You");
  const [partnerName, setPartnerName] = useState("Your Partner");
  const [couple, setCouple] = useState<CoupleDetails | null>(null);
  const [memberCount, setMemberCount] = useState(1);

  const [myCheckIn, setMyCheckIn] = useState<CheckIn | null>(null);
  const [partnerCheckIn, setPartnerCheckIn] =
    useState<CheckIn | null>(null);

  const [sharedStreak, setSharedStreak] = useState(0);
  const [latestLoveNote, setLatestLoveNote] =
    useState<LoveNote | null>(null);

  const [loading, setLoading] = useState(true);
  const [pageError, setPageError] = useState("");

  useEffect(() => {
    loadDashboard();
  }, []);

  async function loadDashboard() {
    setPageError("");

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      router.replace("/login");
      return;
    }

    const currentName =
      user.user_metadata?.display_name ||
      user.email?.split("@")[0] ||
      "You";

    setMyName(currentName);

    const { data: membership, error: membershipError } =
      await supabase
        .from("couple_members")
        .select("couple_id")
        .eq("user_id", user.id)
        .maybeSingle();

    if (membershipError) {
      setPageError(membershipError.message);
      setLoading(false);
      return;
    }

    if (!membership) {
      setLoading(false);
      return;
    }

    const currentCoupleId = membership.couple_id;

    const { data: coupleData } = await supabase
      .from("couples")
      .select("id, couple_name, invite_code")
      .eq("id", currentCoupleId)
      .single();

    if (coupleData) {
      setCouple(coupleData);
    }

    const { data: members, error: membersError } = await supabase
      .from("couple_members")
      .select("user_id")
      .eq("couple_id", currentCoupleId);

    if (membersError) {
      setPageError(membersError.message);
      setLoading(false);
      return;
    }

    const totalMembers = members?.length || 1;
    setMemberCount(totalMembers);

    const partnerMember = members?.find(
      (member) => member.user_id !== user.id
    );

    if (partnerMember) {
      const { data: partnerProfile } = await supabase
        .from("profiles")
        .select("display_name")
        .eq("id", partnerMember.user_id)
        .maybeSingle();

      setPartnerName(
        partnerProfile?.display_name?.trim() || "Your Partner"
      );
    }

    const { data: todayCheckIns } = await supabase
      .from("daily_checkins")
      .select(
        "user_id, checkin_date, mood, happiness_score, connection_score"
      )
      .eq("couple_id", currentCoupleId)
      .eq("checkin_date", getToday());

    setMyCheckIn(
      todayCheckIns?.find(
        (checkIn) => checkIn.user_id === user.id
      ) || null
    );

    setPartnerCheckIn(
      todayCheckIns?.find(
        (checkIn) => checkIn.user_id !== user.id
      ) || null
    );

    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const { data: recentCheckIns } = await supabase
      .from("daily_checkins")
      .select(
        "user_id, checkin_date, mood, happiness_score, connection_score"
      )
      .eq("couple_id", currentCoupleId)
      .gte(
        "checkin_date",
        thirtyDaysAgo.toISOString().slice(0, 10)
      )
      .order("checkin_date", { ascending: false });

    setSharedStreak(
      calculateSharedStreak(recentCheckIns || [], totalMembers)
    );

    const { data: latestNote } = await supabase
      .from("love_jar_notes")
      .select(
        "id, sender_id, recipient_id, category, message, open_on, opened_at, created_at"
      )
      .eq("couple_id", currentCoupleId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    setLatestLoveNote(latestNote || null);
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

  const latestNoteIsLocked = Boolean(
    latestLoveNote?.open_on &&
      latestLoveNote.open_on > getToday()
  );

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
      <div className="mx-auto max-w-6xl">
        <header className="mb-8 flex items-start justify-between gap-4">
          <div>
            <p className="text-sm font-bold uppercase tracking-[0.25em] text-pink-600">
              Together ❤️
            </p>

            <h1 className="mt-2 text-3xl font-bold text-gray-900 sm:text-5xl">
              {getGreeting()}, {myName}
            </h1>

            <p className="mt-2 text-gray-600">
              Your private relationship space.
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

        {pageError && (
          <div className="mb-6 rounded-2xl border border-red-200 bg-red-50 p-4 text-center font-semibold text-red-700">
            {pageError}
          </div>
        )}

        <section className="mb-6 overflow-hidden rounded-[2rem] bg-white shadow-xl">
          <div className="bg-gradient-to-r from-pink-600 to-rose-500 p-6 text-white sm:p-8">
            <p className="text-sm font-semibold uppercase tracking-[0.2em] text-pink-100">
              Your relationship
            </p>

            <h2 className="mt-2 text-3xl font-bold sm:text-4xl">
              {couple?.couple_name ||
                `${myName} & ${partnerName}`}
            </h2>

            <p className="mt-3 text-pink-50">
              A private home for your check-ins, love notes, and
              memories.
            </p>
          </div>

          <div className="grid gap-4 p-5 sm:grid-cols-2 lg:grid-cols-4 sm:p-6">
            <div className="rounded-2xl bg-pink-50 p-5">
              <p className="text-sm font-semibold text-gray-500">
                Partner
              </p>

              <p className="mt-2 text-xl font-bold text-gray-900">
                {memberCount >= 2
                  ? `${partnerName} ❤️`
                  : "Waiting to connect"}
              </p>
            </div>

            <div className="rounded-2xl bg-pink-50 p-5">
              <p className="text-sm font-semibold text-gray-500">
                Shared streak
              </p>

              <p className="mt-2 text-xl font-bold text-gray-900">
                🔥 {sharedStreak}{" "}
                {sharedStreak === 1 ? "day" : "days"}
              </p>
            </div>

            <div className="rounded-2xl bg-pink-50 p-5">
              <p className="text-sm font-semibold text-gray-500">
                Happiness
              </p>

              <p className="mt-2 text-xl font-bold text-gray-900">
                {averageHappiness
                  ? `${averageHappiness}/5`
                  : "Waiting..."}
              </p>
            </div>

            <div className="rounded-2xl bg-pink-50 p-5">
              <p className="text-sm font-semibold text-gray-500">
                Connection
              </p>

              <p className="mt-2 text-xl font-bold text-gray-900">
                {averageConnection
                  ? `${averageConnection}/5`
                  : "Waiting..."}
              </p>
            </div>
          </div>
        </section>

        <div className="mb-6 grid gap-6 lg:grid-cols-3">
          <section className="rounded-[2rem] bg-white p-6 shadow-xl lg:col-span-2 sm:p-8">
            <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
              <div>
                <p className="text-sm font-bold uppercase tracking-widest text-pink-600">
                  Today’s Check-In
                </p>

                <h2 className="mt-2 text-3xl font-bold text-gray-900">
                  How are you two doing?
                </h2>
              </div>

              <Link
                href="/checkin"
                className="rounded-full bg-pink-600 px-6 py-3 text-center font-semibold text-white shadow-md"
              >
                {myCheckIn
                  ? "Update My Check-In"
                  : "Check In Now"}
              </Link>
            </div>

            <div className="mt-6 grid gap-4 sm:grid-cols-2">
              <div className="rounded-3xl bg-pink-50 p-6">
                <p className="text-sm font-bold uppercase tracking-widest text-pink-600">
                  You · {myName}
                </p>

                <div className="mt-4 text-5xl">
                  {moodEmoji(myCheckIn?.mood)}
                </div>

                <h3 className="mt-3 text-2xl font-bold text-gray-900">
                  {myCheckIn?.mood || "Not checked in yet"}
                </h3>

                {myCheckIn && (
                  <div className="mt-4 space-y-1 text-gray-600">
                    <p>
                      Happiness: {myCheckIn.happiness_score}/5
                    </p>
                    <p>
                      Connection: {myCheckIn.connection_score}/5
                    </p>
                  </div>
                )}
              </div>

              <div className="rounded-3xl bg-pink-50 p-6">
                <p className="text-sm font-bold uppercase tracking-widest text-pink-600">
                  {partnerName}
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
                      Happiness:{" "}
                      {partnerCheckIn.happiness_score}/5
                    </p>
                    <p>
                      Connection:{" "}
                      {partnerCheckIn.connection_score}/5
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
                  Shared happiness: {averageHappiness}/5 ·
                  Connection: {averageConnection}/5
                </p>
              </div>
            )}
          </section>

          <section className="rounded-[2rem] bg-white p-6 shadow-xl sm:p-8">
            <p className="text-sm font-bold uppercase tracking-widest text-pink-600">
              Love Jar
            </p>

            <div className="mt-4 text-5xl">💌</div>

            <h2 className="mt-4 text-2xl font-bold text-gray-900">
              Latest Love Note
            </h2>

            {!latestLoveNote ? (
              <p className="mt-3 text-gray-600">
                No love notes have been added yet.
              </p>
            ) : latestNoteIsLocked ? (
              <>
                <p className="mt-3 font-semibold text-gray-800">
                  A surprise is waiting 🔒
                </p>

                <p className="mt-2 text-sm text-gray-500">
                  Opens {latestLoveNote.open_on}
                </p>
              </>
            ) : (
              <>
                <p className="mt-3 text-sm font-bold text-pink-700">
                  {latestLoveNote.category}
                </p>

                <p className="mt-2 line-clamp-4 whitespace-pre-wrap text-gray-700">
                  {latestLoveNote.message}
                </p>

                <p className="mt-3 text-sm text-gray-500">
                  Added {formatDate(latestLoveNote.created_at)}
                </p>
              </>
            )}

            <Link
              href="/love-jar"
              className="mt-6 block rounded-full bg-pink-600 px-5 py-3 text-center font-bold text-white"
            >
              Open Love Jar
            </Link>
          </section>
        </div>

        <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Link
            href="/checkin"
            className="rounded-3xl bg-white p-6 shadow-md transition hover:-translate-y-1 hover:shadow-xl"
          >
            <span className="text-4xl">😊</span>

            <h2 className="mt-4 text-xl font-bold text-gray-900">
              Daily Check-In
            </h2>

            <p className="mt-2 text-sm text-gray-600">
              Share how today felt.
            </p>
          </Link>

          <Link
            href="/love-jar"
            className="rounded-3xl bg-white p-6 shadow-md transition hover:-translate-y-1 hover:shadow-xl"
          >
            <span className="text-4xl">💌</span>

            <h2 className="mt-4 text-xl font-bold text-gray-900">
              Love Jar
            </h2>

            <p className="mt-2 text-sm text-gray-600">
              Leave {partnerName} something sweet.
            </p>
          </Link>

          <div className="rounded-3xl bg-white p-6 shadow-md opacity-80">
            <span className="text-4xl">📸</span>

            <h2 className="mt-4 text-xl font-bold text-gray-900">
              Memories
            </h2>

            <p className="mt-2 text-sm text-gray-600">
              Coming soon.
            </p>
          </div>

          <div className="rounded-3xl bg-white p-6 shadow-md opacity-80">
            <span className="text-4xl">✨</span>

            <h2 className="mt-4 text-xl font-bold text-gray-900">
              Wrapped
            </h2>

            <p className="mt-2 text-sm text-gray-600">
              Coming soon.
            </p>
          </div>
        </section>
      </div>
    </main>
  );
}