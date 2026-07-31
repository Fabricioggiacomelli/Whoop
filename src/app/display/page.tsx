import type { Metadata } from "next";

import { getDisplayData } from "@/server/services/display.service";

import { DisplayCarousel } from "./display-carousel";

export const metadata: Metadata = { title: "Telão" };

export default async function DisplayPage() {
  const data = await getDisplayData();
  return <DisplayCarousel initialData={data} />;
}
