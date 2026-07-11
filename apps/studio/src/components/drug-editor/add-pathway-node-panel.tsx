"use client";

import { useState } from "react";
import { Loader2, Plus, Search } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { useCuratorMechanismFragments } from "@/lib/api/react-query/hooks";
import { CreateMechanismFragmentDialog } from "./create-mechanism-fragment-dialog";

export interface AddPathwayNodePanelProps {
  onCanvasIds: Set<string>;
  rootIds: Set<string>;
  disabled?: boolean;
  onAdd: (fragment: {
    entity_id: string;
    slug: string;
    label: string;
    description?: string | null;
  }) => void;
}

export function AddPathwayNodePanel({
  onCanvasIds,
  rootIds,
  disabled = false,
  onAdd,
}: AddPathwayNodePanelProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const catalog = useCuratorMechanismFragments({ search, limit: 40 });
  const rows = catalog.data?.data ?? [];

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) setSearch("");
      }}
    >
      <DialogTrigger asChild>
        <Button type="button" size="sm" variant="outline" disabled={disabled}>
          <Plus className="h-4 w-4" />
          Add node
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Add mechanism fragment</DialogTitle>
          <DialogDescription>
            Place a fragment on the canvas. Mark it as a root from the selection toolbar after adding,
            or connect from the Drug node.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="relative">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              className="pl-9"
              placeholder="Search catalog..."
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              autoFocus
            />
          </div>
          <div className="flex justify-end">
            <CreateMechanismFragmentDialog
              onCreated={(entity) => {
                onAdd({
                  entity_id: entity.id,
                  slug: entity.slug,
                  label: entity.label,
                  description: entity.description,
                });
                setOpen(false);
              }}
            />
          </div>
          <ul className="max-h-72 space-y-1 overflow-y-auto rounded-md border">
            {catalog.isLoading ? (
              <li className="flex items-center gap-2 p-3 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                Loading...
              </li>
            ) : rows.length === 0 ? (
              <li className="p-3 text-sm text-muted-foreground">No fragments found.</li>
            ) : (
              rows.map((row) => {
                const onCanvas = onCanvasIds.has(row.entity_id);
                return (
                  <li
                    key={row.entity_id}
                    className="flex items-center justify-between gap-2 border-b p-2 last:border-b-0"
                  >
                    <span className="min-w-0 truncate text-sm">
                      {row.label}
                      {rootIds.has(row.entity_id) && (
                        <Badge variant="secondary" className="ml-2">
                          root
                        </Badge>
                      )}
                    </span>
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      disabled={onCanvas}
                      onClick={() => {
                        onAdd(row);
                        setOpen(false);
                      }}
                    >
                      {onCanvas ? "On canvas" : "Add"}
                    </Button>
                  </li>
                );
              })
            )}
          </ul>
        </div>
      </DialogContent>
    </Dialog>
  );
}
