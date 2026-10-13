# 🏐 Sport Plánovač (Volleyball & Multisport Planner)

Moderní webová aplikace pro organizaci sportovních zápasů, správu docházky, týmů a generování českých QR plateb pro bankovní převody. Postaveno na React 19, TypeScriptu, Tailwind CSS a Upstash Redis serverless backendu na Vercelu.

---

## ✨ Klíčové funkce (Features)

### 🗄️ Moderní UX architektura & Drawery
- **Boční panel nastavení (`SettingsDrawer`)**: Nahrazuje dřívější nepřehledný modál 4 organizovanými záložkami (*Profil*, *Účty*, *Sporty*, *Tým*).
- **Uživatelské menu (`AppMenuDrawer`)**: Sjednocuje rychlou navigaci, exporty i správu týmu a odstraňuje shluk ikon v záhlaví.
- **Kompaktní kalendář (`CalendarView`)**: Přepínač **[Týden | Měsíc]** šetří přes 220 px vertikálního prostoru a zobrazuje nadcházející zápasy ihned na první pohled.
- **Synchronizační toast (`ReloadToast`)**: Plovoucí notifikace v pravém dolním rohu s plynulou animací rotace a okamžitou odezvou při obnově dat.

### 📱 Mobilní rozhraní bez kompromisů
- **Fixní Viewport Shell (`100dvh`)**: Eliminuje poskakování adresního řádku a kolize dvojitých scrollbarů na iOS/Androidu.
- **Sticky mobilní hlavička (`MobileHeader`)**: Elegantní atletický gradient s rychlým přístupem k akcím.
- **Plovoucí akční tlačítko (Elevated FAB)**: Rychlé vytvoření nové události přímo z dolní navigační lišty (`MobileBottomNav`).
- **Edge-to-Edge Flat Login obrazovky**: Kompletní redesign přihlašování uživatele i týmu — roztažení do všech rohů mobilní obrazovky (bez plovoucích karet či okrajových mezer), moderní flat styl s čistými vstupy a rychlým výběrem.
- **Desktopová elegance**: Na desktopu zachován původní styl se skleněnou kartou a ambientními světelnými efekty.

### 👥 Správa uživatelů & profilů
- Uživatelské profily s volitelnou fotografií (max 2 MB) a automatickým generováním iniciál.
- Rychlé fulltextové vyhledávání hráčů bez ohledu na diakritiku (např. *simon* najde *Šimon*).
- Mazání a správa uživatelů s potvrzovacím dialogem a kaskádovým čištěním docházky.

### 🏆 Multisport & Herní pravidla
- Podpora volejbalu, beach volejbalu, badmintonu, tenisu, spikeballu a dalších sportů.
- Nastavení kapacity hráčů, náhradníků, min/max počtu týmů a pravidel vyrovnávání týmů (Team Balancer).
- ELO rating systém, žebříčky a detailní statistiky výkonnosti a docházky.

### 📅 Události & Docházka
- Přehledné karty zápasů s automatickým výběrem prvního nadcházejícího termínu.
- Stavy docházky: *Jdu hrát*, *Na čekací listině*, *Nejdu*.
- Ochrana minulých událostí před nechtěnou změnou.
- Podpora sérií opakujících se událostí (týdně / jednou za 2 týdny).

### 💰 Platby & České QR kódy
- Automatické rozpočítání nákladů na hráče podle skutečné docházky.
- Okamžité generování platebního QR kódu (standard SPAYD) pro české bankovní převody s IBAN konverzí.
- Kopírování čísla účtu jedním kliknutím s vizuální odezvou.
- Správa více bankovních účtů s předvoleným výchozím účtem.

---

## 🚀 Rychlý start (Quick Start)

### Požadavky
- **Node.js 20+**
- **npm** nebo **yarn**

### Lokální vývoj

1. **Instalace závislostí:**
   ```bash
   npm install
   ```

2. **Konfigurace prostředí:**
   Vytvořte `.env.local` s přístupovými údaji pro Upstash Redis:
   ```env
   volejbal_KV_REST_API_URL=https://your-upstash-redis-url.upstash.io
   volejbal_KV_REST_API_TOKEN=your-upstash-token
   ```
   *(Pro lokální vývoj bez síťového Redisu lze spustit mock režim `npm run dev:mock`)*.

3. **Spuštění vývojových serverů:**
   ```bash
   npm run dev       # Spustí API proxy (:3001) i Vite frontend (:5173)
   ```

4. **Otevření v prohlížeči:** `http://localhost:5173`

---

## 🧪 Testování & Kvalita kódu

Projekt klade maximální důraz na testovací pokrytí a prevenci regresí:

```bash
npm test                      # Spustí Vitest ve watch módu
npm test -- --run             # Spustí všechny testy jednorázově
npm test -- --run --coverage  # Spustí testy včetně reportu pokrytí
npm run lint                  # Kontrola pomocí ESLint
```

- **Testy:** **469 testů / 32 testovacích souborů (100 % pass rate)** ✅
- **Kvalita kódu:** Husky pre-commit hook vynucuje **`eslint --max-warnings=0`** na všech fázovaných souborech.
