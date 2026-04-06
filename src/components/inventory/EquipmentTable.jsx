import { useState } from "react";
import { Pencil, Trash2, ChevronUp, ChevronDown, ChevronsUpDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import StatusBadge from "./StatusBadge";
import { cn } from "@/lib/utils";

function SortBtn({ field, current, dir, onSort }) {
  const active = current === field;
  return (
    <button className="inline-flex items-center gap-0.5 hover:text-foreground" onClick={() => onSort(field)}>
      {active ? (dir === "asc" ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />) : <ChevronsUpDown className="h-3 w-3 opacity-40" />}
    </button>
  );
}

function BoolCell({ value }) {
  return (
    <span className={cn(
      "inline-flex items-center justify-center h-5 w-5 rounded-full text-[10px] font-bold",
      value ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-400"
    )}>
      {value ? "✓" : "✗"}
    </span>
  );
}

export default function EquipmentTable({ equipment, onEdit, onDelete, equipmentTypes }) {
  const [sortField, setSortField] = useState("created_date");
  const [sortDir, setSortDir] = useState("desc");

  const typeEmojiMap = Object.fromEntries((equipmentTypes || []).map((t) => [t.name, t.emoji || "📦"]));

  const handleSort = (field) => {
    setSortDir(sortField === field ? (sortDir === "asc" ? "desc" : "asc") : "asc");
    setSortField(field);
  };

  const sorted = [...equipment].sort((a, b) => {
    let aV = a[sortField] ?? "";
    let bV = b[sortField] ?? "";
    if (typeof aV === "boolean") { aV = aV ? 1 : 0; bV = bV ? 1 : 0; }
    const cmp = String(aV).toLowerCase() < String(bV).toLowerCase() ? -1 : String(aV).toLowerCase() > String(bV).toLowerCase() ? 1 : 0;
    return sortDir === "asc" ? cmp : -cmp;
  });

  if (equipment.length === 0) {
    return (
      <div className="bg-card rounded-xl border border-dashed border-border py-16 text-center">
        <p className="text-muted-foreground text-sm">Nenhum equipamento encontrado.</p>
      </div>
    );
  }

  const SP = { field: sortField, dir: sortDir, onSort: handleSort };

  return (
    <TooltipProvider>
      <div className="bg-card rounded-xl border border-border overflow-hidden">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/40 hover:bg-muted/40 border-b border-border">
                {[["name", "Nome"], ["type", "Tipo"], ["origin", "Origem"]].map(([f, label]) => (
                  <TableHead key={f} className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    <span className="flex items-center gap-1">{label}<SortBtn field={f} {...SP} /></span>
                  </TableHead>
                ))}
                <TableHead className="text-xs font-semibold uppercase tracking-wider text-muted-foreground text-center">
                  <span className="flex items-center justify-center gap-1">Fmt<SortBtn field="formatted" {...SP} /></span>
                </TableHead>
                <TableHead className="text-xs font-semibold uppercase tracking-wider text-muted-foreground text-center">
                  <span className="flex items-center justify-center gap-1">Cfg<SortBtn field="configured" {...SP} /></span>
                </TableHead>
                <TableHead className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  <span className="flex items-center gap-1">Status<SortBtn field="status" {...SP} /></span>
                </TableHead>
                <TableHead className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Problema</TableHead>
                <TableHead className="w-16"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sorted.map((item) => (
                <TableRow
                  key={item.id}
                  className={cn("group hover:bg-muted/30 cursor-default", item.status === "problem" && "bg-red-50/50 hover:bg-red-50/70")}
                  onDoubleClick={() => onEdit(item)}
                >
                  <TableCell className="font-medium text-sm py-2.5">{item.name}</TableCell>
                  <TableCell className="text-sm py-2.5">
                    <span className="flex items-center gap-1.5 text-muted-foreground">
                      <span>{typeEmojiMap[item.type] || "📦"}</span>{item.type}
                    </span>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground py-2.5">{item.origin}</TableCell>
                  <TableCell className="text-center py-2.5"><BoolCell value={item.formatted} /></TableCell>
                  <TableCell className="text-center py-2.5"><BoolCell value={item.configured} /></TableCell>
                  <TableCell className="py-2.5"><StatusBadge status={item.status} size="sm" /></TableCell>
                  <TableCell className="max-w-[180px] py-2.5">
                    {item.problem_description ? (
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <span className="text-xs text-red-600 truncate block max-w-[160px] cursor-help">{item.problem_description}</span>
                        </TooltipTrigger>
                        <TooltipContent side="top" className="max-w-xs text-xs">{item.problem_description}</TooltipContent>
                      </Tooltip>
                    ) : <span className="text-muted-foreground text-xs">—</span>}
                  </TableCell>
                  <TableCell className="py-2.5">
                    <div className="flex gap-0.5 opacity-0 group-hover:opacity-100">
                      <Button variant="ghost" size="icon" className="h-7 w-7 hover:text-primary" onClick={() => onEdit(item)}>
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-7 w-7 hover:text-destructive" onClick={() => onDelete(item)}>
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
        <div className="px-4 py-2 border-t border-border bg-muted/20">
          <p className="text-xs text-muted-foreground">{equipment.length} item{equipment.length !== 1 ? "s" : ""} · Clique duplo para editar</p>
        </div>
      </div>
    </TooltipProvider>
  );
}