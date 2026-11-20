import { GlassCard, MoreLink } from "@/components/layout/Glass";
import { useHeadlines } from "@/features/news/api";
import { HeadlineThumb } from "@/features/news/components/HeadlineThumb";
import { useAgo } from "@/features/news/useAgo";
import { useI18n } from "@/lib/i18n/context";

export function NewsCard() {
  const { t, locale } = useI18n();
  const ago = useAgo();
  const headlines = useHeadlines(locale, 8).data ?? [];
  if (headlines.length === 0) return null;
  const [lead, ...rest] = headlines;
  return (
    <GlassCard
      id="home-news"
      title={t("news.latest")}
      className="xl:col-span-2"
      action={<MoreLink to="/news">{t("news.all")}</MoreLink>}
    >
      <div className="grid gap-4 p-4 pt-2 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)]">
        {lead && (
          <a
            href={lead.url}
            target="_blank"
            rel="noopener noreferrer"
            className="group relative flex min-h-80 flex-col justify-end self-stretch overflow-hidden rounded-2xl"
          >
            <HeadlineThumb headline={lead} className="absolute inset-0 size-full" eager />
            <span
              aria-hidden="true"
              className="absolute inset-0 bg-gradient-to-t from-black via-black/50 to-transparent"
            />
            <span className="relative flex flex-col gap-2 p-5 text-white">
              <span className="w-fit rounded-md bg-white/15 px-2 py-0.5 text-xs font-bold backdrop-blur">
                {lead.source_name} · {ago(lead.published_at)}
              </span>
              <span className="display text-2xl leading-tight group-hover:underline">
                {lead.title}
                <span className="sr-only"> {t("news.opensNew")}</span>
              </span>
            </span>
          </a>
        )}
        <ul className="flex flex-col">
          {rest.slice(0, 5).map((h) => (
            <li key={h.url} className="border-t border-line first:border-0">
              <a
                href={h.url}
                target="_blank"
                rel="noopener noreferrer"
                className="group flex items-center gap-4 py-3"
              >
                <HeadlineThumb headline={h} className="h-16 w-24 shrink-0 rounded-xl" />
                <span className="flex min-w-0 flex-1 flex-col gap-1">
                  <span className="line-clamp-2 leading-snug font-bold group-hover:underline">
                    {h.title}
                    <span className="sr-only"> {t("news.opensNew")}</span>
                  </span>
                  <span className="text-xs font-medium text-muted">
                    {h.source_name} · {ago(h.published_at)}
                  </span>
                </span>
              </a>
            </li>
          ))}
        </ul>
      </div>
    </GlassCard>
  );
}
