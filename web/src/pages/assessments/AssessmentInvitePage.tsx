import { useEffect, useState, useCallback } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { assessmentsApi } from "@/services/assessments";
import { sessionsApi } from "@/services/sessions";
import { LEVEL_LABELS } from "@/utils/constants";
import { ArrowLeft, Copy, Check, Eye, Pencil, Clock, Plus, UserRound, Loader2, RotateCcw, Ban } from "lucide-react";
import type { Assessment, Session } from "@/types";

function SessionRow({
  session,
  index,
  assessmentId,
  onCopy,
  copiedId,
  onNewLink,
  creatingLinkId,
  onRevoke,
  revokingId,
}: {
  session: Session;
  index: number;
  assessmentId: string;
  onCopy: (id: number) => void;
  copiedId: number | null;
  onNewLink: (session: Session) => void;
  creatingLinkId: number | null;
  onRevoke: (session: Session) => void;
  revokingId: number | null;
}) {
  const navigate = useNavigate();
  const isLive = session.status === "active";
  const isEnded = session.status === "ended";
  const isPending = session.status === "pending";
  const isFailed = isEnded && session.end_reason === "error";
  const displayName = session.candidate_name || `Candidate ${index}`;
  const isCreatingLink = creatingLinkId === session.id;
  const isRevoking = revokingId === session.id;

  const subtitle = session.started_at
    ? new Date(session.started_at).toLocaleDateString()
    : session.created_at
      ? `Invited ${new Date(session.created_at).toLocaleDateString()}`
      : "Invite ready";

  const statusLabel = isPending
    ? "Awaiting"
    : isLive
      ? "Live"
      : isFailed
        ? "Failed"
        : "Completed";

  const statusClass = isPending
    ? "text-amber-600"
    : isLive
      ? "text-primary"
      : isFailed
        ? "text-destructive"
        : "text-green-600";

  const statusDotClass = isPending
    ? "bg-amber-400"
    : isLive
      ? "bg-primary animate-pulse"
      : isFailed
        ? "bg-destructive"
        : "bg-green-500";

  const actionBtn =
    "h-7 px-2.5 text-xs shrink-0";

  return (
    <div className="grid grid-cols-[1fr_auto] gap-3 items-center py-3 px-4 min-h-[3.5rem]">
      <div className="flex items-center gap-3 min-w-0">
        <div className="flex items-center justify-center w-7 h-7 rounded-full bg-muted text-xs font-medium text-muted-foreground shrink-0">
          {index}
        </div>
        <div className="min-w-0 space-y-0.5">
          <div className="text-sm font-medium truncate">{displayName}</div>
          <div className="text-xs text-muted-foreground">{subtitle}</div>
        </div>
      </div>

      <div className="flex items-center gap-3 shrink-0">
        <span className={`flex items-center gap-1.5 text-xs w-[7.5rem] justify-end ${statusClass}`}>
          <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${statusDotClass}`} />
          {statusLabel}
        </span>

        <div className="flex items-center justify-end gap-1.5 min-w-[11.5rem]">
          {isPending && (
            <>
              <Button
                variant="outline"
                size="sm"
                className={actionBtn}
                onClick={() => onCopy(session.id)}
              >
                {copiedId === session.id ? (
                  <><Check className="h-3 w-3 mr-1" /> Copied</>
                ) : (
                  <><Copy className="h-3 w-3 mr-1" /> Copy link</>
                )}
              </Button>
              <Button
                variant="outline"
                size="sm"
                className={`${actionBtn} text-muted-foreground hover:text-destructive`}
                disabled={isRevoking}
                onClick={() => onRevoke(session)}
              >
                {isRevoking ? (
                  <Loader2 className="h-3 w-3 animate-spin" />
                ) : (
                  <><Ban className="h-3 w-3 mr-1" /> Revoke</>
                )}
              </Button>
            </>
          )}
          {isLive && (
            <Button
              variant="outline"
              size="sm"
              className={actionBtn}
              onClick={() => navigate(`/assessments/${assessmentId}/sessions/${session.id}/monitor`)}
            >
              <Eye className="h-3 w-3 mr-1" /> Monitor
            </Button>
          )}
          {isFailed && (
            <Button
              variant="outline"
              size="sm"
              className={actionBtn}
              disabled={isCreatingLink}
              onClick={() => onNewLink(session)}
            >
              {isCreatingLink ? (
                <><Loader2 className="h-3 w-3 mr-1 animate-spin" /> Creating…</>
              ) : (
                <><RotateCcw className="h-3 w-3 mr-1" /> New link</>
              )}
            </Button>
          )}
          {isEnded && !isFailed && (
            <Button
              variant="outline"
              size="sm"
              className={actionBtn}
              onClick={() => navigate(`/assessments/${assessmentId}/sessions/${session.id}/portfolio`)}
            >
              <Eye className="h-3 w-3 mr-1" />
              Results
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

export default function AssessmentInvitePage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [assessment, setAssessment] = useState<Assessment | null>(null);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(true);
  const [creatingSession, setCreatingSession] = useState(false);
  const [newSession, setNewSession] = useState<Session | null>(null);
  const [copiedId, setCopiedId] = useState<number | null>(null);
  const [newSessionCopied, setNewSessionCopied] = useState(false);
  const [showInviteDialog, setShowInviteDialog] = useState(false);
  const [candidateNameInput, setCandidateNameInput] = useState("");
  const [creatingLinkId, setCreatingLinkId] = useState<number | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionNotice, setActionNotice] = useState<string | null>(null);
  const [sessionToRevoke, setSessionToRevoke] = useState<Session | null>(null);
  const [revokingId, setRevokingId] = useState<number | null>(null);

  const loadSessions = useCallback(async () => {
    const res = await assessmentsApi.getSessions(Number(id));
    setSessions(res.data.sessions);
  }, [id]);

  useEffect(() => {
    Promise.all([
      assessmentsApi.get(Number(id)),
      assessmentsApi.getSessions(Number(id)),
    ]).then(([aRes, sRes]) => {
      setAssessment(aRes.data.assessment);
      setSessions(sRes.data.sessions);
    }).catch(() => { }).finally(() => setLoading(false));
  }, [id]);

  // Poll while any session is live or pending
  useEffect(() => {
    const hasActive = sessions.some((s) => s.status !== "ended");
    if (!hasActive) return;
    const interval = setInterval(loadSessions, 5000);
    return () => clearInterval(interval);
  }, [sessions, loadSessions]);

  const openInviteDialog = () => {
    setCandidateNameInput("");
    setShowInviteDialog(true);
  };

  const applyCreatedSession = (created: Session, reused?: boolean) => {
    if (reused) {
      setSessions((prev) => (prev.some((s) => s.id === created.id) ? prev : [created, ...prev]));
      copyLink(created, created.id);
      const name = created.candidate_name || "This candidate";
      setActionNotice(`${name} already has an awaiting invite — link copied.`);
      return;
    }

    setSessions((prev) => [created, ...prev]);
  };

  const handleInviteCandidate = async () => {
    setCreatingSession(true);
    setShowInviteDialog(false);
    setNewSession(null);
    setActionError(null);
    setActionNotice(null);
    try {
      const res = await assessmentsApi.createSession(Number(id), candidateNameInput.trim() || undefined);
      applyCreatedSession(res.data.session, res.data.reused);
      setNewSession(res.data.session);
    } catch (e: any) {
      setActionError(e?.response?.data?.errors?.[0]?.message ?? "Failed to create invite.");
    } finally {
      setCreatingSession(false);
    }
  };

  /** Reuse a pending invite for this person, or createSession if none exists. */
  const handleNewLink = async (failed: Session) => {
    setCreatingLinkId(failed.id);
    setNewSession(null);
    setActionError(null);
    setActionNotice(null);
    try {
      const res = await assessmentsApi.createSession(
        Number(id),
        failed.candidate_name || undefined,
        failed.candidate_id
      );
      applyCreatedSession(res.data.session, res.data.reused);
      setNewSession(res.data.session);
    } catch (e: any) {
      setActionError(e?.response?.data?.errors?.[0]?.message ?? "Failed to create new link.");
    } finally {
      setCreatingLinkId(null);
    }
  };

  const handleRevoke = async () => {
    if (!sessionToRevoke) return;
    const target = sessionToRevoke;
    setSessionToRevoke(null);
    setRevokingId(target.id);
    setActionError(null);
    setActionNotice(null);
    try {
      await sessionsApi.revoke(target.id);
      setSessions((prev) => prev.filter((s) => s.id !== target.id));
    } catch (e: any) {
      setActionError(e?.response?.data?.errors?.[0]?.message ?? "Failed to revoke invite.");
    } finally {
      setRevokingId(null);
    }
  };

  const copyLink = (session: Session, sid: number) => {
    navigator.clipboard.writeText(session.invite_url);
    setCopiedId(sid);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const copyNewSessionLink = () => {
    if (!newSession?.invite_url) return;
    navigator.clipboard.writeText(newSession.invite_url);
    setNewSessionCopied(true);
    setTimeout(() => setNewSessionCopied(false), 2000);
  };

  if (loading) {
    return (
      <div className="max-w-2xl mx-auto space-y-4">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-48 w-full" />
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-2">
          <Link to="/assessments" className="text-muted-foreground hover:text-foreground">
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <div>
            <h1 className="text-lg font-semibold">{assessment?.name ?? "—"}</h1>
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground mt-0.5">
              <Clock className="h-3 w-3" />
              {assessment?.time_limit_min} min · {assessment?.skills?.length ?? 0} skills
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => navigate(`/assessments/${id}/edit`)}>
            <Pencil className="h-3.5 w-3.5 mr-1.5" /> Edit
          </Button>
          <Button size="sm" onClick={openInviteDialog} disabled={creatingSession}>
            <Plus className="h-3.5 w-3.5 mr-1.5" />
            {creatingSession ? "Creating..." : "Invite Candidate"}
          </Button>
        </div>
      </div>

      {/* Invite candidate dialog */}
      <Dialog open={showInviteDialog} onOpenChange={setShowInviteDialog}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Invite Candidate</DialogTitle>
          </DialogHeader>
          <div className="space-y-2 py-2">
            <Label htmlFor="candidate-name">Candidate name</Label>
            <Input
              id="candidate-name"
              placeholder="e.g. Budi Santoso"
              value={candidateNameInput}
              onChange={(e) => setCandidateNameInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleInviteCandidate()}
              autoFocus
            />
            <p className="text-xs text-muted-foreground">Optional — helps you identify this session later.</p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowInviteDialog(false)}>Cancel</Button>
            <Button onClick={handleInviteCandidate}>Create Link</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {actionError && (
        <p className="text-sm text-destructive">{actionError}</p>
      )}
      {actionNotice && (
        <p className="text-sm text-muted-foreground">{actionNotice}</p>
      )}

      <Separator />

      {/* Sessions list */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold">
            Candidates
            {sessions.length > 0 && (
              <span className="ml-1.5 text-muted-foreground font-normal">({sessions.length})</span>
            )}
          </h2>
        </div>

        {sessions.length === 0 ? (
          <div className="border rounded-lg p-10 text-center space-y-3">
            <UserRound className="h-8 w-8 text-muted-foreground mx-auto" />
            <div>
              <p className="text-sm font-medium">No candidates yet</p>
              <p className="text-xs text-muted-foreground mt-1">
                Click "Invite Candidate" to generate an interview link.
              </p>
            </div>
          </div>
        ) : (
          <Card>
            <CardContent className="p-0 divide-y">
              {sessions.map((session, i) => (
                <SessionRow
                  key={session.id}
                  session={session}
                  index={sessions.length - i}
                  assessmentId={id!}
                  onCopy={(sid) => {
                    const s = sessions.find((x) => x.id === sid);
                    if (s) copyLink(s, sid);
                  }}
                  copiedId={copiedId}
                  onNewLink={handleNewLink}
                  creatingLinkId={creatingLinkId}
                  onRevoke={setSessionToRevoke}
                  revokingId={revokingId}
                />
              ))}
            </CardContent>
          </Card>
        )}
      </div>

      <AlertDialog open={!!sessionToRevoke} onOpenChange={(open) => !open && setSessionToRevoke(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Revoke this invite?</AlertDialogTitle>
            <AlertDialogDescription>
              The link for {sessionToRevoke?.candidate_name || "this candidate"} will stop working.
              You can invite them again later by creating a new link.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={handleRevoke}
            >
              Revoke
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Assessment skills detail */}
      {assessment?.skills && assessment.skills.length > 0 && (
        <>
          <Separator />
          <div className="space-y-2">
            <h2 className="text-sm font-semibold">Skills assessed</h2>
            <ul className="space-y-1">
              {assessment.skills.map((s) => (
                <li key={s.id ?? s.skill_label} className="flex items-center gap-2 text-sm text-muted-foreground">
                  <span>•</span>
                  <span>{s.skill_label}</span>
                  <span className="text-xs">(expected {LEVEL_LABELS[s.expected_level]})</span>
                </li>
              ))}
            </ul>
          </div>
        </>
      )}
    </div>
  );
}
