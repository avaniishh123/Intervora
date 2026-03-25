import { writeFileSync, appendFileSync } from 'fs';

const TARGET = 'frontend/src/pages/CompanyInterviewPage.tsx';

// Part 1: imports + constants (NO emoji - use text labels)
writeFileSync(TARGET, `import { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import api from '../services/api';
import { usePanelVoice, type ResponseMode } from '../hooks/usePanelVoice';
import '../styles/CompanyInterview.css';

const PANEL = [
  { id: 'tech',   name: 'Alex Chen',      title: 'Technical Lead',  avatar: 'TL', color: '#3b82f6' },
  { id: 'hiring', name: 'Sarah Mitchell', title: 'Hiring Manager',  avatar: 'HM', color: '#8b5cf6' },
  { id: 'hr',     name: 'James Park',     title: 'HR Specialist',   avatar: 'HR', color: '#10b981' },
];

interface Company { name: string; icon: string; color: string; tier: string; }

const COMPANIES: Company[] = [
  { name: 'Accenture',    icon: 'AC', color: '#a855f7', tier: 'Consulting' },
  { name: 'Adobe',        icon: 'AD', color: '#ef4444', tier: 'Tech' },
  { name: 'Airbnb',       icon: 'AB', color: '#f97316', tier: 'Tech' },
  { name: 'Amazon',       icon: 'AMZ', color: '#f59e0b', tier: 'FAANG' },
  { name: 'Apple',        icon: 'APL', color: '#6b7280', tier: 'FAANG' },
  { name: 'Atlassian',    icon: 'ATL', color: '#3b82f6', tier: 'Tech' },
  { name: 'Capgemini',    icon: 'CAP', color: '#06b6d4', tier: 'Consulting' },
  { name: 'Cisco',        icon: 'CSC', color: '#0ea5e9', tier: 'Tech' },
  { name: 'Deloitte',     icon: 'DLT', color: '#22c55e', tier: 'Consulting' },
  { name: 'Flipkart',     icon: 'FK', color: '#f59e0b', tier: 'E-Commerce' },
  { name: 'Goldman Sachs',icon: 'GS', color: '#eab308', tier: 'Finance' },
  { name: 'Google',       icon: 'G', color: '#4285f4', tier: 'FAANG' },
  { name: 'IBM',          icon: 'IBM', color: '#1d4ed8', tier: 'Tech' },
  { name: 'Infosys',      icon: 'INF', color: '#0891b2', tier: 'IT Services' },
  { name: 'Intel',        icon: 'INT', color: '#0ea5e9', tier: 'Semiconductor' },
  { name: 'JPMorgan',     icon: 'JPM', color: '#1e40af', tier: 'Finance' },
  { name: 'Meta',         icon: 'META', color: '#1877f2', tier: 'FAANG' },
  { name: 'Microsoft',    icon: 'MS', color: '#00a4ef', tier: 'FAANG' },
  { name: 'Netflix',      icon: 'NFLX', color: '#e50914', tier: 'Tech' },
  { name: 'Nvidia',       icon: 'NV', color: '#76b900', tier: 'Semiconductor' },
  { name: 'Oracle',       icon: 'ORC', color: '#ef4444', tier: 'Tech' },
  { name: 'PayPal',       icon: 'PP', color: '#003087', tier: 'Fintech' },
  { name: 'Salesforce',   icon: 'SF', color: '#00a1e0', tier: 'SaaS' },
  { name: 'Samsung',      icon: 'SAM', color: '#1428a0', tier: 'Tech' },
  { name: 'ServiceNow',   icon: 'SN', color: '#62d84e', tier: 'SaaS' },
  { name: 'Stripe',       icon: 'STR', color: '#635bff', tier: 'Fintech' },
  { name: 'TCS',          icon: 'TCS', color: '#0f4c81', tier: 'IT Services' },
  { name: 'Uber',         icon: 'UBR', color: '#000000', tier: 'Tech' },
  { name: 'Walmart',      icon: 'WMT', color: '#0071ce', tier: 'Retail' },
  { name: 'Zoho',         icon: 'ZHO', color: '#f97316', tier: 'SaaS' },
];
`, 'utf8');
console.log('Part 1 written');
