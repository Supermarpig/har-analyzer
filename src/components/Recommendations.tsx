"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Globe,
  Server,
  Wifi,
  FileDown,
  CheckCircle,
  Copy,
  TrendingUp,
  AlertCircle,
} from "lucide-react";
import type { Recommendation } from "@/types/har";
import { useState, useMemo } from "react";
import { formatTime, getShortUrl } from "@/lib/utils";

interface RecommendationsProps {
  recommendations: Recommendation[];
}

interface DnsData {
  type: "dns";
  stats: { count: number; avgTime: number; maxTime: number; domains: string[] };
  details: Array<{ url: string; dns: number; region: string }>;
}

interface ConnectionData {
  type: "connection";
  stats: { count: number; avgTime: number; maxTime: number };
  details: Array<{ url: string; connect: number; ssl: number; region: string }>;
}

interface TtfbData {
  type: "ttfb";
  stats: { count: number; avgTime: number; maxTime: number };
  details: Array<{ url: string; ttfb: number; region: string }>;
}

interface DownloadData {
  type: "download";
  stats: { count: number; avgTime: number; maxTime: number };
  details: Array<{ url: string; download: number; region: string }>;
}

interface RegionData {
  type: "region";
  stats: {
    region: string;
    slowCount: number;
    avgDiff: number;
    totalComparisons: number;
  };
  details: Array<{
    url: string;
    thisRegion: number;
    fastest: number;
    fastestRegion: string;
    diff: number;
  }>;
}

type AnalysisData =
  | DnsData
  | ConnectionData
  | TtfbData
  | DownloadData
  | RegionData;

const CATEGORY_ICONS = {
  dns: Globe,
  connection: Wifi,
  server: Server,
  payload: FileDown,
  caching: Server,
  cdn: Globe,
};

const CATEGORY_COLORS = {
  dns: {
    text: "text-cyan-400",
    bg: "bg-cyan-500/10",
    border: "border-cyan-500/30",
  },
  connection: {
    text: "text-orange-400",
    bg: "bg-orange-500/10",
    border: "border-orange-500/30",
  },
  server: {
    text: "text-blue-400",
    bg: "bg-blue-500/10",
    border: "border-blue-500/30",
  },
  payload: {
    text: "text-green-400",
    bg: "bg-green-500/10",
    border: "border-green-500/30",
  },
  caching: {
    text: "text-purple-400",
    bg: "bg-purple-500/10",
    border: "border-purple-500/30",
  },
  cdn: {
    text: "text-pink-400",
    bg: "bg-pink-500/10",
    border: "border-pink-500/30",
  },
};

const PRIORITY_STYLES = {
  high: {
    bg: "bg-red-500/20",
    text: "text-red-400",
    border: "border-red-500/30",
    label: "高",
  },
  medium: {
    bg: "bg-yellow-500/20",
    text: "text-yellow-400",
    border: "border-yellow-500/30",
    label: "中",
  },
  low: {
    bg: "bg-blue-500/20",
    text: "text-blue-400",
    border: "border-blue-500/30",
    label: "低",
  },
};

export function Recommendations({ recommendations }: RecommendationsProps) {
  if (recommendations.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-zinc-500">
        <CheckCircle className="w-16 h-16 mb-4 text-green-500" />
        <p className="text-xl font-medium text-zinc-200">效能良好！</p>
        <p className="text-sm mt-2 text-zinc-400">沒有發現明顯的效能問題</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* 摘要統計 */}
      <div className="grid grid-cols-3 gap-4">
        <StatCard
          label="發現問題"
          value={recommendations.length}
          icon={<AlertCircle className="w-5 h-5 text-red-400" />}
        />
        <StatCard
          label="高優先"
          value={recommendations.filter((r) => r.priority === "high").length}
          icon={<TrendingUp className="w-5 h-5 text-red-400" />}
          highlight
        />
        <StatCard
          label="影響地區"
          value={
            [...new Set(recommendations.flatMap((r) => r.affectedRegions))]
              .length
          }
          icon={<Globe className="w-5 h-5 text-blue-400" />}
        />
      </div>

      {/* 詳細建議 */}
      <div className="space-y-4">
        {recommendations.map((rec, index) => (
          <RecommendationCard key={index} recommendation={rec} index={index} />
        ))}
      </div>
    </div>
  );
}

function StatCard({
  label,
  value,
  icon,
  highlight = false,
}: {
  label: string;
  value: number;
  icon: React.ReactNode;
  highlight?: boolean;
}) {
  return (
    <Card
      className={`${
        highlight && value > 0
          ? "border-red-500/50 bg-red-500/5"
          : "bg-zinc-900/50"
      }`}
    >
      <CardContent className="p-4 flex items-center gap-4">
        <div className="p-2 rounded-lg bg-zinc-800">{icon}</div>
        <div>
          <p className="text-2xl font-bold">{value}</p>
          <p className="text-xs text-zinc-500">{label}</p>
        </div>
      </CardContent>
    </Card>
  );
}

function RecommendationCard({
  recommendation,
  index,
}: {
  recommendation: Recommendation;
  index: number;
}) {
  const [copied, setCopied] = useState<string | null>(null);
  const Icon = CATEGORY_ICONS[recommendation.category];
  const colors = CATEGORY_COLORS[recommendation.category];
  const priority = PRIORITY_STYLES[recommendation.priority];

  // 解析 JSON description
  const data = useMemo<AnalysisData | null>(() => {
    try {
      return JSON.parse(recommendation.description);
    } catch {
      return null;
    }
  }, [recommendation.description]);

  const handleCopy = async (url: string) => {
    await navigator.clipboard.writeText(url);
    setCopied(url);
    setTimeout(() => setCopied(null), 2000);
  };

  if (!data) return null;

  return (
    <Card className={`${colors.bg} ${colors.border} border`}>
      <CardHeader className="pb-2">
        <div className="flex items-start gap-4">
          <div className="flex items-center gap-3">
            <span className="flex items-center justify-center w-8 h-8 rounded-full bg-zinc-800 text-sm font-bold">
              {index + 1}
            </span>
            <div className={`p-2.5 rounded-xl bg-zinc-800`}>
              <Icon className={`w-5 h-5 ${colors.text}`} />
            </div>
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-3 mb-1">
              <CardTitle className="text-base font-semibold">
                {recommendation.title}
              </CardTitle>
              <Badge
                variant="outline"
                className={`${priority.bg} ${priority.text} ${priority.border} text-xs`}
              >
                {priority.label}優先
              </Badge>
            </div>
            <div className="flex items-center gap-2">
              {recommendation.affectedRegions.map((region) => (
                <Badge key={region} variant="secondary" className="text-xs">
                  {region}
                </Badge>
              ))}
            </div>
          </div>
        </div>
      </CardHeader>
      <CardContent className="pt-4">
        {/* 統計數據 */}
        <div className="grid grid-cols-3 gap-3 mb-4">
          {"count" in data.stats && (
            <MiniStat label="受影響請求" value={`${data.stats.count} 個`} />
          )}
          {"avgTime" in data.stats && (
            <MiniStat
              label="平均時間"
              value={formatTime(data.stats.avgTime)}
              warning={data.stats.avgTime > 500}
            />
          )}
          {"maxTime" in data.stats && (
            <MiniStat
              label="最長時間"
              value={formatTime(data.stats.maxTime)}
              warning={data.stats.maxTime > 1000}
            />
          )}
          {"slowCount" in data.stats && (
            <>
              <MiniStat
                label="慢速請求數"
                value={`${data.stats.slowCount} 個`}
                warning
              />
              <MiniStat
                label="平均延遲"
                value={`+${formatTime(data.stats.avgDiff)}`}
                warning
              />
            </>
          )}
        </div>

        {/* 詳細表格 */}
        <div className="rounded-lg border border-zinc-700 overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow className="bg-zinc-800/50 hover:bg-zinc-800/50">
                <TableHead className="text-xs">請求 URL</TableHead>
                <TableHead className="text-xs w-20">地區</TableHead>
                {data.type === "dns" && (
                  <TableHead className="text-xs w-24 text-right">DNS</TableHead>
                )}
                {data.type === "connection" && (
                  <>
                    <TableHead className="text-xs w-20 text-right">
                      TCP
                    </TableHead>
                    <TableHead className="text-xs w-20 text-right">
                      SSL
                    </TableHead>
                  </>
                )}
                {data.type === "ttfb" && (
                  <TableHead className="text-xs w-24 text-right">
                    TTFB
                  </TableHead>
                )}
                {data.type === "download" && (
                  <TableHead className="text-xs w-24 text-right">
                    下載
                  </TableHead>
                )}
                {data.type === "region" && (
                  <>
                    <TableHead className="text-xs w-24 text-right">
                      本地區
                    </TableHead>
                    <TableHead className="text-xs w-24 text-right">
                      最快地區
                    </TableHead>
                    <TableHead className="text-xs w-20 text-right">
                      差異
                    </TableHead>
                  </>
                )}
                <TableHead className="w-10"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.details.map((detail, i) => (
                <TableRow key={i} className="hover:bg-zinc-800/30">
                  <TableCell className="font-mono text-xs py-2">
                    <span title={detail.url} className="text-zinc-300">
                      {getShortUrl(detail.url, 45)}
                    </span>
                  </TableCell>
                  <TableCell className="text-xs py-2">
                    {"region" in detail && (
                      <Badge variant="outline" className="text-xs">
                        {detail.region}
                      </Badge>
                    )}
                  </TableCell>
                  {data.type === "dns" && (
                    <TableCell className="text-right py-2">
                      <TimeValue
                        value={(detail as DnsData["details"][0]).dns}
                        threshold={200}
                      />
                    </TableCell>
                  )}
                  {data.type === "connection" && (
                    <>
                      <TableCell className="text-right py-2">
                        <TimeValue
                          value={
                            (detail as ConnectionData["details"][0]).connect
                          }
                          threshold={300}
                        />
                      </TableCell>
                      <TableCell className="text-right py-2">
                        <TimeValue
                          value={(detail as ConnectionData["details"][0]).ssl}
                          threshold={200}
                        />
                      </TableCell>
                    </>
                  )}
                  {data.type === "ttfb" && (
                    <TableCell className="text-right py-2">
                      <TimeValue
                        value={(detail as TtfbData["details"][0]).ttfb}
                        threshold={1000}
                      />
                    </TableCell>
                  )}
                  {data.type === "download" && (
                    <TableCell className="text-right py-2">
                      <TimeValue
                        value={(detail as DownloadData["details"][0]).download}
                        threshold={2000}
                      />
                    </TableCell>
                  )}
                  {data.type === "region" && (
                    <>
                      <TableCell className="text-right py-2">
                        <TimeValue
                          value={
                            (detail as RegionData["details"][0]).thisRegion
                          }
                          threshold={1000}
                        />
                      </TableCell>
                      <TableCell className="text-right py-2 text-zinc-400">
                        <span className="text-green-400">
                          {formatTime(
                            (detail as RegionData["details"][0]).fastest
                          )}
                        </span>
                        <span className="text-zinc-500 text-xs ml-1">
                          ({(detail as RegionData["details"][0]).fastestRegion})
                        </span>
                      </TableCell>
                      <TableCell className="text-right py-2">
                        <span className="text-red-400 font-medium">
                          +
                          {formatTime(
                            (detail as RegionData["details"][0]).diff
                          )}
                        </span>
                      </TableCell>
                    </>
                  )}
                  <TableCell className="py-2">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7"
                      onClick={() => handleCopy(detail.url)}
                    >
                      {copied === detail.url ? (
                        <CheckCircle className="w-3.5 h-3.5 text-green-400" />
                      ) : (
                        <Copy className="w-3.5 h-3.5 text-zinc-500" />
                      )}
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>

        {/* 建議操作 */}
        <div className="mt-4 p-3 rounded-lg bg-zinc-800/30 border border-zinc-700/50">
          <p className="text-xs text-zinc-400 mb-2">💡 建議操作</p>
          <ul className="text-sm text-zinc-300 space-y-1">
            {data.type === "dns" && (
              <>
                <li>• 檢查是否可以合併多個 API 到同一個域名</li>
                <li>
                  • 加入{" "}
                  <code className="px-1 py-0.5 rounded bg-zinc-700 text-xs">
                    &lt;link rel=&quot;dns-prefetch&quot;
                    href=&quot;//domain.com&quot;&gt;
                  </code>
                </li>
              </>
            )}
            {data.type === "connection" && (
              <>
                <li>• 確認是否開啟 HTTP/2 或 HTTP/3</li>
                <li>
                  • 加入{" "}
                  <code className="px-1 py-0.5 rounded bg-zinc-700 text-xs">
                    &lt;link rel=&quot;preconnect&quot;
                    href=&quot;//domain.com&quot;&gt;
                  </code>
                </li>
              </>
            )}
            {data.type === "ttfb" && (
              <>
                <li>• 檢查這些 API 的後端效能，可能需要增加快取</li>
                <li>• 考慮使用 CDN 快取 API 回應</li>
              </>
            )}
            {data.type === "download" && (
              <>
                <li>• 確認伺服器有開啟 Gzip/Brotli 壓縮</li>
                <li>• 圖片考慮使用 WebP 格式</li>
              </>
            )}
            {data.type === "region" && (
              <>
                <li>• 檢查 {data.stats.region} 地區的 CDN 節點配置</li>
                <li>• 確認 DNS 解析是否指向正確的邊緣節點</li>
              </>
            )}
          </ul>
        </div>
      </CardContent>
    </Card>
  );
}

function MiniStat({
  label,
  value,
  warning = false,
}: {
  label: string;
  value: string;
  warning?: boolean;
}) {
  return (
    <div className="p-2 rounded bg-zinc-800/50">
      <p className="text-xs text-zinc-500">{label}</p>
      <p
        className={`text-sm font-medium ${
          warning ? "text-yellow-400" : "text-zinc-200"
        }`}
      >
        {value}
      </p>
    </div>
  );
}

function TimeValue({ value, threshold }: { value: number; threshold: number }) {
  const isWarning = value > threshold;
  return (
    <span
      className={`text-xs font-mono ${
        isWarning ? "text-red-400 font-medium" : "text-zinc-400"
      }`}
    >
      {formatTime(value)}
    </span>
  );
}
