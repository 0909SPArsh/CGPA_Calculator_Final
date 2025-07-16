import formidable from 'formidable';
import fs from 'fs';
import pdfParse from 'pdf-parse';

export const config = {
  api: {
    bodyParser: false,
    responseLimit: '10mb',
  },
};

function parsePerformanceText(text) {
  try {
    // Step 1: Find the section after 'Completed Courses/Registered Courses'
    const startIdx = text.indexOf('Completed Courses/Registered Courses');
    if (startIdx === -1) {
      console.log('Could not find "Completed Courses/Registered Courses" in text');
      return { courses: [], error: 'Could not find course section' };
    }
    let section = text.slice(startIdx);

    // Step 2: Stop at 'Pending Courses' or end of section
    const endIdx = section.indexOf('Pending Courses');
    if (endIdx !== -1) section = section.slice(0, endIdx);

    // Step 3: Split into lines and clean up
    const lines = section.split(/\r?\n/).map(l => l.trim()).filter(Boolean);

    // Step 4: Parse by blocks (courseNo, title, units, grade)
    let courses = [];
    let semester = '';
    let i = 0;
    while (i < lines.length) {
      // Detect semester header
      if (/SEMESTER/.test(lines[i])) {
        semester = lines[i];
        i++;
        continue;
      }
      // Detect course block: look for a sequence of course numbers
      if (/^[A-Z]{2,}\s*F\d{3}/.test(lines[i])) {
        // Gather course numbers
        let courseNos = [];
        while (i < lines.length && /^[A-Z]{2,}\s*F\d{3}/.test(lines[i])) {
          courseNos.push(lines[i]);
          i++;
        }
        // Gather course titles
        let courseTitles = [];
        while (i < lines.length && /[A-Z]/.test(lines[i][0])) {
          courseTitles.push(lines[i]);
          i++;
        }
        // Gather units
        let units = [];
        while (i < lines.length && /^\d+$/.test(lines[i])) {
          units.push(Number(lines[i]));
          i++;
        }
        // Gather grades
        let grades = [];
        while (i < lines.length && /^[A-F][+-]?|RC|GD|NC|R|W|I|EX|IP|P$/.test(lines[i])) {
          grades.push(lines[i]);
          i++;
        }
        // Zip together
        const n = Math.min(courseNos.length, courseTitles.length, units.length, grades.length);
        for (let j = 0; j < n; j++) {
          courses.push({
            courseNo: courseNos[j],
            courseTitle: courseTitles[j],
            units: units[j],
            grade: grades[j],
            semester
          });
        }
      } else {
        i++;
      }
    }
    console.log(`Parsed ${courses.length} courses from performance sheet`);
    return { courses };
  } catch (error) {
    console.error('Error parsing performance text:', error);
    return { courses: [], error: error.message };
  }
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
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

    console.log('Processing file:', file.originalFilename, 'Size:', file.size);

    const data = fs.readFileSync(file.filepath);
    console.log('File read successfully, size:', data.length);

    const pdfData = await pdfParse(data);
    console.log('PDF parsed successfully, text length:', pdfData.text.length);

    const parsed = parsePerformanceText(pdfData.text);
    res.status(200).json(parsed);
  } catch (error) {
    console.error('API Error:', error);
    res.status(500).json({ 
      error: 'Failed to parse PDF',
      details: error.message 
    });
  }
} 