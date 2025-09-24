const fs = require('fs');
const path = require('path');

const dbPath = path.join(__dirname, '..', 'database', 'users.json');

// Initialize database file if it doesn't exist
if (!fs.existsSync(path.dirname(dbPath))) {
    fs.mkdirSync(path.dirname(dbPath), { recursive: true });
}

if (!fs.existsSync(dbPath)) {
    fs.writeFileSync(dbPath, JSON.stringify({}, null, 2));
}

// Read database
const readDatabase = () => {
    try {
        const data = fs.readFileSync(dbPath, 'utf8');
        return JSON.parse(data);
    } catch (error) {
        console.error('Error reading database:', error);
        return {};
    }
};

// Write to database
const writeDatabase = (data) => {
    try {
        fs.writeFileSync(dbPath, JSON.stringify(data, null, 2));
        return true;
    } catch (error) {
        console.error('Error writing to database:', error);
        return false;
    }
};

// Get user profile
const getUserProfile = (userId) => {
    const db = readDatabase();
    return db[userId] || null;
};

// Create user profile
const createUserProfile = (userId, username) => {
    const db = readDatabase();

    if (db[userId]) {
        return db[userId];
    }

    const newProfile = {
        userId: userId,
        username: username,
        arcadeTokens: 1000,
        goldenJoysticks: 0,
        tutorialCompleted: false,
        createdAt: Date.now(),
        lastSeen: Date.now(),
        stats: {
            gamesPlayed: 0,
            gamesWon: 0,
            totalWagered: 0,
            totalWon: 0
        }
    };

    db[userId] = newProfile;
    writeDatabase(db);

    return newProfile;
};

// Update user balance
const updateUserBalance = (userId, arcadeTokens = 0, goldenJoysticks = 0) => {
    const db = readDatabase();

    if (!db[userId]) {
        return false;
    }

    db[userId].arcadeTokens += arcadeTokens;
    db[userId].goldenJoysticks += goldenJoysticks;
    db[userId].lastSeen = Date.now();

    // Ensure no negative balances
    if (db[userId].arcadeTokens < 0) db[userId].arcadeTokens = 0;
    if (db[userId].goldenJoysticks < 0) db[userId].goldenJoysticks = 0;

    return writeDatabase(db);
};

// Mark tutorial as completed
const completeTutorial = (userId) => {
    const db = readDatabase();

    if (!db[userId]) {
        return false;
    }

    db[userId].tutorialCompleted = true;
    return writeDatabase(db);
};

// Update game stats
const updateGameStats = (userId, won, wagered, winnings = 0) => {
    const db = readDatabase();

    if (!db[userId]) {
        return false;
    }

    db[userId].stats.gamesPlayed++;
    if (won) db[userId].stats.gamesWon++;
    db[userId].stats.totalWagered += wagered;
    db[userId].stats.totalWon += winnings;

    return writeDatabase(db);
};

module.exports = {
    getUserProfile,
    createUserProfile,
    updateUserBalance,
    completeTutorial,
    updateGameStats
};
