# Soltex Global — English Copy Audit

Status: **report only.** No English copy was changed. English is the master; every translation mirrors it 1:1.
Labels: KEEP · REVIEW LATER · VERIFY · POTENTIAL REPETITION · POTENTIAL FLUFF · TERMINOLOGY ISSUE.

## 1. VERIFY — factual consistency / claims needing evidence

| # | Where | Finding |
|---|-------|---------|
| V1 | Home, About, Timeline, meta | Company age stated as **25+**, **30+**, “three decades” and “founded 1999” — mutually inconsistent. |
| V2 | Home stats / About | Years in operation **20+** vs **18+**. |
| V3 | Home stats | **300M+ USD** project value — source needed. **10+ countries** — only 7 countries are named anywhere on the site. |
| V4 | Home featured projects vs project pages | Uzbekistan “500 MT/DAY, 2024” vs project page 500 t/y, 2023–2025. Israel “700 MT/DAY, 2023” vs project page 17,000 t/y, 2002–2004. Units (per day vs per year) and dates conflict. |
| V5 | Namangan project | 1,000 t/y headline vs 500 t/y pectin + 800 t/y fibres in detail. |
| V6 | Solbar Israel | 2002–2004 vs 2001–2004. |
| V7 | Home IP section vs Patents page | Home shows 4 BG patents; Patents page shows application 113754 and RU 2709384 C1. “2 registered patents” while one is an application; “Registered Patent Number” label used for an application; EPO/Israel jurisdictions not evidenced; RU patent (2019) described as applied at plants built 2002–2011. |
| V8 | Footer / Contact | “Soltex Global FZC” UAE HQ vs offices list “SOLTEX GROUP LTD” with no UAE office. |
| V9 | Contact | Working hours Mon–Fri vs Sun–Thu; response time “1 business day” vs “<24h” vs “24 working hours”. |
| V10 | Products / Technologies | “Biostim”, “S-Protein” named without explanation. |
| V11 | Projects / Timeline | Client names (Cargill, DSM, Agritech LLC, Siberian Wellness) — confirm permission to publish. |
| V12 | Nebraska / Timeline | Nebraska plant claims need source. |
| V13 | Products | Certifications (Kosher/Halal/FCC/USP/EP, ISO/HACCP Ningbo) — evidence needed. Identical packaging and shelf life on every product, contradicting 200 L drums for concentrates. |
| V14 | About / Technologies | Numeric claims **92 %**, **6.8x**, **60 %**, “> 90 % protein” — source needed. |
| V15 | Various | Guarantees and exclusivity statements (“guaranteed yield”, “exclusive”) — legal review. |
| V16 | Video block | “Verified Facility Footage” with durations, but no real video — misleading. |
| V17 | Footer | © 2024 (outdated). ISO 22000:2005 / FSSC 22000:2013 are superseded versions. “USA SAG” unclear. |

## 2. TERMINOLOGY ISSUE

- **EPC vs EPCM** used interchangeably (“Turnkey EPCM”, “Turnkey EPC” on consulting-only projects). Define once and apply.
- **Lifecycle stage count**: 7, 8, 10 and 5 stages in different places.
- **Pectin grade**: “HM” vs “high-ester” — pick one (with the other in parentheses on first use).
- **pulp vs marc/pomace**; **feedstock vs raw material vs biomass** — choose one primary term.
- **Units**: t/y, MT, t/year, MT/DAY — standardise (suggest “t/year”, “t/day”).
- **acid-free vs organic-acid** extraction — clarify whether same process.
- **CAPEX / Capex** casing.
- **“Jurisdiction”** used for a plant location (should be “Location”).

## 3. POTENTIAL FLUFF

“Technological Sovereignty”, “engineering prowess”, “world-class”, “state-of-the-art”, “premier”, “market-leading”, “Revolution”, “Perfect”, “absolute”, “mission-critical”, “Registered scientific monographs”, “Stage verified technology”, “Archival engineering record”; generic boilerplate paragraphs repeated on every project detail page. Recommendation: replace adjectives with specific facts (capacity, year, country, scope).

## 4. POTENTIAL REPETITION

- Lead/CTA form repeated on ~10 pages; “START YOUR PROJECT” repeated many times per page.
- Patent key points duplicated between Home and Patents.
- Project overview shown twice on project detail pages.
- Company timeline repeats project list almost verbatim.

## 5. Awkward English (REVIEW LATER)

“10+ COUNTRIES PROJECT EXPERIENCE”, “FLAGMAN” (→ flagship), “FIRST MASSIVE ASSET”, “world largest” (→ world’s largest), “Soltex patented technology” (→ Soltex’s patented technology), “craft bags” (→ kraft bags), “Jurisdiction: Commercial installation…”, “Output Utilization Sectors”; inconsistent ALL-CAPS vs Title Case in headings and buttons.

## 6. UX notes (not copy, out of scope — REVIEW LATER)

- “View all projects”, “Explore IP portfolio”, “Our EPC approach”, “Learn more”, Privacy, Terms all open the inquiry modal instead of navigating. No legal pages exist.
- Forms are not connected to any backend (setTimeout + random REF number) — **leads are lost**.
- Home technology cards (6) use different slugs/names than the 6 technology pages.
- Dead components/data (e.g. PUBLIC_SCALE “safe city / airports”); ContactModal never opened.
- Mobile burger partly off-screen at 390 px (all languages, pre-existing).

## 7. KEEP

Specific project data (once reconciled), process principles, product characteristics, hero description, contact details and office addresses (once V8/V9 resolved).
