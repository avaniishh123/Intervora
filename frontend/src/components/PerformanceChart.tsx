import { InterviewSession } from '../types';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  LineElement,
  PointElement,
  Title,
  Tooltip,
  Legend,
  ArcElement,
} from 'chart.js';
import { Bar, Line } from 'react-chartjs-2';
import '../styles/PerformanceChart.css';

// Register Chart.js components
ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  LineElement,
  PointElement,
  Title,
  Tooltip,
  Legend,
  ArcElement
);

interface PerformanceChartProps {
  session: InterviewSession;
}

const PerformanceChart = ({ session }: PerformanceChartProps) => {
  const { performanceReport, questions } = session;

  if (!performanceReport) {
    return null;
  }

  // Word Count Chart Data
  const wordCountData = {
    labels: questions.map((_, index) => `Q${index + 1}`),
    datasets: [
      {
        label: 'Words per Answer',
        data: performanceReport.wordCountMetrics.perQuestion,
        backgroundColor: 'rgba(102, 126, 234, 0.6)',
        borderColor: 'rgba(102, 126, 234, 1)',
        borderWidth: 2,
        borderRadius: 5,
      },
    ],
  };

  const wordCountOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'top' as const,
      },
      title: {
        display: true,
        text: 'Word Count Analysis',
        font: {
          size: 16,
          weight: 'bold' as const,
        },
      },
      tooltip: {
        callbacks: {
          label: function(context: any) {
            let label = context.dataset.label || '';
            if (label) {
              label += ': ';
            }
            label += Math.round(context.parsed.y) + ' words';
            return label;
          }
        }
      }
    },
    scales: {
      y: {
        beginAtZero: true,
        title: {
          display: true,
          text: 'Word Count',
        },
      },
      x: {
        title: {
          display: true,
          text: 'Question Number',
        },
      },
    },
  };

  // Sentiment Analysis Chart Data
  const sentimentData = {
    labels: questions.map((_, index) => `Q${index + 1}`),
    datasets: [
      {
        label: 'Confidence',
        data: questions.map(q => q.evaluation.sentiment.confidence),
        borderColor: 'rgba(75, 192, 192, 1)',
        backgroundColor: 'rgba(75, 192, 192, 0.2)',
        tension: 0.4,
        fill: true,
      },
      {
        label: 'Clarity',
        data: questions.map(q => q.evaluation.sentiment.clarity),
        borderColor: 'rgba(153, 102, 255, 1)',
        backgroundColor: 'rgba(153, 102, 255, 0.2)',
        tension: 0.4,
        fill: true,
      },
      {
        label: 'Professionalism',
        data: questions.map(q => q.evaluation.sentiment.professionalism),
        borderColor: 'rgba(255, 159, 64, 1)',
        backgroundColor: 'rgba(255, 159, 64, 0.2)',
        tension: 0.4,
        fill: true,
      },
    ],
  };

  const sentimentOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'top' as const,
      },
      title: {
        display: true,
        text: 'Communication Quality Trends',
        font: {
          size: 16,
          weight: 'bold' as const,
        },
      },
      tooltip: {
        callbacks: {
          label: function(context: any) {
            let label = context.dataset.label || '';
            if (label) {
              label += ': ';
            }
            label += Math.round(context.parsed.y) + '%';
            return label;
          }
        }
      }
    },
    scales: {
      y: {
        beginAtZero: true,
        max: 100,
        title: {
          display: true,
          text: 'Score (%)',
        },
      },
      x: {
        title: {
          display: true,
          text: 'Question Number',
        },
      },
    },
  };

  return (
    <div className="performance-charts-section">
      <h3>Detailed Analytics</h3>
      
      <div className="charts-grid">
        {/* Word Count Chart */}
        <div className="chart-container">
          <Bar data={wordCountData} options={wordCountOptions} />
          <div className="chart-summary">
            <div className="summary-item">
              <span className="summary-label">Total Words:</span>
              <span className="summary-value">{performanceReport.wordCountMetrics.total}</span>
            </div>
            <div className="summary-item">
              <span className="summary-label">Average per Answer:</span>
              <span className="summary-value">{Math.round(performanceReport.wordCountMetrics.average)}</span>
            </div>
          </div>
        </div>

        {/* Sentiment Analysis Chart */}
        <div className="chart-container">
          <Line data={sentimentData} options={sentimentOptions} />
          <div className="chart-summary">
            <div className="summary-item">
              <span className="summary-label">Overall Sentiment:</span>
              <span className="summary-value sentiment-badge">
                {performanceReport.sentimentAnalysis.overall}
              </span>
            </div>
            <div className="summary-item">
              <span className="summary-label">Avg Confidence:</span>
              <span className="summary-value">
                {Math.round(performanceReport.sentimentAnalysis.confidence)}%
              </span>
            </div>
            <div className="summary-item">
              <span className="summary-label">Avg Clarity:</span>
              <span className="summary-value">
                {Math.round(performanceReport.sentimentAnalysis.clarity)}%
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* CAR Framework Score (if mentor mode was used) */}
      {performanceReport.carFrameworkScore !== undefined && (
        <div className="car-framework-section">
          <div className="car-header">
            <h4>📋 CAR Framework Analysis</h4>
            <p className="car-description">
              Context-Action-Result framework adherence score
            </p>
          </div>
          <div className="car-score-display">
            <div className="car-score-circle">
              <svg viewBox="0 0 120 120" className="car-gauge">
                <circle
                  cx="60"
                  cy="60"
                  r="50"
                  fill="none"
                  stroke="#e0e0e0"
                  strokeWidth="10"
                />
                <circle
                  cx="60"
                  cy="60"
                  r="50"
                  fill="none"
                  stroke="#4caf50"
                  strokeWidth="10"
                  strokeDasharray={`${(performanceReport.carFrameworkScore / 100) * 314} 314`}
                  strokeLinecap="round"
                  transform="rotate(-90 60 60)"
                />
                <text
                  x="60"
                  y="65"
                  textAnchor="middle"
                  className="car-score-text"
                  fill="#4caf50"
                >
                  {performanceReport.carFrameworkScore}
                </text>
              </svg>
            </div>
            <div className="car-explanation">
              <p>
                Your answers followed the CAR framework structure, providing clear context,
                describing specific actions, and highlighting measurable results.
              </p>
              <div className="car-tips">
                <strong>CAR Framework Tips:</strong>
                <ul>
                  <li><strong>Context:</strong> Set the scene and explain the situation</li>
                  <li><strong>Action:</strong> Describe what you specifically did</li>
                  <li><strong>Result:</strong> Share the outcome and impact</li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default PerformanceChart;
