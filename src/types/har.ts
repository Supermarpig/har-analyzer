/**
 * HAR (HTTP Archive) 檔案格式型別定義
 * 參考: http://www.softwareishard.com/blog/har-12-spec/
 */

export interface HarFile {
  log: HarLog;
}

export interface HarLog {
  version: string;
  creator: HarCreator;
  browser?: HarBrowser;
  pages?: HarPage[];
  entries: HarEntry[];
}

export interface HarCreator {
  name: string;
  version: string;
}

export interface HarBrowser {
  name: string;
  version: string;
}

export interface HarPage {
  startedDateTime: string;
  id: string;
  title: string;
  pageTimings: HarPageTimings;
}

export interface HarPageTimings {
  onContentLoad?: number;
  onLoad?: number;
}

export interface HarEntry {
  startedDateTime: string;
  time: number;
  request: HarRequest;
  response: HarResponse;
  cache: HarCache;
  timings: HarTimings;
  serverIPAddress?: string;
  connection?: string;
  pageref?: string;
}

export interface HarRequest {
  method: string;
  url: string;
  httpVersion: string;
  cookies: HarCookie[];
  headers: HarHeader[];
  queryString: HarQueryString[];
  postData?: HarPostData;
  headersSize: number;
  bodySize: number;
}

export interface HarResponse {
  status: number;
  statusText: string;
  httpVersion: string;
  cookies: HarCookie[];
  headers: HarHeader[];
  content: HarContent;
  redirectURL: string;
  headersSize: number;
  bodySize: number;
}

export interface HarCookie {
  name: string;
  value: string;
  path?: string;
  domain?: string;
  expires?: string;
  httpOnly?: boolean;
  secure?: boolean;
}

export interface HarHeader {
  name: string;
  value: string;
}

export interface HarQueryString {
  name: string;
  value: string;
}

export interface HarPostData {
  mimeType: string;
  text?: string;
  params?: HarParam[];
}

export interface HarParam {
  name: string;
  value?: string;
  fileName?: string;
  contentType?: string;
}

export interface HarContent {
  size: number;
  compression?: number;
  mimeType: string;
  text?: string;
  encoding?: string;
}

export interface HarCache {
  beforeRequest?: HarCacheEntry;
  afterRequest?: HarCacheEntry;
}

export interface HarCacheEntry {
  expires?: string;
  lastAccess: string;
  eTag: string;
  hitCount: number;
}

/**
 * HAR 時間細分 - 這是分析效能瓶頸的關鍵
 * 所有時間單位為毫秒
 */
export interface HarTimings {
  blocked?: number; // 排隊等待時間
  dns?: number; // DNS 查詢時間
  connect?: number; // TCP 連線時間
  ssl?: number; // SSL/TLS 握手時間
  send: number; // 發送請求時間
  wait: number; // 等待回應時間 (TTFB)
  receive: number; // 接收回應時間
}

// ============ 分析結果型別 ============

export type RequestType =
  | "document"
  | "xhr"
  | "fetch"
  | "script"
  | "stylesheet"
  | "image"
  | "font"
  | "media"
  | "other";

export type SeverityLevel = "normal" | "warning" | "critical";

export interface ParsedRequest {
  id: string;
  url: string;
  method: string;
  status: number;
  type: RequestType;
  size: number;
  time: number;
  timings: HarTimings;
  startTime: number; // 相對於第一個請求的開始時間
  severity: SeverityLevel;
  issues: string[];
}

export interface RegionData {
  name: string;
  fileName: string;
  requests: ParsedRequest[];
  totalTime: number;
  totalSize: number;
  requestCount: number;
  slowRequests: number;
  issues: AnalysisIssue[];
}

export interface AnalysisIssue {
  type:
    | "slow_dns"
    | "slow_connect"
    | "slow_ssl"
    | "slow_ttfb"
    | "slow_download"
    | "large_payload"
    | "blocking";
  severity: SeverityLevel;
  message: string;
  url: string;
  value: number;
  threshold: number;
}

export interface ComparisonResult {
  url: string;
  regions: {
    name: string;
    time: number;
    timings: HarTimings;
  }[];
  maxDiff: number; // 最大地區差異
  slowestRegion: string;
  fastestRegion: string;
}

export interface AnalysisResult {
  regions: RegionData[];
  comparisons: ComparisonResult[];
  recommendations: Recommendation[];
}

export interface Recommendation {
  priority: "high" | "medium" | "low";
  category: "dns" | "connection" | "server" | "payload" | "caching" | "cdn";
  title: string;
  description: string;
  affectedUrls: string[];
  affectedRegions: string[];
}
