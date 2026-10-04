"use client";

import { useLocale, useTranslations } from "next-intl";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { PlayIcon } from "lucide-react";

import { cn } from "~/lib/utils";
import { ExternalLink } from "./external-link";
import { youtubeId } from "./youtube";

/**
 * VideoEmbed — a privacy-friendly YouTube player. Nothing loads from YouTube
 * until the person presses „Odtwórz film" (the thumbnail is proxied through
 * next/image); then a youtube-nocookie iframe with Polish captions takes its
 * place and receives focus. A plain „Obejrzyj na YouTube" link is always
 * shown. Unknown URLs degrade to the link alone.
 *
 * @param url    Any YouTube URL.
 * @param title  The video's subject — used in the button label and iframe title.
 */
export function VideoEmbed({
  url,
  title,
  className,
}: {
  url: string;
  title: string;
  className?: string;
}) {
  const t = useTranslations("common.kit.video");
  const locale = useLocale();
  const id = youtubeId(url);
  const [playing, setPlaying] = useState(false);
  const frame = useRef<HTMLIFrameElement>(null);

  useEffect(() => {
    if (playing) frame.current?.focus();
  }, [playing]);

  return (
    <div data-slot="video-embed" className={cn("w-full", className)}>
      {id ? (
        <div className="border-hairline bg-foreground relative aspect-video w-full overflow-hidden rounded-lg border">
          {playing ? (
            <iframe
              ref={frame}
              src={`https://www.youtube-nocookie.com/embed/${id}?autoplay=1&rel=0&hl=${locale}&cc_lang_pref=${locale}&cc_load_policy=1`}
              title={t("frameTitle", { title })}
              allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
              allowFullScreen
              referrerPolicy="strict-origin-when-cross-origin"
              className="absolute inset-0 size-full"
            />
          ) : (
            <button
              type="button"
              onClick={() => setPlaying(true)}
              aria-label={t("playLabel", { title })}
              className="group absolute inset-0 flex size-full items-end text-left"
            >
              <Image
                src={`https://i.ytimg.com/vi/${id}/hqdefault.jpg`}
                alt=""
                fill
                sizes="(min-width: 1024px) 720px, 100vw"
                className="object-cover"
              />
              <span className="bg-background text-foreground relative m-3 inline-flex min-h-12 items-center gap-3 rounded-md py-2 pr-5 pl-2 font-semibold md:m-4">
                <span className="bg-primary text-primary-foreground flex size-10 shrink-0 items-center justify-center rounded-full transition-transform group-hover:scale-105">
                  <PlayIcon
                    aria-hidden="true"
                    className="ml-0.5 size-5 fill-current"
                  />
                </span>
                {t("play")}
              </span>
            </button>
          )}
        </div>
      ) : null}
      <p className="mt-2 text-[0.9375rem]">
        <ExternalLink
          href={url}
          className="text-foreground inline-flex min-h-11 items-center"
        >
          {t("watch")}
        </ExternalLink>
        {id && !playing ? (
          <span className="text-muted-foreground">
            {" "}
            · {t("loadsOnClick")}
          </span>
        ) : null}
      </p>
    </div>
  );
}
