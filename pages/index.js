import React, { useState } from 'react';
import { Box, Button, Step, StepLabel, Stepper, Typography, Grid, Paper, Card, CardContent, Alert } from '@mui/material';
import CourseTable from '../components/CourseTable';
import PendingCoursesTable from '../components/PendingCoursesTable';
import { calculateCGPA, calculatePredictedCGPA } from '../utils/cgpaUtils';
import CGPATrendChart from '../components/CGPATrendChart';
import ExportButtons from '../components/ExportButtons';
import * as pdfjsLib from 'pdfjs-dist/build/pdf';
pdfjsLib.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.js`;

const steps = [
  'Upload PDFs',
  'Review Courses',
  'Predict CGPA',
  'Export Report',
];

function getPendingCourses(required, completed) {
  const completedTitles = new Set(
    completed.map(c => c.courseTitle.trim().toLowerCase())
  );
  return required
    .filter(r => !completedTitles.has(r.courseTitle.trim().toLowerCase()))
    .map(r => ({ ...r, expectedGrade: '', units: r.unitsRequired || 0 }));
}

function getUnitsSummary(completed, pending, required) {
  const completedUnits = completed.reduce((sum, c) => sum + (c.units || 0), 0);
  const pendingUnits = pending.reduce((sum, c) => sum + (c.units || 0), 0);
  const requiredUnits = required.reduce((sum, c) => sum + (c.unitsRequired || 0), 0);
  return { completedUnits, pendingUnits, requiredUnits };
}

function getCategoryUnitGaps(required, completed, pending) {
  const requiredByCat = {};
  required.forEach(c => {
    if (!requiredByCat[c.category]) requiredByCat[c.category] = 0;
    requiredByCat[c.category] += c.unitsRequired || 0;
  });
  const completedByCat = {};
  completed.forEach(c => {
    if (!completedByCat[c.category]) completedByCat[c.category] = 0;
    completedByCat[c.category] += c.units || 0;
  });
  const pendingByCat = {};
  pending.forEach(c => {
    if (!pendingByCat[c.category]) pendingByCat[c.category] = 0;
    pendingByCat[c.category] += c.units || 0;
  });
  const gaps = [];
  for (const cat in requiredByCat) {
    const done = (completedByCat[cat] || 0) + (pendingByCat[cat] || 0);
    if (done < requiredByCat[cat]) {
      gaps.push({
        category: cat,
        required: requiredByCat[cat],
        completed: completedByCat[cat] || 0,
        pending: pendingByCat[cat] || 0,
        missing: requiredByCat[cat] - done,
      });
    }
  }
  return gaps;
}

// --- PDF Parsing Logic (moved from API routes) ---
function parsePerformanceText(text) {
  try {
    const startIdx = text.indexOf('Completed Courses/Registered Courses');
    if (startIdx === -1) {
      return { courses: [], error: 'Could not find course section' };
    }
    let section = text.slice(startIdx);
    const endIdx = section.indexOf('Pending Courses');
    if (endIdx !== -1) section = section.slice(0, endIdx);
    const lines = section.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
    let courses = [];
    let semester = '';
    let i = 0;
    while (i < lines.length) {
      if (/SEMESTER/.test(lines[i])) {
        semester = lines[i];
        i++;
        continue;
      }
      if (/^[A-Z]{2,}\s*F\d{3}/.test(lines[i])) {
        let courseNos = [];
        while (i < lines.length && /^[A-Z]{2,}\s*F\d{3}/.test(lines[i])) {
          courseNos.push(lines[i]);
          i++;
        }
        let courseTitles = [];
        while (i < lines.length && /[A-Z]/.test(lines[i][0])) {
          courseTitles.push(lines[i]);
          i++;
        }
        let units = [];
        while (i < lines.length && /^\d+$/.test(lines[i])) {
          units.push(Number(lines[i]));
          i++;
        }
        let grades = [];
        while (i < lines.length && /^[A-F][+-]?|RC|GD|NC|R|W|I|EX|IP|P$/.test(lines[i])) {
          grades.push(lines[i]);
          i++;
        }
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
  } catch (error) {
    return { courses: [], error: error.message };
  }
}

function parseStructureText(text) {
  try {
    const lines = text.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
    let categories = [];
    let inTable = false;
    for (let i = 0; i < lines.length; i++) {
      if (/^\(I\)/.test(lines[i])) inTable = true;
      if (inTable && /^Total/.test(lines[i])) break;
      if (inTable && /Requirement|Elective|Foundation|Core|Practice|Thesis|Sub-Total/i.test(lines[i])) {
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
    let courseListSection = text.split('ThefollowingcoursesareneededtomeettheGeneralInstitutionalRequirement:')[1] || '';
    let courseLines = courseListSection.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
    let courseEntries = [];
    for (let line of courseLines) {
      const match = line.match(/^([A-Za-z\s]+)-\s*(.+)$/);
      if (match) {
        const category = match[1].replace(/([a-z])([A-Z])/g, '$1 $2').trim();
        let courses = match[2].replace(/and/g, ',').split(',').map(s => s.replace(/\.$/, '').trim());
        for (let courseTitle of courses) {
          if (courseTitle) {
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
  } catch (error) {
    return { courses: [], error: error.message };
  }
}
// --- End PDF Parsing Logic ---

export default function Home() {
  const [activeStep, setActiveStep] = useState(0);
  const [perfResult, setPerfResult] = useState(null);
  const [structResult, setStructResult] = useState(null);
  const [perfLoading, setPerfLoading] = useState(false);
  const [structLoading, setStructLoading] = useState(false);
  const [pendingCourses, setPendingCourses] = useState([]);
  const [error, setError] = useState(null);

  // Client-side PDF parsing handler
  const handlePdfUpload = async (e, parser, setResult, setLoading) => {
    try {
      setError(null);
      setLoading(true);
      setResult(null);
      const file = e.target.files[0];
      if (!file) {
        setError('No file selected');
        setLoading(false);
        return;
      }
      const arrayBuffer = await file.arrayBuffer();
      const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
      let text = '';
      for (let i = 1; i <= pdf.numPages; i++) {
        const page = await pdf.getPage(i);
        const content = await page.getTextContent();
        text += content.items.map(item => item.str).join(' ') + '\n';
      }
      const parsed = parser(text);
      setResult(parsed);
    } catch (err) {
      setError(`PDF parsing failed: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  React.useEffect(() => {
    if (perfResult && structResult) {
      setPendingCourses(getPendingCourses(structResult.courses, perfResult.courses));
    }
  }, [perfResult, structResult]);

  const handlePendingGradeChange = (idx, value) => {
    setPendingCourses(prev => prev.map((c, i) => i === idx ? { ...c, expectedGrade: value } : c));
  };
  const handlePendingUnitsChange = (idx, value) => {
    setPendingCourses(prev => prev.map((c, i) => i === idx ? { ...c, units: Number(value) } : c));
  };

  const completedCourses = perfResult ? perfResult.courses : [];
  const requiredCourses = structResult ? structResult.courses : [];
  const currentCGPA = calculateCGPA(completedCourses);
  const predictedCGPA = calculatePredictedCGPA(completedCourses, pendingCourses);
  const { completedUnits, pendingUnits, requiredUnits } = getUnitsSummary(completedCourses, pendingCourses, requiredCourses);
  const categoryGaps = getCategoryUnitGaps(requiredCourses, completedCourses, pendingCourses);

  const stepContent = [
    <Box key="upload">
      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>
      )}
      <Grid container spacing={3}>
        <Grid item xs={12} md={6}>
          <Paper sx={{ p: 3 }}>
            <Typography variant="h6">Performance Sheet</Typography>
            <input
              type="file"
              accept="application/pdf"
              onChange={e => handlePdfUpload(e, parsePerformanceText, setPerfResult, setPerfLoading)}
              style={{ margin: '16px 0' }}
            />
            {perfLoading && <Typography>Parsing...</Typography>}
            {perfResult && (
              <Typography color="success.main">
                Parsed {perfResult.courses.length} courses.
                {perfResult.error && <span style={{color: 'red'}}> Warning: {perfResult.error}</span>}
              </Typography>
            )}
          </Paper>
        </Grid>
        <Grid item xs={12} md={6}>
          <Paper sx={{ p: 3 }}>
            <Typography variant="h6">Degree Structure</Typography>
            <input
              type="file"
              accept="application/pdf"
              onChange={e => handlePdfUpload(e, parseStructureText, setStructResult, setStructLoading)}
              style={{ margin: '16px 0' }}
            />
            {structLoading && <Typography>Parsing...</Typography>}
            {structResult && (
              <Typography color="success.main">
                Parsed {structResult.courses.length} required courses.
                {structResult.error && <span style={{color: 'red'}}> Warning: {structResult.error}</span>}
              </Typography>
            )}
          </Paper>
        </Grid>
      </Grid>
      <Box sx={{ mt: 4 }}>
        <Button
          variant="contained"
          color="primary"
          disabled={!(perfResult && structResult)}
          onClick={() => setActiveStep(1)}
        >
          Next: Review Courses
        </Button>
      </Box>
    </Box>,
    <Box key="review">
      <CourseTable courses={completedCourses} />
      <PendingCoursesTable
        courses={pendingCourses}
        onGradeChange={handlePendingGradeChange}
        onUnitsChange={handlePendingUnitsChange}
      />
      <Box sx={{ display: 'flex', justifyContent: 'space-between', mt: 2 }}>
        <Button onClick={() => setActiveStep(0)}>Back</Button>
        <Button
          variant="contained"
          color="primary"
          onClick={() => setActiveStep(2)}
          disabled={pendingCourses.length === 0}
        >
          Next: Predict CGPA
        </Button>
      </Box>
    </Box>,
    <Box key="predict">
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Typography variant="h6" gutterBottom>CGPA Summary</Typography>
          <Typography>Current CGPA: <b>{currentCGPA ?? 'N/A'}</b></Typography>
          <Typography>Predicted CGPA: <b>{predictedCGPA ?? 'N/A'}</b></Typography>
          <Typography>Units Completed: <b>{completedUnits}</b></Typography>
          <Typography>Units Pending: <b>{pendingUnits}</b></Typography>
          <Typography>Units Required for Graduation: <b>{requiredUnits}</b></Typography>
        </CardContent>
      </Card>
      {categoryGaps.length > 0 && (
        <Card sx={{ mb: 3, border: '1px solid #f44336' }}>
          <CardContent>
            <Typography variant="subtitle1" color="error" gutterBottom>
              Warning: The following categories have missing units for graduation:
            </Typography>
            <ul style={{ margin: 0, paddingLeft: 20 }}>
              {categoryGaps.map(gap => (
                <li key={gap.category}>
                  <b>{gap.category}:</b> {gap.missing} units missing (required: {gap.required}, completed+pending: {gap.completed + gap.pending})
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}
      <CGPATrendChart currentCGPA={currentCGPA} predictedCGPA={predictedCGPA} />
      <Box sx={{ display: 'flex', justifyContent: 'space-between', mt: 2 }}>
        <Button onClick={() => setActiveStep(1)}>Back</Button>
        <Button variant="contained" color="primary" onClick={() => setActiveStep(3)}>
          Next: Export Report
        </Button>
      </Box>
    </Box>,
    <Box key="export">
      <Typography variant="h6" gutterBottom>Export/Download Report</Typography>
      <ExportButtons
        completedCourses={completedCourses}
        pendingCourses={pendingCourses}
        currentCGPA={currentCGPA}
        predictedCGPA={predictedCGPA}
        unitsSummary={{ completedUnits, pendingUnits, requiredUnits }}
      />
      <Box sx={{ display: 'flex', justifyContent: 'flex-start', mt: 2 }}>
        <Button onClick={() => setActiveStep(2)}>Back</Button>
      </Box>
    </Box>,
  ];

  return (
    <Box sx={{ maxWidth: 900, mx: 'auto', mt: 4, p: 2 }}>
      <Typography variant="h4" align="center" gutterBottom>
        CGPA Calculator & Predictor
      </Typography>
      <Stepper activeStep={activeStep} alternativeLabel sx={{ mb: 4 }}>
        {steps.map(label => (
          <Step key={label}>
            <StepLabel>{label}</StepLabel>
          </Step>
        ))}
      </Stepper>
      <Paper sx={{ p: 3, minHeight: 400 }}>{stepContent[activeStep]}</Paper>
    </Box>
  );
} 