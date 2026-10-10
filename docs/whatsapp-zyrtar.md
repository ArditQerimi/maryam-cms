# WhatsApp zyrtar (Meta Cloud API) për Dyqanin Elif

Ky udhëzues është për personin që krijon llogarinë e biznesit te Meta. Kodi i bot-it është gati: pasi të
bëhen hapat më poshtë, bot-i u përgjigjet klientëve në WhatsApp (produkte, çmime, dërgesë, porosi) dhe
pronarit i dërgon porositë e reja me butonat **Konfirmo / Anulo**.

**Kush e bën:** një person me llogari Facebook **të vërtetë, të vjetër dhe pa kufizime**. Ky person mbetet
pronar dhe admin i biznesit te Meta.

**Çka duhet:**
- një **numër telefoni për dyqanin** që **nuk** është i regjistruar në aplikacionin WhatsApp (numër i ri, ose
  numër të cilit i fshihet llogaria WhatsApp para se të lidhet);
- emaili i dyqanit;
- për fazën e fundit (verifikimi): dokumenti i regjistrimit të biznesit (p.sh. certifikata nga ARBK).

---

## 1. Business portfolio
1. Hap <https://business.facebook.com/overview> → **Create a business portfolio**.
2. Emri: **Dyqani Elif** (pa shenja speciale), emri yt, emaili i dyqanit → **Submit**.
3. Konfirmo emailin që vjen nga Meta.
4. Aktivizo **verifikimin me dy hapa** (Facebook → Settings → Accounts Center → Password and security).

## 2. Appi
1. Hap <https://developers.facebook.com/apps> → **Create app**.
2. Te **Use cases** zgjedh vetëm **Connect with customers through WhatsApp** → **Next**.
3. Te **Business** zgjedh **Dyqani Elif** → **Next** → **Create app**.

## 3. Provë me numrin testues (falas, pa verifikim)
1. Në app: **WhatsApp → API Setup**. Meta jep një numër testues dhe **Phone number ID**.
2. Te **To** shto numrin e pronarit (dhe 1–4 numra për provë) dhe konfirmoji me kodin që vjen në WhatsApp.

## 4. Token-i i përhershëm
1. <https://business.facebook.com/settings> → **Users → System users** → **Add**: emri `shop-bot`, roli **Admin**.
2. **Assign assets** → zgjedh appin → **Full control**.
3. **Generate new token** → zgjedh appin → lejet `whatsapp_business_messaging` dhe
   `whatsapp_business_management` → **Generate**.
4. Ruaje token-in diku të sigurt. **Mos e dërgo me chat / email.** E vendos vetëm te Render (hapi 6).

## 5. App secret
Në app: **App settings → Basic → App secret → Show**. Edhe këtë vendose vetëm te Render.

## 6. Variablat te Render (faqja e dyqanit → Environment)
| Variabla | Vlera |
|---|---|
| `WHATSAPP_CLOUD_TOKEN` | token-i nga hapi 4 |
| `WHATSAPP_PHONE_NUMBER_ID` | **Phone number ID** nga API Setup (jo vetë numri) |
| `WHATSAPP_APP_SECRET` | App secret nga hapi 5 |
| `WHATSAPP_VERIFY_TOKEN` | një fjalë e rastësishme e gjatë (min. 12 shkronja), p.sh. `elif-webhook-7Kq2vR9x` |
| `WHATSAPP_OWNER_TO` | numri i pronarit që merr porositë, me kodin e shtetit, vetëm shifra: `38349…` |

Pas ruajtjes, Render e rinis faqen vetë.

## 7. Webhook-u
1. Në app: **WhatsApp → Configuration → Webhook → Edit**.
2. **Callback URL:** `https://DOMENI-I-DYQANIT/api/whatsapp/cloud`
3. **Verify token:** e njëjta fjalë si `WHATSAPP_VERIFY_TOKEN` → **Verify and save**.
4. Te **Webhook fields** → **messages** → **Subscribe**.

**Prova:** nga një numër i shtuar te hapi 3, shkruaji numrit testues "Përshëndetje, a e keni Sahihun e
Buhariut?". Duhet të vijë përgjigjja e asistentit brenda pak sekondash.

## 8. Numri i vërtetë i dyqanit (që t'u shkruajë të gjithë klientëve)
1. **WhatsApp → API Setup → Add phone number**: emri që shfaqet (**Dyqani Elif**), kategoria, numri,
   konfirmimi me SMS / thirrje.
2. **Business verification**: <https://business.facebook.com/settings> → **Security center → Start
   verification** → të dhënat dhe dokumenti i biznesit. Zgjat zakonisht disa ditë.
3. Te Render ndrysho `WHATSAPP_PHONE_NUMBER_ID` me ID-në e numrit të ri.
4. Shto **mënyrën e pagesës** te WhatsApp Manager (vetëm për mesazhet që i nis dyqani; përgjigjet ndaj
   klientëve brenda 24 orëve janë falas).

## Opsionale: njoftimet e porosive pas 24 orësh
WhatsApp lejon mesazhe të lira vetëm brenda 24 orëve nga mesazhi i fundit i pronarit. Që porositë të vijnë
gjithmonë, krijo te **WhatsApp Manager → Message templates** një shabllon **Utility**, gjuha **Albanian**,
me tekst p.sh.:

> Porosi e re #{{1}}: {{2}}. Totali: {{3}}.

Pasi të aprovohet, vendos emrin e tij te Render si `WHATSAPP_ORDER_TEMPLATE`.

---

### Si funksionon (për zhvilluesin)
- Webhook: `src/app/api/whatsapp/cloud/route.ts` — kontrollon nënshkrimin e Meta-s (`x-hub-signature-256`),
  pronari konfirmon / anulon porosi, të gjithë të tjerët marrin asistentin (`src/lib/agent/whatsapp.ts`).
- Dërgimi: `src/lib/whatsapp-cloud.ts`.
- Prova lokale pa Meta: `scripts/whatsapp-cloud-sim.mjs` (udhëzimet në krye të skedarit).
- `WHATSAPP_CLOUD_AGENT=off` e ndal asistentin pa prekur njoftimet e porosive.
