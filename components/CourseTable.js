import React from 'react';
import { Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Paper, Typography } from '@mui/material';

export default function CourseTable({ courses = [], title = 'Completed Courses' }) {
  return (
    <TableContainer component={Paper} sx={{ mb: 3 }}>
      <Typography variant="h6" sx={{ p: 2 }}>{title}</Typography>
      <Table size="small">
        <TableHead>
          <TableRow>
            <TableCell>Course No</TableCell>
            <TableCell>Title</TableCell>
            <TableCell>Units</TableCell>
            <TableCell>Grade</TableCell>
            <TableCell>Semester</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {courses.length === 0 ? (
            <TableRow>
              <TableCell colSpan={5} align="center">No courses found.</TableCell>
            </TableRow>
          ) : (
            courses.map((c, idx) => (
              <TableRow key={idx}>
                <TableCell>{c.courseNo}</TableCell>
                <TableCell>{c.courseTitle}</TableCell>
                <TableCell>{c.units}</TableCell>
                <TableCell>{c.grade}</TableCell>
                <TableCell>{c.semester}</TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </TableContainer>
  );
} 