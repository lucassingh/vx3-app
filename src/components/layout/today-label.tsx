"use client";

import { useId, useSyncExternalStore } from "react";
import { InlineScript } from "@/components/inline-script";
import { siteConfig } from "@/config/site";

const options: Intl.DateTimeFormatOptions = {
  weekday: "long",
  day: "numeric",
  month: "long",
};

const subscribe = () => () => {};
const formatToday = () =>
  new Intl.DateTimeFormat(siteConfig.locale, options).format(new Date());

/**
 * Fecha de hoy en la zona horaria del usuario. El script inline la escribe
 * antes del primer paint; en navegaciones del cliente la calcula React.
 */
export function TodayLabel() {
  const id = useId();
  const today = useSyncExternalStore(subscribe, formatToday, () => "");

  return (
    <>
      <p id={id} suppressHydrationWarning className="min-h-5 first-letter:uppercase">
        {today}
      </p>
      <InlineScript
        html={`{var n=document.getElementById(${JSON.stringify(id)});if(n)n.textContent=new Intl.DateTimeFormat(${JSON.stringify(siteConfig.locale)},${JSON.stringify(options)}).format(new Date())}`}
      />
    </>
  );
}
