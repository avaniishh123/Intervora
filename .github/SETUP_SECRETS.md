# GitHub Actions Secrets Setup Guide

This guide explains how to configure GitHub Actions secrets for the CI/CD pipeline.

## Required Secrets

Navigate to your GitHub repository:
**Settings → Secrets and variables → Actions → New repository secret**

### 1. Vercel Deployment Secrets

#### VERCEL_TOKEN
Your Vercel authentication token.

**How to get it:**
1. Go to [Vercel Account Settings](https://vercel.com/account/tokens)
2. Click "Create Token"
3. Name it: `github-actions-ai-interview`
4. Copy the token
5. Add to GitHub as `VERCEL_TOKEN`

#### VERCEL_ORG_ID
Your Vercel organization ID.

**How to get it:**
1. Install Vercel CLI: `npm install -g vercel`
2. Login: `vercel login`
3. Link project: `cd backend && vercel link`
4. View project info: `cat .vercel/project.json`
5. Copy `orgId` value
6. Add to GitHub as `VERCEL_ORG_ID`

#### VERCEL_BACKEND_PROJECT_ID
Backend project ID in Vercel.

**How to get it:**
1. From the same `.vercel/project.json` file
2. Copy `projectId` value
3. Add to GitHub as `VERCEL_BACKEND_PROJECT_ID`

#### VERCEL_FRONTEND_PROJECT_ID
Frontend project ID in Vercel.

**How to get it:**
1. Run: `cd frontend && vercel link`
2. View: `cat .vercel/project.json`
3. Copy `projectId` value
4. Add to GitHub as `VERCEL_FRONTEND_PROJECT_ID`

### 2. API Keys

#### GEMINI_API_KEY
Your Google Gemini API key (for E2E tests).

**How to get it:**
1. Go to [Google AI Studio](https://makersuite.google.com/app/apikey)
2. Create or copy your API key
3. Add to GitHub as `GEMINI_API_KEY`

### 3. Environment URLs

#### VITE_API_URL
Production backend API URL.

**Value:**
```
https://your-backend-project.vercel.app
```

Add to GitHub as `VITE_API_URL`

#### VITE_SOCKET_URL
Production WebSocket URL (usually same as API URL).

**Value:**
```
https://your-backend-project.vercel.app
```

Add to GitHub as `VITE_SOCKET_URL`

## Optional Secrets

### AWS_ACCESS_KEY_ID
AWS access key for S3 file storage (if using AWS S3).

### AWS_SECRET_ACCESS_KEY
AWS secret key for S3 file storage (if using AWS S3).

### DATABASE_URL
Production database connection string (if needed for migrations).

## Verification

After adding all secrets, verify they're set:

1. Go to **Settings → Secrets and variables → Actions**
2. You should see all secrets listed (values are hidden)
3. Trigger a workflow to test: `git push origin main`

## Security Best Practices

1. **Never commit secrets** to the repository
2. **Rotate tokens** regularly (every 90 days)
3. **Use least privilege** - only grant necessary permissions
4. **Monitor usage** - check Vercel and GitHub Actions logs
5. **Separate environments** - use different secrets for staging/production

## Troubleshooting

### "Secret not found" error
- Verify secret name matches exactly (case-sensitive)
- Check secret is added to correct repository
- Ensure workflow has access to secrets

### Vercel deployment fails
- Verify `VERCEL_TOKEN` is valid
- Check `VERCEL_ORG_ID` and project IDs are correct
- Ensure Vercel CLI version is up to date

### E2E tests fail
- Verify `GEMINI_API_KEY` is valid and has quota
- Check API URLs are accessible
- Review test logs in Actions tab

## Quick Setup Script

Run this script to get all Vercel IDs at once:

```bash
#!/bin/bash

echo "=== Vercel Configuration ==="
echo ""

# Backend
echo "Backend Project:"
cd backend
vercel link
cat .vercel/project.json | grep -E '"orgId"|"projectId"'
echo ""

# Frontend
echo "Frontend Project:"
cd ../frontend
vercel link
cat .vercel/project.json | grep -E '"orgId"|"projectId"'
echo ""

echo "Copy these values to GitHub Secrets"
```

Save as `scripts/get-vercel-ids.sh` and run:
```bash
chmod +x scripts/get-vercel-ids.sh
./scripts/get-vercel-ids.sh
```

## Support

For issues with:
- **GitHub Actions**: [GitHub Actions Documentation](https://docs.github.com/en/actions)
- **Vercel**: [Vercel Documentation](https://vercel.com/docs)
- **Secrets Management**: [GitHub Secrets Documentation](https://docs.github.com/en/actions/security-guides/encrypted-secrets)
