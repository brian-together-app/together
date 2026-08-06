"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/app/lib/supabase";
import QuickActions from "@/components/dashboard/QuickActions";

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

type NotificationItem = {
  id: string;
  notification_type: string;
  title: string;
  message: string | null;
  link: string | null;
  is_read: boolean;
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

function formatRelativeTime(date: string) {
  const value = new Date(date);
  const now = new Date();
  const difference = now.getTime() - value.getTime();

  const minutes = Math.floor(difference / 60000);
  const hours = Math.floor(difference / 3600000);
  const days = Math.floor(difference / 86400000);

  if (minutes < 1) return "Just now";
  if (minutes < 60) return `${minutes} min ago`;
  if (hours < 24) return `${hours} hr${hours === 1 ? "" : "s"} ago`;
  if (days < 7) return `${days} day${days === 1 ? "" : "s"} ago`;

  return value.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function notificationIcon(type: string) {
  if (type === "love_note") return "💌";
  if (type === "memory") return "📸";
  if (type === "memory_comment") return "💬";
  if (type === "checkin") return "😊";
  if (type === "streak") return "🔥";
  return "🔔";
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

  const [currentUserId, setCurrentUserId] = useState("");
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

  const [recentNotifications, setRecentNotifications] = useState<
    NotificationItem[]
  >([]);
  const [unreadNotificationCount, setUnreadNotificationCount] = useState(0);

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

    setCurrentUserId(user.id);

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

    const { data: notificationRows, error: notificationError } = await supabase
      .from("notifications")
      .select(
        "id, notification_type, title, message, link, is_read, created_at"
      )
      .eq("recipient_id", user.id)
      .order("created_at", { ascending: false })
      .limit(3);

    if (!notificationError) {
      setRecentNotifications(
        (notificationRows || []) as NotificationItem[]
      );
    }

    const { count: unreadCount, error: unreadError } = await supabase
      .from("notifications")
      .select("id", {
        count: "exact",
        head: true,
      })
      .eq("recipient_id", user.id)
      .eq("is_read", false);

    if (!unreadError) {
      setUnreadNotificationCount(unreadCount || 0);
    }

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

  const checkInsForScore = [myCheckIn, partnerCheckIn].filter(
    (checkIn): checkIn is CheckIn => Boolean(checkIn)
  );

  const scoreHappiness = checkInsForScore.length
    ? checkInsForScore.reduce(
        (total, checkIn) => total + checkIn.happiness_score,
        0
      ) / checkInsForScore.length
    : 0;

  const scoreConnection = checkInsForScore.length
    ? checkInsForScore.reduce(
        (total, checkIn) => total + checkIn.connection_score,
        0
      ) / checkInsForScore.length
    : 0;

  const togetherScore = Math.min(
    100,
    Math.round(
      scoreHappiness * 6 +
        scoreConnection * 6 +
        (bothCheckedIn ? 15 : checkInsForScore.length === 1 ? 8 : 0) +
        Math.min(sharedStreak * 3, 15) +
        (latestLoveNote ? 10 : 0)
    )
  );

  function scoreLabel() {
    if (togetherScore >= 85) return "Strong day together ❤️";
    if (togetherScore >= 70) return "Feeling connected 💕";
    if (togetherScore >= 50) return "Building the day together 🌷";
    return "A fresh chance to connect 🤍";
  }

  function personalUpdate() {
    if (
      latestLoveNote &&
      latestLoveNote.recipient_id === currentUserId &&
      !latestNoteIsLocked
    ) {
      return `You have a love note waiting from ${partnerName}.`;
    }

    if (partnerCheckIn?.mood === "Rough") {
      return `${partnerName} had a rough check-in today. A little extra care may mean a lot.`;
    }

    if (partnerCheckIn?.mood === "Distant") {
      return `${partnerName} is feeling distant today. A gentle check-in could help you reconnect.`;
    }

    if (bothCheckedIn && scoreConnection >= 4) {
      return `You both checked in and your connection is feeling strong today.`;
    }

    if (partnerCheckIn && !myCheckIn) {
      return `${partnerName} has already checked in today. Your check-in is still waiting.`;
    }

    if (myCheckIn && !partnerCheckIn) {
      return `You checked in today. ${partnerName}'s check-in is still waiting.`;
    }

    if (bothCheckedIn) {
      return `You both showed up for today's check-in. Keep the conversation going.`;
    }

    return "Start with a quick check-in and build today's story together.";
  }

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
    <main className="min-h-screen bg-gradient-to-br from-pink-100 via-rose-50 to-pink-200 px-4 pb-28 pt-6 sm:px-6 sm:pb-10 sm:pt-10">
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

        <section className="mb-6 overflow-hidden rounded-[2rem] border border-pink-100 bg-white shadow-xl">
          <div className="p-6 sm:p-8">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <div className="flex items-center gap-3">
                  <span className="text-4xl">🔔</span>

                  <div>
                    <p className="text-sm font-bold uppercase tracking-[0.2em] text-pink-600">
                      New Updates
                    </p>

                    <h2 className="mt-1 text-2xl font-black text-gray-900 sm:text-3xl">
                      {unreadNotificationCount > 0
                        ? `You have ${unreadNotificationCount} new ${
                            unreadNotificationCount === 1
                              ? "update"
                              : "updates"
                          }`
                        : "You’re all caught up"}
                    </h2>
                  </div>
                </div>

                <p className="mt-3 text-gray-600">
                  Love notes, comments, memories, and check-ins appear here
                  when you log in.
                </p>
              </div>

              <Link
                href="/notifications"
                className="rounded-full bg-pink-600 px-5 py-3 text-center text-sm font-bold text-white shadow-md transition hover:bg-pink-700"
              >
                View All Updates
              </Link>
            </div>

            {recentNotifications.length > 0 ? (
              <div className="mt-6 grid gap-3">
                {recentNotifications.map((notification) => (
                  <Link
                    key={notification.id}
                    href={notification.link || "/notifications"}
                    className={`flex items-start gap-4 rounded-3xl border p-4 transition hover:-translate-y-0.5 hover:shadow-md ${
                      notification.is_read
                        ? "border-pink-100 bg-white"
                        : "border-pink-300 bg-pink-50"
                    }`}
                  >
                    <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-white text-2xl shadow-sm">
                      {notificationIcon(notification.notification_type)}
                    </span>

                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="font-black text-gray-900">
                          {notification.title}
                        </h3>

                        {!notification.is_read && (
                          <span className="h-2.5 w-2.5 rounded-full bg-pink-600" />
                        )}
                      </div>

                      {notification.message && (
                        <p className="mt-1 line-clamp-2 text-sm text-gray-700">
                          {notification.message}
                        </p>
                      )}

                      <p className="mt-2 text-xs font-semibold text-gray-500">
                        {formatRelativeTime(notification.created_at)}
                      </p>
                    </div>
                  </Link>
                ))}
              </div>
            ) : (
              <div className="mt-6 rounded-3xl bg-pink-50 p-5 text-center">
                <p className="font-semibold text-gray-700">
                  Nothing new since your last visit ❤️
                </p>
              </div>
            )}
          </div>
        </section>

        <section className="mb-6 overflow-hidden rounded-[2rem] bg-white shadow-xl">
          <div className="grid gap-6 bg-gradient-to-r from-pink-600 to-rose-500 p-6 text-white lg:grid-cols-[1.1fr_0.9fr] sm:p-8">
            <div>
              <p className="text-sm font-bold uppercase tracking-[0.22em] text-pink-100">
                Today’s Together Score
              </p>

              <div className="mt-3 flex items-end gap-3">
                <span className="text-6xl font-black sm:text-7xl">
                  {togetherScore}
                </span>
                <span className="pb-2 text-2xl font-bold text-pink-100">
                  /100
                </span>
              </div>

              <p className="mt-2 text-xl font-bold">{scoreLabel()}</p>

              <div className="mt-5 h-4 overflow-hidden rounded-full bg-white/25">
                <div
                  className="h-full rounded-full bg-white transition-all duration-700"
                  style={{ width: `${togetherScore}%` }}
                />
              </div>

              <p className="mt-3 text-sm text-pink-100">
                A playful daily snapshot based on check-ins, your streak,
                and recent love-note activity—not a grade on your relationship.
              </p>
            </div>

            <div className="rounded-3xl bg-white/15 p-5 backdrop-blur-sm">
              <p className="text-sm font-bold uppercase tracking-widest text-pink-100">
                Personal Update
              </p>
              <div className="mt-3 text-4xl">💬</div>
              <p className="mt-3 text-lg font-semibold leading-relaxed">
                {personalUpdate()}
              </p>
              <div className="mt-5 grid grid-cols-2 gap-3 text-sm">
                <div className="rounded-2xl bg-white/15 p-3">
                  <p className="text-pink-100">Check-ins</p>
                  <p className="mt-1 font-bold">
                    {checkInsForScore.length}/{memberCount}
                  </p>
                </div>
                <div className="rounded-2xl bg-white/15 p-3">
                  <p className="text-pink-100">Shared streak</p>
                  <p className="mt-1 font-bold">🔥 {sharedStreak} days</p>
                </div>
              </div>
            </div>
          </div>
        </section>

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

        <QuickActions partnerName={partnerName} />
      </div>
    </main>
  );
}