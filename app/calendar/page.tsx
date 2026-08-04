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
};

type MemberProfile = {
  userId: string;
  name: string;
};

type DaySummary = {
  date: string;
  checkIns: CheckIn[];
  averageHappiness: number;
  averageConnection: number;
  status: "rough" | "okay" | "good";
};

function localDateString(date: Date) {
  const localDate = new Date(
    date.getTime() - date.getTimezoneOffset() * 60000
  );

  return localDate.toISOString().slice(0, 10);
}

function formatFullDate(date: string) {
  return new Date(`${date}T12:00:00`).toLocaleDateString(undefined, {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
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

function dayStatus(score: number): DaySummary["status"] {
  if (score >= 4) return "good";
  if (score >= 3) return "okay";
  return "rough";
}

function statusLabel(status: DaySummary["status"]) {
  if (status === "good") return "Good day";
  if (status === "okay") return "Okay day";
  return "Rough day";
}

function statusStyles(status: DaySummary["status"]) {
  if (status === "good") {
    return {
      day: "border-emerald-300 bg-emerald-50",
      dot: "bg-emerald-500",
      badge: "bg-emerald-100 text-emerald-800",
    };
  }

  if (status === "okay") {
    return {
      day: "border-amber-300 bg-amber-50",
      dot: "bg-amber-500",
      badge: "bg-amber-100 text-amber-800",
    };
  }

  return {
    day: "border-rose-300 bg-rose-50",
    dot: "bg-rose-500",
    badge: "bg-rose-100 text-rose-800",
  };
}

export default function CalendarPage() {
  const router = useRouter();

  const [userId, setUserId] = useState("");
  const [coupleId, setCoupleId] = useState("");
  const [members, setMembers] = useState<MemberProfile[]>([]);
  const [checkIns, setCheckIns] = useState<CheckIn[]>([]);

  const [monthCursor, setMonthCursor] = useState(() => {
    const today = new Date();
    return new Date(today.getFullYear(), today.getMonth(), 1);
  });

  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [pageError, setPageError] = useState("");

  useEffect(() => {
    loadCalendar();
  }, [monthCursor]);

  async function loadCalendar() {
    setLoading(true);
    setPageError("");

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

    if (membershipError) {
      setPageError(membershipError.message);
      setLoading(false);
      return;
    }

    if (!membership) {
      setPageError("Connect with your partner before using the calendar.");
      setLoading(false);
      return;
    }

    const currentCoupleId = membership.couple_id;
    setCoupleId(currentCoupleId);

    const { data: memberRows, error: memberError } = await supabase
      .from("couple_members")
      .select("user_id")
      .eq("couple_id", currentCoupleId);

    if (memberError) {
      setPageError(memberError.message);
      setLoading(false);
      return;
    }

    const memberProfiles: MemberProfile[] = [];

    for (const member of memberRows || []) {
      if (member.user_id === user.id) {
        const currentName =
          user.user_metadata?.display_name ||
          user.email?.split("@")[0] ||
          "You";

        memberProfiles.push({
          userId: member.user_id,
          name: currentName,
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

    const firstDay = new Date(
      monthCursor.getFullYear(),
      monthCursor.getMonth(),
      1
    );

    const lastDay = new Date(
      monthCursor.getFullYear(),
      monthCursor.getMonth() + 1,
      0
    );

    const { data: monthCheckIns, error: checkInError } = await supabase
      .from("daily_checkins")
      .select(
        "id, user_id, checkin_date, mood, happiness_score, connection_score, reasons, note, tomorrow_request"
      )
      .eq("couple_id", currentCoupleId)
      .gte("checkin_date", localDateString(firstDay))
      .lte("checkin_date", localDateString(lastDay))
      .order("checkin_date", { ascending: true });

    if (checkInError) {
      setPageError(checkInError.message);
      setLoading(false);
      return;
    }

    setCheckIns(monthCheckIns || []);
    setLoading(false);
  }

  const summaries = useMemo(() => {
    const grouped = new Map<string, CheckIn[]>();

    for (const checkIn of checkIns) {
      const existing = grouped.get(checkIn.checkin_date) || [];
      existing.push(checkIn);
      grouped.set(checkIn.checkin_date, existing);
    }

    const result = new Map<string, DaySummary>();

    for (const [date, entries] of grouped.entries()) {
      const averageHappiness =
        entries.reduce(
          (total, entry) => total + entry.happiness_score,
          0
        ) / entries.length;

      const averageConnection =
        entries.reduce(
          (total, entry) => total + entry.connection_score,
          0
        ) / entries.length;

      result.set(date, {
        date,
        checkIns: entries,
        averageHappiness,
        averageConnection,
        status: dayStatus(averageHappiness),
      });
    }

    return result;
  }, [checkIns]);

  const calendarDays = useMemo(() => {
    const year = monthCursor.getFullYear();
    const month = monthCursor.getMonth();
    const firstWeekday = new Date(year, month, 1).getDay();
    const totalDays = new Date(year, month + 1, 0).getDate();

    const cells: Array<number | null> = [];

    for (let index = 0; index < firstWeekday; index += 1) {
      cells.push(null);
    }

    for (let day = 1; day <= totalDays; day += 1) {
      cells.push(day);
    }

    while (cells.length % 7 !== 0) {
      cells.push(null);
    }

    return cells;
  }, [monthCursor]);

  const selectedSummary = selectedDate
    ? summaries.get(selectedDate) || null
    : null;

  function dateForDay(day: number) {
    const year = monthCursor.getFullYear();
    const month = String(monthCursor.getMonth() + 1).padStart(2, "0");
    const date = String(day).padStart(2, "0");

    return `${year}-${month}-${date}`;
  }

  function memberName(checkInUserId: string) {
    if (checkInUserId === userId) {
      const currentUser = members.find(
        (member) => member.userId === userId
      );

      return `You · ${currentUser?.name || "You"}`;
    }

    return (
      members.find((member) => member.userId === checkInUserId)?.name ||
      "Your Partner"
    );
  }

  function previousMonth() {
    setSelectedDate(null);

    setMonthCursor(
      new Date(
        monthCursor.getFullYear(),
        monthCursor.getMonth() - 1,
        1
      )
    );
  }

  function nextMonth() {
    setSelectedDate(null);

    setMonthCursor(
      new Date(
        monthCursor.getFullYear(),
        monthCursor.getMonth() + 1,
        1
      )
    );
  }

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-gradient-to-br from-pink-100 via-rose-50 to-pink-200">
        <div className="text-center">
          <div className="animate-pulse text-6xl">📅</div>

          <p className="mt-4 font-semibold text-pink-700">
            Opening your calendar...
          </p>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-gradient-to-br from-pink-100 via-rose-50 to-pink-200 px-4 py-8">
      <div className="mx-auto max-w-5xl">
        <header className="mb-6 flex items-start justify-between gap-4">
          <div>
            <p className="text-sm font-bold uppercase tracking-[0.2em] text-pink-600">
              Together ❤️
            </p>

            <h1 className="mt-2 text-4xl font-bold text-gray-900">
              Mood Calendar
            </h1>

            <p className="mt-2 text-gray-600">
              See your good, okay, and difficult days together.
            </p>
          </div>

          <Link
            href="/dashboard"
            className="rounded-full border border-pink-200 bg-white px-4 py-2 text-sm font-semibold text-pink-700 shadow-sm"
          >
            Back
          </Link>
        </header>

        {pageError && (
          <div className="mb-6 rounded-2xl border border-red-200 bg-red-50 p-4 text-center font-semibold text-red-700">
            {pageError}
          </div>
        )}

        <section className="rounded-[2rem] bg-white p-5 shadow-xl sm:p-8">
          <div className="flex items-center justify-between gap-4">
            <button
              type="button"
              onClick={previousMonth}
              className="flex h-11 w-11 items-center justify-center rounded-full border border-pink-200 text-2xl font-bold text-pink-700"
              aria-label="Previous month"
            >
              ‹
            </button>

            <div className="text-center">
              <p className="text-sm font-bold uppercase tracking-widest text-pink-600">
                Relationship History
              </p>

              <h2 className="mt-1 text-2xl font-bold text-gray-900 sm:text-3xl">
                {monthCursor.toLocaleDateString(undefined, {
                  month: "long",
                  year: "numeric",
                })}
              </h2>
            </div>

            <button
              type="button"
              onClick={nextMonth}
              className="flex h-11 w-11 items-center justify-center rounded-full border border-pink-200 text-2xl font-bold text-pink-700"
              aria-label="Next month"
            >
              ›
            </button>
          </div>

          <div className="mt-7 grid grid-cols-7 gap-1 text-center text-xs font-bold uppercase text-gray-500 sm:gap-2 sm:text-sm">
            <div>Sun</div>
            <div>Mon</div>
            <div>Tue</div>
            <div>Wed</div>
            <div>Thu</div>
            <div>Fri</div>
            <div>Sat</div>
          </div>

          <div className="mt-2 grid grid-cols-7 gap-1 sm:gap-2">
            {calendarDays.map((day, index) => {
              if (day === null) {
                return (
                  <div
                    key={`empty-${index}`}
                    className="aspect-square"
                  />
                );
              }

              const date = dateForDay(day);
              const summary = summaries.get(date);
              const isToday = date === localDateString(new Date());
              const isSelected = date === selectedDate;
              const styles = summary
                ? statusStyles(summary.status)
                : null;

              return (
                <button
                  key={date}
                  type="button"
                  onClick={() => setSelectedDate(date)}
                  className={`relative aspect-square rounded-xl border p-1 text-left transition sm:rounded-2xl sm:p-2 ${
                    styles
                      ? styles.day
                      : "border-gray-200 bg-white hover:bg-pink-50"
                  } ${
                    isSelected
                      ? "ring-2 ring-pink-600 ring-offset-2"
                      : ""
                  } ${
                    isToday
                      ? "shadow-[inset_0_0_0_2px_#db2777]"
                      : ""
                  }`}
                >
                  <span className="text-xs font-bold text-gray-800 sm:text-base">
                    {day}
                  </span>

                  {summary && (
                    <>
                      <span
                        className={`absolute bottom-1 right-1 h-2.5 w-2.5 rounded-full sm:bottom-2 sm:right-2 sm:h-3 sm:w-3 ${styles?.dot}`}
                      />

                      <span className="absolute bottom-1 left-1 text-[9px] font-bold text-gray-600 sm:bottom-2 sm:left-2 sm:text-xs">
                        {summary.checkIns.length}/{members.length}
                      </span>
                    </>
                  )}
                </button>
              );
            })}
          </div>

          <div className="mt-6 flex flex-wrap justify-center gap-3 text-sm">
            <div className="flex items-center gap-2 rounded-full bg-emerald-50 px-3 py-2">
              <span className="h-3 w-3 rounded-full bg-emerald-500" />
              Good day
            </div>

            <div className="flex items-center gap-2 rounded-full bg-amber-50 px-3 py-2">
              <span className="h-3 w-3 rounded-full bg-amber-500" />
              Okay day
            </div>

            <div className="flex items-center gap-2 rounded-full bg-rose-50 px-3 py-2">
              <span className="h-3 w-3 rounded-full bg-rose-500" />
              Rough day
            </div>

            <div className="flex items-center gap-2 rounded-full bg-gray-100 px-3 py-2">
              <span className="h-3 w-3 rounded-full bg-gray-300" />
              No check-in
            </div>
          </div>
        </section>

        <section className="mt-6 rounded-[2rem] bg-white p-6 shadow-xl sm:p-8">
          {!selectedDate ? (
            <div className="py-8 text-center">
              <div className="text-5xl">👆</div>

              <h2 className="mt-4 text-2xl font-bold text-gray-900">
                Choose a day
              </h2>

              <p className="mt-2 text-gray-600">
                Tap any date to review that day’s check-ins.
              </p>
            </div>
          ) : !selectedSummary ? (
            <div className="py-8 text-center">
              <div className="text-5xl">📭</div>

              <h2 className="mt-4 text-2xl font-bold text-gray-900">
                {formatFullDate(selectedDate)}
              </h2>

              <p className="mt-2 text-gray-600">
                Neither of you completed a check-in on this day.
              </p>

              {selectedDate === localDateString(new Date()) && (
                <Link
                  href="/checkin"
                  className="mt-6 inline-block rounded-full bg-pink-600 px-6 py-3 font-bold text-white"
                >
                  Complete Today’s Check-In
                </Link>
              )}
            </div>
          ) : (
            <div>
              <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-start">
                <div>
                  <p className="text-sm font-bold uppercase tracking-widest text-pink-600">
                    Day Details
                  </p>

                  <h2 className="mt-2 text-3xl font-bold text-gray-900">
                    {formatFullDate(selectedDate)}
                  </h2>
                </div>

                <span
                  className={`self-start rounded-full px-4 py-2 text-sm font-bold ${
                    statusStyles(selectedSummary.status).badge
                  }`}
                >
                  {statusLabel(selectedSummary.status)}
                </span>
              </div>

              <div className="mt-6 grid gap-4 sm:grid-cols-3">
                <div className="rounded-2xl bg-pink-50 p-5">
                  <p className="text-sm font-semibold text-gray-500">
                    Shared happiness
                  </p>

                  <p className="mt-2 text-2xl font-bold text-gray-900">
                    {selectedSummary.averageHappiness.toFixed(1)}/5
                  </p>
                </div>

                <div className="rounded-2xl bg-pink-50 p-5">
                  <p className="text-sm font-semibold text-gray-500">
                    Shared connection
                  </p>

                  <p className="mt-2 text-2xl font-bold text-gray-900">
                    {selectedSummary.averageConnection.toFixed(1)}/5
                  </p>
                </div>

                <div className="rounded-2xl bg-pink-50 p-5">
                  <p className="text-sm font-semibold text-gray-500">
                    Check-ins completed
                  </p>

                  <p className="mt-2 text-2xl font-bold text-gray-900">
                    {selectedSummary.checkIns.length}/{members.length}
                  </p>
                </div>
              </div>

              <div className="mt-6 grid gap-4 sm:grid-cols-2">
                {selectedSummary.checkIns.map((checkIn) => (
                  <article
                    key={checkIn.id}
                    className="rounded-3xl border border-pink-100 bg-pink-50 p-6"
                  >
                    <p className="text-sm font-bold uppercase tracking-widest text-pink-600">
                      {memberName(checkIn.user_id)}
                    </p>

                    <div className="mt-4 text-5xl">
                      {moodEmoji(checkIn.mood)}
                    </div>

                    <h3 className="mt-3 text-2xl font-bold text-gray-900">
                      {checkIn.mood}
                    </h3>

                    <div className="mt-4 space-y-1 text-gray-700">
                      <p>
                        Happiness:{" "}
                        <strong>{checkIn.happiness_score}/5</strong>
                      </p>

                      <p>
                        Connection:{" "}
                        <strong>{checkIn.connection_score}/5</strong>
                      </p>
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
                        <p className="text-xs font-bold uppercase tracking-widest text-pink-600">
                          About Today
                        </p>

                        <p className="mt-2 whitespace-pre-wrap text-gray-800">
                          {checkIn.note}
                        </p>
                      </div>
                    )}

                    {checkIn.tomorrow_request && (
                      <div className="mt-4 rounded-2xl bg-white p-4">
                        <p className="text-xs font-bold uppercase tracking-widest text-pink-600">
                          Tomorrow
                        </p>

                        <p className="mt-2 whitespace-pre-wrap text-gray-800">
                          {checkIn.tomorrow_request}
                        </p>
                      </div>
                    )}
                  </article>
                ))}
              </div>
            </div>
          )}
        </section>
      </div>
    </main>
  );
}