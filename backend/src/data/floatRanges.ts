// Accurate CS2 float ranges per skin
// Source: community-verified data from csgostash.com / csgo.exchange
// Format: 'Weapon | Skin': [min_float, max_float]
// Skins not in this map default to [0.00, 1.00]

export const FLOAT_RANGES: Record<string, [number, number]> = {
  // ═══ AK-47 ═══
  'AK-47 | Asiimov': [0.05, 0.70],
  'AK-47 | Redline': [0.10, 0.70],
  'AK-47 | Vulcan': [0.00, 0.70],
  'AK-47 | Fire Serpent': [0.00, 0.76],
  'AK-47 | Neon Rider': [0.00, 0.50],
  'AK-47 | Phantom Disruptor': [0.00, 1.00],
  'AK-47 | The Empress': [0.00, 1.00],
  'AK-47 | Bloodsport': [0.00, 0.60],
  'AK-47 | Fuel Injector': [0.00, 0.70],
  'AK-47 | Aquamarine Revenge': [0.00, 1.00],
  'AK-47 | Case Hardened': [0.00, 1.00],
  'AK-47 | Hydroponic': [0.00, 0.70],
  'AK-47 | Wild Lotus': [0.00, 1.00],
  'AK-47 | Nightwish': [0.00, 0.80],
  'AK-47 | Head Shot': [0.00, 0.80],
  'AK-47 | Ice Coaled': [0.00, 0.80],
  'AK-47 | Slate': [0.00, 0.80],
  'AK-47 | Inheritance': [0.00, 1.00],
  'AK-47 | Legion of Anubis': [0.00, 1.00],
  'AK-47 | Panthera onca': [0.00, 1.00],
  'AK-47 | Frontside Misty': [0.00, 1.00],
  'AK-47 | Point Disarray': [0.00, 1.00],
  'AK-47 | Neon Revolution': [0.00, 1.00],
  'AK-47 | Wasteland Rebel': [0.00, 0.70],
  'AK-47 | Jaguar': [0.00, 1.00],
  'AK-47 | Gold Arabesque': [0.00, 1.00],
  'AK-47 | X-Ray': [0.00, 0.80],
  'AK-47 | Blue Laminate': [0.00, 1.00],
  'AK-47 | Leet Museo': [0.00, 0.80],
  'AK-47 | Elite Build': [0.00, 0.80],
  'AK-47 | Orbit Mk01': [0.00, 0.50],
  'AK-47 | Uncharted': [0.00, 0.65],
  'AK-47 | Rat Rod': [0.00, 1.00],
  'AK-47 | Cartel': [0.00, 0.70],
  'AK-47 | Jet Set': [0.00, 1.00],
  'AK-47 | First Class': [0.00, 0.80],

  // ═══ M4A4 ═══
  'M4A4 | Asiimov': [0.18, 1.00],
  'M4A4 | Neo-Noir': [0.00, 0.60],
  'M4A4 | Howl': [0.00, 0.70],
  'M4A4 | Poseidon': [0.00, 0.70],
  'M4A4 | The Emperor': [0.00, 1.00],
  'M4A4 | In Living Color': [0.00, 0.80],
  'M4A4 | Tooth Fairy': [0.00, 0.70],
  'M4A4 | Spider Lily': [0.00, 1.00],
  'M4A4 | Temukau': [0.00, 0.80],
  'M4A4 | Desolate Space': [0.00, 1.00],
  'M4A4 | Hellfire': [0.00, 0.70],
  'M4A4 | Dragon King': [0.00, 0.70],
  'M4A4 | Buzz Kill': [0.00, 1.00],
  'M4A4 | Royal Paladin': [0.00, 1.00],
  'M4A4 | Bullet Rain': [0.00, 0.50],
  'M4A4 | Daybreak': [0.00, 0.40],
  'M4A4 | Radiation Hazard': [0.00, 0.65],
  'M4A4 | X-Ray': [0.06, 0.80],

  // ═══ M4A1-S ═══
  'M4A1-S | Printstream': [0.00, 1.00],
  'M4A1-S | Hyper Beast': [0.00, 1.00],
  'M4A1-S | Golden Coil': [0.00, 1.00],
  'M4A1-S | Hot Rod': [0.00, 0.08],
  'M4A1-S | Knight': [0.00, 0.08],
  'M4A1-S | Icarus Fell': [0.00, 0.08],
  'M4A1-S | Master Piece': [0.00, 1.00],
  'M4A1-S | Mecha Industries': [0.00, 0.50],
  'M4A1-S | Player Two': [0.00, 1.00],
  'M4A1-S | Welcome to the Jungle': [0.00, 1.00],
  'M4A1-S | Chantico\'s Fire': [0.00, 0.70],
  'M4A1-S | Cyrex': [0.00, 1.00],
  'M4A1-S | Nitro': [0.00, 1.00],
  'M4A1-S | Nightmare': [0.00, 1.00],
  'M4A1-S | Decimator': [0.00, 0.50],
  'M4A1-S | Night Terror': [0.00, 0.80],

  // ═══ AWP ═══
  'AWP | Dragon Lore': [0.00, 0.70],
  'AWP | Fade': [0.00, 0.08],
  'AWP | Asiimov': [0.18, 1.00],
  'AWP | Lightning Strike': [0.00, 0.08],
  'AWP | Medusa': [0.00, 0.70],
  'AWP | Hyper Beast': [0.00, 1.00],
  'AWP | Printstream': [0.00, 1.00],
  'AWP | Gungnir': [0.00, 0.70],
  'AWP | Containment Breach': [0.00, 1.00],
  'AWP | Wildfire': [0.00, 0.70],
  'AWP | Neo-Noir': [0.00, 0.60],
  'AWP | Silk Tiger': [0.00, 1.00],
  'AWP | Oni Taiji': [0.00, 1.00],
  'AWP | Redline': [0.10, 0.70],
  'AWP | Graphite': [0.00, 0.08],
  'AWP | Boom': [0.00, 0.18],
  'AWP | Electric Hive': [0.00, 0.70],
  'AWP | Corticera': [0.00, 0.50],
  'AWP | Man-o\'-war': [0.00, 0.70],
  'AWP | Chromatic Aberration': [0.00, 0.80],
  'AWP | Duality': [0.00, 0.80],
  'AWP | Desert Hydra': [0.00, 0.80],
  'AWP | The Prince': [0.00, 1.00],
  'AWP | PAW': [0.00, 0.80],
  'AWP | Exoskeleton': [0.00, 0.80],

  // ═══ Desert Eagle ═══
  'Desert Eagle | Blaze': [0.00, 0.08],
  'Desert Eagle | Code Red': [0.00, 0.50],
  'Desert Eagle | Printstream': [0.00, 1.00],
  'Desert Eagle | Kumicho Dragon': [0.00, 0.70],
  'Desert Eagle | Mecha Industries': [0.00, 0.50],
  'Desert Eagle | Golden Koi': [0.00, 0.08],
  'Desert Eagle | Fennec Fox': [0.00, 1.00],
  'Desert Eagle | Ocean Drive': [0.00, 1.00],
  'Desert Eagle | Emerald Jörmungandr': [0.00, 1.00],
  'Desert Eagle | Conspiracy': [0.00, 0.50],
  'Desert Eagle | Cobalt Disruption': [0.00, 0.08],
  'Desert Eagle | Trigger Discipline': [0.00, 1.00],

  // ═══ USP-S ═══
  'USP-S | Kill Confirmed': [0.00, 1.00],
  'USP-S | Neo-Noir': [0.00, 0.60],
  'USP-S | Printstream': [0.00, 1.00],
  'USP-S | Cortex': [0.00, 0.55],
  'USP-S | The Traitor': [0.00, 1.00],
  'USP-S | Ticket to Hell': [0.00, 1.00],
  'USP-S | Whiteout': [0.00, 0.08],
  'USP-S | Orion': [0.00, 0.50],
  'USP-S | Caiman': [0.00, 0.70],
  'USP-S | Road Rash': [0.00, 0.70],
  'USP-S | Cyrex': [0.00, 1.00],

  // ═══ Glock-18 ═══
  'Glock-18 | Fade': [0.00, 0.08],
  'Glock-18 | Gamma Doppler': [0.00, 0.08],
  'Glock-18 | Water Elemental': [0.00, 1.00],
  'Glock-18 | Twilight Galaxy': [0.00, 0.35],
  'Glock-18 | Bullet Queen': [0.00, 1.00],
  'Glock-18 | Wasteland Rebel': [0.00, 0.70],
  'Glock-18 | Neo-Noir': [0.00, 0.60],
  'Glock-18 | Vogue': [0.00, 1.00],
  'Glock-18 | Dragon Tattoo': [0.00, 0.08],
  'Glock-18 | Reactor': [0.06, 0.80],
  'Glock-18 | Franklin': [0.00, 0.80],

  // ═══ P250 ═══
  'P250 | See Ya Later': [0.00, 0.50],
  'P250 | Asiimov': [0.05, 0.70],
  'P250 | Mehndi': [0.00, 1.00],
  'P250 | Whiteout': [0.00, 0.08],
  'P250 | Undertow': [0.00, 0.08],
  'P250 | Nuclear Threat': [0.06, 0.80],

  // ═══ Five-SeveN ═══
  'Five-SeveN | Monkey Business': [0.00, 1.00],
  'Five-SeveN | Hyper Beast': [0.00, 1.00],
  'Five-SeveN | Case Hardened': [0.00, 1.00],
  'Five-SeveN | Angry Mob': [0.00, 0.50],
  'Five-SeveN | Neon Kimono': [0.00, 0.70],

  // ═══ Tec-9 ═══
  'Tec-9 | Fuel Injector': [0.00, 0.70],
  'Tec-9 | Nuclear Threat': [0.06, 0.80],

  // ═══ CZ75-Auto ═══
  'CZ75-Auto | Victoria': [0.06, 0.80],
  'CZ75-Auto | Xiangliu': [0.00, 1.00],
  'CZ75-Auto | Emerald Quartz': [0.00, 0.08],
  'CZ75-Auto | Yellow Jacket': [0.00, 0.40],

  // ═══ P2000 ═══
  'P2000 | Ocean Foam': [0.00, 0.08],
  'P2000 | Fire Elemental': [0.00, 0.70],
  'P2000 | Amber Fade': [0.00, 0.08],
  'P2000 | Imperial Dragon': [0.00, 0.50],

  // ═══ R8 Revolver ═══
  'R8 Revolver | Fade': [0.00, 0.08],
  'R8 Revolver | Amber Fade': [0.00, 0.08],

  // ═══ SSG 08 ═══
  'SSG 08 | Dragonfire': [0.00, 0.70],
  'SSG 08 | Blood in the Water': [0.00, 0.70],
  'SSG 08 | Detour': [0.00, 0.08],

  // ═══ SCAR-20 ═══
  'SCAR-20 | Emerald': [0.00, 0.08],
  'SCAR-20 | Cyrex': [0.00, 1.00],

  // ═══ MAC-10 ═══
  'MAC-10 | Neon Rider': [0.00, 0.50],
  'MAC-10 | Case Hardened': [0.00, 1.00],
  'MAC-10 | Fade': [0.00, 0.08],

  // ═══ UMP-45 ═══
  'UMP-45 | Fade': [0.00, 0.08],
  'UMP-45 | Primal Saber': [0.00, 1.00],

  // ═══ MP7 ═══
  'MP7 | Fade': [0.00, 0.08],
  'MP7 | Nemesis': [0.06, 0.80],
  'MP7 | Whiteout': [0.00, 0.08],

  // ═══ P90 ═══
  'P90 | Asiimov': [0.05, 0.70],
  'P90 | Death by Kitty': [0.00, 0.70],
  'P90 | Emerald Dragon': [0.06, 0.80],

  // ═══ FAMAS ═══
  'FAMAS | Commemoration': [0.00, 1.00],
  'FAMAS | Mecha Industries': [0.00, 0.50],

  // ═══ Galil AR ═══
  'Galil AR | Chatterbox': [0.06, 0.80],
  'Galil AR | Cerberus': [0.00, 0.70],

  // ═══ SG 553 ═══
  'SG 553 | Cyrex': [0.00, 1.00],
  'SG 553 | Integrale': [0.00, 0.65],

  // ═══ AUG ═══
  'AUG | Akihabara Accept': [0.00, 0.70],
  'AUG | Hot Rod': [0.00, 0.08],
  'AUG | Chameleon': [0.06, 0.80],

  // ═══ Negev ═══
  'Negev | Mjölnir': [0.00, 0.70],

  // ═══ Nova ═══
  'Nova | Antique': [0.06, 0.80],
  'Nova | Hyper Beast': [0.00, 1.00],

  // ═══ XM1014 ═══
  'XM1014 | Tranquility': [0.06, 0.80],

  // ═══ Sawed-Off ═══
  'Sawed-Off | The Kraken': [0.06, 0.80],

  // ═══ MAG-7 ═══
  'MAG-7 | Praetorian': [0.00, 1.00],

  // ═══ Knives — all have 0.00-1.00 except specific finishes ═══
  // Doppler variants (all knife types): 0.00-0.08
  // Fade (all knife types): 0.00-0.08
  // Tiger Tooth (all knife types): 0.00-0.08
  // Marble Fade (all knife types): 0.00-0.08
  // Gamma Doppler (all knife types): 0.00-0.08
  // Crimson Web: 0.06-0.80
  // Slaughter: 0.00-0.26
  // Autotronic: 0.00-0.65
  // Lore: 0.00-0.65
  // Night: 0.06-0.80
  // Ultraviolet: 0.06-0.80
  // Damascus Steel: 0.00-0.50
  // Bright Water: 0.00-0.50
  // Black Laminate: 0.00-1.00
};

// Knife finish float ranges (applied to all knife types)
const KNIFE_FINISH_FLOATS: Record<string, [number, number]> = {
  'Doppler': [0.00, 0.08],
  'Doppler Phase 2': [0.00, 0.08],
  'Doppler Phase 4': [0.00, 0.08],
  'Doppler Ruby': [0.00, 0.08],
  'Doppler Sapphire': [0.00, 0.08],
  'Doppler Black Pearl': [0.00, 0.08],
  'Gamma Doppler': [0.00, 0.08],
  'Gamma Doppler Emerald': [0.00, 0.08],
  'Fade': [0.00, 0.08],
  'Fade 100%': [0.00, 0.08],
  'Tiger Tooth': [0.00, 0.08],
  'Marble Fade': [0.00, 0.08],
  'Crimson Web': [0.06, 0.80],
  'Crimson Web FN': [0.06, 0.80],
  'Slaughter': [0.01, 0.26],
  'Case Hardened': [0.00, 1.00],
  'Autotronic': [0.00, 0.65],
  'Lore': [0.00, 0.65],
  'Night': [0.06, 0.80],
  'Night Stripe': [0.06, 0.80],
  'Ultraviolet': [0.06, 0.80],
  'Damascus Steel': [0.00, 0.50],
  'Rust Coat': [0.40, 1.00],
  'Blue Steel': [0.00, 1.00],
  'Stained': [0.00, 1.00],
  'Urban Masked': [0.06, 0.80],
  'Boreal Forest': [0.06, 0.80],
  'Forest DDPAT': [0.06, 0.80],
  'Safari Mesh': [0.06, 0.80],
  'Scorched': [0.06, 0.80],
  'Vanilla': [0.00, 1.00],
  'Bright Water': [0.00, 0.50],
  'Freehand': [0.00, 0.65],
  'Black Laminate': [0.00, 1.00],
};

// Glove finish float ranges
const GLOVE_FINISH_FLOATS: Record<string, [number, number]> = {
  // All gloves: 0.06-0.80 (no Factory New exists)
};
const GLOVE_DEFAULT: [number, number] = [0.06, 0.80];

const KNIFE_TYPES = [
  'Karambit', 'Butterfly Knife', 'M9 Bayonet', 'Bayonet', 'Flip Knife',
  'Gut Knife', 'Huntsman Knife', 'Falchion Knife', 'Shadow Daggers',
  'Bowie Knife', 'Navaja Knife', 'Stiletto Knife', 'Ursus Knife',
  'Talon Knife', 'Classic Knife', 'Paracord Knife', 'Survival Knife',
  'Nomad Knife', 'Skeleton Knife', 'Kukri Knife',
];

const GLOVE_TYPES = [
  'Sport Gloves', 'Specialist Gloves', 'Driver Gloves',
  'Hand Wraps', 'Moto Gloves', 'Hydra Gloves', 'Broken Fang Gloves',
];

// Generate knife float ranges
for (const knife of KNIFE_TYPES) {
  for (const [finish, range] of Object.entries(KNIFE_FINISH_FLOATS)) {
    FLOAT_RANGES[`${knife} | ${finish}`] = range;
  }
}

// Generate glove float ranges
for (const glove of GLOVE_TYPES) {
  // All gloves are 0.06-0.80
  // We don't enumerate finishes here — handled by getFloatRange default
}

// Exterior float ranges (standard CS2 values)
export const EXTERIOR_RANGES: Record<string, [number, number]> = {
  'Factory New': [0.00, 0.07],
  'Minimal Wear': [0.07, 0.15],
  'Field-Tested': [0.15, 0.38],
  'Well-Worn': [0.38, 0.45],
  'Battle-Scarred': [0.45, 1.00],
};

/**
 * Get the float range for a skin. Handles knives, gloves, and regular weapons.
 */
export function getFloatRange(skinName: string): [number, number] {
  // Direct lookup first
  if (FLOAT_RANGES[skinName]) return FLOAT_RANGES[skinName];

  // Check if it's a glove
  if (GLOVE_TYPES.some(g => skinName.startsWith(g))) return GLOVE_DEFAULT;

  // Default
  return [0.00, 1.00];
}

/**
 * Get which exteriors are possible for a skin based on its float range
 */
export function getPossibleExteriors(skinName: string): string[] {
  const [min, max] = getFloatRange(skinName);
  const possible: string[] = [];

  for (const [ext, [extMin, extMax]] of Object.entries(EXTERIOR_RANGES)) {
    // An exterior is possible if the skin's float range overlaps with the exterior's range
    if (min < extMax && max > extMin) {
      possible.push(ext);
    }
  }

  return possible;
}
