"use client";

import { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import type { AdminUser } from "@/lib/admin-api";
import { clearClinicOverride, getClinicOverride } from "@/lib/admin-api";
import { DisplayCurrencyProvider } from "@/contexts/DisplayCurrencyContext";

const NAV_ITEMS = [
  { label: "Dashboard", href: "/admin", icon: "grid" },
  { label: "Clinic Profile", href: "/admin/clinic", icon: "building" },
  { label: "Images", href: "/admin/clinic/images", icon: "image" },
  { label: "Retreats", href: "/admin/retreats", icon: "heart" },
  { label: "Experiences", href: "/admin/experiences", icon: "star" },
  { label: "Team", href: "/admin/team", icon: "users" },
  { label: "Bookings", href: "/admin/bookings", icon: "clipboard" },
  { label: "Users", href: "/admin/users", icon: "userCog" },
];

const ICONS: Record<string, JSX.Element> = {
  grid: (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zm10 0a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zm10 0a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
    </svg>
  ),
  building: (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
    </svg>
  ),
  image: (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
    </svg>
  ),
  users: (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
    </svg>
  ),
  heart: (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
    </svg>
  ),
  calendar: (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
    </svg>
  ),
  clipboard: (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
    </svg>
  ),
  userCog: (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
    </svg>
  ),
  platform: (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  ),
  tag: (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A2 2 0 013 12V7a4 4 0 014-4z" />
    </svg>
  ),
  star: (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
    </svg>
  ),
  map: (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
    </svg>
  ),
};

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [user, setUser] = useState<AdminUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [clinicOverride, setClinicOverrideState] = useState<{ id: string; name: string } | null>(null);

  useEffect(() => {
    const token = localStorage.getItem("admin_token");
    const stored = localStorage.getItem("admin_user");

    if (!token || !stored) {
      if (pathname !== "/admin/login") {
        router.replace("/admin/login");
      }
      setLoading(false);
      return;
    }

    try {
      setUser(JSON.parse(stored));
    } catch {
      localStorage.removeItem("admin_token");
      localStorage.removeItem("admin_user");
      router.replace("/admin/login");
    }
    setClinicOverrideState(getClinicOverride());
    setLoading(false);
  }, [pathname, router]);

  // Login page renders without sidebar
  if (pathname === "/admin/login") {
    return <>{children}</>;
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-cream">
        <div className="animate-spin rounded-full h-8 w-8 border-2 border-forest border-t-transparent" />
      </div>
    );
  }

  if (!user) return null;

  const isSuperAdmin = user.role === "platform_admin";

  const navItems = isSuperAdmin
    ? [
        { label: "Dashboard",    href: "/admin/platform",                  icon: "platform" },
        { label: "All Clinics",  href: "/admin/platform",                  icon: "building" },
        { label: "Tags",         href: "/admin/platform/tags",             icon: "tag" },
        { label: "Experiences",  href: "/admin/platform/experiences",      icon: "map" },
        { label: "Users",        href: "/admin/users",                     icon: "userCog" },
      ]
    : NAV_ITEMS;

  // Clinic admin: forest green sidebar  |  Super admin: deep indigo sidebar
  const sidebarBg    = isSuperAdmin ? "#1e1b4b" : undefined;
  const accentColor  = isSuperAdmin ? "#a5b4fc" : undefined; // indigo-300
  const activeBg     = isSuperAdmin ? "rgba(165,180,252,0.15)" : undefined;
  const hoverBg      = isSuperAdmin ? "rgba(255,255,255,0.07)" : undefined;

  const handleLogout = () => {
    localStorage.removeItem("admin_token");
    localStorage.removeItem("admin_user");
    router.replace("/admin/login");
  };

  return (
    <DisplayCurrencyProvider initialCurrency="INR" locale="en" forceInr>
    <div className={`flex min-h-screen ${isSuperAdmin ? "" : "bg-cream"}`}
      style={isSuperAdmin ? { background: "#f5f4ff" } : undefined}>
      {/* Mobile overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/40 z-30 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`fixed lg:static inset-y-0 left-0 z-40 w-64 text-white flex flex-col transform transition-transform duration-200 ${
          sidebarOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
        } ${isSuperAdmin ? "" : "bg-forest"}`}
        style={sidebarBg ? { background: sidebarBg } : undefined}
      >
        {/* Logo */}
        <div className="px-6 py-5 border-b border-white/10">
          <div className="flex items-baseline gap-2">
            <span className="font-serif text-2xl" style={accentColor ? { color: accentColor } : undefined}>
              {isSuperAdmin ? "Vaidya" : "AyuRetreats"}
            </span>
            <span
              className="text-xs font-sans uppercase tracking-widest"
              style={{ color: isSuperAdmin ? "rgba(165,180,252,0.7)" : "rgba(255,255,255,0.6)" }}
            >
              {isSuperAdmin ? "Super Admin" : "Admin"}
            </span>
          </div>
          {isSuperAdmin && (
            <div className="mt-2 inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-sans font-medium"
              style={{ background: "rgba(165,180,252,0.2)", color: "#a5b4fc" }}>
              <span className="w-1.5 h-1.5 rounded-full bg-indigo-300 animate-pulse inline-block" />
              Platform Admin
            </div>
          )}
        </div>

        {/* Navigation */}
        <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
          {navItems.map((item) => {
            const isActive =
              item.href === "/admin"
                ? pathname === "/admin"
                : pathname.startsWith(item.href);

            return (
              <a
                key={item.href + item.label}
                href={item.href}
                onClick={(e) => {
                  e.preventDefault();
                  router.push(item.href);
                  setSidebarOpen(false);
                }}
                className="flex items-center gap-3 px-3 py-2.5 rounded-md text-sm font-sans transition-colors"
                style={isActive
                  ? { background: activeBg ?? "rgba(255,255,255,0.15)", color: accentColor ?? "#B8862C" }
                  : { color: "rgba(255,255,255,0.7)" }
                }
                onMouseEnter={e => {
                  if (!isActive) (e.currentTarget as HTMLElement).style.background = hoverBg ?? "rgba(255,255,255,0.1)";
                }}
                onMouseLeave={e => {
                  if (!isActive) (e.currentTarget as HTMLElement).style.background = "transparent";
                }}
              >
                {ICONS[item.icon]}
                {item.label}
              </a>
            );
          })}
        </nav>

        {/* User / Logout */}
        <div className="px-4 py-4 border-t border-white/10">
          <div className="text-xs font-sans font-medium uppercase tracking-wide mb-1"
            style={{ color: isSuperAdmin ? "rgba(165,180,252,0.6)" : "rgba(255,255,255,0.4)" }}>
            {isSuperAdmin ? "Super Admin" : "Clinic Admin"}
          </div>
          <div className="text-sm text-white/60 font-sans truncate mb-2">
            {user.name || user.email}
          </div>
          <button
            onClick={handleLogout}
            className="flex items-center gap-2 text-sm text-white/50 hover:text-white transition-colors font-sans"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"
              />
            </svg>
            Sign out
          </button>
        </div>
      </aside>

      {/* Main content */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top bar (mobile) */}
        <header className={`lg:hidden flex items-center justify-between px-4 py-3 border-b ${isSuperAdmin ? "border-indigo-200" : "border-cream2 bg-white"}`}
          style={isSuperAdmin ? { background: "#f0f0ff" } : undefined}>
          <button
            onClick={() => setSidebarOpen(true)}
            className="p-2 text-forest hover:bg-forest-lt rounded-md"
          >
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>
          <span className="font-serif text-lg text-forest">AyuRetreats</span>
          <div className="w-10" />
        </header>

        {/* Platform-admin acting on behalf of clinic — banner */}
        {clinicOverride && (
          <div className="flex items-center justify-between px-4 py-2.5 text-sm font-sans"
            style={{ background: "#1e1b4b", color: "#c7d2fe" }}>
            <div className="flex items-center gap-2">
              <svg className="w-4 h-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
              </svg>
              <span>Managing as platform admin: <strong className="text-white">{clinicOverride.name}</strong></span>
            </div>
            <button
              onClick={() => {
                clearClinicOverride();
                setClinicOverrideState(null);
                router.push(`/admin/platform`);
              }}
              className="flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-medium transition-colors"
              style={{ background: "rgba(165,180,252,0.2)", color: "#a5b4fc" }}
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
              Stop managing
            </button>
          </div>
        )}

        {/* Page content */}
        <main className="flex-1 p-4 md:p-6 lg:p-8 overflow-y-auto">{children}</main>
      </div>
    </div>
    </DisplayCurrencyProvider>
  );
}
