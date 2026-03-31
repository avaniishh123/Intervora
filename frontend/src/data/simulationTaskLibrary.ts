/**
 * simulationTaskLibrary.ts
 * Client-side fallback task library.
 * Used when the backend returns empty tasks (e.g. network error, missing JSON file).
 * Tasks are role-specific and duration-scaled.
 */

export interface SimTask {
  id: string;
  title: string;
  difficulty: 'easy' | 'medium' | 'hard';
  timeLimit: number;
  description: string;
  // coding tasks
  problemStatement?: string;
  starterCode?: string;
  language?: string;
  visibleTests?: { input: string; expected: string; description: string }[];
  hints?: string[];
  // analysis tasks
  scenario?: string;
  questions?: string[];
  evaluationCriteria?: string[];
  // context blocks
  brokenCode?: string;
  pipelineConfig?: string;
  infrastructure?: any;
  logs?: string[];
  datasetSummary?: any;
  modelResults?: any;
  testResults?: any;
  vulnerableCode?: string;
  currentArchitecture?: any;
  observabilityData?: any;
}

// ─── Software Engineer / Backend / Full Stack Q&A analysis tasks ─────────────
const CODING_TASKS: SimTask[] = [
  {
    id: 'fe-code-001',
    title: 'Fix the Binary Search Bug',
    difficulty: 'medium',
    timeLimit: 900,
    description: 'A binary search implementation has critical bugs causing infinite loops.',
    scenario: 'You are reviewing a pull request from a junior engineer. The binary search function below has multiple bugs that cause it to loop infinitely or return incorrect results. Identify every bug, explain why it is wrong, and provide the corrected implementation.',
    brokenCode: `function binarySearch(arr, target) {
  let left = 0;
  let right = arr.length;  // BUG 1

  while (left < right) {  // BUG 2
    const mid = Math.floor((left + right) / 2);
    if (arr[mid] === target) return mid;
    if (arr[mid] < target) left = mid;  // BUG 3
    else right = mid;  // BUG 4
  }
  return -1;
}`,
    questions: [
      'Identify all bugs in this binary search implementation and explain why each one is incorrect.',
      'What is the correct time complexity of binary search and how does each bug affect it?',
      'Rewrite the corrected binarySearch function with proper boundary conditions.',
      'What edge cases must a correct binary search handle? Does your fix address all of them?',
    ],
    evaluationCriteria: [
      'Identifies right = arr.length should be arr.length - 1',
      'Identifies left < right should be left <= right',
      'Identifies left = mid should be left = mid + 1',
      'Identifies right = mid should be right = mid - 1',
      'Explains O(log n) time complexity',
      'Handles empty array and single-element edge cases',
    ],
    hints: ['Check boundary conditions', 'left <= right for the loop condition', 'mid + 1 and mid - 1 to avoid infinite loop'],
  },
  {
    id: 'fe-code-002',
    title: 'Diagnose a Memory Leak in Node.js',
    difficulty: 'hard',
    timeLimit: 1200,
    description: 'A Node.js service is leaking memory and crashing after 24 hours in production.',
    scenario: "Your team's Node.js API server crashes every 24 hours with an out-of-memory error. The heap grows from 200MB to 2GB over time. Review the code below and diagnose the root cause.",
    brokenCode: `const requestCache = {};

app.get('/data/:id', async (req, res) => {
  const { id } = req.params;
  if (!requestCache[id]) {
    requestCache[id] = await fetchFromDB(id); // never evicted
  }
  // Event listener added on every request — never removed
  process.on('uncaughtException', (err) => {
    console.error('Error for request', id, err);
  });
  res.json(requestCache[id]);
});`,
    questions: [
      'Identify all memory leak sources in this code and explain the mechanism of each leak.',
      'Why is adding event listeners inside a request handler particularly dangerous?',
      'How would you implement a proper bounded cache with TTL (time-to-live) eviction?',
      'What Node.js tools and techniques would you use to diagnose a memory leak in production?',
    ],
    evaluationCriteria: [
      'Identifies unbounded requestCache as primary leak',
      'Identifies event listener accumulation on process object',
      'Proposes LRU cache or TTL-based eviction',
      'Mentions heap profiling tools (--inspect, clinic.js)',
    ],
    hints: ['Look at what grows unboundedly', 'Event listeners on process accumulate', 'Consider LRU or TTL caching'],
  },
  {
    id: 'fe-code-003',
    title: 'Design a URL Shortener System',
    difficulty: 'hard',
    timeLimit: 1200,
    description: 'Design a scalable URL shortener handling 100M URLs and 10B redirects/month.',
    scenario: 'You are the lead engineer designing a URL shortener (like bit.ly). The system must handle 100 million stored URLs and 10 billion redirect requests per month. Design the architecture, data model, and key algorithms.',
    questions: [
      'Estimate the storage and throughput requirements. How many redirects per second must the system handle?',
      'Design the database schema and explain your choice of database. How would you generate unique short codes?',
      'How would you design the caching layer to handle the read-heavy workload? What cache eviction policy would you use?',
      'What are the failure modes of this system and how would you handle high availability?',
    ],
    evaluationCriteria: [
      'Correctly estimates ~3,800 redirects/second',
      'Proposes base62 encoding or hash-based short code generation',
      'Identifies read-heavy nature and proposes Redis/CDN caching',
      'Addresses single points of failure with replication',
    ],
    hints: ['Calculate: 10B / (30 days × 86400 seconds)', 'Base62 gives 62^6 = 56B unique codes', 'Cache hit rate should be >99%'],
  },
  {
    id: 'fe-code-004',
    title: 'Implement an LRU Cache — Design & Analysis',
    difficulty: 'hard',
    timeLimit: 1200,
    description: 'Analyze and design an LRU cache with O(1) get and put operations.',
    scenario: 'You need to implement an LRU (Least Recently Used) cache for a high-traffic API. The cache must support O(1) get and put operations. Explain your design choices and analyze the trade-offs.',
    questions: [
      'What data structures would you combine to achieve O(1) get and put? Explain why each is needed.',
      'Walk through the put operation step by step when the cache is at capacity.',
      'What are the thread-safety concerns for an LRU cache in a concurrent environment?',
      'How would you extend this to a distributed LRU cache across multiple servers?',
    ],
    evaluationCriteria: [
      'Identifies HashMap + Doubly Linked List combination',
      'Correctly explains O(1) access via HashMap and O(1) eviction via DLL',
      'Describes put: add to front, evict from tail if at capacity',
      'Mentions mutex/lock for thread safety',
      'Discusses consistent hashing for distributed version',
    ],
    hints: ['HashMap gives O(1) lookup', 'Doubly linked list gives O(1) insertion/deletion', 'JavaScript Map preserves insertion order'],
  },
  {
    id: 'fe-code-005',
    title: 'Async Concurrency Control',
    difficulty: 'hard',
    timeLimit: 1200,
    description: 'Design and analyze an async task queue with concurrency limiting.',
    scenario: 'Your team needs to process thousands of API calls but the external API has a rate limit of 10 concurrent requests. Design an async queue that limits concurrency and handles failures gracefully.',
    questions: [
      'Explain the concept of a concurrency-limited async queue. How does it differ from a simple Promise.all?',
      'What happens to queued tasks when a running task fails? How would you implement retry logic?',
      'How would you implement backpressure to prevent the queue from growing unboundedly?',
      'What metrics would you expose to monitor the health of this queue in production?',
    ],
    evaluationCriteria: [
      'Explains Promise.all runs all concurrently vs queue limits to N',
      'Describes task failure isolation and retry with exponential backoff',
      'Proposes max queue size with rejection or blocking',
      'Mentions queue depth, throughput, error rate as key metrics',
    ],
    hints: ['Track running count and pending queue', 'When a task finishes, dequeue next', 'Exponential backoff for retries'],
  },
];

// ─── Frontend Developer tasks ─────────────────────────────────────────────────
const FRONTEND_TASKS: SimTask[] = [
  {
    id: 'front-001',
    title: 'Debug a React Component Re-render Loop',
    difficulty: 'medium',
    timeLimit: 900,
    description: 'A React component is causing infinite re-renders. Identify and fix the issue.',
    scenario: 'A developer wrote a UserProfile component that fetches user data. It causes an infinite loop of API calls. Review the code and fix all issues.',
    brokenCode: `function UserProfile({ userId }) {
  const [user, setUser] = useState(null);

  // BUG 1: Missing dependency array causes re-run on every render
  useEffect(() => {
    fetch(\`/api/users/\${userId}\`)
      .then(r => r.json())
      .then(data => setUser(data)); // BUG 2: setUser triggers re-render → useEffect runs again
  });

  // BUG 3: Object created inline causes new reference every render
  const style = { color: 'blue', fontSize: 16 };

  return <div style={style}>{user?.name}</div>;
}`,
    questions: [
      'What causes the infinite re-render loop? Explain the React lifecycle involved.',
      'Fix the useEffect to run only when userId changes.',
      'What is the performance issue with the inline style object? How do you fix it?',
      'How would you add loading and error states to this component?',
    ],
    evaluationCriteria: ['Identifies missing dependency array', 'Fixes useEffect([userId])', 'Moves style outside component or uses useMemo', 'Adds loading/error handling'],
  },
  {
    id: 'front-002',
    title: 'Implement Responsive Navigation',
    difficulty: 'easy',
    timeLimit: 600,
    description: 'Design and implement a responsive navigation component.',
    scenario: 'Build a navigation bar that collapses into a hamburger menu on mobile (< 768px). It must be accessible and keyboard-navigable.',
    questions: [
      'Describe your HTML structure for the navigation. Why did you choose this structure?',
      'How do you handle the hamburger toggle with CSS only vs JavaScript? What are the tradeoffs?',
      'What ARIA attributes are needed for accessibility?',
      'How do you trap focus inside the mobile menu when it is open?',
    ],
    evaluationCriteria: ['Semantic HTML (nav, ul, li)', 'CSS media query approach', 'ARIA-expanded and aria-controls', 'Focus trap implementation'],
  },
  {
    id: 'front-003',
    title: 'Optimize a Slow List Rendering',
    difficulty: 'hard',
    timeLimit: 1200,
    description: 'A list of 10,000 items is causing the page to freeze. Apply virtualization.',
    scenario: 'An e-commerce product list renders 10,000 items at once. The initial render takes 4 seconds and scrolling is janky. Diagnose and fix the performance issues.',
    questions: [
      'What is virtual scrolling / windowing? How does it solve this problem?',
      'Describe how you would implement a basic virtual list without a library.',
      'What React-specific optimizations (memo, useMemo, useCallback) would you apply and where?',
      'How would you measure the performance improvement? What metrics matter?',
    ],
    evaluationCriteria: ['Explains virtual scrolling correctly', 'Describes visible window calculation', 'Applies React.memo correctly', 'Mentions Lighthouse / React DevTools Profiler'],
  },
];

// ─── AI/ML Engineer tasks ─────────────────────────────────────────────────────
const AIML_TASKS: SimTask[] = [
  {
    id: 'aiml-fe-001',
    title: 'Fix the Preprocessing Pipeline',
    difficulty: 'medium',
    timeLimit: 900,
    description: 'A data preprocessing pipeline has data leakage bugs.',
    scenario: 'A Python preprocessing pipeline for a classification task has issues with missing value handling, feature scaling, and data leakage. Identify and fix all issues.',
    brokenCode: `def preprocess(df):
    # Fill missing values with mean (BUG: uses full dataset mean)
    df.fillna(df.mean(), inplace=True)

    X = df.drop('target', axis=1)
    y = df['target']
    X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2)

    # BUG: scaler fit on ALL data before split — data leakage
    scaler = StandardScaler()
    X_scaled = scaler.fit_transform(X)
    X_train_scaled = X_scaled[:len(X_train)]
    X_test_scaled = X_scaled[len(X_train):]

    return X_train_scaled, X_test_scaled, y_train, y_test`,
    questions: [
      'What is data leakage and why is it a problem in this pipeline?',
      'Why should we fit the scaler only on training data?',
      'Rewrite the preprocess function correctly.',
      'What other preprocessing steps might be needed?',
    ],
    evaluationCriteria: ['Identifies data leakage', 'Fixes split order', 'Fits scaler on train only', 'Mentions reproducibility (random_state)'],
  },
  {
    id: 'aiml-fe-002',
    title: 'Model Evaluation & Overfitting Analysis',
    difficulty: 'hard',
    timeLimit: 1200,
    description: 'Analyze model evaluation results and recommend improvements.',
    scenario: 'You trained a Random Forest classifier. Training accuracy is 98% but validation accuracy is 67%. Analyze and provide a structured improvement plan.',
    modelResults: {
      train_accuracy: 0.98, val_accuracy: 0.67,
      train_f1: 0.97, val_f1: 0.61,
      confusion_matrix: [[450, 50], [120, 380]],
      current_params: { n_estimators: 500, max_depth: null, min_samples_split: 2 },
    },
    questions: [
      'What problem does this model have? Explain with evidence from the metrics.',
      'List 3 specific hyperparameter changes you would make and why.',
      'What additional techniques beyond hyperparameter tuning would you apply?',
      'How would you validate that your changes actually improved the model?',
    ],
    evaluationCriteria: ['Correctly identifies overfitting', 'Proposes valid regularization', 'Mentions cross-validation', 'Discusses bias-variance tradeoff'],
  },
  {
    id: 'aiml-fe-003',
    title: 'Feature Engineering for Tabular Data',
    difficulty: 'medium',
    timeLimit: 900,
    description: 'Design feature engineering for a loan default prediction task.',
    scenario: 'You have a loan dataset with columns: age, income, loan_amount, employment_years, credit_score, num_previous_loans, default (target). Design a feature engineering strategy.',
    datasetSummary: {
      rows: 50000, target: 'default', defaultRate: '8.3%',
      columns: ['age', 'income', 'loan_amount', 'employment_years', 'credit_score', 'num_previous_loans'],
    },
    questions: [
      'What new features would you engineer from the existing columns? Give at least 5 with reasoning.',
      'How would you handle the class imbalance (8.3% default rate)?',
      'Which features do you expect to be most predictive and why?',
      'What feature selection techniques would you apply?',
    ],
    evaluationCriteria: ['Creates ratio features (loan_to_income)', 'Addresses class imbalance (SMOTE/class_weight)', 'Justifies feature importance', 'Mentions correlation analysis'],
  },
];

// ─── Cloud Engineer tasks ─────────────────────────────────────────────────────
const CLOUD_TASKS: SimTask[] = [
  {
    id: 'cloud-fe-001',
    title: 'Diagnose Misconfigured Infrastructure',
    difficulty: 'hard',
    timeLimit: 1200,
    description: 'A production app has 502 errors and high latency. Diagnose the infrastructure.',
    scenario: 'You are on-call. Monitoring shows 502 errors at 15% and p99 latency at 8 seconds. Review the infrastructure config and identify all issues.',
    infrastructure: {
      loadBalancer: { healthCheck: { interval: 300, threshold: 10, timeout: 5 }, idleTimeout: 60 },
      autoScaling: { minInstances: 1, maxInstances: 3, scaleOutCooldown: 600, cpuThreshold: 90 },
      ec2: { instanceType: 't2.micro', multiAZ: false },
      rds: { instanceType: 'db.t2.micro', multiAZ: false, backupRetention: 0, maxConnections: 66 },
      cache: 'none',
    },
    questions: [
      'List all infrastructure issues and their severity (Critical/High/Medium/Low).',
      'What is the most likely root cause of the 502 errors right now?',
      'Write a prioritized remediation plan for the next 24 hours.',
      'What would the ideal architecture look like for this workload?',
    ],
    evaluationCriteria: ['Identifies health check misconfiguration', 'Spots single AZ risk', 'Recognizes scaling issues', 'Proposes caching strategy'],
  },
  {
    id: 'cloud-fe-002',
    title: 'Cost Optimization Architecture Review',
    difficulty: 'medium',
    timeLimit: 900,
    description: 'Review a cloud architecture and identify cost optimization opportunities.',
    scenario: 'A startup spends $12,000/month on AWS. The CTO wants to cut costs by 40% without impacting availability. Review their setup.',
    currentArchitecture: {
      compute: '10x m5.xlarge EC2 On-Demand running 24/7',
      database: 'RDS Multi-AZ db.r5.2xlarge (always on)',
      storage: '500GB gp2 EBS per instance',
      cdn: 'None',
      dataTransfer: '5TB/month outbound',
      environments: 'Production and staging use identical infrastructure',
    },
    questions: [
      'What are the top 5 cost optimization opportunities?',
      'How would you handle the staging environment differently?',
      'What Reserved Instance or Savings Plan strategy would you recommend?',
      'How would adding a CDN impact both cost and performance?',
    ],
    evaluationCriteria: ['Identifies Reserved Instances', 'Suggests auto-scaling', 'Recommends CDN', 'Addresses staging waste'],
  },
  {
    id: 'cloud-fe-003',
    title: 'Design a Multi-Region Disaster Recovery Plan',
    difficulty: 'hard',
    timeLimit: 1200,
    description: 'Design a DR strategy for a financial services application.',
    scenario: 'A fintech company processes $2M/hour in transactions. They need an RTO of 15 minutes and RPO of 1 minute. Design their disaster recovery architecture.',
    questions: [
      'What DR strategy (Backup/Restore, Pilot Light, Warm Standby, Active-Active) would you choose and why?',
      'How do you achieve RPO of 1 minute for the database?',
      'Describe the failover process step by step.',
      'What are the cost implications of your chosen strategy?',
    ],
    evaluationCriteria: ['Chooses appropriate DR tier', 'Explains RDS Multi-AZ + read replicas', 'Describes Route53 health checks', 'Estimates cost tradeoffs'],
  },
];

// ─── DevOps Engineer tasks ────────────────────────────────────────────────────
const DEVOPS_TASKS: SimTask[] = [
  {
    id: 'devops-fe-001',
    title: 'Debug Failing CI/CD Pipeline',
    difficulty: 'medium',
    timeLimit: 900,
    description: 'A CI/CD pipeline fails 40% of the time. Diagnose and fix it.',
    scenario: 'Your deployment pipeline has been failing intermittently for 3 days. Review the config and error logs.',
    pipelineConfig: `name: Deploy to Production
on:
  push:
    branches: [main]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2
      - run: npm test

  build:
    runs-on: ubuntu-latest  # BUG: no dependency on test
    steps:
      - uses: actions/checkout@v2
      - run: docker build -t myapp:latest .
      - run: |
          docker login -u $DOCKER_USER -p $DOCKER_PASS  # BUG: password in plain text
          docker push myapp:latest

  deploy:
    runs-on: ubuntu-latest  # BUG: no dependency on build
    steps:
      - run: ssh deploy@prod-server 'docker pull myapp:latest && docker restart myapp'`,
    questions: [
      'List all issues in this pipeline configuration.',
      'Why does the deploy job sometimes run even when tests fail?',
      'Rewrite the pipeline with proper job dependencies and fixes.',
      'How would you add rollback capability?',
    ],
    evaluationCriteria: ['Identifies missing needs: [test, build]', 'Spots credential exposure', 'Recommends caching', 'Proposes rollback strategy'],
  },
  {
    id: 'devops-fe-002',
    title: 'Production Incident Response',
    difficulty: 'hard',
    timeLimit: 1200,
    description: 'Respond to a production incident using observability data.',
    scenario: 'It is 3pm Friday. Your e-commerce site is degraded. Orders are failing. You have 15 minutes to diagnose and mitigate.',
    observabilityData: {
      metrics: {
        requestRate: '2,400 req/min (normal: 1,800)',
        errorRate: '12% (normal: 0.1%)',
        p99Latency: '4,200ms (normal: 180ms)',
        cpuUsage: '92%',
        dbConnections: '498/500 (at limit)',
        cacheHitRate: '12% (normal: 85%)',
      },
      recentChanges: ['10:30am - Deployed new product recommendation feature', '2:45pm - Traffic spike from marketing email'],
      topSlowQueries: ['SELECT * FROM products JOIN recommendations — avg 2,100ms', 'SELECT COUNT(*) FROM orders WHERE created_at > NOW() - INTERVAL 30 DAY — no index'],
    },
    questions: [
      'What is the root cause? Walk through your reasoning.',
      'What are your immediate mitigation steps (next 15 minutes)?',
      'What is the permanent fix for each identified issue?',
      'What monitoring would have caught this earlier?',
    ],
    evaluationCriteria: ['Identifies N+1 query as root cause', 'Suggests feature flag disable', 'Proposes query optimization', 'Mentions proactive load testing'],
  },
];

// ─── Cybersecurity Engineer tasks ─────────────────────────────────────────────
const CYBERSECURITY_TASKS: SimTask[] = [
  {
    id: 'sec-fe-001',
    title: 'Security Incident Triage',
    difficulty: 'hard',
    timeLimit: 1200,
    description: 'Analyze security logs and triage a potential breach.',
    scenario: 'At 2:47 AM, automated alerts fired for unusual activity. Review the logs and perform incident triage.',
    logs: [
      '02:31:14 - AUTH - admin@company.com - LOGIN_FAILED - IP: 185.220.101.45 - attempt 1',
      '02:31:22 - AUTH - admin@company.com - LOGIN_FAILED - IP: 185.220.101.45 - attempt 2',
      '02:31:45 - AUTH - admin@company.com - LOGIN_SUCCESS - IP: 185.220.101.45',
      '02:32:01 - API - GET /api/users?limit=10000 - 200 OK - 2.3MB',
      '02:32:15 - API - GET /api/users/export?format=csv - 200 OK - 8.7MB',
      '02:32:44 - API - GET /api/payments/history?all=true - 200 OK - 4.1MB',
      '02:33:45 - AUTH - admin@company.com - LOGOUT - IP: 185.220.101.45',
    ],
    questions: [
      'What type of attack occurred? Classify the incident severity (P1/P2/P3/P4).',
      'What is the timeline of the attack? What did the attacker accomplish?',
      'What immediate containment actions should you take RIGHT NOW?',
      'What notifications are required (legal, regulatory, users)?',
    ],
    evaluationCriteria: ['Identifies credential stuffing + data exfiltration', 'Classifies as P1', 'Immediate: disable account, block IP', 'Identifies GDPR breach notification'],
  },
  {
    id: 'sec-fe-002',
    title: 'Vulnerable Code Review',
    difficulty: 'medium',
    timeLimit: 900,
    description: 'Review Node.js API code for security vulnerabilities.',
    scenario: 'You are reviewing a pull request for a Node.js REST API. Identify all security vulnerabilities and explain how to fix them.',
    vulnerableCode: `const express = require('express');
const mysql = require('mysql');
const app = express();

const db = mysql.createConnection({
  host: 'localhost',
  user: 'root',
  password: 'password123',  // VULN: hardcoded credentials
  database: 'users'
});

app.get('/user', (req, res) => {
  const userId = req.query.id;
  // VULN: SQL injection
  const query = \`SELECT * FROM users WHERE id = \${userId}\`;
  db.query(query, (err, results) => {
    res.json(results);  // VULN: exposes all fields
  });
});

app.post('/login', (req, res) => {
  const { username, password } = req.body;
  // VULN: SQL injection + plaintext password comparison
  const query = \`SELECT * FROM users WHERE username='\${username}' AND password='\${password}'\`;
  db.query(query, (err, results) => {
    if (results.length > 0) {
      res.json({ token: 'hardcoded-secret-token' });  // VULN: hardcoded token
    }
  });
});`,
    questions: [
      'List all security vulnerabilities ordered by severity.',
      'Rewrite the /login endpoint securely.',
      'What security headers should this API include?',
      'How would you implement proper authentication?',
    ],
    evaluationCriteria: ['Identifies SQL injection', 'Identifies hardcoded credentials', 'Proposes parameterized queries', 'Mentions bcrypt + proper JWT'],
  },
];

// ─── Data Scientist tasks ─────────────────────────────────────────────────────
const DATASCIENCE_TASKS: SimTask[] = [
  {
    id: 'ds-fe-001',
    title: 'Customer Churn Dataset Investigation',
    difficulty: 'medium',
    timeLimit: 1200,
    description: 'Investigate a customer churn dataset and provide actionable insights.',
    scenario: 'You are a data scientist at a telecom company. The business team wants to understand why customers are churning.',
    datasetSummary: {
      rows: 7043, target: 'Churn', churnRate: '26.5%',
      churnByContract: { 'Month-to-month': '43%', 'One year': '11%', 'Two year': '3%' },
      churnByTenure: { '0-12 months': '48%', '13-24 months': '28%', '25+ months': '12%' },
      missingValues: { TotalCharges: 11 },
    },
    questions: [
      'What are the top 3 factors driving customer churn? Explain your reasoning.',
      'What business recommendations would you make to reduce churn by 10%?',
      'How would you handle the missing values in TotalCharges?',
      'What features would you engineer for a churn prediction model?',
    ],
    evaluationCriteria: ['Identifies contract type and tenure as key drivers', 'Provides actionable recommendations', 'Correctly handles missing data', 'Proposes relevant feature engineering'],
  },
  {
    id: 'ds-fe-002',
    title: 'A/B Test Results Analysis',
    difficulty: 'hard',
    timeLimit: 900,
    description: 'Analyze A/B test results and make a data-driven recommendation.',
    scenario: 'Your team ran an A/B test on a new checkout flow. Analyze the results.',
    testResults: {
      control: { visitors: 10234, conversions: 1023, conversionRate: '10.0%', avgOrderValue: 85.20 },
      treatment: { visitors: 10189, conversions: 1120, conversionRate: '11.0%', avgOrderValue: 82.10 },
      pValue: 0.023, confidenceLevel: '95%',
      segmentData: { mobile: { control: '8.2%', treatment: '12.1%' }, desktop: { control: '12.5%', treatment: '10.2%' } },
    },
    questions: [
      'Is the result statistically significant? Should we ship the new checkout flow?',
      'What does the segment data reveal? How does it change your recommendation?',
      'What is the practical significance vs statistical significance here?',
      'What risks do you see in shipping this change?',
    ],
    evaluationCriteria: ['Correctly interprets p-value', 'Identifies Simpson\'s paradox in segment data', 'Distinguishes statistical vs practical significance', 'Provides nuanced recommendation'],
  },
  {
    id: 'ds-fe-003',
    title: 'SQL Query Optimization',
    difficulty: 'medium',
    timeLimit: 900,
    description: 'Optimize slow SQL queries for a reporting dashboard.',
    scenario: 'A reporting dashboard is timing out. The queries below take 45+ seconds. Analyze and optimize them.',
    brokenCode: `-- Query 1: Monthly revenue report (45 seconds)
SELECT
  DATE_FORMAT(created_at, '%Y-%m') as month,
  SUM(amount) as revenue,
  COUNT(*) as order_count
FROM orders
WHERE status = 'completed'
GROUP BY DATE_FORMAT(created_at, '%Y-%m')
ORDER BY month DESC;

-- Query 2: Top customers (38 seconds)
SELECT
  u.email,
  COUNT(o.id) as order_count,
  SUM(o.amount) as total_spent
FROM users u
LEFT JOIN orders o ON u.id = o.user_id
WHERE o.created_at > '2024-01-01'
GROUP BY u.id
ORDER BY total_spent DESC
LIMIT 100;`,
    questions: [
      'What indexes would you add to speed up these queries?',
      'What is wrong with using DATE_FORMAT in the WHERE/GROUP BY clause?',
      'Rewrite Query 2 to fix the LEFT JOIN + WHERE filter anti-pattern.',
      'How would you use query caching or materialized views for this dashboard?',
    ],
    evaluationCriteria: ['Identifies missing indexes on created_at, status', 'Explains function on column prevents index use', 'Fixes LEFT JOIN to INNER JOIN or moves filter', 'Mentions materialized views / caching'],
  },
];

// ─── Role → task pool mapping ─────────────────────────────────────────────────
const TASK_POOLS: Record<string, SimTask[]> = {
  'Software Engineer':      CODING_TASKS,   // Q&A analysis tasks (coding-qa.json equivalent)
  'Backend Developer':      CODING_TASKS,
  'Full Stack Developer':   CODING_TASKS,
  'Frontend Developer':     FRONTEND_TASKS,
  'AI/ML Engineer':         AIML_TASKS,
  'Cloud Engineer':         CLOUD_TASKS,
  'DevOps Engineer':        DEVOPS_TASKS,
  'Cybersecurity Engineer': CYBERSECURITY_TASKS,
  'Data Scientist':         DATASCIENCE_TASKS,
};

/**
 * Returns duration-scaled tasks for a given role.
 * Used as a fallback when the backend returns empty tasks.
 */
export function getFallbackTasks(role: string, durationMin: number): SimTask[] {
  const pool = TASK_POOLS[role] ?? CODING_TASKS;

  let count: number;
  if (durationMin <= 5)       count = 1;
  else if (durationMin <= 10) count = Math.min(2, pool.length);
  else if (durationMin <= 15) count = Math.min(3, pool.length);
  else if (durationMin <= 25) count = Math.min(4, pool.length);
  else                        count = pool.length;

  return pool.slice(0, count);
}

/**
 * Returns the task type for a given role — all roles use analysis/Q&A format.
 */
export function getTaskType(_role: string): 'coding' | 'analysis' {
  return 'analysis';
}
