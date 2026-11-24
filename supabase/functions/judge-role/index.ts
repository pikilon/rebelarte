import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

type BranchId = "plasticas" | "textos" | "escenicas" | "sonido" | "audiovisuales";
type DecisionKind = "approved_new" | "matched_existing" | "rejected";

interface I18nText {
  es: string;
  en: string;
}

interface CatalogRole {
  id: number;
  branch: BranchId | null;
  slug: string;
  name: I18nText;
  sort: number;
}

interface JudgeCandidate {
  decision: DecisionKind;
  matched_role_id?: number | null;
  slug?: string | null;
  name?: I18nText | null;
  reason: I18nText;
}

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const BRANCH_LABELS: Record<BranchId, I18nText> = {
  plasticas: { es: "Artes plásticas", en: "Visual arts" },
  textos: { es: "Textos", en: "Texts" },
  escenicas: { es: "Artes escénicas", en: "Performing arts" },
  sonido: { es: "Sonido", en: "Sound" },
  audiovisuales: { es: "Audiovisuales", en: "Audiovisual" },
};

function norm(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

function slugify(s: string): string {
  return norm(s)
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 50)
    .replace(/-+$/g, "");
}

function capFirst(s: string): string {
  const clean = s.replace(/\s+/g, " ").trim();
  if (!clean) return "";
  return clean.charAt(0).toUpperCase() + clean.slice(1);
}

/** Sinónimos directos hacia slugs que ya existen en la semilla de `role_catalog`. */
const SYNONYM_TO_EXISTING_SLUG: Record<BranchId | "*", Record<string, string>> = {
  "*": {
    "creador": "autor",
    "creadora": "autor",
    "author": "autor",
    "coautor": "colaborador",
    "coautora": "colaborador",
    "co-author": "colaborador",
    "asistente": "colaborador",
    "produccion": "productor",
    "productor ejecutivo": "productor",
    "productora ejecutiva": "productor",
    "executive producer": "productor",
    "traduccion": "traductor",
  },
  audiovisuales: {
    "realizador": "director",
    "realizadora": "director",
    "filmmaker": "director",
    "cineasta": "director",
    "guion": "guionista",
    "scriptwriter": "guionista",
    "writer": "guionista",
    "actor": "actor-protagonista",
    "actriz": "actor-protagonista",
    "actor principal": "actor-protagonista",
    "actriz principal": "actor-protagonista",
    "protagonista": "actor-protagonista",
    "actor secundario": "actor-reparto",
    "actriz secundaria": "actor-reparto",
    "reparto": "actor-reparto",
    "operador de camara": "camara",
    "operadora de camara": "camara",
    "camera operator": "camara",
    "cameraman": "camara",
    "director de fotografia": "fotografia",
    "directora de fotografia": "fotografia",
    "dop": "fotografia",
    "dp": "fotografia",
    "cinematographer": "fotografia",
    "editor": "montaje",
    "editora": "montaje",
    "montador": "montaje",
    "montadora": "montaje",
    "edicion": "montaje",
    "edicion de video": "montaje",
    "video editor": "montaje",
    "film editor": "montaje",
    "banda sonora": "musica-original",
    "compositor": "musica-original",
    "compositora": "musica-original",
    "musica": "musica-original",
    "soundtrack": "musica-original",
    "tecnico de sonido": "sonido",
    "tecnica de sonido": "sonido",
    "sonidista": "sonido",
    "iluminador": "iluminacion",
    "iluminadora": "iluminacion",
    "luces": "iluminacion",
    "escenografo": "escenografia",
    "escenografa": "escenografia",
  },
  escenicas: {
    "director de escena": "director",
    "directora de escena": "director",
    "puesta en escena": "director",
    "stage director": "director",
    "dramaturgia": "dramaturgo",
    "autor teatral": "dramaturgo",
    "actor": "actor-protagonista",
    "actriz": "actor-protagonista",
    "actor principal": "actor-protagonista",
    "actriz principal": "actor-protagonista",
    "actor secundario": "actor-reparto",
    "actriz secundaria": "actor-reparto",
    "perfomer": "interprete",
    "coreografia": "coreografo",
    "escenografo": "escenografia",
    "escenografa": "escenografia",
    "iluminador": "iluminacion",
    "iluminadora": "iluminacion",
    "luces": "iluminacion",
    "tecnico de luces": "iluminacion",
    "tecnico de sonido": "sonido",
    "sonidista": "sonido",
    "musica": "musica-original",
    "compositor": "musica-original",
  },
  sonido: {
    "composicion": "compositor",
    "autor musical": "compositor",
    "musico": "interprete",
    "musica": "interprete",
    "instrumentista": "interprete",
    "letra": "letrista",
    "lyrics": "letrista",
    "songwriter": "letrista",
    "ingeniero de sonido": "sonido",
    "ingeniera de sonido": "sonido",
    "sonidista": "sonido",
    "grabacion": "sonido",
    "masterizacion": "mezcla",
    "mastering": "mezcla",
    "mixing": "mezcla",
    "mezclador": "mezcla",
    "cantante": "voz",
    "vocalista": "voz",
    "singer": "voz",
    "vocals": "voz",
  },
  plasticas: {
    "fotografia": "fotografo",
    "posado": "modelo",
    "ilustracion": "ilustrador",
    "dibujante": "ilustrador",
    "escultura": "escultor",
    "pintura": "pintor",
    "curador": "comisario",
    "curadora": "comisario",
    "comisariado": "comisario",
    "curadoria": "comisario",
  },
  textos: {
    "escritor": "autor",
    "escritora": "autor",
    "poeta": "autor",
    "novelista": "autor",
    "ensayista": "autor",
    "ilustracion": "ilustrador",
    "dibujante": "ilustrador",
    "edicion": "editor",
    "prologo": "prologuista",
  },
};

interface CuratedRoleDef {
  slug: string;
  name: I18nText;
  branches: BranchId[];
  aliases: string[];
}

/** Catálogo ampliado de cargos artísticos y técnicos válidos para crear on-the-fly. */
const CURATED_NEW_ROLES: CuratedRoleDef[] = [
  // Audiovisuales y Escénicas
  {
    slug: "direccion-arte",
    name: { es: "Dirección de arte", en: "Art direction" },
    branches: ["audiovisuales", "escenicas", "plasticas"],
    aliases: ["director de arte", "directora de arte", "art director", "art direction", "direccion artistica", "director artistico", "directora artistica"],
  },
  {
    slug: "vestuario",
    name: { es: "Diseño de vestuario", en: "Costume design" },
    branches: ["audiovisuales", "escenicas", "plasticas"],
    aliases: ["vestuario", "vestuarista", "disenador de vestuario", "disenadora de vestuario", "costume designer", "costume design", "wardrobe", "estilismo", "estilista", "stylist"],
  },
  {
    slug: "maquillaje-peluqueria",
    name: { es: "Maquillaje y peluquería", en: "Make-up and hair" },
    branches: ["audiovisuales", "escenicas", "plasticas"],
    aliases: ["maquillaje", "maquillador", "maquilladora", "peluqueria", "caracterizacion", "makeup", "make-up", "makeup artist", "mua", "hair and makeup"],
  },
  {
    slug: "colorista",
    name: { es: "Colorista / Etalonaje", en: "Colorist / Color grading" },
    branches: ["audiovisuales", "plasticas"],
    aliases: ["colorista", "etalonaje", "correccion de color", "color grading", "colorist", "colourist", "grading"],
  },
  {
    slug: "efectos-visuales",
    name: { es: "Efectos visuales (VFX)", en: "Visual effects (VFX)" },
    branches: ["audiovisuales"],
    aliases: ["vfx", "efectos visuales", "efectos digitales", "visual effects", "vfx artist", "composicion digital", "postproduccion digital", "posproduccion"],
  },
  {
    slug: "efectos-especiales",
    name: { es: "Efectos especiales (SFX)", en: "Special effects (SFX)" },
    branches: ["audiovisuales", "escenicas"],
    aliases: ["sfx", "efectos especiales", "special effects", "fx"],
  },
  {
    slug: "animacion",
    name: { es: "Animador/a", en: "Animator" },
    branches: ["audiovisuales", "plasticas"],
    aliases: ["animador", "animadora", "animacion", "animador 2d", "animador 3d", "animator", "motion graphics", "stop motion"],
  },
  {
    slug: "storyboard",
    name: { es: "Storyboard", en: "Storyboard artist" },
    branches: ["audiovisuales", "plasticas"],
    aliases: ["storyboard", "storyboarder", "storyboard artist", "guion grafico"],
  },
  {
    slug: "foquista",
    name: { es: "Foquista", en: "Focus puller" },
    branches: ["audiovisuales"],
    aliases: ["foquista", "focus puller", "1st ac", "primer ayudante de camara", "ayudante de camara"],
  },
  {
    slug: "gaffer",
    name: { es: "Jefe/a de eléctricos (Gaffer)", en: "Gaffer" },
    branches: ["audiovisuales", "escenicas"],
    aliases: ["gaffer", "jefe de electricos", "electrico", "electricista de rodaje"],
  },
  {
    slug: "script",
    name: { es: "Script / Continuista", en: "Script supervisor" },
    branches: ["audiovisuales"],
    aliases: ["script", "continuista", "script supervisor", "continuidad"],
  },
  {
    slug: "sonido-directo",
    name: { es: "Sonido directo / Microfonista", en: "Production sound / Boom operator" },
    branches: ["audiovisuales", "sonido"],
    aliases: ["sonido directo", "microfonista", "perchista", "boom operator", "location sound"],
  },
  {
    slug: "diseno-sonoro",
    name: { es: "Diseño sonoro", en: "Sound design" },
    branches: ["audiovisuales", "sonido", "escenicas"],
    aliases: ["diseno sonoro", "disenador sonoro", "disenadora sonora", "diseno de sonido", "sound designer", "sound design", "foley", "artista foley", "foley artist"],
  },
  {
    slug: "doblaje-locucion",
    name: { es: "Locución y doblaje", en: "Voice-over and dubbing" },
    branches: ["audiovisuales", "sonido", "escenicas"],
    aliases: ["locutor", "locutora", "locucion", "doblaje", "actor de doblaje", "actriz de doblaje", "voice over", "voice-over", "narrador", "narradora", "voice actor"],
  },
  {
    slug: "subtitulado",
    name: { es: "Subtitulado y accesibilidad", en: "Subtitling and accessibility" },
    branches: ["audiovisuales"],
    aliases: ["subtitulado", "subtitulos", "subtitler", "audiodescripcion"],
  },
  {
    slug: "casting",
    name: { es: "Dirección de casting", en: "Casting director" },
    branches: ["audiovisuales", "escenicas"],
    aliases: ["casting", "director de casting", "directora de casting", "casting director"],
  },
  {
    slug: "asistente-direccion",
    name: { es: "Ayudante de dirección", en: "Assistant director" },
    branches: ["audiovisuales", "escenicas"],
    aliases: ["ayudante de direccion", "asistente de direccion", "assistant director", "1st ad", "primer ayudante de direccion"],
  },
  {
    slug: "jefe-produccion",
    name: { es: "Jefe/a de producción", en: "Production manager" },
    branches: ["audiovisuales", "escenicas", "sonido", "plasticas"],
    aliases: ["jefe de produccion", "jefa de produccion", "direccion de produccion", "production manager", "line producer", "coordinador de produccion"],
  },
  {
    slug: "foto-fija",
    name: { es: "Foto fija / Making of", en: "Still photographer / Making-of" },
    branches: ["audiovisuales", "escenicas"],
    aliases: ["foto fija", "fotografo de rodaje", "still photographer", "making of", "making-of"],
  },
  {
    slug: "especialista-escena",
    name: { es: "Especialista / Coordinación de acción", en: "Stunt performer / Coordinator" },
    branches: ["audiovisuales", "escenicas"],
    aliases: ["especialista", "doble de accion", "stunt", "stuntman", "coordinador de especialistas", "coordinacion de intimidad"],
  },
  // Escénicas específicas
  {
    slug: "regiduria",
    name: { es: "Regiduría", en: "Stage management" },
    branches: ["escenicas", "audiovisuales"],
    aliases: ["regidor", "regidora", "regiduria", "regidor de escena", "stage manager"],
  },
  {
    slug: "bailarin",
    name: { es: "Bailarín/a", en: "Dancer" },
    branches: ["escenicas", "audiovisuales"],
    aliases: ["bailarin", "bailarina", "danza", "bailaor", "bailaora", "dancer"],
  },
  {
    slug: "acrobata-circo",
    name: { es: "Acróbata / Artista circense", en: "Acrobat / Circus artist" },
    branches: ["escenicas"],
    aliases: ["acrobata", "malabarista", "clown", "payaso", "trapecista", "artista circense", "circus artist", "acrobat"],
  },
  {
    slug: "titiritero",
    name: { es: "Titiritero/a / Manipulación de objetos", en: "Puppeteer" },
    branches: ["escenicas", "audiovisuales"],
    aliases: ["titiritero", "titiritera", "marionetista", "puppeteer", "titeres"],
  },
  {
    slug: "utileria-atrezzo",
    name: { es: "Utillería y atrezzo", en: "Props master" },
    branches: ["escenicas", "audiovisuales", "plasticas"],
    aliases: ["utileria", "utilero", "atrezzo", "atrezista", "props", "prop master"],
  },
  // Sonido específicas
  {
    slug: "arreglista",
    name: { es: "Arreglista / Orquestación", en: "Arranger / Orchestration" },
    branches: ["sonido", "escenicas", "audiovisuales"],
    aliases: ["arreglista", "arreglos", "orquestador", "orquestacion", "arranger", "orchestrator"],
  },
  {
    slug: "productor-musical",
    name: { es: "Producción musical", en: "Music producer" },
    branches: ["sonido", "audiovisuales"],
    aliases: ["productor musical", "productora musical", "produccion musical", "music producer", "beatmaker"],
  },
  {
    slug: "guitarrista",
    name: { es: "Guitarrista", en: "Guitarist" },
    branches: ["sonido", "escenicas"],
    aliases: ["guitarrista", "guitarra", "guitarra espanola", "guitarra electrica", "guitarra acustica", "guitarist", "guitar"],
  },
  {
    slug: "bajista",
    name: { es: "Bajista / Contrabajista", en: "Bassist / Double bass" },
    branches: ["sonido", "escenicas"],
    aliases: ["bajista", "bajo", "bajo electrico", "contrabajista", "contrabajo", "bassist", "bass"],
  },
  {
    slug: "bateria-percusion",
    name: { es: "Batería y percusión", en: "Drums and percussion" },
    branches: ["sonido", "escenicas"],
    aliases: ["bateria", "baterista", "percusionista", "percusion", "cajon flamenco", "drummer", "drums", "percussion"],
  },
  {
    slug: "pianista-teclista",
    name: { es: "Pianista / Teclista", en: "Pianist / Keyboardist" },
    branches: ["sonido", "escenicas"],
    aliases: ["pianista", "piano", "teclista", "teclados", "sintetizador", "pianist", "keyboardist", "keyboards", "synths"],
  },
  {
    slug: "cuerdas-vientos",
    name: { es: "Instrumentista de cuerda / viento", en: "String / Wind player" },
    branches: ["sonido", "escenicas"],
    aliases: ["violinista", "violin", "violonchelista", "chelo", "cello", "saxofonista", "saxofon", "trompetista", "trompeta", "flautista", "flauta", "clarinetista"],
  },
  {
    slug: "coros",
    name: { es: "Coros / Voz de acompañamiento", en: "Backing vocals / Choir" },
    branches: ["sonido", "escenicas"],
    aliases: ["coros", "corista", "voces adicionales", "backing vocals", "choir"],
  },
  {
    slug: "dj-electronica",
    name: { es: "DJ / Electrónica en vivo", en: "DJ / Live electronics" },
    branches: ["sonido", "escenicas"],
    aliases: ["dj", "disc jockey", "live set", "sintesis modular", "turntablism"],
  },
  // Plásticas específicas
  {
    slug: "grabador",
    name: { es: "Grabador/a / Estampación", en: "Printmaker" },
    branches: ["plasticas", "textos"],
    aliases: ["grabador", "grabadora", "serigrafia", "serigrafista", "litografia", "xilografia", "aguafuerte", "printmaker", "estampacion"],
  },
  {
    slug: "ceramista",
    name: { es: "Ceramista / Alfarería", en: "Ceramicist / Potter" },
    branches: ["plasticas"],
    aliases: ["ceramista", "ceramica", "alfarero", "alfarera", "alfareria", "ceramicist", "potter"],
  },
  {
    slug: "muralista",
    name: { es: "Muralista / Arte urbano", en: "Muralist / Street artist" },
    branches: ["plasticas"],
    aliases: ["muralista", "mural", "grafiti", "arte urbano", "street artist", "muralist"],
  },
  {
    slug: "restauracion-conservacion",
    name: { es: "Restauración y conservación", en: "Restoration and conservation" },
    branches: ["plasticas", "textos"],
    aliases: ["restaurador", "restauradora", "restauracion", "conservador", "conservadora", "conservacion", "conservator", "restorer"],
  },
  {
    slug: "diseno-grafico",
    name: { es: "Diseño gráfico", en: "Graphic design" },
    branches: ["plasticas", "textos", "audiovisuales", "escenicas", "sonido"],
    aliases: ["disenador grafico", "disenadora grafica", "diseno grafico", "graphic designer", "graphic design", "cartelista", "portadista", "diseno de portada", "diseno de cubierta"],
  },
  {
    slug: "instalacion-montaje",
    name: { es: "Montaje expositivo / Instalación", en: "Exhibition installation" },
    branches: ["plasticas"],
    aliases: ["montaje expositivo", "montador de exposiciones", "instalacion", "instalacion artistica", "museografia", "museografo"],
  },
  {
    slug: "orfebreria-joyeria",
    name: { es: "Orfebrería / Joyería artística", en: "Goldsmith / Art jewelry" },
    branches: ["plasticas"],
    aliases: ["orfebre", "orfebreria", "joyero", "joyeria artistica", "cerrajeria artistica", "forja"],
  },
  // Textos específicas
  {
    slug: "correccion-estilo",
    name: { es: "Corrección de estilo y ortotipográfica", en: "Copy-editing and proofreading" },
    branches: ["textos"],
    aliases: ["corrector", "correctora", "correccion", "corrector de estilo", "correctora de estilo", "corrector ortotipografico", "proofreader", "copy editor", "copy-editor"],
  },
  {
    slug: "maquetacion",
    name: { es: "Maquetación y composición editorial", en: "Editorial layout and typesetting" },
    branches: ["textos", "plasticas"],
    aliases: ["maquetador", "maquetadora", "maquetacion", "diagramacion", "composicion tipografica", "typesetter", "layout designer", "diseno editorial"],
  },
  {
    slug: "documentacion-investigacion",
    name: { es: "Documentación e investigación", en: "Research and documentation" },
    branches: ["textos", "audiovisuales", "escenicas", "plasticas", "sonido"],
    aliases: ["documentalista", "documentacion", "investigador", "investigadora", "investigacion", "asesoria historica", "asesor historico", "researcher"],
  },
  {
    slug: "epilogo-notas",
    name: { es: "Epílogo / Estudio crítico", en: "Afterword / Critical study" },
    branches: ["textos"],
    aliases: ["epilogo", "epiloguista", "estudio critico", "notas", "anotador", "antologador", "antologadora", "compilador", "compiladora", "afterword"],
  },
  {
    slug: "encuadernacion",
    name: { es: "Encuadernación artística", en: "Bookbinding" },
    branches: ["textos", "plasticas"],
    aliases: ["encuadernador", "encuadernadora", "encuadernacion", "bookbinder", "bookbinding"],
  },
];

/**
 * Evalúa con la base de conocimiento determinista de Jev antes de recurrir al LLM
 * (o como respaldo si no hay clave de LLM configurada).
 */
function evaluateDeterministically(
  branch: BranchId,
  rawInput: string,
  catalog: CatalogRole[],
): JudgeCandidate | null {
  const n = norm(rawInput);
  if (!n || n.length < 2 || /^[^a-z]+$/.test(n)) {
    return {
      decision: "rejected",
      reason: {
        es: `«${rawInput.trim()}» no es un nombre de cargo válido.`,
        en: `“${rawInput.trim()}” is not a valid role name.`,
      },
    };
  }

  // 1. ¿Es un sinónimo directo de un cargo existente en el catálogo de esta rama?
  const branchSyns = SYNONYM_TO_EXISTING_SLUG[branch] ?? {};
  const globalSyns = SYNONYM_TO_EXISTING_SLUG["*"] ?? {};
  const targetSlug = branchSyns[n] ?? globalSyns[n];
  if (targetSlug) {
    const found =
      catalog.find((r) => r.branch === branch && r.slug === targetSlug) ??
      catalog.find((r) => r.branch === null && r.slug === targetSlug);
    if (found) {
      return {
        decision: "matched_existing",
        matched_role_id: found.id,
        reason: {
          es: `«${rawInput.trim()}» equivale al cargo «${found.name.es}» del catálogo.`,
          en: `“${rawInput.trim()}” matches the existing role “${found.name.en}”.`,
        },
      };
    }
  }

  // 2. ¿Está en nuestro catálogo curado de cargos artísticos/técnicos?
  const matchedCurated = CURATED_NEW_ROLES.find(
    (c) => c.slug === slugify(rawInput) || c.aliases.includes(n) || norm(c.name.es) === n || norm(c.name.en) === n,
  );
  if (matchedCurated) {
    if (matchedCurated.branches.includes(branch)) {
      const existing = catalog.find(
        (r) => (r.branch === branch || r.branch === null) && r.slug === matchedCurated.slug,
      );
      if (existing) {
        return {
          decision: "matched_existing",
          matched_role_id: existing.id,
          reason: {
            es: `Se ha vinculado al cargo «${existing.name.es}».`,
            en: `Linked to the role “${existing.name.en}”.`,
          },
        };
      }
      return {
        decision: "approved_new",
        slug: matchedCurated.slug,
        name: matchedCurated.name,
        reason: {
          es: `Cargo «${matchedCurated.name.es}» aprobado e incorporado al catálogo de ${BRANCH_LABELS[branch].es}.`,
          en: `Role “${matchedCurated.name.en}” approved and added to the ${BRANCH_LABELS[branch].en} catalog.`,
        },
      };
    } else {
      const validBranchesEs = matchedCurated.branches.map((b) => BRANCH_LABELS[b].es).join(", ");
      const validBranchesEn = matchedCurated.branches.map((b) => BRANCH_LABELS[b].en).join(", ");
      return {
        decision: "rejected",
        reason: {
          es: `«${matchedCurated.name.es}» es un cargo propio de ${validBranchesEs}, no de ${BRANCH_LABELS[branch].es}.`,
          en: `“${matchedCurated.name.en}” belongs to ${validBranchesEn}, not ${BRANCH_LABELS[branch].en}.`,
        },
      };
    }
  }

  // 3. ¿Es un cargo del catálogo semilla pero exclusivo de OTRA rama?
  const otherBranchRoles: Array<{ terms: string[]; validIn: BranchId[]; label: I18nText }> = [
    {
      terms: ["guionista", "screenwriter", "camara", "camera", "direccion de fotografia", "cinematography", "actor protagonista", "actriz protagonista"],
      validIn: ["audiovisuales", "escenicas"],
      label: { es: "ese cargo audiovisual/escénico", en: "that audiovisual/performing arts role" },
    },
    {
      terms: ["dramaturgo", "dramaturga", "playwright", "coreografo", "coreografa", "choreographer"],
      validIn: ["escenicas", "textos"],
      label: { es: "ese cargo escénico", en: "that performing arts role" },
    },
    {
      terms: ["letrista", "lyricist", "mezcla y masterizacion", "masterizacion", "sound engineer"],
      validIn: ["sonido", "audiovisuales"],
      label: { es: "ese cargo de sonido", en: "that sound role" },
    },
    {
      terms: ["prologuista", "foreword author"],
      validIn: ["textos"],
      label: { es: "Prologuista", en: "Foreword author" },
    },
    {
      terms: ["escultor", "escultora", "sculptor", "pintor", "pintora", "painter", "comisario", "comisaria", "curator"],
      validIn: ["plasticas"],
      label: { es: "ese cargo de artes plásticas", en: "that visual arts role" },
    },
  ];
  for (const ob of otherBranchRoles) {
    if (ob.terms.includes(n) && !ob.validIn.includes(branch)) {
      const validEs = ob.validIn.map((b) => BRANCH_LABELS[b].es).join(" o ");
      const validEn = ob.validIn.map((b) => BRANCH_LABELS[b].en).join(" or ");
      return {
        decision: "rejected",
        reason: {
          es: `«${capFirst(rawInput)}» corresponde a ${validEs}, no a ${BRANCH_LABELS[branch].es}.`,
          en: `“${capFirst(rawInput)}” belongs to ${validEn}, not ${BRANCH_LABELS[branch].en}.`,
        },
      };
    }
  }

  return null;
}

/**
 * Respaldo heurístico cuando no hay clave de LLM configurada o la API externa falla:
 * reconoce cargos compuestos válidos («Asistente de…», «Diseño de…», «Técnico de…», etc.)
 * coherentes con la rama y rechaza profesiones ajenas al ámbito artístico/cultural.
 */
function evaluateWithHeuristicFallback(
  branch: BranchId,
  rawInput: string,
): JudgeCandidate {
  const n = norm(rawInput);
  const clean = capFirst(rawInput);

  // Palabras claramente ajenas a una participación artística o técnica en una obra
  const nonArtistic = /\b(fontaner|albanil|taxista|futbolista|abogad|contable|medic|odontolog|camarer|cociner|panader|banquer|policia|bomber|militar|vendedor|repartidor|plumber|accountant|lawyer|dentist|waiter|cashier|driver|spam|test|prueba|asdf|qwerty|xxx|admin|root)\b/;
  if (nonArtistic.test(n) || n.length < 3 || /(.)\1{3,}/.test(n)) {
    return {
      decision: "rejected",
      reason: {
        es: `«${clean}» no se reconoce como un cargo artístico, técnico o creativo válido para ${BRANCH_LABELS[branch].es}.`,
        en: `“${clean}” is not recognized as a valid artistic, technical or creative role for ${BRANCH_LABELS[branch].en}.`,
      },
    };
  }

  const branchKeywords: Record<BranchId, RegExp> = {
    plasticas: /\b(pintur|escultur|grabad|fotograf|ilustr|instalaci|ceram|textil|tapiz|collage|restauraci|conservaci|comisari|curadur|exposi|marco|enmarcad|moldead|fundici|talla|dibuj|acuarel|oleo|acrilic|serigraf|litograf|arte|visual|plastic|model|maquet|caligraf|orfebr|joyer|vidri|vitral|esmalte|mosaico)\b/,
    textos: /\b(edici|correcci|revisi|prolog|epilog|ilustr|maquetaci|tipograf|cubiert|portad|traducci|documentaci|antolog|compilaci|redacci|lectur|glosari|indice|bibliograf|nota|critica|literari|texto|editorial|imprent|encuadernaci|caligraf|guion|narraci)\b/,
    escenicas: /\b(escen|teatr|danz|circo|performan|vestuari|iluminaci|luces|sonid|utilleri|atrezz|regidur|coreograf|dramaturg|interpret|actor|actriz|bailar|acrobat|titer|marionet|maquillaj|caracterizaci|producci|direcci|apuntador|tramoy|maquinist|espacio|movimiento|voz|canto|coro)\b/,
    sonido: /\b(sonid|music|audio|mezcl|master|grabaci|voz|vocal|coro|instrument|guitarr|bajo|contrabaj|bateri|percusi|pian|teclad|sintetizador|violin|violonchel|viola|flaut|saxof|trompet|trombon|clarinet|oboe|fagot|arpa|acordeon|bandoneon|cante|cantaor|palmas|arregl|orquest|composici|producci|locuci|podcast|foley|acustic|directo|estudio|edici)\b/,
    audiovisuales: /\b(camar|fotograf|video|cine|rodaj|montaj|edici|sonid|audio|luces|iluminaci|arte|vestuari|maquillaj|peluqueri|vfx|sfx|efect|color|etalonaj|guion|direcci|producci|casting|script|continuid|animaci|storyboard|dron|steadicam|grua|travelling|microfon|perch|doblaj|subtitul|locuci|grafism|creditos|postproducci|posproducci|decorad|atrezz|utileri|foquist|electric)\b/,
  };

  const genericPrefixes = /\b(asistente|ayudante|coordinaci|coordinador|direcci|director|disen|tecnic|operador|jefe|jefa|responsable|asesor|asesori|supervis|especialista|assistant|coordinator|designer|technician|operator|supervisor|specialist|lead|chief)\b/;

  if (branchKeywords[branch].test(n) || genericPrefixes.test(n)) {
    const sl = slugify(clean);
    if (sl.length >= 3) {
      return {
        decision: "approved_new",
        slug: sl,
        name: { es: clean, en: clean },
        reason: {
          es: `Cargo «${clean}» aprobado e incorporado al catálogo de ${BRANCH_LABELS[branch].es}.`,
          en: `Role “${clean}” approved and added to the ${BRANCH_LABELS[branch].en} catalog.`,
        },
      };
    }
  }

  return {
    decision: "rejected",
    reason: {
      es: `«${clean}» no parece corresponder a un cargo propio de la rama de ${BRANCH_LABELS[branch].es}.`,
      en: `“${clean}” does not appear to be a valid role for the ${BRANCH_LABELS[branch].en} branch.`,
    },
  };
}

/**
 * Llama a Gemini (`gemini-2.5-flash`) como Juez de Cargos (Jev) con salida JSON estructurada.
 */
async function evaluateWithGemini(
  apiKey: string,
  branch: BranchId,
  rawInput: string,
  catalog: CatalogRole[],
): Promise<JudgeCandidate | null> {
  const catalogList = catalog.map((r) => ({
    id: r.id,
    slug: r.slug,
    es: r.name.es,
    en: r.name.en,
    global: r.branch === null,
  }));

  const prompt = `Eres Jev, el juez automático de catálogo de Rebelarte (portal cultural para promocionar artistas y sus obras).
Un usuario quiere añadir el cargo de participación: ${JSON.stringify(rawInput)}
en una obra de la rama: "${branch}" (${BRANCH_LABELS[branch].es} / ${BRANCH_LABELS[branch].en}).

Cargos ya disponibles en el catálogo para esta rama:
${JSON.stringify(catalogList, null, 2)}

Reglas de decisión:
1. "matched_existing": Si el texto propuesto es un sinónimo, variante de género, abreviatura o equivalente directo de alguno de los cargos ya disponibles en la lista anterior para esta rama, devuelve "matched_existing" y su "matched_role_id" numérico exacto.
2. "approved_new": Si es un cargo o rol artístico, técnico, creativo, artesanal o de producción genuino que tiene sentido en una obra de la rama "${branch}" (${BRANCH_LABELS[branch].es}) y NO está cubierto por los existentes, apruébalo ("approved_new"). Genera:
   - "slug": identificador en kebab-case ASCII sin acentos (^[a-z0-9-]+$, máx. 40 caracteres).
   - "name": {"es": "...", "en": "..."} con el nombre canónico bien escrito en español e inglés (usa formato inclusivo natural como en el catálogo cuando proceda, p. ej. "Colorista", "Diseño de vestuario", "Maquetador/a").
3. "rejected": Si el texto NO es un cargo válido (spam, insulto, texto sin sentido, nombre propio de persona, profesión ajena a la creación cultural) O si es un cargo exclusivo de OTRA rama artística que no tiene cabida en "${branch}" (por ejemplo, "Foquista" o "Operador de cámara" en una obra de Textos, o "Encuadernador" en una obra de Sonido), recházalo ("rejected").
4. Incluye siempre "reason": {"es": "...", "en": "..."} con una frase breve y clara para el usuario explicando el motivo.`;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 8000);
  try {
    const resp = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${encodeURIComponent(apiKey)}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: controller.signal,
        body: JSON.stringify({
          contents: [{ role: "user", parts: [{ text: prompt }] }],
          generationConfig: {
            temperature: 0.1,
            responseMimeType: "application/json",
            responseSchema: {
              type: "OBJECT",
              required: ["decision", "reason"],
              properties: {
                decision: {
                  type: "STRING",
                  enum: ["approved_new", "matched_existing", "rejected"],
                },
                matched_role_id: { type: "INTEGER", nullable: true },
                slug: { type: "STRING", nullable: true },
                name: {
                  type: "OBJECT",
                  nullable: true,
                  required: ["es", "en"],
                  properties: {
                    es: { type: "STRING" },
                    en: { type: "STRING" },
                  },
                },
                reason: {
                  type: "OBJECT",
                  required: ["es", "en"],
                  properties: {
                    es: { type: "STRING" },
                    en: { type: "STRING" },
                  },
                },
              },
            },
          },
        }),
      },
    );
    if (!resp.ok) return null;
    const data = await resp.json();
    const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!text) return null;
    const parsed = JSON.parse(text) as JudgeCandidate;
    if (!parsed || !["approved_new", "matched_existing", "rejected"].includes(parsed.decision)) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: CORS_HEADERS });
  }
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "method_not_allowed" }), {
      status: 405,
      headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
    });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    const token = authHeader?.replace(/^Bearer\s+/i, "").trim() ?? "";
    if (!authHeader || !token) {
      return new Response(JSON.stringify({ error: "not_authenticated" }), {
        status: 401,
        headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

    const userClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: `Bearer ${token}` } },
    });
    const adminClient = createClient(supabaseUrl, supabaseServiceKey);

    const { data: userData, error: userErr } = await adminClient.auth.getUser(token);
    if (userErr || !userData?.user) {
      return new Response(JSON.stringify({ error: "not_authenticated" }), {
        status: 401,
        headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
      });
    }

    const body = await req.json().catch(() => ({}));
    const branch = body?.branch as BranchId | undefined;
    const rawRole = typeof body?.rawRole === "string" ? body.rawRole.trim() : "";

    if (!branch || !(branch in BRANCH_LABELS)) {
      return new Response(JSON.stringify({ error: "invalid_branch" }), {
        status: 400,
        headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
      });
    }
    if (!rawRole || rawRole.length > 80) {
      return new Response(JSON.stringify({ error: "invalid_role" }), {
        status: 400,
        headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
      });
    }

    // 1. Consulta rápida en base de datos (coincidencia exacta/género en catálogo o decisión en caché)
    const { data: cached, error: cacheErr } = await userClient.rpc(
      "resolve_existing_or_cached_role",
      { p_branch: branch, p_raw_input: rawRole },
    );
    if (cacheErr) {
      return new Response(JSON.stringify({ error: cacheErr.message }), {
        status: 400,
        headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
      });
    }
    if (cached) {
      return new Response(JSON.stringify(cached), {
        status: 200,
        headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
      });
    }

    // 2. Cargar los cargos existentes para la rama
    const { data: rolesData } = await adminClient
      .from("role_catalog")
      .select("*")
      .or(`branch.is.null,branch.eq.${branch}`)
      .order("sort");
    const catalog = (rolesData ?? []) as CatalogRole[];

    // 3. Evaluar primero con la base de conocimiento determinista de Jev
    let candidate = evaluateDeterministically(branch, rawRole, catalog);

    // 4. Si no está en la base determinista, consultar a Gemini (si hay GEMINI_API_KEY)
    if (!candidate) {
      const geminiKey = Deno.env.get("GEMINI_API_KEY") ?? Deno.env.get("GOOGLE_API_KEY") ?? "";
      if (geminiKey) {
        candidate = await evaluateWithGemini(geminiKey, branch, rawRole, catalog);
      }
    }

    // 5. Respaldo heurístico si no hay clave de LLM o la llamada externa no respondió
    if (!candidate) {
      candidate = evaluateWithHeuristicFallback(branch, rawRole);
    }

    // 6. Registrar la decisión y crear el cargo en `role_catalog` si procede
    const { data: recorded, error: recErr } = await adminClient.rpc(
      "record_role_judge_decision",
      {
        p_user_id: userData.user.id,
        p_branch: branch,
        p_raw_input: rawRole,
        p_decision: candidate.decision,
        p_slug: candidate.slug ?? null,
        p_name: candidate.name ?? null,
        p_matched_role_id: candidate.matched_role_id ?? null,
        p_reason: candidate.reason,
      },
    );

    if (recErr) {
      return new Response(JSON.stringify({ error: recErr.message }), {
        status: 400,
        headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify(recorded), {
      status: 200,
      headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : "internal_error" }),
      {
        status: 500,
        headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
      },
    );
  }
});
