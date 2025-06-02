/**
 * Help texts and descriptions for various parts of the application.
 * Centralizing these texts makes it easier to maintain and update content.
 */

export const loginTexts = {
  title: 'Sign in to your account',
  subtitle: 'KCS Performance Tracking Portal',
  emailLabel: 'Email address',
  passwordLabel: 'Password',
  submitButton: 'Sign in',
  forgotPassword: 'Forgot your password?',
  needAccount: 'Need an account?',
  alreadyHaveAccount: 'Already have an account?'
};

export const registerTexts = {
  title: 'Create your account',
  subtitle: 'KCS Performance Tracking Portal',
  description: 'Join the KCS Performance Tracking Portal to monitor and improve your team\'s performance. Select your role below to get started with the appropriate permissions.',
  nameLabel: 'Full Name',
  emailLabel: 'Email address',
  passwordLabel: 'Password',
  roleLabel: 'Your Role',
  submitButton: 'Register',
  roleDescriptions: {
    coach: 'Track individual performance metrics and provide feedback to team members.',
    lead: 'Oversee team performance and coordinate with coaches to improve results.',
    manager: 'Access comprehensive analytics and manage organizational performance strategies.'
  }
};

export const roleOptions = [
  { value: 'coach', label: 'Coach' },
  { value: 'lead', label: 'Lead' }
];

export const errorMessages = {
  login: {
    invalidCredentials: 'Invalid email or password. Please try again.',
    accountLocked: 'Your account has been locked due to too many failed attempts. Please try again later.',
    serverError: 'Server error. Please try again later.',
    rateLimited: 'Too many login attempts. Please wait a moment and try again.'
  },
  register: {
    emailTaken: 'This email is already registered. Please use a different email or sign in.',
    invalidEmail: 'Please enter a valid email address.',
    passwordTooWeak: 'Password is too weak. Please use at least 8 characters including a number and a special character.',
    serverError: 'Server error. Please try again later.',
    missingRole: 'Please select your role to continue.'
  }
};

export const debugTexts = {
  title: 'Debug Information',
  userAgent: 'User Agent',
  windowSize: 'Window Size',
  localStorage: 'Local Storage',
  sessionStorage: 'Session Storage',
  authStore: 'Auth Store State',
  clearButton: 'Clear Debug Info'
};
