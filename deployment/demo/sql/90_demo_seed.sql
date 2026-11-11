/*******************************************************************************
 * AeroLMS - předváděcí data (PŘEDVÁDĚCÍ INSTANCE)
 *
 * Spouští se po 00_helios_simulation.sql a po produkčních skriptech
 * deployment/sql/02-10. Všechna data jsou smyšlená: jména zaměstnanců, obsah
 * školení, testy i výsledky. Skutečná data z Heliosu tu nejsou žádná.
 *
 * Co naplní:
 *   - mzdová období a 17 zaměstnanců (1 administrátor, 2 školitelé, 12 pracovníků
 *     v evidenčním stavu a 2 bývalí zaměstnanci, které pohled správně skryje)
 *   - 29 školení se jmény, popisem, obsahem a dobou platnosti
 *   - přiřazení školitelů (3 školení zůstávají bez školitele pro ukázku správy)
 *   - testy s otázkami u šesti školení (CMM má i druhou, neaktivní variantu)
 *   - matici požadovaných školení a data posledního absolvování; data se počítají
 *     od dne naplnění, takže přehledy ukazují platná, brzy končící i prošlá školení
 *   - historii prezenčních zkoušek a certifikáty
 *
 * Hesla účtů přicházejí z proměnných sqlcmd (-v), do repozitáře se nezapisují:
 *   DEMO_ADMIN_PASSWORD, DEMO_TRAINER_PASSWORD, DEMO_WORKER_PASSWORD
 *
 * Skript odmítne běžet nad databází, která už zaměstnance obsahuje.
 ******************************************************************************/

USE Helios003;
GO

SET NOCOUNT ON;
SET XACT_ABORT ON;

IF NOT EXISTS (SELECT 1 FROM sys.extended_properties
               WHERE class = 0 AND name = N'AeroLMS.HeliosSimulation')
BEGIN
    RAISERROR('Databaze neni oznacena jako simulace Heliosu. Predvadeci data se do ni nezapisuji.', 16, 1);
    SET NOEXEC ON;
END
GO

IF EXISTS (SELECT 1 FROM dbo.TabCisZam)
BEGIN
    RAISERROR('TabCisZam uz obsahuje zamestnance. Predvadeci data se zapisuji jen do prazdne databaze.', 16, 1);
    SET NOEXEC ON;
END
GO

BEGIN TRANSACTION;

DECLARE @dnes DATE = CAST(GETDATE() AS DATE);

-- ============================================================================
-- 1. Mzdová období: posledních 12 měsíců, aktuální měsíc má Stav = 1
-- ============================================================================
;WITH mesice AS (
    SELECT 11 AS zpet
    UNION ALL
    SELECT zpet - 1 FROM mesice WHERE zpet > 0
)
INSERT INTO dbo.TabMzdObd (Rok, Mesic, Stav)
SELECT YEAR(DATEADD(month, -zpet, @dnes)),
       MONTH(DATEADD(month, -zpet, @dnes)),
       CASE WHEN zpet = 0 THEN 1 ELSE 0 END
FROM mesice
ORDER BY zpet DESC;

DECLARE @aktualniObdobi INT = (SELECT ID FROM dbo.TabMzdObd WHERE Stav = 1);
DECLARE @starsiObdobi INT = (SELECT MIN(ID) FROM dbo.TabMzdObd);

-- ============================================================================
-- 2. Zaměstnanci
--    stav: A = v evidenčním stavu, O = odešel (v aktuálním období mimo stav),
--          S = má jen starší mzdový záznam (pohled ho rovněž skryje)
-- ============================================================================
CREATE TABLE #Zam (
    Cislo    INT NOT NULL PRIMARY KEY,
    Jmeno    NVARCHAR(100) NOT NULL,
    Prijmeni NVARCHAR(100) NOT NULL,
    Heslo    NVARCHAR(255) NOT NULL,
    Role     NVARCHAR(50) NOT NULL,
    Email    NVARCHAR(255) NULL,
    Pozice   NVARCHAR(60) NOT NULL,
    Stav     CHAR(1) NOT NULL
);

INSERT INTO #Zam (Cislo, Jmeno, Prijmeni, Heslo, Role, Email, Pozice, Stav) VALUES
    (900001, N'Jana',     N'Dvořáková',   N'$(DEMO_ADMIN_PASSWORD)',   N'ADMIN',   N'admin@lms.inspiritenergy.cz',            N'Personalistka',            'A'),
    (900002, N'Petr',     N'Novotný',     N'$(DEMO_TRAINER_PASSWORD)', N'TRAINER', N'skolitel.kvalita@lms.inspiritenergy.cz', N'Vedoucí kvality',          'A'),
    (900003, N'Lucie',    N'Marková',     N'$(DEMO_TRAINER_PASSWORD)', N'TRAINER', N'skolitel.bozp@lms.inspiritenergy.cz',    N'Specialistka BOZP a IT',   'A'),
    (100101, N'Martin',   N'Svoboda',     N'$(DEMO_WORKER_PASSWORD)',  N'WORKER',  NULL, N'Operátor CNC',             'A'),
    (100102, N'Tomáš',    N'Černý',       N'$(DEMO_WORKER_PASSWORD)',  N'WORKER',  NULL, N'Operátor CNC',             'A'),
    (100103, N'Eva',      N'Procházková', N'$(DEMO_WORKER_PASSWORD)',  N'WORKER',  NULL, N'Kontrolorka kvality',      'A'),
    (100104, N'Jiří',     N'Kučera',      N'$(DEMO_WORKER_PASSWORD)',  N'WORKER',  NULL, N'Seřizovač',                'A'),
    (100105, N'Kateřina', N'Veselá',      N'$(DEMO_WORKER_PASSWORD)',  N'WORKER',  NULL, N'Metroložka',               'A'),
    (100106, N'Pavel',    N'Horák',       N'$(DEMO_WORKER_PASSWORD)',  N'WORKER',  NULL, N'Operátor EDM',             'A'),
    (100107, N'Lenka',    N'Němcová',     N'$(DEMO_WORKER_PASSWORD)',  N'WORKER',  NULL, N'Kontrolorka kvality',      'A'),
    (100108, N'Michal',   N'Pokorný',     N'$(DEMO_WORKER_PASSWORD)',  N'WORKER',  NULL, N'Operátor CNC',             'A'),
    (100109, N'Veronika', N'Králová',     N'$(DEMO_WORKER_PASSWORD)',  N'WORKER',  NULL, N'Skladnice',                'A'),
    (100110, N'David',    N'Jelínek',     N'$(DEMO_WORKER_PASSWORD)',  N'WORKER',  NULL, N'Údržbář',                  'A'),
    (100111, N'Hana',     N'Růžičková',   N'$(DEMO_WORKER_PASSWORD)',  N'WORKER',  NULL, N'Operátorka značení',       'A'),
    (100112, N'Ondřej',   N'Fiala',       N'$(DEMO_WORKER_PASSWORD)',  N'WORKER',  NULL, N'Technolog',                'A'),
    (100113, N'Roman',    N'Bartoš',      N'$(DEMO_WORKER_PASSWORD)',  N'WORKER',  NULL, N'Operátor CNC',             'O'),
    (100114, N'Simona',   N'Urbanová',    N'$(DEMO_WORKER_PASSWORD)',  N'WORKER',  NULL, N'Kontrolorka kvality',      'S');

INSERT INTO dbo.TabCisZam (Cislo, Jmeno, Prijmeni, Alias)
SELECT Cislo, Jmeno, Prijmeni, Heslo FROM #Zam ORDER BY Cislo;

INSERT INTO dbo.TabCisZam_EXT (ID, _DruhPozice)
SELECT t.ID, z.Pozice
FROM #Zam z JOIN dbo.TabCisZam t ON t.Cislo = z.Cislo;

INSERT INTO dbo.TabMzNastupPP (ZamestnanecId, DatumNastupu)
SELECT t.ID, DATEADD(day, -(400 + (z.Cislo % 97) * 31), @dnes)
FROM #Zam z JOIN dbo.TabCisZam t ON t.Cislo = z.Cislo;

-- Mzdové záznamy: aktivní a odešlí mají záznam v aktuálním období, "S" jen ve starším.
INSERT INTO dbo.TabZamMzd (ZamestnanecId, IdObdobi, StavES, DruhPP)
SELECT t.ID,
       CASE WHEN z.Stav = 'S' THEN @starsiObdobi ELSE @aktualniObdobi END,
       CASE WHEN z.Stav = 'O' THEN 2 ELSE 0 END,
       0
FROM #Zam z JOIN dbo.TabCisZam t ON t.Cislo = z.Cislo;

-- Role a e-maily: stejnou cestou jako aplikace, tedy zápisem do pohledu.
-- Trigger INSTEAD OF INSERT je uloží do InspiritUserAuth.
-- Záznam dostává jen administrátor a školitelé. Pracovník ho nepotřebuje (pohled
-- mu roli WORKER doplní sám) a produkční tabulka má na sloupci email obyčejné
-- omezení UNIQUE, které v SQL Serveru připustí jediný řádek bez e-mailu.
INSERT INTO dbo.InspiritCisZam (ID, Cislo, role, email, Alias, Jmeno, Prijmeni, createdAt, updatedAt)
SELECT t.ID, z.Cislo, z.Role, z.Email, z.Heslo, z.Jmeno, z.Prijmeni, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM #Zam z JOIN dbo.TabCisZam t ON t.Cislo = z.Cislo
WHERE z.Email IS NOT NULL;

-- ============================================================================
-- 3. Školení
--    Platnost v měsících odpovídá produkčnímu pohledu (03_create_inspirit_view.sql).
--    Skolitel = osobní číslo školitele, NULL = školení zatím bez školitele.
--    Body = tři hesla oddělená svislítkem, z nichž vzniká osnova obsahu.
-- ============================================================================
CREATE TABLE #Skoleni (
    Kod      NVARCHAR(100) NOT NULL PRIMARY KEY,
    Nazev    NVARCHAR(500) NOT NULL,
    Popis    NVARCHAR(1000) NOT NULL,
    Platnost INT NOT NULL,
    Skolitel INT NULL,
    Body     NVARCHAR(1000) NOT NULL
);

INSERT INTO #Skoleni (Kod, Nazev, Popis, Platnost, Skolitel, Body) VALUES
(N'CMM', N'Souřadnicové měření (CMM)', N'Zásady přesného měření na souřadnicovém měřicím stroji, příprava dílu a vyhodnocení protokolu.', 24, 900002, N'Příprava dílu a měrového střediska|Kvalifikace snímacích doteků|Vyhodnocení a archivace protokolu'),
(N'EDM', N'Elektroerozivní obrábění (EDM)', N'Bezpečná obsluha elektroerozivních strojů, kontrola dielektrika a ověření povrchu po obrábění.', 12, 900002, N'Kontrola dielektrika a filtrace|Upnutí dílu a elektrody|Kontrola přetavené vrstvy po obrábění'),
(N'EleZnaceni', N'Elektrochemické značení dílů', N'Postup elektrochemického značení, volba šablony a elektrolytu a neutralizace povrchu po značení.', 24, 900002, N'Volba šablony a elektrolytu podle materiálu|Nastavení parametrů značení|Neutralizace a kontrola čitelnosti'),
(N'ITBezpecnost', N'IT bezpečnost', N'Pravidla bezpečné práce s firemními systémy, hesly, e-mailem a zákaznickými daty.', 12, 900003, N'Hesla a přihlašování|Podvodné e-maily a přílohy|Ochrana zákaznických dat a výkresů'),
(N'KnihaStroje', N'Kniha stroje', N'Vedení záznamů o stavu, seřízení a údržbě stroje a jejich význam pro zpětnou dohledatelnost.', 24, 900003, N'Co a kdy se do knihy stroje zapisuje|Záznamy o poruchách a opravách|Předání stroje mezi směnami'),
(N'KontrPrijZboz', N'Kontrola přijatého zboží', N'Vstupní kontrola materiálu a nakupovaných dílů, ověření dokladů a uvolnění do výroby.', 36, 900002, N'Kontrola dodacích dokladů a atestů|Vizuální a rozměrová kontrola dodávky|Označení a uložení neshodné dodávky'),
(N'MerAVyhodOpotrebeni', N'Měření a vyhodnocení opotřebení', N'Měření opotřebení nástrojů a přípravků, mezní hodnoty a rozhodnutí o výměně.', 24, 900002, N'Druhy opotřebení břitu|Měření opotřebení a mezní hodnoty|Záznam a rozhodnutí o výměně nástroje'),
(N'Meridla', N'Měřidla a jejich používání', N'Správné používání dílenských měřidel, kontrola kalibrace a zacházení s měřidly.', 24, 900002, N'Kontrola kalibrační značky před měřením|Správná technika měření|Uložení a ochrana měřidel'),
(N'MonitorVyraCMTDilu', N'Monitoring výroby CMT dílů', N'Sledování parametrů výroby kritických dílů a reakce na odchylky od stanoveného procesu.', 12, 900002, N'Sledované parametry procesu|Reakce na překročení mezí|Záznam o průběhu operace'),
(N'NakladaniLatkami', N'Nakládání s chemickými látkami', N'Bezpečná práce s chemickými látkami a směsmi, bezpečnostní listy, skladování a první pomoc.', 36, 900003, N'Bezpečnostní listy a značení obalů|Osobní ochranné pomůcky|Postup při úniku a první pomoc'),
(N'OpotrebeniNastrojuuCMT', N'Opotřebení nástrojů u CMT dílů', N'Limity opotřebení nástrojů při obrábění kritických dílů a povinné výměny nástrojů.', 24, 900002, N'Limity životnosti nástroje|Povinná výměna před dokončovací operací|Evidence použitých nástrojů'),
(N'PouzitiNatsroju', N'Použití nástrojů', N'Volba, kontrola a správné použití řezných nástrojů podle technologického postupu.', 24, 900002, N'Nástroj podle technologického postupu|Kontrola nástroje před upnutím|Vracení a označení opotřebených nástrojů'),
(N'PozdavkyEN10204Dodak', N'Požadavky EN 10204 na dodací dokumentaci', N'Druhy dokumentů kontroly podle EN 10204 a jejich ověření při příjmu materiálu.', 24, NULL, N'Druhy dokumentů kontroly 2.1 až 3.2|Co musí atest obsahovat|Archivace a dohledatelnost'),
(N'PraceKonProdukt', N'Práce s konečným produktem', N'Manipulace, ochrana a balení hotových dílů tak, aby nedošlo k jejich poškození.', 36, 900002, N'Manipulace v rukavicích a ochrana povrchu|Konzervace a balení|Označení a doprovodné doklady'),
(N'Pruvodka', N'Průvodka', N'Práce s výrobní průvodkou: potvrzování operací, záznamy kontrol a zpětná dohledatelnost.', 24, 900002, N'Co průvodka obsahuje|Potvrzení operace a kontroly|Postup při ztrátě nebo poškození průvodky'),
(N'RazK1K', N'Ražení K1K', N'Zásady ražení identifikačních znaků na dílech včetně povolených míst a hloubky ražby.', 24, NULL, N'Povolená místa pro ražení|Kontrola razidel|Čitelnost a hloubka ražby'),
(N'RegulacniKarty', N'Regulační karty (SPC)', N'Vedení regulačních karet, čtení trendů a reakce na signály nestability procesu.', 24, 900002, N'Zápis naměřených hodnot|Regulační meze a trendy|Reakce na signál nestability'),
(N'Samokontrola', N'Samokontrola', N'Odpovědnost operátora za kvalitu vlastní práce a postup při zjištění neshody.', 24, 900002, N'Kontrola prvního kusu|Četnost kontrol podle kontrolního plánu|Zastavení výroby při neshodě'),
(N'SeriovaCisla', N'Sériová čísla', N'Přidělování, zápis a kontrola sériových čísel dílů pro úplnou dohledatelnost.', 24, 900002, N'Přidělení sériového čísla|Shoda čísla na dílu a v dokladech|Postup při duplicitě nebo chybě'),
(N'SymbolyvBB', N'Symboly ve výkresové dokumentaci (BB)', N'Čtení symbolů a značek ve výkresové dokumentaci zákazníka.', 24, NULL, N'Geometrické tolerance|Značky drsnosti a úprav povrchu|Poznámky a zvláštní znaky'),
(N'SystemmanagemenntuKvalityCilepodniku', N'Systém managementu kvality a cíle podniku', N'Politika kvality, cíle podniku a role každého zaměstnance v systému managementu kvality.', 12, 900003, N'Politika kvality a cíle na letošní rok|Role zaměstnance v systému kvality|Hlášení neshod a návrhy na zlepšení'),
(N'TrideniOdpadu', N'Třídění odpadu', N'Správné třídění výrobního a komunálního odpadu, nádoby a označení.', 36, 900003, N'Druhy odpadu ve výrobě|Barevné označení nádob|Nebezpečný odpad a jeho evidence'),
(N'UdrzbaStrojuPracovnikyDilny', N'Údržba strojů pracovníky dílny', N'Denní a týdenní autonomní údržba strojů, kterou provádí obsluha.', 24, 900003, N'Denní kontrola stroje před směnou|Mazání a čištění|Hlášení závad údržbě'),
(N'VizualniKontrola', N'Vizuální kontrola', N'Zásady vizuální kontroly dílů: osvětlení, pomůcky, typické vady a jejich hodnocení.', 24, 900002, N'Podmínky kontroly a osvětlení|Typické povrchové vady|Rozhodnutí podle katalogu vad'),
(N'VrtaniKritDily', N'Vrtání kritických dílů', N'Požadavky na vrtání otvorů v kritických dílech a kontrola kvality otvoru.', 12, 900002, N'Schválené nástroje a řezné podmínky|Odvod třísek a chlazení|Kontrola otvoru po vrtání'),
(N'Vzorovani', N'Vzorování', N'Postup výroby a schválení prvních kusů a vzorků pro zákazníka.', 12, 900002, N'Kdy se vzorování provádí|Dokumentace prvního kusu|Uvolnění sériové výroby'),
(N'ZkouskaTvrdosti', N'Zkouška tvrdosti', N'Provádění zkoušek tvrdosti, příprava vzorku a vyhodnocení výsledků.', 24, 900002, N'Metody měření tvrdosti|Příprava povrchu a ověření tvrdoměru|Zápis výsledku a nejistota'),
(N'ZlomeniNastroje', N'Zlomení nástroje', N'Postup při zlomení nástroje během obrábění a posouzení dopadu na díl.', 12, 900002, N'Okamžité zastavení a zajištění dílu|Hlášení a záznam události|Rozhodnutí o dalším postupu s dílem'),
(N'Znaceni', N'Značení dílů', N'Způsoby značení dílů, povolené metody a kontrola čitelnosti.', 24, 900002, N'Metody značení podle výkresu|Umístění a obsah značení|Kontrola čitelnosti a trvanlivosti');

-- Podrobný obsah šesti školení, která se při předvádění otevírají nejčastěji.
-- Typ: h = nadpis, p = odstavec, ul = odrážky (položky oddělené svislítkem), ol = číslovaný postup.
CREATE TABLE #Obsah (
    Kod    NVARCHAR(100) NOT NULL,
    Poradi INT NOT NULL,
    Typ    VARCHAR(2) NOT NULL,
    Txt    NVARCHAR(2000) NOT NULL,
    PRIMARY KEY (Kod, Poradi)
);

INSERT INTO #Obsah (Kod, Poradi, Typ, Txt) VALUES
(N'CMM', 1, 'h',  N'Proč na měření záleží'),
(N'CMM', 2, 'p',  N'Souřadnicový měřicí stroj rozhoduje o tom, zda díl opustí závod. Výsledek měření je tak přesný, jak přesně jsme připravili díl, stroj i prostředí. Toto školení shrnuje pravidla, která platí pro každé měření v měrovém středisku.'),
(N'CMM', 3, 'h',  N'Příprava před měřením'),
(N'CMM', 4, 'ol', N'Očistěte díl i upínací plochy od třísek, oleje a chladicí kapaliny.|Nechte díl temperovat, dokud se jeho teplota nevyrovná s teplotou měrového střediska (20 °C).|Zkontrolujte, že měřicí program odpovídá platné revizi výkresu.|Ověřte stav snímacího doteku a platnost jeho kvalifikace.'),
(N'CMM', 5, 'h',  N'Co nejčastěji zkreslí výsledek'),
(N'CMM', 6, 'ul', N'Teplý díl přinesený přímo od stroje|Nečistota na kuličce doteku nebo na dílu|Díl upnutý s pnutím, které ho deformuje|Program vytvořený pro starší revizi výkresu'),
(N'CMM', 7, 'h',  N'Kvalifikace doteku'),
(N'CMM', 8, 'p',  N'Kvalifikaci doteku provádíme po každé výměně doteku, po kolizi a vždy, když si výsledkem nejsme jisti. Bez platné kvalifikace se neměří.'),
(N'CMM', 9, 'h',  N'Protokol a neshoda'),
(N'CMM', 10, 'p', N'Protokol obsahuje identifikaci dílu a výkresu, naměřené hodnoty s tolerancemi, jméno pracovníka a datum. Hodnoty se nikdy neupravují. Díl mimo toleranci označte jako neshodný a postupujte podle řízení neshodného výrobku.'),

(N'VizualniKontrola', 1, 'h',  N'Účel vizuální kontroly'),
(N'VizualniKontrola', 2, 'p',  N'Vizuální kontrola zachytí vady, které rozměrové měření neodhalí: rýhy, otřepy, koroze, stopy po nástroji nebo poškození při manipulaci. Provádí ji každý, kdo díl bere do ruky.'),
(N'VizualniKontrola', 3, 'h',  N'Podmínky kontroly'),
(N'VizualniKontrola', 4, 'ul', N'Osvětlení pracoviště nejméně 1 000 lx, bez oslnění|Čistý a odmaštěný díl|Lupa se zvětšením podle kontrolního plánu|Čisté rukavice, aby na povrchu nezůstaly otisky'),
(N'VizualniKontrola', 5, 'h',  N'Typické vady'),
(N'VizualniKontrola', 6, 'ul', N'Otřepy na hranách a v otvorech|Rýhy a vrypy na funkčních plochách|Stopy po chvění nástroje|Koroze a skvrny po chladicí kapalině|Otlaky po upnutí nebo po pádu'),
(N'VizualniKontrola', 7, 'h',  N'Jak rozhodnout'),
(N'VizualniKontrola', 8, 'p',  N'Vadu porovnejte s katalogem vad a s požadavky výkresu. Pokud si nejste jisti, díl neuvolňujte a přivolejte kontrolora kvality. Neshodný díl označte červenou visačkou a uložte do vyhrazeného prostoru.'),

(N'ITBezpecnost', 1, 'h',  N'Proč se to týká každého'),
(N'ITBezpecnost', 2, 'p',  N'Výkresy, měřicí protokoly a zákaznická data jsou majetkem zákazníků a jejich únik by znamenal ztrátu důvěry i zakázek. Většina incidentů nezačíná u techniky, ale u člověka, který klikne na podvodný odkaz nebo sdílí heslo.'),
(N'ITBezpecnost', 3, 'h',  N'Hesla a přihlašování'),
(N'ITBezpecnost', 4, 'ul', N'Heslo má nejméně 12 znaků a nepoužívá se nikde jinde|Heslo nikomu nesdělujte, ani kolegovi, ani pracovníkovi IT|Při odchodu od počítače obrazovku zamkněte|Podezření na vyzrazení hesla hlaste ihned'),
(N'ITBezpecnost', 5, 'h',  N'Podvodné e-maily'),
(N'ITBezpecnost', 6, 'p',  N'Podvodný e-mail obvykle spěchá, hrozí nebo slibuje. Zkontrolujte adresu odesílatele, neotvírejte nečekané přílohy a na odkazy neklikejte. Podezřelou zprávu přepošlete oddělení IT a smažte ji.'),
(N'ITBezpecnost', 7, 'h',  N'Data a zařízení'),
(N'ITBezpecnost', 8, 'ul', N'Zákaznická data neukládejte na soukromá zařízení ani do soukromých úložišť|Cizí USB disky do firemních počítačů nepatří|Výkresy se netisknou bez potřeby a nenechávají se bez dozoru|Ztrátu notebooku nebo telefonu hlaste okamžitě'),

(N'NakladaniLatkami', 1, 'h',  N'Základní pravidlo'),
(N'NakladaniLatkami', 2, 'p',  N'S chemickou látkou pracuje jen ten, kdo zná její bezpečnostní list. Ten říká, čím je látka nebezpečná, jaké ochranné pomůcky použít a co dělat při nehodě.'),
(N'NakladaniLatkami', 3, 'h',  N'Před prací'),
(N'NakladaniLatkami', 4, 'ol', N'Přečtěte si označení na obalu a výstražné symboly.|Vezměte si ochranné pomůcky uvedené v bezpečnostním listu.|Ověřte, že funguje odsávání a že je volná cesta k oční sprše.|Připravte si jen množství potřebné pro danou práci.'),
(N'NakladaniLatkami', 5, 'h',  N'Skladování'),
(N'NakladaniLatkami', 6, 'ul', N'Látky zůstávají v původních označených obalech|Kyseliny a zásady se skladují odděleně|Hořlaviny patří do určených skříní|Obaly se po použití uzavírají'),
(N'NakladaniLatkami', 7, 'h',  N'Únik a první pomoc'),
(N'NakladaniLatkami', 8, 'p',  N'Při úniku ohraďte místo, použijte sorbent a informujte vedoucího směny. Při zasažení očí vyplachujte nejméně 15 minut proudem vody a vyhledejte lékaře. Kontaminovaný sorbent je nebezpečný odpad.'),

(N'Meridla', 1, 'h',  N'Měřidlo je nástroj důvěry'),
(N'Meridla', 2, 'p',  N'Rozhodnutí o shodě dílu stojí na měřidle. Měřidlo bez platné kalibrace nebo poškozené měřidlo dává čísla, kterým nelze věřit, a všechny díly jím změřené je pak nutné prověřit znovu.'),
(N'Meridla', 3, 'h',  N'Před každým měřením'),
(N'Meridla', 4, 'ul', N'Zkontrolujte kalibrační značku a datum platnosti|Očistěte měřicí plochy měřidla i dílu|Ověřte nulu, u mikrometru na nastavovací měrce|Zkontrolujte, že měřidlo není mechanicky poškozené'),
(N'Meridla', 5, 'h',  N'Správná technika'),
(N'Meridla', 6, 'p',  N'Měřte stálou měřicí silou, u mikrometru vždy přes řehtačku. Měřidlo držte kolmo k měřené ploše a hodnotu odečítejte přímo, ne pod úhlem. Měření opakujte, pokud se výsledky liší.'),
(N'Meridla', 7, 'h',  N'Péče o měřidla'),
(N'Meridla', 8, 'ul', N'Měřidla se ukládají do pouzder, nikdy mezi nástroje a třísky|Po pádu se měřidlo vyřadí a předá metrologii|Měřidlo s prošlou kalibrací se nepoužívá|Půjčené měřidlo se vrací čisté'),

(N'Samokontrola', 1, 'h',  N'Kvalitu dělá ten, kdo díl vyrábí'),
(N'Samokontrola', 2, 'p',  N'Kontrola na konci výroby vadu jen najde. Zabránit jí může pouze operátor, který kontroluje vlastní práci v průběhu operace. Samokontrola je součástí každé operace a potvrzuje se v průvodce.'),
(N'Samokontrola', 3, 'h',  N'Postup'),
(N'Samokontrola', 4, 'ol', N'Před zahájením ověřte výkres, průvodku a seřízení stroje.|Zkontrolujte první kus a nechte ho potvrdit podle kontrolního plánu.|V průběhu dávky měřte s četností uvedenou v kontrolním plánu.|Výsledky zapisujte ihned, ne zpětně.'),
(N'Samokontrola', 5, 'h',  N'Když něco nesedí'),
(N'Samokontrola', 6, 'ul', N'Zastavte výrobu|Označte podezřelé díly a oddělte je od shodných|Informujte mistra nebo kontrolora kvality|Ve výrobě pokračujte až po odstranění příčiny'),
(N'Samokontrola', 7, 'p',  N'Zastavení výroby kvůli neshodě není chyba operátora. Chybou je vadu vidět a pokračovat.');

INSERT INTO dbo.InspiritTraining (code, name, description, content, validityMonths)
SELECT s.Kod, s.Nazev, s.Popis, NULL, s.Platnost
FROM #Skoleni s
ORDER BY s.Kod;

-- Obsah ve formátu editoru Tiptap (JSON). Řetězce escapuje STRING_ESCAPE, ne ruka.
;WITH bloky AS (
    -- podrobný obsah
    SELECT o.Kod, o.Poradi, o.Typ, o.Txt FROM #Obsah o
    UNION ALL
    -- osnova pro ostatní školení
    SELECT s.Kod, v.Poradi, v.Typ, v.Txt
    FROM #Skoleni s
    CROSS APPLY (VALUES
        (1, 'h',  CAST(N'O školení' AS NVARCHAR(2000))),
        (2, 'p',  CAST(s.Popis AS NVARCHAR(2000))),
        (3, 'h',  CAST(N'Co si odnesete' AS NVARCHAR(2000))),
        (4, 'ul', CAST(s.Body AS NVARCHAR(2000))),
        (5, 'p',  CAST(N'Platnost školení je ' + CAST(s.Platnost AS NVARCHAR(10)) + N' měsíců. Před jejím uplynutím vás systém vyzve k opakování.' AS NVARCHAR(2000)))
    ) v (Poradi, Typ, Txt)
    WHERE NOT EXISTS (SELECT 1 FROM #Obsah o WHERE o.Kod = s.Kod)
),
uzly AS (
    SELECT b.Kod, b.Poradi,
        CAST(CASE b.Typ
            WHEN 'h' THEN N'{"type":"heading","attrs":{"level":2},"content":[{"type":"text","text":"' + STRING_ESCAPE(b.Txt, 'json') + N'"}]}'
            WHEN 'p' THEN N'{"type":"paragraph","content":[{"type":"text","text":"' + STRING_ESCAPE(b.Txt, 'json') + N'"}]}'
            ELSE N'{"type":"' + CASE b.Typ WHEN 'ol' THEN N'orderedList' ELSE N'bulletList' END + N'","content":['
                 + (SELECT STRING_AGG(
                        CAST(N'{"type":"listItem","content":[{"type":"paragraph","content":[{"type":"text","text":"'
                             + STRING_ESCAPE(LTRIM(RTRIM(p.value)), 'json') + N'"}]}]}' AS NVARCHAR(MAX)), N',')
                        WITHIN GROUP (ORDER BY p.ordinal)
                    FROM STRING_SPLIT(b.Txt, N'|', 1) p)
                 + N']}'
        END AS NVARCHAR(MAX)) AS Uzel
    FROM bloky b
),
dokumenty AS (
    SELECT u.Kod,
           N'{"type":"doc","content":[' + STRING_AGG(u.Uzel, N',') WITHIN GROUP (ORDER BY u.Poradi) + N']}' AS Dokument
    FROM uzly u
    GROUP BY u.Kod
)
UPDATE t
SET t.content = d.Dokument
FROM dbo.InspiritTraining t
JOIN dokumenty d ON d.Kod = t.code;

IF EXISTS (SELECT 1 FROM dbo.InspiritTraining WHERE content IS NULL OR ISJSON(content) <> 1)
    THROW 51001, 'Obsah nekterych skoleni neni platny JSON.', 1;

-- ============================================================================
-- 4. Přiřazení školitelů (jedno školení = jeden školitel)
-- ============================================================================
INSERT INTO dbo.InspiritTrainingAssignment (trainerId, trainingId, assignedAt)
SELECT z.ID, t.id, DATEADD(day, -200, CURRENT_TIMESTAMP)
FROM #Skoleni s
JOIN dbo.InspiritTraining t ON t.code = s.Kod
JOIN dbo.TabCisZam z ON z.Cislo = s.Skolitel
WHERE s.Skolitel IS NOT NULL;

-- ============================================================================
-- 5. Testy a otázky
--    single: Spravne = text správné možnosti; multiple: Spravne = JSON pole.
--    Body: single 1, multiple = počet správných odpovědí (stejně jako aplikace).
-- ============================================================================
CREATE TABLE #Testy (
    Kod      NVARCHAR(100) NOT NULL,
    Varianta CHAR(1) NOT NULL,
    Nazev    NVARCHAR(500) NOT NULL,
    Popis    NVARCHAR(1000) NOT NULL,
    Aktivni  BIT NOT NULL,
    PRIMARY KEY (Kod, Varianta)
);

INSERT INTO #Testy (Kod, Varianta, Nazev, Popis, Aktivni) VALUES
(N'CMM',              'A', N'Souřadnicové měření – závěrečný test (varianta A)', N'Osm otázek z přípravy měření, kvalifikace doteku a práce s protokolem.', 1),
(N'CMM',              'B', N'Souřadnicové měření – závěrečný test (varianta B)', N'Náhradní varianta testu pro opakované přezkoušení.', 0),
(N'VizualniKontrola', 'A', N'Vizuální kontrola – závěrečný test', N'Osm otázek z podmínek kontroly, typických vad a rozhodování.', 1),
(N'ITBezpecnost',     'A', N'IT bezpečnost – závěrečný test', N'Osm otázek z práce s hesly, e-mailem a zákaznickými daty.', 1),
(N'NakladaniLatkami', 'A', N'Nakládání s chemickými látkami – závěrečný test', N'Osm otázek z bezpečnostních listů, skladování a první pomoci.', 1),
(N'Meridla',          'A', N'Měřidla – závěrečný test', N'Osm otázek z kontroly kalibrace, techniky měření a péče o měřidla.', 1),
(N'Samokontrola',     'A', N'Samokontrola – závěrečný test', N'Osm otázek z kontroly prvního kusu a postupu při neshodě.', 1);

CREATE TABLE #Otazky (
    Kod      NVARCHAR(100) NOT NULL,
    Varianta CHAR(1) NOT NULL,
    Poradi   INT NOT NULL,
    Typ      NVARCHAR(50) NOT NULL,
    Otazka   NVARCHAR(1000) NOT NULL,
    Moznosti NVARCHAR(MAX) NOT NULL,
    Spravne  NVARCHAR(MAX) NOT NULL,
    PRIMARY KEY (Kod, Varianta, Poradi)
);

INSERT INTO #Otazky (Kod, Varianta, Poradi, Typ, Otazka, Moznosti, Spravne) VALUES
-- CMM, varianta A
(N'CMM','A',1,N'single',  N'Co je nutné udělat před zahájením měření na souřadnicovém měřicím stroji?', N'["Očistit díl a upínací plochy","Zvýšit rychlost posuvů na maximum","Vypnout klimatizaci měrového střediska","Sejmout snímací dotek"]', N'Očistit díl a upínací plochy'),
(N'CMM','A',2,N'single',  N'Při jaké referenční teplotě se vyhodnocují rozměry?', N'["20 °C","15 °C","23 °C","25 °C"]', N'20 °C'),
(N'CMM','A',3,N'multiple',N'Které vlivy mohou zkreslit výsledek měření?', N'["Teplý díl přinesený přímo od stroje","Nečistota na kuličce doteku","Díl upnutý s pnutím","Barva měřicího protokolu"]', N'["Teplý díl přinesený přímo od stroje","Nečistota na kuličce doteku","Díl upnutý s pnutím"]'),
(N'CMM','A',4,N'single',  N'Kdy je nutné provést kvalifikaci snímacího doteku?', N'["Po každé výměně doteku a po kolizi","Jednou ročně","Jen při instalaci stroje","Nikdy, stroj ji provádí sám"]', N'Po každé výměně doteku a po kolizi'),
(N'CMM','A',5,N'single',  N'Jak dlouho se díl před přesným měřením temperuje?', N'["Dokud se jeho teplota nevyrovná s teplotou měrového střediska","Není třeba čekat","Vždy přesně 5 minut","Temperují se jen plastové díly"]', N'Dokud se jeho teplota nevyrovná s teplotou měrového střediska'),
(N'CMM','A',6,N'multiple',N'Co musí obsahovat měřicí protokol?', N'["Identifikaci dílu a výkresu","Naměřené hodnoty s tolerancemi","Jméno pracovníka a datum měření","Prodejní cenu dílu"]', N'["Identifikaci dílu a výkresu","Naměřené hodnoty s tolerancemi","Jméno pracovníka a datum měření"]'),
(N'CMM','A',7,N'single',  N'Co uděláte, když naměřená hodnota leží mimo toleranci?', N'["Díl označím jako neshodný a postupuji podle řízení neshodného výrobku","Hodnotu v protokolu upravím","Měřím znovu, dokud hodnota nevyjde","Díl předám dál bez označení"]', N'Díl označím jako neshodný a postupuji podle řízení neshodného výrobku'),
(N'CMM','A',8,N'single',  N'S jakou revizí výkresu musí souhlasit měřicí program?', N'["S platnou revizí výkresu","S první revizí výkresu","Na revizi nezáleží","S revizí, kterou zvolí operátor"]', N'S platnou revizí výkresu'),
-- CMM, varianta B
(N'CMM','B',1,N'single',  N'Co je první krok přípravy dílu k měření?', N'["Očištění dílu od třísek a oleje","Spuštění měřicího programu","Tisk protokolu","Výměna doteku"]', N'Očištění dílu od třísek a oleje'),
(N'CMM','B',2,N'single',  N'Smí se měřit bez platné kvalifikace doteku?', N'["Ne","Ano, pokud spěcháme","Ano, u malých dílů","Ano, se souhlasem kolegy"]', N'Ne'),
(N'CMM','B',3,N'multiple',N'Kdy se kvalifikace doteku opakuje?', N'["Po výměně doteku","Po kolizi","Při pochybnosti o výsledku","Při každém přihlášení do systému"]', N'["Po výměně doteku","Po kolizi","Při pochybnosti o výsledku"]'),
(N'CMM','B',4,N'single',  N'Smí se naměřené hodnoty v protokolu upravovat?', N'["Ne, nikdy","Ano, o setiny milimetru","Ano, se souhlasem mistra","Ano, pokud je díl jinak v pořádku"]', N'Ne, nikdy'),
(N'CMM','B',5,N'single',  N'Jaká je teplota měrového střediska?', N'["20 °C","18 °C","22 °C","24 °C"]', N'20 °C'),
-- Vizuální kontrola
(N'VizualniKontrola','A',1,N'single',  N'Jaké nejmenší osvětlení má mít pracoviště vizuální kontroly?', N'["1 000 lx","200 lx","500 lx","Na osvětlení nezáleží"]', N'1 000 lx'),
(N'VizualniKontrola','A',2,N'multiple',N'Které vady patří mezi typické povrchové vady?', N'["Otřepy na hranách","Rýhy na funkčních plochách","Koroze","Chybné číslo zakázky v systému"]', N'["Otřepy na hranách","Rýhy na funkčních plochách","Koroze"]'),
(N'VizualniKontrola','A',3,N'single',  N'Proč se díl kontroluje v čistých rukavicích?', N'["Aby na povrchu nezůstaly otisky a nevznikla koroze","Kvůli pohodlí","Aby díl neklouzal","Rukavice nejsou potřeba"]', N'Aby na povrchu nezůstaly otisky a nevznikla koroze'),
(N'VizualniKontrola','A',4,N'single',  N'Podle čeho se rozhoduje, zda je vada přípustná?', N'["Podle katalogu vad a požadavků výkresu","Podle názoru kolegy","Podle termínu zakázky","Podle ceny dílu"]', N'Podle katalogu vad a požadavků výkresu'),
(N'VizualniKontrola','A',5,N'single',  N'Co uděláte, když si posouzením vady nejste jisti?', N'["Díl neuvolním a přivolám kontrolora kvality","Díl uvolním","Vadu přebrousím","Díl vrátím na stroj bez záznamu"]', N'Díl neuvolním a přivolám kontrolora kvality'),
(N'VizualniKontrola','A',6,N'single',  N'Jak se označuje neshodný díl?', N'["Červenou visačkou","Zelenou visačkou","Neoznačuje se","Fixou na funkční ploše"]', N'Červenou visačkou'),
(N'VizualniKontrola','A',7,N'multiple',N'Co patří k podmínkám správné vizuální kontroly?', N'["Čistý a odmaštěný díl","Dostatečné osvětlení bez oslnění","Lupa podle kontrolního plánu","Zapnuté rádio"]', N'["Čistý a odmaštěný díl","Dostatečné osvětlení bez oslnění","Lupa podle kontrolního plánu"]'),
(N'VizualniKontrola','A',8,N'single',  N'Kdo provádí vizuální kontrolu dílu?', N'["Každý, kdo díl bere do ruky","Jen kontrolor kvality","Jen mistr","Jen zákazník"]', N'Každý, kdo díl bere do ruky'),
-- IT bezpečnost
(N'ITBezpecnost','A',1,N'single',  N'Kolik znaků má mít nejméně heslo do firemních systémů?', N'["12","6","8","Na délce nezáleží"]', N'12'),
(N'ITBezpecnost','A',2,N'single',  N'Komu smíte sdělit své heslo?', N'["Nikomu","Kolegovi na směně","Pracovníkovi IT po telefonu","Nadřízenému"]', N'Nikomu'),
(N'ITBezpecnost','A',3,N'multiple',N'Podle čeho poznáte podvodný e-mail?', N'["Spěchá nebo hrozí","Má neobvyklou adresu odesílatele","Obsahuje nečekanou přílohu","Přišel v pracovní době"]', N'["Spěchá nebo hrozí","Má neobvyklou adresu odesílatele","Obsahuje nečekanou přílohu"]'),
(N'ITBezpecnost','A',4,N'single',  N'Co uděláte s podezřelým e-mailem?', N'["Přepošlu ho oddělení IT a smažu","Otevřu přílohu, abych zjistil, o co jde","Odpovím odesílateli","Přepošlu ho kolegům"]', N'Přepošlu ho oddělení IT a smažu'),
(N'ITBezpecnost','A',5,N'single',  N'Co uděláte při odchodu od počítače?', N'["Zamknu obrazovku","Nechám počítač odemčený","Vypnu monitor","Otočím monitor ke zdi"]', N'Zamknu obrazovku'),
(N'ITBezpecnost','A',6,N'single',  N'Kam smíte ukládat zákaznické výkresy?', N'["Jen do určených firemních systémů","Na soukromý telefon","Do soukromého cloudového úložiště","Na vlastní USB disk"]', N'Jen do určených firemních systémů'),
(N'ITBezpecnost','A',7,N'single',  N'Najdete na parkovišti USB disk. Co s ním uděláte?', N'["Odevzdám ho oddělení IT, do počítače ho nezapojím","Zapojím ho, abych našel majitele","Vezmu si ho domů","Zapojím ho do firemního notebooku"]', N'Odevzdám ho oddělení IT, do počítače ho nezapojím'),
(N'ITBezpecnost','A',8,N'multiple',N'Co je nutné hlásit okamžitě?', N'["Ztrátu notebooku nebo telefonu","Podezření na vyzrazení hesla","Kliknutí na podvodný odkaz","Nový zamykací obrázek na ploše"]', N'["Ztrátu notebooku nebo telefonu","Podezření na vyzrazení hesla","Kliknutí na podvodný odkaz"]'),
-- Nakládání s chemickými látkami
(N'NakladaniLatkami','A',1,N'single',  N'Kde najdete informace o nebezpečnosti chemické látky?', N'["V bezpečnostním listu","V průvodce","V knize stroje","V docházkovém systému"]', N'V bezpečnostním listu'),
(N'NakladaniLatkami','A',2,N'single',  N'V jakých obalech se chemické látky uchovávají?', N'["V původních označených obalech","V lahvích od nápojů","V jakékoli čisté nádobě","V otevřených nádobách"]', N'V původních označených obalech'),
(N'NakladaniLatkami','A',3,N'multiple',N'Co ověříte před prací s chemickou látkou?', N'["Označení na obalu a výstražné symboly","Ochranné pomůcky podle bezpečnostního listu","Funkční odsávání a volnou cestu k oční sprše","Stav zásob kávy"]', N'["Označení na obalu a výstražné symboly","Ochranné pomůcky podle bezpečnostního listu","Funkční odsávání a volnou cestu k oční sprše"]'),
(N'NakladaniLatkami','A',4,N'single',  N'Jak se skladují kyseliny a zásady?', N'["Odděleně","Společně na jedné polici","Na podlaze u stroje","V šatně"]', N'Odděleně'),
(N'NakladaniLatkami','A',5,N'single',  N'Jak dlouho se vyplachují oči zasažené chemickou látkou?', N'["Nejméně 15 minut","1 minutu","Stačí je otřít","Oči se nevyplachují"]', N'Nejméně 15 minut'),
(N'NakladaniLatkami','A',6,N'single',  N'Kam patří sorbent nasáklý chemickou látkou?', N'["Do nebezpečného odpadu","Do směsného odpadu","Do papíru","Do kanalizace"]', N'Do nebezpečného odpadu'),
(N'NakladaniLatkami','A',7,N'single',  N'Kam patří hořlaviny?', N'["Do určených skříní na hořlaviny","Na okenní parapet","K topení","Pod pracovní stůl"]', N'Do určených skříní na hořlaviny'),
(N'NakladaniLatkami','A',8,N'multiple',N'Jak postupujete při úniku chemické látky?', N'["Ohradím místo úniku","Použiji sorbent","Informuji vedoucího směny","Počkám do konce směny"]', N'["Ohradím místo úniku","Použiji sorbent","Informuji vedoucího směny"]'),
-- Měřidla
(N'Meridla','A',1,N'single',  N'Co zkontrolujete na měřidle jako první?', N'["Kalibrační značku a datum platnosti","Barvu pouzdra","Výrobce měřidla","Hmotnost měřidla"]', N'Kalibrační značku a datum platnosti'),
(N'Meridla','A',2,N'single',  N'Smí se použít měřidlo s prošlou kalibrací?', N'["Ne","Ano, pokud vypadá v pořádku","Ano, do konce směny","Ano, na méně důležité rozměry"]', N'Ne'),
(N'Meridla','A',3,N'single',  N'Jak zajistíte stálou měřicí sílu u mikrometru?', N'["Měřím přes řehtačku","Dotáhnu bubínek co nejvíce","Měřím oběma rukama","Na síle nezáleží"]', N'Měřím přes řehtačku'),
(N'Meridla','A',4,N'multiple',N'Co uděláte před měřením?', N'["Očistím měřicí plochy měřidla i dílu","Ověřím nulu měřidla","Zkontroluji, že měřidlo není poškozené","Namažu měřicí plochy olejem"]', N'["Očistím měřicí plochy měřidla i dílu","Ověřím nulu měřidla","Zkontroluji, že měřidlo není poškozené"]'),
(N'Meridla','A',5,N'single',  N'Měřidlo vám upadlo na zem. Co uděláte?', N'["Vyřadím ho a předám metrologii","Pokračuji v měření","Zkontroluji ho pohledem a měřím dál","Vrátím ho do pouzdra a nikomu nic neřeknu"]', N'Vyřadím ho a předám metrologii'),
(N'Meridla','A',6,N'single',  N'Kde se měřidla ukládají?', N'["V pouzdrech na určeném místě","Mezi nástroji u stroje","Na stole stroje","V kapse pracovního oděvu"]', N'V pouzdrech na určeném místě'),
(N'Meridla','A',7,N'single',  N'Proč se hodnota odečítá přímo a ne pod úhlem?', N'["Aby nevznikla chyba odečtu","Kvůli pohodlí","Aby se měřidlo neopotřebovalo","Na směru pohledu nezáleží"]', N'Aby nevznikla chyba odečtu'),
(N'Meridla','A',8,N'single',  N'Co je nutné udělat, když se zjistí, že se měřilo vadným měřidlem?', N'["Prověřit znovu všechny díly, které jím byly změřeny","Nic, díly už odešly","Vyměnit jen měřidlo","Opravit záznamy v průvodce"]', N'Prověřit znovu všechny díly, které jím byly změřeny'),
-- Samokontrola
(N'Samokontrola','A',1,N'single',  N'Kdo odpovídá za kvalitu vyrobeného dílu v průběhu operace?', N'["Operátor, který díl vyrábí","Výstupní kontrola","Zákazník","Sklad"]', N'Operátor, který díl vyrábí'),
(N'Samokontrola','A',2,N'multiple',N'Co ověříte před zahájením operace?', N'["Výkres","Průvodku","Seřízení stroje","Jídelní lístek"]', N'["Výkres","Průvodku","Seřízení stroje"]'),
(N'Samokontrola','A',3,N'single',  N'Co se provádí s prvním kusem dávky?', N'["Zkontroluje se a potvrdí podle kontrolního plánu","Odloží se stranou bez kontroly","Zkontroluje se až na konci dávky","Vyhodí se"]', N'Zkontroluje se a potvrdí podle kontrolního plánu'),
(N'Samokontrola','A',4,N'single',  N'Jak často se měří v průběhu dávky?', N'["S četností uvedenou v kontrolním plánu","Jen na začátku","Jen na konci","Podle nálady"]', N'S četností uvedenou v kontrolním plánu'),
(N'Samokontrola','A',5,N'single',  N'Kdy se výsledky kontroly zapisují?', N'["Ihned po měření","Na konci směny zpaměti","Až je čas","Nezapisují se"]', N'Ihned po měření'),
(N'Samokontrola','A',6,N'multiple',N'Co uděláte při zjištění neshody?', N'["Zastavím výrobu","Označím a oddělím podezřelé díly","Informuji mistra nebo kontrolora kvality","Pokračuji a neshodu nahlásím zítra"]', N'["Zastavím výrobu","Označím a oddělím podezřelé díly","Informuji mistra nebo kontrolora kvality"]'),
(N'Samokontrola','A',7,N'single',  N'Kdy smíte po neshodě pokračovat ve výrobě?', N'["Po odstranění příčiny","Hned po označení dílů","Po přestávce","Kdykoli"]', N'Po odstranění příčiny'),
(N'Samokontrola','A',8,N'single',  N'Kde se samokontrola potvrzuje?', N'["V průvodce","V docházce","Nikde","V e-mailu mistrovi"]', N'V průvodce');

-- Měřidlo předváděcích dat: možnosti musí být platné JSON pole a správná odpověď
-- musí mezi možnostmi opravdu být, jinak by test nešel složit.
IF EXISTS (SELECT 1 FROM #Otazky WHERE ISJSON(Moznosti) <> 1)
    THROW 51002, 'Moznosti nekterych otazek nejsou platny JSON.', 1;
IF EXISTS (SELECT 1 FROM #Otazky WHERE Typ = N'multiple' AND ISJSON(Spravne) <> 1)
    THROW 51003, 'Spravne odpovedi otazek typu multiple nejsou platny JSON.', 1;
IF EXISTS (
    SELECT 1 FROM #Otazky o
    WHERE o.Typ = N'single'
      AND NOT EXISTS (SELECT 1 FROM OPENJSON(o.Moznosti) m WHERE m.value = o.Spravne)
)
    THROW 51004, 'Spravna odpoved otazky typu single neni mezi moznostmi.', 1;
IF EXISTS (
    SELECT 1 FROM #Otazky o
    CROSS APPLY OPENJSON(o.Spravne) s
    WHERE o.Typ = N'multiple'
      AND NOT EXISTS (SELECT 1 FROM OPENJSON(o.Moznosti) m WHERE m.value = s.value)
)
    THROW 51005, 'Spravna odpoved otazky typu multiple neni mezi moznostmi.', 1;

INSERT INTO dbo.InspiritTest (trainingId, title, description, isActive, passingScore, timeLimit)
SELECT t.id, x.Nazev, x.Popis, x.Aktivni, 75, 15
FROM #Testy x
JOIN dbo.InspiritTraining t ON t.code = x.Kod
ORDER BY x.Kod, x.Varianta;

INSERT INTO dbo.InspiritQuestion (testId, [order], [type], question, options, correctAnswer, points, required)
SELECT te.id, o.Poradi, o.Typ, o.Otazka, o.Moznosti, o.Spravne,
       CASE WHEN o.Typ = N'multiple' THEN (SELECT COUNT(*) FROM OPENJSON(o.Spravne)) ELSE 1 END,
       1
FROM #Otazky o
JOIN #Testy x ON x.Kod = o.Kod AND x.Varianta = o.Varianta
JOIN dbo.InspiritTraining t ON t.code = o.Kod
JOIN dbo.InspiritTest te ON te.trainingId = t.id AND te.title = x.Nazev
ORDER BY o.Kod, o.Varianta, o.Poradi;

-- ============================================================================
-- 6. Matice školení zaměstnanců
--    VyprsiZaDni: počet dní do konce platnosti (záporné = prošlé, NULL = dosud
--    neabsolvováno, čeká na první prezenční zkoušku).
--    Datum posledního absolvování = dnes + VyprsiZaDni - platnost školení.
-- ============================================================================
CREATE TABLE #Matice (
    ZamId       INT NOT NULL,
    Kod         NVARCHAR(100) NOT NULL,
    VyprsiZaDni INT NULL,
    PRIMARY KEY (ZamId, Kod)
);

-- Pracovníci kromě předváděcího účtu 100101: rozložení odvozené z osobního čísla
-- a kódu školení, tedy při každém naplnění stejné.
INSERT INTO #Matice (ZamId, Kod, VyprsiZaDni)
SELECT t.ID, s.Kod,
       CASE h.Stav
           WHEN 0 THEN NULL                                   -- čeká na první absolvování
           WHEN 1 THEN -3 - (h.Posun % 90)                    -- prošlé
           WHEN 2 THEN 2 + (h.Posun % 26)                     -- brzy vyprší
           ELSE 45 + (h.Posun % (s.Platnost * 30 - 60))       -- platné
       END
FROM #Zam z
JOIN dbo.TabCisZam t ON t.Cislo = z.Cislo
CROSS JOIN #Skoleni s
CROSS APPLY (SELECT (CHECKSUM(z.Cislo, s.Kod) & 2147483647) % 100          AS Vyber,
                    (CHECKSUM(s.Kod, z.Cislo, N'stav') & 2147483647) % 10  AS Stav,
                    (CHECKSUM(N'posun', z.Cislo, s.Kod) & 2147483647)      AS Posun) h
WHERE z.Role = N'WORKER'
  AND z.Stav = 'A'
  AND z.Cislo <> 100101
  AND s.Skolitel IS NOT NULL
  AND h.Vyber < 40;

-- Předváděcí účet pracovníka, administrátor a školitelé: ručně zvolený výběr,
-- aby byl při předvádění vidět každý stav včetně testu, který lze spustit online.
INSERT INTO #Matice (ZamId, Kod, VyprsiZaDni)
SELECT t.ID, v.Kod, v.VyprsiZaDni
FROM (VALUES
    (100101, N'CMM',              410),
    (100101, N'Samokontrola',     260),
    (100101, N'VizualniKontrola',  12),   -- brzy vyprší: test lze spustit online
    (100101, N'NakladaniLatkami',  25),   -- brzy vyprší: test lze spustit online
    (100101, N'ITBezpecnost',     -20),   -- prošlé: test lze spustit online
    (100101, N'Meridla',          NULL),  -- první zkouška je prezenční u školitele
    (100101, N'Pruvodka',         300),
    (100101, N'TrideniOdpadu',    700),
    (900001, N'ITBezpecnost',     150),
    (900001, N'TrideniOdpadu',    500),
    (900001, N'SystemmanagemenntuKvalityCilepodniku', 18),
    (900002, N'ITBezpecnost',     200),
    (900002, N'NakladaniLatkami', 640),
    (900002, N'SystemmanagemenntuKvalityCilepodniku', 90),
    (900003, N'ITBezpecnost',      15),
    (900003, N'TrideniOdpadu',    820),
    (900003, N'Meridla',          365)
) v (Cislo, Kod, VyprsiZaDni)
JOIN dbo.TabCisZam t ON t.Cislo = v.Cislo;

DECLARE @zamId INT, @kod NVARCHAR(100), @datum DATETIME2, @sql NVARCHAR(MAX);
DECLARE matice_cursor CURSOR LOCAL FAST_FORWARD FOR
    SELECT m.ZamId, m.Kod,
           CASE WHEN m.VyprsiZaDni IS NULL THEN NULL
                ELSE CAST(DATEADD(month, -s.Platnost, DATEADD(day, m.VyprsiZaDni, @dnes)) AS DATETIME2) END
    FROM #Matice m JOIN #Skoleni s ON s.Kod = m.Kod;
OPEN matice_cursor;
FETCH NEXT FROM matice_cursor INTO @zamId, @kod, @datum;
WHILE @@FETCH_STATUS = 0
BEGIN
    SET @sql = N'UPDATE dbo.TabCisZam_EXT SET '
             + QUOTENAME(N'_' + @kod + N'Pozadovano') + N' = 1, '
             + QUOTENAME(N'_' + @kod + N'DatumPosl') + N' = @datum WHERE ID = @zamId;';
    EXEC sys.sp_executesql @sql, N'@datum DATETIME2, @zamId INT', @datum = @datum, @zamId = @zamId;
    FETCH NEXT FROM matice_cursor INTO @zamId, @kod, @datum;
END
CLOSE matice_cursor;
DEALLOCATE matice_cursor;

-- ============================================================================
-- 7. Historie zkoušek a certifikáty
--    Ke každému absolvovanému školení, které má aktivní test, vznikne záznam
--    prezenční zkoušky (stejný tvar, jaký zapisuje školitel v aplikaci) a certifikát.
-- ============================================================================
CREATE TABLE #Pokusy (
    PokusId     INT NOT NULL PRIMARY KEY,
    ZamId       INT NOT NULL,
    TestId      INT NOT NULL,
    Absolvovano DATETIME2 NOT NULL
);

INSERT INTO dbo.InspiritTestAttempt (testId, userId, startedAt, completedAt, score, passed, answers, createdAt, updatedAt)
OUTPUT inserted.id, inserted.userId, inserted.testId, inserted.completedAt INTO #Pokusy (PokusId, ZamId, TestId, Absolvovano)
SELECT te.id, m.ZamId, d.Datum, d.Datum,
       76 + ((CHECKSUM(m.ZamId, m.Kod, N'skore') & 2147483647) % 25),
       1,
       N'{"manual":true,"notes":"Prezenční zkouška po školení se školitelem."}',
       d.Datum, d.Datum
FROM #Matice m
JOIN #Skoleni s ON s.Kod = m.Kod
JOIN dbo.InspiritTraining t ON t.code = m.Kod
JOIN dbo.InspiritTest te ON te.trainingId = t.id AND te.isActive = 1
CROSS APPLY (SELECT DATEADD(hour, 9, CAST(DATEADD(month, -s.Platnost, DATEADD(day, m.VyprsiZaDni, @dnes)) AS DATETIME2)) AS Datum) d
WHERE m.VyprsiZaDni IS NOT NULL;

INSERT INTO dbo.InspiritCertificate (userId, trainingId, testAttemptId, certificateNumber, issuedAt, validUntil, createdAt, updatedAt)
SELECT p.ZamId, te.trainingId, p.PokusId,
       N'CERT-' + CAST(YEAR(p.Absolvovano) AS NVARCHAR(4)) + N'-'
           + UPPER(LEFT(REPLACE(CONVERT(NVARCHAR(36), NEWID()), N'-', N''), 8)),
       p.Absolvovano,
       DATEADD(month, t.validityMonths, p.Absolvovano),
       p.Absolvovano, p.Absolvovano
FROM #Pokusy p
JOIN dbo.InspiritTest te ON te.id = p.TestId
JOIN dbo.InspiritTraining t ON t.id = te.trainingId;

COMMIT TRANSACTION;
GO

-- Pohled se přegeneruje podle dob platnosti zapsaných v InspiritTraining
-- (stejná procedura, kterou v aplikaci spouští administrátor).
EXEC dbo.sp_RegenerateInspiritCisZamView @PreviewOnly = 0;
GO

-- ============================================================================
-- Souhrn a kontrola: pohled smí vracet jen zaměstnance v evidenčním stavu.
-- ============================================================================
DECLARE @vPohledu INT = (SELECT COUNT(*) FROM dbo.InspiritCisZam);
DECLARE @vKmenu INT = (SELECT COUNT(*) FROM dbo.TabCisZam);
DECLARE @skoleni INT = (SELECT COUNT(*) FROM dbo.InspiritTraining);
DECLARE @prirazeni INT = (SELECT COUNT(*) FROM dbo.InspiritTrainingAssignment);
DECLARE @testu INT = (SELECT COUNT(*) FROM dbo.InspiritTest);
DECLARE @otazek INT = (SELECT COUNT(*) FROM dbo.InspiritQuestion);
DECLARE @zkousek INT = (SELECT COUNT(*) FROM dbo.InspiritTestAttempt);
DECLARE @certifikatu INT = (SELECT COUNT(*) FROM dbo.InspiritCertificate);
PRINT 'Zamestnancu v TabCisZam: ' + CAST(@vKmenu AS VARCHAR(10));
PRINT 'Zamestnancu v pohledu InspiritCisZam: ' + CAST(@vPohledu AS VARCHAR(10));
PRINT 'Skoleni: ' + CAST(@skoleni AS VARCHAR(10));
PRINT 'Prirazeni skolitelu: ' + CAST(@prirazeni AS VARCHAR(10));
PRINT 'Testu: ' + CAST(@testu AS VARCHAR(10));
PRINT 'Otazek: ' + CAST(@otazek AS VARCHAR(10));
PRINT 'Zaznamu zkousek: ' + CAST(@zkousek AS VARCHAR(10));
PRINT 'Certifikatu: ' + CAST(@certifikatu AS VARCHAR(10));

IF @vPohledu <> 15
    THROW 51006, 'Pohled InspiritCisZam ma vracet prave 15 zamestnancu v evidencnim stavu.', 1;
GO

SET NOEXEC OFF;
GO
