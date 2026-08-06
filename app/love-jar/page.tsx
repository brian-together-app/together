"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/app/lib/supabase";

type LoveNote = {
  id: string;
  sender_id: string;
  recipient_id: string | null;
  message: string;
  category: string;
  open_on: string | null;
  opened_at: string | null;
  created_at: string;
};

const categories = [
  "Love Note",
  "Compliment",
  "Thank You",
  "Inside Joke",
  "Open When",
  "Special Surprise",
];

function getToday() {
  const now = new Date();
  const localDate = new Date(
    now.getTime() - now.getTimezoneOffset() * 60000
  );

  return localDate.toISOString().slice(0, 10);
}

function formatDate(date: string) {
  return new Date(`${date}T12:00:00`).toLocaleDateString(undefined, {
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

function formatCreatedAt(date: string) {
  return new Date(date).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export default function LoveJarPage() {
  const router = useRouter();

  const [userId, setUserId] = useState("");
  const [coupleId, setCoupleId] = useState("");
  const [partnerId, setPartnerId] = useState("");

  const [message, setMessage] = useState("");
  const [category, setCategory] = useState("Love Note");
  const [openOn, setOpenOn] = useState("");

  const [receivedNotes, setReceivedNotes] = useState<LoveNote[]>([]);
  const [sentNotes, setSentNotes] = useState<LoveNote[]>([]);

  const [status, setStatus] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);

  useEffect(() => {
    loadLoveJar();
  }, []);

  async function loadLoveJar() {
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
      setStatus("Create your relationship space before using the Love Jar.");
      setLoading(false);
      return;
    }

    setCoupleId(membership.couple_id);

    const { data: members, error: membersError } = await supabase
      .from("couple_members")
      .select("user_id")
      .eq("couple_id", membership.couple_id);

    if (membersError) {
      setStatus(membersError.message);
      setLoading(false);
      return;
    }

    const partner = members?.find(
      (member) => member.user_id !== user.id
    );

    if (partner) {
      setPartnerId(partner.user_id);
    }

    await loadNotes(user.id, membership.couple_id);
    setLoading(false);
  }

  async function loadNotes(
    currentUserId: string,
    currentCoupleId: string
  ) {
    const { data, error } = await supabase
      .from("love_jar_notes")
      .select(
        "id, sender_id, recipient_id, message, category, open_on, opened_at, created_at"
      )
      .eq("couple_id", currentCoupleId)
      .order("created_at", { ascending: false });

    if (error) {
      setStatus(error.message);
      return;
    }

    const notes = data || [];

    setReceivedNotes(
      notes.filter((note) => note.recipient_id === currentUserId)
    );

    setSentNotes(
      notes.filter((note) => note.sender_id === currentUserId)
    );
  }

  function noteIsLocked(note: LoveNote) {
    return Boolean(note.open_on && note.open_on > getToday());
  }

  async function sendLoveNote() {
    setStatus("");

    if (!message.trim()) {
      setStatus("Write a message before adding your note.");
      return;
    }

    if (!partnerId) {
      setStatus(
        "Kimberly must create her account and join your relationship first."
      );
      return;
    }

    if (!userId || !coupleId) {
      setStatus("Your relationship space could not be found.");
      return;
    }

    setSending(true);

    const noteMessage = message.trim();

    const { data: newNote, error } = await supabase
      .from("love_jar_notes")
      .insert({
        couple_id: coupleId,
        sender_id: userId,
        recipient_id: partnerId,
        message: noteMessage,
        category,
        open_on: openOn || null,
      })
      .select("id")
      .single();

    if (error) {
      setStatus(error.message);
      setSending(false);
      return;
    }

    const notificationMessage = openOn
      ? `${category} · Locked until ${formatDate(openOn)}`
      : `${category} · Ready to open now`;

    const { error: notificationError } = await supabase
      .from("notifications")
      .insert({
        couple_id: coupleId,
        recipient_id: partnerId,
        actor_id: userId,
        notification_type: "love_note",
        title: "Your partner left you a Love Note",
        message: notificationMessage,
        link: "/love-jar",
      });

    if (notificationError) {
      console.error(
        `Love note ${newNote.id} was saved, but its notification failed:`,
        notificationError.message
      );
    }

    setMessage("");
    setCategory("Love Note");
    setOpenOn("");
    setStatus("Your note was added to Kimberly’s Love Jar ❤️");
    await loadNotes(userId, coupleId);
    setSending(false);
  }

  async function openNote(note: LoveNote) {
    if (noteIsLocked(note)) {
      setStatus(`This note is locked until ${formatDate(note.open_on!)}.`);
      return;
    }

    if (!note.opened_at) {
      const { error } = await supabase
        .from("love_jar_notes")
        .update({
          opened_at: new Date().toISOString(),
        })
        .eq("id", note.id);

      if (error) {
        setStatus(error.message);
        return;
      }

      await loadNotes(userId, coupleId);
    }

    setStatus("");
  }

  async function deleteSentNote(noteId: string) {
    const confirmed = window.confirm(
      "Are you sure you want to delete this love note?"
    );

    if (!confirmed) return;

    const { error } = await supabase
      .from("love_jar_notes")
      .delete()
      .eq("id", noteId);

    if (error) {
      setStatus(error.message);
    } else {
      setStatus("Love note deleted.");
      await loadNotes(userId, coupleId);
    }
  }

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-gradient-to-br from-pink-100 via-rose-50 to-pink-200">
        <div className="text-center">
          <div className="animate-pulse text-6xl">💌</div>

          <p className="mt-4 font-semibold text-pink-700">
            Opening your Love Jar...
          </p>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-gradient-to-br from-pink-100 via-rose-50 to-pink-200 px-4 py-8">
      <div className="mx-auto max-w-4xl">
        <header className="mb-6 flex items-start justify-between gap-4">
          <div>
            <p className="text-sm font-bold uppercase tracking-[0.2em] text-pink-600">
              Together ❤️
            </p>

            <h1 className="mt-2 text-4xl font-bold text-gray-900">
              Love Jar
            </h1>

            <p className="mt-2 text-gray-600">
              Leave something sweet for Kimberly to discover.
            </p>
          </div>

          <Link
            href="/dashboard"
            className="rounded-full border border-pink-200 bg-white px-4 py-2 text-sm font-semibold text-pink-700 shadow-sm"
          >
            Back
          </Link>
        </header>

        <section className="mb-6 rounded-[2rem] bg-white p-6 shadow-xl sm:p-8">
          <div className="text-center">
            <div className="text-6xl">💌</div>

            <h2 className="mt-4 text-3xl font-bold text-gray-900">
              Write a Love Note
            </h2>

            <p className="mt-2 text-gray-600">
              {partnerId
                ? "This note will be sent to Kimberly."
                : "Waiting for Kimberly to connect her account."}
            </p>
          </div>

          <div className="mt-8">
            <label className="font-bold text-gray-900">
              What would you like to say?
            </label>

            <textarea
              value={message}
              onChange={(event) => setMessage(event.target.value)}
              rows={6}
              maxLength={2000}
              placeholder="I wanted you to know..."
              className="mt-3 w-full resize-none rounded-2xl border border-pink-200 px-4 py-3 text-gray-900 outline-none focus:border-pink-500"
            />

            <p className="mt-1 text-right text-sm text-gray-500">
              {message.length}/2000
            </p>
          </div>

          <div className="mt-5 grid gap-4 sm:grid-cols-2">
            <div>
              <label className="font-bold text-gray-900">
                Note type
              </label>

              <select
                value={category}
                onChange={(event) => setCategory(event.target.value)}
                className="mt-3 w-full rounded-2xl border border-pink-200 bg-white px-4 py-3 text-gray-900 outline-none focus:border-pink-500"
              >
                {categories.map((option) => (
                  <option key={option}>{option}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="font-bold text-gray-900">
                Open on a special date
              </label>

              <input
                type="date"
                value={openOn}
                min={getToday()}
                onChange={(event) => setOpenOn(event.target.value)}
                className="mt-3 w-full rounded-2xl border border-pink-200 px-4 py-3 text-gray-900 outline-none focus:border-pink-500"
              />

              <p className="mt-2 text-xs text-gray-500">
                Leave this blank to open it immediately.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={sendLoveNote}
            disabled={sending || !partnerId}
            className="mt-7 w-full rounded-full bg-pink-600 px-6 py-4 text-lg font-bold text-white shadow-md transition hover:bg-pink-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {sending ? "Sending..." : "Add to Kimberly’s Love Jar"}
          </button>

          {status && (
            <p className="mt-5 text-center text-sm font-semibold text-gray-700">
              {status}
            </p>
          )}
        </section>

        <section className="mb-6 rounded-[2rem] bg-white p-6 shadow-xl sm:p-8">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-sm font-bold uppercase tracking-widest text-pink-600">
                For You
              </p>

              <h2 className="mt-2 text-3xl font-bold text-gray-900">
                Notes Waiting for You
              </h2>
            </div>

            <div className="rounded-full bg-pink-100 px-4 py-2 font-bold text-pink-700">
              {
                receivedNotes.filter(
                  (note) => !note.opened_at && !noteIsLocked(note)
                ).length
              }{" "}
              new
            </div>
          </div>

          <div className="mt-6 space-y-4">
            {receivedNotes.length === 0 ? (
              <div className="rounded-2xl bg-pink-50 p-6 text-center">
                <div className="text-4xl">📭</div>

                <p className="mt-3 font-semibold text-gray-700">
                  No love notes are waiting yet.
                </p>
              </div>
            ) : (
              receivedNotes.map((note) => {
                const locked = noteIsLocked(note);
                const opened = Boolean(note.opened_at);

                return (
                  <article
                    key={note.id}
                    className="rounded-3xl border border-pink-100 bg-pink-50 p-6"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <p className="text-sm font-bold uppercase tracking-widest text-pink-600">
                          {note.category}
                        </p>

                        <h3 className="mt-2 text-2xl font-bold text-gray-900">
                          {locked
                            ? "A surprise is waiting 🔒"
                            : opened
                              ? "Opened Love Note 💌"
                              : "Kimberly left you something 💖"}
                        </h3>

                        <p className="mt-1 text-sm text-gray-500">
                          Added {formatCreatedAt(note.created_at)}
                        </p>
                      </div>

                      <span className="text-4xl">
                        {locked ? "🔒" : opened ? "💌" : "🎁"}
                      </span>
                    </div>

                    {locked ? (
                      <div className="mt-5 rounded-2xl bg-white p-5 text-center">
                        <p className="font-semibold text-gray-700">
                          Open on {formatDate(note.open_on!)}
                        </p>
                      </div>
                    ) : opened ? (
                      <div className="mt-5 rounded-2xl bg-white p-5">
                        <p className="whitespace-pre-wrap text-gray-800">
                          {note.message}
                        </p>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => openNote(note)}
                        className="mt-5 w-full rounded-full bg-pink-600 px-5 py-3 font-bold text-white shadow-md"
                      >
                        Open Love Note
                      </button>
                    )}
                  </article>
                );
              })
            )}
          </div>
        </section>

        <section className="rounded-[2rem] bg-white p-6 shadow-xl sm:p-8">
          <p className="text-sm font-bold uppercase tracking-widest text-pink-600">
            From You
          </p>

          <h2 className="mt-2 text-3xl font-bold text-gray-900">
            Notes You Sent
          </h2>

          <div className="mt-6 space-y-4">
            {sentNotes.length === 0 ? (
              <div className="rounded-2xl bg-pink-50 p-6 text-center">
                <p className="font-semibold text-gray-700">
                  You haven’t sent a love note yet.
                </p>
              </div>
            ) : (
              sentNotes.map((note) => (
                <article
                  key={note.id}
                  className="rounded-3xl border border-pink-100 p-5"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="text-sm font-bold text-pink-700">
                        {note.category}
                      </p>

                      <p className="mt-2 whitespace-pre-wrap text-gray-800">
                        {note.message}
                      </p>

                      <p className="mt-3 text-sm text-gray-500">
                        {note.open_on
                          ? `Open on ${formatDate(note.open_on)}`
                          : "Available immediately"}
                      </p>

                      <p className="mt-1 text-sm font-semibold text-gray-600">
                        {note.opened_at ? "Opened ❤️" : "Not opened yet"}
                      </p>
                    </div>

                    <button
                      type="button"
                      onClick={() => deleteSentNote(note.id)}
                      className="rounded-full border border-pink-200 px-3 py-2 text-sm font-semibold text-pink-700"
                    >
                      Delete
                    </button>
                  </div>
                </article>
              ))
            )}
          </div>
        </section>
      </div>
    </main>
  );
}