export type KpiTrend = 'up' | 'down';

export type KpiStat = {
  id: string;
  label: string;
  value: string;
  trendLabel: string;
  trend: KpiTrend;
  icon: string;
  iconWrapClass: string;
};
