import { useState, useRef } from "react";

const HELP = {
  title: "Coaches",
  description: "Manage the people who will be evaluating players and running the tryout. Coaches added here appear in the evaluator dropdown on the iPad.",
  steps: [
    { step: 1, text: "Click Add Coach and enter their name and role (e.g. Evaluator, Head Coach, Court Coach)." },
    { step: 2, text: "To give a coach iPad access, go to Staff & Roles and assign them a PIN and station." },
    { step: 3, text: "Coaches with the role 'Evaluator' will appear in the evaluator selector on the Evaluation station." },
    { step: 4, text: "Delete a coach with the trash icon — this removes them from the app but not their historical evaluations." },
  ],
  tips: [
    "Role names are flexible — use whatever your club uses (Head Coach, Assistant, Evaluator, Court Coach).",
    "Only coaches with a PIN assigned in Staff & Roles can log in on the iPad.",
    "Coaches can evaluate from the admin console too, not just the iPad.",
  ],
};
import { useListCoaches, useCreateCoach, useDeleteCoach, getListCoachesQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { UserCheck, Plus, Trash2, Users } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const ROLE_OPTIONS = ["Evaluator", "Court Coach", "Head Coach", "Assistant Coach", "Staff"];

const ROLE_COLORS: Record<string, string> = {
  "Evaluator": "bg-blue-50 text-blue-700 border-blue-200",
  "Court Coach": "bg-purple-50 text-purple-700 border-purple-200",
  "Head Coach": "bg-amber-50 text-amber-700 border-amber-200",
  "Assistant Coach": "bg-green-50 text-green-700 border-green-200",
  "Staff": "bg-gray-50 text-gray-600 border-gray-200",
};

export default function Coaches() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [nameInput, setNameInput] = useState("");
  const [roleInput, setRoleInput] = useState("Evaluator");
  const nameInputRef = useRef<HTMLInputElement>(null);

  const { data: coaches, isLoading } = useListCoaches();
  const createCoach = useCreateCoach();
  const deleteCoach = useDeleteCoach();

  const openDialog = () => {
    setNameInput("");
    setRoleInput("Evaluator");
    setDialogOpen(true);
    setTimeout(() => nameInputRef.current?.focus(), 50);
  };

  const handleCreate = async () => {
    const name = nameInput.trim();
    if (!name) return;
    await createCoach.mutateAsync({ data: { name, teamName: roleInput } });
    queryClient.invalidateQueries({ queryKey: getListCoachesQueryKey() });
    setDialogOpen(false);
    toast({ title: "Coach added", description: `${name} has been added as ${roleInput}.` });
  };

  const handleDelete = async (id: number, name: string) => {
    if (!confirm(`Remove ${name} from the coaches list?`)) return;
    await deleteCoach.mutateAsync({ id });
    queryClient.invalidateQueries({ queryKey: getListCoachesQueryKey() });
    toast({ title: "Coach removed", description: `${name} has been removed.` });
  };

  const evaluators = coaches?.filter((c) => c.teamName === "Evaluator") ?? [];
  const courtCoaches = coaches?.filter((c) => c.teamName === "Court Coach") ?? [];
  const others = coaches?.filter((c) => !["Evaluator", "Court Coach"].includes(c.teamName)) ?? [];

  return (
    <div className="flex flex-col h-full overflow-hidden bg-background">
      <div className="flex-none p-6 pb-4 border-b">
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-3xl font-bold tracking-tight">Coaches</h1>
            </div>
            <p className="text-muted-foreground text-sm mt-1">
              Manage evaluators and court coaches for this tryout
            </p>
          </div>
          <Button onClick={openDialog} className="font-bold gap-2">
            <Plus className="h-4 w-4" />
            Add Coach
          </Button>
        </div>
      </div>

      <div className="flex-1 overflow-auto p-6 space-y-6">
        {isLoading ? (
          <div className="flex items-center justify-center py-24 text-muted-foreground animate-pulse">
            Loading coaches...
          </div>
        ) : !coaches?.length ? (
          <div className="flex flex-col items-center justify-center py-24 text-center gap-4">
            <div className="rounded-full bg-muted p-5">
              <Users className="h-10 w-10 text-muted-foreground" />
            </div>
            <div>
              <h2 className="text-xl font-bold">No coaches yet</h2>
              <p className="text-muted-foreground text-sm mt-1 max-w-xs">
                Add evaluators and court coaches so they can be selected during eval sessions and check-in.
              </p>
            </div>
            <Button onClick={openDialog} className="font-bold gap-2">
              <Plus className="h-4 w-4" />
              Add First Coach
            </Button>
          </div>
        ) : (
          <>
            {evaluators.length > 0 && (
              <Section title="Evaluators" coaches={evaluators} onDelete={handleDelete} />
            )}
            {courtCoaches.length > 0 && (
              <Section title="Court Coaches" coaches={courtCoaches} onDelete={handleDelete} />
            )}
            {others.length > 0 && (
              <Section title="Other Staff" coaches={others} onDelete={handleDelete} />
            )}
          </>
        )}
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <UserCheck className="h-5 w-5 text-primary" />
              Add Coach
            </DialogTitle>
          </DialogHeader>
          <div className="py-2 space-y-3">
            <div>
              <label className="text-sm font-semibold text-foreground mb-1.5 block">Name</label>
              <Input
                ref={nameInputRef}
                placeholder="e.g. Coach Sarah"
                value={nameInput}
                onChange={(e) => setNameInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") handleCreate(); }}
              />
            </div>
            <div>
              <label className="text-sm font-semibold text-foreground mb-1.5 block">Role</label>
              <Select value={roleInput} onValueChange={setRoleInput}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ROLE_OPTIONS.map((r) => (
                    <SelectItem key={r} value={r}>{r}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button
              onClick={handleCreate}
              disabled={!nameInput.trim() || createCoach.isPending}
              className="font-bold"
            >
              <Plus className="h-4 w-4 mr-1" />
              Add Coach
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Section({
  title,
  coaches,
  onDelete,
}: {
  title: string;
  coaches: { id: number; name: string; teamName: string }[];
  onDelete: (id: number, name: string) => void;
}) {
  return (
    <div>
      <h2 className="text-sm font-bold uppercase tracking-wider text-muted-foreground mb-2">{title}</h2>
      <div className="rounded-lg border overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead className="font-bold uppercase tracking-wider text-xs text-muted-foreground/60">Name</TableHead>
              <TableHead className="w-40 font-bold uppercase tracking-wider text-xs text-muted-foreground/60">Role</TableHead>
              <TableHead className="w-20 text-right font-bold uppercase tracking-wider text-xs text-muted-foreground/60">Action</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {coaches.map((coach) => (
              <TableRow key={coach.id} className="group">
                <TableCell className="font-semibold text-base">{coach.name}</TableCell>
                <TableCell>
                  <Badge
                    variant="outline"
                    className={`text-xs font-semibold ${ROLE_COLORS[coach.teamName] ?? "bg-gray-50 text-gray-600 border-gray-200"}`}
                  >
                    {coach.teamName}
                  </Badge>
                </TableCell>
                <TableCell className="text-right">
                  <Button
                    size="sm"
                    variant="ghost"
                    className="opacity-0 group-hover:opacity-100 transition-opacity text-destructive hover:text-destructive hover:bg-destructive/10"
                    onClick={() => onDelete(coach.id, coach.name)}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
