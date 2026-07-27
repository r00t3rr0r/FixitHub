const mongoose = require('mongoose');
const { BlogPost } = require('../models/BlogPost');
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/McRepair.de';

async function fixBlogSlugs() {
  try {
    console.log('Connecting to MongoDB...');
    await mongoose.connect(MONGODB_URI);
    console.log('Connected to MongoDB\n');

    // Define correct slugs for each blog post
    const slugMappings = [
      {
        title: 'Laptop-Reparatur: Die häufigsten Probleme und ihre Lösungen',
        correctSlug: 'laptop-reparatur-haeufigste-probleme'
      },
      {
        title: 'Smartphone-Display kaputt? So schützen Sie Ihr Gerät',
        correctSlug: 'smartphone-display-schutz'
      },
      {
        title: 'Tablet-Reparatur: Wann lohnt sich eine Reparatur?',
        correctSlug: 'tablet-reparatur-lohnenswert'
      },
      {
        title: 'Spielekonsolen-Reparatur: Häufige Defekte bei PS5, Xbox & Nintendo Switch',
        correctSlug: 'spielekonsolen-reparatur-defekte'
      }
    ];

    console.log('Updating blog post slugs...\n');

    for (const mapping of slugMappings) {
      const post = await BlogPost.findOne({ title: mapping.title });
      
      if (post) {
        console.log(`Found: "${post.title}"`);
        console.log(`  Old slug: ${post.slug}`);
        console.log(`  New slug: ${mapping.correctSlug}`);
        
        // Update directly with updateOne to bypass middleware
        await BlogPost.updateOne(
          { _id: post._id },
          { $set: { slug: mapping.correctSlug } }
        );
        
        console.log('  ✅ Updated\n');
      } else {
        console.log(`❌ Post not found: "${mapping.title}"\n`);
      }
    }

    console.log('✅ All blog post slugs have been fixed!\n');
    
    // Display all posts with their new slugs
    console.log('Current blog posts:');
    const allPosts = await BlogPost.find({ status: 'published' })
      .select('title slug')
      .sort({ createdAt: -1 });
    
    allPosts.forEach((post, index) => {
      console.log(`${index + 1}. ${post.title}`);
      console.log(`   Slug: ${post.slug}\n`);
    });
    
  } catch (error) {
    console.error('Error fixing blog slugs:', error);
  } finally {
    await mongoose.connection.close();
    console.log('Database connection closed');
  }
}

// Run the fix script
fixBlogSlugs();
