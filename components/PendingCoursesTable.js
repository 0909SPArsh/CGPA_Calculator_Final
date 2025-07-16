import React from 'react';
import { Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Paper, TextField, Typography, Slider, Box } from '@mui/material';

const validGrades = [
  'A', 'A-', 'B', 'B-', 'C', 'C-', 'D', 'E', 'F',
  'RC', 'GD', 'NC', 'R', 'W', 'I', 'EX', 'IP', 'P'
];

const gradeToPoint = {
  'A': 10, 'A-': 9, 'B': 8, 'B-': 7, 'C': 6, 'C-': 5, 'D': 4, 'E': 2, 'F': 0
};
const pointToGrade = {
  10: 'A', 9: 'A-', 8: 'B', 7: 'B-', 6: 'C', 5: 'C-', 4: 'D', 2: 'E', 0: 'F'
};
const sliderMarks = [
  { value: 0, label: 'F' },
  { value: 2, label: 'E' },
  { value: 4, label: 'D' },
  { value: 5, label: 'C-' },
  { value: 6, label: 'C' },
  { value: 7, label: 'B-' },
  { value: 8, label: 'B' },
  { value: 9, label: 'A-' },
  { value: 10, label: 'A' },
];

function isValidGrade(grade) {
  if (!grade) return true;
  return validGrades.includes(grade.trim().toUpperCase());
}

function gradeToSliderValue(grade) {
  const g = grade ? grade.trim().toUpperCase() : '';
  return gradeToPoint[g] !== undefined ? gradeToPoint[g] : '';
}

function sliderValueToGrade(val) {
  return pointToGrade[val] !== undefined ? pointToGrade[val] : '';
}

export default function PendingCoursesTable({ courses = [], onGradeChange, onUnitsChange, title = 'Pending Courses' }) {
  return (
    <TableContainer component={Paper} sx={{ mb: 3 }}>
      <Typography variant="h6" sx={{ p: 2 }}>{title}</Typography>
      <Table size="small">
        <TableHead>
          <TableRow>
            <TableCell>Course No</TableCell>
            <TableCell>Title</TableCell>
            <TableCell>Units</TableCell>
            <TableCell>Expected Grade</TableCell>
            <TableCell>What-if Slider</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {courses.length === 0 ? (
            <TableRow>
              <TableCell colSpan={5} align="center">No pending courses found.</TableCell>
            </TableRow>
          ) : (
            courses.map((c, idx) => {
              const grade = c.expectedGrade || '';
              const error = grade && !isValidGrade(grade);
              const sliderVal = gradeToSliderValue(grade);
              return (
                <TableRow key={idx}>
                  <TableCell>{c.courseNo}</TableCell>
                  <TableCell>{c.courseTitle}</TableCell>
                  <TableCell>
                    <TextField
                      type="number"
                      value={c.units}
                      size="small"
                      onChange={e => onUnitsChange(idx, e.target.value)}
                      inputProps={{ min: 0, style: { width: 60 } }}
                    />
                  </TableCell>
                  <TableCell>
                    <TextField
                      value={grade}
                      size="small"
                      onChange={e => onGradeChange(idx, e.target.value)}
                      placeholder="A, B, C..."
                      inputProps={{ style: { width: 60 } }}
                      error={error}
                      helperText={error ? 'Invalid grade' : ''}
                    />
                  </TableCell>
                  <TableCell>
                    <Box sx={{ minWidth: 120 }}>
                      <Slider
                        value={sliderVal === '' ? 0 : sliderVal}
                        min={0}
                        max={10}
                        step={null}
                        marks={sliderMarks}
                        onChange={(_, val) => onGradeChange(idx, sliderValueToGrade(val))}
                        valueLabelDisplay="off"
                        disabled={sliderVal === '' && !grade}
                      />
                    </Box>
                  </TableCell>
                </TableRow>
              );
            })
          )}
        </TableBody>
      </Table>
    </TableContainer>
  );
} 