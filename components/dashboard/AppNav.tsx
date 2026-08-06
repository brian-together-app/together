"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { supabase } from "@/app/lib/supabase";

const navigation = [
  {
    href: "/dashboard",
    label: "Home",
    icon: "❤️",
  },
  {
    href: "/checkin",
    label: "Check-In",
    icon: "😊",
  },
  {
    href: "/checkin-history",
    label: "History",
    icon: "🕒",
  },
  {
    href: "/love-jar",
    label: "Love Jar",
    icon: "💌",
  },
  {
    href: "/calendar",
    label: "Calendar",
    icon: "📅",
  },
  {
    href: "/memories",
    label: "Memories",
    icon: "📸",
  },
  {
    href: "/notifications",
    label: "Updates",
    icon: "🔔",
  },
];

const hiddenRoutes = ["/", "/login", "/couple"];

export default function AppNav() {
  const pathname = usePathname();
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    let channel: ReturnType<typeof supabase.channel> | null = null;
    let isMounted = true;

    async function startNotifications() {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        if (isMounted) {
          setUnreadCount(0);
        }

        return;
      }

      const currentUserId = user.id;

      async function refreshUnreadCount() {
        const { count, error } = await supabase
          .from("notifications")
          .select("id", {
            count: "exact",
            head: true,
          })
          .eq("recipient_id", currentUserId)
          .eq("is_read", false);

        if (!error && isMounted) {
          setUnreadCount(count || 0);
        }
      }

      await refreshUnreadCount();

      channel = supabase
        .channel(`notifications-nav-${currentUserId}`)
        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table: "notifications",
            filter: `recipient_id=eq.${currentUserId}`,
          },
          () => {
            refreshUnreadCount();
          }
        )
        .subscribe();
    }

    startNotifications();

    return () => {
      isMounted = false;

      if (channel) {
        supabase.removeChannel(channel);
      }
    };
  }, []);

  if (hiddenRoutes.includes(pathname)) {
    return null;
  }

  function isActive(href: string) {
    return pathname === href || pathname.startsWith(`${href}/`);
  }

  return (
    <>
      <div className="h-24 md:hidden" />

      <nav className="fixed inset-x-0 bottom-0 z-50 overflow-x-auto border-t border-pink-100 bg-white/95 px-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] pt-2 shadow-[0_-8px_30px_rgba(190,24,93,0.08)] backdrop-blur-xl md:hidden">
        <div className="mx-auto grid min-w-[560px] grid-cols-7">
          {navigation.map((item) => {
            const active = isActive(item.href);
            const isNotifications = item.href === "/notifications";

            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex min-h-14 flex-col items-center justify-center rounded-2xl px-1 text-center transition ${
                  active
                    ? "bg-pink-50 text-pink-700"
                    : "text-gray-500 active:bg-pink-50"
                }`}
              >
                <span className="relative">
                  <span
                    className={`block text-xl transition ${
                      active ? "scale-110" : ""
                    }`}
                  >
                    {item.icon}
                  </span>

                  {isNotifications && unreadCount > 0 && (
                    <span className="absolute -right-3 -top-2 flex h-5 min-w-5 items-center justify-center rounded-full bg-pink-600 px-1 text-[10px] font-black text-white shadow">
                      {unreadCount > 99 ? "99+" : unreadCount}
                    </span>
                  )}
                </span>

                <span className="mt-1 text-[9px] font-bold">
                  {item.label}
                </span>
              </Link>
            );
          })}
        </div>
      </nav>

      <nav className="fixed inset-x-0 top-4 z-50 mx-auto hidden w-[calc(100%-2rem)] max-w-5xl rounded-full border border-pink-100 bg-white/90 p-2 shadow-lg backdrop-blur-xl md:block">
        <div className="grid grid-cols-7 gap-1">
          {navigation.map((item) => {
            const active = isActive(item.href);
            const isNotifications = item.href === "/notifications";

            return (
              <Link
                key={item.href}
                href={item.href}
                className={`relative flex items-center justify-center gap-2 rounded-full px-3 py-3 text-sm font-bold transition ${
                  active
                    ? "bg-pink-600 text-white shadow-md"
                    : "text-gray-600 hover:bg-pink-50 hover:text-pink-700"
                }`}
              >
                <span>{item.icon}</span>
                <span>{item.label}</span>

                {isNotifications && unreadCount > 0 && (
                  <span
                    className={`flex h-5 min-w-5 items-center justify-center rounded-full px-1 text-[10px] font-black ${
                      active
                        ? "bg-white text-pink-700"
                        : "bg-pink-600 text-white"
                    }`}
                  >
                    {unreadCount > 99 ? "99+" : unreadCount}
                  </span>
                )}
              </Link>
            );
          })}
        </div>
      </nav>
    </>
  );
}