import { Search, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const FILTERS = [
  { key: "problems", label: "⚠ Problemas" },
  { key: "not_formatted", label: "Não Formatado" },
  { key: "not_configured", label: "Não Configurado" },
];

export default function EquipmentFilters({ search, onSearchChange, activeFilters, onToggleFilter, onClearAll }) {
  const hasAny = search || activeFilters.length > 0;

  return (
    <div className="flex flex-wrap gap-2 items-center">
      <div className="relative">
        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
        <Input
          placeholder="Buscar..."
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          className="pl-8 h-8 text-sm w-48 bg-card"
        />
        {search && (
          <button onClick={() => onSearchChange("")} className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
            <X className="h-3 w-3" />
          </button>
        )}
      </div>
      {FILTERS.map((f) => (
        <Button
          key={f.key}
          variant={activeFilters.includes(f.key) ? "default" : "outline"}
          size="sm"
          onClick={() => onToggleFilter(f.key)}
          className={cn("h-8 text-xs px-3", activeFilters.includes(f.key) && "shadow-sm")}
        >
          {f.label}
        </Button>
      ))}
      {hasAny && (
        <button onClick={onClearAll} className="text-xs text-muted-foreground hover:text-destructive flex items-center gap-1">
          <X className="h-3 w-3" />Limpar
        </button>
      )}
    </div>
  );
}