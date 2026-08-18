import { useEffect, useState, useCallback } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import SkillPortfolioCard from "@/components/portfolio/SkillPortfolioCard";
import { sessionsApi } from "@/services/sessions";
import { vacanciesApi } from "@/services/vacancies";
import { portfoliosApi } from "@/services/portfolios";
import { usePolling } from "@/hooks/usePolling";
import { normalizePortfolioResponse, type PortfolioViewStatus } from "@/utils/portfolioStatus";
import { ArrowLeft, Download, Loader2, RefreshCw, Zap, FileText, AlertCircle } from "lucide-react";
import type { Portfolio, AssessorOverride, Vacancy } from "@/types";

export default function PortfolioPage() {
  const { id, sessionId } = useParams<{ id: string; sessionId: string }>();
  const navigate = useNavigate();
  const [portfolio, setPortfolio] = useState<Portfolio | null>(null);
  const [viewStatus, setViewStatus] = useState<PortfolioViewStatus>("generating");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [retrying, setRetrying] = useState(false);
  const [retryError, setRetryError] = useState<string | null>(null);
  const [overrides, setOverrides] = useState<Record<number, AssessorOverride>>({});
  const [vacancies, setVacancies] = useState<Vacancy[]>([]);
  const [selectedVacancy, setSelectedVacancy] = useState<string>("");
  const [exporting, setExporting] = useState<"pdf" | "json" | null>(null);
  const [candidateName, setCandidateName] = useState<string | null>(null);

  const applyPortfolioPayload = useCallback((data: Parameters<typeof normalizePortfolioResponse>[0]) => {
    const view = normalizePortfolioResponse(data);
    setViewStatus(view.status);
    setPortfolio(view.portfolio);
    setErrorMessage(view.errorMessage);

    if (view.portfolio?.overrides) {
      const overrideMap: Record<number, AssessorOverride> = {};
      view.portfolio.overrides.forEach((o) => {
        overrideMap[o.portfolio_skill_id] = o;
      });
      setOverrides(overrideMap);
    } else {
      setOverrides({});
    }
  }, []);

  const fetchPortfolio = useCallback(async () => {
    const res = await sessionsApi.getPortfolio(Number(sessionId));
    applyPortfolioPayload(res.data);
  }, [sessionId, applyPortfolioPayload]);

  useEffect(() => {
    Promise.all([fetchPortfolio(), vacanciesApi.list(), sessionsApi.get(Number(sessionId))])
      .then(([, vRes, sRes]) => {
        setVacancies(vRes.data.vacancies);
        setCandidateName(sRes.data.session.candidate_name ?? null);
      })
      .catch(() => {
        setViewStatus("empty");
        setErrorMessage("Failed to load portfolio. Refresh the page and try again.");
      })
      .finally(() => setLoading(false));
  }, [fetchPortfolio, sessionId]);

  const isGenerating = viewStatus === "generating";
  const isComplete = viewStatus === "complete" && !!portfolio;
  const isFailed = viewStatus === "failed";

  usePolling(fetchPortfolio, 5000, isGenerating && !loading);

  const handleOverrideSaved = (skillId: number, override: AssessorOverride) => {
    setOverrides((prev) => ({ ...prev, [skillId]: override }));
  };

  const handleRetry = async () => {
    setRetrying(true);
    setRetryError(null);
    try {
      await sessionsApi.regeneratePortfolio(Number(sessionId));
      setViewStatus("generating");
      setErrorMessage(null);
      await fetchPortfolio();
    } catch (e: any) {
      setRetryError(
        e?.response?.data?.errors?.[0]?.message ??
          "Retry failed. Portfolio can only be regenerated when status is failed."
      );
    } finally {
      setRetrying(false);
    }
  };

  const handleRunFitGap = () => {
    if (!selectedVacancy || !isComplete) return;
    navigate(`/assessments/${id}/sessions/${sessionId}/fitgap/${selectedVacancy}`);
  };

  const handleExport = async (format: "pdf" | "json") => {
    if (!portfolio || !isComplete) return;
    setExporting(format);
    try {
      const res = await portfoliosApi.exportPortfolio(
        portfolio.id,
        format,
        selectedVacancy ? Number(selectedVacancy) : undefined
      );
      if (format === "json") {
        const blob = new Blob([JSON.stringify(res.data, null, 2)], { type: "application/json" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `portfolio-${sessionId}.json`;
        a.click();
        URL.revokeObjectURL(url);
      } else {
        const blob = new Blob([res.data as BlobPart], { type: "application/pdf" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `portfolio-${sessionId}.pdf`;
        a.click();
        URL.revokeObjectURL(url);
      }
    } finally {
      setExporting(null);
    }
  };

  if (loading) {
    return (
      <div className="max-w-2xl mx-auto space-y-4">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-48 w-full" />
        <Skeleton className="h-48 w-full" />
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-2">
          <Link to={`/assessments/${id}/invite`} className="text-muted-foreground hover:text-foreground">
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <div>
            <h1 className="text-lg font-semibold">Portfolio Results</h1>
            {candidateName && (
              <p className="text-sm text-muted-foreground">{candidateName}</p>
            )}
          </div>
        </div>

        <div className="flex gap-2">
          <Link
            to={`/assessments/${id}/sessions/${sessionId}/transcript`}
            className="inline-flex items-center gap-1 text-sm border rounded-md px-3 py-1.5 hover:bg-accent transition-colors"
          >
            <FileText className="h-3.5 w-3.5" />
            Transcript
          </Link>
          {isComplete && (
            <>
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleExport("pdf")}
                disabled={!!exporting}
              >
                {exporting === "pdf" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5 mr-1" />}
                PDF
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleExport("json")}
                disabled={!!exporting}
              >
                {exporting === "json" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5 mr-1" />}
                JSON
              </Button>
            </>
          )}
        </div>
      </div>

      {/* Generating */}
      {isGenerating && (
        <div className="border rounded-lg p-12 text-center space-y-3">
          <Loader2 className="h-8 w-8 animate-spin text-primary mx-auto" />
          <div>
            <p className="font-medium">Generating portfolio...</p>
            <p className="text-sm text-muted-foreground mt-1">
              The AI is analyzing the interview transcript. This usually takes about 2 minutes.
              Export and fit-gap stay disabled until generation completes.
            </p>
          </div>
        </div>
      )}

      {/* Failed */}
      {isFailed && (
        <div className="border border-destructive/40 rounded-lg p-6 text-center space-y-3">
          <AlertCircle className="h-8 w-8 text-destructive mx-auto" />
          <div className="space-y-1">
            <p className="font-medium text-destructive">Portfolio generation failed</p>
            <p className="text-sm text-muted-foreground max-w-md mx-auto">
              {errorMessage}
            </p>
            <p className="text-xs text-muted-foreground">
              Do not use these results for hiring decisions until generation succeeds.
            </p>
          </div>
          <Button variant="outline" size="sm" onClick={handleRetry} disabled={retrying}>
            {retrying ? (
              <><Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" /> Retrying…</>
            ) : (
              <><RefreshCw className="h-3.5 w-3.5 mr-1.5" /> Retry generation</>
            )}
          </Button>
          {retryError && <p className="text-xs text-destructive">{retryError}</p>}
        </div>
      )}

      {/* Empty / unknown */}
      {viewStatus === "empty" && (
        <div className="border rounded-lg p-8 text-center space-y-2">
          <p className="font-medium">Portfolio not ready</p>
          <p className="text-sm text-muted-foreground">{errorMessage}</p>
          <Button variant="outline" size="sm" onClick={() => { setLoading(true); fetchPortfolio().finally(() => setLoading(false)); }}>
            Refresh
          </Button>
        </div>
      )}

      {/* Complete */}
      {isComplete && portfolio && (
        <>
          <div className="space-y-3">
            <div>
              <h2 className="text-sm font-semibold">Configured Skills</h2>
              <p className="text-xs text-muted-foreground">
                Final level = assessor override when present; otherwise AI rating.
              </p>
            </div>
            {portfolio.skills
              .filter((s) => !s.is_discovered)
              .map((skill) => (
                <SkillPortfolioCard
                  key={skill.id}
                  skill={skill}
                  override={overrides[skill.id]}
                  onOverrideSaved={(o) => handleOverrideSaved(skill.id, o)}
                />
              ))}
          </div>

          {portfolio.skills.some((s) => s.is_discovered) && (
            <>
              <Separator />
              <div className="space-y-3">
                <div>
                  <h2 className="text-sm font-semibold flex items-center gap-1.5">
                    <Zap className="h-4 w-4 text-amber-500" />
                    Discovered Skills
                  </h2>
                  <p className="text-xs text-muted-foreground">
                    Skills the AI probed that were not in the original assessment
                  </p>
                </div>
                {portfolio.skills
                  .filter((s) => s.is_discovered)
                  .map((skill) => (
                    <SkillPortfolioCard
                      key={skill.id}
                      skill={skill}
                      override={overrides[skill.id]}
                      onOverrideSaved={(o) => handleOverrideSaved(skill.id, o)}
                    />
                  ))}
              </div>
            </>
          )}

          <Separator />

          <div className="flex items-center gap-3">
            <Select value={selectedVacancy} onValueChange={setSelectedVacancy}>
              <SelectTrigger className="w-56">
                <SelectValue placeholder="Choose vacancy..." />
              </SelectTrigger>
              <SelectContent>
                {vacancies.map((v) => (
                  <SelectItem key={v.id} value={String(v.id)}>
                    {v.role_title}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button onClick={handleRunFitGap} disabled={!selectedVacancy}>
              Run Fit/Gap Analysis →
            </Button>
          </div>
        </>
      )}
    </div>
  );
}
