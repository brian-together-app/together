"use client";

import Link from "next/link";
import { ChangeEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/app/lib/supabase";

type MemoryRow = {
  id: string;
  couple_id: string;
  user_id: string;
  image_path: string;
  caption: string | null;
  title: string | null;
  story: string | null;
  location: string | null;
  mood: string | null;
  is_favorite: boolean;
  memory_date: string;
  created_at: string;
};

type Memory = MemoryRow & {
  imageUrl: string;
  uploaderName: string;
};

type MemoryCommentRow = {
  id: string;
  memory_id: string;
  couple_id: string;
  user_id: string;
  message: string;
  created_at: string;
  updated_at: string;
};

type MemoryComment = MemoryCommentRow & {
  authorName: string;
};

const moodOptions = [
  { label: "Loved", emoji: "🥰" },
  { label: "Happy", emoji: "😊" },
  { label: "Fun", emoji: "😂" },
  { label: "Romantic", emoji: "💕" },
  { label: "Adventure", emoji: "🌴" },
  { label: "Peaceful", emoji: "😌" },
];

function getToday() {
  const now = new Date();
  const localDate = new Date(
    now.getTime() - now.getTimezoneOffset() * 60000
  );

  return localDate.toISOString().slice(0, 10);
}

function formatMemoryDate(date: string) {
  return new Date(`${date}T12:00:00`).toLocaleDateString(undefined, {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

function formatCreatedAt(date: string) {
  return new Date(date).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function formatCommentTime(date: string) {
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

function safeFileExtension(file: File) {
  const originalExtension = file.name.split(".").pop()?.toLowerCase();

  if (
    originalExtension &&
    /^[a-z0-9]+$/.test(originalExtension) &&
    originalExtension.length <= 5
  ) {
    return originalExtension;
  }

  if (file.type === "image/png") return "png";
  if (file.type === "image/webp") return "webp";

  return "jpg";
}

function moodEmoji(mood: string | null) {
  return moodOptions.find((option) => option.label === mood)?.emoji || "❤️";
}

export default function MemoriesPage() {
  const router = useRouter();

  const [userId, setUserId] = useState("");
  const [coupleId, setCoupleId] = useState("");
  const [partnerId, setPartnerId] = useState("");

  const [memories, setMemories] = useState<Memory[]>([]);
  const [commentsByMemory, setCommentsByMemory] = useState<
    Record<string, MemoryComment[]>
  >({});
  const [commentDrafts, setCommentDrafts] = useState<Record<string, string>>({});
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState("");

  const [title, setTitle] = useState("");
  const [story, setStory] = useState("");
  const [location, setLocation] = useState("");
  const [mood, setMood] = useState("Loved");
  const [caption, setCaption] = useState("");
  const [memoryDate, setMemoryDate] = useState(getToday());

  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [deletingId, setDeletingId] = useState("");
  const [favoriteId, setFavoriteId] = useState("");
  const [sendingCommentId, setSendingCommentId] = useState("");
  const [deletingCommentId, setDeletingCommentId] = useState("");
  const [message, setMessage] = useState("");

  useEffect(() => {
    loadPage();
  }, []);

  useEffect(() => {
    return () => {
      if (previewUrl) {
        URL.revokeObjectURL(previewUrl);
      }
    };
  }, [previewUrl]);

  async function loadPage() {
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

    if (membershipError) {
      setMessage(membershipError.message);
      setLoading(false);
      return;
    }

    if (!membership) {
      setMessage(
        "Connect with your partner before adding shared memories."
      );
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

    await loadMemories(membership.couple_id, user.id);
    setLoading(false);
  }

  async function loadMemories(
    currentCoupleId: string,
    currentUserId: string
  ) {
    const { data: rows, error } = await supabase
      .from("memories")
      .select(
        "id, couple_id, user_id, image_path, caption, title, story, location, mood, is_favorite, memory_date, created_at"
      )
      .eq("couple_id", currentCoupleId)
      .order("is_favorite", { ascending: false })
      .order("memory_date", { ascending: false })
      .order("created_at", { ascending: false });

    if (error) {
      setMessage(error.message);
      return;
    }

    const memoryRows = (rows || []) as MemoryRow[];

    if (memoryRows.length === 0) {
      setMemories([]);
      return;
    }

    const uniqueUserIds = [
      ...new Set(memoryRows.map((memory) => memory.user_id)),
    ];

    const { data: profiles } = await supabase
      .from("profiles")
      .select("id, display_name")
      .in("id", uniqueUserIds);

    const profileNames = new Map<string, string>();

    for (const profile of profiles || []) {
      profileNames.set(
        profile.id,
        profile.display_name?.trim() || "Partner"
      );
    }

    const paths = memoryRows.map((memory) => memory.image_path);

    const { data: signedFiles, error: signedUrlError } =
      await supabase.storage
        .from("memories")
        .createSignedUrls(paths, 60 * 60);

    if (signedUrlError) {
      setMessage(signedUrlError.message);
      return;
    }

    const signedUrlByPath = new Map<string, string>();

    for (const signedFile of signedFiles || []) {
      if (signedFile.path && signedFile.signedUrl) {
        signedUrlByPath.set(signedFile.path, signedFile.signedUrl);
      }
    }

    const completedMemories: Memory[] = memoryRows.map((memory) => ({
      ...memory,
      imageUrl: signedUrlByPath.get(memory.image_path) || "",
      uploaderName:
        memory.user_id === currentUserId
          ? "You"
          : profileNames.get(memory.user_id) || "Your Partner",
    }));

    setMemories(completedMemories);
    await loadComments(
      completedMemories.map((memory) => memory.id),
      currentUserId
    );
  }

  async function loadComments(
    memoryIds: string[],
    currentUserId: string
  ) {
    if (memoryIds.length === 0) {
      setCommentsByMemory({});
      return;
    }

    const { data: rows, error } = await supabase
      .from("memory_comments")
      .select(
        "id, memory_id, couple_id, user_id, message, created_at, updated_at"
      )
      .in("memory_id", memoryIds)
      .order("created_at", { ascending: true });

    if (error) {
      setMessage(error.message);
      return;
    }

    const commentRows = (rows || []) as MemoryCommentRow[];
    const userIds = [...new Set(commentRows.map((comment) => comment.user_id))];

    const { data: profiles } =
      userIds.length > 0
        ? await supabase
            .from("profiles")
            .select("id, display_name")
            .in("id", userIds)
        : { data: [] as { id: string; display_name: string | null }[] };

    const names = new Map<string, string>();

    for (const profile of profiles || []) {
      names.set(
        profile.id,
        profile.display_name?.trim() || "Your Partner"
      );
    }

    const grouped: Record<string, MemoryComment[]> = {};

    for (const comment of commentRows) {
      if (!grouped[comment.memory_id]) {
        grouped[comment.memory_id] = [];
      }

      grouped[comment.memory_id].push({
        ...comment,
        authorName:
          comment.user_id === currentUserId
            ? "You"
            : names.get(comment.user_id) || "Your Partner",
      });
    }

    setCommentsByMemory(grouped);
  }

  function choosePhoto(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];

    if (!file) return;

    setMessage("");

    if (!file.type.startsWith("image/")) {
      setMessage("Please choose an image file.");
      event.target.value = "";
      return;
    }

    const maximumSize = 10 * 1024 * 1024;

    if (file.size > maximumSize) {
      setMessage("Please choose a photo smaller than 10 MB.");
      event.target.value = "";
      return;
    }

    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
    }

    setSelectedFile(file);
    setPreviewUrl(URL.createObjectURL(file));
  }

  function clearForm() {
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
    }

    setSelectedFile(null);
    setPreviewUrl("");
    setTitle("");
    setStory("");
    setLocation("");
    setMood("Loved");
    setCaption("");
    setMemoryDate(getToday());

    const fileInput = document.getElementById(
      "memory-photo"
    ) as HTMLInputElement | null;

    if (fileInput) {
      fileInput.value = "";
    }
  }

  async function uploadMemory() {
    setMessage("");

    if (!selectedFile) {
      setMessage("Choose a photo first.");
      return;
    }

    if (!title.trim()) {
      setMessage("Give this memory a title.");
      return;
    }

    if (!userId || !coupleId) {
      setMessage("Your relationship space could not be found.");
      return;
    }

    if (!memoryDate) {
      setMessage("Choose the date of this memory.");
      return;
    }

    setUploading(true);

    const extension = safeFileExtension(selectedFile);
    const fileName = `${crypto.randomUUID()}.${extension}`;
    const imagePath = `${coupleId}/${userId}/${fileName}`;

    const { error: uploadError } = await supabase.storage
      .from("memories")
      .upload(imagePath, selectedFile, {
        cacheControl: "3600",
        contentType: selectedFile.type || "image/jpeg",
        upsert: false,
      });

    if (uploadError) {
      setMessage(uploadError.message);
      setUploading(false);
      return;
    }

    const { error: databaseError } = await supabase
      .from("memories")
      .insert({
        couple_id: coupleId,
        user_id: userId,
        image_path: imagePath,
        title: title.trim(),
        story: story.trim() || null,
        location: location.trim() || null,
        mood,
        caption: caption.trim() || null,
        memory_date: memoryDate,
        is_favorite: false,
      });

    if (databaseError) {
      await supabase.storage.from("memories").remove([imagePath]);

      setMessage(databaseError.message);
      setUploading(false);
      return;
    }

    clearForm();
    setMessage("Memory added to your story ❤️");

    await loadMemories(coupleId, userId);
    setUploading(false);
  }

  async function toggleFavorite(memory: Memory) {
    setFavoriteId(memory.id);
    setMessage("");

    const { error } = await supabase
      .from("memories")
      .update({ is_favorite: !memory.is_favorite })
      .eq("id", memory.id);

    if (error) {
      setMessage(error.message);
    } else {
      await loadMemories(coupleId, userId);
    }

    setFavoriteId("");
  }

  async function deleteMemory(memory: Memory) {
    const confirmed = window.confirm(
      "Delete this memory and its photo?"
    );

    if (!confirmed) return;

    setDeletingId(memory.id);
    setMessage("");

    const { error: databaseError } = await supabase
      .from("memories")
      .delete()
      .eq("id", memory.id)
      .eq("user_id", userId);

    if (databaseError) {
      setMessage(databaseError.message);
      setDeletingId("");
      return;
    }

    const { error: storageError } = await supabase.storage
      .from("memories")
      .remove([memory.image_path]);

    if (storageError) {
      setMessage(
        "The memory was removed, but its photo could not be cleaned up."
      );
    } else {
      setMessage("Memory deleted.");
    }

    await loadMemories(coupleId, userId);
    setDeletingId("");
  }

  async function addComment(memory: Memory) {
    const commentMessage = (commentDrafts[memory.id] || "").trim();

    if (!commentMessage) {
      setMessage("Write a comment first.");
      return;
    }

    if (!userId || !coupleId) {
      setMessage("Your relationship space could not be found.");
      return;
    }

    setSendingCommentId(memory.id);
    setMessage("");

    const { data: newComment, error } = await supabase
      .from("memory_comments")
      .insert({
        memory_id: memory.id,
        couple_id: coupleId,
        user_id: userId,
        message: commentMessage,
      })
      .select(
        "id, memory_id, couple_id, user_id, message, created_at, updated_at"
      )
      .single();

    if (error) {
      setMessage(error.message);
      setSendingCommentId("");
      return;
    }

    const comment: MemoryComment = {
      ...(newComment as MemoryCommentRow),
      authorName: "You",
    };

    setCommentsByMemory((current) => ({
      ...current,
      [memory.id]: [...(current[memory.id] || []), comment],
    }));

    setCommentDrafts((current) => ({
      ...current,
      [memory.id]: "",
    }));

    if (partnerId) {
      const memoryTitle =
        memory.title || memory.caption || "a shared memory";

      const { error: notificationError } = await supabase
        .from("notifications")
        .insert({
          couple_id: coupleId,
          recipient_id: partnerId,
          actor_id: userId,
          notification_type: "memory_comment",
          title: "Your partner commented on a memory",
          message: `${memoryTitle}: “${commentMessage.slice(0, 120)}”`,
          link: "/memories",
        });

      if (notificationError) {
        console.error(
          "Comment saved, but notification could not be created:",
          notificationError.message
        );
      }
    }

    setSendingCommentId("");
  }

  async function deleteComment(comment: MemoryComment) {
    const confirmed = window.confirm("Delete this comment?");

    if (!confirmed) return;

    setDeletingCommentId(comment.id);
    setMessage("");

    const { error } = await supabase
      .from("memory_comments")
      .delete()
      .eq("id", comment.id)
      .eq("user_id", userId);

    if (error) {
      setMessage(error.message);
      setDeletingCommentId("");
      return;
    }

    setCommentsByMemory((current) => ({
      ...current,
      [comment.memory_id]: (current[comment.memory_id] || []).filter(
        (item) => item.id !== comment.id
      ),
    }));

    setDeletingCommentId("");
  }

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-gradient-to-br from-pink-100 via-rose-50 to-pink-200">
        <div className="text-center">
          <div className="animate-pulse text-6xl">📸</div>

          <p className="mt-4 font-semibold text-pink-700">
            Opening your memories...
          </p>
        </div>
      </main>
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
              Memories
            </h1>

            <p className="mt-2 text-gray-600">
              Build your private scrapbook, one favorite moment at a time.
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
          <div className="text-center">
            <div className="animate-soft-float text-6xl">📷</div>

            <h2 className="mt-4 text-3xl font-black text-gray-900">
              Add a Memory
            </h2>

            <p className="mt-2 text-gray-600">
              Add a title, story, mood, location, and photo.
            </p>
          </div>

          <div className="mt-7">
            <label
              htmlFor="memory-photo"
              className="block font-bold text-gray-900"
            >
              Photo
            </label>

            <label
              htmlFor="memory-photo"
              className="mt-3 flex min-h-52 cursor-pointer items-center justify-center overflow-hidden rounded-3xl border-2 border-dashed border-pink-300 bg-pink-50 text-center transition hover:bg-pink-100"
            >
              {previewUrl ? (
                <img
                  src={previewUrl}
                  alt="Selected memory preview"
                  className="max-h-[520px] w-full object-contain"
                />
              ) : (
                <div className="p-8">
                  <div className="text-5xl">🖼️</div>
                  <p className="mt-3 font-bold text-pink-700">
                    Tap to choose a photo
                  </p>
                  <p className="mt-1 text-sm text-gray-500">
                    JPG, PNG, or WebP · Maximum 10 MB
                  </p>
                </div>
              )}
            </label>

            <input
              id="memory-photo"
              type="file"
              accept="image/*"
              onChange={choosePhoto}
              className="hidden"
            />
          </div>

          <div className="mt-6 grid gap-5 sm:grid-cols-2">
            <div>
              <label htmlFor="memory-title" className="font-bold text-gray-900">
                Title
              </label>
              <input
                id="memory-title"
                type="text"
                value={title}
                maxLength={100}
                onChange={(event) => setTitle(event.target.value)}
                placeholder="Kimberly's Palm Springs Birthday"
                className="mt-3 w-full rounded-2xl border border-pink-200 bg-white px-4 py-3 text-gray-900 outline-none"
              />
            </div>

            <div>
              <label htmlFor="memory-date" className="font-bold text-gray-900">
                Date
              </label>
              <input
                id="memory-date"
                type="date"
                value={memoryDate}
                max={getToday()}
                onChange={(event) => setMemoryDate(event.target.value)}
                className="mt-3 w-full rounded-2xl border border-pink-200 bg-white px-4 py-3 text-gray-900 outline-none"
              />
            </div>

            <div>
              <label htmlFor="memory-location" className="font-bold text-gray-900">
                Location
              </label>
              <input
                id="memory-location"
                type="text"
                value={location}
                maxLength={150}
                onChange={(event) => setLocation(event.target.value)}
                placeholder="Palm Springs, California"
                className="mt-3 w-full rounded-2xl border border-pink-200 bg-white px-4 py-3 text-gray-900 outline-none"
              />
            </div>

            <div>
              <label htmlFor="memory-mood" className="font-bold text-gray-900">
                Mood
              </label>
              <select
                id="memory-mood"
                value={mood}
                onChange={(event) => setMood(event.target.value)}
                className="mt-3 w-full rounded-2xl border border-pink-200 bg-white px-4 py-3 text-gray-900 outline-none"
              >
                {moodOptions.map((option) => (
                  <option key={option.label} value={option.label}>
                    {option.emoji} {option.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="mt-5">
            <label htmlFor="memory-caption" className="font-bold text-gray-900">
              Short caption
            </label>
            <input
              id="memory-caption"
              type="text"
              value={caption}
              maxLength={300}
              onChange={(event) => setCaption(event.target.value)}
              placeholder="The best birthday weekend ❤️"
              className="mt-3 w-full rounded-2xl border border-pink-200 bg-white px-4 py-3 text-gray-900 outline-none"
            />
          </div>

          <div className="mt-5">
            <label htmlFor="memory-story" className="font-bold text-gray-900">
              Tell the story
            </label>
            <textarea
              id="memory-story"
              value={story}
              maxLength={2000}
              rows={5}
              onChange={(event) => setStory(event.target.value)}
              placeholder="What made this day special?"
              className="mt-3 w-full resize-none rounded-2xl border border-pink-200 bg-white px-4 py-3 text-gray-900 outline-none"
            />
            <p className="mt-1 text-right text-xs text-gray-500">
              {story.length}/2000
            </p>
          </div>

          <button
            type="button"
            onClick={uploadMemory}
            disabled={uploading || !selectedFile || !coupleId}
            className="mt-7 w-full rounded-full bg-pink-600 px-6 py-4 text-lg font-bold text-white shadow-md transition hover:bg-pink-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {uploading ? "Saving Memory..." : "Add to Our Story"}
          </button>

          {selectedFile && (
            <button
              type="button"
              onClick={clearForm}
              disabled={uploading}
              className="mt-3 w-full rounded-full border border-pink-200 bg-white px-6 py-3 font-semibold text-pink-700 disabled:opacity-50"
            >
              Clear Form
            </button>
          )}

          {message && (
            <p className="mt-5 text-center text-sm font-semibold text-gray-700">
              {message}
            </p>
          )}
        </section>

        <section className="glass-card rounded-[2rem] p-6 sm:p-8">
          <div className="flex items-end justify-between gap-4">
            <div>
              <p className="text-sm font-bold uppercase tracking-widest text-pink-600">
                Your Story
              </p>
              <h2 className="mt-2 text-3xl font-black text-gray-900">
                Shared Timeline
              </h2>
            </div>

            <span className="rounded-full bg-pink-100 px-4 py-2 text-sm font-bold text-pink-700">
              {memories.length} {memories.length === 1 ? "memory" : "memories"}
            </span>
          </div>

          {memories.length === 0 ? (
            <div className="py-14 text-center">
              <div className="text-6xl">💕</div>
              <h3 className="mt-4 text-2xl font-bold text-gray-900">
                Your timeline is ready
              </h3>
              <p className="mx-auto mt-2 max-w-md text-gray-600">
                Add your first photo and story to begin.
              </p>
            </div>
          ) : (
            <div className="mt-8 space-y-8">
              {memories.map((memory, index) => (
                <article
                  key={memory.id}
                  className="relative border-l-4 border-pink-200 pl-5 sm:pl-8"
                >
                  <span className="absolute -left-[11px] top-0 h-[18px] w-[18px] rounded-full border-4 border-white bg-pink-600 shadow" />

                  <div className="app-card overflow-hidden rounded-3xl">
                    {memory.imageUrl ? (
                      <img
                        src={memory.imageUrl}
                        alt={memory.title || memory.caption || "Shared memory"}
                        loading={index < 2 ? "eager" : "lazy"}
                        className="max-h-[700px] w-full bg-black/5 object-contain"
                      />
                    ) : (
                      <div className="flex h-64 items-center justify-center bg-pink-100 text-5xl">
                        🖼️
                      </div>
                    )}

                    <div className="p-5 sm:p-7">
                      <div className="flex items-start justify-between gap-4">
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="rounded-full bg-pink-100 px-3 py-1 text-sm font-bold text-pink-700">
                              {moodEmoji(memory.mood)} {memory.mood || "Memory"}
                            </span>

                            {memory.is_favorite && (
                              <span className="rounded-full bg-amber-100 px-3 py-1 text-sm font-bold text-amber-800">
                                ⭐ Favorite
                              </span>
                            )}
                          </div>

                          <p className="mt-4 text-sm font-bold uppercase tracking-widest text-pink-600">
                            {formatMemoryDate(memory.memory_date)}
                          </p>

                          <h3 className="mt-2 text-3xl font-black text-gray-900">
                            {memory.title || memory.caption || "A Special Memory"}
                          </h3>

                          {memory.location && (
                            <p className="mt-2 font-semibold text-gray-600">
                              📍 {memory.location}
                            </p>
                          )}

                          {memory.caption && memory.title && (
                            <p className="mt-4 text-lg font-semibold text-gray-700">
                              {memory.caption}
                            </p>
                          )}

                          {memory.story && (
                            <div className="mt-5 rounded-2xl bg-pink-50 p-5">
                              <p className="whitespace-pre-wrap leading-relaxed text-gray-800">
                                {memory.story}
                              </p>
                            </div>
                          )}

                          <p className="mt-4 text-sm text-gray-500">
                            Added by {memory.uploaderName} ·{" "}
                            {formatCreatedAt(memory.created_at)}
                          </p>
                        </div>

                        <div className="flex shrink-0 flex-col gap-2">
                          <button
                            type="button"
                            onClick={() => toggleFavorite(memory)}
                            disabled={favoriteId === memory.id}
                            className="rounded-full border border-amber-200 bg-white px-3 py-2 text-sm font-semibold text-amber-700 disabled:opacity-50"
                          >
                            {favoriteId === memory.id
                              ? "Saving..."
                              : memory.is_favorite
                                ? "Unfavorite"
                                : "Favorite"}
                          </button>

                          {memory.user_id === userId && (
                            <button
                              type="button"
                              onClick={() => deleteMemory(memory)}
                              disabled={deletingId === memory.id}
                              className="rounded-full border border-pink-200 bg-white px-3 py-2 text-sm font-semibold text-pink-700 disabled:opacity-50"
                            >
                              {deletingId === memory.id
                                ? "Deleting..."
                                : "Delete"}
                            </button>
                          )}
                        </div>
                      </div>

                      <div className="mt-7 border-t border-pink-100 pt-6">
                        <div className="flex items-center justify-between gap-3">
                          <div>
                            <p className="text-sm font-bold uppercase tracking-widest text-pink-600">
                              Comments
                            </p>
                            <h4 className="mt-1 text-xl font-black text-gray-900">
                              {(commentsByMemory[memory.id] || []).length}{" "}
                              {(commentsByMemory[memory.id] || []).length === 1
                                ? "comment"
                                : "comments"}
                            </h4>
                          </div>

                          <span className="text-3xl">💬</span>
                        </div>

                        <div className="mt-4 space-y-3">
                          {(commentsByMemory[memory.id] || []).length === 0 ? (
                            <div className="rounded-2xl bg-pink-50 p-4 text-center text-sm font-semibold text-gray-600">
                              Start the conversation about this memory.
                            </div>
                          ) : (
                            (commentsByMemory[memory.id] || []).map(
                              (comment) => (
                                <div
                                  key={comment.id}
                                  className="rounded-2xl bg-pink-50 p-4"
                                >
                                  <div className="flex items-start justify-between gap-3">
                                    <div className="min-w-0">
                                      <p className="font-black text-gray-900">
                                        {comment.authorName}
                                      </p>
                                      <p className="mt-1 whitespace-pre-wrap text-gray-800">
                                        {comment.message}
                                      </p>
                                      <p className="mt-2 text-xs font-semibold text-gray-500">
                                        {formatCommentTime(comment.created_at)}
                                      </p>
                                    </div>

                                    {comment.user_id === userId && (
                                      <button
                                        type="button"
                                        onClick={() => deleteComment(comment)}
                                        disabled={
                                          deletingCommentId === comment.id
                                        }
                                        className="shrink-0 rounded-full border border-pink-200 bg-white px-3 py-2 text-xs font-bold text-pink-700 disabled:opacity-50"
                                      >
                                        {deletingCommentId === comment.id
                                          ? "Deleting..."
                                          : "Delete"}
                                      </button>
                                    )}
                                  </div>
                                </div>
                              )
                            )
                          )}
                        </div>

                        <div className="mt-4 flex flex-col gap-3 sm:flex-row">
                          <input
                            type="text"
                            value={commentDrafts[memory.id] || ""}
                            maxLength={1000}
                            onChange={(event) =>
                              setCommentDrafts((current) => ({
                                ...current,
                                [memory.id]: event.target.value,
                              }))
                            }
                            onKeyDown={(event) => {
                              if (event.key === "Enter") {
                                event.preventDefault();
                                addComment(memory);
                              }
                            }}
                            placeholder="Write a comment..."
                            className="min-w-0 flex-1 rounded-2xl border border-pink-200 bg-white px-4 py-3 text-gray-900 outline-none"
                          />

                          <button
                            type="button"
                            onClick={() => addComment(memory)}
                            disabled={
                              sendingCommentId === memory.id ||
                              !(commentDrafts[memory.id] || "").trim()
                            }
                            className="rounded-full bg-pink-600 px-5 py-3 font-bold text-white shadow-md disabled:cursor-not-allowed disabled:opacity-50"
                          >
                            {sendingCommentId === memory.id
                              ? "Posting..."
                              : "Comment"}
                          </button>
                        </div>
                      </div>
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