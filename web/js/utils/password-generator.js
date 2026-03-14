/**
 * Password Generator
 * Generates secure random passwords with customizable options
 */

const PasswordGenerator = {
    // Character sets
    charsets: {
        uppercase: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ',
        lowercase: 'abcdefghijklmnopqrstuvwxyz',
        numbers: '0123456789',
        symbols: '!@#$%^&*()_+-=[]{}|;:,.<>?',
        ambiguous: '0O1lI',
    },

    // Default options
    defaultOptions: {
        length: 16,
        uppercase: true,
        lowercase: true,
        numbers: true,
        symbols: true,
        excludeAmbiguous: false,
        excludeChars: '',
        minNumbers: 0,
        minSymbols: 0,
        minUppercase: 0,
        minLowercase: 0,
    },

    /**
     * Generate a password
     * @param {Object} options - Generation options
     * @returns {string} - Generated password
     */
    generate(options = {}) {
        const opts = { ...this.defaultOptions, ...options };

        // Build character pool
        let pool = '';
        const requiredChars = [];

        if (opts.uppercase) {
            let chars = this.charsets.uppercase;
            if (opts.excludeAmbiguous) {
                chars = this.removeChars(chars, this.charsets.ambiguous);
            }
            chars = this.removeChars(chars, opts.excludeChars);
            pool += chars;

            // Add required uppercase characters
            for (let i = 0; i < opts.minUppercase; i++) {
                requiredChars.push(this.randomChar(chars));
            }
        }

        if (opts.lowercase) {
            let chars = this.charsets.lowercase;
            if (opts.excludeAmbiguous) {
                chars = this.removeChars(chars, this.charsets.ambiguous);
            }
            chars = this.removeChars(chars, opts.excludeChars);
            pool += chars;

            // Add required lowercase characters
            for (let i = 0; i < opts.minLowercase; i++) {
                requiredChars.push(this.randomChar(chars));
            }
        }

        if (opts.numbers) {
            let chars = this.charsets.numbers;
            if (opts.excludeAmbiguous) {
                chars = this.removeChars(chars, this.charsets.ambiguous);
            }
            chars = this.removeChars(chars, opts.excludeChars);
            pool += chars;

            // Add required number characters
            for (let i = 0; i < opts.minNumbers; i++) {
                requiredChars.push(this.randomChar(chars));
            }
        }

        if (opts.symbols) {
            let chars = this.charsets.symbols;
            chars = this.removeChars(chars, opts.excludeChars);
            pool += chars;

            // Add required symbol characters
            for (let i = 0; i < opts.minSymbols; i++) {
                requiredChars.push(this.randomChar(chars));
            }
        }

        if (pool.length === 0) {
            throw new Error('At least one character type must be enabled');
        }

        // Calculate remaining length
        const remainingLength = opts.length - requiredChars.length;

        if (remainingLength < 0) {
            throw new Error('Password length is too short for minimum requirements');
        }

        // Generate remaining characters
        const password = [...requiredChars];
        for (let i = 0; i < remainingLength; i++) {
            password.push(this.randomChar(pool));
        }

        // Shuffle password
        return this.shuffle(password).join('');
    },

    /**
     * Generate a passphrase
     * @param {Object} options - Generation options
     * @returns {Promise<string>} - Generated passphrase
     */
    async generatePassphrase(options = {}) {
        const {
            wordCount = 4,
            separator = '-',
            capitalize = true,
            includeNumber = false,
        } = options;

        // Simple word list (in production, use a larger list)
        const words = await this.getWordList();

        const passphrase = [];

        for (let i = 0; i < wordCount; i++) {
            let word = words[this.randomInt(0, words.length - 1)];

            if (capitalize) {
                word = word.charAt(0).toUpperCase() + word.slice(1);
            }

            passphrase.push(word);
        }

        if (includeNumber) {
            const position = this.randomInt(0, passphrase.length);
            passphrase.splice(position, 0, this.randomInt(0, 99).toString());
        }

        return passphrase.join(separator);
    },

    /**
     * Generate random character from pool
     * @param {string} pool
     * @returns {string}
     */
    randomChar(pool) {
        return pool[this.randomInt(0, pool.length - 1)];
    },

    /**
     * Generate cryptographically secure random integer
     * @param {number} min
     * @param {number} max
     * @returns {number}
     */
    randomInt(min, max) {
        const range = max - min + 1;
        const bytesNeeded = Math.ceil(Math.log2(range) / 8);
        const maxValid = Math.floor(256 ** bytesNeeded / range) * range - 1;

        let randomValue;
        const randomBytes = new Uint8Array(bytesNeeded);

        do {
            crypto.getRandomValues(randomBytes);
            randomValue = 0;
            for (let i = 0; i < bytesNeeded; i++) {
                randomValue = (randomValue << 8) + randomBytes[i];
            }
        } while (randomValue > maxValid);

        return min + (randomValue % range);
    },

    /**
     * Remove characters from string
     * @param {string} str
     * @param {string} chars
     * @returns {string}
     */
    removeChars(str, chars) {
        return str.split('').filter(c => !chars.includes(c)).join('');
    },

    /**
     * Fisher-Yates shuffle
     * @param {Array} array
     * @returns {Array}
     */
    shuffle(array) {
        const result = [...array];
        for (let i = result.length - 1; i > 0; i--) {
            const j = this.randomInt(0, i);
            [result[i], result[j]] = [result[j], result[i]];
        }
        return result;
    },

    /**
     * Get word list for passphrase generation
     * 1550 words — ~10.6 bits entropy per word
     * 4-word passphrase = ~42.4 bits | 5-word = ~53 bits | 6-word = ~63.6 bits
     * Inspired by EFF short word list. All words 3-6 chars, common, memorable.
     * @returns {Promise<string[]>}
     */
    async getWordList() {
        return [
            'acid', 'acorn', 'acre', 'acts', 'afar', 'after', 'aged', 'agent',
            'agile', 'aging', 'agony', 'agree', 'ahead', 'aide', 'aim', 'alarm',
            'album', 'alert', 'algae', 'alien', 'align', 'alive', 'alley', 'allow',
            'aloft', 'alone', 'alpha', 'altar', 'alter', 'amaze', 'amber', 'amend',
            'ample', 'amuse', 'angel', 'anger', 'angle', 'ankle', 'anvil', 'apart',
            'apex', 'apple', 'apply', 'apron', 'aqua', 'arena', 'argue', 'arise',
            'armor', 'aroma', 'array', 'arrow', 'ash', 'asset', 'atlas', 'atom',
            'attic', 'audio', 'audit', 'avid', 'avoid', 'await', 'awake', 'award',
            'aware', 'axiom', 'axis', 'azure', 'bacon', 'badge', 'badly', 'bagel',
            'bail', 'bait', 'baker', 'balm', 'band', 'banjo', 'bank', 'bark',
            'barn', 'baron', 'base', 'basic', 'basin', 'batch', 'bay', 'beach',
            'bead', 'beam', 'bean', 'beard', 'beast', 'began', 'begin', 'being',
            'belly', 'bench', 'berry', 'bird', 'birth', 'black', 'blade', 'blame',
            'blank', 'blast', 'blaze', 'bleak', 'blend', 'bless', 'blimp', 'blind',
            'blink', 'bliss', 'blitz', 'block', 'bloom', 'blown', 'bluff', 'blunt',
            'blur', 'blurt', 'blush', 'board', 'boast', 'boat', 'bogus', 'bolt',
            'bomb', 'bonus', 'book', 'boost', 'booth', 'born', 'bound', 'bowl',
            'brace', 'braid', 'brain', 'brake', 'brand', 'brave', 'bread', 'break',
            'breed', 'brick', 'bride', 'brief', 'brim', 'bring', 'brink', 'brisk',
            'broad', 'broil', 'brook', 'broom', 'broth', 'brush', 'buddy', 'budge',
            'build', 'built', 'bulge', 'bulk', 'bunch', 'bunny', 'burn', 'burst',
            'buyer', 'cabin', 'cable', 'cadet', 'cage', 'cake', 'calm', 'camel',
            'camp', 'canal', 'candy', 'cape', 'cargo', 'carry', 'carve', 'catch',
            'cause', 'cedar', 'chain', 'chair', 'chalk', 'champ', 'chant', 'chaos',
            'charm', 'chart', 'chase', 'cheap', 'check', 'cheek', 'cheer', 'chess',
            'chest', 'chief', 'child', 'chill', 'chime', 'chip', 'choir', 'chunk',
            'cigar', 'cinch', 'city', 'civic', 'civil', 'claim', 'clamp', 'clap',
            'clash', 'clasp', 'class', 'claw', 'clay', 'clean', 'clear', 'clerk',
            'click', 'cliff', 'climb', 'cling', 'clip', 'cloak', 'clock', 'clone',
            'close', 'cloth', 'cloud', 'clown', 'club', 'clue', 'clump', 'coach',
            'coast', 'cobra', 'cocoa', 'code', 'coil', 'coin', 'comet', 'comic',
            'coral', 'cord', 'core', 'cork', 'corn', 'couch', 'count', 'court',
            'cover', 'crack', 'craft', 'crane', 'crash', 'crate', 'crave', 'crawl',
            'crazy', 'creak', 'cream', 'creek', 'creep', 'crest', 'crew', 'crisp',
            'cross', 'crowd', 'crown', 'crude', 'crush', 'cube', 'curb', 'cure',
            'curl', 'curve', 'cycle', 'daily', 'dairy', 'daisy', 'dance', 'dare',
            'dart', 'dash', 'data', 'dawn', 'dealt', 'death', 'debut', 'decay',
            'decor', 'decoy', 'decry', 'deed', 'delay', 'delta', 'delve', 'demon',
            'denim', 'dense', 'depot', 'depth', 'derby', 'desk', 'devil', 'diary',
            'diner', 'dish', 'ditch', 'dive', 'dizzy', 'dock', 'dodge', 'donor',
            'donut', 'doom', 'door', 'dose', 'doubt', 'dough', 'dove', 'down',
            'dozen', 'draft', 'drain', 'drama', 'drank', 'drape', 'draw', 'dream',
            'dress', 'dried', 'drift', 'drill', 'drink', 'drive', 'droit', 'drop',
            'drove', 'drum', 'dry', 'dual', 'duck', 'dug', 'duke', 'dull',
            'dummy', 'dune', 'dusty', 'duty', 'dwarf', 'dwell', 'eager', 'eagle',
            'early', 'earn', 'earth', 'easel', 'east', 'eaten', 'eave', 'echo',
            'edge', 'edict', 'eight', 'elbow', 'elder', 'elect', 'elite', 'elm',
            'ember', 'emit', 'empty', 'ended', 'enemy', 'enjoy', 'enter', 'entry',
            'envoy', 'epic', 'equal', 'equip', 'erase', 'error', 'erupt', 'essay',
            'ethic', 'evade', 'even', 'event', 'every', 'evict', 'evil', 'evoke',
            'exact', 'exalt', 'exam', 'exile', 'exist', 'expel', 'extra', 'fable',
            'facet', 'fact', 'fade', 'faint', 'fair', 'fairy', 'faith', 'faker',
            'fame', 'fancy', 'fang', 'farm', 'fatal', 'fault', 'fauna', 'favor',
            'feast', 'feat', 'fence', 'fend', 'fern', 'ferry', 'fetch', 'fever',
            'fiber', 'field', 'fifth', 'fifty', 'fight', 'film', 'final', 'find',
            'fire', 'firm', 'first', 'fish', 'five', 'fixed', 'flag', 'flame',
            'flank', 'flap', 'flare', 'flash', 'flask', 'flaw', 'fleet', 'flesh',
            'flex', 'flick', 'fling', 'flip', 'float', 'flock', 'flood', 'floor',
            'flora', 'flour', 'flown', 'fluid', 'flush', 'flute', 'foam', 'focal',
            'focus', 'foggy', 'foil', 'folk', 'fond', 'font', 'food', 'forge',
            'fork', 'form', 'forth', 'forum', 'fossil', 'found', 'four', 'foyer',
            'frame', 'frank', 'fraud', 'fresh', 'friar', 'frog', 'front', 'frost',
            'froze', 'fruit', 'fuel', 'fully', 'fungi', 'fury', 'fuse', 'fussy',
            'fuzzy', 'gain', 'gala', 'gale', 'game', 'gamma', 'gang', 'gap',
            'gas', 'gauge', 'gaze', 'gear', 'gem', 'genre', 'gift', 'gild',
            'given', 'glad', 'glare', 'glass', 'gleam', 'glide', 'globe', 'gloom',
            'glory', 'gloss', 'glove', 'glow', 'glue', 'goat', 'gold', 'golf',
            'gone', 'goose', 'gorge', 'gown', 'grab', 'grace', 'grade', 'grain',
            'grand', 'grant', 'grape', 'graph', 'grasp', 'grass', 'grave', 'gravy',
            'great', 'greed', 'green', 'greet', 'grief', 'grill', 'grim', 'grin',
            'grind', 'grip', 'groan', 'groom', 'gross', 'group', 'grove', 'grown',
            'growl', 'guard', 'guess', 'guest', 'guide', 'guild', 'guilt', 'guise',
            'gulch', 'gulf', 'gust', 'gut', 'habit', 'half', 'halt', 'hand',
            'happy', 'hardy', 'harm', 'harp', 'harsh', 'hasn', 'haste', 'hasty',
            'hatch', 'haul', 'haven', 'hawk', 'hazel', 'head', 'heap', 'heart',
            'heavy', 'hedge', 'hefty', 'heist', 'held', 'hello', 'help', 'herb',
            'herd', 'hero', 'heron', 'hike', 'hill', 'hilly', 'hind', 'hint',
            'hippo', 'hitch', 'hive', 'hobby', 'hold', 'holly', 'home', 'honey',
            'honor', 'hood', 'hook', 'hope', 'horn', 'horse', 'host', 'hotel',
            'hound', 'house', 'hover', 'hub', 'human', 'humid', 'humor', 'hunt',
            'hurry', 'hut', 'hymn', 'icing', 'icon', 'idea', 'ideal', 'image',
            'impel', 'imply', 'inbox', 'index', 'indie', 'inert', 'infer', 'inner',
            'input', 'iron', 'irony', 'islet', 'issue', 'ivory', 'ivy', 'jab',
            'jade', 'jail', 'jam', 'jar', 'jazz', 'jeans', 'jelly', 'jetty',
            'jewel', 'join', 'joint', 'joker', 'jolly', 'jolt', 'judge', 'juice',
            'juicy', 'jumbo', 'jump', 'jumpy', 'jury', 'kayak', 'keen', 'keep',
            'kept', 'key', 'kick', 'kind', 'king', 'kite', 'knack', 'kneel',
            'knelt', 'knit', 'knob', 'knock', 'knoll', 'knot', 'known', 'label',
            'lace', 'lack', 'laden', 'ladle', 'lake', 'lamb', 'lamp', 'lance',
            'land', 'lane', 'large', 'laser', 'latch', 'later', 'laugh', 'lava',
            'lawn', 'layer', 'lazy', 'lead', 'leaf', 'leak', 'lean', 'leap',
            'learn', 'lease', 'least', 'left', 'legal', 'lemon', 'lend', 'lens',
            'level', 'lever', 'light', 'lilac', 'limb', 'lime', 'limit', 'limp',
            'linen', 'link', 'lion', 'list', 'liter', 'liven', 'liver', 'llama',
            'load', 'loaf', 'loan', 'lobby', 'local', 'lodge', 'loft', 'logic',
            'lone', 'long', 'loop', 'loose', 'lord', 'loss', 'lost', 'lotus',
            'loud', 'love', 'lower', 'loyal', 'lucky', 'lump', 'lunar', 'lunch',
            'lure', 'lurk', 'lying', 'lyric', 'macro', 'magic', 'magma', 'maid',
            'major', 'maker', 'malt', 'mango', 'manor', 'maple', 'march', 'marsh',
            'mason', 'match', 'math', 'mayor', 'maze', 'mealy', 'meant', 'medal',
            'media', 'medic', 'melon', 'memo', 'mend', 'menu', 'mercy', 'merge',
            'merit', 'merry', 'messy', 'metal', 'meter', 'midst', 'might', 'mild',
            'mile', 'mill', 'mimic', 'mind', 'minor', 'minus', 'mirth', 'mist',
            'misty', 'moan', 'moat', 'mock', 'model', 'moist', 'mold', 'money',
            'month', 'mood', 'moose', 'moral', 'moss', 'motel', 'moth', 'motor',
            'mound', 'mount', 'mouse', 'mouth', 'movie', 'much', 'mule', 'mural',
            'music', 'must', 'mute', 'myth', 'nail', 'name', 'navy', 'near',
            'neat', 'nerve', 'nest', 'never', 'next', 'nice', 'night', 'nine',
            'noble', 'node', 'noise', 'north', 'notch', 'noted', 'novel', 'nudge',
            'nurse', 'nylon', 'oak', 'oasis', 'oath', 'ocean', 'odds', 'odor',
            'offer', 'often', 'olive', 'omega', 'once', 'onset', 'opal', 'opera',
            'orbit', 'order', 'organ', 'other', 'otter', 'ought', 'ounce', 'outer',
            'oval', 'oven', 'over', 'owner', 'oxide', 'ozone', 'pace', 'pack',
            'pact', 'page', 'paid', 'pail', 'pain', 'pair', 'palm', 'panda',
            'panel', 'panic', 'paper', 'park', 'party', 'paste', 'patch', 'path',
            'patio', 'pause', 'pave', 'peace', 'peach', 'peak', 'pearl', 'pedal',
            'penny', 'perch', 'peril', 'perky', 'petal', 'petty', 'phone', 'photo',
            'piano', 'pick', 'piece', 'pilot', 'pinch', 'pine', 'pitch', 'pixel',
            'pizza', 'place', 'plaid', 'plain', 'plan', 'plane', 'plank', 'plant',
            'plate', 'plaza', 'plead', 'plod', 'plot', 'ploy', 'pluck', 'plumb',
            'plume', 'plump', 'plush', 'poem', 'point', 'poise', 'polar', 'polo',
            'pond', 'pool', 'poppy', 'porch', 'port', 'poser', 'pouch', 'pound',
            'power', 'press', 'price', 'pride', 'prime', 'print', 'prior', 'prism',
            'prize', 'probe', 'prone', 'proof', 'prose', 'proud', 'prove', 'prowl',
            'prune', 'pulp', 'pulse', 'pump', 'punch', 'pupil', 'puppy', 'purse',
            'quake', 'qualm', 'quest', 'queue', 'quick', 'quiet', 'quill', 'quilt',
            'quirk', 'quota', 'quote', 'race', 'radar', 'radio', 'raft', 'rage',
            'raid', 'rail', 'rain', 'rainy', 'raise', 'rally', 'ramp', 'ranch',
            'range', 'rank', 'rapid', 'rash', 'ratio', 'raw', 'reach', 'ready',
            'realm', 'rebel', 'reef', 'regal', 'reign', 'relax', 'relay', 'relic',
            'renew', 'reply', 'reset', 'resin', 'rider', 'ridge', 'rifle', 'rift',
            'rigid', 'ring', 'rinse', 'ripen', 'rise', 'risen', 'risky', 'rival',
            'river', 'roam', 'roar', 'roast', 'robin', 'robot', 'rocky', 'rode',
            'rogue', 'role', 'roman', 'roof', 'room', 'root', 'rope', 'rosy',
            'rough', 'round', 'route', 'rover', 'royal', 'ruby', 'ruin', 'rule',
            'ruler', 'rumor', 'rural', 'rush', 'rusty', 'sack', 'safe', 'saga',
            'sage', 'saint', 'salad', 'salon', 'salty', 'salve', 'sandy', 'sane',
            'sauce', 'savor', 'scale', 'scar', 'scare', 'scene', 'scent', 'scope',
            'score', 'scout', 'scrap', 'seal', 'sedan', 'seed', 'seize', 'sense',
            'serve', 'setup', 'seven', 'shade', 'shady', 'shaft', 'shake', 'shame',
            'shape', 'share', 'shark', 'sharp', 'shave', 'shawl', 'shed', 'sheer',
            'sheet', 'shelf', 'shell', 'shift', 'shine', 'shiny', 'ship', 'shirt',
            'shock', 'shore', 'short', 'shout', 'shove', 'shown', 'shrub', 'shut',
            'siege', 'sight', 'sigma', 'silk', 'silly', 'since', 'siren', 'sixth',
            'sixty', 'size', 'skate', 'skill', 'skin', 'skimp', 'skull', 'slab',
            'slam', 'slash', 'slate', 'sleek', 'sleep', 'sleet', 'slice', 'slick',
            'slide', 'slim', 'sling', 'slope', 'slug', 'small', 'smart', 'smash',
            'smell', 'smile', 'smirk', 'smog', 'smoke', 'snack', 'snap', 'snare',
            'sneak', 'snow', 'snowy', 'snug', 'soak', 'soap', 'soar', 'sob',
            'sober', 'solar', 'sole', 'solid', 'solve', 'sonic', 'sorry', 'sort',
            'soul', 'sound', 'south', 'space', 'spare', 'spark', 'spawn', 'speak',
            'spear', 'speed', 'spell', 'spend', 'spent', 'spice', 'spicy', 'spike',
            'spill', 'spine', 'spoke', 'spoon', 'sport', 'spray', 'squad', 'squid',
            'staff', 'stage', 'stain', 'stair', 'stake', 'stale', 'stall', 'stamp',
            'stand', 'stank', 'star', 'stare', 'stark', 'start', 'stash', 'state',
            'stave', 'stay', 'steak', 'steal', 'steam', 'steel', 'steep', 'steer',
            'stem', 'step', 'stern', 'stew', 'stick', 'stiff', 'still', 'sting',
            'stink', 'stint', 'stock', 'stomp', 'stone', 'stood', 'stool', 'stop',
            'store', 'stork', 'storm', 'story', 'stout', 'stove', 'stray', 'strip',
            'strum', 'strut', 'stuck', 'study', 'stuff', 'stump', 'stung', 'stunt',
            'style', 'sugar', 'suite', 'sunny', 'super', 'surge', 'sushi', 'swamp',
            'swan', 'swap', 'swarm', 'sway', 'swear', 'sweat', 'sweep', 'sweet',
            'swept', 'swift', 'swim', 'swing', 'swipe', 'swirl', 'sworn', 'swung',
            'syrup', 'table', 'taco', 'tag', 'tail', 'taken', 'tale', 'talk',
            'tally', 'talon', 'tame', 'tank', 'tape', 'taste', 'tasty', 'teach',
            'tease', 'teeth', 'tell', 'tempo', 'tend', 'tenor', 'tent', 'term',
            'test', 'theme', 'then', 'there', 'thick', 'thief', 'thigh', 'thin',
            'thing', 'think', 'third', 'thorn', 'those', 'three', 'threw', 'throw',
            'thud', 'thumb', 'tide', 'tidy', 'tiger', 'tight', 'tile', 'till',
            'tilt', 'time', 'timid', 'tip', 'tired', 'title', 'toast', 'today',
            'token', 'toll', 'tone', 'took', 'tool', 'tooth', 'topic', 'torch',
            'total', 'touch', 'tough', 'towel', 'tower', 'town', 'toxic', 'trace',
            'track', 'trade', 'trail', 'train', 'trait', 'trap', 'trash', 'trawl',
            'treat', 'trend', 'trial', 'tribe', 'trick', 'tried', 'trim', 'trio',
            'troop', 'truck', 'truly', 'trump', 'trunk', 'trust', 'truth', 'try',
            'tube', 'tulip', 'tumor', 'tuna', 'tune', 'tunic', 'turn', 'tutor',
            'tweed', 'twice', 'twin', 'twist', 'type', 'ultra', 'uncle', 'under',
            'unify', 'union', 'unite', 'unity', 'until', 'upper', 'upset', 'urban',
            'urge', 'usage', 'user', 'using', 'usual', 'utter', 'vague', 'valid',
            'value', 'valve', 'vapor', 'vault', 'venom', 'venue', 'verb', 'verge',
            'verse', 'vest', 'video', 'vigil', 'vigor', 'vine', 'vinyl', 'viola',
            'viper', 'viral', 'visit', 'visor', 'vista', 'vital', 'vivid', 'vocal',
            'voice', 'void', 'voter', 'vouch', 'vowel', 'wade', 'wager', 'wagon',
            'waist', 'wake', 'walk', 'wall', 'waltz', 'wand', 'warm', 'warn',
            'warp', 'waste', 'watch', 'water', 'wave', 'wavy', 'wax', 'weak',
            'weary', 'weave', 'wedge', 'weigh', 'weird', 'wells', 'west', 'whale',
            'wheat', 'wheel', 'where', 'which', 'while', 'whim', 'whine', 'whirl',
            'white', 'whole', 'wick', 'wide', 'widen', 'width', 'wield', 'wild',
            'will', 'wilt', 'wind', 'wine', 'wing', 'wipe', 'wired', 'wise',
            'wish', 'witch', 'wolf', 'woman', 'won', 'wood', 'wool', 'word',
            'work', 'world', 'worm', 'worry', 'worse', 'worst', 'worth', 'would',
            'wound', 'woven', 'wrath', 'wreck', 'wrist', 'write', 'wrong', 'wrote',
            'yacht', 'yard', 'year', 'yeast', 'yield', 'yoga', 'young', 'your',
            'youth', 'zebra', 'zero', 'zinc', 'zone', 'zoom',
        ];
    },
};

// Export for module systems
if (typeof module !== 'undefined' && module.exports) {
    module.exports = PasswordGenerator;
}
