import React from 'react';
import { Sparkles, Zap, CheckCircle2, Smartphone, Layout, FlaskConical, CreditCard, ArrowLeft, Trophy, BookOpen, UserCircle, BarChart3, Target, Puzzle, RefreshCw, Repeat2 } from 'lucide-react';

interface ReleaseNotesPageProps {
  onClose: () => void;
}

interface ChangeEntry {
  icon: React.ReactNode;
  title: string;
  items: string[];
}

const versions: { version: string; date: string; title: string; changes: ChangeEntry[] }[] = [
  {
    version: '1.4.0',
    date: '13. 4. 2026',
    title: 'Multi-strategie míchání týmů',
    changes: [
      {
        icon: <Repeat2 size={16} />,
        title: 'Různé týmy při každém zamíchání',
        items: [
          'Tlačítko „Zamíchat" nyní pokaždé vytvoří jiné složení týmů',
          '3 vyvažovací strategie se střídají: Jittered Snake Draft, Greedy Swap, Random Partition',
          'Algoritmus se vyhýbá předchozímu složení — nové týmy jsou vždy odlišné',
          'Všechny strategie zachovávají vyváženost — rozdíl v celkovém ratingu týmů zůstává minimální',
        ],
      },
      {
        icon: <BarChart3 size={16} />,
        title: '3 vyvažovací strategie',
        items: [
          'Jittered Snake Draft — snake-draft s náhodným šumem na ratingy, jinak seřazení hráči každé kolo',
          'Greedy Swap — náhodné rozdělení + iterativní výměny hráčů pro minimální rozdíl ratingu',
          'Random Partition — náhodné rozdělení + hill-climbing optimalizace nejlepší výměnou',
        ],
      },
      {
        icon: <FlaskConical size={16} />,
        title: 'Testy',
        items: [
          '20 nových testů pro multi-strategie: teamsAreSame, previousTeams, jitteredSnakeDraft, greedySwapBalance, randomPartitionBalance',
          '47 testů v teamBalancer, 207 testů celkem',
        ],
      },
    ],
  },
  {
    version: '1.3.0',
    date: '6. 4. 2026',
    title: 'Chytré týmy, skóre setů a refaktoring',
    changes: [
      {
        icon: <BarChart3 size={16} />,
        title: 'Vyvážené rozdělení týmů',
        items: [
          'Týmy se nyní rozdělují podle výkonnosti hráčů (poměr výher a skóre setů)',
          'Snake-draft algoritmus — nejsilnější hráč do jednoho týmu, druhý nejsilnější do druhého, atd.',
          'Hráči s méně než 3 odehranými hrami dostanou průměrné hodnocení skupiny (minimální datový práh)',
          'Blended rating: 60 % poměr výher + 40 % výkon v setech',
          'Plně zpětně kompatibilní — funguje i pro události bez historie',
        ],
      },
      {
        icon: <Target size={16} />,
        title: 'Sledování skóre setů',
        items: [
          'U každé hry lze zadat skóre jednotlivých setů (např. 25:20, 18:25, 15:12)',
          'Přehledné zobrazení s barevným zvýrazněním vítězných setů',
          'Souhrn setů (např. 2:1 na sety) pod výsledky',
          'Skóre se ukládá i do historie her a zobrazuje se u předchozích kol',
          'Data ze setů zlepšují přesnost vyvažování týmů',
        ],
      },
      {
        icon: <Puzzle size={16} />,
        title: 'Refaktoring EventDetail',
        items: [
          'Monolitní komponenta (1 133 řádků) rozdělena do 14 souborů',
          'Největší soubor má nyní max 219 řádků — snadnější čtení a údržba',
          '4 custom hooks: useTeamManagement, useScoreTracking, useParticipants, usePhotoUpload',
          '6 sub-komponent: Header, ParticipantList, WaitlistSection, TeamSection, ScoreEditor, PaymentSection',
          'IBAN konverze přesunuta do utils/iban.ts',
          'Všechny importy používají @/ path alias místo relativních cest',
        ],
      },
      {
        icon: <RefreshCw size={16} />,
        title: 'UX vylepšení',
        items: [
          'Tlačítko „Zamíchat" / „Nová hra" se animuje při míchání týmů',
          'Kompaktnější přihlašovací obrazovka — horizontální layout s menším paddingem',
          'Odebrán sport Fotbal a Florbal — aplikace podporuje Volejbal, Tenis a Badminton',
          'Týmy se automaticky aktualizují při změně účastníků (přidání / odebrání hráče)',
        ],
      },
      {
        icon: <FlaskConical size={16} />,
        title: 'Testy',
        items: [
          '27 testů pro teamBalancer — snake-draft, blended rating, minimální práh, zpětná kompatibilita',
          '185 testů celkem — vše prochází',
        ],
      },
    ],
  },
  {
    version: '1.2.0',
    date: '29. 3. 2026',
    title: 'Více her, async platby a stabilita',
    changes: [
      {
        icon: <CreditCard size={16} />,
        title: 'Okamžité platby',
        items: [
          'Zaškrtnutí „Zaplaceno" se projeví okamžitě bez načítání celé stránky',
          'Změna účasti (Jdu / Nejdu) je nyní okamžitá s pozadovým uložením',
          'Při chybě se stav automaticky vrátí zpět (rollback)',
          'Každý účastník má vlastní indikátor ukládání místo blokování celé obrazovky',
        ],
      },
      {
        icon: <Trophy size={16} />,
        title: 'Více her na událost',
        items: [
          'Po označení vítěze lze zamíchat nové týmy a hrát další kolo',
          'Kompletní historie her s přehledem týmů a výherců u každé události',
          'Statistiky (výhry, win streak, duo stats) počítají všechna odehraná kola',
        ],
      },
      {
        icon: <BookOpen size={16} />,
        title: 'Seznam změn',
        items: [
          'Nová stránka „Seznam změn" s přehledem všech verzí',
          'Přístupná z desktopové hlavičky (ℹ️) i z mobilního nastavení',
        ],
      },
      {
        icon: <UserCircle size={16} />,
        title: 'Úprava profilu',
        items: [
          'Změna jména přímo v nastavení — klikněte na tužku vedle jména',
          'Změna nebo odebrání profilové fotky v nastavení',
          'Nastavení přejmenováno na „Nastavení" s profilem i bankovním účtem na jednom místě',
        ],
      },
      {
        icon: <CheckCircle2 size={16} />,
        title: 'Opravy a vylepšení',
        items: [
          'Seznam účastníků se již nepřeuspořádává po synchronizaci — stabilní řazení podle jména (česká abeceda)',
          'Zaškrtávací políčko „Zaplaceno / Nezaplaceno" má fixní šířku — text se nepohybuje',
        ],
      },
    ],
  },
  {
    version: '1.1.0',
    date: '29. 3. 2026',
    title: 'Mobilní redesign a rozdělení kódu',
    changes: [
      {
        icon: <Smartphone size={16} />,
        title: 'Přepracované mobilní rozhraní',
        items: [
          'Mobilní zobrazení po sekcích — kalendář, detail události a statistiky na samostatných obrazovkách',
          'Spodní navigační lišta s tlačítky Kalendář, ➕ (nová událost), Statistiky a Nastavení',
          'Kontextová hlavička — název aplikace na kalendáři, šipka zpět + název na detailu',
          'Plynulé animace přechodů mezi sekcemi (slide + fade)',
          'Přihlašovací obrazovka na celou šířku displeje na mobilu',
        ],
      },
      {
        icon: <Layout size={16} />,
        title: 'Rozdělení kódu',
        items: [
          'App.tsx zmenšen z 512 na 276 řádků',
          'Nové komponenty: EventCard, EventList, MobileBottomNav, MobileHeader',
          'Výpočet dluhů extrahován do čisté funkce (utils/debt.ts)',
        ],
      },
      {
        icon: <FlaskConical size={16} />,
        title: 'Nové testy',
        items: [
          '42 nových testů v 5 souborech',
          'Pokrytí: výpočet dluhů, karty událostí, seznamy, navigace, hlavička',
        ],
      },
    ],
  },
  {
    version: '1.0.0',
    date: '28. 3. 2026',
    title: 'Základní verze',
    changes: [
      {
        icon: <Sparkles size={16} />,
        title: 'Funkce',
        items: [
          'Správa sportovních událostí — vytváření, úprava, mazání',
          'Kalendářové zobrazení s přehledem nadcházejících akcí',
          'Účast hráčů — Jdu / Nejdu s automatickým počítáním',
          'Platby — sledování zaplacení, výpočet částky na osobu',
          'QR kódy pro české bankovní převody (SPD formát s IBAN)',
          'Správa bankovních účtů v nastavení',
          'Rozdělení do týmů s náhodným zamícháním',
          'Označení vítězného týmu',
          'Fotografie hráčů s nahráváním a náhledem',
          'Statistiky — docházka, platby, žebříček, duo statistiky, odznaky',
          'Banner s upozorněním na nezaplacené události',
          'Responzivní design pro desktop i mobil',
        ],
      },
      {
        icon: <Zap size={16} />,
        title: 'Technologie',
        items: [
          'React 19 + TypeScript + Tailwind CSS',
          'Vercel Serverless Functions + Upstash Redis',
          'Vite build systém s hot reload',
          'Vitest + React Testing Library',
        ],
      },
    ],
  },
];

export const ReleaseNotesPage: React.FC<ReleaseNotesPageProps> = ({ onClose }) => {
  return (
    <div className="relative max-w-3xl mx-auto w-full">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <button
          onClick={onClose}
          className="hidden md:flex p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-200 rounded-lg transition-all"
          title="Zavřít"
        >
          <ArrowLeft size={20} />
        </button>
        <div>
          <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
            <Sparkles size={24} className="text-amber-500" />
            Seznam změn
          </h1>
          <p className="text-sm text-slate-500 mt-0.5">Co je nového v Sport Plánovači</p>
        </div>
      </div>

      {/* Timeline */}
      <div className="space-y-8">
        {versions.map((release, idx) => (
          <div key={release.version} className="relative">
            {/* Version badge */}
            <div className="flex items-center gap-3 mb-4">
              <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-sm font-bold ${
                idx === 0
                  ? 'bg-blue-100 text-blue-700'
                  : 'bg-slate-100 text-slate-600'
              }`}>
                v{release.version}
              </span>
              <span className="text-sm text-slate-400">{release.date}</span>
              {idx === 0 && (
                <span className="text-[10px] uppercase tracking-wider font-bold text-green-600 bg-green-50 px-2 py-0.5 rounded-full">
                  Aktuální
                </span>
              )}
            </div>

            <h2 className="text-lg font-semibold text-slate-700 mb-3">{release.title}</h2>

            <div className="space-y-4">
              {release.changes.map((section, sIdx) => (
                <div
                  key={sIdx}
                  className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm"
                >
                  <h3 className="text-sm font-bold text-slate-700 flex items-center gap-2 mb-2">
                    <span className="text-blue-600">{section.icon}</span>
                    {section.title}
                  </h3>
                  <ul className="space-y-1.5">
                    {section.items.map((item, iIdx) => (
                      <li key={iIdx} className="flex items-start gap-2 text-sm text-slate-600">
                        <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-slate-300 shrink-0" />
                        {item}
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>

            {/* Divider between versions */}
            {idx < versions.length - 1 && (
              <div className="mt-8 border-t border-dashed border-slate-200" />
            )}
          </div>
        ))}
      </div>

      {/* Footer */}
      <div className="mt-8 text-center text-xs text-slate-400 pb-4">
        Sport Plánovač — vytvořeno s ❤️ pro hráče
      </div>
    </div>
  );
};

