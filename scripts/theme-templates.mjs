/**
 * Template berkas komponen untuk `pnpm theme:new` (THEME-CONTRACT §4).
 *
 * Dipisah dari `theme-scaffold.mjs` karena isinya KODE DALAM STRING: setiap
 * backtick dan `${...}` yang dimaksudkan untuk berkas hasil harus di-escape,
 * dan mencampurnya dengan logika scaffold membuat keduanya sulit dibaca.
 *
 * Hasilnya sengaja polos tetapi BENAR: tersambung ke data yang tepat, memenuhi
 * kontrak tema, dan langsung hijau di test konformansi. Yang belum ada hanyalah
 * art direction — dan memang itulah pekerjaan sungguhannya.
 */
import { camel, pascal } from "./theme-scaffold.mjs";

export function tSections({ slug, prefix }) {
  return `import type { ReactNode } from "react";

import { GuestbookSection } from "@/components/public/guestbook/guestbook-section";
import { formatEventDateTime } from "@/lib/datetime";
import type {
  Envelope as EnvelopeType,
  Person,
  StoryEntry,
  TimezoneId,
} from "@/lib/validation/content";
import { CopyButton } from "@/themes/_shared/copy-button";
import { fotoStyle } from "@/themes/_shared/foto";
import { Countdown } from "@/themes/_shared/motion";
import type { InvitationEventView, PhotoView } from "@/types/invitation";

import { L } from "./labels";

/**
 * Section tema \`${slug}\` — kerangka dari \`pnpm theme:new\`. Semuanya sudah
 * tersambung ke data yang benar; yang perlu dikerjakan adalah TAMPILANNYA.
 * Bentuk props jangan diubah: ia kontrak lintas tema.
 */

function Bagian({
  eyebrow,
  children,
}: {
  eyebrow: string;
  children: ReactNode;
}) {
  return (
    <section className="${prefix}-section">
      <p className="${prefix}-eyebrow">{eyebrow}</p>
      {children}
    </section>
  );
}

export function Hero({
  title,
  greetingOpen,
}: {
  title: string;
  greetingOpen?: string;
}) {
  return (
    <Bagian eyebrow={title}>
      {greetingOpen ? <p>{greetingOpen}</p> : null}
    </Bagian>
  );
}

function Orang({
  person,
  role,
  photo,
}: {
  person: Person;
  role: string;
  photo?: PhotoView | null;
}) {
  const inisial = (person.nickname || person.name || "\\u2022")
    .trim()
    .charAt(0)
    .toUpperCase();
  return (
    <div>
      <div className="${prefix}-foto">
        {photo ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={photo.url}
            alt=""
            style={{ width: "100%", height: "100%", ...fotoStyle(photo) }}
          />
        ) : (
          <span>{inisial}</span>
        )}
      </div>
      <p className="${prefix}-title">{person.name}</p>
      <p>{role}</p>
      <p>{L.couple.parents(person.fatherName, person.motherName)}</p>
    </div>
  );
}

export function Couple({
  groom,
  bride,
  groomPhoto,
  bridePhoto,
}: {
  groom: Person;
  bride: Person;
  groomPhoto?: PhotoView | null;
  bridePhoto?: PhotoView | null;
}) {
  return (
    <Bagian eyebrow={L.couple.eyebrow}>
      <Orang person={groom} role={L.couple.groom} photo={groomPhoto} />
      <Orang person={bride} role={L.couple.bride} photo={bridePhoto} />
    </Bagian>
  );
}

export function CountdownBlock({ targetIso }: { targetIso: string }) {
  return (
    <Bagian eyebrow={L.schedule.eyebrow}>
      <Countdown targetIso={targetIso} labels={L.countdown} />
    </Bagian>
  );
}

export function Schedule({
  events,
  tz,
}: {
  events: InvitationEventView[];
  tz: TimezoneId;
}) {
  return (
    <Bagian eyebrow={L.schedule.eyebrow}>
      {events.map((e) => (
        <div key={e.id}>
          <p className="${prefix}-title">{e.name}</p>
          <p>{formatEventDateTime(e.startAt, tz)?.full}</p>
          {e.venueName ? <p>{e.venueName}</p> : null}
          {e.address ? <p>{e.address}</p> : null}
        </div>
      ))}
    </Bagian>
  );
}

export function Gallery({ children }: { children: ReactNode }) {
  return <Bagian eyebrow={L.gallery.eyebrow}>{children}</Bagian>;
}

export function Story({ story }: { story: StoryEntry[] }) {
  return (
    <Bagian eyebrow={L.story.eyebrow}>
      {story.map((s, i) => (
        <div key={\`\${s.title}-\${i}\`}>
          <p className="${prefix}-title">{s.title}</p>
          {s.date ? <p>{s.date}</p> : null}
          <p>{s.narrative}</p>
        </div>
      ))}
    </Bagian>
  );
}

export function Envelope({ envelope }: { envelope: EnvelopeType }) {
  return (
    <Bagian eyebrow={L.envelope.eyebrow}>
      {envelope.banks.map((b) => (
        <div key={\`\${b.bank}-\${b.number}\`}>
          <p className="${prefix}-title">{b.bank}</p>
          <p>{b.number}</p>
          <p>{b.holder}</p>
          <CopyButton
            value={b.number}
            labelCopy="Salin nomor"
            labelCopied="Tersalin"
          />
        </div>
      ))}
    </Bagian>
  );
}

export function Rsvp({ slug }: { slug: string }) {
  return (
    <Bagian eyebrow={L.rsvp.eyebrow}>
      <GuestbookSection slug={slug} />
    </Bagian>
  );
}
`;
}

export function tCover({ slug, prefix }) {
  const P = pascal(slug);
  return `import { L } from "./labels";

/**
 * Layar sampul tema \`${slug}\` — isi \`CoverGate\`; tombol "Buka Undangan"
 * disediakan CoverGate sendiri. Kerangka dari \`pnpm theme:new\`.
 */
export function ${P}Cover({ title }: { title: string }) {
  return (
    <div className="${prefix}-cover-inner">
      <p className="${prefix}-eyebrow">{L.cover.open}</p>
      <p className="${prefix}-title">{title}</p>
    </div>
  );
}
`;
}

export function tIndex({ slug, prefix }) {
  const c = camel(slug);
  const P = pascal(slug);
  return `import type { ReactNode } from "react";

import { appearanceStyle } from "@/lib/customizer/appearance-style";
import { defaultSectionOrder } from "@/lib/customizer/default-order";
import { resolveAppearance } from "@/lib/customizer/resolve";
import { localToUtc } from "@/lib/datetime";
import { CoverGate } from "@/themes/_shared/cover-gate";
import { Lightbox } from "@/themes/_shared/lightbox";
import type { ThemeComponentProps } from "@/themes/registry";

// CSS tema TIDAK di-import di sini: ia dikirim sebagai aset statis lewat
// \`<ThemeStyles slug="${slug}" />\` supaya undangan tak mengunduh stylesheet
// semua tema (DECISIONS #31). Sumbernya tetap ./${slug}.css
import { ${P}Cover } from "./cover";
import { ${c}Options } from "./options";
import {
  CountdownBlock,
  Couple,
  Envelope,
  Gallery,
  Hero,
  Rsvp,
  Schedule,
  Story,
} from "./sections";

/** Tema \`${slug}\` — kerangka dari \`pnpm theme:new\` (THEME-CONTRACT §4). */
export default function ${P}Theme({ data }: ThemeComponentProps) {
  const { content, settings } = data;
  const custom = settings.custom;
  const resolved = custom ? resolveAppearance(${c}Options, custom) : null;

  const judul =
    content.category === "wedding"
      ? \`\${content.groom.nickname || content.groom.name} & \${
          content.bride.nickname || content.bride.name
        }\`
      : data.slug;

  const sesiPertama = data.events[0];
  const countdownTarget = sesiPertama
    ? localToUtc(sesiPertama.startAt, settings.timezone)
    : null;

  const env = content.envelope;
  const sectionNodes: Record<string, ReactNode> = {
    hero: <Hero title={judul} greetingOpen={content.greetingOpen} />,
    couple:
      content.category === "wedding" ? (
        <Couple
          groom={content.groom}
          bride={content.bride}
          groomPhoto={data.groomPhoto}
          bridePhoto={data.bridePhoto}
        />
      ) : null,
    countdown: countdownTarget ? (
      <CountdownBlock targetIso={countdownTarget} />
    ) : null,
    schedule:
      data.events.length > 0 ? (
        <Schedule events={data.events} tz={settings.timezone} />
      ) : null,
    gallery:
      data.media.length > 0 ? (
        <Lightbox media={data.media}>
          <Gallery>
            {data.media.map((m) => (
              // eslint-disable-next-line @next/next/no-img-element
              <img key={m.id} src={m.thumbUrl} alt="" loading="lazy" />
            ))}
          </Gallery>
        </Lightbox>
      ) : null,
    story:
      content.category === "wedding" && content.story.length > 0 ? (
        <Story story={content.story} />
      ) : null,
    envelope: env?.enabled ? <Envelope envelope={env} /> : null,
    rsvp: <Rsvp slug={data.slug} />,
  };

  const order =
    resolved?.sections ?? defaultSectionOrder(${c}Options, settings);

  const appearance = resolved
    ? {
        style: appearanceStyle(${c}Options.preview.vars, resolved),
        motion: resolved.motion,
      }
    : undefined;

  return (
    <CoverGate
      rootClassName="${prefix}"
      contentClassName="${prefix}-stage"
      coverClassName="${prefix}-cover"
      musicClassName="${prefix}-music"
      music={data.music}
      appearance={appearance}
      cover={<${P}Cover title={judul} />}
    >
      {order
        .filter((o) => o.visible)
        .map((o) => {
          const node = sectionNodes[o.id];
          if (!node) return null;
          return (
            <div
              key={o.id}
              data-section-id={o.id}
              style={{ display: "contents" }}
            >
              {node}
            </div>
          );
        })}
    </CoverGate>
  );
}
`;
}

export function tDemo({ slug }) {
  return `import { demoPhoto, demoPhotosFor } from "@/themes/_shared/demo-photos";
import type { InvitationData } from "@/types/invitation";

/**
 * Data contoh tema \`${slug}\` untuk katalog & \`/preview/tema/${slug}\`.
 * Ganti isinya agar memamerkan KEKUATAN tema ini (THEME-PORTING §5).
 */
export const demoInvitationData: InvitationData = {
  slug: "${slug}-demo",
  category: "wedding",
  eventDate: "2027-06-12",
  content: {
    category: "wedding",
    groom: {
      name: "Raka Pradipta",
      nickname: "Raka",
      fatherName: "Bpk. Hadi Pradipta",
      motherName: "Ibu Sri Lestari",
    },
    bride: {
      name: "Dinda Maharani",
      nickname: "Dinda",
      fatherName: "Bpk. Agus Maharani",
      motherName: "Ibu Ratna Dewi",
    },
    story: [],
    envelope: { enabled: false, banks: [], ewallets: [] },
    greetingOpen:
      "Dengan memohon rahmat Tuhan Yang Maha Esa, kami bermaksud menyelenggarakan resepsi pernikahan putra-putri kami.",
  },
  settings: {
    timezone: "Asia/Jakarta",
    sections: {},
    moderateGuestbook: false,
  },
  events: [
    {
      id: "akad",
      name: "Akad Nikah",
      startAt: "2027-06-12T02:00:00.000Z",
      endAt: null,
      venueName: "Masjid Agung",
      address: "Jl. Merdeka No. 1, Bandung",
      mapsUrl: null,
    },
  ],
  media: demoPhotosFor("${slug}") ?? [],
  groomPhoto: demoPhoto(demoPhotosFor("${slug}")?.[0]?.url),
  bridePhoto: demoPhoto(demoPhotosFor("${slug}")?.[1]?.url),
  coverPhoto: null,
  music: null,
  watermark: false,
};
`;
}

export function tSeed({ slug, nama, kategori, tier, urutan }) {
  return `-- Seed metadata tema \`${slug}\` (dihasilkan \`pnpm theme:new\`).
-- Kode temanya ada di \`src/themes/${slug}/\`; baris ini = katalog metadata yang
-- diedit admin, agar draft undangan bisa mereferensikan theme_id dan temanya
-- tampil di katalog. Idempoten lewat ON CONFLICT (slug).
--
-- PERIKSA SEBELUM PUSH: \`is_active\` sengaja FALSE. Tema baru tak boleh muncul
-- di katalog sebelum art direction & DoD-nya selesai (THEME-PORTING §5).
insert into public.themes (slug, name, categories, tier, is_active, sort_order)
values (
  '${slug}',
  '${nama}',
  array['${kategori}']::public.invitation_category[],
  '${tier}',
  false,
  ${urutan}
)
on conflict (slug) do update set
  name = excluded.name,
  categories = excluded.categories,
  tier = excluded.tier,
  sort_order = excluded.sort_order;
`;
}
