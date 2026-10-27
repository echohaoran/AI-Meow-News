export const PERIODS = [
  { id: "day", label: "近 1 天" },
  { id: "week", label: "近 7 天" },
  { id: "month", label: "近 30 天" },
  { id: "trending", label: "增长趋势" },
] as const;
export type Period = typeof PERIODS[number]["id"];

export const CATEGORIES = [
  { id: "text", label: "文本", unit: "tokens" },
  { id: "image", label: "图片", unit: "图片生成请求" },
  { id: "video", label: "视频", unit: "请求" },
  { id: "speech", label: "语音合成", unit: "请求" },
  { id: "decisions", label: "决策", unit: "请求" },
  { id: "embeddings", label: "向量嵌入", unit: "请求" },
  { id: "rerank", label: "重排", unit: "请求" },
  { id: "transcription", label: "语音转写", unit: "请求" },
  { id: "batch", label: "批处理", unit: "子请求" },
  { id: "benchmarks", label: "能力基准", unit: "分数" },
  { id: "apps", label: "应用", unit: "tokens" },
] as const;

export interface RankingEntry {
  rank: number;
  name: string;
  author: string;
  url: string | null;
  /** Preserve large token counts as decimal strings. */
  value: string;
  change: number | null;
}

export interface RankingBoard {
  id: string;
  category: string;
  title: string;
  period: Period | "benchmark";
  unit: string;
  sourceUrl: string;
  /** Latest upstream UTC usage bucket, separate from our fetch time. */
  asOf: string | null;
  fetchedAt: string;
  entries: RankingEntry[];
}

export interface RankingsSnapshot {
  checkedAt: string | null;
  boards: RankingBoard[];
  failures: Array<{ id: string; message: string }>;
}
