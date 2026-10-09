# Volné pozice — testovací verze

Tato větev je oddělená od stabilní verze QR Position. Změny v této větvi se nesmí publikovat na produkční web bez výslovného souhlasu uživatele („Publikujeme“).

## Schválená logika

1. Na úvodní obrazovku přidat možnost „Volné pozice“.
2. Po otevření uživatel vybere DC2 nebo DC3.
3. Systém načte seznam volných pozic z nahraného souboru a rozdělí data pro DC2 a DC3.
4. Uličky se řadí podle počtu zbývajících volných pozic sestupně.
5. Ulička označená jako obsazená/pracovaná se přeskočí a navrhne se další ulička.
6. Pracovník může také ručně přeskočit aktuální uličku, i když není označená jako obsazená. Aplikace si zapamatuje přeskočení pro daný pracovní postup a nabídne další prioritní uličku; přeskočení nesmí odstranit její volné pozice ani ji globálně označit jako obsazenou.
7. Když pracovník začne zpracovávat pozice v uličce, označí ji. Stav musí být sdílený mezi pracovníky přes společné úložiště.
8. Po zpracování pozice se tato pozice odstraní z aktuálního seznamu volných pozic. Priorita uliček se znovu přepočítá podle zbývajících pozic.
9. Navigace probíhá po jednotlivých pozicích; tlačítko „Další“ a swipe zobrazují další pozici a její QR kód.
10. Při připojení k internetu se data a stav synchronizují. Offline se používá poslední stažený seznam a zobrazí se upozornění na možnou neaktuálnost.
11. Tlačítko „Aktualizovat“ ručně načte aktuální data po obnovení připojení.
12. PC verze umožní nahrát nový Excel/CSV, zkontrolovat data a nahradit starý seznam novým. Starý seznam se nenahrazuje, dokud nový soubor neprojde validací.
13. Stabilní verze na větvi `main` se nemění během vývoje a testování.

## Čeká na vzorový soubor

Před implementací importu je nutné získat ukázkový soubor a určit přesná pravidla pro rozpoznávání skladu, uličky, pozice a dostupnosti. Nepředpokládat strukturu souboru.
