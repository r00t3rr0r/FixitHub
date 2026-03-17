const mongoose = require('mongoose');
const bcrypt = require('bcrypt');
const { BlogPost, BlogCategory, BlogTag } = require('../models/BlogPost');
const User = require('../models/User');
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/FixitHub';

async function seedGermanBlogs() {
  try {
    console.log('Connecting to MongoDB...');
    await mongoose.connect(MONGODB_URI);
    console.log('Connected to MongoDB');

    // Find admin user - try different admin emails
    let adminUser = await User.findOne({ email: 'admin@fixithub.com' });
    if (!adminUser) {
      adminUser = await User.findOne({ email: 'admin@example.com' });
    }
    if (!adminUser) {
      adminUser = await User.findOne({ role: 'admin' });
    }
    
    // If no admin user exists, create one
    if (!adminUser) {
      console.log('No admin user found. Creating one...');
      const hashedPassword = await bcrypt.hash('admin123', 10);
      
      adminUser = await User.create({
        name: 'Admin',
        email: 'admin@example.com',
        password: hashedPassword,
        role: 'admin',
        isActive: true,
        emailVerified: true
      });
      console.log('Created admin user:', adminUser.name, '(', adminUser.email, ')');
    } else {
      console.log('Found admin user:', adminUser.name, '(', adminUser.email, ')');
    }

    // Create categories if they don't exist
    const categoryData = [
      {
        name: 'Laptop Reparatur',
        slug: 'laptop-reparatur',
        description: 'Alles über Laptop-Reparaturen und -Wartung',
        isActive: true,
        order: 1
      },
      {
        name: 'Smartphone Reparatur',
        slug: 'smartphone-reparatur',
        description: 'Tipps und Tricks zur Smartphone-Reparatur',
        isActive: true,
        order: 2
      },
      {
        name: 'Tablet Reparatur',
        slug: 'tablet-reparatur',
        description: 'Informationen zur Tablet-Reparatur',
        isActive: true,
        order: 3
      },
      {
        name: 'Spielekonsolen',
        slug: 'spielekonsolen',
        description: 'Reparatur und Wartung von Spielekonsolen',
        isActive: true,
        order: 4
      }
    ];

    console.log('Creating categories...');
    const categories = {};
    for (const catData of categoryData) {
      let category = await BlogCategory.findOne({ slug: catData.slug });
      if (!category) {
        category = await BlogCategory.create(catData);
        console.log(`Created category: ${category.name}`);
      } else {
        console.log(`Category already exists: ${category.name}`);
      }
      categories[catData.slug] = category;
    }

    // Create tags
    const tagData = [
      { name: 'Tipps', slug: 'tipps', color: '#F5B800', isActive: true },
      { name: 'Anleitung', slug: 'anleitung', color: '#0066CC', isActive: true },
      { name: 'Wartung', slug: 'wartung', color: '#28A745', isActive: true },
      { name: 'Reparatur', slug: 'reparatur', color: '#DC3545', isActive: true }
    ];

    console.log('Creating tags...');
    const tags = {};
    for (const tData of tagData) {
      let tag = await BlogTag.findOne({ slug: tData.slug });
      if (!tag) {
        tag = await BlogTag.create(tData);
        console.log(`Created tag: ${tag.name}`);
      } else {
        console.log(`Tag already exists: ${tag.name}`);
      }
      tags[tData.slug] = tag;
    }

    // Create blog posts
    const blogPosts = [
      {
        title: 'Laptop-Reparatur: Die häufigsten Probleme und ihre Lösungen',
        slug: 'laptop-reparatur-haeufigste-probleme',
        excerpt: 'Von defekten Tastaturen bis zu überhitzten Prozessoren – wir zeigen Ihnen die häufigsten Laptop-Probleme und wie Sie diese beheben können.',
        content: `
          <h2>Die häufigsten Laptop-Probleme</h2>
          <p>Laptops sind aus unserem Alltag nicht mehr wegzudenken. Doch wie bei jedem elektronischen Gerät können auch hier Probleme auftreten. In diesem Artikel zeigen wir Ihnen die häufigsten Laptop-Defekte und wie Sie diese beheben können.</p>

          <h3>1. Defekte Tastatur</h3>
          <p>Eine der häufigsten Beschwerden bei Laptops ist eine defekte Tastatur. Einzelne Tasten funktionieren nicht mehr oder reagieren verzögert. Ursachen können Verschmutzungen, Flüssigkeitsschäden oder mechanische Defekte sein.</p>
          <p><strong>Lösung:</strong> In vielen Fällen hilft eine professionelle Reinigung. Bei schwerwiegenden Schäden muss die Tastatur ausgetauscht werden. Unsere Techniker können dies schnell und kostengünstig für Sie erledigen.</p>

          <h3>2. Überhitzung</h3>
          <p>Wenn Ihr Laptop sehr heiß wird und der Lüfter ständig auf Hochtouren läuft, liegt meist ein Problem mit der Kühlung vor. Verstaubte Lüftungsschlitze oder ausgetrocknete Wärmeleitpaste sind häufige Ursachen.</p>
          <p><strong>Lösung:</strong> Eine gründliche Reinigung der Lüftung und ein Austausch der Wärmeleitpaste können Wunder bewirken. Dies sollte regelmäßig (alle 2-3 Jahre) durchgeführt werden.</p>

          <h3>3. Defekter Bildschirm</h3>
          <p>Risse im Display, dunkle Flecken oder Pixelfehler sind ärgerlich und beeinträchtigen die Nutzung erheblich.</p>
          <p><strong>Lösung:</strong> In den meisten Fällen muss das Display ausgetauscht werden. Wir bieten schnelle und professionelle Display-Reparaturen für alle gängigen Laptop-Modelle.</p>

          <h3>4. Akku-Probleme</h3>
          <p>Der Akku hält nicht mehr lange oder lädt nicht mehr? Mit der Zeit verlieren Laptop-Akkus an Kapazität.</p>
          <p><strong>Lösung:</strong> Ein neuer Akku kann die Laufzeit Ihres Laptops wieder deutlich verlängern. Wir verwenden nur hochwertige Ersatzakkus.</p>

          <h3>Fazit</h3>
          <p>Die meisten Laptop-Probleme lassen sich mit der richtigen Expertise schnell beheben. Kontaktieren Sie uns für eine kostenlose Diagnose und ein unverbindliches Angebot!</p>
        `,
        category: categories['laptop-reparatur']._id,
        tags: [tags['reparatur']._id, tags['anleitung']._id],
        author: adminUser._id,
        status: 'published',
        publishedAt: new Date(),
        isFeatured: true,
        featuredOrder: 1
      },
      {
        title: 'Smartphone-Display kaputt? So schützen Sie Ihr Gerät',
        slug: 'smartphone-display-schutz',
        excerpt: 'Ein zerbrochenes Smartphone-Display ist ärgerlich und teuer. Erfahren Sie, wie Sie Ihr Smartphone optimal schützen und was bei einem Displayschaden zu tun ist.',
        content: `
          <h2>Smartphone-Display richtig schützen</h2>
          <p>Das Display ist die empfindlichste Komponente eines Smartphones. Ein Sturz kann schnell zu Rissen oder einem komplett zerstörten Display führen. Hier sind unsere Tipps zum Schutz Ihres Geräts.</p>

          <h3>Präventive Maßnahmen</h3>
          <h4>1. Schutzhülle verwenden</h4>
          <p>Eine hochwertige Schutzhülle kann Stürze abfedern und das Display vor direktem Aufprall schützen. Wählen Sie eine Hülle mit erhöhten Rändern, die das Display schützen, wenn das Handy auf den Bildschirm fällt.</p>

          <h4>2. Displayschutzfolie oder Panzerglas</h4>
          <p>Ein Panzerglas ist eine Investition, die sich lohnt. Es schützt vor Kratzern und kann bei einem Sturz das eigentliche Display schützen, indem es selbst bricht.</p>

          <h4>3. Vorsichtiger Umgang</h4>
          <p>Vermeiden Sie es, Ihr Smartphone zusammen mit Schlüsseln oder Münzen in die Tasche zu stecken. Transportieren Sie es in einer separaten Tasche oder verwenden Sie eine Handyhülle mit Kartenfach.</p>

          <h3>Was tun bei einem Displayschaden?</h3>
          <p>Trotz aller Vorsicht kann es passieren: Das Display ist gesprungen oder komplett zerbrochen.</p>

          <h4>Erste Hilfe</h4>
          <ul>
            <li>Kleben Sie provisorisch Klebeband über Risse, um Verletzungen zu vermeiden</li>
            <li>Sichern Sie wichtige Daten, falls das Display bald nicht mehr reagiert</li>
            <li>Schalten Sie das Gerät aus, wenn das Display flackert oder schwarze Flecken zeigt</li>
          </ul>

          <h4>Professionelle Reparatur</h4>
          <p>Bei FixitHub bieten wir schnelle und professionelle Display-Reparaturen für alle Smartphone-Modelle. In vielen Fällen können wir Ihr Gerät noch am selben Tag reparieren.</p>

          <h3>Display-Reparatur oder neues Handy?</h3>
          <p>Eine Display-Reparatur ist in den meisten Fällen deutlich günstiger als ein neues Smartphone. Lassen Sie sich von uns beraten, ob sich eine Reparatur lohnt!</p>
        `,
        category: categories['smartphone-reparatur']._id,
        tags: [tags['tipps']._id, tags['reparatur']._id],
        author: adminUser._id,
        status: 'published',
        publishedAt: new Date(),
        isFeatured: true,
        featuredOrder: 2
      },
      {
        title: 'Tablet-Reparatur: Wann lohnt sich eine Reparatur?',
        slug: 'tablet-reparatur-lohnenswert',
        excerpt: 'Ist Ihr Tablet defekt? Wir erklären, wann sich eine Reparatur lohnt und welche Tablet-Defekte am häufigsten auftreten.',
        content: `
          <h2>Tablet-Reparatur: Die wichtigsten Informationen</h2>
          <p>Tablets sind vielseitige Begleiter für Arbeit und Freizeit. Doch was tun, wenn das geliebte Tablet plötzlich nicht mehr funktioniert? Wir zeigen Ihnen, wann sich eine Reparatur lohnt.</p>

          <h3>Häufige Tablet-Defekte</h3>
          
          <h4>1. Zerbrochenes Display</h4>
          <p>Der häufigste Schaden bei Tablets ist ein gesprungenes oder zerbrochenes Display. Dies passiert meist durch Stürze oder Druck auf das Gerät.</p>
          <p><strong>Reparaturkosten:</strong> Je nach Modell zwischen 150€ und 400€. Bei hochwertigen Tablets wie dem iPad Pro lohnt sich die Reparatur fast immer.</p>

          <h4>2. Akku-Probleme</h4>
          <p>Mit der Zeit verliert der Akku an Kapazität. Wenn Ihr Tablet nur noch wenige Stunden durchhält, ist der Akku meist das Problem.</p>
          <p><strong>Reparaturkosten:</strong> Ein Akkutausch kostet in der Regel zwischen 80€ und 150€ und haucht Ihrem Tablet neues Leben ein.</p>

          <h4>3. Lade-Buchse defekt</h4>
          <p>Eine lockere oder beschädigte Ladebuchse ist ein häufiges Problem. Das Tablet lädt nicht mehr oder nur noch in bestimmten Positionen.</p>
          <p><strong>Reparaturkosten:</strong> Der Austausch der Ladebuchse kostet meist zwischen 60€ und 120€.</p>

          <h4>4. Wasserschaden</h4>
          <p>Flüssigkeiten und Elektronik vertragen sich nicht. Bei einem Wasserschaden ist schnelles Handeln gefragt.</p>
          <p><strong>Wichtig:</strong> Schalten Sie das Gerät sofort aus und bringen Sie es zu uns. Je schneller wir handeln, desto höher die Chancen auf eine erfolgreiche Reparatur.</p>

          <h3>Lohnt sich die Reparatur?</h3>
          <p>Generell gilt: Wenn Ihr Tablet weniger als 3-4 Jahre alt ist und die Reparaturkosten unter 50% des Neupreises liegen, lohnt sich die Reparatur.</p>

          <h4>Wann Sie reparieren sollten:</h4>
          <ul>
            <li>Hochwertige Tablets (iPad Pro, Samsung Galaxy Tab S Serie)</li>
            <li>Geräte unter 3 Jahren</li>
            <li>Einfache Defekte (Display, Akku, Ladebuchse)</li>
            <li>Wenn wichtige Daten auf dem Gerät sind</li>
          </ul>

          <h4>Wann ein Neukauf sinnvoller ist:</h4>
          <ul>
            <li>Sehr alte Geräte (über 5 Jahre)</li>
            <li>Mehrfachdefekte</li>
            <li>Günstige Einsteiger-Tablets</li>
            <li>Schwere Wasserschäden mit Folgeschäden</li>
          </ul>

          <h3>Kostenlose Diagnose bei FixitHub</h3>
          <p>Sie sind sich unsicher, ob sich die Reparatur lohnt? Kommen Sie vorbei! Wir bieten eine kostenlose Diagnose und erstellen Ihnen ein unverbindliches Angebot.</p>
        `,
        category: categories['tablet-reparatur']._id,
        tags: [tags['reparatur']._id, tags['anleitung']._id],
        author: adminUser._id,
        status: 'published',
        publishedAt: new Date(),
        isFeatured: true,
        featuredOrder: 3
      },
      {
        title: 'Spielekonsolen-Reparatur: Häufige Defekte bei PS5, Xbox & Nintendo Switch',
        slug: 'spielekonsolen-reparatur-defekte',
        excerpt: 'Ihre Spielekonsole macht Probleme? Wir erklären die häufigsten Defekte bei PlayStation, Xbox und Nintendo Switch und wie wir diese beheben können.',
        content: `
          <h2>Spielekonsolen-Reparatur: Das sollten Sie wissen</h2>
          <p>Moderne Spielekonsolen sind technische Meisterwerke – aber auch sie können kaputtgehen. Wir reparieren alle gängigen Konsolen und erklären Ihnen die häufigsten Probleme.</p>

          <h3>PlayStation 5 (PS5)</h3>
          
          <h4>Überhitzungsprobleme</h4>
          <p>Die PS5 ist leistungsstark, produziert aber auch viel Wärme. Verstaubte Lüftungsschlitze können zu Überhitzung und automatischer Abschaltung führen.</p>
          <p><strong>Lösung:</strong> Professionelle Reinigung und ggf. Austausch der Wärmeleitpaste. Kostet ca. 60-90€.</p>

          <h4>Laufwerkprobleme</h4>
          <p>Das Disc-Laufwerk nimmt keine CDs mehr auf oder gibt seltsame Geräusche von sich.</p>
          <p><strong>Lösung:</strong> Reinigung oder Austausch des Laufwerks. Je nach Problem 80-150€.</p>

          <h4>HDMI-Port defekt</h4>
          <p>Kein Bild auf dem Fernseher oder Bildstörungen können auf einen defekten HDMI-Anschluss hindeuten.</p>
          <p><strong>Lösung:</strong> Austausch des HDMI-Ports. Kostet ca. 100-140€.</p>

          <h3>Xbox Series X/S</h3>
          
          <h4>Kein Ton oder Bild</h4>
          <p>Oft ist der HDMI-Anschluss das Problem. Bei der Xbox Series X kommen auch HDMI-Chip-Probleme vor.</p>
          <p><strong>Lösung:</strong> HDMI-Port oder Chip-Reparatur. 100-180€.</p>

          <h4>Lüfter-Probleme</h4>
          <p>Die Xbox wird sehr laut oder schaltet sich wegen Überhitzung ab.</p>
          <p><strong>Lösung:</strong> Lüfteraustausch und Reinigung. 70-110€.</p>

          <h3>Nintendo Switch</h3>
          
          <h4>Joy-Con Drift</h4>
          <p>Der berüchtigte "Joy-Con Drift" – die Controller bewegen sich von alleine. Ein sehr häufiges Problem.</p>
          <p><strong>Lösung:</strong> Austausch des Analog-Sticks. Pro Controller 40-60€.</p>

          <h4>Ladebuchse defekt</h4>
          <p>Die Switch lädt nicht mehr oder nur noch manchmal.</p>
          <p><strong>Lösung:</strong> Austausch der USB-C Ladebuchse. 80-120€.</p>

          <h4>Display-Schaden</h4>
          <p>Gesprungenes Glas oder defektes LCD nach einem Sturz.</p>
          <p><strong>Lösung:</strong> Display-Tausch. 120-180€.</p>

          <h3>Ältere Konsolen (PS4, Xbox One, etc.)</h3>
          <p>Auch ältere Konsolen reparieren wir gerne! Häufige Probleme:</p>
          <ul>
            <li><strong>PS4:</strong> "Blinking Blue Light" (oft HDMI oder Netzteil), Laufwerkprobleme</li>
            <li><strong>Xbox One:</strong> Netzteilprobleme, Laufwerk</li>
            <li><strong>Wii U / 3DS:</strong> Touchscreen, Laufwerk, Akku</li>
          </ul>

          <h3>Wartungstipps für Spielekonsolen</h3>
          <ol>
            <li><strong>Gute Belüftung:</strong> Stellen Sie die Konsole nicht in geschlossene Schränke</li>
            <li><strong>Regelmäßige Reinigung:</strong> Entfernen Sie Staub von den Lüftungsschlitzen</li>
            <li><strong>Nicht im Dauerbetrieb:</strong> Gönnen Sie der Konsole Pausen</li>
            <li><strong>Software-Updates:</strong> Halten Sie die Firmware aktuell</li>
            <li><strong>Überspannungsschutz:</strong> Verwenden Sie eine Steckdosenleiste mit Überspannungsschutz</li>
          </ol>

          <h3>Garantie und Reparatur</h3>
          <p>Achtung: Eine Reparatur außerhalb des Herstellers kann die Garantie erlöschen lassen. Prüfen Sie vor der Reparatur, ob noch Garantie oder Gewährleistung besteht.</p>

          <p>Bei FixitHub bieten wir:</p>
          <ul>
            <li>Kostenlose Diagnose</li>
            <li>Schnelle Reparatur (meist innerhalb von 1-3 Werktagen)</li>
            <li>Original- oder hochwertige Ersatzteile</li>
            <li>6 Monate Garantie auf alle Reparaturen</li>
          </ul>

          <h3>Fazit</h3>
          <p>Die meisten Konsolen-Defekte lassen sich kostengünstig reparieren. Bringen Sie Ihre Konsole vorbei – wir helfen gerne!</p>
        `,
        category: categories['spielekonsolen']._id,
        tags: [tags['reparatur']._id, tags['wartung']._id, tags['tipps']._id],
        author: adminUser._id,
        status: 'published',
        publishedAt: new Date(),
        isFeatured: false
      }
    ];

    console.log('Creating blog posts...');
    for (const postData of blogPosts) {
      const existingPost = await BlogPost.findOne({ slug: postData.slug });
      if (!existingPost) {
        const post = new BlogPost(postData);
        
        // Add initial revision
        post.workflow.revisionHistory.push({
          version: 1,
          title: post.title,
          content: post.content,
          changes: 'Initiale Erstellung',
          createdBy: adminUser._id
        });

        await post.save();
        console.log(`Created blog post: ${post.title}`);
      } else {
        console.log(`Blog post already exists: ${postData.title}`);
      }
    }

    console.log('\n✅ German blog posts seeded successfully!');
    console.log('\nSummary:');
    console.log('- Categories created:', Object.keys(categories).length);
    console.log('- Tags created:', Object.keys(tags).length);
    console.log('- Blog posts created:', blogPosts.length);
    
  } catch (error) {
    console.error('Error seeding German blogs:', error);
  } finally {
    await mongoose.connection.close();
    console.log('\nDatabase connection closed');
  }
}

// Run the seeder
seedGermanBlogs();
