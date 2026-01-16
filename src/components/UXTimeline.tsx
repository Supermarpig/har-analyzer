"use client";

import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Clock,
  AlertTriangle,
  Zap,
  Link2,
  Target,
  TrendingUp,
} from "lucide-react";
import type { RegionData, MilestoneType } from "@/types/har";
import { analyzeUXTimeline } from "@/lib/uxTimelineAnalyzer";
import { formatTime, getShortUrl } from "@/lib/utils";
import { ApiChainVisualization } from "./ApiChainVisualization";

interface UXTimelineProps {
  region: RegionData;
}

const MILESTONE_COLORS: Record<MilestoneType, string> = {
  html_loaded: "#a855f7",
  render_blocking_done: "#f97316",
  first_api_response: "#3b82f6",
  critical_resources_done: "#22c55e",
};

const MILESTONE_LABELS: Record<MilestoneType, string> = {
  html_loaded: "HTML",
  render_blocking_done: "阻塞完成",
  first_api_response: "首個 API",
  critical_resources_done: "關鍵資源",
};

export function UXTimeline({ region }: UXTimelineProps) {
  const analysis = useMemo(() => analyzeUXTimeline(region), [region]);

  // 計算基準時間（最早的請求開始時間）
  const baseTime = useMemo(() => {
    if (region.requests.length === 0) return 0;
    return Math.min(...region.requests.map((r) => r.startTime));
  }, [region.requests]);

  return (
    <div className="space-y-6">
      {/* 摘要卡片 - 水平排列 */}
      <div className="grid grid-cols-4 gap-3">
        <SummaryCard
          icon={<Zap className="w-4 h-4 text-yellow-400" />}
          label="首次繪製"
          value={formatTime(analysis.summary.timeToFirstPaint)}
          warning={analysis.summary.timeToFirstPaint > 1000}
        />
        <SummaryCard
          icon={<Target className="w-4 h-4 text-green-400" />}
          label="可互動"
          value={formatTime(analysis.summary.timeToInteractive)}
          warning={analysis.summary.timeToInteractive > 3000}
        />
        <SummaryCard
          icon={<AlertTriangle className="w-4 h-4 text-orange-400" />}
          label="阻塞時間"
          value={formatTime(analysis.summary.totalBlockingTime)}
          warning={analysis.summary.totalBlockingTime > 500}
        />
        <SummaryCard
          icon={<Link2 className="w-4 h-4 text-blue-400" />}
          label="API 鏈"
          value={formatTime(analysis.summary.longestApiChain)}
          warning={analysis.summary.longestApiChain > 2000}
        />
      </div>

      {/* 時間軸視覺化 */}
      <Card className="bg-zinc-900/50">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-sm">
            <Clock className="w-4 h-4" />
            載入時間軸
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* 時間軸條 */}
          <div className="relative h-8 bg-zinc-800 rounded-lg overflow-hidden">
            {analysis.milestones.map((milestone, i) => {
              const prevTime =
                i > 0 ? analysis.milestones[i - 1].time - baseTime : 0;
              const currentTime = milestone.time - baseTime;
              const width =
                ((currentTime - prevTime) / region.totalTime) * 100;
              const color = MILESTONE_COLORS[milestone.type];

              return (
                <div
                  key={i}
                  className="absolute top-0 h-full"
                  style={{
                    left: `${(prevTime / region.totalTime) * 100}%`,
                    width: `${Math.max(width, 0)}%`,
                    backgroundColor: color,
                    opacity: 0.3,
                  }}
                />
              );
            })}
            {/* 里程碑標記線 */}
            {analysis.milestones.map((milestone, i) => {
              const relativeTime = milestone.time - baseTime;
              const position = (relativeTime / region.totalTime) * 100;
              const color = MILESTONE_COLORS[milestone.type];

              return (
                <div
                  key={`line-${i}`}
                  className="absolute top-0 h-full w-0.5"
                  style={{
                    left: `${Math.min(Math.max(position, 0), 99)}%`,
                    backgroundColor: color,
                  }}
                />
              );
            })}
          </div>

          {/* 圖例 */}
          <div className="flex flex-wrap gap-x-6 gap-y-2">
            {analysis.milestones.map((milestone, i) => (
              <div key={i} className="flex items-center gap-2 text-xs">
                <div
                  className="w-2 h-2 rounded-full"
                  style={{ backgroundColor: MILESTONE_COLORS[milestone.type] }}
                />
                <span className="text-zinc-400">
                  {MILESTONE_LABELS[milestone.type]}
                </span>
                <span
                  className="font-mono"
                  style={{ color: MILESTONE_COLORS[milestone.type] }}
                >
                  {formatTime(milestone.time - baseTime)}
                </span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* 阻塞資源 */}
      {analysis.blockingResources.length > 0 && (
        <Card className="bg-zinc-900/50">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-sm">
              <AlertTriangle className="w-4 h-4 text-orange-400" />
              阻塞渲染資源
              <Badge variant="secondary" className="text-xs">
                {analysis.blockingResources.length}
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {analysis.blockingResources.slice(0, 8).map((resource, i) => {
                const impactColor =
                  resource.impact === "high"
                    ? "text-red-400"
                    : resource.impact === "medium"
                      ? "text-yellow-400"
                      : "text-zinc-400";
                const barWidth = Math.min(
                  (resource.blockingDuration /
                    Math.max(
                      ...analysis.blockingResources.map(
                        (r) => r.blockingDuration
                      )
                    )) *
                    100,
                  100
                );

                return (
                  <div key={i} className="flex items-center gap-3">
                    <Badge
                      variant="outline"
                      className={`w-8 justify-center text-xs ${impactColor}`}
                    >
                      {resource.blockingType === "script" ? "JS" : "CSS"}
                    </Badge>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-mono truncate text-zinc-300">
                          {getShortUrl(resource.request.url, 40)}
                        </span>
                      </div>
                      <div className="h-1.5 bg-zinc-800 rounded-full mt-1">
                        <div
                          className={`h-full rounded-full ${
                            resource.impact === "high"
                              ? "bg-red-500"
                              : resource.impact === "medium"
                                ? "bg-yellow-500"
                                : "bg-zinc-600"
                          }`}
                          style={{ width: `${barWidth}%` }}
                        />
                      </div>
                    </div>
                    <span className={`text-xs font-mono ${impactColor}`}>
                      {formatTime(resource.blockingDuration)}
                    </span>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* API 調用鏈 */}
      {analysis.apiChains.length > 0 && (
        <Card className="bg-zinc-900/50">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-sm">
              <Link2 className="w-4 h-4 text-blue-400" />
              API 依賴鏈
              <Badge variant="secondary" className="text-xs">
                {analysis.apiChains.length}
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ApiChainVisualization chains={analysis.apiChains} />
          </CardContent>
        </Card>
      )}

      {/* 等待區間 */}
      {analysis.waitingPeriods.length > 0 && (
        <Card className="bg-zinc-900/50">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-sm">
              <TrendingUp className="w-4 h-4 text-red-400" />
              等待瓶頸
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {analysis.waitingPeriods.slice(0, 5).map((period, i) => {
                const barColor =
                  period.severity === "critical"
                    ? "bg-red-500"
                    : period.severity === "warning"
                      ? "bg-yellow-500"
                      : "bg-blue-500";
                const textColor =
                  period.severity === "critical"
                    ? "text-red-400"
                    : period.severity === "warning"
                      ? "text-yellow-400"
                      : "text-blue-400";
                const maxDuration = Math.max(
                  ...analysis.waitingPeriods.map((p) => p.duration)
                );
                const barWidth = (period.duration / maxDuration) * 100;

                return (
                  <div key={i}>
                    <div className="flex items-center justify-between text-xs mb-1">
                      <span className="text-zinc-400">{period.reason}</span>
                      <span className={`font-mono ${textColor}`}>
                        {formatTime(period.duration)}
                      </span>
                    </div>
                    <div className="h-1.5 bg-zinc-800 rounded-full">
                      <div
                        className={`h-full ${barColor} rounded-full`}
                        style={{ width: `${barWidth}%` }}
                      />
                    </div>
                    <p className="text-xs text-zinc-500 font-mono mt-1 truncate">
                      {period.relatedRequests
                        .map((r) => getShortUrl(r.url, 30))
                        .join(", ")}
                    </p>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function SummaryCard({
  icon,
  label,
  value,
  warning,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  warning?: boolean;
}) {
  return (
    <div
      className={`p-3 rounded-lg border ${
        warning
          ? "border-yellow-500/30 bg-yellow-500/5"
          : "border-zinc-800 bg-zinc-900/50"
      }`}
    >
      <div className="flex items-center gap-2 mb-1">
        {icon}
        <span className="text-xs text-zinc-500">{label}</span>
      </div>
      <p
        className={`text-lg font-bold font-mono ${warning ? "text-yellow-400" : "text-zinc-100"}`}
      >
        {value}
      </p>
    </div>
  );
}
