// Grade to point mapping (BITS Pilani style, can be customized)
export const gradeToPoint = {
  'A': 10,
  'A-': 9,
  'B': 8,
  'B-': 7,
  'C': 6,
  'C-': 5,
  'D': 4,
  'E': 2,
  'F': 0,
  'RC': 0,
  'GD': 0,
  'NC': 0,
  'R': 0,
  'W': 0,
  'I': 0,
  'EX': 10,
  'IP': 0,
  'P': 6,
};

export function getGradePoint(grade) {
  if (!grade) return null;
  const g = grade.trim().toUpperCase();
  return gradeToPoint[g] !== undefined ? gradeToPoint[g] : null;
}

export function calculateCGPA(courses) {
  let totalPoints = 0;
  let totalUnits = 0;
  for (const c of courses) {
    const points = getGradePoint(c.grade);
    if (points !== null && c.units) {
      totalPoints += points * c.units;
      totalUnits += c.units;
    }
  }
  return totalUnits > 0 ? (totalPoints / totalUnits).toFixed(2) : null;
}

export function calculatePredictedCGPA(completed, pending) {
  let totalPoints = 0;
  let totalUnits = 0;
  for (const c of completed) {
    const points = getGradePoint(c.grade);
    if (points !== null && c.units) {
      totalPoints += points * c.units;
      totalUnits += c.units;
    }
  }
  for (const c of pending) {
    const points = getGradePoint(c.expectedGrade);
    if (points !== null && c.units) {
      totalPoints += points * c.units;
      totalUnits += c.units;
    }
  }
  return totalUnits > 0 ? (totalPoints / totalUnits).toFixed(2) : null;
} 