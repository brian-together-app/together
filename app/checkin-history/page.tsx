"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/app/lib/supabase";

type CheckIn = {
  id: string;
  user_id: string;
  checkin_date: string;
  mood: string;
  happiness_score: number;
  connection_score: number;
  reasons: string[];
  note: string;
  tomorrow_request: string;
  created_at: string;
  updated_at: string;
};

type Member = {
  userId: string;
  name: string;
};

function monthKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function formatDay(date: string) {
  return new Date(`${date}T12:00:00`).toLocaleDateString(undefined, {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

function formatTime(date: string) {
  return new Date(date).toLocaleTimeString(undefined, {
    hour: "numeric",
    minute: "2-digit",
  });
}

function moodEmoji(mood: string) {
  if (mood === "Rough") return "😞";
  if (mood === "Distant") return "😕";
  if (mood === "Okay") return "😐";
  if (mood === "Happy") return "🙂";
  if (mood === "Loved") return "🥰";
  return "❤️";
}

export default function CheckInHistoryPage() {
  const router = useRouter();

  const [userId, setUserId] = useState("");
  const [members, setMembers] = useState<Member[]>([]);
  const [checkIns, setCheckIns] = useState<CheckIn[]>([]);
  const [selectedMonth, setSelectedMonth] = useState(() => monthKey(new Date()));
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");

  useEffect(() => {
    loadHistory();
  }, [selectedMonth]);

  async function loadHistory() {
    setLoading(true);
    setMessage("");

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
      setMessage(
        membershipError?.message ||
          "Connect with your partner before viewing check-in history."
      );
      setLoading(false);
      return;
    }

    const { data: memberRows, error: memberError } = await supabase
      .from("couple_members")
      .select("user_id")
      .eq("couple_id", membership.couple_id);

    if (memberError) {
      setMessage(memberError.message);
      setLoading(false);
      return;
    }

    const memberProfiles: Member[] = [];

    for (const member of memberRows || []) {
      if (member.user_id === user.id) {
        memberProfiles.push({
          userId: user.id,
          name:
            user.user_metadata?.display_name ||
            user.email?.split("@")[0] ||
            "You",
        });
        continue;
      }

      const { data: profile } = await supabase
        .from("profiles")
        .select("display_name")
        .eq("id", member.user_id)
        .maybeSingle();

      memberProfiles.push({
        userId: member.user_id,
        name: profile?.display_name?.trim() || "Your Partner",
      });
    }

    setMembers(memberProfiles);

    const [year, month] = selectedMonth.split("-").map(Number);
    const firstDay = `${year}-${String(month).padStart(2, "0")}-01`;
    const lastDate = new Date(year, month, 0).getDate();
    const lastDay = `${year}-${String(month).padStart(2, "0")}-${String(lastDate).padStart(2, "0")}`;

    const { data, error } = await supabase
      .from("daily_checkins")
      .select(
        "id, user_id, checkin_date, mood, happiness_score, connection_score, reasons, note, tomorrow_request, created_at, updated_at"
      )
      .eq("couple_id", membership.couple_id)
      .gte("checkin_date", firstDay)
      .lte("checkin_date", lastDay)
      .order("checkin_date", { ascending: false })
      .order("created_at", { ascending: true });

    if (error) {
      setMessage(error.message);
      setLoading(false);
      return;
    }

    setCheckIns((data || []) as CheckIn[]);
    setLoading(false);
  }

  const groupedByDate = useMemo(() => {
    const grouped = new Map<string, CheckIn[]>();

    for (const checkIn of checkIns) {
      const entries = grouped.get(checkIn.checkin_date) || [];
      entries.push(checkIn);
      grouped.set(checkIn.checkin_date, entries);
    }

    return [...grouped.entries()];
  }, [checkIns]);

  const averageHappiness = checkIns.length
    ? (
        checkIns.reduce((total, item) => total + item.happiness_score, 0) /
        checkIns.length
      ).toFixed(1)
    : "0.0";

  const averageConnection = checkIns.length
    ? (
        checkIns.reduce((total, item) => total + item.connection_score, 0) /
        checkIns.length
      ).toFixed(1)
    : "0.0";

  const completedDays = groupedByDate.filter(
    ([, entries]) => entries.length >= members.length && members.length > 0
  ).length;

  function memberName(checkInUserId: string) {
    if (checkInUserId === userId) {
      const me = members.find((member) => member.userId === userId);
      return `You · ${me?.name || "You"}`;
    }

    return (
      members.find((member) => member.userId === checkInUserId)?.name ||
      "Your Partner"
    );
  }

  return (
    <main className="min-h-screen px-4 pb-28 pt-8 sm:px-6 sm:pb-12">
      <div className="mx-auto max-w-5xl animate-soft-fade-up">
        <header className="mb-7 flex items-start justify-between gap-4">
          <div>
            <p className="text-sm font-bold uppercase tracking-[0.2em] text-pink-600">
              Together ❤️
            </p>
            <h1 className="mt-2 text-4xl font-black text-gray-900 sm:text-5xl">
              Check-In History
            </h1>
            <p className="mt-2 text-gray-600">
              Look back at your moods, notes, scores, and check-in times.
            </p>
          </div>

          <Link
            href="/dashboard"
            className="rounded-full border border-pink-200 bg-white px-4 py-2 text-sm font-semibold text-pink-700 shadow-sm"
          >
            Back
          </Link>
        </header>

        <section className="glass-card mb-7 rounded-[2rem] p-6 sm:p-8">
          <div className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-sm font-bold uppercase tracking-widest text-pink-600">
                Monthly Overview
              </p>
              <h2 className="mt-2 text-3xl font-black text-gray-900">
                Your relationship at a glance
              </h2>
            </div>

            <div>
              <label
                htmlFor="history-month"
                className="block text-sm font-bold text-gray-700"
              >
                Choose month
              </label>
              <input
                id="history-month"
                type="month"
                value={selectedMonth}
                max={monthKey(new Date())}
                onChange={(event) => setSelectedMonth(event.target.value)}
                className="mt-2 rounded-2xl border border-pink-200 bg-white px-4 py-3 text-gray-900 outline-none"
              />
            </div>
          </div>

          <div className="mt-6 grid gap-4 sm:grid-cols-3">
            <div className="rounded-2xl bg-pink-50 p-5">
              <p className="text-sm font-semibold text-gray-500">Average happiness</p>
              <p className="mt-2 text-3xl font-black text-gray-900">{averageHappiness}/5</p>
            </div>
            <div className="rounded-2xl bg-pink-50 p-5">
              <p className="text-sm font-semibold text-gray-500">Average connection</p>
              <p className="mt-2 text-3xl font-black text-gray-900">{averageConnection}/5</p>
            </div>
            <div className="rounded-2xl bg-pink-50 p-5">
              <p className="text-sm font-semibold text-gray-500">Both completed</p>
              <p className="mt-2 text-3xl font-black text-gray-900">{completedDays} days</p>
            </div>
          </div>
        </section>

        <section className="glass-card rounded-[2rem] p-6 sm:p-8">
          <p className="text-sm font-bold uppercase tracking-widest text-pink-600">
            Timeline
          </p>
          <h2 className="mt-2 text-3xl font-black text-gray-900">Past Check-Ins</h2>

          {loading ? (
            <div className="py-16 text-center">
              <div className="animate-pulse text-6xl">😊</div>
              <p className="mt-4 font-semibold text-pink-700">Loading history...</p>
            </div>
          ) : message ? (
            <div className="mt-6 rounded-2xl border border-red-200 bg-red-50 p-5 text-center font-semibold text-red-700">
              {message}
            </div>
          ) : groupedByDate.length === 0 ? (
            <div className="py-16 text-center">
              <div className="text-6xl">📭</div>
              <h3 className="mt-4 text-2xl font-bold text-gray-900">No check-ins this month</h3>
              <p className="mt-2 text-gray-600">Your completed check-ins will appear here.</p>
            </div>
          ) : (
            <div className="mt-8 space-y-8">
              {groupedByDate.map(([date, entries]) => (
                <article
                  key={date}
                  className="relative border-l-4 border-pink-200 pl-5 sm:pl-8"
                >
                  <span className="absolute -left-[11px] top-0 h-[18px] w-[18px] rounded-full border-4 border-white bg-pink-600 shadow" />

                  <div className="app-card rounded-3xl p-5 sm:p-7">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                      <h3 className="text-2xl font-black text-gray-900">{formatDay(date)}</h3>
                      <span className="self-start rounded-full bg-pink-100 px-3 py-2 text-sm font-bold text-pink-700">
                        {entries.length}/{members.length} completed
                      </span>
                    </div>

                    <div className="mt-5 grid gap-4 sm:grid-cols-2">
                      {entries.map((checkIn) => (
                        <div key={checkIn.id} className="rounded-3xl bg-pink-50 p-5">
                          <p className="text-sm font-bold uppercase tracking-widest text-pink-600">
                            {memberName(checkIn.user_id)}
                          </p>

                          <div className="mt-4 flex items-center gap-3">
                            <span className="text-5xl">{moodEmoji(checkIn.mood)}</span>
                            <div>
                              <h4 className="text-2xl font-black text-gray-900">{checkIn.mood}</h4>
                              <p className="text-sm font-semibold text-gray-500">
                                Checked in at {formatTime(checkIn.created_at)}
                              </p>
                            </div>
                          </div>

                          <div className="mt-5 grid grid-cols-2 gap-3">
                            <div className="rounded-2xl bg-white p-4">
                              <p className="text-xs font-bold uppercase tracking-widest text-gray-500">Happiness</p>
                              <p className="mt-1 text-xl font-black text-gray-900">{checkIn.happiness_score}/5</p>
                            </div>
                            <div className="rounded-2xl bg-white p-4">
                              <p className="text-xs font-bold uppercase tracking-widest text-gray-500">Connection</p>
                              <p className="mt-1 text-xl font-black text-gray-900">{checkIn.connection_score}/5</p>
                            </div>
                          </div>

                          {checkIn.reasons?.length > 0 && (
                            <div className="mt-5 flex flex-wrap gap-2">
                              {checkIn.reasons.map((reason) => (
                                <span
                                  key={reason}
                                  className="rounded-full bg-white px-3 py-2 text-xs font-semibold text-pink-700"
                                >
                                  {reason}
                                </span>
                              ))}
                            </div>
                          )}

                          {checkIn.note && (
                            <div className="mt-5 rounded-2xl bg-white p-4">
                              <p className="text-xs font-bold uppercase tracking-widest text-pink-600">About Today</p>
                              <p className="mt-2 whitespace-pre-wrap text-gray-800">{checkIn.note}</p>
                            </div>
                          )}

                          {checkIn.tomorrow_request && (
                            <div className="mt-4 rounded-2xl bg-white p-4">
                              <p className="text-xs font-bold uppercase tracking-widest text-pink-600">Tomorrow</p>
                              <p className="mt-2 whitespace-pre-wrap text-gray-800">{checkIn.tomorrow_request}</p>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}