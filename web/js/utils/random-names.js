/**
 * Random Name Generator
 * Generates funny random names for local users
 */
const RandomNames = {
    adjectives: [
        // Silly/Funny
        'Crazy', 'Silly', 'Wacky', 'Funky', 'Goofy', 'Quirky', 'Zany', 'Loopy',
        'Nutty', 'Bonkers', 'Kooky', 'Dizzy', 'Fuzzy', 'Wonky', 'Sassy',
        // Food states
        'Crispy', 'Crunchy', 'Sizzling', 'Toasted', 'Grilled', 'Steamed', 'Fried',
        'Baked', 'Roasted', 'Smoked', 'Pickled', 'Fermented', 'Marinated', 'Spiced',
        // Conditions
        'Rotten', 'Fresh', 'Frozen', 'Melted', 'Burnt', 'Raw', 'Aged', 'Moldy',
        'Soggy', 'Crusty', 'Stale', 'Ripe', 'Juicy', 'Dried', 'Wilted',
        // Personality
        'Grumpy', 'Sleepy', 'Sneaky', 'Speedy', 'Lazy', 'Hyper', 'Chill', 'Fierce',
        'Brave', 'Mighty', 'Tiny', 'Giant', 'Secret', 'Mystic', 'Cosmic',
        // Style
        'Fancy', 'Retro', 'Vintage', 'Hipster', 'Punk', 'Disco', 'Ninja', 'Pirate',
        'Viking', 'Wizard', 'Robot', 'Cyber', 'Neon', 'Turbo', 'Ultra',
        // Colors (fun versions)
        'Golden', 'Silver', 'Electric', 'Radioactive', 'Glowing', 'Sparkly', 'Rainbow',
        // Tech/Gaming
        'Pixel', 'Glitch', 'Binary', 'Quantum', 'Digital', 'Analog', 'Arcade',
        // Random fun
        'Dancing', 'Flying', 'Jumping', 'Rolling', 'Spinning', 'Bouncing', 'Floating',
        'Exploding', 'Magnetic', 'Invisible', 'Legendary', 'Epic', 'Supreme', 'Ultimate'
    ],

    nouns: [
        // Vegetables
        'Arugula', 'Spinach', 'Broccoli', 'Carrot', 'Potato', 'Tomato', 'Cucumber',
        'Lettuce', 'Cabbage', 'Celery', 'Radish', 'Turnip', 'Beet', 'Onion',
        'Garlic', 'Pepper', 'Zucchini', 'Eggplant', 'Kale', 'Asparagus',
        // Fruits
        'Apple', 'Banana', 'Orange', 'Mango', 'Pineapple', 'Coconut', 'Avocado',
        'Lemon', 'Lime', 'Grape', 'Melon', 'Peach', 'Cherry', 'Berry', 'Kiwi',
        'Papaya', 'Guava', 'Fig', 'Plum', 'Pear',
        // Proteins
        'Bacon', 'Sausage', 'Nugget', 'Burger', 'Steak', 'Chicken', 'Turkey',
        'Meatball', 'Hotdog', 'Taco', 'Burrito', 'Waffle', 'Pancake',
        // Snacks/Desserts
        'Cookie', 'Donut', 'Cupcake', 'Muffin', 'Pretzel', 'Nacho', 'Popcorn',
        'Pickle', 'Cracker', 'Biscuit', 'Brownie', 'Pudding', 'Jelly',
        // Tech/Gaming
        'Gameboy', 'Joystick', 'Pixel', 'Console', 'Keyboard', 'Mouse', 'Screen',
        'Cartridge', 'Controller', 'Toaster', 'Blender', 'Microwave',
        // Animals (food-adjacent)
        'Lobster', 'Shrimp', 'Crab', 'Squid', 'Octopus', 'Clam', 'Oyster',
        // Kitchen items
        'Spatula', 'Whisk', 'Ladle', 'Colander', 'Skillet', 'Wok', 'Cleaver',
        // Random fun objects
        'Rocket', 'Comet', 'Ninja', 'Pirate', 'Viking', 'Wizard', 'Dragon',
        'Phoenix', 'Unicorn', 'Yeti', 'Sasquatch', 'Goblin', 'Troll',
        // Misc food
        'Toast', 'Noodle', 'Dumpling', 'Ramen', 'Sushi', 'Tempura', 'Gyoza',
        'Croissant', 'Bagel', 'Pretzel', 'Churro', 'Empanada', 'Samosa'
    ],

    /**
     * Generate a random name
     * @returns {string} Random name like "Crazy Arugula"
     */
    generate() {
        const adjective = this.adjectives[Math.floor(Math.random() * this.adjectives.length)];
        const noun = this.nouns[Math.floor(Math.random() * this.nouns.length)];
        return `${adjective} ${noun}`;
    },

    /**
     * Generate multiple unique random names
     * @param {number} count - Number of names to generate
     * @returns {string[]} Array of unique random names
     */
    generateMultiple(count) {
        const names = new Set();
        const maxAttempts = count * 3;
        let attempts = 0;

        while (names.size < count && attempts < maxAttempts) {
            names.add(this.generate());
            attempts++;
        }

        return Array.from(names);
    },

    /**
     * Get total possible combinations
     * @returns {number}
     */
    getTotalCombinations() {
        return this.adjectives.length * this.nouns.length;
    }
};

// Export for use
if (typeof window !== 'undefined') {
    window.RandomNames = RandomNames;
}
