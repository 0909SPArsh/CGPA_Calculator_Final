import formidable from 'formidable';
import fs from 'fs';
import pdfParse from 'pdf-parse';

export const config = {
  api: {
    bodyParser: false,
  },
};

function parseStructureText(text) {
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
  return { courses: courseEntries };
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const form = new formidable.IncomingForm();
  form.parse(req, async (err, fields, files) => {
    if (err) {
      return res.status(500).json({ error: 'Error parsing the file' });
    }
    const file = files.file;
    if (!file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }
    const data = fs.readFileSync(file.filepath);
    try {
      const pdfData = await pdfParse(data);
      const parsed = parseStructureText(pdfData.text);
      res.status(200).json(parsed);
    } catch (e) {
      res.status(500).json({ error: 'Failed to parse PDF' });
    }
  });
} 