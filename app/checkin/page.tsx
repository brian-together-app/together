"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/app/lib/supabase";

const moods = [
  { label: "Rough", emoji: "😞", score: 1 },
  { label: "Distant", emoji: "😕", score: 2 },
  { label: "Okay", emoji: "😐", score: 3 },
  { label: "Happy", emoji: "🙂", score: 4 },
  { label: "Loved", emoji: "🥰", score: 5 },
];

const reasonOptions = [
  "Quality time",
  "Made me laugh",
  "Good communication",
  "Physical affection",
  "Date night",
  "Felt listened to",
  "Solved a disagreement",
  "Argument or tension",
  "Felt distant",
  "Outside stress",
];

function getToday() {
  const now = new Date();
  const localDate = new Date(
    now.getTime() - now.getTimezoneOffset() * 60000
  );

  return localDate.toISOString().slice(0, 10);
}

export default function CheckInPage() {
  const router = useRouter();

  const [userId, setUserId] = useState("");
  const [coupleId, setCoupleId] = useState("");
  const [partnerId, setPartnerId] = useState("");
  const [mood, setMood] = useState("");
  const [happinessScore, setHappinessScore] = useState(4);
  const [connectionScore, setConnectionScore] = useState(4);
  const [reasons, setReasons] = useState<string[]>([]);
  const [note, setNote] = useState("");
  const [tomorrowRequest, setTomorrowRequest] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadCheckIn();
  }, []);

  async function loadCheckIn() {
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      router.replace("/login");
      return;
    }

    setUserId(user.id);

    const { data: membership, error: membershipError } = await supabase
      .from("couple_members")
      .select("couple_id")
      .eq("user_id", user.id)
      .maybeSingle();

    if (membershipError || !membership) {
      setMessage("Create your relationship space before checking in.");
      setLoading(false);
      return;
    }

    setCoupleId(membership.couple_id);

    const { data: members } = await supabase
      .from("couple_members")
      .select("user_id")
      .eq("couple_id", membership.couple_id);

    const partner = members?.find(
      (member) => member.user_id !== user.id
    );

    if (partner) {
      setPartnerId(partner.user_id);
    }

    const { data: existingCheckIn } = await supabase
      .from("daily_checkins")
      .select(
        "mood, happiness_score, connection_score, reasons, note, tomorrow_request"
      )
      .eq("user_id", user.id)
      .eq("checkin_date", getToday())
      .maybeSingle();

    if (existingCheckIn) {
      setMood(existingCheckIn.mood);
      setHappinessScore(existingCheckIn.happiness_score);
      setConnectionScore(existingCheckIn.connection_score);
      setReasons(existingCheckIn.reasons || []);
      setNote(existingCheckIn.note || "");
      setTomorrowRequest(existingCheckIn.tomorrow_request || "");
      setMessage("Today’s check-in is ready to review or update.");
    }

    setLoading(false);
  }

  function toggleReason(reason: string) {
    setReasons((currentReasons) =>
      currentReasons.includes(reason)
        ? currentReasons.filter((item) => item !== reason)
        : [...currentReasons, reason]
    );
  }

  async function saveCheckIn() {
    setMessage("");

    if (!mood) {
      setMessage("Choose how today felt first.");
      return;
    }

    if (!userId || !coupleId) {
      setMessage("Your relationship space could not be found.");
      return;
    }

    setSaving(true);

    const today = getToday();

    const { data: existingRow } = await supabase
      .from("daily_checkins")
      .select("id")
      .eq("user_id", userId)
      .eq("checkin_date", today)
      .maybeSingle();

    const isFirstCheckInToday = !existingRow;

    const { error } = await supabase.from("daily_checkins").upsert(
      {
        couple_id: coupleId,
        user_id: userId,
        checkin_date: today,
        mood,
        happiness_score: happinessScore,
        connection_score: connectionScore,
        reasons,
        note: note.trim(),
        tomorrow_request: tomorrowRequest.trim(),
        updated_at: new Date().toISOString(),
      },
      {
        onConflict: "user_id,checkin_date",
      }
    );

    if (error) {
      setMessage(error.message);
      setSaving(false);
      return;
    }

    if (isFirstCheckInToday && partnerId) {
      const { error: notificationError } = await supabase
        .from("notifications")
        .insert({
          couple_id: coupleId,
          recipient_id: partnerId,
          actor_id: userId,
          notification_type: "checkin",
          title: "Your partner completed today’s check-in",
          message: `Mood: ${mood} · Happiness ${happinessScore}/5 · Connection ${connectionScore}/5`,
          link: "/checkin-history",
        });

      if (notificationError) {
        console.error(
          "Check-in saved, but notification could not be created:",
          notificationError.message
        );
      }
    }

    setMessage(
      isFirstCheckInToday
        ? "Today’s check-in was saved ❤️"
        : "Today’s check-in was updated ❤️"
    );

    setSaving(false);
  }

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-gradient-to-br from-pink-100 via-rose-50 to-pink-200">
        <div className="text-center">
          <div className="animate-pulse text-6xl">❤️</div>
          <p className="mt-4 font-semibold text-pink-700">
            Opening today’s check-in...
          </p>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-gradient-to-br from-pink-100 via-rose-50 to-pink-200 px-4 py-8">
      <div className="mx-auto max-w-2xl">
        <header className="mb-6 flex items-center justify-between gap-4">
          <div>
            <p className="text-sm font-bold uppercase tracking-[0.2em] text-pink-600">
              Together ❤️
            </p>

            <h1 className="mt-2 text-4xl font-bold text-gray-900">
              Daily Check-In
            </h1>

            <p className="mt-2 text-gray-600">
              Be honest, gentle, and focused on understanding each other.
            </p>
          </div>

          <Link
            href="/dashboard"
            className="rounded-full border border-pink-200 bg-white px-4 py-2 text-sm font-semibold text-pink-700 shadow-sm"
          >
            Back
          </Link>
        </header>

        <section className="rounded-[2rem] bg-white p-6 shadow-xl sm:p-8">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">
              How did today feel?
            </h2>

            <div className="mt-5 grid grid-cols-5 gap-2">
              {moods.map((option) => (
                <button
                  key={option.label}
                  type="button"
                  onClick={() => {
                    setMood(option.label);
                    setHappinessScore(option.score);
                  }}
                  className={`rounded-2xl border p-3 text-center transition ${
                    mood === option.label
                      ? "border-pink-600 bg-pink-50 shadow-md"
                      : "border-pink-100 bg-white hover:bg-pink-50"
                  }`}
                >
                  <span className="block text-3xl">{option.emoji}</span>
                  <span className="mt-2 block text-xs font-semibold text-gray-700">
                    {option.label}
                  </span>
                </button>
              ))}
            </div>
          </div>

          <div className="mt-8">
            <div className="flex justify-between gap-4">
              <label className="font-bold text-gray-900">
                Happiness level
              </label>

              <span className="font-bold text-pink-700">
                {happinessScore}/5
              </span>
            </div>

            <input
              type="range"
              min="1"
              max="5"
              value={happinessScore}
              onChange={(event) =>
                setHappinessScore(Number(event.target.value))
              }
              className="mt-3 w-full accent-pink-600"
            />
          </div>

          <div className="mt-8">
            <div className="flex justify-between gap-4">
              <label className="font-bold text-gray-900">
                How connected did you feel?
              </label>

              <span className="font-bold text-pink-700">
                {connectionScore}/5
              </span>
            </div>

            <input
              type="range"
              min="1"
              max="5"
              value={connectionScore}
              onChange={(event) =>
                setConnectionScore(Number(event.target.value))
              }
              className="mt-3 w-full accent-pink-600"
            />
          </div>

          <div className="mt-8">
            <h2 className="text-xl font-bold text-gray-900">
              What affected today?
            </h2>

            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              {reasonOptions.map((reason) => (
                <button
                  key={reason}
                  type="button"
                  onClick={() => toggleReason(reason)}
                  className={`rounded-xl border px-4 py-3 text-left text-sm font-medium transition ${
                    reasons.includes(reason)
                      ? "border-pink-600 bg-pink-50 text-pink-800"
                      : "border-pink-100 text-gray-700 hover:bg-pink-50"
                  }`}
                >
                  {reasons.includes(reason) ? "✓ " : ""}
                  {reason}
                </button>
              ))}
            </div>
          </div>

          <div className="mt-8">
            <label className="font-bold text-gray-900">
              Tell your partner something about today
            </label>

            <textarea
              value={note}
              onChange={(event) => setNote(event.target.value)}
              rows={4}
              placeholder="I felt happiest when..."
              className="mt-3 w-full resize-none rounded-2xl border border-pink-200 px-4 py-3 text-gray-900 outline-none focus:border-pink-500"
            />
          </div>

          <div className="mt-6">
            <label className="font-bold text-gray-900">
              What could make tomorrow better?
            </label>

            <input
              type="text"
              value={tomorrowRequest}
              onChange={(event) =>
                setTomorrowRequest(event.target.value)
              }
              placeholder="More quality time, reassurance, a phone call..."
              className="mt-3 w-full rounded-2xl border border-pink-200 px-4 py-3 text-gray-900 outline-none focus:border-pink-500"
            />
          </div>

          <button
            type="button"
            onClick={saveCheckIn}
            disabled={saving || !coupleId}
            className="mt-8 w-full rounded-full bg-pink-600 px-6 py-4 text-lg font-bold text-white shadow-md transition hover:bg-pink-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {saving ? "Saving..." : "Save Today’s Check-In"}
          </button>

          {message && (
            <p className="mt-5 text-center text-sm font-semibold text-gray-700">
              {message}
            </p>
          )}
        </section>
      </div>
    </main>
  );
}