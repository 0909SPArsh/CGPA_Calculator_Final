import React, { useState } from 'react';
import { Box, Button, Step, StepLabel, Stepper, Typography, Grid, Paper, Card, CardContent } from '@mui/material';
import CourseTable from '../components/CourseTable';
import PendingCoursesTable from '../components/PendingCoursesTable';
import { calculateCGPA, calculatePredictedCGPA } from '../utils/cgpaUtils';
import CGPATrendChart from '../components/CGPATrendChart';
import ExportButtons from '../components/ExportButtons';

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
  // Group by category
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
  // Calculate gaps
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

export default function Home() {
  const [activeStep, setActiveStep] = useState(0);
  const [perfResult, setPerfResult] = useState(null);
  const [structResult, setStructResult] = useState(null);
  const [perfLoading, setPerfLoading] = useState(false);
  const [structLoading, setStructLoading] = useState(false);
  const [pendingCourses, setPendingCourses] = useState([]);

  // Handlers for file upload
  const handleUpload = async (e, endpoint, setResult, setLoading) => {
    setLoading(true);
    setResult(null);
    const file = e.target.files[0];
    if (!file) return;
    const formData = new FormData();
    formData.append('file', file);
    const res = await fetch(endpoint, {
      method: 'POST',
      body: formData,
    });
    const data = await res.json();
    setResult(data);
    setLoading(false);
  };

  // When both PDFs are parsed, compute pending courses
  React.useEffect(() => {
    if (perfResult && structResult) {
      setPendingCourses(getPendingCourses(structResult.courses, perfResult.courses));
    }
  }, [perfResult, structResult]);

  // Handlers for pending course edits
  const handlePendingGradeChange = (idx, value) => {
    setPendingCourses(prev => prev.map((c, i) => i === idx ? { ...c, expectedGrade: value } : c));
  };
  const handlePendingUnitsChange = (idx, value) => {
    setPendingCourses(prev => prev.map((c, i) => i === idx ? { ...c, units: Number(value) } : c));
  };

  // CGPA calculations
  const completedCourses = perfResult ? perfResult.courses : [];
  const requiredCourses = structResult ? structResult.courses : [];
  const currentCGPA = calculateCGPA(completedCourses);
  const predictedCGPA = calculatePredictedCGPA(completedCourses, pendingCourses);
  const { completedUnits, pendingUnits, requiredUnits } = getUnitsSummary(completedCourses, pendingCourses, requiredCourses);
  const categoryGaps = getCategoryUnitGaps(requiredCourses, completedCourses, pendingCourses);

  // Step content
  const stepContent = [
    // Step 1: Upload PDFs
    <Box key="upload">
      <Grid container spacing={3}>
        <Grid item xs={12} md={6}>
          <Paper sx={{ p: 3 }}>
            <Typography variant="h6">Performance Sheet</Typography>
            <input
              type="file"
              accept="application/pdf"
              onChange={e => handleUpload(e, '/api/parsePerformance', setPerfResult, setPerfLoading)}
              style={{ margin: '16px 0' }}
            />
            {perfLoading && <Typography>Parsing...</Typography>}
            {perfResult && (
              <Typography color="success.main">Parsed {perfResult.courses.length} courses.</Typography>
            )}
          </Paper>
        </Grid>
        <Grid item xs={12} md={6}>
          <Paper sx={{ p: 3 }}>
            <Typography variant="h6">Degree Structure</Typography>
            <input
              type="file"
              accept="application/pdf"
              onChange={e => handleUpload(e, '/api/parseStructure', setStructResult, setStructLoading)}
              style={{ margin: '16px 0' }}
            />
            {structLoading && <Typography>Parsing...</Typography>}
            {structResult && (
              <Typography color="success.main">Parsed {structResult.courses.length} required courses.</Typography>
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
    // Step 2: Review Courses
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
    // Step 3: Predict CGPA
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
    // Step 4: Export Report
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