import { Package, CheckCircle2, AlertTriangle, Settings } from "lucide-react";

const cards = [
  {
    key: "total", label: "Total", icon: Package,
    color: "text-blue-600", bg: "bg-blue-50", border: "border-blue-100",
    getValue: (eq) => eq.length, filter: null,
  },
  {
    key: "ready", label: "Prontos", icon: CheckCircle2,
    color: "text-emerald-600", bg: "bg-emerald-50", border: "border-emerald-100",
    getValue: (eq) => eq.filter((e) => e.status === "ok" && e.formatted && e.configured).length, filter: null,
  },
  {
    key: "problems", label: "Problemas", icon: AlertTriangle,
    color: "text-red-600", bg: "bg-red-50", border: "border-red-100",
    getValue: (eq) => eq.filter((e) => e.status === "problem").length, filter: "problems",
  },
  {
    key: "setup", label: "Pendentes", icon: Settings,
    color: "text-amber-600", bg: "bg-amber-50", border: "border-amber-100",
    getValue: (eq) => eq.filter((e) => !e.formatted || !e.configured).length, filter: "not_configured",
  },
];

export default function StatsCards({ equipment, activeFilter, onFilterToggle }) {
  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
      {cards.map((card) => {
        const Icon = card.icon;
        const count = card.getValue(equipment);
        const isActive = card.filter && activeFilter === card.filter;
        return (
          <button
            key={card.key}
            onClick={() => card.filter && onFilterToggle(card.filter)}
            className={`bg-card rounded-xl border p-4 flex items-center gap-3 text-left w-full transition-all hover:shadow-md
              ${card.filter ? "cursor-pointer hover:scale-[1.02] active:scale-[0.99]" : "cursor-default"}
              ${isActive ? `${card.border} ring-2 ring-offset-1 shadow-sm` : "border-border"}`}
          >
            <div className={`h-10 w-10 rounded-lg flex items-center justify-center shrink-0 ${card.bg}`}>
              <Icon className={`h-5 w-5 ${card.color}`} />
            </div>
            <div>
              <p className="text-xs text-muted-foreground font-medium">{card.label}</p>
              <p className={`text-2xl font-bold tracking-tight ${isActive ? card.color : "text-foreground"}`}>{count}</p>
            </div>
          </button>
        );
      })}
    </div>
  );
}