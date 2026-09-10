import bcrypt from 'bcryptjs';
import { connectDatabase, disconnectDatabase } from './config/db.js';
import { User } from './models/User.js';
import { Conversation } from './models/Conversation.js';
import { Message } from './models/Message.js';
import { Status } from './models/Status.js';
import { RefreshToken } from './models/RefreshToken.js';
import { CallSession } from './models/CallSession.js';

async function seed() {
  await connectDatabase();
  await Promise.all([User.deleteMany({}), Conversation.deleteMany({}), Message.deleteMany({}), Status.deleteMany({}), RefreshToken.deleteMany({}), CallSession.deleteMany({})]);
  const passwordHash = await bcrypt.hash('Password@123', 12);
  const users = await User.create([
    { name: 'Platform Admin', phone: '+919999000001', passwordHash, role: 'admin', about: 'WaveChat administrator' },
    { name: 'Aarav Sharma', phone: '+919999000002', passwordHash, role: 'user', about: 'Building useful products' },
    { name: 'Meera Joshi', phone: '+919999000003', passwordHash, role: 'user', about: 'Available' }
  ]);
  console.log(`[seed] created ${users.length} demo accounts`);
  console.log('[seed] password for all accounts: Password@123');
  await disconnectDatabase();
}
seed().catch(async error => { console.error(error); await disconnectDatabase(); process.exit(1); });
