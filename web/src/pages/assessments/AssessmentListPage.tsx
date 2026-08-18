import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/shared/PageHeader";
import { EmptyState, ErrorState, LoadingBlock } from "@/components/shared/EmptyState";
import { ListRowCard } from "@/components/shared/ListRowCard";
import { SessionStatusPill } from "@/components/shared/StatusPill";
import { assessmentsApi } from "@/services/assessments";
import { Plus, Clock, ClipboardList } from "lucide-react";
import type { Assessment } from "@/types";

export default function AssessmentListPage() {
  const [assessments, setAssessments] = useState<Assessment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const navigate = useNavigate();

  const load = () => {
    setLoading(true);
    setError(false);
    assessmentsApi
      .list()
      .then((res) => setAssessments(res.data.assessments))
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
  }, []);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Assessments"
        description="Design interview sessions, invite candidates, and review decision-ready portfolios."
        actions={
          <Button onClick={() => navigate("/assessments/new")}>
            <Plus className="h-4 w-4 mr-1.5" /> New Assessment
          </Button>
        }
      />

      {error && (
        <ErrorState
          title="Failed to load assessments"
          description="Check your connection and try again."
          onRetry={load}
        />
      )}

      {!error && loading && <LoadingBlock rows={3} />}

      {!error && !loading && assessments.length === 0 && (
        <EmptyState
          icon={ClipboardList}
          title="No assessments yet"
          description="Create your first assessment to define skills, time limits, and invite candidates."
          action={
            <Button variant="outline" onClick={() => navigate("/assessments/new")}>
              <Plus className="h-4 w-4 mr-1.5" /> Create your first assessment
            </Button>
          }
        />
      )}

      {!error && !loading && assessments.length > 0 && (
        <div className="space-y-2">
          {assessments.map((a) => (
            <ListRowCard
              key={a.id}
              onClick={() => navigate(`/assessments/${a.id}/invite`)}
              title={
                <span className="inline-flex items-center gap-2 min-w-0">
                  <ClipboardList className="h-4 w-4 text-muted-foreground shrink-0" />
                  {a.name}
                </span>
              }
              meta={
                <>
                  <span className="inline-flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    {a.time_limit_min} min
                  </span>
                  {a.language && (
                    <span className="uppercase tracking-wide text-[10px] border rounded px-1.5 py-0.5">
                      {a.language}
                    </span>
                  )}
                  <SessionStatusPill session={a.latest_session} />
                </>
              }
            />
          ))}
        </div>
      )}
    </div>
  );
}
