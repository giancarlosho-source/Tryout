import { useState, useRef } from "react";
import { useListCoaches, useCreateCoach } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { User, Plus, Check, Zap } from "lucide-react";

interface CoachPickerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  value: string;
  onChange: (name: string) => void;
}

export function CoachPicker({ open, onOpenChange, value, onChange }: CoachPickerProps) {
  const [newCoachName, setNewCoachName] = useState("");
  const [addingNew, setAddingNew] = useState(false);
  const newInputRef = useRef<HTMLInputElement>(null);

  const { data: allCoaches, refetch } = useListCoaches();
  const coaches = allCoaches?.filter((c) => c.teamName === "Evaluator");
  const createCoach = useCreateCoach();

  const select = (name: string) => {
    onChange(name);
    onOpenChange(false);
    setAddingNew(false);
    setNewCoachName("");
  };

  const handleAddNew = async () => {
    const name = newCoachName.trim();
    if (!name) return;
    await createCoach.mutateAsync({ data: { name, teamName: name } });
    await refetch();
    select(name);
  };

  const startAdding = () => {
    setAddingNew(true);
    setNewCoachName("");
    setTimeout(() => newInputRef.current?.focus(), 50);
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { onOpenChange(o); if (!o) setAddingNew(false); }}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <User className="h-5 w-5 text-primary" /> Who is evaluating?
          </DialogTitle>
        </DialogHeader>

        <div className="py-2 space-y-2">
          {coaches && coaches.length > 0 ? (
            <div className="space-y-1.5">
              {coaches.map((coach) => (
                <button
                  key={coach.id}
                  onClick={() => select(coach.name)}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg border-2 text-left transition-all
                    ${value === coach.name
                      ? "border-primary bg-primary/5 text-primary font-bold"
                      : "border-border hover:border-primary/40 hover:bg-muted/40"
                    }`}
                >
                  <User className="h-4 w-4 shrink-0" />
                  <span className="font-semibold flex-1">{coach.name}</span>
                  {value === coach.name && <Check className="h-4 w-4 text-primary" />}
                </button>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground text-center py-2">No evaluators found. Add one in the console under Coaches.</p>
          )}

          {addingNew ? (
            <div className="flex gap-2 pt-1">
              <Input
                ref={newInputRef}
                placeholder="Coach name..."
                value={newCoachName}
                onChange={(e) => setNewCoachName(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") handleAddNew(); if (e.key === "Escape") setAddingNew(false); }}
                className="text-base"
              />
              <Button onClick={handleAddNew} disabled={!newCoachName.trim() || createCoach.isPending} className="font-bold shrink-0">
                <Plus className="h-4 w-4" />
              </Button>
            </div>
          ) : (
            <Button variant="outline" className="w-full gap-2 font-semibold" onClick={startAdding}>
              <Plus className="h-4 w-4" /> Add New Coach
            </Button>
          )}
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
