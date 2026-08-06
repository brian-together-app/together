import Link from "next/link";

export default function Home() {
  return (
    <main className="min-h-screen bg-gradient-to-br from-pink-200 via-rose-100 to-pink-300 flex items-center justify-center">
      <div className="text-center">
        <div className="text-7xl mb-6 animate-bounce">❤️</div>

        <h1 className="text-6xl font-bold text-pink-700">
          Together
        </h1>

        <p className="mt-4 text-2xl text-gray-700">
          Brian & Kimberly
        </p>

        <Link
          href="/login"
          className="inline-block mt-10 rounded-full bg-pink-600 px-8 py-4 text-white text-xl font-semibold shadow-lg transition hover:scale-105 hover:bg-pink-700"
        >
          Begin
        </Link>
      </div>
    </main>
  );
}