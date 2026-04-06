import { useMemo, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Trash2, Plus } from "lucide-react";

function TypeList({ items, label, onAdd, onRemove, hasEmoji = false }) {
  const [name, setName] = useState("");
  const [emoji, setEmoji] = useState("📦");

  const filteredItems = useMemo(
    () => items.filter((item) => item.name.toLowerCase().includes(name.toLowerCase())),
    [items, name]
  );

  const handleAdd = (event) => {
    event.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) return;
    onAdd({ name: trimmed, emoji: hasEmoji ? emoji : undefined });
    setName("");
    setEmoji("📦");
  };

  return (
    <div className="space-y-3">
      <form onSubmit={handleAdd} className="flex gap-2">
        {hasEmoji && (
          <Input
            value={emoji}
            onChange={(e) => setEmoji(e.target.value)}
            className="h-8 w-14 text-center text-lg"
            maxLength={2}
          />
        )}
        <Input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder={`Novo ${label.toLowerCase()}...`}
          className="h-8 text-sm flex-1"
          autoComplete="off"
        />
        <Button type="submit" size="sm" className="h-8 px-3 shrink-0">
          <Plus className="h-3.5 w-3.5" />
        </Button>
      </form>

      {filteredItems.length === 0 ? (
        <p className="text-xs text-muted-foreground text-center py-4">Nenhum cadastrado ainda.</p>
      ) : (
        <ul className="space-y-1.5 max-h-64 overflow-y-auto">
          {filteredItems.map((item) => (
            <li key={item.name} className="flex items-center justify-between gap-2 bg-muted/40 rounded-lg px-3 py-2 group">
              <span className="text-sm flex items-center gap-2">
                {hasEmoji && <span>{item.emoji || "📦"}</span>}
                {item.name}
              </span>
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6 opacity-0 group-hover:opacity-100 hover:text-destructive"
                onClick={() => onRemove(item.name)}
              >
                <Trash2 className="h-3 w-3" />
              </Button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export default function ManageTypesModal({ open, onClose, items = [], onAdd = () => {}, onRemove = () => {} }) {
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="text-base font-semibold">Gerenciar Tipos</DialogTitle>
        </DialogHeader>
        <Tabs defaultValue="equipment" className="mt-1">
          <TabsList className="w-full">
            <TabsTrigger value="equipment" className="flex-1 text-xs">Tipos de Equipamento</TabsTrigger>
            <TabsTrigger value="problem" className="flex-1 text-xs">Tipos de Problema</TabsTrigger>
            <TabsTrigger value="origin" className="flex-1 text-xs">Origens</TabsTrigger>
          </TabsList>
          <TabsContent value="equipment" className="mt-3">
            <TypeList items={items} label="Tipo" onAdd={onAdd} onRemove={onRemove} hasEmoji />
          </TabsContent>
          <TabsContent value="problem" className="mt-3">
            <TypeList items={items} label="Problema" onAdd={onAdd} onRemove={onRemove} />
          </TabsContent>
          <TabsContent value="origin" className="mt-3">
            <TypeList items={items} label="Origem" onAdd={onAdd} onRemove={onRemove} />
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
