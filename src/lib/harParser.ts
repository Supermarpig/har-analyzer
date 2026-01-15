import type {
  HarFile,
  HarEntry,
  HarTimings,
  ParsedRequest,
  RequestType,
  SeverityLevel,
  RegionData,
} from "@/types/har";

/**
 * 效能閾值設定（毫秒）
 */
const THRESHOLDS = {
  // API 請求（xhr/fetch）
  api: { warning: 500, critical: 1000 },
  // 靜態資源
  script: { warning: 500, critical: 1500 },
  stylesheet: { warning: 500, critical: 1500 },
  image: { warning: 1000, critical: 3000 },
  font: { warning: 500, critical: 1500 },
  // 文件
  document: { warning: 1000, critical: 3000 },
  // 其他
  other: { warning: 1000, critical: 3000 },
  // 各階段時間閾值
  dns: { warning: 100, critical: 300 },
  connect: { warning: 200, critical: 500 },
  ssl: { warning: 200, critical: 500 },
  ttfb: { warning: 500, critical: 1500 },
  download: { warning: 1000, critical: 3000 },
};

/**
 * 根據 MIME type 或 URL 判斷請求類型
 */
function getRequestType(entry: HarEntry): RequestType {
  const mimeType = entry.response.content.mimeType?.toLowerCase() || "";
  const url = entry.request.url.toLowerCase();

  // 根據請求發起方式判斷
  const initiatorType = entry.request.headers
    .find((h) => h.name.toLowerCase() === "x-requested-with")
    ?.value?.toLowerCase();

  if (initiatorType === "xmlhttprequest") return "xhr";

  // 根據 Content-Type 判斷
  if (mimeType.includes("json") || mimeType.includes("xml")) return "fetch";
  if (mimeType.includes("html")) return "document";
  if (mimeType.includes("javascript") || url.endsWith(".js")) return "script";
  if (mimeType.includes("css") || url.endsWith(".css")) return "stylesheet";
  if (
    mimeType.includes("image") ||
    /\.(png|jpg|jpeg|gif|svg|webp|ico)/.test(url)
  )
    return "image";
  if (mimeType.includes("font") || /\.(woff|woff2|ttf|otf|eot)/.test(url))
    return "font";
  if (mimeType.includes("video") || mimeType.includes("audio")) return "media";

  return "other";
}

/**
 * 判斷請求嚴重程度
 */
function getSeverity(time: number, type: RequestType): SeverityLevel {
  const thresholdKey = type === "xhr" || type === "fetch" ? "api" : type;
  const threshold =
    THRESHOLDS[thresholdKey as keyof typeof THRESHOLDS] || THRESHOLDS.other;

  if ("warning" in threshold && "critical" in threshold) {
    if (time >= threshold.critical) return "critical";
    if (time >= threshold.warning) return "warning";
  }
  return "normal";
}

/**
 * 分析單一請求的問題
 */
function analyzeRequestIssues(timings: HarTimings): string[] {
  const issues: string[] = [];

  if (timings.dns && timings.dns >= THRESHOLDS.dns.warning) {
    issues.push(`DNS 查詢過慢 (${Math.round(timings.dns)}ms)`);
  }
  if (timings.connect && timings.connect >= THRESHOLDS.connect.warning) {
    issues.push(`TCP 連線過慢 (${Math.round(timings.connect)}ms)`);
  }
  if (timings.ssl && timings.ssl >= THRESHOLDS.ssl.warning) {
    issues.push(`SSL 握手過慢 (${Math.round(timings.ssl)}ms)`);
  }
  if (timings.wait >= THRESHOLDS.ttfb.warning) {
    issues.push(`伺服器回應過慢 TTFB (${Math.round(timings.wait)}ms)`);
  }
  if (timings.receive >= THRESHOLDS.download.warning) {
    issues.push(`下載時間過長 (${Math.round(timings.receive)}ms)`);
  }
  if (timings.blocked && timings.blocked > 100) {
    issues.push(`請求被阻塞 (${Math.round(timings.blocked)}ms)`);
  }

  return issues;
}

/**
 * 解析 HAR 檔案內容
 */
export function parseHarFile(
  content: string,
  regionName: string,
  fileName: string
): RegionData {
  const har: HarFile = JSON.parse(content);
  const entries = har.log.entries;

  if (!entries || entries.length === 0) {
    throw new Error("HAR 檔案中沒有請求記錄");
  }

  // 計算基準時間（第一個請求的開始時間）
  const baseTime = new Date(entries[0].startedDateTime).getTime();

  const requests: ParsedRequest[] = entries.map((entry, index) => {
    const type = getRequestType(entry);
    const time = entry.time;
    const severity = getSeverity(time, type);
    const timings = normalizeTimings(entry.timings);

    return {
      id: `${regionName}-${index}`,
      url: entry.request.url,
      method: entry.request.method,
      status: entry.response.status,
      type,
      size:
        entry.response.bodySize > 0
          ? entry.response.bodySize
          : entry.response.content.size,
      time,
      timings,
      startTime: new Date(entry.startedDateTime).getTime() - baseTime,
      severity,
      issues: analyzeRequestIssues(timings),
    };
  });

  // 統計資料
  const slowRequests = requests.filter((r) => r.severity !== "normal").length;
  const totalTime = Math.max(...requests.map((r) => r.startTime + r.time));
  const totalSize = requests.reduce(
    (sum, r) => sum + (r.size > 0 ? r.size : 0),
    0
  );

  // 收集所有問題
  const issues = requests
    .filter((r) => r.issues.length > 0)
    .flatMap((r) =>
      r.issues.map((issue) => ({
        type: categorizeIssue(issue),
        severity: r.severity,
        message: issue,
        url: r.url,
        value: r.time,
        threshold: 0,
      }))
    );

  return {
    name: regionName,
    fileName,
    requests,
    totalTime,
    totalSize,
    requestCount: requests.length,
    slowRequests,
    issues,
  };
}

/**
 * 正規化時間數據（處理 -1 或 undefined 的情況）
 */
function normalizeTimings(timings: HarTimings): HarTimings {
  return {
    blocked: timings.blocked && timings.blocked > 0 ? timings.blocked : 0,
    dns: timings.dns && timings.dns > 0 ? timings.dns : 0,
    connect: timings.connect && timings.connect > 0 ? timings.connect : 0,
    ssl: timings.ssl && timings.ssl > 0 ? timings.ssl : 0,
    send: timings.send > 0 ? timings.send : 0,
    wait: timings.wait > 0 ? timings.wait : 0,
    receive: timings.receive > 0 ? timings.receive : 0,
  };
}

/**
 * 將問題訊息分類
 */
function categorizeIssue(
  issue: string
):
  | "slow_dns"
  | "slow_connect"
  | "slow_ssl"
  | "slow_ttfb"
  | "slow_download"
  | "large_payload"
  | "blocking" {
  if (issue.includes("DNS")) return "slow_dns";
  if (issue.includes("TCP")) return "slow_connect";
  if (issue.includes("SSL")) return "slow_ssl";
  if (issue.includes("TTFB")) return "slow_ttfb";
  if (issue.includes("下載")) return "slow_download";
  if (issue.includes("阻塞")) return "blocking";
  return "large_payload";
}

/**
 * 取得效能閾值設定（供 UI 顯示使用）
 */
export function getThresholds() {
  return THRESHOLDS;
}
