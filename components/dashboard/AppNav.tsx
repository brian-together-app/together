"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

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
];

const hiddenRoutes = ["/", "/login", "/couple"];

export default function AppNav() {
  const pathname = usePathname();

  if (hiddenRoutes.includes(pathname)) {
    return null;
  }

  return (
    <>
      <div className="h-24 md:hidden" />

      <nav className="fixed inset-x-0 bottom-0 z-50 border-t border-pink-100 bg-white/95 px-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] pt-2 shadow-[0_-8px_30px_rgba(190,24,93,0.08)] backdrop-blur-xl md:hidden">
        <div className="mx-auto grid max-w-lg grid-cols-5">
          {navigation.map((item) => {
            const active = pathname === item.href;

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
                <span
                  className={`text-xl transition ${
                    active ? "scale-110" : ""
                  }`}
                >
                  {item.icon}
                </span>

                <span className="mt-1 text-[10px] font-bold">
                  {item.label}
                </span>
              </Link>
            );
          })}
        </div>
      </nav>

      <nav className="fixed inset-x-0 top-4 z-50 mx-auto hidden w-[calc(100%-2rem)] max-w-3xl rounded-full border border-pink-100 bg-white/90 p-2 shadow-lg backdrop-blur-xl md:block">
        <div className="grid grid-cols-5 gap-1">
          {navigation.map((item) => {
            const active = pathname === item.href;

            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center justify-center gap-2 rounded-full px-3 py-3 text-sm font-bold transition ${
                  active
                    ? "bg-pink-600 text-white shadow-md"
                    : "text-gray-600 hover:bg-pink-50 hover:text-pink-700"
                }`}
              >
                <span>{item.icon}</span>
                <span>{item.label}</span>
              </Link>
            );
          })}
        </div>
      </nav>
    </>
  );
}