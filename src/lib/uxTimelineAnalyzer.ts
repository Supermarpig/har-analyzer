import type {
  ParsedRequest,
  RegionData,
  Milestone,
  BlockingResource,
  ApiChain,
  ApiChainNode,
  WaitingPeriod,
  UXTimelineResult,
} from "@/types/har";

/**
 * 閾值設定
 */
const UX_THRESHOLDS = {
  apiGapThreshold: 50,
  blockingTimeWarning: 200,
  blockingTimeCritical: 500,
  waitingPeriodMin: 100,
};

/**
 * 分析使用者體驗時間軸
 */
export function analyzeUXTimeline(region: RegionData): UXTimelineResult {
  const { requests } = region;

  const milestones = identifyMilestones(requests);
  const blockingResources = identifyBlockingResources(requests);
  const apiChains = analyzeApiChains(requests);
  const waitingPeriods = identifyWaitingPeriods(requests, blockingResources);
  const summary = calculateSummary(
    milestones,
    blockingResources,
    apiChains,
    requests
  );

  return {
    milestones,
    blockingResources,
    apiChains,
    waitingPeriods,
    summary,
  };
}

/**
 * 識別關鍵里程碑
 */
function identifyMilestones(requests: ParsedRequest[]): Milestone[] {
  const milestones: Milestone[] = [];

  // 1. 首個 HTML 載入完成
  const htmlRequest = requests.find((r) => r.type === "document");
  if (htmlRequest) {
    milestones.push({
      type: "html_loaded",
      label: "HTML 載入完成",
      time: htmlRequest.startTime + htmlRequest.time,
      requests: [htmlRequest],
      description: `主文件 ${Math.round(htmlRequest.time)}ms 載入完成`,
    });
  }

  // 2. 阻塞渲染資源完成時間
  const htmlEndTime = htmlRequest
    ? htmlRequest.startTime + htmlRequest.time
    : 0;
  const renderBlockingResources = requests.filter(
    (r) =>
      (r.type === "script" || r.type === "stylesheet") &&
      r.startTime <= htmlEndTime + 100
  );
  if (renderBlockingResources.length > 0) {
    const lastBlockingTime = Math.max(
      ...renderBlockingResources.map((r) => r.startTime + r.time)
    );
    milestones.push({
      type: "render_blocking_done",
      label: "渲染阻塞資源完成",
      time: lastBlockingTime,
      requests: renderBlockingResources,
      description: `${renderBlockingResources.length} 個阻塞資源載入完成`,
    });
  }

  // 3. 首個 API 回應時間
  const apiRequests = requests.filter(
    (r) => r.type === "xhr" || r.type === "fetch"
  );
  if (apiRequests.length > 0) {
    const firstApi = apiRequests.reduce((earliest, current) =>
      current.startTime + current.time < earliest.startTime + earliest.time
        ? current
        : earliest
    );
    milestones.push({
      type: "first_api_response",
      label: "首個 API 回應",
      time: firstApi.startTime + firstApi.time,
      requests: [firstApi],
      description: `首個資料請求 ${Math.round(firstApi.time)}ms 完成`,
    });
  }

  // 4. 最後一個關鍵資源完成時間
  const criticalResources = requests.filter(
    (r) =>
      r.type === "document" ||
      r.type === "script" ||
      r.type === "stylesheet" ||
      r.type === "xhr" ||
      r.type === "fetch"
  );
  if (criticalResources.length > 0) {
    const lastCriticalTime = Math.max(
      ...criticalResources.map((r) => r.startTime + r.time)
    );
    const lastCritical = criticalResources.find(
      (r) => r.startTime + r.time === lastCriticalTime
    );
    milestones.push({
      type: "critical_resources_done",
      label: "關鍵資源完成",
      time: lastCriticalTime,
      requests: lastCritical ? [lastCritical] : [],
      description: `所有關鍵資源載入完成`,
    });
  }

  return milestones.sort((a, b) => a.time - b.time);
}

/**
 * 識別阻塞資源
 */
function identifyBlockingResources(
  requests: ParsedRequest[]
): BlockingResource[] {
  const blockingResources: BlockingResource[] = [];
  const htmlRequest = requests.find((r) => r.type === "document");
  const htmlEndTime = htmlRequest
    ? htmlRequest.startTime + htmlRequest.time
    : 0;

  const potentialBlocking = requests.filter(
    (r) =>
      (r.type === "script" || r.type === "stylesheet") &&
      r.startTime <= htmlEndTime + 50
  );

  for (const request of potentialBlocking) {
    const blockingDuration = request.time;
    const isInHead = request.startTime <= htmlEndTime;

    let impact: "high" | "medium" | "low";
    if (blockingDuration >= UX_THRESHOLDS.blockingTimeCritical) {
      impact = "high";
    } else if (blockingDuration >= UX_THRESHOLDS.blockingTimeWarning) {
      impact = "medium";
    } else {
      impact = "low";
    }

    blockingResources.push({
      request,
      blockingType: request.type as "script" | "stylesheet",
      isInHead,
      blockingDuration,
      impact,
    });
  }

  return blockingResources.sort(
    (a, b) => b.blockingDuration - a.blockingDuration
  );
}

/**
 * 分析 API 調用鏈
 */
function analyzeApiChains(requests: ParsedRequest[]): ApiChain[] {
  const apiRequests = requests
    .filter((r) => r.type === "xhr" || r.type === "fetch")
    .sort((a, b) => a.startTime - b.startTime);

  if (apiRequests.length === 0) return [];

  const chains: ApiChain[] = [];
  const visited = new Set<string>();

  for (const request of apiRequests) {
    if (visited.has(request.id)) continue;

    const chain = buildChain(request, apiRequests, visited);
    if (chain.nodes.length > 1) {
      chains.push(chain);
    }
  }

  return chains.sort((a, b) => b.totalDuration - a.totalDuration);
}

/**
 * 建構依賴鏈
 */
function buildChain(
  startRequest: ParsedRequest,
  allApiRequests: ParsedRequest[],
  visited: Set<string>
): ApiChain {
  const nodes: ApiChainNode[] = [];
  let currentRequest: ParsedRequest | undefined = startRequest;
  let prevId: string | null = null;

  while (currentRequest && !visited.has(currentRequest.id)) {
    visited.add(currentRequest.id);

    const node: ApiChainNode = {
      request: currentRequest,
      startTime: currentRequest.startTime,
      endTime: currentRequest.startTime + currentRequest.time,
      dependsOn: prevId,
    };
    nodes.push(node);
    prevId = currentRequest.id;

    const currentEndTime = currentRequest.startTime + currentRequest.time;
    currentRequest = allApiRequests.find(
      (r) =>
        !visited.has(r.id) &&
        r.startTime >= currentEndTime &&
        r.startTime <= currentEndTime + UX_THRESHOLDS.apiGapThreshold
    );
  }

  const totalDuration =
    nodes.length > 0 ? nodes[nodes.length - 1].endTime - nodes[0].startTime : 0;

  const bottleneck = nodes.reduce(
    (slowest, node) =>
      node.request.time > slowest.request.time ? node : slowest,
    nodes[0]
  );

  return {
    id: `chain-${startRequest.id}`,
    nodes,
    totalDuration,
    chainLength: nodes.length,
    bottleneck,
  };
}

/**
 * 識別使用者等待區間
 */
function identifyWaitingPeriods(
  requests: ParsedRequest[],
  blockingResources: BlockingResource[]
): WaitingPeriod[] {
  const periods: WaitingPeriod[] = [];

  for (const blocking of blockingResources) {
    if (blocking.blockingDuration >= UX_THRESHOLDS.waitingPeriodMin) {
      periods.push({
        startTime: blocking.request.startTime,
        endTime: blocking.request.startTime + blocking.request.time,
        duration: blocking.blockingDuration,
        reason: `${blocking.blockingType === "script" ? "JavaScript" : "CSS"} 阻塞渲染`,
        relatedRequests: [blocking.request],
        severity:
          blocking.impact === "high"
            ? "critical"
            : blocking.impact === "medium"
              ? "warning"
              : "normal",
      });
    }
  }

  const slowApis = requests.filter(
    (r) => (r.type === "xhr" || r.type === "fetch") && r.time > 500
  );
  for (const api of slowApis) {
    periods.push({
      startTime: api.startTime,
      endTime: api.startTime + api.time,
      duration: api.time,
      reason: "API 回應緩慢",
      relatedRequests: [api],
      severity: api.severity,
    });
  }

  return periods.sort((a, b) => b.duration - a.duration);
}

/**
 * 計算摘要
 */
function calculateSummary(
  milestones: Milestone[],
  blockingResources: BlockingResource[],
  apiChains: ApiChain[],
  requests: ParsedRequest[]
) {
  // 找出最早的請求時間作為基準
  const baseTime =
    requests.length > 0
      ? Math.min(...requests.map((r) => r.startTime))
      : 0;

  const renderBlockingMilestone = milestones.find(
    (m) => m.type === "render_blocking_done"
  );
  const criticalMilestone = milestones.find(
    (m) => m.type === "critical_resources_done"
  );

  // 將絕對時間轉換為相對時間
  const timeToFirstPaint = renderBlockingMilestone
    ? renderBlockingMilestone.time - baseTime
    : 0;
  const timeToInteractive = criticalMilestone
    ? criticalMilestone.time - baseTime
    : 0;

  const totalBlockingTime = blockingResources.reduce(
    (sum, r) => sum + r.blockingDuration,
    0
  );

  const longestApiChain =
    apiChains.length > 0
      ? Math.max(...apiChains.map((c) => c.totalDuration))
      : 0;

  const criticalPath = requests
    .filter(
      (r) =>
        r.type === "document" || r.type === "script" || r.type === "stylesheet"
    )
    .sort((a, b) => a.startTime - b.startTime);

  return {
    timeToFirstPaint,
    timeToInteractive,
    totalBlockingTime,
    longestApiChain,
    criticalPath,
  };
}
