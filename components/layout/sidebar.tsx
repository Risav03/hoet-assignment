"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import {
  LayoutDashboard,
  FolderOpen,
  GitPullRequest,
  Users,
  Settings,
  Bot,
  Activity,
  LogOut,
  ChevronDown,
  Plus,
  Building2,
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

interface Workspace {
  id: string;
  name: string;
  slug: string;
}

interface SidebarProps {
  user: { name: string; email: string };
  workspaces: Workspace[];
}

export function Sidebar({ user, workspaces }: SidebarProps) {
  const pathname = usePathname();
  // Extract workspace slug from /workspaces/[slug]/... paths.
  const workspaceSlugMatch = pathname.match(/^\/workspaces\/([^/]+)/);
  const workspaceSlug = workspaceSlugMatch?.[1];
  const currentWorkspace = workspaces.find((w) => w.slug === workspaceSlug);

  const base = workspaceSlug ? `/workspaces/${workspaceSlug}` : "";

  const globalNav = [
    { href: "/dashboard", icon: LayoutDashboard, label: "Dashboard" },
    { href: "/ai-assistant", icon: Bot, label: "AI Assistant" },
  ];

  const workspaceNav = workspaceSlug
    ? [
        { href: `${base}/documents`, icon: FolderOpen, label: "Documents" },
        { href: `${base}/proposals`, icon: GitPullRequest, label: "Proposals" },
        { href: `${base}/members`, icon: Users, label: "Members" },
        { href: `${base}/activity`, icon: Activity, label: "Activity" },
        { href: `${base}/settings`, icon: Settings, label: "Settings" },
      ]
    : [];

  function isActive(href: string) {
    return pathname === href || pathname.startsWith(href + "/");
  }

  return (
    <aside className="flex flex-col w-64 max-h-screen h-screen  bg-slate-900 text-slate-100 border-r border-slate-800 shrink-0">
      <div className="flex items-center gap-2 px-4 py-4 border-b border-slate-800">
        <div className="w-7 h-7 rounded-md bg-indigo-500 flex items-center justify-center font-bold text-white text-xs shrink-0">
          C
        </div>
        <span className="font-semibold text-sm">CoWork</span>
        <div className="ml-auto flex items-center gap-1.5">
          <OnlineIndicator />
          <SyncStatusIndicator />
        </div>
      </div>

      {/* Workspace switcher */}
      <div className="px-3 py-2 border-b border-slate-800">
        <DropdownMenu>
          <DropdownMenuTrigger className="w-full flex items-center gap-2 text-slate-300 hover:text-white hover:bg-slate-800 px-2 h-9 rounded-md text-sm transition-colors">
            <Building2 className="w-4 h-4 text-slate-400 shrink-0" />
            <span className="text-xs truncate flex-1 text-left">
              {currentWorkspace?.name ?? "Select workspace"}
            </span>
            <ChevronDown className="w-3 h-3 shrink-0" />
          </DropdownMenuTrigger>
          <DropdownMenuContent className="w-56">
            {workspaces.map((ws) => (
              <DropdownMenuItem key={ws.id} onClick={() => { window.location.href = `/workspaces/${ws.slug}`; }}>
                <Building2 className="w-4 h-4 mr-2" />
                {ws.name}
              </DropdownMenuItem>
            ))}
            {workspaces.length > 0 && <DropdownMenuSeparator />}
            <DropdownMenuItem onClick={() => { window.location.href = "/dashboard?action=new-workspace"; }}>
              <Plus className="w-4 h-4 mr-2" />
              New workspace
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <ScrollArea className="flex-1 py-2">
        <nav className="px-2 space-y-0.5">
          {globalNav.map((item) => (
            <Link key={item.href} href={item.href}>
              <span
                className={cn(
                  "flex items-center gap-2.5 px-3 py-2 rounded-md text-sm transition-colors cursor-pointer",
                  isActive(item.href)
                    ? "bg-indigo-600 text-white"
                    : "text-slate-400 hover:text-slate-100 hover:bg-slate-800"
                )}
              >
                <item.icon className="w-4 h-4 shrink-0" />
                {item.label}
              </span>
            </Link>
          ))}

          {workspaceNav.length > 0 && (
            <>
              <div className="px-3 py-1.5 mt-2">
                <p className="text-xs font-medium text-slate-600 uppercase tracking-wider">
                  Workspace
                </p>
              </div>
              {workspaceNav.map((item) => (
                <Link key={item.href} href={item.href}>
                  <span
                    className={cn(
                      "flex items-center gap-2.5 px-3 py-2 rounded-md text-sm transition-colors cursor-pointer",
                      isActive(item.href)
                        ? "bg-indigo-600 text-white"
                        : "text-slate-400 hover:text-slate-100 hover:bg-slate-800"
                    )}
                  >
                    <item.icon className="w-4 h-4 shrink-0" />
                    {item.label}
                  </span>
                </Link>
              ))}
            </>
          )}
        </nav>
      </ScrollArea>

      <div className="border-t border-slate-800 p-3">
        <DropdownMenu>
          <DropdownMenuTrigger className="w-full flex items-center gap-2 text-slate-300 hover:text-white hover:bg-slate-800 px-2 py-1.5 rounded-md transition-colors">
            <Avatar className="w-6 h-6">
              <AvatarFallback className="bg-indigo-600 text-white text-xs">
                {user.name?.[0]?.toUpperCase() ?? "U"}
              </AvatarFallback>
            </Avatar>
            <div className="flex flex-col text-left min-w-0 flex-1">
              <span className="text-xs font-medium truncate">{user.name}</span>
              <span className="text-xs text-slate-500 truncate">{user.email}</span>
            </div>
            <ChevronDown className="w-3 h-3 shrink-0" />
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
    </aside>
  );
}
