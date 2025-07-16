import React from 'react';
import { Button, Stack } from '@mui/material';
import jsPDF from 'jspdf';
import Papa from 'papaparse';

export default function ExportButtons({ completedCourses, pendingCourses, currentCGPA, predictedCGPA, unitsSummary }) {
  const handleExportCSV = () => {
    const completed = completedCourses.map(c => ({
      Type: 'Completed',
      CourseNo: c.courseNo,
      Title: c.courseTitle,
      Units: c.units,
      Grade: c.grade,
      Semester: c.semester,
    }));
    const pending = pendingCourses.map(c => ({
      Type: 'Pending',
      CourseNo: c.courseNo,
      Title: c.courseTitle,
      Units: c.units,
      ExpectedGrade: c.expectedGrade,
      Semester: c.semester || '',
    }));
    const all = [...completed, ...pending];
    const csv = Papa.unparse(all);
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'cgpa_report.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleExportPDF = () => {
    const doc = new jsPDF();
    doc.setFontSize(16);
    doc.text('CGPA Report', 10, 15);
    doc.setFontSize(12);
    doc.text(`Current CGPA: ${currentCGPA ?? 'N/A'}`, 10, 25);
    doc.text(`Predicted CGPA: ${predictedCGPA ?? 'N/A'}`, 10, 32);
    doc.text(`Units Completed: ${unitsSummary.completedUnits}`, 10, 39);
    doc.text(`Units Pending: ${unitsSummary.pendingUnits}`, 10, 46);
    doc.text(`Units Required: ${unitsSummary.requiredUnits}`, 10, 53);
    doc.text('Completed Courses:', 10, 63);
    let y = 70;
    completedCourses.forEach(c => {
      doc.text(`${c.courseNo} | ${c.courseTitle} | ${c.units} | ${c.grade} | ${c.semester}`, 10, y);
      y += 7;
      if (y > 270) { doc.addPage(); y = 15; }
    });
    y += 7;
    doc.text('Pending Courses:', 10, y);
    y += 7;
    pendingCourses.forEach(c => {
      doc.text(`${c.courseNo} | ${c.courseTitle} | ${c.units} | ${c.expectedGrade || ''} | ${c.semester || ''}`, 10, y);
      y += 7;
      if (y > 270) { doc.addPage(); y = 15; }
    });
    doc.save('cgpa_report.pdf');
  };

  return (
    <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
      <Button variant="outlined" onClick={handleExportCSV}>Export as CSV</Button>
      <Button variant="contained" onClick={handleExportPDF}>Export as PDF</Button>
    </Stack>
  );
} 