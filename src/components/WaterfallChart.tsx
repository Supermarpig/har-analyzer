"use client";

import { useMemo } from "react";
import type { ParsedRequest } from "@/types/har";
import { formatTime, getShortUrl } from "@/lib/utils";

interface WaterfallChartProps {
  requests: ParsedRequest[];
  maxTime?: number;
}

const TIMING_COLORS = {
  blocked: "#94a3b8", // 灰色 - 阻塞
  dns: "#22d3ee", // 青色 - DNS
  connect: "#f97316", // 橘色 - TCP
  ssl: "#a855f7", // 紫色 - SSL
  send: "#22c55e", // 綠色 - 發送
  wait: "#3b82f6", // 藍色 - TTFB
  receive: "#84cc16", // 亮綠 - 下載
};

export function WaterfallChart({ requests, maxTime }: WaterfallChartProps) {
  const chartData = useMemo(() => {
    // 計算實際的最大結束時間（使用相對開始時間 + 請求時間）
    const endTimes = requests.map((r) => r.startTime + r.time);
    // 過濾掉異常大的值（可能是時間戳問題）
    const validEndTimes = endTimes.filter((t) => t < 3600000); // 小於 1 小時
    const totalTime =
      maxTime ||
      (validEndTimes.length > 0
        ? Math.max(...validEndTimes)
        : Math.max(...endTimes));

    return {
      totalTime,
      requests: requests.map((request) => ({
        ...request,
        // 確保 startTime 是相對時間，不是異常值
        normalizedStartTime: Math.min(request.startTime, totalTime),
        segments: calculateSegments(request, totalTime),
      })),
    };
  }, [requests, maxTime]);

  if (requests.length === 0) {
    return (
      <div className="flex items-center justify-center h-64 text-zinc-500">
        沒有請求數據
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* 圖例 */}
      <div className="flex flex-wrap gap-4 text-xs">
        {Object.entries(TIMING_COLORS).map(([key, color]) => (
          <div key={key} className="flex items-center gap-1.5">
            <div
              className="w-3 h-3 rounded-sm"
              style={{ backgroundColor: color }}
            />
            <span className="text-zinc-400">
              {key === "blocked" && "阻塞"}
              {key === "dns" && "DNS"}
              {key === "connect" && "TCP"}
              {key === "ssl" && "SSL"}
              {key === "send" && "發送"}
              {key === "wait" && "TTFB"}
              {key === "receive" && "下載"}
            </span>
          </div>
        ))}
      </div>

      {/* 時間軸 - 已移除，因為時間跨度問題 */}

      {/* 瀑布圖 */}
      <div className="space-y-1 max-h-[800px] overflow-y-auto">
        {chartData.requests.map((request) => (
          <div
            key={request.id}
            className="flex items-center gap-2 h-6 hover:bg-zinc-800/30 rounded group"
          >
            {/* URL */}
            <div
              className="w-[200px] shrink-0 text-xs font-mono truncate text-zinc-400 group-hover:text-zinc-200"
              title={request.url}
            >
              {getShortUrl(request.url, 35)}
            </div>

            {/* 時間條 */}
            <div className="flex-1 relative h-4 bg-zinc-800/30 rounded">
              {request.segments.map((segment, i) => (
                <div
                  key={i}
                  className="absolute h-full rounded-sm"
                  style={{
                    left: `${segment.start}%`,
                    width: `${Math.max(segment.width, 0.3)}%`,
                    backgroundColor: segment.color,
                  }}
                  title={`${segment.label}: ${formatTime(segment.duration)}`}
                />
              ))}
            </div>

            {/* 時間 */}
            <div
              className={`w-20 shrink-0 text-xs text-right font-mono ${
                request.severity === "critical"
                  ? "text-red-400"
                  : request.severity === "warning"
                  ? "text-yellow-400"
                  : "text-zinc-500"
              }`}
            >
              {formatTime(request.time)}
            </div>
          </div>
        ))}
      </div>

      <p className="text-xs text-zinc-500 text-center">
        共 {requests.length} 個請求
      </p>
    </div>
  );
}

function calculateSegments(
  request: ParsedRequest,
  totalTime: number
): Array<{
  start: number;
  width: number;
  color: string;
  label: string;
  duration: number;
}> {
  const segments: Array<{
    start: number;
    width: number;
    color: string;
    label: string;
    duration: number;
  }> = [];

  // 使用請求自身的時間來計算比例，而不是相對於總時間
  // 這樣每個請求的時間條都會顯示其自身的時間分解
  const requestTotalTime = request.time || 1;
  let currentOffset = 0;

  const toPercent = (ms: number) => (ms / requestTotalTime) * 100;
  const timings = request.timings;

  // 阻塞
  if (timings.blocked && timings.blocked > 0) {
    segments.push({
      start: currentOffset,
      width: toPercent(timings.blocked),
      color: TIMING_COLORS.blocked,
      label: "阻塞",
      duration: timings.blocked,
    });
    currentOffset += toPercent(timings.blocked);
  }

  // DNS
  if (timings.dns && timings.dns > 0) {
    segments.push({
      start: currentOffset,
      width: toPercent(timings.dns),
      color: TIMING_COLORS.dns,
      label: "DNS",
      duration: timings.dns,
    });
    currentOffset += toPercent(timings.dns);
  }

  // TCP Connect
  if (timings.connect && timings.connect > 0) {
    segments.push({
      start: currentOffset,
      width: toPercent(timings.connect),
      color: TIMING_COLORS.connect,
      label: "TCP",
      duration: timings.connect,
    });
    currentOffset += toPercent(timings.connect);
  }

  // SSL
  if (timings.ssl && timings.ssl > 0) {
    segments.push({
      start: currentOffset,
      width: toPercent(timings.ssl),
      color: TIMING_COLORS.ssl,
      label: "SSL",
      duration: timings.ssl,
    });
    currentOffset += toPercent(timings.ssl);
  }

  // Send
  if (timings.send > 0) {
    segments.push({
      start: currentOffset,
      width: toPercent(timings.send),
      color: TIMING_COLORS.send,
      label: "發送",
      duration: timings.send,
    });
    currentOffset += toPercent(timings.send);
  }

  // Wait (TTFB)
  if (timings.wait > 0) {
    segments.push({
      start: currentOffset,
      width: toPercent(timings.wait),
      color: TIMING_COLORS.wait,
      label: "TTFB",
      duration: timings.wait,
    });
    currentOffset += toPercent(timings.wait);
  }

  // Receive
  if (timings.receive > 0) {
    segments.push({
      start: currentOffset,
      width: toPercent(timings.receive),
      color: TIMING_COLORS.receive,
      label: "下載",
      duration: timings.receive,
    });
  }

  return segments;
}
