"use client";

import type { Milestone, MilestoneType } from "@/types/har";
import { formatTime } from "@/lib/utils";

interface MilestoneMarkerProps {
  milestones: Milestone[];
  totalTime: number;
  colors: Record<MilestoneType, string>;
}

const MILESTONE_LABELS: Record<MilestoneType, string> = {
  html_loaded: "HTML",
  render_blocking_done: "阻塞完成",
  first_api_response: "首個 API",
  critical_resources_done: "關鍵資源",
};

export function MilestoneMarker({
  milestones,
  totalTime,
  colors,
}: MilestoneMarkerProps) {
  if (milestones.length === 0) {
    return (
      <div className="text-center text-zinc-500 py-8">沒有可顯示的里程碑</div>
    );
  }

  return (
    <div className="space-y-4">
      {/* 時間軸 */}
      <div className="relative h-12 bg-zinc-800 rounded-lg overflow-hidden">
        {/* 進度填充 */}
        <div className="absolute inset-0 flex">
          {milestones.map((milestone, i) => {
            const prevTime = i > 0 ? milestones[i - 1].time : 0;
            const width = ((milestone.time - prevTime) / totalTime) * 100;
            const color = colors[milestone.type];

            return (
              <div
                key={i}
                className="h-full opacity-20"
                style={{
                  width: `${width}%`,
                  backgroundColor: color,
                }}
              />
            );
          })}
        </div>

        {/* 里程碑標記 */}
        {milestones.map((milestone, i) => {
          const position = (milestone.time / totalTime) * 100;
          const color = colors[milestone.type];

          return (
            <div
              key={i}
              className="absolute top-0 bottom-0 flex flex-col items-center"
              style={{ left: `${Math.min(position, 98)}%` }}
            >
              <div
                className="w-0.5 h-full opacity-70"
                style={{ backgroundColor: color }}
              />
              <div
                className="absolute -top-1 w-3 h-3 rounded-full border-2 border-zinc-900"
                style={{ backgroundColor: color }}
              />
            </div>
          );
        })}
      </div>

      {/* 圖例 */}
      <div className="flex flex-wrap gap-4 text-xs">
        {milestones.map((milestone, i) => (
          <div key={i} className="flex items-center gap-2">
            <div
              className="w-3 h-3 rounded-full"
              style={{ backgroundColor: colors[milestone.type] }}
            />
            <span className="text-zinc-400">
              {MILESTONE_LABELS[milestone.type]}
            </span>
            <span className="text-zinc-500">{formatTime(milestone.time)}</span>
          </div>
        ))}
      </div>

      {/* 詳細說明 */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-4">
        {milestones.map((milestone, i) => (
          <div
            key={i}
            className="p-3 rounded-lg bg-zinc-800/50 border-l-2"
            style={{ borderColor: colors[milestone.type] }}
          >
            <div className="flex items-center justify-between mb-1">
              <span className="text-sm font-medium">{milestone.label}</span>
              <span
                className="text-sm font-mono"
                style={{ color: colors[milestone.type] }}
              >
                {formatTime(milestone.time)}
              </span>
            </div>
            <p className="text-xs text-zinc-500">{milestone.description}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
