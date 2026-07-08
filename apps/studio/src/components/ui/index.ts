/**
 * FarmacoGraph Studio Design System
 *
 * Reusable UI primitives built on Radix UI, Tailwind CSS, and class-variance-authority.
 * Import from `@/components/ui` for the full component library.
 */

// Primitives
export { Button, buttonVariants, type ButtonProps } from "./button";
export { Badge, badgeVariants, type BadgeProps } from "./badge";
export {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
} from "./card";
export { Input } from "./input";
export { Textarea } from "./textarea";
export { Label } from "./label";
export { Separator } from "./separator";
export { ScrollArea } from "./scroll-area";
export { Skeleton } from "./skeleton";

// Data display
export {
  Table,
  TableHeader,
  TableBody,
  TableFooter,
  TableHead,
  TableRow,
  TableCell,
  TableCaption,
} from "./table";
export { Timeline, type TimelineItem, type TimelineProps } from "./timeline";

// Overlays
export {
  Dialog,
  DialogTrigger,
  DialogPortal,
  DialogOverlay,
  DialogClose,
  DialogContent,
  DialogHeader,
  DialogFooter,
  DialogTitle,
  DialogDescription,
} from "./dialog";
export {
  Drawer,
  DrawerTrigger,
  DrawerPortal,
  DrawerOverlay,
  DrawerClose,
  DrawerContent,
  DrawerHeader,
  DrawerFooter,
  DrawerTitle,
  DrawerDescription,
} from "./drawer";
export {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from "./dropdown-menu";

// Forms
export {
  Form,
  FormItem,
  FormLabel,
  FormControl,
  FormDescription,
  FormMessage,
  FormField,
  useFormField,
} from "./form";
export { PropertyEditor, type PropertyEditorField, type PropertyEditorProps } from "./property-editor";
export { SearchInput, type SearchInputProps } from "./search-input";

// Feedback
export { EmptyState, type EmptyStateProps } from "./empty-state";
export { ErrorState, type ErrorStateProps } from "./error-state";
export {
  TextSkeleton,
  CardSkeleton,
  ListSkeleton,
  TableSkeleton,
  StatGridSkeleton,
  PageHeaderSkeleton,
} from "./loading-skeleton";

// Semantic badges
export { ValidationBadge, type ValidationBadgeProps, type ValidationStatus } from "./validation-badge";
export { ConfidenceBadge, type ConfidenceBadgeProps, type ConfidenceLevel } from "./confidence-badge";
export { EvidenceBadge, type EvidenceBadgeProps, type EvidenceType } from "./evidence-badge";
export { StatusBadge, type StatusBadgeProps, type StatusValue } from "./status-badge";

// Command palette (cmdk)
export {
  Command,
  CommandDialog,
  CommandInput,
  CommandList,
  CommandEmpty,
  CommandGroup,
  CommandItem,
} from "./command";
