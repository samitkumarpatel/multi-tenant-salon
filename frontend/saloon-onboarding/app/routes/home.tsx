import { Link } from "react-router";
import { Scissors, User, Store, ArrowRight, Sparkles } from "lucide-react";

export default function Home() {
  return (
    <div className="min-h-[100dvh] bg-gradient-to-b from-matcha-950 via-matcha-900 to-matcha-950 flex flex-col text-white overflow-hidden">
      {/* Top logo bar */}
      <header className="flex items-center gap-2.5 px-5 pt-6 pb-2">
        <div className="w-8 h-8 rounded-xl bg-white/10 backdrop-blur-md border border-white/20 flex items-center justify-center">
          <Scissors className="w-4 h-4 text-white" />
        </div>
        <span className="text-sm font-bold tracking-tight opacity-90">SaloonHub</span>
      </header>

      {/* Hero section */}
      <main className="flex-1 flex flex-col items-center justify-center px-5 py-10 text-center">
        {/* Badge */}
        <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/10 border border-white/20 text-xs font-semibold text-matcha-200 mb-6 backdrop-blur-sm">
          <Sparkles className="w-3 h-3" />
          Premium Salon Management Platform
        </div>

        {/* Heading */}
        <h1 className="text-4xl sm:text-5xl font-black tracking-tight leading-tight mb-4">
          Welcome to
          <span className="block text-transparent bg-clip-text bg-gradient-to-r from-matcha-200 to-matcha-400">
            SaloonHub
          </span>
        </h1>
        <p className="text-base sm:text-lg text-slate-400 max-w-sm mx-auto mb-12 leading-relaxed">
          Discover premium salons, book appointments, or launch your own salon management platform.
        </p>

        {/* Role question */}
        <p className="text-xs font-semibold uppercase tracking-widest text-slate-500 mb-4">
          Who are you?
        </p>

        {/* Choice cards — stacked on mobile, side-by-side on sm+ */}
        <div className="w-full max-w-sm sm:max-w-2xl flex flex-col sm:flex-row gap-4">
          {/* Customer card */}
          <Link
            to="/customer"
            className="group flex-1 flex flex-col items-start text-left p-6 sm:p-8 bg-white/5 hover:bg-white/10 backdrop-blur-md rounded-2xl border border-white/10 hover:border-white/20 transition-all duration-200 no-underline active:scale-[0.98]"
          >
            <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-xl bg-matcha-500/20 flex items-center justify-center mb-4 group-hover:bg-matcha-500/30 transition-colors">
              <User className="w-6 h-6 sm:w-7 sm:h-7 text-matcha-300" />
            </div>
            <h2 className="text-lg sm:text-xl font-bold text-white mb-2">I'm a Customer</h2>
            <p className="text-sm text-slate-400 leading-relaxed mb-5">
              Find nearby salons, explore services, and book your next appointment.
            </p>
            <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-matcha-300 group-hover:gap-3 transition-all">
              Browse Saloons <ArrowRight className="w-4 h-4" />
            </span>
          </Link>

          {/* Owner card — prominent */}
          <Link
            to="/new"
            className="group flex-1 flex flex-col items-start text-left p-6 sm:p-8 bg-matcha-600 hover:bg-matcha-500 rounded-2xl shadow-xl shadow-matcha-900/50 transition-all duration-200 no-underline active:scale-[0.98]"
          >
            <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-xl bg-white/20 flex items-center justify-center mb-4 group-hover:bg-white/30 transition-colors">
              <Store className="w-6 h-6 sm:w-7 sm:h-7 text-white" />
            </div>
            <h2 className="text-lg sm:text-xl font-bold text-white mb-2">I'm a Saloon Owner</h2>
            <p className="text-sm text-matcha-100 leading-relaxed mb-5">
              Register your saloon, set up services and staff, and go live in minutes.
            </p>
            <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-white group-hover:gap-3 transition-all">
              Create My Saloon <ArrowRight className="w-4 h-4" />
            </span>
          </Link>
        </div>
      </main>

      <footer className="text-center pb-6 text-xs text-slate-600">
        © {new Date().getFullYear()} SaloonHub — All rights reserved
      </footer>
    </div>
  );
}
