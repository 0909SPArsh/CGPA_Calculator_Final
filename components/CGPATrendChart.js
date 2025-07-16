import React from 'react';
import { Bar } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
} from 'chart.js';

ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend);

export default function CGPATrendChart({ currentCGPA, predictedCGPA }) {
  const data = {
    labels: ['Current CGPA', 'Predicted CGPA'],
    datasets: [
      {
        label: 'CGPA',
        data: [Number(currentCGPA) || 0, Number(predictedCGPA) || 0],
        backgroundColor: ['#1976d2', '#9c27b0'],
      },
    ],
  };
  const options = {
    responsive: true,
    plugins: {
      legend: { display: false },
      title: { display: false },
    },
    scales: {
      y: {
        min: 0,
        max: 10,
        ticks: { stepSize: 1 },
        title: { display: true, text: 'CGPA' },
      },
    },
  };
  return (
    <div style={{ maxWidth: 400, margin: '0 auto' }}>
      <Bar data={data} options={options} />
    </div>
  );
} 