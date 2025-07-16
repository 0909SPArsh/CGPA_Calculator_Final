import fs from 'fs';
import pdfParse from 'pdf-parse';

export const config = {
  api: {
    bodyParser: false,
    responseLimit: '10mb',
  },
};

function parseStructureText(text) {
  try {
    // Step 1: Find the main table with categories and units
    const lines = text.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
    let categories = [];
    let inTable = false;
    for (let i = 0; i < lines.length; i++) {
      if (/^\(I\)/.test(lines[i])) inTable = true;
      if (inTable && /^Total/.test(lines[i])) break;
      if (inTable && /Requirement|Elective|Foundation|Core|Practice|Thesis|Sub-Total/i.test(lines[i])) {
        // Example: Mathematics Foundation44012120
        const match = lines[i].match(/([A-Za-z\s\-/&]+)(\d+)(\d+)(\d+)(\d+)?(\d+)?(\d+)?/);
        if (match) {
          categories.push({
            category: match[1].trim(),
            numCourses: parseInt(match[2]),
            unitsRequired: parseInt(match[4]),
          });
        }
      }
    }
    
    // Step 2: Parse course lists by category from text below table
    let courseListSection = text.split('ThefollowingcoursesareneededtomeettheGeneralInstitutionalRequirement:')[1] || '';
    let courseLines = courseListSection.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
    let courseEntries = [];
    for (let line of courseLines) {
      // Example: MathematicsFoundation- MathematicsI, MathematicsII andMathematicsIII...
      const match = line.match(/^([A-Za-z\s]+)-\s*(.+)$/);
      if (match) {
        const category = match[1].replace(/([a-z])([A-Z])/g, '$1 $2').trim();
        let courses = match[2].replace(/and/g, ',').split(',').map(s => s.replace(/\.$/, '').trim());
        for (let courseTitle of courses) {
          if (courseTitle) {
            // Find unitsRequired from categories table
            let cat = categories.find(c => c.category.replace(/\s/g, '').toLowerCase().includes(category.replace(/\s/g, '').toLowerCase()));
            courseEntries.push({
              category,
              courseTitle,
              unitsRequired: cat ? cat.unitsRequired : null
            });
          }
        }
      }
    }
    
    console.log(`Parsed ${courseEntries.length} required courses from structure`);
    return { courses: courseEntries };
  } catch (error) {
    console.error('Error parsing structure text:', error);
    return { courses: [], error: error.message };
  }
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // Dynamic import to fix formidable issue
    const formidable = require('formidable');
    const form = new formidable.IncomingForm({
      maxFileSize: 10 * 1024 * 1024, // 10MB limit
    });

    const [fields, files] = await new Promise((resolve, reject) => {
      form.parse(req, (err, fields, files) => {
        if (err) reject(err);
        else resolve([fields, files]);
      });
    });

    const file = files.file;
    if (!file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    console.log('Processing structure file:', file.originalFilename, 'Size:', file.size);

    const data = fs.readFileSync(file.filepath);
    console.log('Structure file read successfully, size:', data.length);

    const pdfData = await pdfParse(data);
    console.log('Structure PDF parsed successfully, text length:', pdfData.text.length);

    const parsed = parseStructureText(pdfData.text);
    res.status(200).json(parsed);
  } catch (error) {
    console.error('Structure API Error:', error);
    res.status(500).json({ 
      error: 'Failed to parse PDF',
      details: error.message 
    });
  }
} 