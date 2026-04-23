"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import {
  LayoutDashboard,
  FolderOpen,
  Users,
  Settings,
  Bot,
  Activity,
  LogOut,
  ChevronDown,
  Plus,
  Building2,
  Menu,
  LayoutGrid,
} from "lucide-react";
import { signOut } from "next-auth/react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { SyncStatusIndicator } from "@/components/layout/sync-status-indicator";
import { OnlineIndicator } from "@/components/layout/online-indicator";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Sheet,
  SheetContent,
  SheetTrigger,
} from "@/components/ui/sheet";
import { useState } from "react";

interface Workspace {
  id: string;
  name: string;
  slug: string;
}

interface SidebarProps {
  user: { name: string; email: string };
  workspaces: Workspace[];
}

function NavContent({
  user,
  workspaces,
  onNavClick,
}: SidebarProps & { onNavClick?: () => void }) {
  const pathname = usePathname();
  const workspaceSlugMatch = pathname.match(/^\/workspaces\/([^/]+)/);
  const workspaceSlug = workspaceSlugMatch?.[1];
  const currentWorkspace = workspaces.find((w) => w.slug === workspaceSlug);

  const base = workspaceSlug ? `/workspaces/${workspaceSlug}` : "";

  const globalNav = [
    { href: "/dashboard", icon: LayoutDashboard, label: "Dashboard" },
  ];

  const workspaceNav = workspaceSlug
    ? [
      { href: `${base}/documents`, icon: FolderOpen, label: "Documents" },
        { href: `${base}/canvas`, icon: LayoutGrid, label: "Canvas" },
        { href: `${base}/ai-assistant`, icon: Bot, label: "AI Assistant" },
        { href: `${base}/members`, icon: Users, label: "Members" },
        { href: `${base}/activity`, icon: Activity, label: "Activity" },
        { href: `${base}/settings`, icon: Settings, label: "Settings" },
      ]
    : [];

  function isActive(href: string) {
    return pathname === href || pathname.startsWith(href + "/");
  }

  return (
    <div className="flex flex-col h-full">
      {/* Logo strip */}
      <div className="flex items-center gap-2 px-4 h-14 border-b border-sidebar-border shrink-0">
        <div className="flex items-center justify-center font-extrabold text-primary-foreground text-xs shrink-0 w-7 h-7 rounded-lg bg-primary">
          C
        </div>
        <span className="font-bold text-sidebar-accent-foreground text-sm">
          CoWork
        </span>
        <div className="ml-auto flex items-center gap-1.5">
          <OnlineIndicator />
          <SyncStatusIndicator />
        </div>
      </div>

      {/* Workspace switcher */}
      <div className="px-3 py-2.5 border-b border-sidebar-border">
        <DropdownMenu>
          <DropdownMenuTrigger className="w-full flex items-center gap-2 px-2 h-8 rounded-lg transition-colors bg-sidebar-accent border border-sidebar-border text-sidebar-accent-foreground text-xs font-semibold">
            <Building2 className="shrink-0 w-3.5 h-3.5 text-sidebar-foreground" />
            <span className="truncate flex-1 text-left">
              {currentWorkspace?.name ?? "Select workspace"}
            </span>
            <ChevronDown className="w-3 h-3" />
          </DropdownMenuTrigger>
          <DropdownMenuContent className="w-52">
            {workspaces.map((ws) => (
              <DropdownMenuItem
                key={ws.id}
                onClick={() => {
                  window.location.href = `/workspaces/${ws.slug}`;
                }}
              >
                <Building2 className="w-4 h-4 mr-2" />
                {ws.name}
              </DropdownMenuItem>
            ))}
            {workspaces.length > 0 && <DropdownMenuSeparator />}
            <DropdownMenuItem
              onClick={() => {
                window.location.href = "/dashboard?action=new-workspace";
              }}
            >
              <Plus className="w-4 h-4 mr-2" />
              New workspace
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <ScrollArea className="flex-1 py-2">
        <nav className="px-2 space-y-0.5">
          {globalNav.map((item) => (
            <Link key={item.href} href={item.href} onClick={onNavClick}>
              <span
                className={cn(
                  "flex items-center gap-2.5 cursor-pointer transition-all text-[13px] font-medium rounded-lg border-l-[2.5px]",
                  "py-[7px] px-[10px]",
                  isActive(item.href)
                    ? "bg-sidebar-accent text-sidebar-accent-foreground border-l-sidebar-primary"
                    : "text-sidebar-foreground hover:text-sidebar-accent-foreground border-l-transparent"
                )}
              >
                <item.icon
                  className={cn(
                    "shrink-0 w-[15px] h-[15px]",
                    isActive(item.href) ? "text-sidebar-primary" : "text-current"
                  )}
                />
                {item.label}
              </span>
            </Link>
          ))}

          {workspaceNav.length > 0 && (
            <>
              <div className="px-[10px] pt-[10px] pb-1">
                <p className="text-[10px] font-bold uppercase tracking-[0.08em] text-sidebar-foreground">
                  Workspace
                </p>
              </div>
              {workspaceNav.map((item) => (
                <Link key={item.href} href={item.href} onClick={onNavClick}>
                  <span
                    className={cn(
                      "flex items-center gap-2.5 cursor-pointer transition-all text-[13px] font-medium rounded-lg border-l-[2.5px]",
                      "py-[7px] px-[10px]",
                      isActive(item.href)
                        ? "bg-sidebar-accent text-sidebar-accent-foreground border-l-sidebar-primary"
                        : "text-sidebar-foreground hover:text-sidebar-accent-foreground border-l-transparent"
                    )}
                  >
                    <item.icon
                      className={cn(
                        "shrink-0 w-[15px] h-[15px]",
                        isActive(item.href) ? "text-sidebar-primary" : "text-current"
                      )}
                    />
                    {item.label}
                  </span>
                </Link>
              ))}
            </>
          )}
        </nav>
      </ScrollArea>

      {/* User footer */}
      <div className="border-t border-sidebar-border p-3">
        <DropdownMenu>
          <DropdownMenuTrigger className="w-full flex items-center gap-2 px-2 py-1.5 rounded-lg transition-colors hover:bg-sidebar-accent">
            <Avatar className="w-7 h-7">
              <AvatarFallback className="font-bold text-primary-foreground text-xs bg-primary">
                {user.name?.[0]?.toUpperCase() ?? "U"}
              </AvatarFallback>
            </Avatar>
            <div className="flex flex-col text-left min-w-0 flex-1">
              <span className="truncate font-semibold text-xs text-sidebar-accent-foreground">
                {user.name}
              </span>
              <span className="truncate text-[11px] text-sidebar-foreground">
                {user.email}
              </span>
            </div>
            <ChevronDown className="w-3 h-3 text-sidebar-foreground" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48">
            <DropdownMenuItem
              onClick={() => {
                window.location.href = "/settings";
              }}
            >
              Account Settings
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              className="text-red-600 focus:text-red-600 focus:bg-red-50"
              onClick={() => signOut({ callbackUrl: "/login" })}
            >
              <LogOut className="w-4 h-4 mr-2" />
              Sign out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
}

export function Sidebar({ user, workspaces }: SidebarProps) {
  return (
    <aside className="hidden md:flex flex-col h-screen w-[220px] shrink-0 bg-sidebar border-r border-sidebar-border">
      <NavContent user={user} workspaces={workspaces} />
    </aside>
  );
}

export function MobileHeader({ user, workspaces }: SidebarProps) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();

  const workspaceSlugMatch = pathname.match(/^\/workspaces\/([^/]+)/);
  const workspaceSlug = workspaceSlugMatch?.[1];
  const currentWorkspace = workspaces.find((w) => w.slug === workspaceSlug);

  return (
    <header className="md:hidden sticky top-0 z-40 h-14 border-b border-sidebar-border bg-sidebar text-sidebar-foreground flex items-center px-4 gap-3 shrink-0">
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetTrigger className="flex items-center justify-center w-7 h-7 rounded-md text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground transition-colors">
          <Menu className="w-5 h-5" />
          <span className="sr-only">Open menu</span>
        </SheetTrigger>
        <SheetContent side="left" className="w-[260px] p-0 bg-sidebar border-sidebar-border" showCloseButton={false}>
          <NavContent user={user} workspaces={workspaces} onNavClick={() => setOpen(false)} />
        </SheetContent>
      </Sheet>

      <div className="flex items-center gap-2">
        <div className="flex items-center justify-center font-extrabold text-primary-foreground text-xs w-6 h-6 rounded-md bg-primary">
          C
        </div>
        <span className="font-bold text-sidebar-accent-foreground text-sm">
          {currentWorkspace?.name ?? "CoWork"}
        </span>
      </div>

      <div className="ml-auto flex items-center gap-2">
        <OnlineIndicator />
        <SyncStatusIndicator />
        <DropdownMenu>
          <DropdownMenuTrigger className="flex items-center rounded-full">
            <Avatar className="w-7 h-7">
              <AvatarFallback className="font-bold text-primary-foreground text-xs bg-primary">
                {user.name?.[0]?.toUpperCase() ?? "U"}
              </AvatarFallback>
            </Avatar>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48">
            <DropdownMenuItem onClick={() => { window.location.href = "/settings"; }}>
              Account Settings
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              className="text-red-600 focus:text-red-600 focus:bg-red-50"
              onClick={() => signOut({ callbackUrl: "/login" })}
            >
              <LogOut className="w-4 h-4 mr-2" />
              Sign out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
