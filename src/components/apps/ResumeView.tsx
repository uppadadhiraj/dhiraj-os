import { resume } from "@/data/resume";

/** The résumé document. Pure markup (no hooks) so it renders in the OS window, the print page and the PDF. */
export function ResumeView({ print = false }: { print?: boolean }) {
  const h2 = "mb-1 mt-4 border-b border-neutral-400 pb-0.5 font-[family-name:var(--font-pixel)] text-[15px] uppercase tracking-wider text-[#0a1f7a]";
  return (
    <article
      className={print ? "mx-auto max-w-[800px] bg-white p-8 text-[12.5px] leading-[1.45] text-neutral-900" : "bg-white p-6 text-[13px] leading-[1.5] text-neutral-900"}
      aria-label="Résumé"
    >
      <header>
        <h1 className="m-0 font-[family-name:var(--font-pixel)] text-[26px] leading-tight tracking-wide text-[#0a1f7a]">{resume.name}</h1>
        <p className="m-0 font-medium">{resume.headline}</p>
        <p className="m-0 text-neutral-700">{resume.contact.join("  ·  ")}</p>
      </header>

      <section aria-labelledby="r-sum">
        <h2 id="r-sum" className={h2}>Summary</h2>
        <p className="m-0">{resume.summary}</p>
      </section>

      <section aria-labelledby="r-edu">
        <h2 id="r-edu" className={h2}>Education</h2>
        {resume.education.map((e) => (
          <p key={e.title} className="m-0 flex flex-wrap justify-between gap-x-4">
            <span>
              <b>{e.title}</b> — {e.place}
            </span>
            <span className="text-neutral-700">{e.years}</span>
          </p>
        ))}
      </section>

      <section aria-labelledby="r-skills">
        <h2 id="r-skills" className={h2}>Skills</h2>
        <ul className="m-0 list-none p-0">
          {resume.skills.map((s) => (
            <li key={s.label}>
              <b>{s.label}:</b> {s.items}
            </li>
          ))}
        </ul>
      </section>

      <section aria-labelledby="r-proj">
        <h2 id="r-proj" className={h2}>Projects</h2>
        {resume.projects.map((p) => (
          <div key={p.name} className="mb-2" style={{ breakInside: "avoid" }}>
            <p className="m-0 font-semibold">{p.name}</p>
            <p className="m-0 text-[11.5px] text-neutral-600">{p.meta}</p>
            <ul className="m-0 list-disc pl-5">
              {p.bullets.map((b) => (
                <li key={b}>{b}</li>
              ))}
            </ul>
          </div>
        ))}
      </section>

      <section aria-labelledby="r-os">
        <h2 id="r-os" className={h2}>Open source</h2>
        <p className="m-0">{resume.openSource}</p>
      </section>

      <p className="mb-0 mt-5 text-[10.5px] text-neutral-500">{resume.note}</p>
    </article>
  );
}
