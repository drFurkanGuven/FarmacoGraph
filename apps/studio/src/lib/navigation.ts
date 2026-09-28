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
  Compass,
  Stethoscope,
  ArrowLeftRight,
  Code2,
  Database,
  Sparkles,
  Upload,
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
    label: "Clinical & Learning",
    items: [
      { title: "Explorer", href: "/explore", icon: Compass, badge: "New" },
      { title: "Interactions (DDI)", href: "/interactions", icon: Stethoscope, badge: "Live" },
      { title: "Comparator", href: "/compare", icon: ArrowLeftRight, badge: "New" },
      { title: "Mechanism Builder", href: "/mechanism-builder", icon: GitBranch, badge: "New" },
      { title: "Mechanism Review", href: "/mechanism-review", icon: ShieldCheck, badge: "Review" },
      { title: "AI Content Generator", href: "/ai-content-generator", icon: Sparkles, badge: "AI" },
    ],
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
      { title: "Import Center", href: "/imports", icon: Database, badge: "New" },
      { title: "Bulk Import", href: "/bulk-import", icon: Upload, badge: "New" },
      { title: "Developer & API", href: "/developer", icon: Code2, badge: "B2B" },
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
      { title: "AI Settings", href: "/ai-settings", icon: Sparkles, badge: "New" },
      { title: "Settings", href: "/settings", icon: Settings },
    ],
  },
];

export const simpleNavigation: NavSection[] = [
  {
    items: [{ title: "Ana Sayfa", href: "/", icon: LayoutDashboard }],
  },
  {
    label: "İlaç Bilgileri",
    items: [
      { title: "İlaç Keşfet", href: "/explore", icon: Compass },
      { title: "Etkileşim Kontrolü", href: "/interactions", icon: Stethoscope },
      { title: "İlaç Karşılaştır", href: "/compare", icon: ArrowLeftRight },
      { title: "Mekanizma Oluştur", href: "/mechanism-builder", icon: GitBranch },
      { title: "Mekanizma Onayı", href: "/mechanism-review", icon: ShieldCheck },
    ],
  },
  {
    label: "Öğrenme",
    items: [
      { title: "İlaçlar", href: "/knowledge/drugs", icon: Pill },
      { title: "Hastalıklar", href: "/knowledge/diseases", icon: HeartPulse },
      { title: "Eğitim Materyalleri", href: "/knowledge/education", icon: BookOpen },
      { title: "AI İçerik Üretici", href: "/ai-content-generator", icon: Sparkles },
    ],
  },
  {
    label: "Araçlar",
    items: [
      { title: "Veri İçe Aktar", href: "/imports", icon: Database },
      { title: "Toplu Yükleme", href: "/bulk-import", icon: Upload },
      { title: "AI Ayarları", href: "/ai-settings", icon: Sparkles },
      { title: "Arama", href: "/search", icon: Search },
    ],
  },
];

export const commandItems = navigation.flatMap((section) => section.items);
