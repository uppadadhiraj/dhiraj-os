import { Os } from "@/components/os/Os";
import { SeoOutline } from "@/components/SeoOutline";
import { computeStats } from "@/lib/github-stats";

export default function Home() {
  return (
    <>
      <Os stats={computeStats()} />
      <SeoOutline />
    </>
  );
}
