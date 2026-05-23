import { useState, useEffect, useRef } from "react";

const setupStyles = () => {
  if (document.getElementById("ig-fonts")) return;
  const link = document.createElement("link");
  link.id = "ig-fonts"; link.rel = "stylesheet";
  link.href = "https://fonts.googleapis.com/css2?family=Bebas+Neue&family=Outfit:wght@400;500;600;700;800&display=swap";
  document.head.appendChild(link);
  const s = document.createElement("style"); s.id = "ig-css";
  s.textContent = `
    .ig*{box-sizing:border-box;margin:0;padding:0}
    .ig{font-family:'Outfit',sans-serif}
    .ig-display{font-family:'Bebas Neue',sans-serif;letter-spacing:.03em}
    @keyframes ig-glow{0%,100%{box-shadow:0 0 20px rgba(255,34,68,.4)}50%{box-shadow:0 0 50px rgba(255,34,68,.85)}}
    @keyframes ig-pulse{0%,100%{opacity:1}50%{opacity:.45}}
    @keyframes ig-tpulse{0%,100%{transform:scale(1)}50%{transform:scale(1.04)}}
    @keyframes ig-bounceIn{0%{transform:scale(.4);opacity:0}60%{transform:scale(1.08);opacity:1}100%{transform:scale(1)}}
    .ig-glo{animation:ig-glow 2s ease infinite}
    .ig-pls{animation:ig-pulse 1.4s ease infinite}
    .ig-tpls{animation:ig-tpulse .8s ease infinite}
    .ig-bi{animation:ig-bounceIn .55s cubic-bezier(.215,.61,.355,1) forwards}
    .ig-flip{perspective:1200px}
    .ig-flip-inner{transition:transform .7s cubic-bezier(.4,.2,.2,1);transform-style:preserve-3d;position:relative;width:100%;height:100%}
    .ig-flip-inner.flipped{transform:rotateY(180deg)}
    .ig-ffront,.ig-fback{position:absolute;inset:0;border-radius:22px;backface-visibility:hidden;-webkit-backface-visibility:hidden}
    .ig-fback{transform:rotateY(180deg)}
    .ig-scroll::-webkit-scrollbar{width:3px}
    .ig-scroll::-webkit-scrollbar-thumb{background:rgba(255,255,255,.15);border-radius:2px}
    .ig-inp{background:rgba(255,255,255,.06);border:1.5px solid rgba(255,255,255,.1);color:#fff;outline:none;border-radius:12px;padding:12px 14px;font-size:15px;font-family:'Outfit',sans-serif;transition:border-color .2s,background .2s;width:100%}
    .ig-inp:focus{border-color:rgba(255,34,68,.6);background:rgba(255,255,255,.09)}
    .ig-inp::placeholder{color:rgba(255,255,255,.28)}
    .ig-btn{cursor:pointer;border:none;outline:none;font-family:'Outfit',sans-serif;transition:transform .15s,opacity .15s}
    .ig-btn:hover{transform:translateY(-2px)}
    .ig-btn:active{transform:scale(.96)}
    .ig-btn:disabled{opacity:.4;pointer-events:none}
    .ig-catbtn{transition:background .18s,border-color .18s,transform .15s}
    .ig-catbtn:hover{transform:translateY(-2px) scale(1.02)}
    .ig-catbtn:active{transform:scale(.96)}
  `;
  document.head.appendChild(s);
};

const CATEGORIES = {
  "🐾 Djur":["Lejon","Elefant","Delfin","Pingvin","Koala","Gorilla","Gepard","Krokodil","Flamingo","Emu","Näshörning","Sjöhäst","Tapir","Valross","Isbjörn","Piranha","Lodjur","Platypus","Axolotl","Mangust","Järv","Kamel","Räv","Uggla","Lama"],
  "🍕 Mat":["Pizza","Sushi","Hamburger","Taco","Pasta","Curry","Lasagne","Ramen","Kebab","Smörgås","Pannkaka","Köttbullar","Wonton","Falafel","Dim Sum","Burrito","Gyros","Paella","Schnitzel","Pad Thai","Dumplings","Baklava","Pho","Ceviche","Moussaka"],
  "🌍 Länder":["Brasilien","Japan","Australien","Egypten","Kanada","Indien","Mexiko","Sverige","Sydafrika","Argentina","Ryssland","Spanien","Thailand","Marocko","Nigeria","Peru","Vietnam","Island","Chile","Turkiet","Indonesien","Pakistan","Algeriet","Saudiarabien","Malaysia"],
  "🎬 Film":["Titanic","Interstellar","Inception","Matrix","Avatar","Joker","Parasite","Lejonkungen","Gladiatorn","Upp!","Avengers","Forrest Gump","Pulp Fiction","Frozen","Goodfellas","Jurassic Park","Toy Story","The Shining","Fight Club","Spirited Away","Nomadland","Dune","Oppenheimer","Barbie","Everything Everywhere"],
  "🎵 Artister":["Beatles","ABBA","Beyoncé","Eminem","Metallica","Taylor Swift","Michael Jackson","Adele","Drake","Rihanna","Led Zeppelin","Madonna","Elvis","David Bowie","Bob Marley","Coldplay","Billie Eilish","Ed Sheeran","The Weeknd","Lady Gaga","Kendrick Lamar","SZA","Bad Bunny","Sabrina Carpenter","Chappell Roan"],
  "💼 Yrken":["Brandman","Pilot","Kirurg","Arkitekt","Detektiv","Astronaut","Bagare","Dirigent","Dykare","Clown","Kock","Snickare","Trollkonstnär","Journalist","Optiker","Psykolog","Rörmokare","Somelier","Tatuerare","Livvakt","Ballerinadansare","Bergsprängare","Glasblåsare","Läkare","Lärare"],
  "⚽ Sport":["Fotboll","Tennis","Simning","Boxning","Basket","Rugby","Golf","Karate","Segling","Klättring","Brottning","Curling","Fäktning","Skidhopp","Triathlon","Cykling","Bordtennis","Handboll","Ishockey","Surfing","Friidrott","Ridsport","Cheerleading","Skateboard","BMX"],
  "🚗 Fordon":["Ferrari","Traktor","Ubåt","Helikopter","Gondol","Rallybil","Snöscooter","Monstertruck","Luftskepp","Segway","Hydroplan","Ångbåt","Dragster","Tuk-tuk","Glidflygplan","Hovercraft","Rickshaw","Kabelbil","Amfibiefordon","Moonbuggy","Jetski","Pansarvagn","Zeppelinare","Rymdfärja"],
  "🏙️ Städer":["Tokyo","Paris","New York","Dubai","Sydney","Rom","Bangkok","London","Istanbul","Singapore","Barcelona","Mumbai","Kairo","Lagos","Berlin","Medellin","Seoul","Havanna","Reykjavik","Buenos Aires","São Paulo","Nairobi","Bogotá","Jakarta","Göteborg"],
  "🎮 Gaming":["Minecraft","Fortnite","GTA","Zelda","Pokémon","FIFA","Mario","Halo","Overwatch","Skyrim","Among Us","Tetris","Pac-Man","Doom","The Sims","Roblox","Call of Duty","Cyberpunk","Red Dead Redemption","League of Legends","Elden Ring","Stardew Valley","Baldur's Gate","Palworld","Helldivers"],
  "🦸 Superhjältar":["Batman","Superman","Spiderman","Wonder Woman","Iron Man","Thor","Hulk","Black Widow","Captain America","Wolverine","Flash","Aquaman","Ant-Man","Doctor Strange","Black Panther","Deadpool","Scarlet Witch","Hawkeye","Storm","Gamora","Shang-Chi","She-Hulk","Moon Knight","Ms. Marvel","Daredevil"],
  "🌿 Natur":["Vulkan","Vattenfall","Öken","Korallrev","Glaciär","Regnskog","Fjord","Geysir","Norrsken","Savann","Mangrove","Lagun","Tornado","Atoll","Grotta","Tundra","Monsun","Kanjon","Delta","Arktis","Våtmark","Bäck","Klippa","Taiga","Prärie"],
  "🎭 Kändisar":["Zlatan","Zara Larsson","Robyn","Greta Thunberg","Avicii","Roxette","The Cardigans","Ace of Base","Astrid Lindgren","Björn Borg","Max von Sydow","Ingmar Bergman","Lykke Li","Tove Lo","Swedish House Mafia","Loreen","Rolf Lassgård","Noomi Rapace","Pernilla Wahlgren","Stina Nordenstam"],
  "🍺 Fester":["Midsommar","Kräftskiva","Lucia","Nyår","Valborg","Halloween","Pingst","Påsk","Jul","Studentfest","Förfest","Karaoke","Maskerad","Disco","Bröllop","Barnkalas","Arbetsparty","Klädbytesfest","Temaparty","Surströmming"],
};

const HINTS = {
  "Lejon":["katt","stor katt"],"Elefant":["snabel","lång snabel"],"Delfin":["hav","hav, hoppar"],"Pingvin":["fågel","fågel, kall"],"Koala":["eukalyptus","eukalyptus, kläng"],"Gorilla":["apa","stor apa"],"Gepard":["snabb","snabbast, fläckar"],"Krokodil":["reptil","reptil, tänder"],"Flamingo":["rosa","rosa, vatten"],"Emu":["australien","stor fågel"],"Näshörning":["horn","horn, pansarhud"],"Sjöhäst":["fisk","liten fisk"],"Tapir":["snabel","snabel, djungel"],"Valross":["stöttänder","hav, stöttänder"],"Isbjörn":["vit","vit, norr"],"Piranha":["biter","biter, flod"],"Lodjur":["katt","katt, vildmark"],"Platypus":["näbb","näbb, ägg"],"Axolotl":["salamander","salamander, mexiko"],"Mangust":["snabb","snabb, orm"],"Järv":["nordlig","nordlig, vild"],"Kamel":["puckel","puckel, öken"],"Räv":["list","list, röd"],"Uggla":["natt","natt, vis"],"Lama":["spottar","spottar, sydamerika"],
  "Pizza":["deg","deg, ost"],"Sushi":["japan","japan, ris"],"Hamburger":["kött","kött, bulle"],"Taco":["mexiko","mexiko, tortilla"],"Pasta":["italien","italien, nudlar"],"Curry":["kryddigt","kryddigt, indien"],"Lasagne":["ugn","ugn, lager"],"Ramen":["nudel","nudel, buljong"],"Kebab":["spett","spett, kött"],"Smörgås":["bröd","bröd, pålägg"],"Pannkaka":["platt","platt, steka"],"Köttbullar":["rund","rund, sås"],"Wonton":["deg","deg, soppa"],"Falafel":["kikärta","kikärta, friterad"],"Dim Sum":["liten","liten, ångad"],"Burrito":["rulle","rulle, bönor"],"Gyros":["grekland","grekland, snurrar"],"Paella":["ris","ris, skaldjur"],"Schnitzel":["panerad","panerad, kött"],"Pad Thai":["risnudel","risnudel, thaimat"],"Dumplings":["knyte","knyte, ångad"],"Baklava":["honung","honung, nötter"],"Pho":["vietnam","vietnam, soppa"],"Ceviche":["citrus","citrus, rå fisk"],"Moussaka":["aubergine","aubergine, ugn"],
  "Brasilien":["samba","fotboll, samba"],"Japan":["sushi","sushi, teknik"],"Australien":["känguru","känguru, hav"],"Egypten":["pyramid","pyramid, öken"],"Kanada":["lönn","lönn, hockey"],"Indien":["krydda","krydda, Taj Mahal"],"Mexiko":["taco","taco, pyramid"],"Sverige":["IKEA","IKEA, norr"],"Sydafrika":["safari","safari, kap"],"Argentina":["tango","tango, biff"],"Ryssland":["stor","stor, kallt"],"Spanien":["flamenco","flamenco, sol"],"Thailand":["buddism","buddism, stränder"],"Marocko":["medina","medina, krydda"],"Nigeria":["afrika","afrika, stor"],"Peru":["lama","Machu Picchu, lama"],"Vietnam":["nudlar","nudlar, flod"],"Island":["vulkan","vulkan, is"],"Chile":["smal","smal, Anderna"],"Turkiet":["bro","bro, kultur"],"Indonesien":["öar","öar, java"],"Pakistan":["berg","Sydasien, berg"],"Algeriet":["sahara","Sahara, norr"],"Saudiarabien":["olja","olja, öken"],"Malaysia":["djungel","djungel, torn"],
  "Titanic":["skepp","skepp, hav"],"Interstellar":["rymd","rymd, tid"],"Inception":["dröm","dröm, lager"],"Matrix":["virtuell","virtuell, datorvärld"],"Avatar":["blå","blå, planet"],"Joker":["clown","clown, mörker"],"Parasite":["klasser","klasser, korea"],"Lejonkungen":["savann","savann, kung"],"Gladiatorn":["arena","arena, Rom"],"Upp!":["ballong","ballong, hus"],"Avengers":["hjältar","hjältar, Marvel"],"Forrest Gump":["spring","spring, choklad"],"Pulp Fiction":["gangster","nonlinjär, gangster"],"Frozen":["is","is, syster"],"Goodfellas":["mafia","mafia, brott"],"Jurassic Park":["dinosaurier","dinosaurier, ö"],"Toy Story":["leksaker","leksaker, barn"],"The Shining":["hotell","hotell, galen"],"Fight Club":["boxning","boxning, hemlighet"],"Spirited Away":["anime","andars bad, anime"],"Nomadland":["van","van, frihet"],"Dune":["sand","sand, öken"],"Oppenheimer":["bomb","bomb, vetenskap"],"Barbie":["rosa","rosa, docka"],"Everything Everywhere":["multivers","multivers, tvätt"],
  "Beatles":["Liverpool","Liverpool, 60-tal"],"ABBA":["Sverige","Sverige, disco"],"Beyoncé":["drottning","drottning, R&B"],"Eminem":["rap","rap, Detroit"],"Metallica":["metal","metal, hård"],"Taylor Swift":["country","country, pop"],"Michael Jackson":["moonwalk","moonwalk, pop"],"Adele":["brittisk","brittisk, kraftfull"],"Drake":["toronto","Toronto, hip-hop"],"Rihanna":["barbados","Barbados, pop"],"Led Zeppelin":["rock","rock, 70-tal"],"Madonna":["provocativ","pop, provocativ"],"Elvis":["pelarhöfter","rock, pelarhöfter"],"David Bowie":["glam","glam, Ziggy"],"Bob Marley":["reggae","reggae, jamaica"],"Coldplay":["brittisk","brittisk, melankoli"],"Billie Eilish":["mörk","mörk, ung"],"Ed Sheeran":["gitarr","gitarr, rödhårig"],"The Weeknd":["R&B","R&B, mörk"],"Lady Gaga":["extravagant","extravagant, pop"],"Kendrick Lamar":["rap","rap, Los Angeles"],"SZA":["soul","R&B, soul"],"Bad Bunny":["reggaeton","reggaeton, Puerto Rico"],"Sabrina Carpenter":["pop","pop, ung"],"Chappell Roan":["drag","drag-inspirerad, pop"],
  "Brandman":["eld","eld, slang"],"Pilot":["flyg","flyg, cockpit"],"Kirurg":["operation","operation, sjukhus"],"Arkitekt":["ritning","ritning, hus"],"Detektiv":["brott","brott, ledtrådar"],"Astronaut":["rymden","rymden, raketer"],"Bagare":["bröd","bröd, ugn"],"Dirigent":["orkester","orkester, taktpinne"],"Dykare":["hav","hav, syrgastank"],"Clown":["cirkus","cirkus, rolig"],"Kock":["mat","mat, restaurang"],"Snickare":["trä","trä, hammare"],"Trollkonstnär":["magi","magi, kort"],"Journalist":["nyheter","nyheter, penna"],"Optiker":["glasögon","glasögon, syn"],"Psykolog":["sinne","sinne, terapi"],"Rörmokare":["rör","rör, vatten"],"Somelier":["vin","vin, smak"],"Tatuerare":["bläck","bläck, hud"],"Livvakt":["skydda","skydda, stark"],"Ballerinadansare":["balett","balett, tutu"],"Bergsprängare":["dynamit","dynamit, sten"],"Glasblåsare":["glas","glas, hetta"],"Läkare":["medicin","medicin, diagnos"],"Lärare":["skola","skola, elever"],
  "Fotboll":["mål","boll, mål"],"Tennis":["racket","racket, nät"],"Simning":["vatten","vatten, crawl"],"Boxning":["handskar","handskar, ring"],"Basket":["korg","korg, hopp"],"Rugby":["oval","oval, takling"],"Golf":["klubba","klubba, hål"],"Karate":["kampsport","kampsport, kata"],"Segling":["vind","vind, båt"],"Klättring":["berg","berg, rep"],"Brottning":["grepp","grepp, matta"],"Curling":["sten","sten, is"],"Fäktning":["värja","värja, mask"],"Skidhopp":["backe","backe, flygning"],"Triathlon":["simma","simma, cykla, spring"],"Cykling":["pedal","pedal, hjälm"],"Bordtennis":["litet bord","litet bord, ping"],"Handboll":["kasta","kasta, mål"],"Ishockey":["puck","puck, skridsko"],"Surfing":["våg","våg, bräda"],"Friidrott":["löpning","löpning, hopp"],"Ridsport":["häst","häst, sadel"],"Cheerleading":["pom-poms","pom-poms, hopp"],"Skateboard":["bräda","bräda, trick"],"BMX":["cykel","cykel, stunt"],
  "Ferrari":["röd","röd, snabb"],"Traktor":["åker","åker, diesel"],"Ubåt":["under","under vatten, torped"],"Helikopter":["rotor","rotor, luften"],"Gondol":["venedig","Venedig, åra"],"Rallybil":["grus","grus, sladd"],"Snöscooter":["snö","snö, motor"],"Monstertruck":["hjul","stora hjul, show"],"Luftskepp":["ballong","ballong, korg"],"Segway":["balansera","balansera, el"],"Hydroplan":["vatten","vatten, start"],"Ångbåt":["ånga","ångkraft, hjul"],"Dragster":["raketstart","raketstart, rak bana"],"Tuk-tuk":["asien","Asien, trehjuling"],"Glidflygplan":["vind","inga motorer, vind"],"Hovercraft":["svävar","luftkudde, svävar"],"Rickshaw":["dra","dra, Asien"],"Kabelbil":["berg","berg, räls"],"Amfibiefordon":["land","land och vatten"],"Moonbuggy":["måne","måne, NASA"],"Jetski":["vatten","vatten, snabbt"],"Pansarvagn":["stål","stål, militär"],"Zeppelinare":["luftskepp","luftskepp, historisk"],"Rymdfärja":["rymden","rymden, NASA"],
  "Tokyo":["japan","japan, neon"],"Paris":["Eiffeltorn","Eiffeltorn, kärlek"],"New York":["skyskrapa","skyskrapa, frihet"],"Dubai":["guld","guld, öken"],"Sydney":["operahus","operahus, hav"],"Rom":["gladiator","gladiator, historia"],"Bangkok":["tempel","tempel, tuk-tuk"],"London":["Big Ben","Big Ben, dimma"],"Istanbul":["bro","bro, bazar"],"Singapore":["ren","ren, liten"],"Barcelona":["Gaudi","Gaudi, strand"],"Mumbai":["Bollywood","Bollywood, kaos"],"Kairo":["pyramid","pyramid, flod"],"Lagos":["nigeria","Nigeria, stor"],"Berlin":["mur","mur, historia"],"Medellin":["colombia","Colombia, berg"],"Seoul":["K-pop","K-pop, teknik"],"Havanna":["cuba","Cuba, oldtimer"],"Reykjavik":["island","island, liten"],"Buenos Aires":["tango","tango, Argentina"],"São Paulo":["brasilien","Brasilien, stor"],"Nairobi":["safari","safari, kenya"],"Bogotá":["colombia","Colombia, högt"],"Jakarta":["indonesien","Indonesien, trångt"],"Göteborg":["sverige","sverige, väst"],
  "Minecraft":["block","block, bygga"],"Fortnite":["battle","battle royale, dans"],"GTA":["stad","stad, brott"],"Zelda":["länk","länk, svärd"],"Pokémon":["fånga","fånga, kämpa"],"FIFA":["fotboll","fotboll, EA"],"Mario":["hoppar","rörmokare, hoppar"],"Halo":["alien","alien, skjuta"],"Overwatch":["hjälte","hjälte, lag"],"Skyrim":["drake","drake, nordisk"],"Among Us":["rymd","rymd, bedragare"],"Tetris":["block","block, rader"],"Pac-Man":["ät","ät, spöken"],"Doom":["helvete","helvete, skjuta"],"The Sims":["simulera","simulera, liv"],"Roblox":["barn","barn, bygga"],"Call of Duty":["krig","krig, skjuta"],"Cyberpunk":["neon","neon, framtid"],"Red Dead Redemption":["cowboy","vilda västern, häst"],"League of Legends":["MOBA","MOBA, champion"],"Elden Ring":["svårt","svårt, ring"],"Stardew Valley":["gård","gård, lugnt"],"Baldur's Gate":["RPG","RPG, dungeons"],"Palworld":["djur","djur, arbeta"],"Helldivers":["co-op","co-op, alien"],
  "Batman":["gotham","mörk, gotham"],"Superman":["flyger","mantel, flyger"],"Spiderman":["nät","nät, klättrar"],"Wonder Woman":["lasso","lasso, amazon"],"Iron Man":["rustning","rustning, teknik"],"Thor":["hammare","hammare, åska"],"Hulk":["grön","grön, arg"],"Black Widow":["spion","spion, röd"],"Captain America":["sköld","sköld, patriot"],"Wolverine":["klor","klor, helar"],"Flash":["snabb","röd, snabb"],"Aquaman":["hav","hav, trident"],"Ant-Man":["liten","liten, myror"],"Doctor Strange":["magi","magi, cape"],"Black Panther":["wakanda","Wakanda, katt"],"Deadpool":["galen","galen, komisk"],"Scarlet Witch":["röd","röd, magi"],"Hawkeye":["pil","pil, båge"],"Storm":["väder","väder, moln"],"Gamora":["grön","grön, galaxen"],"Shang-Chi":["kampsport","kampsport, ring"],"She-Hulk":["grön","grön, advokat"],"Moon Knight":["måne","måne, multipel"],"Ms. Marvel":["elastisk","elastisk, ung"],"Daredevil":["blind","blind, röd"],
  "Vulkan":["lava","lava, berg"],"Vattenfall":["fallande","fallande, flod"],"Öken":["sand","sand, torrt"],"Korallrev":["hav","hav, färg"],"Glaciär":["is","is, smälter"],"Regnskog":["regn","regn, djungel"],"Fjord":["norge","Norge, vatten"],"Geysir":["sprutar","varmt vatten, sprutar"],"Norrsken":["grön","grön, norr"],"Savann":["gräs","gräs, Afrika"],"Mangrove":["rot","rot, kust"],"Lagun":["stilla","stilla, hav"],"Tornado":["virvel","virvel, vind"],"Atoll":["korall","korall, ring"],"Grotta":["mörkt","mörkt, sten"],"Tundra":["kallt","kallt, flatt"],"Monsun":["regn","regn, Asien"],"Kanjon":["djup","djup, sten"],"Delta":["flod","flod, mynning"],"Arktis":["is","is, pol"],"Våtmark":["blöt","blöt, fågel"],"Bäck":["liten","liten, rinner"],"Klippa":["sten","sten, brant"],"Taiga":["skog","skog, norr"],"Prärie":["gräs","gräs, platt"],
  "Zlatan":["fotboll","fotboll, swagger"],"Zara Larsson":["pop","pop, Sverige"],"Robyn":["dance","dance, Sverige"],"Greta Thunberg":["klimat","klimat, ung"],"Avicii":["DJ","DJ, EDM"],"Roxette":["pop","pop, duo"],"The Cardigans":["rock","rock, Jönköping"],"Ace of Base":["eurodance","eurodance, 90-tal"],"Astrid Lindgren":["barn","barn, böcker"],"Björn Borg":["tennis","tennis, pannband"],"Max von Sydow":["skådis","skådis, Bergman"],"Ingmar Bergman":["film","film, existens"],"Lykke Li":["indiefolk","indiefolk, känslosam"],"Tove Lo":["pop","pop, ärlig"],"Swedish House Mafia":["EDM","EDM, trio"],"Loreen":["Eurovision","Eurovision, Euphoria"],"Rolf Lassgård":["skådis","skådis, Beck"],"Noomi Rapace":["Lisbeth","Lisbeth, skådis"],"Pernilla Wahlgren":["tv","underhållning, tv"],"Stina Nordenstam":["alternativ","alternativ, annorlunda"],
  "Midsommar":["sommar","sommar, dans"],"Kräftskiva":["hummer","hummer, snapsvisa"],"Lucia":["ljus","ljus, december"],"Nyår":["fyrverkerier","fyrverkerier, champagne"],"Valborg":["vår","vår, bål"],"Halloween":["skräck","skräck, pumpa"],"Pingst":["kristen","kristen, vår"],"Påsk":["ägg","ägg, kanin"],"Jul":["tomte","tomte, gran"],"Studentfest":["examen","examen, mössa"],"Förfest":["hemma","hemma, billigt"],"Karaoke":["sjung","sjung, mikrofon"],"Maskerad":["kostym","kostym, mask"],"Disco":["glitterball","glitterball, 70-tal"],"Bröllop":["vigsel","vigsel, kärlek"],"Barnkalas":["tårta","tårta, lekar"],"Arbetsparty":["kollegor","kollegor, awkward"],"Klädbytesfest":["byt","byt, second-hand"],"Temaparty":["kostym","kostym, tema"],"Surströmming":["stink","stinkfisk, tradition"],
};

const CAT_COLORS = {
  "🐾 Djur":"#4ade80","🍕 Mat":"#fb923c","🌍 Länder":"#60a5fa","🎬 Film":"#f472b6",
  "🎵 Artister":"#a78bfa","💼 Yrken":"#fbbf24","⚽ Sport":"#34d399","🚗 Fordon":"#94a3b8",
  "🏙️ Städer":"#38bdf8","🎮 Gaming":"#c084fc","🦸 Superhjältar":"#f87171",
  "🌿 Natur":"#86efac","🎭 Kändisar":"#f9a8d4","🍺 Fester":"#fde68a",
  "✏️ Egna ord":"#e879f9",
};

const ALL_CATS   = Object.keys(CATEGORIES);
const CUSTOM_CAT = "✏️ Egna ord";
const fmt        = (s) => `${Math.floor(s/60).toString().padStart(2,"0")}:${(s%60).toString().padStart(2,"0")}`;
const rnd        = (arr) => arr[Math.floor(Math.random() * arr.length)];

// ─── Layout components OUTSIDE to prevent remount bug ─────────────────────────
const BG = () => (
  <div style={{position:"fixed",inset:0,pointerEvents:"none",zIndex:0}}>
    <div style={{position:"absolute",top:-120,right:-120,width:350,height:350,borderRadius:"50%",background:"radial-gradient(circle,rgba(255,34,68,.12),transparent 70%)"}}/>
    <div style={{position:"absolute",bottom:-120,left:-120,width:400,height:400,borderRadius:"50%",background:"radial-gradient(circle,rgba(0,80,255,.08),transparent 70%)"}}/>
  </div>
);
const Wrap = ({ children, center, pt=24 }) => (
  <div className="ig" style={{minHeight:"100vh",width:"100%",background:"linear-gradient(145deg,#080b14 0%,#0d1120 60%,#0f0810 100%)",display:"flex",justifyContent:"center"}}>
    <BG/>
    <div style={{width:"100%",maxWidth:480,minHeight:"100vh",display:"flex",flexDirection:"column",padding:`${pt}px 20px 48px`,position:"relative",zIndex:1,alignItems:center?"center":undefined,textAlign:center?"center":undefined}}>
      {children}
    </div>
  </div>
);

// ─── Main component ───────────────────────────────────────────────────────────
export default function ImpostorGame() {
  setupStyles();

  // Game state
  const [screen,     setScreen]     = useState("home");
  const [selCats,    setSelCats]    = useState(new Set(ALL_CATS));
  const [difficulty, setDifficulty] = useState("normal");
  const [chosenCat,  setChosenCat]  = useState(null);
  const [players,    setPlayers]    = useState(["","","",""]);
  const [secretWord, setSecretWord] = useState("");
  const [impIdx,     setImpIdx]     = useState(-1);
  const [revIdx,     setRevIdx]     = useState(0);
  const [flipped,    setFlipped]    = useState(false);
  const [timer,      setTimer]      = useState(180);
  const [timerOn,    setTimerOn]    = useState(false);
  const [timerDur,   setTimerDur]   = useState(180);
  const [catVisible, setCatVisible] = useState(false);
  const [votedOut,   setVotedOut]   = useState(null);

  // Custom words library – persisted in localStorage
  const [customWords, setCustomWords] = useState(() => {
    try { return JSON.parse(localStorage.getItem("ig_custom_words") || "[]"); }
    catch { return []; }
  });
  // Library form
  const [libWord,   setLibWord]   = useState("");
  const [libNormal, setLibNormal] = useState("");
  const [libEasy,   setLibEasy]   = useState("");
  const [libError,  setLibError]  = useState("");

  const timerRef = useRef(null);
  const valid    = players.filter(n => n.trim().length > 0);
  const allCats  = customWords.length > 0 ? [...ALL_CATS, CUSTOM_CAT] : ALL_CATS;

  // Persist custom words
  useEffect(() => {
    try { localStorage.setItem("ig_custom_words", JSON.stringify(customWords)); } catch {}
  }, [customWords]);

  // Timer tick
  useEffect(() => {
    clearTimeout(timerRef.current);
    if (timerDur === null) return;
    if (timerOn && timer > 0) timerRef.current = setTimeout(() => setTimer(t => t-1), 1000);
    else if (timerOn && timer === 0) setTimerOn(false);
  }, [timerOn, timer, timerDur]);

  const toggleCat = (cat) => setSelCats(prev => {
    const next = new Set(prev);
    if (next.has(cat)) { if (next.size > 1) next.delete(cat); } else next.add(cat);
    return next;
  });

  const toggleAll = () => setSelCats(prev =>
    prev.size === allCats.length ? new Set([allCats[0]]) : new Set(allCats)
  );

  const updatePlayer = (i, val) => setPlayers(prev => {
    const next = [...prev]; next[i] = val; return next;
  });

  // Library: add word
  const addCustomWord = () => {
    const w = libWord.trim(), n = libNormal.trim(), e = libEasy.trim();
    if (!w) return setLibError("Ange ett ord.");
    if (!n) return setLibError("Ange en normal hint (1 ord).");
    if (!e) return setLibError("Ange en enkel hint (2 ord).");
    if (customWords.some(c => c.word.toLowerCase() === w.toLowerCase()))
      return setLibError("Det ordet finns redan i biblioteket.");
    setCustomWords(prev => [...prev, { word: w, normalHint: n, easyHint: e }]);
    setSelCats(prev => new Set([...prev, CUSTOM_CAT]));
    setLibWord(""); setLibNormal(""); setLibEasy(""); setLibError("");
  };

  // Library: remove word
  const removeCustomWord = (i) => {
    setCustomWords(prev => {
      const next = prev.filter((_,j) => j !== i);
      if (next.length === 0) setSelCats(s => { const n2 = new Set(s); n2.delete(CUSTOM_CAT); return n2; });
      return next;
    });
  };

  // Start game
  const startGame = () => {
    const active = [...selCats].filter(c => c === CUSTOM_CAT ? customWords.length > 0 : !!CATEGORIES[c]);
    if (!active.length) return;
    const cat = rnd(active);
    let word;
    if (cat === CUSTOM_CAT) {
      word = rnd(customWords).word;
    } else {
      word = rnd(CATEGORIES[cat]);
    }
    setChosenCat(cat); setSecretWord(word);
    setImpIdx(Math.floor(Math.random() * valid.length));
    setRevIdx(0); setFlipped(false);
    setTimer(timerDur ?? 0); setTimerOn(false); setVotedOut(null); setCatVisible(false);
    setScreen("reveal");
  };

  // Get hint (checks custom words first)
  const getHint = (word) => {
    const custom = customWords.find(c => c.word === word);
    if (custom) return difficulty === "easy" ? custom.easyHint : custom.normalHint;
    const h = HINTS[word];
    if (!h) return "se dig omkring";
    return difficulty === "easy" ? h[1] : h[0];
  };

  const TIMER_OPTS = [
    { label:"Ingen tid", val:null },
    { label:"2 min",     val:120  },
    { label:"3 min",     val:180  },
    { label:"5 min",     val:300  },
  ];
  const DIFF_OPTS = [
    { val:"easy",   label:"Enkel 🟢",  desc:"2-ords hint" },
    { val:"normal", label:"Normal 🟡", desc:"1-ords hint" },
  ];

  // ── LIBRARY SCREEN ──────────────────────────────────────────────────────────
  if (screen === "library") return (
    <Wrap pt={20}>
      {/* Header */}
      <div style={{display:"flex",alignItems:"center",gap:12,marginBottom:20}}>
        <button className="ig-btn" onClick={()=>setScreen("home")} style={{background:"rgba(255,255,255,.07)",color:"#fff",padding:"8px 14px",borderRadius:10,fontSize:16}}>←</button>
        <div>
          <div className="ig-display" style={{fontSize:36,color:"#fff",lineHeight:1}}>EGNA ORD</div>
          <div style={{fontSize:12,color:"rgba(255,255,255,.35)"}}>Bibliotek · {customWords.length} ord</div>
        </div>
      </div>

      {/* Add form */}
      <div style={{background:"rgba(232,121,249,.07)",border:"1.5px solid rgba(232,121,249,.25)",borderRadius:18,padding:"18px",marginBottom:20}}>
        <div style={{fontSize:11,color:"rgba(232,121,249,.8)",fontWeight:700,letterSpacing:3,marginBottom:14}}>✏️ LÄGG TILL ORD</div>
        <div style={{display:"flex",flexDirection:"column",gap:9}}>
          <div>
            <div style={{fontSize:11,color:"rgba(255,255,255,.35)",fontWeight:600,marginBottom:5,letterSpacing:1}}>ORDET</div>
            <input className="ig-inp" placeholder="T.ex. Giraff" value={libWord}
              onChange={e => { setLibWord(e.target.value); setLibError(""); }}/>
          </div>
          <div>
            <div style={{fontSize:11,color:"rgba(251,191,36,.7)",fontWeight:600,marginBottom:5,letterSpacing:1}}>NORMAL HINT 🟡 (1 ord)</div>
            <input className="ig-inp" placeholder="T.ex. lång" value={libNormal}
              onChange={e => { setLibNormal(e.target.value); setLibError(""); }}/>
          </div>
          <div>
            <div style={{fontSize:11,color:"rgba(74,222,128,.7)",fontWeight:600,marginBottom:5,letterSpacing:1}}>ENKEL HINT 🟢 (2 ord)</div>
            <input className="ig-inp" placeholder="T.ex. lång hals" value={libEasy}
              onChange={e => { setLibEasy(e.target.value); setLibError(""); }}/>
          </div>
          {libError && (
            <div style={{fontSize:12,color:"#ff6677",padding:"8px 12px",background:"rgba(255,34,68,.1)",borderRadius:8}}>⚠ {libError}</div>
          )}
          <button className="ig-btn" onClick={addCustomWord} style={{padding:"13px",borderRadius:12,fontSize:14,fontWeight:800,background:"linear-gradient(135deg,#c026d3,#9333ea)",color:"#fff",boxShadow:"0 6px 20px rgba(192,38,211,.3)"}}>
            + Lägg till i biblioteket
          </button>
        </div>
      </div>

      {/* Word list */}
      {customWords.length === 0 ? (
        <div style={{textAlign:"center",padding:"32px 0",color:"rgba(255,255,255,.2)",fontSize:14}}>
          <div style={{fontSize:40,marginBottom:10}}>📭</div>
          Inga egna ord än.<br/>Lägg till ditt första ord ovan!
        </div>
      ) : (
        <div>
          <div style={{fontSize:11,color:"rgba(255,255,255,.4)",fontWeight:700,letterSpacing:3,marginBottom:10}}>DINA ORD</div>
          <div className="ig-scroll" style={{display:"flex",flexDirection:"column",gap:8,maxHeight:"calc(100vh - 520px)",overflowY:"auto"}}>
            {customWords.map((c, i) => (
              <div key={i} style={{background:"rgba(255,255,255,.04)",border:"1.5px solid rgba(255,255,255,.08)",borderRadius:14,padding:"12px 14px",display:"flex",alignItems:"center",gap:12}}>
                <div style={{flex:1,minWidth:0}}>
                  <div style={{fontSize:15,fontWeight:700,color:"#fff",marginBottom:4}}>{c.word}</div>
                  <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
                    <span style={{fontSize:11,color:"rgba(251,191,36,.7)",background:"rgba(251,191,36,.1)",padding:"2px 8px",borderRadius:5}}>🟡 {c.normalHint}</span>
                    <span style={{fontSize:11,color:"rgba(74,222,128,.7)",background:"rgba(74,222,128,.1)",padding:"2px 8px",borderRadius:5}}>🟢 {c.easyHint}</span>
                  </div>
                </div>
                <button className="ig-btn" onClick={()=>removeCustomWord(i)} style={{width:32,height:32,flexShrink:0,borderRadius:8,fontSize:16,background:"rgba(255,34,68,.1)",border:"1px solid rgba(255,34,68,.25)",color:"#ff2244"}}>×</button>
              </div>
            ))}
          </div>
        </div>
      )}
    </Wrap>
  );

  // ── HOME SCREEN ─────────────────────────────────────────────────────────────
  if (screen === "home") return (
    <Wrap pt={24}>
      {/* Header */}
      <div style={{display:"flex",flexDirection:"column",alignItems:"center",marginBottom:18}}>
        <div style={{fontSize:62,lineHeight:1,marginBottom:2}}>🕵️</div>
        <div className="ig-display" style={{fontSize:58,lineHeight:1,color:"#fff"}}>IMPOSTER</div>
        <div className="ig-display" style={{fontSize:46,lineHeight:1,color:"#ff2244",marginBottom:4}}>WHO?</div>
        <p style={{color:"rgba(255,255,255,.35)",fontSize:11,letterSpacing:2,fontWeight:600}}>BLUFFNING · DEDUKTION · MISSTANKE</p>
      </div>

      {/* Categories */}
      <div style={{marginBottom:14}}>
        <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:9}}>
          <div style={{fontSize:11,color:"rgba(255,255,255,.4)",fontWeight:700,letterSpacing:3}}>KATEGORIER</div>
          <div style={{display:"flex",gap:7}}>
            <button className="ig-btn" onClick={()=>setScreen("library")} style={{padding:"5px 11px",borderRadius:8,fontSize:12,fontWeight:700,background:"rgba(232,121,249,.12)",border:"1.5px solid rgba(232,121,249,.35)",color:"#e879f9"}}>
              ✏️ Egna ord {customWords.length > 0 && `(${customWords.length})`}
            </button>
            <button className="ig-btn" onClick={toggleAll} style={{padding:"5px 11px",borderRadius:8,fontSize:12,fontWeight:700,background:selCats.size===allCats.length?"rgba(255,34,68,.15)":"rgba(255,255,255,.07)",border:selCats.size===allCats.length?"1.5px solid rgba(255,34,68,.5)":"1.5px solid rgba(255,255,255,.12)",color:selCats.size===allCats.length?"#ff6677":"rgba(255,255,255,.5)"}}>
              {selCats.size===allCats.length?"✓ Alla":"Välj alla"}
            </button>
          </div>
        </div>
        <div className="ig-scroll" style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:7,maxHeight:270,overflowY:"auto",paddingRight:2}}>
          {allCats.map(cat => {
            const color  = CAT_COLORS[cat] || "#60a5fa";
            const active = selCats.has(cat);
            const isCustom = cat === CUSTOM_CAT;
            const [icon,...rest] = cat.split(" ");
            const disabled = isCustom && customWords.length === 0;
            return (
              <button key={cat} className="ig-catbtn ig-btn" disabled={disabled}
                onClick={()=>toggleCat(cat)}
                style={{background:active?`${color}1e`:"rgba(255,255,255,.03)",border:active?`1.5px solid ${color}77`:"1.5px solid rgba(255,255,255,.07)",borderRadius:13,padding:"10px 8px",display:"flex",flexDirection:"column",alignItems:"center",gap:3,position:"relative",overflow:"hidden",opacity:disabled?.4:1}}>
                {active && !disabled && <div style={{position:"absolute",top:5,right:6,width:15,height:15,borderRadius:4,background:color,display:"flex",alignItems:"center",justifyContent:"center",fontSize:9,fontWeight:900,color:"#000"}}>✓</div>}
                <span style={{fontSize:26}}>{icon}</span>
                <span style={{fontSize:10,fontWeight:700,color:active&&!disabled?"#fff":"rgba(255,255,255,.38)",lineHeight:1.2,textAlign:"center"}}>{rest.join(" ")}</span>
                {isCustom && <span style={{fontSize:9,color:`${color}88`}}>{customWords.length} ord</span>}
              </button>
            );
          })}
        </div>
        <div style={{marginTop:6,fontSize:11,color:"rgba(255,255,255,.28)",textAlign:"center"}}>
          {selCats.size===allCats.length ? "Alla kategorier — du vet inte vilken! 🎲" : selCats.size===1 ? `Låst: ${[...selCats][0]}` : `${selCats.size} kategorier — slumpmässig`}
        </div>
      </div>

      {/* Difficulty */}
      <div style={{marginBottom:14}}>
        <div style={{fontSize:11,color:"rgba(255,255,255,.4)",fontWeight:700,letterSpacing:3,marginBottom:8}}>🎯 SVÅRIGHETSGRAD (impostorns hint)</div>
        <div style={{display:"flex",gap:8}}>
          {DIFF_OPTS.map(({val,label,desc}) => (
            <button key={val} className="ig-btn" onClick={()=>setDifficulty(val)} style={{flex:1,padding:"11px 8px",borderRadius:12,background:difficulty===val?"linear-gradient(135deg,#ff2244,#ff6232)":"rgba(255,255,255,.05)",border:difficulty===val?"none":"1.5px solid rgba(255,255,255,.09)",color:"#fff",display:"flex",flexDirection:"column",gap:3,alignItems:"center"}}>
              <span style={{fontSize:13,fontWeight:800}}>{label}</span>
              <span style={{fontSize:10,opacity:.7}}>{desc}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Players */}
      <div style={{marginBottom:14}}>
        <div style={{fontSize:11,color:"rgba(255,255,255,.4)",fontWeight:700,letterSpacing:3,marginBottom:9}}>SPELARE</div>
        <div style={{display:"flex",flexDirection:"column",gap:7,marginBottom:7}}>
          {players.map((name,i) => (
            <div key={i} style={{display:"flex",alignItems:"center",gap:9}}>
              <div style={{width:33,height:33,borderRadius:10,flexShrink:0,background:`hsl(${i*52+180},50%,30%)`,border:`1.5px solid hsl(${i*52+180},55%,45%)`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:13,fontWeight:800,color:`hsl(${i*52+180},80%,75%)`}}>{i+1}</div>
              <input className="ig-inp" placeholder={`Spelare ${i+1}…`} value={name} onChange={e => updatePlayer(i, e.target.value)}/>
              {players.length > 3 && (
                <button className="ig-btn" onClick={()=>setPlayers(p=>p.filter((_,j)=>j!==i))} style={{width:30,height:30,flexShrink:0,borderRadius:8,fontSize:15,background:"rgba(255,34,68,.1)",border:"1px solid rgba(255,34,68,.25)",color:"#ff2244"}}>×</button>
              )}
            </div>
          ))}
          {players.length < 15 && (
            <button className="ig-btn" onClick={()=>setPlayers(p=>[...p,""])} style={{padding:"10px",borderRadius:11,background:"rgba(255,255,255,.03)",border:"1.5px dashed rgba(255,255,255,.11)",color:"rgba(255,255,255,.3)",fontSize:13,fontWeight:500}}>+ Lägg till spelare</button>
          )}
        </div>
      </div>

      {/* Timer */}
      <div style={{marginBottom:18}}>
        <div style={{fontSize:11,color:"rgba(255,255,255,.4)",fontWeight:700,letterSpacing:3,marginBottom:8}}>⏱ DISKUSSIONSTID</div>
        <div style={{display:"flex",gap:7}}>
          {TIMER_OPTS.map(({label,val}) => (
            <button key={label} className="ig-btn" onClick={()=>setTimerDur(val)} style={{flex:1,padding:"10px 4px",borderRadius:10,fontSize:12,fontWeight:700,background:timerDur===val?"linear-gradient(135deg,#ff2244,#ff6232)":"rgba(255,255,255,.05)",border:timerDur===val?"none":"1.5px solid rgba(255,255,255,.09)",color:"#fff"}}>
              {label}
            </button>
          ))}
        </div>
      </div>

      <button className="ig-btn ig-glo" onClick={startGame} disabled={valid.length<3} style={{padding:"20px",borderRadius:18,fontSize:18,fontWeight:800,width:"100%",background:valid.length>=3?"linear-gradient(135deg,#ff2244 0%,#ff6232 100%)":"rgba(255,255,255,.06)",color:valid.length>=3?"#fff":"rgba(255,255,255,.25)",boxShadow:valid.length>=3?"0 8px 32px rgba(255,34,68,.3)":"none"}}>
        {valid.length<3 ? `Minst 3 spelare krävs (${valid.length}/3)` : `🎮 Starta med ${valid.length} spelare`}
      </button>
    </Wrap>
  );

  // ── REVEAL SCREEN ───────────────────────────────────────────────────────────
  if (screen === "reveal") {
    const cur       = valid[revIdx];
    const isImp     = revIdx === impIdx;
    const hint      = getHint(secretWord);
    const diffColor = difficulty === "easy" ? "#4ade80" : "#fbbf24";

    return (
      <Wrap center pt={28}>
        <div style={{display:"flex",flexDirection:"column",alignItems:"center",gap:0,width:"100%"}}>
          <div style={{display:"flex",gap:7,marginBottom:20}}>
            {valid.map((_,i) => <div key={i} style={{width:i===revIdx?24:8,height:8,borderRadius:4,background:i===revIdx?"#ff2244":i<revIdx?"rgba(255,255,255,.5)":"rgba(255,255,255,.15)",transition:"all .3s"}}/>)}
          </div>
          <div className="ig-display" style={{fontSize:42,color:"#fff",lineHeight:1}}>{cur}</div>
          <p style={{color:"rgba(255,255,255,.38)",fontSize:13,margin:"6px 0 24px",padding:"0 10px",textAlign:"center",lineHeight:1.5}}>
            {flipped ? (isImp ? "Du är impostern — bluffa grymt! 😈" : "Kom ihåg ditt ord!") : "Håll telefonen privat och tryck för att se din roll"}
          </p>

          <div className="ig-flip" onClick={!flipped?()=>setFlipped(true):undefined}
            style={{width:"100%",height:300,cursor:flipped?"default":"pointer"}}>
            <div className={`ig-flip-inner${flipped?" flipped":""}`}>
              <div className="ig-ffront" style={{background:"linear-gradient(145deg,rgba(255,255,255,.08),rgba(255,255,255,.03))",border:"1.5px solid rgba(255,255,255,.12)",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",gap:14}}>
                <div className="ig-pls" style={{fontSize:60}}>👁️</div>
                <div style={{fontWeight:800,fontSize:17,color:"rgba(255,255,255,.75)",letterSpacing:1}}>TRYCK FÖR ATT AVSLÖJA</div>
                <div style={{fontSize:12,color:"rgba(255,255,255,.28)"}}>Enbart för dina ögon</div>
              </div>
              <div className="ig-fback" style={{background:isImp?"linear-gradient(145deg,#1c0008,#2e0012)":"linear-gradient(145deg,#001a0e,#002e1a)",border:isImp?"2px solid rgba(255,34,68,.65)":"2px solid rgba(52,211,153,.55)",boxShadow:isImp?"0 0 50px rgba(255,34,68,.25)":"0 0 50px rgba(52,211,153,.15)",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",gap:8,padding:"0 22px"}}>
                {isImp ? (
                  <>
                    <div style={{fontSize:44}}>🕵️</div>
                    <div className="ig-display" style={{fontSize:48,color:"#ff2244",lineHeight:1}}>IMPOSTER</div>
                    <div style={{fontSize:12,color:"rgba(255,100,100,.6)",lineHeight:1.5,textAlign:"center",marginBottom:6}}>Du vet inte ordet — bluffa och smälta in!</div>
                    <div style={{width:"100%",background:`${diffColor}14`,border:`1.5px solid ${diffColor}44`,borderRadius:14,padding:"10px 14px",textAlign:"center"}}>
                      <div style={{fontSize:10,color:`${diffColor}88`,fontWeight:700,letterSpacing:2,marginBottom:3}}>
                        {difficulty==="easy"?"ENKEL HINT 🟢":"NORMAL HINT 🟡"}
                      </div>
                      <div style={{fontSize:20,fontWeight:800,color:diffColor}}>{hint}</div>
                    </div>
                  </>
                ) : (
                  <>
                    <div style={{fontSize:12,color:"rgba(52,211,153,.7)",fontWeight:700,letterSpacing:3}}>DITT ORD</div>
                    <div className="ig-display" style={{fontSize:52,color:"#34d399",lineHeight:1}}>{secretWord}</div>
                    <div style={{fontSize:12,color:"rgba(52,211,153,.45)",lineHeight:1.5,textAlign:"center"}}>Ge ledtrådar utan att avslöja ordet</div>
                  </>
                )}
              </div>
            </div>
          </div>

          {flipped && (
            <button className="ig-btn ig-bi" onClick={() => {
              if (revIdx+1 < valid.length) {
                setFlipped(false);
                setTimeout(() => setRevIdx(i => i+1), 700);
              } else {
                setScreen("game");
              }
            }} style={{marginTop:20,background:revIdx+1<valid.length?"linear-gradient(135deg,#ff2244,#ff6232)":"linear-gradient(135deg,#34d399,#059669)",color:"#fff",padding:"16px 36px",borderRadius:16,fontSize:16,fontWeight:800,boxShadow:revIdx+1<valid.length?"0 8px 28px rgba(255,34,68,.3)":"0 8px 28px rgba(52,211,153,.25)"}}>
              {revIdx+1<valid.length ? `✓ Klar · Ge till ${valid[revIdx+1]}` : "🎮 STARTA SPELET!"}
            </button>
          )}
        </div>
      </Wrap>
    );
  }

  // ── GAME SCREEN ─────────────────────────────────────────────────────────────
  if (screen === "game") {
    const noTimer = timerDur === null;
    const tc      = noTimer ? "#60a5fa" : timer < 30 ? "#ff2244" : timer < 60 ? "#fbbf24" : "#34d399";
    const urgent  = !noTimer && timer < 30 && timerOn;
    return (
      <Wrap center pt={24}>
        <div style={{display:"flex",flexDirection:"column",alignItems:"center",width:"100%"}}>
          <div className={urgent?"ig-tpls":undefined} style={{width:190,height:190,borderRadius:"50%",border:`5px solid ${tc}`,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",background:`radial-gradient(circle,${tc}14,transparent 70%)`,boxShadow:`0 0 40px ${tc}44`,marginBottom:10,transition:"border-color .5s,box-shadow .5s"}}>
            {noTimer
              ? <div style={{fontSize:44}}>⏾</div>
              : <><div className="ig-display" style={{fontSize:56,color:tc,lineHeight:1,transition:"color .5s"}}>{fmt(timer)}</div><div style={{fontSize:11,color:"rgba(255,255,255,.35)",letterSpacing:3,fontWeight:600}}>KVAR</div></>
            }
          </div>

          {!noTimer ? (
            <div style={{display:"flex",gap:10,marginBottom:20}}>
              <button className="ig-btn" onClick={()=>setTimerOn(t=>!t)} style={{padding:"10px 20px",borderRadius:12,fontSize:14,fontWeight:700,background:timerOn?"rgba(251,191,36,.13)":"rgba(52,211,153,.13)",border:timerOn?"1.5px solid rgba(251,191,36,.4)":"1.5px solid rgba(52,211,153,.4)",color:timerOn?"#fbbf24":"#34d399"}}>
                {timerOn?"⏸ Pausa":"▶ Starta"}
              </button>
              <button className="ig-btn" onClick={()=>{setTimer(timerDur);setTimerOn(false);}} style={{padding:"10px 20px",borderRadius:12,fontSize:14,fontWeight:700,background:"rgba(255,255,255,.05)",border:"1.5px solid rgba(255,255,255,.1)",color:"rgba(255,255,255,.5)"}}>↺ Återställ</button>
            </div>
          ) : (
            <div style={{fontSize:13,color:"rgba(255,255,255,.3)",marginBottom:20}}>Ingen tidsgräns — spela så länge ni vill!</div>
          )}

          <button className="ig-btn" onClick={()=>setCatVisible(v=>!v)} style={{width:"100%",background:"rgba(255,255,255,.04)",border:"1.5px solid rgba(255,255,255,.08)",borderRadius:16,padding:"14px 18px",marginBottom:14,textAlign:"left"}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
              <div>
                <div style={{fontSize:11,color:"rgba(255,255,255,.4)",fontWeight:700,letterSpacing:3,marginBottom:4}}>KATEGORI</div>
                {catVisible
                  ? <div style={{fontSize:20,fontWeight:700,color:"#fff"}}>{chosenCat}</div>
                  : <div style={{fontSize:14,fontWeight:600,color:"rgba(255,255,255,.25)",letterSpacing:1}}>Tryck för att visa 👁</div>
                }
              </div>
              <div style={{fontSize:12,color:"rgba(255,255,255,.3)",textAlign:"right"}}>
                <div>{difficulty==="easy"?"Enkel 🟢":"Normal 🟡"}</div>
                <div style={{fontSize:10,marginTop:2}}>svårighetsgrad</div>
              </div>
            </div>
          </button>

          <div style={{width:"100%",marginBottom:16}}>
            <div style={{fontSize:11,color:"rgba(255,255,255,.4)",fontWeight:700,letterSpacing:3,marginBottom:10}}>SPELARE ({valid.length})</div>
            <div style={{display:"flex",flexWrap:"wrap",gap:8}}>
              {valid.map((p,i) => <div key={i} style={{padding:"8px 14px",borderRadius:10,fontSize:14,fontWeight:600,background:`hsl(${i*52+180},30%,20%)`,border:`1.5px solid hsl(${i*52+180},40%,32%)`,color:`hsl(${i*52+180},60%,72%)`}}>{p}</div>)}
            </div>
          </div>

          <p style={{fontSize:13,color:"rgba(255,255,255,.3)",marginBottom:14,textAlign:"center",lineHeight:1.5}}>Diskutera, ge ledtrådar och försök hitta impostern!</p>
          <button className="ig-btn" onClick={()=>setScreen("vote")} style={{width:"100%",padding:"18px",borderRadius:16,fontSize:18,fontWeight:800,background:"linear-gradient(135deg,#ff2244,#ff6232)",color:"#fff",boxShadow:"0 8px 28px rgba(255,34,68,.3)"}}>
            🗳️ Rösta ut någon
          </button>
        </div>
      </Wrap>
    );
  }

  // ── VOTE SCREEN ─────────────────────────────────────────────────────────────
  if (screen === "vote") return (
    <Wrap pt={24}>
      <div className="ig-display" style={{fontSize:44,color:"#fff",marginBottom:4}}>RÖSTA</div>
      <p style={{color:"rgba(255,255,255,.38)",fontSize:14,marginBottom:28}}>Vem tror ni är impostern?</p>
      <div style={{display:"flex",flexDirection:"column",gap:10,marginBottom:16}}>
        {valid.map((p,i) => (
          <button key={i} className="ig-btn" onClick={()=>{setVotedOut(p);setScreen("result");}} style={{padding:"18px",borderRadius:16,background:"rgba(255,255,255,.04)",border:"1.5px solid rgba(255,255,255,.09)",display:"flex",alignItems:"center",gap:14}}>
            <div style={{width:46,height:46,borderRadius:13,flexShrink:0,background:`hsl(${i*52+180},45%,30%)`,border:`1.5px solid hsl(${i*52+180},55%,48%)`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:20,fontWeight:800,color:`hsl(${i*52+180},80%,78%)`}}>{p[0]?.toUpperCase()}</div>
            <span style={{fontSize:18,fontWeight:700,color:"#fff"}}>{p}</span>
            <div style={{marginLeft:"auto",color:"rgba(255,255,255,.25)",fontSize:20}}>→</div>
          </button>
        ))}
      </div>
      <button className="ig-btn" onClick={()=>setScreen("game")} style={{width:"100%",padding:"14px",borderRadius:14,background:"rgba(255,255,255,.04)",border:"1.5px solid rgba(255,255,255,.09)",color:"rgba(255,255,255,.38)",fontSize:14,fontWeight:600}}>← Tillbaka</button>
    </Wrap>
  );

  // ── RESULT SCREEN ───────────────────────────────────────────────────────────
  if (screen === "result") {
    const caught    = votedOut === valid[impIdx];
    const actualImp = valid[impIdx];
    return (
      <Wrap center pt={36}>
        <div style={{display:"flex",flexDirection:"column",alignItems:"center",width:"100%"}}>
          <div className="ig-bi" style={{fontSize:80,marginBottom:14}}>{caught?"🎉":"🕵️"}</div>
          <div className="ig-display" style={{fontSize:44,lineHeight:1,color:caught?"#34d399":"#ff2244",marginBottom:8}}>
            {caught?"AVSLÖJAD!":"IMPOSTORN VANN!"}
          </div>
          <p style={{color:"rgba(255,255,255,.45)",fontSize:14,marginBottom:24,padding:"0 8px",lineHeight:1.6}}>
            {caught ? "Bra jobbat! Ni röstade ut rätt person." : `${votedOut} var oskyldig. Impostorn klarade sig!`}
          </p>
          <div style={{width:"100%",borderRadius:20,padding:"22px",background:"rgba(255,255,255,.04)",border:"1.5px solid rgba(255,255,255,.09)",marginBottom:16}}>
            <div style={{marginBottom:18}}>
              <div style={{fontSize:11,color:"rgba(255,255,255,.38)",letterSpacing:3,fontWeight:700,marginBottom:6}}>IMPOSTORN VAR</div>
              <div style={{fontSize:26,fontWeight:800,color:"#ff2244"}}>{actualImp} 🕵️</div>
            </div>
            <div style={{height:1,background:"rgba(255,255,255,.07)",marginBottom:18}}/>
            <div>
              <div style={{fontSize:11,color:"rgba(255,255,255,.38)",letterSpacing:3,fontWeight:700,marginBottom:6}}>DET HEMLIGA ORDET</div>
              <div className="ig-display" style={{fontSize:46,color:"#fff",lineHeight:1}}>{secretWord}</div>
              <div style={{fontSize:12,color:"rgba(255,255,255,.35)",marginTop:4}}>{chosenCat}</div>
            </div>
          </div>
          <div style={{width:"100%",borderRadius:14,padding:"14px 16px",marginBottom:24,background:caught?"rgba(52,211,153,.08)":"rgba(255,34,68,.08)",border:caught?"1.5px solid rgba(52,211,153,.25)":"1.5px solid rgba(255,34,68,.25)"}}>
            <div style={{fontSize:14,fontWeight:700,color:caught?"#34d399":"#ff2244"}}>
              {caught?"🏆 Civila vinner denna runda!":"🏆 Impostorn vinner denna runda!"}
            </div>
          </div>
          <div style={{display:"flex",gap:12,width:"100%",marginBottom:10}}>
            <button className="ig-btn" onClick={startGame} style={{flex:1,padding:"16px",borderRadius:14,fontSize:14,fontWeight:800,background:"rgba(255,255,255,.07)",border:"1.5px solid rgba(255,255,255,.13)",color:"#fff"}}>🔄 Ny runda</button>
            <button className="ig-btn" onClick={()=>setScreen("home")} style={{flex:1,padding:"16px",borderRadius:14,fontSize:14,fontWeight:800,background:"rgba(255,255,255,.07)",border:"1.5px solid rgba(255,255,255,.13)",color:"#fff"}}>⚙️ Inställningar</button>
          </div>
          <button className="ig-btn" onClick={()=>setScreen("home")} style={{width:"100%",padding:"16px",borderRadius:14,fontSize:15,fontWeight:800,background:"linear-gradient(135deg,#ff2244,#ff6232)",color:"#fff",boxShadow:"0 8px 28px rgba(255,34,68,.28)"}}>🏠 Hem</button>
        </div>
      </Wrap>
    );
  }

  return null;
}
