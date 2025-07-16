import formidable from 'formidable';
import fs from 'fs';
import pdfParse from 'pdf-parse';

export const config = {
  api: {
    bodyParser: false,
  },
};

function parsePerformanceText(text) {
  // Step 1: Find the section after 'Completed Courses/Registered Courses'
  const startIdx = text.indexOf('Completed Courses/Registered Courses');
  if (startIdx === -1) return { courses: [] };
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
  return { courses };
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
      const parsed = parsePerformanceText(pdfData.text);
      res.status(200).json(parsed);
    } catch (e) {
      res.status(500).json({ error: 'Failed to parse PDF' });
    }
  });
} 