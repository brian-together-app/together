import Link from "next/link";

type QuickActionsProps = {
  partnerName: string;
};

export default function QuickActions({
  partnerName,
}: QuickActionsProps) {
  return (
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

      <Link
        href="/calendar"
        className="rounded-3xl bg-white p-6 shadow-md transition hover:-translate-y-1 hover:shadow-xl"
      >
        <span className="text-4xl">📅</span>

        <h2 className="mt-4 text-xl font-bold text-gray-900">
          Mood Calendar
        </h2>

        <p className="mt-2 text-sm text-gray-600">
          Review your good, okay, and difficult days.
        </p>
      </Link>

      <Link
        href="/memories"
        className="rounded-3xl bg-white p-6 shadow-md transition hover:-translate-y-1 hover:shadow-xl"
      >
        <span className="text-4xl">📸</span>

        <h2 className="mt-4 text-xl font-bold text-gray-900">
          Memories
        </h2>

        <p className="mt-2 text-sm text-gray-600">
          Save your favorite moments together.
        </p>
      </Link>
    </section>
  );
}