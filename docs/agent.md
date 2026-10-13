# Asistenti AI i dyqanit

Agjent që u përgjigjet klientëve dhe merr porosi në **chat-in e faqes**, **Telegram** dhe **WhatsApp** (QR ose
API zyrtare). Një kod i vetëm për të tre kanalet; çdo dyqan (tenant) përdor katalogun dhe databazën e vet.

## Arkitektura

```
 Klienti                     Kanali (route)                       Agjenti                         Dyqani
 ───────                     ──────────────                       ───────                         ──────
 Chat në faqe ──► /api/agent/chat        (same-origin, IP)  ┐
 Telegram     ──► /api/agent/telegram    (secret header)    ├─► runAgent()  ──► LLM (Groq, OpenAI-compatible)
 WhatsApp QR  ──► /api/agent/whatsapp    (Bearer token)     │     │  ≤ 5 raunde          │
 WhatsApp API ──► /api/whatsapp/cloud    (HMAC e Meta-s)    ┘     │                      ▼ tool_calls
                                                                  ├─► runTool() ─► search / browse / shop info
                                                                  │               place_order ─► checkout i dyqanit
                                                                  │               check_order / notify_shop
                                                                  ├─► agent_runs / agent_steps   (audit trail)
                                                                  └─► agent_conversations        (kujtesa)
```

| Skedari | Roli |
|---|---|
| `src/lib/agent/run.ts` | Cikli: mesazh → model → (vegla → model)… → përgjigje. Prompt-i i sistemit dhe rregullat. |
| `src/lib/agent/llm.ts` | Thirrja e modelit (Groq / OpenRouter / Mistral / Gemini), riprovime për 429, tokenat. |
| `src/lib/agent/tools.ts` | Veglat dhe validimi i tyre. Modeli vetëm propozon; kodi kontrollon dhe ekzekuton. |
| `src/lib/agent/store.ts` | Audit trail dhe kujtesa e bisedave në databazë. |
| `src/lib/agent/telegram.ts`, `whatsapp.ts` | Kanalet (formatimi, kujtesa për bisedë). |
| `src/app/cms/settings/assistant` | Faqja **Settings → Asistenti AI** në CMS (historiku). |

## Veglat

| Vegla | Çfarë bën | Mbrojtjet |
|---|---|---|
| `search_products` | Kërkim sipas emrit / fjalëve, me sinonime (tefsir ↔ koment…) | Vetëm produkte aktive; ato që blihen dalin të parat; maks. 8 |
| `browse_products` | Lista: më të shiturat, të rejat, më të lirat, sipas kategorisë | Vetëm me çmim dhe në stok; maks. 15; tregon sa ka vërtet |
| `get_shop_info` | Pagesa, dërgesa sipas shtetit | — |
| `place_order` | Krijon porosinë përmes checkout-it të dyqanit | Pas konfirmimit të klientit; 1–10 copë, maks. 10 rreshta, maks. 3 porosi/orë për bisedë; produkt pa çmim refuzohet; çmimet i llogarit sistemi |
| `check_order` | Statusi i porosisë | Vetëm me numrin e porosisë **dhe** telefonin e saj; maks. 8/orë |
| `notify_shop` | I njofton dyqanit kur klienti kërkon njeri | Maks. 3/orë |

Modeli **nuk** shkruan SQL, nuk vendos çmime dhe nuk sheh ID e brendshme te klienti.

## Kërkimi semantik (vektorët / RAG)
Modeli **nuk trajnohet**; produktet, faqet e CMS-së dhe artikujt e blogut kthehen në vektorë (kuptimi i tekstit) dhe
kërkimi bëhet **hibrid**: fjalët + sinonimet (për titujt e saktë) dhe kuptimi (për pyetjet me fjalë të tjera).

| | |
|---|---|
| Modeli | `Xenova/multilingual-e5-small` (lokal, ONNX, e kupton shqipen), pa çelës API dhe pa kosto |
| Ndezja | `AGENT_EMBEDDINGS=local` (fikur si parazgjedhje) |
| Memoria | **~500–800 MB** më shumë → jo në Render falas / Starter (512 MB); po në Hetzner ose Render Standard (2 GB) |
| Indeksi | `agent_knowledge` (vektori si `real[]`), rifreskim çdo 15 min, vetëm tekstet e ndryshuara; 182 dokumente në 3.7 s |
| Pragu | `AGENT_SEMANTIC_FLOOR` (0.82): pyetjet pa lidhje (laptop, telefon, picë…) kanë maks. 0.819 |
| Vegla e re | `search_knowledge` (faqet dhe blogu), vetëm kur vektorët janë ndezur |

Matja me `scripts/agent-semantic-check.ts` (13 pyetje reale, produkti i pritur në top 3):

| | Saktësia | Pyetje pa lidhje → produkte |
|---|---|---|
| Vetëm fjalë + sinonime | 10/13 | 0 |
| **Hibrid (fjalë + vektorë)** | **11/13** | **0** |

Fiton te parafrazat ("libër për gratë muslimane" → "Nën hixhabin tim", "Aishja, nëna e besimtarëve"; "çfarë ndodh pas
vdekjes" → "Gjendja e të vdekurve…"). Mbeten pa u gjetur: "libër për parajsën" (modeli nuk e lidh parajsë ↔ xhenet) dhe
"si ta edukoj fëmijën tim". Një model më i madh (`multilingual-e5-base`) ose embeddings me API mund t'i përmirësojnë,
me më shumë memorie / kosto.

## Si mëson asistenti (pa trajnim)
Modeli nuk ndryshon; **dyqani e mëson** nga CMS → Settings → **Asistenti AI**:

1. **👍 / 👎** — klienti nën çdo përgjigje në chat-in e faqes (`/api/agent/feedback`, vetëm nga i njëjti origin, vetëm
   përgjigje të 24 orëve të fundit), stafi te historia. Ruhen te `agent_feedback`.
2. **Korrigjimet** — për çdo përgjigje (ose si pyetje e re) stafi shkruan përgjigjen e saktë (`agent_corrections`).
   Për çdo pyetje të ngjashme (fjalë kyçe; me vektorët edhe pyetje të riformuluara) asistenti merr korrigjimin si
   udhëzim të dyqanit, **pranë pyetjes** (aty modeli i kushton më shumë vëmendje). Faktet e veglave (çmim, stok) kanë
   përparësi; kur veglat s'e kanë (p.sh. produkt pa çmim online), përdoret ai i dyqanit. Hapi duket te audit trail si
   `shop_guidance`.
3. **Raporti 7-ditor** — pyetjet pa përgjigje të vërtetë, produktet e kërkuara që s'u gjetën, 👍 / 👎.
4. **Testet** — çdo korrigjim aktiv bëhet test:
   `node --env-file=.env.local node_modules/tsx/dist/cli.mjs scripts/agent-evals.ts <url e databazës>`
   (pyet asistentin e vërtetë dhe kontrollon faktet kryesore: numrat, çmimet, emrat).

Provë: "sa kushton tefsiri i kuranit, a mund ta porosis?" — para: "çmimi nuk është caktuar online"; pas një korrigjimi:
"në dyqan me çmim 25 € (3 vëllime)… telefononi… ose ejani në dyqan" (7/7 fakte).

## Mbrojtjet (guardrails)
- Trupi i kërkesës maks. 24 KB (413), mesazhi 1 500 karaktere, historia 16 mesazhe.
- Maks. 5 raunde model/vegla për mesazh; timeout 30 s për thirrje; 25 mesazhe / 10 min për bisedë; 400 thirrje / ditë.
- Riprovim i kontrolluar kur ofruesi thotë "rate limit" (deri 3 herë, sipas kohës që kërkon, ≤ 25 s).
- Çdo kanal ka autentikimin e vet (same-origin, sekret, token, nënshkrim HMAC).
- Porosia krijohet **Pending**; dyqani e pranon me **Konfirmo / Anulo** (miratim njerëzor).

## Kujtesa
Bisedat e Telegram / WhatsApp ruhen te `agent_conversations` (çelësi = hash, jo numri), 16 mesazhet e fundit,
skadojnë pas 24 orësh dhe fshihen pas 7 ditësh. Chat-i i faqes e mban historinë në shfletues.

## Audit trail
Çdo mesazh = një rresht te `agent_runs` (kanali, biseda si hash, statusi, mesazhi, përgjigjja, gabimi, hapat,
tokenat, kohëzgjatja) dhe hapat te `agent_steps` (modeli ose vegla, argumentet me të dhënat personale të
maskuara, rezultati, ok/gabim, ms, tokenat). Statuset: `completed`, `fallback`, `rate_limited`, `daily_limit`,
`max_steps`, `failed`. Historia mbahet **90 ditë**. Shihet te CMS → Settings → **Asistenti AI**.

Matje fillestare (lokal, Groq `openai/gpt-oss-120b`): **~4 000–6 500 tokena** dhe **~2 s** për përgjigje me 1–2 vegla.

## Testet
```bash
# Veglat, pa AI (deterministe): katalogu, porositë e gabuara, porosia normale nga fillimi në fund, privatësia
npx tsx scripts/agent-scenarios.ts postgres://…/pos_tenant_arditi_test

# WhatsApp zyrtar pa Meta (simulator)
node scripts/whatsapp-cloud-sim.mjs
```
`agent-scenarios.ts` punon vetëm me databazë `*_test`, fik emailat dhe njoftimet (`EMAIL_DELIVERY=off`) dhe e fshin
porosinë testuese në fund. Gjendja e fundit: **15/15 kalojnë**.

## Defektet dhe kufizimet e njohura
1. **Groq falas: 8 000 tokena/minutë.** Me ~5 000 për përgjigje, vetëm 1–2 përgjigje në minutë; në ngarkesë klienti
   merr përgjigjen rezervë. Zgjidhja: plan me pagesë (Dev Tier) ose prompt / vegla më të shkurtra.
2. **Porosi e dyfishtë:** nëse modeli e thërret `place_order` dy herë për të njëjtën porosi, krijohen dy porosi
   (çdo thirrje ka idempotency key të ri). E kufizon vetëm limiti 3/orë dhe konfirmimi. → Java 2: idempotency.
3. **Kufijtë (rate limits) dhe numëruesi ditor janë në memorie:** rinisen me serverin dhe nuk ndahen mes disa instancave.
4. **Historia e chat-it të faqes vjen nga shfletuesi:** klienti mund ta ndryshojë; veglat validohen gjithsesi.
5. **Kërkimi** është me fjalë / rrënjë + sinonime të shkruara me dorë, jo kërkim semantik.
6. **Të dhënat e katalogut:** postime ("OFERTA E PANAIRIT…", "Për hajr Bajrami…") janë produkte me çmim dhe dalin te
   listat; disa produkte kanë çmim 0 dhe nuk mund të porositen.
7. **Telegram në Render falas:** mesazhi i parë pas "gjumit" merr ~30–60 s.
8. **Tabelat e agjentit krijohen në përdorimin e parë** (jo nga migrimet).
9. **Ende pa evals me AI për përgjigjet e plota** (golden dataset, saktësia e zgjedhjes së veglës) → Java 3.
10. Mesazhet e klientëve ruhen 90 ditë te audit trail — duhet përmendur te politika e privatësisë.
