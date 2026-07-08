"use client";

import { useState } from "react";
import { Copy, ExternalLink, MoreHorizontal, Search, Workflow } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Skeleton } from "@/components/ui/skeleton";
import { ApiError } from "@/lib/api";
import { useDrug } from "@/lib/api/react-query/hooks";
import type { DrugBrowserRow } from "./types";

interface DrugRowActionsProps {
  row: DrugBrowserRow;
}

function DrugDetailDialog({
  drugId,
  open,
  onOpenChange,
}: {
  drugId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const drugQuery = useDrug(drugId);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Drug detail</DialogTitle>
          <DialogDescription>Loaded from GET /drugs/{drugId}</DialogDescription>
        </DialogHeader>
        {drugQuery.isLoading && <Skeleton className="h-40 w-full" />}
        {drugQuery.error && (
          <p className="text-sm text-destructive">
            {drugQuery.error instanceof ApiError
              ? drugQuery.error.message
              : "Failed to load drug detail."}
          </p>
        )}
        {drugQuery.data && (
          <pre className="max-h-[24rem] overflow-auto rounded-md bg-muted p-3 text-xs">
            {JSON.stringify(drugQuery.data.data, null, 2)}
          </pre>
        )}
      </DialogContent>
    </Dialog>
  );
}

export function DrugRowActions({ row }: DrugRowActionsProps) {
  const [detailOpen, setDetailOpen] = useState(false);
  const canLoadDetail = row.source === "graph";

  async function copySlug() {
    await navigator.clipboard.writeText(row.slug);
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="sm" className="h-8 w-8 p-0" aria-label={`Actions for ${row.slug}`}>
            <MoreHorizontal className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuLabel>Quick actions</DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={() => void copySlug()}>
            <Copy className="h-4 w-4" />
            Copy slug
          </DropdownMenuItem>
          <DropdownMenuItem asChild>
            <Link href={`/search?q=${encodeURIComponent(row.slug)}`}>
              <Search className="h-4 w-4" />
              Search globally
            </Link>
          </DropdownMenuItem>
          <DropdownMenuItem asChild>
            <Link href={`/knowledge/drugs/${row.slug}`}>
              <ExternalLink className="h-4 w-4" />
              Open drug editor
            </Link>
          </DropdownMenuItem>
          {canLoadDetail && (
            <DropdownMenuItem onClick={() => setDetailOpen(true)}>
              <ExternalLink className="h-4 w-4" />
              View API detail
            </DropdownMenuItem>
          )}
          {row.workflowId && (
            <DropdownMenuItem asChild>
              <Link href="/">
                <Workflow className="h-4 w-4" />
                Open workflow queue
              </Link>
            </DropdownMenuItem>
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      {canLoadDetail && (
        <DrugDetailDialog drugId={row.id} open={detailOpen} onOpenChange={setDetailOpen} />
      )}
    </>
  );
}
