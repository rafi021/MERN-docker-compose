import { NavLink } from "react-router-dom";

export default function Navbar() {
  return (
    <header className="rounded-3xl border border-white/10 bg-slate-900/70 px-5 py-4 shadow-2xl shadow-slate-950/30 backdrop-blur-xl sm:px-6">
      <nav className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <NavLink className="flex items-center gap-3" to="/">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-cyan-400 to-emerald-400 text-sm font-black text-slate-950 shadow-lg shadow-cyan-500/20">
            M
          </div>
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.3em] text-cyan-200/80">
              MERN Records
            </p>
            <p className="text-lg font-semibold text-slate-50">
              Modern user management
            </p>
          </div>
        </NavLink>

        <NavLink
          className="inline-flex items-center justify-center rounded-full border border-cyan-400/30 bg-cyan-400/10 px-4 py-2 text-sm font-semibold text-cyan-100 transition hover:border-cyan-300/50 hover:bg-cyan-400/20 hover:text-white"
          to="/create"
        >
          Create User
        </NavLink>
      </nav>
    </header>
  );
}
