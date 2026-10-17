# Herní a produktová mechanika: Osobní hráčský dashboard (volejbal-app-v2)

> **Cíl dokumentu:** Ucelená produktová a matematická specifikace gamifikace, rankového a XP systému, výzev a retence pro aplikaci `volejbal-app-v2`.
> **Cílová skupina:** Amatérští a kluboví hráči volejbalu (a doplňkově tenisu/badmintonu), kteří se scházejí 1–2× týdně.

---

## 1. Produktová vize a psychologie amatérského volejbalu

Amatérský volejbal v přátelském nebo klubovém prostředí má specifickou dynamiku:
- **Organizační bolest:** Organizátor neustále řeší, zda se sejde plný počet (10–12 lidí na volejbal, 4 na čtyřhru tenisu). Odhlašování 3 hodiny před zápasem je noční můrou.
- **Finanční tření:** Nahánění drobných plateb za pronájem kurtu/haly (100–250 Kč na osobu) zatěžuje přátelské vztahy.
- **Sociální citlivost:** Úroveň hráčů se liší. Pokud systém odměňuje pouze výhry, slabší hráči ztrácejí motivaci, cítí se jako přítěž a postupně přestávají chodit.

### 3 zlatá pravidla gamifikace:
1. **Spolehlivost a přítomnost tvoří 75–80 % úspěchu:** Nejlepší spoluhráč není nutně ten, kdo dá nejtvrdší smeč, ale ten, na koho je 100% spolehnutí – přihlásí se včas, dorazí, včas zaplatí a bojuje o každý balón.
2. **Nulová toxicita a psychologické bezpečí:** Žádné veřejné trestání, žádný odpočet XP, žádné negativní štítky (např. „Největší dlužník“). XP funguje jako celoživotní akumulátor zkušeností.
3. **Okamžitá zpětná vazba a dopamin:** Každá událost končí shrnutím zisku XP, posunem v týdenních misích a jasným ukazatelem: *„Už jen 1 zápas do dalšího ranku!“*

---

## 2. Matematická specifikace XP křivky (Level 1 až 50+)

### 2.1 Základní parametry aktivity
- **Průměrný hráč:** 1,5 akce týdně = ~6 akcí za měsíc = **~75 akcí ročně**.
- **Průměrný zisk XP na 1 akci:** **~200 XP** (150 XP při smolném zápase s prohrou, až 260 XP při výhře 3:0 se sérií docházky a včasnou platbou).
- **Roční XP zisk běžného hráče:** cca **12 000 až 16 000 XP / rok**.

---

### 2.2 Matematický vzorec křivky
Levely jsou rozděleny do 4 fází s progresivním škálováním:

$$\Delta\text{XP}(L) = \text{XP potřebné k přechodu z Levelu } (L-1) \text{ do } L$$

$$\text{TotalXP}(L) = \sum_{i=2}^{L} \Delta\text{XP}(i), \quad \text{kde } \text{TotalXP}(1) = 0$$

1. **Fáze 1: Onboarding (Level 1–5) — Okamžitý dopamin:**
   $$\Delta\text{XP}(L) = 50 + 100 \times (L - 1) \quad \text{pro } L \in [2, 5]$$
   - *Level 2* po 1. hře (+150 XP)
   - *Level 3* po 2. hře (+250 XP)
   - *Level 4* po 3.–4. hře (+350 XP)
   - *Level 5* po cca 5. hře (+450 XP)

2. **Fáze 2: Budování návyku (Level 6–15) — 1 level každé 2–3 týdny:**
   $$\Delta\text{XP}(L) = 500 + 50 \times (L - 5) \quad \text{pro } L \in [6, 15]$$

3. **Fáze 3: Klubová opora (Level 16–35) — 1 level každé 4–6 týdnů:**
   $$\Delta\text{XP}(L) = 1000 + 25 \times (L - 15) \quad \text{pro } L \in [16, 35]$$

4. **Fáze 4: Veterán & Legenda (Level 36–50) — Prestige tempo:**
   $$\Delta\text{XP}(L) = 1500 \quad \text{pro } L \in [36, 50]$$

5. **Endgame (Level 50+):**
   - Každý další prestižní stupeň (Prestige Star ★) vyžaduje fixně **1 500 XP** (cca 7–8 odehraných akcí, tj. ~1,5 měsíce).

---

### 2.3 Tabulka milníků levelů a ranků

| Level | Rankový titul (Tier) | Ikona & Barva | Kumulativní XP | XP na další Level | Odhad akcí | Časový horizont |
|:---:|:---|:---:|:---:|:---:|:---:|:---|
| **1** | Antukový zelenáč | 🥉 Bronz | 0 XP | 150 XP | 0 | První přihlášení |
| **2** | Volejbalový rekrut | 🥉 Bronz | 150 XP | 250 XP | 1 | 1. trénink |
| **3** | Učeň příjmu | 🥉 Bronz | 400 XP | 350 XP | 2 | 1.–2. týden |
| **4** | Spolehlivý nahrávač | 🥉 Bronz | 750 XP | 450 XP | 3–4 | 2.–3. týden |
| **5** | Palubovkový bojovník | 🥉 Bronz | 1 200 XP | 550 XP | 5–6 | 1. měsíc |
| **6** | Polař základní řady | 🥈 Stříbro | 1 750 XP | 600 XP | 8 | 1,5 měsíce |
| **10** | Týmový pilíř | 🥈 Stříbro | 4 450 XP | 800 XP | 20 | 3 měsíce |
| **15** | Opora sestavy | 🥈 Stříbro | 8 950 XP | 1 025 XP | 42 | cca 6–7 měsíců |
| **16** | Mistr plachtícího servisu | 🥇 Zlato | 9 975 XP | 1 050 XP | 47 | 7–8 měsíců |
| **20** | Bloková zeď | 🥇 Zlato | 14 375 XP | 1 150 XP | 68 | cca 10–11 měsíců |
| **25** | Klubový špílmachr | 🥇 Zlato | 20 500 XP | 1 275 XP | 95 | **1,2 roku** |
| **26** | Zástupce kapitána | 💎 Platina | 21 775 XP | 1 300 XP | 102 | 1,4 roku |
| **30** | Hráč do koncovky | 💎 Platina | 27 225 XP | 1 400 XP | 128 | 1,8 roku |
| **35** | Taktický dirigent | 💎 Platina | 34 500 XP | 1 500 XP | 160 | 2,2 roku |
| **36** | Palubovkový virtuóz | 🔮 Diamant | 36 000 XP | 1 500 XP | 168 | 2,4 roku |
| **40** | Smečařský fenomén | 🔮 Diamant | 42 000 XP | 1 500 XP | 195 | 2,8 roku |
| **45** | Klubová ikona | 🔮 Diamant | 49 500 XP | 1 500 XP | 230 | 3,3 roku |
| **50** | **Volejbalová Síň slávy** | 👑 Master/Mýtický | 57 000 XP | 1 500 XP/★ | 265 | **3,5–4 roky** |

---

## 3. Bodový systém (XP Economy & Trigger Rules)

XP se po každé události sčítají ze 4 transparentních kategorií.

```
┌──────────────────────────────────────────────────────────────┐
│                    ZISK XP Z JEDNÉ AKCE                      │
├──────────────────────────────┬───────────────────────────────┤
│  A. ÚČAST A SPOLEHLIVOST     │  100 XP (Základní účast)      │
│     (cca 70–80 % celku)      │  +30 XP (Early Bird > 48h)    │
│                              │  +25 XP (Včasná platba do 24h)│
│                              │  +10 XP / odehraný set (3x10) │
├──────────────────────────────┼───────────────────────────────┤
│  B. SÉRIE ÚČASTÍ (STREAK)    │  +15 až +60 XP (Streak bonus) │
│                              │  +10 % Multiplikátor ("On Fire")│
├──────────────────────────────┼───────────────────────────────┤
│  C. HERNA A BOJOVNOST        │  +15 XP / vyhraný set         │
│     (cca 20–25 % celku)      │  +30 XP za výhru v zápase     │
│                              │  +25 XP Clutch / Comeback     │
│                              │  +20 XP Trojsetová bitva      │
└──────────────────────────────┴───────────────────────────────┘
```

### 3.1 Pilíř A: Docházka a spolehlivost (70–80 %)
- **Účast na akci (Base Attendance):** **+100 XP**
  - Základní kámen. Hráč dorazil a zapojil se do hry.
- **Včasná nominace (Early Bird):** **+30 XP**
  - Přihlášení se stavem `joined` více než 48 hodin před začátkem akce. Pomáhá organizátorovi zajistit kapacitu.
- **Záchranář sestavy (Last-Minute Hero):** **+40 XP**
  - Uděluje se, pokud se hráč přihlásí méně než 12 hodin před akcí na chybějící místo (např. když byl tým nekompletní a hrozilo zrušení).
  - *Nelze kombinovat s Early Bird na stejné akci.*
- **Včasná platba (Spolehlivý plátce):** **+25 XP**
  - Hráč označí / organizátor potvrdí platbu do 24 hodin od skončení akce.
- **Odehraný set (Úsilí bez ohledu na výsledek):** **+10 XP za každý odehraný set**
  - Typický volejbal na 3 sety = +30 XP jen za to, že hráč stál na hřišti.

### 3.2 Pilíř B: Herní zážitek a bojovnost (20–25 %)
- **Vyhraný set:** **+15 XP** (spolu s účastí v setu celkem 25 XP za vítězný set).
- **Vyhraný zápas (Match Winner):** **+30 XP** pro všechny hráče vítězného týmu.
- **Clutch moment (Těsná koncovka):** **+25 XP**
  - Set vyhraný o 2 body (např. 25:23, 26:24, 28:26) nebo tiebreak (15:13, 16:14). Odměňuje nervy ze železa.
- **Otočka zápasu (Comeback King):** **+25 XP**
  - Vítězství v zápase po prohraném prvním setu (1:2 na 2:1).
- **Trojsetová bitva (Maraton):** **+20 XP pro VŠECHNY hráče**
  - Zápas, který dospěl do 3. rozhodujícího setu. Oslavujeme vyrovnanou a kvalitní hru bez ohledu na to, kdo nakonec vyhrál.

### 3.3 Pilíř C: Série docházky (Streaks)
Streak se počítá jako počet po sobě jdoucích událostí, kterých se hráč zúčastnil:
- **2 účasti v řadě:** +15 XP
- **3 účasti v řadě:** +30 XP + odemčení statusu **„Na vlně (On Fire) 🔥“** (+10 % bonus ke všem získaným XP, dokud streak trvá).
- **5 účastí v řadě:** +60 XP
- **10 účastí v řadě:** +150 XP + trvalý odznak do profilu.

---

### 3.4 Srovnávací model: Bojovník vs. Hvězda

| Scénář | Hráč A (Nováček/Slabší, prohrál 1:2) | Hráč B (Zkušený smečař, vyhrál 2:0) |
|:---|:---:|:---:|
| Chování | Přihlášen 3 dny předem, zaplatil hned | Přihlásil se 6h předem, neplatil včas |
| Účast na akci | 100 XP | 100 XP |
| Early Bird (>48h) | 30 XP | 0 XP |
| Včasná platba | 25 XP | 0 XP |
| Odehrané sety | 30 XP (3 sety) | 20 XP (2 sety) |
| Vyhrané sety | 15 XP (1 set) | 30 XP (2 sety) |
| Výhra v zápase | 0 XP | 30 XP |
| Clutch set (výhra 26:24) | 25 XP | 0 XP |
| Trojsetová bitva | 20 XP | 0 XP |
| **CELKEM ZA VEČER** | **245 XP** | **180 XP** |

> **Závěr:** Hráč A, ačkoliv zápas prohrál, získal **o 65 XP více** díky spolehlivosti a bojovnosti v koncovce. Tím je stoprocentně odstraněna frustrace z prohry!

---

## 4. Osobní výzvy a milníky (Quests & Milestones)

Každý hráč má na svém dashboardu aktivní 3 typy misí:

```
┌─────────────────────────────────────────────────────────────┐
│                 VÝZVY HRÁČSKÉHO DASHBOARDU                  │
├─────────────────────────────────────────────────────────────┤
│ 1. TÝDENNÍ VÝZVY (Rotace každé pondělí)                     │
│    • Dvojitá porce: Zúčastni se 2 akcí v týdnu (+100 XP)    │
│    • Ranní ptáče: Přihlas se >48h před začátkem (+50 XP)   │
│    • Bojovník o každý bod: Vyhraj aspoň 1 clutch set (+75 XP│
├─────────────────────────────────────────────────────────────┤
│ 2. MĚSÍČNÍ SEZÓNNÍ EXPEDICE (Kalendářní měsíc)              │
│    • Železná docházka: Účast na ≥75 % akcí měsíce (+250 XP) │
│    • Týmový parťák: Zahraj si s 6 různými spoluhráči (+150 XP│
│    • Čisté konto: Všechny platby v měsíci včas (+150 XP)    │
├─────────────────────────────────────────────────────────────┤
│ 3. CELOŽIVOTNÍ TROFEJE (Bronze → Silver → Gold → Diamond)   │
│    • Zápasový maratonec: 10 / 25 / 50 / 100 účastí         │
│    • Král koncovek: 5 / 15 / 30 / 60 clutch výher           │
│    • Věrný veterán: 6 měsíců / 1 rok / 2 roky v klubu       │
└─────────────────────────────────────────────────────────────┘
```

### 4.1 "Smart Level-Up Predictor" v UI
Namísto suchého čísla `380 / 500 XP` dashboard zobrazuje dynamický přepočet na volejbalovou realitu:
- **Příklad:** *„Do Levelu 8 (Stříbrná divize) ti chybí už jen 70 XP! To znamená: 1 účast nebo 2 vyhrané sety na příštím volejbale.“*
- Algoritmus predikce vyhodnotí zbývající XP:
  - $\le 30$ XP: *„Stačí 1 včasná registrace nebo vyhraný set!“*
  - $31 - 100$ XP: *„Stačí 1 účast na příštím tréninku!“*
  - $101 - 180$ XP: *„Jedna skvělá účast se všemi bonusy nebo 2 standardní zápasy.“*

---

## 5. Anti-frustration & Retenční mechaniky

### 5.1 Ochrana streaku při dovolené a nemoci (Streak Shield / Vacation Freeze)
- **Problém:** Hráč má sérii 8 účastí v řadě, ale odjíždí na 14 dní na dovolenou nebo onemocní chřipkou. Přijít o celý streak by působilo demotivačně.
- **Mechanika:**
  - Každý hráč získá **1 Ochranný štít (Streak Shield)** za každých 5 odehraných zápasů (max. kapacita: 2 štíty).
  - Pokud se hráč odhlásí (`declined`) s předstihem $\ge 24$ hodin před akcí a zaškrtne důvod *„Dovolená / Nemoc“*, automaticky se aktivuje štít.
  - Streak nezmizí ani se nevynuluje, pouze se **„zmrazí“ (Frozen)**. Jakmile hráč přijde na další akci, jeho série plynule pokračuje (např. z 8 na 9).
  - **Trestá se pouze flaking:** Odhlášení na poslední chvíli (< 6h) nebo neúčast bez omluvy štít nespustí a streak se vynuluje.

### 5.2 Trvalost progresu (Zero XP Decay)
- Zkušenostní body (XP) ani dosažené levely **nikdy neklesají**.
- Pauza 3 měsíce hráče nevrací na Level 1.
- Pouze v ELO žebříčku se hráč po 45 dnech neaktivity přesouvá do sekce „Neaktivní hráči“, kde čeká na svůj návrat bez ztráty ratingu.

### 5.3 Onboarding dopaminový náběh (První 3 hry nováčka)
- **Hra 1:**
  - Automatický postup z Levelu 1 na **Level 2 (Volejbalový rekrut)**.
  - Odznak *„První smeč“* + 100 uvítacích XP.
- **Hra 2:**
  - Postup na **Level 3 (Učeň příjmu)**.
  - Odemčení týdenních výzev a zobrazení osobního radaru dovedností.
- **Hra 3:**
  - Postup na **Level 4** a plné odemčení ELO ratingu a statistik formy.

### 5.4 Návratový bonus (Welcome Back Quest)
Pokud hráč chyběl více než 4 týdny (zranění, zkouškové, práce), při dalším přihlášení obdrží jednorázovou misi:
- *„Vítej zpátky na palubovce! Dokonči dnešní zápas a získej uvítací bonus +150 XP a obnovení štítu.“*

---

## 6. Datové modely a integrace do architektury

### 6.1 TypeScript rozhraní (`types.ts`)

```typescript
export type RankTier = 'bronze' | 'silver' | 'gold' | 'platinum' | 'diamond' | 'hall_of_fame';

export interface PlayerGamificationState {
  userId: string;
  totalXp: number;
  currentLevel: number;
  rankTitle: string;
  rankTier: RankTier;
  xpInCurrentLevel: number;
  xpForNextLevel: number;
  levelProgressPercent: number; // 0 - 100
  
  // Streaks & Shields
  currentAttendanceStreak: number;
  longestAttendanceStreak: number;
  streakShieldsAvailable: number; // 0 - 2
  isStreakFrozen: boolean;
  isOnFire: boolean; // streak >= 3 -> +10% XP bonus
  
  // Predictor
  nextLevelDeficit: number;
  nextLevelHintText: string;
  
  // Quests
  activeQuests: ActiveQuest[];
  completedMilestones: string[];
}

export interface XpBreakdown {
  baseAttendance: number;
  earlyBird: number;
  lastMinuteHero: number;
  timelyPayment: number;
  setsPlayed: number;
  setsWon: number;
  matchWon: number;
  clutchWin: number;
  comebackWin: number;
  threeSetBattle: number;
  streakBonus: number;
  multiplierBonus: number;
  totalEarned: number;
}

export interface ActiveQuest {
  id: string;
  title: string;
  description: string;
  type: 'weekly' | 'monthly' | 'lifetime';
  progress: number;
  goal: number;
  xpReward: number;
  isCompleted: boolean;
  expiresAt?: string; // ISO date for weekly/monthly
}
```

### 6.2 Napojení na `statsEngine.ts`
Gamifikační engine lze přímo napojit na existující funkci `computeUserStats` a data z `SportEvent`.
- Každá odehraná akce projde čistou deterministickou funkcí `calculateEventXp(event, userId)`.
- Výsledek je cachován v `CompactedStats` pod klíčem `gamification[userId]`, takže mobilní aplikace nezaznamenává žádný pokles výkonu při načítání.

---

## 7. UI/UX koncept osobního dashboardu hráče

Při otevření záložky **Statistiky / Profil** v `volejbal-app-v2` se nahoře zobrazí nová hero komponenta:

```
┌─────────────────────────────────────────────────────────────┐
│ [Avatar] Lukas Burian               Lv. 18 🥇 ZLATO         │
│          Bloková zeď                 12 450 XP              │
│                                                             │
│ [████████████████████░░░░░░░] 74 % (Zbývá 280 XP do Lv. 19) │
│ 💡 Do dalšího levelu ti stačí: 1 účast + včasná platba      │
├─────────────────────────────────────────────────────────────┤
│ 🔥 Série docházky: 4 v řadě (Na vlně +10 % XP!)             │
│ 🛡️ Ochranné štíty: 1 / 2 k dispozici                         │
├─────────────────────────────────────────────────────────────┤
│ TÝDENNÍ VÝZVY:                                              │
│ • [✓] Včasné přihlášení (>48h)              +30 XP (HOTOVO) │
│ • [===>    ] Dvojitá porce: 1/2 akcí odehráno (+100 XP)     │
│ • [        ] Vyhraj clutch set (≤2b rozdíl)  (+75 XP)       │
└─────────────────────────────────────────────────────────────┘
```

1. **Barevné odlišení dle tieru:** Bronzová, stříbrná, zlatá, platinová a diamantová aura kolem avatara.
2. **Animovaný progress bar:** Při otevření se plynule naplní a zobrazí kontextovou nápovědu.
3. **Plovoucí badge:** Po skončení zápasu vyskočí gratulační modal s rozpadem získaných XP a případným odemčením nového levelu.
