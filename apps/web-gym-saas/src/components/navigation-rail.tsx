"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { 
  Users, 
  ShoppingCart, 
  Calendar, 
  Settings, 
  LogOut,
  ScanLine,
  Sparkles,
  GitBranch,
  Building2,
  CheckSquare,
  Radio,
  Menu,
  X
} from "lucide-react";
import { cn } from "@/lib/utils";

const navigationItems = [
  {
    name: "Reception",
    href: "/reception",
    icon: ScanLine,
    description: "Check-in monitor",
  },
  {
    name: "Members",
    href: "/members",
    icon: Users,
    description: "Member CRM",
  },
  {
    name: "Corporate B2B",
    href: "/admin/corporate",
    icon: Building2,
    description: "Employer billing",
  },
  {
    name: "Sales & Leads",
    href: "/members/leads",
    icon: GitBranch,
    description: "Pipeline & referrals",
  },
  {
    name: "POS",
    href: "/pos",
    icon: ShoppingCart,
    description: "Point of sale",
  },
  {
    name: "Schedule",
    href: "/calendar",
    icon: Calendar,
    description: "Classes & conflicts",
  },
  {
    name: "Messaging & SMS",
    href: "/communications",
    icon: Radio,
    description: "Africa's Talking & WhatsApp",
  },
  {
    name: "Staff Tasks",
    href: "/admin/tasks",
    icon: CheckSquare,
    description: "Task automations",
  },
  {
    name: "Canvas",
    href: "/marketing/canvas",
    icon: Sparkles,
    description: "Visual Campaign Builder",
  },
  {
    name: "Settings",
    href: "/admin/settings",
    icon: Settings,
    description: "Configuration",
  },
];

export function NavigationRail() {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);

  // Close mobile navigation drawer on route change
  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  const activeItem = navigationItems.find(
    (item) => pathname === item.href || (pathname?.startsWith(item.href + '/') && item.href !== '/')
  );

  return (
    <>
      {/* Mobile Top Header Bar (< lg) */}
      <header className="lg:hidden fixed top-0 left-0 right-0 h-14 bg-surface border-b border-border px-4 flex items-center justify-between z-40">
        <div className="flex items-center gap-2.5">
          <button
            onClick={() => setMobileOpen(!mobileOpen)}
            className="p-2 rounded-lg text-foreground hover:bg-muted focus:outline-none min-h-[44px] min-w-[44px] flex items-center justify-center"
            aria-label="Toggle Navigation Menu"
          >
            {mobileOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
          </button>
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center shrink-0">
              <ScanLine className="w-5 h-5 text-primary-foreground" />
            </div>
            <span className="font-headline-md font-bold text-foreground text-base">
              GymPartner
            </span>
          </div>
        </div>

        {activeItem && (
          <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-primary/10 text-primary border border-primary/20 truncate max-w-[120px] sm:max-w-[180px]">
            {activeItem.name}
          </span>
        )}
      </header>

      {/* Mobile Drawer Overlay Backdrop (< lg) */}
      {mobileOpen && (
        <div
          onClick={() => setMobileOpen(false)}
          className="lg:hidden fixed inset-0 bg-black/60 backdrop-blur-xs z-40 transition-opacity"
          aria-hidden="true"
        />
      )}

      {/* Navigation Sidebar (Desktop fixed + Mobile slide-over drawer) */}
      <nav
        className={cn(
          "fixed left-0 top-0 bottom-0 w-[240px] bg-surface border-r border-border flex flex-col z-50 transition-transform duration-200 ease-in-out",
          "lg:translate-x-0", // Always visible on desktop
          mobileOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0" // Slide-over on mobile
        )}
      >
        {/* Logo/Brand */}
        <div className="p-5 border-b border-border flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-primary flex items-center justify-center shrink-0">
              <ScanLine className="w-6 h-6 text-primary-foreground" />
            </div>
            <div>
              <h1 className="font-headline-md font-bold text-foreground text-base">GymPartner</h1>
              <p className="text-xs text-muted-foreground">Operations Console</p>
            </div>
          </div>

          <button
            onClick={() => setMobileOpen(false)}
            className="lg:hidden p-1 text-muted-foreground hover:text-foreground"
            aria-label="Close menu"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Navigation Items */}
        <div className="flex-1 overflow-y-auto py-3">
          <ul className="space-y-1 px-3">
            {navigationItems.map((item) => {
              const isActive = pathname === item.href || (pathname?.startsWith(item.href + '/') && item.href !== '/');
              const Icon = item.icon;

              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    onClick={() => setMobileOpen(false)}
                    className={cn(
                      "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors",
                      "min-h-[44px]", // 44px minimum touch target
                      isActive
                        ? "bg-primary text-primary-foreground"
                        : "text-muted-foreground hover:bg-muted hover:text-foreground"
                    )}
                    aria-current={isActive ? "page" : undefined}
                  >
                    <Icon className="w-5 h-5 shrink-0" />
                    <div className="flex flex-col">
                      <span>{item.name}</span>
                      <span className="text-xs opacity-70">{item.description}</span>
                    </div>
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>

        {/* Bottom Actions */}
        <div className="p-3 border-t border-border">
          <Link
            href="/login"
            onClick={() => setMobileOpen(false)}
            className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-colors min-h-[44px]"
          >
            <LogOut className="w-5 h-5 shrink-0" />
            <span>Sign Out</span>
          </Link>
        </div>
      </nav>
    </>
  );
}
