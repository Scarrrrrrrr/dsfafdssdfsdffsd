const fs = require('fs');

// Read the storage.ts file
const storageContent = fs.readFileSync('server/storage.ts', 'utf8');

// Define the patterns to search for and replace
const oldPattern = `      .select({
        id: users.id,
        username: users.username,
        displayName: users.displayName,
        avatar: users.avatar,
        bio: users.bio,
        pronouns: users.pronouns,
        isOnline: users.isOnline,
        backgroundImage: users.backgroundImage,
        settings: users.settings
      })`;

const newPattern = `      .select({
        id: users.id,
        username: users.username,
        displayName: users.displayName,
        avatar: users.avatar,
        bio: users.bio,
        pronouns: users.pronouns,
        isOnline: users.isOnline,
        backgroundImage: users.backgroundImage,
        settings: users.settings,
        isBanned: users.isBanned,
        banReason: users.banReason
      })`;

// Replace all occurrences
const updatedContent = storageContent.replace(new RegExp(oldPattern.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'), newPattern);

// Write the updated content back to the file
fs.writeFileSync('server/storage.ts', updatedContent);
console.log('File updated successfully.');
