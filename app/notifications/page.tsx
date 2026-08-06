"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/app/lib/supabase";

type NotificationRow = {
  id: string;
  couple_id: string;
  recipient_id: string;
  actor_id: string;
  notification_type: string;
  title: string;
  message: string | null;
  link: string | null;
  is_read: boolean;
  created_at: string;
};

type NotificationItem = NotificationRow & {
  actorName: string;
};

function notificationIcon(type: string) {
  if (type === "love_note") return "💌";
  if (type === "memory") return "📸";
  if (type === "memory_comment") return "💬";
  if (type === "checkin") return "😊";
  if (type === "streak") return "🔥";
  if (type === "anniversary") return "❤️";
  return "🔔";
}

function formatTimestamp(date: string) {
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
    year: value.getFullYear() !== now.getFullYear() ? "numeric" : undefined,
    hour: "numeric",
    minute: "2-digit",
  });
}

export default function NotificationsPage() {
  const router = useRouter();

  const [userId, setUserId] = useState("");
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [workingId, setWorkingId] = useState("");
  const [message, setMessage] = useState("");

  useEffect(() => {
    loadNotifications();
  }, []);

  const unreadCount = useMemo(
    () => notifications.filter((item) => !item.is_read).length,
    [notifications]
  );

  async function loadNotifications() {
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

    const { data: rows, error } = await supabase
      .from("notifications")
      .select(
        "id, couple_id, recipient_id, actor_id, notification_type, title, message, link, is_read, created_at"
      )
      .eq("recipient_id", user.id)
      .order("created_at", { ascending: false });

    if (error) {
      setMessage(error.message);
      setLoading(false);
      return;
    }

    const notificationRows = (rows || []) as NotificationRow[];

    if (notificationRows.length === 0) {
      setNotifications([]);
      setLoading(false);
      return;
    }

    const actorIds = [...new Set(notificationRows.map((row) => row.actor_id))];

    const { data: profiles } = await supabase
      .from("profiles")
      .select("id, display_name")
      .in("id", actorIds);

    const actorNames = new Map<string, string>();

    for (const profile of profiles || []) {
      actorNames.set(
        profile.id,
        profile.display_name?.trim() || "Your Partner"
      );
    }

    setNotifications(
      notificationRows.map((row) => ({
        ...row,
        actorName:
          row.actor_id === user.id
            ? "You"
            : actorNames.get(row.actor_id) || "Your Partner",
      }))
    );

    setLoading(false);
  }

  async function markAsRead(notification: NotificationItem) {
    if (notification.is_read) {
      if (notification.link) {
        router.push(notification.link);
      }
      return;
    }

    setWorkingId(notification.id);

    const { error } = await supabase
      .from("notifications")
      .update({ is_read: true })
      .eq("id", notification.id)
      .eq("recipient_id", userId);

    if (error) {
      setMessage(error.message);
      setWorkingId("");
      return;
    }

    setNotifications((current) =>
      current.map((item) =>
        item.id === notification.id ? { ...item, is_read: true } : item
      )
    );

    setWorkingId("");

    if (notification.link) {
      router.push(notification.link);
    }
  }

  async function markAllAsRead() {
    const unreadIds = notifications
      .filter((item) => !item.is_read)
      .map((item) => item.id);

    if (unreadIds.length === 0) return;

    setMessage("");

    const { error } = await supabase
      .from("notifications")
      .update({ is_read: true })
      .eq("recipient_id", userId)
      .in("id", unreadIds);

    if (error) {
      setMessage(error.message);
      return;
    }

    setNotifications((current) =>
      current.map((item) => ({ ...item, is_read: true }))
    );
  }

  async function deleteNotification(id: string) {
    setWorkingId(id);
    setMessage("");

    const { error } = await supabase
      .from("notifications")
      .delete()
      .eq("id", id)
      .eq("recipient_id", userId);

    if (error) {
      setMessage(error.message);
      setWorkingId("");
      return;
    }

    setNotifications((current) => current.filter((item) => item.id !== id));
    setWorkingId("");
  }

  return (
    <main className="min-h-screen px-4 pb-28 pt-8 sm:px-6 sm:pb-12">
      <div className="mx-auto max-w-4xl animate-soft-fade-up">
        <header className="mb-7 flex items-start justify-between gap-4">
          <div>
            <p className="text-sm font-bold uppercase tracking-[0.2em] text-pink-600">
              Together ❤️
            </p>

            <h1 className="mt-2 text-4xl font-black text-gray-900 sm:text-5xl">
              Notifications
            </h1>

            <p className="mt-2 text-gray-600">
              New love notes, memories, comments, check-ins, and updates.
            </p>
          </div>

          <Link
            href="/dashboard"
            className="rounded-full border border-pink-200 bg-white px-4 py-2 text-sm font-semibold text-pink-700 shadow-sm"
          >
            Back
          </Link>
        </header>

        <section className="glass-card rounded-[2rem] p-6 sm:p-8">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm font-bold uppercase tracking-widest text-pink-600">
                Activity Center
              </p>

              <h2 className="mt-2 text-3xl font-black text-gray-900">
                {unreadCount > 0
                  ? `${unreadCount} new ${unreadCount === 1 ? "update" : "updates"}`
                  : "You’re all caught up"}
              </h2>
            </div>

            <button
              type="button"
              onClick={markAllAsRead}
              disabled={unreadCount === 0}
              className="rounded-full border border-pink-200 bg-white px-5 py-3 text-sm font-bold text-pink-700 shadow-sm disabled:cursor-not-allowed disabled:opacity-50"
            >
              Mark all as read
            </button>
          </div>

          {message && (
            <div className="mt-6 rounded-2xl border border-red-200 bg-red-50 p-4 text-center font-semibold text-red-700">
              {message}
            </div>
          )}

          {loading ? (
            <div className="py-16 text-center">
              <div className="animate-pulse text-6xl">🔔</div>
              <p className="mt-4 font-semibold text-pink-700">
                Loading notifications...
              </p>
            </div>
          ) : notifications.length === 0 ? (
            <div className="py-16 text-center">
              <div className="text-6xl">💗</div>
              <h3 className="mt-4 text-2xl font-bold text-gray-900">
                Nothing new yet
              </h3>
              <p className="mx-auto mt-2 max-w-md text-gray-600">
                New love notes, memories, comments, and check-ins will appear
                here.
              </p>
            </div>
          ) : (
            <div className="mt-8 space-y-4">
              {notifications.map((notification) => (
                <article
                  key={notification.id}
                  className={`rounded-3xl border p-5 transition sm:p-6 ${
                    notification.is_read
                      ? "border-pink-100 bg-white/75"
                      : "border-pink-300 bg-pink-50 shadow-md"
                  }`}
                >
                  <div className="flex items-start gap-4">
                    <button
                      type="button"
                      onClick={() => markAsRead(notification)}
                      disabled={workingId === notification.id}
                      className="flex min-w-0 flex-1 items-start gap-4 text-left disabled:opacity-60"
                    >
                      <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-white text-3xl shadow-sm">
                        {notificationIcon(notification.notification_type)}
                      </div>

                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className="text-lg font-black text-gray-900">
                            {notification.title}
                          </h3>

                          {!notification.is_read && (
                            <span className="h-2.5 w-2.5 rounded-full bg-pink-600" />
                          )}
                        </div>

                        {notification.message && (
                          <p className="mt-2 text-gray-700">
                            {notification.message}
                          </p>
                        )}

                        <p className="mt-3 text-sm font-semibold text-gray-500">
                          {notification.actorName} ·{" "}
                          {formatTimestamp(notification.created_at)}
                        </p>
                      </div>
                    </button>

                    <button
                      type="button"
                      onClick={() => deleteNotification(notification.id)}
                      disabled={workingId === notification.id}
                      className="shrink-0 rounded-full border border-pink-200 bg-white px-3 py-2 text-xs font-bold text-pink-700 disabled:opacity-50"
                    >
                      Delete
                    </button>
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