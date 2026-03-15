export interface SkinSeed {
  name: string;
  weapon_name: string;
  skin_name: string;
  rarity: string;
  case_name: string;
  min_float: number;
  max_float: number;
  is_knife: boolean;
  is_glove: boolean;
  has_souvenir: boolean;
  release_date: string;
  base_price: number;
}

// ─── Price ranges by rarity ──────────────────────────
const PRICE_RANGE: Record<string, [number, number]> = {
  'Consumer Grade': [0.03, 0.50],
  'Industrial Grade': [0.05, 2.00],
  'Mil-Spec': [0.10, 25.00],
  'Restricted': [1.00, 80.00],
  'Classified': [3.00, 250.00],
  'Covert': [8.00, 500.00],
  'Extraordinary': [60.00, 2000.00],
};

function seededRandom(seed: number): number {
  const x = Math.sin(seed * 9301 + 49297) * 49297;
  return x - Math.floor(x);
}

function priceForSkin(weapon: string, skin: string, rarity: string, override?: number): number {
  if (override) return override;
  const range = PRICE_RANGE[rarity] || [1, 50];
  const seed = (weapon + skin).split('').reduce((a, c) => a + c.charCodeAt(0), 0);
  const r = seededRandom(seed);
  return Math.round((range[0] + r * (range[1] - range[0])) * 100) / 100;
}

const CASES = [
  'Kilowatt Case', 'Revolution Case', 'Recoil Case', 'Dreams & Nightmares Case',
  'Snakebite Case', 'Fracture Case', 'Prisma 2 Case', 'Shattered Web Case',
  'CS20 Case', 'Prisma Case', 'Danger Zone Case', 'Horizon Case', 'Clutch Case',
  'Spectrum 2 Case', 'Spectrum Case', 'Glove Case', 'Gamma 2 Case', 'Gamma Case',
  'Chroma 3 Case', 'Chroma 2 Case', 'Chroma Case', 'Revolver Case',
  'Shadow Case', 'Falchion Case', 'Huntsman Case', 'Phoenix Case',
  'Winter Offensive Case', 'Operation Bravo Case', 'Operation Breakout Case',
  'Operation Vanguard Case', 'Operation Wildfire Case', 'Operation Hydra Case',
  'Operation Broken Fang Case', 'Operation Riptide Case', 'Gallery Case',
  'Anubis Collection', 'Cobblestone Collection', 'Dust 2 Collection',
  'Inferno Collection', 'Mirage Collection', 'Nuke Collection',
];

function pickCase(seed: number): string { return CASES[Math.abs(seed) % CASES.length]; }
function pickDate(seed: number): string {
  const y = 2013 + (Math.abs(seed) % 12);
  const m = 1 + (Math.abs(seed * 7) % 12);
  const d = 1 + (Math.abs(seed * 13) % 28);
  return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

type SE = [string, string, number?]; // [skin_name, rarity, price_override?]

const WEAPON_SKINS: Record<string, SE[]> = {
  'AK-47': [
    ['Asiimov','Covert',35],['Redline','Classified',12],['Vulcan','Covert',28],['Fire Serpent','Covert',800],['Neon Rider','Covert',42],['Phantom Disruptor','Covert',18],['The Empress','Covert',22],['Bloodsport','Covert',30],['Fuel Injector','Classified',32],['Aquamarine Revenge','Classified',15],['Case Hardened','Classified',45],['Hydroponic','Classified',120],['Wild Lotus','Covert',2500],['Nightwish','Classified',8],['Head Shot','Classified',25],['Ice Coaled','Classified',6],['Slate','Industrial Grade',5],['Inheritance','Covert',15],['Legion of Anubis','Classified',10],['Panthera onca','Classified',8],['Frontside Misty','Classified',8],['Point Disarray','Classified',6],['Neon Revolution','Covert',12],['Wasteland Rebel','Classified',15],['Jaguar','Classified',8],['Gold Arabesque','Classified',35],['X-Ray','Classified',3],['Blue Laminate','Mil-Spec',1.5],['Leet Museo','Classified',8],['Elite Build','Mil-Spec',0.5],['Safari Mesh','Consumer Grade',0.3],['Jungle Spray','Consumer Grade',0.2],['Predator','Consumer Grade',0.25],['Emerald Pinstripe','Industrial Grade',1],['Rat Rod','Mil-Spec',0.8],['Orbit Mk01','Classified',5],['Uncharted','Restricted',3],['First Class','Mil-Spec',0.6],['Baroque Purple','Industrial Grade',0.4],['Green Laminate','Restricted',2],['Cartel','Restricted',1.5],['Jet Set','Classified',30],
  ],
  'M4A4': [
    ['Asiimov','Covert',55],['Neo-Noir','Covert',12],['Howl','Covert',3500],['Poseidon','Classified',180],['The Emperor','Covert',8],['Desert-Strike','Restricted',3],['Buzz Kill','Classified',8],['In Living Color','Covert',25],['Tooth Fairy','Covert',12],['Spider Lily','Covert',15],['Temukau','Covert',18],['Royal Paladin','Classified',6],['Desolate Space','Classified',10],['Hellfire','Classified',5],['X-Ray','Restricted',3],['Griffin','Restricted',2],['Bullet Rain','Classified',5],['Dragon King','Restricted',3],['Evil Daimyo','Mil-Spec',0.4],['Faded Zebra','Industrial Grade',0.15],['Urban DDPAT','Industrial Grade',0.2],['Jungle Tiger','Industrial Grade',0.15],['Mainframe','Restricted',1.5],['Converter','Restricted',1.8],['Global Offensive','Classified',8],['The Coalition','Classified',5],['Poly Mag','Restricted',2],['Cyber Security','Mil-Spec',0.6],['Zirka','Classified',2.5],['Radiation Hazard','Classified',12],['Modern Hunter','Restricted',2],['Daybreak','Restricted',4],
  ],
  'M4A1-S': [
    ['Printstream','Covert',130],['Hyper Beast','Covert',15],['Golden Coil','Classified',18],['Hot Rod','Classified',85],['Knight','Classified',250],['Icarus Fell','Classified',65],["Chantico's Fire",'Classified',28],['Mecha Industries','Covert',10],['Player Two','Covert',22],['Welcome to the Jungle','Covert',45],['Blue Phosphor','Restricted',5],['Night Terror','Classified',8],['Emphorosaur-S','Covert',12],['Decimator','Restricted',3],['Cyrex','Classified',5],['Atomic Alloy','Restricted',3],['Guardian','Classified',3],['Leaded Glass','Classified',4],['Basilisk','Mil-Spec',0.5],['Bright Water','Mil-Spec',1],['Nitro','Classified',6],['Dark Water','Restricted',2],['Blood Tiger','Mil-Spec',0.4],['Boreal Forest','Industrial Grade',0.2],['Flashback','Mil-Spec',0.3],['Moss Quartz','Industrial Grade',0.25],['Control Panel','Mil-Spec',0.6],['Nightmare','Classified',3],['Master Piece','Covert',80],
  ],
  'FAMAS': [['Roll Cage','Mil-Spec',2],['Mecha Industries','Restricted',3],['Eye of Athena','Restricted',5],['Commemoration','Classified',12],['Djinn','Restricted',2],['Pulse','Mil-Spec',0.3],['Afterimage','Restricted',2.5],['Valence','Restricted',1],['Hexane','Industrial Grade',0.15],['Styx','Mil-Spec',0.5],['Decommissioned','Mil-Spec',0.8],['Cyanospatter','Consumer Grade',0.05],['Colony','Consumer Grade',0.05],['Teardown','Industrial Grade',0.1],['Sergeant','Industrial Grade',0.1],['Macabre','Mil-Spec',0.3],['Doomkitty','Mil-Spec',0.25],['Neural Net','Mil-Spec',0.2],['Survivor Z','Mil-Spec',0.2],['Rapid Eye Movement','Restricted',1.5],['Prime Conspiracy','Restricted',1.8]],
  'Galil AR': [['Chatterbox','Classified',4],['Cerberus','Restricted',8],['Sugar Rush','Mil-Spec',2],['Phoenix Blacklight','Restricted',3],['Eco','Restricted',1.5],['Chromatic Aberration','Classified',3],['Cold Fusion','Restricted',2],['Signal','Mil-Spec',0.4],['Rocket Pop','Mil-Spec',0.3],['Stone Cold','Mil-Spec',0.2],['Firefight','Mil-Spec',0.15],['Orange DDPAT','Industrial Grade',0.1],['Sandstorm','Industrial Grade',0.1],['Sage Spray','Consumer Grade',0.05],['Kami','Industrial Grade',0.08],['Akoben','Mil-Spec',0.3],['Connexion','Restricted',1.2]],
  'SG 553': [['Integrale','Restricted',3],['Pulse','Mil-Spec',1],['Tiger Moth','Restricted',2],['Darkwing','Mil-Spec',1.5],['Cyrex','Classified',3],['Bulldozer','Restricted',2],['Triarch','Restricted',1.5],['Atlas','Industrial Grade',0.15],['Fallout Warning','Consumer Grade',0.05],['Wave Spray','Consumer Grade',0.05],['Hazard Pay','Mil-Spec',0.25],['Aerial','Classified',2],['Phantom','Mil-Spec',0.3],['Damascus Steel','Mil-Spec',0.4],['Ultraviolet','Industrial Grade',0.1]],
  'AUG': [['Akihabara Accept','Covert',1500],['Chameleon','Restricted',3],['Flame Jinn','Restricted',5],['Hot Rod','Classified',25],['Syd Mead','Classified',3],['Stymphalian','Restricted',2],['Momentum','Restricted',1.5],['Fleet Flock','Mil-Spec',0.5],['Aristocrat','Mil-Spec',0.3],['Wings','Mil-Spec',0.2],['Torque','Mil-Spec',0.15],['Colony','Consumer Grade',0.05],['Storm','Consumer Grade',0.05],['Contractor','Consumer Grade',0.05],['Condemned','Industrial Grade',0.1],['Daedalus','Industrial Grade',0.08],['Random Access','Mil-Spec',0.25]],
  'MP9': [['Hydra','Restricted',4],['Wild Lily','Classified',8],['Mount Fuji','Restricted',5],['Starlight Protector','Classified',6],['Rose Iron','Mil-Spec',0.5],['Bioleak','Mil-Spec',0.2],['Airlock','Restricted',1.5],['Deadly Poison','Mil-Spec',0.3],['Ruby Poison Dart','Restricted',2],['Setting Sun','Industrial Grade',0.1],['Sand Dashed','Consumer Grade',0.05],['Storm','Consumer Grade',0.05],['Orange Peel','Consumer Grade',0.05],['Slide','Mil-Spec',0.15],['Featherweight','Mil-Spec',0.2],['Music Box','Restricted',1.5],['Modest Threat','Restricted',1]],
  'MAC-10': [['Neon Rider','Classified',5],['Stalker','Mil-Spec',2],['Case Hardened','Classified',8],['Whitefish','Mil-Spec',0.5],['Disco Tech','Restricted',2],['Heat','Mil-Spec',0.3],['Graven','Restricted',1.5],['Pipe Down','Restricted',2],['Curse','Restricted',1],['Tatter','Industrial Grade',0.08],['Silver','Consumer Grade',0.05],['Candy Apple','Industrial Grade',0.1],['Fade','Restricted',4],['Nuclear Garden','Mil-Spec',0.25],['Last Dive','Mil-Spec',0.2],['Malachite','Mil-Spec',0.3],['Propaganda','Restricted',1.5],['Button Masher','Restricted',1.8]],
  'MP7': [['Nemesis','Classified',4],['Bloodsport','Restricted',2],['Impire','Mil-Spec',0.3],['Special Delivery','Restricted',1.5],['Skulls','Mil-Spec',0.15],['Fade','Restricted',3],['Powercore','Mil-Spec',0.25],['Akoben','Mil-Spec',0.2],['Armor Core','Mil-Spec',0.15],['Forest DDPAT','Consumer Grade',0.05],['Olive Plaid','Consumer Grade',0.05],['Whiteout','Mil-Spec',0.5],['Ocean Foam','Industrial Grade',0.1],['Abyssal Apparition','Restricted',1.5],['Cyan Blossom','Restricted',1]],
  'UMP-45': [['Primal Saber','Classified',6],['Crime Scene','Restricted',2],['Fade','Restricted',12],['Momentum','Restricted',1.5],['Riot','Restricted',1],['Moonrise','Restricted',1.5],['Exposure','Restricted',2],['Grand Prix','Mil-Spec',0.3],['Labyrinth','Mil-Spec',0.2],['Plastique','Mil-Spec',0.25],['Corporal','Consumer Grade',0.05],['Indigo','Consumer Grade',0.05],['Carbon Fiber','Industrial Grade',0.1],['Scorched','Consumer Grade',0.05],['Arctic Wolf','Restricted',1.5],['Oscillator','Restricted',1.8]],
  'P90': [['Asiimov','Covert',8],['Death by Kitty','Classified',18],['Emerald Dragon','Classified',12],['Shapewood','Restricted',3],['Trigon','Restricted',1.5],['Cold Blooded','Restricted',2],['Chopper','Restricted',1.5],['Nostalgia','Restricted',2],['Shallow Grave','Mil-Spec',0.3],['Desert Warfare','Mil-Spec',0.2],['Elite Build','Mil-Spec',0.15],['Storm','Consumer Grade',0.05],['Sand Spray','Consumer Grade',0.05],['Leather','Consumer Grade',0.05],['Blindspot','Industrial Grade',0.1],['Freight','Mil-Spec',0.2],['Virus','Restricted',1],['Facility Draft','Mil-Spec',0.3],['Traction','Restricted',1.5]],
  'PP-Bizon': [['Judgement of Anubis','Restricted',2],['High Roller','Restricted',1.5],['Blue Streak','Mil-Spec',0.3],['Jungle Slipstream','Mil-Spec',0.2],['Fuel Rod','Mil-Spec',0.15],['Antique','Mil-Spec',0.2],['Osiris','Mil-Spec',0.15],['Night Riot','Industrial Grade',0.08],['Sand Dashed','Consumer Grade',0.05],['Carbon Fiber','Consumer Grade',0.05],['Harvester','Restricted',1],['Space Cat','Restricted',1.5],['Modern Hunter','Industrial Grade',0.1],['Photic Zone','Mil-Spec',0.25],['Embargo','Restricted',1.2]],
  'MP5-SD': [['Lab Rats','Restricted',2],['Phosphor','Mil-Spec',0.4],['Gauss','Mil-Spec',0.3],['Co-Processor','Mil-Spec',0.25],['Acid Wash','Consumer Grade',0.05],['Dirt Drop','Industrial Grade',0.08],['Kitbash','Restricted',1],['Agent','Mil-Spec',0.2],['Liquidation','Restricted',1.5],['Desert Strike','Mil-Spec',0.25]],
  'Desert Eagle': [['Blaze','Restricted',320],['Code Red','Covert',35],['Printstream','Covert',85],['Kumicho Dragon','Classified',15],['Mecha Industries','Classified',6],['Fennec Fox','Classified',12],['Ocean Drive','Classified',8],['Golden Koi','Restricted',22],['Emerald Jörmungandr','Classified',10],['Conspiracy','Mil-Spec',1.5],['Directive','Classified',3],['Cobalt Disruption','Restricted',3],['Midnight Storm','Mil-Spec',0.5],['Sunset Storm 壱','Restricted',5],['Heirloom','Restricted',3],['Trigger Discipline','Classified',4],['Naga','Restricted',2],['Bronze Deco','Industrial Grade',0.2],['Mudder','Consumer Grade',0.1],['Urban Rubble','Industrial Grade',0.15],['Night','Industrial Grade',0.1],['Oxide Blaze','Mil-Spec',0.3],['Blue Ply','Mil-Spec',0.25],['Sputnik','Mil-Spec',0.2],['Light Rail','Mil-Spec',0.3]],
  'USP-S': [['Kill Confirmed','Covert',48],['Neo-Noir','Classified',5],['Printstream','Covert',25],['Cortex','Restricted',8],['Monster Mashup','Mil-Spec',3],['The Traitor','Covert',10],['Ticket to Hell','Classified',6],['Whiteout','Classified',120],['Caiman','Restricted',3],['Orion','Classified',5],['Dark Water','Restricted',2],['Road Rash','Classified',4],['Stainless','Mil-Spec',0.5],['Guardian','Mil-Spec',0.3],['Blood Tiger','Mil-Spec',0.2],['Business Class','Restricted',1.5],['Cyrex','Restricted',2],['Night Ops','Consumer Grade',0.05],['Forest Leaves','Consumer Grade',0.05],['Royal Blue','Industrial Grade',0.1],['Blueprint','Restricted',2],['Target Acquired','Mil-Spec',0.4],['Check Engine','Mil-Spec',0.3],['Flashback','Mil-Spec',0.25],['Ancient Visions','Restricted',1.5]],
  'Glock-18': [['Fade','Restricted',1500],['Gamma Doppler','Covert',250],['Water Elemental','Classified',5],['Twilight Galaxy','Classified',8],['Bullet Queen','Classified',3],['Wasteland Rebel','Classified',6],['Vogue','Classified',4],['Neo-Noir','Classified',3],['Synth Leaf','Classified',2.5],['Weasel','Restricted',1.5],['Grinder','Mil-Spec',0.3],['Steel Disruption','Mil-Spec',0.2],['Dragon Tattoo','Restricted',3],['Brass','Mil-Spec',0.15],['Candy Apple','Industrial Grade',0.5],['Sand Dune','Consumer Grade',0.05],['Night','Industrial Grade',0.08],['Reactor','Classified',2],['Royal Legion','Classified',2],['Catacombs','Industrial Grade',0.08],['Wraiths','Mil-Spec',0.2],['Blue Fissure','Industrial Grade',0.1],['Off World','Mil-Spec',0.25],['Moonrise','Restricted',1],['Oxide Blaze','Mil-Spec',0.3],['Sacrifice','Restricted',1.5],['Franklin','Classified',3],['Umbral Rabbit','Classified',2],['Clear Polymer','Mil-Spec',0.2],['Block-18','Restricted',1.5]],
  'P250': [['See Ya Later','Classified',4],['Asiimov','Classified',3],['Muertos','Restricted',2],['Mehndi','Classified',3],['Vino Primo','Classified',2],['Cartel','Restricted',1],['Supernova','Restricted',1.5],['Whiteout','Classified',8],['Splash','Mil-Spec',0.5],['Undertow','Restricted',3],['Franklin','Restricted',1.5],['Hive','Mil-Spec',0.2],['Steel Disruption','Mil-Spec',0.15],['Bone Mask','Consumer Grade',0.05],['Sand Dune','Consumer Grade',0.05],['Boreal Forest','Consumer Grade',0.05],['Metallic DDPAT','Mil-Spec',0.15],['Nuclear Threat','Classified',5],['Connexion','Mil-Spec',0.25],['Facility Draft','Mil-Spec',0.2],['Verdigris','Restricted',1.2],['Inferno','Mil-Spec',0.3],['Re.built','Restricted',1.5]],
  'Five-SeveN': [['Monkey Business','Restricted',4],['Hyper Beast','Classified',3],['Case Hardened','Classified',15],['Angry Mob','Classified',5],['Fairy Tale','Classified',3],['Triumvirate','Mil-Spec',0.2],['Copper Galaxy','Mil-Spec',0.15],['Kami','Mil-Spec',0.1],['Fowl Play','Restricted',2],['Retrobution','Restricted',1.5],['Urban Hazard','Industrial Grade',0.08],['Silver Quartz','Consumer Grade',0.05],['Hot Shot','Consumer Grade',0.05],['Forest Night','Consumer Grade',0.05],['Candy Apple','Industrial Grade',0.1],['Neon Kimono','Classified',5],['Violent Daimyo','Mil-Spec',0.2],['Scumbria','Restricted',1],['Flame Test','Mil-Spec',0.3],['Withered Vine','Mil-Spec',0.25],['Berries And Cherries','Restricted',1.8]],
  'P2000': [['Ocean Foam','Classified',180],['Fire Elemental','Classified',8],['Imperial Dragon','Classified',3],['Corticera','Mil-Spec',1],['Amber Fade','Restricted',3],['Handgun','Restricted',1.5],['Scorpion','Mil-Spec',0.3],['Granite Marbleized','Consumer Grade',0.05],['Ivory','Mil-Spec',0.15],['Red FragCam','Mil-Spec',0.1],['Chainmail','Industrial Grade',0.08],['Coach Class','Consumer Grade',0.05],['Silver','Consumer Grade',0.05],['Grassland','Consumer Grade',0.05],['Obsidian','Mil-Spec',0.2],['Turf','Mil-Spec',0.15],['Wicked Sick','Restricted',2],['Gnarled','Restricted',1],['Lifted Spirits','Restricted',1.5],['Space Race','Restricted',1.2]],
  'Tec-9': [['Fuel Injector','Classified',6],['Re-Entry','Restricted',3],['Decimator','Restricted',2],['Remote Control','Restricted',1.5],['Hades','Restricted',1.5],['Toxic','Classified',4],['Nuclear Threat','Classified',5],['Red Quartz','Mil-Spec',0.3],['Titanium Bit','Mil-Spec',0.2],['Isaac','Restricted',1.5],['Bamboo Forest','Mil-Spec',0.15],['Sandstorm','Industrial Grade',0.1],['Army Mesh','Consumer Grade',0.05],['Groundwater','Consumer Grade',0.05],['Urban DDPAT','Consumer Grade',0.05],['Fubar','Restricted',1],['Snek-9','Restricted',1.5],['Brother','Mil-Spec',0.2],['Cut Out','Mil-Spec',0.25],['Terrace','Mil-Spec',0.3]],
  'CZ75-Auto': [['Victoria','Classified',4],['Emerald Quartz','Restricted',2],['Xiangliu','Classified',5],['Yellow Jacket','Restricted',3],['Vendetta','Classified',2],['Poison Dart','Mil-Spec',0.3],['Crimson Web','Restricted',2],['Tacticat','Restricted',1.5],['The Fuschia Is Now','Restricted',1.5],['Tigris','Mil-Spec',0.2],['Army Sheen','Industrial Grade',0.1],['Green Plaid','Consumer Grade',0.05],['Tread Plate','Mil-Spec',0.15],['Pole Position','Industrial Grade',0.08],['Twist','Mil-Spec',0.2],['Polymer','Industrial Grade',0.08],['Circaetus','Restricted',1.5],['Eco','Restricted',1.2],['Frame Work','Mil-Spec',0.25]],
  'Dual Berettas': [['Cobalt Quartz','Classified',4],['Royal Consorts','Restricted',3],['Twin Turbo','Restricted',2],['Flora Carnivora','Classified',5],['Melondrama','Restricted',1.5],['Hemoglobin','Restricted',1.5],['Marina','Restricted',1],['Urban Shock','Mil-Spec',0.3],['Duelist','Restricted',2],['Briar','Mil-Spec',0.2],['Stained','Industrial Grade',0.1],['Moon in Libra','Consumer Grade',0.05],['Demolition','Industrial Grade',0.08],['Shred','Mil-Spec',0.15],['Hideout','Restricted',1],['Balance','Mil-Spec',0.2],['Cartel','Mil-Spec',0.15],['Elite 1.6','Restricted',2.5],['Pyre','Restricted',1.5],['Dezastre','Restricted',1.8],['Panther','Mil-Spec',0.25]],
  'R8 Revolver': [['Fade','Restricted',8],['Amber Fade','Restricted',2],['Crimson Web','Mil-Spec',0.5],['Bone Mask','Consumer Grade',0.05],['Survivalist','Industrial Grade',0.1],['Grip','Mil-Spec',0.2],['Llama Cannon','Restricted',2],['Memento','Restricted',1.5],['Skull Crusher','Restricted',1],['Canal Spray','Consumer Grade',0.05],['Banana Cannon','Restricted',1.5],['Junk Yard','Mil-Spec',0.25],['Nitro','Industrial Grade',0.1],['Crazy 8','Mil-Spec',0.3]],
  'AWP': [['Dragon Lore','Covert',5000],['Fade','Covert',850],['Asiimov','Covert',30],['Lightning Strike','Covert',90],['Medusa','Covert',1500],['Hyper Beast','Covert',20],['Printstream','Covert',45],['Gungnir','Covert',4000],['The Prince','Classified',8],['Containment Breach','Covert',22],['Wildfire','Covert',35],['Chromatic Aberration','Covert',18],['Duality','Covert',15],['Neo-Noir','Covert',12],['PAW','Classified',6],['Silk Tiger','Covert',10],['Exoskeleton','Classified',5],['Oni Taiji','Covert',15],['Electric Hive','Classified',5],['Redline','Classified',8],['Boom','Classified',12],['Graphite','Classified',10],['Corticera','Classified',4],["Man-o'-war",'Classified',6],['Fever Dream','Classified',3],['Pit Viper','Restricted',2],['Worm God','Mil-Spec',0.5],['Safari Mesh','Consumer Grade',0.2],['Snake Camo','Consumer Grade',0.15],['Sun in Leo','Industrial Grade',0.3],['Phobos','Mil-Spec',0.4],['Acheron','Mil-Spec',0.3],['Elite Build','Mil-Spec',0.25],['Capillary','Restricted',1.5],['Desert Hydra','Covert',60],['Atheris','Restricted',2]],
  'SSG 08': [['Dragonfire','Classified',8],['Blood in the Water','Classified',12],['Turbo Peek','Restricted',3],['Big Iron','Restricted',2],['Dark Water','Restricted',1.5],['Ghost Crusader','Restricted',2],['Detour','Restricted',2],['Necropos','Mil-Spec',0.3],['Abyss','Consumer Grade',0.05],['Blue Spruce','Consumer Grade',0.05],['Sand Dune','Consumer Grade',0.05],['Slashed','Industrial Grade',0.08],['Acid Fade','Restricted',2],['Hand Brake','Restricted',1.5],['Parallax','Restricted',1],['Mainframe 001','Restricted',1.8],['Spring Twilly','Restricted',1.5],['Death Strike','Mil-Spec',0.25],['Fever Dream','Mil-Spec',0.2]],
  'SCAR-20': [['Emerald','Classified',6],['Cardiac','Restricted',3],['Bloodsport','Restricted',2],['Jungle Slipstream','Mil-Spec',0.3],['Cyrex','Classified',3],['Grotto','Mil-Spec',0.2],['Carbon Fiber','Industrial Grade',0.1],['Crimson Web','Industrial Grade',0.1],['Storm','Consumer Grade',0.05],['Sand Mesh','Consumer Grade',0.05],['Palm','Industrial Grade',0.08],['Contractor','Mil-Spec',0.15],['Assault','Restricted',1],['Blueprint','Mil-Spec',0.2],['Magna Carta','Restricted',1.5],['Enforcer','Restricted',1.5]],
  'G3SG1': [['The Executioner','Restricted',3],['Flux','Restricted',2],['Chronos','Classified',4],['Scavenger','Restricted',1.5],['Stinger','Classified',2],['Hunter','Mil-Spec',0.15],['Orange Kimono','Restricted',1.5],['Demeter','Mil-Spec',0.2],['Safari Mesh','Consumer Grade',0.05],['Jungle Dashed','Consumer Grade',0.05],['Desert Storm','Consumer Grade',0.05],['Polar Camo','Industrial Grade',0.08],['Green Apple','Industrial Grade',0.08],['Dream Glade','Mil-Spec',0.25],['Contractor','Mil-Spec',0.15],['High Seas','Mil-Spec',0.2],['Ventilator','Restricted',1]],
  'Nova': [['Hyper Beast','Restricted',3],['Antique','Classified',5],['Wild Six','Restricted',2],['Toy Soldier','Restricted',1.5],['Koi','Restricted',1.5],['Rising Skull','Classified',2],['Graphite','Restricted',1],['Tempest','Mil-Spec',0.2],['Moon in Libra','Consumer Grade',0.05],['Sand Dune','Consumer Grade',0.05],['Walnut','Consumer Grade',0.05],['Predator','Industrial Grade',0.08],['Forest Leaves','Consumer Grade',0.05],['Caged Steel','Industrial Grade',0.08],['Mandrel','Mil-Spec',0.15],['Baroque Orange','Mil-Spec',0.2],['Clear Polymer','Restricted',1]],
  'XM1014': [['Incinegator','Classified',3],['Tranquility','Restricted',4],['Ziggy','Restricted',2],['Bone Machine','Mil-Spec',0.3],['Seasons','Classified',2],['Teclu Burner','Restricted',1.5],['Urban Perforated','Consumer Grade',0.05],['Blue Spruce','Consumer Grade',0.05],['Grassland','Consumer Grade',0.05],['Scumbria','Industrial Grade',0.08],['Red Leather','Restricted',1],['Banana Leaf','Mil-Spec',0.2],['Blue Steel','Industrial Grade',0.1],['Slipstream','Mil-Spec',0.25],['Entombed','Restricted',1.5]],
  'MAG-7': [['Heat','Restricted',2],['SWAG-7','Restricted',3],['Praetorian','Classified',3],['Petroglyph','Restricted',1.5],['Bulldozer','Restricted',1.5],['Memento','Mil-Spec',0.2],['Heaven Guard','Mil-Spec',0.15],['Sand Dune','Consumer Grade',0.05],['Storm','Consumer Grade',0.05],['Silver','Consumer Grade',0.05],['Sonar','Industrial Grade',0.08],['Metallic DDPAT','Industrial Grade',0.08],['Firestarter','Restricted',1],['Hard Water','Mil-Spec',0.15],['Cinquedea','Restricted',1.5],['Justice','Classified',2]],
  'Sawed-Off': [['The Kraken','Classified',5],['Wasteland Princess','Restricted',3],['Kiss♥Love','Restricted',2],['Devourer','Restricted',1.5],['Highwayman','Mil-Spec',0.3],['Origami','Mil-Spec',0.2],['Brake Light','Restricted',1],['Amber Fade','Restricted',1.5],['Sage Spray','Consumer Grade',0.05],['Forest DDPAT','Consumer Grade',0.05],['Snake Camo','Consumer Grade',0.05],['Irradiated Alert','Industrial Grade',0.08],['Zander','Mil-Spec',0.15],['Apocalypto','Mil-Spec',0.2],['Morris','Restricted',1],['Limelight','Classified',2]],
  'M249': [['Magma','Restricted',2],['System Lock','Restricted',1.5],['Downtown','Restricted',1],['Spectre','Mil-Spec',0.2],['Impact Drill','Mil-Spec',0.15],['Jungle DDPAT','Consumer Grade',0.05],['Blizzard Marbleized','Consumer Grade',0.05],['Gator Mesh','Consumer Grade',0.05],['Contrast Spray','Industrial Grade',0.08],['Shipping Forecast','Restricted',1],['Nebula Crusader','Classified',2],['Deep Relief','Mil-Spec',0.2],['Warbird','Mil-Spec',0.15],['Emerald Poison Dart','Mil-Spec',0.25]],
  'Negev': [['Mjölnir','Classified',8],['Ultralight','Restricted',2],['Power Loader','Classified',3],['Loudmouth','Restricted',1.5],['Bratatat','Restricted',1],['Bulkhead','Mil-Spec',0.2],['Palm','Consumer Grade',0.05],['Army Sheen','Consumer Grade',0.05],['CaliCamo','Consumer Grade',0.05],['Nuclear Waste','Industrial Grade',0.08],['Terrain','Consumer Grade',0.05],['Dazzle','Mil-Spec',0.15],["Man-o'-war",'Mil-Spec',0.2],['Lionfish','Mil-Spec',0.25],['Drop Me','Restricted',1.5],['Prototype','Restricted',1.2],['Boroque Sand','Mil-Spec',0.15]],
};

// ═══════════════════ KNIVES ═══════════════════
const KNIFE_TYPES = [
  'Karambit','Butterfly Knife','M9 Bayonet','Bayonet','Flip Knife','Gut Knife',
  'Huntsman Knife','Falchion Knife','Shadow Daggers','Bowie Knife','Navaja Knife',
  'Stiletto Knife','Ursus Knife','Talon Knife','Classic Knife','Paracord Knife',
  'Survival Knife','Nomad Knife','Skeleton Knife','Kukri Knife',
];

const KNIFE_FINISHES: [string, number][] = [
  ['Doppler',1.0],['Fade',1.4],['Tiger Tooth',0.85],['Marble Fade',1.2],
  ['Crimson Web',0.9],['Slaughter',0.7],['Case Hardened',0.65],['Gamma Doppler',0.95],
  ['Lore',0.75],['Autotronic',0.6],['Damascus Steel',0.4],['Rust Coat',0.25],
  ['Night',0.35],['Ultraviolet',0.35],['Blue Steel',0.3],['Stained',0.25],
  ['Urban Masked',0.2],['Boreal Forest',0.2],['Forest DDPAT',0.18],['Safari Mesh',0.15],
  ['Scorched',0.15],['Vanilla',0.55],['Bright Water',0.4],['Freehand',0.45],
  ['Black Laminate',0.5],['Doppler Phase 2',1.15],['Doppler Phase 4',1.05],
  ['Doppler Ruby',3.5],['Doppler Sapphire',4.0],['Doppler Black Pearl',2.8],
  ['Gamma Doppler Emerald',3.2],['Fade 100%',1.6],['Crimson Web FN',2.5],
  ['Night Stripe',0.22],
];

const KNIFE_BASE: Record<string, number> = {
  'Karambit':750,'Butterfly Knife':900,'M9 Bayonet':500,'Bayonet':300,'Flip Knife':250,
  'Gut Knife':100,'Huntsman Knife':180,'Falchion Knife':160,'Shadow Daggers':120,
  'Bowie Knife':150,'Navaja Knife':110,'Stiletto Knife':180,'Ursus Knife':170,
  'Talon Knife':350,'Classic Knife':200,'Paracord Knife':160,'Survival Knife':140,
  'Nomad Knife':170,'Skeleton Knife':250,'Kukri Knife':320,
};

// ═══════════════════ GLOVES ═══════════════════
const GLOVE_DATA: Record<string, [string, number][]> = {
  'Sport Gloves': [['Hedge Maze',350],["Pandora's Box",2800],['Superconductor',450],['Vice',500],['Slingshot',250],['Bronze Morph',180],['Scarlet Shamagh',200],['Nocts',300],['Big Game',150],['Omega',250]],
  'Specialist Gloves': [['Crimson Kimono',3000],['Crimson Web',600],['Emerald Web',800],['Fade',1200],['Marble Fade',900],['Foundation',350],['Mogul',280],['Tiger Strike',400],['Buckshot',200],['Field Agent',250]],
  'Driver Gloves': [['King Snake',280],['Crimson Weave',200],['Lunar Weave',150],['Imperial Plaid',250],['Snow Leopard',180],['Queen Jaguar',220],['Diamondback',200],['Overtake',150],['Racing Green',120],['Rezan',180]],
  'Hand Wraps': [['Cobalt Skulls',180],['Leather',120],['Slaughter',250],['Overprint',100],['Giraffe',80],['Constrictor',130],['Duct Tape',70],['Arboreal',90],['CAUTION!',110],['Desert Shamagh',85]],
  'Moto Gloves': [['Smoke Out',200],['Spearmint',350],['Cool Mint',150],['Eclipse',250],['Blood Pressure',120],['Polygon',100],['Turtle',130],['Finish Line',180],['Transport',90],['POW!',160]],
  'Hydra Gloves': [['Emerald',400],['Case Hardened',300],['Mangrove',150],['Rattler',120]],
  'Broken Fang Gloves': [['Jade',350],['Yellow-banded',200],['Unhinged',250],['Needle Point',300]],
};

// ─── Build full catalog ──────────────────────────────
function buildCatalog(): SkinSeed[] {
  const catalog: SkinSeed[] = [];
  const seen = new Set<string>();

  const add = (s: SkinSeed) => {
    if (seen.has(s.name)) return;
    seen.add(s.name);
    catalog.push(s);
  };

  // Weapon skins
  for (const [weapon, skins] of Object.entries(WEAPON_SKINS)) {
    for (const [skinName, rarity, priceOverride] of skins) {
      const isLowFloat = ['Hot Rod','Knight','Lightning Strike','Blaze'].includes(skinName);
      add({
        name: `${weapon} | ${skinName}`, weapon_name: weapon, skin_name: skinName,
        rarity, case_name: pickCase(catalog.length + skinName.length),
        min_float: 0.0, max_float: isLowFloat ? 0.08 : 1.0,
        is_knife: false, is_glove: false, has_souvenir: false,
        release_date: pickDate(catalog.length * 3 + skinName.length),
        base_price: priceForSkin(weapon, skinName, rarity, priceOverride),
      });
    }
  }

  // Knives (20 types × 25 finishes = 500)
  for (const knife of KNIFE_TYPES) {
    const base = KNIFE_BASE[knife] || 200;
    for (const [finish, mult] of KNIFE_FINISHES) {
      add({
        name: `${knife} | ${finish}`, weapon_name: knife, skin_name: finish,
        rarity: 'Extraordinary', case_name: pickCase(catalog.length + knife.length),
        min_float: 0.0, max_float: 1.0,
        is_knife: true, is_glove: false, has_souvenir: false,
        release_date: pickDate(catalog.length * 5 + knife.length),
        base_price: Math.round(base * mult * 100) / 100,
      });
    }
  }

  // Gloves (7 types × varying finishes = ~68)
  for (const [gloveType, finishes] of Object.entries(GLOVE_DATA)) {
    for (const [finish, price] of finishes) {
      add({
        name: `${gloveType} | ${finish}`, weapon_name: gloveType, skin_name: finish,
        rarity: 'Extraordinary', case_name: pickCase(catalog.length + gloveType.length),
        min_float: 0.06, max_float: 1.0,
        is_knife: false, is_glove: true, has_souvenir: false,
        release_date: pickDate(catalog.length * 7 + gloveType.length),
        base_price: price,
      });
    }
  }

  return catalog;
}

export const SKIN_CATALOG: SkinSeed[] = buildCatalog();
