import mongoose from 'mongoose';
import CodingChallenge from '../models/CodingChallenge';
import challengeBank from '../data/challengeBank.json';
import config from '../config/env';

/**
 * Seed coding challenges into the database
 */
async function seedChallenges(): Promise<void> {
  try {
    // Connect to database
    if (!config.databaseUrl) {
      throw new Error('DATABASE_URL is not defined');
    }

    await mongoose.connect(config.databaseUrl);
    console.log('✅ Connected to MongoDB');

    // Clear existing challenges
    const deleteResult = await CodingChallenge.deleteMany({});
    console.log(`🗑️  Deleted ${deleteResult.deletedCount} existing challenges`);

    // Insert new challenges
    const challenges = challengeBank.challenges.map(challenge => ({
      ...challenge,
      starterCode: new Map(Object.entries(challenge.starterCode))
    }));

    const insertedChallenges = await CodingChallenge.insertMany(challenges);
    console.log(`✅ Inserted ${insertedChallenges.length} coding challenges`);

    // Display summary by role
    const summary = insertedChallenges.reduce((acc: Record<string, number>, challenge) => {
      acc[challenge.role] = (acc[challenge.role] || 0) + 1;
      return acc;
    }, {});

    console.log('\n📊 Challenges by role:');
    Object.entries(summary).forEach(([role, count]) => {
      console.log(`   ${role}: ${count} challenges`);
    });

    console.log('\n✅ Seeding completed successfully!');
  } catch (error) {
    console.error('❌ Error seeding challenges:', error);
    throw error;
  } finally {
    await mongoose.disconnect();
    console.log('✅ Disconnected from MongoDB');
  }
}

// Run the seeding script
if (require.main === module) {
  seedChallenges()
    .then(() => process.exit(0))
    .catch((error) => {
      console.error(error);
      process.exit(1);
    });
}

export default seedChallenges;
