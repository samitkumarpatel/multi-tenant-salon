export default function OnboardingHome() {
  return (
    <main className="min-h-screen flex flex-col items-center justify-center gap-6 bg-slate-950 text-white p-8">
      <div className="text-center">
        <h1 className="text-4xl font-bold mb-2">my-saloon.online</h1>
        <p className="text-slate-400 text-lg">
          The all-in-one platform for saloon owners.
        </p>
      </div>
      <div className="flex gap-4 mt-4">
        <a
          href="/signup"
          className="px-6 py-3 bg-amber-500 hover:bg-amber-400 text-white font-semibold rounded-xl transition-colors"
        >
          Get started free
        </a>
        <a
          href="/explore"
          className="px-6 py-3 bg-white/10 hover:bg-white/20 text-white font-semibold rounded-xl transition-colors border border-white/20"
        >
          Explore saloons
        </a>
      </div>
      <p className="text-slate-600 text-sm mt-8">Onboarding flow coming soon.</p>
    </main>
  );
}
