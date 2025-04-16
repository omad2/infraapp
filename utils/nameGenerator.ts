// List of first names
const firstNames = [
  'Alex', 'Jordan', 'Taylor', 'Morgan', 'Casey', 'Jamie', 'Riley', 'Quinn',
  'Avery', 'Blake', 'Cameron', 'Drew', 'Eden', 'Finley', 'Gray', 'Harper',
  'Indigo', 'Jules', 'Kai', 'Lennon', 'Milo', 'Nova', 'Ocean', 'Phoenix',
  'River', 'Sage', 'Tatum', 'Uma', 'Vale', 'Winter', 'Xen', 'Yara', 'Zephyr'
];

// List of adjectives to use as prefixes
const adjectives = [
  'Brave', 'Clever', 'Daring', 'Eager', 'Fierce', 'Gentle', 'Happy', 'Innocent',
  'Joyful', 'Kind', 'Lively', 'Mighty', 'Noble', 'Peaceful', 'Quick', 'Radiant',
  'Swift', 'Tender', 'Unique', 'Vibrant', 'Wise', 'Xtra', 'Young', 'Zealous'
];

/**
 * Generates a random name for a user
 * @returns A randomly generated name
 */
export const generateRandomName = (): string => {
  // 50% chance to use an adjective + first name combination
  const useAdjective = Math.random() > 0.5;
  
  if (useAdjective) {
    const adjective = adjectives[Math.floor(Math.random() * adjectives.length)];
    const firstName = firstNames[Math.floor(Math.random() * firstNames.length)];
    return `${adjective}${firstName}`;
  } else {
    // Just use a first name
    return firstNames[Math.floor(Math.random() * firstNames.length)];
  }
}; 