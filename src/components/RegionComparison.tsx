"use client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { ComparisonResult } from "@/types/har";
import { formatTime, getShortUrl } from "@/lib/utils";

interface RegionComparisonProps {
  comparisons: ComparisonResult[];
}

export function RegionComparison({ comparisons }: RegionComparisonProps) {
  if (comparisons.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-zinc-500">
        <p>沒有發現明顯的地區差異</p>
        <p className="text-sm mt-2">請確認已上傳多個地區的 HAR 檔案</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-zinc-500">
          找到 {comparisons.length} 個有明顯地區差異的請求
        </p>
      </div>

      <div className="space-y-3 max-h-[800px] overflow-y-auto">
        {comparisons.map((comparison, index) => (
          <ComparisonCard
            key={index}
            comparison={comparison}
            rank={index + 1}
          />
        ))}
      </div>
    </div>
  );
}

function ComparisonCard({
  comparison,
  rank,
}: {
  comparison: ComparisonResult;
  rank: number;
}) {
  const maxTime = Math.max(...comparison.regions.map((r) => r.time));

  return (
    <Card className="bg-zinc-900/50">
      <CardHeader className="pb-2">
        <div className="flex items-start gap-3">
          <span className="flex items-center justify-center w-6 h-6 rounded-full bg-zinc-800 text-xs font-medium text-zinc-400">
            {rank}
          </span>
          <div className="flex-1 min-w-0">
            <CardTitle className="text-sm font-mono break-all">
              {getShortUrl(comparison.url, 80)}
            </CardTitle>
            <div className="flex items-center gap-2 mt-1">
              <Badge variant="destructive" className="text-xs">
                差異 {formatTime(comparison.maxDiff)}
              </Badge>
              <span className="text-xs text-zinc-500">
                最慢: {comparison.slowestRegion} | 最快:{" "}
                {comparison.fastestRegion}
              </span>
            </div>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          {comparison.regions
            .sort((a, b) => b.time - a.time)
            .map((region) => {
              const isSlowwest = region.name === comparison.slowestRegion;
              const isFastest = region.name === comparison.fastestRegion;
              const barWidth = (region.time / maxTime) * 100;

              return (
                <div key={region.name} className="flex items-center gap-3">
                  <span
                    className={`w-16 text-sm flex-shrink-0 ${
                      isSlowwest
                        ? "text-red-400 font-medium"
                        : isFastest
                        ? "text-green-400"
                        : "text-zinc-400"
                    }`}
                  >
                    {region.name}
                  </span>
                  <div className="flex-1 h-5 bg-zinc-800 rounded overflow-hidden">
                    <div
                      className={`h-full rounded transition-all ${
                        isSlowwest
                          ? "bg-red-500/50"
                          : isFastest
                          ? "bg-green-500/50"
                          : "bg-blue-500/50"
                      }`}
                      style={{ width: `${barWidth}%` }}
                    />
                  </div>
                  <span
                    className={`w-20 text-sm text-right flex-shrink-0 ${
                      isSlowwest
                        ? "text-red-400 font-medium"
                        : isFastest
                        ? "text-green-400"
                        : "text-zinc-400"
                    }`}
                  >
                    {formatTime(region.time)}
                  </span>
                </div>
              );
            })}
        </div>

        {/* 時間細分 */}
        <div className="mt-4 pt-4 border-t border-zinc-800">
          <p className="text-xs text-zinc-500 mb-2">最慢地區時間細分</p>
          <div className="grid grid-cols-4 gap-2 text-xs">
            {(() => {
              const slowest = comparison.regions.find(
                (r) => r.name === comparison.slowestRegion
              );
              if (!slowest) return null;
              const t = slowest.timings;
              return (
                <>
                  <Stat label="DNS" value={t.dns || 0} />
                  <Stat label="TCP" value={t.connect || 0} />
                  <Stat label="SSL" value={t.ssl || 0} />
                  <Stat label="TTFB" value={t.wait} highlight={t.wait > 500} />
                </>
              );
            })()}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function Stat({
  label,
  value,
  highlight = false,
}: {
  label: string;
  value: number;
  highlight?: boolean;
}) {
  return (
    <div className="p-2 rounded bg-zinc-800/50">
      <p className="text-zinc-500">{label}</p>
      <p
        className={highlight ? "text-yellow-400 font-medium" : "text-zinc-300"}
      >
        {formatTime(value)}
      </p>
    </div>
  );
}
