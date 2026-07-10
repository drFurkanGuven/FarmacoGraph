import type { ComponentType } from "react";
import {
  Activity,
  BookOpen,
  FlaskConical,
  GitBranch,
  HeartPulse,
  LayoutDashboard,
  Network,
  Pill,
  Search,
  Settings,
  ShieldCheck,
  Users,
  Camera,
} from "lucide-react";

export interface NavItem {
  title: string;
  href: string;
  icon: ComponentType<{ className?: string }>;
  badge?: string;
  disabled?: boolean;
}

export interface NavSection {
  label?: string;
  items: NavItem[];
}

export const navigation: NavSection[] = [
  {
    items: [{ title: "Dashboard", href: "/", icon: LayoutDashboard }],
  },
  {
    label: "Knowledge",
    items: [
      { title: "Drugs", href: "/knowledge/drugs", icon: Pill, badge: "4.2" },
      { title: "Diseases", href: "/knowledge/diseases", icon: HeartPulse, badge: "4.2" },
      { title: "Mechanisms", href: "/knowledge/mechanisms", icon: GitBranch, badge: "4.3" },
      { title: "Evidence", href: "/knowledge/evidence", icon: FlaskConical, badge: "4.2" },
      { title: "Education", href: "/knowledge/education", icon: BookOpen, badge: "4.2" },
    ],
  },
  {
    label: "Platform",
    items: [
      { title: "Graph Explorer", href: "/graph", icon: Network, badge: "4.3" },
      { title: "Validation", href: "/validation", icon: ShieldCheck, badge: "4.3" },
      { title: "Snapshots", href: "/snapshots", icon: Camera, badge: "4.4" },
      { title: "Search", href: "/search", icon: Search },
      { title: "Activity", href: "/activity", icon: Activity, badge: "Soon" },
    ],
  },
  {
    label: "Administration",
    items: [
      { title: "Users", href: "/users", icon: Users, badge: "4.5" },
      { title: "Settings", href: "/settings", icon: Settings },
    ],
  },
];

export const commandItems = navigation.flatMap((section) => section.items);
