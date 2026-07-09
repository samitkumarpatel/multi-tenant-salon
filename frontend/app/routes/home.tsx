import { Link } from "react-router";

export default function Home() {
  return (
    <div className="min-h-[100dvh] bg-cream flex flex-col items-center justify-center px-5">
      <div className="w-full max-w-lg -mt-16">
        <div className="text-center mb-5">
          <h1 className="font-display italic text-3xl text-stone-900 tracking-tight">my-saloon</h1>
        </div>

        <div className="flex flex-col sm:flex-row gap-4">
          {/* Owner card */}
          <Link
            to="/new"
            className="flex flex-col flex-1 bg-white border border-stone-200 rounded-2xl px-8 py-10 no-underline transition-all duration-200 hover:border-matcha-400 hover:shadow-[0_0_0_4px_rgba(86,115,48,0.12)]"
          >
            <p className="text-sm font-bold text-stone-900 uppercase tracking-wide mb-3">Owner</p>
            <p className="text-stone-700 font-medium text-base leading-snug mb-2">
              Register a saloon and start business
            </p>
            <p className="text-stone-400 text-sm leading-relaxed">Get your saloon online in minutes.</p>
            <span className="mt-6 self-start text-sm font-medium text-matcha-600">Get started →</span>
          </Link>

          {/* Customer card */}
          <Link
            to="/customer"
            className="flex flex-col flex-1 bg-white border border-stone-200 rounded-2xl px-8 py-10 no-underline transition-all duration-200 hover:border-matcha-400 hover:shadow-[0_0_0_4px_rgba(86,115,48,0.12)]"
          >
            <p className="text-sm font-bold text-stone-900 uppercase tracking-wide mb-3">Customer</p>
            <p className="text-stone-700 font-medium text-base leading-snug mb-2">
              Explore all the saloons and their services
            </p>
            <p className="text-stone-400 text-sm leading-relaxed">Find a saloon and book your next appointment.</p>
            <span className="mt-6 self-start text-sm font-medium text-matcha-600">Browse →</span>
          </Link>
        </div>
      </div>
    </div>
  );
}
